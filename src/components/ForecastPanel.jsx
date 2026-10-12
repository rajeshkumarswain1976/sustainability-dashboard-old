import React, { useEffect, useState } from 'react';
import { api, USE_MOCK } from '../services/client';
import { useDashboard } from '../context/DashboardContext';

const METRICS = {
  energy: [['energy_kwh', 'Energy', 'kWh'], ['peak_demand_kw', 'Peak demand', 'kW']],
  occupancy: [['occupancy_count', 'Occupancy', 'people']],
  water: [['water_consumption_litres', 'Water use', 'L'], ['tank_level_pct', 'Tank level', '%'], ['days_of_water_available', 'Water runway', 'days']],
  waste: [['fill_percentage', 'Bin fill', '%'], ['waste_weight', 'Waste', 'kg'], ['diversion_rate', 'Diversion rate', 'ratio']],
  mobility: [['parking_occupancy', 'Parking', 'spaces'], ['delay_min', 'Delay', 'min'], ['vehicle_count', 'Vehicles', 'movements']],
  air: [['aqi_cpcb', 'AQI', ''], ['pm25', 'PM2.5', 'µg/m³'], ['pm10', 'PM10', 'µg/m³'], ['no2', 'NO₂', 'µg/m³']],
  weather: [['temperature', 'Temperature', '°C'], ['humidity', 'Humidity', '%'], ['rainfall', 'Rainfall', 'mm'], ['wind_speed', 'Wind', 'm/s']],
  climate: [['heat_risk', 'Heat risk', '/100'], ['flood_risk', 'Flood risk', '/100']],
  assets: [['failure_risk', 'Failure risk', '/100'], ['vibration', 'Vibration', '']],
  safety: [['incident_count', 'Daily incidents', 'incidents'], ['risk_index', 'Hourly risk', '/100']],
  sustainability: [['sustainability_score', 'Score projection', '/100']],
  emissions: [['total_co2e', 'Total emissions', 'kgCO₂e'], ['energy_co2e', 'Energy emissions', 'kgCO₂e'], ['mobility_co2e', 'Mobility emissions', 'kgCO₂e'], ['waste_co2e', 'Waste emissions', 'kgCO₂e']],
};
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

