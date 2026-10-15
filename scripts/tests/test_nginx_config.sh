#!/usr/bin/env bash

set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="$REPO_ROOT/deploy/nginx/ad-creativity.conf"

require_line() {
  grep -Fq -- "$1" "$CONFIG" || {
    printf 'FAIL: missing Nginx directive: %s\n' "$1" >&2
    exit 1
  }
}

require_line 'server_name ad-creativity.tech;'
require_line 'return 301 https://ad-creativity.tech$request_uri;'
require_line 'listen 443 ssl;'
require_line 'ssl_protocols TLSv1.2 TLSv1.3;'
require_line 'ssl_certificate /etc/nginx/ssl/ad-creativity.tech/fullchain.pem;'
require_line 'ssl_certificate_key /etc/nginx/ssl/ad-creativity.tech/privkey.pem;'
require_line 'add_header Strict-Transport-Security "max-age=31536000" always;'
require_line 'client_max_body_size 2g;'
require_line 'proxy_read_timeout 3600s;'
require_line 'proxy_request_buffering off;'
require_line 'proxy_pass http://127.0.0.1:8000;'
require_line 'proxy_pass http://127.0.0.1:3000;'

if grep -Eq 'includeSubDomains|preload|www\.ad-creativity\.tech' "$CONFIG"; then
  printf 'FAIL: unsupported HSTS scope or hostname found\n' >&2
  exit 1
fi

printf 'PASS: production Nginx HTTPS contract\n'
