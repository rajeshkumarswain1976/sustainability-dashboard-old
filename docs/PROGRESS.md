# Backend implementation progress

- [x] Phase 1 — foundation, ingestion, database schema, sector configuration, analytics endpoints, and tests
- [x] Phase 2 — domain candidate detectors, numeric forecasts, alert storage, replay controls, and SSE stream
- [x] Phase 3 — frontend connection, Jev decision layer, actions, and evaluation (89 backend tests, 10 browser tests, live API contracts passed)
- [ ] Phase 4 — simulation, comparison, and explanation
- [ ] Phase 5 — actions, replay controls, and operational hardening

Phase 1 is implemented in the current branch of work. Phase 2 is complete: 14 Phase 2 tests passed against an isolated SQLite database populated from the source CSVs. The Neon alert schema and unique alert key were verified read-only. Neon-backed integration tests require a separate `TEST_DATABASE_URL`.

## Phase 3 status (2026-10-12)

The pre-change code and Neon catalog audit is in `docs/STATE.md`; `docs/CONTEXT.md` now records the actual timestamp types, endpoint parameter conventions, and frontend path. `docs/API_CONTRACT.md` records the per-widget mapping and pending values. The React/Vite frontend uses `src/services/client.ts` and the backend `/dashboard` mapping by default; `VITE_USE_MOCK=true` enables the demo data. Shared location, period, snapshot date, replay controls, SSE alert updates, Alerts page, decision queue, and action status controls are connected. Existing visual layout was retained.

The Jev client follows the official TypeSafe API (`POST /v1/systemone`, bearer key, `state/model/questions`) with pinned `jev-1.13.0`, two-second timeout, two retries, batching, and cache. The configured key passed the read-only official `GET /v1/models` authentication check. The router supports `jev`, `rules`, and `shadow`, records each result/error in `decision_log`, and leaves the label null on `needs_review` fallback. The pipeline updates alert level/confidence/status and creates formula-based routine actions. Neon action/decision columns were added without replacing rows. `docs/decision_eval.txt` was generated; it reports no paired live shadow decisions yet.

| Check | Result |
| --- | --- |
| Phase 2 replay suite after Phase 3 routing | PASS — 14 tests |
| Phase 3 mocked Jev/cache/fallback/shadow/action/contract suite | PASS — 8 tests |
| Frontend production build | PASS |
| Live Neon additive schema migration | PASS |
| Read-only live `/dashboard` request | PASS — HTTP 200, all mapped sections |
| Local Windows replay database + running API (`/replay/state`, `/locations`, `/dashboard`) | PASS — 29 tables, 292,312 source rows; HTTP 200 |
| Official TypeSafe key authentication (`GET /v1/models`) | PASS — HTTP 200 |
| Real Jev decision using internal campus readings | BLOCKED — automatic approval review rejected sending operational readings/context to the external TypeSafe endpoint |
| Every connected page in a browser, console error check | UNVERIFIED — installed Edge headless exited before executing the React app; Vite build and API contract tests pass |

That earlier checkpoint was incomplete. The final resumed Phase 3 run below supersedes it:
the requested mocked Jev tests and live browser checks now pass; a real external decision
request is not an acceptance requirement for this task. `.env.example` contains placeholders.

For local Windows development when Neon connectivity is unavailable, run `.venv\Scripts\python.exe -m scripts.build_local_db` once, then launch the API with `DATABASE_URL=sqlite+pysqlite:///C:/Users/HP/Desktop/sustainability-dashboard/sustainability.db`. This ignored local copy was used for the HTTP smoke check; the configured Neon database was not replaced.


## Forecasting repairs (2026-10-12)

- [x] Preserve interrupted work in the requested safety commit.
- [x] Repair missing frontend dependencies and production compilation.
- [x] Correct issue-time/metric/location caches, entity sampling, baseline gating, bands and real accuracy reporting.
- [x] Correct tank/bin simulations, floor reconciliation, source-based safety rates, climate formulas, emissions and asset inputs.
- [x] Register missing metrics and connect forecast charts, risk signals and Insights accuracy.
- [x] Add isolated leakage, finite-band, cache isolation, historical simulation, formula, factor, persistence and HTTP contract regression checks.
- [ ] Full forecasting acceptance: daily KPI-based sustainability projections, independently evaluated daily/derived bands, both story-event predictions and browser verification remain open; see STATE.md.

