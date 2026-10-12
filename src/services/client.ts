/** Typed wire contract for the local FastAPI backend. All dates are ISO 8601 with IST offset. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export type QueryWindow = { node: string; start: string; end: string; as_of: string };
export type Location = { node_id: string; level: string; parent_id: string | null; label: string };
export type Alert = { alert_key: string; alert_id: string; created_at: string; node: string; domain: string;
  type: string; level: 'Info' | 'Warning' | 'Critical' | null; status: string; confidence: number | null;
  facts: { observations: Record<string, unknown>; context: Record<string, unknown> } };
export type Action = { id: string; alert_key: string; type: string; node: string; text: string;
  saving_inr: number; saving_co2e: number; priority: number | null; owner: string | null;
  status: 'open' | 'acknowledged' | 'in_progress' | 'done'; needs_head_approval: boolean;
  needs_review: boolean; source: 'rule' | 'agent'; created_at: string };
export type ReplayState = { running: boolean; speed: number; cursor: string; last_processed_at: string | null; node: string };
export type DashboardPayload = {
  window: QueryWindow & { effective_end: string };
  data_source: { mode: string; classification: string };
  meta: { generatedAt: string; filters: QueryWindow };
  overview: { score: number; delta: number; trend: string;
    factors: { name: string; score: number; status: string; color: string; page: string }[];
    complaints: { open: number; overdue: number };
    utilization: { classrooms: number; labs: number; hostels: number };
    alertCounts: { open: number; critical: number; needsReview: number } };
  energy: { currentDemandKw: number; deltaVsPrevWeek: number; electricityMwh: number; peakDemandKw: number;
    estimatedEmissionsTco2e: number; avoidedTco2e: number;
    buildings: { name: string; kw: number; percent: number }[]; monthlySavingRs: number; savingMwh: number };
  water: { useTodayM3: number; deltaAvg: number; dailySupplyM3: number; storedReservePercent: number;
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
    rainAlertMm: number; rainAlertDuration: string };
  sustainability: { score: number; grade: string; ghgEmissionsYearly: number;
    renewableElectricityPercent: number; wasteDivertedPercent: number; openImprovementActions: number };
  actions: { openCount: number; inProgressCount: number; resolvedCount: number; policyChecks: string };
  insights: { dailySavingRs: number; energyVariancePercent: string };
};

function url(path: string, query?: object): string {
  const target = new URL(path, API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`);
  Object.entries(query || {}).forEach(([key, value]) => { if (value !== undefined) target.searchParams.set(key, String(value)); });
  return target.toString();
}

async function request<T>(path: string, query?: object,
                          init?: RequestInit): Promise<T> {
  const response = await fetch(url(path, query), init);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export const api = {
  dashboard: (window: QueryWindow) => request<DashboardPayload>('dashboard', window),
  locations: () => request<{ locations: Location[] }>('locations'),
  alerts: (query: { node?: string; since?: string; as_of?: string }) => request<{ as_of: string; alerts: Alert[] }>('alerts', query),
  actions: (query: { node?: string; as_of?: string }) => request<{ as_of: string; actions: Action[] }>('actions', query),
  decisionQueue: (query: { node?: string; as_of?: string }) => request<{ items: Alert[]; count: number }>('decisions/queue', query),
  replayState: () => request<ReplayState>('replay/state'),
  replayStart: (body: { node: string; as_of?: string; speed?: number }) => request<ReplayState>('replay/start', undefined,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  replayPause: () => request<ReplayState>('replay/pause', undefined, { method: 'POST' }),
  replaySeek: (as_of: string) => request<ReplayState>('replay/seek', undefined,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ as_of }) }),
  replaySpeed: (speed: number) => request<ReplayState>('replay/speed', undefined,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ speed }) }),
  actionStatus: (id: string, status: Action['status'], role: 'staff' | 'head') => request<Action>(`actions/${encodeURIComponent(id)}`,
    undefined, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Role': role }, body: JSON.stringify({ status }) }),
  streamUrl: (query: { node: string; as_of?: string }) => url('stream', query),
};
