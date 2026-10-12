"""Frontend contract mapping; source tables stay unchanged."""
from __future__ import annotations

from datetime import datetime
from typing import Any

import pandas as pd
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.analytics.metrics import count_true, maximum, mean, sustainability_score, total
from app.config import settings


class ForecastPoint(BaseModel):
    model_config = ConfigDict(extra="allow", allow_inf_nan=False)
    timestamp: str
    value: float
    lower: float
    upper: float

    @model_validator(mode="after")
    def ordered_band(self):
        if not self.lower <= self.value <= self.upper:
            raise ValueError("Forecast bands must contain the predicted value")
        return self


class EntityForecast(BaseModel):
    model_config = ConfigDict(extra="allow", allow_inf_nan=False)
    entity_id: str
    model: str
    mae: float | None = None
    baseline_mae: float | None = None
    series: list[ForecastPoint]


class ForecastResponse(BaseModel):
    model_config = ConfigDict(extra="allow", allow_inf_nan=False)
    domain: str
    node: str
    as_of: str
    data_source: dict[str, str]
    forecasts: list[EntityForecast] = Field(default_factory=list)


def _latest(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return frame
    key = "timestamp" if "timestamp" in frame else "date" if "date" in frame else None
    return frame[frame[key] == frame[key].max()] if key else frame


def _num(value: Any, default: float = 0) -> float:
    try:
        output = float(value)
        return output if pd.notna(output) else default
    except (TypeError, ValueError):
        return default


def dashboard_payload(frames: dict[str, pd.DataFrame], alerts: list[dict[str, Any]],
                      actions: list[dict[str, Any]], context: dict[str, Any]) -> dict[str, Any]:
    energy, water, waste = frames["energy"], frames["water"], frames["waste"]
    air, assets, mobility = frames["air"], frames["assets"], frames["mobility"]
    safety, climate = frames["safety"], frames["climate"]
    score_frame = _latest(frames["sustainability"])
    score = _num(sustainability_score(score_frame))
    latest_energy, latest_water, latest_air = _latest(energy), _latest(water), _latest(air)
    latest_ops = _latest(frames["operations"])
    latest_weather = _latest(frames["weather"])
    latest_tanks = _latest(frames["water_tanks"])
    latest_mobility = _latest(mobility)
    latest_climate = _latest(climate)
    open_alerts = [a for a in alerts if a["status"] in {"open", "needs_review", "pending_agent"}]
    open_actions = [a for a in actions if a["status"] == "open"]
    series_buildings = []
    if not latest_energy.empty and "building_id" in latest_energy:
        grouped = latest_energy.groupby("building_id", dropna=True)["energy_kwh"].sum()
        total_kw = max(float(grouped.sum()), 1)
        series_buildings = [{"name": str(name), "kw": round(float(value)), "percent": round(float(value) / total_kw * 100)}
                            for name, value in grouped.sort_values(ascending=False).items()]
    tanks = [{"name": str(row.tank_id), "percent": _num(getattr(row, "tank_level_pct", 0))}
             for row in latest_tanks.itertuples(index=False)] if not latest_tanks.empty else []
    waste_streams = []
    if not waste.empty and "bin_type" in waste:
        grouped = waste.groupby("bin_type", dropna=True)["waste_weight"].sum()
        total_mass = max(float(grouped.sum()), 1)
        waste_streams = [{"name": str(name), "tonnage": round(float(value) / 1000, 2),
                          "width": f"{round(float(value) / total_mass * 100)}%"}
                         for name, value in grouped.items()]
    garages = []
    for row in latest_mobility.itertuples(index=False):
        capacity = _num(getattr(row, "parking_capacity", 0))
        percent = round(_num(getattr(row, "parking_occupancy", 0)) / capacity * 100) if capacity else 0
        garages.append({"name": str(getattr(row, "gate_id", "Gate")), "percent": percent,
                        "status": "high pressure" if percent > 80 else "room"})
    operations = latest_ops.iloc[0] if not latest_ops.empty else {}
    weather = latest_weather.iloc[0] if not latest_weather.empty else {}
    component_names = [("Energy", "energy_score", "energy"), ("Water", "water_score", "water"),
                       ("Waste", "waste_score", "waste"), ("Air · AQI", "air_score", "air"),
                       ("Mobility", "mobility_score", "mobility"), ("Assets", "assets_score", "assets"),
                       ("Safety", "safety_score", "safety"), ("Climate", "climate_score", "climate")]
    factors = []
    for name, column, page in component_names:
        value = _num(mean(score_frame, column))
        factors.append({"name": name, "score": round(value), "status": "On track" if value >= 80 else "Monitor",
                        "color": "emerald" if value >= 80 else "amber", "page": page})
    occupied = total(latest_mobility, "parking_occupancy")
    capacity = total(latest_mobility, "parking_capacity")
    energy_kwh = total(energy, "energy_kwh")
    co2e = total(frames["emissions"], "total_co2e")
    diversion = mean(waste, "diversion_rate") or 0
    return {
        "meta": {"generatedAt": context["as_of"].isoformat(), "filters": {"node": context["node"],
                 "start": context["start"].isoformat(), "end": context["end"].isoformat(),
                 "as_of": context["as_of"].isoformat()}},
        "overview": {"score": score, "delta": 0, "trend": "Stable", "factors": factors,
                     "complaints": {"open": 0, "overdue": 0},
                     "utilization": {"classrooms": round(_num(operations.get("classroom_utilisation")) * 100),
                                     "labs": round(_num(operations.get("lab_utilisation")) * 100),
                                     "hostels": round(_num(operations.get("hostel_utilisation")) * 100)},
                     "alertCounts": {"open": len(open_alerts), "critical": sum(a["level"] == "Critical" for a in open_alerts),
                                     "needsReview": sum(a["status"] == "needs_review" for a in open_alerts)}},
        "energy": {"currentDemandKw": round(_num(maximum(latest_energy, "peak_demand_kw"))), "deltaVsPrevWeek": 0,
                   "electricityMwh": round(energy_kwh / 1000, 2), "peakDemandKw": round(_num(maximum(energy, "peak_demand_kw"))),
                   "estimatedEmissionsTco2e": round(total(frames["emissions"], "energy_co2e") / 1000, 2),
                   "avoidedTco2e": 0, "buildings": series_buildings,
                   "monthlySavingRs": round(sum(a["saving_inr"] for a in actions if a["type"] == "review_energy_spike")),
                   "savingMwh": 0},
        "water": {"useTodayM3": round(total(latest_water, "water_consumption_litres") / 1000, 2),
                  "deltaAvg": 0, "dailySupplyM3": 0,
                  "storedReservePercent": round(_num(mean(latest_tanks, "tank_level_pct"))),
                  "intensityLPerPerson": round(total(latest_water, "water_consumption_litres") /
                                               max(total(_latest(frames["occupancy"]), "occupancy_count"), 1), 2),
                  "leakAnomalyDelta": "", "weeklySavingRs": round(sum(a["saving_inr"] for a in actions if a["type"] == "investigate_leak")),
                  "tanks": tanks},
        "waste": {"generatedTonnes": round(total(waste, "waste_weight") / 1000, 2), "deltaVsLastWeek": 0,
                  "collectedOnSchedulePercent": round(100 * (1 - count_true(waste, "collection_delayed") / max(len(waste), 1)), 1),
                  "overflowIncidents": count_true(waste, "overflow_event"), "diversionRatePercent": round(diversion * 100, 1),
                  "streams": waste_streams, "routeSavingRsWeekly": 0},
        "air": {"aqi": round(_num(mean(latest_air, "aqi_cpcb"))),
                "status": str(latest_air["aqi_category"].mode().iat[0]) if not latest_air.empty and "aqi_category" in latest_air and not latest_air["aqi_category"].dropna().empty else "",
                "weeklyMeanAqi": round(_num(mean(air, "aqi_cpcb"))), "pm25Mean": round(_num(mean(air, "pm25")), 1),
                "wind": str(weather.get("wind_direction", "")), "outlook": ""},
        "assets": {"conditionScore": round(_num(mean(assets, "availability")) * 100),
                   "maintenanceDueCount": int(assets.get("maintenance_status", pd.Series(dtype=str)).astype(str).str.lower().isin({"due", "overdue"}).sum()),
                   "unresolvedCount": sum(a["type"] == "asset_risk" for a in open_alerts), "criticalTracked": 0,
                   "failuresTrendPer100": 0, "calloutSavingRs": 0},
        "mobility": {"dailyEntries": round(total(latest_mobility, "entry_count")), "typicalDelayMin": round(_num(mean(mobility, "delay_min")), 1),
                     "parkingOccupiedPercent": round(occupied / capacity * 100) if capacity else 0,
                     "openCapacitySpaces": round(max(0, capacity - occupied)), "garages": garages},
        "safety": {"openReports": int((safety.get("status", pd.Series(dtype=str)).astype(str).str.lower() != "closed").sum()) if not safety.empty else 0,
                   "highRiskZones": 0, "inspectionsPercent": 0, "anomaliesCount": sum(a["domain"] == "safety" for a in open_alerts),
                   "periodReportedIssues": len(safety)},
        "climate": {"preparednessIndex": round(_num(mean(latest_climate, "climate_readiness_score"))),
                    "heatIndexC": round(_num(weather.get("heat_index"))), "coolingLoadMw": 0,
                    "rainAlertMm": round(_num(weather.get("rainfall_6h_total"))), "rainAlertDuration": "6 hr"},
        "sustainability": {"score": score, "grade": "", "ghgEmissionsYearly": 0,
                           "renewableElectricityPercent": round(total(energy, "solar_generation_kwh") / max(energy_kwh, 1) * 100, 1),
                           "wasteDivertedPercent": round(diversion * 100, 1), "openImprovementActions": len(open_actions)},
        "actions": {"openCount": len(open_actions), "inProgressCount": sum(a["status"] == "in_progress" for a in actions),
                    "resolvedCount": sum(a["status"] == "done" for a in actions), "policyChecks": "0 / 0"},
        "insights": {"dailySavingRs": round(sum(a["saving_inr"] for a in actions)), "energyVariancePercent": ""},
    }
