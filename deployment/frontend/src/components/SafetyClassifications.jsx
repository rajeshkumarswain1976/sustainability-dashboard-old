import React from 'react';
import {api} from '../services/client';
import {useScopedResource} from '../services/useScopedResource';
import ResourceState from './ResourceState';
export default function SafetyClassifications() {
  const resource=useScopedResource(scope=>api.safetyClassifications(scope));
  const rows=resource.data?.classifications||[];
  return <section className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 space-y-3"><h3 className="text-sm font-bold text-white">Incident decisions</h3><p className="text-xs text-dark-400">Type, severity and confidence recorded by the decision pipeline. Original incident descriptions remain in the dataset.</p><ResourceState {...resource} retry={resource.reload} empty={!rows.length}><div className="space-y-3">{rows.map(item=><article key={item.alert_id} className="text-xs bg-[#191A24] p-3 rounded-lg"><p className="text-white">{item.incident_id} · {item.type||'Type needs review'} · {item.severity||'Severity needs review'}</p><p className="text-dark-400 mt-1">{item.confidence!=null?`${(item.confidence*100).toFixed(1)}% confidence`:'Confidence unavailable'}{item.needs_review?' · Head review required':''}</p>{Object.entries(item.decisions||{}).map(([point,decision])=><p key={point} className="text-dark-400 mt-1">{point} · {decision.provider} · {decision.flag||'served'}</p>)}</article>)}</div></ResourceState></section>;
}
