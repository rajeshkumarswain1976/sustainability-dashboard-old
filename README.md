# AgeNexus

Smart campus monitoring, forecasting and complaint handling. TerraNexus watches energy, water, waste, air, equipment, traffic, safety and climate in one place, flags problems as they happen, forecasts what comes next, and tells staff what to do about it. Students and staff can also raise campus complaints, which are routed to the right team automatically.

Colleges are fully supported today. Hospitals are next.

## Sector status

| Sector | Status |
|---|---|
| Colleges | Done |
| Hospitals | Next |
| Municipalities | Planned |
| Industries | Planned |

## Features

**Dashboard**
- 12 pages: Overview, Energy, Water, Waste, Air, Assets, Mobility, Safety, Climate, Sustainability, Actions, Insights
- Overall sustainability score with drill-down
- Searchable location tree (campus, zone, building, floor, outdoor area)
- Charts with solid history, a dashed forecast with an uncertainty band, and a "now" marker
- Light and dark themes, mobile-friendly layout, loading, retry and empty states

**Live monitoring**
- Historical data replays hour by hour like a live feed, with start, pause, seek and speed controls
- New alerts reach the browser over Server-Sent Events, with automatic reconnect and catch-up
- Optional calendar shift so the replay ends on today's date

**Detection and forecasting**
- Detectors for energy spikes, water leaks, low tanks, bin overflow, parking pressure, equipment faults, poor air quality, safety incidents, heat and flood risk
- Gradient boosting forecasts compared against simple baselines, and served only when they win
- Simulations for tank levels and bin filling, formula-based projections for emissions and climate risk

**Decisions and actions**
- Each flag is judged as a real issue, data gap or normal pattern, then given a severity and a route
- Decisions can come from Jev, a rules provider, or both side by side (shadow mode)
- Actions move through open, acknowledged, in progress and done, with head approval for critical items
- Savings are worked out by explicit formulas in rupees and CO2e

**Complaint system**
- College sign-in (Google or Microsoft), campus-only submission, guided questions instead of a blank box
- Jev returns department, urgency, spam check and severity in one fast call, with Groq as a fallback below 0.85 confidence
- "Me too" duplicate merging, ticket IDs, expected fix times, email on resolution with a reopen link and rating
- Admin view sorted by severity, area announcements, auto-escalation, resolved complaints deleted after about 90 days
- QR codes (general and per block or room) are generated from the final URL after deployment

## How it works

```
Source data -> Adapters -> Database + location tree -> Replay clock
  -> Detectors and forecasts -> Decision layer -> Rule path or agent path
  -> Alerts and actions -> Dashboard
```

TerraNexus keeps four jobs strictly apart:

| Engine | Tool | Job | Never |
|---|---|---|---|
| Rules and formulas | Plain Python | Detection, roll-ups, simulation, savings, scores | Guesses |
| Forecasting | scikit-learn | Numeric forecasts | Decides or writes |
| Decisions | Jev, with a rules provider as fallback | Labels, levels, routing, owner, priority | Writes text or calculates |
| Language | Groq | Wording, summaries, chat answers | Decides or calculates |

