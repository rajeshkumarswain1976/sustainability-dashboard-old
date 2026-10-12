import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { api, USE_MOCK } from '../services/client';
import { 
  CheckSquare, 
  TrendingUp, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Filter, 
  ChevronDown,
  UserCheck,
  FileCheck,
  Plus
} from 'lucide-react';

export default function ActionsPage() {
  const { currentUser, showToast, filters, actions: serverActions, refreshOperational, decisionQueue } = useDashboard();
  const [filterMode, setFilterMode] = useState('all');
  const [resolvedStatus, setResolvedStatus] = useState({});

  const toggleResolve = async (actId) => {
    if (!USE_MOCK) {
      const action = serverActions.find(item => item.id === actId);
      if (!action) return;
      const next = { open: 'acknowledged', acknowledged: 'in_progress', in_progress: 'done' }[action.status];
      if (!next) return;
      try {
        await api.actionStatus(actId, next, currentUser.key === 'head' || currentUser.key === 'admin' ? 'head' : 'staff');
        await refreshOperational();
        showToast(`Action moved to ${next.replace('_', ' ')}`);
      } catch (error) { showToast(error.message); }
      return;
    }
    setResolvedStatus(prev => ({
      ...prev,
      [actId]: !prev[actId]
    }));
    showToast(`Updated status for ${actId}`);
  };

  const mockStatusCounts = [
    { label: 'Recommended', count: 1, color: 'text-sky-400' },
    { label: 'Accepted', count: 1, color: 'text-indigo-400' },
    { label: 'Assigned', count: 1, color: 'text-amber-400' },
    { label: 'In progress', count: 1, color: 'text-brand-orange' },
    { label: 'Done', count: 2, color: 'text-emerald-400' },
    { label: 'Verified', count: 7, color: 'text-emerald-500 font-bold' },
    { label: 'Rejected', count: 1, color: 'text-dark-400' },
    { label: 'Overdue', count: 1, color: 'text-rose-400' },
  ];

  const mockActions = [
    {
      id: 'ACT-204',
      title: 'Inspect recurring irrigation leak',
      desc: 'High priority · Water · North Quad use is 31% above four-week baseline · Water standard §4.2',
      status: 'Recommended',
      assignee: 'Facilities',
      statusBadge: 'text-sky-400 bg-sky-500/15'
    },
    {
      id: 'ACT-198',
      title: 'Rebalance library ventilation schedule',
      desc: 'High priority · Energy · After-hours load persisted on 5 of 7 nights · Building ops §2.1',
      status: 'In progress',
      assignee: 'M. Chen',
      timeline: 'Recommended 2 Oct → Accepted 3 Oct → Assigned 3 Oct → In progress 6 Oct',
      statusBadge: 'text-amber-400 bg-amber-500/15'
    },
    {
      id: 'ACT-191',
      title: 'Add shade to east residence walk',
      desc: 'Medium priority · Climate · Afternoon heat reports rose · Heat response plan §3.4',
      status: 'Assigned',
      assignee: 'Grounds team',
      statusBadge: 'text-indigo-400 bg-indigo-500/15'
    },
    {
      id: 'ACT-186',
      title: 'Review bike rack capacity at West Gate',
      desc: 'Medium priority · Mobility · Secure parking reached 92% on three weekdays · Active travel guide §5.1',
      status: 'Overdue',
      assignee: 'Unassigned',
      statusBadge: 'text-rose-400 bg-rose-500/15'
    },
  ];

  const mockComplaints = [
    { cat: 'Water · North Quad', reports: '3 reports', desc: 'Low pressure reported in the west wing · first 08:42 today · 1h 18m' },
    { cat: 'Waste · Student Centre', reports: '2 reports', desc: 'Dining hall bins filling before collection · yesterday 14:16 · 4h 05m' },
    { cat: 'Mobility · West Gate', reports: '1 report', desc: 'Bicycle rack access is obstructed · yesterday 11:05 · Overdue 26m' },
  ];

  const actions = USE_MOCK ? mockActions : serverActions.map(item => ({
    id: item.id, title: item.text, desc: `${item.priority ?? 'Review'} priority · ${item.type.replace(/_/g, ' ')} · ₹${item.saving_inr.toFixed(0)} estimated savings${item.needs_review ? ' · Needs review' : ''}`,
    status: item.status === 'in_progress' ? 'In progress' : item.status.charAt(0).toUpperCase() + item.status.slice(1),
    assignee: item.owner || 'Needs review', statusBadge: item.needs_review ? 'text-amber-400 bg-amber-500/15' : 'text-sky-400 bg-sky-500/15',
    needsHeadApproval: item.needs_head_approval,
  }));
  const complaints = USE_MOCK ? mockComplaints : [];
  const statusCounts = USE_MOCK ? mockStatusCounts : [
    { label: 'Open', count: serverActions.filter(item => item.status === 'open').length, color: 'text-sky-400' },
    { label: 'Acknowledged', count: serverActions.filter(item => item.status === 'acknowledged').length, color: 'text-indigo-400' },
    { label: 'In progress', count: serverActions.filter(item => item.status === 'in_progress').length, color: 'text-brand-orange' },
    { label: 'Done', count: serverActions.filter(item => item.status === 'done').length, color: 'text-emerald-400' },
    { label: 'Needs review', count: decisionQueue.length, color: 'text-amber-400' },
  ];
  const canSeeAction = (action) => !USE_MOCK || currentUser.role !== 'Staff' || action.assignee === 'M. Chen' || action.assignee === 'Facilities';
  const visibleActions = actions.filter(action =>
    canSeeAction(action) && (filterMode !== 'attention' || (
      !resolvedStatus[action.id] && (!USE_MOCK ? action.desc.includes('Needs review') || action.status === 'Open' : action.status === 'Overdue' || action.desc.includes('High priority'))
    ))
  );
  const attentionCount = actions.filter(action =>
    canSeeAction(action) && !resolvedStatus[action.id] && (!USE_MOCK ? action.desc.includes('Needs review') || action.status === 'Open' : action.status === 'Overdue' || action.desc.includes('High priority'))
  ).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="text-xs font-mono text-dark-400 mb-1">
          Main Campus ▾ › All zones › All buildings › All assets
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Actions
              <span className="text-xs font-mono bg-brand-orange/20 text-brand-orange px-2.5 py-1 rounded-full border border-orange-500/30">
                Queue Active · {actions.length} Checked
              </span>
            </h1>
            <p className="text-sm text-dark-300 mt-1">
              Turn campus signals into owned work, with the evidence and policy context to move confidently.
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

      {/* Operational queue status notification */}
      <div className="p-3 bg-[#171922] border border-[#242735] rounded-xl flex items-center justify-between text-xs text-dark-300">
        <span>● Operational queue · {USE_MOCK ? 'Illustrative sample data' : `${actions.length} actions from replay`}</span>
        <span className="font-mono text-dark-400">{USE_MOCK ? 'Every "Add to action plan" feeds this list' : `${decisionQueue.length} decisions need review`}</span>
      </div>

      {!USE_MOCK && decisionQueue.length > 0 && (
        <div className="p-4 bg-[#14151B] border border-amber-500/30 rounded-2xl text-xs text-dark-200">
          <strong className="text-amber-400">Decision queue · {decisionQueue.length} needs review</strong>
          <div className="mt-2 space-y-1">
            {decisionQueue.slice(0, 5).map(item => <div key={item.alert_key}>{item.type.replace(/_/g, ' ')} · {item.node} · {item.status}</div>)}
          </div>
        </div>
      )}

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Open actions</div>
              <div className="text-3xl font-extrabold text-white mt-1">{statusCounts.find(item => item.label === 'Open')?.count ?? 3}</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-amber-400">2 marked high priority</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">In progress</div>
          <div className="text-3xl font-extrabold text-brand-orange mt-1">{statusCounts.find(item => item.label === 'In progress')?.count ?? 1}</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-dark-300">Owned by campus teams</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Resolved this week</div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-1">{statusCounts.find(item => item.label === 'Done')?.count ?? 7}</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-emerald-400">+2 vs previous week</div>
        </div>

        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-dark-400">Policy checks</div>
          <div className="text-3xl font-extrabold text-white mt-1">4 / 4</div>
          <div className="mt-3 pt-2 border-t border-[#1F212B] text-xs text-emerald-400">All actions have a reference</div>
        </div>
      </div>

      {/* Pipeline Status Counters Row */}
      <div className="p-3 bg-[#14151B] border border-[#22242E] rounded-2xl grid grid-cols-4 sm:grid-cols-8 gap-2 text-center text-xs">
        {statusCounts.map((sc, i) => (
          <div key={i} className="p-2 bg-[#181A23] rounded-xl border border-[#252834]">
            <div className="text-[10px] text-dark-400 truncate">{sc.label}</div>
            <div className={`text-base font-black mt-0.5 ${sc.color}`}>{sc.count}</div>
          </div>
        ))}
      </div>

      {/* Main Grid: Action Queue (Left) vs Complaint Clusters & Before/After Impact (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Action Queue (7 cols) */}
        <div className="lg:col-span-7 bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                RECOMMENDED WORK · {actions.length} FROM REPLAY
              </span>
              <h3 className="text-sm font-bold text-white">Action queue</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-[#191A24] border border-[#262835] rounded-lg p-0.5 text-xs">
                <button 
                  onClick={() => setFilterMode('all')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                    filterMode === 'all' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button 
                  onClick={() => setFilterMode('attention')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                    filterMode === 'attention' ? 'bg-brand-orange text-white' : 'text-dark-400 hover:text-white'
                  }`}
                >
                  Needs attention · {attentionCount}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {visibleActions.map((act) => {
                const isResolved = resolvedStatus[act.id];
                return (
                  <div key={act.id} className="p-3.5 bg-[#181A23] border border-[#252834] rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand-orange">{act.id}</span>
                          <h4 className="font-bold text-white text-xs">{act.title}</h4>
                        </div>
                        <p className="text-[11px] text-dark-300 mt-1 leading-relaxed">{act.desc}</p>
                      </div>
                    </div>

                    {act.timeline && (
                      <div className="text-[10px] font-mono text-dark-400 bg-[#14151E] p-2 rounded-lg border border-[#202230]">
                        Timeline: {act.timeline}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-[#202330]">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${act.statusBadge}`}>
                          {isResolved ? 'Resolved' : act.status}
                        </span>
                        <span className="text-dark-400 text-[11px]">Assignee: <strong className="text-white">{act.assignee}</strong></span>
                      </div>

                      {/* PDF Rule: Staff can mark In progress or Done. Cannot assign, accept, reject, verify */}
                      <button 
                        onClick={() => toggleResolve(act.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          isResolved 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-[#222533] hover:bg-brand-orange text-white'
                        }`}
                      >
                        {isResolved 
                          ? (currentUser.role === 'Staff' ? 'Marked Done ✓' : 'Resolved ✓') 
                          : (!USE_MOCK ? (act.status === 'Done' ? 'Done ✓' : act.needsHeadApproval && act.status === 'In progress' ? 'Head approval' : 'Advance status') : currentUser.role === 'Staff' ? 'Mark In Progress / Done' : 'Resolve')}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right Column: Complaint Clusters & Before/After (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Complaint Clusters */}
          <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark space-y-3">
            <div>
              <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                SERVICE SIGNALS · {complaints.length} OPEN
              </span>
              <h3 className="text-sm font-bold text-white">Complaint clusters</h3>
              <div className="text-[11px] text-dark-400 mt-0.5">{USE_MOCK ? 'Reported complaints 6 in 3 clusters · Resolution SLA' : 'Complaint clusters pending Phase 4'}</div>
            </div>

            <div className="space-y-2.5">
              {complaints.map((c, i) => (
                <div key={i} className="p-3 bg-[#181A23] border border-[#252834] rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{c.cat}</span>
                      <span className="text-amber-400 font-mono text-[10px]">({c.reports})</span>
                    </div>
                    <div className="text-[11px] text-dark-400 mt-0.5">{c.desc}</div>
                  </div>

                  {/* PDF Rule: Staff cannot use Work order */}
                  {currentUser.role !== 'Staff' ? (
                    <button 
                      onClick={() => showToast(`Work order created for ${c.cat}`)}
                      className="px-2.5 py-1.5 bg-[#232635] hover:bg-brand-orange hover:text-white rounded-lg text-[11px] font-semibold text-white whitespace-nowrap transition cursor-pointer"
                    >
                      + Work order
                    </button>
                  ) : (
                    <span className="text-[10px] text-dark-500 font-mono">Assigned</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Before / After Impact */}
          <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-5 shadow-card-dark space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                  BEFORE / AFTER IMPACT
                </span>
                <h3 className="text-sm font-bold text-white">HVAC setback · Science south wing</h3>
              </div>
              <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-semibold">
                Estimated
              </span>
            </div>

            <div className="p-3 bg-[#181A23] border border-[#252834] rounded-xl text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-dark-300">Before 184 kW → After 158 kW</span>
                <span className="text-emerald-400 font-bold font-mono">11.6 MWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-300">Monthly financial impact</span>
                <span className="text-white font-mono font-bold">₹92,800 / month</span>
              </div>
              <div className="pt-2 border-t border-[#222533] flex justify-between text-[11px] text-dark-400">
                <span>CO₂e avoided <strong>8.2 t / month</strong></span>
                <span>Expected −18% vs actual −14%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
