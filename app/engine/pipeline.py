from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.analytics import air, assets, climate, energy, safety, traffic, waste, water
from app.analytics.common import analysis_session, current_frame, event_context, hour
from app.analytics.metrics import to_records
from app.db import get_table
from app.decision import jev, router
from app.engine.actions import create_action
from app.engine.replay import load_state, save_state

ANALYZERS = (energy, water, waste, air, traffic, assets, safety, climate)


def _store_candidate(session: Session, candidate: dict[str, Any]) -> dict[str, Any] | None:
    table = get_table("alerts")
    stamp = hour(datetime.fromisoformat(candidate["ts"]))
    key = "|".join((candidate["type"], candidate["node"], stamp.isoformat()))
    values = {"alert_id": candidate["candidate_id"], "alert_key": key, "created_at": stamp,
              "node_id": candidate["node"], "domain": candidate["domain"], "type": candidate["type"],
              "level": None, "status": "candidate", "confidence": None,
              "facts": {"observations": candidate["facts"], "context": candidate["context"]}}
    dialect = session.get_bind().dialect.name
    if dialect == "postgresql":
        statement = pg_insert(table).values(**values).on_conflict_do_nothing(index_elements=[table.c.alert_key])
    elif dialect == "sqlite":
        statement = sqlite_insert(table).values(**values).on_conflict_do_nothing(index_elements=[table.c.alert_key])
    else:
        raise RuntimeError("Candidate persistence requires PostgreSQL or SQLite")
    inserted = session.execute(statement)
    if inserted.rowcount == 0:
        return None
    return {"alert_key": key, "alert_id": values["alert_id"], "created_at": stamp.isoformat(),
            "node": values["node_id"], "domain": values["domain"], "type": values["type"],
            "level": None, "status": "candidate", "confidence": None, "facts": values["facts"]}


def _decide_candidate(session: Session, candidate: dict[str, Any], alert: dict[str, Any],
                      as_of: datetime, snapshot: dict[str, Any]) -> dict[str, Any]:
    gates = jev.catalogue()["thresholds"]
    act_p, review_p = float(gates["act"]), float(gates["review"])
    state = {"candidate": candidate, "context": candidate["context"],
             "weather": snapshot.get("weather", []), "campus_operations": snapshot.get("campus_operations", []),
             "open_alerts": snapshot.get("open_alerts", [])}
    triage = router.decide_many(session, ["triage.anomaly"], state, as_of)["triage.anomaly"]
    triage_label = router.label(triage)
    triage_p = router.probability(triage)
    if triage["flag"] == "needs_review":
        status = "needs_review"
    elif triage_label != "real_issue" and triage_p >= 0.7:
        status = "ignored"
    elif triage_p < review_p:
        status = "ignored"
    elif triage_p < act_p:
        status = "needs_review"
    else:
        status = "open"
    level = None
    confidence = None
    if status == "open":
        followup = router.decide_many(session, ["alert.level", "router.complexity"], state, as_of)
        level_result = followup["alert.level"]
        complexity_result = followup["router.complexity"]
        level = router.label(level_result)
        confidence = router.probability(level_result) if level is not None else None
        if level_result["flag"] == "needs_review" or complexity_result["flag"] == "needs_review":
            status = "needs_review"
        elif confidence is not None and confidence < review_p and level != "Critical":
            status = "ignored"
        elif confidence is not None and confidence < act_p:
            status = "needs_review"
        elif router.probability(complexity_result) < act_p:
            status = "needs_review"
        elif router.label(complexity_result) == "multi_domain":
            status = "pending_agent"
        elif router.label(complexity_result) == "routine":
            action_decisions = router.decide_many(session, ["owner.assign", "action.priority"],
                                                  {**state, "action": {"alert_key": alert["alert_key"], "level": level}}, as_of)
            create_action(session, candidate, alert["alert_key"], level, as_of, action_decisions)
    session.execute(update(get_table("alerts")).where(get_table("alerts").c.alert_key == alert["alert_key"])
                    .values(level=level, status=status, confidence=confidence))
    return {**alert, "level": level, "status": status, "confidence": confidence}


def tick(as_of: datetime, node: str = "F01", session: Session | None = None) -> dict[str, Any]:
    """Process each unprocessed replay hour once and route new candidates."""
    target = hour(as_of)
    with analysis_session(session) as db:
        if db.get_bind().dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(7112882)"))
        state = load_state(db)
        previous = datetime.fromisoformat(state["last_processed_at"]) if state.get("last_processed_at") else target - timedelta(hours=1)
        if target <= previous:
            db.commit()
            return {"as_of": target.isoformat(), "ticks": [], "new_alerts": []}
        processed = []
        new_alerts = []
        current = previous + timedelta(hours=1)
        while current <= target:
            context = event_context(db, node, current)
            analyses = [module.analyze(node, current, session=db, base_context=context) for module in ANALYZERS]
            snapshot = {"domains": {item["domain"]: {"current": item["current"], "kpis": item["kpis"]} for item in analyses},
                        "candidates": [candidate for item in analyses for candidate in item["candidates"]],
                        "hotspots": {item["domain"]: item["hotspots"] for item in analyses},
                        "weather": to_records(current_frame(db, "weather", node, current)),
                        "campus_operations": to_records(current_frame(db, "campus_operations", node, current)),
                        "open_alerts": list_alerts(db, as_of=current, node=node),
                        "context": context}
            alerts = []
            for analysis in analyses:
                for item in analysis["candidates"]:
                    stored = _store_candidate(db, item)
                    if stored is not None:
                        alerts.append(_decide_candidate(db, item, stored, current, snapshot))
            state["cursor"] = current.isoformat()
            state["last_processed_at"] = current.isoformat()
            state["node"] = node
            save_state(db, state)
            processed.append({"as_of": current.isoformat(),
                              "records": {item["domain"]: len(item["current"]) for item in analyses},
                              "new_alerts": alerts})
            new_alerts.extend(alerts)
            current += timedelta(hours=1)
        db.commit()
        return {"as_of": target.isoformat(), "ticks": processed, "new_alerts": new_alerts}


def list_alerts(session: Session, since: datetime | None = None, as_of: datetime | None = None,
                node: str | None = None) -> list[dict[str, Any]]:
    table = get_table("alerts")
    statement = select(table).order_by(table.c.created_at, table.c.alert_key)
    if since is not None:
        statement = statement.where(table.c.created_at >= since)
    if as_of is not None:
        statement = statement.where(table.c.created_at <= as_of)
    if node and node != "F01":
        statement = statement.where(table.c.node_id == node)
    return [{"alert_key": row["alert_key"], "alert_id": row["alert_id"],
             "created_at": hour(row["created_at"]).isoformat(), "node": row["node_id"],
             "domain": row["domain"], "type": row["type"], "level": row["level"],
             "status": row["status"], "confidence": row["confidence"], "facts": row["facts"]}
            for row in session.execute(statement).mappings().all()]
