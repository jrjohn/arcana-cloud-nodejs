#!/bin/bash
# Integration smoke test for arcana-cloud-nodejs layered deployment
# Usage: ./scripts/integration-smoke-test.sh <base_url> <label> [timeout_seconds]

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
LABEL="${2:-smoke}"
TIMEOUT="${3:-300}"

echo "=== Integration Smoke Test: ${LABEL} ==="
echo "    Target: ${BASE_URL}"
echo "    Timeout: ${TIMEOUT}s"

# ---------------------------------------------------------------------------
# Wait for service to be ready
# ---------------------------------------------------------------------------
wait_for_health() {
  local url="${BASE_URL}/health"
  local elapsed=0
  local interval=5

  echo "[wait] Waiting for ${url} ..."
  while true; do
    if curl -sf --max-time 5 "${url}" > /dev/null 2>&1; then
      echo "[wait] Service is healthy after ${elapsed}s"
      return 0
    fi
    if [[ ${elapsed} -ge ${TIMEOUT} ]]; then
      echo "[wait] TIMEOUT after ${elapsed}s waiting for ${url}"
      return 1
    fi
    sleep ${interval}
    elapsed=$((elapsed + interval))
    echo "[wait] ...${elapsed}s elapsed"
  done
}

# ---------------------------------------------------------------------------
# Assert helper
# ---------------------------------------------------------------------------
assert() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if echo "${actual}" | grep -qF "${expected}"; then
    echo "[PASS] ${desc}"
  else
    echo "[FAIL] ${desc}"
    echo "       Expected to contain: ${expected}"
    echo "       Got: ${actual}"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Run tests
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

wait_for_health

# Health check
HEALTH=$(curl -sf --max-time 10 "${BASE_URL}/health" || echo '{}')
run_test "GET /health returns ok" "ok" "${HEALTH}"

# Register a test user
TIMESTAMP=$(date +%s)
TEST_USER="smoketest_${TIMESTAMP}"
TEST_EMAIL="${TEST_USER}@test.arcana"
TEST_PASS="SmokeTest@123!"

REGISTER=$(curl -sf --max-time 10 \
  -X POST "${BASE_URL}/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${TEST_USER}\",\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}" \
  || echo '{"error":"register_failed"}')
run_test "POST /api/v1/auth/register" "access_token" "${REGISTER}"

# Extract access token
ACCESS_TOKEN=$(echo "${REGISTER}" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || echo "")

if [[ -n "${ACCESS_TOKEN}" ]]; then
  # Get users (authenticated)
  USERS=$(curl -sf --max-time 10 \
    "${BASE_URL}/api/v1/users" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    || echo '{"error":"users_failed"}')
  run_test "GET /api/v1/users (authenticated)" "items" "${USERS}"

  # Validate token
  VALIDATE=$(curl -sf --max-time 10 \
    "${BASE_URL}/api/v1/auth/validate" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    || echo '{"error":"validate_failed"}')
  run_test "GET /api/v1/auth/validate" "username" "${VALIDATE}"

  # Login
  LOGIN=$(curl -sf --max-time 10 \
    -X POST "${BASE_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"usernameOrEmail\":\"${TEST_USER}\",\"password\":\"${TEST_PASS}\"}" \
    || echo '{"error":"login_failed"}')
  run_test "POST /api/v1/auth/login" "access_token" "${LOGIN}"
else
  echo "[SKIP] Skipping authenticated tests (no access token)"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
TOTAL=$((PASS + FAIL))
echo ""
echo "=== Results [${LABEL}]: ${PASS}/${TOTAL} passed ==="

if [[ ${FAIL} -gt 0 ]]; then
  echo "SMOKE TEST FAILED: ${FAIL} test(s) failed"
  exit 1
else
  echo "SMOKE TEST PASSED"
  exit 0
fi
