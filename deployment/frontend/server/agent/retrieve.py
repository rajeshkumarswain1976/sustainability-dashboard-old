from app.config import settings
from server.config import configuration
from server.rag.search import search

def retrieve(session,candidate,snapshot,as_of):
    terms=[candidate['domain'],candidate['type'].replace('_',' ')]
    related=set()
    for alert in snapshot.get('open_alerts',[]):
        if alert.get('domain')!=candidate['domain']:
            terms.extend([alert.get('domain',''),alert.get('type','').replace('_',' ')])
            related.add(alert.get('domain'))
    if any(float(row.get('rainfall') or 0)>0 for row in snapshot.get('weather',[])):
        terms.extend(['heavy rain readiness','water leak'])
        related.add('climate')
    query=' '.join(terms)
    count=int(configuration()['retrieval']['top_k'])
    result=search(session,query,settings.sector,snapshot['node'],as_of,limit=count*3)
    chosen=[]
    for domain in [candidate['domain'],*sorted(related)]:
        match=next((item for item in result['results'] if domain in str(item.get('domain','')).split(',') and item not in chosen),None)
        if match:chosen.append(match)
    chosen=(chosen+[item for item in result['results'] if item not in chosen])[:count]
    return {**result,'query':query,'results':chosen}
