"""Persistent complaint classification, clustering and head-gated administration."""
from datetime import datetime,timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo
import json
from sqlalchemy import select,insert,update
from fastapi import HTTPException
from app.config import settings
from app.db import get_table
from app.decision import router
from app.engine.scopes import entity_nodes
from app.analytics.repository import resolve_scope
from server.storage import log_complaint_event,tables
from server.config import configuration
from server.agent.language import verified_explanation
from server.rag.search import anonymize_payload

def _stamp(value):
    if value.tzinfo is None:
        value=value.replace(tzinfo=ZoneInfo('Asia/Kolkata'))
    return value.isoformat()

def unpack(row):
    payload=json.loads(row['payload'] or '{}')
    return {**payload,'id':row['complaint_id'],'node':row['node_id'],'status':row['status'],'created_at':_stamp(row['created_at'])}

def _row(session,identifier):
    row=session.execute(select(get_table('complaints')).where(get_table('complaints').c.complaint_id==identifier)).mappings().first()
    if not row:
        raise HTTPException(404,'Complaint was not found')
    return row

def list_complaints(session,node,as_of):
    table=get_table('complaints')
    statement=select(table).where(table.c.created_at<=as_of)
    if node!='F01':
        statement=statement.where(table.c.node_id.in_(entity_nodes(session,node,as_of)))
    items=[unpack(row) for row in session.execute(statement.order_by(table.c.created_at.desc())).mappings()]
    event_table=tables().tables['complaint_events']
    identifiers=[item['id'] for item in items]
    if not identifiers:
        return items
    snapshots={}
    for event in session.execute(select(event_table).where(event_table.c.complaint_id.in_(identifiers),event_table.c.created_at<=as_of)).mappings():
        change=json.loads(event['payload'])
        after=change.get('after') or {}
        if after.get('id')!=event['complaint_id']:
            continue
        order=(_stamp(event['created_at']),change.get('recorded_at',''))
        previous=snapshots.get(event['complaint_id'])
        if previous is None or order>previous[0]:
            snapshots[event['complaint_id']]=(order,after)
    return [snapshots[item['id']][1] if item['id'] in snapshots else item for item in items]

def _store(session,item):
    payload={key:value for key,value in item.items() if key not in {'id','node','created_at','status'}}
    session.execute(update(get_table('complaints')).where(get_table('complaints').c.complaint_id==item['id']).values(
        status=item['status'],payload=json.dumps(payload,default=str)))

def classify(session,item,as_of):
    candidate={'type':'complaint','node':item['node'],'facts':{'text':item['text']},'context':{'reported_at':item['created_at']}}
    decisions=router.decide_many(session,['complaint.category','incident.severity','owner.assign','action.priority'],{
        'complaint':{'text':anonymize_payload(item['text']),'node':item['node']},
        'incident':{'description':anonymize_payload(item['text'])},'candidate':anonymize_payload(candidate),'context':candidate['context'],'action':{'type':'complaint_follow_up'}},as_of)
    category=decisions['complaint.category']
    urgency=decisions['incident.severity']
    owner=decisions['owner.assign']
    priority=decisions['action.priority']
    priority_label=router.label(priority)
    item.update(category=router.label(category),urgency=router.label(urgency),owner=router.label(owner),
        priority=max(0,min(100,float(priority_label)*25)) if priority_label is not None else None,
        confidence=router.probability(category) if router.label(category) is not None else None,
        needs_review=any(decision['flag']=='needs_review' or router.probability(decision)<0.8 for decision in decisions.values()),
        decisions={point:{'provider':decision['provider'],'flag':decision['flag'],'label':router.label(decision),'confidence':router.probability(decision)} for point,decision in decisions.items()})
    return item

