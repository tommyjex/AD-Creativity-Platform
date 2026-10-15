# Local and Production HTTPS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trusted local HTTPS at `https://localhost:3000` and production HTTPS at `https://ad-creativity.tech` without committing certificates or changing internal Next.js/FastAPI HTTP communication.

**Architecture:** Local development uses a `mkcert` certificate consumed by the Next.js development server while preserving the existing HTTP command. Production uses a versioned Nginx site configuration and a guarded certificate installer that validates an external tar archive before atomically installing it and reloading Nginx. Browser traffic remains same-origin and FastAPI continues to listen on loopback HTTP.

**Tech Stack:** Bash, OpenSSL, mkcert, Next.js 16, Nginx, FastAPI/Pydantic, Vitest, pytest

---

## File Structure

- Create `scripts/setup_local_https.sh`: idempotently generate and validate a trusted localhost certificate.
- Create `scripts/tests/test_setup_local_https.sh`: isolated command-stub tests for local certificate setup.
- Modify `frontend/package.json`: expose `cert:https` and `dev:https` commands.
- Modify `.gitignore`: ignore the local certificate directory and private-key artifacts.
- Create `deploy/nginx/ad-creativity.conf`: production HTTP redirect and HTTPS reverse proxy configuration.
- Create `scripts/install_nginx_certificate.sh`: validate and atomically install the external production certificate archive.
- Create `scripts/tests/test_install_nginx_certificate.sh`: generate temporary certificates and test installer success/failure paths without touching `/etc`.
- Modify `.env.example`: document the exact local HTTPS and production HTTPS origin settings without changing HTTP defaults.
- Modify `README.md`: document local HTTP/HTTPS startup.
- Modify `docs/deployment/application-server-first-deployment.md`: replace generic domain/Certbot examples with the approved domain, certificate installer, Nginx deployment, renewal, rollback, and acceptance flow.

No application API or database files need modification. Existing `Settings` validation and authentication tests already enforce HTTPS production origins and secure cookies.

### Task 1: Add Tested Local Certificate Setup

**Files:**
- Create: `scripts/setup_local_https.sh`
- Create: `scripts/tests/test_setup_local_https.sh`
- Modify: `.gitignore:18-24`

- [ ] **Step 1: Write the failing shell tests**

Create `scripts/tests/test_setup_local_https.sh` with a temporary repository fixture, fake `mkcert`, and fake `openssl`. Cover these contracts:

```bash
test_missing_mkcert_explains_install() {
  create_fixture missing_mkcert

  if run_setup_without_mkcert; then
    fail "missing mkcert should return nonzero"
    return
  fi

  assert_contains "$OUTPUT_LOG" "brew install mkcert" \
    "the error should include the macOS installation command"
}

test_generates_expected_local_certificate() {
  create_fixture generate

  run_setup

  assert_contains "$COMMAND_LOG" "mkcert -install" \
    "the local CA should be initialized"
  assert_contains "$COMMAND_LOG" \
    "mkcert -cert-file $CERT_DIR/localhost.pem -key-file $CERT_DIR/localhost-key.pem localhost 127.0.0.1 ::1" \
    "the certificate should cover every approved local host"
  test -f "$CERT_DIR/localhost.pem"
  test -f "$CERT_DIR/localhost-key.pem"
}

test_reuses_valid_existing_certificate() {
  create_fixture reuse
  touch "$CERT_DIR/localhost.pem" "$CERT_DIR/localhost-key.pem"
  printf 'valid\n' >"$CASE_ROOT/certificate-state"

  run_setup

  assert_not_contains "$COMMAND_LOG" "mkcert -cert-file" \
    "a valid existing certificate should not be regenerated"
  assert_contains "$OUTPUT_LOG" "Local HTTPS certificate is ready" \
    "the ready paths should be printed"
}

test_regenerates_invalid_existing_certificate() {
  create_fixture regenerate
  touch "$CERT_DIR/localhost.pem" "$CERT_DIR/localhost-key.pem"
  printf 'invalid\n' >"$CASE_ROOT/certificate-state"

  run_setup

  assert_contains "$COMMAND_LOG" "mkcert -cert-file" \
    "an invalid existing certificate should be replaced"
}
```

The fake `openssl` must implement:

