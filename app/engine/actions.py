"""Formula-based routine work orders and persistent status workflow."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import insert, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.api.schemas import action_intelligence
from app.engine.scopes import entity_nodes
from app.db import get_table
from app.decision import jev, router
from app.sector.config import load_sector_config

STATUS_ORDER = ("open", "acknowledged", "in_progress", "done")
ACTION_BY_TYPE = {
    "energy_spike": "review_energy_spike", "water_leak": "investigate_leak",
    "tank_low": "investigate_leak", "bin_overflow": "dispatch_waste_collection",
    "asset_risk": "schedule_maintenance", "air_poor": "inspect_air_quality",
    "parking_high": "manage_parking", "congestion": "manage_parking",
    "flood_risk": "check_drains", "heavy_rain": "check_drains",
    "heat_risk": "prepare_heat_response", "safety_incident": "respond_safety_incident",
}


def _savings(candidate: dict[str, Any]) -> tuple[float, float]:
    facts = candidate.get("facts") or {}
    if candidate["type"] == "energy_spike":
        excess = max(0.0, float(facts.get("energy_kwh") or 0) - float(facts.get("hour_of_week_median_kwh") or 0))
        energy = max(0.0, float(facts.get("energy_kwh") or 0))
        grid = max(0.0, float(facts.get("grid_import_kwh") or 0))
        grid_share = min(1.0, grid / energy) if energy else 0.0
        return excess * settings.tariff_inr_per_kwh, excess * grid_share * settings.grid_ef
    if candidate["type"] == "water_leak" and facts.get("flow_lpm") is not None:
        litres = max(0.0, float(facts["flow_lpm"])) * 60
        return (litres / 1000) * settings.water_tariff_inr_per_kl, 0.0
    return 0.0, 0.0


def create_action(session: Session, candidate: dict[str, Any], alert_key: str, level: str,
                  as_of: datetime, decisions: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    action_type = ACTION_BY_TYPE.get(candidate["type"])
    if action_type not in load_sector_config().get("actions", []):
        return None
    table = get_table("actions")
    action_id = "ACT-" + candidate["candidate_id"][:16]
    if session.execute(select(table.c.action_id).where(table.c.action_id == action_id)).first():
        return None
    saving_inr, saving_co2e = _savings(candidate)
    owner_decision = decisions.get("owner.assign") or {}
    priority_decision = decisions.get("action.priority") or {}
    gates = jev.catalogue()["thresholds"]
    if level != "Critical" and any(router.probability(item) < float(gates["review"]) and item.get("flag") != "needs_review"
                                   for item in (owner_decision, priority_decision)):
        return None
    owner = router.label(owner_decision)
    raw_score = priority_decision.get("answer", {}).get("score") if priority_decision.get("answer") else None
    priority = max(0.0, min(100.0, float(raw_score) * 25)) if raw_score is not None else None
    needs_review = bool(owner_decision.get("flag") == "needs_review" or priority_decision.get("flag") == "needs_review"
                        or router.probability(owner_decision) < float(gates["act"])
                        or router.probability(priority_decision) < float(gates["act"]))
    approval = needs_review or level == "Critical" or (priority is not None and priority >= 80)
    action = {"id": action_id, "alert_key": alert_key, "type": action_type, "node": candidate["node"],
              "text": action_type.replace("_", " ").capitalize() + " at " + candidate["node"],
              "saving_inr": saving_inr, "saving_co2e": saving_co2e, "priority": priority,
              "owner": owner, "status": "open", "needs_head_approval": approval, "source": "rule",
              "needs_review": needs_review, "created_at": as_of.isoformat()}
    existing = session.execute(select(table).where(table.c.alert_key == alert_key)).mappings().first()
    if existing is not None:
        # A realized prediction updates the same work order and preserves progress.
        session.execute(update(table).where(table.c.action_id == existing["action_id"]).values(
            type=action_type, text=action["text"], saving_inr=saving_inr, saving_co2e=saving_co2e,
            priority=priority, owner=owner, needs_head_approval=int(approval or existing["needs_head_approval"]),
            payload=json.dumps({**json.loads(existing.get("payload") or "{}"), "needs_review": needs_review}),
        ))
        updated = session.execute(select(table).where(table.c.action_id == existing["action_id"])).mappings().one()
        return _map_row(dict(updated))
    session.execute(insert(table).values(
        action_id=action_id, alert_key=alert_key, created_at=as_of, node_id=action["node"],
        type=action_type, text=action["text"], saving_inr=saving_inr, saving_co2e=saving_co2e,
        priority=priority, owner=owner, status="open", needs_head_approval=int(approval), source="rule",
        payload=json.dumps({"needs_review": needs_review}),
    ))
    return action


def _map_row(row: dict[str, Any]) -> dict[str, Any]:
    payload = json.loads(row.get("payload") or "{}")
    return {"id": row["action_id"], "alert_key": row["alert_key"], "type": row["type"],
            "node": row["node_id"], "text": row["text"], "saving_inr": row["saving_inr"] or 0.0,
            "saving_co2e": row["saving_co2e"] or 0.0, "priority": row["priority"],
            "owner": row["owner"], "status": row["status"],
            "needs_head_approval": bool(row["needs_head_approval"] or payload.get("needs_review")), "source": row["source"],
            "needs_review": bool(payload.get("needs_review")),
            "estimate_available": payload.get("estimate_available", True),
            "history": payload.get("history", []),
            **action_intelligence(payload),
            "created_at": row["created_at"].isoformat() if row["created_at"] else None}


def list_actions(session: Session, as_of: datetime | None = None, node: str | None = None) -> list[dict[str, Any]]:
    table = get_table("actions")
    stmt = select(table)
    if as_of is not None:
        stmt = stmt.where(table.c.created_at <= as_of)
    if node and node != "F01":
        stmt = stmt.where(table.c.node_id.in_(entity_nodes(session, node, as_of)))
    stmt = stmt.order_by(table.c.priority.desc().nullslast(), table.c.created_at)
    return [_map_row(dict(row)) for row in session.execute(stmt).mappings()]


def change_status(session: Session, action_id: str, status: str, role: str) -> dict[str, Any]:
    table = get_table("actions")
    row = session.execute(select(table).where(table.c.action_id == action_id)).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Action not found")
    if status not in STATUS_ORDER or row["status"] not in STATUS_ORDER:
        raise HTTPException(status_code=422, detail="Unknown action status")
    if STATUS_ORDER.index(status) != STATUS_ORDER.index(row["status"]) + 1:
        raise HTTPException(status_code=409, detail="Action status must advance one step")
    if status == "done" and (row["needs_head_approval"] or json.loads(row.get("payload") or "{}").get("needs_review")) and role != "head":
        raise HTTPException(status_code=403, detail="Head approval is required")
    payload = json.loads(row.get("payload") or "{}")
    from app.replay_calendar import now_ist
    payload["history"] = [*payload.get("history", []), {"from": row["status"], "to": status, "role": role, "at": now_ist().isoformat()}]
    session.execute(update(table).where(table.c.action_id == action_id).values(status=status, payload=json.dumps(payload)))
    session.commit()
    updated = session.execute(select(table).where(table.c.action_id == action_id)).mappings().one()
    return _map_row(dict(updated))
