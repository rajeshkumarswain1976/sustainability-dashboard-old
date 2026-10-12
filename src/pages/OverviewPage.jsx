import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { USE_MOCK } from '../services/client';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  CloudRain, 
  Wind, 
  Zap, 
  Droplets, 
  Trash2, 
  ShieldCheck, 
  Info, 
  ChevronRight, 
  ExternalLink, 
  Flame, 
  UserPlus, 
  BellRing 
} from 'lucide-react';

export default function OverviewPage() {
  const { 
    dashboardData, 
    setCurrentPage, 
    filters, 
    notifications, 
    acknowledgeNotification, 
    snoozeNotification,
    showToast 
  } = useDashboard();

  const [viewMode, setViewMode] = useState('map');
  const [assignedLead, setAssignedLead] = useState({});

  const handleAssignLead = (id, title) => {
    setAssignedLead(prev => {
      const nextState = prev[id] ? null : 'Lead Assigned ✓';
      if (!prev[id]) showToast(`Lead assigned to: ${title}`);
      return { ...prev, [id]: nextState };
    });
  };

  const defaultFactors = [
    { name: 'Energy', score: 81, status: 'On track', color: 'emerald', page: 'energy' },
    { name: 'Water', score: 74, status: 'Monitor', color: 'amber', page: 'water' },
    { name: 'Waste', score: 88, status: 'On track', color: 'emerald', page: 'waste' },
    { name: 'Air · AQI', score: 42, status: 'On track', color: 'emerald', page: 'air' },
    { name: 'Mobility', score: 67, status: 'Monitor', color: 'amber', page: 'mobility' },
    { name: 'Assets', score: '12 due', status: 'Action needed', color: 'orange', page: 'assets' },
    { name: 'Safety', score: 94, status: 'On track', color: 'emerald', page: 'safety' },
    { name: 'Climate', score: 68, status: 'Elevated', color: 'amber', page: 'climate' },
  ];

  const factors = dashboardData?.overview?.factors || (USE_MOCK ? defaultFactors : []);
  const score = dashboardData?.overview?.score ?? (USE_MOCK ? 78.4 : 0);
  const complaints = dashboardData?.overview?.complaints || (USE_MOCK ? { open: 14, overdue: 3 } : { open: 0, overdue: 0 });
  const utilization = dashboardData?.overview?.utilization || (USE_MOCK ? { classrooms: 64, labs: 71, hostels: 88 } : { classrooms: 0, labs: 0, hostels: 0 });

  const decisionItems = [
    { id: 1, title: 'Inspect irrigation leak', loc: 'North residence · Water · Urgent · Due today', tag: 'Urgent' },
    { id: 2, title: 'Service air handler AHU-04', loc: 'Science Hall · Assets · High · Due in 1 day', tag: 'High' },
    { id: 3, title: 'Review east gate queueing', loc: 'East entrance · Mobility · High · 2 days', tag: 'High' },
  ];

  return (
    <div className="space-y-6">
      {/* Title & Headline */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-dark-400 mb-1">
            {filters.location} ▾ › All zones › All buildings › All assets
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Overview</h1>
          <p className="text-sm text-dark-300 mt-1">
            A clear read on campus performance, emerging risks and the work that needs attention.
          </p>
        </div>

        {/* Anomaly Live Ticker Badge */}
        <div className="flex items-center gap-2 bg-[#1B1917] border border-[#3E251A] px-3.5 py-2 rounded-xl text-xs">
          <span className="w-2 h-2 rounded-full bg-brand-orange animate-ping" />
          <span className="font-semibold text-brand-orange">Anomaly:</span>
          <span className="text-dark-200">Library west flow +18.7% · Water · just now</span>
        </div>
      </div>

      {/* Top Grid: Hero Sustainability Score Card + Factor Health Grid + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Hero Card: Campus Sustainability Score */}
        <div className="lg:col-span-4 rounded-2xl bg-gradient-to-br from-[#FF5500] via-[#FF6622] to-[#FF3800] p-6 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold tracking-wider uppercase text-white/90">
                CAMPUS SUSTAINABILITY SCORE
              </span>
              <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full text-[11px] font-medium text-white flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +3.4 pts
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-5xl font-black tracking-tight">{score}</span>
              <span className="text-lg font-semibold text-white/80">/ 100</span>
            </div>

            <p className="text-xs text-white/90 flex items-center gap-1">
              <span>▲ 3.4 pts vs previous 6 weeks</span>
              <Info className="w-3.5 h-3.5 opacity-80" />
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/20">
            {/* Trend SVG Sparkline */}
            <div className="h-14 w-full">
              <svg viewBox="0 0 200 50" className="w-full h-full stroke-white fill-none stroke-[2.5]">
                <path d="M0,40 Q30,35 60,30 T120,24 T160,18 L200,10" />
                <circle cx="200" cy="10" r="4" className="fill-white" />
              </svg>
            </div>
            <div className="text-[11px] text-white/80 mt-2 flex justify-between items-center">
              <span>Six-week trend · Improving</span>
              <span className="font-mono text-[10px]">28 Aug → Today 9 Oct</span>
            </div>
          </div>
        </div>

        {/* Campus Health Factors Grid */}
        <div className="lg:col-span-5 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-semibold tracking-wider text-dark-400 uppercase">
                  Campus Health · 5 On Track · 2 Monitor · 1 Action
                </span>
                <h3 className="text-base font-bold text-white">Performance by factor</h3>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {factors.map((f, i) => (
                <div 
                  key={i} 
                  onClick={() => setCurrentPage(f.page)}
                  className="bg-[#191B22] hover:bg-[#20232E] border border-[#262835] rounded-xl p-3 cursor-pointer transition flex flex-col justify-between group"
                >
                  <div className="text-[11px] font-medium text-dark-400 group-hover:text-white transition">
                    {f.name}
                  </div>
                  <div className="text-xl font-bold text-white my-1">
                    {f.score}
                  </div>
                  <div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      f.color === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' :
                      f.color === 'amber' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-orange-500/20 text-brand-orange'
                    }`}>
                      {f.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1F212B] flex items-center justify-between text-xs text-dark-400">
            <span>Aggregated from 1,420 IoT monitoring nodes ({filters.sector})</span>
            <button 
              onClick={() => setCurrentPage('sustainability')}
              className="text-brand-orange hover:underline flex items-center gap-1 font-medium"
            >
              Detailed matrix <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Notifications Panel */}
        <div className="lg:col-span-3 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-brand-orange" />
                <h3 className="text-sm font-bold text-white">Notifications · {dashboardData?.overview?.alertCounts?.open ?? notifications.length}</h3>
              </div>
              <div className="text-[10px] text-dark-400 flex gap-1.5">
                <span className="text-brand-orange font-bold">All</span>
                <span>·</span>
                <span>Info</span>
                <span>·</span>
                <span>Warning</span>
                <span>·</span>
                <span>Critical</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {notifications.slice(0, 3).map((n) => (
                <div key={n.id} className="p-3 bg-[#181921] border border-[#252834] rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      n.type === 'critical' ? 'bg-rose-500/20 text-rose-400' :
                      n.type === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-sky-500/20 text-sky-400'
                    }`}>
                      {n.badge}{n.confidence != null ? ` · ${Math.round(n.confidence * 100)}%` : ''}
                    </span>
                    <span className="text-[10px] text-dark-400 font-mono">{n.meta?.split(' · ')[1] || ''}</span>
                  </div>
                  <div className="font-semibold text-white text-xs leading-snug">
                    {n.title}
                  </div>
                  <div className="text-[11px] text-dark-400">
                    {n.meta}
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <button 
                      onClick={() => acknowledgeNotification(n.id)}
                      className="px-2 py-1 bg-[#232530] hover:bg-brand-orange hover:text-white rounded text-[10px] text-dark-300 font-medium transition cursor-pointer"
                    >
                      Acknowledge
                    </button>
                    <button 
                      onClick={() => snoozeNotification(n.id)}
                      className="px-2 py-1 bg-[#232530] hover:bg-[#2E3140] rounded text-[10px] text-dark-400 font-medium transition cursor-pointer"
                    >
                      Snooze
                    </button>
                    <button 
                      onClick={() => {
                        setCurrentPage(n.page);
                        showToast(`Opened ${n.page} details`);
                      }}
                      className="px-2 py-1 bg-[#232530] hover:bg-[#2E3140] rounded text-[10px] text-dark-400 font-medium transition cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Grid: Decision Queue + Campus Pulse + Operational Hotspots */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Decision Queue */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                  Decision Queue · Prioritised by urgency
                </span>
                <h3 className="text-sm font-bold text-white">Three actions need a lead</h3>
              </div>
              <span className="text-[10px] font-mono bg-brand-orange/20 text-brand-orange px-2 py-0.5 rounded-full font-bold">
                {Object.keys(assignedLead).filter(k => assignedLead[k]).length} of 3 owned
              </span>
            </div>

            <div className="space-y-2.5">
              {decisionItems.map((item) => (
                <div key={item.id} className="p-3 bg-[#191A23] border border-[#262835] rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white">{item.title}</h4>
                    <p className="text-[11px] text-dark-400 mt-0.5">{item.loc}</p>
                  </div>
                  <button 
                    onClick={() => handleAssignLead(item.id, item.title)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer ${
                      assignedLead[item.id]
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white hover:brightness-110 shadow-md shadow-orange-500/20'
                    }`}
                  >
                    {assignedLead[item.id] || 'Assign lead'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1E202A] text-right">
            <button 
              onClick={() => setCurrentPage('actions')}
              className="text-xs text-brand-orange hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              Go to Actions Queue →
            </button>
          </div>
        </div>

        {/* Campus Pulse */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                  Campus Pulse · Updated 10:42
                </span>
                <h3 className="text-sm font-bold text-white">Complaints & conditions</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-3 bg-[#191A23] border border-[#252834] rounded-xl">
                <div className="text-[11px] text-dark-400">Open complaints</div>
                <div className="text-2xl font-black text-white mt-0.5">{complaints.open}</div>
              </div>
              <div className="p-3 bg-[#191A23] border border-[#252834] rounded-xl">
                <div className="text-[11px] text-dark-400">Overdue</div>
                <div className="text-2xl font-black text-rose-400 mt-0.5">{complaints.overdue}</div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-[#191A23] border border-[#252834] rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Leaking tap · Library west</div>
                  <div className="text-[11px] text-dark-400">Water · Work order opened</div>
                </div>
                <span className="text-[10px] text-dark-400 font-mono">2h ago</span>
              </div>

              <div className="p-2.5 bg-[#191A23] border border-[#252834] rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Warm study room · Science</div>
                  <div className="text-[11px] text-dark-400">Comfort · Past response target</div>
                </div>
                <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-mono font-medium">Overdue</span>
              </div>
            </div>
          </div>

          <div className="mt-3 p-3 bg-gradient-to-r from-[#171922] to-[#1E202B] border border-[#272A38] rounded-xl flex items-center justify-between text-xs">
            <div>
              <div className="text-[10px] text-dark-400">Campus weather · local 10:30</div>
              <div className="font-bold text-white mt-0.5">32°C · 68% humidity · 85% rain chance</div>
              <div className="text-[11px] text-sky-400 font-medium">Showers incoming</div>
            </div>
            <CloudRain className="w-7 h-7 text-sky-400" />
          </div>
        </div>

        {/* Operational Hotspots */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                  Where to look
                </span>
                <h3 className="text-sm font-bold text-white">Operational hotspots</h3>
              </div>
              <div className="flex items-center bg-[#191A23] border border-[#262835] rounded-lg p-0.5 text-xs">
                <button 
                  onClick={() => setViewMode('map')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    viewMode === 'map' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  Map
                </button>
                <button 
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    viewMode === 'table' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  Table
                </button>
              </div>
            </div>

            {viewMode === 'map' ? (
              <div className="relative h-44 bg-[#181922] border border-[#242735] rounded-xl overflow-hidden p-3 flex flex-col justify-between">
                <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10,20 L150,40 L280,10 L350,80" stroke="#7E849A" strokeWidth="1.5" fill="none" strokeDasharray="3 3"/>
                  <path d="M40,120 L180,90 L260,150 L340,110" stroke="#7E849A" strokeWidth="1.5" fill="none"/>
                  <rect x="70" y="30" width="60" height="40" stroke="#7E849A" strokeWidth="1" fill="#1C1E28" />
                  <rect x="180" y="70" width="70" height="50" stroke="#7E849A" strokeWidth="1" fill="#1C1E28" />
                </svg>

                <div className="relative z-10 flex flex-col justify-between h-full">
                  <div 
                    onClick={() => setCurrentPage('water')}
                    className="flex items-center gap-2 cursor-pointer hover:scale-105 transition"
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs font-bold text-white bg-black/60 px-2 py-0.5 rounded border border-rose-500/50">
                      NORTH RES. (Leak)
                    </span>
                  </div>

                  <div 
                    onClick={() => setCurrentPage('energy')}
                    className="flex items-center gap-2 self-center cursor-pointer hover:scale-105 transition"
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-bold text-white bg-black/60 px-2 py-0.5 rounded border border-amber-500/50">
                      SCIENCE HALL (AHU-04)
                    </span>
                  </div>

                  <div 
                    onClick={() => setCurrentPage('mobility')}
                    className="flex items-center gap-2 self-end cursor-pointer hover:scale-105 transition"
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs font-bold text-white bg-black/60 px-2 py-0.5 rounded border border-rose-500/50">
                      EAST GATE (Queue)
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <div 
                  onClick={() => setCurrentPage('water')}
                  className="p-2 bg-[#191A23] rounded-lg border border-[#252834] flex justify-between items-center cursor-pointer hover:border-brand-orange"
                >
                  <span className="font-semibold text-white">North residence</span>
                  <span className="text-rose-400 font-mono">Urgent leak</span>
                </div>
                <div 
                  onClick={() => setCurrentPage('energy')}
                  className="p-2 bg-[#191A23] rounded-lg border border-[#252834] flex justify-between items-center cursor-pointer hover:border-brand-orange"
                >
                  <span className="font-semibold text-white">Science Hall</span>
                  <span className="text-amber-400 font-mono">AHU-04 Overload</span>
                </div>
                <div 
                  onClick={() => setCurrentPage('mobility')}
                  className="p-2 bg-[#191A23] rounded-lg border border-[#252834] flex justify-between items-center cursor-pointer hover:border-brand-orange"
                >
                  <span className="font-semibold text-white">East entrance</span>
                  <span className="text-amber-400 font-mono">Mobility gate delay</span>
                </div>
              </div>
            )}

            <div className="mt-3 text-[11px] text-dark-300">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1.5" />
              Active operational hotspot · <strong>3 locations</strong> require attention
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#1E202A] flex gap-2">
            <span onClick={() => setCurrentPage('water')} className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 text-[10px] font-semibold cursor-pointer">North residence</span>
            <span onClick={() => setCurrentPage('energy')} className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-[10px] font-semibold cursor-pointer">Science Hall</span>
            <span onClick={() => setCurrentPage('mobility')} className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 text-[10px] font-semibold cursor-pointer">East entrance</span>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Campus Operations */}
      <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#1E202A] text-brand-orange">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-dark-400 uppercase">
              Campus Operations · {filters.sector} Only
            </div>
            <div className="text-sm font-bold text-white flex items-center gap-4 mt-0.5">
              <span>Classrooms <strong className="text-brand-orange">{utilization.classrooms}%</strong></span>
              <span>·</span>
              <span>Labs <strong className="text-brand-orange">{utilization.labs}%</strong></span>
              <span>·</span>
              <span>Hostels <strong className="text-brand-orange">{utilization.hostels}%</strong></span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setCurrentPage('sustainability')}
          className="px-4 py-2 bg-[#1C1E27] hover:bg-[#252835] border border-[#292D3D] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <span>Utilisation today Open details</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
