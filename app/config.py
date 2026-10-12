from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    database_url: str | None = os.getenv("DATABASE_URL")
    database_url_direct: str | None = os.getenv("DATABASE_URL_DIRECT")
    test_database_url: str | None = os.getenv("TEST_DATABASE_URL")
    data_dir_value: str = os.getenv("DATA_DIR", "generated_v3")
    timezone: str = os.getenv("TZ", "Asia/Kolkata")
    sector: str = os.getenv("SECTOR", "college").strip().lower()
    tariff_inr_per_kwh: float = float(os.getenv("TARIFF_INR_PER_KWH", "8"))
    grid_ef: float = float(os.getenv("GRID_EF", "0.716"))
    water_tariff_inr_per_kl: float = float(os.getenv("WATER_TARIFF_INR_PER_KL", "40"))
    groq_api_key: str | None = os.getenv("GROQ_API_KEY")
    groq_model: str | None = os.getenv("GROQ_MODEL")
    jev_api_key: str | None = os.getenv("JEV_API_KEY")
    jev_base_url: str | None = os.getenv("JEV_BASE_URL")
    jev_model: str | None = os.getenv("JEV_MODEL")
    decision_provider: str = os.getenv("DECISION_PROVIDER", "jev").strip().lower()
    decision_on_error: str = os.getenv("DECISION_ON_ERROR", "needs_review").strip().lower()
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

    @property
    def data_dir(self) -> Path:
        configured = Path(self.data_dir_value)
        if not configured.is_absolute():
            configured = ROOT_DIR / configured
        if configured.exists():
            return configured
        # The repository checkout already contains the generated source tables.
        # The documented generated_v3 path takes precedence when it exists.
        if self.data_dir_value == "generated_v3":
            fallback = ROOT_DIR / "datasets"
            if fallback.exists():
                return fallback
        return configured

    @property
    def provenance_dir(self) -> Path:
        return ROOT_DIR / "private"


settings = Settings()
