# C2G Orchestrator — Architecture Deep Dive

Technical documentation for the C2G Orchestrator system architecture,
designed for judges and engineers who want to understand the internals.

---

## 1. Two-Layer Kubernetes Strategy

C2G uses two complementary control planes for workload management:

### Layer 1: Python Sidecar (Fast, Imperative)

The FastAPI service (`services/k8s_controller.py`) directly interfaces with the
Kubernetes API via `kubernetes-client`. When ERCOT prices cross thresholds, the
controller immediately:

1. Annotates target deployments (`c2g/shed-requested: "true"`)
2. Waits `CHECKPOINT_GRACE_SECONDS` for pre-stop hooks to save state
3. Patches `spec.replicas` to 0

**Advantages:** Sub-second response, full control over checkpoint timing,
action logging to Supabase for audit compliance.

### Layer 2: KEDA Controller (Resilient, Declarative)

KEDA `ScaledObject` resources watch a Prometheus metric
(`ercot_recommended_replicas`) exposed by our exporter on port 9090.
If the Python sidecar crashes, KEDA continues to enforce scaling rules
autonomously using the Kubernetes control plane.

**Advantages:** Self-healing (survives Python service restarts), native K8s
reconciliation loop, no single point of failure.

### Why Both?

| Scenario | Python Sidecar | KEDA |
|----------|---------------|------|
| Normal operation | Primary controller | Standby |
| Python service crash | Down | Takes over automatically |
| Checkpoint required | Orchestrates graceful shutdown | N/A (no app-level awareness) |
| Network partition to Prometheus | Works (direct K8s API) | Stale metrics, maintains last state |

The two layers are **not redundant** — they complement each other. The sidecar
handles stateful operations (checkpointing, annotation), while KEDA provides
the availability guarantee.

---

## 2. The Waterfall Shed

Load shedding follows a tiered "waterfall" strategy that maximizes demand
response credits while minimizing operational impact:

```
ERCOT Price    Action                          Workloads Affected
─────────────────────────────────────────────────────────────────
< $100/MWh     NORMAL                          None
$100-$200      ELEVATED — Pre-stage             Checkpoint saves initiated
               checkpoints, warm migration
               targets

$200-$500      WARNING — Shed Tier 1            data-preprocessing-pipeline
               6 replicas → 0                   (6 pods, lowest priority)

$500-$1000     EMERGENCY — Shed Tier 2          + stable-diffusion-batch
               Tiers 1+2 → 0                   (8 pods, batch workload)

> $1000        CRITICAL — Full shed             + llama4-training-job
               All flexible workloads → 0       (10 pods, after checkpoint)
               Burst-to-cloud migration         Migrate eligible to PJM-East
─────────────────────────────────────────────────────────────────
```

### Why Waterfall?

- **$200 threshold:** Cheapest workloads first — preprocessing can restart from
  any point, no state to preserve.
- **$500 threshold:** Batch inference has implicit checkpoints (per-batch).
  Shedding here captures most demand response value.
- **$1000 threshold:** Training jobs require explicit checkpoint saves.
  The grace period ensures zero epoch loss.

This tiered approach means C2G sheds **6 pods at $200** instead of all 24 at once,
minimizing disruption when prices briefly spike and return.

---

## 3. State Preservation

The checkpoint/resume flow ensures AI training survives grid emergencies with
zero progress loss.

### Sequence Diagram

```
ERCOT Price > $1000
       │
       ▼
┌──────────────────┐
│  C2G Controller  │──── Phase 1: Annotate deployment
│  (Python)        │     c2g/shed-requested: "true"
└────────┬─────────┘     c2g/shed-timestamp: <ISO>
         │
         │  CHECKPOINT_GRACE_SECONDS (default: 10s)
         │
         ▼
┌──────────────────┐
│  Kubernetes      │──── Initiates rolling update (annotation change)
│  Control Plane   │     Sends SIGTERM to pods
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Pod Pre-Stop    │──── lifecycle.preStop.exec runs
│  Hook            │     k8s/preStop-hook.py executes
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Training        │──── SIGTERM handler fires
│  Container       │     training_sim.py saves checkpoint:
│  (training_sim)  │     {epoch, loss, timestamp, reason: "emergency"}
└────────┬─────────┘     Writes to /checkpoints/LATEST
         │
         │  terminationGracePeriodSeconds: 30
         │
         ▼
┌──────────────────┐
│  C2G Controller  │──── Phase 2: Patch replicas → 0
│  (Python)        │     Pod terminated after checkpoint saved
└──────────────────┘

       ... price normalizes ...

┌──────────────────┐
│  C2G Controller  │──── resume_operations()
│  (Python)        │     Restore replicas from _original_replicas
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  New Pod Starts  │──── training_sim.py reads /checkpoints/LATEST
│  (training_sim)  │     Resumes from exact epoch + loss
└──────────────────┘     Zero epochs lost
```

