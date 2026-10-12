"""The bounded, normalized operational view available to future agents."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from app.analytics import air, assets, climate, energy, safety, traffic, waste, water
from app.analytics.common import analysis_session, current_frame, event_context, hour
from app.analytics.forecast import forecast
from app.analytics.metrics import to_records, data_source, sustainability_score, total
from app.analytics.repository import fetch_frame
from app.engine.pipeline import list_alerts

ANALYZERS = (energy, water, waste, air, traffic, assets, safety, climate)


def build_snapshot(node: str, as_of: datetime, session=None, analyses=None) -> dict[str, Any]:
    with analysis_session(session) as db:
        context = event_context(db, node, as_of)
        analyses = analyses if analyses is not None else [module.analyze(node, as_of, session=db, base_context=context) for module in ANALYZERS]
        domains = {item["domain"]: {"current": item["current"], "kpis": item["kpis"],
                                    "data_source": item["data_source"]} for item in analyses}
        day_start = hour(as_of).replace(hour=0)
        for domain in ("emissions", "sustainability"):
            rows = fetch_frame(db, domain, node, day_start, as_of, as_of)
            kpis = {"sustainability_score": sustainability_score(rows)} if domain == "sustainability" else {
                "total_co2e": total(rows, "total_co2e")}
            domains[domain] = {"current": to_records(rows), "kpis": kpis, "data_source": data_source(domain)}
        return {"node": node, "as_of": hour(as_of).isoformat(), "domains": domains,
                "forecasts": {domain: forecast(domain, node, as_of, session=db)
                              for domain in ("energy", "water", "waste", "parking", "air", "weather", "climate", "emissions", "assets", "safety", "sustainability")},
                "candidates": [candidate for item in analyses for candidate in item["candidates"]],
                "hotspots": {item["domain"]: item["hotspots"] for item in analyses},
                "campus_operations": to_records(current_frame(db, "campus_operations", node, as_of)),
                "weather": to_records(current_frame(db, "weather", node, as_of)),
                "open_alerts": [item for item in list_alerts(db, as_of=as_of, node=node)
                                if item["status"] in {"open", "needs_review", "pending_agent"}],
                "context": context}
