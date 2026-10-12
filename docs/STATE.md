# Current-date replay and Delhi weather (2026-10-12)

The user requested automatic current-date replay, operational forecasts from the dataset, and weather forecasts from an API for Delhi. This supersedes the fixed 9 October default and the requirement to anticipate that particular historical storm/pickup event in the current view.

- `REPLAY_ALIGN_TODAY=true` maps the dataset's final calendar day to the current IST date, and translates all source query bounds and returned date/time columns by the same offset. Original CSVs and stored source readings remain intact. On 12 October, the displayed range is 20 August?12 October; tomorrow it advances automatically. Query filtering happens in the source calendar before timestamps are mapped, so unreplayed hours remain excluded.
- API replay state and stream bounds follow the calendar without changing protected engine/decision/action implementations. Dataset closure dates follow the same mapping. Model cache keys and persisted accuracy include the offset, preventing an older calendar's model from being reused after midnight.
- The frontend defaults to today/current time, updates its clock every minute, advances its default date across midnight, generates recent date choices dynamically, and computes month/year boundaries in IST. Manual historical date selections remain available. Real mode uses neutral `Dataset replay` wording rather than a fabricated live-node count.
- Delhi's coordinates were resolved through Open-Meteo (28.65195, 77.23149). The weather widget uses its forecast API for temperature, humidity, rainfall and wind in m/s, with 24 hourly or seven complete daily points, a 15-minute cache, five-second timeout and provider attribution. Actual retrieval/issue time is returned separately from the dataset cutoff. Past replay times cannot use a forecast fetched later; they retain the dataset fallback. Operational ML/climate/safety inputs remain dataset-based, as requested.
- The four non-secret settings were configured in the local ignored `.env` and documented in `.env.example`. Existing credentials were preserved.

Validation: 68 backend tests passed, plus three Node date tests; production build passes. Live public Delhi forecast retrieval succeeded. Local HTTP smoke: `/forecast/weather` returned HTTP 200 with `weather_api` and 24 hourly / seven daily points; `/energy` returned HTTP 200 with today's timestamps and no unreplayed future hours. No production source-table rewrites or protected action/decision table migrations were performed.

Restart the API/frontend when running without automatic reload so the updated environment and source modules are loaded. The earlier audit and full-phase limitations remain below as historical context.

# Forecasting repair audit (2026-10-12)

The interrupted work was preserved in commit `c65caa3` (`wip: interrupted phase 3`). The repair does not change decision, engine, agent, action, decision-log, or complaint implementations. The existing snapshot change was preserved in that safety commit.

## Verified corrections

