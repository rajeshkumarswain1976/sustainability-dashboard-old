import ForecastPanel from '../components/ForecastPanel';
import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { USE_MOCK } from '../services/client';
import { 
  Droplets, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  ArrowUpRight, 
  ChevronDown,
  Layers,
  Activity
} from 'lucide-react';

export default function WaterPage() {
  const { currentUser, dashboardData, filters, showToast, setCurrentPage } = useDashboard();
  const [timeRange, setTimeRange] = useState('7d');
  const [addedToAction, setAddedToAction] = useState(false);

  const water = dashboardData?.water;
  const useToday = water?.useTodayM3 ?? (USE_MOCK ? 1323 : 0);
  const dailySupply = water?.dailySupplyM3 ?? (USE_MOCK ? 1540 : 0);
  const storedReserve = water?.storedReservePercent ?? (USE_MOCK ? 68 : 0);
  const intensity = water?.intensityLPerPerson ?? (USE_MOCK ? 42.8 : 0);
  const weeklySaving = water?.weeklySavingRs ?? (USE_MOCK ? 2300 : 0);

  const mockTanks = [
    { name: 'North reservoir · 480 kL', percent: 82, color: 'bg-emerald-500' },
    { name: 'Central tank · 320 kL', percent: 64, color: 'bg-emerald-500' },
    { name: 'South cistern · 210 kL', percent: 38, color: 'bg-amber-500' },
  ];
  const tanks = USE_MOCK ? mockTanks : (water?.tanks || []).map(item => ({ ...item,
    color: item.percent < 40 ? 'bg-amber-500' : 'bg-emerald-500' }));

  const zones = USE_MOCK ? [
    { name: 'Residence halls', value: '412', delta: '−4.2%', width: '85%' },
    { name: 'Academic quarter', value: '366', delta: '+1.8%', width: '75%' },
    { name: 'Central services', value: '294', delta: '−2.1%', width: '60%' },
    { name: 'Landscape & other', value: '251', delta: '−6.4%', width: '50%' },
  ] : [];

  return (
    <div className="space-y-6">
      {!USE_MOCK && <ForecastPanel domain="water" defaultMetric="tank_level_pct" title="Tank forecast and water runway" />}

      {/* Page Header */}
      <div>
        <div className="text-xs font-mono text-dark-400 mb-1">
          {filters.location} ▾ › South Residential Zone › Hall C › Meter RH-C-04
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Water
              <span className="text-xs font-mono bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Historical water replay
              </span>
            </h1>
            <p className="text-sm text-dark-300 mt-1">
              A clear view of campus demand, storage and supply health in {filters.sector}.
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
              Campus use today
            </div>
            <div className="text-3xl font-extrabold mt-1 tracking-tight">
              {useToday.toLocaleString()} m³
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-1.5 text-xs text-white/90">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>−3.6% vs 7-day average</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">
              Daily supply
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 tracking-tight">
              {dailySupply.toLocaleString()} m³
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1F212B] text-xs text-emerald-400">
            In range · municipal + borewell
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">
              Stored reserve
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 tracking-tight">
              {storedReserve}%
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1F212B] text-xs text-amber-400">
            −4 pts across 3 monitored tanks
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">
              Water intensity
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 tracking-tight">
              {intensity} L/person
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1F212B] text-xs text-dark-400">
            −2.4% per occupied day
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="p-3 bg-[#171922] border border-[#242735] rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">More ▾</span>
          <span className="text-dark-500">|</span>
          <span className="text-dark-300">Days of water: <strong className="text-white">4.2</strong></span>
          <span className="text-dark-500">·</span>
          <span className="text-dark-300">Recycled: <strong className="text-brand-orange">18%</strong></span>
          <span className="text-dark-500">·</span>
          <span className="text-dark-300">Water stress: <strong className="text-amber-400">Medium</strong></span>
          <span className="text-dark-500">·</span>
          <span className="text-dark-300">Pressure: <strong className="text-white">2.8 bar</strong></span>
          <span className="text-dark-500">·</span>
          <span className="text-dark-300">Flow: <strong className="text-white">54 m³/h</strong></span>
        </div>
      </div>

      {/* Middle Grid: Demand Curve Chart & Tank Levels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
{!USE_MOCK ? <ForecastPanel domain="water" compact /> : <>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">DEMAND · M³/DAY</span>
                <span className="text-sm font-bold text-white">Use & expected demand</span>
                <Info className="w-3.5 h-3.5 text-dark-400" />
              </div>
              <div className="flex bg-[#181A23] border border-[#262835] rounded-lg p-0.5 text-xs">
                <button 
                  onClick={() => setTimeRange('7d')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    timeRange === '7d' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  7 days
                </button>
                <button 
                  onClick={() => setTimeRange('30d')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    timeRange === '30d' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  30 days
                </button>
              </div>
            </div>

            <div className="text-xs text-dark-400 mb-2">
              Snapshot: {filters.snapshotDate} (dashed = forecast)
            </div>

            <div className="h-48 w-full pt-2">
              <svg viewBox="0 0 500 150" className="w-full h-full overflow-visible">
                <line x1="0" y1="30" x2="500" y2="30" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="75" x2="500" y2="75" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="120" x2="500" y2="120" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>

                <path 
                  d="M0,90 Q90,65 180,75 T320,60 T360,70" 
                  fill="none" 
                  stroke="#38BDF8" 
                  strokeWidth="3" 
                />

                <line x1="360" y1="10" x2="360" y2="140" stroke="#FF5500" strokeWidth="1" strokeDasharray="3 3"/>

                <path 
                  d="M360,70 Q420,80 500,85" 
                  fill="none" 
                  stroke="#7E849A" 
                  strokeWidth="2.5" 
                  strokeDasharray="5 5" 
                />

                <circle cx="360" cy="70" r="4.5" fill="#FFFFFF" stroke="#38BDF8" strokeWidth="2.5" />
              </svg>
            </div>
          </div>

          {USE_MOCK && (          <div className="mt-3 p-3 bg-[#191B24] border border-[#262835] rounded-xl text-xs text-dark-300">
            <span className="text-emerald-400 font-semibold">Forecast:</span> demand is expected to ease to 1,248 m³/day by Friday; supply remains within operating reserve.
          </div>)}

</>}
</div>

        {/* Tank Levels */}
        <div className="lg:col-span-5 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                  STORAGE · 1,010 KL COMBINED
                </span>
                <h3 className="text-base font-bold text-white">Tank levels</h3>
              </div>
              <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded-full font-semibold">
                Supply steady
              </span>
            </div>

            <div className="space-y-4">
              {tanks.map((t, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-white">{t.name}</span>
                    <span className="font-mono text-white font-bold">{t.percent}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-[#1A1C24] rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        t.percent > 70 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                        t.percent > 40 ? 'bg-gradient-to-r from-amber-500 to-orange-400' :
                        'bg-gradient-to-r from-[#FF5500] to-rose-500'
                      }`}
                      style={{ width: `${t.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1F212B] text-xs text-dark-400">
            Minimum operating reserve <strong>25%</strong> · all tanks above threshold
          </div>
        </div>
      </div>

      {/* Bottom 3 Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                NEEDS A CLOSER LOOK
              </span>
              {/* PDF Rule: Staff cannot use Investigate */}
              {currentUser.role !== 'Staff' ? (
                <span 
                  onClick={() => showToast('Opening inspection audit on Meter RH-C-04')}
                  className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-semibold cursor-pointer hover:underline"
                >
                  Investigate
                </span>
              ) : (
                <span className="text-[10px] text-dark-500 font-mono">
                  Read Only
                </span>
              )}
            </div>
            <h3 className="text-2xl font-black text-brand-orange mb-2">+18.7%</h3>
            <p className="text-xs text-dark-300 leading-relaxed">
              Unexpected draw, 01:00–04:00. Hall C held a steady flow after occupancy dropped; consistent with a running fixture or small leak.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1F212B] text-[11px] font-mono text-dark-400">
            South residential zone · Meter RH-C-04
          </div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider mb-3">
              TODAY · M³ · Use by campus zone
            </div>
            <div className="space-y-3">
              {zones.map((z, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-dark-200">{z.name}</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-white">{z.value}</span>
                    <span className={z.delta.startsWith('+') ? 'text-rose-400' : 'text-emerald-400'}>
                      {z.delta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1F212B] text-[11px] text-dark-400">
            Total active submeters: 15 units
          </div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-semibold text-brand-orange uppercase tracking-wider">
              RECOMMENDED ACTION · TARGETED CONSERVATION
            </span>
            <h3 className="text-sm font-bold text-white mt-1">Inspect Hall C overnight supply line</h3>
            <p className="text-xs text-dark-300 mt-1 leading-relaxed">
              A facilities check of the west wing fixtures is the fastest way to confirm the anomaly.
            </p>
            <div className="mt-3 p-3 bg-[#191A23] border border-[#262835] rounded-xl text-xs">
              <span className="text-white font-bold">~46 m³ estimated weekly savings</span>
              <span className="text-emerald-400 font-mono ml-1 font-semibold">(≈ ₹{weeklySaving.toLocaleString()})</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <button 
              onClick={() => {
                setAddedToAction(true);
                showToast(currentUser.role === 'Staff' 
                  ? 'Suggestion submitted for Hall C inspection' 
                  : 'Hall C inspection added to Actions Queue!');
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
                addedToAction 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white hover:brightness-110 shadow-lg shadow-orange-500/25'
              }`}
            >
              {addedToAction 
                ? (currentUser.role === 'Staff' ? 'Suggestion Submitted ✓' : 'Added to Actions Queue ✓')
                : (currentUser.role === 'Staff' ? 'Suggest for action plan' : 'Add to action plan → Actions')}
            </button>
            <div className="text-[11px] text-dark-400 text-center">
              Suggested owner: Facilities · routine inspection
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
