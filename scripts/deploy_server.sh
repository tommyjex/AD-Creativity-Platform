#!/usr/bin/env bash

set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKEND_SERVICE="${BACKEND_SERVICE:-ad-creativity-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-ad-creativity-frontend}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:8000/health}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-http://127.0.0.1:3000/}"
HEALTH_CHECK_ATTEMPTS="${HEALTH_CHECK_ATTEMPTS:-30}"
HEALTH_CHECK_INTERVAL_SECONDS="${HEALTH_CHECK_INTERVAL_SECONDS:-2}"
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-/tmp/ad-creativity-deploy.lock}"

SERVICES_TOUCHED=0

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
  log "ERROR: $*" >&2
  return 1
}

require_command() {
  local command_name="$1"

  command -v "$command_name" >/dev/null 2>&1 ||
    die "Required command not found: $command_name"
}

require_file() {
  local path="$1"

  [[ -f "$path" ]] || die "Required file not found: $path"
}

require_directory() {
  local path="$1"

  [[ -d "$path" ]] || die "Required directory not found: $path"
}

require_executable() {
  local path="$1"

  [[ -x "$path" ]] || die "Required executable not found or not executable: $path"
}

trim_whitespace() {
  local value="$1"

  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

read_dotenv_value() {
  local name="$1"
  local line
  local value=""
  local found=0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?${name}[[:space:]]*=(.*)$ ]]; then
      value="$(trim_whitespace "${BASH_REMATCH[2]}")"
      if [[ "${#value}" -ge 2 ]] &&
        { [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]] ||
          [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; }; then
        value="${value:1:${#value}-2}"
      fi
      value="$(trim_whitespace "$value")"
      found=1
    fi
  done <"$APP_ROOT/.env"

  [[ "$found" -eq 1 ]] || return 1
  printf '%s' "$value"
}

normalize_http_origin() {
  local value="$1"

  "$APP_ROOT/.venv/bin/python" - "$value" <<'PY'
import sys
from urllib.parse import urlsplit

value = sys.argv[1].strip()
if any(character.isspace() for character in value):
    raise SystemExit(1)

try:
    parsed = urlsplit(value)
    port = parsed.port
except ValueError:
    raise SystemExit(1)

if (
    parsed.scheme.casefold() not in {"http", "https"}
    or parsed.hostname is None
    or parsed.username is not None
    or parsed.password is not None
    or parsed.path not in {"", "/"}
    or parsed.query
    or parsed.fragment
):
    raise SystemExit(1)

host = parsed.hostname.casefold()
if ":" in host:
    host = f"[{host}]"
scheme = parsed.scheme.casefold()
default_port = 80 if scheme == "http" else 443
authority = host if port in {None, default_port} else f"{host}:{port}"
print(f"{scheme}://{authority}", end="")
PY
}

run_privileged() {
  if [[ "$EUID" -eq 0 ]]; then
    "$@"
  else
    sudo -n "$@"
  fi
}

print_service_diagnostics() {
  local service

  log "Deployment failed after service restart began; collecting diagnostics." >&2
  for service in "$BACKEND_SERVICE" "$FRONTEND_SERVICE"; do
    log "systemctl status $service" >&2
    run_privileged systemctl status "$service" --no-pager || true
    log "journalctl -u $service -n 100" >&2
    run_privileged journalctl -u "$service" -n 100 --no-pager || true
  done
}

on_error() {
  local exit_code="$?"
  local line_number="$1"

  trap - ERR
  set +e
  log "Deployment failed at line $line_number with exit code $exit_code." >&2
  if [[ "$SERVICES_TOUCHED" -eq 1 ]]; then
    print_service_diagnostics
  fi
  exit "$exit_code"
}

trap 'on_error "$LINENO"' ERR

validate_positive_integer() {
  local name="$1"
  local value="$2"

  [[ "$value" =~ ^[0-9]+$ ]] || die "$name must be a non-negative integer"
}

