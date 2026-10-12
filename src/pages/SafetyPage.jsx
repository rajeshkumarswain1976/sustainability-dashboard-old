import ForecastPanel from '../components/ForecastPanel';
import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { USE_MOCK } from '../services/client';
import { 
  ShieldAlert, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  MapPin, 
  Clock, 
  ChevronDown
} from 'lucide-react';

export default function SafetyPage({ setCurrentPage }) {
  const { dashboardData, filters } = useDashboard();
  const safety = dashboardData?.safety;
  const [timeRange, setTimeRange] = useState('7d');
  const [viewMode, setViewMode] = useState('table');
  const [actionAssigned, setActionAssigned] = useState(false);

  const hotspots = USE_MOCK ? [
    { loc: 'North Walk · Zone N2', issue: 'Uneven paving · 6 reports', sub: 'Auto-classified: slip hazard', risk: 'High', color: 'text-rose-400 bg-rose-500/15' },
    { loc: 'Science Annex · S1', issue: 'Door access · 4 reports', sub: '', risk: 'Elevated', color: 'text-amber-400 bg-amber-500/15' },
    { loc: 'East Car Park · E4', issue: 'Low lighting · 3 reports', sub: '', risk: 'Elevated', color: 'text-amber-400 bg-amber-500/15' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="text-xs font-mono text-dark-400 mb-1">
          Main Campus ▾ › North Zone › North Walk › Zone N2
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Safety
              <span className="text-xs font-mono bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/20">
                03 High-Risk Zones
              </span>
            </h1>
            <p className="text-sm text-dark-300 mt-1">
              A clear view of reported issues, emerging risk and the inspections that keep campus moving safely.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-400">Reporting period:</span>
            <div className="flex items-center gap-2 bg-[#171821] border border-[#252834] px-3 py-1.5 rounded-xl text-xs text-white font-medium">
              <span>This week</span>
              <ChevronDown className="w-3.5 h-3.5 text-dark-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Open safety reports</div>
          <div className="text-3xl font-extrabold text-white mt-1">{safety?.openReports ?? 0}</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-amber-400">4 need attention · 2 overdue</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">High-risk zones</div>
          <div className="text-3xl font-extrabold text-rose-400 mt-1">03</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-rose-400">2 elevated · 1 newly flagged</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Inspections complete</div>
          <div className="text-3xl font-extrabold text-white mt-1">{safety?.inspectionsPercent ?? 0}%</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-emerald-400">41 of 50 · 9 still pending</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Anomaly signals</div>
          <div className="text-3xl font-extrabold text-white mt-1">02</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-dark-400">1 new today · both under review</div>
        </div>
      </div>

      {/* Middle Grid: Incident Activity vs Hotspots */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Incident Activity Chart (7 cols) */}
        <div className="lg:col-span-7 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
{!USE_MOCK ? <ForecastPanel domain="safety" compact /> : <>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">INCIDENT ACTIVITY</span>
                <span className="text-sm font-bold text-white">Reported issues over time</span>
                <span className="text-[10px] bg-brand-orange/20 text-brand-orange px-1.5 py-0.5 rounded font-mono">2 signals</span>
              </div>
              <div className="flex bg-[#191A24] border border-[#262835] rounded-lg p-0.5 text-xs">
                {['7 days', '30 days', 'Breakdown'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeRange(t.toLowerCase())}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      timeRange === t.toLowerCase() ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-2xl font-black text-white my-1">
              59 <span className="text-xs font-normal text-dark-400">reported in this period · </span>
              <span className="text-xs text-emerald-400 font-mono">−12% vs previous week</span>
            </div>

            {/* SVG Incident Activity Line */}
            <div className="h-44 w-full pt-2">
              <svg viewBox="0 0 500 130" className="w-full h-full overflow-visible">
                <line x1="0" y1="30" x2="500" y2="30" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="70" x2="500" y2="70" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="110" x2="500" y2="110" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>

                <path 
                  d="M0,80 Q90,70 180,90 T320,60 T380,50" 
                  fill="none" 
                  stroke="#FF5500" 
                  strokeWidth="3" 
                />

                <path 
                  d="M380,50 Q430,55 500,52" 
                  fill="none" 
                  stroke="#7E849A" 
                  strokeWidth="2.5" 
                  strokeDasharray="5 5" 
                />

                <circle cx="380" cy="50" r="4.5" fill="#FFFFFF" stroke="#FF5500" strokeWidth="2.5" />
              </svg>
            </div>
          </div>

          <div className="mt-2 text-xs text-dark-400 flex justify-between items-center">
            <span>Today · Fri 9 Oct (dashed = forecast)</span>
            <span className="text-[11px] font-mono">Median response: 2.4 h</span>
          </div>

</>}
</div>

        {/* Hotspots (5 cols) */}
        <div className="lg:col-span-5 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                  REPEAT-ISSUE HOTSPOTS
                </span>
                <h3 className="text-sm font-bold text-white">Where reports return</h3>
              </div>
              <div className="flex bg-[#191A24] border border-[#262835] rounded-lg p-0.5 text-xs">
                <button 
                  onClick={() => setViewMode('table')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    viewMode === 'table' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  Table
                </button>
                <button 
                  onClick={() => setViewMode('map')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    viewMode === 'map' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  Map
                </button>
              </div>
            </div>

            <div className="text-xs text-dark-400 mb-3">
              Three locations account for <strong>61%</strong> of repeat reports.
            </div>

            <div className="space-y-2">
              {hotspots.map((h, i) => (
                <div key={i} className="p-2.5 bg-[#181A23] border border-[#252834] rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white">{h.loc}</div>
                    <div className="text-[11px] text-dark-400">{h.issue}</div>
                    {h.sub && <div className="text-[10px] text-amber-400 font-mono">{h.sub}</div>}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${h.color}`}>{h.risk}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 p-2.5 bg-[#1F1818] border border-[#3E2222] rounded-xl text-xs text-rose-300">
            Zone N2 is newly high-risk. Two trip reports within 48 hours; a walk-through is recommended today.
          </div>
        </div>
      </div>

      {/* Bottom Grid: Routine Assurance vs Recommended Action */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Routine Assurance (5 cols) */}
        <div className="lg:col-span-5 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
              ROUTINE ASSURANCE · WEEK 41
            </span>
            <h3 className="text-sm font-bold text-white mt-1">Inspection status</h3>
            <div className="text-2xl font-black text-white mt-2">
              82% <span className="text-xs font-normal text-emerald-400 font-mono">41 of 50 checks completed · on pace</span>
            </div>

            <div className="space-y-2.5 mt-4">
              <div className="p-2.5 bg-[#181A23] border border-[#252834] rounded-xl flex justify-between items-center text-xs">
                <span className="font-medium text-white">North Walk surface review</span>
                <span className="text-brand-orange bg-brand-orange/15 px-2 py-0.5 rounded font-semibold text-[11px]">Today · Priority</span>
              </div>
              <div className="p-2.5 bg-[#181A23] border border-[#252834] rounded-xl flex justify-between items-center text-xs">
                <span className="font-medium text-white">Science Annex access doors</span>
                <span className="text-dark-400 text-[11px]">Tomorrow</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recommended Next Step (7 cols) */}
        <div className="lg:col-span-7 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between space-y-4">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-brand-orange uppercase tracking-wider">
                RECOMMENDED NEXT STEP
              </span>
              <span className="text-xs bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded font-semibold">
                Priority · High
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">Resolve the recurring North Walk hazard</h3>
            <div className="text-xs font-semibold text-dark-200 mt-1">Inspect and isolate the uneven paving at Zone N2</div>
            <p className="text-xs text-dark-300 mt-2 leading-relaxed">
              Arrange a same-day site check with Facilities, mark the affected path, and log a repair work order if confirmed. Three recent trip reports support escalation.
            </p>
          </div>

          <div className="pt-3 border-t border-[#1F212B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="text-dark-400 font-mono text-[11px]">
              Due today · Facilities · Campus services · Procedure ref SAFE-04 §3.2
            </div>
            <button 
              onClick={() => setActionAssigned(true)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
                actionAssigned 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white hover:brightness-110 shadow-lg shadow-orange-500/25'
              }`}
            >
              {actionAssigned ? 'Corrective Action Assigned ✓' : 'Assign corrective action'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
