import React, { useMemo, useState } from 'react';
import { useDashboard } from '../context/DashboardContext';

const number = (value, digits = 1) => Number.isFinite(value) ? value.toLocaleString('en-IN', { maximumFractionDigits: digits }) : 'Unavailable';

export default function SustainabilityPage() {
  const { filters, dashboardData } = useDashboard();
  const [selected, setSelected] = useState('Energy');
  const factors = useMemo(() => (dashboardData?.overview?.factors || []).filter(item => Number.isFinite(item.score)), [dashboardData]);
  const activeFactor = factors.find(item => item.name === selected) || factors[0];
  const sustainability = dashboardData?.sustainability || {};
  const score = Number.isFinite(sustainability.score) ? sustainability.score : null;

  return <div className="space-y-6">
    <header>
      <p className="text-xs font-mono text-dark-400 mb-1">{filters.location} · {filters.period}</p>
      <h1 className="text-3xl font-extrabold text-white">Sustainability simulation</h1>
      <p className="mt-1 text-sm text-dark-300">Scores are relative to this synthetic history window. They are not certified ratings or actual campus measurements.</p>
    </header>

    <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-1 p-6 rounded-2xl border border-[#262A3C] bg-gradient-to-br from-[#1C1E29] to-[#12131C]">
        <p className="text-[10px] uppercase tracking-wider text-dark-400">Equal-weight factor index</p>
        <div className="mt-3 text-5xl font-black text-white">{score === null ? 'Calculating…' : number(score)}<span className="ml-2 text-base font-normal text-dark-400">/ 100</span></div>
        <p className="mt-3 text-xs text-dark-300">Mean of the available daily factor scores for the selected reporting window.</p>
      </div>
      <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric label="Estimated emissions in period" value={`${number(sustainability.ghgEmissionsPeriodTco2e, 3)} tCO₂e`} />
        <Metric label="Synthetic solar share" value={`${number(sustainability.renewableElectricityPercent)}%`} />
        <Metric label="Waste diversion" value={`${number(sustainability.wasteDivertedPercent)}%`} />
        <Metric label="Open review actions" value={number(sustainability.openImprovementActions, 0)} />
        <Metric label="Reporting window" value={`${number(sustainability.periodDays, 0)} days`} />
        <Metric label="Score basis" value="Within-window rank" />
      </div>
    </section>

    <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="p-5 rounded-2xl border border-[#22242E] bg-[#14151B]">
        <h2 className="text-sm font-bold text-white">Factor scores</h2>
        <p className="mt-1 mb-4 text-xs text-dark-400">Lower resource use, pollution, risk and emissions rank higher. Asset availability ranks higher when it is higher.</p>
        {factors.length ? <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{factors.map(item => <button key={item.name} onClick={() => setSelected(item.name)} className={`p-3 rounded-xl border text-left ${selected === item.name ? 'border-brand-orange bg-brand-orange/10 text-white' : 'border-[#262835] bg-[#181A23] text-dark-200'}`}>
          <span className="block text-xs">{item.name.replace(' · AQI', '')}</span><strong className="mt-1 block text-xl">{number(item.score)}</strong>
        </button>)}</div> : <p className="text-sm text-dark-300">Factor scores are being calculated from the active synthetic readings.</p>}
      </div>
      <div className="p-5 rounded-2xl border border-[#22242E] bg-[#14151B]">
        <h2 className="text-sm font-bold text-white">How this score is calculated</h2>
        <p className="mt-2 text-sm text-dark-300">Each factor is an empirical percentile rank across the generated history. The composite is the unweighted mean of available factor values.</p>
        {activeFactor && <div className="mt-5 border-t border-[#262835] pt-4">
          <p className="text-xs uppercase tracking-wider text-dark-400">Selected factor</p>
          <p className="mt-1 text-lg font-bold text-white">{activeFactor.name.replace(' · AQI', '')} · {number(activeFactor.score)}/100</p>
          <p className="mt-2 text-xs text-dark-300">Source field: <code>{activeFactor.source_column || 'derived synthetic KPI'}</code></p>
        </div>}
      </div>
    </section>
  </div>;
}

function Metric({ label, value }) {
  return <div className="p-4 rounded-2xl border border-[#22242E] bg-[#14151B]"><p className="text-xs text-dark-400">{label}</p><strong className="mt-2 block text-xl text-white">{value}</strong></div>;
}
