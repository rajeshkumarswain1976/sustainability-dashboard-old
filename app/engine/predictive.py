"""Predictive candidate routing and in-place real-event reconciliation."""
from copy import deepcopy
from datetime import datetime, timedelta
import hashlib
from sqlalchemy import select, update
from app.db import get_table
from app.analytics.common import hour

REAL_TYPES = {'energy_peak': 'energy_spike'}

def real_type(kind):
    kind = kind.removeprefix('predicted_')
    return REAL_TYPES.get(kind, kind)

def pending(session, as_of):
    table = get_table('alerts')
    return [dict(row) for row in session.execute(select(table).where(
        table.c.type.startswith('predicted_', autoescape=True), table.c.status == 'candidate', table.c.created_at <= as_of
    ).order_by(table.c.created_at, table.c.alert_key)).mappings()]

def route_pending(session, node, as_of, snapshot):
    from app.engine.pipeline import _decide_candidate
    allowed = {node}
    allowed.update(candidate['node'] for candidate in snapshot.get('candidates', []))
    for result in snapshot.get('forecasts', {}).values():
        allowed.update(item['entity_id'] for item in result.get('forecasts', []))
    routed = []
    for row in pending(session, as_of):
        if node != 'F01' and row['node_id'] not in allowed:
            continue
        facts = deepcopy(row.get('facts') or {})
        candidate = {'candidate_id': hashlib.sha256(row['alert_key'].encode()).hexdigest()[:24],
                     'domain': row['domain'], 'type': row['type'], 'node': row['node_id'],
                     'ts': hour(row['created_at']).isoformat(), 'facts': facts.get('observations', {}),
                     'context': {**snapshot.get('context', {}), **facts.get('context', {})}}
        alert = {'alert_key': row['alert_key'], 'alert_id': row['alert_id'],
                 'created_at': hour(row['created_at']).isoformat(), 'node': row['node_id'],
                 'domain': row['domain'], 'type': row['type'], 'level': row['level'],
                 'status': row['status'], 'confidence': row['confidence'], 'facts': facts}
        routed.append(_decide_candidate(session, candidate, alert, as_of, snapshot))
    return routed

def reconcile(session, candidate, values, stamp):
    """Replace a matching prediction, retain its primary identity/history, and relink work."""
    table = get_table('alerts')
    rows = session.execute(select(table).where(table.c.node_id == candidate['node'],
                                               table.c.type.startswith('predicted_', autoescape=True), table.c.created_at <= stamp)
                           .order_by(table.c.created_at.desc())).mappings()
    for row in rows:
        if real_type(row['type']) != candidate['type']:
            continue
        original = deepcopy(row.get('facts') or {})
        observations = original.get('observations', {})
        try:
            predicted = hour(datetime.fromisoformat(observations['predicted_time']))
        except (KeyError, TypeError, ValueError):
            continue
        if abs(stamp - predicted) > timedelta(hours=1):
            continue
        history = original.get('history', []) + [{
            'alert_key': row['alert_key'], 'type': row['type'],
            'created_at': hour(row['created_at']).isoformat(), 'level': row['level'],
            'confidence': row['confidence'], 'status': row['status'], 'facts': original.get('observations', {}),
        }]
        values = {**values, 'alert_id': row['alert_id'], 'facts': {**values['facts'], 'history': history}}
        session.execute(update(table).where(table.c.alert_id == row['alert_id']).values(**values))
        actions = get_table('actions')
        session.execute(update(actions).where(actions.c.alert_key == row['alert_key']).values(alert_key=values['alert_key']))
        return values
    return None
