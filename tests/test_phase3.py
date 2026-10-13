from __future__ import annotations

from dataclasses import replace
from concurrent.futures import ThreadPoolExecutor

import pytest
import httpx
from fastapi.testclient import TestClient
from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_metadata, get_session, get_table
from app.decision import jev, router
from app.engine import replay
from app.main import app
from test_phase2 import at, database  # noqa: F401 — shared isolated fixture


@pytest.fixture(autouse=True)
def clear_jev_cache():
    jev.clear_cache()


def test_jev_request_schema_and_cache(monkeypatch):
    calls = []

    class FakeResponse:
        status_code = 200
        def raise_for_status(self): pass
        def json(self):
            return {"model": "jev-1.13.0", "answers": {
                "triage.anomaly": {"type": "choice", "choice": "real_issue",
                                   "probabilities": {"real_issue": 0.91, "data_gap": 0.04, "expected_pattern": 0.05},
                                   "confidence": 0.85}}, "usage": {"input_tokens": 100, "output_tokens": 20}}

    class FakeClient:
        def __init__(self, timeout): assert timeout == 8.0
        def __enter__(self): return self
        def __exit__(self, *_): pass
        def post(self, url, json, headers):
            calls.append((url, json, headers))
            return FakeResponse()

    monkeypatch.setattr(jev.httpx, "Client", FakeClient)
    monkeypatch.setattr(jev, "settings", replace(settings, jev_api_key="test-key", jev_base_url=None))
    state = {"candidate": {"type": "energy_spike"}}
    first = jev.decide_many(["triage.anomaly"], state)
    second = jev.decide_many(["triage.anomaly"], state)
    assert len(calls) == 1 and second["cached"] is True
    assert calls[0][0] == "https://api.typesafe.ai/v1/systemone"
    assert calls[0][1]["model"] == "jev-1.13.0"
    assert calls[0][1]["questions"]["triage.anomaly"]["criteria"]["real_issue"]
    assert calls[0][2]["Authorization"] == "Bearer test-key"
    assert first["answers"]["triage.anomaly"]["choice"] == "real_issue"


def test_jev_timeout_retries_twice(monkeypatch):
    calls = []
    class TimeoutClient:
        def __init__(self, timeout): assert timeout == 8.0
        def __enter__(self): return self
        def __exit__(self, *_): pass
        def post(self, *_args, **_kwargs):
            calls.append(1)
            raise httpx.ReadTimeout("synthetic timeout")
    monkeypatch.setattr(jev.httpx, "Client", TimeoutClient)
    monkeypatch.setattr(jev, "settings", replace(settings, jev_api_key="test-key", jev_base_url=None))
    monkeypatch.setattr(jev.time, "sleep", lambda *_: None)
    with pytest.raises(httpx.ReadTimeout):
        jev.decide_many(["triage.anomaly"], {"candidate": {"type": "water_leak"}})
    assert len(calls) == 3


def test_concurrent_metadata_initialization():
    with ThreadPoolExecutor(max_workers=8) as pool:
        tables = list(pool.map(lambda _: len(get_metadata().tables), range(16)))
    assert len(set(tables)) == 1 and tables[0] >= 29


@pytest.mark.parametrize("on_error,expected_flag,expected_label", [
    ("needs_review", "needs_review", None), ("rules", "rules_fallback", "real_issue")])
def test_error_modes_log_without_invented_jev_label(database, monkeypatch, on_error, expected_flag, expected_label):
    def fails(*_): raise TimeoutError("synthetic timeout")
    monkeypatch.setattr(jev, "decide_many", fails)
    monkeypatch.setattr(router, "settings", replace(settings, decision_provider="jev", decision_on_error=on_error))
    with Session(database) as session:
        result = router.decide_many(session, ["triage.anomaly"],
                                    {"candidate": {"type": "energy_spike", "facts": {}, "context": {}}}, at("2026-10-07", 2))
        session.commit()
        logs = session.execute(select(get_table("decision_log"))).mappings().all()
    assert result["triage.anomaly"]["flag"] == expected_flag
    assert router.label(result["triage.anomaly"]) == expected_label
    assert logs[0]["provider"] == "jev" and logs[0]["label"] is None and logs[0]["status"] == "error"
    if on_error == "rules":
        assert logs[1]["provider"] == "rules" and logs[1]["label"] == "real_issue"


