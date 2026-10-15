#!/usr/bin/env bash

set -Eeuo pipefail

DOMAIN="${DOMAIN:-ad-creativity.tech}"
SSL_DIR="${SSL_DIR:-/etc/nginx/ssl/$DOMAIN}"
NGINX_BIN="${NGINX_BIN:-nginx}"
SYSTEMCTL_BIN="${SYSTEMCTL_BIN:-systemctl}"
INSTALL_USER="${INSTALL_USER:-root}"
INSTALL_GROUP="${INSTALL_GROUP:-root}"
REQUIRE_ROOT="${REQUIRE_ROOT:-true}"
MIN_VALID_SECONDS="${MIN_VALID_SECONDS:-1209600}"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

if [[ "$#" -ne 1 ]]; then
  die "Usage: $0 /path/to/${DOMAIN}_nginx.tar"
fi

archive="$1"
[[ -f "$archive" ]] || die "Certificate archive not found: $archive"
command -v openssl >/dev/null 2>&1 || die "OpenSSL is required."
command -v tar >/dev/null 2>&1 || die "tar is required."
[[ "$MIN_VALID_SECONDS" =~ ^[0-9]+$ ]] ||
  die "MIN_VALID_SECONDS must be a non-negative integer."

if [[ "$REQUIRE_ROOT" == "true" && "$EUID" -ne 0 ]]; then
  die "Run this installer as root."
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

tar -tf "$archive" >"$work_dir/archive-entries"
[[ "$(wc -l <"$work_dir/archive-entries" | tr -d '[:space:]')" == "2" ]] ||
  die "Certificate archive must contain exactly two files."
LC_ALL=C sort "$work_dir/archive-entries" >"$work_dir/archive-entries.sorted"
printf '%s\n' "$DOMAIN.key" "$DOMAIN.pem" |
  LC_ALL=C sort >"$work_dir/expected-entries.sorted"
cmp -s "$work_dir/archive-entries.sorted" "$work_dir/expected-entries.sorted" ||
  die "Certificate archive contains unexpected paths."

tar -xf "$archive" -C "$work_dir" "$DOMAIN.pem" "$DOMAIN.key"
certificate="$work_dir/$DOMAIN.pem"
private_key="$work_dir/$DOMAIN.key"

openssl x509 -in "$certificate" -noout >/dev/null 2>&1 ||
  die "Certificate is not a valid PEM X.509 certificate."
openssl pkey -in "$private_key" -noout -passin pass: >/dev/null 2>&1 ||
  die "Private key is invalid or encrypted."
openssl x509 -in "$certificate" -noout -checkend "$MIN_VALID_SECONDS" \
  >/dev/null 2>&1 ||
  die "Certificate expires too soon or is already expired."

san_entries="$(
  openssl x509 -in "$certificate" -noout -text |
    awk '
      /X509v3 Subject Alternative Name/ {
        getline
        gsub(/^[[:space:]]+|[[:space:]]+$/, "")
        print
        exit
      }
    '
)"
printf '%s\n' "$san_entries" |
  tr ',' '\n' |
  sed 's/^[[:space:]]*//; s/[[:space:]]*$//' |
  grep -Fqx "DNS:$DOMAIN" ||
  die "Certificate SAN must contain DNS:$DOMAIN."

certificate_public_key="$(
  openssl x509 -in "$certificate" -noout -pubkey |
    openssl pkey -pubin -outform pem
)"
private_public_key="$(
  openssl pkey -in "$private_key" -pubout -outform pem -passin pass:
)"
[[ "$certificate_public_key" == "$private_public_key" ]] ||
  die "Certificate and private key do not match."

install -d -m 700 -o "$INSTALL_USER" -g "$INSTALL_GROUP" "$SSL_DIR"
timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
certificate_backup="$SSL_DIR/fullchain.pem.$timestamp.bak"
private_key_backup="$SSL_DIR/privkey.pem.$timestamp.bak"
had_certificate=false
had_private_key=false

if [[ -f "$SSL_DIR/fullchain.pem" ]]; then
  cp -p "$SSL_DIR/fullchain.pem" "$certificate_backup"
  had_certificate=true
fi
if [[ -f "$SSL_DIR/privkey.pem" ]]; then
  cp -p "$SSL_DIR/privkey.pem" "$private_key_backup"
  had_private_key=true
fi

restore_backups_or_remove_new_files() {
  if [[ "$had_certificate" == "true" ]]; then
    cp -p "$certificate_backup" "$SSL_DIR/fullchain.pem"
  else
    rm -f "$SSL_DIR/fullchain.pem"
  fi

  if [[ "$had_private_key" == "true" ]]; then
    cp -p "$private_key_backup" "$SSL_DIR/privkey.pem"
  else
    rm -f "$SSL_DIR/privkey.pem"
  fi

  "$NGINX_BIN" -t >/dev/null 2>&1 || true
}

install -m 644 -o "$INSTALL_USER" -g "$INSTALL_GROUP" \
  "$certificate" "$SSL_DIR/fullchain.pem.new"
install -m 600 -o "$INSTALL_USER" -g "$INSTALL_GROUP" \
  "$private_key" "$SSL_DIR/privkey.pem.new"
mv -f "$SSL_DIR/fullchain.pem.new" "$SSL_DIR/fullchain.pem"
mv -f "$SSL_DIR/privkey.pem.new" "$SSL_DIR/privkey.pem"

if ! "$NGINX_BIN" -t; then
  restore_backups_or_remove_new_files
  die "nginx -t failed; the previous certificate was restored."
fi

if ! "$SYSTEMCTL_BIN" reload nginx; then
  printf 'ERROR: Nginx reload failed. Backups retained at:\n' >&2
  printf '  %s\n  %s\n' "$certificate_backup" "$private_key_backup" >&2
  exit 1
fi

printf 'Installed certificate for %s:\n' "$DOMAIN"
openssl x509 -in "$SSL_DIR/fullchain.pem" -noout -subject -issuer -dates
