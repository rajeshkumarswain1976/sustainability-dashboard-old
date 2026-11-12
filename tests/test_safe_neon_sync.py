from datetime import datetime

from sqlalchemy import Column, DateTime, MetaData, String, Table, create_engine, insert, select

import scripts.safe_neon_sync as sync


def test_post_sync_check_can_run_inside_open_transaction(tmp_path, monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    metadata = MetaData()
    table = Table("test_dataset", metadata,
                  Column("record_id", String, primary_key=True),
                  Column("timestamp", DateTime(timezone=True)))
    metadata.create_all(engine)
    source = tmp_path / "test_dataset.csv"
    source.write_text(
        "record_id,timestamp\nr1,2026-11-10T01:00:00+05:30\nr2,2026-11-10T02:00:00+05:30\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(sync, "get_table", lambda _name: table)
    monkeypatch.setitem(sync.TABLE_PRIMARY_KEYS, "test_dataset", ("record_id",))

    with engine.begin() as connection:
        connection.execute(insert(table), [
            {"record_id": "r1", "timestamp": datetime.fromisoformat("2026-11-10T01:00:00+05:30")},
            {"record_id": "r2", "timestamp": datetime.fromisoformat("2026-11-10T02:00:00+05:30")},
        ])
        checked = sync.post_sync_check(connection, {"test_dataset": source})
        assert checked["test_dataset"]["status"] == "pass"
        assert connection.execute(select(table.c.record_id)).all()

    engine.dispose()
