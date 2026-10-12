"""Forecast regression checks use isolated source data; no external providers or production writes."""
from datetime import datetime, timedelta
from math import isfinite
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, insert, select, update
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.adapters.campus_a import CampusAAdapter, parse_scalar
from app.analytics import forecast as forecasts
from app.analytics import forecast_engine as engine
from app.db import get_metadata, get_table, get_session
from app.main import app

AS_OF = datetime.fromisoformat('2026-10-08T12:00:00+05:30')


@pytest.fixture(scope='module')
def database():
    bind = create_engine('sqlite+pysqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    get_metadata().create_all(bind)
    adapter = CampusAAdapter()
    names = ['location_dim', 'registry_tanks', 'registry_bins', 'registry_assets', 'registry_outdoor_areas',
             'registry_emission_factors', 'registry_zones_climate', 'energy_building_hourly', 'energy_floor_hourly', 'occupancy_hourly',
             'water_hourly', 'water_tank_levels', 'waste_hourly', 'traffic_parking', 'air_environment',
             'weather', 'climate_resilience', 'assets_equipment', 'safety_incidents', 'sustainability', 'emissions']
    with Session(bind) as session:
        for name in names:
            frame = adapter.extract(name)
            if name in {'energy_building_hourly', 'energy_floor_hourly', 'occupancy_hourly', 'emissions'}:
                frame = frame[frame.building_id.isin(['Academic', 'Library'])]
            elif name == 'water_hourly':
                frame = frame[frame.meter_id.isin(['M01', 'M03'])]
            elif name == 'waste_hourly':
                frame = frame[frame.bin_id.isin(['Academic_F0_B1', 'Academic_F0_B2'])]
            elif name == 'assets_equipment':
                frame = frame[frame.asset_id.isin(frame.asset_id.unique()[:2])]
            if not frame.empty:
                session.execute(insert(get_table(name)), [{key: parse_scalar(value) for key, value in row.items()}
                    for row in frame.to_dict(orient='records')])
        session.commit()
    forecasts._MODEL_CACHE.clear()
    yield bind
    forecasts._MODEL_CACHE.clear()
    bind.dispose()


@pytest.mark.parametrize('target', [target for target in engine.load_forecast_targets() if target['method'] != 'pending'], ids=lambda target: target['id'])
def test_catalogue_target_returns_finite_ordered_bands(database, target):
    with Session(database) as session:
        response = forecasts.forecast(target['domain'], 'F01', AS_OF, session,
                                      metric=target['metric'], horizon=target['horizons'][0])
    assert response['forecasts'], target['id']
    for entity in response['forecasts']:
        assert entity['series']
        for point in entity['series']:
            assert all(isfinite(point[key]) for key in ('value', 'lower', 'upper'))
            assert point['lower'] <= point['value'] <= point['upper']


def test_hour_scope_metric_cache_isolation_and_copy(database):
    with Session(database) as session:
        campus = forecasts.forecast('energy', 'F01', AS_OF, session)
        scoped = forecasts.forecast('energy', 'Library', AS_OF, session)
        later = forecasts.forecast('energy', 'F01', AS_OF + timedelta(hours=1), session)
        assert len(campus['forecasts']) > len(scoped['forecasts']) == 1
        assert scoped['forecasts'][0]['entity_id'] == 'Library'
        assert later['as_of'] != campus['as_of']
        assert later['forecasts'][0]['series'][0]['timestamp'] != campus['forecasts'][0]['series'][0]['timestamp']
        aqi = forecasts.forecast('air', 'F01', AS_OF, session, metric='aqi_cpcb')
        pm25 = forecasts.forecast('air', 'F01', AS_OF, session, metric='pm25')
        assert aqi['forecasts'][0]['series'] != pm25['forecasts'][0]['series']
        campus['forecasts'][0]['series'][0]['value'] = -999
        assert forecasts.forecast('energy', 'F01', AS_OF, session)['forecasts'][0]['series'][0]['value'] >= 0


def test_no_future_row_leakage_after_cache_clear(database):
    isolated = create_engine('sqlite+pysqlite:///:memory:')
    get_metadata().create_all(isolated)
    with Session(database) as source, Session(isolated) as destination:
        for name in ('location_dim', 'registry_tanks', 'registry_bins', 'registry_assets', 'registry_outdoor_areas',
                     'registry_emission_factors', 'registry_zones_climate', 'energy_building_hourly', 'energy_floor_hourly',
                     'occupancy_hourly', 'water_hourly', 'water_tank_levels', 'waste_hourly', 'traffic_parking',
                     'air_environment', 'weather', 'climate_resilience', 'assets_equipment', 'safety_incidents', 'sustainability', 'emissions'):
            table = get_table(name)
            rows = [dict(row) for row in source.execute(select(table)).mappings()]
            if rows:
                destination.execute(insert(table), rows)
        destination.commit()
    with Session(isolated) as session:
        targets = [target for target in engine.load_forecast_targets() if target['method'] != 'pending']
        def predict_all():
            return {target['id']: forecasts.forecast(target['domain'], 'F01', AS_OF, session,
                metric=target['metric'], horizon=target['horizons'][0])['forecasts'] for target in targets}
        before = predict_all()
        from sqlalchemy import Float, Integer, Boolean, String
        for table in get_metadata().tables.values():
            stamp = table.c.get('timestamp')
            if stamp is None:
                stamp = table.c.get('date')
            if stamp is None:
                continue
            changes = {column.name: True if isinstance(column.type, Boolean) else
                       999999 if isinstance(column.type, (Float, Integer)) else 'future_changed'
                       for column in table.c if column is not stamp and not column.primary_key
                       and isinstance(column.type, (Boolean, Float, Integer, String))}
            if changes:
                session.execute(update(table).where(stamp > AS_OF).values(**changes))
        session.flush()
        forecasts._MODEL_CACHE.clear()
        after = predict_all()
        assert before == after
    isolated.dispose()


def test_tank_and_bin_simulations_match_historical_source_hours():
    adapter = CampusAAdapter()
    water = adapter.extract('water_hourly').groupby('timestamp').water_consumption_litres.sum() / 1000
    tanks = adapter.extract('water_tank_levels')
    total_capacity = tanks.groupby('tank_id').tank_capacity_kl.last().sum()
    for _, history in tanks.groupby('tank_id'):
        previous = history.iloc[0]
        for _, row in history.iloc[1:168].iterrows():
            use = water.at[row.timestamp] * row.tank_capacity_kl / total_capacity
            level, pump, inflow = engine.simulate_tank_hour(previous.tank_level, row.tank_capacity_kl,
                                                           bool(previous.pump_on), use)
            assert level == pytest.approx(row.tank_level, abs=1e-6)
            assert pump == bool(row.pump_on)
            assert inflow == pytest.approx(row.pump_inflow_kl, abs=1e-6)
            previous = row

    bins = adapter.extract('registry_bins').set_index('bin_id').capacity_kg
    waste = adapter.extract('waste_hourly')
    for bin_id, history in waste.groupby('bin_id'):
        previous = history.iloc[0]
        capacity = float(bins.at[bin_id])
        for _, row in history.iloc[1:24].iterrows():
            weight = engine.simulate_bin_hour(previous.fill_percentage * capacity / 100,
                                              capacity, row.waste_weight, row.timestamp, bool(row.collection_delayed))
            assert weight / capacity * 100 == pytest.approx(row.fill_percentage)
            previous = row


def test_climate_formulas_match_all_historical_source_rows():
    adapter = CampusAAdapter()
    weather = adapter.extract('weather').set_index('timestamp')
    history = adapter.extract('climate_resilience')
    for row in history.itertuples():
        heat, flood = engine.climate_risk_values(row.temperature, row.humidity, row.rainfall,
            float(weather.at[row.timestamp, 'rainfall_6h_total']), row.drainage_capacity,
            row.low_lying_flag, row.building_exposure)
        assert heat == pytest.approx(row.heat_risk)
        assert flood == pytest.approx(row.flood_risk)


@pytest.mark.parametrize('horizon', ['24h', '7d'])
def test_floor_forecasts_sum_to_building_and_peak_is_not_summed(database, horizon):
    with Session(database) as session:
        result = forecasts.forecast('energy', 'F01', AS_OF, session, horizon=horizon)
        peak = forecasts.forecast('energy', 'F01', AS_OF, session, metric='peak_demand_kw', horizon=horizon)
    for building in result['forecasts']:
        floors = [item for item in result['floor_forecasts'] if item['building_id'] == building['entity_id']]
        assert floors
        for index, point in enumerate(building['series']):
            for key in ('value', 'lower', 'upper'):
                assert sum(floor['series'][index][key] for floor in floors) == pytest.approx(point[key])
    assert all(len(item['series']) == (24 if horizon == '24h' else 7) for item in peak['forecasts'])
    if horizon == '7d':
        assert max(point['value'] for item in peak['forecasts'] for point in item['series']) < 1000


def test_emissions_equal_registry_factor_times_forecast_activity(database):
    with Session(database) as session:
        emission = forecasts.forecast('emissions', 'F01', AS_OF, session)
        energy = forecasts.forecast('energy', 'F01', AS_OF, session)
        grid = session.execute(select(get_table('registry_emission_factors').c.value).where(
            get_table('registry_emission_factors').c.factor_name == 'grid')).scalar_one()
    assert emission['unit'] == 'kgCO2e'
    for actual, activity in zip(emission['forecasts'], energy['forecasts']):
        for point, source in zip(actual['series'], activity['series']):
            assert point['energy_co2e'] == pytest.approx(source['value'] * grid)
            assert point['total_co2e'] == pytest.approx(sum(point[key] for key in ('energy_co2e', 'mobility_co2e', 'waste_co2e')))


def test_accuracy_is_real_and_does_not_cross_databases(database):
    with Session(database) as session:
        forecasts.forecast('energy', 'F01', AS_OF, session)
        accuracy = forecasts.accuracy_at('F01', AS_OF, session)
    energy = next(item for item in accuracy if item['target'] == 'energy_kwh')
    assert energy['status'] == 'evaluated'
    assert all(0 <= fold['band_coverage'] <= 100 for fold in energy['folds'])
    other = create_engine('sqlite+pysqlite:///:memory:')
    with Session(other) as session:
        unknown = forecasts.accuracy_at('F01', AS_OF, session)
    assert all(item['mae'] is None and not item['folds'] for item in unknown)
    other.dispose()


def test_invalid_metric_and_horizon_are_rejected(database):
    def override():
        with Session(database) as session:
            yield session
    app.dependency_overrides[get_session] = override
    try:
        with TestClient(app) as client:
            for params in ({'metric': 'typo'}, {'horizon': '99d'}):
                assert client.get('/forecast/energy', params={**params, 'as_of': AS_OF.isoformat()}).status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_every_widget_forecast_contract_and_derived_persistence(database):
    def override():
        with Session(database) as session:
            yield session
    app.dependency_overrides[get_session] = override
    try:
        with TestClient(app) as client:
            for target in engine.load_forecast_targets():
                response = client.get(f"/forecast/{target['domain']}", params={
                    'node': 'F01', 'as_of': AS_OF.isoformat(), 'metric': target['metric'],
                    'horizon': target['horizons'][0]})
                assert response.status_code == 200, response.text
                body = response.json()
                if target['method'] == 'pending':
                    assert body['status'] == 'pending' and not body['forecasts']
                    continue
                assert body['node'] == 'F01'
                assert body['as_of'] == AS_OF.isoformat()
                assert body['data_source']['classification']
                assert body['forecasts']
                if 'model' in body:
                    assert body['model'] == body['forecasts'][0]['model']
                for entity in body['forecasts']:
                    assert entity['model'] in {'seasonal', 'hist_gradient_boosting', 'formula', 'rule', 'simulated', 'poisson'}
                    assert all(point['lower'] <= point['value'] <= point['upper'] for point in entity['series'])
            assert client.get('/forecast/weather', params={'node': 'missing', 'as_of': AS_OF.isoformat()}).status_code == 404
            for params in ({'horizon': '7d'}, {'node': 'Library'}):
                assert client.get('/forecast/energy', params={'as_of': AS_OF.isoformat(), **params}).status_code == 200
        with Session(database) as session:
            rows = list(session.execute(select(get_table('forecasts'))).mappings())
            assert {'tank_level_pct', 'bin_fill_pct', 'emissions_co2e', 'asset_failure_risk', 'weather'}.issubset({row['target'] for row in rows})
            energy_rows = [row for row in rows if row['target'] == 'energy_kwh' and row['entity'] == 'Academic'
                           and row['ts'] == datetime(2026, 10, 9) and row['issued_at'] == AS_OF.replace(tzinfo=None)]
            assert len(energy_rows) == 2  # hourly midnight and next-day total remain separate
            assert energy_rows[0]['yhat'] != energy_rows[1]['yhat']
            forecasts._MODEL_CACHE.clear()
            saved = forecasts.accuracy_at('F01', AS_OF, session)
            assert next(item for item in saved if item['target'] == 'energy_kwh')['status'] == 'evaluated'
    finally:
        app.dependency_overrides.clear()
