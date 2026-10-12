from __future__ import annotations

from typing import Any

import pandas as pd


def _records(frame: pd.DataFrame | None) -> list[dict[str, Any]]:
    if frame is None or frame.empty:
        return []
    return [
        {key: (None if pd.isna(value) else value) for key, value in row.items()}
        for row in frame.to_dict(orient="records")
    ]


def build_master_rows(frames: dict[str, pd.DataFrame]) -> dict[str, list[dict[str, Any]]]:
    """Build common facility masters while leaving operational domains separate."""
    buildings = frames.get("registry_buildings", pd.DataFrame())
    floors = frames.get("registry_floors", pd.DataFrame())
    assets = frames.get("registry_assets", pd.DataFrame())
    climate_zones = frames.get("registry_zones_climate", pd.DataFrame())
    meters = frames.get("registry_meters", pd.DataFrame())
    tanks = frames.get("registry_tanks", pd.DataFrame())
    bins = frames.get("registry_bins", pd.DataFrame())
    locations = frames.get("location_dim", pd.DataFrame())

    facility_rows: list[dict[str, Any]] = []
    for facility_id in buildings.get("facility_id", pd.Series(dtype=str)).dropna().unique():
        facility_rows.append({"facility_id": str(facility_id), "name": "Campus A", "sector": "college"})

    zone_rows: list[dict[str, Any]] = []
    if not climate_zones.empty:
        for row in climate_zones.to_dict(orient="records"):
            zone_id = row.get("zone_id")
            if pd.isna(zone_id):
                continue
            location = locations[locations.get("node_id", pd.Series(dtype=str)).astype(str) == str(zone_id)] if not locations.empty else pd.DataFrame()
            label = str(location.iloc[0].get("label")) if not location.empty else str(zone_id)
            zone_rows.append({"zone_id": str(zone_id), "facility_id": str(row.get("facility_id") or ""), "label": label})

    building_rows = [
        {"building_id": str(row.get("building_id")), "facility_id": str(row.get("facility_id") or ""), "zone_id": str(row.get("zone_id") or ""), "label": str(row.get("building_label") or row.get("building_id"))}
        for row in _records(buildings) if row.get("building_id") is not None
    ]
    floor_rows = [
        {"floor_id": str(row.get("floor_id")), "building_id": str(row.get("building_id") or ""), "facility_id": str(row.get("facility_id") or ""), "zone_id": str(row.get("zone_id") or ""), "floor_use": str(row.get("floor_use") or "")}
        for row in _records(floors) if row.get("floor_id") is not None
    ]
    asset_rows = [
        {"asset_id": str(row.get("asset_id")), "asset_type": str(row.get("asset_type") or ""), "facility_id": str(row.get("facility_id") or ""), "zone_id": str(row.get("zone_id") or ""), "building_id": str(row.get("building_id") or ""), "floor_id": str(row.get("floor_id") or "")}
        for row in _records(assets) if row.get("asset_id") is not None
    ]

    sensor_rows: list[dict[str, Any]] = []
    for frame, id_col, sensor_type in ((meters, "meter_id", "water_meter"), (tanks, "tank_id", "tank_level"), (bins, "bin_id", "waste_bin")):
        for row in _records(frame):
            identifier = row.get(id_col)
            if identifier is None:
                continue
            sensor_rows.append({
                "sensor_id": f"{sensor_type}:{identifier}", "sensor_type": sensor_type,
                "facility_id": str(row.get("facility_id") or ""), "zone_id": str(row.get("zone_id") or ""),
                "building_id": str(row.get("building_id") or ""), "floor_id": str(row.get("floor_id") or ""),
                "source_id": str(identifier),
            })
    return {
        "facility": facility_rows,
        "zone": zone_rows,
        "building": building_rows,
        "floor": floor_rows,
        "asset": asset_rows,
        "sensor": sensor_rows,
    }
