"""Provider selection, confidence gates, and persistent decision audit."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import insert
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_table
from app.decision import jev, rules


def _label(answer: dict[str, Any] | None) -> tuple[str | None, float | None]:
    if not answer:
        return None, None
    if answer.get("type") == "choice":
        label = answer.get("choice")
        return label, float(answer.get("probabilities", {}).get(label, answer.get("confidence", 0))) if label else None
    if answer.get("type") == "score":
        return str(answer.get("score")), float(answer.get("confidence", 0))
    if answer.get("type") == "noul":
        probability = float(answer["noul"])
        return "true" if probability >= 0.5 else "false", max(probability, 1 - probability)
    return None, None


def _log(session: Session, point: str, state: dict[str, Any], provider: str, answer: dict[str, Any] | None,
         model: str | None, status: str, as_of: datetime, error: str | None = None) -> None:
    label, confidence = _label(answer)
    payload = {"answer": answer, "error": error, "state": state}
    session.execute(insert(get_table("decision_log")).values(
        decision_id=str(uuid4()), created_at=as_of, provider=provider, point=point,
        state_hash=jev.state_hash(state, [point]), label=label, confidence=confidence,
        status=status, model=model, payload=json.dumps(payload, default=str),
    ))


def decide_many(session: Session, points: list[str], state: dict[str, Any], as_of: datetime) -> dict[str, dict[str, Any]]:
    provider = settings.decision_provider
    if provider not in {"jev", "rules", "shadow"}:
        raise ValueError("DECISION_PROVIDER must be jev, shadow, or rules")
    if provider == "rules":
        output = rules.decide_many(points, state)
        for point in points:
            _log(session, point, state, "rules", output["answers"][point], output["model"], "served", as_of)
        return {point: {"answer": output["answers"][point], "provider": "rules", "flag": None} for point in points}
    try:
        output = jev.decide_many(points, state)
        for point in points:
            _log(session, point, state, "jev", output["answers"][point], output["model"], "shadow" if provider == "shadow" else "served", as_of)
    except Exception as exc:
        error = f"{type(exc).__name__}: {str(exc)[:160]}"
        for point in points:
            _log(session, point, state, "jev", None, None, "error", as_of, error)
        if provider == "shadow" or settings.decision_on_error == "rules":
            output = rules.decide_many(points, state)
            flag = "shadow" if provider == "shadow" else "rules_fallback"
            for point in points:
                _log(session, point, state, "rules", output["answers"][point], output["model"], flag, as_of)
            return {point: {"answer": output["answers"][point], "provider": "rules", "flag": flag} for point in points}
        return {point: {"answer": None, "provider": "jev", "flag": "needs_review"} for point in points}
    if provider == "shadow":
        served = rules.decide_many(points, state)
        for point in points:
            _log(session, point, state, "rules", served["answers"][point], served["model"], "served", as_of)
        return {point: {"answer": served["answers"][point], "provider": "rules", "flag": "shadow"} for point in points}
    return {point: {"answer": output["answers"][point], "provider": "jev", "flag": None} for point in points}


def probability(decision: dict[str, Any]) -> float:
    return _label(decision.get("answer"))[1] or 0.0


def label(decision: dict[str, Any]) -> str | None:
    return _label(decision.get("answer"))[0]
