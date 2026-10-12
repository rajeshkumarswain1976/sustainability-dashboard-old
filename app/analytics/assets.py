from __future__ import annotations

from datetime import datetime

import pandas as pd

from app.analytics.common import (
    analysis_result, analysis_session, candidate, current_frame, event_context,
    number, prior_frame, thresholds, top_rows,
)
from app.analytics.metrics import total


def analyze(node: str, as_of: datetime, session=None, base_context=None) -> dict:
    with analysis_session(session) as db:
        current = current_frame(db, "assets_equipment", node, as_of)
        history = prior_frame(db, "assets_equipment", node, as_of, 1)
        context = base_context or event_context(db, node, as_of)
        config = thresholds()
        found = []
        for row in current.itertuples(index=False):
            asset = str(row.asset_id)
            past = history[history["asset_id"].astype(str) == asset] if not history.empty else pd.DataFrame()
            vibration = number(getattr(row, "vibration", None))
            availability = number(getattr(row, "availability", None))
            status = str(getattr(row, "status", "")).lower()
            previous_vibration = number(pd.to_numeric(past.get("vibration", pd.Series(dtype=float)), errors="coerce").median())
            previous_availability = number(pd.to_numeric(past.get("availability", pd.Series(dtype=float)), errors="coerce").median())
            down = status in {"down", "failed", "failure", "offline", "out_of_service"} or availability == 0
            rising = bool(vibration is not None and previous_vibration is not None and previous_vibration > 0 and
                          vibration > previous_vibration * float(config.get("asset_vibration_rise_ratio", 1.25)))
            dropping = bool(availability is not None and previous_availability is not None and previous_availability > 0 and
                            availability < previous_availability * float(config.get("asset_availability_drop_ratio", 0.8)))
            if down or rising or dropping:
                found.append(candidate("assets", "asset_risk", asset, row.timestamp,
                                       {"status": status, "availability": availability, "vibration": vibration,
                                        "down": down, "rising_vibration": rising, "availability_drop": dropping}, context))
        return analysis_result(
            "assets", current,
            {"asset_count": len(current), "downtime_hours": total(current, "downtime_hours")},
            found, top_rows(current, "asset_id", "downtime_hours", int(config.get("hotspot_count", 5))), context,
        )
