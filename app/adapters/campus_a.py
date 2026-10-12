from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd
import numpy as np

from app.adapters.base import DataAdapter
from app.config import settings
from app.etl.clean import clean_and_validate

TABLE_PRIMARY_KEYS: dict[str, tuple[str, ...]] = {
    "occupancy_hourly": ("timestamp", "building_id"),
    "occupancy_floor_hourly": ("timestamp", "floor_id"),
    "weather": ("timestamp",),
    "energy_building_hourly": ("timestamp", "building_id"),
    "energy_floor_hourly": ("timestamp", "floor_id"),
    "water_hourly": ("timestamp", "meter_id"),
    "water_tank_levels": ("timestamp", "tank_id"),
    "water_resources": ("timestamp",),
    "waste_hourly": ("timestamp", "bin_id"),
    "traffic_parking": ("timestamp", "gate_id"),
    "assets_equipment": ("timestamp", "asset_id"),
    "climate_resilience": ("timestamp", "zone_id"),
    "air_environment": ("timestamp", "zone_id"),
    "emissions": ("timestamp", "floor_id"),
    "campus_operations": ("timestamp",),
    "safety_incidents": ("incident_id",),
    "signals_energy": ("signal_id",),
    "sustainability": ("date", "facility_id"),
    # A node identifier may be reused at different hierarchy levels.
    "location_dim": ("node_id", "level"),
    "registry_buildings": ("building_id",),
    "registry_floors": ("floor_id",),
    "registry_meters": ("meter_id",),
    "registry_tanks": ("tank_id",),
    "registry_bins": ("bin_id",),
    "registry_assets": ("asset_id",),
    "registry_outdoor_areas": ("area_id",),
    "registry_zones_climate": ("zone_id",),
    "registry_emission_factors": ("factor_name",),
    "inspections": ("inspection_id",),
}

DATE_COLUMNS = {"date", "last_service_date", "maintenance_date"}
DATETIME_COLUMNS = {
    "timestamp", "timestamp_start", "timestamp_end", "predicted_overflow_time",
    "collection_time", "last_collection_time",
}


class CampusAAdapter(DataAdapter):
    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = data_dir or settings.data_dir
        if not self.data_dir.is_dir():
            raise FileNotFoundError("Configured data directory is unavailable")
        self._manifest_cache: dict[str, Any] | None = None

    def table_paths(self) -> dict[str, Path]:
        return {path.stem: path for path in sorted(self.data_dir.glob("*.csv"))}

    def extract(self, table: str | None = None) -> dict[str, pd.DataFrame] | pd.DataFrame:
        paths = self.table_paths()
        if table is not None:
            if table not in paths:
                raise KeyError(f"Unknown table: {table}")
            return self._read(paths[table])
        return {name: self._read(path) for name, path in paths.items()}

    @staticmethod
    def _read(path: Path) -> pd.DataFrame:
        frame = pd.read_csv(path, low_memory=False)
        # Registry reference tables do not always carry a row-level source field.
        # Keep provenance explicit for those rows without altering the source CSV.
        if path.stem == "registry_emission_factors" and "data_source" not in frame.columns:
            frame["data_source"] = "provided_registry"
        frame = frame.replace([np.inf, -np.inf], np.nan)
        for column in frame.columns:
            key = column.lower()
            if key in DATETIME_COLUMNS or key.endswith("_timestamp"):
                frame[column] = pd.to_datetime(frame[column], errors="coerce", utc=True).dt.tz_convert("Asia/Kolkata")
            elif key in DATE_COLUMNS or key.endswith("_date"):
                frame[column] = pd.to_datetime(frame[column], errors="coerce").dt.tz_localize("Asia/Kolkata")
        return frame

    def validate(self, table: str | None = None) -> dict[str, list[str]]:
        frames = self.extract(table)
        selected = {table: frames} if table else frames
        return self.validate_frames(selected)

    @staticmethod
    def validate_frames(frames: dict[str, pd.DataFrame]) -> dict[str, list[str]]:
        results: dict[str, list[str]] = {}
        for name, frame in frames.items():
            errors = clean_and_validate(frame, name, TABLE_PRIMARY_KEYS.get(name, ()))
            if "data_source" not in frame.columns:
                errors.append("required provenance field is absent")
            results[name] = errors
        return results

    def provenance(self) -> dict[str, Any]:
        if self._manifest_cache is not None:
            return self._manifest_cache
        manifest = {
            "captured_at_utc": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "records": [],
        }
        for name, path in self.table_paths().items():
            digest = hashlib.sha256()
            with path.open("rb") as handle:
                for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                    digest.update(chunk)
            with path.open("r", encoding="utf-8-sig", newline="") as handle:
                row_count = max(sum(1 for _ in handle) - 1, 0)
            manifest["records"].append({
                "table": name,
                "sha256": digest.hexdigest(),
                "row_count": row_count,
            })
        self._manifest_cache = manifest
        return manifest

    def write_provenance(self, destination: Path | None = None) -> Path:
        target_dir = destination or settings.provenance_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / "ingestion_manifest.json"
        target.write_text(json.dumps(self.provenance(), indent=2), encoding="utf-8")
        return target


def parse_scalar(value: Any) -> Any:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        if value.tzinfo is None:
            return value.tz_localize("Asia/Kolkata").to_pydatetime()
        return value.to_pydatetime()
    if isinstance(value, (datetime, date)):
        return value
    if hasattr(value, "item"):
        return value.item()
    return value
