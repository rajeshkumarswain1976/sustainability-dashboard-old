import { USE_MOCK } from '../services/client';
import ForecastPanel from '../components/ForecastPanel';
import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { 
  CloudRain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Thermometer, 
  Wind, 
  Droplet,
  ChevronDown
} from 'lucide-react';

export default function ClimatePage({ setCurrentPage }) {
  const { dashboardData, filters } = useDashboard();
  const climate = dashboardData?.climate;
  const [activeTab, setActiveTab] = useState('scores');
  const [hotspotView, setHotspotView] = useState('table');
  const [filterType, setFilterType] = useState('drainage');
  const [addedToAction, setAddedToAction] = useState(false);

  const waterloggingSpots = [
    { loc: 'Library underpass', detail: 'drain inlet inspection due · Friday peak', risk: 'High', rate: '72% pooling risk', color: 'text-rose-400 bg-rose-500/15' },
    { loc: 'North Quad', detail: 'west walk · shallow ponding', risk: 'Moderate', rate: '41%', color: 'text-amber-400 bg-amber-500/15' },
    { loc: 'South loading bay', detail: 'surface grate clears slowly', risk: 'Watch', rate: '28%', color: 'text-emerald-400 bg-emerald-500/15' },
  ];

  return (
    <div className="space-y-6">
      {!USE_MOCK && <ForecastPanel domain="weather" title="Weather outlook" />}

      {/* Page Header */}
      <div>
        <div className="text-xs font-mono text-dark-400 mb-1">
          Main Campus ▾ › South Zone › Library underpass
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Climate
              <span className="text-xs font-mono bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/20">
                Preparedness Index {climate?.preparednessIndex ?? 0} / 100
              </span>
            </h1>
            <p className="text-sm text-dark-300 mt-1">
              A forward view of heat and rainfall exposure across campus operations.
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

      {/* Top Section: Preparedness Index & Weather Station */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Campus Climate Risk (7 cols) */}
        <div className="lg:col-span-7 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">CAMPUS CLIMATE RISK</span>
                <span className="text-xs font-bold text-white">Preparedness index</span>
                <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-semibold">Elevated</span>
              </div>
              <div className="flex bg-[#191A24] border border-[#262835] rounded-lg p-0.5 text-xs">
                {['Scores', 'Resilience'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t.toLowerCase())}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      activeTab === t.toLowerCase() ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="my-2">
              <div className="text-4xl font-black text-white tracking-tight flex items-baseline gap-2">
                {climate?.preparednessIndex ?? 0} <span className="text-sm font-normal text-dark-400">/ 100 · replay</span>
              </div>
              <p className="text-xs text-dark-300 mt-2 leading-relaxed">
                Heat stress and Friday's rainfall elevate exposure around low-lying paths. Core operations remain within response capacity. <strong className="text-amber-400">▲ 14 pts above seasonal baseline</strong>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 bg-[#181A23] border border-[#252834] rounded-xl">
                <div className="text-[11px] text-dark-400">Heat score</div>
                <div className="text-xl font-bold text-amber-400 mt-0.5">61</div>
              </div>
              <div className="p-3 bg-[#181A23] border border-[#252834] rounded-xl">
                <div className="text-[11px] text-dark-400">Flood score</div>
                <div className="text-xl font-bold text-rose-400 mt-0.5">74</div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1F212B] text-xs text-dark-400 font-mono">
            Resilience: power backup 6 h · water stress Medium · asset climate risk 3 high
          </div>
        </div>

        {/* Observed Now · Weather Station (5 cols) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#191C27] to-[#12141C] border border-[#262B3D] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                OBSERVED NOW · CAMPUS WEATHER STATION
              </span>
            </div>
            <h3 className="text-xs text-dark-300">Heat conditions</h3>

            <div className="my-4">
              <div className="text-5xl font-black text-amber-400 tracking-tight flex items-baseline gap-2">
                {climate?.heatIndexC ?? 0}°C
                <span className="text-xs font-normal text-dark-300">heat index · feels like</span>
              </div>
              <div className="text-xs text-dark-400 mt-1">air temp 32°C</div>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-[#222536] text-xs">
            <div className="flex justify-between text-dark-200">
              <span>Cooling load:</span>
              <strong className="text-white">{climate?.coolingLoadMw ?? 0} MW</strong>
            </div>
            <div className="flex justify-between text-dark-300">
              <span>Relative humidity: <strong className="text-white">68%</strong></span>
              <span>Wind: <strong className="text-white">11 km/h NE</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Grid: 7-Day Outlook & Weather Watch Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Outlook Chart (7 cols) */}
        <div className="lg:col-span-7 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
{!USE_MOCK ? <ForecastPanel domain="climate" compact /> : <>

          <div>
            <div className="flex justify-between items-center mb-2">
              <div>
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                  8–14 OCTOBER 2026
                </span>
                <h3 className="text-sm font-bold text-white">Seven-day outlook · Daily high & rainfall</h3>
              </div>
            </div>

            {/* Rainfall Bar/Curve Visualizer */}
            <div className="h-44 w-full pt-3">
              <svg viewBox="0 0 500 130" className="w-full h-full overflow-visible">
                {/* Friday Peak Rain Highlight Bar */}
                <rect x="90" y="20" width="40" height="90" fill="#FF5500" rx="4" opacity="0.3" />
                
                {/* Curve */}
                <path 
                  d="M20,90 Q110,20 180,75 T320,60 T480,70" 
                  fill="none" 
                  stroke="#38BDF8" 
                  strokeWidth="3" 
                />

                <circle cx="110" cy="30" r="5" fill="#FF5500" stroke="#FFFFFF" strokeWidth="2" />
              </svg>
            </div>
          </div>

          <div className="mt-2 flex justify-between text-[11px] text-dark-400 font-mono">
            <span>Thu 8</span>
                  <span className="text-brand-orange font-bold">{filters.snapshotDate} ({climate?.rainAlertMm ?? 0} mm)</span>
            <span>Sat 10</span>
            <span>Sun 11</span>
            <span>Mon 12</span>
            <span>Tue 13</span>
            <span>Wed 14</span>
          </div>

</>}
</div>

        {/* Weather Watch (5 cols) */}
        <div className="lg:col-span-5 bg-[#1F1716] border border-[#44221D] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">WEATHER WATCH</span>
              <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded font-bold">Prepare response</span>
            </div>
            <h3 className="text-base font-bold text-white">Heavy rain alert</h3>
            <div className="text-xs font-semibold text-brand-orange mt-1">
              Rainfall replay · {climate?.rainAlertMm ?? 0} mm / 6 hr
            </div>
            <p className="text-xs text-dark-300 mt-2 leading-relaxed">
              Peak showers may overwhelm surface drains in lower campus areas.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-[#3A221E] text-xs text-dark-400 flex justify-between items-center">
            <span>Fri 9 Oct · 17:00–23:00</span>
            <span className="text-brand-orange font-mono font-bold">74% confidence ⓘ</span>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Waterlogging Hotspots & Recommended Response */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Hotspots (7 cols) */}
        <div className="lg:col-span-7 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                EXPOSURE WATCH · 3 LOCATIONS MONITORED
              </span>
              <h3 className="text-sm font-bold text-white">Waterlogging hotspots</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-[#191A24] border border-[#262835] rounded-lg p-0.5 text-xs">
                {['Drainage', 'Elevation'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t.toLowerCase())}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      filterType === t.toLowerCase() ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex bg-[#191A24] border border-[#262835] rounded-lg p-0.5 text-xs">
                <button 
                  onClick={() => setHotspotView('map')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    hotspotView === 'map' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  Map
                </button>
                <button 
                  onClick={() => setHotspotView('table')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    hotspotView === 'table' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  Table
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {waterloggingSpots.map((item, idx) => (
              <div key={idx} className="p-3 bg-[#181A23] border border-[#252834] rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">{item.loc}</div>
                  <div className="text-[11px] text-dark-400">{item.detail}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${item.color}`}>{item.risk}</span>
                  <span className="font-mono text-white font-bold">{item.rate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Response (5 cols) */}
        <div className="lg:col-span-5 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between space-y-4">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-brand-orange uppercase tracking-wider">
                RECOMMENDED RESPONSE
              </span>
              <span className="text-xs bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded font-semibold">
                Priority 1
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">Clear drains before Friday</h3>
            <p className="text-xs text-dark-300 mt-2 leading-relaxed">
              Inspect the Library underpass and North Quad inlets by 15:00 today. Assign Facilities to clear leaf build-up; stage one portable pump at the underpass. Expected to reduce pooling exposure at two locations before the 46 mm event.
            </p>
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
        </div>
      </div>
    </div>
  );
}
