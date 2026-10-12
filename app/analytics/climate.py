from __future__ import annotations

from datetime import datetime

from app.analytics.common import (
    analysis_result, analysis_session, candidate, current_frame, event_context,
    number, thresholds, top_rows,
)
from app.analytics.metrics import maximum


def analyze(node: str, as_of: datetime, session=None, base_context=None) -> dict:
    with analysis_session(session) as db:
        current = current_frame(db, "climate_resilience", node, as_of)
        weather = current_frame(db, "weather", "F01", as_of)
        context = base_context or event_context(db, node, as_of)
        config = thresholds()
        found = []
        for row in current.itertuples(index=False):
            area = str(row.zone_id)
            flood = number(getattr(row, "flood_risk", None))
            heat = number(getattr(row, "heat_risk", None))
            if flood is not None and flood > float(config.get("flood_risk", 60)):
                found.append(candidate("climate", "flood_risk", area, row.timestamp,
                                       {"flood_risk": flood, "rainfall": number(getattr(row, "rainfall", None))}, context))
            if heat is not None and heat > float(config.get("heat_risk", 60)):
                found.append(candidate("climate", "heat_risk", area, row.timestamp,
                                       {"heat_risk": heat, "temperature": number(getattr(row, "temperature", None))}, context))
        for row in weather.itertuples(index=False):
            rainfall = number(getattr(row, "rainfall", None))
            if rainfall is not None and rainfall >= float(config.get("heavy_rain_mm_per_hour", 5)):
                found.append(candidate("climate", "heavy_rain", "F01", row.timestamp,
                                       {"rainfall_mm": rainfall}, context))
        return analysis_result(
            "climate", current,
            {"flood_risk_max": maximum(current, "flood_risk"), "heat_risk_max": maximum(current, "heat_risk")},
            found, top_rows(current, "zone_id", "flood_risk", int(config.get("hotspot_count", 5))), context,
        )
