from __future__ import annotations

from functools import lru_cache
from copy import deepcopy
from datetime import date
from pathlib import Path
from typing import Any

import yaml

from app.config import ROOT_DIR, settings
from app import replay_calendar


@lru_cache(maxsize=8)
def _load_sector_config(sector: str | None = None) -> dict[str, Any]:
    selected = (sector or settings.sector).lower()
    path = ROOT_DIR / "config" / "sectors" / f"{selected}.yaml"
    if not path.is_file():
        raise KeyError(f"Unknown sector configuration: {selected}")
    content = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    content["sector"] = selected
    return content


def load_sector_config(sector: str | None = None) -> dict[str, Any]:
    content = deepcopy(_load_sector_config(sector))
    shift = replay_calendar.offset()
    if shift.days:
        content["holidays"] = [(date.fromisoformat(str(day)) + shift).isoformat()
                               for day in content.get("holidays", [])]
    return content
