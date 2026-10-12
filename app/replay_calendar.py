"""Map the immutable dataset calendar onto today's IST calendar at query time."""
from datetime import datetime, timedelta
from functools import lru_cache
from zoneinfo import ZoneInfo
import pandas as pd
from app.config import settings

IST = ZoneInfo('Asia/Kolkata')


def now_ist() -> datetime:
    return datetime.now(IST)


@lru_cache(maxsize=4)
def _source_bounds(path: str, modified: int) -> tuple[datetime, datetime]:
    values = pd.to_datetime(pd.read_csv(path, usecols=['timestamp'])['timestamp'], utc=True).dt.tz_convert(IST)
    return values.min().to_pydatetime(), values.max().to_pydatetime()


def source_bounds() -> tuple[datetime, datetime]:
    path = settings.data_dir / 'energy_building_hourly.csv'
    return _source_bounds(str(path), path.stat().st_mtime_ns)


def offset() -> timedelta:
    if not settings.replay_align_today:
        return timedelta(0)
    return timedelta(days=(now_ist().date() - source_bounds()[1].date()).days)


def bounds() -> tuple[datetime, datetime]:
    first, last = source_bounds()
    shift = offset()
    return first + shift, last + shift


def payload() -> dict:
    first, last = bounds()
    return {'today': now_ist().date().isoformat(), 'timezone': 'Asia/Kolkata',
            'aligned_to_today': settings.replay_align_today, 'offset_days': offset().days,
            'start': first.isoformat(), 'end': last.isoformat(), 'as_of': now_ist().isoformat()}
