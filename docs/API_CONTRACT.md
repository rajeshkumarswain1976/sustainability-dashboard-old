# Frontend ↔ API contract (Phase 3)

Active frontend: `C:/Users/HP/Desktop/sustainability-dashboard/src/`; backend: sibling
`sustainability-dashboard-old`. `src/services/api.js` retains sample data behind `VITE_USE_MOCK=true`
(default false). `src/services/client.ts` is the only typed HTTP/SSE client. Its default base is `/api`,
proxied to localhost:8000 by Vite; production can override `VITE_API_BASE_URL`.
All values retain the existing widget fields and units below. No source tables are changed for UI labels.

The location tree stores `filters.node` as node_id; display labels are never sent as node.
The period supplies IST start/end; snapshot date supplies as_of; active replay uses its cursor.
All 42 nodes are uniquely selectable. The colliding Academic building is `building:Academic`,
while the Academic zone retains `Academic`; floor parent IDs follow that building identity.

Replay controls use the existing JSON bodies. `/stream?node=` provides SSE tick updates; after a
connection loss `/alerts?node=&since=&as_of=` catches up and deduplicates alert_key before reconnecting.
Only open/needs_review/pending_agent rows appear in the bell. The shared header reads score and
open/critical/needsReview counts from the same overview fields used by every page.

`GET /history/{domain}?node=&metric=&horizon=24h|7d&as_of=` is the read-only chart extension in
scripts/dashboard_backend.py. Shape: `{domain:string,metric:string,as_of:string,history:[{entity_id:string,
series:[{timestamp:string,value:number}]}]}`. The chart pairs this with `/forecast/{domain}` using the same
entity, metric and units: solid historical readings, today marker, dotted future forecast. No future
source rows are exposed; quantities sum, proportions/risks average, peak demand maximizes. Floor energy
uses floor source readings and the existing floor forecast allocation; unsupported water floors display
`No data at this level`. Weather remains dataset history plus Delhi/Open-Meteo future forecasts.

Predictive lead time is read from `facts.observations.lead_time_hours`; alerts may additionally expose
`lead_time_hours:number|null`. Notifications display confidence, needs-review and `expected in 6h`.
The existing page/widget table below defines exact empty values and fields pending Phase 4.


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


## Forecast contract after repair (2026-10-12)

All forecast requests accept `node` and `as_of` (ISO time; normalized to IST). Omitting `as_of` uses the replay cursor. `/forecast/{domain}` additionally accepts `metric` and `horizon=24h|7d`; invalid metrics/horizons return 422, unknown domains/locations return 404. Source-compatible names `timestamp,value,lower,upper` are retained.

| Endpoint | Response |
| --- | --- |
| `GET /forecast` | `{as_of,targets:[{id,domain,table,entity_key,metric,horizons,method,baseline,drivers}],data_source}`; complaints is pending. |
| `GET /forecast/{domain}` | `{domain,node,as_of,horizon,data_source,forecasts:[{entity_id,model,mae:number|null,baseline_mae:number|null,series:[{timestamp,value,lower,upper}]}]}` plus domain fields below. Every point is finite and satisfies `lower <= value <= upper`, enforced by `ForecastResponse` in `app/api/schemas.py`. |
| `GET /forecast/accuracy` | `{as_of,node,targets:[{target,domain,method,served_model,mae,baseline_mae,smape,folds,status}],data_source}`. `mae` is ML error; `baseline_mae` is the selected baseline's error. Folds also include measured `band_coverage`, `served_mae` and `served_smape`. `status` is `evaluated`, `not_evaluated` or `pending`; unmeasured errors are null. Reads persisted evaluations when no matching process cache remains. |
| `GET /forecast/risks` | `{as_of,node,risks:[{type,node,domain,predicted_time,lead_time_hours,facts}],count,data_source}`. Persists predictive candidates in alerts, deduplicated by `type|node|predicted_day`, with null level/confidence and predictive facts in `facts.observations`. |

