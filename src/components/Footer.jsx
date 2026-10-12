import React from 'react';
import { Database, ShieldCheck } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

export default function Footer() {
  const { organizationName, selectedWorld } = useDashboard();
  const sectorLabel = selectedWorld === 'enterprise'
    ? 'Enterprise & civic operations'
    : selectedWorld === 'hospital' ? 'Healthcare operations' : 'Sustainability operations';

  return (
    <footer className="mt-8 pt-4 pb-6 border-t border-[#1C1E26] text-xs text-dark-400 flex flex-col md:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Database className="w-3.5 h-3.5 text-brand-orange" />
        <span>{organizationName} · {sectorLabel} · Illustrative sample data</span>
      </div>
      <div className="flex items-center gap-2 font-mono text-[11px] text-dark-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Reference factors · illustrative sample data</span>
      </div>
    </footer>
  );
}