export default function ForecastPanel({ domain, title, defaultMetric, compact = false }) {
  const options = METRICS[domain];
  const [metric, setMetric] = useState(defaultMetric || options[0][0]);
  const [entity, setEntity] = useState('');
  const [requestedHorizon, setRequestedHorizon] = useState('24h');
  const horizon = domain === 'sustainability' || (domain === 'safety' && metric === 'incident_count') ? '7d' : requestedHorizon;
  const dailyAvailable = ['energy', 'occupancy', 'weather', 'emissions'].includes(domain);
  const state = useForecastRequest('series', domain, metric, horizon);
  if (USE_MOCK) return null;
  const forecasts = state.data?.forecasts || [];
  const selected = forecasts.find(item => item.entity_id === entity) || forecasts[0];
  const series = selected?.series || [];
  const unit = options.find(item => item[0] === metric)?.[2] || '';
  const method = selected?.model === 'hist_gradient_boosting' ? 'ML' : selected?.model;
  const synthetic = state.data?.data_source?.classification?.includes('synthetic');
  const min = Math.min(...series.map(point => point.lower));
  const max = Math.max(...series.map(point => point.upper));
  const x = index => 5 + index * 290 / Math.max(1, series.length - 1);
  const y = value => 85 - (value - min) * 75 / Math.max(0.001, max - min);
  const points = field => series.map((point, index) => `${x(index)},${y(point[field])}`).join(' ');
  return <section className={compact ? 'space-y-2' : 'bg-[#14151B] border border-[#22242E] rounded-2xl p-4 space-y-3'} aria-label={title || `${domain} forecast`}>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <h3 className="font-bold text-white">{title || `${horizon === '7d' ? 'Seven-day' : 'Next 24 hours'} forecast`}</h3>
      <div className="flex gap-2">
        {dailyAvailable && <select aria-label="Forecast horizon" value={horizon} onChange={event => setRequestedHorizon(event.target.value)} className="bg-[#191A24] text-dark-300 rounded p-1">
          <option value="24h">24 hours</option><option value="7d">7 days</option>
        </select>}
        <select aria-label="Forecast metric" value={metric} onChange={event => setMetric(event.target.value)} className="bg-[#191A24] text-dark-300 rounded p-1">
          {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        {forecasts.length > 1 && <select aria-label="Forecast entity" value={selected?.entity_id || ''} onChange={event => setEntity(event.target.value)} className="bg-[#191A24] text-dark-300 rounded p-1 max-w-40">
          {forecasts.map(item => <option key={item.entity_id} value={item.entity_id}>{item.entity_id}</option>)}
        </select>}
      </div>
    </div>
    <RequestState state={state} />
    {state.data && !series.length && <p className="text-xs text-dark-400">No forecast data for this location and issue time.</p>}
    {!!series.length && <>
      <div className="flex flex-wrap gap-2 items-center text-[11px] text-dark-300">
        <span>{selected.entity_id}</span><span className="rounded bg-brand-orange/15 text-brand-orange px-2 py-0.5">{method}</span>
        {synthetic && <span className="rounded bg-amber-500/15 text-amber-300 px-2 py-0.5">synthetic</span>}
        {state.data?.projection && <span>projection · holds latest observed score</span>}
        <span>{unit}</span>
      </div>
      <svg viewBox="0 0 300 90" className="w-full h-24" role="img" aria-label={`${selected.entity_id} forecast with lower and upper bands`}>
        <polygon points={`${points('upper')} ${series.map((point, index) => `${x(index)},${y(point.lower)}`).reverse().join(' ')}`} fill="#FF5500" opacity="0.18" />
        <polyline points={points('value')} fill="none" stroke="#FF5500" strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-[10px] text-dark-400"><span>{time(series[0].timestamp)} IST</span><span>{time(series.at(-1).timestamp)} IST</span></div>
      {selected.predicted_overflow_time && <p className="text-xs text-amber-300">Predicted overflow: {time(selected.predicted_overflow_time)} IST</p>}
      {state.data.days_of_water_available != null && <p className="text-xs text-dark-300">Water runway: {format(state.data.days_of_water_available)} days</p>}
      <details className="text-xs text-dark-400"><summary className="cursor-pointer">Values and uncertainty bands</summary>
        <div className="max-h-48 overflow-auto mt-2"><table className="w-full text-left"><thead><tr><th>Time (IST)</th><th>Forecast</th><th>Lower</th><th>Upper</th></tr></thead>
          <tbody>{series.map(point => <tr key={point.timestamp}><td>{time(point.timestamp)}</td><td>{format(point.value)}</td><td>{format(point.lower)}</td><td>{format(point.upper)}</td></tr>)}</tbody></table></div>
      </details>
    </>}
  </section>;
}

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

export function ForecastRisksPanel({ domain }) {
  const state = useForecastRequest('risks');
  if (USE_MOCK) return null;
  const risks = state.data?.risks.filter(item => !domain || item.domain === domain) || [];
  return <section className="bg-[#14151B] border border-[#22242E] rounded-2xl p-4 space-y-3">
    <h3 className="text-sm font-bold text-white">Next 24 hours · Predicted signals</h3><RequestState state={state} />
    {state.data && !risks.length && <p className="text-xs text-dark-400">No predicted threshold crossings.</p>}
    {risks.map(item => <p key={`${item.type}|${item.node}|${item.predicted_time}`} className="text-xs text-amber-300">{item.type.replace('predicted_', '').replaceAll('_', ' ')} · {item.node} · {time(item.predicted_time)} IST · {item.lead_time_hours}h lead</p>)}
  </section>;
}
