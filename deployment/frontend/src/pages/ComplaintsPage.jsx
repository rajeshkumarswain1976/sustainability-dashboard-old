import React,{useState,useEffect} from 'react';
import {api} from '../services/client';
import {useScopedResource} from '../services/useScopedResource';
import {useDashboard} from '../context/DashboardContext';
import ResourceState from '../components/ResourceState';
import ComplaintOverrides from '../components/ComplaintOverrides';
import QrCodeModal from '../components/QrCodeModal';
import { QrCode } from 'lucide-react';

export default function ComplaintsPage() {
  const {currentUser,refreshOperational}=useDashboard();
  const resource=useScopedResource(scope=>Promise.all([api.complaints(scope),api.complaintSummary(scope),api.complaintOptions()]).then(([list,summary,options])=>({...list,summary,options})));
  const [text,setText]=useState(''),[selected,setSelected]=useState([]),[detail,setDetail]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[reply,setReply]=useState(''),[notes,setNotes]=useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const head=currentUser.key!=='staff';
  const rows=resource.data?.complaints||[];
  const owners=resource.data?.options.owners||[];
  useEffect(()=>{setDetail(null);setSelected([]);setReply('');setNotes('');},[resource.scope.node,currentUser.key]);
  const run=async action=>{setBusy(true);setMessage('');try{const value=await action();resource.reload();await refreshOperational();return value;}catch(error){setMessage(error.message);}finally{setBusy(false);}};
  const open=async id=>{const result=await run(()=>api.complaintDetail(id,resource.scope));if(result){setDetail(result);setReply(result.complaint.reply||'');setNotes(result.complaint.resolution_notes||'');}};
  const save=async changes=>{const result=await run(()=>api.updateComplaint(detail.complaint.id,resource.scope,changes));if(result)await open(result.id);};
  const submit=async event=>{event.preventDefault();const result=await run(()=>api.submitComplaint({...resource.scope,text:text.trim()}));if(result){setText('');setMessage('Complaint recorded. Classification and review status come from the decision service.');}};
  const group=async operation=>{await run(()=>api.complaintGroup(operation,{...resource.scope,ids:selected}));setSelected([]);};
  return <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-extrabold text-white">Complaints</h1>
      <p className="mt-1 text-sm text-dark-300">Submit, triage and track reported campus issues with a persistent history.</p>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <a href="/campus-care" className="inline-block text-sm text-violet-300 hover:text-violet-200 underline">Open CampusCare — student reports and current department queue ↗</a>
        <button 
          onClick={() => setQrOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B1D28] hover:bg-[#252736] text-brand-orange border border-[#2D3042] rounded-lg text-xs font-semibold transition"
        >
          <QrCode className="w-3.5 h-3.5" />
          Location QR Signs & Poster Generator
        </button>
      </div>
    </div>
    {resource.data?.summary&&<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[['Open',resource.data.summary.open],['Needs review',resource.data.summary.needs_review],['Clusters',resource.data.summary.clusters],['Total reports',resource.data.summary.total]].map(([label,value])=><div key={label} className="p-4 bg-[#14151B] border border-[#22242E] rounded-2xl"><p className="text-xs text-dark-400">{label}</p><strong className="text-2xl text-white">{value}</strong></div>)}</div>}
    <form onSubmit={submit} className="p-5 bg-[#14151B] border border-[#22242E] rounded-2xl space-y-3"><label htmlFor="complaint-text" className="text-sm font-bold text-white">Report an issue at the selected location</label><textarea id="complaint-text" value={text} onChange={event=>setText(event.target.value)} minLength={3} maxLength={4000} required className="w-full p-3 bg-[#191A24] rounded-lg border border-[#262835] text-sm" placeholder="Describe the observed campus issue"/><button disabled={busy||!text.trim()} className="px-4 py-2 rounded-lg bg-brand-orange text-white text-xs">Submit complaint</button></form>
    {message&&<p role="status" className="text-sm text-amber-300">{message}</p>}
    <section className="p-5 bg-[#14151B] border border-[#22242E] rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-white">Recorded reports</h3>{head&&<div className="flex gap-2"><button disabled={busy||selected.length<2} onClick={()=>group('merge')} className="text-xs underline">Merge selected</button><button disabled={busy||!selected.length} onClick={()=>group('split')} className="text-xs underline">Split selected</button><button disabled={busy||!selected.length} onClick={()=>run(()=>api.complaintGroup('bulk',{...resource.scope,ids:selected,changes:{status:'triaged'}}))} className="text-xs underline">Bulk triage</button></div>}</div>
      <ResourceState {...resource} retry={resource.reload} empty={!rows.length}><div className="space-y-3 mt-4">{rows.map(item=><article key={item.id} className="p-3 bg-[#191A23] border border-[#262835] rounded-xl"><div className="flex gap-3">{head&&<input type="checkbox" aria-label={`Select complaint ${item.id}`} checked={selected.includes(item.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,item.id]:current.filter(id=>id!==item.id))}/>}<button onClick={()=>open(item.id)} className="text-left flex-1"><strong className="text-white text-sm">{item.text}</strong><p className="mt-2 text-xs text-dark-300">{item.category||'Category pending review'} · {item.status} · {item.owner||'Unassigned'}{item.confidence!=null?` · ${(item.confidence*100).toFixed(1)}%`:''}{item.needs_review?' · Needs review':''}</p><p className="mt-1 text-[11px] text-dark-400">{item.node} · {new Date(item.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p></button></div></article>)}</div></ResourceState>
    </section>
    {detail&&<section role="dialog" aria-label="Complaint detail" className="p-5 bg-[#14151B] border border-brand-orange/30 rounded-2xl space-y-4"><div className="flex justify-between"><h3 className="font-bold text-white">Complaint detail</h3><button onClick={()=>setDetail(null)} className="text-xs underline">Close detail</button></div><p className="text-sm">{detail.complaint.text}</p><div className="flex gap-3 flex-wrap"><label className="text-xs">Owner <select aria-label="Complaint owner" value={detail.complaint.owner||''} disabled={busy} onChange={event=>save({owner:event.target.value,status:'assigned'})} className="ml-2 bg-[#191A24] rounded-lg p-2"><option value="">Unassigned</option>{owners.map(owner=><option key={owner}>{owner}</option>)}</select></label><label className="text-xs">Status <select aria-label="Complaint status" value={detail.complaint.status} disabled={busy} onChange={event=>save({status:event.target.value})} className="ml-2 bg-[#191A24] rounded-lg p-2">{['open','triaged','assigned','in_progress',...(head?['rejected']:[])].map(status=><option key={status}>{status}</option>)}</select></label><button disabled={busy} onClick={()=>run(()=>api.complaintOperation(detail.complaint.id,'escalate',resource.scope))} className="px-3 py-2 text-xs bg-brand-orange rounded-lg">Escalate to action</button></div>
      {head&&<ComplaintOverrides item={detail.complaint} options={resource.data?.options} busy={busy} save={save}/>}
      <label className="block text-xs">Reply draft<textarea aria-label="Complaint reply" value={reply} onChange={event=>setReply(event.target.value)} className="mt-2 p-3 w-full rounded-lg bg-[#191A24]"/></label><div className="flex gap-3"><button disabled={busy} onClick={async()=>{const result=await run(()=>api.complaintOperation(detail.complaint.id,'reply-draft',resource.scope));if(result?.text)setReply(result.text);}} className="text-xs underline">Generate verified reply draft</button><button disabled={busy} onClick={()=>save({reply})} className="text-xs underline">Save edited reply</button></div>
      <label className="block text-xs">Resolution notes<textarea aria-label="Resolution notes" value={notes} onChange={event=>setNotes(event.target.value)} className="mt-2 p-3 w-full rounded-lg bg-[#191A24]"/></label><button disabled={busy||!notes.trim()||(!head&&(detail.complaint.needs_review||['high','critical'].includes(detail.complaint.urgency)))} onClick={()=>save({status:'resolved',resolution_notes:notes})} className="px-3 py-2 bg-brand-orange rounded-lg text-xs">Resolve complaint</button>
      <div><h4 className="font-bold text-sm">History</h4>{detail.history.map(event=><p key={event.id} className="mt-2 text-xs text-dark-400">{event.type} · {event.role} · {new Date(event.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</p>)}</div>
    </section>}
    <QrCodeModal isOpen={qrOpen} onClose={() => setQrOpen(false)} />
  </div>;
}
