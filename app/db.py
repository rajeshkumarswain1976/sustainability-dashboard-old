from __future__ import annotations

import csv
import io
from itertools import islice
import math
import re
import sys
import time
from threading import RLock
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import (
    JSON, DateTime, Float, Index, Integer, MetaData, String, Table, Column, create_engine,
    delete, insert, select, text,
)
from sqlalchemy.engine import Engine, URL, make_url
from sqlalchemy.orm import Session, sessionmaker

from app.adapters.campus_a import CampusAAdapter, DATETIME_COLUMNS, parse_scalar
from app.backbone.masters import build_master_rows
from app.config import settings

metadata = MetaData()
_metadata_lock = RLock()
DOMAIN_TABLES: dict[str, Table] = {}
MASTER_TABLES: dict[str, Table] = {}


def _sample_columns(path: Path) -> tuple[list[str], dict[str, list[str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = reader.fieldnames or []
        samples: dict[str, list[str]] = {name: [] for name in columns}
        for idx, row in enumerate(reader):
            if idx >= 250:
                break
            for name in columns:
                value = (row.get(name) or "").strip()
                if value:
                    samples[name].append(value)
    if path.stem == "registry_emission_factors" and "data_source" not in columns:
        columns.append("data_source")
        samples["data_source"] = []
    return columns, samples


def _column_type(name: str, values: list[str]) -> Any:
    key = name.lower()
    if (
        key == "date" or key.endswith("_date") or key in DATETIME_COLUMNS
        or key == "timestamp" or key.startswith("timestamp_") or key.endswith("_timestamp")
    ):
        return DateTime(timezone=True)
    if key.endswith("_id") or key in {"node_id", "parent_id", "factor_name", "factor_version"}:
        return String(160)
    numeric: list[float] = []
    for value in values:
        try:
            number = float(value)
        except ValueError:
            return String(500)
        if not math.isfinite(number):
            continue
        numeric.append(number)
    if not numeric:
        return String(500)
    # Lexical integer checks avoid inferring INTEGER for values such as "1.0".
    if all(re.fullmatch(r"[+-]?\d+", value) for value in values):
        return Integer()
    return Float()


def _add_domain_tables() -> None:
    if DOMAIN_TABLES:
        return
    for name, path in CampusAAdapter().table_paths().items():
        if not re.fullmatch(r"[a-z][a-z0-9_]*", name):
            raise ValueError("A source table name is not a safe SQL identifier")
        columns, samples = _sample_columns(path)
        table_columns = [Column(column, _column_type(column, samples[column]), nullable=True) for column in columns]
        table = Table(name, metadata, *table_columns)
        for indexed in ("timestamp", "building_id", "floor_id", "zone_id", "meter_id", "bin_id", "asset_id"):
            if indexed in table.c:
                Index(f"ix_{name}_{indexed}", table.c[indexed])
        DOMAIN_TABLES[name] = table


def _add_master_tables() -> None:
    if MASTER_TABLES:
        return
    definitions = {
        "facility": [Column("facility_id", String(100), primary_key=True), Column("name", String(200), nullable=False), Column("sector", String(60), nullable=False)],
        "zone": [Column("zone_id", String(100), primary_key=True), Column("facility_id", String(100)), Column("label", String(200))],
        "building": [Column("building_id", String(100), primary_key=True), Column("facility_id", String(100)), Column("zone_id", String(100)), Column("label", String(200))],
        "floor": [Column("floor_id", String(100), primary_key=True), Column("building_id", String(100)), Column("facility_id", String(100)), Column("zone_id", String(100)), Column("floor_use", String(100))],
        "asset": [Column("asset_id", String(100), primary_key=True), Column("asset_type", String(100)), Column("facility_id", String(100)), Column("zone_id", String(100)), Column("building_id", String(100)), Column("floor_id", String(100))],
        "sensor": [Column("sensor_id", String(200), primary_key=True), Column("sensor_type", String(100)), Column("facility_id", String(100)), Column("zone_id", String(100)), Column("building_id", String(100)), Column("floor_id", String(100)), Column("source_id", String(100))],
    }
    for name, columns in definitions.items():
        MASTER_TABLES[name] = Table(name, metadata, *columns)


def _add_operational_tables() -> None:
    timestamp = DateTime(timezone=True)
    definitions = {
        "alerts": [Column("alert_id", String(100), primary_key=True),
                   Column("alert_key", String(255)), Column("created_at", timestamp),
                   Column("node_id", String(100)), Column("domain", String(80)), Column("type", String(80)),
                   Column("level", String(40)), Column("status", String(40)), Column("confidence", Float),
                   Column("facts", JSON), Column("severity", String(40)), Column("payload", String)],
        "actions": [Column("action_id", String(100), primary_key=True), Column("created_at", timestamp), Column("node_id", String(100)), Column("status", String(40)), Column("payload", String),
                    Column("alert_key", String(255)), Column("type", String(80)), Column("text", String), Column("saving_inr", Float), Column("saving_co2e", Float),
                    Column("priority", Float), Column("owner", String(80)), Column("needs_head_approval", Integer), Column("source", String(40))],
        "decision_log": [Column("decision_id", String(100), primary_key=True), Column("created_at", timestamp), Column("provider", String(40)), Column("payload", String),
                         Column("point", String(100)), Column("state_hash", String(64)), Column("label", String(100)), Column("confidence", Float),
                         Column("status", String(40)), Column("model", String(100))],
        "replay_state": [Column("state_id", String(100), primary_key=True), Column("as_of", timestamp), Column("payload", String)],
        "copilot_log": [Column("log_id", String(100), primary_key=True), Column("created_at", timestamp), Column("payload", String)],
        "weekly_summaries": [Column("summary_id", String(100), primary_key=True), Column("week_start", timestamp), Column("node_id", String(100)), Column("payload", String)],
        "complaints": [Column("complaint_id", String(100), primary_key=True), Column("created_at", timestamp), Column("node_id", String(100)), Column("status", String(40)), Column("payload", String)],
        "knowledge_chunks": [Column("chunk_id", String(100), primary_key=True), Column("sector", String(80)), Column("document_id", String(160)), Column("content", String), Column("metadata_json", String)],
        "forecast_models": [Column("model_id", String(100), primary_key=True), Column("target", String(80), nullable=False),
                            Column("trained_at", timestamp, nullable=False), Column("train_end", timestamp, nullable=False),
                            Column("params", JSON)],
        "forecasts": [Column("forecast_id", String(160), primary_key=True), Column("target", String(80), nullable=False),
                      Column("entity", String(80), nullable=False), Column("issued_at", timestamp, nullable=False),
                      Column("ts", timestamp, nullable=False), Column("yhat", Float, nullable=False),
                      Column("lo", Float, nullable=False), Column("hi", Float, nullable=False),
                      Column("method", String(40), nullable=False), Column("served_model", String(80), nullable=False)],
        "forecast_accuracy": [Column("accuracy_id", String(120), primary_key=True), Column("target", String(80), nullable=False),
                              Column("fold", Integer, nullable=False), Column("mae", Float, nullable=False),
                              Column("smape", Float, nullable=False), Column("baseline_mae", Float, nullable=False),
                              Column("band_coverage", Float, nullable=False)],
    }
    for name, columns in definitions.items():
        if name not in metadata.tables:
            Table(name, metadata, *columns)
    if "ix_alerts_alert_key" not in {index.name for index in metadata.tables["alerts"].indexes}:
        Index("ix_alerts_alert_key", metadata.tables["alerts"].c.alert_key, unique=True)
    if "forecasts" in metadata.tables and "ix_forecasts_lookup" not in {index.name for index in metadata.tables["forecasts"].indexes}:
        Index("ix_forecasts_lookup", metadata.tables["forecasts"].c.target, metadata.tables["forecasts"].c.entity, metadata.tables["forecasts"].c.issued_at)


def ensure_forecast_tables(bind) -> None:
    """Ensure forecast operational tables exist idempotently."""
    get_metadata()
    for name in ("forecast_models", "forecasts", "forecast_accuracy"):
        table = metadata.tables.get(name)
        if table is not None:
            table.create(bind, checkfirst=True)


def get_metadata() -> MetaData:
    # FastAPI handles simultaneous first requests in worker threads.
    with _metadata_lock:
        _add_domain_tables()
        _add_master_tables()
        _add_operational_tables()
    return metadata


def get_table(name: str) -> Table | None:
    get_metadata()
    return metadata.tables.get(name)


def _postgres_url(value: str) -> URL:
    url = make_url(value)
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+psycopg")
    if url.drivername.startswith("postgresql"):
        query = dict(url.query)
        query.setdefault("sslmode", "require")
        url = url.set(query=query)
    return url


def create_db_engine(url_value: str, *, pool_size: int = 5) -> Engine:
    url = _postgres_url(url_value)
    kwargs: dict[str, Any] = {
        "pool_pre_ping": True,
        "pool_recycle": 240,
        "pool_size": pool_size,
        "max_overflow": 2,
        "pool_timeout": 15,
        "future": True,
    }
    if url.drivername.startswith("postgresql"):
        kwargs["connect_args"] = {"connect_timeout": 10}
    return create_engine(url, **kwargs)


@lru_cache(maxsize=1)
def runtime_engine() -> Engine | None:
    return create_db_engine(settings.database_url) if settings.database_url else None


@lru_cache(maxsize=1)
def direct_engine() -> Engine | None:
    return create_db_engine(settings.database_url_direct) if settings.database_url_direct else None


def connect_with_retry(engine: Engine, attempts: int = 3, delay_seconds: float = 0.5):
    """Reconnect after a suspended/idle database, without logging credentials."""
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            return engine.connect()
        except Exception as exc:  # connection errors vary by driver
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(delay_seconds * (attempt + 1))
    if last_error:
        raise last_error
    raise RuntimeError("Database connection did not start")


def get_session():
    engine = runtime_engine()
    if engine is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Database is not configured")
    factory = sessionmaker(engine, class_=Session, expire_on_commit=False)
    with factory() as session:
        yield session


def check_database() -> bool | None:
    engine = runtime_engine()
    if engine is None:
        return None
    with connect_with_retry(engine) as connection:
        connection.execute(text("SELECT 1"))
    return True


def create_schema() -> None:
    engine = direct_engine()
    if engine is None:
        raise RuntimeError("DATABASE_URL_DIRECT is required for schema operations")
    get_metadata().create_all(engine)
    _upgrade_operational_schema(engine)


def _upgrade_operational_schema(engine: Engine) -> None:
    """Add operational fields without replacing existing rows."""
    get_metadata()
    with engine.begin() as connection:
        quote = engine.dialect.identifier_preparer.quote
        for name in ("alerts", "actions", "decision_log"):
            present = set(connection.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = :name"
            ), {"name": name}).scalars())
            for column in metadata.tables[name].columns:
                if column.name not in present:
                    connection.exec_driver_sql(
                        f"ALTER TABLE {quote(name)} ADD COLUMN {quote(column.name)} {column.type.compile(dialect=engine.dialect)}"
                    )
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_alerts_alert_key ON alerts (alert_key)"
        )


