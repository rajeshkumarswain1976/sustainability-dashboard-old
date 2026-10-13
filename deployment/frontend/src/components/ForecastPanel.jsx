import React, { useEffect, useState } from 'react';
import { api, USE_MOCK } from '../services/client';
import { useDashboard } from '../context/DashboardContext';

const requests = new Map();
function useForecastRequest(kind, domain, metric, horizon) {
  const { forecastScope } = useDashboard();
  const key = JSON.stringify([kind, domain, metric, horizon, forecastScope]);
  const [state, setState] = useState({});
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const [requestKind, requestDomain, requestMetric, requestHorizon, scope] = JSON.parse(key);
    if (USE_MOCK) return;
    if (!requests.has(key)) {
      if (requests.size > 100) requests.delete(requests.keys().next().value);
      const request = requestKind === 'accuracy' ? api.forecastAccuracy(scope) : requestKind === 'risks'
        ? api.forecastRisks(scope) : api.forecast(requestDomain, { ...scope, metric: requestMetric, horizon: requestHorizon });
      requests.set(key, request);
    }
    requests.get(key).then(data => { if (active) setState({ key, data }); }).catch(error => {
      requests.delete(key);
      if (active) setState({ key, error: error.message });
    });
    return () => { active = false; };
  }, [key, retry]); // key contains every request parameter
  const result = state.key === key ? state : {};
  return { ...result, retry: () => { requests.delete(key); setState({}); setRetry(value => value + 1); } };
}
function RequestState({ state }) {
  if (state.error) return <div role="alert" className="text-xs text-rose-300">Forecast unavailable: {state.error}. <button className="underline" onClick={state.retry}>Retry</button></div>;
  if (!state.data) return <div role="status" className="text-xs text-dark-400">Loading forecast…</div>;
  return null;
}
const format = value => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';
const time = value => new Date(value.length === 10 ? `${value}T00:00:00+05:30` : value).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', ...(value.length === 10 ? {} : { hour: '2-digit', minute: '2-digit' }),
});

export { default } from './TrendChart';

export function ForecastAccuracyPanel() {
  const state = useForecastRequest('accuracy');
  if (USE_MOCK) return null;
  return <section className="bg-[#14151B] border border-[#22242E] rounded-2xl p-4 space-y-3">
    <div className="flex justify-between items-center"><h3 className="text-sm font-bold text-white">Forecast accuracy</h3>
      <button onClick={state.retry} className="text-xs text-brand-orange underline">Refresh</button></div><RequestState state={state} />
    {state.data && !state.data.targets.length && <p className="text-xs text-dark-400">No registered targets.</p>}
    {state.data?.targets.length > 0 && <div className="overflow-auto"><table className="w-full text-xs text-left text-dark-300">
      <thead><tr><th>Target</th><th>Served</th><th>ML MAE</th><th>Baseline MAE</th><th>Coverage</th><th>Status</th></tr></thead>
      <tbody>{state.data.targets.map(item => <tr key={item.target} className="border-t border-[#22242E]"><td className="py-2">{item.target}</td><td>{item.served_model || '—'}</td><td>{format(item.mae)}</td><td>{format(item.baseline_mae)}</td><td>{item.folds.length ? `${format(item.folds.reduce((sum, fold) => sum + (fold.band_coverage || 0), 0) / item.folds.length)}%` : '—'}</td><td>{item.status.replaceAll('_', ' ')}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}

