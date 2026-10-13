import React,{useEffect,useState} from 'react';
import {api} from '../services/client';
import {useDashboard} from '../context/DashboardContext';
export default function ActionAssignment({actionId}) {
  const {currentUser,refreshOperational,showToast}=useDashboard();
  const [owners,setOwners]=useState([]),[owner,setOwner]=useState(''),[reason,setReason]=useState(''),[approve,setApprove]=useState(false),[busy,setBusy]=useState(false);
  useEffect(()=>{if(currentUser.key!=='staff') api.complaintOptions().then(value=>setOwners(value.owners)).catch(error=>showToast(error.message));},[currentUser.key,showToast]);
  if(currentUser.key==='staff')return null;
  return <details className="mt-3 text-xs text-dark-300"><summary className="cursor-pointer text-violet-300">Assign team / record head review</summary><form className="mt-3 grid gap-2" onSubmit={async event=>{event.preventDefault();setBusy(true);try{await api.actionAssign(actionId,{owner,reason,approve});await refreshOperational();showToast('Assignment and review recorded');setReason('');}catch(error){showToast(error.message);}finally{setBusy(false);}}}><select aria-label={`Assign team ${actionId}`} required value={owner} onChange={event=>setOwner(event.target.value)} className="p-2 bg-[#14151B] rounded"><option value="">Choose team</option>{owners.map(item=><option key={item}>{item}</option>)}</select><input aria-label={`Review reason ${actionId}`} required minLength={3} maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)} placeholder="Reason for assignment or approval" className="p-2 bg-[#14151B] rounded"/><label className="flex gap-2"><input type="checkbox" checked={approve} onChange={event=>setApprove(event.target.checked)}/>I have reviewed the evidence and approve this work</label><button disabled={busy} className="p-2 bg-violet-700 rounded text-white">Save assignment</button></form></details>;
}
