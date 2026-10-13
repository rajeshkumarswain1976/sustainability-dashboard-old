import React from 'react';
import {useDashboard} from '../context/DashboardContext';
import {USE_MOCK} from '../services/client';
import {formatReading} from '../services/format';
export default function CampusWeather({sample,className}) {
  const {dashboardData,filters}=useDashboard();
  if(USE_MOCK) return sample;
  const weather=dashboardData?.overview?.weather;
  return <section className={className} aria-label="Campus weather readings">
    <h3 className="text-sm font-bold text-white">Campus pulse</h3>
    <p className="text-xs text-dark-400 mt-1">{filters.location} · {filters.snapshotDate}</p>
    <div className="mt-4 text-sm text-white space-y-2">
      <p>Temperature: {formatReading(weather?.temperature,'°C')}</p>
      <p>Humidity: {formatReading(weather?.humidity,'%')}</p>
      <p>Rainfall: {formatReading(weather?.rainfallMm,'mm')}</p>
    </div>
    <p className="mt-3 text-[11px] text-dark-400">{weather?.asOf ? `Reading: ${new Date(weather.asOf).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST` : 'Weather reading unavailable'}{weather?.source ? ` · ${weather.source}` : ''}</p>
  </section>;
}
