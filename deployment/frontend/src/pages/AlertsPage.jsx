import React,{useState} from 'react';
import {api} from '../services/client';
import {useScopedResource} from '../services/useScopedResource';
import {useDashboard} from '../context/DashboardContext';
import ResourceState from '../components/ResourceState';
import VerifiedResults from '../components/VerifiedResults';
export default function AlertsPage() {
  const {currentUser,refreshOperational}=useDashboard();
  const resource=useScopedResource(scope=>api.alerts(scope));
  const [filter,setFilter]=useState('active'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const alerts=(resource.data?.alerts||[]).filter(alert=>filter==='all'||['open','needs_review','pending_agent'].includes(alert.status));
  const runAgent=async()=>{setBusy(true);try{const result=await api.runAgent(resource.scope);setMessage(`${result.count} queued items reviewed`);resource.reload();await refreshOperational();}catch(error){setMessage(error.message);}finally{setBusy(false);}};
  return <div className="space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-3xl font-extrabold text-white">Alerts</h1><p className="text-sm text-dark-300 mt-1">Recorded alerts, confidence, predicted lead time and review history.</p></div><select aria-label="Alert filter" value={filter} onChange={event=>setFilter(event.target.value)} className="p-2 rounded-xl bg-[#191A24]"><option value="active">Active</option><option value="all">All recorded</option></select></div>
    {currentUser.key!=='staff'&&<button disabled={busy} onClick={runAgent} className="px-4 py-2 bg-brand-orange rounded-lg text-white text-xs">{busy?'Reviewing…':'Review multi-domain queue'}</button>}
    {message&&<p role="status" className="text-sm text-dark-300">{message}</p>}
    <section className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5">
      <ResourceState {...resource} retry={resource.reload} empty={!alerts.length}>
        <div className="space-y-3">{alerts.map(alert=><article key={alert.alert_id} className="p-4 rounded-xl border border-[#262835] bg-[#191A23]">
          <div className="flex justify-between gap-3"><h3 className="font-bold text-white">{alert.type.replaceAll('_',' ')} · {alert.node}</h3><span className="text-xs text-amber-400">{alert.level||'Needs review'}{alert.confidence!=null?` · ${(alert.confidence*100).toFixed(1)}%`:''}</span></div>
          <p className="text-xs text-dark-300 mt-2">{alert.status.replaceAll('_',' ')} · {new Date(alert.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST{alert.lead_time_hours!=null?` · expected in ${alert.lead_time_hours}h`:''}</p>
          {alert.facts?.history?.length>0&&<details className="mt-3 text-xs text-dark-300"><summary>Prediction and event history</summary>{alert.facts.history.map((entry,index)=><p key={entry.alert_key||index} className="mt-2">{entry.type} · {entry.created_at} · {entry.status}</p>)}</details>}
          {alert.facts?.agent&&<details className="mt-3 text-xs text-dark-300"><summary>Verified recommendation and sources</summary><p className="mt-2">{alert.facts.agent.explanation?.text}</p><p className="mt-2">{alert.facts.agent.sources?.join(' · ')||'No applicable procedure was verified'}</p><details className="mt-3"><summary>Simulated alternatives and applicability</summary><VerifiedResults value={{comparison:alert.facts.agent.comparison,applicability:alert.facts.agent.applicability}}/></details></details>}
        </article>)}</div>
      </ResourceState>
    </section>
  </div>;
}
