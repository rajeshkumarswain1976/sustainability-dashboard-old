from dataclasses import replace
from datetime import datetime, timedelta
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, insert, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import replay_calendar as calendar
from app.analytics.repository import fetch_frame
from app.analytics import weather_api
from app.api import routes
from app.db import get_metadata, get_table, get_session
from app.main import app

NOW = datetime.fromisoformat('2027-01-02T10:30:00+05:30')
SOURCE = datetime.fromisoformat('2026-10-09T10:00:00+05:30')


@pytest.fixture
def shifted(monkeypatch):
    monkeypatch.setattr(calendar, 'settings', replace(calendar.settings, replay_align_today=True))
    monkeypatch.setattr(calendar, 'now_ist', lambda: NOW)
    bind = create_engine('sqlite+pysqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    get_metadata().create_all(bind)
    with bind.begin() as connection:
        connection.execute(insert(get_table('location_dim')), [{'node_id': 'F01', 'level': 'facility', 'label': 'Campus A'}])
        connection.execute(insert(get_table('energy_building_hourly')), [
            {'timestamp': SOURCE + timedelta(hours=h), 'facility_id': 'F01', 'building_id': 'Academic', 'energy_kwh': 100 + h}
            for h in (-1, 0, 1)])
    yield bind
    bind.dispose()


def test_today_mapping_preserves_values_and_excludes_future_rows(shifted):
    with Session(shifted) as db:
        result = fetch_frame(db, 'energy_building_hourly', 'F01', NOW - timedelta(hours=2), NOW, NOW)
        assert result.energy_kwh.tolist() == [99, 100]
        assert list(result.timestamp.dt.date.astype(str)) == ['2027-01-02', '2027-01-02']
        original = list(db.execute(select(get_table('energy_building_hourly').c.timestamp)).scalars())
        assert all(value.date().isoformat() == '2026-10-09' for value in original)


def test_api_replay_initializes_today_and_follows_midnight(shifted, monkeypatch):
    def override():
        with Session(shifted) as db:
            yield db
    app.dependency_overrides[get_session] = override
    try:
        with TestClient(app) as client:
            first = client.get('/replay/state').json()
            assert first['cursor'] == NOW.replace(minute=0).isoformat()
            assert client.get('/replay/calendar').json()['end'].startswith('2027-01-02')
            monkeypatch.setattr(calendar, 'now_ist', lambda: NOW + timedelta(days=1))
            second = client.get('/replay/state').json()
            assert datetime.fromisoformat(second['cursor']) - datetime.fromisoformat(first['cursor']) == timedelta(days=1)
            assert client.get('/replay/calendar').json()['end'].startswith('2027-01-03')
    finally:
        app.dependency_overrides.clear()


def test_default_analytics_window_uses_current_dataset_calendar(shifted):
    context = routes.request_context(node='F01', start=None, end=None, as_of=None)
    assert context['end'].date() == NOW.date()
    assert context['as_of'] == NOW


def test_weather_api_cache_units_coverage_and_historical_isolation(monkeypatch):
    monkeypatch.setattr(calendar, 'now_ist', lambda: NOW)
    monkeypatch.setattr(weather_api, 'settings', replace(weather_api.settings, weather_forecast_enabled=True))
    weather_api._cache.clear()
    calls = []
    def get(url, params, timeout):
        calls.append(params)
        stamps = [(NOW.replace(hour=0, minute=0) + timedelta(hours=index)).strftime('%Y-%m-%dT%H:%M') for index in range(216)]
        return httpx.Response(200, request=httpx.Request('GET', url), json={'hourly': {
            'time': stamps, 'temperature_2m': [20] * 216, 'relative_humidity_2m': [60] * 216,
            'precipitation': [0.4] * 216, 'wind_speed_10m': [3] * 216}})
    monkeypatch.setattr(weather_api.httpx, 'get', get)
    hourly = weather_api.forecast(NOW, 24)
    daily = weather_api.forecast(NOW, 181)
    assert len(hourly) == 24 and len(daily) == 181
    assert calls[0]['wind_speed_unit'] == 'ms' and calls[0]['timezone'] == 'Asia/Kolkata'
    assert hourly.iloc[0].wind_speed == 3
    assert hourly.attrs['classification'] == 'api_weather_forecast'
    assert len(calls) == 1
    assert len(weather_api.forecast(NOW + timedelta(hours=3), 24)) == 24
    assert weather_api.forecast(NOW - timedelta(minutes=3), 24) is None
    assert weather_api.forecast(NOW - timedelta(days=1), 24) is None
    assert len(calls) == 1


def test_weather_timeout_does_not_repeatedly_block_widgets(monkeypatch):
    monkeypatch.setattr(calendar, 'now_ist', lambda: NOW)
    monkeypatch.setattr(weather_api, 'settings', replace(weather_api.settings, weather_forecast_enabled=True))
    weather_api._cache.clear()
    calls = []
    def fail(*args, **kwargs):
        calls.append(1)
        raise httpx.ReadTimeout('test timeout')
    monkeypatch.setattr(weather_api.httpx, 'get', fail)
    assert weather_api.forecast(NOW, 24) is None
    assert weather_api.forecast(NOW, 24) is None
    assert len(calls) == 1