- Reinstalled the locked frontend dependencies. The initial build failure was a missing `braces/lib/compile` module; the production build now passes without changing the dependency versions.
- Separated exact issue-time/location/metric response caching from campus-wide daily model caching. Cache keys include the database bind and model class; cached responses are copied before domain-specific decoration. Daily training ends at midnight, so an earlier replay request cannot reuse a model trained on later hours. Persisted records distinguish 24h/7d horizons, and a scoped refresh cannot delete another location's forecast points. Bounded caches limit retained models and responses.
- Train/evaluate every entity rather than only the first ten. The catalogue now registers 31 active targets and one pending complaints target, including individual air pollutants, weather metrics, emission components, water runway, and the hourly safety index.
- Removed the production branch that fabricated forecast values when tests monkeypatched training. The retraining test now observes the real backtest call.
- Removed invented accuracy numbers and fixed band coverage. Baseline ties do not qualify as a 3% ML improvement. Bands use residuals from the served model; coverage is calculated from held-out predictions. Measured evaluations are persisted and can be read after clearing the process cache. Missing evaluations are explicitly `not_evaluated` with null errors.
- Daily energy/occupancy use a labelled seasonal baseline over completed historical calendar days. Peak demand is a maximum, rather than a sum of hourly kW. Floor shares are normalized and the hourly/daily floor forecasts sum to the building series.
- Tank capacities, current volumes, and pump states come from source records; no synthetic starting state is invented. The pump consumes water, starts below 40%, refills at capacity/6 per hour, and stops at 85%. Runway uses current stored volume, rather than total tank capacity.
- Bin simulation follows 06:00, 12:00, and 18:00 pickups and clips observed fill at 100%; historical checks include observed delayed collections. Future simulations assume scheduled pickups, without reading future collection rows. Diversion uses registry bin types, not bin-name guesses. Parking capacities come from observed gate rows.
- Heat-index threshold and heat/flood formulas were recovered from the source columns and verified against every historical weather/climate row. Climate forecasts are per registry zone and carry the five observed rain hours into each future six-hour window.
- Emissions use registry factors and forecast energy, vehicles, and waste, in source units of kgCO2e. Mobility is allocated using historical building shares; each total equals its component sum. Missing factors return an empty result instead of invented factors.
- Asset rules use observed load divided by rated capacity, past downtime, the registry's actual last service date and maintenance interval, and a time-based vibration trend. Lowercase pump/chiller types are included. Safety uses registered area IDs and observed daily Poisson rates.
- Sustainability no longer starts at a fixed 78.4 or invents a 0.3-point daily improvement. It returns a labelled persistence projection of the latest observed score using the existing score calculation.
- Real-mode forecast charts use the shared API widget, with method/source badges, bands, entity/metric selection, and loading/empty/error/retry states. Mock curves remain behind `VITE_USE_MOCK=true`. Overview and Energy use predictive risk results; Insights has a refreshable accuracy table. Emissions are presented on Energy because this checkout has no separate Emissions page.

## Remaining acceptance gaps (full forecasting is not marked complete)

- Sustainability still holds the latest observed score; applying the generator's KPI-to-score component formulas to predicted daily KPIs remains unimplemented. Those component formulas are not present in this checkout.
- The seven-day energy/occupancy forecasts are seasonal baselines, not seven-day direct ML models. Daily baseline and formula/rule/simulation uncertainty bands have not been independently calibrated/backtested.
- A replay from 2026-10-08 12:00 IST did not predict the specified 9 October heavy-rain readiness event or the North Dining `Mess_F1_B4` overflow. Climatology/persistence cannot know an unprecedented future storm or an unannounced missed pickup; future source rows must remain excluded. These story acceptance checks remain open.
- Full browser rendering, interaction and console smoke checks remain unverified because no browser automation tool is available in this session. Production compilation and real endpoint contract checks pass.
- Measured local full refresh: 29.82 seconds; cached risk calculation: 0.21 seconds. This is not a benchmark of the protected Phase 3 replay/decision/action pipeline.
- Existing lint warnings and the large JavaScript bundle warning remain. An npm audit found seven transitive development dependency advisories (five high, two moderate); fixing all requires a major Tailwind migration according to npm. This repair retains the existing design/dependency versions.

The historical Phase 3 audit below is retained as the pre-change record.

# Phase 3 audit: code and storage as found

Audited 2026-10-12 from `app/api/routes.py`, `app/db.py`, `app/engine/{pipeline,replay}.py`, the CSV-derived SQLAlchemy metadata, and a read-only inspection of the live Neon catalog. The React frontend is at the repository root (`src/`), not a separate `<path>`.

## Existing HTTP contract

All regular analytics routes accept `node` (default `F01`), `start` (default 2026-08-17 00:00 IST), `end` (default 2026-10-09 23:00 IST), and `as_of` (default current IST time). They return `window: {node,start,end,as_of}` and `data_source`. The `end < start` case returns 422; unknown nodes return 404 on data routes.

