# C2G Orchestrator — Demo Script

## Standard demo flow

1. Start backend: `cd c2g-orchestrator && uvicorn main:app --reload --host 0.0.0.0 --port 8000`
2. Start frontend: `cd frontend && npm run dev` (optional: set `NEXT_PUBLIC_API_URL=http://localhost:8000`)
3. Open http://localhost:3000 and show dashboard, then trigger **Inject storm**: `curl http://localhost:8000/api/demo/inject-storm`
4. Show Supabase Table Editor: `grid_events` and `action_logs` filling with data.

---

## ADVANCED DEMO (if judges ask about production architecture)

### 1. Show KEDA is running

```bash
kubectl get scaledobjects -A
```

Example output:

```
NAMESPACE   NAME                        SCALETARGETKIND      SCALETARGETNAME              MIN   MAX   TRIGGERS     AUTHENTICATION   READY
default     c2g-llama4-training-scaler  apps/v1.Deployment   llama4-training-job          0     10   prometheus   c2g-prometheus    True
default     c2g-stable-diffusion-scaler apps/v1.Deployment   stable-diffusion-batch      0     8    prometheus   c2g-prometheus    True
default     c2g-preprocessing-scaler   apps/v1.Deployment   data-preprocessing-pipeline  0     6    prometheus   c2g-prometheus    True
```

**Talking point:**  
"Even if our Python orchestrator goes offline, KEDA's controller running natively in the cluster will continue to enforce price-based scaling. This is the difference between a script and a platform."

### 2. Explain the waterfall

**Talking point:**  
"At **$200/MWh** we shed preprocessing (data-preprocessing-pipeline). At **$500/MWh** we shed diffusion (stable-diffusion-batch). At **$1000/MWh** we shed training (llama4-training-job). It's tiered, proportional, and fully automated."

- Cheapest / lowest-value jobs shed first.
- Expensive training is only scaled down when the grid is truly stressed.
- Each ScaledObject has its own threshold and max replicas so shedding is ordered and predictable.

### 3. Optional: show Prometheus metric

```bash
kubectl port-forward svc/c2g-prometheus-exporter 9090:9090 -n default
curl -s http://localhost:9090/metrics | grep ercot
```

You should see `ercot_realtime_price_mwh` and `ercot_recommended_replicas` (with labels per deployment). KEDA uses these to decide replica counts.
