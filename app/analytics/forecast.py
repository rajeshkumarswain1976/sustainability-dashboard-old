from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

from app.analytics.common import analysis_session, hour
from app.analytics.metrics import data_source
from app.analytics.repository import fetch_frame
from app.sector.config import load_sector_config

FEATURES = ["hour", "dayofweek", "is_holiday", "temperature", "humidity", "rainfall",
            "lag_24", "lag_168", "rolling_24_mean", "occupancy"]
SOURCE = {
    "energy": ("energy_building_hourly", "building_id", "energy_kwh"),
    "water": ("water_hourly", None, "water_consumption_litres"),
    "parking": ("traffic_parking", "gate_id", "parking_occupancy"),
}
_MODEL_CACHE: dict[tuple[object, str, str], dict[str, Any]] = {}


def _features(series: pd.DataFrame, holidays: set[str]) -> pd.DataFrame:
    work = series.sort_index().asfreq("h").copy()
    work.columns = [str(column) for column in work.columns]
    work["hour"] = work.index.hour
    work["dayofweek"] = work.index.dayofweek
    work["is_holiday"] = work.index.strftime("%Y-%m-%d").isin(holidays).astype(int)
    for column in ("temperature", "humidity", "rainfall", "occupancy"):
        if column not in work:
            work[column] = np.nan
        work[column] = pd.to_numeric(work[column], errors="coerce").ffill().fillna(0)
    work["lag_24"] = work["target"].shift(24)
    work["lag_168"] = work["target"].shift(168)
    work["rolling_24_mean"] = work["target"].shift(1).rolling(24, min_periods=24).mean()
    return work


def _choose_model_name(model_mae: float | None, baseline_mae: float | None) -> str:
    return "hist_gradient_boosting" if (model_mae is not None and baseline_mae is not None and
                                        model_mae < baseline_mae) else "seasonal"


def _train(work: pd.DataFrame, cutoff: datetime) -> dict[str, Any]:
    usable = work.dropna(subset=["target", "lag_168", "lag_24", "rolling_24_mean"])
    split = pd.Timestamp(cutoff) - timedelta(days=7)
    train = usable[usable.index < split]
    test = usable[(usable.index >= split) & (usable.index <= pd.Timestamp(cutoff))]
    if len(test) == 0:
        return {"model_object": None, "model": "seasonal", "mae": None,
                "baseline_mae": None, "band": 0.0}
    baseline_mae = float(mean_absolute_error(test["target"], test["lag_168"]))
    if len(train) < 100:
        return {"model_object": None, "model": "seasonal", "mae": None,
                "baseline_mae": baseline_mae, "band": baseline_mae}
    model = HistGradientBoostingRegressor(max_iter=120, max_leaf_nodes=15, l2_regularization=1.0,
                                           random_state=42)
    model.fit(train[FEATURES], train["target"])
    predictions = model.predict(test[FEATURES])
    model_mae = float(mean_absolute_error(test["target"], predictions))
    selected = _choose_model_name(model_mae, baseline_mae)
    residual = test["target"].to_numpy() - (
        predictions if selected == "hist_gradient_boosting" else test["lag_168"].to_numpy()
    )
    band = max(float(np.std(residual, ddof=0)), model_mae if selected != "seasonal" else baseline_mae)
    return {"model_object": model if selected != "seasonal" else None,
            "model": selected, "mae": model_mae, "baseline_mae": baseline_mae, "band": band}


def _series(source: pd.DataFrame, key: str | None, entity: str, value: str,
            weather: pd.DataFrame, occupancy: pd.DataFrame) -> pd.DataFrame:
    selected = source if key is None else source[source[key].astype(str) == entity]
    if selected.empty:
        return pd.DataFrame(columns=["target"])
    result = selected.groupby("timestamp")[value].sum(min_count=1).to_frame("target")
    if not weather.empty:
        weather_values = weather.groupby("timestamp")[["temperature", "humidity", "rainfall"]].mean()
        result = result.join(weather_values, how="left")
    if not occupancy.empty:
        occupancy_values = occupancy.groupby("timestamp")["occupancy_count"].sum().to_frame("occupancy")
        result = result.join(occupancy_values, how="left")
    result.index = pd.to_datetime(result.index)
    if result.index.tz is None:
        result.index = result.index.tz_localize("Asia/Kolkata")
    return result.sort_index()


