"""The only Jev transport module.

Contract: https://docs.typesafe.ai/api and https://docs.typesafe.ai/models
"""
from __future__ import annotations

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


def decide_many(points: list[str], state: dict[str, Any]) -> dict[str, Any]:
    if not settings.jev_api_key:
        raise RuntimeError("JEV_API_KEY is not configured")
    if len(points) > 20:
        raise ValueError("Jev supports at most 20 questions per request")
    key = state_hash(state, points)
    if key in _cache:
        return {"answers": _cache[key]["answers"], "model": _cache[key]["model"], "cached": True}
    body = {"model": JEV_MODEL, "state": state, "questions": {point: question(point) for point in points}}
    endpoint = (settings.jev_base_url or JEV_ENDPOINT).rstrip("/")
    if not endpoint.endswith("/v1/systemone"):
        endpoint += "/v1/systemone"
    # One initial attempt and two retries. Never retry invalid credentials or schema.
    with httpx.Client(timeout=2.0) as client:
        for attempt in range(3):
            try:
                response = client.post(endpoint, json=body, headers={"Authorization": f"Bearer {settings.jev_api_key}"})
                if response.status_code in {401, 403, 422}:
                    raise RuntimeError(f"Jev rejected request: HTTP {response.status_code}")
                response.raise_for_status()
                payload = response.json()
                answers = payload["answers"]
                if not isinstance(answers, dict) or any(point not in answers for point in points):
                    raise ValueError("Jev response omitted a requested answer")
                result = {"answers": answers, "model": payload["model"]}
                _cache[key] = result
                return {**result, "cached": False}
            except (httpx.TimeoutException, httpx.TransportError, httpx.HTTPStatusError):
                if attempt == 2:
                    raise
                time.sleep(0.1 * (2 ** attempt))
    raise RuntimeError("Jev did not return a decision")


def clear_cache() -> None:
    _cache.clear()
