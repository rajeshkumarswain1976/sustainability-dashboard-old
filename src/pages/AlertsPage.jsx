import React from 'react';
import { useDashboard } from '../context/DashboardContext';

export default function AlertsPage() {
  const { notifications, decisionQueue, filters, dashboardData } = useDashboard();
  const counts = dashboardData?.overview?.alertCounts || { open: notifications.length, critical: 0, needsReview: decisionQueue.length };
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-mono text-dark-400 mb-1">{filters.location} ▾ › Alert history</div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Alerts</h1>
        <p className="text-sm text-dark-300 mt-1">Historical replay signals after decision review.</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          ['Open alerts', counts.open], ['Critical', counts.critical], ['Needs review', counts.needsReview],
        ].map(([label, count]) => <div key={label} className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">{label}</div>
          <div className="text-3xl font-extrabold text-white mt-1">{count}</div>
        </div>)}
      </div>
      <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark space-y-3">
        <h2 className="text-sm font-bold text-white">Alert list</h2>
        {notifications.length === 0 && <p className="text-xs text-dark-400">No alerts at this replay time.</p>}
        {notifications.map(item => <div key={item.id} className="p-3 bg-[#181A23] border border-[#252834] rounded-xl flex justify-between gap-4 text-xs">
          <div><div className="font-bold text-white">{item.title}</div><div className="text-dark-400 mt-1">{item.meta}</div></div>
          <div className="text-right whitespace-nowrap"><div className="text-brand-orange font-semibold">{item.badge}</div>
            <div className="text-dark-400">{item.confidence == null ? 'Needs review' : `${Math.round(item.confidence * 100)}% confidence`}</div></div>
        </div>)}
      </div>
      {decisionQueue.length > 0 && <div className="bg-[#14151B] border border-amber-500/30 rounded-2xl p-5 shadow-card-dark">
        <h2 className="text-sm font-bold text-amber-400">Decision queue · {decisionQueue.length}</h2>
        {decisionQueue.map(item => <div key={item.alert_key} className="text-xs text-dark-300 mt-2">{item.type.replace(/_/g, ' ')} · {item.node} · {item.status}</div>)}
      </div>}
    </div>
  );
}
