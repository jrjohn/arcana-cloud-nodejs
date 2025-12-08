#!/bin/bash
set -e

PROTOCOL=${1:-http}
NAMESPACE="arcana-test"

echo "=== Arcana Cloud K8s Test Runner ==="
echo "Protocol: $PROTOCOL"
echo ""

# Create namespace if not exists
echo "Creating namespace..."
kubectl apply -f k8s/test/namespace.yaml

# Deploy Redis
echo "Deploying Redis..."
kubectl apply -f k8s/test/redis.yaml

# Wait for Redis to be ready
echo "Waiting for Redis to be ready..."
kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=60s

# Apply ConfigMaps
echo "Applying ConfigMaps..."
kubectl apply -f k8s/test/configmap.yaml

# Delete previous test job if exists
echo "Cleaning up previous test jobs..."
kubectl delete job arcana-test-$PROTOCOL -n $NAMESPACE --ignore-not-found=true

# Run the test job
echo "Running tests with $PROTOCOL protocol..."
kubectl apply -f k8s/test/test-job-$PROTOCOL.yaml

# Wait for job to start
sleep 2

# Get pod name
POD_NAME=$(kubectl get pods -n $NAMESPACE -l component=test-runner,protocol=$PROTOCOL -o jsonpath='{.items[0].metadata.name}')

echo "Test pod: $POD_NAME"
echo ""

# Follow logs
echo "=== Test Output ==="
kubectl logs -f $POD_NAME -n $NAMESPACE

# Get job status
JOB_STATUS=$(kubectl get job arcana-test-$PROTOCOL -n $NAMESPACE -o jsonpath='{.status.succeeded}')

if [ "$JOB_STATUS" == "1" ]; then
    echo ""
    echo "=== Tests PASSED ==="
    exit 0
else
    echo ""
    echo "=== Tests FAILED ==="
    exit 1
fi
