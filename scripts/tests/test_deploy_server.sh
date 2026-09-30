#!/usr/bin/env bash

set -u

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_SCRIPT="$REPO_ROOT/scripts/deploy_server.sh"
TEST_ROOT="$(mktemp -d)"
FAILURES=0

trap 'rm -rf "$TEST_ROOT"' EXIT

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  FAILURES=$((FAILURES + 1))
}

pass() {
  printf 'PASS: %s\n' "$1"
}

assert_contains() {
  local file="$1"
  local expected="$2"
  local message="$3"

  if ! grep -Fq -- "$expected" "$file"; then
    fail "$message (missing: $expected)"
    return 1
  fi
}

assert_not_contains() {
  local file="$1"
  local unexpected="$2"
  local message="$3"

  if grep -Fq -- "$unexpected" "$file"; then
    fail "$message (unexpected: $unexpected)"
    return 1
  fi
}

line_number() {
  local file="$1"
  local expected="$2"

  grep -Fn -- "$expected" "$file" | head -n 1 | cut -d: -f1
}

write_executable() {
  local path="$1"
  shift
  printf '%s\n' "$@" >"$path"
  chmod +x "$path"
}

create_fixture() {
  local name="$1"

  CASE_ROOT="$TEST_ROOT/$name"
  APP_ROOT="$CASE_ROOT/app"
  FAKE_BIN="$CASE_ROOT/bin"
  COMMAND_LOG="$CASE_ROOT/commands.log"
  OUTPUT_LOG="$CASE_ROOT/output.log"

  mkdir -p "$APP_ROOT/.venv/bin" "$APP_ROOT/backend" "$APP_ROOT/frontend" "$FAKE_BIN"
  printf '%s\n' \
    'APP_ENV=production' \
    'CORS_ORIGINS=https://ad.example.com' \
    'SITE_ORIGIN=https://ad.example.com' \
    'AUTH_COOKIE_SECURE=true' >"$APP_ROOT/.env"
  : >"$APP_ROOT/requirements.txt"
  : >"$APP_ROOT/frontend/package-lock.json"
  printf '{"scripts":{"build":"next build"}}\n' >"$APP_ROOT/frontend/package.json"
  : >"$COMMAND_LOG"

  write_executable "$APP_ROOT/.venv/bin/python" \
    '#!/usr/bin/env bash' \
    'printf "python %s\n" "$*" >>"$COMMAND_LOG"'

  write_executable "$FAKE_BIN/node" \
    '#!/usr/bin/env bash' \
    'printf "%s\n" "${FAKE_NODE_VERSION:-v22.12.0}"'

  write_executable "$FAKE_BIN/npm" \
    '#!/usr/bin/env bash' \
    'printf "npm %s next_public=%s\n" "$*" "${NEXT_PUBLIC_BACKEND_BASE_URL-unset}" >>"$COMMAND_LOG"' \
    'if [[ "$*" == "run build" && "${FAKE_NPM_BUILD_FAIL:-0}" == "1" ]]; then exit 42; fi'

  write_executable "$FAKE_BIN/curl" \
    '#!/usr/bin/env bash' \
    'printf "curl %s\n" "$*" >>"$COMMAND_LOG"' \
    'if [[ "${FAKE_CURL_FAIL:-0}" == "1" ]]; then exit 22; fi'

  write_executable "$FAKE_BIN/flock" \
    '#!/usr/bin/env bash' \
    'printf "flock %s\n" "$*" >>"$COMMAND_LOG"'

  write_executable "$FAKE_BIN/systemctl" \
    '#!/usr/bin/env bash' \
    'printf "systemctl %s\n" "$*" >>"$COMMAND_LOG"'

  write_executable "$FAKE_BIN/journalctl" \
    '#!/usr/bin/env bash' \
    'printf "journalctl %s\n" "$*" >>"$COMMAND_LOG"'

  write_executable "$FAKE_BIN/sudo" \
    '#!/usr/bin/env bash' \
    'printf "sudo %s\n" "$*" >>"$COMMAND_LOG"' \
    'if [[ "${1:-}" == "-n" ]]; then shift; fi' \
    '"$@"'
}

run_deploy() {
  env \
    APP_ROOT="$APP_ROOT" \
    COMMAND_LOG="$COMMAND_LOG" \
    DEPLOY_LOCK_FILE="$CASE_ROOT/deploy.lock" \
    HEALTH_CHECK_ATTEMPTS=1 \
    HEALTH_CHECK_INTERVAL_SECONDS=0 \
    NEXT_PUBLIC_BACKEND_BASE_URL="http://wrong.example.test:8000" \
    PATH="$FAKE_BIN:$PATH" \
    "$@" \
    bash "$DEPLOY_SCRIPT" >"$OUTPUT_LOG" 2>&1
}

