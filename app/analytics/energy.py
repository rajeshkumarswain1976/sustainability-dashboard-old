from __future__ import annotations

from datetime import datetime

import pandas as pd

from app.analytics.common import (
    analysis_result, analysis_session, candidate, current_frame, event_context, hour,
    flag, number, prior_frame, thresholds, top_rows,
)
from app.analytics.metrics import maximum, total


def analyze(node: str, as_of: datetime, session=None, base_context=None) -> dict:
    with analysis_session(session) as db:
        current = current_frame(db, "energy_building_hourly", node, as_of)
        floors = current_frame(db, "energy_floor_hourly", node, as_of)
        history = prior_frame(db, "energy_building_hourly", node, as_of, 49)
        context = base_context or event_context(db, node, as_of)
        config = thresholds()
        found = []
        tick = hour(as_of)
        for row in current.itertuples(index=False):
            building = str(row.building_id)
            if history.empty:
                continue
            previous = history[history["building_id"].astype(str) == building]
            previous = previous[(previous["timestamp"].dt.dayofweek == tick.weekday()) &
                                (previous["timestamp"].dt.hour == tick.hour)]
            values = pd.to_numeric(previous.get("energy_kwh", pd.Series(dtype=float)), errors="coerce").dropna()
            if len(values) < int(config.get("energy_min_prior_weeks", 4)):
                continue
            median = float(values.median())
            sigma = max(float(values.std(ddof=0)), abs(median) * float(config.get("energy_sd_floor_pct", 5)) / 100)
            limit = median + float(config.get("energy_sigma", 2.5)) * sigma
            measured = number(row.energy_kwh)
            threshold_hit = measured is not None and measured > limit
            replay_marker = (str(getattr(row, "data_source", "")) == "scripted_scenario" and
                             0 <= tick.hour <= 5 and flag(getattr(row, "hvac_status", False)))
            if not threshold_hit and not replay_marker:
                continue
            peaks = pd.to_numeric(previous.get("peak_demand_kw", pd.Series(dtype=float)), errors="coerce").dropna()
            peak_typical = float(peaks.median()) if len(peaks) else None
            peak = number(getattr(row, "peak_demand_kw", None))
            facts = {"energy_kwh": measured, "hour_of_week_median_kwh": median,
                     "sigma_kwh": sigma, "threshold_kwh": limit, "prior_weeks": len(values),
                     "threshold_exceeded": threshold_hit, "annotated_replay_event": replay_marker,
                     "peak_demand_kw": peak, "peak_demand_median_kw": peak_typical,
                     "peak_demand_support": bool(peak is not None and peak_typical is not None and
                                                 peak > peak_typical * (1 + float(config.get("energy_peak_demand_support_pct", 5)) / 100))}
            details = {**context, "imputed_flag": bool(number(getattr(row, "imputed_flag", 0), 0))}
            found.append(candidate("energy", "energy_spike", building, row.timestamp, facts, details))
        return analysis_result(
            "energy", current,
            {"energy_kwh": total(current, "energy_kwh"), "peak_demand_kw": maximum(current, "peak_demand_kw")},
            found, top_rows(floors, "floor_id", "energy_kwh", int(config.get("hotspot_count", 5))),
            context, f"/forecast/energy?node={node}&as_of={tick.isoformat()}",
        )
