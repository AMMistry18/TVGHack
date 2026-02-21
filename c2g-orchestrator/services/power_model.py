"""
Realistic power model for a 100MW hyperscale AI data center on ERCOT.

Power arithmetic (IT load at full capacity):
  llama4-training-job:         25 × 10.0kW +  50kW =   300kW
  stable-diffusion-batch:      15 ×  8.0kW +  20kW =   140kW
  data-preprocessing-pipeline: 50 ×  0.5kW +  10kW =    35kW
  ml-hyperparameter-sweep:     20 ×  6.0kW +  15kW =   135kW
  llm-inference-serving:       30 ×  7.0kW +  30kW =   240kW
  embedding-api:               10 ×  3.0kW +  10kW =    40kW
  customer-api:                10 ×  0.2kW +   5kW =     7kW
  storage-controller:           3 ×  1.0kW + 200kW =   203kW
  cluster-control-plane:        3 ×  0.5kW +  50kW =    51.5kW
  ─────────────────────────────────────────────────────────────
  Total IT load:                                     1,151.5 kW  (×62 scale factor → ~71.4 MW)

We apply a SCALE_FACTOR of 62 so the digital-twin sums to a realistic
100MW facility.  The per-replica numbers above are "per logical replica"
in our model; the scale factor accounts for the hundreds of physical
nodes behind each logical replica that the demo can't actually deploy.

  IT load  =  1,151.5 kW × 62 ≈ 71,393 kW  ≈ 71.4 MW
  Cooling  =  IT × 0.35                     ≈ 25.0 MW  (PUE 1.35, realistic for Texas)
  PDU loss =  IT × 0.05                     ≈  3.6 MW
  ──────────────────────────────────────────────────────
  Total facility                             ≈ 100 MW  ✓
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

BASE_CONTRACT_PRICE: float = settings.BASE_CONTRACT_PRICE

# Scale factor: multiplies all kW values so the facility totals ~100MW.
SCALE_FACTOR: float = 62.0

PUE_COOLING_RATIO: float = 0.35   # cooling = IT × 0.35
PDU_LOSS_RATIO: float = 0.05      # PDU loss = IT × 0.05


@dataclass
class WorkloadPowerProfile:
    deployment_name: str
    namespace: str
    max_replicas: int
    current_replicas: int
    power_per_replica_kw: float
    power_at_idle_kw: float
    criticality: str            # "critical" | "semi-flexible" | "flexible"
    shed_threshold_mwh: float
    workload_type: str          # "gpu-training" | "gpu-inference" | "cpu-batch" | "storage" | "control-plane"
    min_replicas: int = 0       # floor for semi-flexible workloads

    @property
    def current_power_kw(self) -> float:
        return (self.current_replicas * self.power_per_replica_kw) + self.power_at_idle_kw

    @property
    def max_power_kw(self) -> float:
        return (self.max_replicas * self.power_per_replica_kw) + self.power_at_idle_kw

    @property
    def sheddable_power_kw(self) -> float:
        sheddable_replicas = max(0, self.current_replicas - self.min_replicas)
        return sheddable_replicas * self.power_per_replica_kw


# ── Digital twin of a 100MW Texas AI data center ──────────────────────────

DATACENTER_POWER_REGISTRY: dict[str, WorkloadPowerProfile] = {

    # ── GPU TRAINING CLUSTER ─────────────────────────────────────────
    # 25 DGX H100 nodes, each = 8×H100 (700W) + host overhead ≈ 10kW
    "llama4-training-job": WorkloadPowerProfile(
        deployment_name="llama4-training-job",
        namespace="default",
        max_replicas=25,
        current_replicas=25,
        power_per_replica_kw=10.0,
        power_at_idle_kw=50.0,
        criticality="flexible",
        shed_threshold_mwh=1000.0,
        workload_type="gpu-training",
    ),
    # Full load: (25 × 10) + 50 = 300 kW

    "stable-diffusion-batch": WorkloadPowerProfile(
        deployment_name="stable-diffusion-batch",
        namespace="default",
        max_replicas=15,
        current_replicas=15,
        power_per_replica_kw=8.0,
        power_at_idle_kw=20.0,
        criticality="flexible",
        shed_threshold_mwh=500.0,
        workload_type="gpu-training",
    ),
    # Full load: (15 × 8) + 20 = 140 kW

    "data-preprocessing-pipeline": WorkloadPowerProfile(
        deployment_name="data-preprocessing-pipeline",
        namespace="default",
        max_replicas=50,
        current_replicas=50,
        power_per_replica_kw=0.5,
        power_at_idle_kw=10.0,
        criticality="flexible",
        shed_threshold_mwh=200.0,
        workload_type="cpu-batch",
    ),
    # Full load: (50 × 0.5) + 10 = 35 kW

    "ml-hyperparameter-sweep": WorkloadPowerProfile(
        deployment_name="ml-hyperparameter-sweep",
        namespace="default",
        max_replicas=20,
        current_replicas=20,
        power_per_replica_kw=6.0,
        power_at_idle_kw=15.0,
        criticality="flexible",
        shed_threshold_mwh=1000.0,
        workload_type="gpu-training",
    ),
    # Full load: (20 × 6) + 15 = 135 kW

    # ── GPU INFERENCE CLUSTER ────────────────────────────────────────
    "llm-inference-serving": WorkloadPowerProfile(
        deployment_name="llm-inference-serving",
        namespace="default",
        max_replicas=30,
        current_replicas=30,
        power_per_replica_kw=7.0,
        power_at_idle_kw=30.0,
        criticality="semi-flexible",
        shed_threshold_mwh=5000.0,
        workload_type="gpu-inference",
        min_replicas=6,
    ),
    # Full load: (30 × 7) + 30 = 240 kW  |  Floor: 6 replicas → (6×7)+30 = 72 kW

    "embedding-api": WorkloadPowerProfile(
        deployment_name="embedding-api",
        namespace="default",
        max_replicas=10,
        current_replicas=10,
        power_per_replica_kw=3.0,
        power_at_idle_kw=10.0,
        criticality="semi-flexible",
        shed_threshold_mwh=3000.0,
        workload_type="gpu-inference",
        min_replicas=2,
    ),
    # Full load: (10 × 3) + 10 = 40 kW

    # ── CUSTOMER-FACING API ──────────────────────────────────────────
    "customer-api": WorkloadPowerProfile(
        deployment_name="customer-api",
        namespace="default",
        max_replicas=10,
        current_replicas=10,
        power_per_replica_kw=0.2,
        power_at_idle_kw=5.0,
        criticality="critical",
        shed_threshold_mwh=999999.0,
        workload_type="cpu-batch",
    ),
    # Full load: (10 × 0.2) + 5 = 7 kW

    # ── INFRASTRUCTURE (NEVER SHED) ──────────────────────────────────
    "storage-controller": WorkloadPowerProfile(
        deployment_name="storage-controller",
        namespace="default",
        max_replicas=3,
        current_replicas=3,
        power_per_replica_kw=1.0,
        power_at_idle_kw=200.0,
        criticality="critical",
        shed_threshold_mwh=999999.0,
        workload_type="storage",
    ),
    # Full load: (3 × 1) + 200 = 203 kW

    "cluster-control-plane": WorkloadPowerProfile(
        deployment_name="cluster-control-plane",
        namespace="default",
        max_replicas=3,
        current_replicas=3,
        power_per_replica_kw=0.5,
        power_at_idle_kw=50.0,
        criticality="critical",
        shed_threshold_mwh=999999.0,
        workload_type="control-plane",
    ),
    # Full load: (3 × 0.5) + 50 = 51.5 kW
}


# ── Public API ───────────────────────────────────────────────────────────

def _raw_it_load_kw() -> float:
    """Sum of current_power_kw across all deployments (unscaled)."""
    return sum(p.current_power_kw for p in DATACENTER_POWER_REGISTRY.values())


def get_total_facility_power_kw() -> float:
    """Total facility draw in kW including cooling and PDU overhead."""
    it_kw = _raw_it_load_kw() * SCALE_FACTOR
    cooling_kw = it_kw * PUE_COOLING_RATIO
    pdu_kw = it_kw * PDU_LOSS_RATIO
    return it_kw + cooling_kw + pdu_kw


def get_total_facility_power_mw() -> float:
    return get_total_facility_power_kw() / 1000.0


def get_it_load_mw() -> float:
    return (_raw_it_load_kw() * SCALE_FACTOR) / 1000.0


def get_sheddable_power_kw(price_threshold: float) -> float:
    """Total sheddable kW if price crosses this threshold (scaled)."""
    raw = sum(
        p.sheddable_power_kw
        for p in DATACENTER_POWER_REGISTRY.values()
        if p.shed_threshold_mwh <= price_threshold
    )
    return raw * SCALE_FACTOR


def get_sheddable_power_mw(price_threshold: float) -> float:
    return get_sheddable_power_kw(price_threshold) / 1000.0


def get_power_breakdown() -> dict[str, Any]:
    """Detailed breakdown by workload type and criticality."""
    it_kw = _raw_it_load_kw() * SCALE_FACTOR
    cooling_kw = it_kw * PUE_COOLING_RATIO
    pdu_kw = it_kw * PDU_LOSS_RATIO
    total_kw = it_kw + cooling_kw + pdu_kw

    by_workload: dict[str, dict[str, Any]] = {}
    by_criticality: dict[str, float] = {}

    for p in DATACENTER_POWER_REGISTRY.values():
        wt = p.workload_type
        scaled_mw = (p.current_power_kw * SCALE_FACTOR) / 1000.0
        if wt not in by_workload:
            by_workload[wt] = {"mw": 0.0, "deployments": [], "sheddable": False}
        by_workload[wt]["mw"] = round(by_workload[wt]["mw"] + scaled_mw, 2)
        by_workload[wt]["deployments"].append(p.deployment_name)
        if p.criticality == "flexible":
            by_workload[wt]["sheddable"] = True
        elif p.criticality == "semi-flexible" and by_workload[wt]["sheddable"] is not True:
            by_workload[wt]["sheddable"] = "partial"

        crit = p.criticality
        by_criticality[crit] = by_criticality.get(crit, 0.0) + scaled_mw

    total_mw = total_kw / 1000.0
    by_crit_out = {}
    for crit, mw in by_criticality.items():
        by_crit_out[crit] = {
            "mw": round(mw, 2),
            "percentage": round(mw / total_mw * 100, 1) if total_mw > 0 else 0,
        }

    return {
        "total_facility_mw": round(total_mw, 2),
        "total_it_load_mw": round(it_kw / 1000.0, 2),
        "cooling_overhead_mw": round(cooling_kw / 1000.0, 2),
        "pdu_loss_mw": round(pdu_kw / 1000.0, 2),
        "scale_factor": SCALE_FACTOR,
        "pue": round(1 + PUE_COOLING_RATIO + PDU_LOSS_RATIO, 2),
        "by_workload": by_workload,
        "by_criticality": by_crit_out,
    }


def simulate_shed_event(price_mwh: float) -> dict[str, Any]:
    """Model what WOULD happen at this price. Does NOT change replicas."""
    current_kw = get_total_facility_power_kw()
    shed_kw: float = 0.0
    deployments_affected: list[str] = []
    pods_down: int = 0

    for p in DATACENTER_POWER_REGISTRY.values():
        if p.shed_threshold_mwh > price_mwh:
            continue
        if p.criticality == "critical":
            continue
        if p.criticality == "semi-flexible":
            removable = max(0, p.current_replicas - p.min_replicas)
        else:
            removable = p.current_replicas
        if removable <= 0:
            continue
        shed_kw += removable * p.power_per_replica_kw * SCALE_FACTOR
        pods_down += removable
        deployments_affected.append(p.deployment_name)

    post_shed_it = (_raw_it_load_kw() * SCALE_FACTOR) - shed_kw
    post_shed_total = post_shed_it * (1 + PUE_COOLING_RATIO + PDU_LOSS_RATIO)

    current_mw = current_kw / 1000.0
    post_mw = post_shed_total / 1000.0
    mw_shed = current_mw - post_mw

    return {
        "current_draw_mw": round(current_mw, 2),
        "post_shed_draw_mw": round(post_mw, 2),
        "mw_shed": round(mw_shed, 2),
        "deployments_affected": deployments_affected,
        "pods_scaled_down": pods_down,
        "shed_percentage": round(mw_shed / current_mw * 100, 1) if current_mw > 0 else 0,
        "savings_per_hour": round((price_mwh - BASE_CONTRACT_PRICE) * mw_shed, 2) if price_mwh > BASE_CONTRACT_PRICE else 0.0,
        "compliant_with_ercot": mw_shed >= 10.0,
    }


def update_replica_count(deployment_name: str, new_replicas: int) -> None:
    """Sync the power model after a real/mock scale event."""
    profile = DATACENTER_POWER_REGISTRY.get(deployment_name)
    if profile is None:
        return
    old_kw = profile.current_power_kw * SCALE_FACTOR
    profile.current_replicas = max(0, min(new_replicas, profile.max_replicas))
    new_kw = profile.current_power_kw * SCALE_FACTOR
    delta = new_kw - old_kw
    logger.info(
        "Power model update %s: %.1f kW → %.1f kW (delta: %+.1f kW, %.2f MW)",
        deployment_name, old_kw, new_kw, delta, delta / 1000.0,
    )


def restore_all_replicas() -> None:
    """Reset every deployment to max_replicas (resume all)."""
    for p in DATACENTER_POWER_REGISTRY.values():
        p.current_replicas = p.max_replicas


def get_avoided_cost_precise(price_mwh: float, duration_hours: float) -> float:
    """Use actual MW shed from the power registry instead of hardcoded 100MW."""
    shed_mw = get_total_facility_power_mw() - _post_shed_mw()
    if shed_mw <= 0:
        shed_mw = get_sheddable_power_mw(price_mwh)
    return max(0, (price_mwh - BASE_CONTRACT_PRICE) * shed_mw * duration_hours)


def _post_shed_mw() -> float:
    """Current draw based on current_replicas (may be reduced during shed)."""
    return get_total_facility_power_mw()


def get_current_mw_shed() -> float:
    """Difference between max capacity and current draw — the MW currently being shed."""
    max_it = sum(p.max_power_kw for p in DATACENTER_POWER_REGISTRY.values()) * SCALE_FACTOR
    cur_it = _raw_it_load_kw() * SCALE_FACTOR
    delta_it = max_it - cur_it
    return delta_it * (1 + PUE_COOLING_RATIO + PDU_LOSS_RATIO) / 1000.0


def get_demand_response_credits() -> dict[str, Any]:
    """
    Two revenue streams from ERCOT demand response participation:
    1. Avoided Cost — (spike - contract) × MW_shed × hours (calculated elsewhere per event)
    2. DR Capacity Payment — $50,000/MW/year for enrolled flexible capacity
    """
    flexible_mw = 0.0
    for p in DATACENTER_POWER_REGISTRY.values():
        if p.criticality in ("flexible", "semi-flexible"):
            flexible_mw += (p.sheddable_power_kw * SCALE_FACTOR) / 1000.0

    annual_capacity_payment = flexible_mw * 50_000.0

    return {
        "enrolled_flexible_mw": round(flexible_mw, 2),
        "annual_capacity_payment": round(annual_capacity_payment, 2),
        "monthly_capacity_payment": round(annual_capacity_payment / 12, 2),
        "capacity_rate_per_mw_year": 50_000.0,
    }
