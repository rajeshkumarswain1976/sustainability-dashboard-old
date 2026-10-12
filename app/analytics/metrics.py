from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd
from sqlalchemy.orm import Session

from app.analytics.rollup import rollup

REPLAY_MODE = "real_time_historical_data_replay"
DOMAIN_SOURCES = {
    "energy": "measured_historical_replay_allocated_to_floors",
    "emissions": "derived_replay",
    "sustainability": "derived_replay",
    "weather": "synthetic_replay",
    "air": "synthetic_replay",
    "water": "synthetic_replay",
    "waste": "synthetic_replay",
    "mobility": "synthetic_replay",
    "assets": "synthetic_replay",
    "safety": "synthetic_replay",
    "climate": "synthetic_replay",
    "overview": "derived_replay",
    "insights": "derived_replay",
    "operations": "synthetic_replay",
}


def data_source(domain: str) -> dict[str, str]:
    return {"mode": REPLAY_MODE, "classification": DOMAIN_SOURCES.get(domain, "synthetic_replay")}


def _numeric(frame: pd.DataFrame, column: str) -> pd.Series:
    if column not in frame:
        return pd.Series(dtype="float64")
    return pd.to_numeric(frame[column], errors="coerce").replace([float("inf"), float("-inf")], pd.NA).dropna()


def total(frame: pd.DataFrame, column: str, default: float = 0.0) -> float:
    values = _numeric(frame, column)
    return float(values.sum()) if len(values) else default


def mean(frame: pd.DataFrame, column: str) -> float | None:
    values = _numeric(frame, column)
    return float(values.mean()) if len(values) else None


def maximum(frame: pd.DataFrame, column: str) -> float | None:
    values = _numeric(frame, column)
    return float(values.max()) if len(values) else None


def count_true(frame: pd.DataFrame, column: str) -> int:
    if column not in frame:
        return 0
    value = frame[column]
    if pd.api.types.is_bool_dtype(value):
        return int(value.fillna(False).sum())
    numeric = pd.to_numeric(value, errors="coerce")
    if numeric.notna().any():
        return int((numeric.fillna(0) != 0).sum())
    return int(value.astype(str).str.lower().isin({"true", "yes", "active", "critical", "high"}).sum())


def ratio(numerator: float, denominator: float) -> float | None:
    return numerator / denominator if denominator else None


def sustainability_score(frame: pd.DataFrame) -> float | None:
    """One score calculation shared by overview and sustainability responses."""
    if frame.empty:
        return None
    if "sustainability_score" in frame:
        direct = _numeric(frame, "sustainability_score")
        if len(direct):
            return float(direct.sum() / len(direct))
    components = [column for column in frame.columns if column.endswith("_score") and column != "sustainability_score"]
    values = pd.concat([_numeric(frame, column) for column in components], ignore_index=True) if components else pd.Series(dtype="float64")
    if values.empty:
        return None
    return float(values.sum() / len(values))


def to_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    if frame.empty:
        return []
    cleaned = frame.astype(object).where(pd.notna(frame), None)
    records = cleaned.to_dict(orient="records")
    for record in records:
        for key, value in record.items():
            if hasattr(value, "isoformat"):
                record[key] = value.isoformat()
            elif hasattr(value, "item"):
                record[key] = value.item()
    return records


def window_payload(node: str, start: datetime, end: datetime, as_of: datetime) -> dict[str, str]:
    tz = ZoneInfo("Asia/Kolkata")
    lower = start.replace(tzinfo=tz) if start.tzinfo is None else start.astimezone(tz)
    upper = end.replace(tzinfo=tz) if end.tzinfo is None else end.astimezone(tz)
    cutoff = as_of.replace(tzinfo=tz) if as_of.tzinfo is None else as_of.astimezone(tz)
    effective_end = min(upper, cutoff)
    return {
        "node": node,
        "start": lower.isoformat(),
        "end": upper.isoformat(),
        "as_of": cutoff.isoformat(),
        "effective_end": effective_end.isoformat(),
    }


def domain_frames(session: Session, node: str, start: datetime, end: datetime, as_of: datetime) -> dict[str, pd.DataFrame]:
    return rollup(session, node, start, end, as_of)


def overview_snapshot(frames: dict[str, pd.DataFrame]) -> dict[str, Any]:
    score = sustainability_score(frames["sustainability"])
    energy = frames["energy"]
    water = frames["water"]
    waste = frames["waste"]
    safety = frames["safety"]
    return {
        "sustainability_score": score,
        "energy_kwh": total(energy, "energy_kwh"),
        "water_consumption_litres": total(water, "water_consumption_litres"),
        "waste_weight": total(waste, "waste_weight"),
        "open_incidents": int((safety.get("status", pd.Series(dtype=str)).astype(str).str.lower() != "closed").sum()) if not safety.empty else 0,
        "energy_signal_count": len(frames["signals"]),
    }
