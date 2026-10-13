import React, { useState, useRef, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { USE_MOCK } from '../services/client';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Bell, 
  Mail, 
  HelpCircle, 
  Share2, 
  RotateCcw, 
  Building, 
  User, 
  Calendar, 
  Layers, 
  Search, 
  Check, 
  LogOut,
  ShieldCheck,
  UserCheck,
  Wrench,
  Sun,
  Moon
} from 'lucide-react';

export default function Header({ breadcrumbExtra }) {
  const {
    currentPage,
    setCurrentPage,
    filters,
    updateFilter,
    resetFilters,
    notifications,
    setNotificationDrawerOpen,
    setSearchModalOpen,
    setShareModalOpen,
    setDatePickerOpen,
    showToast,
    FILTER_OPTIONS,
    currentUser,
    logout,
    theme,
    setTheme,
    organizationName,
    locations
  } = useDashboard();

  const [openDropdown, setOpenDropdown] = useState(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const headerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setOpenDropdown(null);
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name) => {
    setOpenDropdown(prev => prev === name ? null : name);
  };

  const getPageTitle = (page) => {
    switch (page) {
      case 'overview': return 'Overview';
      case 'energy': return 'Energy';
      case 'water': return 'Water';
      case 'waste': return 'Waste';
      case 'air': return 'Air';
      case 'assets': return 'Assets';
      case 'mobility': return 'Mobility';
      case 'safety': return 'Safety';
      case 'climate': return 'Climate';
      case 'sustainability': return 'Sustainability';
      case 'actions': return 'Actions';
      case 'alerts': return 'Alerts';
      case 'insights': return 'Insights';
      default: return 'Overview';
    }
  };

  const pageOrder = [
    'overview', 'energy', 'water', 'waste', 'air', 'assets',
    'mobility', 'safety', 'climate', 'sustainability', 'actions', 'alerts', 'insights'
  ];

  const handlePrevPage = () => {
    const idx = pageOrder.indexOf(currentPage);
    if (idx > 0) setCurrentPage(pageOrder[idx - 1]);
  };

  const handleNextPage = () => {
    const idx = pageOrder.indexOf(currentPage);
    if (idx < pageOrder.length - 1) setCurrentPage(pageOrder[idx + 1]);
  };

  // PDF Rule: Administrator sees every location. Department Head & Staff see only assigned locations.
  const availableLocations = USE_MOCK ? (currentUser.role === 'Administrator'
    ? FILTER_OPTIONS.locations : currentUser.assignedLocations)
    : locations.map(item => item.label);

  return (
    <header ref={headerRef} className="bg-[#111216] border-b border-[#20222B] px-6 py-3.5 sticky top-0 z-30 flex flex-col gap-3">
      {/* Top Level Nav Row */}
      <div className="flex items-center justify-between">
        
        {/* Navigation History & Breadcrumb */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-dark-400">
            <button 
              onClick={handlePrevPage}
              title="Previous page"
              className="p-1.5 rounded-lg hover:bg-[#1A1C24] hover:text-white transition disabled:opacity-30 cursor-pointer"
              disabled={pageOrder.indexOf(currentPage) === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={handleNextPage}
              title="Next page"
              className="p-1.5 rounded-lg hover:bg-[#1A1C24] hover:text-white transition disabled:opacity-30 cursor-pointer"
              disabled={pageOrder.indexOf(currentPage) === pageOrder.length - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span 
              onClick={() => setCurrentPage('overview')} 
              className="text-dark-400 font-medium hover:text-white cursor-pointer transition"
            >
              Agenexus
            </span>
            <span className="text-dark-500">›</span>
            <span 
              onClick={() => setCurrentPage('overview')} 
              className="text-dark-400 font-medium hover:text-white cursor-pointer transition"
            >
              {organizationName} Operations
            </span>
            <span className="text-dark-500">›</span>
            <span className="text-white font-semibold bg-[#1C1E26] px-2.5 py-1 rounded-lg border border-[#282B37]">
              {getPageTitle(currentPage)}
            </span>
            {breadcrumbExtra && (
              <>
                <span className="text-dark-500">›</span>
                <span className="text-brand-orange font-mono text-[11px]">{breadcrumbExtra}</span>
              </>
            )}
          </div>
        </div>

        {/* Right Action Icons & Controls */}
        <div className="flex items-center gap-3">
          {/* Snapshot Date Badge */}
          <button 
            onClick={() => setDatePickerOpen(true)}
            title="Change snapshot date"
            className="hidden lg:flex items-center gap-2 text-xs bg-[#171821] hover:bg-[#20222E] border border-[#262835] hover:border-brand-orange px-3 py-1.5 rounded-xl text-dark-300 transition group cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-brand-orange group-hover:scale-110 transition" />
            <span>Snapshot: <strong className="text-white">{filters.snapshotDate}</strong></span>
          </button>

          {/* Quick Icons */}
          <div className="flex items-center gap-1.5 text-dark-300">
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              className="p-2 rounded-xl bg-[#171821] hover:bg-[#20222E] hover:text-white border border-[#252835] transition cursor-pointer"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => setSearchModalOpen(true)}
              title="Search dashboard (⌘K)"
              className="p-2 rounded-xl bg-[#171821] hover:bg-[#20222E] hover:text-white border border-[#252835] transition cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>

            <button 
              onClick={() => showToast('Help Desk: All 12 sectors and sensor feeds online.')}
              title="Help & docs"
              className="p-2 rounded-xl bg-[#171821] hover:bg-[#20222E] hover:text-white border border-[#252835] transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button 
              onClick={() => showToast('Advisory inbox: 0 unread alerts')}
              title="Messages"
              className="p-2 rounded-xl bg-[#171821] hover:bg-[#20222E] hover:text-white border border-[#252835] transition cursor-pointer"
            >
              <Mail className="w-4 h-4" />
            </button>

            {/* Notification Bell */}
            <button 
              onClick={() => setNotificationDrawerOpen(true)}
              title="View notifications"
              className="relative p-2 rounded-xl bg-[#171821] hover:bg-[#20222E] hover:text-white border border-[#252835] transition cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                  {notifications.length}
                </span>
              )}
            </button>
          </div>

          {/* User Profile & Role Info (Per PDF: Role comes from Login) */}
          <div className="relative">
            <div 
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 pl-2 border-l border-[#242735] cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-[#2E3140] group-hover:ring-brand-orange transition">
                {currentUser?.avatarInitials || 'AD'}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-white leading-tight">{currentUser?.name?.split(' ')[0]}</span>
                <span className="text-[10px] text-brand-orange font-medium">{currentUser?.role}</span>
              </div>
            </div>

            {/* Profile Dropdown */}
            {profileDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-[#161720] border border-[#262938] rounded-2xl shadow-2xl z-50 p-3 space-y-2.5 animate-in fade-in">
                <div className="border-b border-[#20222E] pb-2">
                  <div className="text-xs font-bold text-white">{currentUser?.name}</div>
                  <div className="text-[11px] text-dark-400">{currentUser?.email}</div>
                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-orange/20 text-brand-orange font-mono text-[10px] font-bold">
                    {currentUser?.role} Mode
                  </div>
                </div>

                <div className="text-[11px] text-dark-300 space-y-1">
                  <div><strong>Assigned Scope:</strong></div>
                  <div className="text-[10px] text-dark-400 font-mono">
                    {currentUser?.assignedLocations?.join(', ')}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#20222E]">
                  <button
                    onClick={logout}
                    className="w-full py-2 px-3 bg-[#1F212D] hover:bg-rose-500/20 hover:text-rose-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition text-dark-200 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out & Switch Role</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Glowing Orange Explore / Share Button */}
          <button 
            onClick={() => setShareModalOpen(true)}
            title="Explore & Export Menu"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF5500] to-[#FF3D00] hover:brightness-110 text-white font-semibold text-xs shadow-lg shadow-orange-500/25 transition cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Explore</span>
          </button>
        </div>
      </div>

      {/* Contextual Filters Sub-bar: Sector, Scoped Location, Period, and Reset */}
      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#1C1E26] relative">
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* 1. SECTOR DROPDOWN (All roles use it per PDF) */}
          <div className="relative">
            <button 
              onClick={() => toggleDropdown('sector')}
              className={`flex items-center gap-1.5 bg-[#171821] border px-2.5 py-1 rounded-lg text-dark-300 transition cursor-pointer ${
                openDropdown === 'sector' ? 'border-brand-orange text-white' : 'border-[#262835] hover:border-[#383C4D]'
              }`}
            >
              <Building className="w-3.5 h-3.5 text-dark-400" />
              <span>Sector: <strong className="text-white">{filters.sector}</strong></span>
              <ChevronDown className={`w-3 h-3 text-dark-400 ml-1 transition-transform ${openDropdown === 'sector' ? 'rotate-180' : ''}`} />
            </button>

            {openDropdown === 'sector' && (
              <div className="absolute top-full left-0 mt-1.5 w-56 bg-[#161720] border border-[#262938] rounded-xl shadow-2xl z-40 p-1 space-y-0.5 animate-in fade-in">
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-dark-400">Select Sector</div>
                {FILTER_OPTIONS.sectors.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      updateFilter('sector', s);
                      setOpenDropdown(null);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition cursor-pointer ${
                      filters.sector === s ? 'bg-brand-orange/20 text-brand-orange font-bold' : 'text-dark-200 hover:bg-[#20222F] hover:text-white'
                    }`}
                  >
                    <span>{s}</span>
                    {filters.sector === s && <Check className="w-3 h-3 text-brand-orange" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. ROLE BADGE (Per PDF: Role dropdown not shown, comes from login) */}
          <div className="flex items-center gap-1.5 bg-[#171821] border border-[#262835] px-2.5 py-1 rounded-lg text-dark-300">
            <User className="w-3.5 h-3.5 text-brand-orange" />
            <span>Role: <strong className="text-white">{currentUser?.role}</strong></span>
          </div>

          {/* 3. LOCATION DROPDOWN (Scoped per PDF rules) */}
          <div className="relative">
            <button 
              onClick={() => toggleDropdown('location')}
              className={`flex items-center gap-1.5 bg-[#171821] border px-2.5 py-1 rounded-lg text-dark-300 transition cursor-pointer ${
                openDropdown === 'location' ? 'border-brand-orange text-white' : 'border-[#262835] hover:border-[#383C4D]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-dark-400" />
              <span>Location: <strong className="text-white">{filters.location}</strong></span>
              <ChevronDown className={`w-3 h-3 text-dark-400 ml-1 transition-transform ${openDropdown === 'location' ? 'rotate-180' : ''}`} />
            </button>

            {openDropdown === 'location' && (
              <div className="absolute top-full left-0 mt-1.5 w-64 bg-[#161720] border border-[#262938] rounded-xl shadow-2xl z-40 p-1 space-y-0.5 animate-in fade-in">
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-dark-400">
                  {currentUser.role === 'Administrator' ? 'All Campus Locations' : 'Assigned Scope Locations'}
                </div>
                {availableLocations.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => {
                      updateFilter('location', loc);
                      setOpenDropdown(null);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition cursor-pointer ${
                      filters.location === loc ? 'bg-brand-orange/20 text-brand-orange font-bold' : 'text-dark-200 hover:bg-[#20222F] hover:text-white'
                    }`}
                  >
                    <span>{loc}</span>
                    {filters.location === loc && <Check className="w-3 h-3 text-brand-orange" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side: Period selector & Reset button */}
        <div className="flex items-center gap-2">
          {/* 4. PERIOD DROPDOWN */}
          <div className="relative">
            <button 
              onClick={() => toggleDropdown('period')}
              className={`flex items-center gap-1.5 bg-[#171821] border px-2.5 py-1 rounded-lg text-dark-300 transition cursor-pointer ${
                openDropdown === 'period' ? 'border-brand-orange text-white' : 'border-[#262835] hover:border-[#383C4D]'
              }`}
            >
              <span>Period: <strong className="text-white">{filters.period}</strong></span>
              <ChevronDown className={`w-3 h-3 text-dark-400 ml-1 transition-transform ${openDropdown === 'period' ? 'rotate-180' : ''}`} />
            </button>

            {openDropdown === 'period' && (
              <div className="absolute top-full right-0 mt-1.5 w-56 bg-[#161720] border border-[#262938] rounded-xl shadow-2xl z-40 p-1 space-y-0.5 animate-in fade-in">
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-dark-400">Reporting Window</div>
                {FILTER_OPTIONS.periods.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      updateFilter('period', p);
                      setOpenDropdown(null);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition cursor-pointer ${
                      filters.period === p ? 'bg-brand-orange/20 text-brand-orange font-bold' : 'text-dark-200 hover:bg-[#20222F] hover:text-white'
                    }`}
                  >
                    <span>{p}</span>
                    {filters.period === p && <Check className="w-3 h-3 text-brand-orange" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 5. RESET BUTTON */}
          <button 
            onClick={resetFilters}
            title="Reset filters"
            className="flex items-center gap-1 text-dark-400 hover:text-white hover:bg-[#1E202B] px-2.5 py-1 rounded-lg border border-transparent hover:border-[#262835] transition text-xs cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
