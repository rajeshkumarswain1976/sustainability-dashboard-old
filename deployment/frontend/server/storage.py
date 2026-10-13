"""Additive operational tables; source-domain tables remain untouched."""
from datetime import datetime,timezone
from uuid import uuid4
import json
from sqlalchemy import Table, Column, String, DateTime, Index, insert
from app.db import get_metadata

def tables():
    metadata = get_metadata()
    if 'complaint_events' not in metadata.tables:
        table = Table('complaint_events', metadata,
            Column('event_id', String(100), primary_key=True),
            Column('complaint_id', String(100), nullable=False),
            Column('created_at', DateTime(timezone=True), nullable=False),
            Column('actor_role', String(20), nullable=False),
            Column('event_type', String(50), nullable=False),
            Column('payload', String, nullable=False))
        Index('ix_complaint_events_history', table.c.complaint_id, table.c.created_at)
    for name,columns in {
        'app_users':[Column('user_id',String(100),primary_key=True),Column('email',String(200),unique=True,nullable=False),Column('password_hash',String(300),nullable=False),Column('profile',String,nullable=False)],
        'app_sessions':[Column('token_hash',String(64),primary_key=True),Column('user_id',String(100),nullable=False),Column('expires_at',DateTime(timezone=True),nullable=False),Column('last_seen_at',DateTime(timezone=True),nullable=False)],
        'auth_attempts':[Column('attempt_id',String(100),primary_key=True),Column('identity_hash',String(64),nullable=False),Column('created_at',DateTime(timezone=True),nullable=False)]
    }.items():
        if name not in metadata.tables:Table(name,metadata,*columns)
    from server.campus_storage import register
    return register(metadata)

def ensure_tables(bind):
    from server.campus_storage import NAMES
    for name in ('complaint_events','app_users','app_sessions','auth_attempts', *NAMES):
        tables().tables[name].create(bind, checkfirst=True)

def log_complaint_event(session, complaint_id, role, event_type, before, after, as_of):
    session.execute(insert(tables().tables['complaint_events']).values(
        event_id=str(uuid4()), complaint_id=complaint_id, created_at=as_of,
        actor_role=role, event_type=event_type,
        payload=json.dumps({'before': before, 'after': after, 'recorded_at':datetime.now(timezone.utc).isoformat()}, default=str)))
