"""
C2G Prometheus Exporter
Exposes ERCOT real-time price as a Prometheus gauge metric.
KEDA scrapes this to autonomously scale AI workloads.
Run: uvicorn k8s.keda.prometheus_exporter:app --host 0.0.0.0 --port 9090
(from c2g-orchestrator directory, or set PYTHONPATH)
"""
import asyncio
import sys
from pathlib import Path

# Allow importing from repo root when run as script or uvicorn
_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from prometheus_client import Gauge, generate_latest, CONTENT_TYPE_LATEST

try:
    from services.ercot_monitor import app_state
except Exception:
    app_state = type("AppState", (), {"current_price": 30.0})()

from fastapi import FastAPI
from fastapi.responses import Response

# Raw price — for dashboards and optional KEDA queries
ercot_price_mwh = Gauge(
    "ercot_realtime_price_mwh",
    "Current ERCOT Real-Time LMP price in $/MWh",
)

# Per-deployment recommended replicas (0 when price above threshold); KEDA uses these with threshold 1
RECOMMENDED_GAUGES = {
    "llama4-training-job": (1000, 10),
    "stable-diffusion-batch": (500, 8),
    "data-preprocessing-pipeline": (200, 6),
}
ercot_recommended_replicas = Gauge(
    "ercot_recommended_replicas",
    "Recommended replicas for C2G shed (0 when price above threshold)",
    ["deployment"],
)


async def update_gauge():
    while True:
        try:
            price = app_state.current_price
            ercot_price_mwh.set(price)
            for name, (threshold, max_replicas) in RECOMMENDED_GAUGES.items():
                val = 0 if price >= threshold else max_replicas
                ercot_recommended_replicas.labels(deployment=name).set(val)
        except Exception:
            ercot_price_mwh.set(0.0)
            for name, (_, max_replicas) in RECOMMENDED_GAUGES.items():
                ercot_recommended_replicas.labels(deployment=name).set(max_replicas)
        await asyncio.sleep(5)


app = FastAPI(title="C2G Prometheus Exporter", version="1.0.0")


@app.on_event("startup")
async def startup():
    asyncio.create_task(update_gauge())


@app.get("/metrics")
async def metrics():
    return Response(
        generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )


@app.get("/health")
async def health():
    return {"status": "ok", "current_price": app_state.current_price}
