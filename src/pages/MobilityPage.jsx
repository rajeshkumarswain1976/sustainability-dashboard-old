import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { USE_MOCK } from '../services/client';
import { 
  Navigation, 
  TrendingDown, 
  TrendingUp, 
  Car, 
  Clock, 
  Info, 
  ChevronDown,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

export default function MobilityPage({ setCurrentPage }) {
  const { dashboardData, filters } = useDashboard();
  const mobility = dashboardData?.mobility;
  const [trafficTab, setTrafficTab] = useState('flow');
  const [parkingView, setParkingView] = useState('table');

  const mockGarages = [
    { name: 'North Garage', percent: 88, status: 'high pressure', color: 'bg-rose-500' },
    { name: 'Library Court', percent: 81, status: 'filling', color: 'bg-amber-500' },
    { name: 'East Field', percent: 52, status: 'room', color: 'bg-emerald-500' },
  ];
  const garages = USE_MOCK ? mockGarages : (mobility?.garages || []).map(item => ({
    ...item, color: item.percent > 80 ? 'bg-rose-500' : 'bg-emerald-500'
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="text-xs font-mono text-dark-400 mb-1">
          Main Campus ▾ › Gate Zone › West Gate
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Mobility
              <span className="text-xs font-mono bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Historical Gate Replay
              </span>
            </h1>
            <p className="text-sm text-dark-300 mt-1">
              A clear view of how people and vehicles move through Campus A.
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

      {/* Snapshot Subhead Bar */}
      <div className="p-3 bg-[#171922] border border-[#242735] rounded-xl text-xs text-dark-300 flex items-center justify-between">
        <span>Movement & access Illustrative campus operations snapshot · Weekdays · 6 am–6 pm</span>
        <span className="font-mono text-dark-400">Avg speed 18 km/h</span>
      </div>

      {/* Main Grid: 01 Traffic Flow vs 02 Parking Utilisation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 01 / TRAFFIC Vehicle flow */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand-orange font-mono">01 / TRAFFIC</span>
                <span className="text-sm font-bold text-white">Vehicle flow</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-semibold">
                  Moderate congestion
                </span>
                <div className="flex bg-[#191A24] border border-[#262835] rounded-lg p-0.5 text-xs">
                  {['Flow', 'Class mix', 'Entries/Exits'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTrafficTab(t.toLowerCase())}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                        trafficTab === t.toLowerCase() ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-baseline justify-between text-xs py-2 border-y border-[#1E202B]">
              <div>
                <span className="text-dark-400">Daily entries:</span>{' '}
                <strong className="text-white text-base">{mobility?.dailyEntries ?? 0}</strong>{' '}
                <span className="text-emerald-400 font-mono text-[11px]">(▼ 4.8%)</span>
              </div>
              <div>
                <span className="text-dark-400">Typical delay:</span>{' '}
                <strong className="text-white">{mobility?.typicalDelayMin ?? 0} min</strong>{' '}
                <span className="text-amber-400 text-[11px]">· Peak 08:15</span>
              </div>
            </div>

            {/* SVG Traffic Flow Curve */}
            <div className="h-44 w-full pt-3">
              <svg viewBox="0 0 500 120" className="w-full h-full overflow-visible">
                <line x1="0" y1="30" x2="500" y2="30" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="70" x2="500" y2="70" stroke="#22242F" strokeWidth="1" strokeDasharray="3 3"/>

                {/* Flow line */}
                <path 
                  d="M0,90 Q80,95 150,40 T300,75 T350,60" 
                  fill="none" 
                  stroke="#FF5500" 
                  strokeWidth="3" 
                />

                {/* Forecast dashed */}
                <path 
                  d="M350,60 Q420,68 500,75" 
                  fill="none" 
                  stroke="#7E849A" 
                  strokeWidth="2.5" 
                  strokeDasharray="5 5" 
                />

                <circle cx="350" cy="60" r="4.5" fill="#FFFFFF" stroke="#FF5500" strokeWidth="2.5" />
              </svg>
            </div>

            <div className="text-[11px] text-dark-400 font-mono">
              Class mix: two-wheelers <strong>58%</strong> · cars <strong>31%</strong> · buses <strong>7%</strong> · other <strong>4%</strong>
            </div>

            <div className="p-3 bg-[#181A24] border border-[#262835] rounded-xl text-xs mt-3 space-y-1">
              <div className="text-dark-200">
                <strong>Traffic hotspots:</strong> West Gate approach (queue 08:20–08:50) · Science Loop (12–18 min delay)
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-gradient-to-r from-[#1D1B19] to-[#25201A] border border-[#3E2D1D] rounded-xl text-xs">
              <div className="text-brand-orange font-bold">Recommended next step:</div>
              <div className="text-white mt-0.5">
                Trial a 10-minute stagger for west-campus arrivals. Delay reduction <strong>−12%</strong>.
              </div>
            </div>

            <div className="p-2.5 bg-[#171922] border border-[#242735] rounded-xl text-xs flex items-center justify-between text-dark-400">
              <span>NEXT HOURS · PARKING DEMAND ⓘ Seasonal forecast · 74%</span>
              <span className="text-rose-400 font-semibold">North Garage reaches 88% by 09:40</span>
            </div>
          </div>
        </div>

        {/* 02 / PARKING Space utilisation */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 font-mono">02 / PARKING</span>
                <span className="text-sm font-bold text-white">Space utilisation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-semibold">
                  Capacity available
                </span>
                <div className="flex bg-[#191A24] border border-[#262835] rounded-lg p-0.5 text-xs">
                  <button 
                    onClick={() => setParkingView('map')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      parkingView === 'map' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                    }`}
                  >
                    Map
                  </button>
                  <button 
                    onClick={() => setParkingView('table')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      parkingView === 'table' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                    }`}
                  >
                    Table
                  </button>
                </div>
              </div>
            </div>

            {/* Big Capacity Headline */}
            <div className="my-2">
              <div className="text-4xl font-black text-white tracking-tight flex items-baseline gap-2">
                {mobility?.parkingOccupiedPercent ?? 0}% <span className="text-sm font-normal text-dark-400">occupied · open capacity <strong>{mobility?.openCapacitySpaces ?? 0} spaces</strong></span>
              </div>
              <div className="flex justify-between text-xs text-dark-300 mt-2 font-mono">
                <span>Peak demand 10:30 am · Tuesday 91% full</span>
                <span className="text-emerald-400">Avg. occupancy 74% · ▼ 2.1 pts</span>
              </div>
            </div>

            {/* Garage Breakdown Progress Bars */}
            <div className="space-y-4 my-4">
              {garages.map((g, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-white">{g.name}</span>
                    <span className="font-mono text-white font-bold">{g.percent}% · <span className="text-dark-400 font-normal">{g.status}</span></span>
                  </div>
                  <div className="h-2.5 w-full bg-[#1A1C24] rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        g.percent > 85 ? 'bg-gradient-to-r from-[#FF5500] to-rose-500' :
                        g.percent > 75 ? 'bg-gradient-to-r from-amber-500 to-orange-400' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${g.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs text-dark-400 leading-relaxed">
              Parking pressure: North Garage reaches 88% before 10 am · Library Court limited visitor spaces at midday
            </div>
          </div>

          {/* Utilisation Opportunity Card */}
          <div className="p-3.5 bg-gradient-to-r from-[#161B24] to-[#1C2230] border border-[#253246] rounded-xl text-xs space-y-1">
            <div className="text-sky-400 font-bold">Utilisation opportunity:</div>
            <div className="text-white">
              Direct staff arrivals to East Field when North Garage passes 80%.
            </div>
            <div className="text-[11px] text-dark-400 font-mono">
              Spaces to rebalance: <strong className="text-emerald-400">126</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
