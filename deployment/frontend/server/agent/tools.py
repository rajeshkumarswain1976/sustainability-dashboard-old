"""A fixed tool allowlist bound to the caller's node, role and replay cutoff."""
from dataclasses import dataclass
from datetime import datetime,timedelta
from typing import Any
from app.api import routes
from app.analytics.repository import resolve_scope
from app.sector.config import load_sector_config
from app.replay_calendar import bounds

DOMAINS=('energy','water','waste','air','assets','mobility','safety','climate','sustainability','emissions')

@dataclass(frozen=True)
class Scope:
    node:str
    as_of:datetime
    role:str='staff'
    start:datetime|None=None
    end:datetime|None=None

def redact_financial(value,role):
    if role=='head':
        return value
    if isinstance(value,dict):
        return {key:redact_financial(item,role) for key,item in value.items() if not any(term in key.lower() for term in ('cost','saving_inr','savingrs','tariff','approval'))}
    if isinstance(value,list):
        return [redact_financial(item,role) for item in value]
    return value

def query_domain_metrics(session,scope,domain,start=None,end=None):
    if domain not in DOMAINS or domain not in load_sector_config()['domains']:
        raise ValueError('Unsupported active domain')
    resolve_scope(session,scope.node)
    context=routes.request_context(node=scope.node,start=start or scope.start,end=end or scope.end,as_of=scope.as_of)
    result=getattr(routes,domain)(context=context,session=session)
    # Tools expose analytical output; never expose raw source tables or SQL.
    available=bool(result.get('series',result.get('incidents',[])))
    kpis=result['kpis'] if available else {key:None for key in result['kpis']}
    return redact_financial({'domain':domain,'window':result['window'],'kpis':kpis,'status':'available' if available else 'no_data','data_source':result['data_source']},scope.role)

def compare_periods(session,scope,domain,hours):
    first,last=bounds()
    coverage_hours=int((last-first).total_seconds()/3600)+1
    if isinstance(hours,bool) or not isinstance(hours,int) or not 1<=hours<=coverage_hours:
        raise ValueError('Comparison duration must be within dataset coverage')
    end=scope.as_of
    current=query_domain_metrics(session,scope,domain,end-timedelta(hours=hours),end)
    previous=query_domain_metrics(session,scope,domain,end-timedelta(hours=2*hours),end-timedelta(hours=hours))
    changes={key:current['kpis'][key]-value for key,value in previous['kpis'].items()
        if isinstance(value,(int,float)) and not isinstance(value,bool) and isinstance(current['kpis'].get(key),(int,float))}
    return {'domain':domain,'current':current,'previous':previous,'changes':changes}

def execute_tool(session,scope,name,arguments):
    if name not in load_sector_config()['tools']:
        raise ValueError('Tool is not allowed for the active sector')
    if not isinstance(arguments,dict):
        raise ValueError('Tool arguments must be an object')
    scoped_names={f'get_{domain}':domain for domain in DOMAINS if domain not in {'sustainability','emissions'}}
    scoped_names['get_score']='sustainability'
    additional={'get_alerts','get_forecast','search_knowledge','simulate_action'}
    if name in scoped_names or name in additional:
        expected={'node','start','end','as_of'}
        permitted=expected|({'domain','metric','horizon'} if name=='get_forecast' else {'query'} if name=='search_knowledge' else {'scenario','parameters'} if name=='simulate_action' else set())
        if set(arguments)-permitted:
            raise ValueError('Unsupported tool arguments')
        if arguments.get('node',scope.node)!=scope.node:
            raise ValueError('Tool cannot override location')
        for key in ['start','end','as_of']:
            value=arguments.get(key)
            bound=getattr(scope,key)
            if value is not None and (bound is None or datetime.fromisoformat(value)!=bound):
                raise ValueError('Tool cannot override the reporting window or cutoff')
        if name in scoped_names:
            return query_domain_metrics(session,scope,scoped_names[name])
        if name=='get_alerts':
            from app.engine.pipeline import list_alerts
            return redact_financial({'alerts':list_alerts(session,node=scope.node,as_of=scope.as_of)},scope.role)
        if name=='get_forecast':
            from app.analytics.forecast import forecast
            domain=arguments['domain']
            if domain not in DOMAINS and domain!='weather':raise ValueError('Unsupported forecast domain')
            return redact_financial(forecast(domain,scope.node,scope.as_of,session=session,metric=arguments.get('metric'),horizon=arguments.get('horizon','24h')),scope.role)
        if name=='search_knowledge':
            from server.rag.search import search
            from app.config import settings
            return search(session,arguments['query'],settings.sector,scope.node,scope.as_of)
        from server.agent.simulation import simulate
        return redact_financial(simulate(session,scope,arguments['scenario'],arguments.get('parameters',{})),scope.role)
    allowed={'query_domain_metrics':{'domain'},'compare_periods':{'domain','hours'},'simulate_rule_scenario':{'scenario','parameters'}}
    if name not in allowed or set(arguments)-allowed[name]:
        raise ValueError('Tool arguments cannot override role, node, cutoff or query source')
    if name=='query_domain_metrics':
        return query_domain_metrics(session,scope,arguments['domain'])
    if name=='compare_periods':
        return compare_periods(session,scope,arguments['domain'],arguments['hours'])
    from server.agent.simulation import simulate
    return redact_financial(simulate(session,scope,arguments['scenario'],arguments.get('parameters',{})),scope.role)

