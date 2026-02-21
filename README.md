# C2G Orchestrator

**Compute-to-Grid: Intelligent Kubernetes workload orchestration driven by real-time ERCOT electricity prices**

## The Problem

Texas data centers consume 40GW+ of power on ERCOT's deregulated grid, where real-time prices can spike from $30/MWh to $9,000/MWh in minutes during grid emergencies. Senate Bill 6 now mandates large-load demand response participation, yet operators lack automated systems to curtail non-critical compute while preserving AI training state. The result: millions in unnecessary energy costs and zero demand response revenue.

## The Solution

C2G Orchestrator is a middleware agent that continuously monitors ERCOT real-time market prices and automatically orchestrates Kubernetes workload shedding in tiered response to price spikes. It preserves AI training checkpoints via graceful SIGTERM handling, migrates latency-insensitive workloads to cheaper grids, and provides a real-time financial dashboard quantifying avoided costs. A dual-layer strategy — Python sidecar for fast imperative control plus KEDA for autonomous resilient fallback — ensures zero missed demand response events.

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────────────┐
│   ERCOT RTM API │────▶│         C2G Orchestrator (FastAPI)            │
│  (Price Signal) │     │  • Polls every 5s                             │
└─────────────────┘     │  • Classifies: NORMAL/WARNING/EMERGENCY       │
                        │  • Triggers tiered response                   │
                        └──────┬──────────────┬──────────────┬──────────┘
                               │              │              │
                   ┌───────────▼──┐  ┌────────▼──────┐  ┌───▼──────────────┐
                   │  Supabase    │  │  K8s Cluster  │  │  KEDA Controller │
                   │  (Logging &  │  │  (Pod Scaling)│  │  (Autonomous     │
                   │   Realtime)  │  │               │  │   Fallback)      │
                   └──────────────┘  └───────────────┘  └──────────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │  Next.js Dashboard      │
                               │  (Realtime via WS)      │
                               └─────────────────────────┘
```

### Key Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Price Monitor | Python/FastAPI | Polls ERCOT RTM, classifies grid state |
| K8s Controller | kubernetes-client | Graceful two-phase load shedding |
| KEDA Scaler | Prometheus + ScaledObjects | Autonomous fallback scaling |
| Checkpoint Engine | SIGTERM + PreStop hooks | Preserves AI training state |
| Supabase DB | PostgreSQL (hosted) | Event logging, metrics persistence |
| Dashboard | Next.js + Recharts + WebSocket | Real-time operational visibility |

## Quickstart

**Prerequisites:** Python 3.11+, Node.js 20+, a Supabase project

### 1. Clone and configure

```bash
git clone https://github.com/AMMistry18/TVGHack.git
cd TVGHack

# Set up environment
cp .env.example .env
# Edit .env with your SUPABASE_URL and SUPABASE_KEY
```

### 2. Create Supabase tables

Run this SQL in the [Supabase SQL Editor](https://supabase.com/dashboard):

```sql
CREATE TABLE IF NOT EXISTS grid_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  price_mwh DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS action_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  action_taken TEXT NOT NULL,
  pods_scaled INTEGER DEFAULT 0,
  estimated_savings DOUBLE PRECISION DEFAULT 0,
  duration_seconds DOUBLE PRECISION
);
```

### 3. Start the backend

```bash
cd c2g-orchestrator
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Open the dashboard

Navigate to **http://localhost:3000** — the dashboard auto-connects to the backend via WebSocket and polling.

### 6. Trigger the demo

```bash
# Inject a simulated winter storm ($5000/MWh spike)
curl http://localhost:8000/api/demo/inject-storm

# Or trigger a manual spike
curl -X POST http://localhost:8000/admin/simulate-spike \
  -H "Content-Type: application/json" \
  -d '{"price_mwh": 5000, "duration_seconds": 60}'
```

### Docker Compose (all services)

```bash
docker compose up --build
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check with version and current price |
| GET | `/api/grid/current` | Current ERCOT price, status, shed state |
| GET | `/api/grid/events?limit=100` | Historical grid events from Supabase |
| GET | `/api/grid/history?hours=2` | Grid history with synthetic fallback |
| GET | `/api/metrics/savings?hours=24` | Savings timeline for last N hours |
| GET | `/api/metrics/summary` | Aggregated stats (peak, savings, shed hours) |
| GET | `/api/metrics/recharts` | Recharts-formatted price + savings data |
| GET | `/api/metrics/demo-snapshot` | Hardcoded 2hr winter storm dataset |
| GET | `/api/dashboard` | Full dashboard payload (frontend-compatible) |
| GET | `/api/demo/inject-storm` | Magic button: inject storm + historical data |
| GET | `/api/demo/training-status` | Mock AI training checkpoint status |
| POST | `/admin/simulate-spike` | Start price spike simulation |
| POST | `/admin/reset` | Cancel spike, reset to $30/MWh |
| GET | `/admin/state` | Current app state |
| POST | `/admin/force-shed` | Force load shed (scale down workloads) |
| POST | `/admin/force-resume` | Force resume (restore workloads) |
| GET | `/admin/cluster-status` | K8s cluster pod summary |
| WS | `/ws/live` | Real-time app state broadcast (2s interval) |

## The Business Case

### Senate Bill 6 (SB 6) — Regulatory Tailwind

Texas SB 6 requires large power consumers (>75MW) to participate in demand response programs or face curtailment. Data centers operating on ERCOT must demonstrate automated load reduction capability.

### The Math

During Winter Storm Uri (Feb 2021), ERCOT prices hit $9,000/MWh for 48+ hours:

```
Avoided Cost = (Spike Price - Contract Price) × Facility MW × Hours
             = ($9,000 - $40) × 100MW × 48hrs
             = $43,008,000 avoided in one event
```

### Market Opportunity

- **40GW** of data center demand projected on ERCOT by 2030
- **$500M+** annual demand response market in ERCOT
- Every 100MW facility saves **$992,000** per 2-hour spike event at $5,000/MWh

## Tech Stack

- **Backend:** Python 3.11, FastAPI, Supabase (PostgreSQL), kubernetes-client
- **Frontend:** Next.js 15, React 19, TypeScript, Recharts, Tailwind CSS
- **Orchestration:** Kubernetes, KEDA, Prometheus, Helm
- **Infrastructure:** Docker Compose, Kind (local dev)

## Team

Built at the TVG Hackathon 2026.
