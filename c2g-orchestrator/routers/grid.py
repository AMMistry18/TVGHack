"""
Grid router for C2G Orchestrator.
"""
from fastapi import APIRouter

from models.schemas import SpikeSimulationRequest

router = APIRouter(tags=["grid"])


@router.post("/simulate")
async def simulate_spike(request: SpikeSimulationRequest):
    """Simulate a price spike."""
    return {
        "message": "Simulation requested",
        "price_mwh": request.price_mwh,
        "duration_seconds": request.duration_seconds,
    }
