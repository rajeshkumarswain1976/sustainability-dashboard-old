from __future__ import annotations

from datetime import datetime
from dataclasses import replace

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, insert, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.adapters.campus_a import CampusAAdapter, parse_scalar
from app.analytics import air, assets, climate, energy, safety, traffic, waste, water
from app.analytics import forecast as forecast_module
from app.db import get_metadata, get_session, get_table
from app.engine import pipeline, replay
from app.decision import router as decision_router
from app.config import settings
from app.main import app


def at(day: str, hour: int) -> datetime:
    return datetime.fromisoformat(f"{day}T{hour:02d}:00:00+05:30")


@pytest.fixture(autouse=True)
def deterministic_decisions(monkeypatch):
    monkeypatch.setattr(decision_router, "settings", replace(settings, decision_provider="rules"))


@pytest.fixture
def database():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    get_metadata().create_all(engine)
    adapter = CampusAAdapter()
    with Session(engine) as session:
        for name in (
            "location_dim", "energy_building_hourly", "energy_floor_hourly", "occupancy_hourly",
            "water_hourly", "water_tank_levels", "waste_hourly", "traffic_parking",
            "climate_resilience", "safety_incidents", "weather",
        ):
            frame = adapter.extract(name)
            if name == "energy_building_hourly":
                frame = frame[frame.building_id == "Academic"]
            elif name == "energy_floor_hourly":
                frame = frame[(frame.building_id == "Academic") &
                              (frame.timestamp.dt.date.astype(str) == "2026-10-07") &
                              frame.timestamp.dt.hour.isin([1, 2, 3, 4])]
            elif name == "water_hourly":
                event = (frame.timestamp.dt.date.astype(str) == "2026-10-09") & frame.timestamp.dt.hour.isin(range(5))
                frame = frame[(frame.meter_id == "M03") | event]
            elif name == "water_tank_levels":
                frame = frame[(frame.timestamp.dt.date.astype(str) == "2026-10-09") &
                              frame.timestamp.dt.hour.isin(range(5))]
            elif name == "waste_hourly":
                frame = frame[(frame.bin_id == "Mess_F1_B4") &
                              (frame.timestamp.dt.date.astype(str) == "2026-10-07") &
                              frame.timestamp.dt.hour.isin([4, 5, 6, 7])]
            elif name == "traffic_parking":
                frame = frame[frame.gate_id == "West"]
            elif name == "climate_resilience":
                frame = frame[(frame.timestamp.dt.date.astype(str) == "2026-10-09") &
                              frame.timestamp.dt.hour.isin([16, 17, 18])]
            if not frame.empty:
                records = [{key: parse_scalar(value) for key, value in row.items()}
                           for row in frame.to_dict(orient="records")]
                session.execute(insert(get_table(name)), records)
        session.commit()
    yield engine
    engine.dispose()


def test_story_energy_alert_starts_at_02(database):
    with Session(database) as session:
        before = energy.analyze("F01", at("2026-10-07", 1), session=session)
        event = energy.analyze("F01", at("2026-10-07", 2), session=session)
    assert not any(item["type"] == "energy_spike" and item["node"] == "Academic"
                   for item in before["candidates"])
    matches = [item for item in event["candidates"] if item["type"] == "energy_spike" and item["node"] == "Academic"]
    assert len(matches) == 1
    assert matches[0]["ts"] == at("2026-10-07", 2).isoformat()
    assert matches[0]["facts"]["annotated_replay_event"] is True
    assert matches[0]["context"]["occupancy_vs_usual"] is not None
    assert event["hotspots"] and "floor_id" in event["hotspots"][0]


def test_only_m03_leak_at_story_hours(database):
    with Session(database) as session:
        before = water.analyze("F01", at("2026-10-09", 0), session=session)
        event = [water.analyze("F01", at("2026-10-09", hour), session=session) for hour in (1, 2, 3)]
        after = water.analyze("F01", at("2026-10-09", 4), session=session)
    assert not any(item["type"] == "water_leak" for item in before["candidates"])
    assert not any(item["type"] == "water_leak" for item in after["candidates"])
    for result in event:
        leaks = [item for item in result["candidates"] if item["type"] == "water_leak"]
        assert len(leaks) == 1
        assert leaks[0]["node"] == "M03"
        assert result["hotspots"] and "meter_id" in result["hotspots"][0]