```bash
case "$*" in
  *"x509 -checkend 604800"*)
    [[ "$(cat "$CERTIFICATE_STATE" 2>/dev/null)" == "valid" ]]
    ;;
  *"x509 -noout -text"*)
    printf '%s\n' 'DNS:localhost, IP Address:127.0.0.1, IP Address:0:0:0:0:0:0:0:1'
    ;;
  *"x509 -noout -pubkey"*)
    printf '%s\n' 'PUBLIC KEY'
    ;;
  *"pkey -pubout"*)
    printf '%s\n' 'PUBLIC KEY'
    ;;
  *)
    exit 1
    ;;
esac
```

- [ ] **Step 2: Run the local setup tests and verify they fail**

Run:

```bash
bash scripts/tests/test_setup_local_https.sh
```

Expected: FAIL because `scripts/setup_local_https.sh` does not exist.

- [ ] **Step 3: Implement the local HTTPS setup script**

Create `scripts/setup_local_https.sh` with:

```bash
#!/usr/bin/env bash

set -Eeuo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
CERT_DIR="${LOCAL_HTTPS_CERT_DIR:-$REPO_ROOT/frontend/.certificates}"
CERT_FILE="$CERT_DIR/localhost.pem"
KEY_FILE="$CERT_DIR/localhost-key.pem"
MIN_VALID_SECONDS="${LOCAL_HTTPS_MIN_VALID_SECONDS:-604800}"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || return 1
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

  local certificate_key private_key
  certificate_key="$(
    openssl x509 -in "$CERT_FILE" -noout -pubkey |
      openssl pkey -pubin -outform pem
  )"
  private_key="$(
    openssl pkey -in "$KEY_FILE" -pubout -outform pem
  )"
  [[ "$certificate_key" == "$private_key" ]]
}

require_command openssl || die "OpenSSL is required."
if ! require_command mkcert; then
  die "mkcert is required. On macOS run: brew install mkcert"
fi

mkdir -p "$CERT_DIR"
chmod 700 "$CERT_DIR"

if ! certificate_is_reusable; then
  rm -f "$CERT_FILE" "$KEY_FILE"
  mkcert -install
  mkcert \
    -cert-file "$CERT_FILE" \
    -key-file "$KEY_FILE" \
    localhost 127.0.0.1 ::1
fi

chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"
printf 'Local HTTPS certificate is ready:\n  certificate: %s\n  private key: %s\n' \
  "$CERT_FILE" "$KEY_FILE"
```

Use `openssl pkey` instead of RSA modulus comparison so EC and RSA mkcert keys both work.

- [ ] **Step 4: Ignore local certificates and private keys**

Append to `.gitignore`:

```gitignore

# Local TLS certificates and private keys
frontend/.certificates/
*.key
```

Do not ignore all `*.pem` files because public CA bundles may legitimately be versioned later.

- [ ] **Step 5: Run the local setup tests and syntax checks**

Run:

```bash
bash -n scripts/setup_local_https.sh scripts/tests/test_setup_local_https.sh
bash scripts/tests/test_setup_local_https.sh
git check-ignore frontend/.certificates/localhost.pem
git check-ignore test.key
```

Expected: all shell tests print PASS; both example paths are ignored.

- [ ] **Step 6: Commit the local certificate setup**

```bash
git add .gitignore scripts/setup_local_https.sh scripts/tests/test_setup_local_https.sh
git commit -m "feat(dev): add trusted local HTTPS certificates"
```

### Task 2: Add the Next.js HTTPS Development Command

**Files:**
- Modify: `frontend/package.json:5-8`
- Modify: `frontend/tests/next-config.test.mjs`

- [ ] **Step 1: Add a failing package-script contract test**

Extend `frontend/tests/next-config.test.mjs`:

```javascript
import { readFile } from "node:fs/promises";

it("provides an explicit local HTTPS development command", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  );

  expect(packageJson.scripts["cert:https"]).toBe(
    "../scripts/setup_local_https.sh"
  );
  expect(packageJson.scripts["dev:https"]).toBe(
    "npm run cert:https && next dev --hostname localhost --experimental-https " +
      "--experimental-https-cert .certificates/localhost.pem " +
      "--experimental-https-key .certificates/localhost-key.pem"
  );
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd frontend
npx vitest run tests/next-config.test.mjs
```

