from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from app.config import ROOT_DIR, settings


@lru_cache(maxsize=8)
def load_sector_config(sector: str | None = None) -> dict[str, Any]:
    selected = (sector or settings.sector).lower()
    path = ROOT_DIR / "config" / "sectors" / f"{selected}.yaml"
    if not path.is_file():
        raise KeyError(f"Unknown sector configuration: {selected}")
    content = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    content["sector"] = selected
    return content
