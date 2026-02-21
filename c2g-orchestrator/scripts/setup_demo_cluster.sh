#!/usr/bin/env bash
# Creates a kind cluster "c2g-demo" and deploys demo workloads with energy-priority labels.
# All use busybox sleep containers with CPU/memory requests for demo reliability.

set -e

CLUSTER_NAME="${CLUSTER_NAME:-c2g-demo}"

echo "Creating kind cluster: $CLUSTER_NAME"
kind create cluster --name "$CLUSTER_NAME" --wait 2m

echo "Creating demo deployments..."

# llama4-training-job: 10 replicas, energy-priority: low
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llama4-training-job
  namespace: default
  labels:
    energy-priority: low
    job-type: training
spec:
  replicas: 10
  selector:
    matchLabels:
      app: llama4-training-job
  template:
    metadata:
      labels:
        app: llama4-training-job
        energy-priority: low
        job-type: training
    spec:
      containers:
        - name: busybox
          image: busybox:1.36
          command: ["sleep", "infinity"]
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
EOF

# stable-diffusion-batch: 8 replicas, energy-priority: low
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stable-diffusion-batch
  namespace: default
  labels:
    energy-priority: low
    job-type: training
spec:
  replicas: 8
  selector:
    matchLabels:
      app: stable-diffusion-batch
  template:
    metadata:
      labels:
        app: stable-diffusion-batch
        energy-priority: low
        job-type: training
    spec:
      containers:
        - name: busybox
          image: busybox:1.36
          command: ["sleep", "infinity"]
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
EOF

# data-preprocessing-pipeline: 6 replicas, energy-priority: low
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: data-preprocessing-pipeline
  namespace: default
  labels:
    energy-priority: low
spec:
  replicas: 6
  selector:
    matchLabels:
      app: data-preprocessing-pipeline
  template:
    metadata:
      labels:
        app: data-preprocessing-pipeline
        energy-priority: low
    spec:
      containers:
        - name: busybox
          image: busybox:1.36
          command: ["sleep", "infinity"]
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
EOF

# customer-api: 5 replicas, energy-priority: high
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: customer-api
  namespace: default
  labels:
    energy-priority: high
spec:
  replicas: 5
  selector:
    matchLabels:
      app: customer-api
  template:
    metadata:
      labels:
        app: customer-api
        energy-priority: high
    spec:
      containers:
        - name: busybox
          image: busybox:1.36
          command: ["sleep", "infinity"]
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
EOF

echo "Waiting for deployments to be available..."
kubectl wait --for=condition=Available deployment/llama4-training-job deployment/stable-diffusion-batch deployment/data-preprocessing-pipeline deployment/customer-api --timeout=120s 2>/dev/null || true

echo "Demo cluster ready. Summary:"
kubectl get deployments -l energy-priority=low
kubectl get deployments -l energy-priority=high
echo "Set KUBECONFIG for kind: export KUBECONFIG=\$(kind get kubeconfig-path --name $CLUSTER_NAME 2>/dev/null || kind get kubeconfig --name $CLUSTER_NAME)"
echo "Or with kind 0.20+: kubectl config use-context kind-$CLUSTER_NAME"
