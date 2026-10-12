from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import insert, select, update
from sqlalchemy.orm import Session

from app.analytics.common import hour
from app.db import get_table

FIRST_HOUR = datetime.fromisoformat("2026-08-17T00:00:00+05:30")


def _initial_state() -> dict[str, Any]:
    return {"running": False, "speed": 3600.0,
            "cursor": (FIRST_HOUR - timedelta(hours=1)).isoformat(),
            "last_processed_at": None, "node": "F01"}


def load_state(session: Session) -> dict[str, Any]:
    table = get_table("replay_state")
    row = session.execute(select(table).where(table.c.state_id == "default")).mappings().first()
    if row is None:
        return _initial_state()
    state = _initial_state()
    state.update(json.loads(row["payload"] or "{}"))
    return state


def save_state(session: Session, state: dict[str, Any]) -> dict[str, Any]:
    table = get_table("replay_state")
    payload = json.dumps(state, separators=(",", ":"))
    cursor = datetime.fromisoformat(state["cursor"])
    exists = session.execute(select(table.c.state_id).where(table.c.state_id == "default")).first()
    if exists:
        session.execute(update(table).where(table.c.state_id == "default").values(as_of=cursor, payload=payload))
    else:
        session.execute(insert(table).values(state_id="default", as_of=cursor, payload=payload))
    return state


def start(session: Session, as_of: datetime | None = None, speed: float | None = None, node: str = "F01") -> dict[str, Any]:
    state = load_state(session)
    if as_of is not None:
        target = hour(as_of)
        state["cursor"] = target.isoformat()
        state["last_processed_at"] = (target - timedelta(hours=1)).isoformat()
    if speed is not None:
        if speed <= 0:
            raise ValueError("speed must be positive")
        state["speed"] = speed
    state["node"] = node
    state["running"] = True
    save_state(session, state)
    session.commit()
    return state


def pause(session: Session) -> dict[str, Any]:
    state = load_state(session)
    state["running"] = False
    save_state(session, state)
    session.commit()
    return state


def seek(session: Session, as_of: datetime) -> dict[str, Any]:
    state = load_state(session)
    target = hour(as_of)
    state["cursor"] = target.isoformat()
    state["last_processed_at"] = (target - timedelta(hours=1)).isoformat()
    save_state(session, state)
    session.commit()
    return state


def set_speed(session: Session, speed: float) -> dict[str, Any]:
    if speed <= 0:
        raise ValueError("speed must be positive")
    state = load_state(session)
    state["speed"] = speed
    save_state(session, state)
    session.commit()
    return state
