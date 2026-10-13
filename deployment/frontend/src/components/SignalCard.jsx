import React,{useState} from 'react';
import {api} from '../services/client';
import {useScopedResource} from '../services/useScopedResource';
import {useDashboard} from '../context/DashboardContext';
import ResourceState from './ResourceState';
export default function SignalCard({domain}) {
  const {currentUser,refreshOperational,setCurrentPage}=useDashboard();
  const resource=useScopedResource(scope=>Promise.all([api.alerts(scope),api.forecastRisks(scope)]).then(([alerts,forecast])=>({alerts:alerts.alerts,risks:forecast.risks})));
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const alert=resource.data?.alerts.filter(item=>item.domain===domain&&['open','needs_review','pending_agent'].includes(item.status)).at(-1);
  const risks=resource.data?.risks.filter(item=>item.domain===domain)||[];
  const review=async()=>{setBusy(true);try{await api.markAlertReview(alert.alert_id,resource.scope);resource.reload();await refreshOperational();}catch(failure){setError(failure.message);}finally{setBusy(false);}};
  return <section className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 space-y-3" aria-label={`${domain} signal`}><h3 className="text-sm font-bold text-white">Signal detected</h3><ResourceState {...resource} retry={resource.reload}>{alert?<div className="text-xs space-y-2"><strong>{alert.type.replaceAll('_',' ')} · {alert.node}</strong><p>{alert.level||'Level needs review'} · {alert.status.replaceAll('_',' ')}{alert.confidence!=null?` · ${(alert.confidence*100).toFixed(1)}% confidence`:''}</p><p className="text-dark-400">{new Date(alert.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p>{currentUser.key!=='staff'&&<button disabled={busy} onClick={review} className="text-brand-orange underline">Mark for review</button>}<button onClick={()=>setCurrentPage('alerts')} className="ml-3 underline">View evidence</button></div>:<p className="text-xs text-dark-400">No active signal at this location and replay hour.</p>}</ResourceState>{risks.map(item=><p key={`${item.type}-${item.node}-${item.predicted_time}`} className="text-xs text-amber-300">Forecast watch · {item.type.replaceAll('_',' ')} · {item.node} · {new Date(item.predicted_time).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST · {item.lead_time_hours}h lead</p>)}{error&&<p role="alert" className="text-xs text-rose-300">{error}</p>}</section>;
}