| Route | Existing response fields beyond `window`, `data_source` |
| --- | --- |
| `GET /health` | `status`, `database: {status}`, `jev: {status}` |
| `GET /sector` | `sector`, `active`, `version` |
| `GET /sector/config` | `config` (raw sector YAML object) |
| `GET /locations` | `locations: [{node_id,level,parent_id,label,zone_id,building_id,floor_id,sort_order,data_source}]` |
| `GET /overview` | `kpis: {sustainability_score,energy_kwh,water_consumption_litres,waste_weight,open_incidents,energy_signal_count}` |
| `GET /energy` | `kpis: {energy_kwh,peak_demand_kw,grid_import_kwh,solar_generation_kwh,estimated_grid_co2e,estimated_cost_inr}`, `series: [{timestamp,energy_kwh,grid_import_kwh,solar_generation_kwh}]` |
| `GET /water` | `kpis: {water_consumption_litres,water_consumption_kl,flow_lpm_mean,leak_count,estimated_cost_inr,days_of_water_available,water_stress_mean}`, `series: [{timestamp,water_consumption_litres,flow_lpm}]` |
| `GET /waste` | `kpis: {waste_weight,mean_fill_percentage,overflow_count,collection_delay_count,weighted_diversion_rate}`, `series: [{timestamp,waste_weight,overflow_event}]` |
| `GET /air` | `kpis: {aqi_cpcb_mean,pm25_mean,pm10_mean,dominant_pollutant}`, `series: [{timestamp,aqi_cpcb,pm25,pm10}]` |
| `GET /assets` | `kpis: {utilisation_mean,availability_mean,downtime_hours,maintenance_due,failed_count,vibration_mean}`, `series: [{timestamp,downtime_hours,operating_hours}]` |
| `GET /mobility` | `kpis: {vehicle_count,mean_delay_min,parking_occupancy,parking_capacity,parking_occupancy_ratio}`, `series: [{timestamp,vehicle_count,parking_occupancy,parking_capacity}]` |
| `GET /safety` | `kpis: {incident_count,high_severity_count,response_time_mean,open_count}`, `incidents: [source rows]` |
| `GET /climate` | `kpis: {heat_risk_mean,flood_risk_mean,heavy_rain_readiness_mean,power_resilience_mean,climate_readiness_score_mean,rainfall_total_mm}`, `series: [{timestamp,heat_risk,flood_risk,climate_readiness_score}]` |
| `GET /sustainability` | `kpis: {sustainability_score,energy_score,water_score,waste_score,air_score,mobility_score,assets_score,safety_score,emissions_score}`, `series: [{date,energy_score,water_score,waste_score,air_score,mobility_score,assets_score,safety_score,emissions_score}]` |
| `GET /emissions` | `kpis: {energy_co2e,mobility_co2e,waste_co2e,total_co2e}`, `series: [{timestamp,energy_co2e,mobility_co2e,waste_co2e,total_co2e}]` |
| `GET /insights` | `anomaly_count`, `energy_signals: [source rows]`, `event_flags: {water_leaks,waste_overflows,delayed_collections}` |
| `GET /forecast/{energy\|water\|parking}` | `domain,node,as_of,data_source,forecasts: [{entity_id,model,mae,baseline_mae,series:[{timestamp,value,lower,upper}]}]`; single-entity responses also expose `model,mae,baseline_mae,series` at top level |
| `GET /replay/state` | `running,speed,cursor,last_processed_at,node` |
| `POST /replay/start` | optional `{as_of,speed,node}`; returns replay state |
| `POST /replay/pause` | returns replay state |
| `POST /replay/seek` | required `{as_of}`; returns replay state |
| `POST /replay/speed` | required `{speed}`; returns replay state |
| `GET /alerts` | query `since,as_of,node`; response `{as_of,alerts:[{alert_key,alert_id,created_at,node,domain,type,level,status,confidence,facts}],data_source}` |
| `GET /stream` | query `node,as_of,limit`; SSE `tick` events containing `{as_of,ticks:[{as_of,records,new_alerts}],new_alerts}` |

`GET /overview` currently supplies a KPI object only. The frontend currently fetches one nonexistent `/api/sustainability-snapshot` route in its disabled live branch and otherwise uses the single mock object in `src/services/api.js`.

## Operational tables as found

