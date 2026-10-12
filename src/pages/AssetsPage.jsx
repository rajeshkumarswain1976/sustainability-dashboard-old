import ForecastPanel from '../components/ForecastPanel';
import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { USE_MOCK } from '../services/client';
import { 
  Cpu, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  ArrowUpRight, 
  ChevronDown,
  Wrench,
  ShieldAlert
} from 'lucide-react';

export default function AssetsPage({ setCurrentPage }) {
  const { dashboardData, filters } = useDashboard();
  const assets = dashboardData?.assets;
  const [activeTab, setActiveTab] = useState('reliability');
  const [actionAdded, setActionAdded] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  const inspections = USE_MOCK ? [
    { code: 'BLD-04', name: 'North science · air handler 2', issue: 'HVAC · vibration anomaly', due: 'Today', priority: 'Urgent', team: 'Facilities', pColor: 'text-rose-400 bg-rose-500/15' },
    { code: 'UTL-11', name: 'Central plant · pump 3', issue: 'Pumping · seal wear', due: '10 Oct', priority: 'High', team: 'Mechanical', pColor: 'text-amber-400 bg-amber-500/15' },
    { code: 'BLD-17', name: 'Library · lift bank A', issue: 'Vertical transport · repeat fault', due: '11 Oct', priority: 'High', team: 'Facilities', pColor: 'text-amber-400 bg-amber-500/15' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="text-xs font-mono text-dark-400 mb-1">
          Main Campus ▾ › Academic Zone › Science Hall › AHU-04
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Assets
              <span className="text-xs font-mono bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Health Score {assets?.conditionScore ?? 0} / 100
              </span>
            </h1>
            <p className="text-sm text-dark-300 mt-1">
              Infrastructure health, emerging faults and the work that will keep campus systems dependable.
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
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Condition score</div>
          <div className="text-3xl font-extrabold text-white mt-1">{assets?.conditionScore ?? 0} / 100</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-emerald-400">+2.4 pts vs last quarter</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Maintenance due</div>
          <div className="text-3xl font-extrabold text-white mt-1">{assets?.maintenanceDueCount ?? 0} assets</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-amber-400">6 overdue · across 4 buildings</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Unresolved issues</div>
          <div className="text-3xl font-extrabold text-white mt-1">{assets?.unresolvedCount ?? 0} open</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-dark-400">3 high priority · 2 beyond target</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Critical assets</div>
          <div className="text-3xl font-extrabold text-white mt-1">{assets?.criticalTracked ?? 0} tracked</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-rose-400">2 need attention · of 46 systems</div>
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="p-3 bg-[#171922] border border-[#242735] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex gap-2">
          {['Condition', 'Utilisation', 'Reliability'].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t.toLowerCase())}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === t.toLowerCase()
                  ? 'bg-brand-orange text-white'
                  : 'bg-[#1F212B] text-dark-300 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="text-dark-300 flex items-center gap-1.5 font-mono text-[11px]">
          <span>Reliability: availability <strong>96.4%</strong> · idle <strong>11%</strong> · downtime <strong>14 h</strong> · MTBF <strong>212 h</strong> · MTTR <strong>3.6 h</strong></span>
          <Info className="w-3.5 h-3.5 text-dark-400" />
        </div>
      </div>

      {/* Middle Grid: Reliability Failure Trend + Portfolio Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Trend Chart (7 cols) */}
        <div className="lg:col-span-7 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
{!USE_MOCK ? <ForecastPanel domain="assets" compact /> : <>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                  RELIABILITY · ROLLING 12 WEEKS
                </span>
                <h3 className="text-sm font-bold text-white">Recurring failure trend</h3>
              </div>
              <span className="text-xs text-emerald-400 font-mono">▼ 31% since July</span>
            </div>
            <div className="text-2xl font-black text-white">
              16 <span className="text-xs font-normal text-dark-400">failures per 100 assets this week</span>
            </div>

            {/* SVG Trend Chart */}
            <div className="h-44 w-full pt-2">
              <svg viewBox="0 0 500 130" className="w-full h-full overflow-visible">
                <line x1="0" y1="30" x2="500" y2="30" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="70" x2="500" y2="70" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="110" x2="500" y2="110" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>

                {/* Trend line */}
                <path 
                  d="M0,85 Q100,80 200,65 T350,55 T380,50" 
                  fill="none" 
                  stroke="#10B981" 
                  strokeWidth="3" 
                />

                {/* Forecast line */}
                <path 
                  d="M380,50 Q440,55 500,52" 
                  fill="none" 
                  stroke="#7E849A" 
                  strokeWidth="2.5" 
                  strokeDasharray="5 5" 
                />

                <circle cx="380" cy="50" r="4.5" fill="#FFFFFF" stroke="#10B981" strokeWidth="2.5" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-dark-400">Today · Fri 9 Oct (dashed = forecast)</div>

</>}
</div>

        {/* Portfolio Health (5 cols) */}
        <div className="lg:col-span-5 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">PORTFOLIO HEALTH</span>
                <h3 className="text-sm font-bold text-white">Condition distribution</h3>
              </div>
              <span className="text-lg font-black text-white">{assets?.conditionScore ?? 0} / 100</span>
            </div>

            <div className="text-xs text-dark-400 mb-4">
              Holding steady above the 78-point service threshold
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-white">Good</span>
                  <span className="font-mono text-emerald-400 font-bold">68%</span>
                </div>
                <div className="h-2 w-full bg-[#1A1C24] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '68%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-white">Watch</span>
                  <span className="font-mono text-amber-400 font-bold">23%</span>
                </div>
                <div className="h-2 w-full bg-[#1A1C24] rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '23%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-white">At risk</span>
                  <span className="font-mono text-rose-400 font-bold">9%</span>
                </div>
                <div className="h-2 w-full bg-[#1A1C24] rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: '9%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-2.5 bg-[#1F1919] border border-[#3E2222] rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>⚠ 2 critical systems require inspection inside 48 hours</span>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Inspection Priority & Recommended Intervention */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Inspection Priority Table (7 cols) */}
        <div className="lg:col-span-7 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="flex justify-between items-center mb-3">
            <div>
              <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                NEXT WORK · 18 ITEMS DUE
              </span>
              <h3 className="text-sm font-bold text-white">Inspection priority</h3>
            </div>
          </div>

          <div className="space-y-2.5">
            {inspections.map((item, idx) => (
              <div key={idx} className="p-3 bg-[#181A23] border border-[#252834] rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="font-mono text-[11px] text-brand-orange">{item.code}</span>
                    <span>{item.name}</span>
                  </div>
                  <div className="text-[11px] text-dark-400 mt-0.5">{item.issue}</div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-dark-300">{item.due}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${item.pColor}`}>
                    {item.priority}
                  </span>
                  <span className="text-dark-400 text-[11px]">{item.team}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Intervention (5 cols) */}
        <div className="lg:col-span-5 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-semibold text-brand-orange uppercase tracking-wider">
              RECOMMENDED INTERVENTION
            </span>
            <h3 className="text-sm font-bold text-white mt-1">Service North Science AHU-2 this week</h3>
            <p className="text-xs text-dark-300 mt-1 leading-relaxed">
              A rising vibration signal and two repeat stoppages point to bearing wear.
            </p>
          </div>

          <div className="p-3 bg-[#181A24] border border-[#262835] rounded-xl flex items-center justify-between text-xs">
            <div>
              <div className="text-white font-bold">Simulated uptime +4.8 pts</div>
              <div className="text-[11px] text-dark-400">Modelled from 18 months of work orders</div>
            </div>
            <div className="text-right">
              <div className="text-emerald-400 font-mono font-bold">Callouts −2 / qtr</div>
              <div className="text-[11px] text-dark-400">(≈ ₹46,000)</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setScheduled(true)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#20222D] hover:bg-[#2B2E3D] text-white text-xs font-semibold transition"
            >
              {scheduled ? 'Scheduled ✓' : 'Schedule inspection'}
            </button>
            <button 
              onClick={() => setActionAdded(true)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white text-xs font-semibold hover:brightness-110 shadow-lg shadow-orange-500/25 transition"
            >
              {actionAdded ? 'Added ✓' : 'Add to action plan →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
