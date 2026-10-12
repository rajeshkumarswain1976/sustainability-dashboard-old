from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd

from app.analytics.common import (
    analysis_result, analysis_session, candidate, current_frame, event_context,
    flag, hour, ist, number, thresholds, top_rows,
)
from app.analytics.metrics import total


def analyze(node: str, as_of: datetime, session=None, base_context=None) -> dict:
    with analysis_session(session) as db:
        current = current_frame(db, "waste_hourly", node, as_of)
        context = base_context or event_context(db, node, as_of)
        config = thresholds()
        found = []
        for row in current.itertuples(index=False):
            fill = number(getattr(row, "fill_percentage", None))
            explicit = flag(getattr(row, "overflow_event", False))
            delayed = flag(getattr(row, "collection_delayed", False))
            predicted = getattr(row, "predicted_overflow_time", None)
            due_soon = False
            if pd.notna(predicted):
                predicted_at = ist(predicted)
                tick = hour(row.timestamp)
                due_soon = tick <= predicted_at <= tick + timedelta(hours=float(config.get("waste_overflow_warning_hours", 3)))
            full = fill is not None and fill >= float(config.get("waste_overflow_pct", 100))
            if explicit or full or due_soon or delayed:
                found.append(candidate("waste", "bin_overflow", str(row.bin_id), row.timestamp,
                                       {"fill_percentage": fill, "overflow_event": explicit,
                                        "predicted_within_3h": due_soon, "collection_delayed": delayed}, context))
        return analysis_result(
            "waste", current,
            {"waste_weight": total(current, "waste_weight"), "overflow_bins": sum(flag(x) for x in current.get("overflow_event", []))},
            found, top_rows(current, "bin_id", "fill_percentage", int(config.get("hotspot_count", 5))), context,
        )
