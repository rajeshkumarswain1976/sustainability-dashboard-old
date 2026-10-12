import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { USE_MOCK } from '../services/client';
import { 
  Zap, 
  TrendingDown, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  ArrowUpRight, 
  FileText,
  Clock,
  Layers,
  ChevronDown
} from 'lucide-react';

export default function EnergyPage() {
  const { currentUser, dashboardData, filters, updateFilter, showToast, setCurrentPage } = useDashboard();
  const [addedToAction, setAddedToAction] = useState(false);
  const [markedForReview, setMarkedForReview] = useState(false);

  const defaultBuildings = [
    { name: 'Science & Engineering', kw: 184, percent: 38 },
    { name: 'Main Library', kw: 96, percent: 20 },
    { name: 'Residence halls', kw: 83, percent: 17 },
    { name: 'Student Center', kw: 71, percent: 15 },
    { name: 'Other buildings', kw: 48, percent: 10 },
  ];

  const energy = dashboardData?.energy;
  const currentDemand = energy?.currentDemandKw ?? (USE_MOCK ? 482 : 0);
  const electricityWeekly = energy?.electricityMwh ?? (USE_MOCK ? 68.4 : 0);
  const peakDemand = energy?.peakDemandKw ?? (USE_MOCK ? 612 : 0);
  const emissions = energy?.estimatedEmissionsTco2e ?? (USE_MOCK ? 21.7 : 0);
  const avoided = energy?.avoidedTco2e ?? (USE_MOCK ? 1.6 : 0);
  const buildings = energy?.buildings || (USE_MOCK ? defaultBuildings : []);
  const monthlySaving = energy?.monthlySavingRs ?? (USE_MOCK ? 92800 : 0);
  const savingMwh = energy?.savingMwh ?? (USE_MOCK ? 11.6 : 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="text-xs font-mono text-dark-400 mb-1">
          {filters.location} ▾ › Academic Zone › Science Hall › AHU-04
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Energy
              <span className="text-xs font-mono bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Historical metering replay
              </span>
            </h1>
            <p className="text-sm text-dark-300 mt-1">
              Electricity use, unusual load, and the next practical opportunity to reduce it in {filters.sector}.
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

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-gradient-to-br from-[#FF5500] via-[#FF6622] to-[#FF3800] rounded-2xl p-5 text-white shadow-xl shadow-orange-500/20 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-white/80">
              Current campus demand
            </div>
            <div className="text-3xl font-extrabold mt-1 tracking-tight">
              {currentDemand} kW
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-1.5 text-xs text-white/90">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>6.8% lower vs previous week</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">
              Electricity ({filters.period})
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 tracking-tight">
              {electricityWeekly} MWh
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1F212B] text-xs text-dark-400">
            through 14:00 today
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">
              Peak demand
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 tracking-tight">
              {peakDemand} kW
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1F212B] text-xs text-dark-400">
            Thu · 14:00
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">
              Estimated emissions
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 tracking-tight">
              {emissions} tCO₂e
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1F212B] text-xs text-emerald-400 flex items-center gap-1">
            <span>{avoided} t avoided · India grid EF v20</span>
          </div>
        </div>
      </div>

      {/* Main Content: Trend & Building breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column (8 cols): Trend Chart + Live Demand by Building */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">CAMPUS ELECTRICITY</span>
                  <span className="text-sm font-bold text-white">A steadier week, with a modest forecast</span>
                  <Info className="w-3.5 h-3.5 text-dark-400" />
                </div>
                <div className="text-xs text-dark-400 mt-1">
                  Snapshot: {filters.snapshotDate} (dashed = forecast) · Daily energy, MWh
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full w-fit">
                Within demand target
              </span>
            </div>

            {/* Custom SVG Trend Chart */}
            <div className="h-60 w-full relative pt-4">
              <svg viewBox="0 0 700 200" className="w-full h-full overflow-visible">
                <line x1="0" y1="40" x2="700" y2="40" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="90" x2="700" y2="90" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="140" x2="700" y2="140" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                
                <defs>
                  <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF5500" stopOpacity="0.35"/>
                    <stop offset="100%" stopColor="#FF5500" stopOpacity="0.0"/>
                  </linearGradient>
                </defs>

                <path 
                  d="M0,130 Q100,110 180,80 T350,95 T480,70 L480,180 L0,180 Z" 
                  fill="url(#energyGrad)" 
                />

                <path 
                  d="M0,130 Q100,110 180,80 T350,95 T480,70" 
                  fill="none" 
                  stroke="#FF5500" 
                  strokeWidth="3.5" 
                />

                <line x1="480" y1="20" x2="480" y2="180" stroke="#FF5500" strokeWidth="1.5" strokeDasharray="4 4"/>
                <text x="485" y="30" fill="#FF7043" fontSize="11" fontFamily="sans-serif" fontWeight="bold">Today ({filters.snapshotDate})</text>

                <path 
                  d="M480,70 Q580,75 700,72" 
                  fill="none" 
                  stroke="#A3A9BE" 
                  strokeWidth="2.5" 
                  strokeDasharray="6 6"
                />

                <circle cx="480" cy="70" r="5" fill="#FFFFFF" stroke="#FF5500" strokeWidth="3" />
              </svg>

              <div className="flex justify-between text-[11px] text-dark-400 mt-2 font-mono">
                <span>Day 1</span>
                <span>Day 2</span>
                <span>Day 3</span>
                <span>Day 4</span>
                <span className="text-brand-orange font-bold">Snapshot Active</span>
                <span>Forecast +1d</span>
                <span>Forecast +2d</span>
              </div>
            </div>
          </div>

          {/* Where Energy is Going */}
          <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">
                  LIVE DEMAND · {currentDemand} KW TOTAL · 5 BUILDING GROUPS
                </span>
                <h3 className="text-base font-bold text-white">Where energy is going</h3>
              </div>
              <span className="text-xs font-mono text-dark-400">kW / % share</span>
            </div>

            <div className="space-y-4">
              {buildings.map((b, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-white">{b.name}</span>
                    <span className="font-mono text-white font-bold">{b.kw} kW <span className="text-dark-400 font-normal">({b.percent}%)</span></span>
                  </div>
                  <div className="h-2.5 w-full bg-[#1A1C24] rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        i === 0 
                          ? 'bg-gradient-to-r from-[#FF5500] to-[#FF3D00] shadow-sm shadow-orange-500/50' 
                          : 'bg-[#3A3E4E]'
                      }`}
                      style={{ width: `${b.percent * 2.2}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Signals, Next Steps, Policy */}
        <div className="lg:col-span-4 space-y-5">
          {/* Signal Detected Card */}
          <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                SIGNAL DETECTED
              </span>
              <div className="flex gap-1.5">
                <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-semibold">
                  Review
                </span>
                <span className="text-[10px] bg-[#222531] text-dark-300 px-2 py-0.5 rounded font-semibold">
                  High confidence
                </span>
              </div>
            </div>

            <h3 className="text-sm font-bold text-white mb-2">Overnight load persisted</h3>
            <p className="text-xs text-dark-300 leading-relaxed mb-3">
              Science & Engineering · south wing HVAC ran <strong>18%</strong> above its overnight baseline. 7 Oct · 02:15–04:40
            </p>

            {/* PDF Rule: Staff cannot use Mark for review */}
            {currentUser.role !== 'Staff' ? (
              <button 
                onClick={() => {
                  setMarkedForReview(!markedForReview);
                  showToast(markedForReview ? 'Review mark removed' : 'Marked for engineering review');
                }}
                className="text-xs text-brand-orange hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>{markedForReview ? 'Marked for review ✓' : 'Mark for review →'}</span>
              </button>
            ) : (
              <div className="text-[11px] text-dark-500 italic">
                (Marking for review restricted to Heads & Administrators)
              </div>
            )}
          </div>

          {/* Recommended Next Step Card */}
          <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark space-y-4">
            <div>
              <span className="text-[10px] font-semibold text-brand-orange uppercase tracking-wider">
                RECOMMENDED NEXT STEP
              </span>
              <h3 className="text-base font-bold text-white mt-1">Align HVAC to occupancy</h3>
              <p className="text-xs text-dark-300 mt-1 leading-relaxed">
                Restore the south wing air-handling setback after the evening schedule.
              </p>
            </div>

            <div className="p-3.5 bg-[#191A23] border border-[#262835] rounded-xl flex items-baseline justify-between">
              <div>
                <span className="text-xl font-black text-white">{savingMwh} MWh</span>
                <div className="text-[11px] text-dark-400">Monthly potential</div>
              </div>
              <div className="text-right">
                <span className="text-base font-bold text-emerald-400 font-mono">≈ ₹{monthlySaving.toLocaleString()}</span>
                <div className="text-[11px] text-dark-400">/ month savings</div>
              </div>
            </div>

            {/* PDF Rule: Staff suggests through Add to action plan; Admins and Heads directly add */}
            <button 
              onClick={() => {
                setAddedToAction(true);
                showToast(currentUser.role === 'Staff' 
                  ? 'Suggestion submitted for Administrator approval' 
                  : 'HVAC alignment task added to Actions Queue!');
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                addedToAction 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white hover:brightness-110 shadow-lg shadow-orange-500/25'
              }`}
            >
              <span>
                {addedToAction 
                  ? (currentUser.role === 'Staff' ? 'Suggestion Submitted ✓' : 'Added to Actions Queue ✓')
                  : (currentUser.role === 'Staff' ? 'Suggest for action plan' : 'Add to action plan → Actions')}
              </span>
            </button>

            <div className="text-[11px] text-dark-400 italic">
              Illustrative simulation · assumes a 5-night schedule
            </div>
          </div>

          {/* Policy Reference */}
          <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
            <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
              POLICY REFERENCE
            </span>
            <h4 className="text-xs font-bold text-white mt-1">Energy Management Standard 4.2</h4>
            <div 
              onClick={() => showToast('Viewing Energy Management Standard 4.2 details')}
              className="mt-3 p-3 bg-[#191A23] border border-[#262835] rounded-xl flex items-center justify-between text-xs text-dark-300 cursor-pointer hover:border-brand-orange transition"
            >
              <span>After-hours HVAC setback</span>
              <ChevronDown className="w-4 h-4 text-dark-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