### Key Design Decisions

- **PersistentVolumeClaim (ReadWriteMany):** Checkpoint files survive pod deletion.
  New pods mount the same volume and read `LATEST` on startup.
- **SIGTERM handler:** Python's `signal.signal(SIGTERM)` triggers emergency checkpoint
  save before the container exits.
- **30s termination grace:** Gives the training loop enough time to finish the
  current mini-batch and write the checkpoint file.

---

## 4. Financial Model

### Core Formula

```
Avoided Cost = (Spot Price - Contract Price) × Facility MW × Duration (hours)
```

Where:
- **Contract Price** = $40/MWh (typical Texas bilateral contract)
- **Facility MW** = 100MW (configurable, represents total sheddable load)
- **Spot Price** = ERCOT Real-Time LMP

### Real-World Scenario: Winter Storm Uri (Feb 2021)

```
Peak Price:    $9,000/MWh (ERCOT system-wide offer cap)
Duration:      ~48 hours of sustained high prices
Facility:      100MW data center

Avoided Cost = ($9,000 - $40) × 100MW × 48hrs
             = $8,960 × 100 × 48
             = $43,008,000

Additional demand response credits:  ~$2,000,000
Cloud migration costs (burst):       ~$500,000
────────────────────────────────────────────────
Net savings for ONE event:           ~$44,508,000
```

### Typical Non-Emergency Spike (Summer 2024)

```
Peak Price:    $5,000/MWh
Duration:      2 hours
Facility:      100MW

Avoided Cost = ($5,000 - $40) × 100 × 2 = $992,000
```

These events occur 5-15 times per year on ERCOT, making the annual savings
potential $5M-$50M+ per 100MW facility.

### Demand Response Revenue

Under ERCOT's Emergency Response Service (ERS), participating loads earn:
- **Capacity payment:** $15-25/MW/month for being available
- **Energy payment:** Market price × MW curtailed during ERS deployment
- **Ancillary services:** Additional revenue from frequency response

C2G automates qualification by maintaining audit logs (Supabase `action_logs`
table) that prove curtailment occurred within required response times.

---

## 5. Why ERCOT, Why Now

### Regulatory: SB 6

Texas Senate Bill 6 (passed 2023) fundamentally changed the landscape for
large power consumers:

- Facilities >75MW must register with ERCOT as Large Flexible Loads
- Mandatory curtailment participation during grid emergencies (EEA2+)
- Financial penalties for non-compliance
- Requirement to demonstrate automated response capability

C2G provides the automated infrastructure SB 6 demands.

### Market: 40GW Data Center Pipeline

- Texas has **40GW** of data center capacity in the interconnection queue
- ERCOT is the **only** major US grid that's fully deregulated with
  transparent real-time pricing
- Hyperscalers (AWS, Google, Microsoft) are all expanding Texas operations
- AI training clusters are the fastest-growing power consumers (100MW+
  single facilities)

### Timing: The Perfect Storm

1. **SB 6 compliance deadlines** are approaching — facilities need solutions now
2. **AI training workloads** are uniquely suited for demand response (can checkpoint and resume)
3. **ERCOT price volatility** is increasing with renewable intermittency
4. **No existing solution** bridges grid signals to Kubernetes orchestration

C2G is purpose-built for this intersection of regulatory pressure, market
opportunity, and technical feasibility.

---

## Appendix: Data Flow

```
┌─────────┐  5s poll   ┌──────────────┐  insert   ┌───────────┐
│  ERCOT  │──────────▶│  ercot_      │──────────▶│ Supabase  │
│  (sim)  │           │  monitor.py  │           │ grid_     │
└─────────┘           └──────┬───────┘           │ events    │
                             │                    └───────────┘
                    classify_price()
                             │
                ┌────────────┼────────────┐
                ▼            ▼            ▼
          price<100    100<p<1000     price>1000
          NORMAL       WARNING        EMERGENCY
                                         │
                                    trigger_load_shed()
                                         │
                              ┌──────────┼──────────┐
                              ▼                     ▼
                        K8s real              K8s mock
                    (annotate→wait→         (log only)
                     scale to 0)
                              │
                              ▼
                    ┌──────────────┐  insert   ┌───────────┐
                    │ ActionLog    │──────────▶│ Supabase  │
                    │ LOAD_SHED    │           │ action_   │
                    └──────────────┘           │ logs      │
                                               └───────────┘
                              │
                    WebSocket broadcast
                              │
                              ▼
                    ┌──────────────┐
                    │  Next.js     │
                    │  Dashboard   │
                    └──────────────┘
```
