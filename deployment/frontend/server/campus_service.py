"""Shared operational tickets, private followers and durable notification outbox."""
from datetime import timedelta
from hashlib import sha256
from uuid import uuid4
from pathlib import Path
from functools import lru_cache
import json, os, yaml
from zoneinfo import ZoneInfo
from sqlalchemy import select, insert, update, delete, func
from fastapi import HTTPException
from app.db import get_table
from app.analytics.repository import location_tree
from server.storage import tables, log_complaint_event
from server.auth import utcnow, aware
from server import complaints
from server.rag.search import anonymize_payload
from server.campus_classify import classify

@lru_cache(maxsize=1)
def config(): return yaml.safe_load((Path(__file__).resolve().parents[1] / 'config/campus-care.yaml').read_text(encoding='utf-8'))
def table(name): return tables().tables['care_' + name]
def operational_now(): return utcnow().astimezone(ZoneInfo('Asia/Kolkata'))
def known_node(session, node):
    valid = {row['node_id'] for row in location_tree(session, 'F01')}
    if node not in valid or node == 'F01': raise HTTPException(422, 'Choose a specific registered campus location')

def can_manage(session, user, node):
    return user['manager'] and node in {row['node_id'] for root in user['nodes'] for row in location_tree(session, root)}

def linked(session, identifier):
    record = session.execute(select(table('tickets')).where(table('tickets').c.id == identifier)).mappings().first()
    if not record: raise HTTPException(404, 'Ticket was not found')
    return record, complaints.unpack(complaints._row(session, identifier))

def following(session, identifier, user):
    return bool(session.execute(select(table('followers').c.id).where(table('followers').c.ticket_id == identifier, table('followers').c.member_id == user['id'])).first())

def authorize_ticket(session, identifier, user):
    record, item = linked(session, identifier)
    if not following(session, identifier, user) and not can_manage(session, user, item['node']): raise HTTPException(404, 'Ticket was not found')
    return record, item

def public_ticket(session, record, item, user):
    followers = session.scalar(select(func.count()).select_from(table('followers')).where(table('followers').c.ticket_id == item['id']))
    rating = session.scalar(select(table('followers').c.rating).where(table('followers').c.ticket_id == item['id'], table('followers').c.member_id == user['id']))
    events = session.execute(select(tables().tables['complaint_events']).where(tables().tables['complaint_events'].c.complaint_id == item['id']).order_by(tables().tables['complaint_events'].c.created_at)).mappings()
    history = [{'event': row['event_type'], 'at': row['created_at'].isoformat()} for row in events]
    return {**item, 'issue': record['issue'], 'due_at': record['due_at'].isoformat() if record['due_at'] else None,
        'sla_kind': 'policy_target', 'supporters': followers, 'rating': rating, 'history': history,
        'overdue': bool(record['due_at'] and aware(record['due_at']) < utcnow() and item['status'] not in {'resolved', 'rejected'}),
        'has_photo': bool(session.execute(select(table('photos').c.ticket_id).where(table('photos').c.ticket_id == item['id'])).first())}

def duplicate_key(node, issue): return sha256(f'{node}|{issue}'.encode()).hexdigest()

def duplicates(session, node, issue):
    row = session.execute(select(table('tickets')).where(table('tickets').c.dedupe_key == duplicate_key(node, issue))).mappings().first()
    if not row: return []
    item = complaints.unpack(complaints._row(session, row['id']))
    return [{'id': row['id'], 'node': item['node'], 'issue': issue, 'title': config()['issues'][issue]['title'], 'status': item['status']}]

def subscribe(session, identifier, user):
    identifier_key = identifier + ':' + user['id']
    if not session.execute(select(table('followers').c.id).where(table('followers').c.id == identifier_key)).first():
        session.execute(insert(table('followers')).values(id=identifier_key, ticket_id=identifier, member_id=user['id']))

def queue_mail(session, ticket_id, recipient, subject, body):
    if recipient:
        session.execute(insert(table('mail')).values(id=str(uuid4()), ticket_id=ticket_id, recipient=recipient,
            subject=subject, body=body, created_at=utcnow(), attempts=0))

def notify(session, item, text):
    rows = session.execute(select(table('members')).join(table('followers'), table('members').c.id == table('followers').c.member_id).where(table('followers').c.ticket_id == item['id'])).mappings()
    for reporter in rows:
        session.execute(insert(table('notices')).values(id=str(uuid4()), member_id=reporter['id'], ticket_id=item['id'], text=text, created_at=utcnow()))
        base = os.getenv('CARE_PUBLIC_URL', '').rstrip('/')
        queue_mail(session, item['id'], reporter['email'], 'CampusCare: ' + item['status'].replace('_', ' '),
            text + (f"\nTrack, reopen or rate your ticket: {base}/campus-care?ticket={item['id']}" if base else ''))

