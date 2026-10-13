import React from 'react';
export default function ResourceState({loading,error,retry,empty,children}) {
  if(loading)return <p role="status" className="text-sm text-dark-400 py-5">Loading recorded data…</p>;
  if(error)return <div role="alert" className="p-4 border border-amber-500/30 bg-amber-500/10 rounded-xl text-sm"><p>{error}</p><button onClick={retry} className="underline mt-2">Retry</button></div>;
  if(empty)return <p className="text-sm text-dark-400 py-5">No records at this location and snapshot.</p>;
  return children;
}
