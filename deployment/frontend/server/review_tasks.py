"""Recover human review work from recorded alerts without any provider calls."""
import json
from sqlalchemy import select, update
from app.db import get_table
from app.engine.actions import create_action
from app.engine.predictive import real_type

def recover_review_tasks(session):
    alerts, actions = get_table('alerts'), get_table('actions')
    count = 0
    for row in session.execute(select(alerts).where(alerts.c.status == 'needs_review')).mappings():
        if session.execute(select(actions.c.action_id).where(actions.c.alert_key == row['alert_key'])).first():
            continue
        facts = row['facts'] or {}
        candidate = {'candidate_id': row['alert_id'], 'type': real_type(row['type']),
            'node': row['node_id'], 'facts': facts.get('observations', {}), 'context': facts.get('context', {})}
        review = {point: {'answer': None, 'flag': 'needs_review', 'provider': 'unavailable'}
                  for point in ('owner.assign', 'action.priority')}
        action = create_action(session, candidate, row['alert_key'], row['level'] or 'Warning', row['created_at'], review)
        if action:
            session.execute(update(actions).where(actions.c.action_id == action['id']).values(
                text=f"Review unverified {candidate['type'].replace('_', ' ')} at {candidate['node']}",
                payload=json.dumps({'needs_review': True, 'estimate_available': False,
                    'review_reason': 'Recorded alert requires a human decision before assignment.'})))
            count += 1
    session.commit()
    return count