def tool_definitions():
    definitions=[
      {'name':'query_domain_metrics','description':'Read verified analytical KPIs at the selected node and replay cutoff.',
       'parameters':{'type':'object','properties':{'domain':{'type':'string','enum':list(DOMAINS)}},'required':['domain'],'additionalProperties':False}},
      {'name':'compare_periods','description':'Compare equal historical windows ending at the selected replay cutoff.',
       'parameters':{'type':'object','properties':{'domain':{'type':'string','enum':list(DOMAINS)},'hours':{'type':'integer','minimum':1}},'required':['domain','hours'],'additionalProperties':False}},
      {'name':'simulate_rule_scenario','description':'Compute a what-if from source KPIs and explicit assumptions, never inventing measured values.',
       'parameters':{'type':'object','properties':{'scenario':{'type':'string','enum':['energy_reduction','water_leak','climate_drains','parking_relief']},'parameters':{'type':'object','properties':{'reduction_percent':{'type':'number','minimum':0,'maximum':100},'duration_hours':{'type':'number','minimum':0,'maximum':168}},'additionalProperties':False}},'required':['scenario','parameters'],'additionalProperties':False}},
    ]
    window={'node':{'type':'string'},'start':{'type':['string','null']},'end':{'type':['string','null']},'as_of':{'type':'string'}}
    named={f'get_{domain}':f'Read verified {domain} KPIs.' for domain in DOMAINS if domain not in {'sustainability','emissions'}}
    named.update(get_score='Read source sustainability factor scores.',get_alerts='Read scoped alerts.',get_forecast='Read source-backed model forecasts.',search_knowledge='Retrieve applicable active-sector clauses.',simulate_action='Calculate a scenario using source metrics and explicit assumptions.')
    for name,description in named.items():
        properties=dict(window);required=list(window)
        if name=='get_forecast':
            properties.update(domain={'type':'string'},metric={'type':'string'},horizon={'type':'string','enum':['24h','7d']});required.append('domain')
        elif name=='search_knowledge':properties['query']={'type':'string'};required.append('query')
        elif name=='simulate_action':
            properties.update(scenario={'type':'string','enum':['energy_reduction','water_leak','climate_drains','parking_relief']},parameters={'type':'object','properties':{'reduction_percent':{'type':'number','minimum':0,'maximum':100}},'required':['reduction_percent'],'additionalProperties':False});required.extend(['scenario','parameters'])
        definitions.append({'name':name,'description':description,'parameters':{'type':'object','properties':properties,'required':required,'additionalProperties':False}})
    allowed=load_sector_config()['tools']
    return [{'type':'function','function':item} for item in definitions if item['name'] in allowed]
