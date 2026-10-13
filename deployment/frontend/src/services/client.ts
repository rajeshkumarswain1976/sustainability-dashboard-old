/** Typed wire contract for the local FastAPI backend. All dates are ISO 8601 with IST offset. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
let apiRole: 'staff'|'head' = 'staff';
export const setApiRole = (role: 'staff'|'head') => { apiRole = role; };

export type QueryWindow = { node: string; start: string; end: string; as_of: string };
export type Location = { node_id: string; level: string; parent_id: string | null; label: string };
export type Alert = { alert_key: string; alert_id: string; created_at: string; node: string; domain: string;
  type: string; level: 'Info' | 'Warning' | 'Critical' | null; status: string; confidence: number | null;
  lead_time_hours?: number | null;
  facts: { observations: Record<string, unknown>; context: Record<string, unknown>; history?: object[]; decisions?: Record<string, unknown> } };
export type Action = { id: string; alert_key: string; type: string; node: string; text: string;
  saving_inr: number; saving_co2e: number; priority: number | null; owner: string | null;
  status: 'open' | 'acknowledged' | 'in_progress' | 'done'; needs_head_approval: boolean;
  needs_review: boolean; estimate_available?:boolean; source: 'rule' | 'agent'; created_at: string };
export type ReplayState = { running: boolean; speed: number; cursor: string; last_processed_at: string | null; node: string };
export type DashboardPayload = {
  pending_fields?: Record<string, string>;
  window: QueryWindow & { effective_end: string };
  data_source: { mode: string; classification: string };
  meta: { generatedAt: string; filters: QueryWindow };
  overview: { score: number; delta: number; trend: string;
    weather?: {temperature: number|null; humidity:number|null; rainfallMm:number|null; asOf:string; source:string};
    factors: { name: string; score: number | null; status: string; color: string; page: string; source?: string; source_column?: string }[];
    complaints: { open: number; overdue: number };
    utilization: { classrooms: number; labs: number; hostels: number };
    alertCounts: { open: number; critical: number; needsReview: number } };
  energy: { currentDemandKw: number; deltaVsPrevWeek: number; electricityMwh: number; peakDemandKw: number;
    estimatedEmissionsTco2e: number; avoidedTco2e: number;
    buildings: { name: string; kw: number; percent: number }[]; monthlySavingRs: number; savingMwh: number };
  water: { useTodayM3: number; deltaAvg: number; dailySupplyM3: number; storedReservePercent: number;
    daysOfWaterAvailable?:number|null; meanLinePressureBar?:number|null; flowM3PerHour?:number|null;
    waterStress?:number|null; monitoredTankCapacityKl?:number|null;
    intensityLPerPerson: number; leakAnomalyDelta: string; weeklySavingRs: number;
    tanks: { name: string; percent: number }[] };
  waste: { generatedTonnes: number; deltaVsLastWeek: number; collectedOnSchedulePercent: number;
    overflowIncidents: number; diversionRatePercent: number;
    streams: { name: string; tonnage: number; width: string }[]; routeSavingRsWeekly: number };
  air: { aqi: number; status: string; weeklyMeanAqi: number; pm25Mean: number; wind: string; outlook: string };
  assets: { conditionScore: number; maintenanceDueCount: number; unresolvedCount: number;
    criticalTracked: number; failuresTrendPer100: number; calloutSavingRs: number };
  mobility: { dailyEntries: number; typicalDelayMin: number; parkingOccupiedPercent: number;
    openCapacitySpaces: number; garages: { name: string; percent: number; status: string }[] };
  safety: { openReports: number; highRiskZones: number; inspectionsPercent: number;
    anomaliesCount: number; periodReportedIssues: number };
  climate: { preparednessIndex: number; heatIndexC: number; coolingLoadMw: number;
    heatRisk?:number|null; floodRisk?:number|null;
    rainAlertMm: number; rainAlertDuration: string };
  sustainability: { score: number; grade: string; ghgEmissionsYearly: number;
    renewableElectricityPercent: number; wasteDivertedPercent: number; openImprovementActions: number };
  actions: { openCount: number; inProgressCount: number; resolvedCount: number; policyChecks: string };
  insights: { dailySavingRs: number; energyVariancePercent: string };
};

function url(path: string, query?: object): string {
  const base = new URL(API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`, window.location.origin);
  const target = new URL(path, base);
  Object.entries(query || {}).forEach(([key, value]) => { if (value !== undefined) target.searchParams.set(key, String(value)); });
  return target.toString();
}

async function request<T>(path: string, query?: object,
                          init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('X-Role')) headers.set('X-Role', apiRole);
  const response = await fetch(url(path, query), { credentials:'include', ...init, headers, signal: AbortSignal.timeout(60000) });
  if (!response.ok) {
    const failure=await response.json().catch(()=>null);
    throw new Error(typeof failure?.detail==='string'?failure.detail:`${path}: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  authMe: () => request<{user:any;demo_mode:boolean}>('auth/me'),
  markAlertReview:(id:string,query:{node:string;as_of:string})=>request<Alert>(`alerts/${encodeURIComponent(id)}/review`,query,{method:'POST'}),
  login: (email:string,password:string) => request<{user:any;demo_mode:boolean}>('auth/login',undefined,jsonRequest({email,password})),
  logout: () => request('auth/logout',undefined,{method:'POST'}),
  demoRole: (role:string) => request<{user:any;demo_mode:boolean}>('auth/demo-role',undefined,jsonRequest({role})),
  aiStatus: (query: {node:string;as_of?:string}) => request<AiStatus>('ai/status',query),
  copilot: (body: ScopedBody & {question:string}) => request<CopilotResponse>('copilot',undefined,jsonRequest(body)),
  weeklySummary: (query: {node:string;as_of:string}) => request<WeeklySummary>('summary/weekly',query),
  simulate: (body: ScopedBody & {scenario:string;parameters:Record<string,number>}) => request<SimulationResponse>('simulate',undefined,jsonRequest(body)),
  runAgent: (body: ScopedBody & {limit?:number}) => request<{results:object[];count:number}>('agent/run',undefined,jsonRequest(body)),
  complaints: (query: {node:string;as_of:string}) => request<{complaints:Complaint[];as_of:string}>('complaints',query),
  complaintSummary: (query: {node:string;as_of:string}) => request<ComplaintSummary>('complaints/summary',query),
  complaintOptions: () => request<{owners:string[];categories:string[];urgencies:string[];statuses:string[]}>('complaints/options'),
  submitComplaint: (body: ScopedBody & {text:string}) => request<Complaint>('complaints',undefined,jsonRequest(body)),
  complaintDetail: (id:string,query:{node:string;as_of:string}) => request<{complaint:Complaint;history:ComplaintEvent[]}>(`complaints/${encodeURIComponent(id)}`,query),
  updateComplaint: (id:string,query:{node:string;as_of:string},changes:Partial<Complaint>) => request<Complaint>(`complaints/${encodeURIComponent(id)}`,query,jsonRequest(changes,'PATCH')),
  complaintGroup: (operation:'bulk'|'merge'|'split',body:ScopedBody & {ids:string[];changes?:Partial<Complaint>}) => request<{complaints:Complaint[]}>(`complaints/${operation}`,undefined,jsonRequest(body)),
  complaintOperation: (id:string,operation:'escalate'|'reply-draft',query:{node:string;as_of:string}) => request<{action_id?:string;text?:string;source?:string}>(`complaints/${encodeURIComponent(id)}/${operation}`,query,{method:'POST'}),
  knowledge: (query:{q:string;node:string;as_of:string}) => request<{method:string;results:KnowledgeResult[]}>('knowledge/search',query),
  safetyClassifications: (query:{node:string;as_of:string}) => request<{classifications:object[]}>('safety/classifications',query),
  history: (domain: string, query: { node: string; as_of: string; metric: string; horizon: string; start?: string; end?: string }) =>
    request<{ history: { entity_id: string; series: { timestamp: string; value: number }[] }[] }>(`history/${domain}`, query),
  forecast: async (domain: string, query: { node: string; as_of: string; metric?: string; horizon?: string }) => {
    const data = await request<ForecastResponse>(`forecast/${domain}`, query);
    const floors = data.floor_forecasts?.filter(item => item.entity_id === query.node);
    return floors?.length ? { ...data, forecasts: floors } : data;
  },
  forecastAccuracy: (query: { node: string; as_of: string }) => request<{ targets: ForecastAccuracy[] }>('forecast/accuracy', query),
  forecastRisks: (query: { node: string; as_of: string }) => request<{ risks: ForecastRisk[] }>('forecast/risks', query),
  dashboard: (window: QueryWindow) => request<DashboardPayload>('dashboard', window),
  locations: () => request<{ locations: Location[] }>('locations'),
  alerts: (query: { node?: string; since?: string; as_of?: string }) => request<{ as_of: string; alerts: Alert[] }>('alerts', query),
  actions: (query: { node?: string; as_of?: string }) => request<{ as_of: string; actions: Action[] }>('actions', query),
  decisionQueue: (query: { node?: string; as_of?: string }) => request<{ items: Alert[]; count: number }>('decisions/queue', query),
  replayState: () => request<ReplayState>('replay/state'),
  replayStatus:()=>request<{owner:string;processing:boolean;error:string|null}>('replay/status'),
  replayStart: (body: { node: string; as_of?: string; speed?: number }) => request<ReplayState>('replay/start', undefined,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  replayPause: () => request<ReplayState>('replay/pause', undefined, { method: 'POST' }),
  replaySeek: (as_of: string) => request<ReplayState>('replay/seek', undefined,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ as_of }) }),
  replaySpeed: (speed: number) => request<ReplayState>('replay/speed', undefined,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ speed }) }),
  actionStatus: (id: string, status: Action['status'], role: 'staff' | 'head') => request<Action>(`actions/${encodeURIComponent(id)}`,
    undefined, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Role': role }, body: JSON.stringify({ status }) }),
  actionAssign: (id:string, body:{owner:string;reason:string;approve:boolean}) => request<Action>(`actions/${encodeURIComponent(id)}/assign`,undefined,
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
  streamUrl: (query: { node: string; as_of?: string }) => url('stream', query),
};

function jsonRequest(body:unknown,method='POST'):RequestInit {return {method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};}
export type ScopedBody = {node:string;as_of:string;start?:string;end?:string};
export type AiStatus = {sector:string;jev:{configured:boolean;provider:string;model:string;decision_results:{provider:string;status:string;results:number}[]};groq:{configured:boolean;model:string}};
export type KnowledgeResult = {id:string;source:string;content:string;heading:string;placeholder:boolean;similarity:number};
export type CopilotResponse = {status:string;text:string;source:string;tools:{tool:string;arguments:object;result:Record<string,unknown>}[];citations:string[];number_check:{passed:boolean;unsupported_numbers?:string[]};log_id:string};
export type SimulationResponse = {scenario:string;source:{domain:string;window:QueryWindow;kpis:Record<string,number|null>};assumptions:Record<string,number>;outcome:Record<string,number|null>;formulas:Record<string,string>;classification:string};
export type WeeklySummary = {node:string;start:string;as_of:string;summary:{text:string;source:string;number_check:{passed:boolean}};domains:Record<string,object>};
export type Complaint = {id:string;node:string;text:string;created_at:string;status:string;category:string|null;urgency:string|null;owner:string|null;priority:number|null;confidence:number|null;needs_review:boolean;cluster_id:string;linked_alert:string|null;action_id:string|null;reply?:string|null;resolution_notes?:string};
export type ComplaintEvent = {id:string;created_at:string;role:string;type:string;changes:object};
export type ComplaintSummary = {total:number;open:number;needs_review:number;clusters:number;by_status:Record<string,number>};

export type ForecastPoint = { timestamp: string; value: number; lower: number; upper: number; parking_percent?: number };
export type ForecastResponse = { domain: string; as_of: string; node: string; projection?: boolean; projection_basis?: string;
  floor_forecasts?: ForecastResponse['forecasts'];
  days_of_water_available?: number | null; unit?: string;
  data_source: { mode: string; classification: string };
  forecasts: { entity_id: string; metric?: string; model: string; mae: number | null; baseline_mae: number | null;
    series: ForecastPoint[]; predicted_overflow_time?: string | null }[] };
export type ForecastAccuracy = { target: string; served_model: string | null; mae: number | null;
  baseline_mae: number | null; smape: number | null; status: string; folds: { band_coverage?: number }[] };
export type ForecastRisk = { type: string; node: string; domain: string; predicted_time: string; lead_time_hours: number };
