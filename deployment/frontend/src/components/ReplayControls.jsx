import React, { useState,useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { api } from '../services/client';
import { snapshotAsOf } from '../services/dates';

export default function ReplayControls() {
  const { filters, replayState, setReplayState, refreshDashboard, showToast,currentUser } = useDashboard();
  const canControl=currentUser.key==='admin';
  const [busy, setBusy] = useState(false);
  const [status,setStatus]=useState(null);
  useEffect(()=>{
    if(!replayState?.running)return;
    let active=true;
    const refresh=()=>api.replayStatus().then(value=>{if(active)setStatus(value);}).catch(()=>{});
    refresh();const timer=setInterval(refresh,5000);
    return()=>{active=false;clearInterval(timer);};
  },[replayState?.running]);
  const run = async action => {
    setBusy(true);
    try { setReplayState(await action()); refreshDashboard(); }
    catch (error) { showToast(`Replay unavailable: ${error.message}`); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-wrap items-center gap-2 text-xs">
    <button disabled={busy||!canControl} onClick={() => run(() => replayState?.running ? api.replayPause() : api.replayStart({ node: filters.node, speed: replayState?.speed || 360 }))} className="px-3 py-1.5 rounded-lg bg-brand-orange/15 text-brand-orange">{replayState?.running ? 'Pause replay' : 'Start replay'}</button>
    <button disabled={busy || replayState?.running||!canControl} onClick={() => run(() => api.replaySeek(snapshotAsOf(filters.snapshotDate)))} className="px-3 py-1.5 rounded-lg bg-[#191A24] text-dark-300">Seek to selected date</button>
    <select aria-label="Replay speed" disabled={busy||!canControl} value={replayState?.speed || 360} onChange={event => run(() => api.replaySpeed(Number(event.target.value)))} className="bg-[#191A24] text-dark-300 rounded-lg p-1.5">
      {[1, 10, 60, 360, 3600].map(speed => <option key={speed} value={speed}>{speed}× · {3600/speed}s per hour</option>)}
    </select>
    <span className="text-dark-400">{replayState?.cursor ? new Date(replayState.cursor).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : 'Replay paused'}</span>
    {replayState?.running&&<span role="status" className={status?.error?'text-rose-300':'text-dark-400'}>{status?.error?`Replay needs attention: ${status.error}`:status?.processing?'Processing readings and decisions…':'Backend clock active'}</span>}
  </div>;
}
