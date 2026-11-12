"""Derive transparent, within-simulation sustainability indices from source CSVs."""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).resolve().parents[1] / "datasets"
SCORE_COLUMNS = (
    "energy_score", "water_score", "waste_score", "air_score", "mobility_score",
    "assets_score", "safety_score", "climate_score", "emissions_score",
)


def daily_metric(folder: Path, filename: str, value: str, operation: str) -> pd.Series:
    pieces: list[pd.DataFrame] = []
    for chunk in pd.read_csv(folder / filename, usecols=["timestamp", value], chunksize=150_000):
        dates = pd.to_datetime(chunk.pop("timestamp"), errors="coerce", utc=True).dt.tz_convert("Asia/Kolkata").dt.date
        values = pd.to_numeric(chunk[value], errors="coerce")
        valid = values.notna() & dates.notna()
        frame = pd.DataFrame({"date": dates[valid], "value": values[valid]})
        grouped = frame.groupby("date").value
        pieces.append((grouped.sum() if operation == "sum" else grouped.mean()).rename("value").reset_index())
    if not pieces:
        return pd.Series(dtype=float)
    combined = pd.concat(pieces, ignore_index=True).groupby("date").value
    return (combined.sum() if operation == "sum" else combined.mean()).astype(float)


def calculate_scores(folder: Path = DATA) -> pd.DataFrame:
    base = pd.read_csv(folder / "sustainability.csv", usecols=["date", "facility_id", "data_source"])
    columns = pd.read_csv(folder / "sustainability.csv", nrows=0).columns.tolist()
    dates = pd.to_datetime(base.date, errors="coerce")

    energy = daily_metric(folder, "energy_building_hourly.csv", "energy_kwh", "sum")
    occupancy = daily_metric(folder, "occupancy_hourly.csv", "occupancy_count", "sum")
    water = daily_metric(folder, "water_hourly.csv", "water_consumption_litres", "sum")
    waste = daily_metric(folder, "waste_hourly.csv", "waste_weight", "sum")
    air = daily_metric(folder, "air_environment.csv", "aqi_cpcb", "mean")
    mobility = daily_metric(folder, "traffic_parking.csv", "vehicle_count", "sum")
    assets = daily_metric(folder, "assets_equipment.csv", "availability", "mean")
    safety_rows = pd.read_csv(folder / "safety_incidents.csv", usecols=["timestamp", "incident_id"])
    safety_dates = pd.to_datetime(safety_rows.timestamp, errors="coerce", utc=True).dt.tz_convert("Asia/Kolkata").dt.date
    safety = safety_dates.value_counts().astype(float).sort_index()
    climate_parts: list[pd.DataFrame] = []
    for chunk in pd.read_csv(folder / "climate_resilience.csv", usecols=["timestamp", "heat_risk", "flood_risk"], chunksize=150_000):
        stamp = pd.to_datetime(chunk.pop("timestamp"), errors="coerce", utc=True).dt.tz_convert("Asia/Kolkata").dt.date
        risk = pd.concat([pd.to_numeric(chunk.heat_risk, errors="coerce"), pd.to_numeric(chunk.flood_risk, errors="coerce")], axis=1).max(axis=1, skipna=True)
        valid = stamp.notna() & risk.notna()
        climate_parts.append(pd.DataFrame({"date": stamp[valid], "value": risk[valid]}).groupby("date").value.mean().reset_index())
    climate = pd.concat(climate_parts, ignore_index=True).groupby("date").value.mean() if climate_parts else pd.Series(dtype=float)
    emissions = daily_metric(folder, "emissions.csv", "total_co2e", "sum")

    # With no occupied person-hours, retain absolute daily usage as the metric;
    # this avoids inventing an occupancy denominator or leaving score blanks.
    persons = occupancy.fillna(0).replace(0, 1)
    date_index = pd.Index(dates.dt.date, name="date")
    safety = safety.reindex(date_index, fill_value=0)
    metrics = {
        "energy_score": (energy / persons, False),
        "water_score": (water / persons, False),
        "waste_score": (waste / persons, False),
        "air_score": (air, False),
        "mobility_score": (mobility, False),
        "assets_score": (assets, True),
        "safety_score": (safety, False),
        "climate_score": (climate, False),
        "emissions_score": (emissions / persons, False),
    }
    scores: dict[str, pd.Series] = {}
    for column, (metric, higher_is_better) in metrics.items():
        aligned = metric.reindex(date_index).to_numpy(dtype=float)
        finite = np.isfinite(aligned)
        result = np.full(len(base), np.nan, dtype=float)
        if finite.sum() >= 30:
            ranks = pd.Series(aligned[finite]).rank(method="min", pct=True).to_numpy()
            result[finite] = ranks * 100 if higher_is_better else (1 - ranks) * 100
        scores[column] = pd.Series(result, index=base.index).round(2)
    output = pd.DataFrame(scores)
    output["sustainability_score"] = output[list(SCORE_COLUMNS)].mean(axis=1).round(2)
    output.insert(0, "date", base.date)
    output.insert(1, "facility_id", base.facility_id)
    output["data_source"] = "synthetic_derived"
    return output[columns]


def regenerate(folder: Path = DATA) -> int:
    output = calculate_scores(folder)
    output.to_csv(folder / "sustainability.csv", index=False, lineterminator="\n")
    return len(output)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DATA)
    args = parser.parse_args()
    count = regenerate(args.data_dir)
    print(f"Derived nine factor scores and composite for {count} synthetic daily rows")


if __name__ == "__main__":
    main()
