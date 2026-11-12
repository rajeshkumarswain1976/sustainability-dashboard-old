# Deploy Agenexus on Render

The root `render.yaml` and `Dockerfile` deploy the current frontend and full backend
as one web service. The browser calls `/api` on the same origin, so no frontend or
backend URL needs to be entered before deployment.


1. Commit and push `Dockerfile`, `.dockerignore`, `render.yaml`, and the complete
   `deployment/` folder to the connected GitHub repository.
2. In Render choose **New > Blueprint**, select the repository, and apply `render.yaml`.
3. Provide `DATABASE_URL`, `DATABASE_URL_DIRECT`, `JEV_API_KEY` and `GROQ_API_KEY`
   from your existing backend environment. Use the populated Neon database.
4. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to the administrator credentials you want.
5. Deploy. Render displays the live HTTPS URL on the service page.

## Refreshing synthetic dataset rows

The image includes the active top-level CSVs in `datasets/`, but the running API reads rows from Neon; committing CSV changes does not import them. Before deploying a new dataset, run the strict validator and read-only Neon preflight from the repository root:

```powershell
.venv/Scripts/python.exe scripts/validate_synthetic_datasets.py
.venv/Scripts/python.exe scripts/safe_neon_sync.py --dry-run
```

Review the printed source-file to target-table row counts, current database counts, and validation status. Resolve any schema or database preflight issue before continuing. Only after reviewing that exact summary should an operator run:

```powershell
.venv/Scripts/python.exe scripts/safe_neon_sync.py --sync
```

The sync replaces only imported dataset and source-derived dimension tables. It backs those tables up and checks row counts, duplicate keys, and timestamp bounds inside the same transaction; any mismatch rolls the replacement back. It does not replace operational tables such as users, complaints, actions, alerts, or logs. Render deployment itself does not sync CSVs to Neon.

For manual setup, choose **New > Web Service**, connect the same repository, select
**Docker** as the language, leave Root Directory blank, use `./Dockerfile`, and
leave Docker Command blank. Add the variables from `render.yaml` in Environment.
Set `CARE_SESSION_SECRET` to a random secret of at least 32 characters if you do
not use the Blueprint's generated value.

The container builds the frontend with development build dependencies, then runs
the Python server on Render's `PORT`. `/healthz` is the health-check endpoint.
Runtime defaults also apply to manual Docker deployments: `DATA_DIR=datasets`,
`REPLAY_ALIGN_TODAY=true` and `WEATHER_FORECAST_ENABLED=true`. If you previously
set `REPLAY_ALIGN_TODAY=false` in Render Environment, change it to `true`; an
explicit environment value overrides these defaults. Historical source dates
remain unchanged in the database and are mapped to today for the dashboard.
Render's assigned URL automatically supplies the allowed frontend origin and the
CampusCare public URL. A custom domain can override these with `FRONTEND_ORIGIN`
and `CARE_PUBLIC_URL`.

Startup creates missing operational and CampusCare tables without replacing
source-domain tables. When `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, each
startup applies those values to the active administrator account so the Render
credentials are the sign-in credentials. Source data must
already exist in the database. No local `.env`, SQLite database, credentials,
browser cache or installed dependencies are included in the image.

College Google or Microsoft SSO still needs its provider settings (`CARE_*`,
`COLLEGE_EMAIL_DOMAINS`). Authenticated CampusCare users can submit from any
network by default. Set `CARE_REQUIRE_CAMPUS_NETWORK=true` and configure
`CAMPUS_IP_CIDRS` only when submissions should be limited to campus networks.
The administrator dashboard works with the provisioned account.

The Docker build uses the checked-in `deployment/frontend/` snapshot. In this
checkout, `deployment/sync-source.ps1` defaults to the neighboring
`sustainability-dashboard` directory and copies its files over that snapshot.
Do not run it blindly: use it only when that neighboring project is the intended
canonical frontend, and first carry the reviewed changes into that source.

Validation: build the packaged frontend and run
`.venv/Scripts/python.exe deployment/verify.py`. Docker builds can be checked with
`docker build -t agenexus .` on a machine with Docker installed.
