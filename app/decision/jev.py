"""The only Jev transport module.

Contract: https://docs.typesafe.ai/api and https://docs.typesafe.ai/models
"""
from __future__ import annotations

from copy import deepcopy
from threading import RLock
import math
import hashlib
import json
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
import yaml

from app.config import ROOT_DIR, settings

JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone"
JEV_MODEL = "jev-1.13.0"
_cache: dict[str, dict[str, Any]] = {}
_cache_lock = RLock()


@lru_cache(maxsize=1)
def catalogue() -> dict[str, Any]:
    return yaml.safe_load((ROOT_DIR / "config" / "decisions.yaml").read_text(encoding="utf-8"))


def question(point: str) -> dict[str, Any]:
    config = catalogue()["decisions"][point]
    kind = config["kind"]
    item: dict[str, Any] = {"type": {"yesno": "noul"}.get(kind, kind), "instructions": config["question"]}
    if kind == "choice":
        item["criteria"] = config["options"]
    elif kind == "score":
        item["criteria"] = config["options"]
    return item


def state_hash(state: dict[str, Any], points: list[str]) -> str:
    encoded = json.dumps({"state": state, "points": sorted(points), "model": JEV_MODEL}, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(encoded.encode()).hexdigest()


def request_state(points: list[str], state: dict[str, Any]) -> dict[str, Any]:
    """Only send the catalogue's decision fields; retain actual forecast extrema."""
    fields = {field for point in points for field in catalogue()["decisions"][point]["state_fields"]}
    def compact(value):
        if isinstance(value, dict):
            output = {key: compact(item) for key, item in value.items()}
            series = value.get("series")
            if isinstance(series, list) and len(series) > 4:
                finite = [item for item in series if isinstance(item, dict) and isinstance(item.get("value"), (int, float)) and math.isfinite(item["value"])]
                chosen = [series[0], series[-1]]
                if finite:
                    chosen.extend([min(finite, key=lambda item: item["value"]), max(finite, key=lambda item: item["value"])])
                output["series"] = sorted({json.dumps(item, sort_keys=True, default=str): item for item in chosen}.values(), key=lambda item: str(item.get("timestamp", "")))
                output["series_point_count"] = len(series)
                output["series_selection"] = "observed forecast endpoints and extrema; intermediate points omitted"
            return output
        if isinstance(value, list):
            return [compact(item) for item in value]
        return value
    projected = {key: compact(value) for key, value in state.items() if key in fields}
    candidate = state.get("candidate") or {}
    domain = candidate.get("domain")
    entity = str(candidate.get("node", ""))
    if isinstance(projected.get("forecasts"), dict) and domain:
        wanted = {domain, "parking" if domain == "mobility" else domain, "weather"}
        if any(float(row.get("rainfall") or 0) > 0 for row in state.get("weather", []) if isinstance(row, dict)):
            wanted.add("climate")
        for alert in state.get("open_alerts", []):
            if isinstance(alert, dict) and alert.get("node") == entity:
                wanted.add(alert.get("domain"))
        filtered = {}
        for name, forecast in projected["forecasts"].items():
            if name not in wanted or not isinstance(forecast, dict):
                continue
            forecast = dict(forecast)
            entities = forecast.get("forecasts")
            if isinstance(entities, list):
                matching = [item for item in entities if str(item.get("entity_id")) in {entity, str(state.get("node"))}]
                forecast["forecasts"] = matching or entities[:1]
                forecast["entity_count"] = len(entities)
                forecast["entity_selection"] = "candidate/facility entities; otherwise first available source entity"
            forecast.pop("floor_forecasts", None)
            filtered[name] = forecast
        projected["forecasts"] = filtered
    if isinstance(projected.get("open_alerts"), list):
        alerts = projected["open_alerts"]
        ordered = sorted(alerts, key=lambda alert: (alert.get("node") != entity, alert.get("domain") != domain, alert.get("level") != "Critical"))
        projected["open_alerts"] = [{key: alert.get(key) for key in ("alert_key", "node", "domain", "type", "level", "status", "confidence")} for alert in ordered[:10]]
    # UTF-8 bytes provide a conservative bound without a remote tokenizer or
    # guessing the provider's tokenization. Never ship an oversized snapshot.
    if len(json.dumps(projected, default=str).encode("utf-8")) > 24000:
        projected.pop("forecasts", None)
        projected["context"] = {**projected.get("context", {}), "forecast_context_omitted": "request budget exceeded; no values substituted"}
    if len(json.dumps(projected, default=str).encode("utf-8")) > 28000:
        raise ValueError("Normalized Jev input exceeds the safe request budget")
    return projected


def _decide_many(points: list[str], state: dict[str, Any]) -> dict[str, Any]:
    if not settings.jev_api_key:
        raise RuntimeError("JEV_API_KEY is not configured")
    if len(points) > 20:
        raise ValueError("Jev supports at most 20 questions per request")
    key = state_hash(state, points)
    if key in _cache:
        return {**deepcopy(_cache[key]), "cached": True}
    body = {"model": JEV_MODEL, "state": request_state(points, state), "questions": {point: question(point) for point in points}}
    endpoint = (settings.jev_base_url or JEV_ENDPOINT).rstrip("/")
    if not endpoint.endswith("/v1/systemone"):
        endpoint += "/v1/systemone"
    # One initial attempt and two retries. Never retry invalid credentials or schema.
    with httpx.Client(timeout=8.0) as client:
        for attempt in range(3):
            try:
                response = client.post(endpoint, json=body, headers={"Authorization": f"Bearer {settings.jev_api_key}"})
                if 400 <= response.status_code < 500 and response.status_code != 429:
                    try:
                        details = response.json()
                        error = details.get("error", details)
                        message = error.get("message", error.get("detail", error.get("code", ""))) if isinstance(error, dict) else str(error)
                    except (ValueError, AttributeError):
                        message = "Provider rejected the request"
                    raise RuntimeError(f"Jev rejected request: HTTP {response.status_code}: {str(message)[:300]}")
                response.raise_for_status()
                payload = response.json()
                answers = payload["answers"]
                if not isinstance(answers, dict) or any(point not in answers for point in points):
                    raise ValueError("Jev response omitted a requested answer")
                if payload.get("model") != JEV_MODEL:
                    raise ValueError("Jev response used an unexpected model version")
                for point in points:
                    validate_answer(point, answers[point])
                if len(_cache) >= 1024:
                    _cache.pop(next(iter(_cache)))
                result = {"answers": deepcopy(answers), "model": payload["model"]}
                _cache[key] = result
                return {**deepcopy(result), "cached": False}
            except (httpx.TimeoutException, httpx.TransportError, httpx.HTTPStatusError):
                if attempt == 2:
                    raise
                time.sleep(0.1 * (2 ** attempt))
    raise RuntimeError("Jev did not return a decision")


def validate_answer(point: str, answer: dict[str, Any]) -> None:
    config = catalogue()["decisions"][point]
    expected = {"yesno": "noul"}.get(config["kind"], config["kind"])
    if not isinstance(answer, dict) or answer.get("type") != expected:
        raise ValueError("Jev answer type does not match its question")
    def numeric(value):
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
    if expected == "noul":
        if not numeric(answer.get("noul")) or not 0 <= answer["noul"] <= 1:
            raise ValueError("Invalid Jev yes/no probability")
        return
    probabilities = answer.get("probabilities")
    confidence = answer.get("confidence")
    if not numeric(confidence) or not 0 <= confidence <= 1:
        raise ValueError("Invalid Jev confidence")
    allowed = set(config["options"]) if expected == "choice" else {str(index) for index in range(len(config["options"]))}
    if not isinstance(probabilities, dict) or set(probabilities) != allowed:
        raise ValueError("Jev probability options do not match the question")
    if any(not numeric(value) or not 0 <= value <= 1 for value in probabilities.values()) or not math.isclose(sum(probabilities.values()), 1.0, abs_tol=0.001):
        raise ValueError("Invalid Jev probability distribution")
    if expected == "choice" and answer.get("choice") not in allowed:
        raise ValueError("Jev returned an unknown choice")
    if expected == "score" and (not numeric(answer.get("score")) or not 0 <= answer["score"] <= len(allowed) - 1):
        raise ValueError("Jev score is outside its rubric")


def decide_many(points: list[str], state: dict[str, Any]) -> dict[str, Any]:
    # Serialize cache misses so concurrent identical states issue one request.
    with _cache_lock:
        return _decide_many(points, state)


def clear_cache() -> None:
    _cache.clear()
