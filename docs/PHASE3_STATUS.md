# Phase 3 resumed audit — 12 October 2026 (IST)

Active frontend: `C:/Users/HP/Desktop/sustainability-dashboard/src/`.
Backend and existing Git history: `C:/Users/HP/Desktop/sustainability-dashboard-old/`.
The frontend currently has no Git repository; the backend has uncommitted welcome/mind-tree work.
Preserve those files. No truncated modules found; backend tests and frontend build import successfully.

## Initial validation

- Backend suite: **68 passed**, 149 seconds; mocked decisions, isolated test databases.
- Frontend production build: **PASS**. Bundle size warning remains.
- Running frontend/backend: **PASS**, localhost:5173 and localhost:8000. Dataset dashboard, 42 locations, Delhi weather API populated.
- Live Neon information_schema: **PASS**, 63 columns across audited operational/forecast tables; read-only.
- Local SQLite schema: decision/action columns exist; alerts level/confidence/facts confirmed. No migrations executed.
- Schema evidence: `verification/phase3-schema.json` (metadata only).
- Official Jev API/model docs: reachable, read at https://docs.typesafe.ai/api and https://docs.typesafe.ai/models.
- Forecast registry/accuracy/risks exist. Forecast acceptance limitations remain documented; do not rebuild forecasting here.

## Item status

| Item | Status | Existing implementation / remaining work |
| --- | --- | --- |
| A1 State documentation | DONE | Active two-folder setup, schema audit, test results and gaps documented; historical audits retained. |
| A2 Context documentation | DONE | Actual frontend/backend paths and starter recorded; stale coverage claims explicitly superseded. |
| B1 Widget JSON contracts | DONE | Active widget fields/units, history, stable node controls and pending Phase 4 values documented. |
| B2 Mapping layer and shaped pending values | DONE | app/api/schemas.py maps dashboard fields without source-table changes. |
| B3 CORS and typed client/mock flag | DONE | Backend FRONTEND_ORIGIN; one client.ts; mock API retained, default false; local Vite proxy. |
| B4 API-connected analytics pages | DONE | All 12 pages passed real Chromium checks without console errors; Actions now uses the existing backend workflow. |
| B5 Locations API and 42-node count | DONE | Running API returns 42; hierarchy/count distribution must be asserted individually. |
| B6 Searchable indented location tree | DONE | 42 unique IDs, searchable hierarchy and every selection verified in Chromium; source rows unchanged. |
| B7 No data at selected level | DONE | Regression and browser tests verify floor water displays No data at this level; energy uses matching floor history/allocation. |
| B8 Date/range and replay controls | DONE | Dynamic IST date/period window and start/pause/seek/speed controls connected; detailed replay browser test follows. |
| B9 SSE bell/popup/reconnect | DONE | EventSource tick, popup, reconnect and alerts-since catch-up implemented; isolated streaming test follows. |
| B10 Shared score/counts | DONE | Header and overview read the same backend score/counts; bell filters active alert statuses. |
| C1 Official Jev contract | DONE | Official API/model pages reachable; existing transport shape matches documented primitives. |
| C2 Decision YAML catalogue | DONE | All requested points retain names/questions/options/state_fields and now include explicit act/review thresholds; copilot.scope is yes/no. |
| C3 Jev transport | DONE | Official pinned model, timeout/retries/batching retained; answer types/probabilities/model validated, copies and locked cache protect repeated/concurrent requests. |
| C4 Rules matching interface | DONE | Each rules answer type matches its catalogue primitive; conservative copilot yes/no fallback tested. |
| C5 Router/error/shadow/log/health | DONE | Existing both error modes and shadow tests pass; malformed replies log null label/confidence and route to review; health retains configured/provider status. |
| D1 Snapshot for all active domains | DONE | Pipeline uses build_snapshot with all 10 active domains, existing forecasts, candidates/hotspots, weather, operations and open alerts. |
| D2 Triage/level/complexity gates | DONE | High-confidence non-issues drop; intermediate confidence reviews; low-confidence Critical alerts retained for review; repeated processing is deduplicated. |
| D3 Predictive candidate routing/lead time | DONE | Stored literal predicted_ candidates route through the same decisions; future-issued rows excluded; lead time preserved and exposed. |
| D4 Predicted-to-real replacement/history | DONE | Same node/type within one hour of expected event reconciles in place; stable alert_id, history and relinked action persist; SSE deduplicates identities. |
| D5 Sector actions/formula savings/ownership | DONE | Catalogue actions use numeric formulas only; CO2 uses observed grid share, water tariff converts litres to kL; unknown assignments cause review and no invented labels. |
| D6 Ordered actions/PATCH/head gate | DONE | Existing endpoint and persistence test; validate restart and full status progression. |
| D7 Decision queue/action/review UI | DONE | Backend action/decision queue restored in the existing design; confidence/review/lead-time display and head-gated status controls connected. |
| D8 Decision evaluation report | DONE | Per-point agreement/proxy Brier/calibration bins implemented and tested; active report has no paired live records and explicitly marks all live metrics not_evaluated. |
| T1 Decision columns | DONE | Regression asserts five routing/assignment points persisted and owner/priority/source columns match typed decisions. |
| T2 Timeout both modes / shadow / cache | DONE | Existing mocked tests pass; extend malformed response and catalogue consistency tests. |
| T3 Story timing/no future alerts | DONE | Existing Phase 2 story regression tests pass; rerun after pipeline changes. |
| T4 Status order/head gate/restart | DONE | File-backed database engine recreated after PATCH; status persists and every step/head gate is enforced. |
| T5 Pipeline twice / predictive replacement | DONE | Normal and predictive replay dedupe, same-hour newly stored predictions, future exclusion, replacement history and one-action preservation tested. |
| T6 Every location selectable | DONE | Browser verified all 42 IDs selected and sent in successful dashboard requests; search and floor empty-state checks pass. |
| T7 Every frontend endpoint shape | PARTIAL | Expanded live contract script written; final rerun required after local pool exhaustion fix. |
| T8 Browser pages/console errors | PARTIAL | Initial 3 Chromium tests passed; extended six-test rerun failed during pool exhaustion and must pass after correction. |

Uncommitted backend files: `src/components/LivingYggdrasil.jsx`, `src/context/DashboardContext.jsx`,
`src/journey.css`, `src/pages/WelcomeJourney.jsx`; untracked `KnowledgeBase3D.jsx`, `services/sound.js`.
Initial diff: 4 tracked files, 2,886 insertions, 774 deletions. These are user design edits, not partial backend modules.

## Runtime regression and scope exceptions

A full mixed run reached 85 passing tests, with one environment error because pytest could not
access the default HP temp directory. scripts/test-backend.ps1 now creates a unique checked
workspace temp directory. Final rerun is in progress.

Parallel cold model/browser/build work exhausted the local SQLite pool (5 + 2 connections,
15-second queue timeout), producing HTTP 500. app/db.py now uses 16 + 8 / 30 seconds for
SQLite only; PostgreSQL pooling remains unchanged. Automatic refresh does not overlap pending
dashboard loads. This Phase 1 database helper change is justified by the observed failing HTTP
contract/browser checks. No source tables or rows are changed. Repository location/floor fixes
were likewise justified by the two initially failing scope tests. Forecasting code is unchanged.

The backend's original welcome/mind-tree edits remain uncommitted and untouched by this resume.
