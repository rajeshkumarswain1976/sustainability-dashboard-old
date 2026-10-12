import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { 
  LayoutDashboard, 
  Zap, 
  Droplets, 
  Trash2, 
  Wind, 
  Cpu, 
  Navigation, 
  ShieldAlert, 
  CloudRain, 
  Leaf, 
  CheckSquare, 
  Bell,
  Lightbulb, 
  Search, 
  Sparkles, 
  Flame, 
  ArrowUpRight,
  LogOut,
  Lock
} from 'lucide-react';

export default function Sidebar() {
  const { 
    currentPage, 
    setCurrentPage, 
    setSearchModalOpen, 
    dashboardData, 
    currentUser, 
    organizationName,
    logout,
    canAccessPage 
  } = useDashboard();

  const energyBadge = `${dashboardData?.energy?.currentDemandKw ?? 0} kW`;
  const waterBadge = `${dashboardData?.water?.useTodayM3 ?? 0} m³`;
  const wasteBadge = `${dashboardData?.waste?.diversionRatePercent ?? 0}%`;
  const airBadge = `${dashboardData?.air?.aqi ?? 0} AQI`;

  const corePages = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard, badge: null },
    { id: 'energy', name: 'Energy', icon: Zap, badge: energyBadge },
    { id: 'water', name: 'Water', icon: Droplets, badge: waterBadge },
    { id: 'waste', name: 'Waste', icon: Trash2, badge: wasteBadge },
    { id: 'air', name: 'Air Quality', icon: Wind, badge: airBadge },
    { id: 'assets', name: 'Assets', icon: Cpu, badge: `${dashboardData?.assets?.maintenanceDueCount ?? 0} due` },
  ];

  const extendedPages = [
    { id: 'mobility', name: 'Mobility', icon: Navigation, badge: null },
    { id: 'safety', name: 'Safety', icon: ShieldAlert, badge: `${dashboardData?.safety?.openReports ?? 0} reports` },
    { id: 'climate', name: 'Climate', icon: CloudRain, badge: `${dashboardData?.climate?.heatIndexC ?? 0}°C` },
    { id: 'sustainability', name: 'Sustainability', icon: Leaf, badge: `${dashboardData?.overview?.score ?? 0}` },
    { id: 'actions', name: 'Actions Queue', icon: CheckSquare, badge: `${dashboardData?.actions?.openCount ?? 0} open` },
    { id: 'alerts', name: 'Alerts', icon: Bell, badge: `${dashboardData?.overview?.alertCounts?.open ?? 0}` },
    { id: 'insights', name: 'Insights & Copilot', icon: Lightbulb, badge: 'AI' },
  ];

  return (
    <aside className="w-64 bg-[#111216] border-r border-[#20222B] flex flex-col shrink-0 min-h-screen text-sm select-none">
      {/* Brand Header */}
      <div 
        onClick={() => setCurrentPage('overview')}
        className="p-5 flex items-center gap-3 border-b border-[#1E2028] cursor-pointer hover:bg-[#15161D] transition"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF5500] to-[#FF3D00] flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-bold text-lg">
          <Flame className="w-5 h-5 fill-white" />
        </div>
        <div>
          <div className="text-white font-bold text-base tracking-tight flex items-center gap-1.5">
            {organizationName} <span className="text-[10px] bg-[#22242E] text-brand-orange px-1.5 py-0.5 rounded font-mono font-medium">OS</span>
          </div>
          <div className="text-xs text-dark-400">Operations & Sustainability</div>
        </div>
      </div>

      {/* Search Input Trigger */}
      <div className="px-4 pt-4 pb-2">
        <div 
          onClick={() => setSearchModalOpen(true)}
          className="relative cursor-pointer group"
        >
          <Search className="w-4 h-4 text-dark-400 group-hover:text-white transition absolute left-3 top-2.5" />
          <div className="w-full bg-[#181920] group-hover:bg-[#1E202A] border border-[#252833] group-hover:border-brand-orange/50 rounded-xl pl-9 pr-9 py-2 text-xs text-dark-400 group-hover:text-dark-200 transition">
            Search metrics...
          </div>
          <kbd className="absolute right-2.5 top-2.5 text-[10px] bg-[#232632] text-dark-400 px-1.5 py-0.5 rounded font-mono border border-[#2E3240]">⌘K</kbd>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
        {/* Core Operations */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-dark-400 uppercase">
            Operations (1-6)
          </div>
          <div className="space-y-1">
            {corePages.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-gradient-to-r from-[#1E2028] to-[#252732] text-white border-l-4 border-brand-orange shadow-md shadow-black/30' 
                      : 'text-dark-300 hover:text-white hover:bg-[#181921]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-brand-orange' : 'text-dark-400'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                      isActive ? 'bg-[#FF5500]/20 text-brand-orange' : 'bg-[#1D1E27] text-dark-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Management & Insights */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-dark-400 uppercase">
            Management (7-12)
          </div>
          <div className="space-y-1">
            {extendedPages.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              const hasAccess = canAccessPage(item.id);

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-gradient-to-r from-[#1E2028] to-[#252732] text-white border-l-4 border-brand-orange shadow-md shadow-black/30' 
                      : !hasAccess
                      ? 'text-dark-500 hover:bg-[#15161E]'
                      : 'text-dark-300 hover:text-white hover:bg-[#181921]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-brand-orange' : hasAccess ? 'text-dark-400' : 'text-dark-600'}`} />
                    <span className={!hasAccess ? 'text-dark-500' : ''}>{item.name}</span>
                  </div>
                  
                  {!hasAccess ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Locked</span>
                    </span>
                  ) : item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                      isActive ? 'bg-[#FF5500]/20 text-brand-orange' : 'bg-[#1D1E27] text-dark-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Logged in User Profile Footer */}
      <div className="p-3 m-3 rounded-2xl bg-[#14151C] border border-[#242735] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#FF5500] to-[#FF3D00] flex items-center justify-center text-white font-bold text-[11px]">
              {currentUser?.avatarInitials}
            </div>
            <div>
              <div className="text-xs font-bold text-white truncate max-w-[110px]">{currentUser?.name?.split(' ')[0]}</div>
              <div className="text-[10px] text-dark-400 font-mono">{currentUser?.role}</div>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 rounded-lg text-dark-400 hover:text-rose-400 hover:bg-[#1F212C] transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
