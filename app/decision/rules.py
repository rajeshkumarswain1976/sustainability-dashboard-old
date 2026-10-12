"""Deterministic decision provider for shadow comparisons and fallback."""
from __future__ import annotations

from typing import Any
from app.decision.jev import catalogue


def _choice(label: str) -> dict[str, Any]:
    return {"type": "choice", "choice": label, "probabilities": {label: 1.0}, "confidence": 1.0}


def decide_many(points: list[str], state: dict[str, Any]) -> dict[str, Any]:
    candidate = state.get("candidate") or {}
    facts = candidate.get("facts") or {}
    context = candidate.get("context") or {}
    kind = candidate.get("type", "").removeprefix("predicted_")
    kind = {"energy_peak": "energy_spike"}.get(kind, kind)
    result = {}
    for point in points:
        if point == "triage.anomaly":
            label = "data_gap" if context.get("imputed_flag") and not facts.get("annotated_replay_event") else "expected_pattern" if context.get("is_holiday") and kind == "energy_spike" and not facts.get("annotated_replay_event") else "real_issue"
            result[point] = _choice(label)
        elif point == "alert.level":
            label = "Critical" if kind in {"safety_incident", "flood_risk", "heavy_rain"} else "Warning" if kind in {"water_leak", "bin_overflow", "energy_spike", "asset_risk"} else "Info"
            result[point] = _choice(label)
        elif point == "router.complexity":
            result[point] = _choice("routine")
        elif point == "owner.assign":
            owner = "Plumbing" if kind in {"water_leak", "tank_low"} else "Housekeeping" if kind.startswith("bin_") else "Security" if kind == "safety_incident" else "Facilities"
            result[point] = _choice(owner)
        elif point == "action.priority":
            score = 4.0 if kind in {"safety_incident", "flood_risk"} else 3.0 if kind in {"water_leak", "bin_overflow", "energy_spike"} else 2.0
            result[point] = {"type": "score", "score": score, "probabilities": {str(int(score)): 1.0}, "confidence": 1.0}
        elif point in {"complaint.cluster", "policy.applicability", "copilot.grounding"}:
            result[point] = {"type": "noul", "noul": 0.0}
        elif point == "incident.type":
            raw = str(state.get("incident", {}).get("incident_type", "other")).lower()
            label = raw if raw in catalogue()["decisions"][point]["options"] else "other"
            result[point] = _choice(label)
        elif point == "incident.severity":
            raw = str(state.get("incident", {}).get("severity", "medium")).lower()
            label = raw if raw in catalogue()["decisions"][point]["options"] else "medium"
            result[point] = _choice(label)
        elif point == "complaint.category":
            result[point] = _choice("other")
        elif point == "copilot.scope":
            result[point] = {"type": "noul", "noul": 0.0}
        else:
            raise KeyError(point)
    for point, answer in result.items():
        config = catalogue()["decisions"][point]
        if answer["type"] == "choice":
            answer["probabilities"] = {label: float(label == answer["choice"]) for label in config["options"]}
        elif answer["type"] == "score":
            answer["probabilities"] = {str(index): float(index == int(answer["score"])) for index in range(len(config["options"]))}
            answer["legend"] = {str(index): label for index, label in enumerate(config["options"])}
    return {"answers": result, "model": "rules-v1", "cached": False}