Expected: FAIL because `cert:https` and `dev:https` are undefined.

- [ ] **Step 3: Add the package commands**

Update the start of `frontend/package.json` scripts:

```json
"scripts": {
  "dev": "next dev",
  "cert:https": "../scripts/setup_local_https.sh",
  "dev:https": "npm run cert:https && next dev --hostname localhost --experimental-https --experimental-https-cert .certificates/localhost.pem --experimental-https-key .certificates/localhost-key.pem",
  "build": "next build",
  "start": "next start"
}
```

Keep `npm run dev` unchanged so HTTP remains available.

- [ ] **Step 4: Run focused and frontend checks**

Run:

```bash
cd frontend
npx vitest run tests/next-config.test.mjs
npm run typecheck
npm run lint
```

Expected: all commands exit zero.

- [ ] **Step 5: Commit the frontend HTTPS command**

```bash
git add frontend/package.json frontend/tests/next-config.test.mjs
git commit -m "feat(frontend): add local HTTPS dev command"
```

### Task 3: Add the Production Nginx Site

**Files:**
- Create: `deploy/nginx/ad-creativity.conf`
- Create: `scripts/tests/test_nginx_config.sh`

- [ ] **Step 1: Write a failing static Nginx contract test**

Create `scripts/tests/test_nginx_config.sh`:

```bash
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
require_line 'return 301 https://$host$request_uri;'
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
```

- [ ] **Step 2: Run the Nginx contract and verify it fails**

Run:

```bash
bash scripts/tests/test_nginx_config.sh
```

Expected: FAIL because the configuration file does not exist.

- [ ] **Step 3: Create the production Nginx configuration**

Create `deploy/nginx/ad-creativity.conf`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name ad-creativity.tech;

    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ad-creativity.tech;

    ssl_certificate /etc/nginx/ssl/ad-creativity.tech/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/ad-creativity.tech/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:ADCreativityTLS:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 2g;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Request-ID $request_id;
        proxy_connect_timeout 30s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    location = /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Request-ID $request_id;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 30s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
    }
}
```

- [ ] **Step 4: Run static and optional native Nginx checks**

Run:

```bash
bash -n scripts/tests/test_nginx_config.sh
bash scripts/tests/test_nginx_config.sh
```

On a Linux host with Nginx and temporary test certificates installed, additionally run:

```bash
sudo nginx -t
```

Expected: the static contract passes. Record native `nginx -t` as environment-dependent if Nginx is unavailable on macOS.

- [ ] **Step 5: Commit the Nginx site**

```bash
git add deploy/nginx/ad-creativity.conf scripts/tests/test_nginx_config.sh
git commit -m "feat(deploy): add production HTTPS Nginx site"
```

### Task 4: Add the Guarded Production Certificate Installer

**Files:**
- Create: `scripts/install_nginx_certificate.sh`
- Create: `scripts/tests/test_install_nginx_certificate.sh`

- [ ] **Step 1: Write isolated failing installer tests**

Create `scripts/tests/test_install_nginx_certificate.sh`. Generate RSA fixtures with the system OpenSSL:

```bash
create_certificate() {
  local name="$1"
  local common_name="$2"
  local days="$3"

  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$FIXTURES/$name.key" \
    -out "$FIXTURES/$name.pem" \
    -days "$days" \
    -subj "/CN=$common_name" \
    -addext "subjectAltName=DNS:$common_name" >/dev/null 2>&1
}
```

If the host OpenSSL lacks `-addext`, write a temporary config with a `[san]` section and use
`-extensions san -config "$config"`. Cover:

```bash
test_installs_matching_certificate_atomically
test_rejects_archive_with_extra_entries
test_rejects_wrong_domain
test_rejects_certificate_near_expiry
test_rejects_mismatched_private_key
test_nginx_failure_does_not_reload
test_successful_validation_reloads_nginx
test_existing_files_receive_timestamped_backup
```

Each test must set:

```bash
SSL_DIR="$CASE_ROOT/etc/nginx/ssl/ad-creativity.tech"
NGINX_BIN="$FAKE_BIN/nginx"
SYSTEMCTL_BIN="$FAKE_BIN/systemctl"
INSTALL_USER="$(id -un)"
INSTALL_GROUP="$(id -gn)"
REQUIRE_ROOT=false
MIN_VALID_SECONDS=1209600
```

Assertions for the success path:

```bash
assert_mode "$SSL_DIR/fullchain.pem" "644"
assert_mode "$SSL_DIR/privkey.pem" "600"
cmp "$SSL_DIR/fullchain.pem" "$FIXTURES/valid.pem"
cmp "$SSL_DIR/privkey.pem" "$FIXTURES/valid.key"
assert_contains "$COMMAND_LOG" "nginx -t"
assert_contains "$COMMAND_LOG" "systemctl reload nginx"
```

- [ ] **Step 2: Run installer tests and verify they fail**

Run:

```bash
bash scripts/tests/test_install_nginx_certificate.sh
```

Expected: FAIL because `scripts/install_nginx_certificate.sh` does not exist.

- [ ] **Step 3: Implement archive and certificate validation**

Create `scripts/install_nginx_certificate.sh` with strict defaults:

```bash
DOMAIN="${DOMAIN:-ad-creativity.tech}"
SSL_DIR="${SSL_DIR:-/etc/nginx/ssl/$DOMAIN}"
NGINX_BIN="${NGINX_BIN:-nginx}"
SYSTEMCTL_BIN="${SYSTEMCTL_BIN:-systemctl}"
INSTALL_USER="${INSTALL_USER:-root}"
INSTALL_GROUP="${INSTALL_GROUP:-root}"
REQUIRE_ROOT="${REQUIRE_ROOT:-true}"
MIN_VALID_SECONDS="${MIN_VALID_SECONDS:-1209600}"
```

Require exactly one positional archive argument. Before extracting:

```bash
tar -tf "$archive" >"$work_dir/archive-entries"
[[ "$(wc -l <"$work_dir/archive-entries" | tr -d '[:space:]')" == "2" ]] ||
  die "Certificate archive must contain exactly two files."
