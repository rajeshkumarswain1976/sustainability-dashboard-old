"""Repeatable validation for the active synthetic campus CSV set."""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "datasets"
KEYS = {
    "occupancy_hourly": ["timestamp", "building_id"], "occupancy_floor_hourly": ["timestamp", "floor_id"],
    "weather": ["timestamp"], "energy_building_hourly": ["timestamp", "building_id"],
    "energy_floor_hourly": ["timestamp", "floor_id"], "water_hourly": ["timestamp", "meter_id"],
    "water_tank_levels": ["timestamp", "tank_id"], "water_resources": ["timestamp"],
    "waste_hourly": ["timestamp", "bin_id"], "traffic_parking": ["timestamp", "gate_id"],
    "assets_equipment": ["timestamp", "asset_id"], "climate_resilience": ["timestamp", "zone_id"],
    "air_environment": ["timestamp", "zone_id"], "emissions": ["timestamp", "floor_id"],
    "campus_operations": ["timestamp"], "safety_incidents": ["incident_id"], "signals_energy": ["signal_id"],
    "sustainability": ["date", "facility_id"], "location_dim": ["node_id", "level"],
    "registry_buildings": ["building_id"], "registry_floors": ["floor_id"], "registry_meters": ["meter_id"],
    "registry_tanks": ["tank_id"], "registry_bins": ["bin_id"], "registry_assets": ["asset_id"],
    "registry_outdoor_areas": ["area_id"], "registry_zones_climate": ["zone_id"],
    "registry_emission_factors": ["factor_name"], "inspections": ["inspection_id"],
}
UNIT_COLUMNS = {
    "air_environment": "zone_id", "assets_equipment": "asset_id", "campus_operations": "facility_id",
    "climate_resilience": "zone_id", "emissions": "floor_id", "energy_building_hourly": "building_id",
    "energy_floor_hourly": "floor_id", "occupancy_floor_hourly": "floor_id", "occupancy_hourly": "building_id",
    "traffic_parking": "gate_id", "waste_hourly": "bin_id", "water_hourly": "meter_id",
    "water_resources": "facility_id", "water_tank_levels": "tank_id", "weather": "facility_id",
}
TREND_COLUMNS = {
    "air_environment": "aqi_cpcb", "assets_equipment": "vibration", "campus_operations": "classroom_occupied",
    "climate_resilience": "temperature", "emissions": "total_co2e", "energy_building_hourly": "energy_kwh",
    "energy_floor_hourly": "energy_kwh", "occupancy_floor_hourly": "occupancy_count",
    "occupancy_hourly": "occupancy_count", "traffic_parking": "vehicle_count", "waste_hourly": "waste_weight",
    "water_hourly": "water_consumption_litres", "water_resources": "available_water_kl",
    "water_tank_levels": "tank_level", "weather": "temperature",
}
PROVENANCE = {"synthetic", "synthetic_derived", "synthetic_estimated", "synthetic_assumed"}
INTENTIONAL_BLANKS = {
    "assets_equipment": {"mtbf", "mttr", "availability", "vibration"}, "water_resources": {"days_of_water_available"},
    "waste_hourly": {"fill_rate", "predicted_overflow_time", "collection_time", "last_collection_time"},
    "sustainability": {"energy_score", "water_score", "waste_score", "air_score", "mobility_score", "assets_score", "safety_score", "climate_score", "emissions_score", "sustainability_score"},
    "climate_resilience": {"climate_readiness_score"}, "water_hourly": {"occupancy"},
    "signals_energy": {"z_score"},
}


