"""Observe only the normalized snapshot at the selected replay boundary."""
from app.engine.snapshot import build_snapshot
def observe(session,node,as_of):
    return build_snapshot(node,as_of,session=session)
