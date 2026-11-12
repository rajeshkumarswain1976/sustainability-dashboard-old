from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
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
    source = list(DOMAIN_TABLES.items())
    engine = session.get_bind()
    if engine.dialect.name != "postgresql" or len(source) < 2:
        return {
            domain: fetch_frame(session, table, node, start, end, as_of)
            for domain, table in source
        }

    # Neon has noticeable per-query network latency. Share one resolved campus
    # scope and fetch independent source tables concurrently using separate,
    # short-lived sessions (SQLAlchemy sessions are not thread-safe).
    from app.analytics.repository import resolve_scope

    resolved_scope = resolve_scope(session, node)

    def load(item):
        domain, table = item
        with Session(engine) as worker_session:
            return domain, fetch_frame(
                worker_session, table, node, start, end, as_of,
                resolved_scope=resolved_scope,
            )

    # The PostgreSQL pool allows seven simultaneous connections; the request
    # session holds one, leaving up to six for independent table reads.
    with ThreadPoolExecutor(max_workers=min(6, len(source))) as pool:
        loaded = dict(pool.map(load, source))
    return {domain: loaded[domain] for domain, _ in source}
