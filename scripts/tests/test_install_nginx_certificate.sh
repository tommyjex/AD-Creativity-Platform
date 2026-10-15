#!/usr/bin/env bash

set -u

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALLER="$REPO_ROOT/scripts/install_nginx_certificate.sh"
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

assert_mode() {
  local path="$1"
  local expected="$2"
  local actual

  actual="$(stat -f '%Lp' "$path" 2>/dev/null || stat -c '%a' "$path")"
  [[ "$actual" == "$expected" ]] ||
    fail "$path should have mode $expected, found $actual"
}

write_executable() {
  local path="$1"
  shift
  printf '%s\n' "$@" >"$path"
  chmod +x "$path"
}

create_certificate() {
  local prefix="$1"
  local domain="$2"
  local days="$3"
  local config="$prefix.cnf"

  printf '%s\n' \
    '[req]' \
    'distinguished_name=dn' \
    'prompt=no' \
    'x509_extensions=san' \
    '[dn]' \
    "CN=$domain" \
    '[san]' \
    "subjectAltName=DNS:$domain" >"$config"
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$prefix.key" \
    -out "$prefix.pem" \
    -days "$days" \
    -config "$config" >/dev/null 2>&1
}

create_fixture() {
  local name="$1"

  CASE_ROOT="$TEST_ROOT/$name"
  FIXTURES="$CASE_ROOT/fixtures"
  SSL_DIR="$CASE_ROOT/etc/nginx/ssl/ad-creativity.tech"
  FAKE_BIN="$CASE_ROOT/bin"
  COMMAND_LOG="$CASE_ROOT/commands.log"
  OUTPUT_LOG="$CASE_ROOT/output.log"
  mkdir -p "$FIXTURES" "$SSL_DIR" "$FAKE_BIN"
  : >"$COMMAND_LOG"

  write_executable "$FAKE_BIN/nginx" \
    '#!/usr/bin/env bash' \
    'printf "nginx %s\n" "$*" >>"$COMMAND_LOG"' \
    '[[ "${FAKE_NGINX_FAIL:-0}" != "1" ]]'

  write_executable "$FAKE_BIN/systemctl" \
    '#!/usr/bin/env bash' \
    'printf "systemctl %s\n" "$*" >>"$COMMAND_LOG"' \
    '[[ "${FAKE_SYSTEMCTL_FAIL:-0}" != "1" ]]'
}

archive_certificate() {
  local prefix="$1"
  local archive="$2"
  local archive_dir="$CASE_ROOT/archive"

  rm -rf "$archive_dir"
  mkdir -p "$archive_dir"
  cp "$prefix.pem" "$archive_dir/ad-creativity.tech.pem"
  cp "$prefix.key" "$archive_dir/ad-creativity.tech.key"
  tar -cf "$archive" -C "$archive_dir" \
    ad-creativity.tech.pem ad-creativity.tech.key
}

run_installer() {
  env \
    SSL_DIR="$SSL_DIR" \
    NGINX_BIN="$FAKE_BIN/nginx" \
    SYSTEMCTL_BIN="$FAKE_BIN/systemctl" \
    INSTALL_USER="$(id -un)" \
    INSTALL_GROUP="$(id -gn)" \
    REQUIRE_ROOT=false \
    MIN_VALID_SECONDS="${MIN_VALID_SECONDS:-0}" \
    COMMAND_LOG="$COMMAND_LOG" \
    "$@" \
    bash "$INSTALLER" "$ARCHIVE" >"$OUTPUT_LOG" 2>&1
}

test_installs_matching_certificate() {
  create_fixture install
  create_certificate "$FIXTURES/valid" ad-creativity.tech 30
  ARCHIVE="$CASE_ROOT/certificate.tar"
  archive_certificate "$FIXTURES/valid" "$ARCHIVE"

  if ! run_installer; then
    fail "matching certificate should install"
    return
  fi
  cmp "$SSL_DIR/fullchain.pem" "$FIXTURES/valid.pem" ||
    fail "installed certificate should match"
  cmp "$SSL_DIR/privkey.pem" "$FIXTURES/valid.key" ||
    fail "installed private key should match"
  assert_mode "$SSL_DIR/fullchain.pem" 644
  assert_mode "$SSL_DIR/privkey.pem" 600
  assert_contains "$COMMAND_LOG" "nginx -t" "Nginx configuration should be tested"
  assert_contains "$COMMAND_LOG" "systemctl reload nginx" "Nginx should reload"
  pass "installs matching certificate"
}

