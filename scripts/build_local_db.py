"""Build an ignored local SQLite replay database for Windows development/smoke checks."""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, insert

from app.adapters.campus_a import CampusAAdapter, parse_scalar
from app.backbone.masters import build_master_rows
from app.db import get_metadata, get_table


def main() -> None:
    target = Path("sustainability.db")
    if target.exists():
        raise SystemExit("Local database already exists; refusing to overwrite it")
    engine = create_engine(f"sqlite+pysqlite:///{target.resolve().as_posix()}")
    adapter = CampusAAdapter()
    frames = adapter.extract()
    issues = adapter.validate_frames(frames)
    failed = {name: findings for name, findings in issues.items() if findings}
    if failed:
        raise SystemExit(f"Validation failed for {len(failed)} source tables")
    get_metadata().create_all(engine)
    count = 0
    for name, frame in frames.items():
        table = get_table(name)
        with engine.begin() as connection:
            for first in range(0, len(frame), 1000):
                batch = [{key: parse_scalar(value) for key, value in row.items()}
                         for row in frame.iloc[first:first + 1000].to_dict(orient="records")]
                if batch:
                    connection.execute(insert(table), batch)
                    count += len(batch)
    masters = build_master_rows(frames)
    with engine.begin() as connection:
        for name, rows in masters.items():
            if rows:
                connection.execute(insert(get_table(name)), rows)
    engine.dispose()
    print(f"Local replay ready: {len(frames)} domain tables, {count} source rows")


if __name__ == "__main__":
    main()
