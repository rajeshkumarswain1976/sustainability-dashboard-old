import OperationalAction from '../components/OperationalAction';
import ForecastPanel from '../components/ForecastPanel';
import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { USE_MOCK } from '../services/client';
import { 
  Trash2, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  ArrowUpRight, 
  ChevronDown,
  Layers,
  Recycle,
  Calculator
} from 'lucide-react';

export default function WastePage({ setCurrentPage }) {
  const { dashboardData, filters } = useDashboard();
  const waste = dashboardData?.waste;
  const [viewMode, setViewMode] = useState('table');
  const [addedToAction, setAddedToAction] = useState(false);

  const mockStreams = [
    { name: 'General', tonnage: 20.1, color: '#A0A5B5', width: '38%' },
    { name: 'Organics', tonnage: 16.4, color: '#10B981', width: '31%' },
    { name: 'Recycling', tonnage: 12.2, color: '#38BDF8', width: '23%' },
    { name: 'Other', tonnage: 3.9, color: '#F59E0B', width: '8%' },
  ];
  const streams = USE_MOCK ? mockStreams : (waste?.streams || []).map((item, index) => ({
    ...item, color: ['#A0A5B5', '#10B981', '#38BDF8', '#F59E0B'][index % 4]
  }));

  const hotspots = USE_MOCK ? [
    { loc: 'North dining hall · Food + mixed', count: '4', window: '11:40–13:10', status: 'Recurring', color: 'text-rose-400 bg-rose-500/15' },
    { loc: 'Library east entrance · Mixed recycling', count: '2', window: '15:00–16:30', status: 'Watch', color: 'text-amber-400 bg-amber-500/15' },
    { loc: 'Science courtyard · General', count: '1', window: 'After 17:00', status: 'Stable', color: 'text-emerald-400 bg-emerald-500/15' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="text-xs font-mono text-dark-400 mb-1">{USE_MOCK ? "\n          Main Campus ▾ › Academic Zone › North Dining › Bin ND-07\n        " : "—"}</div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Waste
              <span className="text-xs font-mono bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Diversion {!USE_MOCK && ((!dashboardData?.waste || dashboardData?.pending_fields?.["waste.diversionRatePercent"])) ? '—' : (waste?.diversionRatePercent ?? 0)}%
              </span>
            </h1>
            <p className="text-sm text-dark-300 mt-1">
              A clear view of what the campus generates, where collection slips, and what to adjust next.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-400">Reporting period:</span>
            <div className="flex items-center gap-2 bg-[#171821] border border-[#252834] px-3 py-1.5 rounded-xl text-xs text-white font-medium">
              <span>{filters.period}</span>
              <ChevronDown className="w-3.5 h-3.5 text-dark-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">
              Waste generated
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 tracking-tight">
              {!USE_MOCK && ((!dashboardData?.waste || dashboardData?.pending_fields?.["waste.generatedTonnes"])) ? '—' : (waste?.generatedTonnes ?? 0)} t
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1F212B] text-xs text-emerald-400 flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>{USE_MOCK ? "▼ 4.8% vs last week · 1.84 kg/person" : "—"}</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">
              Collected on schedule
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 tracking-tight">
              {!USE_MOCK && ((!dashboardData?.waste || dashboardData?.pending_fields?.["waste.collectedOnSchedulePercent"])) ? '—' : (waste?.collectedOnSchedulePercent ?? 0)}%
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1F212B] text-xs text-emerald-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{USE_MOCK ? "▲ 2.1 pts · Target 96%" : "Not available"}</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">
              Overflow incidents
            </div>
            <div className="text-3xl font-extrabold text-rose-400 mt-1 tracking-tight">
              {!USE_MOCK && ((!dashboardData?.waste || dashboardData?.pending_fields?.["waste.overflowIncidents"])) ? '—' : (waste?.overflowIncidents ?? 0)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1F212B] text-xs text-amber-400">{USE_MOCK ? "\n            3 need review · across 2 locations\n          " : "Not available"}</div>
        </div>

        {/* Card 4 - Highlight Card */}
        <div className="bg-gradient-to-br from-[#FF5500] via-[#FF6622] to-[#FF3800] rounded-2xl p-5 text-white shadow-xl shadow-orange-500/20 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-white/80">
              Diversion rate
            </div>
            <div className="text-3xl font-extrabold mt-1 tracking-tight">
              {!USE_MOCK && ((!dashboardData?.waste || dashboardData?.pending_fields?.["waste.diversionRatePercent"])) ? '—' : (waste?.diversionRatePercent ?? 0)}%
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20 text-xs text-white/90 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{USE_MOCK ? "▲ 1.6 pts · recycling + organics" : "—"}</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Collection Chart + Waste by Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Collection Performance (7 cols) */}
        <div className="lg:col-span-7 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
{!USE_MOCK ? <ForecastPanel domain="waste" compact /> : <>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                  COLLECTION PERFORMANCE · 7-DAY VIEW
                </span>
                <h3 className="text-sm font-bold text-white">Generation & collection</h3>
              </div>
              <span className="text-xs font-mono text-dark-400">Generated · Collected · tonnes/day</span>
            </div>

            {/* SVG Chart */}
            <div className="h-48 w-full pt-2">
              <svg viewBox="0 0 500 150" className="w-full h-full overflow-visible">
                <line x1="0" y1="30" x2="500" y2="30" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="75" x2="500" y2="75" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="120" x2="500" y2="120" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>

                {/* Generated line (Orange) */}
                <path 
                  d="M0,110 Q90,95 180,60 T350,75 T500,105" 
                  fill="none" 
                  stroke="#FF5500" 
                  strokeWidth="3" 
                />

                {/* Collected line (Teal/Emerald) */}
                <path 
                  d="M0,118 Q90,102 180,68 T350,82 T500,112" 
                  fill="none" 
                  stroke="#10B981" 
                  strokeWidth="2.5" 
                  strokeDasharray="4 4"
                />
              </svg>
            </div>
          </div>

          {/* Next hours overflow alert pill */}
          <div className="mt-3 p-3 bg-[#191B24] border border-[#262835] rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-brand-orange font-bold">NEXT HOURS · BIN OVERFLOW</span>
              <Info className="w-3.5 h-3.5 text-dark-400" />
              <span className="text-dark-300">North Dining ND-07 · <strong>13:10</strong> · Library East LE-02 · <strong>16:40</strong></span>
            </div>
            <span className="text-[10px] text-dark-400 font-mono">Fill forecast · 78% confidence</span>
          </div>

</>}
</div>

        {/* Waste by Stream (5 cols) */}
        <div className="lg:col-span-5 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                  WHERE IT COMES FROM · {!USE_MOCK && ((!dashboardData?.waste || dashboardData?.pending_fields?.["waste.generatedTonnes"])) ? '—' : (waste?.generatedTonnes ?? 0)} T TOTAL
                </span>
                <h3 className="text-sm font-bold text-white">Waste by stream</h3>
              </div>
              <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-semibold">
                {!USE_MOCK && ((!dashboardData?.waste || dashboardData?.pending_fields?.["waste.diversionRatePercent"])) ? '—' : (waste?.diversionRatePercent ?? 0)}% diverted
              </span>
            </div>

            <div className="space-y-3.5 mt-2">
              {streams.map((s, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-dark-200">{s.name}</span>
                    <span className="font-mono font-bold text-white">{s.tonnage} t</span>
                  </div>
                  <div className="h-2 w-full bg-[#1A1C24] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ width: s.width, backgroundColor: s.color }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1F212B] text-xs text-dark-400">{USE_MOCK ? "\n            vs. 49.8 t last week · campus-wide\n          " : "—"}</div>
        </div>
      </div>

      {/* Bottom Grid: Repeat Locations & Suggested Adjustment Route 04 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Repeat Locations & Bin level (7 cols) */}
        <div className="lg:col-span-7 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">{USE_MOCK ? "\n                  REPEAT LOCATIONS · 7 INCIDENTS\n                " : "—"}</span>
                <h3 className="text-sm font-bold text-white">Overflow hotspots</h3>
              </div>
              <div className="flex bg-[#181A23] border border-[#262835] rounded-lg p-0.5 text-xs">
                <button 
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                    viewMode === 'table' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  Table
                </button>
                <button 
                  onClick={() => setViewMode('map')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                    viewMode === 'map' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  Map
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {hotspots.map((h, i) => (
                <div key={i} className="p-2.5 bg-[#191A23] border border-[#262835] rounded-xl flex items-center justify-between text-xs">
                  <div className="font-medium text-white">{h.loc}</div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-dark-300">{h.count} · {h.window}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${h.color}`}>{h.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bin Level sub-table */}
            <div className="p-3 bg-[#171922] border border-[#242735] rounded-xl text-xs space-y-2">
              <div className="text-[10px] text-dark-400 uppercase tracking-wider font-semibold">Bin level (Table view)</div>
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">{USE_MOCK ? "ND-07 · fill 86% · +9%/h" : "—"}</span>
                <span className="text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded font-mono text-[11px]">{USE_MOCK ? "overflow 13:10" : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">{USE_MOCK ? "LE-02 · fill 64% · +6%/h" : "—"}</span>
                <span className="text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded font-mono text-[11px]">{USE_MOCK ? "overflow 16:40" : "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Suggested Adjustment Route 04 (5 cols) */}
        <OperationalAction domain="waste" className="lg:col-span-5 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between space-y-4" sample={<div className="lg:col-span-5 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-semibold text-brand-orange uppercase tracking-wider">
              SUGGESTED ADJUSTMENT · ROUTE 04
            </span>
            <h3 className="text-sm font-bold text-white mt-1">
              Shift dining hall pickup before the lunch peak.
            </h3>
            <p className="text-xs text-dark-300 mt-1 leading-relaxed">
              Add a 12:15 organics collection at North Dining, then loop the library east bins.
            </p>
            <div className="text-xs font-mono text-dark-400 mt-2 bg-[#191B24] p-2 rounded-lg border border-[#262835]">
              North Dining → Library East → Depot
            </div>
          </div>

          <div className="p-3 bg-[#191A23] border border-[#262835] rounded-xl text-xs space-y-1.5">
            <div className="text-white font-semibold">−3.2 overflow/wk · +6.4% on-time · 18 min</div>
            <div className="text-emerald-400 font-mono font-bold">≈ ₹{waste?.routeSavingRsWeekly ?? 0}/week saved.</div>
            <div className="text-[11px] text-dark-400">Estimated from last 4 weeks of route and fill-level data.</div>
          </div>

          <button 
            onClick={() => setAddedToAction(true)}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition ${
              addedToAction 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white hover:brightness-110 shadow-lg shadow-orange-500/25'
            }`}
          >
            {addedToAction ? 'Added to Actions Queue ✓' : 'Add to action plan → Actions'}
          </button>

          {/* Model info card */}
          <div className="p-2.5 bg-[#161720] border border-[#232532] rounded-xl text-[11px] text-dark-400 space-y-1">
            <div className="text-white font-semibold flex items-center gap-1.5">
              <Calculator className="w-3 h-3 text-brand-orange" />
              <span>How this was computed</span>
            </div>
            <div>Method: gradient-boosted fill-rate forecast</div>
            <div>Baseline window: last 28 days · Confidence: 78% · Error: MAE 6.1% fill</div>
          </div>
        </div>} />
      </div>
    </div>
  );
}
