from __future__ import annotations

from datetime import datetime

from app.analytics.common import (
    analysis_result, analysis_session, candidate, current_frame, event_context,
    prior_frame, thresholds, top_rows,
)


def analyze(node: str, as_of: datetime, session=None, base_context=None) -> dict:
    with analysis_session(session) as db:
        current = current_frame(db, "safety_incidents", node, as_of)
        config = thresholds()
        previous = prior_frame(db, "safety_incidents", node, as_of, int(config.get("safety_recurrence_days", 30)))
        context = base_context or event_context(db, node, as_of)
        found = []
        for row in current.itertuples(index=False):
            area = str(getattr(row, "area_id", None) or getattr(row, "zone_id", node))
            prior_count = int((previous["area_id"].astype(str) == area).sum()) if "area_id" in previous else 0
            found.append(candidate("safety", "safety_incident", area, row.timestamp,
                                   {"incident_id": str(row.incident_id), "incident_type": str(row.incident_type),
                                    "severity": str(row.severity), "prior_area_incidents": prior_count,
                                    "repeat_area": prior_count >= int(config.get("safety_recurrence_count", 2))},
                                   context, str(row.incident_id)))
        hotspot_count = int(config.get("hotspot_count", 5))
        if not previous.empty and "area_id" in previous:
            combined = previous[["area_id"]].copy()
            combined["incident_count"] = 1
            hotspots = top_rows(combined, "area_id", "incident_count", hotspot_count)
        else:
            hotspots = []
        return analysis_result("safety", current, {"incident_count": len(current)}, found, hotspots, context)
