"""Observe, retrieve, applicability, simulate, compare and verified explanation."""
from datetime import datetime
import json
from sqlalchemy import select,update
from app.config import settings
from app.db import get_table
from app.decision import router
from app.engine.actions import create_action
from app.engine.predictive import real_type
from server.agent.tools import Scope,redact_financial
from server.agent.simulation import simulate,compare
from server.agent.language import verified_explanation
from server.agent.retrieve import retrieve
from server.agent.applicability import check_applicability
from server.config import configuration

def candidate_from_alert(alert):
    facts=alert.get('facts') or {}
    return {'candidate_id':alert['alert_id'],'domain':alert['domain'],'type':alert['type'],
        'node':alert['node'],'ts':alert['created_at'],'facts':facts.get('observations',{}),'context':facts.get('context',{})}

def process_candidate(session,candidate,alert,snapshot):
    """One source-backed recommendation per stable alert identity."""
    action_table=get_table('actions')
    existing=session.execute(select(action_table).where(action_table.c.alert_key==alert['alert_key'])).mappings().first()
    previous_payload=json.loads(existing.get('payload') or '{}') if existing else {}
    if existing and previous_payload.get('agent',{}).get('alert_key')==alert['alert_key']:
        return {'status':'already_processed','action_id':existing['action_id']}
    as_of=datetime.fromisoformat(snapshot['as_of'])
    retrieval=retrieve(session,candidate,snapshot,as_of)
    checked=check_applicability(session,candidate,snapshot,retrieval['results'],as_of)
    applicability=checked['checks']
    relevant=checked['applicable']
    facts=candidate['facts']
    actual=real_type(candidate['type'])
    scenarios={'energy_spike':'energy_reduction','water_leak':'water_leak','tank_low':'water_leak','flood_risk':'climate_drains','heavy_rain':'climate_drains','parking_high':'parking_relief','congestion':'parking_relief'}
    options=[]
    observed=facts.get('energy_kwh')
    baseline=facts.get('hour_of_week_median_kwh')
    excess=max(0,observed-baseline) if isinstance(observed,(int,float)) and isinstance(baseline,(int,float)) else None
    if actual in scenarios and (actual!='energy_spike' or (excess is not None and observed)):
        reduction=min(100,max(0,excess/observed*100)) if actual=='energy_spike' else 100
        for fraction in configuration()['comparison']['intervention_fractions']:
            parameters={'reduction_percent':reduction*float(fraction)}
            options.append(simulate(session,Scope(snapshot['node'],as_of,'head',as_of,as_of),scenarios[actual],parameters))
    ranking=compare(options)
    template=f"Review the recorded {actual.replace('_',' ')} at {candidate['node']}. Verify the source readings and local procedure before an intervention. Head review is required when applicability or assignment is uncertain."
    verified={'candidate':candidate,'alert_level':alert.get('level'),'comparison':ranking,'applicability':applicability,
        'applicable_clauses':[{'source':item['source'],'content':item['content'],'clause_number':item.get('clause_number')} for item in relevant]}
    explanation=verified_explanation(verified,[{'source':item['source'],'content':item['content'],'placeholder':item['placeholder']} for item in relevant],template) if relevant else {
        'text':'No applicable procedure was verified. Review the recorded issue and obtain an approved local procedure before intervention.',
        'source':'template','number_check':{'passed':True,'unsupported_numbers':[]},'reason':'no_applicable_source'}
    assignments=router.decide_many(session,['owner.assign','action.priority'],{
        **snapshot,'candidate':candidate,'context':candidate['context'],'action':{'type':actual,'comparison':ranking,'explanation':explanation['text']}},as_of)
    routed={**candidate,'type':actual}
    if actual=='energy_spike':
        reading=next((row for row in snapshot.get('domains',{}).get('energy',{}).get('current',[]) if str(row.get('building_id'))==candidate['node']),{})
        routed['facts']={**facts,'grid_import_kwh':reading.get('grid_import_kwh',facts.get('grid_import_kwh'))}
    action=create_action(session,routed,alert['alert_key'],alert.get('level') or 'Warning',as_of,assignments)
    needs_review=not relevant or any(item['flag'] or item['confidence']<0.8 for item in applicability) or any(item.get('placeholder') for item in relevant)
    trace={'stage':'complete','alert_key':alert['alert_key'],'retrieval_method':retrieval['method'],'sources':[item['source'] for item in relevant],
        'source_details':[{'id':item['source'],'title':item.get('title',item['heading']),'clause':item.get('clause_number'),'score':item['score']} for item in relevant],
        'stages':['observe','retrieve','check_applicability','simulate','compare','explain'],
        'why':'Applicable clauses and verified scenario outcomes support this recommendation; generic procedures require local approval.' if relevant else 'No source: no applicable clause passed the confidence gate.',
        'applicability':applicability,'comparison':ranking,'explanation':explanation,'needs_review':needs_review}
    if action:
        payload={**previous_payload,'needs_review':needs_review or action['needs_review'],'agent':trace}
        session.execute(update(action_table).where(action_table.c.action_id==action['id']).values(source='agent',
            text=explanation['text'],needs_head_approval=int(needs_review or action['needs_head_approval']),payload=json.dumps(payload,default=str)))
        session.execute(update(get_table('alerts')).where(get_table('alerts').c.alert_key==alert['alert_key']).values(
            status='needs_review' if payload['needs_review'] else 'open',facts={**alert['facts'],'agent':trace}))
        return {'status':'needs_review' if payload['needs_review'] else 'open','action_id':action['id'],'trace':trace}
    session.execute(update(get_table('alerts')).where(get_table('alerts').c.alert_key==alert['alert_key']).values(status='needs_review',facts={**alert['facts'],'agent':trace}))
    return {'status':'needs_review','action_id':None,'trace':trace}

def explain_routine(session,alert):
    table=get_table('actions')
    row=session.execute(select(table).where(table.c.alert_key==alert['alert_key'])).mappings().first()
    if not row:
        return None
    payload=json.loads(row.get('payload') or '{}')
    if 'explanation' in payload:
        return payload['explanation']
    verified={key:row[key] for key in ['text','saving_inr','saving_co2e','owner','priority','needs_head_approval']}
    explanation=verified_explanation(verified,[],row['text'])
    payload['explanation']=explanation
    session.execute(update(table).where(table.c.action_id==row['action_id']).values(text=explanation['text'],payload=json.dumps(payload)))
    return explanation