LC_ALL=C sort "$work_dir/archive-entries" >"$work_dir/archive-entries.sorted"
printf '%s\n' "$DOMAIN.key" "$DOMAIN.pem" |
  LC_ALL=C sort >"$work_dir/expected-entries.sorted"
cmp -s "$work_dir/archive-entries.sorted" "$work_dir/expected-entries.sorted" ||
  die "Certificate archive contains unexpected paths."
```

Use `mktemp -d`, trap cleanup, and extract only after the listing passes. Validate:

```bash
openssl x509 -in "$certificate" -noout >/dev/null
openssl pkey -in "$private_key" -noout >/dev/null
openssl x509 -in "$certificate" -noout -checkend "$MIN_VALID_SECONDS"
```

Read SAN from `openssl x509 -in "$certificate" -noout -text`, extract the Subject Alternative
Name block, and require a comma/newline-delimited exact `DNS:ad-creativity.tech` entry. Do not
accept CN-only certificates, wildcards, or `www.ad-creativity.tech`.

```bash
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
```

Compare public keys:

```bash
certificate_public_key="$(
  openssl x509 -in "$certificate" -noout -pubkey |
    openssl pkey -pubin -outform pem
)"
private_public_key="$(
  openssl pkey -in "$private_key" -pubout -outform pem
)"
[[ "$certificate_public_key" == "$private_public_key" ]] ||
  die "Certificate and private key do not match."
```

- [ ] **Step 4: Implement guarded installation, backup, validation, and reload**

Continue the installer:

```bash
if [[ "$REQUIRE_ROOT" == "true" && "$EUID" -ne 0 ]]; then
  die "Run this installer as root."
fi

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

"$SYSTEMCTL_BIN" reload nginx ||
  die "Nginx reload failed; restore the timestamped backup and retry."
```

Define the rollback function before installation:

```bash
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
```

On reload failure, retain backups and print `certificate_backup` and `private_key_backup`;
do not automatically reload again because Nginx continues serving with its existing workers.

- [ ] **Step 5: Run installer tests and validate the supplied certificate**

Run:

```bash
bash -n \
  scripts/install_nginx_certificate.sh \
  scripts/tests/test_install_nginx_certificate.sh
