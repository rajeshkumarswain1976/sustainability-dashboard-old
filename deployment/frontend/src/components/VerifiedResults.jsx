import React from 'react';
export default function VerifiedResults({value}) {
  if(value==null)return <span className="text-dark-400">Unavailable</span>;
  if(typeof value!=='object')return <span>{typeof value==='number'?value.toLocaleString('en-IN',{maximumFractionDigits:3}):String(value)}</span>;
  return <dl className="space-y-2 text-xs">{Object.entries(value).map(([key,item])=><div key={key} className="border-l border-[#303343] pl-3"><dt className="text-dark-400">{key.replaceAll('_',' ')}</dt><dd className="mt-1"><VerifiedResults value={item}/></dd></div>)}</dl>;
}
