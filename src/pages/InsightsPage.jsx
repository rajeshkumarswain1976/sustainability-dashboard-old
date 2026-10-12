import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { USE_MOCK } from '../services/client';
import { 
  Lightbulb, 
  Sparkles, 
  Send, 
  Play, 
  Sliders, 
  ArrowRight, 
  ExternalLink, 
  ChevronDown,
  BookOpen,
  TrendingUp,
  Cpu
} from 'lucide-react';

export default function InsightsPage() {
  const { currentUser, showToast, filters, dashboardData } = useDashboard();
  const [query, setQuery] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [selectedIntervention, setSelectedIntervention] = useState('hvac');
  const [simRunning, setSimRunning] = useState(false);
  const [addedToAction, setAddedToAction] = useState(false);

  const mockInterventions = {
    hvac: { label: 'Shift science block HVAC start by 45 min', electricity: '17.9', emissions: '7.15', comfort: '90.8%', saving: '5,600' },
    lighting: { label: 'Shift laboratory lighting shutoff by 30 min', electricity: '18.2', emissions: '7.28', comfort: '91.1%', saving: '3,200' },
    irrigation: { label: 'Reduce overnight irrigation by 20%', electricity: '18.6', emissions: '7.42', comfort: '91.4%', saving: '1,800' },
  };
  const interventions = USE_MOCK ? mockInterventions : {
    hvac: { label: 'Pending Phase 4 simulation', electricity: '—', emissions: '—', comfort: '—', saving: '0' },
  };
  const selectedScenario = interventions[selectedIntervention];

  const handleCopilotSubmit = (event) => {
    event.preventDefault();
    const question = query.trim();
    if (!question) return;
    setSubmittedQuestion(question);
    setQuery('');
  };

  const handleSimulate = () => {
    setSimRunning(true);
    setTimeout(() => setSimRunning(false), 800);
  };

  const isStaff = currentUser.role === 'Staff';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="text-xs font-mono text-dark-400 mb-1">
          {filters.location} ▾ › All zones
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Insights
              <span className="text-xs font-mono bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white px-2.5 py-1 rounded-full shadow-md shadow-orange-500/20">
                {isStaff ? 'Operations Reference View' : 'Copilot & Simulation Engine'}
              </span>
            </h1>
            <p className="text-sm text-dark-300 mt-1">
              Ask better questions of campus data, then test operational decisions before they become work.
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

      {/* PDF Rule: Staff views only Policy desk and This week's signal. Copilot & What-If are hidden/locked */}
      {!isStaff ? (
        /* Top Grid: Campus Copilot (Left) vs What-If Studio (Right) */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Campus Copilot */}
          <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-6 shadow-card-dark flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 text-brand-orange mb-1">
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  CAMPUS COPILOT · GROUNDED IN CAMPUS DATA
                </span>
              </div>
              <h3 className="text-base font-bold text-white">Find the signal behind the numbers.</h3>

              <div className="mt-4 p-4 bg-[#181A24] border border-[#262835] rounded-xl space-y-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-dark-400">YOUR QUESTION</span>
                  <p className="text-xs font-semibold text-white mt-0.5">
                    {submittedQuestion ? `“${submittedQuestion}”` : '“Why is electricity use above our weekly baseline?”'}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#222533]">
                  <h4 className="text-xs font-bold text-brand-orange">
                    {USE_MOCK ? 'After-hours HVAC is the clearest driver, not a campus-wide shift.' : 'Copilot analysis pending Phase 4.'}
                  </h4>
                  <p className="text-xs text-dark-300 mt-1.5 leading-relaxed">
                    {USE_MOCK ? <>Electricity use is <strong>4.8%</strong> above the 4-week weekday baseline. North Science ran beyond its occupied schedule on four evenings; together those intervals account for an estimated <strong>61%</strong> of the weekly variance. ⓘ</> : 'No grounded narrative is available yet. Operational savings below come from formula-based actions.'}
                  </p>
                </div>
                {submittedQuestion && (
                  <p className="text-xs text-dark-300 border-t border-[#222533] pt-2">
                    {USE_MOCK ? 'Demo response: this preview uses sample campus data only. The current energy signal is 4.8% above baseline, with after-hours HVAC as the largest identified contributor.' : 'Copilot response pending Phase 4.'}
                  </p>
                )}
              </div>

              <form onSubmit={handleCopilotSubmit} className="mt-4 relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about energy, water, safety…"
                  className="w-full bg-[#181920] border border-[#252833] rounded-xl px-4 py-2.5 text-xs text-white placeholder-dark-400 focus:outline-none focus:border-brand-orange transition"
                />
                <button type="submit" aria-label="Send question" className="absolute right-2.5 top-2 p-1.5 rounded-lg bg-brand-orange text-white hover:brightness-110 transition cursor-pointer">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px] text-dark-400">
                <span 
                  onClick={() => setQuery('Why did energy rise this week?')}
                  className="cursor-pointer hover:text-brand-orange transition"
                >
                  · Why did energy rise this week?
                </span>
                <span 
                  onClick={() => setQuery('Where should we inspect first?')}
                  className="cursor-pointer hover:text-brand-orange transition"
                >
                  · Where should we inspect first?
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1E202B] text-[11px] text-dark-400 italic">
              AI explanation · references shown for review, not an operational finding.
            </div>
          </div>

          {/* What-If Studio Simulation Engine */}
          <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-6 shadow-card-dark flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 text-brand-orange mb-1">
                <Cpu className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  WHAT-IF STUDIO · SIMULATION ENGINE
                </span>
              </div>
              <h3 className="text-base font-bold text-white">Test an intervention</h3>

              <div className="mt-4 p-3 bg-[#181A24] border border-[#262835] rounded-xl flex items-center justify-between gap-3 text-xs text-white">
                <label htmlFor="intervention-select" className="shrink-0">Proposed change:</label>
                <select
                  id="intervention-select"
                  value={selectedIntervention}
                  onChange={(event) => setSelectedIntervention(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-right text-white focus:outline-none"
                >
                  {Object.entries(interventions).map(([id, intervention]) => (
                    <option key={id} value={id} className="bg-[#181A24]">{intervention.label}</option>
                  ))}
                </select>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="p-2.5 bg-[#181A23] border border-[#252834] rounded-xl flex justify-between">
                  <span className="text-dark-300">Daily electricity (MWh)</span>
                  <span className="font-mono text-white">Current 18.6 → <strong className="text-emerald-400">Simulated {selectedScenario.electricity}</strong></span>
                </div>
                <div className="p-2.5 bg-[#181A23] border border-[#252834] rounded-xl flex justify-between">
                  <span className="text-dark-300">Daily emissions (tCO₂e)</span>
                  <span className="font-mono text-white">Current 7.42 → <strong className="text-emerald-400">Simulated {selectedScenario.emissions}</strong></span>
                </div>
                <div className="p-2.5 bg-[#181A23] border border-[#252834] rounded-xl flex justify-between">
                  <span className="text-dark-300">Comfort hours in range</span>
                  <span className="font-mono text-white">Current 91.4% → <strong>Simulated {selectedScenario.comfort}</strong></span>
                </div>
              </div>

              <div className="mt-3 p-3 bg-gradient-to-r from-[#17201D] to-[#121B16] border border-[#1E3B29] rounded-xl flex items-baseline justify-between text-xs">
                <span className="text-emerald-400 font-bold">Estimated daily saving</span>
                <span className="text-xl font-black text-emerald-400 font-mono">≈ ₹{selectedScenario.saving} / day</span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#1E202B]">
              <div className="flex gap-2">
                <button 
                  onClick={handleSimulate}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#222533] hover:bg-[#2C3042] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 text-brand-orange" />
                  <span>{simRunning ? 'Simulating...' : 'Run simulation →'}</span>
                </button>
                <button 
                  onClick={() => showToast('Intervention parameters optimized')}
                  className="px-3 py-2.5 rounded-xl bg-[#222533] hover:bg-[#2C3042] text-white text-xs font-semibold transition cursor-pointer"
                >
                  Optimise
                </button>
                <button 
                  onClick={() => {
                    setAddedToAction(true);
                    showToast('Intervention added to Actions plan!');
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white text-xs font-semibold hover:brightness-110 shadow-lg shadow-orange-500/25 transition cursor-pointer"
                >
                  {addedToAction ? 'Added ✓' : 'Add to action plan →'}
                </button>
              </div>
              <div className="text-[11px] text-dark-400 text-center">
                Impact values are modeled estimates from the simulation engine.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-[#14151C] border border-[#252835] rounded-xl text-xs text-dark-300 flex items-center gap-2">
          <span className="text-brand-orange font-bold font-mono">Note:</span>
          <span>Campus Copilot AI and What-If Simulation Studio are restricted to Administrators and Department Heads. Staff access is scoped to Policy Desk and Signal logs below.</span>
        </div>
      )}

      {/* Bottom Grid: Policy Desk (Left) vs This Week's Signal (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Policy Desk */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-6 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                POLICY DESK · CAMPUS A · ENERGY
              </span>
              <button 
                onClick={() => showToast('Looking up Energy Management Standard §4.2')}
                className="text-brand-orange hover:underline text-xs font-semibold cursor-pointer"
              >
                Look up →
              </button>
            </div>
            <h3 className="text-sm font-bold text-white">Can we shift HVAC start times?</h3>

            <div className="mt-3 p-4 bg-[#181A23] border border-[#252834] rounded-xl flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-white">Energy Management Standard · §4.2</div>
                <p className="text-xs text-dark-300 mt-1 leading-relaxed">
                  Building schedules may be adjusted by facilities to match occupancy, provided comfort thresholds and approved operating hours are maintained.
                </p>
              </div>
              <button 
                onClick={() => showToast('Opening Clause §4.2 full document')}
                className="p-2 bg-[#222533] hover:bg-brand-orange hover:text-white rounded-lg text-dark-300 transition shrink-0 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 pt-2 text-[11px] text-dark-400">
            Compliance certified by Campus Sustainability Board
          </div>
        </div>

        {/* This Week's Signal */}
        <div className="bg-[#14151B] border border-[#22242E] rounded-2xl p-6 shadow-card-dark flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
                THIS WEEK'S SIGNAL
              </span>
              <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-semibold">
                Worth a look
              </span>
            </div>
            <h3 className="text-sm font-bold text-white">Energy is drifting above baseline</h3>

            <div className="my-3 flex items-baseline gap-3">
              <span className="text-4xl font-black text-brand-orange">{dashboardData?.insights?.energyVariancePercent || '—'}</span>
              <span className="text-xs text-dark-300">
                vs. 4-week weekday baseline · largest contributor: North Science after-hours load.
              </span>
            </div>

            {/* Sparkline chart */}
            <div className="h-20 w-full pt-1">
              <svg viewBox="0 0 400 60" className="w-full h-full overflow-visible">
                <path d="M0,45 Q70,40 140,25 T280,30 T320,15" fill="none" stroke="#FF5500" strokeWidth="2.5" />
                <path d="M320,15 Q360,18 400,20" fill="none" stroke="#7E849A" strokeWidth="2" strokeDasharray="4 4" />
                <circle cx="320" cy="15" r="3.5" fill="#FFFFFF" stroke="#FF5500" strokeWidth="2" />
              </svg>
            </div>
          </div>

          <div className="pt-3 border-t border-[#1E202B] flex justify-between items-center text-xs">
            <span className="text-dark-400">Today · {filters.snapshotDate} (dashed = forecast)</span>
            
            {/* PDF Rule: "The Ask about this signal button is hidden" for Staff */}
            {!isStaff ? (
              <button 
                onClick={() => showToast('Opening Copilot investigation for +4.8% energy signal')}
                className="text-brand-orange hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                Ask about this signal →
              </button>
            ) : (
              <span className="text-[11px] text-dark-500 font-mono">Logged to signal registry</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
