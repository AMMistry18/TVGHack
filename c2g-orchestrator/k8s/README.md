# C2G Kubernetes manifests and Pre-Stop hook

## ConfigMap for Pre-Stop hook

Before applying `flexible-deployment.yaml`, create the ConfigMap that mounts the checkpoint script:

```bash
kubectl create configmap c2g-prestop-hooks \
  --from-file=c2g_checkpoint.py=preStop-hook.py \
  -n default
```

Or from repo root:

```bash
kubectl create configmap c2g-prestop-hooks \
  --from-file=c2g_checkpoint.py=c2g-orchestrator/k8s/preStop-hook.py \
  -n default
```

Then apply the flexible deployment so the Pre-Stop hook runs on SIGTERM during load shed.
