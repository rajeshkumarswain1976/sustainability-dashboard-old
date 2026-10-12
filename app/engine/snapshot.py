"""The bounded, normalized operational view available to future agents."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from app.analytics import air, assets, climate, energy, safety, traffic, waste, water
from app.analytics.common import analysis_session, current_frame, event_context, hour
from app.analytics.forecast import forecast
from app.analytics.metrics import to_records
from app.engine.pipeline import list_alerts

ANALYZERS = (energy, water, waste, air, traffic, assets, safety, climate)


def build_snapshot(node: str, as_of: datetime, session=None) -> dict[str, Any]:
    with analysis_session(session) as db:
        context = event_context(db, node, as_of)
        analyses = [module.analyze(node, as_of, session=db, base_context=context) for module in ANALYZERS]
        return {"node": node, "as_of": hour(as_of).isoformat(),
                "domains": {item["domain"]: {"current": item["current"], "kpis": item["kpis"],
                                             "data_source": item["data_source"]} for item in analyses},
                "forecasts": {domain: forecast(domain, node, as_of, session=db)
                              for domain in ("energy", "water", "waste", "parking", "air", "weather", "climate", "emissions", "assets", "safety", "sustainability")},
                "candidates": [candidate for item in analyses for candidate in item["candidates"]],
                "hotspots": {item["domain"]: item["hotspots"] for item in analyses},
                "campus_operations": to_records(current_frame(db, "campus_operations", node, as_of)),
                "weather": to_records(current_frame(db, "weather", node, as_of)),
                "open_alerts": [item for item in list_alerts(db, as_of=as_of, node=node)
                                if item["status"] in {"open", "needs_review", "pending_agent"}],
                "context": context}
