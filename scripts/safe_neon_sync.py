"""Safely replace only imported campus dataset tables in the configured Neon DB.

Run --dry-run first. Sync requires a passing dataset validator, existing compatible
tables, and a PostgreSQL transaction that creates persistent table backups first.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import secrets
import sys
from datetime import date, datetime
from pathlib import Path

import pandas as pd
from sqlalchemy import delete, insert, inspect, select, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.adapters.campus_a import CampusAAdapter, TABLE_PRIMARY_KEYS, parse_scalar
from app.backbone.masters import build_master_rows
from app.db import DOMAIN_TABLES, MASTER_TABLES, _copy_frame, direct_engine, get_metadata, get_table
from app.config import settings
from scripts.validate_synthetic_datasets import validate_folder

DATA = settings.data_dir
MASTER_INPUTS = {"location_dim", "registry_buildings", "registry_floors", "registry_assets",
                 "registry_zones_climate", "registry_meters", "registry_tanks", "registry_bins"}


class PostSyncMismatch(RuntimeError):
    def __init__(self, results: dict[str, dict]):
        super().__init__("post-sync dataset validation failed; transaction rolled back")
        self.results = results


def csv_rows(path: Path) -> int:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        return max(sum(1 for _ in csv.reader(stream)) - 1, 0)


def master_rows() -> dict[str, list[dict]]:
    frames = {name: pd.read_csv(DATA / f"{name}.csv", low_memory=False) for name in MASTER_INPUTS}
    return build_master_rows(frames)


def plan() -> dict:
    adapter = CampusAAdapter(DATA)
    paths = adapter.table_paths()
    source = {name: {"file": path.relative_to(ROOT).as_posix(), "rows": csv_rows(path)}
              for name, path in paths.items()}
    masters = master_rows()
    target_counts = {**{name: value["rows"] for name, value in source.items()},
                     **{name: len(rows) for name, rows in masters.items()}}
    return {"source_files": source, "target_rows": target_counts,
            "target_tables": sorted(target_counts), "database_direct_configured": bool(settings.database_url_direct)}


def current_database_counts(engine, target_tables: list[str]) -> dict:
    available = set(inspect(engine).get_table_names())
    absent = sorted(set(target_tables) - available)
    if absent:
        raise RuntimeError("dataset target tables missing")
    quote = engine.dialect.identifier_preparer.quote
    result = {}
    with engine.connect() as connection:
        for name in target_tables:
            result[name] = int(connection.execute(text(f"SELECT COUNT(*) FROM {quote(name)}")).scalar_one())
    return result


def _time_bounds_csv(path: Path, column: str) -> tuple[pd.Timestamp | None, pd.Timestamp | None]:
    low = high = None
    for chunk in pd.read_csv(path, usecols=[column], chunksize=100_000):
        if column == "date":
            values = pd.to_datetime(chunk[column], errors="coerce").dt.tz_localize("Asia/Kolkata", ambiguous="NaT", nonexistent="NaT").dt.tz_convert("UTC").dropna()
        else:
            values = pd.to_datetime(chunk[column], errors="coerce", utc=True).dropna()
        if values.empty:
            continue
        first, last = values.min(), values.max()
        low = first if low is None or first < low else low
        high = last if high is None or last > high else high
    return low, high


def post_sync_check(bind, paths: dict[str, Path]) -> dict[str, dict]:
    """Validate row counts, keys and time bounds on an engine or active transaction."""
    quote = bind.dialect.identifier_preparer.quote
    results = {}
    owns_connection = hasattr(bind, "connect")
    connection = bind.connect() if owns_connection else bind
    try:
        for name, path in paths.items():
            table = get_table(name)
            keys = TABLE_PRIMARY_KEYS.get(name, ())
            count = int(connection.execute(text(f"SELECT COUNT(*) FROM {quote(name)}")).scalar_one())
            duplicates = 0
            if keys:
                key_sql = ", ".join(quote(key) for key in keys)
                duplicates = int(connection.execute(text(
                    f"SELECT COUNT(*) FROM (SELECT 1 FROM {quote(name)} GROUP BY {key_sql} HAVING COUNT(*) > 1) AS duplicate_keys"
                )).scalar_one())
            time_column = next((column for column in ("timestamp", "date", "timestamp_start", "due") if column in table.c), None)
            db_bounds = (None, None)
            file_bounds = (None, None)
            if time_column:
                db_bounds = connection.execute(text(
                    f"SELECT MIN({quote(time_column)}), MAX({quote(time_column)}) FROM {quote(name)}"
                )).one()
                file_bounds = _time_bounds_csv(path, time_column)
            def normalized(value):
                if value is None:
                    return None
                stamp = pd.Timestamp(value)
                if stamp.tzinfo is None:
                    stamp = stamp.tz_localize("Asia/Kolkata")
                return stamp.tz_convert("UTC").isoformat()
            csv_duplicates = pd.read_csv(path, usecols=list(keys), low_memory=False).duplicated(list(keys)).any() if keys else False
            passed = (count == csv_rows(path) and duplicates == 0 and not csv_duplicates and
                      normalized(db_bounds[0]) == normalized(file_bounds[0]) and
                      normalized(db_bounds[1]) == normalized(file_bounds[1]))
            results[name] = {"csv_rows": csv_rows(path), "database_rows": count,
                             "csv_duplicate_keys": bool(csv_duplicates), "database_duplicate_groups": duplicates,
                             "csv_min": normalized(file_bounds[0]), "db_min": normalized(db_bounds[0]),
                             "csv_max": normalized(file_bounds[1]), "db_max": normalized(db_bounds[1]),
                             "status": "pass" if passed else "mismatch"}
    finally:
        if owns_connection:
            connection.close()
    return results


def sync() -> dict:
    issues = validate_folder(DATA, strict=True)
    if issues:
        raise ValueError(f"dataset validation failed ({len(issues)} issues)")
    engine = direct_engine()
    if engine is None or engine.dialect.name != "postgresql":
        if engine is not None:
            engine.dispose()
        raise RuntimeError("direct PostgreSQL database is unavailable")
    adapter = CampusAAdapter(DATA)
    paths = adapter.table_paths()
    try:
        get_metadata()
        tables = sorted([*paths, *MASTER_TABLES.keys()])
        available = set(inspect(engine).get_table_names())
        if not set(tables).issubset(available):
            raise RuntimeError("one or more dataset tables are missing; schema creation is disabled")
        # Verify every destination has all source columns before opening the write transaction.
        inspector = inspect(engine)
        for name, path in paths.items():
            expected = set(pd.read_csv(path, nrows=0).columns)
            if name == "registry_emission_factors":
                expected.add("data_source")
            actual = {column["name"] for column in inspector.get_columns(name)}
            if expected != actual:
                raise RuntimeError("a dataset table has an incompatible schema")
        if not set(MASTER_TABLES).issubset(available):
            raise RuntimeError("one or more dataset master tables are missing")
        small_frames = {name: pd.read_csv(DATA / f"{name}.csv", low_memory=False) for name in MASTER_INPUTS}
        masters = build_master_rows(small_frames)
        backup_id = datetime.utcnow().strftime("%Y%m%d_%H%M%S") + "_" + secrets.token_hex(3)
        quote = engine.dialect.identifier_preparer.quote
        results = {}
        try:
            with engine.begin() as connection:
                # Persistent backups, replacements and validation share one transaction.
                # A failed post-sync check raises before commit and rolls everything back.
                for name in tables:
                    backup = f"{name}_bak_{backup_id}"
                    if not re.fullmatch(r"[a-z][a-z0-9_]*", backup) or len(backup) > 63:
                        raise RuntimeError("backup identifier is invalid")
                    connection.exec_driver_sql(
                        f"CREATE TABLE {quote(backup)} AS SELECT * FROM {quote(name)}"
                    )
                    original_rows = int(connection.execute(text(f"SELECT COUNT(*) FROM {quote(name)}")).scalar_one())
                    backup_rows = int(connection.execute(text(f"SELECT COUNT(*) FROM {quote(backup)}")).scalar_one())
                    if original_rows != backup_rows:
                        raise RuntimeError("a dataset table backup did not preserve its row count")
                for name, path in paths.items():
                    table = DOMAIN_TABLES[name]
                    connection.execute(delete(table))
                    frame = adapter.extract(name)
                    if name == "registry_emission_factors" and "data_source" not in frame:
                        frame["data_source"] = "synthetic_assumed"
                    raw = connection.connection
                    driver = getattr(raw, "driver_connection", raw)
                    _copy_frame(driver, name, list(frame.columns), frame)
                for name, rows in masters.items():
                    table = MASTER_TABLES[name]
                    connection.execute(delete(table))
                    if rows:
                        connection.execute(insert(table), rows)
                results = post_sync_check(connection, paths)
                if any(item["status"] != "pass" for item in results.values()):
                    raise PostSyncMismatch(results)
        except PostSyncMismatch as error:
            return {"status": "post_sync_mismatch", "tables": error.results, "backups": [], "rollback": "completed"}
        return {"status": "passed", "tables": results,
                "backups": [f"{name}_bak_{backup_id}" for name in tables]}
    finally:
        engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--sync", action="store_true")
    args = parser.parse_args()
    if args.sync == args.dry_run:
        parser.error("choose exactly one of --dry-run or --sync")
    try:
        if args.dry_run:
            report = plan()
            validation_issues = validate_folder(DATA, strict=True)
            report["dataset_validation"] = "passed" if not validation_issues else "failed"
            report["dataset_validation_issue_count"] = len(validation_issues)
            engine = direct_engine()
            if engine is None:
                report["database_status"] = "not_configured"
            else:
                try:
                    report["existing_target_rows"] = current_database_counts(engine, report["target_tables"])
                    report["database_status"] = "connected_read_only_preflight"
                except Exception as error:
                    report["database_status"] = "preflight_failed"
                    report["error_type"] = type(error).__name__
                finally:
                    engine.dispose()
        else:
            report = sync()
    except Exception as error:
        report = {"status": "blocked", "error_type": type(error).__name__}
    print(json.dumps(report, indent=2))
    if report.get("status") in {"blocked", "post_sync_mismatch"} or report.get("database_status") in {"preflight_failed", "not_configured"}:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