bash scripts/tests/test_install_nginx_certificate.sh
```

Then validate the real archive into an isolated directory with fake system commands:

```bash
tmpdir="$(mktemp -d)"
mkdir -p "$tmpdir/bin"
printf '#!/usr/bin/env bash\nexit 0\n' >"$tmpdir/bin/nginx"
printf '#!/usr/bin/env bash\nexit 0\n' >"$tmpdir/bin/systemctl"
chmod +x "$tmpdir/bin/nginx" "$tmpdir/bin/systemctl"

SSL_DIR="$tmpdir/ssl" \
NGINX_BIN="$tmpdir/bin/nginx" \
SYSTEMCTL_BIN="$tmpdir/bin/systemctl" \
INSTALL_USER="$(id -un)" \
INSTALL_GROUP="$(id -gn)" \
REQUIRE_ROOT=false \
bash scripts/install_nginx_certificate.sh \
  /Users/bytedance/Downloads/ad-creativity.tech_nginx.tar

openssl x509 -in "$tmpdir/ssl/fullchain.pem" -noout \
  -subject -issuer -dates
rm -rf "$tmpdir"
```

Expected: installer exits zero and reports `ad-creativity.tech`; no key content is printed.

- [ ] **Step 6: Commit the certificate installer**

```bash
git add scripts/install_nginx_certificate.sh scripts/tests/test_install_nginx_certificate.sh
git commit -m "feat(deploy): validate and install Nginx certificates"
```

### Task 5: Document Exact Environment and Deployment Workflows

**Files:**
- Modify: `.env.example:1-14`
- Modify: `README.md:19-40,177-203`
- Modify: `docs/deployment/application-server-first-deployment.md:170-205,300-420,606-719,897-928`

- [ ] **Step 1: Update the environment template comments**

Keep the current HTTP values as executable defaults and add:

```dotenv
# Local HTTPS override:
# CORS_ORIGINS=https://localhost:3000
# SITE_ORIGIN=https://localhost:3000
# AUTH_COOKIE_SECURE=true
#
# Production HTTPS:
# APP_ENV=production
# CORS_ORIGINS=https://ad-creativity.tech
# SITE_ORIGIN=https://ad-creativity.tech
# AUTH_COOKIE_SECURE=true
```

Do not add certificate paths to application `.env`; TLS termination belongs to Next.js dev
arguments or Nginx.

- [ ] **Step 2: Update README local HTTPS instructions**

Document:

```bash
brew install mkcert

# In .env, use https://localhost:3000 for CORS_ORIGINS and SITE_ORIGIN,
# and set AUTH_COOKIE_SECURE=true.
cd frontend
npm run dev:https
```

State that `npm run dev` remains the HTTP command, local certificates live under the ignored
`frontend/.certificates/` directory, and browser API calls remain same-origin through `/api`.

- [ ] **Step 3: Replace generic production domain and Nginx guidance**

In `docs/deployment/application-server-first-deployment.md`:

1. Replace production examples using `ad.example.com` with `ad-creativity.tech`.
2. State that the supplied certificate covers only `ad-creativity.tech`, not `www`.
3. Install the versioned Nginx configuration:

```bash
sudo install -m 644 \
  deploy/nginx/ad-creativity.conf \
  /etc/nginx/sites-available/ad-creativity
sudo ln -sfn \
  /etc/nginx/sites-available/ad-creativity \
  /etc/nginx/sites-enabled/ad-creativity
sudo rm -f /etc/nginx/sites-enabled/default
```

4. Install the external certificate:

```bash
sudo scripts/install_nginx_certificate.sh \
  /secure/path/ad-creativity.tech_nginx.tar
```

5. Explain that the archive stays outside the repository and should be transferred through the
approved secret-delivery channel.
6. Replace Certbot renewal text with manual replacement before 2027-04-26, including timestamped
backup restoration and `sudo nginx -t && sudo systemctl reload nginx`.
7. Add acceptance commands:

```bash
curl -I http://ad-creativity.tech/health
curl --fail https://ad-creativity.tech/health
openssl s_client -connect ad-creativity.tech:443 \
  -servername ad-creativity.tech </dev/null
```

8. Add browser login verification for `Secure; HttpOnly; SameSite=Lax`.
9. Update the release checklist to require certificate/domain match, HTTP redirect, TLS 1.2/1.3,
HSTS, loopback-only ports 3000/8000, and a recorded certificate replacement owner/date.

- [ ] **Step 4: Check documentation consistency**

Run:

```bash
rg -n 'ad\.example\.com|certbot|www\.ad-creativity\.tech' \
  README.md .env.example docs/deployment/application-server-first-deployment.md
