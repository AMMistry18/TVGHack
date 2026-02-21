"""
ERCOT grid price monitoring background task and simulated price feed.
Inserts grid_events and power_snapshots to Supabase every 5s tick.
"""
import asyncio
import logging
import random
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from db.supabase_client import insert_grid_event, insert_power_snapshot
from models.schemas import GridEvent
from services.k8s_controller import resume_operations, trigger_load_shed
from services.power_model import (
    get_current_mw_shed,
    get_it_load_mw,
    get_total_facility_power_mw,
)

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


@dataclass
class AppState:
    current_price: float = 30.0
    is_spike_active: bool = False
    spike_end_time: Optional[datetime] = None
    spike_price: float = 0.0
    load_shed_active: bool = False
    last_event_id: Optional[str] = None


app_state = AppState()


def classify_price(price: float) -> str:
    if price < 100:
        return "NORMAL"
    if price < 1000:
        return "WARNING"
    if price < 5000:
        return "EMERGENCY"
    return "CRITICAL"


async def simulate_ercot_price() -> float:
    now = datetime.now(timezone.utc)

    if app_state.is_spike_active and app_state.spike_end_time and now < app_state.spike_end_time:
        app_state.current_price = app_state.spike_price
        return app_state.current_price

    if app_state.is_spike_active and app_state.spike_end_time and now >= app_state.spike_end_time:
        app_state.is_spike_active = False
        app_state.spike_end_time = None
        app_state.spike_price = 0.0
        app_state.current_price = 30.0
        return app_state.current_price

    base = 30.0
    noise = random.gauss(0, 5)
    price = max(15.0, base + noise)
    if random.random() < 0.05:
        price = random.uniform(200, 800)
    app_state.current_price = round(price, 2)
    return app_state.current_price


async def _insert_power_snapshot(price: float) -> None:
    """Capture current power model state into Supabase power_snapshots."""
    try:
        from services.power_model import get_power_breakdown
        breakdown = get_power_breakdown()
        by_crit = breakdown.get("by_criticality", {})
        flexible_mw = by_crit.get("flexible", {}).get("mw", 0) + by_crit.get("semi-flexible", {}).get("mw", 0)
        critical_mw = by_crit.get("critical", {}).get("mw", 0)

        snapshot = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_facility_mw": breakdown["total_facility_mw"],
            "it_load_mw": breakdown["total_it_load_mw"],
            "cooling_mw": breakdown["cooling_overhead_mw"],
            "flexible_mw": round(flexible_mw, 2),
            "critical_mw": round(critical_mw, 2),
            "grid_price_mwh": price,
            "shed_active": app_state.load_shed_active,
            "mw_shed": round(get_current_mw_shed(), 2),
        }
        await insert_power_snapshot(snapshot)
    except Exception as e:
        logger.debug("power snapshot insert failed (table may not exist yet): %s", e)


async def ercot_polling_loop() -> None:
    while True:
        try:
            await asyncio.sleep(5)
            price = await simulate_ercot_price()
            status = classify_price(price)
            now = datetime.now(timezone.utc)
            event = GridEvent(timestamp=now, price_mwh=price, status=status)
            result = await insert_grid_event(event)
            if result and result.get("id"):
                app_state.last_event_id = str(result["id"])
            logger.debug("ercot tick price=%.2f status=%s event_id=%s", price, status, app_state.last_event_id)

            await _insert_power_snapshot(price)

            if price > 1000 and not app_state.load_shed_active:
                await trigger_load_shed(price)
                app_state.load_shed_active = True
            elif price < 500 and app_state.load_shed_active:
                await resume_operations()
                app_state.load_shed_active = False
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.exception("ercot_polling_loop error: %s", e)


_monitor_task: Optional[asyncio.Task] = None


async def start_monitoring() -> asyncio.Task:
    global _monitor_task
    _monitor_task = asyncio.create_task(ercot_polling_loop())
    logger.info("ERCOT monitoring task started")
    return _monitor_task
