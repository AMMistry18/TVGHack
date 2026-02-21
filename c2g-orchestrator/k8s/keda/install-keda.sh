#!/bin/bash
# Installs KEDA and Prometheus into the kind cluster for the C2G demo.
# Runtime: ~3 minutes
set -e

echo "Adding Helm repos..."
helm repo add kedacore https://kedacore.github.io/charts
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

echo "Creating namespaces..."
kubectl create namespace keda 2>/dev/null || true
kubectl create namespace monitoring 2>/dev/null || true

echo "Installing KEDA..."
helm upgrade --install keda kedacore/keda --namespace keda --wait

echo "Installing Prometheus..."
helm upgrade --install prometheus prometheus-community/prometheus \
  --namespace monitoring \
  --set server.persistentVolume.enabled=false \
  --wait

echo "Deploying C2G Prometheus exporter (stub for demo; production runs full exporter with main app)..."
# Stub exposes metric names so KEDA can scrape. In production, run the full
# prometheus_exporter.py alongside the orchestrator (same codebase, uvicorn on 9090).
kubectl apply -f - <<'EXPORTER'
apiVersion: v1
kind: ConfigMap
metadata:
  name: c2g-exporter-script
  namespace: default
data:
  exporter.py: |
    from prometheus_client import Gauge, generate_latest
    from http.server import HTTPServer, BaseHTTPRequestHandler
    g_price = Gauge("ercot_realtime_price_mwh", "ERCOT price $/MWh")
    g_rec = Gauge("ercot_recommended_replicas", "Recommended replicas", ["deployment"])
    g_price.set(30)
    for name, (_, max_rep) in [("llama4-training-job", (1000, 10)), ("stable-diffusion-batch", (500, 8)), ("data-preprocessing-pipeline", (200, 6))]:
        g_rec.labels(deployment=name).set(max_rep)
    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/metrics":
                self.send_response(200)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(generate_latest())
            elif self.path == "/health":
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"status":"ok"}')
            else:
                self.send_response(404)
                self.end_headers()
        def log_message(self, *a): pass
    HTTPServer(("0.0.0.0", 9090), H).serve_forever()
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: c2g-prometheus-exporter
  namespace: default
  labels:
    app: c2g-exporter
spec:
  replicas: 1
  selector:
    matchLabels:
      app: c2g-exporter
  template:
    metadata:
      labels:
        app: c2g-exporter
    spec:
      containers:
        - name: exporter
          image: python:3.11-slim
          command: ["sh", "-c", "pip install prometheus_client -q && python /app/exporter.py"]
          volumeMounts:
            - name: script
              mountPath: /app
          ports:
            - containerPort: 9090
          resources:
            requests:
              cpu: 10m
              memory: 64Mi
      volumes:
        - name: script
          configMap:
            name: c2g-exporter-script
---
apiVersion: v1
kind: Service
metadata:
  name: c2g-prometheus-exporter
  namespace: default
spec:
  selector:
    app: c2g-exporter
  ports:
    - port: 9090
      targetPort: 9090
EXPORTER

echo "Applying KEDA ScaledObjects..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
kubectl apply -f "$SCRIPT_DIR/scaled-object.yaml"

echo "Applying TriggerAuthentication (optional, for production)..."
kubectl apply -f "$SCRIPT_DIR/trigger-authentication.yaml" 2>/dev/null || true

echo ""
echo "KEDA installed. Verify with: kubectl get scaledobjects -A"
echo "Prometheus: kubectl get svc -n monitoring"
echo "Exporter: kubectl get svc c2g-prometheus-exporter -n default"