test_rejects_extra_archive_entry() {
  create_fixture extra
  create_certificate "$FIXTURES/valid" ad-creativity.tech 30
  ARCHIVE="$CASE_ROOT/certificate.tar"
  archive_certificate "$FIXTURES/valid" "$ARCHIVE"
  printf 'unexpected\n' >"$CASE_ROOT/archive/extra.txt"
  tar -cf "$ARCHIVE" -C "$CASE_ROOT/archive" .

  if run_installer; then
    fail "archive with extra entries should fail"
    return
  fi
  assert_contains "$OUTPUT_LOG" "exactly two files" \
    "extra archive entry should have a clear error"
  pass "rejects extra archive entry"
}

test_rejects_wrong_domain() {
  create_fixture wrong_domain
  create_certificate "$FIXTURES/wrong" wrong.example.com 30
  ARCHIVE="$CASE_ROOT/certificate.tar"
  archive_certificate "$FIXTURES/wrong" "$ARCHIVE"

  if run_installer; then
    fail "wrong-domain certificate should fail"
    return
  fi
  assert_contains "$OUTPUT_LOG" "SAN must contain DNS:ad-creativity.tech" \
    "wrong domain should have a clear error"
  pass "rejects wrong domain"
}

test_rejects_near_expiry() {
  create_fixture expiry
  create_certificate "$FIXTURES/short" ad-creativity.tech 1
  ARCHIVE="$CASE_ROOT/certificate.tar"
  archive_certificate "$FIXTURES/short" "$ARCHIVE"

  if MIN_VALID_SECONDS=1209600 run_installer; then
    fail "near-expiry certificate should fail"
    return
  fi
  assert_contains "$OUTPUT_LOG" "expires too soon" \
    "near-expiry certificate should have a clear error"
  pass "rejects near-expiry certificate"
}

test_rejects_mismatched_key() {
  create_fixture mismatch
  create_certificate "$FIXTURES/valid" ad-creativity.tech 30
  create_certificate "$FIXTURES/other" ad-creativity.tech 30
  ARCHIVE="$CASE_ROOT/certificate.tar"
  archive_certificate "$FIXTURES/valid" "$ARCHIVE"
  cp "$FIXTURES/other.key" "$CASE_ROOT/archive/ad-creativity.tech.key"
  tar -cf "$ARCHIVE" -C "$CASE_ROOT/archive" \
    ad-creativity.tech.pem ad-creativity.tech.key

  if run_installer; then
    fail "mismatched private key should fail"
    return
  fi
  assert_contains "$OUTPUT_LOG" "do not match" \
    "mismatched key should have a clear error"
  pass "rejects mismatched key"
}

test_nginx_failure_restores_existing_files() {
  create_fixture nginx_failure
  create_certificate "$FIXTURES/valid" ad-creativity.tech 30
  ARCHIVE="$CASE_ROOT/certificate.tar"
  archive_certificate "$FIXTURES/valid" "$ARCHIVE"
  printf 'old certificate\n' >"$SSL_DIR/fullchain.pem"
  printf 'old key\n' >"$SSL_DIR/privkey.pem"

  if run_installer FAKE_NGINX_FAIL=1; then
    fail "nginx -t failure should fail installation"
    return
  fi
  [[ "$(cat "$SSL_DIR/fullchain.pem")" == "old certificate" ]] ||
    fail "old certificate should be restored"
  [[ "$(cat "$SSL_DIR/privkey.pem")" == "old key" ]] ||
    fail "old private key should be restored"
  if grep -Fq "systemctl reload" "$COMMAND_LOG"; then
    fail "Nginx must not reload after validation failure"
  fi
  pass "Nginx failure restores existing files"
}

test_installs_matching_certificate
test_rejects_extra_archive_entry
test_rejects_wrong_domain
test_rejects_near_expiry
test_rejects_mismatched_key
test_nginx_failure_restores_existing_files

if [[ "$FAILURES" -gt 0 ]]; then
  printf '%s test(s) failed\n' "$FAILURES" >&2
  exit 1
fi

printf 'All Nginx certificate installer tests passed.\n'
