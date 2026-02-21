"""
Admin router for C2G Orchestrator.
"""
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException

from models.schemas import SpikeSimulationRequest
from services.ercot_monitor import app_state
from services.k8s_controller import (
    get_cluster_status,
    resume_operations,
    trigger_load_shed,
)

router = APIRouter(tags=["admin"])


@router.get("/")
async def admin_root():
    """Admin root endpoint."""
    return {"message": "Admin API"}


@router.post("/simulate-spike")
async def simulate_spike(request: SpikeSimulationRequest):
    """
    Start a simulated price spike. Rejects with 422 if price_mwh <= 1000.
    """
    if request.price_mwh <= 1000:
        raise HTTPException(
            status_code=422,
            detail="price_mwh must be greater than 1000 to simulate a spike",
        )
    now = datetime.now(timezone.utc)
    app_state.is_spike_active = True
    app_state.spike_end_time = now + timedelta(seconds=request.duration_seconds)
    app_state.spike_price = request.price_mwh
    app_state.current_price = request.price_mwh
    expires_at = app_state.spike_end_time.isoformat()
    return {
        "message": "Spike simulation started",
        "price_mwh": request.price_mwh,
        "duration_seconds": request.duration_seconds,
        "expires_at": expires_at,
    }


@router.post("/reset")
async def reset():
    """Cancel spike and reset current_price to 30.0."""
    app_state.is_spike_active = False
    app_state.spike_end_time = None
    app_state.spike_price = 0.0
    app_state.current_price = 30.0
    return {"message": "State reset", "current_price": 30.0}


@router.get("/state")
async def get_state():
    """Return full app_state as dict."""
    return {
        "current_price": app_state.current_price,
        "is_spike_active": app_state.is_spike_active,
        "spike_end_time": (
            app_state.spike_end_time.isoformat() if app_state.spike_end_time else None
        ),
        "load_shed_active": app_state.load_shed_active,
        "last_event_id": app_state.last_event_id,
    }


@router.post("/force-shed")
async def force_shed():
    """Force load shed (scale down low-priority deployments)."""
    return await trigger_load_shed()


@router.post("/force-resume")
async def force_resume():
    """Force resume (restore scaled-down deployments)."""
    return await resume_operations()


@router.get("/cluster-status")
async def cluster_status():
    """Return cluster pod summary by energy-priority (or mock state)."""
    return await get_cluster_status()
