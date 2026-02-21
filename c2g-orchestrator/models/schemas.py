"""
Pydantic v2 schemas for C2G Orchestrator.
"""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class GridEvent(BaseModel):
    id: UUID | None = None
    timestamp: datetime
    price_mwh: float
    status: Literal["NORMAL", "WARNING", "EMERGENCY", "CRITICAL"]


class ActionLog(BaseModel):
    id: UUID | None = None
    timestamp: datetime
    action_taken: Literal["LOAD_SHED", "BURST_CLOUD", "RESUME", "CHECKPOINT"]
    pods_scaled: int = 0
    estimated_savings: float = 0.0
    duration_seconds: float | None = None


class SpikeSimulationRequest(BaseModel):
    price_mwh: float
    duration_seconds: int = 60


class MetricsEventItem(BaseModel):
    timestamp: datetime
    grid_price: float
    cumulative_savings: float
    status: str


class MetricsResponse(BaseModel):
    total_savings: float
    events: list[dict] = Field(
        ...,
        description="List of dicts with keys: timestamp, grid_price, cumulative_savings, status",
    )
