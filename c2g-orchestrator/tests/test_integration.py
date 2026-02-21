"""
Integration tests covering all routers and the full request lifecycle.
Uses httpx AsyncClient with ASGITransport for in-process testing.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.fixture
def client_factory():
    async def _make():
        return AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        )
    return _make


# ────────────────────── Health ──────────────────────

@pytest.mark.asyncio
async def test_health_includes_price_and_version(client_factory):
    async with await client_factory() as client:
        r = await client.get("/health")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "online"
    assert d["version"] == "1.0.0"
    assert "current_price" in d
    assert "load_shed_active" in d


# ────────────────────── Grid ──────────────────────

@pytest.mark.asyncio
async def test_grid_current_shape(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/grid/current")
    assert r.status_code == 200
    d = r.json()
    assert "current_price" in d
    assert "price_mwh" in d
    assert "status" in d
    assert "load_shed_active" in d
    assert "timestamp" in d


@pytest.mark.asyncio
async def test_grid_events_default_limit(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/grid/events")
    assert r.status_code == 200
    d = r.json()
    assert "events" in d
    assert "count" in d
    assert isinstance(d["events"], list)


@pytest.mark.asyncio
async def test_grid_history_returns_data(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/grid/history?hours=2")
    assert r.status_code == 200
    d = r.json()
    assert "events" in d
    assert isinstance(d["events"], list)


# ────────────────────── Admin ──────────────────────

@pytest.mark.asyncio
async def test_admin_state_shape(client_factory):
    async with await client_factory() as client:
        r = await client.get("/admin/state")
    assert r.status_code == 200
    d = r.json()
    assert "current_price" in d
    assert "is_spike_active" in d
    assert "load_shed_active" in d


@pytest.mark.asyncio
async def test_admin_simulate_spike_and_reset(client_factory):
    async with await client_factory() as client:
        r = await client.post(
            "/admin/simulate-spike",
            json={"price_mwh": 5000, "duration_seconds": 30},
        )
        assert r.status_code == 200
        assert r.json()["price_mwh"] == 5000

        r2 = await client.get("/admin/state")
        assert r2.json()["is_spike_active"] is True

        r3 = await client.post("/admin/reset")
        assert r3.status_code == 200
        assert r3.json()["current_price"] == 30.0

        r4 = await client.get("/admin/state")
        assert r4.json()["is_spike_active"] is False


@pytest.mark.asyncio
async def test_admin_force_shed_and_resume(client_factory):
    async with await client_factory() as client:
        r = await client.post("/admin/force-shed")
    assert r.status_code == 200
    d = r.json()
    assert d["action"] == "LOAD_SHED"
    assert "pods_scaled_down" in d

    async with await client_factory() as client:
        r = await client.post("/admin/force-resume")
    assert r.status_code == 200
    d = r.json()
    assert d["action"] == "RESUME"


@pytest.mark.asyncio
async def test_admin_cluster_status(client_factory):
    async with await client_factory() as client:
        r = await client.get("/admin/cluster-status")
    assert r.status_code == 200
    d = r.json()
    assert "mode" in d
    assert "total_pods" in d
    assert "by_energy_priority" in d


# ────────────────────── Metrics ──────────────────────

@pytest.mark.asyncio
async def test_metrics_root(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/metrics/")
    assert r.status_code == 200
    d = r.json()
    assert "total_savings" in d
    assert "events" in d


@pytest.mark.asyncio
async def test_metrics_savings(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/metrics/savings?hours=24")
    assert r.status_code == 200
    d = r.json()
    assert "total_savings" in d


@pytest.mark.asyncio
async def test_metrics_summary(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/metrics/summary")
    assert r.status_code == 200
    d = r.json()
    assert "total_cumulative_savings" in d
    assert "peak_price_seen" in d
    assert "total_load_shed_events" in d
    assert "projected_annual_savings" in d


@pytest.mark.asyncio
async def test_metrics_recharts(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/metrics/recharts")
    assert r.status_code == 200
    d = r.json()
    assert "priceData" in d
    assert "savingsData" in d
    assert "summary" in d


@pytest.mark.asyncio
async def test_metrics_demo_snapshot(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/metrics/demo-snapshot")
    assert r.status_code == 200
    d = r.json()
    assert len(d["priceData"]) == 50
    assert d["summary"]["totalSaved"] == 992_000.0
    assert d["summary"]["peakPrice"] == 5000.0


# ────────────────────── Demo ──────────────────────

@pytest.mark.asyncio
async def test_demo_inject_storm(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/demo/inject-storm")
    assert r.status_code == 200
    d = r.json()
    assert "priceData" in d
    assert "savingsData" in d
    assert "summary" in d
    assert d["summary"]["peakPrice"] == 5000.0


@pytest.mark.asyncio
async def test_demo_training_status(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/demo/training-status")
    assert r.status_code == 200
    d = r.json()
    assert "status" in d
    assert "current_epoch" in d
    assert "current_loss" in d


# ────────────────────── Dashboard ──────────────────────

@pytest.mark.asyncio
async def test_dashboard_returns_full_payload(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/dashboard")
    assert r.status_code == 200
    d = r.json()

    assert "ercot" in d
    ercot = d["ercot"]
    assert "lmpPrice" in ercot
    assert "gridStatus" in ercot
    assert ercot["gridStatus"] in ("normal", "elevated", "scarcity", "emergency")
    assert "eeaLevel" in ercot
    assert "frequency" in ercot
    assert "totalDemand" in ercot
    assert "totalCapacity" in ercot

    assert "compute" in d
    compute = d["compute"]
    assert "totalLoadMW" in compute
    assert "criticalLoadMW" in compute
    assert "deferredLoadMW" in compute
    assert "remoteLoadMW" in compute
    assert "activePods" in compute
    assert "pausedPods" in compute
    assert "migratedPods" in compute
    assert "totalPods" in compute
    assert "shedReadyMW" in compute
    assert "namespaces" in compute
    assert isinstance(compute["namespaces"], list)
    assert "migration" in compute
    migration = compute["migration"]
    assert "migratedPods" in migration
    assert "migratedMW" in migration
    assert "remoteRegion" in migration
    assert "remoteProvider" in migration
    assert "migrationLatencyMs" in migration
    assert "cloudSpendPerHour" in migration
    assert "accumulatedCloudSpend" in migration
    assert "status" in migration

    assert "financial" in d
    financial = d["financial"]
    assert "avoidedCost" in financial
    assert "demandResponseRevenue" in financial
    assert "cloudSpend" in financial
    assert "netSavings" in financial
    assert "criticalUptime" in financial
    assert "savingsHistory" in financial
    assert "peakPriceToday" in financial
    assert "avgPriceToday" in financial

    assert "logs" in d
    assert isinstance(d["logs"], list)


@pytest.mark.asyncio
async def test_dashboard_namespace_fields(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/dashboard")
    d = r.json()
    for ns in d["compute"]["namespaces"]:
        assert "name" in ns
        assert "priority" in ns
        assert "pods" in ns
        assert "remotePods" in ns
        assert "loadMW" in ns
        assert "remoteLoadMW" in ns
        assert "status" in ns


# ────────────────────── Power Model Endpoints ──────────────────────

@pytest.mark.asyncio
async def test_power_breakdown(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/metrics/power")
    assert r.status_code == 200
    d = r.json()
    assert "total_facility_mw" in d
    assert "total_it_load_mw" in d
    assert "cooling_overhead_mw" in d
    assert "pdu_loss_mw" in d
    assert "pue" in d
    assert "by_workload" in d
    assert "by_criticality" in d
    assert "demand_response" in d
    assert 85.0 <= d["total_facility_mw"] <= 115.0, f"Facility MW out of range: {d['total_facility_mw']}"


@pytest.mark.asyncio
async def test_power_timeline(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/metrics/power/timeline?hours=2")
    assert r.status_code == 200
    d = r.json()
    assert "timeline" in d
    assert "count" in d
    assert isinstance(d["timeline"], list)


@pytest.mark.asyncio
async def test_shed_simulation(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/metrics/shed-simulation?price=5000")
    assert r.status_code == 200
    d = r.json()
    assert "current_draw_mw" in d
    assert "post_shed_draw_mw" in d
    assert "mw_shed" in d
    assert "deployments_affected" in d
    assert "pods_scaled_down" in d
    assert "shed_percentage" in d
    assert "savings_per_hour" in d
    assert "compliant_with_ercot" in d
    assert d["mw_shed"] > 0
    assert d["pods_scaled_down"] > 0


@pytest.mark.asyncio
async def test_shed_simulation_zero_price(client_factory):
    async with await client_factory() as client:
        r = await client.get("/api/metrics/shed-simulation?price=0")
    assert r.status_code == 200
    d = r.json()
    assert d["mw_shed"] == 0
    assert d["pods_scaled_down"] == 0
