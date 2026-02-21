"""
Demo router: magic button / inject-storm for demo safety.
All inserts go to Supabase (https://gkyhvikuizoceekuduwe.supabase.co).
"""
import json
import os
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter

from config import settings
from db.supabase_client import insert_action_log, insert_grid_events_bulk
from models.schemas import ActionLog
from services.ercot_monitor import app_state
from services.savings_calculator import calculate_avoided_cost

router = APIRouter(tags=["demo"])

PEAK_PRICE = 5000.0
BASE = 40.0
MW = 100.0
THRESHOLD = 1000


def _classify(price: float) -> str:
    if price < 100:
        return "NORMAL"
    if price < 1000:
        return "WARNING"
    if price < 5000:
        return "EMERGENCY"
    return "CRITICAL"


@router.get("/inject-storm")
async def inject_storm():
    """
    Magic button: in one operation trigger $5000 spike, insert 24 historical grid_events
    (last 2 hours: ramp 30→200→800→2000→5000→plateau→recovery), insert 2 action_logs
    (LOAD_SHED, CHECKPOINT). Returns full recharts-formatted dataset immediately.
    """
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=2)
    n = 24
    step_sec = (2 * 3600) / (n - 1) if n > 1 else 0

    # Price ramp: $30 → $200 → $800 → $2000 → $5000 → plateau → recovery
    def price_at_index(i: int) -> float:
        t = i / (n - 1) if n > 1 else 0
        if t < 0.15:
            return 30 + (200 - 30) * (t / 0.15)
        if t < 0.35:
            return 200 + (800 - 200) * ((t - 0.15) / 0.2)
        if t < 0.5:
            return 800 + (2000 - 800) * ((t - 0.35) / 0.15)
        if t < 0.65:
            return 2000 + (5000 - 2000) * ((t - 0.5) / 0.15)
        if t < 0.85:
            return 5000
        return 5000 - (5000 - 30) * ((t - 0.85) / 0.15)

    grid_events = []
    for i in range(n):
        ts = start + timedelta(seconds=i * step_sec)
        price = price_at_index(i)
        status = _classify(price)
        grid_events.append({
            "timestamp": ts.isoformat(),
            "price_mwh": round(price, 2),
            "status": status,
        })

    await insert_grid_events_bulk(grid_events)

    shed_ts = start + timedelta(minutes=50)
    checkpoint_ts = start + timedelta(minutes=52)
    await insert_action_log(ActionLog(
        timestamp=shed_ts,
        action_taken="LOAD_SHED",
        pods_scaled=24,
        estimated_savings=0.0,
        duration_seconds=None,
    ))
    await insert_action_log(ActionLog(
        timestamp=checkpoint_ts,
        action_taken="CHECKPOINT",
        pods_scaled=3,
        estimated_savings=0.0,
        duration_seconds=None,
    ))

    app_state.current_price = PEAK_PRICE
    app_state.is_spike_active = True
    app_state.spike_end_time = now + timedelta(minutes=10)
    app_state.spike_price = PEAK_PRICE
    app_state.load_shed_active = True

    def to_hhmm(iso_ts: str) -> str:
        try:
            dt = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
            return dt.strftime("%H:%M")
        except Exception:
            return "00:00"

    interval_h = 2.0 / (n - 1) if n > 1 else 0
    cumulative = 0.0
    price_data = []
    savings_data = []
    for i, e in enumerate(grid_events):
        ts_str = to_hhmm(e["timestamp"])
        price = e["price_mwh"]
        price_data.append({"time": ts_str, "price": price, "threshold": THRESHOLD})
        if price > BASE:
            cumulative += (price - BASE) * MW * interval_h
        savings_data.append({"time": ts_str, "savings": round(cumulative, 2), "avoided": round(cumulative, 2)})

    total_saved = calculate_avoided_cost(PEAK_PRICE, 2.0, MW)
    return {
        "priceData": price_data,
        "savingsData": savings_data,
        "summary": {
            "totalSaved": total_saved,
            "peakPrice": PEAK_PRICE,
            "hoursActive": 2.0,
        },
    }


def _read_training_status() -> dict | None:
    """Read training status from CHECKPOINT_DIR/LATEST if available. Returns None if not accessible."""
    checkpoint_dir = os.environ.get("CHECKPOINT_DIR", "").strip()
    if not checkpoint_dir:
        return None
    latest_path = os.path.join(checkpoint_dir, "LATEST")
    if not os.path.isfile(latest_path):
        return None
    try:
        with open(latest_path, "r") as f:
            filename = f.read().strip()
        path = os.path.join(checkpoint_dir, filename)
        if not os.path.isfile(path):
            return None
        with open(path, "r") as f:
            data = json.load(f)
        return {
            "status": "checkpointed",
            "current_epoch": data.get("epoch", 0),
            "current_loss": data.get("loss", 0.0),
            "last_checkpoint": data.get("timestamp", ""),
            "checkpoint_reason": data.get("checkpoint_reason", "emergency"),
            "training_time_seconds": data.get("training_time_seconds", 0),
            "resumed_from_emergency": data.get("checkpoint_reason") == "emergency",
        }
    except Exception:
        return None


@router.get("/training-status")
async def training_status():
    """
    Return current state of the mock training job (for TrainingLossChart).
    Reads from CHECKPOINT_DIR/LATEST when set and accessible; otherwise returns mock data for demo.
    """
    data = _read_training_status()
    if data is not None:
        return data
    # Mock data so the chart and UI work without a shared checkpoint volume
    return {
        "status": "running",
        "current_epoch": 347,
        "current_loss": 6.823,
        "last_checkpoint": "2026-02-20T14:23:11Z",
        "checkpoint_reason": "emergency",
        "training_time_seconds": 1247,
        "resumed_from_emergency": True,
    }
