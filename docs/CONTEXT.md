RESUMED WORKSPACE (2026-10-12): The active React frontend is C:/Users/HP/Desktop/sustainability-dashboard/src/.
The backend, source tables, tests and original Git history are in ../sustainability-dashboard-old/.
Start the existing backend through scripts/start-backend.ps1; it adds read-only /history/{domain}
for the combined charts and uses the existing local SQLite database. Neon remains configured in
the backend environment and was audited read-only. Keep the new welcome/mind-tree design.
PHASE3_STATUS.md supersedes older coverage claims. Initial tests pass, but active frontend
replay/SSE/action/tree controls and predictive decision-pipeline integration still need completion.

FLOW: Source data -> Adapters -> Clean/Validate -> Normalise -> Common Backbone -> Sector Config -> Domain Analytics ->
Facility Intelligence Engine -> Router -> Rule Path OR Agentic Path (RAG, Applicability, Simulation, Compare, Explain) -> Action.
Historical data is replayed as a sensor-style stream ("Real-Time Historical Data Replay", never "live IoT"). No manual value entry.
Domains stay separate tables, no universal table. Weather is one location-level layer. Agent only sees normalised analytical output.
Sector config (college active, hospital stub) changes KPIs, thresholds, tools, actions, docs. Controller is the same for all.

ENGINES: A rules/formulas (detect, rollup, simulate, savings, CO2e, scores). B gradient boosting (numeric forecasts only).
C JEV (decisions only: choice, score, yes/no with probabilities; never writes text, never calculates). D Groq (wording and tool
orchestration only, from given numbers; never decides). Numbers from A/B, decisions from C, words from D.

DB: Neon Postgres. DATABASE_URL = pooled (API runtime). DATABASE_URL_DIRECT = direct (schema, migrations, bulk load only).
TEST_DATABASE_URL = separate branch for tests. sslmode=require, pool_pre_ping=True, short pool_recycle, retry first connect after
idle (compute suspends). The current live database reports TIMESTAMP without time zone even where SQLAlchemy declares timezone=True;
API/replay inputs and outputs use explicit IST offsets. A future migration should reconcile stored types. Bound parameters only. Keep DB under 400 MB.
ENV: DATA_DIR=generated_v3, TZ=Asia/Kolkata, SECTOR=college, TARIFF_INR_PER_KWH=8, GRID_EF=0.716, WATER_TARIFF_INR_PER_KL=40,
GROQ_API_KEY, GROQ_MODEL, JEV_API_KEY, optional JEV_BASE_URL override (default official TypeSafe endpoint), JEV_MODEL is pinned
in code to jev-1.13.0 (never an alias), FRONTEND_ORIGIN=http://localhost:5173, DECISION_PROVIDER=jev (jev|rules|shadow),
DECISION_ON_ERROR=needs_review (needs_review|rules).

DATA (table = file stem; hourly files have timestamp IST, facility_id F01, zone_id):
energy_building_hourly: building_id, energy_kwh, peak_demand_kw, hvac_status, solar_generation_kwh, grid_import_kwh, fuel_consumption_l, imputed_flag
energy_floor_hourly: building_id, floor_id, energy_kwh, occupancy, hvac_status, equipment_load, grid_import_kwh
occupancy_hourly: building_id, occupancy_count, utilisation | occupancy_floor_hourly: floor_id, floor_use, occupancy_count, floor_utilisation
water_hourly: meter_id, building_id, flow_lpm, water_consumption_litres, line_pressure, leak_flag
water_tank_levels: tank_id, tank_level, tank_level_pct, pump_on | water_resources: days_of_water_available, water_stress
waste_hourly: bin_id, bin_type, building_id, floor_id, fill_percentage, waste_weight, fill_rate, predicted_overflow_time, overflow_event, collection_delayed, diversion_rate
traffic_parking: zone_id (West/Main/East), gate_id, vehicle_count, traffic_density, delay_min, parking_capacity, parking_occupancy
assets_equipment: asset_id, asset_type, floor_id, utilisation, availability, downtime_hours, status, maintenance_status, mtbf, mttr, vibration
climate_resilience: zone_id, heat_risk, flood_risk, heavy_rain_readiness, power_resilience, climate_readiness_score
air_environment: zone_id (Regional/Campus), pm25, pm10, no2, so2, co, o3, nh3, co2, aqi_cpcb, aqi_category, dominant_pollutant
emissions: floor_id, energy_co2e, mobility_co2e, waste_co2e, total_co2e | weather: temperature, humidity, wind_speed, rainfall, heat_index
safety_incidents: incident_id, timestamp, area_id, location, incident_type, severity, department, response_time, status, description
signals_energy, inspections, campus_operations (sector table), sustainability (daily, key "date", *_score + sustainability_score)
registries: registry_buildings/floors/meters (M03 = "Hall C")/tanks/bins/assets/outdoor_areas/zones_climate/emission_factors
location_dim: node_id, level (facility, zone, building, floor, area), parent_id, label
Only building power is measured, the rest is synthetic. Every response carries data_source. Out of scope: camera/CV, image, PPE, GIS.

RULES: rollups SUM parts then derive ratios, never average averages. Parking ratio = parking_occupancy / parking_capacity. Analytics
endpoints take node, start, end, as_of; forecast takes node/as_of, alerts takes node/since/as_of, stream takes node/as_of/limit, and
replay controls use JSON bodies. Window 2026-08-17 00:00 to 2026-10-09 23:00 IST, queries see timestamp <= as_of only. One
source of truth for scores and counts. STORY EVENTS: 2026-10-07 02-04h Academic overnight HVAC (+18%); 2026-10-09 01-03h meter M03
leak; North Dining overflow; North Walk (N2) incidents; 2026-10-09 evening heavy rain; no low-occupancy alert on 2026-10-02 holiday.
At the start of Phase 3, the pipeline persisted candidates in `alerts` with null level/confidence and actions/decision logs were generic
payload tables. Phase 3 added Jev routing and additive action/decision columns, plus a `/dashboard` mapping layer. The frontend is the
React/Vite app in this repository (`src/`); demo data is now behind `VITE_USE_MOCK=true`. `docs/STATE.md` records the pre-change audit.
The active Phase 3 request covers frontend connection, Jev decisions, and actions; it supersedes the older phase labels in PROGRESS.md.
Work only on the current phase. Finish each phase by running its tests and printing a pass/fail table.


CURRENT-DATE REPLAY (2026-10-12): REPLAY_ALIGN_TODAY=true moves the final dataset day to today's IST date at query time, preserving the source files and values. API/date-picker/replay bounds roll forward automatically. Historical reference tests keep the original calendar. Operational forecasts use only dataset inputs; the weather widget uses Delhi Open-Meteo forecasts (WEATHER_FORECAST_ENABLED, WEATHER_LATITUDE, WEATHER_LONGITUDE), with an explicit dataset fallback for past issue times or API failure. Protected engine/decision/action code is unchanged. See API_CONTRACT.md for moving calendar and issuance metadata.