def create(session, user, node, issue_id, note):
    known_node(session, node)
    issue = config()['issues'].get(issue_id)
    if not issue: raise HTTPException(422, 'Choose a listed issue')
    now = utcnow()
    count = session.scalar(select(func.count()).select_from(table('tickets')).where(table('tickets').c.member_id == user['id'], table('tickets').c.created_at > now-timedelta(hours=1)))
    if count >= config()['submissions_per_hour']: raise HTTPException(429, 'Hourly complaint limit reached; track or support an existing ticket')
    existing = duplicates(session, node, issue_id)
    if existing: return {'duplicate': True, 'ticket': existing[0]}
    # Reserve a unique active issue before slow model work; concurrent requests
    # cannot create a second active ticket for the same registry location.
    identifier = 'CC-' + uuid4().hex[:16].upper()
    session.execute(insert(table('tickets')).values(id=identifier, member_id=user['id'], issue=issue_id,
        dedupe_key=duplicate_key(node, issue_id), created_at=now, due_at=now+timedelta(hours=issue['sla_hours'])))
    classification = classify(session, issue, note, now, identifier)
    conflict = classification.get('department') not in {None, issue['department']}
    route = next((value for value in config()['issues'].values() if value['department'] == classification.get('department')), issue) if not classification['needs_review'] else issue
    observed_at = operational_now()
    item = {'id': identifier, 'node': node, 'created_at': observed_at.isoformat(), 'status': 'assigned', 'text': issue['title'] + (': ' + anonymize_payload(note) if note else ''),
        'category': route['category'], 'department': route['department'], 'owner': route['owner'], 'urgency': classification.get('severity'), 'priority': None,
        'confidence': classification.get('confidence'), 'needs_review': bool(classification.get('needs_review') or conflict or classification.get('flags', {}).get('hazard') or classification.get('flags', {}).get('spam')),
        'source': 'campus_care', 'cluster_id': identifier, 'classification': classification, 'submitted_role': 'campus_member',
        'resolution_notes': None, 'action_id': None, 'building': None}
    session.execute(insert(get_table('complaints')).values(complaint_id=identifier, created_at=observed_at, node_id=node, status=item['status'], payload='{}'))
    complaints._store(session, item); subscribe(session, identifier, user)
    log_complaint_event(session, identifier, 'campus_member', 'submitted', None, item, observed_at)
    destinations = json.loads(os.getenv('CARE_DEPARTMENT_EMAILS', '{}'))
    queue_mail(session, identifier, destinations.get(route['department']), 'CampusCare ticket ' + identifier,
        f"{issue['title']} at {node}. Review the ticket in the campus dashboard.")
    notify(session, item, 'Your complaint was recorded and routed to ' + route['department'] + '. The displayed time is a policy target.')
    session.commit()
    record, item = linked(session, identifier)
    return {'duplicate': False, 'ticket': public_ticket(session, record, item, user)}

def status_change(session, identifier, user, status, notes, department=None):
    record, item = authorize_ticket(session, identifier, user)
    if not can_manage(session, user, item['node']): raise HTTPException(403, 'Department administrator access is required')
    transitions = {'open': {'triaged', 'assigned', 'rejected'}, 'triaged': {'assigned', 'rejected'},
        'assigned': {'in_progress', 'rejected'}, 'in_progress': {'resolved', 'rejected'}, 'resolved': set(), 'rejected': set()}
    if status != item['status'] and status not in transitions.get(item['status'], set()): raise HTTPException(409, 'Follow the ticket workflow in order')
    if (status in {'resolved', 'rejected'} or department) and not notes.strip(): raise HTTPException(422, 'Record a reason for closure or a routing correction')
    before = dict(item)
    if department:
        route = next((value for value in config()['issues'].values() if value['department'] == department), None)
        if not route: raise HTTPException(422, 'Unknown department')
        item.update(department=department, category=route['category'], owner=route['owner'], classification_source='human_override')
    item.update(status=status, resolution_notes=notes or item.get('resolution_notes'))
    complaints._store(session, item)
    log_complaint_event(session, identifier, 'head', 'updated', before, item, operational_now())
    on_dashboard_change(session, before, item)
    session.commit()
    return public_ticket(session, linked(session, identifier)[0], item, user)

def on_dashboard_change(session, before, item):
    """Also called by the existing dashboard so both interfaces stay consistent."""
    if item.get('source') != 'campus_care': return
    terminal = item['status'] in {'resolved', 'rejected'}
    if before.get('status') != item['status']:
        session.execute(update(table('tickets')).where(table('tickets').c.id == item['id']).values(
            resolved_at=utcnow() if terminal else None, dedupe_key=None if terminal else duplicate_key(item['node'], session.scalar(select(table('tickets').c.issue).where(table('tickets').c.id == item['id'])))))
        notify(session, item, 'Ticket ' + item['id'] + ' is ' + item['status'].replace('_', ' ') + ('. ' + item['resolution_notes'] if item.get('resolution_notes') else '.'))

def reopen(session, identifier, user):
    record, item = authorize_ticket(session, identifier, user)
    if not following(session, identifier, user): raise HTTPException(403, 'Only ticket reporters can reopen')
    if item['status'] != 'resolved': raise HTTPException(409, 'Only resolved tickets can be reopened')
    active = duplicates(session, item['node'], record['issue'])
    if active:
        subscribe(session, active[0]['id'], user); session.commit()
        return {'merged_into': active[0]['id']}
    before = dict(item); item.update(status='assigned', resolution_notes=None)
    complaints._store(session, item)
    session.execute(update(table('tickets')).where(table('tickets').c.id == identifier).values(resolved_at=None,
        dedupe_key=duplicate_key(item['node'], record['issue']), due_at=utcnow()+timedelta(hours=config()['issues'][record['issue']]['sla_hours']), escalated_at=None))
    log_complaint_event(session, identifier, 'campus_member', 'reopened', before, item, operational_now())
    notify(session, item, 'Ticket ' + identifier + ' was reopened for department review.')
    session.commit(); return {'reopened': True}
