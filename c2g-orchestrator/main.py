"""
C2G Orchestrator — FastAPI application entrypoint.

Startup sequence:
  1. Validate env vars (SUPABASE_URL, SUPABASE_KEY)
  2. Test Supabase connection
  3. Test Kubernetes connection
  4. Start Prometheus exporter background task (port 9090)
  5. Start ERCOT polling loop
  6. Start WebSocket broadcast loop
"""
from contextlib import asynccontextmanager
import asyncio
import logging
import os
import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.websockets import WebSocket

from config import settings
from routers import admin, dashboard, demo, grid, metrics
from services.ercot_monitor import app_state, start_monitoring

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("c2g")

_ws_connections: set[WebSocket] = set()
_ws_broadcast_task: asyncio.Task | None = None
_prometheus_task: asyncio.Task | None = None


def _validate_env():
    """Fail fast with clear messages if required env vars are missing."""
    if not settings.SUPABASE_URL:
        logger.critical("SUPABASE_URL is not set. Exiting.")
        sys.exit(1)
    if not settings.SUPABASE_KEY:
        logger.critical("SUPABASE_KEY is not set. Set it in .env or environment. Exiting.")
        sys.exit(1)
    logger.info("Config loaded: SUPABASE_URL=%s, FACILITY_MW=%s, BASE_CONTRACT_PRICE=%s",
                settings.SUPABASE_URL, settings.FACILITY_MW, settings.BASE_CONTRACT_PRICE)


async def _test_supabase():
    """Ping Supabase to confirm connectivity."""
    try:
        from db.supabase_client import get_db
        client = get_db()
        await asyncio.to_thread(
            lambda: client.table("grid_events").select("id").limit(1).execute()
        )
        logger.info("Supabase CONNECTED (%s)", settings.SUPABASE_URL)
    except Exception as e:
        logger.warning("Supabase connection test failed: %s (continuing — writes may fail)", e)


def _test_kubernetes():
    """Check if a Kubernetes cluster is reachable."""
    try:
        from services.k8s_controller import K8S_AVAILABLE
        if K8S_AVAILABLE:
            logger.info("K8s CONNECTED")
        else:
            logger.info("K8s MOCK MODE (no cluster found)")
    except Exception:
        logger.info("K8s MOCK MODE (kubernetes package not available)")


async def _run_prometheus_exporter():
    """Run the Prometheus metrics exporter on port 9090 as a background task."""
    try:
        import uvicorn
        from k8s.keda.prometheus_exporter import app as prom_app
        config = uvicorn.Config(prom_app, host="0.0.0.0", port=9090, log_level="warning")
        server = uvicorn.Server(config)
        logger.info("Prometheus exporter starting on :9090")
        await server.serve()
    except ImportError:
        logger.warning("prometheus_client or uvicorn not installed — skipping Prometheus exporter")
    except OSError as e:
        logger.warning("Prometheus exporter failed to bind :9090: %s (continuing)", e)
    except Exception as e:
        logger.warning("Prometheus exporter error: %s", e)


def _app_state_json() -> dict:
    return {
        "current_price": app_state.current_price,
        "is_spike_active": app_state.is_spike_active,
        "spike_end_time": (
            app_state.spike_end_time.isoformat() if app_state.spike_end_time else None
        ),
        "load_shed_active": app_state.load_shed_active,
        "last_event_id": app_state.last_event_id,
    }


async def _ws_broadcast_loop() -> None:
    while True:
        await asyncio.sleep(2)
        dead = set()
        for ws in _ws_connections:
            try:
                await ws.send_json(_app_state_json())
            except Exception:
                dead.add(ws)
        for ws in dead:
            _ws_connections.discard(ws)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Full startup sequence → yield → graceful shutdown."""
    global _ws_broadcast_task, _prometheus_task

    # 1. Validate config
    _validate_env()

    # 2. Test Supabase
    await _test_supabase()

    # 3. Test Kubernetes
    _test_kubernetes()

    # 4. Start Prometheus exporter (background)
    _prometheus_task = asyncio.create_task(_run_prometheus_exporter())

    # 5. Start ERCOT polling loop
    monitor_task = await start_monitoring()

    # 6. Start WebSocket broadcast
    _ws_broadcast_task = asyncio.create_task(_ws_broadcast_loop())

    logger.info("C2G Orchestrator online. Dashboard: http://localhost:3000")

    yield

    # Shutdown
    monitor_task.cancel()
    if _ws_broadcast_task:
        _ws_broadcast_task.cancel()
    if _prometheus_task:
        _prometheus_task.cancel()
    for t in [monitor_task, _ws_broadcast_task, _prometheus_task]:
        if t:
            try:
                await t
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="C2G Orchestrator",
    description="Middleware agent bridging ERCOT grid price signals to Kubernetes workload orchestration",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal error", "detail": str(exc)},
    )


app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"])
app.include_router(grid.router, prefix="/api/grid", tags=["grid"])
app.include_router(demo.router, prefix="/api/demo", tags=["demo"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])


@app.get("/health")
async def health():
    """Health check — returns status, version, and current price."""
    return {
        "status": "online",
        "version": "1.0.0",
        "current_price": app_state.current_price,
        "load_shed_active": app_state.load_shed_active,
    }


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    """Accept WebSocket; broadcast app_state as JSON every 2 seconds."""
    await websocket.accept()
    _ws_connections.add(websocket)
    try:
        while True:
            try:
                await websocket.receive_text()
            except Exception:
                break
    finally:
        _ws_connections.discard(websocket)
