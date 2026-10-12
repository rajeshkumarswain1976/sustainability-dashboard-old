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
from app.engine import predictive
from app.engine.scopes import entity_nodes
from app.engine.replay import load_state, save_state

ANALYZERS = (energy, water, waste, air, traffic, assets, safety, climate)
_post_decision_hook = None


def set_post_decision_hook(hook):
    """Optional post-routing extension used by the complete TerraNexus service."""
    global _post_decision_hook
    _post_decision_hook = hook



def _store_candidate(session: Session, candidate: dict[str, Any]) -> dict[str, Any] | None:
    table = get_table("alerts")
    stamp = hour(datetime.fromisoformat(candidate["ts"]))
    key = "|".join((candidate["type"], candidate["node"], stamp.isoformat()))
    values = {"alert_id": candidate["candidate_id"], "alert_key": key, "created_at": stamp,
              "node_id": candidate["node"], "domain": candidate["domain"], "type": candidate["type"],
              "level": None, "status": "candidate", "confidence": None,
              "facts": {"observations": candidate["facts"], "context": candidate["context"]}}
    if session.execute(select(table.c.alert_id).where(table.c.alert_key == key)).first():
        return None
    replacement = predictive.reconcile(session, candidate, values, stamp)
    if replacement is not None:
        return {"alert_key": key, "alert_id": replacement["alert_id"], "created_at": stamp.isoformat(),
                "node": replacement["node_id"], "domain": replacement["domain"], "type": replacement["type"],
                "level": None, "status": "candidate", "confidence": None, "facts": replacement["facts"]}
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
    state = {**snapshot, "candidate": candidate, "context": candidate["context"]}
    triage = router.decide_many(session, ["triage.anomaly"], state, as_of)["triage.anomaly"]
    triage_label, triage_p = router.label(triage), router.probability(triage)
    level, confidence = None, None
    decisions = {"triage.anomaly": triage}
    if triage["flag"] == "needs_review":
        status = "needs_review"
    elif triage_label != "real_issue" and triage_p >= 0.7:
        status = "ignored"
    else:
        followup = router.decide_many(session, ["alert.level", "router.complexity"], state, as_of)
        decisions.update(followup)
        level_result, complexity_result = followup["alert.level"], followup["router.complexity"]
        level = router.label(level_result)
        confidence = router.probability(level_result) if level is not None else None
        probabilities = [triage_p, confidence or 0, router.probability(complexity_result)]
        if any(item["flag"] == "needs_review" for item in followup.values()):
            status = "needs_review"
        elif min(probabilities) < review_p and level != "Critical":
            status = "ignored"
        elif min(probabilities) < act_p:
            status = "needs_review"
        elif router.label(complexity_result) == "multi_domain":
            status = "pending_agent"
        elif router.label(complexity_result) == "routine":
            status = "open"
            action_decisions = router.decide_many(session, ["owner.assign", "action.priority"],
                {**state, "action": {"alert_key": alert["alert_key"], "level": level}}, as_of)
            decisions.update(action_decisions)
            action_candidate = {**candidate, "type": predictive.real_type(candidate["type"])}
            if action_candidate["type"] == "energy_spike":
                observed = next((row for row in snapshot.get("domains", {}).get("energy", {}).get("current", [])
                                 if str(row.get("building_id")) == candidate["node"]), {})
                action_candidate["facts"] = {**candidate["facts"],
                    "grid_import_kwh": observed.get("grid_import_kwh", candidate["facts"].get("grid_import_kwh"))}
            action = create_action(session, action_candidate, alert["alert_key"], level, as_of, action_decisions)
            if action is not None and action.get("needs_review"):
                status = "needs_review"
        else:
            status = "needs_review"
    facts = {**alert["facts"], "decisions": {point: {
        "provider": result["provider"], "flag": result["flag"], "label": router.label(result),
        "probability": router.probability(result)} for point, result in decisions.items()}}
    session.execute(update(get_table("alerts")).where(get_table("alerts").c.alert_key == alert["alert_key"])
                    .values(level=level, status=status, confidence=confidence, facts=facts))
    lead = facts.get("observations", {}).get("lead_time_hours")
    decided = {**alert, "level": level, "status": status, "confidence": confidence, "facts": facts,
               "lead_time_hours": lead}
    if _post_decision_hook is not None and status != "ignored":
        try:
            with session.begin_nested():
                return _post_decision_hook(session, candidate, decided, as_of, snapshot)
        except Exception as error:
            facts = {**facts, "enrichment_error": type(error).__name__}
            session.execute(update(get_table("alerts")).where(get_table("alerts").c.alert_key == alert["alert_key"])
                            .values(status="needs_review", facts=facts))
            return {**decided, "status": "needs_review", "facts": facts}
    return decided


def tick(as_of: datetime, node: str = "F01", session: Session | None = None) -> dict[str, Any]:
    """Process each unprocessed replay hour once and route new candidates."""
    target = hour(as_of)
    with analysis_session(session) as db:
        if db.get_bind().dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(7112882)"))
        from app.engine.snapshot import build_snapshot
        state = load_state(db)
        previous = datetime.fromisoformat(state["last_processed_at"]) if state.get("last_processed_at") else target - timedelta(hours=1)
        if target <= previous:
            alerts = []
            if predictive.pending(db, target):
                snapshot = build_snapshot(node, target, session=db)
                alerts = predictive.route_pending(db, node, target, snapshot)
            db.commit()
            return {"as_of": target.isoformat(), "ticks": [], "new_alerts": alerts}
        processed = []
        new_alerts = []
        current = previous + timedelta(hours=1)
        while current <= target:
            context = event_context(db, node, current)
            analyses = [module.analyze(node, current, session=db, base_context=context) for module in ANALYZERS]
            snapshot = build_snapshot(node, current, session=db, analyses=analyses)
            from app.analytics.forecast import risks
            risks(node, current, session=db)
            alerts = predictive.route_pending(db, node, current, snapshot)
            for analysis in analyses:
                for item in analysis["candidates"]:
                    stored = _store_candidate(db, item)
                    if stored is not None:
                        alerts.append(_decide_candidate(db, item, stored, current, snapshot))
            alerts = list({alert["alert_id"]: alert for alert in alerts}.values())
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
        new_alerts = list({alert["alert_id"]: alert for alert in new_alerts}.values())
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
        statement = statement.where(table.c.node_id.in_(entity_nodes(session, node, as_of)))
    return [{"alert_key": row["alert_key"], "alert_id": row["alert_id"],
             "created_at": hour(row["created_at"]).isoformat(), "node": row["node_id"],
             "domain": row["domain"], "type": row["type"], "level": row["level"],
             "status": row["status"], "confidence": row["confidence"], "facts": row["facts"],
             "lead_time_hours": (row["facts"] or {}).get("observations", {}).get("lead_time_hours")}
            for row in session.execute(statement).mappings().all()]
