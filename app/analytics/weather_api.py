"""Current Delhi weather forecasts; historical replay never fetches today's forecast."""
from datetime import datetime, timedelta
from threading import Lock
import math
import httpx
import pandas as pd
from app.config import settings
from app import replay_calendar

_cache = {}
_lock = Lock()
VARIABLES = {'temperature': 'temperature_2m', 'humidity': 'relative_humidity_2m',
             'rainfall': 'precipitation', 'wind_speed': 'wind_speed_10m'}


def forecast(as_of: datetime, horizon_hours: int) -> pd.DataFrame | None:
    if not settings.weather_forecast_enabled:
        return None
    current = replay_calendar.now_ist()
    as_of = as_of.replace(tzinfo=replay_calendar.IST) if as_of.tzinfo is None else as_of.astimezone(replay_calendar.IST)
    # A current API response cannot supply an issue-time forecast for a past replay.
    if as_of < current - timedelta(minutes=2):
        return None
    key = (settings.weather_latitude, settings.weather_longitude, current.date(), current.hour, current.minute // 15)
    with _lock:
        entry = _cache.get(key)
        if entry is None:
            try:
                response = httpx.get('https://api.open-meteo.com/v1/forecast', params={
                    'latitude': settings.weather_latitude, 'longitude': settings.weather_longitude,
                    'hourly': ','.join(VARIABLES.values()), 'timezone': 'Asia/Kolkata',
                    'wind_speed_unit': 'ms', 'forecast_days': 9}, timeout=5.0)
                response.raise_for_status()
                hourly = response.json()['hourly']
                times = pd.DatetimeIndex(pd.to_datetime(hourly['time'])).tz_localize(replay_calendar.IST)
                values = pd.DataFrame({metric: hourly[source] for metric, source in VARIABLES.items()}, index=times)
                values = values.apply(pd.to_numeric, errors='coerce')
                if not all(math.isfinite(float(value)) for value in values.to_numpy().flat):
                    raise ValueError('Invalid weather forecast values')
                values['humidity'] = values['humidity'].clip(0, 100)
                values['rainfall'] = values['rainfall'].clip(lower=0)
                values['wind_speed'] = values['wind_speed'].clip(lower=0)
                entry = (values, replay_calendar.now_ist())
            except (httpx.HTTPError, KeyError, ValueError, TypeError):
                entry = (None, current)
            if len(_cache) >= 16:
                _cache.pop(next(iter(_cache)))
            _cache[key] = entry
    values, fetched_at = entry
    if values is None:
        return None
    cutoff = as_of.replace(minute=0, second=0, microsecond=0)
    expected = pd.date_range(cutoff + timedelta(hours=1), periods=horizon_hours, freq='h')
    if not expected.isin(values.index).all():
        return None
    result = values.loc[expected].copy()
    result.attrs.update(provider='open-meteo', issued_at=fetched_at.isoformat(), classification='api_weather_forecast')
    return result
