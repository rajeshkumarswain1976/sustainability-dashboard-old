"""Serve the current frontend and complete API from one public origin."""
from contextlib import asynccontextmanager
import os
from pathlib import Path
import sys
from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse
from starlette.routing import Mount
from starlette.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "deployment" / "frontend"
os.environ.setdefault("DASHBOARD_BACKEND_ROOT", str(ROOT))
for key, value in {
    "DATA_DIR": "datasets",
    "SECTOR": "college",
    "TZ": "Asia/Kolkata",
    "REPLAY_ALIGN_TODAY": "true",
    "WEATHER_FORECAST_ENABLED": "true",
    "DASHBOARD_DEMO_MODE": "false",
}.items():
    os.environ.setdefault(key, value)
public_url = os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")
if public_url:
    os.environ.setdefault("FRONTEND_ORIGIN", public_url)
    os.environ.setdefault("CARE_PUBLIC_URL", public_url)
sys.path[:0] = [str(ROOT), str(FRONTEND), str(FRONTEND / "scripts")]
from dashboard_backend import app as backend


def prepare_database():
    """Create missing workflow tables and provision the first administrator."""
    from app.config import settings
    from app.db import create_db_engine
    from server.storage import ensure_tables, tables
    from server.auth import provision
    from sqlalchemy import select
    from sqlalchemy.orm import Session
    connection = settings.database_url_direct or settings.database_url
    if not connection:
        raise RuntimeError("Set DATABASE_URL to your existing populated database in Render")
    email, password = os.getenv("ADMIN_EMAIL"), os.getenv("ADMIN_PASSWORD")
    if bool(email) != bool(password):
        raise RuntimeError("Set both ADMIN_EMAIL and ADMIN_PASSWORD")
    engine = create_db_engine(connection)
    try:
        with engine.begin() as bind:
            ensure_tables(bind)
        if email and password:
            with Session(engine) as session:
                users = tables().tables["app_users"]
                if not session.execute(select(users.c.user_id).where(users.c.user_id == "render-admin")).first():
                    provision(session, "render-admin", email, password, "admin", ["F01"])
                    session.commit()
    finally:
        engine.dispose()


class FrontendFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as error:
            is_asset = bool(Path(path).parts) and Path(path).parts[0] == "assets"
            if error.status_code == 404 and not Path(path).suffix and not is_asset:
                return await super().get_response("index.html", scope)
            raise


class AgenexusApp:
    def __init__(self, api, static_directory):
        self.api = api
        self.static = Starlette(routes=[Mount("/", app=FrontendFiles(directory=str(static_directory), html=True))])
        @asynccontextmanager
        async def lifespan(application):
            prepare_database()
            async with api.router.lifespan_context(api):
                yield
        self.lifecycle = Starlette(lifespan=lifespan)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "lifespan":
            return await self.lifecycle(scope, receive, send)
        path = scope.get("path", "")
        if path == "/healthz":
            return await JSONResponse({"status": "ok"})(scope, receive, send)
        if path == "/api" or path.startswith("/api/"):
            api_scope = dict(scope)
            api_scope["path"] = path[4:] or "/"
            api_scope["root_path"] = scope.get("root_path", "") + "/api"
            raw_path = scope.get("raw_path", path.encode())
            api_scope["raw_path"] = raw_path[4:] or b"/"
            return await self.api(api_scope, receive, send)
        return await self.static(scope, receive, send)


app = AgenexusApp(backend, ROOT / "dist")
