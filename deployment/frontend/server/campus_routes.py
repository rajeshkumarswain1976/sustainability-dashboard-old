"""CampusCare API: every read and mutation enforces reporter or manager access."""
from datetime import timedelta
from typing import Literal
from uuid import uuid4
import base64, io, os
from fastapi import APIRouter, Depends, Request, Response, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, insert, update, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db import get_session
from app.analytics.repository import location_tree
from server.auth import demo_mode, utcnow
from server.campus_auth import member, campus_check, require_campus
from server import campus_service as service

router = APIRouter(prefix='/campus-care')
class Strict(BaseModel): model_config = ConfigDict(extra='forbid')
class Submission(Strict):
    node: str = Field(max_length=100)
    issue: str = Field(max_length=80)
    note: str = Field(default='', max_length=2000)
class Status(Strict):
    status: Literal['open','triaged','assigned','in_progress','resolved','rejected']
    notes: str = Field(default='', max_length=2000)
    department: str | None = Field(default=None, max_length=80)
class Rating(Strict): rating: Literal[-1, 1]
class Photo(Strict): content: str = Field(max_length=800000)
class Question(Strict): question: str = Field(min_length=3, max_length=1000)
class Announcement(Strict):
    node: str = Field(max_length=100)
    text: str = Field(min_length=3, max_length=500)
    hours: int = Field(default=24, ge=1, le=168)

@router.get('/config')
def configuration(request: Request):
    providers = [name for name in ('google','microsoft') if all(os.getenv(key) for key in ('CARE_'+name.upper()+'_CLIENT_ID','CARE_'+name.upper()+'_CLIENT_SECRET','CARE_SESSION_SECRET','CARE_PUBLIC_URL','COLLEGE_EMAIL_DOMAINS'))]
    return {'demo': demo_mode(), 'providers': providers, 'campus': campus_check(request), 'email_configured': bool(os.getenv('CARE_SMTP_HOST') and os.getenv('CARE_SMTP_FROM')),
        'issues': [{'id': key, **value} for key, value in service.config()['issues'].items()], 'retention_days': service.config()['retention_days']}

@router.get('/me')
def me(request: Request, session: Session = Depends(get_session)):
    try: user = member(request, session)
    except HTTPException as error:
        if error.status_code != 401: raise
        user = None
    return {'user': user, 'campus': campus_check(request)}

@router.get('/locations')
def locations(request: Request, session: Session = Depends(get_session)):
    member(request, session)
    return {'locations': [row for row in location_tree(session, 'F01') if row['level'] in {'building','floor','area'}]}

@router.get('/tickets')
def tickets(request: Request, admin: bool = False, limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0), session: Session = Depends(get_session)):
    user = member(request, session)
    if admin and not user['manager']: raise HTTPException(403, 'Administrator access required')
    query = select(service.table('tickets'))
    if not admin: query = query.join(service.table('followers'), service.table('followers').c.ticket_id == service.table('tickets').c.id).where(service.table('followers').c.member_id == user['id'])
    entries = []
    for row in session.execute(query.order_by(service.table('tickets').c.created_at.desc())).mappings():
        _, item = service.linked(session, row['id'])
        if not admin or service.can_manage(session, user, item['node']): entries.append((row,item))
    if admin:
        severity = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        entries.sort(key=lambda entry: (entry[1]['status'] in {'resolved','rejected'}, severity.get(entry[1].get('urgency'), 4), not entry[1].get('needs_review')))
    return {'tickets': [service.public_ticket(session, row, item, user) for row,item in entries[offset:offset+limit]], 'total': len(entries)}

@router.get('/tickets/{identifier}')
def ticket(identifier: str, request: Request, session: Session = Depends(get_session)):
    user = member(request, session); record, item = service.authorize_ticket(session, identifier, user)
    return service.public_ticket(session, record, item, user)

@router.get('/duplicates')
def duplicates(request: Request, node: str, issue: str, session: Session = Depends(get_session)):
    member(request, session); require_campus(request); service.known_node(session, node)
    return {'tickets': service.duplicates(session, node, issue)}

@router.post('/tickets')
def submit(command: Submission, request: Request, session: Session = Depends(get_session)):
    user = member(request, session); require_campus(request)
    try: return service.create(session, user, command.node, command.issue, command.note.strip())
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'A matching complaint was just submitted. Check duplicates and tap Me too.') from None

@router.post('/tickets/{identifier}/follow')
def follow(identifier: str, request: Request, session: Session = Depends(get_session)):
    user = member(request, session); require_campus(request)
    record, item = service.linked(session, identifier)
    if item['status'] in {'resolved','rejected'}: raise HTTPException(409, 'This issue is already closed')
    try:
        service.subscribe(session, identifier, user); session.commit()
    except IntegrityError: session.rollback()  # concurrent double tap is idempotent
    return {'following': True}

@router.patch('/tickets/{identifier}')
def change(identifier: str, command: Status, request: Request, session: Session = Depends(get_session)):
    return service.status_change(session, identifier, member(request, session), command.status, command.notes, command.department)

@router.post('/tickets/{identifier}/reopen')
def reopen(identifier: str, request: Request, session: Session = Depends(get_session)):
    return service.reopen(session, identifier, member(request, session))

@router.post('/tickets/{identifier}/rating')
def rating(identifier: str, command: Rating, request: Request, session: Session = Depends(get_session)):
    user = member(request, session); _, item = service.authorize_ticket(session, identifier, user)
    if item['status'] != 'resolved' or not service.following(session, identifier, user): raise HTTPException(409, 'Reporters can rate resolved tickets')
    session.execute(update(service.table('followers')).where(service.table('followers').c.ticket_id == identifier, service.table('followers').c.member_id == user['id']).values(rating=command.rating)); session.commit()
    return {'rating': command.rating}

