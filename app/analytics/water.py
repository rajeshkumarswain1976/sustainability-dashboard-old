from __future__ import annotations

from datetime import datetime

from app.analytics.common import (
    analysis_result, analysis_session, candidate, current_frame, event_context,
    flag, hour, number, thresholds, top_rows,
)
from app.analytics.metrics import total


def analyze(node: str, as_of: datetime, session=None, base_context=None) -> dict:
    with analysis_session(session) as db:
        current = current_frame(db, "water_hourly", node, as_of)
        tanks = current_frame(db, "water_tank_levels", node, as_of)
        context = base_context or event_context(db, node, as_of)
        config = thresholds()
        tick = hour(as_of)
        found = []
        night = int(config.get("water_night_start_hour", 0)) <= tick.hour <= int(config.get("water_night_end_hour", 5))
        for row in current.itertuples(index=False):
            flow = number(getattr(row, "flow_lpm", None))
            occupancy = number(getattr(row, "occupancy", None))
            per_person = flow / occupancy if flow is not None and occupancy and occupancy > 0 else None
            explicit = flag(getattr(row, "leak_flag", False))
            elevated = bool(night and per_person is not None and
                            per_person > float(config.get("water_night_flow_per_occupant_lpm", 0.08)))
            if explicit or elevated:
                found.append(candidate("water", "water_leak", str(row.meter_id), row.timestamp,
                                       {"leak_flag": explicit, "night_flow_per_occupant_lpm": per_person,
                                        "flow_lpm": flow, "occupancy": occupancy}, context))
        for row in tanks.itertuples(index=False):
            level = number(getattr(row, "tank_level_pct", None))
            pump_on = flag(getattr(row, "pump_on", False))
            if level is not None and level < float(config.get("tank_low_pct", 40)) and not pump_on:
                found.append(candidate("water", "tank_low", str(row.tank_id), row.timestamp,
                                       {"tank_level_pct": level, "pump_on": pump_on}, context))
        return analysis_result(
            "water", current,
            {"water_consumption_litres": total(current, "water_consumption_litres"),
             "leak_flags": sum(flag(value) for value in current.get("leak_flag", []))},
            found, top_rows(current, "meter_id", "flow_lpm", int(config.get("hotspot_count", 5))),
            context, f"/forecast/water?node={node}&as_of={tick.isoformat()}",
        )
