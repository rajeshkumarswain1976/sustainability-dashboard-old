"""Resolve Phase 3 alert/action entity identities within a selected location."""
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from app.analytics.repository import resolve_scope, location_tree, fetch_frame

def entity_nodes(session, node, as_of=None):
    try:
        _, target = resolve_scope(session, node)
        tree = location_tree(session, node)
    except KeyError as error:
        raise HTTPException(404, 'Location node was not found') from error
    allowed = {str(row['node_id']) for row in tree}
    for row in tree:
        key = {'building':'building_id','floor':'floor_id','area':'area_id','zone':'zone_id'}.get(row['level'])
        if key and row.get(key): allowed.add(str(row[key]))
    cutoff = as_of or datetime.now(ZoneInfo('Asia/Kolkata'))
    for table, key in [('registry_assets','asset_id'),('registry_bins','bin_id'),('registry_meters','meter_id'),('registry_tanks','tank_id')]:
        rows = fetch_frame(session,table,node,cutoff,cutoff,cutoff)
        required = {'floor':'floor_id','area':'area_id'}.get(target['level'])
        if required and required not in rows:
            continue
        if key in rows: allowed.update(rows[key].dropna().astype(str))
    return allowed
