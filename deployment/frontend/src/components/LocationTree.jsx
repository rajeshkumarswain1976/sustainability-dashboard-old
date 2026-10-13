import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { locationRows } from '../services/locations';

export default function LocationTree({ onSelect }) {
  const { locations, filters, updateFilter } = useDashboard();
  const [search, setSearch] = useState('');
  const rows = locationRows(locations).filter(node => node.path.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-2">
    <input aria-label="Search locations" placeholder="Search campus, building, floor…" value={search} onChange={event => setSearch(event.target.value)} className="w-full bg-[#191A24] text-white text-xs p-2 rounded-lg border border-[#262938]" />
    <div role="tree" aria-label="Campus locations" className="max-h-80 overflow-auto">
      {rows.map(node => <button key={node.node_id} role="treeitem" aria-level={node.depth + 1} aria-selected={filters.node === node.node_id} title={node.path} data-node-id={node.node_id}
        style={{ paddingLeft: 10 + node.depth * 16 }} onClick={() => { updateFilter('node', node.node_id); onSelect?.(); }}
        className={`w-full text-left text-xs py-2 pr-2 rounded-lg ${filters.node === node.node_id ? 'bg-brand-orange/20 text-brand-orange' : 'text-dark-200 hover:bg-[#20222F]'}`}>
        <span>{node.label}</span><span className="ml-2 text-[9px] text-dark-400">{node.level}</span>
      </button>)}
      {!rows.length && <p className="p-2 text-xs text-dark-400">No matching locations.</p>}
    </div>
  </div>;
}
