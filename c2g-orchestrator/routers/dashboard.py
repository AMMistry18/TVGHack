"""
Dashboard aggregator: single endpoint returning data compatible with the Next.js
frontend types (ERCOTData, ComputeData, FinancialData, ActionLogEntry).
Now powered by the real power model for accurate MW figures.
"""
from datetime import datetime, timezone

from fastapi import APIRouter

from services.ercot_monitor import app_state, classify_price
from services.k8s_controller import get_cluster_status
from services.power_model import (
    DATACENTER_POWER_REGISTRY,
    get_current_mw_shed,
    get_demand_response_credits,
    get_power_breakdown,
    get_sheddable_power_mw,
    get_total_facility_power_mw,
)
from services.savings_calculator import get_summary_stats

router = APIRouter(tags=["dashboard"])


def _grid_status_from_price(price: float) -> str:
    s = classify_price(price)
    if s == "CRITICAL":
        return "emergency"
    if s == "EMERGENCY":
        return "scarcity"
    if s == "WARNING":
        return "elevated"
    return "normal"


@router.get("")
async def get_dashboard():
    now = datetime.now(timezone.utc)
    price = app_state.current_price
    grid_status = _grid_status_from_price(price)
    summary = await get_summary_stats()
    cluster = await get_cluster_status()
    breakdown = get_power_breakdown()
    shed_active = app_state.load_shed_active

    total_mw = breakdown["total_facility_mw"]
    it_mw = breakdown["total_it_load_mw"]
    by_crit = breakdown["by_criticality"]
    flex_mw = by_crit.get("flexible", {}).get("mw", 0) + by_crit.get("semi-flexible", {}).get("mw", 0)
    crit_mw = by_crit.get("critical", {}).get("mw", 0)
    mw_shed = get_current_mw_shed()
    sheddable_mw = get_sheddable_power_mw(price)

    total_pods = sum(p.current_replicas for p in DATACENTER_POWER_REGISTRY.values())
    max_pods = sum(p.max_replicas for p in DATACENTER_POWER_REGISTRY.values())
    paused_pods = max_pods - total_pods
    migrated_pods = 0

    remote_load_mw = 0.0
    if grid_status == "emergency":
        remote_load_mw = 20.0
        migrated_pods = 700
    elif grid_status == "scarcity" and shed_active:
        remote_load_mw = 25.0
        migrated_pods = 800

    active_pods = max(0, total_pods - migrated_pods)

    ercot = {
        "lmpPrice": price,
        "timestamp": now.isoformat(),
        "gridStatus": grid_status,
        "eeaLevel": 3 if grid_status == "emergency" else (2 if grid_status == "scarcity" else (1 if grid_status == "elevated" else 0)),
        "frequency": 60.0,
        "totalDemand": 62000,
        "totalCapacity": 85000,
        "reserveMargin": 27.0,
    }

    cloud_cost_per_mwh = 85
    cloud_spend_per_hour = round(remote_load_mw * cloud_cost_per_mwh) if migrated_pods > 0 else 0

    migration = {
        "migratedPods": migrated_pods,
        "migratedMW": round(remote_load_mw, 1),
        "remoteRegion": "PJM-East",
        "remoteProvider": "AWS us-east-1",
        "migrationLatencyMs": 1400 if migrated_pods > 0 else 0,
        "cloudSpendPerHour": cloud_spend_per_hour,
        "accumulatedCloudSpend": round(cloud_spend_per_hour * 0.5),
        "status": "active" if grid_status == "emergency" else ("migrating" if grid_status == "scarcity" and shed_active else "idle"),
    }

    namespaces = [
        {"name": "customer-api", "priority": "critical", "pods": 10, "remotePods": 0, "loadMW": round(DATACENTER_POWER_REGISTRY["customer-api"].current_power_kw * 62 / 1000, 1), "remoteLoadMW": 0, "status": "running"},
        {"name": "llm-inference-serving", "priority": "critical", "pods": DATACENTER_POWER_REGISTRY["llm-inference-serving"].current_replicas, "remotePods": 0, "loadMW": round(DATACENTER_POWER_REGISTRY["llm-inference-serving"].current_power_kw * 62 / 1000, 1), "remoteLoadMW": 0, "status": "running"},
        {
            "name": "llama-training", "priority": "low",
            "pods": DATACENTER_POWER_REGISTRY["llama4-training-job"].current_replicas,
            "remotePods": 500 if grid_status == "emergency" else 0,
            "loadMW": round(DATACENTER_POWER_REGISTRY["llama4-training-job"].current_power_kw * 62 / 1000, 1),
            "remoteLoadMW": 15 if grid_status == "emergency" else 0,
            "status": "migrated" if grid_status == "emergency" else ("paused" if shed_active else "running"),
        },
        {
            "name": "stable-diffusion", "priority": "low",
            "pods": DATACENTER_POWER_REGISTRY["stable-diffusion-batch"].current_replicas,
            "remotePods": 200 if grid_status == "emergency" else 0,
            "loadMW": round(DATACENTER_POWER_REGISTRY["stable-diffusion-batch"].current_power_kw * 62 / 1000, 1),
            "remoteLoadMW": 3 if grid_status == "emergency" else 0,
            "status": "migrated" if grid_status == "emergency" else ("paused" if shed_active else "running"),
        },
        {
            "name": "data-preprocessing", "priority": "low",
            "pods": DATACENTER_POWER_REGISTRY["data-preprocessing-pipeline"].current_replicas,
            "remotePods": 0, "loadMW": round(DATACENTER_POWER_REGISTRY["data-preprocessing-pipeline"].current_power_kw * 62 / 1000, 1),
            "remoteLoadMW": 0,
            "status": "paused" if shed_active else "running",
        },
        {
            "name": "hyperparameter-sweep", "priority": "medium",
            "pods": DATACENTER_POWER_REGISTRY["ml-hyperparameter-sweep"].current_replicas,
            "remotePods": 0, "loadMW": round(DATACENTER_POWER_REGISTRY["ml-hyperparameter-sweep"].current_power_kw * 62 / 1000, 1),
            "remoteLoadMW": 0,
            "status": "paused" if shed_active else "running",
        },
    ]

    compute = {
        "totalLoadMW": round(total_mw, 1),
        "criticalLoadMW": round(crit_mw, 1),
        "deferredLoadMW": round(flex_mw, 1),
        "remoteLoadMW": remote_load_mw,
        "activePods": active_pods,
        "pausedPods": paused_pods,
        "migratedPods": migrated_pods,
        "totalPods": max_pods,
        "shedReadyMW": round(sheddable_mw, 1),
        "namespaces": namespaces,
        "migration": migration,
    }

    total_savings = summary["total_cumulative_savings"]
    dr = get_demand_response_credits()
    dr_revenue = round(dr["monthly_capacity_payment"])
    cloud_spend_total = round(cloud_spend_per_hour * summary.get("total_hours_load_shed", 0))

    financial = {
        "avoidedCost": round(total_savings),
        "demandResponseRevenue": dr_revenue,
        "cloudSpend": cloud_spend_total,
        "netSavings": round(total_savings + dr_revenue - cloud_spend_total),
        "criticalUptime": 100,
        "savingsHistory": [],
        "peakPriceToday": summary["peak_price_seen"],
        "avgPriceToday": summary["average_price_during_shed"] or price,
    }

    logs = [
        {
            "id": "1",
            "timestamp": now.isoformat(),
            "type": "info",
            "source": "C2G Agent",
            "message": f"Grid price ${price:.0f}/MWh \u00b7 {grid_status} \u00b7 {total_mw:.1f}MW draw \u00b7 {mw_shed:.1f}MW shed",
        },
    ]
    if shed_active:
        logs.insert(0, {
            "id": "0",
            "timestamp": now.isoformat(),
            "type": "critical",
            "source": "K8s Controller",
            "message": f"Load shed active. {mw_shed:.1f}MW shed across {paused_pods} pods.",
        })

    return {"ercot": ercot, "compute": compute, "financial": financial, "logs": logs}
