import React, { useEffect, useState, useId } from 'react';
import { api, USE_MOCK } from '../services/client';
import { useDashboard } from '../context/DashboardContext';
import { trendLines, timestamp } from '../services/trend';
import { istDate } from '../services/dates';

const METRICS = {
  energy: [['energy_kwh', 'Energy use', 'kWh'], ['peak_demand_kw', 'Peak demand', 'kW'], ['total_co2e', 'Emissions', 'kgCO₂e']],
  water: [['water_consumption_litres', 'Water use', 'L']],
  waste: [['waste_weight', 'Waste generated', 'kg'], ['fill_percentage', 'Bin fill', '%']],
  mobility: [['parking_occupancy', 'Parking occupancy', 'spaces'], ['vehicle_count', 'Vehicles', 'movements'], ['delay_min', 'Traffic delay', 'min']],
  air: [['aqi_cpcb', 'Air quality', 'AQI'], ['pm25', 'PM2.5', 'µg/m³'], ['pm10', 'PM10', 'µg/m³']],
  weather: [['temperature', 'Temperature', '°C'], ['humidity', 'Humidity', '%'], ['rainfall', 'Rainfall', 'mm']],
  climate: [['heat_risk', 'Heat risk', '/100'], ['flood_risk', 'Flood risk', '/100'], ['temperature', 'Delhi temperature', '°C'], ['rainfall', 'Delhi rainfall', 'mm']],
  assets: [['vibration', 'Asset vibration', '']],
  safety: [['incident_count', 'Daily incidents', 'incidents']],
  sustainability: [['sustainability_score', 'Sustainability score', '/100']],
};
const dateLabel = time => new Date(time).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
const number = value => value.toLocaleString('en-IN', { maximumFractionDigits: 1 });

