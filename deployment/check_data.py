"""Read-only check of database connectivity and stored dataset coverage."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import settings
from app.db import create_db_engine
from sqlalchemy import inspect, text

report = {"calendar_aligned": settings.replay_align_today, "database_configured": bool(settings.database_url), "tables": {}}
if settings.database_url:
    engine = create_db_engine(settings.database_url)
    try:
        with engine.connect() as connection:
            if engine.dialect.name == "postgresql":
                connection.execute(text("SET TRANSACTION READ ONLY"))
                connection.execute(text("SET LOCAL statement_timeout = '15s'"))
            available = set(inspect(connection).get_table_names())
            for name in ("location_dim", "energy_building_hourly", "water_hourly", "waste_hourly", "air_environment", "sustainability"):
                if name not in available:
                    report["tables"][name] = {"status": "missing"}
                    continue
                row = connection.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar_one()
                report["tables"][name] = {"rows": row}
                time_column = "date" if name == "sustainability" else "timestamp"
                if name != "location_dim":
                    first, last = connection.execute(text(f'SELECT MIN("{time_column}"), MAX("{time_column}") FROM "{name}"')).one()
                    report["tables"][name].update(first=str(first), last=str(last))
            connection.rollback()
            report["database_status"] = "connected"
    except Exception as error:
        # Never include connection strings, secrets or driver error text in output.
        report["database_status"] = "check_failed"
        report["error_type"] = type(error).__name__
    finally:
        engine.dispose()
print(json.dumps(report, indent=2))