def test_waste_safety_and_rain_event_hours(database):
    with Session(database) as session:
        waste_before = waste.analyze("F01", at("2026-10-07", 6), session=session)
        waste_event = waste.analyze("F01", at("2026-10-07", 7), session=session)
        safety_before = safety.analyze("F01", at("2026-10-07", 17), session=session)
        safety_event = safety.analyze("F01", at("2026-10-07", 18), session=session)
        rain_before = climate.analyze("F01", at("2026-10-09", 16), session=session)
        rain_event = climate.analyze("F01", at("2026-10-09", 17), session=session)
    assert not any(item["facts"].get("overflow_event") for item in waste_before["candidates"])
    assert any(item["type"] == "bin_overflow" and item["facts"]["overflow_event"]
               for item in waste_event["candidates"])
    assert waste_event["hotspots"] and "bin_id" in waste_event["hotspots"][0]
    assert not safety_before["candidates"]
    assert any(item["type"] == "safety_incident" and item["node"] == "N2"
               for item in safety_event["candidates"])
    assert safety_event["hotspots"] and "area_id" in safety_event["hotspots"][0]
    assert not any(item["type"] == "heavy_rain" for item in rain_before["candidates"])
    assert any(item["type"] == "heavy_rain" and item["ts"] == at("2026-10-09", 17).isoformat()
               for item in rain_event["candidates"])
    assert rain_event["hotspots"] and "zone_id" in rain_event["hotspots"][0]


def test_holiday_has_no_low_occupancy_alert(database):
    with Session(database) as session:
        result = energy.analyze("F01", at("2026-10-02", 2), session=session)
    assert result["context"]["is_holiday"] is True
    assert all(item["type"] != "low_occupancy" for item in result["candidates"])


def test_tick_twice_is_idempotent_and_alerts_are_decided(database):
    with Session(database) as session:
        replay.seek(session, at("2026-10-07", 2))
        first = pipeline.tick(at("2026-10-07", 2), session=session)
        second = pipeline.tick(at("2026-10-07", 2), session=session)
        count = session.execute(select(func.count()).select_from(get_table("alerts"))).scalar_one()
        alert = session.execute(select(get_table("alerts")).where(get_table("alerts").c.type == "energy_spike")).mappings().first()
    assert first["ticks"] and second["ticks"] == []
    assert count == len(first["new_alerts"])
    assert alert is not None
    assert alert["alert_key"] == "energy_spike|Academic|2026-10-07T02:00:00+05:30"
    assert alert["level"] == "Warning" and alert["confidence"] == 1.0
    assert alert["status"] == "open"


def test_stream_emits_7_oct_alert(database, monkeypatch):
    from app.api import routes
    monkeypatch.setattr(routes, "runtime_engine", lambda: database)
    with Session(database) as session:
        replay.seek(session, at("2026-10-07", 2))
    response = TestClient(app).get("/stream", params={"as_of": at("2026-10-07", 2).isoformat()})
    assert response.status_code == 200
    assert "event: tick" in response.text
    assert '"type":"energy_spike"' in response.text


@pytest.mark.parametrize("domain", ["energy", "water", "parking"])
def test_forecast_api_returns_both_maes(database, domain):
    def session_override():
        with Session(database) as session:
            yield session
    app.dependency_overrides[get_session] = session_override
    try:
        response = TestClient(app).get(f"/forecast/{domain}", params={"as_of": at("2026-10-09", 23).isoformat()})
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    result = response.json()["forecasts"][0]
    assert result["mae"] is not None
    assert result["baseline_mae"] is not None
    assert len(result["series"]) == 24


def test_alerts_endpoint_respects_as_of(database):
    def session_override():
        with Session(database) as session:
            yield session
    app.dependency_overrides[get_session] = session_override
    try:
        with Session(database) as session:
            replay.seek(session, at("2026-10-07", 2))
            pipeline.tick(at("2026-10-07", 2), session=session)
        client = TestClient(app)
        before = client.get("/alerts", params={"as_of": at("2026-10-07", 1).isoformat()})
        at_event = client.get("/alerts", params={"since": at("2026-10-07", 2).isoformat(),
                                                 "as_of": at("2026-10-07", 2).isoformat()})
    finally:
        app.dependency_overrides.clear()
    assert before.status_code == 200 and not before.json()["alerts"]
    assert at_event.status_code == 200
    assert any(item["type"] == "energy_spike" for item in at_event.json()["alerts"])


def test_replay_control_endpoints_persist_state(database):
    def session_override():
        with Session(database) as session:
            yield session
    app.dependency_overrides[get_session] = session_override
    try:
        client = TestClient(app)
        started = client.post("/replay/start", json={"as_of": at("2026-10-07", 2).isoformat(),
                                                      "speed": 7200, "node": "F01"})
        changed = client.post("/replay/speed", json={"speed": 3600})
        paused = client.post("/replay/pause")
        sought = client.post("/replay/seek", json={"as_of": at("2026-10-09", 1).isoformat()})
        state = client.get("/replay/state")
    finally:
        app.dependency_overrides.clear()
    assert started.status_code == changed.status_code == paused.status_code == sought.status_code == state.status_code == 200
    assert started.json()["running"] is True and started.json()["speed"] == 7200
    assert changed.json()["speed"] == 3600
    assert paused.json()["running"] is False
    assert state.json()["cursor"] == at("2026-10-09", 1).isoformat()


