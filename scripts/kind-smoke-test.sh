#!/bin/bash
# K8s smoke test using kind for arcana-cloud-nodejs
# Usage: ./scripts/kind-smoke-test.sh <image:tag> <protocol> [timeout_seconds]
#
# Examples:
#   ./scripts/kind-smoke-test.sh localhost:5000/arcana/node-app:build-42 grpc 480

set -euo pipefail

IMAGE="${1:-localhost:5000/arcana/node-app:latest}"
PROTOCOL="${2:-grpc}"
TIMEOUT="${3:-480}"

# Configuration
CLUSTER_NAME="arcana-ci-node-${PROTOCOL}"
IMAGE_ALIAS="arcana-cloud-node:ci"
NS="arcana-ci-kind-node-grpc"
NODE_PORT="30093"
MANIFEST="deployment/kubernetes/ci/kind-ci-grpc.yaml"

echo "=== Kind K8s Smoke Test: ${PROTOCOL} ==="
echo "    Cluster:  ${CLUSTER_NAME}"
echo "    Image:    ${IMAGE} → ${IMAGE_ALIAS}"
echo "    Manifest: ${MANIFEST}"
echo "    Timeout:  ${TIMEOUT}s"

# ---------------------------------------------------------------------------
# Cleanup helper
# ---------------------------------------------------------------------------
cleanup() {
  echo "[cleanup] Deleting kind cluster ${CLUSTER_NAME} ..."
  kind delete cluster --name "${CLUSTER_NAME}" 2>/dev/null || true
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Create kind cluster
# ---------------------------------------------------------------------------
echo "[kind] Creating cluster ${CLUSTER_NAME} ..."
kind create cluster --name "${CLUSTER_NAME}" --wait 60s

# ---------------------------------------------------------------------------
# Load image into kind
# ---------------------------------------------------------------------------
echo "[kind] Loading image ${IMAGE} as ${IMAGE_ALIAS} ..."

# Pull image from local registry if needed
if ! docker image inspect "${IMAGE}" > /dev/null 2>&1; then
  echo "[kind] Pulling ${IMAGE} from registry ..."
  docker pull "${IMAGE}"
fi

# Tag for kind (imagePullPolicy: Never)
docker tag "${IMAGE}" "${IMAGE_ALIAS}"
kind load docker-image "${IMAGE_ALIAS}" --name "${CLUSTER_NAME}"

# ---------------------------------------------------------------------------
# Apply manifest
# ---------------------------------------------------------------------------
echo "[k8s] Applying manifest ${MANIFEST} ..."
kubectl apply -f "${MANIFEST}"

# ---------------------------------------------------------------------------
# Wait for pods to be ready
# ---------------------------------------------------------------------------
wait_pods() {
  local elapsed=0
  local interval=10
  local label="$1"

  echo "[k8s] Waiting for pods (${label}) to be ready ..."
  while true; do
    local ready
    ready=$(kubectl get pods -n "${NS}" -l "app=${label}" \
      --field-selector=status.phase=Running \
      -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "")

    if [[ "${ready}" == *"True"* ]]; then
      echo "[k8s] Pod ${label} is ready after ${elapsed}s"
      return 0
    fi

    if [[ ${elapsed} -ge ${TIMEOUT} ]]; then
      echo "[k8s] TIMEOUT waiting for ${label} pods"
      kubectl get pods -n "${NS}" 2>/dev/null || true
      kubectl describe pods -n "${NS}" -l "app=${label}" 2>/dev/null | tail -30 || true
      return 1
    fi

    sleep ${interval}
    elapsed=$((elapsed + interval))
    echo "[k8s] ...${elapsed}s elapsed, waiting for ${label}"
  done
}

# Wait for all layers in order
wait_pods "arcana-node-repository"
wait_pods "arcana-node-service"
wait_pods "arcana-node-controller"

# ---------------------------------------------------------------------------
# Get NodePort address
# ---------------------------------------------------------------------------
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || echo "localhost")
BASE_URL="http://${NODE_IP}:${NODE_PORT}"

echo "[test] Smoke testing ${BASE_URL} ..."

# ---------------------------------------------------------------------------
# Wait for controller health
# ---------------------------------------------------------------------------
elapsed=0
interval=10
echo "[test] Waiting for controller health endpoint ..."
while true; do
  if curl -sf --max-time 5 "${BASE_URL}/health" > /dev/null 2>&1; then
    echo "[test] Controller is healthy after ${elapsed}s"
    break
  fi
  if [[ ${elapsed} -ge ${TIMEOUT} ]]; then
    echo "[test] TIMEOUT waiting for health endpoint"
    kubectl get pods -n "${NS}" 2>/dev/null || true
    exit 1
  fi
  sleep ${interval}
  elapsed=$((elapsed + interval))
  echo "[test] ...${elapsed}s elapsed"
done

# ---------------------------------------------------------------------------
# Smoke tests
# ---------------------------------------------------------------------------
PASS=0
FAIL=0

run_test() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if echo "${actual}" | grep -qF "${expected}"; then
    echo "[PASS] ${desc}"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] ${desc} — expected '${expected}' in: ${actual}"
    FAIL=$((FAIL + 1))
  fi
}

HEALTH=$(curl -sf --max-time 10 "${BASE_URL}/health" || echo '{}')
run_test "GET /health" "ok" "${HEALTH}"

TIMESTAMP=$(date +%s%3N)
TEST_USER="kindsmoke${TIMESTAMP}"
TEST_EMAIL="${TEST_USER}@test.arcana"
TEST_PASS="KindSmoke@123!"

REGISTER=$(curl -sf --max-time 15 \
  -X POST "${BASE_URL}/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${TEST_USER}\",\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}" \
  || echo '{"error":"register_failed"}')
run_test "POST /api/v1/auth/register" "access_token" "${REGISTER}"

ACCESS_TOKEN=$(echo "${REGISTER}" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || echo "")

if [[ -n "${ACCESS_TOKEN}" ]]; then
  LOGIN=$(curl -sf --max-time 15 \
    -X POST "${BASE_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"usernameOrEmail\":\"${TEST_USER}\",\"password\":\"${TEST_PASS}\"}" \
    || echo '{"error":"login_failed"}')
  run_test "POST /api/v1/auth/login" "access_token" "${LOGIN}"
else
  echo "[SKIP] Skipping login test (no token from register)"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
TOTAL=$((PASS + FAIL))
echo ""
echo "=== Kind Results [${PROTOCOL}]: ${PASS}/${TOTAL} passed ==="

if [[ ${FAIL} -gt 0 ]]; then
  echo "KIND SMOKE TEST FAILED"
  exit 1
else
  echo "KIND SMOKE TEST PASSED"
  exit 0
fi
