import React from 'react';
import {USE_MOCK} from '../services/client';
export default function PendingPanel({sample,className,title}) {
  if(USE_MOCK) return sample;
  return <section className={className}><h3 className="text-sm font-bold text-white">{title}</h3><p className="mt-3 text-xs text-dark-400">The source records needed for this view are not connected yet. No sample results are shown.</p></section>;
}
