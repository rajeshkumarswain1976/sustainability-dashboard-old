"""Rebuild the active campus simulation from a frozen source profile bundle.

The bundle is created once from the existing top-level CSVs, then kept outside
the adapter's top-level CSV glob. Generation is deterministic for a given seed.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import random
import shutil
import sys
import tempfile
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
DATA = ROOT / "datasets"
TEMPLATES = ROOT / "scripts" / "synthetic_seed_profiles.zip"
REPORT = DATA / "validation_report.txt"
SEED = 20261111
TZ = "Asia/Kolkata"
HOUR_TABLES = {
    "air_environment", "assets_equipment", "campus_operations", "climate_resilience",
    "emissions", "energy_building_hourly", "energy_floor_hourly", "occupancy_floor_hourly",
    "occupancy_hourly", "traffic_parking", "waste_hourly", "water_hourly",
    "water_resources", "water_tank_levels", "weather",
}
ENTITY_KEYS = {
    "air_environment": ["zone_id"], "assets_equipment": ["asset_id"],
    "campus_operations": ["facility_id"], "climate_resilience": ["zone_id"],
    "emissions": ["floor_id"], "energy_building_hourly": ["building_id"],
    "energy_floor_hourly": ["floor_id"], "occupancy_floor_hourly": ["floor_id"],
    "occupancy_hourly": ["building_id"], "traffic_parking": ["gate_id"],
    "waste_hourly": ["bin_id"], "water_hourly": ["meter_id"],
    "water_resources": ["facility_id"], "water_tank_levels": ["tank_id"],
    "weather": ["facility_id"],
}
SYNTHETIC_TAG = {
    "synthetic", "synthetic_derived", "derived", "estimated_from_occupancy",
    "synthetic_estimated", "registry_assumed", "provided_registry", "real", "scripted_scenario",
}


def freeze_source_profiles() -> None:
    if TEMPLATES.exists():
        return
    files = sorted(DATA.glob("*.csv"))
    if not files:
        raise RuntimeError("No active CSVs available to seed the profile bundle")
    temporary = TEMPLATES.with_suffix(".tmp")
    with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in files:
            archive.write(path, path.name)
    temporary.replace(TEMPLATES)


def source_frames() -> dict[str, pd.DataFrame]:
    with zipfile.ZipFile(TEMPLATES) as archive:
        return {Path(name).stem: pd.read_csv(archive.open(name), low_memory=False)
                for name in archive.namelist() if name.endswith(".csv")}


def season_factor(stamp: pd.Timestamp) -> float:
    """A mild, smooth north-Indian academic-calendar load seasonality."""
    day = stamp.dayofyear
    annual = math.cos(2 * math.pi * (day - 200) / 365.25)
    return 1.0 + 0.055 * annual


def apply_weather_seasonality(name: str, frame: pd.DataFrame, templates: dict[str, pd.DataFrame],
                              weather_rain6: dict[str, float] | None = None) -> pd.DataFrame:
    """Retain hourly profiles while adding a coherent Delhi annual climate cycle."""
    source = templates["weather"]
    source_dates = pd.to_datetime(source.timestamp, errors="coerce", utc=True).dt.tz_convert(TZ)
    source_day = float(source_dates.dt.dayofyear.median())
    if name in {"weather", "air_environment", "climate_resilience"}:
        stamps = pd.to_datetime(frame.timestamp, errors="coerce", utc=True).dt.tz_convert(TZ)
        day = stamps.dt.dayofyear.to_numpy()
        hour = stamps.dt.hour.to_numpy()
        annual = np.cos(2 * np.pi * (day - 200) / 365.25)
        source_annual = math.cos(2 * math.pi * (source_day - 200) / 365.25)
        monsoon = np.where((day >= 160) & (day <= 275), 1.0, np.where((day >= 276) & (day <= 305), 0.25, 0.04))
        source_monsoon = 1.0 if 160 <= source_day <= 275 else 0.25
        if "temperature" in frame:
            diurnal = 1.2 * np.sin(2 * np.pi * (hour - 8) / 24)
            frame["temperature"] = pd.to_numeric(frame.temperature, errors="coerce") + 8.5 * (annual - source_annual) + diurnal
        if "humidity" in frame:
            frame["humidity"] = (pd.to_numeric(frame.humidity, errors="coerce") + 15 * (monsoon - source_monsoon)).clip(20, 100)
        if "rainfall" in frame:
            factor = np.divide(monsoon, source_monsoon, out=np.zeros_like(monsoon, dtype=float), where=source_monsoon != 0)
            frame["rainfall"] = (pd.to_numeric(frame.rainfall, errors="coerce").fillna(0).to_numpy() * factor).clip(0, 80)
        if name == "climate_resilience" and "climate_readiness_score" in frame:
            frame["climate_readiness_score"] = ""
        if name == "weather" and "rainfall_6h_total" in frame:
            rain = pd.to_numeric(frame.rainfall, errors="coerce").fillna(0)
            frame["rainfall_6h_total"] = rain.rolling(6, min_periods=1).sum()
            from app.analytics.forecast_engine import heat_index
            temperature = pd.to_numeric(frame.temperature, errors="coerce").fillna(0)
            humidity = pd.to_numeric(frame.humidity, errors="coerce").fillna(0)
            frame["heat_index"] = [heat_index(float(temp), float(rh)) for temp, rh in zip(temperature, humidity)]
            frame["heat_risk"] = ((frame.heat_index - 27) * 5).clip(0, 100)
        if name == "climate_resilience":
            from app.analytics.forecast_engine import climate_risk_values
            frame = frame.sort_values(["zone_id", "timestamp"]).reset_index(drop=True)
            rain_6h = frame.timestamp.map(weather_rain6 or {})
            risks = [climate_risk_values(float(temp), float(rh), float(rain), float(rain6),
                      float(drainage), float(low), float(exposure))
                     for temp, rh, rain, rain6, drainage, low, exposure in zip(
                         frame.temperature, frame.humidity, frame.rainfall, rain_6h,
                         frame.drainage_capacity, frame.low_lying_flag, frame.building_exposure)]
            frame["heat_risk"] = [value[0] for value in risks]
            frame["flood_risk"] = [value[1] for value in risks]
            frame = frame.sort_values("timestamp").reset_index(drop=True)
        if "data_source" in frame:
            frame["data_source"] = "synthetic_derived"
    return frame


def profile_for(frame: pd.DataFrame, stamp_col: str, target: pd.Timestamp) -> pd.Series:
    parsed = pd.to_datetime(frame[stamp_col], errors="coerce", utc=True).dt.tz_convert(TZ)
    mask = (parsed.dt.dayofweek == target.dayofweek) & (parsed.dt.hour == target.hour)
    subset = frame.loc[mask]
    if subset.empty:
        subset = frame.loc[parsed.dt.hour == target.hour]
    if subset.empty:
        subset = frame
    return subset.iloc[0]


def iter_hourly_chunks(name: str, frame: pd.DataFrame, timestamps: pd.DatetimeIndex, chunk_hours: int = 24):
    stamp_col = "timestamp"
    entities = ENTITY_KEYS[name]
    grouped = {key: part for key, part in frame.groupby(entities, dropna=False, sort=False)}
    entity_keys = list(grouped)
    profiles: dict[object, dict[tuple[int, int], dict[str, object]]] = {}
    for key, source in grouped.items():
        parsed = pd.to_datetime(source[stamp_col], errors="coerce", utc=True).dt.tz_convert(TZ)
        profile_rows = {}
        for row_index, row in source.iterrows():
            stamp = parsed.loc[row_index]
            profile_rows.setdefault((stamp.dayofweek, stamp.hour), row.to_dict())
        profiles[key] = profile_rows
    for first in range(0, len(timestamps), chunk_hours):
        records: list[dict[str, object]] = []
        for stamp in timestamps[first:first + chunk_hours]:
            dow_hour = (stamp.dayofweek, stamp.hour)
            for key in entity_keys:
                row = profiles[key].get(dow_hour)
                if row is None:
                    row = next(iter(profiles[key].values()))
                row = row.copy()
                source_time = pd.Timestamp(row[stamp_col])
                if source_time.tzinfo is None:
                    source_time = source_time.tz_localize(TZ)
                else:
                    source_time = source_time.tz_convert(TZ)
                date_shift = stamp - source_time
                row[stamp_col] = stamp.isoformat(sep=" ")
                for col in ("collection_time", "last_collection_time", "predicted_overflow_time"):
                    if col in row and pd.notna(row[col]) and str(row[col]).strip():
                        value = pd.Timestamp(row[col])
                        if value.tzinfo is None:
                            value = value.tz_localize(TZ)
                        else:
                            value = value.tz_convert(TZ)
                        row[col] = (value + date_shift).isoformat(sep=" ")
                if "data_source" in row and str(row["data_source"]).lower() in SYNTHETIC_TAG:
                    row["data_source"] = "synthetic_derived" if name in {"emissions", "campus_operations", "climate_resilience"} else "synthetic"
                records.append(row)
        yield pd.DataFrame.from_records(records, columns=frame.columns)


def expand_hourly(name: str, frame: pd.DataFrame, timestamps: pd.DatetimeIndex, rng: random.Random) -> pd.DataFrame:
    result = pd.concat(iter_hourly_chunks(name, frame, timestamps), ignore_index=True)
    # Slowly varying demand/load seasonality; same multiplier across each domain
    # and hour preserves energy/floor and occupancy/floor allocations.
    if name in {"energy_building_hourly", "energy_floor_hourly"}:
        units = result.groupby(ENTITY_KEYS[name], dropna=False).ngroups
        factor = pd.Series([season_factor(t) for t in pd.DatetimeIndex(pd.to_datetime(result.timestamp).drop_duplicates())]).repeat(units).reset_index(drop=True)
        for column in ("energy_kwh", "peak_demand_kw", "grid_import_kwh", "solar_generation_kwh", "fuel_consumption_l", "equipment_load"):
            if column in result:
                result[column] = pd.to_numeric(result[column], errors="coerce") * factor
    # Provenance says the readings are simulated, even where old labels implied measurement.
    if "data_source" in result:
        result["data_source"] = result["data_source"].replace({"real": "synthetic", "derived": "synthetic_derived", "estimated_from_occupancy": "synthetic_estimated"})
    return result


def expand_events(name: str, frame: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp, rng: random.Random) -> pd.DataFrame:
    if frame.empty:
        return frame.copy()
    if name == "safety_incidents":
        count = round(len(frame) * ((end - start).total_seconds() / 86400) / 54)
        rows = []
        for index in range(count):
            row = frame.iloc[rng.randrange(len(frame))].to_dict()
            stamp = start + timedelta(minutes=rng.randrange(int((end - start).total_seconds() / 60) + 1))
            row["incident_id"] = f"INC{index + 1:05d}"
            row["timestamp"] = stamp.isoformat(sep=" ")
            rows.append(row)
        return pd.DataFrame(rows, columns=frame.columns)
    if name == "signals_energy":
        rows = frame.copy()
        signals = []
        for index, (_, record) in enumerate(rows.iterrows(), 1):
            row = record.to_dict()
            day_offset = int((end - start).days * (index - 0.5) / len(rows))
            anomaly_start = start + timedelta(days=day_offset, hours=8 + (index % 4) * 2)
            duration = 2 + index % 3
            row.update(signal_id=f"SIG{index:04d}", timestamp_start=anomaly_start.isoformat(sep=" "),
                       timestamp_end=(anomaly_start + timedelta(hours=duration)).isoformat(sep=" "))
            if "data_source" in row:
                row["data_source"] = "synthetic_derived"
            signals.append(row)
        return pd.DataFrame(signals, columns=frame.columns)
    if name == "sustainability":
        rows = []
        for day in pd.date_range(start.normalize(), end.normalize(), freq="D", tz=TZ):
            for facility in frame.facility_id.drop_duplicates():
                candidates = frame[frame.facility_id == facility]
                base = candidates.iloc[day.dayofweek % len(candidates)].to_dict()
                base["date"] = day.date().isoformat()
                base["data_source"] = "synthetic_derived"
                # No defensible score formula exists in available inputs; don't inherit legacy scores.
                for score in ("energy_score", "water_score", "waste_score", "air_score", "mobility_score",
                              "assets_score", "safety_score", "climate_score", "emissions_score", "sustainability_score"):
                    if score in base:
                        base[score] = ""
                rows.append(base)
        return pd.DataFrame(rows, columns=frame.columns)
    if name == "inspections":
        rows = frame.copy()
        rows["week"] = rows["week"].astype(str)
        for index, row in rows.iterrows():
            day = start.normalize() + timedelta(days=(index % max(1, (end - start).days)))
            rows.at[index, "week"] = str(day.isocalendar().week)
            rows.at[index, "due"] = (day + timedelta(days=3, hours=8)).isoformat(sep=" ")
            if "data_source" in rows:
                rows.at[index, "data_source"] = "synthetic_assumed"
        return rows
    # Reference tables retain stable identifiers and assumptions.
    result = frame.copy()
    if "data_source" in result:
        result["data_source"] = result["data_source"].replace({"real": "synthetic", "derived": "synthetic_derived", "registry_assumed": "synthetic_assumed", "provided_registry": "synthetic_assumed", "scripted_scenario": "synthetic", "estimated_from_occupancy": "synthetic_estimated"})
    for column in result.columns:
        if column == "last_service_date":
            result[column] = "2026-10-01"
    return result


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    frame.to_csv(path, index=False, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")


def generate(seed: int = SEED, requested_end_date: date | None = None) -> dict[str, int]:
    freeze_source_profiles()
    templates = source_frames()
    rng = random.Random(seed)
    end_date = requested_end_date or (date.today() - timedelta(days=1))
    start_date = end_date - timedelta(days=364)
    start = pd.Timestamp(datetime.combine(start_date, datetime.min.time()), tz=TZ)
    event_end = pd.Timestamp(datetime.combine(end_date, datetime.max.time().replace(microsecond=0)), tz=TZ)
    hours = pd.date_range(start, pd.Timestamp(datetime.combine(end_date, datetime.min.time()) + timedelta(hours=23), tz=TZ), freq="h")
    signal_frame = expand_events("signals_energy", templates["signals_energy"], start, event_end, rng)
    signal_frame["excess_pct"] = 18.0
    signal_frame["data_source"] = "synthetic_derived"
    asset_history = templates["assets_equipment"].groupby("asset_id").vibration.apply(lambda values: values.notna().any())
    assets_without_vibration_sensor = set(asset_history.index[~asset_history])
    water_template = templates["water_hourly"].copy()
    water_stamps = pd.to_datetime(water_template.timestamp, errors="coerce", utc=True).dt.tz_convert(TZ)
    water_template["_weekhour"] = list(zip(water_stamps.dt.dayofweek, water_stamps.dt.hour))
    water_profile = water_template.drop_duplicates(["meter_id", "_weekhour"])
    water_litres = water_profile.groupby("_weekhour", sort=False).water_consumption_litres.sum().to_dict()
    tank_capacity_by_id = templates["water_tank_levels"].groupby("tank_id").tank_capacity_kl.first().astype(float).to_dict()
    tank_capacity = pd.Series(list(tank_capacity_by_id.values()), dtype=float)
    total_tank_capacity = float(tank_capacity.sum())
    tank_states: dict[str, tuple[float, bool]] = {}
    energy_floor_parts = []
    row_counts: dict[str, int] = {}
    output_names = ["signals_energy", "weather", *sorted(name for name in templates if name not in {"signals_energy", "weather", "emissions", "energy_building_hourly", "energy_floor_hourly"}),
                    "energy_floor_hourly", "energy_building_hourly", "emissions"]
    weather_rain6: dict[str, float] | None = None
    with tempfile.TemporaryDirectory(prefix="campus-synthetic-") as tmp:
        stage = Path(tmp)
        for name in output_names:
            template = templates[name]
            if name == "signals_energy":
                frame = signal_frame
                write_csv(frame, stage / f"{name}.csv")
                row_counts[name] = len(frame)
                continue
            elif name in HOUR_TABLES:
                destination = stage / f"{name}.csv"
                energy_index = None
                if name == "emissions":
                    energy_floor_values = pd.concat(energy_floor_parts, ignore_index=True).set_index(["timestamp", "floor_id"])["energy_kwh"]
                    energy_index = energy_floor_values
                chunk_hours = 8760 if name in {"weather", "air_environment", "climate_resilience"} else 24
                for frame in iter_hourly_chunks(name, template, hours, chunk_hours=chunk_hours):
                    timestamps_in_chunk = pd.DatetimeIndex(pd.to_datetime(frame.timestamp).drop_duplicates())
                    if name in {"energy_building_hourly", "energy_floor_hourly"}:
                        factor = np.repeat([season_factor(stamp) for stamp in timestamps_in_chunk], len(frame) // len(timestamps_in_chunk))
                        for column in ("energy_kwh", "peak_demand_kw", "grid_import_kwh", "solar_generation_kwh", "fuel_consumption_l", "equipment_load"):
                            if column in frame:
                                frame[column] = pd.to_numeric(frame[column], errors="coerce") * factor
                        for signal in signal_frame.itertuples(index=False):
                            targets = [stamp.isoformat(sep=" ") for stamp in pd.date_range(
                                pd.Timestamp(signal.timestamp_start), pd.Timestamp(signal.timestamp_end),
                                freq="h", inclusive="left")]
                            mask = frame.building_id.eq(signal.building_id) & frame.timestamp.isin(targets)
                            for column in ("energy_kwh", "peak_demand_kw", "grid_import_kwh"):
                                if column in frame:
                                    frame.loc[mask, column] = pd.to_numeric(frame.loc[mask, column], errors="coerce") * 1.18
                    if name in {"weather", "air_environment", "climate_resilience"}:
                        frame = apply_weather_seasonality(name, frame, templates, weather_rain6)
                        if name == "weather":
                            weather_rain6 = dict(zip(frame.timestamp, pd.to_numeric(frame.rainfall_6h_total, errors="coerce")))
                    if name == "water_tank_levels":
                        from app.analytics.forecast_engine import simulate_tank_hour
                        for row_index, row in frame.iterrows():
                            tank = str(row.tank_id)
                            capacity = float(tank_capacity_by_id[tank])
                            if tank not in tank_states:
                                level, pump = float(row.tank_level), bool(row.pump_on)
                                inflow = float(row.pump_inflow_kl)
                            else:
                                stamp = pd.Timestamp(row.timestamp)
                                use_kl = float(water_litres.get((stamp.dayofweek, stamp.hour), 0.0)) / 1000.0
                                use_kl *= capacity / total_tank_capacity if total_tank_capacity else 0.0
                                previous_level, previous_pump = tank_states[tank]
                                level, pump, inflow = simulate_tank_hour(previous_level, capacity, previous_pump, use_kl)
                            tank_states[tank] = (level, pump)
                            frame.at[row_index, "tank_level"] = level
                            frame.at[row_index, "tank_level_pct"] = level / capacity * 100.0 if capacity else 0.0
                            frame.at[row_index, "pump_on"] = int(pump)
                            frame.at[row_index, "pump_inflow_kl"] = inflow
                    if name == "assets_equipment":
                        partial_dropout = frame.vibration.isna() & ~frame.asset_id.isin(assets_without_vibration_sensor)
                        frame.loc[partial_dropout, "telemetry_gap"] = 1
                    if name == "energy_floor_hourly":
                        energy_floor_parts.append(frame[["timestamp", "floor_id", "energy_kwh"]].copy())
                    if name == "emissions":
                        energy_keys = pd.MultiIndex.from_frame(frame[["timestamp", "floor_id"]])
                        frame = frame.drop(columns=["energy_co2e"])
                        grid_factor = pd.to_numeric(frame["energy_emission_factor"], errors="coerce").fillna(0)
                        frame["energy_co2e"] = energy_keys.map(energy_index) * grid_factor.to_numpy()
                        frame["total_co2e"] = sum(pd.to_numeric(frame[column], errors="coerce").fillna(0)
                                                  for column in ("energy_co2e", "mobility_co2e", "waste_co2e"))
                        frame["data_source"] = "synthetic_derived"
                        frame = frame[template.columns.tolist()]
                    if "data_source" in frame:
                        frame["data_source"] = frame["data_source"].replace({"real": "synthetic", "derived": "synthetic_derived", "registry_assumed": "synthetic_assumed", "provided_registry": "synthetic_assumed", "scripted_scenario": "synthetic", "estimated_from_occupancy": "synthetic_estimated"})
                    frame.to_csv(destination, mode="a", header=not destination.exists(), index=False,
                                 quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
                    row_counts[name] = row_counts.get(name, 0) + len(frame)
                print(f"Staged {name}: {row_counts[name]} rows", flush=True)
                continue
            else:
                frame = expand_events(name, template, start, event_end, rng)
            if "data_source" in frame:
                frame["data_source"] = frame["data_source"].replace({"real": "synthetic", "derived": "synthetic_derived", "registry_assumed": "synthetic_assumed", "provided_registry": "synthetic_assumed", "scripted_scenario": "synthetic", "estimated_from_occupancy": "synthetic_estimated"})
            write_csv(frame, stage / f"{name}.csv")
            row_counts[name] = len(frame)
            del frame
            print(f"Staged {name}: {row_counts[name]} rows", flush=True)
        # Replace the unsupported template blanks with a documented relative index.
        from derive_sustainability_scores import regenerate
        regenerate(stage)
        # Validate staged schemas, nulls, keys, and domain relations before replacing active files.
        from validate_synthetic_datasets import validate_folder
        issues = validate_folder(stage, strict=False,
                                 expected_schema={name: frame.columns.tolist() for name, frame in templates.items()})
        if issues:
            raise ValueError("Generated files failed validation: " + "; ".join(issues[:20]))
        counts = {}
        for name in sorted(row_counts):
            shutil.copyfile(stage / f"{name}.csv", DATA / f"{name}.csv")
            counts[name] = row_counts[name]
    meta = {
        "classification": "synthetic campus simulation",
        "seed": seed,
        "generator": "scripts/generate_synthetic_datasets.py",
        "generated_on": date.today().isoformat(),
        "timezone": TZ,
        "start": start.isoformat(), "end": hours[-1].isoformat(),
        "template_bundle_sha256": hashlib.sha256(TEMPLATES.read_bytes()).hexdigest(),
        "source_profile_note": "Frozen from the repository's prior synthetic top-level CSV profiles; no measured campus inputs.",
        "assumptions": ["one prior synthetic weekday/hour profile is replayed per unit", "energy receives a shared smooth annual seasonal multiplier", "weather receives a seasonal annual temperature and monsoon rainfall cycle, applied consistently to linked climate and air rows", "heat risk = clamp((Steadman/Rothfusz heat index in C - 27) * 5, 0, 100)", "flood risk = clamp(max(rainfall_6h / 6, rainfall * 0.4) * 50 * exposure * (1 + low_lying) / (10 + 0.5 * drainage_capacity), 0, 100)", "18% synthetic energy anomalies are present only in matching signal windows", "safety events and derived signal windows are resampled with the fixed seed", "each daily factor score is the empirical percentile rank within this simulation window; lower is better for energy/person-hour, water/person-hour, waste/person-hour, AQI, vehicle count, incidents, climate risk and emissions/person-hour; higher is better for asset availability; zero-occupancy days use absolute daily resource use", "the composite is the equal-weight mean of available daily factor scores; it is a relative simulation index, not a certified sustainability rating", "climate readiness score remains unavailable without a supported formula"],
        "intentional_nulls": {
            "assets_equipment.mtbf,mttr": "not computed because the synthetic source has no per-asset failure history",
            "assets_equipment.vibration": "not applicable to assets without a vibration sensor; partial nulls are flagged in telemetry_gap",
            "assets_equipment.availability": "not applicable while AST028 is out of service with zero scheduled available hours",
            "water_hourly.occupancy": "not applicable to central meter M15, which has no building assignment",
            "signals_energy.z_score": "unavailable where baseline dispersion was not estimable",
            "safety_incidents.asset_id": "not applicable to incidents not linked to a specific asset",
            "water_resources.days_of_water_available": "unavailable where no finite usable-water depletion estimate is present",
            "waste_hourly.fill_rate": "not applicable when there is no usable fill change over the preceding interval",
            "waste_hourly.predicted_overflow_time": "not applicable when no overflow is predicted",
            "waste_hourly.collection_time,last_collection_time": "not applicable before/when a bin has no collection event",
            "climate_resilience.climate_readiness_score": "unavailable because no defensible score formula is documented",
        },
    }
    schema = {name: frame.columns.tolist() for name, frame in templates.items()}
    (DATA / "synthetic_schema.json").write_text(json.dumps(schema, indent=2), encoding="utf-8")
    (DATA / "synthetic_provenance.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    report = ["Synthetic campus simulation validation inputs", f"Seed: {seed}",
              f"Window: {start.isoformat()} through {hours[-1].isoformat()} ({TZ})",
              f"Template SHA-256: {meta['template_bundle_sha256']}",
              "Source profiles are frozen synthetic examples; no measured campus observations were used.",
              "Energy anomaly windows are synthetic +18% excursions synchronized to signals_energy.csv.",
              "Weather seasonal offset: annual temperature cosine about day 200 plus hourly cycle; rainfall is concentrated in the modeled monsoon window (days 160–305). Heat risk = clamp((Steadman/Rothfusz heat index in C - 27) * 5, 0, 100); flood risk = clamp(max(rainfall_6h/6, rainfall*0.4)*50*exposure*(1+low_lying)/(10+0.5*drainage_capacity), 0, 100). Sustainability factor scores are within-window empirical percentile ranks of the documented daily metrics; the composite is the unweighted mean of available factors and is not a certified rating.",
              ""] + [f"PASS {name}.csv: {count} rows" for name, count in sorted(counts.items())]
    REPORT.write_text("\n".join(report) + "\n", encoding="utf-8")
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--end-date", type=date.fromisoformat, help="last calendar date to generate (defaults to yesterday, IST)")
    parser.add_argument("--dry-run", action="store_true", help="report the planned regeneration without writing CSVs")
    args = parser.parse_args()
    if args.dry_run:
        frames = source_frames() if TEMPLATES.exists() else {p.stem: pd.read_csv(p, low_memory=False) for p in DATA.glob("*.csv")}
        print(json.dumps({"active_csvs": sorted(frames), "seed": args.seed, "planned_hours": 8760,
                          "planned_window_days": 365, "template_bundle_exists": TEMPLATES.exists()}, indent=2))
        return
    counts = generate(args.seed, args.end_date)
    print(json.dumps({"seed": args.seed, "tables": len(counts), "rows": sum(counts.values()), "row_counts": counts}, indent=2))


if __name__ == "__main__":
    main()
