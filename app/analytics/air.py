from __future__ import annotations

from datetime import datetime

from app.analytics.common import (
    analysis_result, analysis_session, candidate, current_frame, event_context,
    number, thresholds, top_rows,
)
from app.analytics.metrics import maximum


def analyze(node: str, as_of: datetime, session=None, base_context=None) -> dict:
    with analysis_session(session) as db:
        all_air = current_frame(db, "air_environment", node, as_of)
        current = all_air[all_air["zone_id"].astype(str).str.lower() == "campus"] if "zone_id" in all_air else all_air
        context = base_context or event_context(db, node, as_of)
        config = thresholds()
        found = []
        for row in current.itertuples(index=False):
            aqi = number(getattr(row, "aqi_cpcb", None))
            if aqi is not None and aqi > float(config.get("air_aqi_watch", 200)):
                found.append(candidate("air", "air_poor", str(row.zone_id), row.timestamp,
                                       {"aqi_cpcb": aqi, "dominant_pollutant": getattr(row, "dominant_pollutant", None)}, context))
        return analysis_result(
            "air", current, {"aqi_cpcb_max": maximum(current, "aqi_cpcb")}, found,
            top_rows(current, "zone_id", "aqi_cpcb", int(config.get("hotspot_count", 5))), context,
        )
