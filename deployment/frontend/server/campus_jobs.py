"""Durable mail delivery, overdue escalation, and bounded personal-data retention."""
import asyncio, os, smtplib, ssl, json
from email.message import EmailMessage
from datetime import timedelta
from uuid import uuid4
from sqlalchemy import select, update, delete, insert
from sqlalchemy.orm import Session
from app.db import runtime_engine, get_table
from server.auth import utcnow
from server.storage import tables, log_complaint_event
from server import campus_service as service, complaints

def deliver(session):
    if not os.getenv('CARE_SMTP_HOST') or not os.getenv('CARE_SMTP_FROM'): return 0
    queue = service.table('mail'); sent = 0
    rows = session.execute(select(queue).where(queue.c.sent_at.is_(None), queue.c.attempts < 5).order_by(queue.c.created_at).limit(10)).mappings().all()
    for row in rows:
        message = EmailMessage(); message['From'] = os.environ['CARE_SMTP_FROM']; message['To'] = row['recipient']; message['Subject'] = row['subject']
        message['Message-ID'] = '<' + row['id'] + '@campuscare.local>'; message.set_content(row['body'])
        try:
            port = int(os.getenv('CARE_SMTP_PORT', '587'))
            constructor = smtplib.SMTP_SSL if port == 465 else smtplib.SMTP
            with constructor(os.environ['CARE_SMTP_HOST'], port, timeout=10) as smtp:
                if port != 465: smtp.starttls(context=ssl.create_default_context())
                if os.getenv('CARE_SMTP_USER'): smtp.login(os.environ['CARE_SMTP_USER'], os.environ['CARE_SMTP_PASSWORD'])
                smtp.send_message(message)
            session.execute(update(queue).where(queue.c.id == row['id']).values(sent_at=utcnow(), attempts=row['attempts']+1, last_error=None)); sent += 1
        except Exception as error:
            session.execute(update(queue).where(queue.c.id == row['id']).values(attempts=row['attempts']+1, last_error=type(error).__name__))
        session.commit()
    return sent

def maintain(session):
    now = utcnow(); tickets = service.table('tickets')
    # Once per active deadline; reopening resets the deadline and escalation.
    for row in session.execute(select(tickets).where(tickets.c.due_at < now, tickets.c.resolved_at.is_(None), tickets.c.escalated_at.is_(None))).mappings().all():
        _, item = service.linked(session, row['id']); before = dict(item)
        item['needs_review'] = True; item['sla_escalated'] = True
        complaints._store(session, item)
        session.execute(update(tickets).where(tickets.c.id == row['id']).values(escalated_at=now))
        log_complaint_event(session, row['id'], 'system', 'overdue_escalation', before, item, service.operational_now())
        service.notify(session, item, 'Ticket ' + row['id'] + ' passed its service target and was escalated for review.')
        service.queue_mail(session, row['id'], os.getenv('CARE_ESCALATION_EMAIL'), 'CampusCare overdue ticket', 'Review overdue ticket ' + row['id'] + ' in the dashboard.')
    removed = 0
    cutoff = now - timedelta(days=service.config()['retention_days'])
    for row in session.execute(select(tickets).where(tickets.c.resolved_at < cutoff)).mappings().all():
        _, item = service.linked(session, row['id'])
        counts = service.table('daily_counts'); day = row['created_at'].date().isoformat(); category = item.get('category') or 'other'; key = day + ':' + category
        if session.execute(select(counts.c.id).where(counts.c.id == key)).first(): session.execute(update(counts).where(counts.c.id == key).values(count=counts.c.count+1))
        else: session.execute(insert(counts).values(id=key, day=day, category=category, count=1))
        for name in ('followers','notices','mail','photos'): session.execute(delete(service.table(name)).where(service.table(name).c.ticket_id == row['id']))
        session.execute(delete(tables().tables['complaint_events']).where(tables().tables['complaint_events'].c.complaint_id == row['id']))
        # Any retrieval cache containing the expired complaint must be removed too.
        chunks = get_table('knowledge_chunks')
        session.execute(delete(chunks).where((chunks.c.metadata_json.like('%' + row['id'] + '%')) | (chunks.c.document_id.like('%' + row['id'] + '%'))))
        decisions = get_table('decision_log')
        session.execute(delete(decisions).where(decisions.c.payload.like('%' + row['id'] + '%')))
        session.execute(delete(get_table('complaints')).where(get_table('complaints').c.complaint_id == row['id']))
        session.execute(delete(tickets).where(tickets.c.id == row['id'])); removed += 1
    session.execute(delete(service.table('sessions')).where(service.table('sessions').c.expires_at < now))
    active_members = select(service.table('followers').c.member_id).union(select(service.table('sessions').c.member_id))
    session.execute(delete(service.table('members')).where(service.table('members').c.id.not_in(active_members)))
    session.commit(); return {'removed': removed}

async def run():
    while True:
        try:
            def step():
                with Session(runtime_engine()) as session: maintain(session); deliver(session)
            await asyncio.to_thread(step)
        except Exception as error:
            import logging
            logging.getLogger(__name__).warning('CampusCare maintenance: %s', type(error).__name__)
        await asyncio.sleep(60)