@router.post('/tickets/{identifier}/photo')
def upload(identifier: str, command: Photo, request: Request, session: Session = Depends(get_session)):
    user = member(request, session); require_campus(request)
    record, item = service.authorize_ticket(session, identifier, user)
    if record['member_id'] != user['id'] or item['status'] in {'resolved','rejected'}: raise HTTPException(403, 'Only the original reporter can attach a photo to an open ticket')
    try:
        from PIL import Image, ImageOps
        raw = base64.b64decode(command.content, validate=True)
        image = Image.open(io.BytesIO(raw))
        if image.format not in {'JPEG','PNG','WEBP'} or image.width * image.height > 4000000: raise ValueError('Unsupported image')
        image.load(); image = ImageOps.exif_transpose(image).convert('RGB'); image.thumbnail((1280,1280))
        clean = io.BytesIO(); image.save(clean, format='JPEG', quality=80)
    except Exception: raise HTTPException(422, 'Use a JPEG, PNG or WebP image under four megapixels') from None
    photos = service.table('photos')
    if session.execute(select(photos.c.ticket_id).where(photos.c.ticket_id == identifier)).first(): session.execute(update(photos).where(photos.c.ticket_id == identifier).values(content=clean.getvalue(), mime='image/jpeg'))
    else: session.execute(insert(photos).values(ticket_id=identifier, content=clean.getvalue(), mime='image/jpeg'))
    session.commit(); return {'uploaded': True}

@router.get('/tickets/{identifier}/photo')
def photo(identifier: str, request: Request, session: Session = Depends(get_session)):
    service.authorize_ticket(session, identifier, member(request, session))
    row = session.execute(select(service.table('photos')).where(service.table('photos').c.ticket_id == identifier)).mappings().first()
    if not row: raise HTTPException(404, 'No photo attached')
    return Response(row['content'], media_type=row['mime'], headers={'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'})

@router.get('/notifications')
def notifications(request: Request, session: Session = Depends(get_session)):
    user = member(request, session)
    rows = session.execute(select(service.table('notices')).where(service.table('notices').c.member_id == user['id']).order_by(service.table('notices').c.created_at.desc()).limit(50)).mappings()
    return {'notifications': [dict(row) for row in rows]}

@router.post('/notifications/{identifier}/read')
def read_notice(identifier: str, request: Request, session: Session = Depends(get_session)):
    user = member(request, session)
    session.execute(update(service.table('notices')).where(service.table('notices').c.id == identifier, service.table('notices').c.member_id == user['id']).values(read_at=utcnow())); session.commit()
    return {'read': True}

@router.get('/announcements')
def announcements(request: Request, session: Session = Depends(get_session)):
    member(request, session)
    rows = session.execute(select(service.table('announcements')).where(service.table('announcements').c.expires_at > utcnow()).order_by(service.table('announcements').c.created_at.desc()).limit(25)).mappings()
    return {'announcements': [dict(row) for row in rows]}

@router.post('/announcements')
def announce(command: Announcement, request: Request, session: Session = Depends(get_session)):
    user = member(request, session)
    if not service.can_manage(session, user, command.node): raise HTTPException(403, 'Announcement is outside your department scope')
    session.execute(insert(service.table('announcements')).values(id=str(uuid4()), node=command.node, text=command.text, created_at=utcnow(), expires_at=utcnow()+timedelta(hours=command.hours))); session.commit()
    return {'published': True}

@router.post('/help')
def help_chat(command: Question, request: Request, session: Session = Depends(get_session)):
    user = member(request, session)
    from hashlib import sha256
    from server.storage import tables
    limits=tables().tables['auth_attempts']; identity=sha256(('campus-help:'+user['id']).encode()).hexdigest()
    count=session.scalar(select(func.count()).select_from(limits).where(limits.c.identity_hash==identity,limits.c.created_at>utcnow()-timedelta(minutes=1)))
    if count>=10:raise HTTPException(429,'Please wait a minute before asking more questions')
    session.execute(insert(limits).values(attempt_id=str(uuid4()),identity_hash=identity,created_at=utcnow()));session.commit()
    from app.decision import router as decisions
    from server.agent.language import verified_explanation
    from server.rag.search import anonymize_payload
    question = anonymize_payload(command.question)
    gate = decisions.decide_many(session, ['copilot.scope'], {'request': question, 'snapshot': {'purpose': 'campus facility complaints and ticket tracking'}}, utcnow())['copilot.scope']
    session.commit()
    if decisions.label(gate) != 'true' or decisions.probability(gate) < .80 or gate.get('flag') == 'needs_review':
        return {'text': 'I can help with campus facilities and your complaint tickets. Choose a listed issue or open My complaints to track it.', 'source': 'template', 'sources': []}
    own = tickets(request, False, 10, 0, session)['tickets']
    verified = {'tickets': [{'id': item['id'], 'status': item['status'], 'department': item['department'], 'due_at': item['due_at']} for item in own],
        'policy_targets': [{'issue': value['title'], 'hours': value['sla_hours']} for value in service.config()['issues'].values()]}
    answer = verified_explanation({'question': question, **verified}, [], 'Choose a department and issue, then a registered location to report a problem. Track updates in My complaints. Repair times are policy targets and may change after inspection.')
    return {**answer, 'sources': [{'id': item['id'], 'title': item['status']} for item in own] + [{'id': 'campus-care-policy', 'title': 'Configured service targets'}]}
