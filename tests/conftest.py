"""Keep reference replay fixtures on their original calendar and prohibit real weather HTTP in tests."""
from dataclasses import replace
import pytest
from app import replay_calendar
from app.analytics import weather_api


@pytest.fixture(autouse=True)
def reference_calendar(monkeypatch):
    monkeypatch.setattr(replay_calendar, 'settings', replace(replay_calendar.settings, replay_align_today=False))
    monkeypatch.setattr(weather_api, 'settings', replace(weather_api.settings, weather_forecast_enabled=False))
