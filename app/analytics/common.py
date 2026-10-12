from __future__ import annotations

import hashlib
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any, Iterator
from zoneinfo import ZoneInfo

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.metrics import data_source, to_records
from app.analytics.repository import fetch_frame, resolve_scope
from app.db import get_table, runtime_engine
from app.sector.config import load_sector_config

IST = ZoneInfo("Asia/Kolkata")


def ist(value: datetime | pd.Timestamp) -> datetime:
    parsed = pd.Timestamp(value).to_pydatetime()
    return parsed.replace(tzinfo=IST) if parsed.tzinfo is None else parsed.astimezone(IST)


def hour(value: datetime | pd.Timestamp) -> datetime:
    return ist(value).replace(minute=0, second=0, microsecond=0)


def number(value: Any, default: float | None = None) -> float | None:
    try:
        result = float(value)
        return result if pd.notna(result) and result not in (float("inf"), float("-inf")) else default
    except (TypeError, ValueError):
        return default


def flag(value: Any) -> bool:
    return str(value).strip().lower() in {"1", "1.0", "true", "yes", "on", "high", "critical"}


@contextmanager
def analysis_session(session: Session | None) -> Iterator[Session]:
    if session is not None:
        yield session
        return
    engine = runtime_engine()
    if engine is None:
        raise RuntimeError("DATABASE_URL is required for analytics")
    with Session(engine) as owned:
        yield owned


def current_frame(session: Session, table: str, node: str, as_of: datetime) -> pd.DataFrame:
    tick = hour(as_of)
    return fetch_frame(session, table, node, tick, ist(as_of), ist(as_of))


def prior_frame(session: Session, table: str, node: str, as_of: datetime, days: int) -> pd.DataFrame:
    tick = hour(as_of)
    return fetch_frame(session, table, node, tick - timedelta(days=days), tick - timedelta(microseconds=1), tick)


def thresholds() -> dict[str, Any]:
    return load_sector_config().get("thresholds", {})


def event_context(session: Session, node: str, as_of: datetime) -> dict[str, Any]:
    tick = hour(as_of)
    holidays = {str(day) for day in load_sector_config().get("holidays", [])}
    table = get_table("occupancy_hourly")
    relative: float | None = None
    if table is not None:
        stamps = [tick] + [tick - timedelta(weeks=week) for week in range(1, 5)]
        scope, target = resolve_scope(session, node)
        statement = select(table.c.timestamp, func.sum(table.c.occupancy_count)).where(table.c.timestamp.in_(stamps))
        for dimension in ({"facility": ("facility_id",), "zone": ("zone_id", "facility_id"),
                           "building": ("building_id", "zone_id", "facility_id"),
                           "floor": ("building_id", "zone_id", "facility_id")}.get(
                               str(target.get("level") or "facility").lower(), ("facility_id",)
                           )):
            allowed = scope.get(dimension)
            if allowed and dimension in table.c:
                statement = statement.where(table.c[dimension].in_(sorted(allowed)))
                break
        statement = statement.group_by(table.c.timestamp)
        totals = {hour(stamp): float(value) for stamp, value in session.execute(statement).all() if value is not None}
        previous = [totals[stamp] for stamp in stamps[1:] if stamp in totals]
        if previous and tick in totals:
            typical = float(pd.Series(previous).median())
            relative = totals[tick] / typical if typical > 0 else None
    return {"is_holiday": tick.date().isoformat() in holidays,
            "imputed_flag": False, "occupancy_vs_usual": relative}


def candidate(
    domain: str, kind: str, node: str, ts: datetime | pd.Timestamp,
    facts: dict[str, Any], context: dict[str, Any], source_key: str | None = None,
) -> dict[str, Any]:
    stamp = hour(ts)
    identity = "|".join((kind, node, stamp.isoformat(), source_key or ""))
    return {"candidate_id": hashlib.sha256(identity.encode()).hexdigest()[:24],
            "domain": domain, "type": kind, "node": node, "ts": stamp.isoformat(),
            "facts": facts, "context": context.copy()}


def analysis_result(
    domain: str, current: pd.DataFrame, kpis: dict[str, Any], candidates: list[dict[str, Any]],
    hotspots: list[dict[str, Any]], context: dict[str, Any], forecast_ref: str | None = None,
) -> dict[str, Any]:
    return {"domain": domain, "current": to_records(current), "kpis": kpis,
            "candidates": candidates, "hotspots": hotspots, "forecast_ref": forecast_ref,
            "context": context, "data_source": data_source(domain)}


def top_rows(frame: pd.DataFrame, key: str, metric: str, count: int) -> list[dict[str, Any]]:
    if frame.empty or key not in frame or metric not in frame:
        return []
    ranked = frame[[key, metric]].copy()
    ranked[metric] = pd.to_numeric(ranked[metric], errors="coerce")
    ranked = ranked.dropna(subset=[metric]).groupby(key, as_index=False)[metric].sum()
    return to_records(ranked.sort_values(metric, ascending=False).head(count))
