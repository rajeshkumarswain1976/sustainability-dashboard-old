"""Serve the existing backend with a read-only history endpoint for trend charts."""
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta

backend_root = Path(os.environ.get('DASHBOARD_BACKEND_ROOT', Path(__file__).resolve().parents[2] / 'sustainability-dashboard-old'))
sys.path.insert(0, str(backend_root))
sys.path.insert(1, str(Path(__file__).resolve().parents[1]))

import pandas as pd
from fastapi import Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.main import app
from app.db import get_session
from app.analytics.repository import fetch_frame, resolve_scope
from app.analytics.metrics import sustainability_score
from app.api.routes import _normalize_time
from app import replay_calendar

# Explicit allowlist: clients cannot query arbitrary source tables or columns.
SOURCES = {
    'energy': ('energy_building_hourly', 'building_id', ['energy_kwh', 'peak_demand_kw']),
    'water': ('water_hourly', 'meter_id', ['water_consumption_litres']),
    'waste': ('waste_hourly', 'bin_id', ['waste_weight', 'fill_percentage']),
    'mobility': ('traffic_parking', 'gate_id', ['parking_occupancy', 'vehicle_count', 'delay_min']),
    'air': ('air_environment', 'zone_id', ['aqi_cpcb', 'pm25', 'pm10', 'no2']),
    'climate': ('climate_resilience', 'zone_id', ['heat_risk', 'flood_risk']),
    'weather': ('weather', 'facility_id', ['temperature', 'humidity', 'rainfall', 'wind_speed']),
    'assets': ('assets_equipment', 'asset_id', ['vibration']),
    'safety': ('safety_incidents', 'area_id', ['incident_count']),
    'sustainability': ('sustainability', None, ['sustainability_score']),
    'emissions': ('emissions', 'building_id', ['total_co2e', 'energy_co2e', 'mobility_co2e', 'waste_co2e']),
}

@app.get('/history/{domain}')
def history(domain: str, metric: str, node: str = 'F01', as_of: datetime | None = None,
            horizon: str = Query('24h', pattern='^(24h|7d)$'), start: datetime | None = None,
            end: datetime | None = None, session: Session = Depends(get_session)):
    if domain not in SOURCES or metric not in SOURCES[domain][2]:
        raise HTTPException(422, 'Unsupported history metric')
    cutoff = _normalize_time(as_of) if as_of else replay_calendar.now_ist()
    table, entity_key, _ = SOURCES[domain]
    daily = horizon == '7d' or domain in {'safety', 'sustainability'}
    start = _normalize_time(start) if start else (cutoff - timedelta(days=7 if daily else 3)).replace(minute=0, second=0, microsecond=0)
    end = min(_normalize_time(end), cutoff) if end else cutoff
    if end < start:
        raise HTTPException(422, 'end must not be earlier than start')
    first_available, last_available = replay_calendar.bounds()
    start, end = max(start, first_available), min(end, last_available)
    if start > end:
        return {'domain': domain, 'metric': metric, 'as_of': cutoff.isoformat(), 'history': []}
    try:
        _, selected_scope = resolve_scope(session, node)
        if domain == 'energy' and selected_scope.get('level') == 'floor':
            table, entity_key = 'energy_floor_hourly', 'floor_id'
        frame = fetch_frame(session, table, node, start, end, cutoff)
    except KeyError as exc:
        raise HTTPException(404, 'Location was not found') from exc
    output = []
    if domain == 'safety':
        registry = fetch_frame(session, 'registry_outdoor_areas', node, start, cutoff, cutoff)
        areas = sorted(set(registry.get('area_id', pd.Series(dtype=str)).dropna().astype(str)) |
                       set(frame.get('area_id', pd.Series(dtype=str)).dropna().astype(str)))
        dates = pd.date_range(pd.Timestamp(start).normalize(), pd.Timestamp(end).normalize(), freq='D')
        for area in areas:
            incidents = frame[frame['area_id'].astype(str) == area] if not frame.empty else frame
            counts = pd.to_datetime(incidents['timestamp']).dt.floor('D').value_counts() if not incidents.empty else pd.Series(dtype=float)
            output.append({'entity_id': area, 'series': [{'timestamp': day.isoformat(), 'value': float(counts.get(day, 0))} for day in dates]})
        return {'domain': domain, 'metric': metric, 'as_of': cutoff.isoformat(), 'history': output}
    if not frame.empty:
        time_key = next((key for key in ['timestamp', 'date', 'timestamp_start'] if key in frame), None)
        if time_key:
            groups = list(frame.groupby(entity_key)) if entity_key and entity_key in frame else [(node, frame)]
            if domain == 'water':
                groups.insert(0, ('F01', frame))
            for entity, rows in groups:
                rows = rows.copy()
                rows['_time'] = pd.to_datetime(rows[time_key])
                if domain == 'sustainability':
                    values = rows.groupby(rows['_time'].dt.floor('D')).apply(sustainability_score)
                elif metric in rows:
                    rows['_value'] = pd.to_numeric(rows[metric], errors='coerce')
                    operation = 'sum' if metric in {'energy_kwh', 'water_consumption_litres', 'waste_weight', 'vehicle_count', 'rainfall'} or metric.endswith('co2e') else 'max' if metric == 'peak_demand_kw' else 'mean'
                    resampled = rows.set_index('_time')['_value'].resample('D' if daily else 'h')
                    values = resampled.sum(min_count=1) if operation == 'sum' else resampled.agg(operation)
                else:
                    continue
                points = [{'timestamp': time.isoformat(), 'value': float(value)} for time, value in values.items()
                          if pd.notna(value) and float('-inf') < float(value) < float('inf') and time <= cutoff]
                output.append({'entity_id': str(entity), 'series': points})
    return {'domain': domain, 'metric': metric, 'as_of': cutoff.isoformat(), 'history': output}

# Keep the existing analytics API and extend its operational workflow.
from server.integration import install
install(app)
