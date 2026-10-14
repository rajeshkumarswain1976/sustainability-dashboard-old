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
source-domain tables. The first startup provisions the administrator once; it
does not reset that account's password on later deployments. Source data must
already exist in the database. No local `.env`, SQLite database, credentials,
browser cache or installed dependencies are included in the image.

College Google or Microsoft SSO and campus-network restrictions still need their
existing provider and campus settings (`CARE_*`, `COLLEGE_EMAIL_DOMAINS`,
`CAMPUS_IP_CIDRS`). The administrator dashboard works with the provisioned account.

`deployment/frontend/` is a deployment snapshot of the current sibling frontend,
including its API extensions and knowledge files. After changing that local
frontend, update the snapshot with `powershell -File deployment/sync-source.ps1`
before committing. Keep both directories' source changes when appropriate.

Validation: build the packaged frontend and run
`.venv/Scripts/python.exe deployment/verify.py`. Docker builds can be checked with
`docker build -t agenexus .` on a machine with Docker installed.
