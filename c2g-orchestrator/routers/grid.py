"""
Grid router for C2G Orchestrator.
"""
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Query

from db.supabase_client import get_grid_events, get_grid_events_asc
from services.ercot_monitor import app_state, classify_price

router = APIRouter(tags=["grid"])


def _synthetic_history(hours: float = 2.0, points: int = 24) -> list[dict]:
    """Generate synthetic baseline for last N hours so chart is never empty."""
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=hours)
    step_sec = (hours * 3600) / (points - 1) if points > 1 else 0
    events = []
    for i in range(points):
        ts = start + timedelta(seconds=i * step_sec)
        price = 30.0 + (i % 5) * 10
        status = "NORMAL" if price < 100 else "WARNING"
        events.append({
            "id": None,
            "timestamp": ts.isoformat(),
            "price_mwh": price,
            "status": status,
        })
    return events


@router.get("/events")
async def list_events(limit: int = Query(100, ge=1, le=500)):
    """Query Supabase grid_events ordered by timestamp DESC, max limit 500."""
    events = await get_grid_events(limit=limit)
    return {"events": events, "count": len(events)}


@router.get("/current")
async def current():
    """Return current price, status, load_shed_active, and timestamp."""
    price = app_state.current_price
    status = classify_price(price)
    return {
        "current_price": price,
        "price_mwh": price,
        "status": status,
        "load_shed_active": app_state.load_shed_active,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/history")
async def history(hours: float = Query(2.0, ge=0.5, le=168)):
    """
    Return grid history for last N hours. If Supabase grid_events has fewer than 20 rows,
    returns pre-seeded synthetic baseline so chart is never empty on fresh deployment.
    """
    probe = await get_grid_events(21)
    if len(probe) < 20:
        return {"events": _synthetic_history(hours=hours), "synthetic": True}
    all_asc = await get_grid_events_asc(500)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    def parse_ts(v):
        if v is None:
            return None
        if isinstance(v, datetime):
            return v
        try:
            return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        except Exception:
            return None

    filtered = [e for e in all_asc if parse_ts(e.get("timestamp")) >= cutoff]
    return {"events": filtered, "synthetic": False}