Validation: 63 backend tests passed; the new all-target HTTP/persistence contract test also passed separately after replacing the earlier source-wiring check. Production build passes. Lint exits successfully with existing warnings. Local measurements: full forecast refresh 29.82s; cached risk calculation 0.21s. No external Jev/Groq requests or production database migrations were made by this repair.


## Current-date replay and Delhi weather (2026-10-12)

- [x] Dynamically align the dataset calendar with today's IST date without changing measured values or source files.
- [x] Dynamic replay state, API window/stream limits, default snapshot/date choices and midnight rollover.
- [x] Dataset-only operational forecasts; Delhi weather forecast API with cache, source badge and attribution.
- [x] Configure local environment and document safe example settings.

| Check | Result |
| --- | --- |
| Backend regression suite | PASS ? 68 tests |
| Frontend date/time rollover tests | PASS ? 3 tests |
| Production build | PASS |
| Public Delhi weather API | PASS ? 24 matching future hours |
| Weather endpoint HTTP smoke | PASS ? 24 hourly and 7 daily API points |
| Current-date dataset HTTP smoke | PASS ? today's mapped dates, future hours excluded |

Fixed historical replay fixtures run with current-date alignment/API HTTP disabled; dedicated tests verify the enabled modes. Protected engine, decision, action and complaint implementations remain unchanged.

### Dashboard visibility repair — 12 October 2026

The browser was being served by the older frontend in `sustainability-dashboard-old`, while the backend was stopped. Restarted the backend through `scripts/start-backend.ps1` and replaced the verified older Vite process with this workspace's frontend at `http://localhost:5173`. The dashboard now renders its page during loading and connection errors; a status banner no longer replaces the entire page. Added a browser regression check for page visibility during a mocked API outage. The production build and both targeted browser checks pass: outage visibility and all 12 connected pages with one combined graph per applicable page and no browser errors.

### Energy recommendations and score display repair

The connected Energy page still displayed a sample HVAC recommendation and a placeholder `savingMwh=0`. It now shows an active `review_energy_spike` work order, its event saving, or an explicit no-action state. Its button opens the real Actions Queue; it no longer claims to create a task locally or estimates monthly savings from an event.

Factor mapping preserves source decimals and missing values rather than rounding whole numbers or replacing absent Climate scores with zero. The latest dataset row contains Energy, Water and Assets scores of exactly 100, Waste 99.3341618892538, Air 97.40544429275334, and no Climate score. These source scores remain unchanged; generator KPI-to-score formulas are unavailable. The overview now identifies dataset scores and computes its status counts from actual factors.

The sustainability chart uses a 0–100 axis, daily tick dates, and a dotted baseline that starts at the selected cutoff. The backend's constant-score projection is explicitly identified as a baseline, not a validated sustainability forecast. No artificial variation or source-row changes were introduced. Production build and two browser checks pass, including all 12 connected pages without browser errors and the recommendation/score/graph regression.

## Phase 3 final completion

Resumed the existing implementation, preserved user design edits in the sibling backend
repository, and completed the remaining live contract and browser checks. No source tables
were dropped or recreated, and no migration was needed. Official TypeSafe API/model docs
were reachable and checked again; all requested Jev tests use the mocked client.

| Final check | Result |
| --- | --- |
| Full backend regression, including existing Phase 1/2/forecast tests | PASS — 89 tests, 200.35 seconds |
| Full Chromium suite | PASS — 10 tests, 2.8 minutes |
| IST date/time and calendar boundaries | PASS — 3 tests |
| Live typed dashboard/control/read endpoint contracts | PASS |
| History/forecast numerical contracts | PASS — 11 chart domains |
| SQLite + PostgreSQL information_schema audit | PASS — 7 existing tables, read-only |
| Production frontend build and lint | PASS |
| Per-point decision evaluation output | PASS — 12 points reported, live metrics not_evaluated where no paired samples exist |

The final browser run verifies every page, all 42 locations, floor water's no-data state,
replay command bodies, staff/head approval, stream reconnect/catch-up and notification
deduplication, slow dashboard responses, and shared score/graph selections after a minute
refresh. Final streaming repairs coalesce requests, deduplicate popups and provide stable
accessible notification controls. Actions' unimplemented impact/policy comparisons show
pending Phase 4 rather than sample numbers. The design was retained.

Every item is DONE in PHASE3_STATUS.md. Numeric forecast acceptance gaps and Phase 4
simulation/comparison work remain in their existing scope; they were not rebuilt here.
