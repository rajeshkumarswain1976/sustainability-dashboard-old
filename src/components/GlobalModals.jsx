import React, { useEffect, useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { api, USE_MOCK } from '../services/client';
import { 
  Search, 
  X, 
  Calendar, 
  Bell, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Share2, 
  Copy, 
  Download, 
  ExternalLink,
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
  Lightbulb,
  Send,
  Lock
} from 'lucide-react';

export default function GlobalModals() {
  const {
    filters,
    updateFilter,
    notifications,
    acknowledgeNotification,
    snoozeNotification,
    dismissNotification,
    notificationDrawerOpen,
    setNotificationDrawerOpen,
    searchModalOpen,
    setSearchModalOpen,
    shareModalOpen,
    setShareModalOpen,
    datePickerOpen,
    setDatePickerOpen,
    toastMessage,
    showToast,
    setCurrentPage,
    FILTER_OPTIONS,
    currentUser,
    canAccessPage,
    replayState,
    setReplayState,
    locations
  } = useDashboard();

  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!searchModalOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSearchModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchModalOpen, setSearchModalOpen]);

  // Search items across all 12 sections
  const searchableItems = [
    { title: 'Overview Dashboard', category: 'Pages', page: 'overview', icon: Leaf },
    { title: 'Energy & Electricity Demand (482 kW)', category: 'Energy', page: 'energy', icon: Zap },
    { title: 'Science Block AHU-04 Air Handler', category: 'Energy / Assets', page: 'energy', icon: Zap },
    { title: 'Water Use & Tank Storage (1,323 m³)', category: 'Water', page: 'water', icon: Droplets },
    { title: 'Hall C Meter RH-C-04 Overnight Leak', category: 'Water', page: 'water', icon: Droplets },
    { title: 'Waste Generation & Diversion (61.8%)', category: 'Waste', page: 'waste', icon: Trash2 },
    { title: 'Bin ND-07 North Dining Overflow', category: 'Waste', page: 'waste', icon: Trash2 },
    { title: 'Air Quality Index AQI 42 & PM2.5', category: 'Air', page: 'air', icon: Wind },
    { title: 'Assets Reliability & Maintenance (18 due)', category: 'Assets', page: 'assets', icon: Cpu },
    { title: 'West Gate Vehicle Flow & Congestion', category: 'Mobility', page: 'mobility', icon: Navigation },
    { title: 'Parking Capacity (North Garage 88%)', category: 'Mobility', page: 'mobility', icon: Navigation },
    { title: 'Safety Reports & Zone N2 Slip Hazard', category: 'Safety', page: 'safety', icon: ShieldAlert },
    { title: 'Climate Risk & Heavy Rain Alert (46 mm)', category: 'Climate', page: 'climate', icon: CloudRain },
    { title: 'Campus 2030 Sustainability Commitments', category: 'Sustainability', page: 'sustainability', icon: Leaf },
    { title: 'Actions Queue (ACT-204 to ACT-186)', category: 'Actions', page: 'actions', icon: CheckSquare },
    { title: 'Campus Copilot AI & What-If Simulations', category: 'Insights', page: 'insights', icon: Lightbulb },
  ];

  // Per PDF: Explore menu lists only the pages they can open
  const permittedSearchItems = searchableItems.filter(item => canAccessPage(item.page));

  const filteredSearch = searchQuery.trim() === ''
    ? permittedSearchItems.slice(0, 6)
    : permittedSearchItems.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      showToast('Dashboard link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Clipboard access is unavailable. Copy the dashboard URL from your browser.');
    }
  };

  const handleSendAdvisory = (notificationTitle) => {
    showToast(`Advisory dispatched for: "${notificationTitle}" to on-call field teams`);
  };

  return (
    <>
      {/* Toast Notification Pill */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1A1C25] border border-brand-orange/40 text-white px-4 py-2.5 rounded-xl shadow-2xl shadow-orange-500/20 text-xs font-medium flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-brand-orange" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. SEARCH MODAL (⌘K) */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
          <div className="bg-[#14151B] border border-[#252835] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#20222F] flex items-center gap-3">
              <Search className="w-5 h-5 text-brand-orange" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across accessible modules, assets, rooms, metrics..."
                className="w-full bg-transparent text-white placeholder-dark-400 focus:outline-none text-sm font-medium"
                autoFocus
              />
              <button 
                onClick={() => setSearchModalOpen(false)}
                className="p-1 rounded-lg text-dark-400 hover:text-white hover:bg-[#20222E] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 max-h-80 overflow-y-auto space-y-1">
              <div className="text-[10px] uppercase font-semibold text-dark-400 px-3 py-1">
                {searchQuery ? 'Search Results' : 'Accessible Sections & Telemetry'}
              </div>
              {filteredSearch.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentPage(item.page);
                      setSearchModalOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-[#1E202B] text-left flex items-center justify-between text-xs transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#1B1D27] group-hover:bg-brand-orange/20 group-hover:text-brand-orange text-dark-400 transition">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-white group-hover:text-brand-orange transition">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-dark-400">{item.category}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-dark-400 font-mono">Jump →</span>
                  </button>
                );
              })}
            </div>
            <div className="p-3 bg-[#111217] border-t border-[#1E202B] text-[11px] text-dark-400 flex justify-between items-center">
              <span>Press <kbd className="px-1.5 py-0.5 bg-[#1F212D] text-white rounded">ESC</kbd> to close</span>
              <span>Scoped to {currentUser.role} permissions</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. NOTIFICATIONS DRAWER */}
      {notificationDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-[#13141A] border-l border-[#242735] h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="p-5 border-b border-[#1F212C] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-brand-orange" />
                <h3 className="text-base font-bold text-white">Campus Notifications</h3>
                <span className="text-xs bg-brand-orange/20 text-brand-orange font-bold px-2 py-0.5 rounded-full">
                  {notifications.length}
                </span>
              </div>
              <button 
                onClick={() => setNotificationDrawerOpen(false)}
                className="p-1 rounded-lg text-dark-400 hover:text-white hover:bg-[#1D1F2A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              {notifications.map((n) => (
                <div key={n.id} className="p-4 bg-[#181A23] border border-[#252836] rounded-xl space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      n.type === 'critical' ? 'bg-rose-500/20 text-rose-400' :
                      n.type === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-sky-500/20 text-sky-400'
                    }`}>
                      {n.badge}{n.confidence != null ? ` · ${Math.round(n.confidence * 100)}%` : ''}
                    </span>
                    <span className="text-[10px] text-dark-400 font-mono">{n.status}</span>
                  </div>

                  <h4 className="font-bold text-white text-xs leading-snug">{n.title}</h4>
                  <p className="text-[11px] text-dark-400">{n.meta}</p>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#202230] flex-wrap">
                    <button 
                      onClick={() => acknowledgeNotification(n.id)}
                      className="px-2.5 py-1 bg-[#232532] hover:bg-brand-orange hover:text-white rounded text-[11px] text-dark-300 font-semibold transition cursor-pointer"
                    >
                      Acknowledge
                    </button>
                    <button 
                      onClick={() => snoozeNotification(n.id)}
                      className="px-2.5 py-1 bg-[#232532] hover:bg-[#2C2F40] rounded text-[11px] text-dark-400 transition cursor-pointer"
                    >
                      Snooze 4h
                    </button>

                    {/* PDF Rule: "Send advisory is for the Administrator and the Department Head only" */}
                    {(currentUser.role === 'Administrator' || currentUser.role === 'Department Head') && (
                      <button 
                        onClick={() => handleSendAdvisory(n.title)}
                        className="px-2.5 py-1 bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white rounded text-[11px] font-semibold transition cursor-pointer"
                      >
                        Send Advisory
                      </button>
                    )}

                    <button 
                      onClick={() => {
                        if (canAccessPage(n.page)) {
                          setCurrentPage(n.page);
                          setNotificationDrawerOpen(false);
                        } else {
                          showToast(`Access to ${n.page} is restricted for your role.`);
                        }
                      }}
                      className="ml-auto text-brand-orange hover:underline text-[11px] font-semibold cursor-pointer"
                    >
                      View in page →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-[#101116] border-t border-[#1E202B] text-center">
              <button 
                onClick={() => setNotificationDrawerOpen(false)}
                className="w-full py-2 bg-[#1C1E28] hover:bg-[#262836] text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. DATE / SNAPSHOT PICKER MODAL */}
      {datePickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14151B] border border-[#252835] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-orange" />
                <h3 className="text-base font-bold text-white">Select Snapshot Date</h3>
              </div>
              <button 
                onClick={() => setDatePickerOpen(false)}
                className="p-1 rounded-lg text-dark-400 hover:text-white hover:bg-[#20222E] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-dark-300 leading-relaxed">
              Choosing an archived snapshot recalculates all sensor feeds, demand baselines, and historical compliance logs.
            </p>

            <div className="space-y-2">
              <div className="text-[10px] uppercase font-bold text-dark-400">Archived Snapshots:</div>
              {FILTER_OPTIONS.snapshotDates.map((date) => (
                <button
                  key={date}
                  onClick={() => {
                    updateFilter('snapshotDate', date);
                    setDatePickerOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl border text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                    filters.snapshotDate === date
                      ? 'bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white border-transparent shadow-lg shadow-orange-500/20 font-bold'
                      : 'bg-[#181A23] hover:bg-[#20222E] border-[#252835] text-dark-300 hover:text-white'
                  }`}
                >
                  <span>{date}</span>
                  {filters.snapshotDate === date && <span>Selected ✓</span>}
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-[#1E202B]">
              <label className="text-[10px] uppercase font-bold text-dark-400 block mb-1.5">Custom Date Picker:</label>
              <input
                type="date"
                defaultValue="2026-10-09"
                onChange={(e) => {
                  if (e.target.value) {
                    updateFilter('snapshotDate', e.target.value);
                    setDatePickerOpen(false);
                  }
                }}
                className="w-full bg-[#181922] border border-[#262835] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange"
              />
            </div>
            {!USE_MOCK && (
              <div className="pt-3 border-t border-[#1E202B] space-y-2">
                <div className="text-[10px] uppercase font-bold text-dark-400">Historical replay · {replayState?.running ? 'Running' : 'Paused'}</div>
                <div className="flex gap-2">
                  <button className="px-3 py-2 rounded-lg bg-brand-orange text-white text-xs" onClick={async () => {
                    try {
                      const node = locations.find(item => item.label === filters.location)?.node_id || 'F01';
                      setReplayState(await api.replayStart({ node, as_of: replayState?.cursor }));
                    } catch (error) { showToast(error.message); }
                  }}>Start</button>
                  <button className="px-3 py-2 rounded-lg bg-[#252835] text-white text-xs" onClick={async () => {
                    try { setReplayState(await api.replayPause()); } catch (error) { showToast(error.message); }
                  }}>Pause</button>
                  <button className="px-3 py-2 rounded-lg bg-[#252835] text-white text-xs" onClick={async () => {
                    try {
                      const day = new Date(`${filters.snapshotDate.replace(/^[A-Za-z]{3} /, '')} 00:00:00 GMT+0530`);
                      setReplayState(await api.replaySeek(day.toISOString()));
                    } catch (error) { showToast(error.message); }
                  }}>Seek to date</button>
                </div>
                <select className="bg-[#181922] border border-[#262835] rounded-lg px-2 py-1 text-xs text-white" value={replayState?.speed || 3600} onChange={async e => {
                  try { setReplayState(await api.replaySpeed(Number(e.target.value))); } catch (error) { showToast(error.message); }
                }}>
                  <option value={3600}>1 hour per second</option><option value={7200}>2 hours per second</option><option value={14400}>4 hours per second</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. EXPLORE / SHARE MODAL */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14151B] border border-[#252835] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-brand-orange" />
                <h3 className="text-base font-bold text-white">Explore Menu & Export</h3>
              </div>
              <button 
                onClick={() => setShareModalOpen(false)}
                className="p-1 rounded-lg text-dark-400 hover:text-white hover:bg-[#20222E] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-dark-300">
              Access permitted modules and executive outputs for <strong>{currentUser.name} ({currentUser.role})</strong>.
            </p>

            {/* Quick list of openable pages per PDF: Explore menu lists only the pages they can open */}
            <div className="space-y-1 py-1">
              <div className="text-[10px] uppercase font-bold text-dark-400 mb-1">Openable Modules ({currentUser.role}):</div>
              <div className="flex flex-wrap gap-1.5">
                {['overview', 'energy', 'water', 'waste', 'air', 'assets', 'mobility', 'safety', 'climate', 'sustainability', 'actions', 'insights']
                  .filter(p => canAccessPage(p))
                  .map(p => (
                    <span 
                      key={p} 
                      onClick={() => {
                        setCurrentPage(p);
                        setShareModalOpen(false);
                      }}
                      className="px-2.5 py-1 bg-[#1A1C25] hover:bg-brand-orange hover:text-white border border-[#252835] rounded-lg text-[11px] font-medium text-dark-200 capitalize cursor-pointer transition"
                    >
                      {p}
                    </span>
                  ))}
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[#1F212D]">
              <button
                onClick={handleCopyLink}
                className="w-full p-2.5 bg-[#181A23] hover:bg-[#222533] border border-[#252835] rounded-xl flex items-center justify-between text-xs font-semibold text-white transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Copy className="w-4 h-4 text-brand-orange" />
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy View Link'}</span>
                </div>
                <span className="text-dark-400 font-mono text-[11px]">URL</span>
              </button>

              <button
                onClick={() => {
                  showToast('Exporting Sustainability Executive Summary (PDF)...');
                  setShareModalOpen(false);
                }}
                className="w-full p-2.5 bg-[#181A23] hover:bg-[#222533] border border-[#252835] rounded-xl flex items-center justify-between text-xs font-semibold text-white transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Export Executive Report (PDF)</span>
                </div>
                <span className="text-dark-400 font-mono text-[11px]">.pdf</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
