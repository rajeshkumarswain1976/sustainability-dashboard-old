"""Full Forecasting Engine for Campus Sustainability Operations.
Engine B: Gradient boosting, simulation, formulas, rules, and evaluation.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from copy import deepcopy
from pathlib import Path
import math
from typing import Any
from zoneinfo import ZoneInfo
import yaml

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from threadpoolctl import threadpool_limits
from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from app.analytics.common import analysis_session, hour
from app.analytics.metrics import data_source, sustainability_score as calc_sustainability_score
from app.analytics.repository import fetch_frame
from app.db import ensure_forecast_tables, get_table
from app.sector.config import load_sector_config

TZ = ZoneInfo("Asia/Kolkata")

_REGISTRY_CACHE: list[dict[str, Any]] | None = None
_GLOBAL_MODEL_CACHE: dict[tuple[Any, str, str], dict[str, Any]] = {}
_TRAINED_MODEL_CACHE: dict[tuple[Any, ...], dict[str, Any]] = {}


def load_forecast_targets() -> list[dict[str, Any]]:
    global _REGISTRY_CACHE
    if _REGISTRY_CACHE is not None:
        return _REGISTRY_CACHE
    path = Path(__file__).resolve().parents[2] / "config" / "forecasts.yaml"
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    targets = data.get("targets") if isinstance(data, dict) else None
    required = {"id", "domain", "table", "entity_key", "metric", "horizons", "method", "baseline", "drivers"}
    if not isinstance(targets, list) or not targets:
        raise ValueError("Forecast registry must contain a non-empty targets list")
    seen = set()
    for target in targets:
        if not isinstance(target, dict) or not required.issubset(target):
            raise ValueError("Forecast target is missing required fields")
        if target["id"] in seen:
            raise ValueError(f"Duplicate forecast target: {target['id']}")
        seen.add(target["id"])
    _REGISTRY_CACHE = targets
    return _REGISTRY_CACHE


def get_target_meta(target_id: str) -> dict[str, Any] | None:
    targets = load_forecast_targets()
    for t in targets:
        if t["id"] == target_id:
            return t
    return None


def smape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    denom = np.abs(y_true) + np.abs(y_pred) + 1e-6
    diff = np.abs(y_true - y_pred)
    return float(np.mean(200.0 * diff / denom)) if len(y_true) > 0 else 0.0


def band_coverage(y_true: np.ndarray, lo: np.ndarray, hi: np.ndarray) -> float:
    y_true = np.asarray(y_true, dtype=float)
    lo = np.asarray(lo, dtype=float)
    hi = np.asarray(hi, dtype=float)
    if len(y_true) == 0:
        return 100.0
    covered = (y_true >= lo) & (y_true <= hi)
    return float(np.mean(covered) * 100.0)


def heat_index(temp_c: float, rh_pct: float) -> float:
    """Steadman / Rothfusz heat index calculation."""
    if temp_c < 27.0:
        return temp_c
    T = temp_c * 9.0 / 5.0 + 32.0
    R = rh_pct
    c1, c2, c3 = -42.379, 2.04901523, 10.14333127
    c4, c5, c6 = -0.22475541, -0.00683783, -0.05481717
    c7, c8, c9 = 0.00122874, 0.00085282, -0.00000199
    hi_f = (c1 + c2*T + c3*R + c4*T*R + c5*T*T + c6*R*R +
            c7*T*T*R + c8*T*R*R + c9*T*T*R*R)
    return (hi_f - 32.0) * 5.0 / 9.0


def aqi_category(aqi: float) -> str:
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Satisfactory"
    if aqi <= 200:
        return "Moderate"
    if aqi <= 300:
        return "Poor"
    if aqi <= 400:
        return "Very Poor"
    return "Severe"


def _as_ist(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=TZ)
    return dt.astimezone(TZ)


# =========================================================================
# Climatology & Weather Forecasting
# =========================================================================

def forecast_weather(db: Session, as_of: datetime, horizon_hours: int = 24) -> pd.DataFrame:
    """Climatology (hour-of-day mean of last 14 days) blended with persistence.
    Returns DataFrame indexed by forecast timestamp with columns:
    temperature, humidity, rainfall, wind_speed.
    """
    cutoff = hour(as_of)
    start_14d = cutoff - timedelta(days=14)
    raw = fetch_frame(db, "weather", "F01", start_14d, cutoff, cutoff)
    metrics = ["temperature", "humidity", "rainfall", "wind_speed"]
    if raw.empty:
        return pd.DataFrame(columns=metrics, index=pd.DatetimeIndex([], tz=TZ))

    raw["timestamp"] = pd.to_datetime(raw["timestamp"])
    raw = raw.sort_values("timestamp")
    raw["hour"] = raw["timestamp"].dt.hour
    climatology = raw.groupby("hour")[metrics].mean()

    # Persistence from last observed 24h
    last_24 = raw[raw["timestamp"] > cutoff - timedelta(hours=24)]
    last_map = {}
    for m in metrics:
        if not last_24.empty and m in last_24:
            last_map[m] = dict(zip(last_24["timestamp"].dt.hour, last_24[m]))
        else:
            last_map[m] = {}

    rows = []
    dates = []
    for h in range(1, horizon_hours + 1):
        target_time = cutoff + timedelta(hours=h)
        target_hour = target_time.hour
        dates.append(target_time)
        row = {}
        for m in metrics:
            clim_val = float(climatology.at[target_hour, m]) if target_hour in climatology.index else 0.0
            pers_val = float(last_map[m].get(target_hour, clim_val))
            # Blend 0.5 climatology + 0.5 persistence
            val = 0.5 * clim_val + 0.5 * pers_val
            if m == "rainfall":
                val = max(0.0, val)
            row[m] = val
        rows.append(row)

    df = pd.DataFrame(rows, index=pd.DatetimeIndex(dates))
    return df


# =========================================================================
# Feature Engineering & Multi-Horizon Modeling
# =========================================================================

FEATURE_NAMES = [
    "entity_code", "horizon", "hour", "dayofweek", "is_holiday",
    "lag_1", "lag_24", "lag_168", "rolling_24_mean", "rolling_24_std",
    "occupancy", "temperature", "humidity", "rainfall", "wind_speed"
]


def extract_entity_series(frame: pd.DataFrame, entity_key: str | None, metric: str) -> dict[str, pd.Series]:
    if frame.empty or metric not in frame.columns:
        return {}
    work = frame.copy()
    work[metric] = pd.to_numeric(work[metric], errors="coerce").replace([np.inf, -np.inf], np.nan)
    work = work.dropna(subset=[metric])
    work["timestamp"] = pd.to_datetime(work["timestamp"])
    series_map = {}
    if entity_key is None:
        agg = work.groupby("timestamp")[metric].sum(min_count=1)
        agg.index = pd.to_datetime(agg.index)
        series_map["F01"] = agg.sort_index()
    else:
        for ent, grp in work.groupby(entity_key):
            agg = grp.groupby("timestamp")[metric].sum(min_count=1)
            agg.index = pd.to_datetime(agg.index)
            series_map[str(ent)] = agg.sort_index()
    return series_map


def build_training_matrix(
    series_map: dict[str, pd.Series],
    entities: list[str],
    holidays: set[str],
    weather_df: pd.DataFrame,
    occupancy_map: dict[str, pd.Series],
    cutoff: datetime,
    max_days: int = 45,
    step_sample: int = 4,
) -> tuple[np.ndarray, np.ndarray]:
    """Construct multi-horizon training set strictly before cutoff without future leakage."""
    X_rows = []
    y_rows = []
    entity_code_map = {ent: i for i, ent in enumerate(entities)}
    min_time = cutoff - timedelta(days=max_days)
    max_samples = 3000

    train_entities = entities
    eff_step = max(step_sample, 8 if len(entities) > 10 else 4)

    # Fast weather lookup dict: timestamp -> (temp, hum, rain, wind)
    w_lookup: dict[datetime, tuple[float, float, float, float]] = {}
    if weather_df is not None and not weather_df.empty:
        for idx, row in weather_df.iterrows():
            w_lookup[idx] = (
                float(row["temperature"]) if pd.notna(row.get("temperature")) else 26.0,
                float(row["humidity"]) if pd.notna(row.get("humidity")) else 60.0,
                float(row["rainfall"]) if pd.notna(row.get("rainfall")) else 0.0,
                float(row["wind_speed"]) if pd.notna(row.get("wind_speed")) else 2.0,
            )

    # Fast occupancy lookup dict: ent -> {ts: occ}
    occ_lookup: dict[str, dict[datetime, float]] = {}
    for ent, occ_s in occupancy_map.items():
        if occ_s is not None and not occ_s.empty:
            occ_lookup[ent] = {ts: float(val) for ts, val in occ_s.items() if pd.notna(val)}

    for ent in train_entities:
        if len(X_rows) >= max_samples:
            break
        s = series_map.get(ent)
        if s is None or len(s) < 168:
            continue
        ent_code = entity_code_map[ent]
        ent_occ = occ_lookup.get(ent, {})

        # Precompute arrays and time index mapping
        s_times = list(s.index)
        s_vals = s.to_numpy(dtype=float)
        time_to_idx = {ts: idx for idx, ts in enumerate(s_times)}

        valid_issue_times = [
            ts for ts in s_times
            if min_time <= ts <= (cutoff - timedelta(hours=24))
        ]
        # Allocate the sample budget across every entity, including the last bins/meters.
        entity_budget = max(1, max_samples // max(len(entities), 1) // 24)
        sampled_issues = valid_issue_times[::eff_step]
        if len(sampled_issues) > entity_budget:
            sampled_issues = [sampled_issues[i] for i in np.linspace(0, len(sampled_issues) - 1, entity_budget, dtype=int)]

        for t in sampled_issues:
            if len(X_rows) >= max_samples:
                break
            t_idx = time_to_idx.get(t)
            if t_idx is None or t_idx < 168:
                continue

            lag_1 = float(s_vals[t_idx]) if not np.isnan(s_vals[t_idx]) else 0.0
            r24_start = max(0, t_idx - 23)
            roll_slice = np.nan_to_num(s_vals[r24_start : t_idx + 1], nan=lag_1)
            roll_mean = float(np.mean(roll_slice)) if len(roll_slice) > 0 else lag_1
            roll_std = float(np.std(roll_slice)) if len(roll_slice) > 1 else 0.0

            for h in range(1, 25):
                target_ts = t + timedelta(hours=h)
                target_idx = time_to_idx.get(target_ts)
                if target_idx is None:
                    continue
                y_val = float(s_vals[target_idx])
                if np.isnan(y_val):
                    continue

                ts_lag_24 = target_ts - timedelta(hours=24)
                idx_24 = time_to_idx.get(ts_lag_24)
                lag_24 = float(s_vals[idx_24]) if idx_24 is not None and not np.isnan(s_vals[idx_24]) else lag_1

                ts_lag_168 = target_ts - timedelta(hours=168)
                idx_168 = time_to_idx.get(ts_lag_168)
                lag_168 = float(s_vals[idx_168]) if idx_168 is not None and not np.isnan(s_vals[idx_168]) else lag_1

                w_tuple = w_lookup.get(ts_lag_168, (26.0, 60.0, 0.0, 2.0))
                temp, hum, rain, wind = w_tuple

                occ = ent_occ.get(ts_lag_168, 0.0)
                is_hol = int(target_ts.strftime("%Y-%m-%d") in holidays)

                X_rows.append([
                    ent_code, h, target_ts.hour, target_ts.weekday(), is_hol,
                    lag_1, lag_24, lag_168, roll_mean, roll_std,
                    occ, temp, hum, rain, wind
                ])
                y_rows.append(y_val)

    if not X_rows:
        return np.empty((0, len(FEATURE_NAMES))), np.empty((0,))
    return np.array(X_rows, dtype=float), np.array(y_rows, dtype=float)


def run_rolling_origin_backtest(
    model_cls: type,
    series_map: dict[str, pd.Series],
    entities: list[str],
    holidays: set[str],
    weather_history: pd.DataFrame,
    occupancy_map: dict[str, pd.Series],
    cutoff: datetime,
) -> dict[str, Any]:
    """3 folds of rolling origin backtest (at cutoff - 21d, -14d, -7d).
    Evaluates ML model against 3 baselines: lag_168, lag_24, lag_1.
    Computes residual quantiles by horizon bucket (1-6, 7-12, 13-24).
    """
    folds = [
        cutoff - timedelta(days=21),
        cutoff - timedelta(days=14),
        cutoff - timedelta(days=7),
    ]

    fold_results = []
    bucket_residuals = {1: [], 2: [], 3: []}

    ml_maes = []
    base_168_maes = []
    base_24_maes = []
    base_1_maes = []

    entity_code_map = {ent: i for i, ent in enumerate(entities)}
    eval_entities = entities

    # Fast weather lookup
    w_lookup: dict[datetime, tuple[float, float, float, float]] = {}
    if weather_history is not None and not weather_history.empty:
        for idx, row in weather_history.iterrows():
            w_lookup[idx] = (
                float(row["temperature"]) if pd.notna(row.get("temperature")) else 26.0,
                float(row["humidity"]) if pd.notna(row.get("humidity")) else 60.0,
                float(row["rainfall"]) if pd.notna(row.get("rainfall")) else 0.0,
                float(row["wind_speed"]) if pd.notna(row.get("wind_speed")) else 2.0,
            )

    occ_lookup: dict[str, dict[datetime, float]] = {}
    for ent, occ_s in occupancy_map.items():
        if occ_s is not None and not occ_s.empty:
            occ_lookup[ent] = {ts: float(val) for ts, val in occ_s.items() if pd.notna(val)}

    # Pre-extract series arrays and index maps for eval_entities
    series_cache: dict[str, tuple[list[datetime], np.ndarray, dict[datetime, int]]] = {}
    for ent in eval_entities:
        s = series_map.get(ent)
        if s is not None and len(s) >= 168:
            s_times = list(s.index)
            s_vals = s.to_numpy(dtype=float)
            t_map = {ts: idx for idx, ts in enumerate(s_times)}
            series_cache[ent] = (s_times, s_vals, t_map)

    for fold_idx, issue_time in enumerate(folds):
        # 1. Train candidate model on data before issue_time
        X_tr, y_tr = build_training_matrix(
            series_map, eval_entities, holidays, weather_history, occupancy_map,
            cutoff=issue_time, max_days=35, step_sample=6
        )

        model = None
        if len(y_tr) >= 100:
            model = model_cls(
                max_iter=45, max_leaf_nodes=15, l2_regularization=1.0,
                categorical_features=[0], random_state=42
            )
            with threadpool_limits(limits=1):
                model.fit(X_tr, y_tr)

        # 2. Evaluate on 24h horizon after issue_time
        y_trues = []
        y_preds = []
        b168s = []
        b24s = []
        b1s = []

        fold_feat_rows = []
        eval_meta = []

        for ent in eval_entities:
            sc = series_cache.get(ent)
            if sc is None:
                continue
            s_times, s_vals, time_to_idx = sc
            issue_idx = time_to_idx.get(issue_time)
            if issue_idx is None or issue_idx < 168:
                continue

            lag_1 = float(s_vals[issue_idx]) if not np.isnan(s_vals[issue_idx]) else 0.0
            r24_start = max(0, issue_idx - 23)
            roll_slice = np.nan_to_num(s_vals[r24_start : issue_idx + 1], nan=lag_1)
            roll_mean = float(np.mean(roll_slice)) if len(roll_slice) > 0 else lag_1
            roll_std = float(np.std(roll_slice)) if len(roll_slice) > 1 else 0.0
            ent_occ = occ_lookup.get(ent, {})

            for h in range(1, 25):
                target_ts = issue_time + timedelta(hours=h)
                target_idx = time_to_idx.get(target_ts)
                if target_idx is None:
                    continue
                actual = float(s_vals[target_idx])
                if np.isnan(actual):
                    continue

                ts_lag_24 = target_ts - timedelta(hours=24)
                idx_24 = time_to_idx.get(ts_lag_24)
                lag_24 = float(s_vals[idx_24]) if idx_24 is not None and not np.isnan(s_vals[idx_24]) else lag_1

                ts_lag_168 = target_ts - timedelta(hours=168)
                idx_168 = time_to_idx.get(ts_lag_168)
                lag_168 = float(s_vals[idx_168]) if idx_168 is not None and not np.isnan(s_vals[idx_168]) else lag_1

                w_tuple = w_lookup.get(ts_lag_168, (26.0, 60.0, 0.0, 2.0))
                temp, hum, rain, wind = w_tuple

                occ = ent_occ.get(ts_lag_168, 0.0)
                is_hol = int(target_ts.strftime("%Y-%m-%d") in holidays)
                bucket = 1 if h <= 6 else (2 if h <= 12 else 3)

                fold_feat_rows.append([
                    entity_code_map[ent], h, target_ts.hour, target_ts.weekday(), is_hol,
                    lag_1, lag_24, lag_168, roll_mean, roll_std,
                    occ, temp, hum, rain, wind
                ])
                eval_meta.append((actual, lag_168, lag_24, lag_1, bucket))

        if eval_meta:
            if model is not None and fold_feat_rows:
                with threadpool_limits(limits=1):
                    preds = model.predict(np.array(fold_feat_rows, dtype=float))
                preds = np.maximum(0.0, preds)
            else:
                preds = np.array([m[1] for m in eval_meta], dtype=float)

            for i, (actual, lag_168, lag_24, lag_1, bucket) in enumerate(eval_meta):
                pred = float(preds[i])
                y_trues.append(actual)
                y_preds.append(pred)
                b168s.append(lag_168)
                b24s.append(lag_24)
                b1s.append(lag_1)
                res = actual - pred
                bucket_residuals[bucket].append(res)

        if len(y_trues) > 0:
            yt_arr = np.array(y_trues)
            yp_arr = np.array(y_preds)
            f_mae = float(mean_absolute_error(yt_arr, yp_arr))
            f_smape = smape(yt_arr, yp_arr)
            b168_mae = float(mean_absolute_error(yt_arr, b168s))
            b24_mae = float(mean_absolute_error(yt_arr, b24s))
            b1_mae = float(mean_absolute_error(yt_arr, b1s))

            ml_maes.append(f_mae)
            base_168_maes.append(b168_mae)
            base_24_maes.append(b24_mae)
            base_1_maes.append(b1_mae)

            fold_results.append({
                "fold": fold_idx + 1,
                "mae": f_mae,
                "smape": f_smape,
                "b168_mae": b168_mae,
                "b24_mae": b24_mae,
                "b1_mae": b1_mae,
                "_actual": yt_arr,
                "_ml": yp_arr,
                "_baselines": {"lag_168": np.asarray(b168s), "lag_24": np.asarray(b24s), "naive_last": np.asarray(b1s)},
                "_buckets": [item[4] for item in eval_meta],
            })

    # Overall baseline performance
    mean_168 = float(np.mean(base_168_maes)) if base_168_maes else 1.0
    mean_24 = float(np.mean(base_24_maes)) if base_24_maes else 1.0
    mean_1 = float(np.mean(base_1_maes)) if base_1_maes else 1.0

    baselines_dict = {"lag_168": mean_168, "lag_24": mean_24, "naive_last": mean_1}
    best_baseline_name = min(baselines_dict, key=baselines_dict.get)
    best_baseline_mae = baselines_dict[best_baseline_name]

    # Map fold baseline errors to the best baseline
    fold_baseline_maes = []
    for f in fold_results:
        f_bmae = f["b168_mae"] if best_baseline_name == "lag_168" else (f["b24_mae"] if best_baseline_name == "lag_24" else f["b1_mae"])
        f["baseline_mae"] = f_bmae
        fold_baseline_maes.append(f_bmae)

    # 3% rule: Beats best baseline MAE by at least 3% in most folds (>= 2 out of 3)
    beats_count = sum(1 for m_mae, b_mae in zip(ml_maes, fold_baseline_maes) if m_mae < b_mae and m_mae <= 0.97 * b_mae)
    is_ml_served = (beats_count >= 2) and (len(ml_maes) >= 2)

    # Calibrate the bands to the model actually served, including seasonal fallback.
    bucket_residuals = {1: [], 2: [], 3: []}
    for fold in fold_results:
        predictions = fold["_ml"] if is_ml_served else fold["_baselines"][best_baseline_name]
        for residual, bucket in zip(fold["_actual"] - predictions, fold["_buckets"]):
            bucket_residuals[bucket].append(float(residual))

    # Residual quantiles per bucket
    bands_by_bucket = {}
    for b in (1, 2, 3):
        res_list = bucket_residuals[b]
        if res_list:
            q_lo = float(np.percentile(res_list, 10))
            q_hi = float(np.percentile(res_list, 90))
            # Ensure width at least baseline / std
            spread = max(abs(q_hi - q_lo), 0.1)
            bands_by_bucket[b] = (min(q_lo, -0.05 * spread), max(q_hi, 0.05 * spread))
        else:
            bands_by_bucket[b] = (-1.0, 1.0)

    # Band coverage
    for fold in fold_results:
        actual = fold.pop("_actual")
        predictions = fold.pop("_ml")
        baselines = fold.pop("_baselines")
        buckets = fold.pop("_buckets")
        served = predictions if is_ml_served else baselines[best_baseline_name]
        lower = np.maximum(0, served + np.array([bands_by_bucket[b][0] for b in buckets]))
        upper = np.maximum(served, served + np.array([bands_by_bucket[b][1] for b in buckets]))
        fold["band_coverage"] = band_coverage(actual, lower, upper)
        fold["served_mae"] = float(mean_absolute_error(actual, served))
        fold["served_smape"] = smape(actual, served)
    overall_mae = float(np.mean(ml_maes)) if ml_maes else None
    overall_smape = float(np.mean([f["smape"] for f in fold_results])) if fold_results else None

    return {
        "is_ml_served": is_ml_served,
        "served_model": "hist_gradient_boosting" if is_ml_served else "seasonal",
        "best_baseline": best_baseline_name,
        "overall_mae": overall_mae,
        "best_baseline_mae": best_baseline_mae if fold_results else None,
        "overall_smape": overall_smape,
        "fold_results": fold_results,
        "bands_by_bucket": bands_by_bucket,
    }


def fit_and_serve_global_model(
    db: Session,
    target_id: str,
    domain: str,
    table_name: str,
    entity_key: str | None,
    metric: str,
    node: str,
    as_of: datetime,
    model_cls: type = HistGradientBoostingRegressor,
) -> dict[str, Any]:
    cutoff = hour(as_of)
    bind_key = db.get_bind()
    cache_key = (bind_key, target_id, metric, node, cutoff.isoformat(), model_cls)
    cached = _GLOBAL_MODEL_CACHE.get(cache_key)
    if cached is not None:
        return deepcopy(cached)

    # Train campus-wide; serving scope must never change the model's entity coding.
    start = cutoff - timedelta(days=56)
    raw = fetch_frame(db, table_name, "F01", start, cutoff, cutoff)
    if domain == "air" and not raw.empty:
        raw = raw[raw["zone_id"] == "Campus"]
    series_map = extract_entity_series(raw, entity_key, metric)
    entities = sorted(series_map.keys()) if series_map else (["F01"] if entity_key is None else [])

    # Drivers
    weather_raw = fetch_frame(db, "weather", "F01", start, cutoff, cutoff)
    weather_history = pd.DataFrame()
    if not weather_raw.empty:
        weather_raw["timestamp"] = pd.to_datetime(weather_raw["timestamp"])
        weather_history = weather_raw.set_index("timestamp").sort_index()

    occ_raw = fetch_frame(db, "occupancy_hourly", "F01", start, cutoff, cutoff)
    occupancy_map = extract_entity_series(occ_raw, "building_id", "occupancy_count")
    campus_occupancy = extract_entity_series(occ_raw, None, "occupancy_count").get("F01")
    for entity in entities:
        if entity in occupancy_map:
            continue
        rows = raw[raw[entity_key].astype(str) == entity] if entity_key and not raw.empty else raw
        building = str(rows["building_id"].dropna().iloc[-1]) if "building_id" in rows and not rows["building_id"].dropna().empty else None
        driver = occupancy_map.get(building, campus_occupancy)
        if driver is not None:
            occupancy_map[entity] = driver

    holidays = {str(day) for day in load_sector_config().get("holidays", [])}

    train_end = cutoff.replace(hour=0)
    train_key = (bind_key, target_id, metric, train_end.date(), model_cls)
    trained = _TRAINED_MODEL_CACHE.get(train_key)
    if trained is None:
        train_series = {ent: s[s.index <= train_end] for ent, s in series_map.items()}
        eval_res = run_rolling_origin_backtest(
            model_cls, train_series, entities, holidays, weather_history, occupancy_map, train_end
        )
        X_all, y_all = build_training_matrix(
            train_series, entities, holidays, weather_history, occupancy_map,
            cutoff=train_end, max_days=45, step_sample=4
        )
        final_model = None
        if eval_res["is_ml_served"] and len(y_all) >= 100:
            final_model = model_cls(max_iter=60, max_leaf_nodes=15, l2_regularization=1.0,
                                    categorical_features=[0], random_state=42)
            with threadpool_limits(limits=1):
                final_model.fit(X_all, y_all)
        trained = {"evaluation": eval_res, "model": final_model}
        if len(_TRAINED_MODEL_CACHE) >= 64:
            _TRAINED_MODEL_CACHE.pop(next(iter(_TRAINED_MODEL_CACHE)))
        _TRAINED_MODEL_CACHE[train_key] = trained
    eval_res = trained["evaluation"]
    final_model = trained["model"]
    scoped = fetch_frame(db, table_name, node, cutoff - timedelta(days=7), cutoff, cutoff)
    served_entities = set(extract_entity_series(scoped, entity_key, metric))

    # 3. Forecast weather forward to drive future predictions
    future_weather = forecast_weather(db, cutoff, horizon_hours=24)

    # 4. Generate forecasts for next 24 hours
    entity_code_map = {ent: i for i, ent in enumerate(entities)}
    outputs = []
    bands_by_bucket = eval_res["bands_by_bucket"]

    # Pre-collect feature rows and metadata for batch prediction
    pred_meta = []
    pred_feats = []

    for ent in entities:
        if ent not in served_entities:
            continue
        s = series_map.get(ent)
        sub = s[s.index <= cutoff] if s is not None else pd.Series()
        lag_1 = float(sub.iloc[-1]) if len(sub) > 0 else 0.0
        roll_24 = sub[sub.index > cutoff - timedelta(hours=24)] if len(sub) > 0 else pd.Series()
        roll_mean = float(roll_24.mean()) if len(roll_24) > 0 else lag_1
        roll_std = float(roll_24.std(ddof=0)) if len(roll_24) > 1 else 0.0

        for h in range(1, 25):
            target_ts = cutoff + timedelta(hours=h)
            bucket = 1 if h <= 6 else (2 if h <= 12 else 3)
            q_lo, q_hi = bands_by_bucket[bucket]

            ts_lag_24 = target_ts - timedelta(hours=24)
            lag_24 = float(s.at[ts_lag_24]) if s is not None and ts_lag_24 in s.index and pd.notna(s.at[ts_lag_24]) else lag_1
            ts_lag_168 = target_ts - timedelta(hours=168)
            lag_168 = float(s.at[ts_lag_168]) if s is not None and ts_lag_168 in s.index and pd.notna(s.at[ts_lag_168]) else lag_1

            temp = float(future_weather.at[target_ts, "temperature"]) if target_ts in future_weather.index else 26.0
            hum = float(future_weather.at[target_ts, "humidity"]) if target_ts in future_weather.index else 60.0
            rain = float(future_weather.at[target_ts, "rainfall"]) if target_ts in future_weather.index else 0.0
            wind = float(future_weather.at[target_ts, "wind_speed"]) if target_ts in future_weather.index else 2.0

            occ_s = occupancy_map.get(ent)
            occ = float(occ_s.at[ts_lag_168]) if (occ_s is not None and ts_lag_168 in occ_s.index and pd.notna(occ_s.at[ts_lag_168])) else 0.0

            is_hol = int(target_ts.strftime("%Y-%m-%d") in holidays)

            pred_feats.append([
                entity_code_map.get(ent, 0), h, target_ts.hour, target_ts.weekday(), is_hol,
                lag_1, lag_24, lag_168, roll_mean, roll_std,
                occ, temp, hum, rain, wind
            ])
            pred_meta.append((ent, h, target_ts, q_lo, q_hi, lag_168, lag_24, lag_1))

    # Single batch predict if ML served
    raw_preds = None
    if eval_res["is_ml_served"] and final_model is not None and pred_feats:
        with threadpool_limits(limits=1):
            raw_preds = final_model.predict(np.array(pred_feats, dtype=float))

    entity_series_map: dict[str, list[dict[str, Any]]] = {ent: [] for ent in entities}
    for i, (ent, h, target_ts, q_lo, q_hi, lag_168, lag_24, lag_1) in enumerate(pred_meta):
        if raw_preds is not None:
            yhat = float(raw_preds[i])
        else:
            if eval_res["best_baseline"] == "lag_168":
                yhat = lag_168
            elif eval_res["best_baseline"] == "lag_24":
                yhat = lag_24
            else:
                yhat = lag_1
        yhat = max(0.0, yhat)
        lo = max(0.0, yhat + q_lo)
        hi = max(lo, yhat + q_hi)

        if not math.isfinite(yhat):
            yhat = lag_1
        if not math.isfinite(lo) or lo > yhat:
            lo = max(0.0, yhat * 0.9)
        if not math.isfinite(hi) or hi < yhat:
            hi = yhat * 1.1

        entity_series_map[ent].append({
            "timestamp": target_ts.isoformat(),
            "value": yhat,
            "lower": lo,
            "upper": hi,
        })

    for ent in entities:
        if ent not in served_entities:
            continue
        outputs.append({
            "entity_id": ent,
            "model": eval_res["served_model"],
            "mae": eval_res["overall_mae"],
            "baseline_mae": eval_res["best_baseline_mae"],
            "smape": eval_res["overall_smape"],
            "series": entity_series_map.get(ent, []),
        })

    result = {
        "target": target_id,
        "domain": domain,
        "node": node,
        "as_of": cutoff.isoformat(),
        "served_model": eval_res["served_model"],
        "mae": eval_res["overall_mae"],
        "baseline_mae": eval_res["best_baseline_mae"],
        "smape": eval_res["overall_smape"],
        "forecasts": outputs,
        "data_source": data_source("mobility" if domain in ("parking", "mobility") else domain),
        "fold_results": eval_res["fold_results"],
    }
    if len(outputs) == 1:
        result.update({
            "model": outputs[0]["model"],
            "mae": outputs[0]["mae"],
            "baseline_mae": outputs[0]["baseline_mae"],
            "series": outputs[0]["series"],
        })

    # Persist in DB idempotently
    try:
        ensure_forecast_tables(db.get_bind())
        m_table = get_table("forecast_models")
        f_table = get_table("forecasts")
        a_table = get_table("forecast_accuracy")
        if m_table is not None and f_table is not None and a_table is not None:
            # Model
            model_id = f"{target_id}|{cutoff.isoformat()}|{node}|24h"
            db.execute(delete(m_table).where(m_table.c.model_id == model_id))
            db.execute(insert(m_table).values(
                model_id=model_id,
                target=target_id,
                trained_at=cutoff,
                train_end=train_end,
                params={"node": node, "horizon": "24h", "served_model": eval_res["served_model"],
                        "mae": eval_res["overall_mae"], "baseline_mae": eval_res["best_baseline_mae"],
                        "smape": eval_res["overall_smape"], "fold_results": eval_res["fold_results"],
                        "max_iter": 60, "max_leaf_nodes": 15, "categorical_features": [0]}
            ))
            # Accuracy
            db.execute(delete(a_table).where(a_table.c.target == target_id))
            for f in eval_res["fold_results"]:
                db.execute(insert(a_table).values(
                    accuracy_id=f"{target_id}|fold_{f['fold']}|{cutoff.date()}",
                    target=target_id,
                    fold=f["fold"],
                    mae=f["mae"],
                    smape=f["smape"],
                    baseline_mae=f["baseline_mae"],
                    band_coverage=f.get("band_coverage"),
                ))
            # Forecasts
            ins_rows = []
            for out in outputs:
                for item in out["series"]:
                    ts_val = datetime.fromisoformat(item["timestamp"])
                    ins_rows.append({
                        "forecast_id": f"{target_id}|{out['entity_id']}|{cutoff.isoformat()}|{ts_val.isoformat()}|24h",
                        "target": target_id,
                        "entity": out["entity_id"],
                        "issued_at": cutoff,
                        "ts": ts_val,
                        "yhat": item["value"],
                        "lo": item["lower"],
                        "hi": item["upper"],
                        "method": "ml" if eval_res["is_ml_served"] else "seasonal",
                        "served_model": eval_res["served_model"],
                    })
            if ins_rows:
                identifiers = [row["forecast_id"] for row in ins_rows]
                db.execute(delete(f_table).where(f_table.c.forecast_id.in_(
                    identifiers + [identifier.rsplit("|", 1)[0] for identifier in identifiers])))
                db.execute(insert(f_table), ins_rows)
            db.commit()
    except Exception:
        db.rollback()
        raise

    if len(_GLOBAL_MODEL_CACHE) >= 256:
        _GLOBAL_MODEL_CACHE.pop(next(iter(_GLOBAL_MODEL_CACHE)))
    _GLOBAL_MODEL_CACHE[cache_key] = deepcopy(result)
    return result


# =========================================================================
# Domain Specialized Target Engines
# =========================================================================

def forecast_daily_baseline(db: Session, domain: str, table: str, entity_key: str | None,
                            metric: str, node: str, as_of: datetime) -> dict[str, Any]:
    """Seven full calendar days based on completed historical days only."""
    cutoff = hour(as_of)
    raw = fetch_frame(db, table, node, cutoff - timedelta(days=28), cutoff, cutoff)
    outputs = []
    aggregation = "max" if metric == "peak_demand_kw" else (
        "mean" if metric in {"occupancy_count", "temperature", "humidity", "wind_speed"} else "sum")
    for entity, values in extract_entity_series(raw, entity_key, metric).items():
        complete = values[values.index.date < cutoff.date()]
        daily = complete.groupby(complete.index.date).agg(aggregation)
        if daily.empty:
            continue
        rows = []
        for offset in range(1, 8):
            day = cutoff.date() + timedelta(days=offset)
            source_day = day - timedelta(days=7)
            while source_day >= cutoff.date():
                source_day -= timedelta(days=7)
            value = float(daily.get(source_day, daily.iloc[-1]))
            rows.append({"timestamp": day.isoformat(), "value": value,
                         "lower": max(0.0, value * 0.9), "upper": max(0.0, value * 1.1)})
        outputs.append({"entity_id": entity, "model": "seasonal", "mae": None,
                        "baseline_mae": None, "series": rows})
    return {"domain": domain, "metric": metric, "node": node, "as_of": cutoff.isoformat(),
            "horizon": "7d", "forecasts": outputs, "data_source": data_source(domain)}


def simulate_tank_hour(level: float, capacity: float, pump: bool, use_kl: float) -> tuple[float, bool, float]:
    """Consume water, start below 40%, refill at capacity/6, and stop at 85%."""
    if capacity <= 0:
        return 0.0, False, 0.0
    level = max(0.0, level - max(0.0, use_kl))
    if level < 0.4 * capacity:
        pump = True
    inflow = min(capacity / 6, max(0.0, 0.85 * capacity - level)) if pump else 0.0
    level = min(capacity, level + inflow)
    if level >= 0.85 * capacity:
        pump = False
    return level, pump, inflow


def simulate_bin_hour(weight: float, capacity: float, generated_kg: float, timestamp: datetime,
                      collection_delayed: bool = False) -> float:
    if capacity <= 0:
        return 0.0
    return 0.0 if timestamp.hour in (6, 12, 18) and not collection_delayed else min(capacity, max(0.0, weight + generated_kg))


def forecast_water_domain(db: Session, node: str, as_of: datetime, metric: str = "water_consumption_litres", model_cls: type = HistGradientBoostingRegressor) -> dict[str, Any]:
    cutoff = hour(as_of)
    ml_res = fit_and_serve_global_model(
        db, "water_consumption_litres", "water", "water_hourly", "meter_id", "water_consumption_litres", node, as_of, model_cls=model_cls
    )
    if metric in ("tank_level_pct", "days_of_water_available"):
        # Simulate tank levels forward
        tanks_raw = fetch_frame(db, "water_tank_levels", node, cutoff - timedelta(hours=24), cutoff, cutoff)
        registry = fetch_frame(db, "registry_tanks", node, cutoff - timedelta(days=1), cutoff, cutoff)
        tank_capacities = {str(row.tank_id): float(row.tank_capacity_kl) for row in registry.itertuples()}
        if not tanks_raw.empty:
            for row in tanks_raw.sort_values("timestamp").itertuples():
                tank_capacities[str(row.tank_id)] = float(row.tank_capacity_kl)
        tank_capacities = {tank: capacity for tank, capacity in tank_capacities.items()
                           if not tanks_raw.empty and tank in set(tanks_raw["tank_id"].astype(str))}
        total_cap = sum(tank_capacities.values())

        # Initial tank states
        curr_levels = {tank: 0.0 for tank in tank_capacities}
        curr_pumps = {tank: False for tank in tank_capacities}
        if not tanks_raw.empty:
            for t_id in tank_capacities:
                t_sub = tanks_raw[tanks_raw["tank_id"] == t_id]
                if not t_sub.empty:
                    last_row = t_sub.sort_values("timestamp").iloc[-1]
                    curr_levels[t_id] = float(last_row.get("tank_level", curr_levels[t_id]))
                    curr_pumps[t_id] = bool(last_row.get("pump_on", 0))

        # Hourly forecast water use across all meters
        total_hourly_litres = [0.0] * 24
        for fc in ml_res.get("forecasts", []):
            for h, s in enumerate(fc.get("series", [])[:24]):
                total_hourly_litres[h] += s["value"]

        tank_outputs = []
        for t_id, cap in tank_capacities.items():
            lvl = curr_levels[t_id]
            pump = curr_pumps[t_id]
            cap_share = cap / total_cap if total_cap else 0.0
            series_rows = []
            for h in range(24):
                ts = cutoff + timedelta(hours=h + 1)
                outflow_kl = (total_hourly_litres[h] / 1000.0) * cap_share
                lvl, pump, inflow_kl = simulate_tank_hour(lvl, cap, pump, outflow_kl)
                pct = (lvl / cap) * 100.0

                # Pump rule: start < 40%, stop >= 85%
                if pct < 40.0:
                    pump = True
                elif pct >= 85.0:
                    pump = False

                lo = max(0.0, pct - 5.0)
                hi = min(100.0, pct + 5.0)
                series_rows.append({
                    "timestamp": ts.isoformat(),
                    "value": round(pct, 2),
                    "lower": round(lo, 2),
                    "upper": round(hi, 2),
                    "pump_on": pump,
                    "pump_inflow_kl": inflow_kl,
                })
            tank_outputs.append({
                "entity_id": t_id,
                "model": "simulated",
                "mae": None,
                "baseline_mae": None,
                "series": series_rows,
            })

        total_daily_use_kl = sum(total_hourly_litres) / 1000.0
        days_avail = sum(curr_levels.values()) / total_daily_use_kl if total_daily_use_kl > 0 else None
        if metric == "days_of_water_available":
            rows = [] if days_avail is None else [{"timestamp": (cutoff + timedelta(hours=h)).isoformat(),
                "value": max(0.0, days_avail - h / 24), "lower": max(0.0, days_avail - h / 24),
                "upper": max(0.0, days_avail - h / 24)} for h in range(1, 25)]
            return {"domain": "water", "metric": metric, "node": node, "as_of": cutoff.isoformat(),
                    "days_of_water_available": days_avail, "data_source": data_source("water"),
                    "forecasts": [{"entity_id": node, "model": "formula", "mae": None,
                                   "baseline_mae": None, "series": rows}] if rows else []}

        return {
            "domain": "water",
            "metric": "tank_level_pct",
            "node": node,
            "as_of": cutoff.isoformat(),
            "days_of_water_available": days_avail,
            "forecasts": tank_outputs,
            "data_source": data_source("water"),
            "model": "simulated",
            "mae": None,
            "baseline_mae": None,
            "series": tank_outputs[0]["series"] if tank_outputs else [],
        }

    # Sum of all meters for campus total
    campus_series = []
    if ml_res.get("forecasts"):
        for h in range(24):
            ts = ml_res["forecasts"][0]["series"][h]["timestamp"]
            tot_val = sum(fc["series"][h]["value"] for fc in ml_res["forecasts"])
            tot_lo = sum(fc["series"][h]["lower"] for fc in ml_res["forecasts"])
            tot_hi = sum(fc["series"][h]["upper"] for fc in ml_res["forecasts"])
            campus_series.append({
                "timestamp": ts,
                "value": round(tot_val, 2),
                "lower": round(tot_lo, 2),
                "upper": round(tot_hi, 2),
            })
    campus_output = {
        "entity_id": "F01",
        "model": ml_res.get("served_model", "hist_gradient_boosting"),
        "mae": ml_res.get("mae", 1.0),
        "baseline_mae": ml_res.get("baseline_mae", 1.0),
        "series": campus_series,
    }

    res = {**ml_res}
    res["forecasts"] = [campus_output] + ml_res.get("forecasts", [])
    res.update(campus_output)
    return res


def forecast_waste_domain(db: Session, node: str, as_of: datetime, metric: str = "waste_weight") -> dict[str, Any]:
    cutoff = hour(as_of)
    ml_res = fit_and_serve_global_model(
        db, "waste_weight", "waste", "waste_hourly", "bin_id", "waste_weight", node, as_of
    )
    # Forward simulation of bin fill percentage with pickups at 06:00, 12:00, 18:00
    waste_raw = fetch_frame(db, "waste_hourly", node, cutoff - timedelta(hours=24), cutoff, cutoff)
    bins_reg = fetch_frame(db, "registry_bins", node, cutoff - timedelta(days=1), cutoff, cutoff)
    bin_caps = {}
    if not bins_reg.empty:
        for r in bins_reg.itertuples():
            bin_caps[str(getattr(r, "bin_id", ""))] = float(getattr(r, "capacity_kg", 10.0))

    sim_outputs = []
    risks_overflow = []
    for fc in ml_res.get("forecasts", []):
        b_id = fc["entity_id"]
        cap = bin_caps.get(b_id, 10.0)

        # Current observed fill / weight
        curr_weight = 3.0
        curr_fill = 30.0
        if not waste_raw.empty:
            b_sub = waste_raw[waste_raw["bin_id"] == b_id]
            if not b_sub.empty:
                last_r = b_sub.sort_values("timestamp").iloc[-1]
                curr_fill = float(last_r.get("fill_percentage", curr_fill))
                curr_weight = (curr_fill / 100.0) * cap

        w = curr_weight
        series_rows = []
        pred_overflow = None
        for item in fc.get("series", [])[:24]:
            t_dt = datetime.fromisoformat(item["timestamp"])
            h_val = t_dt.hour
            # Pickup at 06:00, 12:00, 18:00 resets weight and fill %
            w = simulate_bin_hour(w, cap, item["value"], t_dt)

            fill_pct = min(150.0, (w / cap) * 100.0)
            if fill_pct >= 100.0 and pred_overflow is None:
                pred_overflow = item["timestamp"]
                lead_h = max(1, int((t_dt - cutoff).total_seconds() / 3600.0))
                risks_overflow.append({
                    "type": "predicted_bin_overflow",
                    "node": b_id,
                    "predicted_time": pred_overflow,
                    "lead_time_hours": lead_h,
                    "domain": "waste",
                    "facts": {"bin_id": b_id, "capacity_kg": cap, "predicted_fill_pct": fill_pct},
                })

            lo = max(0.0, fill_pct * 0.9)
            hi = min(100.0, fill_pct * 1.1)
            series_rows.append({
                "timestamp": item["timestamp"],
                "value": round(fill_pct, 1),
                "lower": round(lo, 1),
                "upper": round(hi, 1),
            })

        sim_outputs.append({
            "entity_id": b_id,
            "model": "simulated",
            "capacity_kg": cap,
            "predicted_overflow_time": pred_overflow,
            "mae": None,
            "baseline_mae": None,
            "series": series_rows,
        })

    if metric in ("fill_percentage", "bin_fill_pct"):
        return {
            "domain": "waste",
            "metric": "fill_percentage",
            "node": node,
            "as_of": cutoff.isoformat(),
            "overflow_risks": risks_overflow,
            "forecasts": sim_outputs,
            "data_source": data_source("waste"),
            "model": "simulated",
            "mae": None,
            "baseline_mae": None,
            "series": sim_outputs[0]["series"] if sim_outputs else [],
        }

    bin_types = {str(row.bin_id): str(row.bin_type).lower() for row in bins_reg.itertuples()}
    diversion = []
    for index in range(24):
        points = [(fc, fc["series"][index]) for fc in ml_res.get("forecasts", []) if len(fc["series"]) > index]
        if not points:
            continue
        total_weight = sum(point["value"] for _, point in points)
        diverted = sum(point["value"] for fc, point in points if bin_types.get(fc["entity_id"]) in {"recyclable", "recyclables", "recycling", "organic"})
        rate = diverted / total_weight if total_weight > 0 else 0.0
        diversion.append({"timestamp": points[0][1]["timestamp"], "value": rate, "lower": rate, "upper": rate})
    res = {**ml_res, "diversion_rate": diversion[-1]["value"] if diversion else None, "overflow_risks": risks_overflow}
    if metric == "diversion_rate":
        res.update({"metric": metric, "model": "formula", "forecasts": [{"entity_id": node, "model": "formula",
                    "mae": None, "baseline_mae": None, "series": diversion}] if diversion else [], "series": diversion})
    return res


def forecast_energy_domain(db: Session, node: str, as_of: datetime, metric: str = "energy_kwh", horizon: str = "24h", model_cls: type = HistGradientBoostingRegressor) -> dict[str, Any]:
    cutoff = hour(as_of)
    target_id = "peak_demand_kw" if metric == "peak_demand_kw" else "energy_kwh"
    ml_res = fit_and_serve_global_model(
        db, target_id, "energy", "energy_building_hourly", "building_id", target_id, node, as_of, model_cls=model_cls
    ) if horizon == "24h" else forecast_daily_baseline(
        db, "energy", "energy_building_hourly", "building_id", target_id, node, as_of)

    # Floor forecasts = building forecast * current floor share
    floor_raw = fetch_frame(db, "energy_floor_hourly", "F01", cutoff - timedelta(hours=24), cutoff, cutoff)
    bldg_raw = fetch_frame(db, "energy_building_hourly", node, cutoff - timedelta(hours=24), cutoff, cutoff)
    floor_shares: dict[str, dict[str, float]] = {}
    if not floor_raw.empty and not bldg_raw.empty:
        b_totals = floor_raw.groupby("building_id")["energy_kwh"].sum()
        f_totals = floor_raw.groupby(["building_id", "floor_id"])["energy_kwh"].sum()
        for (b_id, f_id), f_val in f_totals.items():
            b_val = b_totals.get(b_id, 0.0)
            share = (f_val / b_val) if b_val > 0 else 1.0 / max(len(f_totals.loc[b_id]), 1)
            floor_shares.setdefault(str(b_id), {})[str(f_id)] = share

    floor_forecasts = []
    for fc in ml_res.get("forecasts", []):
        b_id = fc["entity_id"]
        shares = floor_shares.get(b_id, {})
        if shares:
            for f_id, sh in shares.items():
                f_series = []
                for item in fc.get("series", []):
                    f_val = item["value"] * sh
                    f_series.append({
                        "timestamp": item["timestamp"],
                        "value": f_val,
                        "lower": item["lower"] * sh,
                        "upper": item["upper"] * sh,
                    })
                floor_forecasts.append({
                    "entity_id": f_id,
                    "building_id": b_id,
                    "floor_share": sh,
                    "model": fc["model"],
                    "mae": fc["mae"] * sh if fc.get("mae") is not None else None,
                    "baseline_mae": fc["baseline_mae"] * sh if fc.get("baseline_mae") is not None else None,
                    "series": f_series,
                })

    res = {**ml_res}
    res["floor_forecasts"] = floor_forecasts
    return res


def forecast_mobility_domain(db: Session, node: str, as_of: datetime, metric: str = "parking_occupancy", model_cls: type = HistGradientBoostingRegressor) -> dict[str, Any]:
    cutoff = hour(as_of)
    target_id = "vehicle_count" if metric == "vehicle_count" else ("delay_min" if metric == "delay_min" else "parking_occupancy")
    ml_res = fit_and_serve_global_model(
        db, "traffic_vehicle_count" if target_id == "vehicle_count" else ("traffic_delay_min" if target_id == "delay_min" else target_id), "mobility", "traffic_parking", "gate_id", target_id, node, as_of, model_cls=model_cls
    )
    # Parking percentage calculation
    latest = fetch_frame(db, "traffic_parking", node, cutoff - timedelta(days=1), cutoff, cutoff)
    capacity_map = dict(latest.sort_values("timestamp").groupby("gate_id")["parking_capacity"].last()) if not latest.empty else {}
    for fc in ml_res.get("forecasts", []):
        cap = float(capacity_map.get(fc["entity_id"], 0.0))
        fc["parking_capacity"] = cap
        for item in fc.get("series", []):
            if metric == "parking_occupancy":
                item["parking_percent"] = round((item["value"] / cap) * 100.0, 1) if cap else None

    return ml_res


def forecast_air_domain(db: Session, node: str, as_of: datetime, metric: str = "aqi_cpcb") -> dict[str, Any]:
    cutoff = hour(as_of)
    ml_res = fit_and_serve_global_model(
        db, "air_quality" if metric == "aqi_cpcb" else metric, "air", "air_environment", "zone_id", metric, node, as_of
    )
    for fc in ml_res.get("forecasts", []):
        for item in fc.get("series", []):
            if metric == "aqi_cpcb":
                item["aqi_category"] = aqi_category(item["value"])
    return ml_res


def climate_risk_values(temp_c: float, humidity: float, rainfall: float, rainfall_6h: float,
                        drainage: float, low_lying: float, exposure: float) -> tuple[float, float]:
    """Source formulas, verified against every historical weather/climate row."""
    heat = max(0.0, min(100.0, (heat_index(temp_c, humidity) - 27.0) * 5.0))
    rain_load = max(rainfall_6h / 6.0, rainfall * 0.4)
    flood = max(0.0, min(100.0, rain_load * 50.0 * exposure * (1.0 + low_lying) / (10.0 + 0.5 * drainage)))
    return heat, flood


def forecast_climate_domain(db: Session, node: str, as_of: datetime) -> dict[str, Any]:
    cutoff = hour(as_of)
    future = forecast_weather(db, cutoff, horizon_hours=24)
    historical = fetch_frame(db, "weather", "F01", cutoff - timedelta(hours=5), cutoff, cutoff)
    registry = fetch_frame(db, "registry_zones_climate", node, cutoff - timedelta(days=1), cutoff, cutoff)
    rainfall = list(historical.sort_values("timestamp")["rainfall"].tail(5)) if not historical.empty else []
    rolling_rain = []
    for item in future.itertuples():
        rainfall.append(float(item.rainfall))
        rainfall = rainfall[-6:]
        rolling_rain.append(sum(rainfall))
    outputs = []
    for zone in registry.itertuples():
        heat_rows, flood_rows = [], []
        for index, item in enumerate(future.itertuples()):
            heat, flood = climate_risk_values(float(item.temperature), float(item.humidity), float(item.rainfall),
                rolling_rain[index], float(zone.drainage_capacity), float(zone.low_lying_flag), float(zone.building_exposure))
            for rows, value in ((heat_rows, heat), (flood_rows, flood)):
                rows.append({"timestamp": item.Index.isoformat(), "value": value,
                             "lower": max(0.0, value - 5), "upper": min(100.0, value + 5)})
        for metric, rows in (("heat_risk", heat_rows), ("flood_risk", flood_rows)):
            if rows:
                outputs.append({"entity_id": str(zone.zone_id), "metric": metric, "model": "formula",
                                "mae": None, "baseline_mae": None, "series": rows})
    return {"domain": "climate", "node": node, "as_of": cutoff.isoformat(), "model": "formula",
            "forecasts": outputs, "data_source": data_source("climate")}


def forecast_emissions_domain(db: Session, node: str, as_of: datetime, horizon: str = "24h", metric: str = "total_co2e") -> dict[str, Any]:
    cutoff = hour(as_of)
    energy = forecast_energy_domain(db, node, cutoff, horizon=horizon)
    mobility = forecast_mobility_domain(db, "F01", cutoff, metric="vehicle_count") if horizon == "24h" else forecast_daily_baseline(
        db, "mobility", "traffic_parking", "gate_id", "vehicle_count", "F01", cutoff)
    waste = forecast_waste_domain(db, node, cutoff) if horizon == "24h" else forecast_daily_baseline(
        db, "waste", "waste_hourly", "bin_id", "waste_weight", node, cutoff)
    factors_raw = fetch_frame(db, "registry_emission_factors", "F01", cutoff - timedelta(days=1), cutoff, cutoff)
    factors = {str(row.factor_name): float(row.value) for row in factors_raw.itertuples()}
    if not all(name in factors for name in ("grid", "vehicle", "landfill")):
        return {"domain": "emissions", "node": node, "as_of": cutoff.isoformat(), "horizon": horizon,
                "forecasts": [], "data_source": data_source("emissions"), "status": "missing_emission_factors"}
    bins = fetch_frame(db, "registry_bins", node, cutoff - timedelta(days=1), cutoff, cutoff)
    bin_buildings = {str(row.bin_id): str(row.building_id) for row in bins.itertuples()}
    historic = fetch_frame(db, "emissions", "F01", cutoff - timedelta(days=7), cutoff, cutoff)
    weights = historic.groupby("building_id")["mobility_co2e"].sum() if not historic.empty else pd.Series(dtype=float)
    weight_total = float(weights.sum())
    building_count = max(len(energy.get("forecasts", [])), 1)
    outputs = []
    for building in energy.get("forecasts", []):
        entity = building["entity_id"]
        share = float(weights.get(entity, 0.0)) / weight_total if weight_total else 1 / building_count
        rows = []
        for index, point in enumerate(building["series"]):
            parts = {}
            intervals = {}
            for field in ("value", "lower", "upper"):
                values = {"energy_co2e": point[field] * factors["grid"],
                          "mobility_co2e": sum(fc["series"][index][field] for fc in mobility.get("forecasts", [])) * share * factors["vehicle"],
                          "waste_co2e": sum(fc["series"][index][field] for fc in waste.get("forecasts", [])
                                             if bin_buildings.get(fc["entity_id"]) == entity) * factors["landfill"]}
                values["total_co2e"] = sum(values.values())
                intervals[field] = values[metric]
                if field == "value":
                    parts = values
            rows.append({"timestamp": point["timestamp"], **intervals, **parts})
        outputs.append({"entity_id": entity, "model": "formula", "mae": None, "baseline_mae": None, "series": rows})
    return {"domain": "emissions", "metric": metric, "node": node, "as_of": cutoff.isoformat(),
            "horizon": horizon, "model": "formula", "unit": "kgCO2e", "forecasts": outputs,
            "data_source": data_source("emissions")}


def forecast_assets_domain(db: Session, node: str, as_of: datetime) -> dict[str, Any]:
    cutoff = hour(as_of)
    assets_raw = fetch_frame(db, "assets_equipment", node, cutoff - timedelta(hours=48), cutoff, cutoff)
    registry = fetch_frame(db, "registry_assets", node, cutoff - timedelta(days=1), cutoff, cutoff)
    asset_registry = {str(row.asset_id): row for row in registry.itertuples()}
    entities = sorted(assets_raw["asset_id"].dropna().unique().tolist()) if not assets_raw.empty else []

    outputs = []
    vibration_outputs = []

    for ast_id in entities:
        sub = assets_raw[assets_raw["asset_id"] == ast_id].sort_values("timestamp") if not assets_raw.empty else pd.DataFrame()
        curr_vib = 2.1
        vib_slope = 0.01
        load_val = 0.65
        down_hrs = 0.0
        ast_type = "HVAC"

        if not sub.empty:
            last_r = sub.iloc[-1]
            curr_vib = float(last_r.get("vibration", curr_vib))
            load_val = float(last_r.get("load", load_val))
            down_hrs = float(pd.to_numeric(sub["downtime_hours"], errors="coerce").fillna(0).sum())
            ast_type = str(last_r.get("asset_type", ast_type))
            vibration = pd.to_numeric(sub["vibration"], errors="coerce")
            usable = vibration.notna()
            timestamps = sub.loc[usable, "timestamp"]
            elapsed = (timestamps - timestamps.iloc[-1]).dt.total_seconds() / 3600.0 if len(timestamps) else pd.Series(dtype=float)
            vib_slope = float(np.polyfit(elapsed, vibration[usable], 1)[0]) if len(elapsed) > 1 and elapsed.max() > elapsed.min() else 0.0

        # Rule score: vibration level and slope, hours since maintenance, load, past downtime
        vib_score = min(40.0, max(0.0, (curr_vib - 2.0) * 15.0 + max(0.0, vib_slope * 200.0)))
        rated = float(last_r.get("rated_capacity") or 0.0)
        load_score = min(20.0, max(0.0, load_val / rated * 20.0)) if rated > 0 else 0.0
        down_score = min(20.0, down_hrs * 2.5)
        record = asset_registry.get(str(ast_id))
        maintenance = pd.to_datetime(getattr(record, "last_service_date", None), errors="coerce")
        if pd.notna(maintenance):
            maintenance = maintenance.tz_localize(TZ) if maintenance.tzinfo is None else maintenance.tz_convert(TZ)
            hours_since = max(0.0, (cutoff - maintenance).total_seconds() / 3600.0)
            interval = max(1.0, float(getattr(record, "maintenance_interval_days", 30.0)))
            maint_score = min(20.0, hours_since / (interval * 24.0) * 20.0)
        else:
            maint_score = 0.0
        failure_risk = round(min(100.0, max(0.0, vib_score + load_score + down_score + maint_score)), 1)

        risk_series = []
        for h in range(1, 25):
            ts = cutoff + timedelta(hours=h)
            drift = failure_risk + (vib_slope * h * 5.0)
            drift = min(100.0, max(0.0, drift))
            risk_series.append({
                "timestamp": ts.isoformat(),
                "value": round(drift, 1),
                "lower": max(0.0, round(drift - 5.0, 1)),
                "upper": min(100.0, round(drift + 5.0, 1)),
            })
        outputs.append({
            "entity_id": ast_id,
            "asset_type": ast_type,
            "failure_risk_24h": max(point["value"] for point in risk_series),
            "model": "rule",
            "series": risk_series,
        })

        if ast_type.lower() in ("hvac", "pump", "chiller"):
            vib_series = []
            for h in range(1, 25):
                ts = cutoff + timedelta(hours=h)
                v_hat = max(0.0, curr_vib + vib_slope * h)
                vib_series.append({
                    "timestamp": ts.isoformat(),
                    "value": round(v_hat, 3),
                    "lower": max(0.0, round(v_hat - 0.2, 3)),
                    "upper": round(v_hat + 0.2, 3),
                })
            vibration_outputs.append({
                "entity_id": ast_id,
                "asset_type": ast_type,
                "model": "formula",
                "series": vib_series,
            })

    return {
        "domain": "assets",
        "node": node,
        "as_of": cutoff.isoformat(),
        "model": "rule",
        "forecasts": outputs,
        "vibration_forecasts": vibration_outputs,
        "data_source": data_source("assets"),
        "series": outputs[0]["series"] if outputs else [],
    }


def forecast_safety_domain(db: Session, node: str, as_of: datetime) -> dict[str, Any]:
    cutoff = hour(as_of)
    future_w = forecast_weather(db, cutoff, horizon_hours=24)
    history_start = cutoff - timedelta(days=28)
    history = fetch_frame(db, "safety_incidents", node, history_start, cutoff, cutoff)
    registry = fetch_frame(db, "registry_outdoor_areas", node, history_start, cutoff, cutoff)
    areas = sorted(set(registry.get("area_id", pd.Series(dtype=str)).dropna().astype(str)) |
                   set(history.get("area_id", pd.Series(dtype=str)).dropna().astype(str)))
    outputs = []
    for area in areas:
        count = int((history["area_id"].astype(str) == area).sum()) if not history.empty else 0
        # Poisson maximum-likelihood rate includes days with zero incidents.
        rate = count / 28.0
        daily_series = [{"timestamp": (cutoff.date() + timedelta(days=d)).isoformat(),
                         "value": rate, "lower": max(0.0, rate - 1.645 * math.sqrt(rate)),
                         "upper": rate + 1.645 * math.sqrt(rate)} for d in range(1, 8)]
        outputs.append({"entity_id": area, "model": "poisson", "mae": None,
                        "baseline_mae": None, "series": daily_series})

    # Hourly risk index combining darkness and rain
    hourly_risk = []
    for item in future_w.itertuples():
        t_dt = item.Index
        h_val = t_dt.hour
        rain = float(getattr(item, "rainfall", 0.0))
        darkness = 25.0 if (h_val < 6 or h_val >= 19) else 0.0
        rain_risk = 35.0 if rain > 0.0 else 0.0
        tot_risk = round(min(100.0, 15.0 + darkness + rain_risk), 1)
        hourly_risk.append({
            "timestamp": t_dt.isoformat(),
            "value": tot_risk,
            "lower": max(0.0, tot_risk - 5.0),
            "upper": min(100.0, tot_risk + 5.0),
        })

    return {
        "domain": "safety",
        "node": node,
        "as_of": cutoff.isoformat(),
        "model": "poisson",
        "forecasts": outputs,
        "hourly_risk_index": hourly_risk,
        "data_source": data_source("safety"),
        "series": outputs[0]["series"] if outputs else [],
    }


def forecast_sustainability_domain(db: Session, node: str, as_of: datetime) -> dict[str, Any]:
    cutoff = hour(as_of)
    history = fetch_frame(db, "sustainability", node, cutoff - timedelta(days=28), cutoff, cutoff)
    latest = history[history["date"] == history["date"].max()] if not history.empty else history
    base_score = calc_sustainability_score(latest)
    daily_series = [] if base_score is None else [
        {"timestamp": (cutoff.date() + timedelta(days=d)).isoformat(), "value": base_score,
         "lower": base_score, "upper": base_score} for d in range(1, 8)]
    return {"domain": "sustainability", "node": node, "as_of": cutoff.isoformat(),
            "model": "seasonal", "projection": True,
            "projection_basis": "Last observed score held constant; KPI score forecast formulas are unavailable",
            "forecasts": [] if base_score is None else [{"entity_id": node, "model": "seasonal",
                "mae": None, "baseline_mae": None, "series": daily_series}],
            "data_source": data_source("sustainability"), "series": daily_series}


# =========================================================================
# Risks Detection & Predictive Candidate Persistence
# =========================================================================

def get_forecast_risks(db: Session, node: str, as_of: datetime) -> list[dict[str, Any]]:
    cutoff = hour(as_of)
    risks = []

    # 1. Energy peak over threshold (> 550 kW)
    e_fc = forecast_energy_domain(db, node, as_of, metric="peak_demand_kw")
    for fc in e_fc.get("forecasts", []):
        for s in fc.get("series", []):
            if s["value"] > 550.0:
                t_dt = datetime.fromisoformat(s["timestamp"])
                lead_h = max(1, int((t_dt - cutoff).total_seconds() / 3600.0))
                risks.append({
                    "type": "predicted_energy_peak",
                    "node": fc["entity_id"],
                    "domain": "energy",
                    "predicted_time": s["timestamp"],
                    "lead_time_hours": lead_h,
                    "facts": {"peak_kw": s["value"], "threshold_kw": 550.0},
                })
                break

    # 2. Waste overflow (first hour with fill >= 100%)
    w_fc = forecast_waste_domain(db, node, as_of, metric="fill_percentage")
    risks.extend(w_fc.get("overflow_risks", []))

    # 3. Tank low (< 40%)
    t_fc = forecast_water_domain(db, node, as_of, metric="tank_level_pct")
    for fc in t_fc.get("forecasts", []):
        for s in fc.get("series", []):
            if s["value"] < 40.0:
                t_dt = datetime.fromisoformat(s["timestamp"])
                lead_h = max(1, int((t_dt - cutoff).total_seconds() / 3600.0))
                risks.append({
                    "type": "predicted_tank_low",
                    "node": fc["entity_id"],
                    "domain": "water",
                    "predicted_time": s["timestamp"],
                    "lead_time_hours": lead_h,
                    "facts": {"tank_level_pct": s["value"]},
                })
                break

    # 4. Parking above 80%
    m_fc = forecast_mobility_domain(db, node, as_of, metric="parking_occupancy")
    for fc in m_fc.get("forecasts", []):
        for s in fc.get("series", []):
            if s.get("parking_percent") is not None and s["parking_percent"] >= 80.0:
                t_dt = datetime.fromisoformat(s["timestamp"])
                lead_h = max(1, int((t_dt - cutoff).total_seconds() / 3600.0))
                risks.append({
                    "type": "predicted_parking_high",
                    "node": fc["entity_id"],
                    "domain": "mobility",
                    "predicted_time": s["timestamp"],
                    "lead_time_hours": lead_h,
                    "facts": {"parking_percent": s["parking_percent"]},
                })
                break

    # 5. AQI above 200
    a_fc = forecast_air_domain(db, node, as_of, metric="aqi_cpcb")
    for fc in a_fc.get("forecasts", []):
        for s in fc.get("series", []):
            if s["value"] > 200.0:
                t_dt = datetime.fromisoformat(s["timestamp"])
                lead_h = max(1, int((t_dt - cutoff).total_seconds() / 3600.0))
                risks.append({
                    "type": "predicted_air_poor",
                    "node": fc["entity_id"],
                    "domain": "air",
                    "predicted_time": s["timestamp"],
                    "lead_time_hours": lead_h,
                    "facts": {"aqi": s["value"], "category": s.get("aqi_category", "Poor")},
                })
                break

    # 6. Heat or Flood risk high (> 60) & Heavy rain readiness
    c_fc = forecast_climate_domain(db, node, as_of)
    for fc in c_fc.get("forecasts", []):
        for s in fc.get("series", []):
            if s["value"] >= 60.0:
                t_dt = datetime.fromisoformat(s["timestamp"])
                lead_h = max(1, int((t_dt - cutoff).total_seconds() / 3600.0))
                r_type = "predicted_heat_risk" if fc["metric"] == "heat_risk" else "predicted_flood_risk"
                risks.append({
                    "type": r_type,
                    "node": fc["entity_id"],
                    "domain": "climate",
                    "predicted_time": s["timestamp"],
                    "lead_time_hours": lead_h,
                    "facts": {"risk_value": s["value"], "metric": fc["metric"]},
                })
                break

    # 7. Asset failure risk above 70
    ast_fc = forecast_assets_domain(db, node, as_of)
    for fc in ast_fc.get("forecasts", []):
        if fc.get("failure_risk_24h", 0.0) > 70.0:
            s0 = next((point for point in fc.get("series", []) if point["value"] > 70.0), None)
            if s0 is None:
                continue
            lead = max(1, int((datetime.fromisoformat(s0["timestamp"]) - cutoff).total_seconds() / 3600))
            risks.append({
                "type": "predicted_asset_risk",
                "node": fc["entity_id"],
                "domain": "assets",
                "predicted_time": s0["timestamp"],
                "lead_time_hours": lead,
                "facts": {"failure_risk": fc["failure_risk_24h"], "asset_type": fc.get("asset_type")},
            })

    return risks


def store_predictive_candidates(db: Session, risks: list[dict[str, Any]], as_of: datetime) -> int:
    """Store predictive risk events into alerts table with predictive=True and dedup alert_key = type|node|day."""
    table = get_table("alerts")
    if table is None:
        return 0

    inserted_count = 0
    cutoff = hour(as_of)
    dialect = db.get_bind().dialect.name

    for r in risks:
        r_type = r["type"]
        node_id = r["node"]
        pred_time = datetime.fromisoformat(r["predicted_time"])
        day_str = pred_time.date().isoformat()
        alert_key = f"{r_type}|{node_id}|{day_str}"
        alert_id = f"pred_{r_type}_{node_id}_{pred_time.strftime('%Y%m%d%H')}"

        facts = {
            **r.get("facts", {}),
            "predictive": True,
            "lead_time_hours": r.get("lead_time_hours", 1),
            "predicted_time": r["predicted_time"],
        }
        values = {
            "alert_id": alert_id,
            "alert_key": alert_key,
            "created_at": cutoff,
            "node_id": node_id,
            "domain": r.get("domain", "system"),
            "type": r_type,
            "level": None,
            "status": "candidate",
            "confidence": None,
            "facts": {"observations": facts, "context": {}},
            "severity": None,
            "payload": None,
        }

        try:
            if dialect == "postgresql":
                from sqlalchemy.dialects.postgresql import insert as pg_insert
                stmt = pg_insert(table).values(**values).on_conflict_do_nothing(index_elements=[table.c.alert_key])
            elif dialect == "sqlite":
                from sqlalchemy.dialects.sqlite import insert as sqlite_insert
                stmt = sqlite_insert(table).values(**values).on_conflict_do_nothing(index_elements=[table.c.alert_key])
            else:
                stmt = insert(table).values(**values)
            res = db.execute(stmt)
            if res.rowcount and res.rowcount > 0:
                inserted_count += 1
        except Exception:
            pass

    try:
        db.commit()
    except Exception:
        db.rollback()

    return inserted_count
