# Mock AI Training Job (checkpoint/resume demo)

Simulates a long-running training loop that saves state on SIGTERM and resumes from the last checkpoint.

## Run locally

```bash
python3 training_sim.py
```

Send SIGTERM (e.g. Ctrl+C or `kill -TERM <pid>`) to see it save an emergency checkpoint and exit. Run again to resume.

## Build image for Kubernetes

```bash
docker build -t mock-ai-training:latest .
# For kind:
kind load docker-image mock-ai-training:latest --name c2g-demo
```

Then apply the deployment (from repo root):

```bash
kubectl apply -f demo/mock-training-job/deployment.yaml
```

## Full demo flow

From repo root, run:

```bash
bash scripts/demo_training_flow.sh
```

Ensure the C2G backend is running on port 8000 and kubectl points at your demo cluster.
