"""
C2G Orchestrator — FastAPI application entrypoint.
"""
from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import admin, grid, metrics
from services.ercot_monitor import run_ercot_monitor


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: start ERCOT monitor task. Shutdown: cancel it."""
    task = asyncio.create_task(run_ercot_monitor())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="C2G Orchestrator",
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

app.include_router(admin.router, prefix="/admin")
app.include_router(metrics.router, prefix="/api/metrics")
app.include_router(grid.router, prefix="/api/grid")


@app.get("/health")
async def health():
    """Health check."""
    return {"status": "online", "version": "1.0.0"}