def submit(session,node,text,as_of,role):
    _,scope=resolve_scope(session,node)
    recent=[row for row in list_complaints(session,node,as_of) if datetime.fromisoformat(row['created_at'])>=as_of-timedelta(minutes=configuration()['complaints']['submission_window_minutes']) and row.get('submitted_role')==role]
    if len(recent)>=configuration()['complaints']['max_submissions_per_window']:
        raise HTTPException(429,'Complaint submission limit reached for this location and role')
    identifier=str(uuid4())
    item={'id':identifier,'node':node,'created_at':as_of.isoformat(),'text':text,'status':'open',
        'building':scope.get('building_id'),'cluster_id':identifier,'reply':None,'linked_alert':None,'action_id':None,'source':'submitted','submitted_role':role}
    classify(session,item,as_of)
    if not item['building']:
        item['needs_review']=True
    window=timedelta(hours=float(configuration()['complaints']['cluster_window_hours']))
    clusters={}
    for previous in list_complaints(session,'F01',as_of):
        previous_time=datetime.fromisoformat(previous['created_at'])
        if item['building'] and previous.get('building')==item['building'] and previous_time>=as_of-window and previous.get('category')==item['category'] and previous['status'] not in {'resolved','rejected'}:
            clusters.setdefault(previous.get('cluster_id',previous['id']),previous)
    for cluster_id,previous in list(clusters.items())[:int(configuration()['complaints']['cluster_alert_count'])]:
        decision=router.decide_many(session,['complaint.cluster'],anonymize_payload({'complaint':item,'cluster':previous}),as_of)['complaint.cluster']
        if router.label(decision)=='true' and router.probability(decision)>=0.8 and decision['flag']!='needs_review':
            item['cluster_id']=cluster_id
            break
        if decision['flag']=='needs_review' or router.probability(decision)<0.8:
            item['needs_review']=True
    session.execute(insert(get_table('complaints')).values(complaint_id=identifier,created_at=as_of,node_id=node,status='open',payload='{}'))
    _store(session,item)
    log_complaint_event(session,identifier,role,'submitted',None,item,as_of)
    correlate_cluster(session,item,as_of)
    return item

def correlate_cluster(session,item,as_of):
    if not item.get('building'):
        return None
    window=timedelta(hours=float(configuration()['complaints']['cluster_window_hours']))
    members=[row for row in list_complaints(session,'F01',as_of) if row.get('cluster_id')==item['cluster_id'] and row['status'] not in {'resolved','rejected'} and datetime.fromisoformat(row['created_at'])>=as_of-window]
    if len(members)<int(configuration()['complaints']['cluster_alert_count']):
        return None
    table=get_table('alerts')
    scope_nodes=entity_nodes(session,f"building:{item['building']}",as_of)
    if item.get('building'):
        scope_nodes=scope_nodes|{item['building'],f"building:{item['building']}"}
    existing=session.execute(select(table).where(table.c.node_id.in_(scope_nodes),table.c.domain==item.get('category'),
        table.c.created_at>=as_of-window,table.c.created_at<=as_of,table.c.status.in_(['open','needs_review','pending_agent'])).order_by(table.c.created_at.desc())).mappings().first()
    if existing:
        key=existing['alert_key']
        facts={**(existing['facts'] or {}),'complaints':{'ids':[member['id'] for member in members],'count':len(members),'cluster_id':item['cluster_id']}}
        session.execute(update(table).where(table.c.alert_key==key).values(facts=facts))
        action_table=get_table('actions')
        if item.get('priority') is not None:
            for action in session.execute(select(action_table).where(action_table.c.alert_key==key)).mappings():
                session.execute(update(action_table).where(action_table.c.action_id==action['action_id']).values(priority=max(action['priority'] or 0,item['priority'])))
    else:
        key=f"complaint_cluster|{item['cluster_id']}"
        known=session.execute(select(table.c.alert_key).where(table.c.alert_key==key)).first()
        if not known:
            decision=router.decide_many(session,['alert.level'],{'candidate':{'type':'complaint_cluster','node':item['node'],'facts':{'complaint_count':len(members),'urgency':item.get('urgency')}},'context':{},'forecasts':{}},as_of)['alert.level']
            level=router.label(decision)
            confidence=router.probability(decision) if level else None
            session.execute(insert(table).values(alert_id=str(uuid4()),alert_key=key,created_at=as_of,node_id=item['node'],domain=item.get('category') or 'complaints',type='complaint_cluster',
                level=level,confidence=confidence,status='needs_review' if item['needs_review'] or decision['flag']=='needs_review' or (confidence or 0)<0.8 else 'open',
                facts={'observations':{'complaint_count':len(members),'cluster_id':item['cluster_id']},'context':{},'complaints':{'ids':[member['id'] for member in members]}}))
    for member in members:
        before=dict(member)
        member['linked_alert']=key
        _store(session,member)
        log_complaint_event(session,member['id'],'system','alert_linked',before,member,as_of)
    item['linked_alert']=key
    return key

