"""Deterministic what-if arithmetic with source inputs and labelled assumptions."""
import math
from app.config import settings
from server.config import configuration
from server.agent.tools import query_domain_metrics
from app.sector.config import load_sector_config

def simulate(session,scope,scenario,parameters):
    if not isinstance(parameters,dict) or set(parameters)-{'reduction_percent','duration_hours'}:
        raise ValueError('Unsupported scenario parameters')
    def parameter(name,upper):
        value=parameters.get(name)
        if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not 0<=value<=upper:
            raise ValueError(f'{name} must be an explicit finite assumption within range')
        return float(value)
    reduction=parameter('reduction_percent',100)/100
    duration=parameter('duration_hours',168) if 'duration_hours' in parameters else None
    domains={'energy_reduction':'energy','water_leak':'water','climate_drains':'climate','parking_relief':'mobility'}
    if scenario not in domains:
        raise ValueError('Unsupported scenario')
    source=query_domain_metrics(session,scope,domains[scenario])
    kpis=source['kpis']
    outcome={'energy_kwh':None,'saving_inr':None,'saving_co2e':None,'water_litres':None,'risk_reduction':None,'time_hours':duration}
    formulas={}
    if scenario=='energy_reduction':
        energy=kpis.get('energy_kwh')
        grid=kpis.get('grid_import_kwh')
        if energy is not None:
            shifted=energy*reduction
            outcome['energy_kwh']=shifted
            outcome['saving_inr']=shifted*settings.tariff_inr_per_kwh
            outcome['saving_co2e']=min(shifted,max(0,grid or 0)*reduction)*settings.grid_ef if grid is not None else None
            formulas={'energy_kwh':'observed energy × assumed reduction fraction','saving_inr':'shifted kWh × configured energy tariff','saving_co2e':'observed grid kWh × assumed reduction fraction × configured grid emission factor'}
    elif scenario=='water_leak':
        litres=kpis.get('water_consumption_litres')
        if litres is not None:
            outcome['water_litres']=litres*reduction
            outcome['saving_inr']=outcome['water_litres']/1000*settings.water_tariff_inr_per_kl
            formulas={'water_litres':'observed water volume × assumed reduction fraction','saving_inr':'litres / 1000 × configured per-kL tariff'}
    elif scenario=='climate_drains':
        risk=kpis.get('flood_risk_mean')
        if risk is not None:
            outcome['risk_reduction']=risk*reduction
            formulas={'risk_reduction':'observed flood-risk score × assumed relative reduction; not a forecast of effectiveness'}
    elif scenario=='parking_relief':
        occupied=kpis.get('parking_occupancy')
        capacity=kpis.get('parking_capacity')
        if occupied is not None and capacity:
            outcome['risk_reduction']=occupied/capacity*reduction
            formulas={'risk_reduction':'observed parking occupancy ratio × assumed redistribution fraction'}
    return {'scenario':scenario,'source':source,'assumptions':parameters,'outcome':outcome,'formulas':formulas,'classification':'what_if_assumption','not_measured_future':True}

def compare(options,role='head'):
    weights=dict(load_sector_config().get('agent_objective',configuration()['comparison']['weights']))
    if role!='head':
        weights.pop('saving_inr',None)
    active={key:weight for key,weight in weights.items() if any(isinstance(option.get('outcome',{}).get(key),(int,float)) for option in options)}
    total=sum(active.values())
    ranked=[]
    for option in options:
        score=0.0
        for key,weight in active.items():
            maximum=max(max(0,float(item['outcome'].get(key) or 0)) for item in options)
            value=max(0,float(option['outcome'].get(key) or 0))
            score+=(value/maximum if maximum else 0)*weight/total if total else 0
        unavailable=[key for key in weights if option.get('outcome',{}).get(key) is None]
        ranked.append({**option,'comparison_score':score,'trade_offs':{'available_objectives':list(active),'unavailable_objectives':unavailable,
            'implementation_time':'explicit assumption' if option.get('outcome',{}).get('time_hours') is not None else 'not available from source',
            'risk_effect':'assumed relative reduction' if option.get('outcome',{}).get('risk_reduction') is not None else 'not evaluated'}})
    return {'weights':active,'options':sorted(ranked,key=lambda item:item['comparison_score'],reverse=True)[:int(configuration()['comparison']['top_k'])]}
