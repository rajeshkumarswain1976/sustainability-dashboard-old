# Frontend ↔ API contract (Phase 3)

Frontend source is `src/` in this repository. `src/services/api.js` holds the legacy demo object and is used only when `VITE_USE_MOCK=true`. `src/services/client.ts` is the typed HTTP/SSE client. The default base URL is `http://localhost:8000`; override it with `VITE_API_BASE_URL`. All numeric values are JSON numbers, dates are ISO 8601 strings, and arrays are empty when there is no data. The backend mapping lives in `app/api/schemas.py` and does not change source-domain tables.

## Shared controls and envelopes

| Control/widget | Request | Response shape used |
| --- | --- | --- |
| Location dropdown | `GET /locations` | `{window,data_source,locations: Location[]}`, `Location={node_id:string,level:string,parent_id:string|null,label:string,zone_id:string|null,building_id:string|null,floor_id:string|null,sort_order:number|null,data_source:string}`. The selected label maps to `node_id`. |
| Period/date | `GET /dashboard?node=&start=&end=&as_of=` | `window={node,start,end,as_of,effective_end}`. `period` chooses start/end; snapshot date chooses `as_of`. |
| Replay picker | `GET /replay/state`, `POST /replay/start` `{node,as_of?,speed?}`, `/pause`, `/seek` `{as_of}`, `/speed` `{speed}` | `ReplayState={running:boolean,speed:number,cursor:string,last_processed_at:string|null,node:string}`. |
| Bell, popup, Alerts/decision queue | `GET /alerts?node=&since=&as_of=`, `GET /decisions/queue?node=&as_of=`, `GET /stream?node=` | `Alert={alert_key,alert_id,created_at,node,domain,type,level:Info|Warning|Critical|null,status,confidence:number|null,facts:{observations,context}}`. SSE `tick` data `{as_of,ticks,new_alerts}`; reconnect reads `/alerts?since=` and deduplicates by `alert_key`. Queue is `{as_of,items:Alert[],count,data_source}`. |
| Shared sustainability score and alert counts | `GET /dashboard` | `overview.score:number`, `sustainability.score:number` are the same value; `overview.alertCounts={open:number,critical:number,needsReview:number}` and the bell use the same alert rows at `as_of`. |
| Action queue | `GET /actions?node=&as_of=`, `PATCH /actions/{id}` body `{status}` and `X-Role: staff|head` | `{as_of,actions:Action[],data_source}`; `Action={id,alert_key,type,node,text,saving_inr:number,saving_co2e:number,priority:number|null,owner:string|null,status:open|acknowledged|in_progress|done,needs_head_approval:boolean,needs_review:boolean,source:rule|agent,created_at:string}`. |

The Alerts page renders the same `Alert[]` and `overview.alertCounts` as the header bell and Overview panel. The Actions page renders the same `Action[]` returned by `/actions`, with status progression in its existing queue layout.

Every `/dashboard` response also includes `window` and `data_source={mode,classification}`. No sensor readings are described as live IoT.

## Page and widget shapes

| Page/widgets | Exact `/dashboard` JSON fields and units | Pending shaped value |
| --- | --- | --- |
| Overview score, trend, factor cards | `overview={score:number (0–100),delta:number (points),trend:string,factors:[{name:string,score:number,status:string,color:string,page:string}],complaints:{open:number,overdue:number},utilization:{classrooms:number,labs:number,hostels:number},alertCounts:{open:number,critical:number,needsReview:number}}` | Complaint counts are `0` pending Phase 4 complaint ingestion. `delta=0` until prior-period comparison is implemented. |
| Energy cards and building bars | `energy={currentDemandKw:number,deltaVsPrevWeek:number,electricityMwh:number,peakDemandKw:number,estimatedEmissionsTco2e:number,avoidedTco2e:number,buildings:[{name:string,kw:number,percent:number}],monthlySavingRs:number,savingMwh:number}` | `deltaVsPrevWeek=0`, `avoidedTco2e=0`, `savingMwh=0` pending Phase 4 simulation. |
| Water cards and tanks | `water={useTodayM3:number,deltaAvg:number,dailySupplyM3:number,storedReservePercent:number,intensityLPerPerson:number,leakAnomalyDelta:string,weeklySavingRs:number,tanks:[{name:string,percent:number}]}` | `deltaAvg=0`, `dailySupplyM3=0`, `leakAnomalyDelta=""` pending Phase 4 comparison/supply model. |
| Waste cards and streams | `waste={generatedTonnes:number,deltaVsLastWeek:number,collectedOnSchedulePercent:number,overflowIncidents:number,diversionRatePercent:number,streams:[{name:string,tonnage:number,width:string}],routeSavingRsWeekly:number}` | Comparison and route saving fields are `0` pending Phase 4 simulation. |
| Air cards | `air={aqi:number,status:string,weeklyMeanAqi:number,pm25Mean:number,wind:string,outlook:string}` | `outlook=""` pending Phase 4; backend supplies measured replay wind field when present. |
| Assets cards | `assets={conditionScore:number,maintenanceDueCount:number,unresolvedCount:number,criticalTracked:number,failuresTrendPer100:number,calloutSavingRs:number}` | Last three metrics `0` pending Phase 4 comparison/catalogue expansion. |
| Mobility cards and garages | `mobility={dailyEntries:number,typicalDelayMin:number,parkingOccupiedPercent:number,openCapacitySpaces:number,garages:[{name:string,percent:number,status:string}]}` | Empty garages array when no gate rows. |
| Safety cards | `safety={openReports:number,highRiskZones:number,inspectionsPercent:number,anomaliesCount:number,periodReportedIssues:number}` | Risk-zone and inspection percentage `0` pending Phase 4 joins. |
| Climate cards | `climate={preparednessIndex:number,heatIndexC:number,coolingLoadMw:number,rainAlertMm:number,rainAlertDuration:string}` | `coolingLoadMw=0` pending Phase 4 simulation. |
| Sustainability cards | `sustainability={score:number,grade:string,ghgEmissionsYearly:number,renewableElectricityPercent:number,wasteDivertedPercent:number,openImprovementActions:number}` | `grade=""`, `ghgEmissionsYearly=0` pending Phase 4 grading and annualization. |
| Actions cards and queue | `actions={openCount:number,inProgressCount:number,resolvedCount:number,policyChecks:string}` plus `/actions` rows above | `policyChecks="0 / 0"` pending Phase 4 policy retrieval. Complaint cluster list is `[]` pending Phase 4. |
| Insights summary | `insights={dailySavingRs:number,energyVariancePercent:string}` | Variance is `""` pending Phase 4 comparison. |

The current UI contains additional hard-coded narrative charts, examples, and sample complaint rows in page components. Those are presentation placeholders pending Phase 4 source-backed visualizations. Connected cards use the mapped fields above; no source table is changed to fit display labels.

## Domain and forecast endpoints available for later widgets

`GET /energy|water|waste|air|assets|mobility|safety|climate|sustainability|emissions` each takes `node,start,end,as_of` and returns `{window,data_source,kpis,series}` (safety uses `incidents` instead of `series`). `GET /forecast/{energy|water|parking}?node=&as_of=` returns `{domain,node,as_of,forecasts:[{entity_id,model,mae,baseline_mae,series}]}` and top-level metrics for a single entity. Units follow the source columns (`energy_kwh`, `water_consumption_litres`, `parking_occupancy`).
