from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

import pandas as pd
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DbSession
from sqlalchemy.orm import Session

from app.analytics.metrics import (
    count_true, data_source, domain_frames, maximum, mean, overview_snapshot,
    ratio, sustainability_score, total, to_records, window_payload,
)
from app.analytics.repository import location_tree
from app.analytics.forecast import forecast as build_forecast
from app.api.schemas import dashboard_payload
from app.config import settings
from app.db import check_database, get_session, runtime_engine
from app.engine import pipeline, replay
from app.engine.actions import change_status, list_actions
from app.sector.config import load_sector_config

router = APIRouter()
IST = ZoneInfo("Asia/Kolkata")
DEFAULT_START = datetime.fromisoformat("2026-08-17T00:00:00+05:30")
DEFAULT_END = datetime.fromisoformat("2026-10-09T23:00:00+05:30")


def _normalize_time(value: datetime) -> datetime:
    return value.replace(tzinfo=IST) if value.tzinfo is None else value.astimezone(IST)


def request_context(
    node: str = Query("F01"),
    start: datetime = Query(DEFAULT_START),
    end: datetime = Query(DEFAULT_END),
    as_of: datetime | None = Query(None),
) -> dict[str, object]:
    lower = _normalize_time(start)
    upper = _normalize_time(end)
    cutoff = _normalize_time(as_of) if as_of else datetime.now(IST)
    if upper < lower:
        raise HTTPException(status_code=422, detail="end must not be earlier than start")
    return {"node": node, "start": lower, "end": upper, "as_of": cutoff}


def _response_base(domain: str, context: dict[str, object]) -> dict[str, object]:
    return {
        "window": window_payload(str(context["node"]), context["start"], context["end"], context["as_of"]),
        "data_source": data_source(domain),
    }


def _frames(session: Session, context: dict[str, object]):
    try:
        return domain_frames(session, str(context["node"]), context["start"], context["end"], context["as_of"])
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Location node was not found") from exc


def _positive_severity(frame: pd.DataFrame) -> int:
    if frame.empty or "severity" not in frame:
        return 0
    return int(frame["severity"].astype(str).str.lower().isin({"high", "critical"}).sum())


def _domain_series(frame: pd.DataFrame, columns: list[str]) -> list[dict[str, object]]:
    time_column = next((name for name in ("timestamp", "date") if name in frame), None)
    if frame.empty or not time_column:
        return []
    values = [name for name in columns if name in frame]
    if not values:
        return []
    result = frame.groupby(time_column, dropna=True)[values].sum(min_count=1).reset_index()
    return to_records(result)


@router.get("/health")
def health(context: dict[str, object] = Depends(request_context)):
    try:
        status = check_database()
        db_status = "not_configured" if status is None else "ok"
    except Exception:
        db_status = "unavailable"
    decision_status = "configured" if settings.jev_api_key else "not_configured"
    return {
        **_response_base("overview", context),
        "status": "ok" if db_status == "ok" else "degraded",
        "database": {"status": db_status},
        "jev": {"status": decision_status, "model": "jev-1.13.0", "provider": settings.decision_provider},
    }


@router.get("/sector")
def sector(context: dict[str, object] = Depends(request_context)):
    try:
        config = load_sector_config()
    except KeyError as exc:
        raise HTTPException(status_code=500, detail="Active sector configuration is unavailable") from exc
    return {
        **_response_base("overview", context),
        "sector": config["sector"], "active": bool(config.get("active")), "version": config.get("version"),
    }


@router.get("/sector/config")
def sector_config(context: dict[str, object] = Depends(request_context)):
    try:
        config = load_sector_config()
    except KeyError as exc:
        raise HTTPException(status_code=500, detail="Active sector configuration is unavailable") from exc
    return {**_response_base("overview", context), "config": config}


