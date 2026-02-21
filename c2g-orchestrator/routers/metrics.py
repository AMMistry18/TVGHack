"""
Metrics router for C2G Orchestrator.
All metric queries run against Supabase (https://gkyhvikuizoceekuduwe.supabase.co).
"""
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Query

from models.schemas import MetricsResponse
from services.power_model import (
    get_demand_response_credits,
    get_power_breakdown,
    get_sheddable_power_mw,
    simulate_shed_event,
)
from services.savings_calculator import (
    compute_savings_timeline,
    get_summary_stats,
)

router = APIRouter(tags=["metrics"])

PRICE_THRESHOLD = 1000


def _filter_last_hours(events: list[dict], hours: float) -> list[dict]:
    if not events or hours <= 0:
        return events
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    return [e for e in events if _parse_ts(e.get("timestamp")) >= cutoff]


def _parse_ts(v) -> datetime | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def _to_hhmm(ts: str | datetime) -> str:
    if isinstance(ts, datetime):
        return ts.strftime("%H:%M")
    if isinstance(ts, str):
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return dt.strftime("%H:%M")
        except Exception:
            return "00:00"
    return "00:00"


# ── Existing endpoints ───────────────────────────────────────────────────

@router.get("/", response_model=MetricsResponse)
async def get_metrics():
    events = await compute_savings_timeline()
    events = _filter_last_hours(events, 24.0)
    total = events[-1]["cumulative_savings"] if events else 0.0
    return MetricsResponse(total_savings=total, events=events)


@router.get("/savings", response_model=MetricsResponse)
async def get_savings(hours: int = Query(24, ge=1, le=168)):
    events = await compute_savings_timeline()
    events = _filter_last_hours(events, float(hours))
    total = events[-1]["cumulative_savings"] if events else 0.0
    return MetricsResponse(total_savings=total, events=events)


@router.get("/summary")
async def get_summary():
    stats = await get_summary_stats()
    dr = get_demand_response_credits()
    stats["demand_response"] = dr
    return stats


@router.get("/recharts")
async def get_recharts():
    events = await compute_savings_timeline()
    summary = await get_summary_stats()
    price_data = [{"time": _to_hhmm(e["timestamp"]), "price": e["grid_price"], "threshold": PRICE_THRESHOLD} for e in events]
    savings_data = [{"time": _to_hhmm(e["timestamp"]), "savings": e["cumulative_savings"], "avoided": e["cumulative_savings"]} for e in events]
    return {
        "priceData": price_data,
        "savingsData": savings_data,
        "summary": {"totalSaved": summary["total_cumulative_savings"], "peakPrice": summary["peak_price_seen"], "hoursActive": summary["total_hours_load_shed"]},
    }


@router.get("/demo-snapshot")
async def get_demo_snapshot():
    return _demo_snapshot_payload()


# ── Power model endpoints ────────────────────────────────────────────────

@router.get("/power")
async def get_power():
    """Live power breakdown based on actual replica counts in the registry."""
    breakdown = get_power_breakdown()
    breakdown["demand_response"] = get_demand_response_credits()
    return breakdown


@router.get("/power/timeline")
async def get_power_timeline(hours: float = Query(2.0, ge=0.5, le=24)):
    """Power snapshot timeline from Supabase, formatted for Recharts."""
    from db.supabase_client import get_power_snapshots
    snapshots = await get_power_snapshots(limit=300)
    if not snapshots:
        return {"timeline": [], "count": 0}

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    filtered = []
    for s in snapshots:
        ts = _parse_ts(s.get("timestamp"))
        if ts and ts >= cutoff:
            filtered.append({
                "time": _to_hhmm(ts),
                "total_mw": s.get("total_facility_mw", 0),
                "flexible_mw": s.get("flexible_mw", 0),
                "critical_mw": s.get("critical_mw", 0),
                "grid_price": s.get("grid_price_mwh", 0),
                "shed_active": s.get("shed_active", False),
                "mw_shed": s.get("mw_shed", 0),
            })
    return {"timeline": filtered, "count": len(filtered)}


@router.get("/shed-simulation")
async def get_shed_simulation(price: float = Query(5000, ge=0, le=100000)):
    """What-if simulation: what happens if we shed at this price? No side effects."""
    result = simulate_shed_event(price)
    result["sheddable_at_price_mw"] = round(get_sheddable_power_mw(price), 2)
    return result


# ── Demo snapshot (hardcoded winter storm) ───────────────────────────────

def _demo_snapshot_payload() -> dict:
    from config import settings
    base = settings.BASE_CONTRACT_PRICE
    mw = settings.FACILITY_MW
    n = 50
    duration_h = 2.0
    step_h = duration_h / (n - 1) if n > 1 else 0
    peak = 5000.0
    start = datetime(2025, 2, 20, 14, 0, 0, tzinfo=timezone.utc)

    price_data = []
    savings_data = []
    cumulative = 0.0
    for i in range(n):
        t = i * step_h
        if t < 1.0 / 3.0:
            price = 30 + (peak - 30) * (t / (1.0 / 3.0))
        elif t < 5.0 / 3.0:
            price = peak
        else:
            price = peak - (peak - 30) * ((t - 5.0 / 3.0) / (1.0 / 3.0))
            if price < 30:
                price = 30
        dt = start + timedelta(hours=t)
        ts_str = dt.strftime("%H:%M")
        price_data.append({"time": ts_str, "price": round(price, 2), "threshold": 1000})
        if price > base:
            cumulative += (price - base) * mw * step_h
        savings_data.append({"time": ts_str, "savings": round(cumulative, 2), "avoided": round(cumulative, 2)})

    total_saved = 992_000.0
    if cumulative > 0:
        scale = total_saved / cumulative
        for s in savings_data:
            s["savings"] = round(s["savings"] * scale, 2)
            s["avoided"] = s["savings"]
    return {
        "priceData": price_data,
        "savingsData": savings_data,
        "summary": {"totalSaved": total_saved, "peakPrice": peak, "hoursActive": 2.0},
    }