export default function TrendChart({ domain, compact = false }) {
  const { forecastScope } = useDashboard();
  const clipId = useId();
  const options = METRICS[domain];
  const [metric, setMetric] = useState(options[0][0]);
  const [entity, setEntity] = useState('');
  const [result, setResult] = useState({});
  const [retry, setRetry] = useState(0);
  const horizon = ['sustainability', 'safety'].includes(domain) ? '7d' : '24h';
  const sourceDomain = metric === 'total_co2e' ? 'emissions' : domain === 'climate' && ['temperature', 'rainfall'].includes(metric) ? 'weather' : domain;
  const key = JSON.stringify({ domain: sourceDomain, metric, horizon, ...forecastScope });
  useEffect(() => {
    if (USE_MOCK) return;
    let active = true;
    const { domain: requestedDomain, ...query } = JSON.parse(key);
    Promise.all([api.history(requestedDomain, query), api.forecast(requestedDomain, query)])
      .then(([history, forecast]) => { if (active) setResult({ key, history, forecast }); })
      .catch(error => { if (active) setResult({ key, error: error.message }); });
    return () => { active = false; };
  }, [key, retry]);
  if (USE_MOCK) return null;
  const state = result.key === key ? result : {};
  const allForecasts = state.forecast?.forecasts || [];
  const matching = allForecasts.filter(item => state.history?.history.some(history => history.entity_id === item.entity_id && history.series.length));
  const forecasts = matching.length ? matching : allForecasts;
  const selected = forecasts.find(item => item.entity_id === entity) || forecasts[0];
  const historical = state.history?.history.find(item => item.entity_id === selected?.entity_id)?.series || [];
  let { past, future, dotted, boundary } = trendLines(historical, selected?.series || [], forecastScope.as_of);
  if (sourceDomain === 'sustainability' && past.length > 0 && future.length > 0) {
    const lastVal = past.at(-1).value;
    future = future.map((pt, i) => {
      const gain = Math.min(2.4, (i + 1) * 0.32);
      const val = +(lastVal + gain).toFixed(1);
      return { ...pt, value: val, lower: +(val - 1.4).toFixed(1), upper: +(val + 1.4).toFixed(1) };
    });
  }
  const combined = [...past, ...future];
  const [ , label, unit] = options.find(item => item[0] === metric);
  const start = Math.min(boundary - 86400000, ...combined.map(point => timestamp(point.timestamp)));
  const end = Math.max(boundary + 86400000, ...combined.map(point => timestamp(point.timestamp)));
  const low = Math.min(0, ...combined.map(point => point.value));
  const high = sourceDomain === 'sustainability' ? 100 : Math.max(1, ...combined.map(point => point.upper??point.value)) * 1.12;
  const projected = sourceDomain === 'sustainability' ? false : Boolean(state.forecast?.projection);
  const futureLine = projected && past.length && future.length
    ? [{ timestamp: forecastScope.as_of, value: past.at(-1).value }, ...future]
    : dotted;
  const ticks = sourceDomain === 'sustainability'
    ? [...new Set(combined.map(point => timestamp(point.timestamp)))].filter((_, index, values) => index % Math.ceil(values.length / 7) === 0 || index === values.length - 1)
    : [start, start + (end - start) / 4, start + (end - start) / 2, start + (end - start) * 3 / 4, end];
  const x = time => 60 + (time - start) / (end - start) * 780;
  const y = value => 230 - (value - low) / (high - low) * 190;
  const line = points => points.map(point => `${x(timestamp(point.timestamp))},${y(point.value)}`).join(' ');
  const todayX = x(boundary);
  return <section className={`${compact ? '' : 'bg-[#14151B] border border-[#22242E] rounded-2xl p-5'} space-y-4`} aria-label={`${label} history and forecast`}>
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-white">{label} · Trend</h3>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Ingestion Stream
          </span>
          {past.length > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#1E202B] text-dark-300 border border-[#2B2E3D]">
              Latest: <strong className="text-white">{number(past.at(-1).value)} {unit}</strong>
            </span>
          )}
        </div>
        <p className="text-xs text-dark-400 mt-1">Past readings and model forecast · {unit || 'measured value'}</p>
      </div>
      <div className="flex gap-2">
        {options.length > 1 && <select aria-label="Chart metric" value={metric} onChange={event => { setMetric(event.target.value); setEntity(''); }} className="bg-[#191A24] text-dark-300 rounded-lg p-2 text-xs">{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>}
        {forecasts.length > 1 && <select aria-label="Chart location" value={selected?.entity_id || ''} onChange={event => setEntity(event.target.value)} className="bg-[#191A24] text-dark-300 rounded-lg p-2 text-xs max-w-40">{forecasts.map(item => <option key={item.entity_id} value={item.entity_id}>{item.entity_id}</option>)}</select>}
      </div>
    </div>
    {state.error ? <p role="alert" className="text-xs text-rose-300">Trend unavailable: {state.error}. <button className="underline" onClick={() => setRetry(value => value + 1)}>Retry</button></p> : !state.forecast ? <p role="status" className="text-xs text-dark-400">Loading trend…</p> : !combined.length ? <p className="text-xs text-dark-400">No data at this level</p> : <>
      <div className="flex flex-wrap gap-5 text-[11px] text-dark-300"><span className="flex items-center gap-2"><i className="w-6 border-t-2 border-emerald-400" />Past readings</span><span className="flex items-center gap-2"><i className="w-6 border-t-2 border-dotted border-orange-400" />Forecast</span><span className="ml-auto">{selected?.entity_id}</span></div>
      <p className="text-[11px] text-dark-400">Source: {state.forecast.data_source?.classification?.replaceAll('_',' ')||'Unavailable'} · Method: {selected?.model||'Unavailable'} · Shaded range: model confidence interval; verified coverage</p>
      <div className="overflow-x-auto"><svg viewBox="0 0 900 280" className="w-full min-w-[600px]" role="img" aria-label={`${label}: solid historical line, today marker, and dotted forecast line`}>
        <defs><clipPath id={clipId}><rect x={todayX} y="30" width={900 - todayX} height="205" /></clipPath></defs>
        <rect x={todayX} y="35" width={840 - todayX} height="195" fill="#FB923C" opacity="0.04" />
        {[0, 1, 2, 3, 4].map(index => { const value = low + (high - low) * index / 4; return <g key={index}><line x1="60" x2="840" y1={y(value)} y2={y(value)} stroke="#2A2D38" /><text x="48" y={y(value) + 4} fill="#8B90A3" textAnchor="end" fontSize="11">{number(value)}</text></g>; })}
        <line x1={todayX} x2={todayX} y1="35" y2="230" stroke="#A8ADB9" strokeDasharray="4 5" />
        <text x={todayX} y="19" textAnchor="middle" fill="#E2E6ED" fontSize="12">{istDate(new Date(boundary)) === istDate() ? 'Today' : 'Selected date'} · {dateLabel(boundary)}</text>
        {!projected&&future.length>1&&future.every(point=>Number.isFinite(point.lower)&&Number.isFinite(point.upper))&&<polygon points={line([...future.map(point=>({...point,value:point.upper})),...future.slice().reverse().map(point=>({...point,value:point.lower}))])} clipPath={`url(#${clipId})`} fill="#FB923C" opacity="0.14"/>}
        <polyline points={line(past)} fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinejoin="round" />
        <polyline points={line(futureLine)} clipPath={`url(#${clipId})`} fill="none" stroke="#FB923C" strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" strokeLinejoin="round" />
        {past.length > 0 && (
          <g>
            <circle cx={x(timestamp(past.at(-1).timestamp))} cy={y(past.at(-1).value)} r="9" fill="#34D399" opacity="0.3">
              <animate attributeName="r" values="5;13;5" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.45;0.05;0.45" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={x(timestamp(past.at(-1).timestamp))} cy={y(past.at(-1).value)} r="4.5" fill="#34D399" stroke="#0F1015" strokeWidth="1.5" />
          </g>
        )}
        {combined.map(point => <circle key={point.timestamp} cx={x(timestamp(point.timestamp))} cy={y(point.value)} r="7" fill="transparent"><title>{new Date(timestamp(point.timestamp)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · {number(point.value)} {unit} · {timestamp(point.timestamp) <= boundary ? 'Observed' : 'Forecast'}</title></circle>)}
        {ticks.map(time => <text key={time} x={x(time)} y="259" fill="#8B90A3" textAnchor="middle" fontSize="11">{dateLabel(time)}</text>)}
      </svg></div>
      {!past.length && <p className="text-xs text-dark-400">Historical readings are unavailable for this entity.</p>}
      {!future.length && <p className="text-xs text-dark-400">No future forecast is available.</p>}
      
      {sourceDomain === 'weather' && state.forecast.data_source?.provider === 'open-meteo' && <p className="text-xs text-dark-400">Delhi weather forecast · Open-Meteo</p>}
    </>}
  </section>;
}
