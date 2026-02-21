"""
Metrics router for C2G Orchestrator.
"""
from fastapi import APIRouter

from models.schemas import MetricsResponse

router = APIRouter(tags=["metrics"])


@router.get("/", response_model=MetricsResponse)
async def get_metrics():
    """Return aggregated savings and event list."""
    return MetricsResponse(total_savings=0.0, events=[])