def _upgrade_numeric_types(engine: Engine) -> None:
    """Apply additive source-schema changes and widen columns that now infer FLOAT."""
    quote = engine.dialect.identifier_preparer.quote
    with engine.begin() as connection:
        rows = connection.execute(
            text(
                "SELECT table_name, column_name, data_type "
                "FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = ANY(:names)"
            ),
            {"names": list(DOMAIN_TABLES)},
        ).all()
        existing_tables: dict[str, dict[str, str]] = {}
        for table_name, column_name, data_type in rows:
            existing_tables.setdefault(table_name, {})[column_name] = data_type
        empty_tables: dict[str, bool] = {}
        for table_name, table in DOMAIN_TABLES.items():
            existing = existing_tables.get(table_name, {})
            alterations: list[str] = []
            table_sql = quote(table_name)
            for column in table.columns:
                previous = existing.get(column.name)
                column_sql = quote(column.name)
                if previous is None:
                    type_sql = column.type.compile(dialect=engine.dialect)
                    alterations.append(f"ADD COLUMN {column_sql} {type_sql}")
                elif isinstance(column.type, Float) and previous in {"smallint", "integer", "bigint"}:
                    alterations.append(
                        f"ALTER COLUMN {column_sql} TYPE DOUBLE PRECISION "
                        f"USING {column_sql}::DOUBLE PRECISION"
                    )
                elif isinstance(column.type, Float) and previous in {
                    "timestamp without time zone", "timestamp with time zone"
                }:
                    if table_name not in empty_tables:
                        empty_tables[table_name] = not connection.execute(
                            text(f"SELECT EXISTS (SELECT 1 FROM {table_sql} LIMIT 1)")
                        ).scalar_one()
                    if not empty_tables[table_name]:
                        raise RuntimeError(
                            f"Cannot safely change {table_name}.{column.name} while the table contains rows"
                        )
                    alterations.append(
                        f"ALTER COLUMN {column_sql} TYPE DOUBLE PRECISION USING NULL::DOUBLE PRECISION"
                    )
            if alterations:
                connection.exec_driver_sql(f"ALTER TABLE {table_sql} " + ", ".join(alterations))


