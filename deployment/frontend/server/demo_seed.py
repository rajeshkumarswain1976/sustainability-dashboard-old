"""Seed visible, clearly synthetic workflow examples from replay detections."""
from __future__ import annotations

from datetime import timedelta
from hashlib import sha256
import json

from sqlalchemy import insert, select, update

from app.db import get_table
from app.replay_calendar import now_ist
from server.storage import log_complaint_event


def _id(prefix: str, value: str) -> str:
    return prefix + sha256(value.encode()).hexdigest()[:16].upper()


def seed_demo_workflow(session) -> dict[str, int]:
    """Turn recent detector candidates into review tasks and demo reports once."""
    cutoff = now_ist()
    start = cutoff - timedelta(days=7)
    alerts = get_table("alerts")
    actions = get_table("actions")
    candidates = session.execute(select(alerts).where(
        alerts.c.created_at >= start, alerts.c.created_at <= cutoff,
        alerts.c.status.in_(["candidate", "needs_review", "open", "pending_agent"]),
    ).order_by(alerts.c.created_at.desc())).mappings().all()
    for row in candidates:
        if row["status"] == "candidate":
            facts = dict(row["facts"] or {})
            facts["synthetic_replay"] = True
            facts["review_reason"] = "Automated detector candidate; human confirmation is required."
            session.execute(update(alerts).where(alerts.c.alert_id == row["alert_id"]).values(
                status="needs_review", level=row["level"] or "Monitor", facts=facts,
            ))

    action_count = 0
    for row in candidates[:8]:
        if session.execute(select(actions.c.action_id).where(actions.c.alert_key == row["alert_key"])).first():
            continue
        label = str(row["type"]).replace("_", " ")
        task_text = f"Review synthetic {label} signal at {row['node_id']} and confirm the on-site condition."
        payload = {"synthetic": True, "provenance": "synthetic_replay", "estimate_available": False,
                   "needs_review": True, "review_reason": "Generated from a replay detector candidate; verify before work.",
                   "source_alert": row["alert_id"]}
        session.execute(insert(actions).values(
            action_id=_id("SIM-ACT-", str(row["alert_key"])), created_at=row["created_at"],
            node_id=row["node_id"], status="open", payload=json.dumps(payload),
            alert_key=row["alert_key"], type=row["type"], text=task_text,
            saving_inr=None, saving_co2e=None, priority=None, owner="Facilities",
            needs_head_approval=1, source="synthetic_demo",
        ))
        action_count += 1

    complaint_table = get_table("complaints")
    existing_demo = session.execute(select(complaint_table.c.complaint_id).where(
        complaint_table.c.payload.like('%"source":"synthetic_demo"%')
    ).limit(1)).first()
    complaint_count = 0
    if not existing_demo:
        incidents = get_table("safety_incidents")
        recent = session.execute(select(incidents).where(
            incidents.c.timestamp >= start, incidents.c.timestamp <= cutoff,
        ).order_by(incidents.c.timestamp.desc()).limit(3)).mappings().all()
        for row in recent:
            identifier = _id("SIM-COM-", str(row["incident_id"]))
            created = row["timestamp"]
            node = str(row.get("area_id") or row.get("zone_id") or "F01")
            text = (f"Synthetic replay follow-up for incident {row['incident_id']}: "
                    f"verify the simulated {row.get('description') or row.get('incident_type') or 'safety event'}.")
            severity = str(row.get("severity") or "moderate").lower()
            urgency = {"critical": "critical", "major": "high", "moderate": "medium", "minor": "low"}.get(severity, "medium")
            item = {
                "id": identifier, "node": node, "created_at": created.isoformat(), "status": "open",
                "text": text, "category": "Safety", "urgency": urgency,
                "owner": str(row.get("department") or "Facilities"), "priority": None,
                "confidence": None, "needs_review": True, "cluster_id": identifier,
                "linked_alert": None, "action_id": None, "building": None,
                "source": "synthetic_demo", "submitted_role": "synthetic_demo", "synthetic": True,
                "source_incident_id": row["incident_id"],
            }
            if session.execute(select(complaint_table.c.complaint_id).where(
                complaint_table.c.complaint_id == identifier
            )).first():
                continue
            session.execute(insert(complaint_table).values(
                complaint_id=identifier, created_at=created, node_id=node, status="open", payload="{}",
            ))
            from server import complaints
            complaints._store(session, item)
            log_complaint_event(session, identifier, "synthetic_demo", "submitted", None, item, created)
            complaint_count += 1
    session.commit()
    return {"review_alerts": sum(row["status"] == "candidate" for row in candidates),
            "actions": action_count, "complaints": complaint_count}
