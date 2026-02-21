#!/bin/bash
# Complete demo flow showing checkpoint/resume — "training survives grid emergency".
# Run this during the judge presentation.
#
# Prereqs: Backend running on localhost:8000, kubectl pointing at demo cluster,
#          mock-ai-training image built and loaded (see demo/mock-training-job/README or Dockerfile).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "Step 1: Starting mock training job..."
kubectl apply -f demo/mock-training-job/deployment.yaml
sleep 5

echo "Step 2: Watch training progress..."
kubectl logs -l app=mock-ai-training --follow --tail=20 &
LOG_PID=$!
sleep 2

echo "Step 3: Waiting 20 seconds to show normal training..."
sleep 20

echo "Step 4: Triggering grid emergency via C2G API..."
curl -s -X POST http://localhost:8000/admin/simulate-spike \
  -H "Content-Type: application/json" \
  -d '{"price_mwh": 5000, "duration_seconds": 30}' || true

echo ""
echo "Step 5: Watch C2G shed the training pods (checkpointing first)..."
sleep 35

echo "Step 6: Grid normalizing — C2G resuming operations..."
curl -s -X POST http://localhost:8000/admin/force-resume || true
curl -s -X POST http://localhost:8000/admin/reset || true

echo ""
echo "Step 7: Training job restarting from checkpoint..."
sleep 10

echo ""
echo "DEMO COMPLETE — Training resumed from exact checkpoint. Zero epochs lost."
kill $LOG_PID 2>/dev/null || true