def _seasonal_value(values: dict[pd.Timestamp, float], stamp: pd.Timestamp) -> float:
    for delta in (168, 24):
        candidate = values.get(stamp - timedelta(hours=delta))
        if candidate is not None and np.isfinite(candidate):
            return float(candidate)
    return float(next(reversed(values.values()))) if values else 0.0


def _future_series(work: pd.DataFrame, result: dict[str, Any], as_of: datetime, holidays: set[str]) -> list[dict[str, Any]]:
    cutoff = pd.Timestamp(hour(as_of))
    observed = work[work.index <= cutoff]
    values = {stamp: float(value) for stamp, value in observed["target"].dropna().items()}
    weather_columns = ("temperature", "humidity", "rainfall", "occupancy")
    result_rows = []
    for step in range(1, 25):
        stamp = cutoff + timedelta(hours=step)
        seasonal = _seasonal_value(values, stamp)
        row = {"hour": stamp.hour, "dayofweek": stamp.dayofweek,
               "is_holiday": int(stamp.date().isoformat() in holidays),
               "lag_24": values.get(stamp - timedelta(hours=24), seasonal),
               "lag_168": values.get(stamp - timedelta(hours=168), seasonal),
               "rolling_24_mean": float(np.mean([values.get(stamp - timedelta(hours=back), seasonal)
                                                  for back in range(1, 25)]))}
        for column in weather_columns:
            prior = stamp - timedelta(hours=168)
            row[column] = float(work.at[prior, column]) if prior in work.index and pd.notna(work.at[prior, column]) else 0.0
        prediction = seasonal
        if result["model"] == "hist_gradient_boosting" and result["model_object"] is not None:
            prediction = float(result["model_object"].predict(pd.DataFrame([row], columns=FEATURES))[0])
        prediction = max(0.0, prediction)
        values[stamp] = prediction
        band = 1.96 * float(result["band"])
        result_rows.append({"timestamp": stamp.isoformat(), "value": prediction,
                            "lower": max(0.0, prediction - band), "upper": prediction + band})
    return result_rows


def forecast(domain: str, node: str, as_of: datetime, session=None) -> dict[str, Any]:
    if domain not in SOURCE:
        raise KeyError(domain)
    with analysis_session(session) as db:
        cutoff = hour(as_of)
        start = cutoff - timedelta(days=54)
        table, key, value = SOURCE[domain]
        source = fetch_frame(db, table, node, start, cutoff, cutoff)
        entities = ["F01"] if key is None else sorted(source[key].dropna().astype(str).unique().tolist()) if key in source else []
        weather = fetch_frame(db, "weather", "F01", start, cutoff, cutoff)
        occupancy = fetch_frame(db, "occupancy_hourly", "F01", start, cutoff, cutoff)
        holidays = {str(day) for day in load_sector_config().get("holidays", [])}
        outputs = []
        for entity in entities:
            entity_occupancy = occupancy
            if domain == "energy" and not occupancy.empty:
                entity_occupancy = occupancy[occupancy["building_id"].astype(str) == entity]
            raw = _series(source, key, entity, value, weather, entity_occupancy)
            if raw.empty:
                continue
            work = _features(raw, holidays)
            cache_key = (db.get_bind(), domain, entity)
            cached = _MODEL_CACHE.get(cache_key)
            if (cached is None or cached["trained_at"] > cutoff or
                    cutoff - cached["trained_at"] >= timedelta(days=1)):
                cached = {**_train(work, cutoff), "trained_at": cutoff}
                _MODEL_CACHE[cache_key] = cached
            outputs.append({"entity_id": entity, "model": cached["model"],
                            "mae": cached["mae"], "baseline_mae": cached["baseline_mae"],
                            "series": _future_series(work, cached, cutoff, holidays)})
        response = {"domain": domain, "node": node, "as_of": cutoff.isoformat(),
                    "forecasts": outputs, "data_source": data_source("mobility" if domain == "parking" else domain)}
        if len(outputs) == 1:
            response.update({key: outputs[0][key] for key in ("model", "mae", "baseline_mae", "series")})
        return response
