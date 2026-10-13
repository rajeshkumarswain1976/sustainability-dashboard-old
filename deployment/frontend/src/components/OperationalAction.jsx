import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { USE_MOCK } from '../services/client';
import VerifiedResults from './VerifiedResults';

const types = {
  energy: ['review_energy_spike'], water: ['investigate_leak'], waste: ['dispatch_waste_collection'],
  air: ['inspect_air_quality'], assets: ['schedule_maintenance'], mobility: ['manage_parking'],
  safety: ['respond_safety_incident'], climate: ['check_drains', 'prepare_heat_response'],
};
export default function OperationalAction({ domain, sample, className }) {
  const { actions = [], setCurrentPage, dashboardData, isLoading } = useDashboard();
  if (USE_MOCK) return sample;
  const action = actions.find(item => types[domain]?.includes(item.type) && !['done', 'closed', 'cancelled'].includes(item.status));
  return <section className={className} aria-label={`${domain} action recommendation`}>
    <span className="text-[10px] font-semibold text-brand-orange uppercase tracking-wider">Recommended next step</span>
    <h3 className="text-base font-bold text-white mt-1">{action?.text || (isLoading && !dashboardData ? 'Loading recommendations…' : `No ${domain} action recommended`)}</h3>
    {action ? <div className="text-xs text-dark-300 space-y-2 mt-3">
      <p>Owner: {action.owner || 'Needs review'} · Priority: {action.priority ?? 'Needs review'}</p>
      <p>Event saving: {action.estimate_available!==false&&Number.isFinite(action.saving_inr) ? `₹${action.saving_inr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : 'Not available'}</p>
      <p>{action.needs_review ? 'Needs review' : action.status.replaceAll('_', ' ')}{action.needs_head_approval ? ' · Head approval required' : ''}</p>
      {action.explanation?.why&&<p><strong>Why:</strong> {action.explanation.why}</p>}
      {(action.explanation?.source_details||[]).map(source=><span key={source.id} title={`Retrieval score: ${source.score}`} className="inline-block mr-2 px-2 py-1 rounded-full bg-[#262835] text-[10px]">{source.title} · clause {source.clause}</span>)}
      {action.explanation?.comparison?.options?.length>0&&<details><summary className="cursor-pointer">Alternatives and trade-offs</summary><VerifiedResults value={action.explanation.comparison}/></details>}
    </div> : <p className="text-xs text-dark-400 mt-2">No active work order is available for this location and snapshot.</p>}
    <button onClick={() => setCurrentPage('actions')} className="mt-4 px-4 py-2 rounded-lg bg-brand-orange text-white text-xs">View Actions Queue</button>
  </section>;
}