test_successful_deploy() {
  create_fixture success

  if ! run_deploy; then
    fail "successful deployment should exit zero"
    return
  fi

  assert_contains "$COMMAND_LOG" "python -m pip install -r $APP_ROOT/requirements.txt" \
    "backend dependencies should be installed"
  assert_contains "$COMMAND_LOG" "python -m compileall -q $APP_ROOT/backend" \
    "backend should be compiled"
  assert_contains "$COMMAND_LOG" "npm ci next_public=http://wrong.example.test:8000" \
    "npm ci should preserve the caller environment"
  assert_contains "$COMMAND_LOG" "npm run build next_public=unset" \
    "frontend build should clear NEXT_PUBLIC_BACKEND_BASE_URL"
  assert_contains "$COMMAND_LOG" \
    "systemctl restart ad-creativity-backend ad-creativity-frontend" \
    "both services should restart"
  assert_contains "$COMMAND_LOG" "curl --fail --silent --show-error --output /dev/null http://127.0.0.1:8000/health" \
    "backend health URL should be checked"
  assert_contains "$COMMAND_LOG" "curl --fail --silent --show-error --output /dev/null http://127.0.0.1:3000/" \
    "frontend health URL should be checked"

  local build_line restart_line
  build_line="$(line_number "$COMMAND_LOG" "npm run build")"
  restart_line="$(line_number "$COMMAND_LOG" "systemctl restart")"
  if [[ -z "$build_line" || -z "$restart_line" || "$build_line" -ge "$restart_line" ]]; then
    fail "services should restart only after the frontend build succeeds"
    return
  fi

  pass "successful deployment"
}

test_build_failure_does_not_restart() {
  create_fixture build_failure

  if run_deploy FAKE_NPM_BUILD_FAIL=1; then
    fail "frontend build failure should return nonzero"
    return
  fi

  assert_not_contains "$COMMAND_LOG" "systemctl restart" \
    "build failure must not restart services"
  pass "build failure preserves running services"
}

test_health_failure_prints_diagnostics() {
  create_fixture health_failure

  if run_deploy FAKE_CURL_FAIL=1; then
    fail "health-check failure should return nonzero"
    return
  fi

  assert_contains "$COMMAND_LOG" "systemctl status ad-creativity-backend --no-pager" \
    "backend status should be printed"
  assert_contains "$COMMAND_LOG" "systemctl status ad-creativity-frontend --no-pager" \
    "frontend status should be printed"
  assert_contains "$COMMAND_LOG" "journalctl -u ad-creativity-backend -n 100 --no-pager" \
    "backend logs should be printed"
  assert_contains "$COMMAND_LOG" "journalctl -u ad-creativity-frontend -n 100 --no-pager" \
    "frontend logs should be printed"
  pass "health failure emits diagnostics"
}

test_old_node_fails_before_install() {
  create_fixture old_node

  if run_deploy FAKE_NODE_VERSION=v20.19.0; then
    fail "unsupported Node.js should return nonzero"
    return
  fi

  assert_not_contains "$COMMAND_LOG" "python -m pip install" \
    "unsupported Node.js must fail before dependency installation"
  assert_not_contains "$COMMAND_LOG" "systemctl restart" \
    "unsupported Node.js must not restart services"
  assert_contains "$OUTPUT_LOG" "Node.js 22 or newer is required" \
    "unsupported Node.js should have a clear error"
  pass "Node.js version gate"
}

assert_security_preflight_failure() {
  local name="$1"
  local env_contents="$2"
  local expected_error="$3"

  create_fixture "$name"
  printf '%b' "$env_contents" >"$APP_ROOT/.env"

  if run_deploy; then
    fail "$name should return nonzero"
    return
  fi

  assert_not_contains "$COMMAND_LOG" "python -m pip install" \
    "$name must fail before dependency installation"
  assert_not_contains "$COMMAND_LOG" "systemctl restart" \
    "$name must not restart services"
  assert_contains "$OUTPUT_LOG" "$expected_error" \
    "$name should have a clear error"
  pass "$name"
}

test_production_security_env_gate() {
  assert_security_preflight_failure \
    missing_app_env \
    'CORS_ORIGINS=https://ad.example.com\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=true\n' \
    "APP_ENV must be set to production"
  assert_security_preflight_failure \
    missing_cors \
    'APP_ENV=production\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=true\n' \
    "CORS_ORIGINS must be set and non-empty"
  assert_security_preflight_failure \
    empty_site_origin \
    'APP_ENV=production\nCORS_ORIGINS=https://ad.example.com\nSITE_ORIGIN="   "\nAUTH_COOKIE_SECURE=true\n' \
    "SITE_ORIGIN must be set and non-empty"
  assert_security_preflight_failure \
    wildcard_cors \
    'APP_ENV=production\nCORS_ORIGINS=https://ad.example.com,*\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=true\n' \
    "CORS_ORIGINS must not contain '*'"
  assert_security_preflight_failure \
    invalid_site_origin \
    'APP_ENV=production\nCORS_ORIGINS=https://ad.example.com\nSITE_ORIGIN=http://ad.example.com/path\nAUTH_COOKIE_SECURE=true\n' \
    "SITE_ORIGIN must be an HTTPS origin without a path"
  assert_security_preflight_failure \
    mismatched_origins \
    'APP_ENV=production\nCORS_ORIGINS=https://api.example.com\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=true\n' \
    "CORS_ORIGINS must include SITE_ORIGIN"
  assert_security_preflight_failure \
    insecure_cookie \
    'APP_ENV=production\nCORS_ORIGINS=https://ad.example.com\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=false\n' \
    "AUTH_COOKIE_SECURE must be exactly true"
}

test_successful_deploy
test_build_failure_does_not_restart
test_health_failure_prints_diagnostics
test_old_node_fails_before_install
test_production_security_env_gate

if [[ "$FAILURES" -ne 0 ]]; then
  printf '%s test assertion(s) failed\n' "$FAILURES" >&2
  exit 1
fi

printf 'All deployment script tests passed.\n'