| Domain | Metrics and units | Horizons / notes |
| --- | --- | --- |
| energy | `energy_kwh` (kWh), `peak_demand_kw` (kW) | 24h hourly or 7d daily; `floor_forecasts` use normalized current shares. Daily kWh sums activity and daily kW takes the maximum. |
| occupancy | `occupancy_count` (people) | 24h hourly or 7d daily mean; daily results are labelled seasonal. |
| water | `water_consumption_litres` (L), `tank_level_pct` (%), `days_of_water_available` (days) | 24h; water responses include campus total and individual meters. Tank points include pump state/inflow; runway uses actual stored water / forecast daily use. |
| waste | `waste_weight` (kg), `fill_percentage` (%), `diversion_rate` (0?1) | 24h; `bin_fill_pct` is a supported fill alias. Per-bin simulations include `predicted_overflow_time`. |
| mobility / parking | `vehicle_count` (movements), `parking_occupancy` (spaces), `delay_min` (minutes) | 24h; parking points alone add `parking_percent`, derived from observed capacity. |
| air | `aqi_cpcb`, `pm25`, `pm10`, `no2` | Campus zone, 24h; only AQI points have CPCB categories. |
| weather | `temperature`, `humidity`, `rainfall`, `wind_speed` | 24h hourly or 7 full future calendar days; rainfall daily sum, other daily means; synthetic climatology/persistence fallback. |
| climate | `heat_risk`, `flood_risk` (0?100) | 24h per registry zone; omitted metric returns both metrics. |
| emissions | `energy_co2e`, `mobility_co2e`, `waste_co2e`, `total_co2e` | 24h or 7d, per building, **kgCO2e**. Each point also has the four component/total fields. Missing factors give empty series with `status=missing_emission_factors`. |
| assets | `failure_risk` (0?100), `vibration` | 24h; rule scores and linear trends respectively, based on observed assets only. |
| safety | `incident_count`, `risk_index` (0?100) | Incident counts: 7 daily points, Poisson observed rates; risk index: 24 hourly darkness/rain points labelled rule. |
| sustainability | `sustainability_score` (0?100) | 7 daily points; `projection=true`, `projection_basis` explains the current persistence fallback. |
| complaints | `complaints_count` | Returns `status=pending`, `forecasts=[]`; no complaint table is accessed or changed. |

Pydantic and client types permit extra domain fields, while validating the shared series. An empty/no-history response is rendered as empty, never as successful dummy data. Method badges map `hist_gradient_boosting` to `ML`; other methods retain their actual labels. The synthetic badge follows `data_source.classification`. ML/seasonal hourly bands use measured residual buckets; daily and derived bands remain heuristic and should not be presented as a calibrated confidence percentage. The frontend includes loading, empty, error and retry states.

The earlier Phase 3 mapping remains valid for current KPIs. Its older three-domain forecast description is superseded by this section. Full forecasting acceptance gaps and measured results are recorded in STATE.md.

Saved forecast/model IDs include the horizon to keep an hourly midnight value separate from a daily total. Accuracy reports measured hourly ML target evaluations; unevaluated daily baselines do not overwrite them. Refreshes replace only matching forecast IDs and preserve points for other scopes.


## Automatic current-date replay / weather API

`REPLAY_ALIGN_TODAY=true` enables a moving dataset calendar. Source timestamps are translated uniformly so the final dataset day is today's IST date; date filters are translated back before querying. `GET /replay/calendar` returns `{today,timezone,aligned_to_today,offset_days,start,end,as_of}`. Default analytics windows use these bounds, and replay state includes `calendar_offset_days` so midnight rollover preserves the source position. Explicit historical selections query the mapped calendar, not an altered original CSV.

`WEATHER_FORECAST_ENABLED=true`, `WEATHER_LATITUDE=28.65195`, `WEATHER_LONGITUDE=77.23149` configure Delhi/Open-Meteo. For a current or future replay cutoff with API coverage, `/forecast/weather` returns `model=weather_api`, `data_source={mode:weather_forecast,classification:api_weather_forecast,provider:open-meteo,location:Delhi}`. `as_of` is the actual API retrieval/issuance time and `data_cutoff` is the requested dataset cutoff. Seven-day responses contain seven complete future days; rainfall sums hourly amounts while temperature/humidity/wind use daily means. Wind is requested in m/s. The cached API response is never used for a replay before its retrieval window; historical or unavailable coverage falls back to the dataset with the existing synthetic classification. API timestamps and source status are not labelled as measured campus data.

Operational forecasts continue using dataset-only inputs. Current-date defaults use the current hour/time rather than a future 23:00 snapshot, and calendar month/year boundaries use IST. Existing source rows, operational action/decision/complaint tables and protected engine logic are unchanged.

Provider contract: https://open-meteo.com/en/docs . Attribution appears beside the weather forecast.
