"""Verify production asset serving, API prefixes, authentication and lifespan routing."""
from contextlib import asynccontextmanager
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
# Verification never connects to the configured production database.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["DATABASE_URL_DIRECT"] = "sqlite:///:memory:"
os.environ["DASHBOARD_DEMO_MODE"] = "false"
os.environ["FRONTEND_ORIGIN"] = "https://agenexus.example"
os.environ.pop("ADMIN_EMAIL", None)
os.environ.pop("ADMIN_PASSWORD", None)

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
import deployment.web as web
prepare_database = web.prepare_database

events = []
@asynccontextmanager
async def lifecycle(api):
    events.append("started")
    yield
    events.append("stopped")

api = FastAPI(lifespan=lifecycle)
@api.get("/echo")
def echo(request: Request):
    return {"path": request.scope["path"], "root_path": request.scope["root_path"], "query": request.query_params.get("value")}

@api.post("/login")
def login():
    from fastapi.responses import JSONResponse
    result = JSONResponse({"ok": True})
    result.set_cookie("session", "example", path="/", secure=True, httponly=True)
    return result

web.prepare_database = lambda: events.append("prepared")
with TemporaryDirectory() as temporary:
    assets = Path(temporary)
    (assets / "index.html").write_text("<html>Agenexus production</html>", encoding="utf-8")
    (assets / "assets").mkdir()
    (assets / "assets" / "app.js").write_text("console.log('Agenexus')", encoding="utf-8")
    with TestClient(web.AgenexusApp(api, assets), base_url="https://agenexus.example") as client:
        assert "Agenexus production" in client.get("/").text
        assert "Agenexus production" in client.get("/campus-care").text
        assert client.get("/assets/app.js").status_code == 200
        assert client.get("/assets/missing.js").status_code == 404
        assert client.get("/assets/missing").status_code == 404
        assert client.get("/api/echo?value=42").json() == {"path": "/echo", "root_path": "/api", "query": "42"}
        assert client.get("/api/missing").status_code == 404
        assert client.get("/healthz").json() == {"status": "ok"}
        assert "Secure" in client.post("/api/login").headers["set-cookie"]
    assert events == ["prepared", "started", "stopped"]

# Exercise the actual backend middleware's public authentication route.
client = TestClient(web.app, base_url="https://agenexus.example")
assert client.get("/api/auth/config").status_code == 200
client.close()

# Verify additive provisioning and restart behavior in an isolated database.
from sqlalchemy import create_engine, insert, select
from unittest.mock import patch
from app.db import get_table
from server.storage import tables
engine = create_engine("sqlite:///:memory:")
locations = get_table("location_dim")
locations.create(engine)
with engine.begin() as connection:
    connection.execute(insert(locations).values(node_id="F01", level="facility", label="Test campus", parent_id=None))
os.environ["ADMIN_EMAIL"] = "admin@agenexus.example"
os.environ["ADMIN_PASSWORD"] = "isolated-test-password"
with patch("app.db.create_db_engine", return_value=engine), patch.object(engine, "dispose"):
    prepare_database()
    with engine.connect() as connection:
        original = connection.execute(select(tables().tables["app_users"])).mappings().one()
    os.environ["ADMIN_PASSWORD"] = "a-new-value-on-restart"
    prepare_database()
    with engine.connect() as connection:
        rows = connection.execute(select(tables().tables["app_users"])).mappings().all()
        assert len(rows) == 1 and rows[0]["password_hash"] == original["password_hash"]
engine.dispose()
print("Production checks passed: assets, SPA/API routing, cookies, authentication, lifespan and idempotent administrator provisioning.")