@router.get("/locations")
def locations(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    try:
        nodes = location_tree(session, str(context["node"]))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Location node was not found") from exc
    return {**_response_base("overview", context), "locations": to_records(pd.DataFrame(nodes))}


@router.get("/overview")
def overview(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    frames = _frames(session, context)
    return {**_response_base("overview", context), "kpis": overview_snapshot(frames)}


@router.get("/dashboard")
def dashboard(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    frames = _frames(session, context)
    alerts_at_time = pipeline.list_alerts(session, as_of=context["as_of"], node=str(context["node"]))
    actions_at_time = list_actions(session, as_of=context["as_of"], node=str(context["node"]))
    return {**_response_base("overview", context),
            **dashboard_payload(frames, alerts_at_time, actions_at_time, context)}


@router.get("/energy")
def energy(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    frame = _frames(session, context)["energy"]
    grid = total(frame, "grid_import_kwh")
    solar = total(frame, "solar_generation_kwh")
    result = _response_base("energy", context)
    result.update({
        "kpis": {"energy_kwh": total(frame, "energy_kwh"), "peak_demand_kw": maximum(frame, "peak_demand_kw"),
                 "grid_import_kwh": grid, "solar_generation_kwh": solar,
                 "estimated_grid_co2e": grid * settings.grid_ef,
                 "estimated_cost_inr": grid * settings.tariff_inr_per_kwh},
        "series": _domain_series(frame, ["energy_kwh", "grid_import_kwh", "solar_generation_kwh"]),
    })
    return result


@router.get("/water")
def water(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    frames = _frames(session, context)
    frame = frames["water"]
    resources = frames["water_resources"]
    litres = total(frame, "water_consumption_litres")
    kl = litres / 1000
    return {
        **_response_base("water", context),
        "kpis": {"water_consumption_litres": litres, "water_consumption_kl": kl,
                 "flow_lpm_mean": mean(frame, "flow_lpm"), "leak_count": count_true(frame, "leak_flag"),
                 "estimated_cost_inr": kl * settings.water_tariff_inr_per_kl,
                 "days_of_water_available": mean(resources, "days_of_water_available"),
                 "water_stress_mean": mean(resources, "water_stress")},
        "series": _domain_series(frame, ["water_consumption_litres", "flow_lpm"]),
    }


@router.get("/waste")
def waste(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    frame = _frames(session, context)["waste"]
    mass = total(frame, "waste_weight")
    if "diversion_rate" in frame and "waste_weight" in frame:
        valid = frame[["diversion_rate", "waste_weight"]].apply(pd.to_numeric, errors="coerce").dropna()
        denominator = float(valid["waste_weight"].sum()) if not valid.empty else 0.0
        diversion = ratio(float((valid["diversion_rate"] * valid["waste_weight"]).sum()), denominator) if denominator else None
    else:
        diversion = None
    return {
        **_response_base("waste", context),
        "kpis": {"waste_weight": mass, "mean_fill_percentage": mean(frame, "fill_percentage"),
                 "overflow_count": count_true(frame, "overflow_event"),
                 "collection_delay_count": count_true(frame, "collection_delayed"),
                 "weighted_diversion_rate": diversion},
        "series": _domain_series(frame, ["waste_weight", "overflow_event"]),
    }


@router.get("/air")
def air(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    frame = _frames(session, context)["air"]
    dominant = frame["dominant_pollutant"].mode().iat[0] if not frame.empty and "dominant_pollutant" in frame and not frame["dominant_pollutant"].dropna().empty else None
    return {
        **_response_base("air", context),
        "kpis": {"aqi_cpcb_mean": mean(frame, "aqi_cpcb"), "pm25_mean": mean(frame, "pm25"),
                 "pm10_mean": mean(frame, "pm10"), "dominant_pollutant": dominant},
        "series": _domain_series(frame, ["aqi_cpcb", "pm25", "pm10"]),
    }


@router.get("/assets")
def assets(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    frame = _frames(session, context)["assets"]
    due = frame.get("maintenance_status", pd.Series(dtype=str)).astype(str).str.lower().isin({"due", "overdue"}) if not frame.empty else pd.Series(dtype=bool)
    failed = int(frame.get("status", pd.Series(dtype=str)).astype(str).str.lower().isin({"failed", "failure"}).sum()) if not frame.empty else 0
    return {
        **_response_base("assets", context),
        "kpis": {"utilisation_mean": mean(frame, "utilisation"), "availability_mean": mean(frame, "availability"),
                 "downtime_hours": total(frame, "downtime_hours"), "maintenance_due": int(due.sum()),
                 "failed_count": failed, "vibration_mean": mean(frame, "vibration")},
        "series": _domain_series(frame, ["downtime_hours", "operating_hours"]),
    }


@router.get("/mobility")
def mobility(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    frame = _frames(session, context)["mobility"]
    occupied = total(frame, "parking_occupancy")
    capacity = total(frame, "parking_capacity")
    return {
        **_response_base("mobility", context),
        "kpis": {"vehicle_count": total(frame, "vehicle_count"), "mean_delay_min": mean(frame, "delay_min"),
                 "parking_occupancy": occupied, "parking_capacity": capacity,
                 "parking_occupancy_ratio": ratio(occupied, capacity)},
        "series": _domain_series(frame, ["vehicle_count", "parking_occupancy", "parking_capacity"]),
    }


@router.get("/safety")
def safety(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    frame = _frames(session, context)["safety"]
    open_count = int((frame.get("status", pd.Series(dtype=str)).astype(str).str.lower() != "closed").sum()) if not frame.empty else 0
    return {
        **_response_base("safety", context),
        "kpis": {"incident_count": len(frame), "high_severity_count": _positive_severity(frame),
                 "response_time_mean": mean(frame, "response_time"), "open_count": open_count},
        "incidents": to_records(frame),
    }


@router.get("/climate")
def climate(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    frames = _frames(session, context)
    frame = frames["climate"]
    return {
        **_response_base("climate", context),
        "kpis": {"heat_risk_mean": mean(frame, "heat_risk"), "flood_risk_mean": mean(frame, "flood_risk"),
                 "heavy_rain_readiness_mean": mean(frame, "heavy_rain_readiness"),
                 "power_resilience_mean": mean(frame, "power_resilience"),
                 "climate_readiness_score_mean": mean(frame, "climate_readiness_score"),
                 "rainfall_total_mm": total(frames["weather"], "rainfall")},
        "series": _domain_series(frame, ["heat_risk", "flood_risk", "climate_readiness_score"]),
    }


@router.get("/sustainability")
def sustainability(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    frame = _frames(session, context)["sustainability"]
    result = _response_base("sustainability", context)
    result.update({
        "kpis": {"sustainability_score": sustainability_score(frame),
                 "energy_score": mean(frame, "energy_score"), "water_score": mean(frame, "water_score"),
                 "waste_score": mean(frame, "waste_score"), "air_score": mean(frame, "air_score"),
                 "mobility_score": mean(frame, "mobility_score"), "assets_score": mean(frame, "assets_score"),
                 "safety_score": mean(frame, "safety_score"), "emissions_score": mean(frame, "emissions_score")},
        "series": _domain_series(frame, ["energy_score", "water_score", "waste_score", "air_score", "mobility_score", "assets_score", "safety_score", "emissions_score"]),
    })
    return result


@router.get("/emissions")
def emissions(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    frame = _frames(session, context)["emissions"]
    return {
        **_response_base("emissions", context),
        "kpis": {"energy_co2e": total(frame, "energy_co2e"), "mobility_co2e": total(frame, "mobility_co2e"),
                 "waste_co2e": total(frame, "waste_co2e"), "total_co2e": total(frame, "total_co2e")},
        "series": _domain_series(frame, ["energy_co2e", "mobility_co2e", "waste_co2e", "total_co2e"]),
    }


@router.get("/insights")
def insights(context: dict[str, object] = Depends(request_context), session: Session = Depends(get_session)):
    frames = _frames(session, context)
    signals = frames["signals"]
    return {
        **_response_base("insights", context),
        "anomaly_count": len(signals), "energy_signals": to_records(signals),
        "event_flags": {"water_leaks": count_true(frames["water"], "leak_flag"),
                        "waste_overflows": count_true(frames["waste"], "overflow_event"),
                        "delayed_collections": count_true(frames["waste"], "collection_delayed")},
    }


class ReplayStart(BaseModel):
    as_of: datetime | None = None
    speed: float | None = Field(default=None, gt=0)
    node: str = "F01"


class ReplaySeek(BaseModel):
    as_of: datetime


class ReplaySpeed(BaseModel):
    speed: float = Field(gt=0)


@router.get("/forecast/{domain}")
def forecast_endpoint(
    domain: Literal["energy", "water", "parking"], node: str = Query("F01"),
    as_of: datetime | None = Query(None), session: Session = Depends(get_session),
):
    state = replay.load_state(session)
    cutoff = _normalize_time(as_of) if as_of else _normalize_time(datetime.fromisoformat(state["cursor"]))
    try:
        return build_forecast(domain, node, cutoff, session=session)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Location node was not found") from exc


@router.get("/replay/state")
def replay_state(session: Session = Depends(get_session)):
    return replay.load_state(session)


@router.post("/replay/start")
def replay_start(command: ReplayStart | None = None, session: Session = Depends(get_session)):
    values = command or ReplayStart()
    return replay.start(session, values.as_of, values.speed, values.node)


@router.post("/replay/pause")
def replay_pause(session: Session = Depends(get_session)):
    return replay.pause(session)


@router.post("/replay/seek")
def replay_seek(command: ReplaySeek, session: Session = Depends(get_session)):
    return replay.seek(session, command.as_of)


@router.post("/replay/speed")
def replay_speed(command: ReplaySpeed, session: Session = Depends(get_session)):
    return replay.set_speed(session, command.speed)


@router.get("/alerts")
def alerts(
    since: datetime | None = Query(None), as_of: datetime | None = Query(None),
    node: str = Query("F01"), session: Session = Depends(get_session),
):
    state = replay.load_state(session)
    cutoff = _normalize_time(as_of) if as_of else _normalize_time(datetime.fromisoformat(state["cursor"]))
    beginning = _normalize_time(since) if since else None
    return {"as_of": cutoff.isoformat(), "alerts": pipeline.list_alerts(session, beginning, cutoff, node),
            "data_source": data_source("insights")}


@router.get("/decisions/queue")
def decision_queue(as_of: datetime | None = Query(None), node: str = Query("F01"),
                   session: Session = Depends(get_session)):
    state = replay.load_state(session)
    cutoff = _normalize_time(as_of) if as_of else _normalize_time(datetime.fromisoformat(state["cursor"]))
    pending = [alert for alert in pipeline.list_alerts(session, as_of=cutoff, node=node)
               if alert["status"] in {"needs_review", "pending_agent"}]
    return {"as_of": cutoff.isoformat(), "items": pending, "count": len(pending),
            "data_source": data_source("insights")}


@router.get("/actions")
def actions(as_of: datetime | None = Query(None), node: str = Query("F01"),
            session: Session = Depends(get_session)):
    state = replay.load_state(session)
    cutoff = _normalize_time(as_of) if as_of else _normalize_time(datetime.fromisoformat(state["cursor"]))
    return {"as_of": cutoff.isoformat(), "actions": list_actions(session, as_of=cutoff, node=node),
            "data_source": data_source("insights")}


class ActionStatus(BaseModel):
    status: Literal["open", "acknowledged", "in_progress", "done"]


@router.patch("/actions/{action_id}")
def patch_action(action_id: str, command: ActionStatus, role: Literal["staff", "head"] = Header(alias="X-Role"),
                 session: Session = Depends(get_session)):
    return change_status(session, action_id, command.status, role)


@router.get("/stream")
def stream(
    node: str = Query("F01"), as_of: datetime | None = Query(None),
    limit: int | None = Query(None, ge=1, le=100),
):
    engine = runtime_engine()
    if engine is None:
        raise HTTPException(status_code=503, detail="Database is not configured")

    def run_tick(target: datetime):
        with DbSession(engine) as db:
            return pipeline.tick(target, node, db)

    def next_step():
        with DbSession(engine) as db:
            state = replay.load_state(db)
            if not state["running"]:
                return None
            previous = state.get("last_processed_at") or state["cursor"]
            target = _normalize_time(datetime.fromisoformat(previous)) + timedelta(hours=1)
            if target > DEFAULT_END:
                replay.pause(db)
                return None
            return target, float(state["speed"])

    async def events():
        if as_of is not None:
            result = await asyncio.to_thread(run_tick, _normalize_time(as_of))
            yield "event: tick\ndata: " + json.dumps(result, separators=(",", ":")) + "\n\n"
            return
        sent = 0
        while limit is None or sent < limit:
            step = await asyncio.to_thread(next_step)
            if step is None:
                break
            target, speed = step
            result = await asyncio.to_thread(run_tick, target)
            yield "event: tick\ndata: " + json.dumps(result, separators=(",", ":")) + "\n\n"
            sent += 1
            await asyncio.sleep(max(0.01, 3600.0 / speed))

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
