#!/usr/bin/env bash

set -u

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
SETUP_SCRIPT="$REPO_ROOT/scripts/setup_local_https.sh"
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

  grep -Fq -- "$expected" "$file" || fail "$message (missing: $expected)"
}

assert_not_contains() {
  local file="$1"
  local unexpected="$2"
  local message="$3"

  if grep -Fq -- "$unexpected" "$file"; then
    fail "$message (unexpected: $unexpected)"
  fi
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
  CERT_DIR="$CASE_ROOT/certificates"
  FAKE_BIN="$CASE_ROOT/bin"
  COMMAND_LOG="$CASE_ROOT/commands.log"
  OUTPUT_LOG="$CASE_ROOT/output.log"
  CERTIFICATE_STATE="$CASE_ROOT/certificate-state"
  mkdir -p "$CERT_DIR" "$FAKE_BIN"
  : >"$COMMAND_LOG"

  write_executable "$FAKE_BIN/mkcert" \
    '#!/usr/bin/env bash' \
    'printf "mkcert %s\n" "$*" >>"$COMMAND_LOG"' \
    'if [[ "${1:-}" == "-cert-file" ]]; then' \
    '  printf "certificate\n" >"$2"' \
    '  printf "private key\n" >"$4"' \
    'fi'

  write_executable "$FAKE_BIN/openssl" \
    '#!/usr/bin/env bash' \
    'case "$*" in' \
    '  *"x509 -in "*" -noout -checkend "*)' \
    '    [[ "$(cat "$CERTIFICATE_STATE" 2>/dev/null)" == "valid" ]]' \
    '    ;;' \
    '  *"x509 -in "*" -noout -text"*)' \
    '    printf "%s\n" "DNS:localhost, IP Address:127.0.0.1, IP Address:0:0:0:0:0:0:0:1"' \
    '    ;;' \
    '  *"x509 -in "*" -noout -pubkey"*)' \
    '    printf "%s\n" "PUBLIC KEY"' \
    '    ;;' \
    '  *"pkey -pubin -outform pem"*)' \
    '    cat >/dev/null || true' \
    '    printf "%s\n" "PUBLIC KEY"' \
    '    ;;' \
    '  *"pkey -in "*" -pubout -outform pem"*)' \
    '    printf "%s\n" "PUBLIC KEY"' \
    '    ;;' \
    '  *) exit 1 ;;' \
    'esac'
}

run_setup() {
  env \
    REPO_ROOT="$CASE_ROOT/repo" \
    LOCAL_HTTPS_CERT_DIR="$CERT_DIR" \
    COMMAND_LOG="$COMMAND_LOG" \
    CERTIFICATE_STATE="$CERTIFICATE_STATE" \
    PATH="$FAKE_BIN:/usr/bin:/bin" \
    bash "$SETUP_SCRIPT" >"$OUTPUT_LOG" 2>&1
}

test_missing_mkcert_explains_install() {
  create_fixture missing_mkcert
  rm -f "$FAKE_BIN/mkcert"

  if run_setup; then
    fail "missing mkcert should return nonzero"
    return
  fi
  assert_contains "$OUTPUT_LOG" "brew install mkcert" \
    "the error should include the macOS installation command"
  pass "missing mkcert explains installation"
}

test_generates_expected_local_certificate() {
  create_fixture generate

  if ! run_setup; then
    fail "certificate generation should exit zero"
    return
  fi
  assert_contains "$COMMAND_LOG" "mkcert -install" \
    "the local CA should be initialized"
  assert_contains "$COMMAND_LOG" \
    "mkcert -cert-file $CERT_DIR/localhost.pem -key-file $CERT_DIR/localhost-key.pem localhost 127.0.0.1 ::1" \
    "the certificate should cover every approved local host"
  [[ -f "$CERT_DIR/localhost.pem" ]] || fail "certificate should be created"
  [[ -f "$CERT_DIR/localhost-key.pem" ]] || fail "private key should be created"
  pass "generates expected local certificate"
}

test_reuses_valid_existing_certificate() {
  create_fixture reuse
  touch "$CERT_DIR/localhost.pem" "$CERT_DIR/localhost-key.pem"
  printf 'valid\n' >"$CERTIFICATE_STATE"

  if ! run_setup; then
    fail "valid existing certificate should exit zero"
    return
  fi
  assert_not_contains "$COMMAND_LOG" "mkcert -cert-file" \
    "a valid existing certificate should not be regenerated"
  assert_contains "$OUTPUT_LOG" "Local HTTPS certificate is ready" \
    "the ready paths should be printed"
  pass "reuses valid existing certificate"
}

test_regenerates_invalid_existing_certificate() {
  create_fixture regenerate
  touch "$CERT_DIR/localhost.pem" "$CERT_DIR/localhost-key.pem"
  printf 'invalid\n' >"$CERTIFICATE_STATE"

  if ! run_setup; then
    fail "invalid existing certificate should be regenerated"
    return
  fi
  assert_contains "$COMMAND_LOG" "mkcert -cert-file" \
    "an invalid existing certificate should be replaced"
  pass "regenerates invalid existing certificate"
}

test_missing_mkcert_explains_install
test_generates_expected_local_certificate
test_reuses_valid_existing_certificate
test_regenerates_invalid_existing_certificate

if [[ "$FAILURES" -gt 0 ]]; then
  printf '%s test(s) failed\n' "$FAILURES" >&2
  exit 1
fi

printf 'All local HTTPS setup tests passed.\n'
