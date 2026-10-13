import PendingPanel from '../components/PendingPanel';
import ForecastPanel from '../components/ForecastPanel';
import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { USE_MOCK } from '../services/client';
import { 
  Leaf, 
  TrendingUp, 
  TrendingDown, 
  Download, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Calendar,
  Sparkles,
  Edit3
} from 'lucide-react';

export default function SustainabilityPage() {
  const { currentUser, showToast, filters, dashboardData } = useDashboard();
  const sustainability = dashboardData?.sustainability;
  const [selectedFactor, setSelectedFactor] = useState('Energy');
  const [breakdownOpen, setBreakdownOpen] = useState(true);

  const mockFactorScores = [
    { name: 'Energy', score: 81 },
    { name: 'Water', score: 74 },
    { name: 'Waste', score: 88 },
    { name: 'Air', score: 42 },
    { name: 'Mobility', score: 67 },
    { name: 'Assets', score: 82 },
    { name: 'Safety', score: 94 },
    { name: 'Climate', score: 68 },
  ];
  const factorScores = dashboardData?.overview?.factors?.map(item => ({ name: item.name.replace(' · AQI', ''), score: item.score })) || (USE_MOCK ? mockFactorScores : []);

  const commitments = [
    { label: 'Scope 1 & 2 emissions', percent: 74, color: 'bg-brand-orange' },
    { label: 'Renewable electricity', percent: 58, color: 'bg-emerald-500' },
    { label: 'Waste diverted', percent: 63, color: 'bg-sky-500' },
  ];

  const roadmap = USE_MOCK ? [
    { date: 'Oct 18', task: 'Approve library heat-pump scope', status: 'In review', sColor: 'text-amber-400 bg-amber-500/15' },
    { date: 'Nov 04', task: 'Extend evening lighting controls', status: 'Planned', sColor: 'text-dark-300 bg-[#222532]' },
    { date: 'Dec 12', task: 'Dining hall food-waste audit', status: 'Planned', sColor: 'text-dark-300 bg-[#222532]' },
  ] : [];

  return (
    <div className="space-y-6">
      {!USE_MOCK && <ForecastPanel domain="sustainability" title="Seven-day score projection" />}

      {/* Page Header */}
      <div>
        <div className="text-xs font-mono text-dark-400 mb-1">
          {filters.location} ▾ › All zones
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Sustainability
              <span className="text-xs font-mono bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Grade: {sustainability?.grade || "B+"} ({sustainability?.score ?? 78.4})
              </span>
            </h1>
            <p className="text-sm text-dark-300 mt-1">
              A clear view of campus progress, pressure points and the work that moves performance forward.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-400">Reporting period:</span>
            <div className="flex items-center gap-2 bg-[#171821] border border-[#252834] px-3 py-1.5 rounded-xl text-xs text-white font-medium">
              <span>{filters.period}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Section: Score Hero + Factor Assessment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Campus Performance (5 cols) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#1C1E29] to-[#12131C] border border-[#262A3C] rounded-2xl p-6 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                CAMPUS PERFORMANCE
              </span>
              <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded-full font-semibold">
                On track
              </span>
            </div>

            <div className="my-4">
              <div className="text-5xl font-black text-white tracking-tight flex items-baseline gap-2">
                {sustainability?.score ?? 78.4} <span className="text-lg font-normal text-dark-400">out of 100 · </span>
                <span className="text-2xl font-bold text-brand-orange">{sustainability?.grade || "B+"}</span>
              </div>
              <p className="text-xs text-dark-300 mt-2 leading-relaxed">
                Balanced progress across campus systems · <strong className="text-emerald-400">▲ 2.6 pts since last review</strong> · 8 factors weighted · Operations assessment current</p>
            </div>
          </div>

          <div className="pt-3 border-t border-[#252838] flex justify-between items-center text-xs">
            <span className="text-dark-400">Emissions score</span>
            <span className="font-mono text-white font-bold">72 · weight 20%</span>
          </div>
        </div>

        {/* Performance Assessment (7 cols) */}
        <div className="lg:col-span-7 bg-[#14151B] border border-[#22242E] rounded-2xl p-6 shadow-card-dark flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
              PERFORMANCE ASSESSMENT · SELECT A FACTOR
            </span>
            <h3 className="text-xs text-dark-300 mt-0.5 mb-3 font-mono">
              SCORE → FACTOR → KPI → DATA
            </h3>

            {/* Factor Grid */}
            <div className="grid grid-cols-4 gap-2.5">
              {factorScores.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedFactor(f.name)}
                  className={`p-3 rounded-xl border text-center transition ${
                    selectedFactor === f.name
                      ? 'bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white border-transparent shadow-md shadow-orange-500/20'
                      : 'bg-[#181A23] hover:bg-[#20232E] border-[#262835] text-dark-200'
                  }`}
                >
                  <div className="text-[11px] font-medium">{f.name}</div>
                  <div className="text-lg font-black mt-0.5">{Number.isFinite(f.score) ? f.score.toFixed(2).replace(/\.00$/, '') : '—'}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#191B24] border border-[#262835] rounded-xl text-xs text-dark-300 flex items-center justify-between">
            <span>
              <strong>Electricity intensity:</strong> 118 kWh/m² · 9% below baseline; evening load opportunity</span>
            <span className="text-emerald-400 font-semibold font-mono shrink-0 ml-2">Improving</span>
          </div>
        </div>
      </div>

      {/* Middle 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Estimated GHG emissions</div>
          <div className="text-3xl font-extrabold text-white mt-1">1,284 <span className="text-sm font-normal text-dark-400">tCO₂e/yr</span></div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-emerald-400">−8.3% vs 2025 baseline</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Renewable electricity</div>
          <div className="text-3xl font-extrabold text-white mt-1">34.6%</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-emerald-400">+4.1 pts of total load</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Waste diverted</div>
          <div className="text-3xl font-extrabold text-white mt-1">61.8%</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-emerald-400">+2.7 pts year to date</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Open improvement actions</div>
          <div className="text-3xl font-extrabold text-brand-orange mt-1">12</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-amber-400">3 due soon · across 6 teams</div>
        </div>
      </div>

      {/* Lower 3 Columns: Commitments, Milestones Roadmap, Verified Outcomes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Commitments */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">COMMITMENTS</span>
                <h3 className="text-sm font-bold text-white">Targets & progress</h3>
              </div>
              <button 
                onClick={() => showToast('Exporting Sustainability Commitments Audit (PDF)...')}
                className="flex items-center gap-1 text-[11px] text-brand-orange hover:underline font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            </div>

            <div className="space-y-4 my-3">
              {commitments.map((c, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-white">{c.label}</span>
                    <span className="font-mono text-white font-bold">{c.percent}%</span>
                  </div>
                  <div className="h-2 w-full bg-[#1A1C24] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#1F212B] text-xs text-dark-400 flex items-center justify-between">
            <span>Reporting against Campus A 2030 plan</span>
            {currentUser.role === 'Administrator' && (
              <button 
                onClick={() => showToast('Editing commitment targets modal')}
                className="text-[10px] text-brand-orange hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit Targets</span>
              </button>
            )}
          </div>
        </div>

        {/* Next Milestones Q4 2026 */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">NEXT MILESTONES · Q4 2026</span>
              {/* PDF Rule: Administrator edits targets and roadmap. Department Head cannot edit */}
              {currentUser.role === 'Administrator' ? (
                <button 
                  onClick={() => showToast('Opening roadmap milestone editor')}
                  className="text-[10px] text-brand-orange hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              ) : (
                <span className="text-[9px] text-dark-500 font-mono">Read Only</span>
              )}
            </div>
            <h3 className="text-sm font-bold text-white mt-0.5 mb-3">Improvement roadmap</h3>

            <div className="space-y-3">
              {roadmap.map((r, i) => (
                <div key={i} className="p-2.5 bg-[#181A23] border border-[#252834] rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-brand-orange text-[11px] block">{r.date}</span>
                    <span className="text-white font-medium">{r.task}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${r.sColor}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 pt-2 text-[11px] text-dark-400">{USE_MOCK ? "Target completion: Dec 31, 2026" : "Not available"}</div>
        </div>

        {/* Verified Outcomes Last 30 Days */}
        <PendingPanel title="Completed-action impact" className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between" sample={<div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">{USE_MOCK ? "\n              VERIFIED OUTCOMES · LAST 30 DAYS\n            " : "Not available"}</span>
            <h3 className="text-sm font-bold text-white mt-0.5 mb-3">Completed-action impact</h3>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 bg-[#181A23] border border-[#252834] rounded-xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">{USE_MOCK ? "Sep 26 Science wing LED retrofit" : "—"}</span>
                  <span className="text-emerald-400 font-mono font-bold">{USE_MOCK ? "−18.4 tCO₂e/yr" : "—"}</span>
                </div>
                <div className="text-[11px] text-dark-400 flex justify-between">
                  <span>{USE_MOCK ? "Before 91 → After 73 · ₹1.2 L/yr" : "—"}</span>
                  <span className="text-emerald-400 font-bold">Verified</span>
                </div>
              </div>

              <div className="p-2.5 bg-[#181A23] border border-[#252834] rounded-xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">{USE_MOCK ? "Sep 11 Pool filtration schedule reset" : "—"}</span>
                  <span className="text-emerald-400 font-mono font-bold">{USE_MOCK ? "−312 m³/yr" : "—"}</span>
                </div>
                <div className="text-[11px] text-right text-emerald-400 font-bold">Verified</div>
              </div>

              <div className="p-2.5 bg-[#181A23] border border-[#252834] rounded-xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">HVAC setback</span>
                  <span className="text-emerald-400 font-mono font-bold">{USE_MOCK ? "₹92,800/mo" : "—"}</span>
                </div>
                <div className="text-[11px] text-dark-400 flex justify-between">
                  <span>{USE_MOCK ? "(expected −18%, actual −14%)" : "—"}</span>
                  <span className="text-amber-400 font-medium">Estimated</span>
                </div>
              </div>
            </div>
          </div>
        </div>} />
      </div>

      {/* Emissions Breakdown Collapsible Bar */}
      <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-4">
        <div 
          onClick={() => setBreakdownOpen(!breakdownOpen)}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">Emissions breakdown</span>
            <span className="text-xs font-mono text-dark-300">
              Energy <strong>{USE_MOCK ? "812" : "—"}</strong> · Mobility <strong>{USE_MOCK ? "301" : "—"}</strong> · Waste <strong>{USE_MOCK ? "171" : "—"}</strong> tCO₂e
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-brand-orange font-semibold">
            <span>{breakdownOpen ? 'Collapse ▴' : 'Expand ▾'}</span>
          </div>
        </div>

        {breakdownOpen && (
          <div className="mt-3 pt-3 border-t border-[#1F212B] flex flex-col sm:flex-row justify-between text-xs text-dark-400">
            <span>{USE_MOCK ? "Grid emissions factoring standard: CEA Database v20" : "Not available"}</span>
            <span className="font-mono">Factors: India grid EF v20 (0.71 tCO₂/MWh) · Central Electricity Authority verified factor</span>
          </div>
        )}
      </div>
    </div>
  );
}
