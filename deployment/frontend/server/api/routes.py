from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict
import json
from fastapi import APIRouter,Depends,Header,Query,HTTPException
from sqlalchemy import select,func
from sqlalchemy.orm import Session
from app.db import get_session,get_table
from app.config import settings
from app.decision.jev import JEV_MODEL
from app.decision.jev import catalogue
from app.api.routes import request_context
from app.analytics.repository import resolve_scope
from app.analytics.metrics import data_source
from app.engine.pipeline import list_alerts
from server.agent.tools import Scope,redact_financial
from server.agent import copilot,simulation,pipeline as agent_pipeline
from server.rag.search import search
from server import complaints
from server.storage import tables
from server.config import configuration
from server.api.models import CopilotRequest,SimulationRequest,AgentRequest,ComplaintSubmission,ComplaintChange,ComplaintGroup,ComplaintBulk

router=APIRouter()
Role=Literal['staff','head']

class ActionAssignment(BaseModel):
    model_config=ConfigDict(extra='forbid')
    owner:str=Field(min_length=1,max_length=100)
    reason:str=Field(min_length=3,max_length=1000)
    approve:bool=False

@router.post('/actions/{identifier}/assign')
def assign_action(identifier:str,command:ActionAssignment,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    if role!='head':raise HTTPException(403,'Only a Department Head or Administrator can assign or approve work')
    if command.owner not in catalogue()['decisions']['owner.assign']['options']:raise HTTPException(422,'Unknown task-owner team')
    table=get_table('actions')
    row=session.execute(select(table).where(table.c.action_id==identifier)).mappings().first()
    if not row:raise HTTPException(404,'Action not found')
    if row['status']=='done':raise HTTPException(409,'Completed work cannot be reassigned')
    from sqlalchemy import update
    from app.replay_calendar import now_ist
    from app.engine.actions import _map_row
    payload=json.loads(row['payload'] or '{}')
    payload['history']=[*payload.get('history',[]),{'event':'assigned','from_owner':row['owner'],'owner':command.owner,'reason':command.reason,'approved':command.approve,'role':role,'at':now_ist().isoformat()}]
    if command.approve:payload['needs_review']=False
    session.execute(update(table).where(table.c.action_id==identifier).values(owner=command.owner,
        needs_head_approval=0 if command.approve else row['needs_head_approval'],payload=json.dumps(payload)))
    session.commit()
    return _map_row(dict(session.execute(select(table).where(table.c.action_id==identifier)).mappings().one()))

@router.get('/replay/status')
def replay_status():
    from server.replay import worker
    return {'owner':'backend','processing':worker.processing,'error':worker.error,'subscribers':len(worker.subscribers)}

def scope_for(session,node,as_of,role,start=None,end=None):
    try:
        resolve_scope(session,node)
    except KeyError:
        raise HTTPException(404,'Location was not found') from None
    context=request_context(node=node,start=start,end=end,as_of=as_of)
    return Scope(node,context['as_of'],role,context['start'],context['end'])

def visible_complaints(session,scope,identifiers):
    visible={item['id'] for item in complaints.list_complaints(session,scope.node,scope.as_of)}
    if any(identifier not in visible for identifier in identifiers):
        raise HTTPException(404,'Complaint was not found at this scope and cutoff')
    event_table=tables().tables['complaint_events']
    if session.execute(select(event_table.c.event_id).where(event_table.c.complaint_id.in_(identifiers),event_table.c.created_at>scope.as_of).limit(1)).first():
        raise HTTPException(409,'Historical complaint views are read-only after a later update')

@router.get('/ai/status')
def ai_status(node:str='F01',as_of:datetime|None=None,session:Session=Depends(get_session)):
    scope=scope_for(session,node,as_of,'staff')
    table=get_table('decision_log')
    counts=[{'provider':provider,'status':status,'results':count} for provider,status,count in session.execute(
        select(table.c.provider,table.c.status,func.count()).where(table.c.created_at<=scope.as_of).group_by(table.c.provider,table.c.status))]
    return {'sector':settings.sector,'jev':{'configured':bool(settings.jev_api_key),'provider':settings.decision_provider,'model':JEV_MODEL,'decision_results':counts},
        'groq':{'configured':bool(settings.groq_api_key),'model':settings.groq_model or configuration()['language']['model']},
        'data_source':data_source('overview')}

@router.post('/copilot')
def copilot_endpoint(command:CopilotRequest,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    scope=scope_for(session,command.node,command.as_of,role,command.start,command.end)
    result=copilot.answer(session,scope,command.question)
    session.commit()
    return result

@router.get('/summary/weekly')
def weekly_endpoint(node:str='F01',as_of:datetime|None=None,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    scope=scope_for(session,node,as_of,role)
    result=copilot.weekly_summary(session,scope)
    session.commit()
    return result

@router.post('/simulate')
def simulation_endpoint(command:SimulationRequest,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    scope=scope_for(session,command.node,command.as_of,role,command.start,command.end)
    try:
        result=simulation.simulate(session,scope,command.scenario,command.parameters)
    except ValueError as error:
        raise HTTPException(422,str(error)) from None
    return redact_financial(result,role)

@router.get('/knowledge/search')
def knowledge_search(q:str=Query(min_length=1,max_length=2000),node:str='F01',as_of:datetime|None=None,sector:str|None=None,session:Session=Depends(get_session)):
    scope=scope_for(session,node,as_of,'staff')
    try:
        result=search(session,q,sector or settings.sector,node,scope.as_of)
    except ValueError as error:
        raise HTTPException(422,str(error)) from None
    session.commit()
    return result

@router.post('/agent/run')
def run_agent(command:AgentRequest,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    if role!='head':
        raise HTTPException(403,'Multi-domain agent review requires a head')
    scope=scope_for(session,command.node,command.as_of,role)
    pending=[alert for alert in list_alerts(session,node=scope.node,as_of=scope.as_of) if alert['status']=='pending_agent'][:command.limit]
    results=[]
    if pending:
        from app.engine.snapshot import build_snapshot
        snapshot=build_snapshot(scope.node,scope.as_of,session=session)
        for alert in pending:
            results.append(agent_pipeline.process_candidate(session,agent_pipeline.candidate_from_alert(alert),alert,snapshot))
    session.commit()
    return {'as_of':scope.as_of.isoformat(),'results':results,'count':len(results),'data_source':data_source('overview')}

@router.get('/safety/classifications')
def safety_classifications(node:str='F01',as_of:datetime|None=None,session:Session=Depends(get_session)):
    scope=scope_for(session,node,as_of,'staff')
    records=[{'alert_id':alert['alert_id'],'incident_id':(alert.get('facts',{}).get('observations') or {}).get('incident_id') or alert.get('facts',{}).get('incident_id'),**alert['facts']['incident_classification']}
        for alert in list_alerts(session,node=node,as_of=scope.as_of) if alert.get('facts',{}).get('incident_classification')]
    return {'as_of':scope.as_of.isoformat(),'classifications':records,'data_source':data_source('safety')}

@router.post('/alerts/{identifier}/review')
def mark_review(identifier:str,node:str='F01',as_of:datetime|None=None,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    if role!='head':raise HTTPException(403,'Marking a signal for review requires a head')
    scope=scope_for(session,node,as_of,role)
    alert=next((item for item in list_alerts(session,node=node,as_of=scope.as_of) if item['alert_id']==identifier),None)
    if not alert:raise HTTPException(404,'Alert was not found in this scope')
    from sqlalchemy import update
    facts={**alert['facts'],'review_history':[*alert['facts'].get('review_history',[]),{'role':role,'as_of':scope.as_of.isoformat(),'event':'marked_for_review'}]}
    session.execute(update(get_table('alerts')).where(get_table('alerts').c.alert_id==identifier).values(status='needs_review',facts=facts))
    session.execute(update(get_table('actions')).where(get_table('actions').c.alert_key==alert['alert_key']).values(needs_head_approval=1))
    session.commit()
    return {**alert,'status':'needs_review','facts':facts}

@router.get('/complaints')
def complaint_list(node:str='F01',as_of:datetime|None=None,session:Session=Depends(get_session)):
    scope=scope_for(session,node,as_of,'staff')
    return {'as_of':scope.as_of.isoformat(),'complaints':complaints.list_complaints(session,node,scope.as_of),'data_source':{'mode':'operational_reports','classification':'submitted_reports'}}

@router.get('/complaints/summary')
def complaint_summary(node:str='F01',as_of:datetime|None=None,session:Session=Depends(get_session)):
    scope=scope_for(session,node,as_of,'staff')
    rows=complaints.list_complaints(session,node,scope.as_of)
    return {'as_of':scope.as_of.isoformat(),'total':len(rows),'open':sum(row['status'] not in {'resolved','rejected'} for row in rows),
        'needs_review':sum(bool(row.get('needs_review')) for row in rows),'clusters':len({row.get('cluster_id',row['id']) for row in rows}),
        'by_status':{status:sum(row['status']==status for row in rows) for status in configuration()['complaints']['statuses']}}

@router.get('/complaints/options')
def complaint_options():
    decisions=catalogue()['decisions']
    return {'owners':list(decisions['owner.assign']['options']),'categories':list(decisions['complaint.category']['options']),
        'urgencies':list(decisions['incident.severity']['options']),'statuses':configuration()['complaints']['statuses']}

@router.post('/complaints')
def complaint_submit(command:ComplaintSubmission,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    scope=scope_for(session,command.node,command.as_of,role)
    result=complaints.submit(session,scope.node,command.text,scope.as_of,role)
    session.commit()
    return result

@router.post('/complaints/bulk')
def complaint_bulk(command:ComplaintBulk,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    if role!='head':
        raise HTTPException(403,'Bulk updates require a head')
    scope=scope_for(session,command.node,command.as_of,role)
    visible_complaints(session,scope,command.ids)
    results=[complaints.patch(session,identifier,command.changes.model_dump(exclude_none=True),scope.as_of,role) for identifier in command.ids]
    session.commit()
    return {'complaints':results}

@router.post('/complaints/merge')
def complaint_merge(command:ComplaintGroup,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    scope=scope_for(session,command.node,command.as_of,role)
    visible_complaints(session,scope,command.ids)
    result=complaints.merge(session,command.ids,scope.as_of,role);session.commit()
    return {'complaints':result}

@router.post('/complaints/split')
def complaint_split(command:ComplaintGroup,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    scope=scope_for(session,command.node,command.as_of,role)
    visible_complaints(session,scope,command.ids)
    result=complaints.split(session,command.ids,scope.as_of,role);session.commit()
    return {'complaints':result}

@router.get('/complaints/{identifier}')
def complaint_detail(identifier:str,node:str='F01',as_of:datetime|None=None,session:Session=Depends(get_session)):
    scope=scope_for(session,node,as_of,'staff')
    visible={item['id'] for item in complaints.list_complaints(session,node,scope.as_of)}
    if identifier not in visible:
        raise HTTPException(404,'Complaint was not found at this scope and cutoff')
    item=next(item for item in complaints.list_complaints(session,node,scope.as_of) if item['id']==identifier)
    table=tables().tables['complaint_events']
    history=[{'id':row['event_id'],'created_at':complaints._stamp(row['created_at']),'role':row['actor_role'],'type':row['event_type'],'changes':json.loads(row['payload'])}
        for row in session.execute(select(table).where(table.c.complaint_id==identifier,table.c.created_at<=scope.as_of).order_by(table.c.created_at)).mappings()]
    return {'complaint':item,'history':history}

@router.patch('/complaints/{identifier}')
def complaint_patch(identifier:str,command:ComplaintChange,node:str='F01',as_of:datetime|None=None,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    scope=scope_for(session,node,as_of,role)
    visible_complaints(session,scope,[identifier])
    result=complaints.patch(session,identifier,command.model_dump(exclude_none=True),scope.as_of,role);session.commit()
    return result

@router.post('/complaints/{identifier}/escalate')
def complaint_escalate(identifier:str,node:str='F01',as_of:datetime|None=None,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    scope=scope_for(session,node,as_of,role)
    visible_complaints(session,scope,[identifier])
    result=complaints.escalate(session,identifier,scope.as_of,role);session.commit()
    return result

@router.post('/complaints/{identifier}/reply-draft')
def complaint_reply(identifier:str,node:str='F01',as_of:datetime|None=None,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    scope=scope_for(session,node,as_of,role)
    visible_complaints(session,scope,[identifier])
    result=complaints.reply_draft(session,identifier,scope.as_of,role);session.commit()
    return result

@router.post('/complaints/{identifier}/resolve')
def complaint_resolve(identifier:str,command:ComplaintChange,node:str='F01',as_of:datetime|None=None,role:Role=Header(default='staff',alias='X-Role'),session:Session=Depends(get_session)):
    scope=scope_for(session,node,as_of,role)
    visible_complaints(session,scope,[identifier])
    changes={**command.model_dump(exclude_none=True),'status':'resolved'}
    result=complaints.patch(session,identifier,changes,scope.as_of,role);session.commit()
    return result
