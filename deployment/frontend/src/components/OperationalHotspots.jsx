import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { USE_MOCK } from '../services/client';
export default function OperationalHotspots({ sample, className }) {
  const { notifications = [], setCurrentPage } = useDashboard();
  if (USE_MOCK) return sample;
  return <section className={className} aria-label="Operational hotspots">
    <h3 className="text-sm font-bold text-white">Operational hotspots</h3>
    <div className="mt-3 space-y-2">
      {notifications.length ? notifications.map(item => <button key={item.alertId || item.id} onClick={() => setCurrentPage(item.page)} className="block w-full p-3 bg-[#191A23] border border-[#252834] rounded-lg text-left text-xs">
        <strong className="text-white">{item.title}</strong><p className="mt-1 text-dark-300">{item.meta} · {item.badge}{item.confidence != null ? ` · ${Math.round(item.confidence * 100)}%` : ''}</p>
      </button>) : <p className="text-xs text-dark-400">No active alert hotspots are available for this location and snapshot.</p>}
    </div>
    <p className="mt-3 text-[11px] text-dark-400">{notifications.length} active alerts · locations from recorded alerts</p>
  </section>;
}
