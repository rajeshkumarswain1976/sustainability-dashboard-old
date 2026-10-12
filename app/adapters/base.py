from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import pandas as pd


class DataAdapter(ABC):
    """Contract for extracting source tables and recording private provenance."""

    @abstractmethod
    def extract(self, table: str | None = None) -> dict[str, pd.DataFrame] | pd.DataFrame:
        raise NotImplementedError

    @abstractmethod
    def validate(self, table: str | None = None) -> dict[str, list[str]]:
        raise NotImplementedError

    @abstractmethod
    def provenance(self) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def write_provenance(self, destination: Path) -> Path:
        raise NotImplementedError
