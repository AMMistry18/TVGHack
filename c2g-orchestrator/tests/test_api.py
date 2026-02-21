"""
Pytest tests for API endpoints using httpx AsyncClient.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.mark.asyncio
async def test_health_returns_200():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        r = await client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "online"
    assert "version" in data


@pytest.mark.asyncio
async def test_grid_current_returns_price_and_status():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        r = await client.get("/api/grid/current")
    assert r.status_code == 200
    data = r.json()
    assert "price_mwh" in data
    assert "status" in data


@pytest.mark.asyncio
async def test_simulate_spike_422_below_threshold():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        r = await client.post(
            "/admin/simulate-spike",
            json={"price_mwh": 500, "duration_seconds": 60},
        )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_simulate_spike_200_above_threshold():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        r = await client.post(
            "/admin/simulate-spike",
            json={"price_mwh": 5000, "duration_seconds": 60},
        )
    assert r.status_code == 200
