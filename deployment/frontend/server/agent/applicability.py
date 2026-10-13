"""Jev decides applicability; code retains every decision and exclusion reason."""
from app.decision import router
from app.decision.jev import request_state

def check_applicability(session,candidate,snapshot,clauses,as_of):
    checks=[];applicable=[]
    facts=request_state(['triage.anomaly','alert.level'],snapshot)
    for clause in clauses:
        decision=router.decide_many(session,['policy.applicability'],{'action':{'candidate':candidate,'snapshot_facts':facts},
            'policy':{'source_id':clause['source'],'clause':clause['content'],'applies_when':clause.get('applies_when'),'generic_placeholder':clause['placeholder']}},as_of)['policy.applicability']
        label=router.label(decision);confidence=router.probability(decision)
        accepted=label=='true' and confidence>=0.8 and decision.get('flag')!='needs_review'
        checks.append({'source':clause['source'],'label':label,'confidence':confidence,'flag':decision.get('flag'),
            'accepted':accepted,'reason':'applies_to_snapshot' if accepted else 'not_applicable' if label=='false' else 'uncertain_or_unavailable'})
        if accepted:applicable.append(clause)
    return {'checks':checks,'applicable':applicable}
