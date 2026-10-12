# Backend implementation progress

- [x] Phase 1 — foundation, ingestion, database schema, sector configuration, analytics endpoints, and tests
- [x] Phase 2 — domain candidate detectors, numeric forecasts, alert storage, replay controls, and SSE stream
- [ ] Phase 3 — frontend connection, Jev decision layer, actions, and evaluation (implementation built; live Jev/data and browser checks pending)
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

Phase 3 remains unchecked until the real Jev request is authorized and the browser page check is completed. `.env.example` previously contained a real database URL; it now contains placeholders. The exposed database credential should be rotated before sharing the repository.

For local Windows development when Neon connectivity is unavailable, run `.venv\Scripts\python.exe -m scripts.build_local_db` once, then launch the API with `DATABASE_URL=sqlite+pysqlite:///C:/Users/HP/Desktop/sustainability-dashboard/sustainability.db`. This ignored local copy was used for the HTTP smoke check; the configured Neon database was not replaced.