def test_ml_is_not_served_when_it_loses(database, monkeypatch):
    class LosingModel:
        def __init__(self, **kwargs):
            pass

        def fit(self, values, target):
            return self

        def predict(self, values):
            return np.full(len(values), 1_000_000.0)

    forecast_module._MODEL_CACHE.clear()
    monkeypatch.setattr(forecast_module, "HistGradientBoostingRegressor", LosingModel)
    with Session(database) as session:
        result = forecast_module.forecast("energy", "F01", at("2026-10-09", 23), session)
    selected = result["forecasts"][0]
    assert selected["mae"] > selected["baseline_mae"]
    assert selected["model"] == "seasonal"


def test_forecast_retrains_on_next_replay_day(database, monkeypatch):
    trained = []
    original = forecast_module.forecast_engine.run_rolling_origin_backtest

    def record_training(*args, **kwargs):
        trained.append(args[-1])
        return original(*args, **kwargs)

    forecast_module._MODEL_CACHE.clear()
    monkeypatch.setattr(forecast_module.forecast_engine, "run_rolling_origin_backtest", record_training)
    with Session(database) as session:
        for replay_time in (at("2026-10-08", 0), at("2026-10-08", 1),
                            at("2026-10-08", 23), at("2026-10-09", 0)):
            forecast_module.forecast("energy", "F01", replay_time, session)
    assert len(trained) == 2


def test_domain_threshold_detectors_emit_candidates(database):
    stamp = at("2026-10-10", 2)
    with Session(database) as session:
        for table, rows in {
            "energy_building_hourly": [{"timestamp": stamp, "facility_id": "F01", "zone_id": "Academic",
                                        "building_id": "Academic", "energy_kwh": 1000, "peak_demand_kw": 1200,
                                        "hvac_status": 1, "imputed_flag": 0, "data_source": "synthetic"}],
            "water_hourly": [{"timestamp": stamp, "facility_id": "F01", "zone_id": "Academic",
                              "meter_id": "M99", "flow_lpm": 10, "occupancy": 50, "leak_flag": 0}],
            "water_tank_levels": [{"timestamp": stamp, "facility_id": "F01", "zone_id": "Academic",
                                   "tank_id": "T99", "tank_level_pct": 35, "pump_on": 0}],
            "waste_hourly": [{"timestamp": stamp, "facility_id": "F01", "zone_id": "Academic",
                              "bin_id": "B99", "fill_percentage": 100, "overflow_event": 1,
                              "collection_delayed": 1, "predicted_overflow_time": at("2026-10-10", 4)}],
            "traffic_parking": [{"timestamp": stamp, "facility_id": "F01", "zone_id": "Academic",
                                 "gate_id": "G99", "parking_capacity": 100, "parking_occupancy": 90,
                                 "traffic_density": 0.9, "delay_min": 12}],
            "assets_equipment": [
                {"timestamp": at("2026-10-09", 23), "facility_id": "F01", "zone_id": "Academic",
                 "asset_id": "A99", "availability": 1, "vibration": 2, "status": "active"},
                {"timestamp": stamp, "facility_id": "F01", "zone_id": "Academic",
                 "asset_id": "A99", "availability": 0, "vibration": 4, "status": "down"},
            ],
            "air_environment": [{"timestamp": stamp, "facility_id": "F01", "zone_id": "Campus",
                                 "aqi_cpcb": 250}],
            "climate_resilience": [{"timestamp": stamp, "facility_id": "F01", "zone_id": "N2",
                                    "flood_risk": 70, "heat_risk": 80}],
            "safety_incidents": [{"incident_id": "INC_TEST", "timestamp": stamp, "facility_id": "F01",
                                  "zone_id": "Residential", "area_id": "N2", "incident_type": "trip",
                                  "severity": "moderate"}],
        }.items():
            session.execute(insert(get_table(table)), rows)
        session.commit()
        outputs = [module.analyze("F01", stamp, session=session) for module in
                   (energy, water, waste, traffic, assets, air, climate, safety)]
    found = {item["type"] for output in outputs for item in output["candidates"]}
    assert {"energy_spike", "water_leak", "tank_low", "bin_overflow", "parking_high",
            "congestion", "asset_risk", "air_poor", "flood_risk", "heat_risk",
            "safety_incident"} <= found
    assert all({"candidate_id", "domain", "type", "node", "ts", "facts", "context"} <= set(item)
               for output in outputs for item in output["candidates"])