def test_shadow_serves_rules_and_logs_both(database, monkeypatch):
    monkeypatch.setattr(jev, "decide_many", lambda *_: {"answers": {
        "triage.anomaly": {"type": "choice", "choice": "data_gap", "probabilities": {"data_gap": 0.9}, "confidence": 0.9}},
        "model": "jev-1.13.0", "cached": False})
    monkeypatch.setattr(router, "settings", replace(settings, decision_provider="shadow"))
    with Session(database) as session:
        result = router.decide_many(session, ["triage.anomaly"],
                                    {"candidate": {"type": "energy_spike", "facts": {}, "context": {}}}, at("2026-10-07", 2))
        session.commit()
        logs = session.execute(select(get_table("decision_log"))).mappings().all()
    assert router.label(result["triage.anomaly"]) == "real_issue"
    assert [(row["provider"], row["label"]) for row in logs] == [("jev", "data_gap"), ("rules", "real_issue")]


def test_action_status_head_gate_persists_across_sessions(database):
    table = get_table("actions")
    with Session(database) as session:
        session.execute(insert(table).values(action_id="ACT-test", created_at=at("2026-10-07", 2), node_id="Academic",
            status="open", alert_key="energy_spike|Academic|2026-10-07T02:00:00+05:30", type="review_energy_spike",
            text="Review energy spike", saving_inr=80, saving_co2e=7.16, priority=80, owner="Facilities",
            needs_head_approval=1, source="rule", payload="{}"))
        session.commit()
    def session_override():
        with Session(database) as session: yield session
    app.dependency_overrides[get_session] = session_override
    try:
        client = TestClient(app)
        assert client.patch("/actions/ACT-test", json={"status": "done"}, headers={"X-Role": "head"}).status_code == 409
        for status in ("acknowledged", "in_progress"):
            assert client.patch("/actions/ACT-test", json={"status": status}, headers={"X-Role": "staff"}).status_code == 200
        assert client.patch("/actions/ACT-test", json={"status": "done"}, headers={"X-Role": "staff"}).status_code == 403
        assert client.patch("/actions/ACT-test", json={"status": "done"}, headers={"X-Role": "head"}).status_code == 200
    finally:
        app.dependency_overrides.clear()
    with Session(database) as reopened:
        assert reopened.execute(select(table.c.status).where(table.c.action_id == "ACT-test")).scalar_one() == "done"


def test_frontend_contract_endpoints(database):
    def session_override():
        with Session(database) as session: yield session
    app.dependency_overrides[get_session] = session_override
    try:
        client = TestClient(app)
        query = {"node": "F01", "start": at("2026-10-07", 0).isoformat(),
                 "end": at("2026-10-07", 23).isoformat(), "as_of": at("2026-10-07", 23).isoformat()}
        dashboard = client.get("/dashboard", params=query)
        assert dashboard.status_code == 200
        body = dashboard.json()
        assert set(("overview", "energy", "water", "waste", "air", "assets", "mobility", "safety", "climate", "sustainability", "actions", "insights")) <= body.keys()
        assert body["overview"]["score"] == body["sustainability"]["score"]
        assert isinstance(body["energy"]["buildings"], list)
        assert isinstance(body["overview"]["alertCounts"], dict)
        assert isinstance(client.get("/locations").json()["locations"], list)
        assert isinstance(client.get("/alerts", params={"as_of": query["as_of"]}).json()["alerts"], list)
        assert isinstance(client.get("/actions", params={"as_of": query["as_of"]}).json()["actions"], list)
        assert isinstance(client.get("/decisions/queue", params={"as_of": query["as_of"]}).json()["items"], list)
        assert "running" in client.get("/replay/state").json()
        assert client.post("/replay/seek", json={"as_of": at("2026-10-07", 2).isoformat()}).status_code == 200
        assert client.post("/replay/speed", json={"speed": 7200}).json()["speed"] == 7200
        assert client.post("/replay/start", json={"node": "F01"}).json()["running"] is True
        assert client.post("/replay/pause").json()["running"] is False
        preflight = client.options("/dashboard", headers={"Origin": settings.frontend_origin,
            "Access-Control-Request-Method": "GET"})
        assert preflight.status_code == 200
        assert preflight.headers["access-control-allow-origin"] == settings.frontend_origin
    finally:
        app.dependency_overrides.clear()
