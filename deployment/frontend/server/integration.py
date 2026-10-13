"""Register the extended workflow without replacing source analytics or routes."""
from datetime import datetime
from contextlib import asynccontextmanager
from sqlalchemy import select,update,inspect,text
from app.db import get_table,runtime_engine
from app.config import settings
from app.decision import router
from app.analytics.repository import fetch_frame
from server.storage import ensure_tables
from server.api.routes import router as extension_routes
from server.agent.pipeline import process_candidate,explain_routine
from server.auth import router as auth_routes,AccessMiddleware,bootstrap_demo
from server.replay import worker
from app.engine.actions import create_action
import json

def enrich(session,candidate,alert,as_of,snapshot):
    if candidate['type']=='safety_incident':
        current=fetch_frame(session,'safety_incidents',snapshot.get('node','F01'),as_of,as_of,as_of)
        identifier=candidate['facts'].get('incident_id')
        rows=current[current['incident_id'].astype(str)==str(identifier)] if 'incident_id' in current else current
        row=rows.iloc[0].to_dict() if not rows.empty else {}
        incident={'incident_id':identifier,'description':row.get('description'),'location':row.get('location'),'reported_at':candidate['ts']}
        decisions=router.decide_many(session,['incident.type','incident.severity'],{'incident':incident},as_of)
        classification={'type':router.label(decisions['incident.type']),'severity':router.label(decisions['incident.severity']),
            'confidence':min(router.probability(item) for item in decisions.values()),
            'needs_review':not incident['description'] or any(item['flag']=='needs_review' or router.probability(item)<0.8 for item in decisions.values()),
            'decisions':{point:{'label':router.label(item),'provider':item['provider'],'flag':item['flag'],'confidence':router.probability(item)} for point,item in decisions.items()}}
        facts={**alert['facts'],'incident_classification':classification}
        if classification['needs_review']:
            alert={**alert,'status':'needs_review'}
        alert={**alert,'facts':facts}
        session.execute(update(get_table('alerts')).where(get_table('alerts').c.alert_key==alert['alert_key']).values(facts=facts,status=alert['status']))
        if classification['needs_review'] or classification['severity']=='critical':
            action_table=get_table('actions')
            session.execute(update(action_table).where(action_table.c.alert_key==alert['alert_key']).values(needs_head_approval=1))
    if alert['status']=='pending_agent':
        process_candidate(session,candidate,alert,snapshot)
    elif alert['status'] in {'open','needs_review'}:
        if alert['status']=='needs_review' and not session.execute(select(get_table('actions').c.action_id).where(get_table('actions').c.alert_key==alert['alert_key'])).first():
            review={point:{'answer':None,'provider':'jev','flag':'needs_review'} for point in ('owner.assign','action.priority')}
            action=create_action(session,candidate,alert['alert_key'],alert.get('level') or 'Warning',as_of,review)
            if action:
                session.execute(update(get_table('actions')).where(get_table('actions').c.action_id==action['id']).values(
                    text=f"Review unverified {candidate['type'].replace('_',' ')} at {candidate['node']}",
                    payload=json.dumps({'needs_review':True,'estimate_available':False,'review_reason':'Decision confidence or provider availability requires human review'})))
        explain_routine(session,alert)
    table=get_table('alerts')
    row=session.execute(select(table).where(table.c.alert_key==alert['alert_key'])).mappings().one()
    return {**alert,'status':row['status'],'facts':row['facts'],'level':row['level'],'confidence':row['confidence']}

def install(app):
    if getattr(app.state,'terranexus_installed',False):
        return
    app.state.terranexus_installed=True
    app.include_router(extension_routes)
    app.include_router(auth_routes)
    from server.campus_routes import router as campus_routes
    from server.campus_auth import router as campus_auth_routes
    from server.campus_storage import NAMES
    import os, asyncio
    app.include_router(campus_routes)
    app.include_router(campus_auth_routes)
    if os.getenv('CARE_SESSION_SECRET'):
        from starlette.middleware.sessions import SessionMiddleware
        from server.auth import demo_mode
        app.add_middleware(SessionMiddleware, secret_key=os.environ['CARE_SESSION_SECRET'], session_cookie='care_oidc', same_site='lax', https_only=not demo_mode(), max_age=600)
    app.add_middleware(AccessMiddleware)
    from app.engine import pipeline
    pipeline.set_post_decision_hook(enrich)
    from app.api import routes
    routes.set_stream_delegate(worker.stream)
    def initialize():
        from server.auth import demo_mode
        from ipaddress import ip_network
        if not demo_mode() and (not settings.jev_api_key or not settings.groq_api_key):
            raise RuntimeError('Production requires configured JEV_API_KEY and GROQ_API_KEY')
        for cidr in os.getenv('CAMPUS_IP_CIDRS','').split(','):
            if cidr.strip(): ip_network(cidr.strip(),strict=False)
        if os.getenv('CARE_SESSION_SECRET') and len(os.environ['CARE_SESSION_SECRET']) < 32:
            raise RuntimeError('CARE_SESSION_SECRET must contain at least 32 random characters')
        engine=runtime_engine()
        if engine is None:
            raise RuntimeError('DATABASE_URL is required')
        if engine.dialect.name=='sqlite':
            with engine.connect() as connection:
                connection.execute(text('PRAGMA journal_mode=WAL'));connection.commit()
            ensure_tables(engine)
        elif any(not inspect(engine).has_table(name) for name in ('complaint_events','app_users','app_sessions','auth_attempts', *NAMES)):
            raise RuntimeError('Run the additive TerraNexus operational migration with the direct loader URL before starting the configured database')
        from sqlalchemy.orm import Session
        with Session(engine) as session:bootstrap_demo(session)
    previous_lifespan=app.router.lifespan_context
    @asynccontextmanager
    async def lifespan(application):
        initialize()
        async with previous_lifespan(application) as state:
            from server.campus_jobs import run
            jobs = asyncio.create_task(run())
            try:
                async with worker.lifespan():yield state
            finally:
                jobs.cancel()
                try: await jobs
                except asyncio.CancelledError: pass
    app.router.lifespan_context=lifespan