```

Expected:

- No `ad.example.com` or Certbot instructions remain in active production guidance.
- `www.ad-creativity.tech` appears only in an explicit unsupported-host warning.

Run:

```bash
rg -n 'https://ad-creativity\.tech|https://localhost:3000|AUTH_COOKIE_SECURE=true' \
  README.md .env.example docs/deployment/application-server-first-deployment.md
```

Expected: all three files contain the applicable exact HTTPS settings.

- [ ] **Step 5: Commit documentation**

```bash
git add .env.example README.md docs/deployment/application-server-first-deployment.md
git commit -m "docs(deploy): document local and production HTTPS"
```

### Task 6: Run End-to-End Regression and Security Checks

**Files:**
- Verify: all files changed in Tasks 1-5

- [ ] **Step 1: Run all shell and configuration tests**

```bash
bash -n \
  scripts/setup_local_https.sh \
  scripts/install_nginx_certificate.sh \
  scripts/tests/test_setup_local_https.sh \
  scripts/tests/test_install_nginx_certificate.sh \
  scripts/tests/test_nginx_config.sh \
  scripts/deploy_server.sh \
  scripts/tests/test_deploy_server.sh

bash scripts/tests/test_setup_local_https.sh
bash scripts/tests/test_install_nginx_certificate.sh
bash scripts/tests/test_nginx_config.sh
bash scripts/tests/test_deploy_server.sh
```

Expected: every test prints PASS and exits zero.

- [ ] **Step 2: Run focused backend security tests**

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_config.py \
  backend/tests/test_auth_api.py \
  backend/tests/test_main.py -q
```

Expected: all tests pass, including secure production Cookie and Origin checks.

- [ ] **Step 3: Run complete backend regression**

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests -q
```

Expected: all backend tests pass.

- [ ] **Step 4: Run complete frontend regression and production build**

```bash
cd frontend
npm run typecheck
npm run lint
npm test
env -u NEXT_PUBLIC_BACKEND_BASE_URL npm run build
```

Expected: typecheck, lint, all Vitest tests, and production build pass.

- [ ] **Step 5: Verify no certificate or private key is tracked**

```bash
git ls-files | rg '\.(key|pem)$|frontend/\.certificates' && exit 1 || true
git status --short
git diff --check
```

Expected: no tracked key/certificate paths, clean whitespace check, and only intended changes.

- [ ] **Step 6: Perform local HTTPS smoke test**

With the backend running under the local HTTPS `.env` values:

```bash
cd frontend
npm run dev:https
```

In another terminal:

```bash
curl --fail --cacert "$(mkcert -CAROOT)/rootCA.pem" \
  https://localhost:3000/api/auth/setup-status
```

Expected: trusted TLS connection and a JSON setup-status response. Verify login in the browser
and confirm the `ad_session` Cookie has `Secure`, `HttpOnly`, and `SameSite=Lax`.

- [ ] **Step 7: Perform production-host checks after deployment**

Only after DNS points to the server and the operator has explicitly deployed the certificate:

```bash
curl -I http://ad-creativity.tech/health
curl --fail https://ad-creativity.tech/health
openssl s_client -connect ad-creativity.tech:443 \
  -servername ad-creativity.tech </dev/null |
  openssl x509 -noout -subject -issuer -dates
```

Expected: HTTP returns 301 to the same HTTPS path/query, HTTPS health returns 200, and the
certificate subject is `ad-creativity.tech`.

- [ ] **Step 8: Commit any verification-only corrections**

If verification required code or documentation corrections:

```bash
git add \
  .gitignore \
  .env.example \
  README.md \
  deploy/nginx/ad-creativity.conf \
  docs/deployment/application-server-first-deployment.md \
  frontend/package.json \
  frontend/tests/next-config.test.mjs \
  scripts/setup_local_https.sh \
  scripts/install_nginx_certificate.sh \
  scripts/tests/test_setup_local_https.sh \
  scripts/tests/test_install_nginx_certificate.sh \
  scripts/tests/test_nginx_config.sh
git commit -m "fix(deploy): address HTTPS verification findings"
```

Skip this commit when no corrections were needed.