def validate_folder(folder: Path = DATA, strict: bool = True, expected_schema: dict[str, list[str]] | None = None) -> list[str]:
    errors: list[str] = []
    schema_file = folder / "synthetic_schema.json"
    if expected_schema is None and schema_file.exists():
        expected_schema = json.loads(schema_file.read_text(encoding="utf-8"))
    frames: dict[str, pd.DataFrame] = {}
    keep = {"occupancy_hourly", "registry_buildings", "waste_hourly", "water_tank_levels",
            "energy_floor_hourly", "energy_building_hourly", "emissions",
            "registry_emission_factors", "location_dim"}
    files = {path.stem: path for path in folder.glob("*.csv")}
    if not files:
        return [f"{folder}: no CSV files found"]
    for name, path in files.items():
        frame = pd.read_csv(path, low_memory=False)
        if name in keep:
            frames[name] = frame
        if expected_schema is not None and name in expected_schema and frame.columns.tolist() != expected_schema[name]:
            errors.append(f"{name}: columns differ from source schema")
        keys = KEYS.get(name, [])
        missing_keys = [column for column in keys if column not in frame]
        if missing_keys:
            errors.append(f"{name}: key columns missing {missing_keys}")
        elif frame.duplicated(keys).any():
            errors.append(f"{name}: duplicate keys on {keys}")
        if keys and frame[keys].isna().any(axis=None):
            errors.append(f"{name}: null key values")
        for column in frame.select_dtypes(include=[np.number]).columns:
            values = frame[column].dropna().to_numpy(dtype=float)
            if not np.isfinite(values).all():
                errors.append(f"{name}.{column}: non-finite values")
        if "data_source" in frame:
            unknown = set(frame.data_source.dropna().astype(str).str.lower()) - PROVENANCE
            if unknown:
                errors.append(f"{name}: non-synthetic provenance labels {sorted(unknown)}")
            if frame.data_source.isna().any() or (frame.data_source.astype(str).str.strip() == "").any():
                errors.append(f"{name}: blank provenance")
        elif name != "registry_emission_factors":
            errors.append(f"{name}: provenance field missing")
        allowed = INTENTIONAL_BLANKS.get(name, set()) | {"parent_id", "zone_id", "building_id", "floor_id", "area_id", "asset_id"}
        if strict:
            for column in frame.columns:
                count = int(frame[column].isna().sum())
                if count and column not in allowed:
                    errors.append(f"{name}.{column}: {count} unapproved blanks")
            if name == "assets_equipment":
                missing_availability = frame.availability.isna()
                allowed_availability = (frame.status.eq("maintenance") &
                                        pd.to_numeric(frame.available_hours, errors="coerce").fillna(-1).eq(0))
                if (missing_availability & ~allowed_availability).any():
                    errors.append("assets_equipment.availability: blanks outside zero-hour maintenance")
                no_sensor = frame.groupby("asset_id").vibration.transform(lambda values: values.notna().sum() == 0)
                gap = pd.to_numeric(frame.telemetry_gap, errors="coerce").fillna(0).eq(1)
                if (frame.vibration.isna() & ~no_sensor & ~gap).any():
                    errors.append("assets_equipment.vibration: partial missing values lack telemetry_gap=1")
                gaps = pd.to_numeric(frame.telemetry_gap, errors="coerce").dropna()
                if not gaps.isin([0, 1]).all():
                    errors.append("assets_equipment.telemetry_gap: values must be 0 or 1")
            if name == "water_hourly" and "occupancy" in frame:
                invalid = frame.occupancy.isna() & ~(frame.meter_id.eq("M15") & frame.building_id.isna())
                if invalid.any():
                    errors.append("water_hourly.occupancy: blanks outside unassigned central meter M15")
        for column in ("timestamp", "timestamp_start", "timestamp_end", "due"):
            if column in frame:
                parsed = pd.to_datetime(frame[column], errors="coerce", utc=True)
                if frame[column].notna().sum() != parsed.notna().sum():
                    errors.append(f"{name}.{column}: invalid timestamps")
        if "timestamp" in frame and name in UNIT_COLUMNS:
            timestamps = pd.to_datetime(frame.timestamp, errors="coerce", utc=True)
            expected_hours = (timestamps.max() - timestamps.min()).total_seconds() / 3600 + 1
            unit = UNIT_COLUMNS[name]
            gaps = []
            for _, group in frame.groupby(unit, dropna=False):
                times = pd.to_datetime(group.timestamp, errors="coerce", utc=True).sort_values()
                if len(times) != expected_hours or times.diff().dropna().dt.total_seconds().ne(3600).any():
                    gaps.append(str(group[unit].iloc[0]))
            if gaps:
                errors.append(f"{name}: hourly continuity failure for {len(gaps)} units")
            metric = TREND_COLUMNS[name]
            values = pd.to_numeric(frame[metric], errors="coerce").dropna()
            if len(values) and values.nunique() < 8:
                errors.append(f"{name}.{metric}: fewer than 8 distinct readings")
        del frame
    # Basic domain ranges and linked-table checks.
    for name, column in (("waste_hourly", "fill_percentage"), ("water_tank_levels", "tank_level_pct")):
        if name in frames and column in frames[name]:
            values = pd.to_numeric(frames[name][column], errors="coerce")
            if (values.dropna().lt(0) | values.dropna().gt(100)).any():
                errors.append(f"{name}.{column}: outside 0..100")
    if "water_tank_levels" in frames:
        frame = frames["water_tank_levels"]
        level, capacity = pd.to_numeric(frame.tank_level, errors="coerce"), pd.to_numeric(frame.tank_capacity_kl, errors="coerce")
        if (level.lt(0) | level.gt(capacity)).any():
            errors.append("water_tank_levels: levels outside capacity")
    for name, column in (("energy_building_hourly", "energy_kwh"), ("energy_floor_hourly", "energy_kwh"),
                         ("occupancy_hourly", "occupancy_count"), ("occupancy_floor_hourly", "occupancy_count"),
                         ("water_hourly", "water_consumption_litres"), ("waste_hourly", "waste_weight")):
        path = files.get(name)
        if path:
            values = pd.read_csv(path, usecols=[column])[column]
            if pd.to_numeric(values, errors="coerce").dropna().lt(0).any():
                errors.append(f"{name}.{column}: negative readings")
    if "occupancy_hourly" in frames and "registry_buildings" in frames:
        usage = frames["occupancy_hourly"].merge(frames["registry_buildings"][["building_id", "total_capacity_people"]], on="building_id", how="left")
        if usage.total_capacity_people.isna().any() or (pd.to_numeric(usage.occupancy_count, errors="coerce") > pd.to_numeric(usage.total_capacity_people, errors="coerce")).any():
            errors.append("occupancy_hourly: unknown building or occupancy above capacity")
    if "energy_floor_hourly" in frames and "energy_building_hourly" in frames:
        floor = frames["energy_floor_hourly"].groupby(["timestamp", "building_id"], as_index=False).energy_kwh.sum()
        building = frames["energy_building_hourly"][["timestamp", "building_id", "energy_kwh"]]
        joined = floor.merge(building, on=["timestamp", "building_id"], suffixes=("_floor", "_building"), validate="one_to_one")
        if not np.allclose(joined.energy_kwh_floor, joined.energy_kwh_building, rtol=1e-5, atol=1e-5):
            errors.append("energy: floor totals do not match building totals")
    if "emissions" in frames:
        e = frames["emissions"]
        parts = sum(pd.to_numeric(e[c], errors="coerce").fillna(0) for c in ("energy_co2e", "mobility_co2e", "waste_co2e"))
        if not np.allclose(parts, pd.to_numeric(e.total_co2e, errors="coerce"), rtol=1e-6, atol=1e-6):
            errors.append("emissions: total does not equal source components")
        if "registry_emission_factors" in frames:
            factors = frames["registry_emission_factors"].set_index("factor_name").value.to_dict()
            grid = float(factors.get("grid", 0.716))
            ratio = pd.to_numeric(e.energy_co2e, errors="coerce") / pd.to_numeric(e.energy_emission_factor, errors="coerce")
            energy = frames.get("energy_floor_hourly", pd.DataFrame()).set_index(["timestamp", "floor_id"]).energy_kwh
            expected = pd.MultiIndex.from_frame(e[["timestamp", "floor_id"]]).map(energy)
            if not np.allclose(pd.to_numeric(e.energy_co2e, errors="coerce"), expected * grid, rtol=1e-6, atol=1e-6):
                errors.append("emissions: energy component does not match floor energy and grid factor")
    if "location_dim" in frames:
        loc = frames["location_dim"]
        ids = set(loc.node_id.astype(str))
        parents = set(loc.parent_id.dropna().astype(str)) - {""}
        if not parents.issubset(ids):
            errors.append("location_dim: orphan parent identifiers")
    manifest = folder / "synthetic_provenance.json"
    if strict and folder == DATA:
        if not manifest.exists():
            errors.append("synthetic_provenance.json is missing")
        if not schema_file.exists():
            errors.append("synthetic_schema.json is missing")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--folder", type=Path, default=DATA)
    args = parser.parse_args()
    problems = validate_folder(args.folder)
    if problems:
        print(json.dumps({"status": "failed", "issues": problems}, indent=2))
        raise SystemExit(1)
    print(json.dumps({"status": "passed", "csv_files": len(list(args.folder.glob('*.csv')))}, indent=2))


if __name__ == "__main__":
    main()