def _copy_value(value: Any) -> str:
    parsed = parse_scalar(value)
    if parsed is None:
        return ""
    if hasattr(parsed, "isoformat"):
        return parsed.isoformat(sep=" ") if hasattr(parsed, "hour") else parsed.isoformat()
    if isinstance(parsed, float) and not math.isfinite(parsed):
        return ""
    return str(parsed)


def _copy_frame(driver_connection: Any, table_name: str, columns: list[str], frame: pd.DataFrame) -> None:
    import psycopg
    from psycopg import sql

    statement = sql.SQL("COPY {} ({}) FROM STDIN WITH (FORMAT CSV, NULL '')").format(
        sql.Identifier(table_name), sql.SQL(", ").join(sql.Identifier(column) for column in columns),
    )
    with driver_connection.cursor() as cursor:
        with cursor.copy(statement) as copy:
            buffer = io.StringIO()
            writer = csv.writer(buffer, lineterminator="\n")
            rows = iter(frame[columns].itertuples(index=False, name=None))
            while batch := list(islice(rows, 5000)):
                writer.writerows([_copy_value(value) for value in values] for values in batch)
                copy.write(buffer.getvalue())
                buffer.seek(0)
                buffer.truncate(0)


def reload_data() -> dict[str, int]:
    """Create schema and bulk reload source domain tables through the direct URL."""
    engine = direct_engine()
    if engine is None:
        raise RuntimeError("DATABASE_URL_DIRECT is required for reloads")
    adapter = CampusAAdapter()
    frames = adapter.extract()
    validations = adapter.validate_frames(frames)
    failures = {name: issues for name, issues in validations.items() if issues}
    if failures:
        raise ValueError(f"Input validation failed for {len(failures)} tables")
    get_metadata().create_all(engine)
    _upgrade_numeric_types(engine)
    _upgrade_operational_schema(engine)
    counts: dict[str, int] = {}
    with engine.begin() as connection:
        for name, frame in frames.items():
            table = DOMAIN_TABLES[name]
            connection.execute(delete(table))
            raw = connection.connection
            driver_connection = getattr(raw, "driver_connection", raw)
            _copy_frame(driver_connection, name, list(frame.columns), frame)
            counts[name] = len(frame)
        masters = build_master_rows(frames)
        for name, rows in masters.items():
            table = MASTER_TABLES[name]
            connection.execute(delete(table))
            if rows:
                connection.execute(insert(table), rows)
    adapter.write_provenance()
    return counts


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "reload":
        result = reload_data()
        print(f"Reload completed: {len(result)} domain tables, {sum(result.values())} rows")
    elif command == "schema":
        create_schema()
        print("Schema is ready")
    else:
        print("Usage: python -m app.db [schema|reload]")
