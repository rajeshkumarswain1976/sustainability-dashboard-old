import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { 
  Wind, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  Compass, 
  ShieldCheck, 
  ChevronDown
} from 'lucide-react';

export default function AirPage({ setCurrentPage }) {
  const { dashboardData, filters } = useDashboard();
  const air = dashboardData?.air;
  const [activePollutant, setActivePollutant] = useState('PM2.5');
  const [stationType, setStationType] = useState('regional');

  const pollutants = ['PM2.5', 'PM10', 'NO₂', 'SO₂', 'CO', 'CO₂'];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="text-xs font-mono text-dark-400 mb-1">
          Main Campus ▾ › All zones › Regional monitor
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Air
              <span className="text-xs font-mono bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                AQI {air?.aqi ?? 0} · {air?.status || 'Unknown'}
              </span>
            </h1>
            <p className="text-sm text-dark-300 mt-1">
              Regional conditions that may affect campus operations.
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

      {/* Top Section: 7-Day Chart with Pollutant Pills + Current Reading Hero Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart Column (8 cols) */}
        <div className="lg:col-span-8 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">AIR QUALITY · 7-DAY VIEW</span>
                  <span className="text-sm font-bold text-white">A steadier air mass is moving through</span>
                  <Info className="w-3.5 h-3.5 text-dark-400" />
                </div>
              </div>
              <div className="flex bg-[#181A23] border border-[#262835] rounded-lg p-0.5 text-xs">
                <button 
                  onClick={() => setStationType('regional')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                    stationType === 'regional' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  Regional
                </button>
                <button 
                  onClick={() => setStationType('on-campus')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                    stationType === 'on-campus' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  On-campus
                </button>
              </div>
            </div>

            {/* Pollutants Pill Buttons */}
            <div className="flex gap-2 flex-wrap mb-3">
              {pollutants.map((p) => (
                <button
                  key={p}
                  onClick={() => setActivePollutant(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition ${
                    activePollutant === p
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-[#181A24] text-dark-400 hover:text-white border border-[#252834]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* SVG Chart */}
            <div className="h-44 w-full pt-2">
              <svg viewBox="0 0 600 140" className="w-full h-full overflow-visible">
                <line x1="0" y1="30" x2="600" y2="30" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="70" x2="600" y2="70" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="110" x2="600" y2="110" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>

                {/* Actual AQI Curve */}
                <path 
                  d="M0,80 Q100,50 200,60 T350,55 T450,50" 
                  fill="none" 
                  stroke="#10B981" 
                  strokeWidth="3" 
                />

                {/* Forecast dashed */}
                <path 
                  d="M450,50 Q520,53 600,55" 
                  fill="none" 
                  stroke="#7E849A" 
                  strokeWidth="2.5" 
                  strokeDasharray="5 5" 
                />

                <circle cx="450" cy="50" r="4.5" fill="#FFFFFF" stroke="#10B981" strokeWidth="2.5" />
              </svg>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-dark-400 flex justify-between">
            <span>Today · Fri 9 Oct (dashed = forecast)</span>
            <span className="font-mono">Observed AQI · Next-day estimate 47 · Updated 10:00</span>
          </div>
        </div>

        {/* Current Reading Hero Card (4 cols) */}
        <div className="lg:col-span-4 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                CURRENT READING
              </span>
              <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-semibold">
                Good
              </span>
            </div>
            <div className="text-xs text-dark-400">Regional air quality</div>

            <div className="my-4">
              <div className="text-5xl font-black text-white tracking-tight flex items-baseline gap-2">
                42 <span className="text-lg font-bold text-dark-400">AQI</span>
              </div>
              <div className="text-xs text-emerald-400 font-medium mt-1">
                Good · suitable for normal activity
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#1F212B] grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 bg-[#181A24] rounded-xl border border-[#252834]">
              <div className="text-dark-400 text-[11px]">PM2.5</div>
              <div className="text-white font-bold font-mono mt-0.5">8.4 µg/m³</div>
            </div>
            <div className="p-2.5 bg-[#181A24] rounded-xl border border-[#252834]">
              <div className="text-dark-400 text-[11px]">Ozone</div>
              <div className="text-white font-bold font-mono mt-0.5">31 ppb</div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Weekly mean AQI</div>
          <div className="text-3xl font-extrabold text-white mt-1">{air?.weeklyMeanAqi ?? 0}</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-emerald-400">−8.1% vs prior week</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">PM2.5, 24h mean</div>
          <div className="text-3xl font-extrabold text-white mt-1">9.7 µg/m³</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-emerald-400">Within guide</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Wind direction</div>
          <div className="text-3xl font-extrabold text-white mt-1">{air?.wind || '—'}</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-dark-400">2.4 m/s · away from campus</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Outlook</div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-1">{air?.outlook || '—'}</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-dark-400">No alert expected · 24h</div>
        </div>
      </div>

      {/* Bottom 3 Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Recent signals */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark space-y-3">
          <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
            RECENT SIGNALS · POLLUTION EVENTS
          </span>
          
          <div className="p-3 bg-[#181A23] border border-[#252834] rounded-xl text-xs space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="font-bold text-white">07 Oct Fine-particle rise, evening</span>
              <span className="font-mono text-brand-orange font-bold">+19</span>
            </div>
            <div className="text-[11px] text-dark-400">18:00–21:00 · Regional monitor</div>
          </div>

          <div className="p-3 bg-[#181A23] border border-[#252834] rounded-xl text-xs space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="font-bold text-white">04 Oct AQI briefly crossed 60</span>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded font-mono">Resolved</span>
            </div>
            <div className="text-[11px] text-dark-400">12:00–13:00 · Wind shift</div>
          </div>
        </div>

        {/* Regional watch */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
              REGIONAL WATCH · 1 WATCH · HOTSPOTS
            </span>

            <div className="space-y-2 mt-3 text-xs">
              <div className="flex justify-between items-center p-2.5 bg-[#181A23] rounded-xl border border-[#252834]">
                <div>
                  <div className="text-white font-medium">North freight corridor</div>
                  <div className="text-[11px] text-dark-400">Upwind regional area · 3.1 km</div>
                </div>
                <span className="font-mono text-base font-bold text-amber-400">58</span>
              </div>

              <div className="flex justify-between items-center p-2.5 bg-[#181A23] rounded-xl border border-[#252834]">
                <div>
                  <div className="text-white font-medium">Civic monitoring site</div>
                  <div className="text-[11px] text-dark-400">Secondary station · 6.2 km</div>
                </div>
                <span className="font-mono text-base font-bold text-emerald-400">39</span>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2.5 bg-[#1E1C1A] border border-[#3E2C1A] rounded-xl text-[11px] text-dark-300">
            PM2.5 rose 21% faster than the seasonal morning pattern; below advisory thresholds.
          </div>
        </div>

        {/* Recommended response */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between space-y-3">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-brand-orange uppercase tracking-wider">
                RECOMMENDED RESPONSE
              </span>
              <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-semibold">
                No restriction
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mt-1">Keep outdoor activity as planned</h3>
            <p className="text-xs text-dark-300 mt-2 leading-relaxed">
              No campus-wide advisory is indicated. Maintain normal outdoor schedules; ask facilities to recheck if haze or odour is reported. Review at 14:00.
            </p>
          </div>

          <div className="p-3 bg-[#181A24] border border-[#252834] rounded-xl text-xs space-y-1">
            <div className="text-dark-400 text-[11px]">Environmental response · Policy ENV-04 §3.2</div>
            <div className="text-white font-semibold">Escalate when AQI exceeds 100</div>
          </div>
        </div>
      </div>
    </div>
  );
}