def patch(session,identifier,changes,as_of,role):
    before=unpack(_row(session,identifier))
    item=dict(before)
    if set(changes)-{'status','owner','category','urgency','priority','resolution_notes','reply'}:
        raise HTTPException(422,'Unsupported complaint changes')
    if any(key in changes for key in ('category','urgency','priority')) and role!='head':
        raise HTTPException(403,'Label and priority overrides require a head')
    status=changes.get('status',item['status'])
    if status not in configuration()['complaints']['statuses']:
        raise HTTPException(422,'Unsupported complaint status')
    if status=='rejected' and role!='head':
        raise HTTPException(403,'Rejection requires a head')
    high=item.get('urgency') in configuration()['complaints']['high_urgency'] or item.get('needs_review')
    if status=='resolved' and high and role!='head':
        raise HTTPException(403,'High-urgency or needs-review resolution requires a head')
    if status=='resolved' and not (changes.get('resolution_notes') or item.get('resolution_notes')):
        raise HTTPException(422,'Resolution notes are required')
    if 'owner' in changes and changes['owner'] not in router.jev.catalogue()['decisions']['owner.assign']['options']:
        raise HTTPException(422,'Unknown owner')
    if 'category' in changes and changes['category'] not in router.jev.catalogue()['decisions']['complaint.category']['options']:
        raise HTTPException(422,'Unknown category')
    if 'urgency' in changes and changes['urgency'] not in router.jev.catalogue()['decisions']['incident.severity']['options']:
        raise HTTPException(422,'Unknown urgency')
    if 'priority' in changes and (isinstance(changes['priority'],bool) or not isinstance(changes['priority'],(int,float)) or not 0<=changes['priority']<=100):
        raise HTTPException(422,'Priority must be between zero and one hundred')
    item.update(changes)
    if any(key in changes for key in ('category','urgency','priority')):
        item['classification_source']='human_override'
        item['confidence']=None
    _store(session,item)
    log_complaint_event(session,identifier,role,'updated',before,item,as_of)
    from server.campus_service import on_dashboard_change
    on_dashboard_change(session,before,item)
    return item

def merge(session,identifiers,as_of,role):
    if role!='head':
        raise HTTPException(403,'Merge requires a head')
    items=[unpack(_row(session,identifier)) for identifier in identifiers]
    if len(items)<2 or len({item.get('building') for item in items})!=1:
        raise HTTPException(422,'Merge requires complaints in the same building')
    cluster=items[0]['cluster_id']
    for item in items:
        before=dict(item)
        item['cluster_id']=cluster
        _store(session,item)
        log_complaint_event(session,item['id'],role,'merged',before,item,as_of)
    correlate_cluster(session,items[0],as_of)
    return items

def split(session,identifiers,as_of,role):
    if role!='head':
        raise HTTPException(403,'Split requires a head')
    output=[]
    for identifier in identifiers:
        item=unpack(_row(session,identifier));before=dict(item)
        item['cluster_id']=str(uuid4());item['linked_alert']=None;_store(session,item)
        log_complaint_event(session,identifier,role,'split',before,item,as_of);output.append(item)
    return output

def reply_draft(session,identifier,as_of,role):
    item=unpack(_row(session,identifier))
    template='Thank you for reporting this campus issue. The operational team will review the recorded complaint and provide an update after verification.'
    result=verified_explanation({'complaint':item},[],template)
    log_complaint_event(session,identifier,role,'reply_drafted',None,result,as_of)
    return result

def escalate(session,identifier,as_of,role):
    item=unpack(_row(session,identifier))
    if item.get('action_id'):
        return {'action_id':item['action_id'],'already_exists':True}
    category=item.get('category')
    types={'energy':'review_energy_spike','water':'investigate_leak','waste':'dispatch_waste_collection','air':'inspect_air_quality','assets':'schedule_maintenance','mobility':'manage_parking','safety':'respond_safety_incident'}
    if category not in types:
        raise HTTPException(409,'A verified operational category is required before escalation')
    before=dict(item)
    key=item.get('linked_alert') or f"complaint|{identifier}"
    table=get_table('actions')
    existing=session.execute(select(table.c.action_id).where(table.c.alert_key==key)).first()
    action_id=existing[0] if existing else str(uuid4())
    if not existing:
        session.execute(insert(table).values(action_id=action_id,created_at=as_of,node_id=item['node'],alert_key=key,type=types[category],
            text=f"Review reported {category} complaint",saving_inr=0,saving_co2e=0,priority=item.get('priority'),owner=item.get('owner'),status='open',
            needs_head_approval=int(item.get('needs_review') or item.get('urgency') in configuration()['complaints']['high_urgency']),source='rule',
            payload=json.dumps({'needs_review':item.get('needs_review',True),'complaint_id':identifier,'estimate_available':False})))
    item['action_id']=action_id;_store(session,item)
    log_complaint_event(session,identifier,role,'escalated',before,item,as_of)
    return {'action_id':action_id,'already_exists':bool(existing)}