preflight() {
  local allow_insecure_auth_cookie
  local allow_insecure_cors
  local app_env
  local auth_cookie_secure
  local cors_origins
  local cors_origin
  local cors_contains_site_origin=0
  local cors_has_wildcard=0
  local -a configured_origins
  local node_version
  local node_major
  local normalized_cors_origin
  local normalized_site_origin
  local site_origin

  log "Running deployment preflight checks."

  require_file "$APP_ROOT/.env"
  require_file "$APP_ROOT/requirements.txt"
  require_file "$APP_ROOT/frontend/package.json"
  require_file "$APP_ROOT/frontend/package-lock.json"
  require_executable "$APP_ROOT/.venv/bin/python"
  require_directory "$APP_ROOT/backend"

  app_env="$(read_dotenv_value "APP_ENV")" ||
    die "APP_ENV must be set to production in $APP_ROOT/.env"
  cors_origins="$(read_dotenv_value "CORS_ORIGINS")" ||
    die "CORS_ORIGINS must be set and non-empty in $APP_ROOT/.env"
  if ! site_origin="$(read_dotenv_value "SITE_ORIGIN")"; then
    site_origin=""
  fi
  auth_cookie_secure="$(read_dotenv_value "AUTH_COOKIE_SECURE")" ||
    die "AUTH_COOKIE_SECURE must be exactly true or false in $APP_ROOT/.env"
  if ! allow_insecure_auth_cookie="$(
    read_dotenv_value "ALLOW_INSECURE_AUTH_COOKIE"
  )"; then
    allow_insecure_auth_cookie=false
  fi
  if ! allow_insecure_cors="$(read_dotenv_value "ALLOW_INSECURE_CORS")"; then
    allow_insecure_cors=false
  fi
  case "$allow_insecure_auth_cookie" in
    true | false) ;;
    *)
      die "ALLOW_INSECURE_AUTH_COOKIE must be exactly true or false in $APP_ROOT/.env"
      ;;
  esac
  case "$allow_insecure_cors" in
    true | false) ;;
    *)
      die "ALLOW_INSECURE_CORS must be exactly true or false in $APP_ROOT/.env"
      ;;
  esac

  [[ -n "$cors_origins" ]] ||
    die "CORS_ORIGINS must be set and non-empty in $APP_ROOT/.env"
  [[ "$app_env" == "production" || "$app_env" == "prod" ]] ||
    die "APP_ENV must be set to production in $APP_ROOT/.env"
  case "$auth_cookie_secure" in
    true | false) ;;
    *)
      die "AUTH_COOKIE_SECURE must be exactly true or false in $APP_ROOT/.env"
      ;;
  esac
  if [[ "$auth_cookie_secure" == "false" ]]; then
    [[ "$allow_insecure_auth_cookie" == "true" ]] ||
      die "AUTH_COOKIE_SECURE=false requires ALLOW_INSECURE_AUTH_COOKIE=true in $APP_ROOT/.env"
    log "WARNING: insecure authentication cookies are enabled; public HTTP sessions can be intercepted."
  fi
  IFS=',' read -r -a configured_origins <<<"$cors_origins"
  for cors_origin in "${configured_origins[@]}"; do
    cors_origin="$(trim_whitespace "$cors_origin")"
    if [[ "$cors_origin" == "*" ]]; then
      cors_has_wildcard=1
    fi
  done

  if [[ "$cors_has_wildcard" -eq 1 ]]; then
    [[ "$allow_insecure_cors" == "true" ]] ||
      die "CORS_ORIGINS='*' requires ALLOW_INSECURE_CORS=true in $APP_ROOT/.env"
    for cors_origin in "${configured_origins[@]}"; do
      cors_origin="$(trim_whitespace "$cors_origin")"
      [[ -z "$cors_origin" || "$cors_origin" == "*" ]] && continue
      normalize_http_origin "$cors_origin" >/dev/null ||
        die "CORS_ORIGINS entries must be valid HTTP(S) origins in $APP_ROOT/.env"
    done
    if [[ -n "$site_origin" ]]; then
      normalize_http_origin "$site_origin" >/dev/null ||
        die "SITE_ORIGIN must be a valid HTTP(S) origin without path, query, userinfo, fragment, or whitespace in $APP_ROOT/.env"
    fi
    log "WARNING: wildcard CORS is enabled; cross-origin credentials remain disabled."
  else
    [[ -n "$site_origin" ]] ||
      die "SITE_ORIGIN must be set and non-empty in $APP_ROOT/.env"
    normalized_site_origin="$(normalize_http_origin "$site_origin")" ||
      die "SITE_ORIGIN must be a valid HTTP(S) origin without path, query, userinfo, fragment, or whitespace in $APP_ROOT/.env"
    [[ "$normalized_site_origin" == https://* ]] ||
      die "SITE_ORIGIN must use HTTPS in $APP_ROOT/.env"
    for cors_origin in "${configured_origins[@]}"; do
      cors_origin="$(trim_whitespace "$cors_origin")"
      [[ -n "$cors_origin" ]] || continue
      normalized_cors_origin="$(normalize_http_origin "$cors_origin")" ||
        die "CORS_ORIGINS entries must be valid HTTP(S) origins in $APP_ROOT/.env"
      if [[ "$normalized_cors_origin" == "$normalized_site_origin" ]]; then
        cors_contains_site_origin=1
      fi
    done
    [[ "$cors_contains_site_origin" -eq 1 ]] ||
      die "CORS_ORIGINS must include SITE_ORIGIN in $APP_ROOT/.env"
  fi

  require_command curl
  require_command env
  require_command flock
  require_command journalctl
  require_command node
  require_command npm
  require_command systemctl

  if [[ "$EUID" -ne 0 ]]; then
    require_command sudo
    sudo -n true || die "Passwordless sudo is required to manage systemd services"
  fi

  validate_positive_integer "HEALTH_CHECK_ATTEMPTS" "$HEALTH_CHECK_ATTEMPTS"
  validate_positive_integer \
    "HEALTH_CHECK_INTERVAL_SECONDS" \
    "$HEALTH_CHECK_INTERVAL_SECONDS"
  [[ "$HEALTH_CHECK_ATTEMPTS" -gt 0 ]] ||
    die "HEALTH_CHECK_ATTEMPTS must be greater than zero"

  node_version="$(node --version)"
  node_major="${node_version#v}"
  node_major="${node_major%%.*}"
  [[ "$node_major" =~ ^[0-9]+$ ]] ||
    die "Unable to parse Node.js version: $node_version"
  [[ "$node_major" -ge 22 ]] ||
    die "Node.js 22 or newer is required; found $node_version"

  log "Preflight checks passed with Node.js $node_version."
}

acquire_deployment_lock() {
  exec 9>"$DEPLOY_LOCK_FILE"
  flock -n 9 || die "Another deployment is already running (lock: $DEPLOY_LOCK_FILE)"
}

install_and_build() {
  log "Installing backend dependencies."
  "$APP_ROOT/.venv/bin/python" \
    -m pip install \
    -r "$APP_ROOT/requirements.txt"

  log "Compiling backend Python sources."
  "$APP_ROOT/.venv/bin/python" -m compileall -q "$APP_ROOT/backend"

  log "Installing frontend dependencies."
  (
    cd "$APP_ROOT/frontend"
    npm ci
  )

  log "Building the frontend."
  (
    cd "$APP_ROOT/frontend"
    env -u NEXT_PUBLIC_BACKEND_BASE_URL npm run build
  )
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempt

  for ((attempt = 1; attempt <= HEALTH_CHECK_ATTEMPTS; attempt += 1)); do
    if curl --fail --silent --show-error --output /dev/null "$url"; then
      log "$name health check passed: $url"
      return 0
    fi

    if [[ "$attempt" -lt "$HEALTH_CHECK_ATTEMPTS" ]]; then
      log "$name is not ready (attempt $attempt/$HEALTH_CHECK_ATTEMPTS)."
      sleep "$HEALTH_CHECK_INTERVAL_SECONDS"
    fi
  done

  die "$name health check failed after $HEALTH_CHECK_ATTEMPTS attempts: $url"
}

restart_and_verify() {
  log "Restarting $BACKEND_SERVICE and $FRONTEND_SERVICE."
  SERVICES_TOUCHED=1
  run_privileged systemctl restart "$BACKEND_SERVICE" "$FRONTEND_SERVICE"

  run_privileged systemctl is-active --quiet "$BACKEND_SERVICE"
  run_privileged systemctl is-active --quiet "$FRONTEND_SERVICE"

  wait_for_url "Backend" "$BACKEND_HEALTH_URL"
  wait_for_url "Frontend" "$FRONTEND_HEALTH_URL"
}

main() {
  require_command flock
  acquire_deployment_lock
  preflight
  install_and_build
  restart_and_verify
  log "Deployment completed successfully."
}

main "$@"
