import {useEffect,useState} from 'react';
import {useDashboard} from '../context/DashboardContext';
export function useScopedResource(loader) {
  const {forecastScope,filters,dashboardData,currentUser}=useDashboard();
  const [revision,setRevision]=useState(0),[result,setResult]=useState({});
  const scope={...forecastScope,node:filters.node};
  const key=JSON.stringify({scope,role:currentUser.key,revision});
  const ready=Boolean(dashboardData&&forecastScope.node===filters.node);
  useEffect(()=>{
    if(!ready) return;
    let active=true;
    loader(scope).then(data=>{if(active)setResult({key,data});}).catch(error=>{if(active)setResult({key,error:error.message});});
    return ()=>{active=false;};
  },[key,ready]);
  const state=result.key===key&&ready?result:{};
  return {data:state.data,error:state.error,loading:!state.data&&!state.error,scope,reload:()=>setRevision(value=>value+1)};
}