| Table | Columns |
| --- | --- |
| `alerts` | `alert_id` PK, `alert_key` unique, `created_at`, `node_id`, `domain`, `type`, `level`, `status`, `confidence`, `facts` JSON, legacy `severity`, `payload` |
| `actions` | `action_id` PK, `created_at`, `node_id`, `status`, `payload` text |
| `decision_log` | `decision_id` PK, `created_at`, `provider`, `payload` text |
| `replay_state` | `state_id` PK, `as_of`, `payload` text |
| `copilot_log` | `log_id` PK, `created_at`, `payload` text |
| `weekly_summaries` | `summary_id` PK, `week_start`, `node_id`, `payload` text |
| `complaints` | `complaint_id` PK, `created_at`, `node_id`, `status`, `payload` text |
| `knowledge_chunks` | `chunk_id` PK, `sector`, `document_id`, `content`, `metadata_json` text |

`facility`, `zone`, `building`, `floor`, `asset`, and `sensor` are separate master tables. The 29 source-domain tables are generated from the CSV headers; their exact current column lists appear below.

## Differences from the prior CONTEXT.md

- The current pipeline stops at persisted candidates. It has no Jev calls, routing, action generation, snapshot builder, or decision queue.
- `/health` treats Jev as configured only if all of `JEV_API_KEY`, `JEV_BASE_URL`, and `JEV_MODEL` are set. The user's environment supplies only the key.
- `actions` and `decision_log` use generic text payload columns, not dedicated Phase 3 decision/action fields. These can be mapped without replacing source-domain tables.
- Only analytics routes share the full `node/start/end/as_of` query convention. Forecast accepts `node/as_of`; alerts accepts `node/since/as_of`; stream accepts `node/as_of/limit`; replay controls use JSON bodies.
- The frontend is React/Vite in this repository, with JavaScript mock data and a disabled fetch branch aimed at a route the backend does not expose.
- The live Neon catalog reports `TIMESTAMP` without time zone for the timestamp columns, despite `DateTime(timezone=True)` in the SQLAlchemy metadata. This needs a dedicated migration; Phase 3 should keep explicit IST offsets at the API boundary.
- The live `sustainability.energy_score`, `assets_score`, and `safety_score` columns are numeric, while the CSV-based model infers `sustainability_score` and `climate_score` as text. API serialization must parse those scores.
- `docs/PROGRESS.md` originally labeled Phase 3 as retrieval/applicability and Phase 5 as actions/replay; the active user request defines Phase 3 as frontend connection plus Jev decisions and actions.

## Forecasting Audit and Baseline State (2026-10-12)

Existing forecasts implemented in Phase 2 (`app/analytics/forecast.py`):
- `energy`: Building-level `energy_kwh` using separate `HistGradientBoostingRegressor` per building if training rows >= 100, else fallback to `seasonal` (`lag_168`). 24-hour hourly horizon only.
- `water`: Facility-level `water_consumption_litres` (`water_hourly`) using a single `HistGradientBoostingRegressor` or `seasonal`. 24-hour hourly horizon.
- `parking`: Gate-level `parking_occupancy` (`traffic_parking`) using separate `HistGradientBoostingRegressor` per gate or `seasonal`. 24-hour hourly horizon.
- Baseline: Evaluated against single baseline `lag_168` on a 7-day test split. No multi-fold rolling origin backtest, no zero-guarded sMAPE, no band coverage validation.
- Missing tables: `forecast_models`, `forecasts`, `forecast_accuracy`.
- Missing endpoints: `GET /forecast`, `GET /forecast/accuracy`, `GET /forecast/risks`, multi-metric / multi-horizon `GET /forecast/{domain}`.
- Missing targets:
  - Energy: `peak_demand_kw` per building; floor-level forecasts (`building forecast * current floor share`); 7d daily horizon.
  - Occupancy: `occupancy_count` per building (feeds downstream energy/water/traffic models); 24h hourly and 7d daily.
  - Water: `water_consumption_litres` per meter (15 meters) + campus sum; tank level simulation (`tank_level_pct` with 40%/85% pump rule) and `days_of_water_available`.
  - Waste: `waste_weight` per bin (57 bins ML); fill % simulation with 06:00, 12:00, 18:00 pickups; `predicted_overflow_time`; `diversion_rate`.
  - Traffic: `vehicle_count`, `delay_min` per gate; parking % = occupancy / capacity.
  - Air: `aqi_cpcb`, `pm25`, `pm10`, `no2` on Campus zone; wind speed and rainfall features; CPCB bands.
  - Weather: `temperature`, `humidity`, `rainfall`, `wind_speed` via climatology blended with persistence; labeled `data_source = synthetic`.
  - Climate: `heat_risk` and `flood_risk` per zone from generator formulas on forecast weather.
  - Emissions: `energy_co2e`, `mobility_co2e`, `waste_co2e`, `total_co2e` per building and daily via emission factors.
  - Assets: Next-24h failure risk per asset (0-100) via rule score; vibration linear trend forecast for HVAC, pump, chiller.
  - Safety: Daily incident count per area (7 days) via Poisson loss / baseline; hourly risk index from darkness and rain.
  - Sustainability: Projected 7-day daily sustainability score using score formulas.
  - Complaints: `complaints_daily` registered as pending target.

