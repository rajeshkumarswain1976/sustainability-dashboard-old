from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import DOMAIN_TABLES, get_table
from app import replay_calendar

DIMENSIONS = {
    "facility": "facility_id",
    "zone": "zone_id",
    "building": "building_id",
    "floor": "floor_id",
    "area": "area_id",
}


def _ist(value: datetime) -> datetime:
    if value.tzinfo is None:
        from zoneinfo import ZoneInfo
        return value.replace(tzinfo=ZoneInfo("Asia/Kolkata"))
    from zoneinfo import ZoneInfo
    return value.astimezone(ZoneInfo("Asia/Kolkata"))


def _location_records(session: Session) -> list[dict[str, Any]]:
    table = get_table("location_dim")
    if table is None:
        return []
    records = [dict(row) for row in session.execute(select(table)).mappings().all()]
    # Stable API identities disambiguate a zone and building with the same raw key.
    counts = {}
    for row in records:
        key = str(row.get("node_id"))
        counts[key] = counts.get(key, 0) + 1
    originals = {(str(row.get("level")), str(row.get("node_id"))): row for row in records}
    identities = {key: (f"{key[0]}:{key[1]}" if counts[key[1]] > 1 and key[0] != "zone" else key[1])
                  for key in originals}
    for row in records:
        level, original = str(row.get("level")), str(row.get("node_id"))
        row["node_id"] = identities[(level, original)]
        parent_level = {"floor": "building", "building": "zone", "area": "zone", "zone": "facility"}.get(level)
        parent = row.get("parent_id")
        if parent_level and parent is not None:
            row["parent_id"] = identities.get((parent_level, str(parent)), parent)
    return records


def resolve_scope(session: Session, node: str) -> tuple[dict[str, set[str]], dict[str, Any]]:
    records = _location_records(session)
    target = next((row for row in records if str(row.get("node_id")) == node or str(row.get("label")) == node), None)
    if target is None:
        # Facility identifiers are also stable master keys when a location tree is sparse.
        table = get_table("facility")
        if table is not None:
            found = session.execute(select(table.c.facility_id).where(table.c.facility_id == node)).first()
            if found:
                return {"facility_id": {node}}, {"node_id": node, "level": "facility", "label": node}
        raise KeyError(node)
    by_parent: dict[str, list[dict[str, Any]]] = {}
    for row in records:
        parent = row.get("parent_id")
        if parent not in (None, ""):
            by_parent.setdefault(str(parent), []).append(row)
    subtree: list[dict[str, Any]] = []
    stack = [target]
    seen: set[str] = set()
    while stack:
        current = stack.pop()
        key = str(current.get("node_id"))
        if key in seen:
            continue
        seen.add(key)
        subtree.append(current)
        stack.extend(by_parent.get(key, []))
    values: dict[str, set[str]] = {key: set() for key in DIMENSIONS.values()}
    for row in subtree:
        for dimension in values:
            value = row.get(dimension)
            if value not in (None, ""):
                values[dimension].add(str(value))
        level = str(row.get("level") or "").lower()
        id_column = DIMENSIONS.get(level)
        if id_column and row.get("node_id") not in (None, ""):
            values[id_column].add(str(row["node_id"]))
    scope = {key: val for key, val in values.items() if val}
    return scope, target


def fetch_frame(
    session: Session,
    table_name: str,
    node: str,
    start: datetime,
    end: datetime,
    as_of: datetime,
) -> pd.DataFrame:
    table = DOMAIN_TABLES.get(table_name)
    if table is None:
        table = get_table(table_name)
    if table is None:
        return pd.DataFrame()
    scope, target = resolve_scope(session, node)
    calendar_offset = replay_calendar.offset()
    lower = _ist(start) - calendar_offset
    upper = min(_ist(end), _ist(as_of)) - calendar_offset
    statement = select(table)
    level = str(target.get("level") or "facility").lower()
    # No fabricated floor readings from a building-only source. Environmental
    # layers remain shared; building-energy history supports floor allocation.
    if level == "floor" and "floor_id" not in table.c and table_name not in {
        "air_environment", "weather", "water_resources", "campus_operations",
        "energy_building_hourly", "registry_buildings", "registry_assets", "registry_tanks",
        "registry_meters", "registry_outdoor_areas", "registry_zones_climate", "registry_emission_factors",
    }:
        return pd.DataFrame()
    # The location-level environmental layers apply to every child node.
    if table_name in {"air_environment", "weather", "water_resources", "campus_operations"}:
        preferred = ("facility_id",)
    else:
        preferred = {
            "facility": ("facility_id",),
            "zone": ("zone_id", "facility_id"),
            "building": ("building_id", "zone_id", "facility_id"),
            "floor": ("floor_id", "building_id", "zone_id", "facility_id"),
            "area": ("area_id", "zone_id", "facility_id"),
        }.get(level, ("facility_id",))
    for dimension in preferred:
        allowed = scope.get(dimension)
        if dimension in table.c and allowed:
            statement = statement.where(table.c[dimension].in_(sorted(allowed)))
            break
    time_column = next((name for name in ("timestamp", "date", "timestamp_start") if name in table.c), None)
    if time_column:
        column = table.c[time_column]
        statement = statement.where(column >= lower, column <= upper)
        if "timestamp_end" in table.c and time_column == "timestamp_start":
            statement = statement.where(table.c.timestamp_end <= upper)
    rows = session.execute(statement).mappings().all()
    frame = pd.DataFrame([dict(row) for row in rows])
    if frame.empty:
        return frame
    # SQLite returns naive timestamps; preserve the API's IST contract.
    time_columns = {"timestamp", "timestamp_start", "timestamp_end", "date", "predicted_overflow_time",
                    "collection_time", "last_collection_time"}
    for column in frame:
        if column not in time_columns and not column.endswith("_date") and not column.endswith("_timestamp"):
            continue
        if column in frame:
            parsed = pd.to_datetime(frame[column], errors="coerce")
            if parsed.dt.tz is None:
                parsed = parsed.dt.tz_localize("Asia/Kolkata")
            else:
                parsed = parsed.dt.tz_convert("Asia/Kolkata")
            frame[column] = parsed + calendar_offset
    return frame


def location_tree(session: Session, node: str) -> list[dict[str, Any]]:
    records = _location_records(session)
    scope, target = resolve_scope(session, node)
    node_id = str(target.get("node_id"))
    allowed_ids: set[str] = set()
    by_parent: dict[str, list[dict[str, Any]]] = {}
    for row in records:
        if row.get("parent_id") not in (None, ""):
            by_parent.setdefault(str(row["parent_id"]), []).append(row)
    stack = [node_id]
    while stack:
        current = stack.pop()
        if current in allowed_ids:
            continue
        allowed_ids.add(current)
        stack.extend(str(row.get("node_id")) for row in by_parent.get(current, []))
    return [row for row in records if str(row.get("node_id")) in allowed_ids]
