from __future__ import annotations

from datetime import datetime

import pandas as pd
from sqlalchemy.orm import Session

from app.analytics.repository import fetch_frame

DOMAIN_TABLES = {
    "energy": "energy_floor_hourly",
    "occupancy": "occupancy_floor_hourly",
    "water": "water_hourly",
    "water_tanks": "water_tank_levels",
    "water_resources": "water_resources",
    "waste": "waste_hourly",
    "mobility": "traffic_parking",
    "assets": "assets_equipment",
    "air": "air_environment",
    "climate": "climate_resilience",
    "emissions": "emissions",
    "safety": "safety_incidents",
    "sustainability": "sustainability",
    "weather": "weather",
    "signals": "signals_energy",
    "operations": "campus_operations",
}


def rollup(
    session: Session, node: str, start: datetime, end: datetime, as_of: datetime,
) -> dict[str, pd.DataFrame]:
    """Read detail tables for one node and time window; keep each domain separate."""
    return {
        domain: fetch_frame(session, table, node, start, end, as_of)
        for domain, table in DOMAIN_TABLES.items()
    }
