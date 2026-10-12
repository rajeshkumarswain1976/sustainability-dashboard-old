from __future__ import annotations

from datetime import date, datetime
from typing import Iterable

import numpy as np
import pandas as pd

TIMESTAMP_NAMES = {"timestamp", "timestamp_start", "timestamp_end", "predicted_overflow_time", "collection_time", "last_collection_time"}
NONNEGATIVE_TOKENS = (
    "energy_kwh", "peak_demand", "occupancy", "flow_lpm", "water_consumption", "line_pressure",
    "waste_weight", "fill_percentage", "fill_rate", "capacity", "co2e", "vehicle_count", "parking_occupancy",
)
RANGE_0_1 = ("utilisation", "utilization", "availability", "freshwater_dependency", "diversion_rate")
RANGE_0_100 = ("fill_percentage", "tank_level_pct", "floor_utilisation", "classroom_utilisation")


def _as_ist(value: object) -> pd.Timestamp | None:
    if value is None or pd.isna(value):
        return None
    result = pd.Timestamp(value)
    if result.tzinfo is None:
        return result.tz_localize("Asia/Kolkata")
    return result.tz_convert("Asia/Kolkata")


def clean_and_validate(frame: pd.DataFrame, table: str, primary_key: Iterable[str] = ()) -> list[str]:
    """Trim text, normalize timestamp awareness, and return data-quality errors."""
    errors: list[str] = []
    if frame.empty:
        return errors
    for column in frame.columns:
        if pd.api.types.is_object_dtype(frame[column]):
            frame[column] = frame[column].map(lambda item: item.strip() if isinstance(item, str) else item)
        if column.lower() in TIMESTAMP_NAMES or column.lower().endswith("_timestamp"):
            parsed = pd.to_datetime(frame[column], errors="coerce", utc=True)
            invalid = frame[column].notna() & parsed.isna()
            if invalid.any():
                errors.append(f"{column} contains {int(invalid.sum())} unparseable timestamps")
            frame[column] = parsed.dt.tz_convert("Asia/Kolkata")
    keys = [key for key in primary_key if key in frame.columns]
    if keys:
        duplicates = frame.duplicated(keys, keep=False)
        if duplicates.any():
            errors.append(f"duplicate keys for {', '.join(keys)}: {int(duplicates.sum())} rows")
    for column in frame.select_dtypes(include=[np.number]).columns:
        values = frame[column].replace([np.inf, -np.inf], np.nan)
        if values.isna().sum() > frame[column].isna().sum():
            errors.append(f"{column} contains non-finite numeric values")
        name = column.lower()
        if any(token in name for token in NONNEGATIVE_TOKENS) and (values.dropna() < 0).any():
            errors.append(f"{column} contains negative values")
        if any(token in name for token in RANGE_0_1) and ((values.dropna() < 0) | (values.dropna() > 1)).any():
            errors.append(f"{column} is outside 0..1")
        if any(token in name for token in RANGE_0_100) and ((values.dropna() < 0) | (values.dropna() > 100)).any():
            errors.append(f"{column} is outside 0..100")
    return errors


def validate_timestamp_window(
    frame: pd.DataFrame, column: str, start: datetime | date | None = None,
    end: datetime | date | None = None,
) -> list[str]:
    errors: list[str] = []
    if column not in frame.columns:
        return errors
    values = pd.to_datetime(frame[column], errors="coerce", utc=True).dt.tz_convert("Asia/Kolkata")
    if start is not None:
        low = _as_ist(start)
        if low is not None and (values < low).any():
            errors.append(f"{column} contains values before the allowed window")
    if end is not None:
        high = _as_ist(end)
        if high is not None and (values > high).any():
            errors.append(f"{column} contains values after the allowed window")
    return errors


def align(
    frame: pd.DataFrame,
    freq: str,
    how: str = "resample",
    on: str = "timestamp",
    value_columns: list[str] | None = None,
    tolerance: str | pd.Timedelta | None = None,
    window: str | int | None = None,
) -> pd.DataFrame:
    """Align observations on a time grid using resampling, nearest-time, or rolling."""
    if on not in frame.columns:
        raise KeyError(on)
    work = frame.copy()
    work[on] = pd.to_datetime(work[on], errors="coerce", utc=True).dt.tz_convert("Asia/Kolkata")
    work = work.dropna(subset=[on]).sort_values(on)
    values = value_columns or [
        col for col in work.select_dtypes(include=[np.number]).columns
        if col != on and col not in {"floor_no", "sort_order"}
    ]
    if how == "nearest":
        grid = pd.date_range(work[on].min(), work[on].max(), freq=freq, tz="Asia/Kolkata")
        left = pd.DataFrame({on: grid})
        right = work[[on, *values]].drop_duplicates(on).sort_values(on)
        return pd.merge_asof(
            left, right, on=on,
            tolerance=pd.Timedelta(tolerance) if tolerance is not None else pd.Timedelta(freq),
            direction="nearest",
        )
    indexed = work.set_index(on)
    if how == "resample":
        return indexed[values].resample(freq).mean().reset_index()
    if how == "rolling":
        if window is None:
            raise ValueError("rolling alignment requires window")
        return indexed[values].rolling(window=window, min_periods=1).mean().resample(freq).mean().reset_index()
    raise ValueError("how must be one of: resample, nearest, rolling")
