"""Private reporter data is separate from the existing operational complaints table."""
from sqlalchemy import Table, Column, String, DateTime, Integer, LargeBinary, UniqueConstraint, Index

NAMES = ('care_members', 'care_sessions', 'care_tickets', 'care_followers', 'care_notices',
         'care_mail', 'care_announcements', 'care_daily_counts', 'care_photos')

def register(metadata):
    definitions = {
        'care_members': [Column('id', String(100), primary_key=True), Column('email', String(200), nullable=False), Column('name', String(200), nullable=False)],
        'care_sessions': [Column('token_hash', String(64), primary_key=True), Column('member_id', String(100), nullable=False), Column('expires_at', DateTime(timezone=True), nullable=False)],
        'care_tickets': [Column('id', String(100), primary_key=True), Column('member_id', String(100), nullable=False), Column('issue', String(80), nullable=False), Column('dedupe_key', String(64)), Column('created_at', DateTime(timezone=True), nullable=False), Column('resolved_at', DateTime(timezone=True)), Column('due_at', DateTime(timezone=True)), Column('escalated_at', DateTime(timezone=True))],
        'care_followers': [Column('id', String(210), primary_key=True), Column('ticket_id', String(100), nullable=False), Column('member_id', String(100), nullable=False), Column('rating', Integer), UniqueConstraint('ticket_id', 'member_id')],
        'care_notices': [Column('id', String(100), primary_key=True), Column('member_id', String(100), nullable=False), Column('ticket_id', String(100)), Column('created_at', DateTime(timezone=True), nullable=False), Column('text', String, nullable=False), Column('read_at', DateTime(timezone=True))],
        'care_mail': [Column('id', String(100), primary_key=True), Column('ticket_id', String(100)), Column('recipient', String(200), nullable=False), Column('subject', String(200), nullable=False), Column('body', String, nullable=False), Column('created_at', DateTime(timezone=True), nullable=False), Column('sent_at', DateTime(timezone=True)), Column('attempts', Integer, nullable=False, default=0), Column('last_error', String(100))],
        'care_announcements': [Column('id', String(100), primary_key=True), Column('node', String(100), nullable=False), Column('text', String, nullable=False), Column('created_at', DateTime(timezone=True), nullable=False), Column('expires_at', DateTime(timezone=True), nullable=False)],
        'care_daily_counts': [Column('id', String(150), primary_key=True), Column('day', String(10), nullable=False), Column('category', String(50), nullable=False), Column('count', Integer, nullable=False)],
        'care_photos': [Column('ticket_id', String(100), primary_key=True), Column('content', LargeBinary, nullable=False), Column('mime', String(30), nullable=False)],
    }
    for name, columns in definitions.items():
        if name not in metadata.tables:
            table = Table(name, metadata, *columns)
            if name == 'care_tickets': Index('ix_care_active_duplicate', table.c.dedupe_key, unique=True)
    return metadata