Numbers come from formulas, decisions from Jev, words from Groq.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, Three.js, Lucide icons, Web Audio, SVG charts |
| Backend | Python 3.11, FastAPI, Uvicorn, SQLAlchemy, psycopg, pandas, numpy, httpx, PyYAML |
| Database | Neon Postgres (production), SQLite (local), in-memory SQLite (tests) |
| Forecasting | scikit-learn HistGradientBoostingRegressor |
| Decisions | Jev (`jev-1.13.0`, pinned) |
| Language | Groq (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`) |
| Search (planned) | sentence-transformers `all-MiniLM-L6-v2`, numpy cosine search |
| Testing | pytest, ESLint |

Check Groq's current model list before deploying, because model availability changes.

## Repository layout

| Folder | Contents |
|---|---|
| `sustainability-dashboard` | Active React frontend and the backend start script |
| `sustainability-dashboard-old` | Python backend, datasets, database code, tests, older frontend |

```
app/
  adapters/    read and validate source data
  etl/         cleaning, timezone fixes, alignment helpers
  backbone/    master tables and linking helpers
  sector/      sector configuration loader
  analytics/   domain modules, detectors, forecast engine
  decision/    Jev provider, rules provider, router
  engine/      snapshot, pipeline, actions
  api/         routes and response mapping
config/        sector, decision and forecast settings
```

## Getting started

**Requirements:** Node.js (LTS), Python 3.11, and a Neon Postgres database (or SQLite for local work).

**1. Backend**

```bash
cd sustainability-dashboard-old
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then fill in the values below
```

**2. Start the API**

Start it through the frontend's script, not `app.main:app` on its own. The script adds the `/history/{domain}` endpoint the charts need.

```bash
cd ../sustainability-dashboard
python scripts/dashboard_backend.py
```

**3. Frontend**

```bash
npm install
npm run dev
```

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Neon connection used by the running API |
| `DATABASE_URL_DIRECT` | Direct connection for schema creation and bulk loading |
| `TEST_DATABASE_URL` | Separate branch used by tests |
| `DATA_DIR` | Folder with the dataset CSV files |
| `SECTOR` | Active sector (`college`) |
| `REPLAY_ALIGN_TODAY` | Shift the replay calendar so it ends today |
| `TARIFF_INR_PER_KWH`, `GRID_EF`, `WATER_TARIFF_INR_PER_KL` | Savings and emission formulas |
| `DECISION_PROVIDER` | `jev`, `shadow` or `rules` |
| `DECISION_ON_ERROR` | `needs_review` or `rules` when Jev fails |
| `JEV_API_KEY`, `JEV_BASE_URL`, `JEV_MODEL` | Jev access and pinned version |
| `GROQ_API_KEY`, `GROQ_MODEL` | Groq access |
| `FRONTEND_ORIGIN` | Origin allowed by CORS |
| `VITE_CONTACT_ENDPOINT` | Optional contact form endpoint |

Keep keys in `.env` only and never commit them.

## API overview

| Group | Endpoints |
|---|---|
| Pages | `/health`, `/locations`, `/overview`, `/energy`, `/water`, `/waste`, `/air`, `/assets`, `/mobility`, `/safety`, `/climate`, `/sustainability`, `/emissions`, `/insights` |
| History | `/history/{domain}` |
| Forecast | `/forecast`, `/forecast/{domain}`, `/forecast/accuracy`, `/forecast/risks` |
| Replay and alerts | `/replay/state`, `/replay/start`, `/replay/pause`, `/replay/seek`, `/replay/speed`, `/stream`, `/alerts` |
| Actions | `/actions`, `PATCH /actions/{id}` |
| Sector | `/sector`, `/sector/config` |

Most requests take `node`, `start`, `end` and `as_of`. Queries never return rows after `as_of`, so future data cannot appear in a historical view.

## Data

Only building power is measured. Weather, air, occupancy, water, waste, traffic, equipment and safety data are synthetic, and every response carries a `data_source` tag so the interface can say which is which. The dataset covers 7 buildings, 28 floors and about 290,000 hourly records, and a generator runs 49 checks before the data is loaded.

## Roles

| Role | Can do |
|---|---|
| Staff | View, triage, assign, move actions forward |
| Head | Everything staff can do, plus approve critical actions and manage complaints |

## Testing

```bash
pytest                 # backend replay, decision and action tests
npm run lint           # frontend lint
```



## Roadmap

- Real sensor adapters and single sign-on with per-site access
- Chat assistant, knowledge search and recommendation agent
- Hospital sector, then municipalities and industries
- Voice complaints in English and Hindi
- ARIA labels, WCAG 2.2 AA contrast, and SEO for public pages
- Job queue, caching, time-partitioned tables, monitoring and backups for scale
