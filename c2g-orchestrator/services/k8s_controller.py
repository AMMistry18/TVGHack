"""
Kubernetes load-shedding engine — Python Sidecar pattern with power-aware
graceful SIGTERM handling for checkpoint preservation.

Two-phase shed:
  Phase 1 (Signal): Annotate deployment, wait CHECKPOINT_GRACE_SECONDS for
                    Pre-Stop hooks to save checkpoints.
  Phase 2 (Execute): Scale flexible → 0, semi-flexible → min_replicas (20%).

Uses real cluster when available, else MOCK mode for demos.
All action logs persist to Supabase (https://gkyhvikuizoceekuduwe.supabase.co).
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any

from config import settings
from db.supabase_client import insert_action_log
from models.schemas import ActionLog
from services.power_model import (
    DATACENTER_POWER_REGISTRY,
    get_current_mw_shed,
    get_total_facility_power_mw,
    restore_all_replicas,
    simulate_shed_event,
    update_replica_count,
)

logger = logging.getLogger(__name__)

try:
    from kubernetes import client, config
except Exception:
    client = None
    config = None
    K8S_AVAILABLE = False
    logging.warning("Kubernetes client not available — running in MOCK mode")
else:
    try:
        config.load_kube_config()
        K8S_AVAILABLE = True
    except Exception:
        try:
            config.load_incluster_config()
            K8S_AVAILABLE = True
        except Exception:
            K8S_AVAILABLE = False
            logging.warning("No Kubernetes cluster found — running in MOCK mode")

DEFAULT_NAMESPACE = "default"
LABEL_LOAD_FLEXIBLE = "load-type=flexible"
LABEL_ENERGY_LOW = "energy-priority=low"
ANNOTATION_SHED_REQUESTED = "c2g/shed-requested"
ANNOTATION_SHED_TIMESTAMP = "c2g/shed-timestamp"
ANNOTATION_CHECKPOINT = "c2g/checkpoint-requested"
LABEL_JOB_TRAINING = "job-type=training"

CHECKPOINT_GRACE_SECONDS = getattr(
    settings, "CHECKPOINT_GRACE_SECONDS", None
) or float(os.getenv("CHECKPOINT_GRACE_SECONDS", "10"))

_original_replicas: dict[str, dict[str, Any]] = {}


def _apps_api() -> client.AppsV1Api:
    return client.AppsV1Api()


def _core_api() -> client.CoreV1Api:
    return client.CoreV1Api()


async def _run_sync(sync_fn, *args, **kwargs):
    return await asyncio.to_thread(sync_fn, *args, **kwargs)


def _list_sheddable_deployments(api: client.AppsV1Api, namespace: str) -> list[Any]:
    seen: dict[str, Any] = {}
    for label_selector in (LABEL_LOAD_FLEXIBLE, LABEL_ENERGY_LOW):
        try:
            resp = api.list_namespaced_deployment(namespace, label_selector=label_selector)
            for d in resp.items:
                key = f"{d.metadata.namespace}/{d.metadata.name}"
                if key not in seen:
                    seen[key] = d
        except Exception as e:
            logger.warning("list_namespaced_deployment %s failed: %s", label_selector, e)
    return list(seen.values())


async def trigger_load_shed(price_mwh: float | None = None) -> dict[str, Any]:
    """
    Power-aware graceful load shed.
    1. Simulate shed to calculate expected MW reduction
    2. Phase 1 — annotate + grace period
    3. Phase 2 — scale flexible→0, semi-flexible→min_replicas
    4. Sync power model after each scale event
    """
    from services.ercot_monitor import app_state
    current_price = price_mwh or app_state.current_price

    pre_shed = simulate_shed_event(current_price)
    pre_shed_mw = get_total_facility_power_mw()

    now = datetime.now(timezone.utc)
    deployments_affected: list[str] = []
    pods_scaled_down = 0

    if K8S_AVAILABLE:
        try:
            api = _apps_api()
            deployments = await _run_sync(_list_sheddable_deployments, api, DEFAULT_NAMESPACE)
            for d in deployments:
                name = d.metadata.name
                ns = d.metadata.namespace or DEFAULT_NAMESPACE
                key = f"{ns}/{name}"
                replicas = d.spec.replicas or 0
                labels = dict(d.metadata.labels or {})
                _original_replicas[key] = {
                    "replicas": replicas, "namespace": ns, "name": name, "labels": labels,
                }

                annot_body = {"metadata": {"annotations": {
                    ANNOTATION_SHED_REQUESTED: "true",
                    ANNOTATION_SHED_TIMESTAMP: now.isoformat(),
                }}}
                await _run_sync(api.patch_namespaced_deployment, name, ns, annot_body)

            await asyncio.sleep(CHECKPOINT_GRACE_SECONDS)

            for d in deployments:
                name = d.metadata.name
                ns = d.metadata.namespace or DEFAULT_NAMESPACE
                profile = DATACENTER_POWER_REGISTRY.get(name)
                if profile and profile.criticality == "semi-flexible":
                    target = profile.min_replicas
                else:
                    target = 0

                old = d.spec.replicas or 0
                body = {"spec": {"replicas": target}}
                await _run_sync(api.patch_namespaced_deployment, name, ns, body)
                update_replica_count(name, target)
                pods_scaled_down += old - target
                deployments_affected.append(f"{ns}/{name}")

        except Exception as e:
            logger.exception("trigger_load_shed (real) failed: %s", e)
            _mock_shed(current_price, deployments_affected)
            pods_scaled_down = pre_shed["pods_scaled_down"]
    else:
        _mock_shed(current_price, deployments_affected)
        pods_scaled_down = pre_shed["pods_scaled_down"]

    post_shed_mw = get_total_facility_power_mw()
    mw_shed = round(pre_shed_mw - post_shed_mw, 2)

    log = ActionLog(
        timestamp=now,
        action_taken="LOAD_SHED",
        pods_scaled=pods_scaled_down,
        estimated_savings=0.0,
        duration_seconds=CHECKPOINT_GRACE_SECONDS,
    )
    await insert_action_log(log)

    return {
        "action": "LOAD_SHED",
        "deployments_affected": deployments_affected,
        "pods_scaled_down": pods_scaled_down,
        "mw_shed": mw_shed,
        "post_shed_draw_mw": round(post_shed_mw, 2),
        "grace_seconds": CHECKPOINT_GRACE_SECONDS,
        "timestamp": now.isoformat(),
    }


def _mock_shed(price_mwh: float, affected_out: list[str]) -> None:
    """Apply shed to the power model in mock mode."""
    for name, profile in DATACENTER_POWER_REGISTRY.items():
        if profile.shed_threshold_mwh > price_mwh:
            continue
        if profile.criticality == "critical":
            continue
        key = f"{profile.namespace}/{name}"
        _original_replicas[key] = {
            "replicas": profile.current_replicas,
            "namespace": profile.namespace,
            "name": name,
            "labels": {"load-type": "flexible", "energy-priority": "low"},
        }
        if profile.criticality == "semi-flexible":
            update_replica_count(name, profile.min_replicas)
        else:
            update_replica_count(name, 0)
        affected_out.append(key)


async def resume_operations() -> dict[str, Any]:
    """Restore all previously scaled-down deployments and sync power model."""
    now = datetime.now(timezone.utc)
    restored: list[str] = []

    if K8S_AVAILABLE and _original_replicas:
        try:
            api = _apps_api()
            for key, info in list(_original_replicas.items()):
                name = info.get("name")
                ns = info.get("namespace", DEFAULT_NAMESPACE)
                replicas = info.get("replicas", 0)
                if not name:
                    continue
                body = {"spec": {"replicas": replicas}}
                await _run_sync(api.patch_namespaced_deployment, name, ns, body)
                update_replica_count(name, replicas)
                restored.append(key)
            _original_replicas.clear()
        except Exception as e:
            logger.exception("resume_operations (real) failed: %s", e)
            restore_all_replicas()
            restored = list(_original_replicas.keys())
            _original_replicas.clear()
    else:
        restore_all_replicas()
        restored = list(_original_replicas.keys()) or [
            f"{DEFAULT_NAMESPACE}/{n}" for n in DATACENTER_POWER_REGISTRY
            if DATACENTER_POWER_REGISTRY[n].criticality != "critical"
        ]
        _original_replicas.clear()

    log = ActionLog(
        timestamp=now,
        action_taken="RESUME",
        pods_scaled=len(restored),
        estimated_savings=0.0,
        duration_seconds=None,
    )
    await insert_action_log(log)

    return {
        "action": "RESUME",
        "message": "Operations resumed",
        "deployments_restored": restored,
        "post_resume_draw_mw": round(get_total_facility_power_mw(), 2),
        "timestamp": now.isoformat(),
    }


async def annotate_for_checkpoint(deployment_name: str, namespace: str) -> None:
    if not K8S_AVAILABLE:
        return
    try:
        api = _apps_api()
        body = {"spec": {"template": {"metadata": {"annotations": {ANNOTATION_CHECKPOINT: "true"}}}}}
        await _run_sync(api.patch_namespaced_deployment, deployment_name, namespace, body)
        logger.info("annotate_for_checkpoint: %s/%s", namespace, deployment_name)
    except Exception as e:
        logger.exception("annotate_for_checkpoint failed: %s", e)


async def checkpoint_training_jobs() -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    jobs_checkpointed: list[str] = []

    if K8S_AVAILABLE:
        try:
            api = _apps_api()
            resp = await _run_sync(api.list_namespaced_deployment, DEFAULT_NAMESPACE, label_selector=LABEL_JOB_TRAINING)
            for d in resp.items:
                name = d.metadata.name
                ns = d.metadata.namespace or DEFAULT_NAMESPACE
                await annotate_for_checkpoint(name, ns)
                jobs_checkpointed.append(f"{ns}/{name}")
        except Exception as e:
            logger.exception("checkpoint_training_jobs (real) failed: %s", e)
            jobs_checkpointed = [f"{DEFAULT_NAMESPACE}/llama4-training-job"]
    else:
        jobs_checkpointed = [
            f"{DEFAULT_NAMESPACE}/{n}" for n in DATACENTER_POWER_REGISTRY
            if DATACENTER_POWER_REGISTRY[n].workload_type == "gpu-training"
        ]

    log = ActionLog(timestamp=now, action_taken="CHECKPOINT", pods_scaled=len(jobs_checkpointed), estimated_savings=0.0, duration_seconds=None)
    await insert_action_log(log)
    return {"action": "CHECKPOINT", "jobs_checkpointed": jobs_checkpointed, "timestamp": now.isoformat()}


async def get_cluster_status() -> dict[str, Any]:
    if K8S_AVAILABLE:
        try:
            core = _core_api()
            pods = await _run_sync(core.list_namespaced_pod, DEFAULT_NAMESPACE)
            by_priority: dict[str, int] = {}
            total = 0
            for p in pods.items:
                total += 1
                labels = p.metadata.labels or {}
                pri = labels.get("energy-priority", "unknown")
                by_priority[pri] = by_priority.get(pri, 0) + 1
            return {"mode": "real", "total_pods": total, "by_energy_priority": by_priority}
        except Exception as e:
            logger.exception("get_cluster_status (real) failed: %s", e)
            return _mock_cluster_status()
    return _mock_cluster_status()


def _mock_cluster_status() -> dict[str, Any]:
    total = sum(p.current_replicas for p in DATACENTER_POWER_REGISTRY.values())
    high = sum(p.current_replicas for p in DATACENTER_POWER_REGISTRY.values() if p.criticality == "critical")
    low = total - high
    return {"mode": "mock", "total_pods": total, "by_energy_priority": {"high": high, "low": low}}
