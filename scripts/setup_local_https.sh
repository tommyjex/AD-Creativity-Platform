#!/usr/bin/env bash

set -Eeuo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
CERT_DIR="${LOCAL_HTTPS_CERT_DIR:-$REPO_ROOT/frontend/.certificates}"
CERT_FILE="$CERT_DIR/localhost.pem"
KEY_FILE="$CERT_DIR/localhost-key.pem"
MIN_VALID_SECONDS="${LOCAL_HTTPS_MIN_VALID_SECONDS:-604800}"
MKCERT_BIN="${MKCERT_BIN:-}"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

certificate_is_reusable() {
  [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]] || return 1
  openssl x509 -in "$CERT_FILE" -noout -checkend "$MIN_VALID_SECONDS" \
    >/dev/null 2>&1 || return 1

  local certificate_text
  certificate_text="$(openssl x509 -in "$CERT_FILE" -noout -text)"
  grep -Fq 'DNS:localhost' <<<"$certificate_text" || return 1
  grep -Fq 'IP Address:127.0.0.1' <<<"$certificate_text" || return 1
  grep -Fq 'IP Address:0:0:0:0:0:0:0:1' <<<"$certificate_text" || return 1

  local certificate_key
  local private_key
  certificate_key="$(
    openssl x509 -in "$CERT_FILE" -noout -pubkey |
      openssl pkey -pubin -outform pem
  )"
  private_key="$(
    openssl pkey -in "$KEY_FILE" -pubout -outform pem
  )"
  [[ "$certificate_key" == "$private_key" ]]
}

command -v openssl >/dev/null 2>&1 || die "OpenSSL is required."
if [[ -z "$MKCERT_BIN" ]]; then
  if command -v mkcert >/dev/null 2>&1; then
    MKCERT_BIN="$(command -v mkcert)"
  elif [[ -x "$CERT_DIR/bin/mkcert" ]]; then
    MKCERT_BIN="$CERT_DIR/bin/mkcert"
  else
    die "mkcert is required. On macOS run: brew install mkcert"
  fi
fi

mkdir -p "$CERT_DIR"
chmod 700 "$CERT_DIR"

if ! certificate_is_reusable; then
  rm -f "$CERT_FILE" "$KEY_FILE"
  "$MKCERT_BIN" -install
  "$MKCERT_BIN" \
    -cert-file "$CERT_FILE" \
    -key-file "$KEY_FILE" \
    localhost 127.0.0.1 ::1
fi

chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"
printf 'Local HTTPS certificate is ready:\n  certificate: %s\n  private key: %s\n' \
  "$CERT_FILE" "$KEY_FILE"
