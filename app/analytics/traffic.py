from __future__ import annotations

from datetime import datetime

from app.analytics.common import (
    analysis_result, analysis_session, candidate, current_frame, event_context,
    hour, number, thresholds, top_rows,
)
from app.analytics.metrics import total


def analyze(node: str, as_of: datetime, session=None, base_context=None) -> dict:
    with analysis_session(session) as db:
        current = current_frame(db, "traffic_parking", node, as_of)
        context = base_context or event_context(db, node, as_of)
        config = thresholds()
        found = []
        for row in current.itertuples(index=False):
            gate = str(row.gate_id)
            capacity = number(getattr(row, "parking_capacity", None))
            occupied = number(getattr(row, "parking_occupancy", None))
            ratio = occupied / capacity if occupied is not None and capacity and capacity > 0 else None
            density = number(getattr(row, "traffic_density", None))
            delay = number(getattr(row, "delay_min", None))
            if ratio is not None and ratio > float(config.get("parking_high_ratio", 0.8)):
                found.append(candidate("mobility", "parking_high", gate, row.timestamp,
                                       {"parking_occupancy": occupied, "parking_capacity": capacity,
                                        "parking_ratio": ratio}, context))
            if (density is not None and density > float(config.get("congestion_density", 0.75))) or (
                delay is not None and delay > float(config.get("congestion_delay_min", 10))
            ):
                found.append(candidate("mobility", "congestion", gate, row.timestamp,
                                       {"traffic_density": density, "delay_min": delay,
                                        "vehicle_count": number(getattr(row, "vehicle_count", None))}, context))
        capacity_sum = total(current, "parking_capacity")
        occupied_sum = total(current, "parking_occupancy")
        return analysis_result(
            "mobility", current,
            {"vehicle_count": total(current, "vehicle_count"), "parking_ratio": occupied_sum / capacity_sum if capacity_sum else None},
            found, top_rows(current, "gate_id", "parking_occupancy", int(config.get("hotspot_count", 5))),
            context, f"/forecast/parking?node={node}&as_of={hour(as_of).isoformat()}",
        )