## Phase 3 additions after this audit

`GET /dashboard` now returns the frontend mapping in `docs/API_CONTRACT.md`; `GET /decisions/queue` returns `{as_of,items,count,data_source}`; `GET /actions` returns `{as_of,actions,data_source}`; and `PATCH /actions/{id}` accepts `{status}` with `X-Role`. The live Neon migration added `alert_key,type,text,saving_inr,saving_co2e,priority,owner,needs_head_approval,source` to `actions`, and `point,state_hash,label,confidence,status,model` to `decision_log`. Existing payload columns and rows were retained.

## CSV-derived table columns

The appendix is generated from the table definitions in `app/db.py` and the source CSV headers in `datasets/`.

### Domain tables

- air_environment: timestamp, facility_id, zone_id, pm25, pm10, no2, so2, co, o3, nh3, no, co2, temperature, humidity, wind_speed, wind_direction, aqi_cpcb, aqi_category, dominant_pollutant, data_source
- assets_equipment: timestamp, asset_id, facility_id, zone_id, building_id, floor_id, asset_type, rated_capacity, available_capacity, operating_hours, available_hours, idle_hours, downtime_hours, utilisation, availability, load, status, maintenance_date, maintenance_type, maintenance_status, mtbf, mttr, vibration, telemetry_gap, data_source
- campus_operations: timestamp, facility_id, classroom_capacity, classroom_occupied, classroom_utilisation, lab_capacity, lab_occupied, lab_utilisation, hostel_capacity, hostel_occupied, hostel_utilisation, campus_parking_capacity, campus_parking_occupied, data_source
- climate_resilience: timestamp, facility_id, zone_id, temperature, humidity, wind_speed, rainfall, heat_risk, flood_risk, heavy_rain_readiness, water_stress, power_resilience, asset_climate_risk, drainage_capacity, low_lying_flag, elevation, building_exposure, asset_criticality, backup_power, climate_readiness_score, data_source
- emissions: timestamp, facility_id, zone_id, building_id, floor_id, energy_co2e, mobility_co2e, waste_co2e, total_co2e, energy_emission_factor, vehicle_emission_factor, waste_emission_factor, factor_version, data_source
- energy_building_hourly: timestamp, facility_id, zone_id, building_id, energy_kwh, peak_demand_kw, hvac_status, solar_generation_kwh, grid_import_kwh, fuel_consumption_l, backup_kw, imputed_flag, temperature, humidity, data_source, source_dataset
- energy_floor_hourly: timestamp, facility_id, zone_id, building_id, floor_id, energy_kwh, peak_demand_kw, occupancy, hvac_status, equipment_load, operating_hours, grid_import_kwh, solar_generation_kwh, fuel_consumption_l, temperature, humidity, data_source, allocation_method
- inspections: inspection_id, week, due, area_id, status, data_source
- location_dim: node_id, level, parent_id, label, zone_id, building_id, floor_id, sort_order, data_source
- occupancy_floor_hourly: timestamp, facility_id, zone_id, building_id, floor_id, floor_no, floor_use, occupancy_count, floor_utilisation, data_source, allocation_method
- occupancy_hourly: timestamp, facility_id, zone_id, building_id, occupancy_count, utilisation, data_source, allocation_method
- registry_assets: asset_id, asset_type, facility_id, zone_id, building_id, floor_id, rated_capacity_kw, maintenance_interval_days, last_service_date, data_source
- registry_bins: facility_id, zone_id, building_id, floor_id, bin_id, bin_type, x_m, y_m, collection_frequency, data_source, capacity_kg
- registry_buildings: facility_id, zone_id, building_id, building_label, floor_count, total_area_m2, total_capacity_people, data_source
- registry_emission_factors: factor_name, value, unit, factor_version, note, data_source
- registry_floors: facility_id, zone_id, building_id, floor_id, floor_no, floor_label, floor_use, area_m2, capacity_people, cooled_area_share, bin_count, occupancy_weight_profile, data_source
- registry_meters: facility_id, zone_id, building_id, meter_id, meter_label, water_source, data_source
- registry_outdoor_areas: facility_id, zone_id, area_id, location, area_weight, data_source
- registry_tanks: facility_id, tank_id, tank_capacity_kl, data_source
- registry_zones_climate: facility_id, zone_id, elevation_m, drainage_capacity, low_lying_flag, building_exposure, asset_criticality, backup_power_hours, data_source
- safety_incidents: incident_id, timestamp, facility_id, zone_id, area_id, location, incident_type, severity, department, response_time, description, data_source, status, classified_type, classified_severity, classification_confidence, asset_id
- signals_energy: signal_id, timestamp_start, timestamp_end, building_id, excess_pct, z_score, method, baseline_window, confidence, data_source
- sustainability: date, facility_id, energy_score, water_score, waste_score, air_score, mobility_score, assets_score, safety_score, climate_score, emissions_score, sustainability_score, data_source
- traffic_parking: timestamp, facility_id, zone_id, road_id, gate_id, vehicle_count, car_count, bike_count, bus_count, truck_count, avg_speed, traffic_density, parking_capacity, parking_occupancy, entry_count, exit_count, delay_min, data_source
- waste_hourly: timestamp, facility_id, zone_id, building_id, floor_id, bin_id, bin_type, fill_percentage, waste_weight, fill_rate, predicted_overflow_time, collection_time, last_collection_time, collection_frequency, x_m, y_m, overflow_event, collection_delayed, data_source, diversion_rate
- water_hourly: timestamp, facility_id, zone_id, building_id, meter_id, flow_lpm, water_consumption_litres, line_pressure, occupancy, water_source, rainfall, leak_flag, data_source
- water_resources: timestamp, facility_id, zone_id, required_water_kl_per_day, available_water_kl, days_of_water_available, water_stress, water_recycled_l, freshwater_dependency, data_source
- water_tank_levels: timestamp, facility_id, zone_id, tank_id, tank_capacity_kl, tank_level, tank_level_pct, pump_inflow_kl, pump_on, data_source
- weather: timestamp, facility_id, zone_id, temperature, humidity, wind_speed, wind_direction, rainfall, rainfall_6h_total, heat_index, heat_risk, data_source, source_dataset

### Master tables

- facility: facility_id, name, sector
- zone: zone_id, facility_id, label
- building: building_id, facility_id, zone_id, label
- floor: floor_id, building_id, facility_id, zone_id, floor_use
- asset: asset_id, asset_type, facility_id, zone_id, building_id, floor_id
- sensor: sensor_id, sensor_type, facility_id, zone_id, building_id, floor_id, source_id
