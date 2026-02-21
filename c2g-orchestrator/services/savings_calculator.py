"""
Savings and avoided-cost calculations using the dynamic power model.
All metric queries run against Supabase (https://gkyhvikuizoceekuduwe.supabase.co).
"""
from datetime import datetime, timezone
from typing import Any

from config import settings
from db.supabase_client import get_action_logs_asc, get_grid_events_asc
from services.power_model import (
    get_current_mw_shed,
    get_sheddable_power_mw,
    get_total_facility_power_mw,
    get_demand_response_credits,
)

BASE_CONTRACT_PRICE: float = settings.BASE_CONTRACT_PRICE

# Poll interval in hours (5 seconds)
INTERVAL_HOURS: float = 5.0 / 3600.0


def calculate_avoided_cost(
    spike_price: float,
    duration_hours: float,
    mw_shed: float | None = None,
) -> float:
    """
    Avoided cost using actual MW shed from the power model.
    Falls back to sheddable MW at the given price if mw_shed not provided.
    """
    if mw_shed is None:
        mw_shed = get_sheddable_power_mw(spike_price)
    return (spike_price - BASE_CONTRACT_PRICE) * mw_shed * duration_hours


def _parse_ts(v: Any) -> datetime | None:
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


def _build_shed_windows(logs: list[dict[str, Any]]) -> list[tuple[datetime, datetime]]:
    windows: list[tuple[datetime, datetime]] = []
    shed_start: datetime | None = None
    for row in logs:
        ts = _parse_ts(row.get("timestamp"))
        if ts is None:
            continue
        action = (row.get("action_taken") or "").strip().upper()
        if action == "LOAD_SHED":
            shed_start = ts
        elif action == "RESUME" and shed_start is not None:
            windows.append((shed_start, ts))
            shed_start = None
    if shed_start is not None:
        windows.append((shed_start, datetime.now(timezone.utc)))
    return windows


def _in_shed(t: datetime, windows: list[tuple[datetime, datetime]]) -> bool:
    for start, end in windows:
        if start <= t <= end:
            return True
    return False


async def compute_savings_timeline() -> list[dict[str, Any]]:
    """
    Build savings timeline using dynamic MW shed from the power model.
    During active shed periods, uses actual sheddable MW at the current price
    rather than the hardcoded FACILITY_MW.
    """
    events = await get_grid_events_asc(500)
    logs = await get_action_logs_asc(2000)
    windows = _build_shed_windows(logs)

    current_shed_mw = get_current_mw_shed()
    sheddable_mw = get_sheddable_power_mw(1000.0)
    effective_mw = max(current_shed_mw, sheddable_mw) if sheddable_mw > 0 else get_total_facility_power_mw() * 0.6

    result: list[dict[str, Any]] = []
    cumulative: float = 0.0

    for row in events:
        ts = _parse_ts(row.get("timestamp"))
        if ts is None:
            continue
        price = float(row.get("price_mwh") or 0)
        status = str(row.get("status") or "NORMAL")
        load_shed_active = _in_shed(ts, windows)

        if load_shed_active and price > BASE_CONTRACT_PRICE:
            interval_savings = (price - BASE_CONTRACT_PRICE) * effective_mw * INTERVAL_HOURS
            cumulative += interval_savings

        result.append({
            "timestamp": ts.isoformat(),
            "grid_price": price,
            "cumulative_savings": round(cumulative, 2),
            "status": status,
            "load_shed_active": load_shed_active,
        })

    return result


async def get_summary_stats() -> dict[str, Any]:
    timeline = await compute_savings_timeline()
    logs = await get_action_logs_asc(2000)
    windows = _build_shed_windows(logs)

    total_savings = 0.0
    peak_price = 0.0
    prices_during_shed: list[float] = []
    for row in timeline:
        total_savings = row["cumulative_savings"]
        peak_price = max(peak_price, row["grid_price"])
        if row.get("load_shed_active") and row["grid_price"] > 0:
            prices_during_shed.append(row["grid_price"])

    load_shed_events = sum(
        1 for r in logs if (r.get("action_taken") or "").strip().upper() == "LOAD_SHED"
    )
    total_hours_shed = sum(
        (end - start).total_seconds() / 3600.0 for start, end in windows
    )
    avg_price_during_shed = (
        sum(prices_during_shed) / len(prices_during_shed) if prices_during_shed else 0.0
    )
    projected_annual = total_savings * 52

    facility_mw = get_total_facility_power_mw()
    current_shed_mw = get_current_mw_shed()

    return {
        "total_cumulative_savings": round(total_savings, 2),
        "peak_price_seen": round(peak_price, 2),
        "total_load_shed_events": load_shed_events,
        "total_hours_load_shed": round(total_hours_shed, 4),
        "average_price_during_shed": round(avg_price_during_shed, 2),
        "projected_annual_savings": round(projected_annual, 2),
        "facility_mw": round(facility_mw, 2),
        "current_mw_shed": round(current_shed_mw, 2),
    }
