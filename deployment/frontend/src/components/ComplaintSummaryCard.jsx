import React from 'react';
import {api} from '../services/client';
import {useScopedResource} from '../services/useScopedResource';
import {useDashboard} from '../context/DashboardContext';
import ResourceState from './ResourceState';
export default function ComplaintSummaryCard() {
  const resource=useScopedResource(scope=>api.complaintSummary(scope));
  const {setCurrentPage}=useDashboard();
  return <section className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 space-y-3"><h3 className="text-sm font-bold text-white">Complaint clusters</h3><ResourceState {...resource} retry={resource.reload}>{resource.data&&<p className="text-xs text-dark-300">{resource.data.open} open reports · {resource.data.clusters} clusters · {resource.data.needs_review} need review</p>}</ResourceState><button onClick={()=>setCurrentPage('complaints')} className="text-xs text-brand-orange underline">Manage complaint reports</button></section>;
}
