import React from 'react';
export default function ComplaintOverrides({item,options,busy,save}) {
  return <div className="flex flex-wrap gap-3">
    {[['category','categories'],['urgency','urgencies']].map(([field,key])=><label key={field} className="text-xs">Override {field}<select aria-label={`Override complaint ${field}`} disabled={busy} value={item[field]||''} onChange={event=>save({[field]:event.target.value})} className="ml-2 p-2 rounded-lg bg-[#191A24]"><option value="" disabled>Needs review</option>{(options?.[key]||[]).map(value=><option key={value}>{value}</option>)}</select></label>)}
    <label className="text-xs">Override priority<input aria-label="Override complaint priority" key={`${item.id}-${item.priority}`} defaultValue={item.priority??''} type="number" min="0" max="100" disabled={busy} onBlur={event=>{if(event.target.value!==''&&Number(event.target.value)!==item.priority)save({priority:Number(event.target.value)});}} className="ml-2 p-2 rounded-lg bg-[#191A24] w-20"/></label>
  </div>;
}
