# Insecure Production Auth Cookie Opt-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an explicitly authorized production deployment to keep an authentication session over a public HTTP IP while preserving secure cookies as the production default.

**Architecture:** Add a dedicated `ALLOW_INSECURE_AUTH_COOKIE` setting and require it whenever production uses `AUTH_COOKIE_SECURE=false`. Enforce the same contract in Pydantic settings and deployment preflight, emit a structured startup warning plus a deployment warning when the insecure pair is active, and leave the existing cookie-writing functions unchanged so all authentication paths continue to share one cookie policy.

**Tech Stack:** Python 3, FastAPI, Pydantic, pytest, Bash, shell fixture tests, structured TLS logging.

---

## File Map

- Modify `backend/app/core/config.py`: define and validate the explicit opt-in and strictly parse both cookie-security booleans.
- Modify `backend/tests/test_config.py`: cover defaults, valid production combinations, rejected combinations, and strict environment parsing.
- Modify `backend/app/main.py`: emit one privacy-safe warning when insecure production cookies are active.
- Modify `backend/tests/test_main.py`: verify warning emission and suppression.
- Modify `backend/tests/test_auth_api.py`: verify login and 401-clearing cookie attributes in insecure mode.
- Modify `scripts/deploy_server.sh`: enforce the same explicit opt-in during preflight and print the operational warning.
- Modify `scripts/tests/test_deploy_server.sh`: cover successful, rejected, and non-warning deployment combinations.
- Modify `.env.example`: document the disabled-by-default switch.
- Modify `docs/deployment/application-server-first-deployment.md`: document temporary public HTTP configuration, risks, verification, and HTTPS rollback.
- Preserve `frontend/lib/api-client.ts` debug regions and `debug-production-auth-cookie.md` until the user confirms the production fix; do not stage either file in implementation commits.

### Task 1: Backend Configuration Contract

**Files:**
- Modify: `backend/tests/test_config.py:47-90`
- Modify: `backend/tests/test_config.py:158-258`
- Modify: `backend/app/core/config.py:110-125`
- Modify: `backend/app/core/config.py:210-245`
- Modify: `backend/app/core/config.py:250-285`

- [ ] **Step 1: Add failing model-level tests for the production matrix**

Add these assertions near the existing authentication security tests:

```python
def test_auth_security_defaults() -> None:
    settings = Settings()

    assert settings.site_origin == "http://localhost:3000"
    assert settings.allow_insecure_auth_cookie is False
    assert settings.auth_cookie_secure is False
    assert settings.auth_session_idle_seconds == 12 * 60 * 60
    assert settings.auth_session_absolute_seconds == 7 * 24 * 60 * 60
    assert settings.auth_login_window_seconds == 15 * 60
    assert settings.auth_login_max_failures == 5


def test_production_allows_insecure_cookie_with_explicit_opt_in() -> None:
    settings = Settings(
        environment="production",
        cors_origins=["https://app.example.com"],
        site_origin="https://app.example.com",
        allow_insecure_auth_cookie=True,
        auth_cookie_secure=False,
    )

    assert settings.allow_insecure_auth_cookie is True
    assert settings.auth_cookie_secure is False


def test_production_allows_unused_insecure_cookie_opt_in() -> None:
    settings = Settings(
        environment="production",
        cors_origins=["https://app.example.com"],
        site_origin="https://app.example.com",
        allow_insecure_auth_cookie=True,
        auth_cookie_secure=True,
    )

    assert settings.auth_cookie_secure is True
```

Keep `test_production_rejects_insecure_cookie()` and make its expected message identify the missing opt-in:

```python
with pytest.raises(ValueError, match="ALLOW_INSECURE_AUTH_COOKIE"):
```

- [ ] **Step 2: Run the model-level tests and verify they fail**

Run:

```bash
.venv/bin/pytest backend/tests/test_config.py \
  -k "auth_security_defaults or production_allows_insecure_cookie or production_rejects_insecure_cookie" -q
```

Expected: failures because `Settings` does not define
`allow_insecure_auth_cookie` and still rejects every insecure production
cookie.

- [ ] **Step 3: Add failing environment parsing tests**

Add:

```python
def test_production_insecure_auth_cookie_opt_in_is_loaded_from_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    monkeypatch.setenv("ALLOW_INSECURE_CORS", "true")
    monkeypatch.setenv("ALLOW_INSECURE_AUTH_COOKIE", "  true  ")
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "false")
    monkeypatch.delenv("SITE_ORIGIN", raising=False)

    settings = Settings.from_env()

    assert settings.allow_insecure_auth_cookie is True
    assert settings.auth_cookie_secure is False


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("ALLOW_INSECURE_AUTH_COOKIE", "1"),
        ("ALLOW_INSECURE_AUTH_COOKIE", "yes"),
        ("ALLOW_INSECURE_AUTH_COOKIE", "TRUE"),
        ("AUTH_COOKIE_SECURE", "1"),
        ("AUTH_COOKIE_SECURE", "on"),
        ("AUTH_COOKIE_SECURE", "FALSE"),
    ],
)
def test_cookie_security_environment_rejects_boolean_aliases(
    monkeypatch: pytest.MonkeyPatch,
    name: str,
    value: str,
) -> None:
    monkeypatch.setenv(name, value)

    with pytest.raises(
        ConfigurationError,
        match=rf"{name}.*exactly 'true' or 'false'",
    ):
        Settings.from_env()
```

- [ ] **Step 4: Run the environment tests and verify they fail**

Run:

```bash
.venv/bin/pytest backend/tests/test_config.py \
  -k "insecure_auth_cookie_opt_in_is_loaded or cookie_security_environment_rejects" -q
```

Expected: failure because the new environment variable is ignored and
`AUTH_COOKIE_SECURE` still uses permissive boolean parsing.

- [ ] **Step 5: Implement the minimal settings contract**

Add the field beside the existing CORS opt-in:

```python
allow_insecure_cors: bool = False
allow_insecure_auth_cookie: bool = False
site_origin: str = "http://localhost:3000"
auth_cookie_secure: bool = False
```

Replace the unconditional production cookie rejection with:

```python
if not self.auth_cookie_secure and not self.allow_insecure_auth_cookie:
    raise ConfigurationError(
        "AUTH_COOKIE_SECURE=false in production requires "
        "ALLOW_INSECURE_AUTH_COOKIE=true."
    )
```

Load both variables through `_parse_strict_bool_env`:

```python
allow_insecure_auth_cookie=_parse_strict_bool_env(
    "ALLOW_INSECURE_AUTH_COOKIE",
    False,
),
auth_cookie_secure=_parse_strict_bool_env(
    "AUTH_COOKIE_SECURE",
    cookie_secure_default,
),
```

- [ ] **Step 6: Run the focused configuration suite**

Run:

```bash
.venv/bin/pytest backend/tests/test_config.py -q
```

Expected: all tests pass.

- [ ] **Step 7: Commit the configuration contract**

```bash
git add backend/app/core/config.py backend/tests/test_config.py
git commit -m "feat(config): gate insecure production auth cookies"
```

### Task 2: Structured Startup Warning

**Files:**
- Modify: `backend/tests/test_main.py:45-115`
- Modify: `backend/app/main.py:49-60`

- [ ] **Step 1: Add failing lifespan warning tests**

Add:

```python
def test_insecure_production_cookie_emits_startup_warning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    settings = Settings(
        environment="production",
        cors_origins=["*"],
        allow_insecure_cors=True,
        allow_insecure_auth_cookie=True,
        auth_cookie_secure=False,
    )
    monkeypatch.setattr(main_module, "get_settings", lambda: settings)
    monkeypatch.setattr(
        main_module,
        "log_event",
        lambda _logger, event, **context: events.append((event, context)),
    )
    app = create_app()
    app.dependency_overrides[get_aigc_pipeline_runtime] = RuntimeLifecycleProbe

    with TestClient(app):
        pass

    warnings = [
        context
        for event, context in events
        if event == "security.insecure_auth_cookie_enabled"
    ]
    assert len(warnings) == 1
    assert warnings[0]["outcome"] == "started"
    assert warnings[0]["level"] == main_module.logging.WARNING


def test_secure_production_cookie_does_not_emit_insecure_warning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[str] = []
    settings = Settings(
        environment="production",
        cors_origins=["https://app.example.com"],
        site_origin="https://app.example.com",
        allow_insecure_auth_cookie=True,
        auth_cookie_secure=True,
    )
    monkeypatch.setattr(main_module, "get_settings", lambda: settings)
    monkeypatch.setattr(
        main_module,
        "log_event",
        lambda _logger, event, **_context: events.append(event),
    )
    app = create_app()
    app.dependency_overrides[get_aigc_pipeline_runtime] = RuntimeLifecycleProbe

    with TestClient(app):
        pass

    assert "security.insecure_auth_cookie_enabled" not in events
```

- [ ] **Step 2: Run the tests and verify the warning test fails**

Run:

```bash
.venv/bin/pytest backend/tests/test_main.py \
  -k "insecure_production_cookie or secure_production_cookie" -q
```

Expected: the insecure case fails because no security event is emitted.

- [ ] **Step 3: Emit the warning once during startup**

After the TLS sink starts in `_lifespan`, add:

```python
settings = application.state.settings
if (
    settings.environment.casefold() in {"production", "prod"}
    and settings.allow_insecure_auth_cookie
    and not settings.auth_cookie_secure
):
    log_event(
        logger,
        "security.insecure_auth_cookie_enabled",
        outcome="started",
        level=logging.WARNING,
    )
```

Do not add URL, Cookie, session, user, or credential fields.

- [ ] **Step 4: Run the full main tests**

Run:

```bash
.venv/bin/pytest backend/tests/test_main.py -q
```

Expected: all tests pass.

- [ ] **Step 5: Commit the startup warning**

```bash
git add backend/app/main.py backend/tests/test_main.py
git commit -m "feat(logging): warn on insecure auth cookies"
```

### Task 3: Authentication Cookie Contract

**Files:**
- Modify: `backend/tests/test_auth_api.py:5-18`
- Modify: `backend/tests/test_auth_api.py:300-375`

- [ ] **Step 1: Add an insecure login Cookie test**

Add the imports required for the standalone insecure-mode application test:

```python
import backend.app.main as main_module
from backend.app.api.dependencies import get_aigc_pipeline_runtime, get_repository
from backend.app.api.auth_routes import _set_session_cookie
from backend.app.core.config import Settings, get_settings
from backend.app.main import create_app
from backend.app.repositories import InMemoryRepository
```

Add a test beside `test_production_session_cookie_is_secure()` using the same
`AuthenticatedSession` fixture shape:

```python
def test_explicit_insecure_production_session_cookie_keeps_safe_attributes() -> None:
    now = utc_now()
    response = Response()
    authenticated = AuthenticatedSession(
        user=UserPublic(
            id="user-1",
            username="admin",
            display_name="Admin",
            role=UserRole.ADMIN,
            is_enabled=True,
            must_change_password=False,
            created_at=now,
            updated_at=now,
            last_login_at=now,
        ),
        token="session-token",
        session=AuthSession(
            user_id="user-1",
            token_digest="d" * 64,
            idle_expires_at=now + timedelta(hours=12),
            absolute_expires_at=now + timedelta(days=7),
        ),
    )
    _set_session_cookie(
        response,
        authenticated,
        Settings(
            environment="production",
            cors_origins=["*"],
            allow_insecure_cors=True,
            allow_insecure_auth_cookie=True,
            auth_cookie_secure=False,
        ),
    )

    set_cookie = response.headers["set-cookie"].lower()
    assert "secure" not in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/" in set_cookie
```

- [ ] **Step 2: Run the test and verify it passes through the new settings gate**

Run:

```bash
.venv/bin/pytest backend/tests/test_auth_api.py \
  -k "production_session_cookie" -q
```

Expected: both secure and explicitly insecure cookie tests pass. No route code
change is needed because `_set_session_cookie()` already reads
`settings.auth_cookie_secure`.

- [ ] **Step 3: Add a 401 Cookie-clearing regression test**

Define a local runtime probe so the test does not start a real AIGC worker:

```python
class _NoopRuntime:
    async def start(self) -> bool:
        return True

    async def stop(self) -> None:
        return None
```

Then add:

```python
def test_explicit_insecure_mode_clears_invalid_cookie_without_secure_attribute(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(
        environment="production",
        cors_origins=["*"],
        allow_insecure_cors=True,
        allow_insecure_auth_cookie=True,
        auth_cookie_secure=False,
    )
    monkeypatch.setattr(main_module, "get_settings", lambda: settings)
    app = create_app()
    app.dependency_overrides[get_aigc_pipeline_runtime] = _NoopRuntime
    app.dependency_overrides[get_repository] = InMemoryRepository
    app.dependency_overrides[get_settings] = lambda: settings

    with TestClient(app) as client:
        client.cookies.set("ad_session", "invalid-token")
        response = client.get("/api/auth/me")

    assert response.status_code == 401
    set_cookie = response.headers["set-cookie"].lower()
    assert 'ad_session=""' in set_cookie
    assert "secure" not in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
```

- [ ] **Step 4: Run the authentication API suite**

Run:

```bash
.venv/bin/pytest backend/tests/test_auth_api.py -q
```

Expected: all tests pass.

- [ ] **Step 5: Commit the cookie contract tests**

```bash
git add backend/tests/test_auth_api.py
git commit -m "test(auth): cover insecure cookie attributes"
```

### Task 4: Deployment Preflight Gate

**Files:**
- Modify: `scripts/tests/test_deploy_server.sh:58-76`
- Modify: `scripts/tests/test_deploy_server.sh:214-327`
- Modify: `scripts/tests/test_deploy_server.sh:350-448`
- Modify: `scripts/deploy_server.sh:160-245`

- [ ] **Step 1: Add a successful insecure deployment fixture**

Add:

```bash
test_insecure_auth_cookie_opt_in_deploys() {
  create_fixture insecure_auth_cookie_opt_in
  printf '%s\n' \
    'APP_ENV=production' \
    'CORS_ORIGINS=*' \
    'ALLOW_INSECURE_CORS=true' \
    'ALLOW_INSECURE_AUTH_COOKIE=true' \
    'AUTH_COOKIE_SECURE=false' >"$APP_ROOT/.env"

  if ! run_deploy; then
    fail "explicit insecure auth cookie opt-in should deploy"
    return
  fi

  assert_contains "$OUTPUT_LOG" \
    "WARNING: insecure authentication cookies are enabled" \
    "insecure auth cookie deployment should print a security warning"
  pass "insecure auth cookie deploys only with explicit opt-in"
}
```

Invoke it at the bottom of the test file.

- [ ] **Step 2: Add rejected and no-warning deployment cases**

Replace the existing `insecure_cookie` case in
`test_production_security_env_gate()` with the first two cases below, then add
the strict parsing cases:

```bash
assert_security_preflight_failure \
  insecure_cookie_without_opt_in \
  'APP_ENV=production\nCORS_ORIGINS=*\nALLOW_INSECURE_CORS=true\nAUTH_COOKIE_SECURE=false\n' \
  "AUTH_COOKIE_SECURE=false requires ALLOW_INSECURE_AUTH_COOKIE=true"
assert_security_preflight_failure \
  insecure_cookie_false_opt_in \
  'APP_ENV=production\nCORS_ORIGINS=*\nALLOW_INSECURE_CORS=true\nALLOW_INSECURE_AUTH_COOKIE=false\nAUTH_COOKIE_SECURE=false\n' \
  "AUTH_COOKIE_SECURE=false requires ALLOW_INSECURE_AUTH_COOKIE=true"
assert_security_preflight_failure \
  insecure_cookie_uppercase_opt_in \
  'APP_ENV=production\nCORS_ORIGINS=*\nALLOW_INSECURE_CORS=true\nALLOW_INSECURE_AUTH_COOKIE=TRUE\nAUTH_COOKIE_SECURE=false\n' \
  "ALLOW_INSECURE_AUTH_COOKIE must be exactly true or false"
assert_security_preflight_failure \
  missing_auth_cookie_secure \
  'APP_ENV=production\nCORS_ORIGINS=https://ad.example.com\nSITE_ORIGIN=https://ad.example.com\n' \
  "AUTH_COOKIE_SECURE must be exactly true or false"
assert_security_preflight_failure \
  empty_auth_cookie_secure \
  'APP_ENV=production\nCORS_ORIGINS=https://ad.example.com\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=\n' \
  "AUTH_COOKIE_SECURE must be exactly true or false"
assert_security_preflight_failure \
  secure_cookie_boolean_alias \
  'APP_ENV=production\nCORS_ORIGINS=https://ad.example.com\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=yes\n' \
  "AUTH_COOKIE_SECURE must be exactly true or false"
```

Add a successful test where both values are `true`, asserting the insecure
warning is absent:

```bash
test_unused_insecure_auth_cookie_opt_in_does_not_warn() {
  create_fixture unused_insecure_auth_cookie_opt_in
  printf '%s\n' \
    'APP_ENV=production' \
    'CORS_ORIGINS=https://ad.example.com' \
    'SITE_ORIGIN=https://ad.example.com' \
    'ALLOW_INSECURE_AUTH_COOKIE=true' \
    'AUTH_COOKIE_SECURE=true' >"$APP_ROOT/.env"

  if ! run_deploy; then
    fail "secure cookies should deploy when the opt-in is unused"
    return
  fi

  assert_not_contains "$OUTPUT_LOG" \
    "WARNING: insecure authentication cookies are enabled" \
    "secure cookie deployment must not print the insecure cookie warning"
  pass "unused insecure auth cookie opt-in does not warn"
}
```

- [ ] **Step 3: Run the shell suite and verify failures**

Run:

```bash
bash scripts/tests/test_deploy_server.sh
```

Expected: new success cases fail and new expected error messages are absent.

- [ ] **Step 4: Implement strict preflight parsing and the gate**

Declare and load the variable:

```bash
local allow_insecure_auth_cookie

if ! allow_insecure_auth_cookie="$(
  read_dotenv_value "ALLOW_INSECURE_AUTH_COOKIE"
)"; then
  allow_insecure_auth_cookie=false
fi
```

Validate both booleans:

```bash
case "$allow_insecure_auth_cookie" in
  true | false) ;;
  *)
    die "ALLOW_INSECURE_AUTH_COOKIE must be exactly true or false in $APP_ROOT/.env"
    ;;
esac
case "$auth_cookie_secure" in
  true | false) ;;
  *)
    die "AUTH_COOKIE_SECURE must be exactly true or false in $APP_ROOT/.env"
    ;;
esac
```

Replace the unconditional secure-cookie requirement with:

```bash
if [[ "$auth_cookie_secure" == "false" ]]; then
  [[ "$allow_insecure_auth_cookie" == "true" ]] ||
    die "AUTH_COOKIE_SECURE=false requires ALLOW_INSECURE_AUTH_COOKIE=true in $APP_ROOT/.env"
  log "WARNING: insecure authentication cookies are enabled; public HTTP sessions can be intercepted."
fi
```

- [ ] **Step 5: Run shell syntax and deployment tests**

Run:

```bash
bash -n scripts/deploy_server.sh scripts/tests/test_deploy_server.sh
bash scripts/tests/test_deploy_server.sh
```

Expected: syntax checks exit zero and every deployment scenario prints
`PASS`.

- [ ] **Step 6: Commit the deployment gate**

```bash
git add scripts/deploy_server.sh scripts/tests/test_deploy_server.sh
git commit -m "feat(deploy): allow explicit insecure auth cookies"
```

### Task 5: Configuration Template and Deployment Documentation

**Files:**
- Modify: `.env.example:1-12`
- Modify: `docs/deployment/application-server-first-deployment.md:175-260`
- Modify: `docs/deployment/application-server-first-deployment.md:690-725`

- [ ] **Step 1: Add the disabled template switch**

Update the authentication block:

```dotenv
CORS_ORIGINS=http://localhost:3000
ALLOW_INSECURE_CORS=false
ALLOW_INSECURE_AUTH_COOKIE=false
SITE_ORIGIN=http://localhost:3000
AUTH_COOKIE_SECURE=false
```

Add a comment stating that production HTTP requires the explicit auth-cookie
opt-in and is not recommended.

- [ ] **Step 2: Document the temporary public HTTP profile**

Add this exact production example after the wildcard CORS section:

```dotenv
APP_ENV=production
CORS_ORIGINS=*
ALLOW_INSECURE_CORS=true
ALLOW_INSECURE_AUTH_COOKIE=true
AUTH_COOKIE_SECURE=false
AUTH_SESSION_IDLE_SECONDS=1800
AUTH_SESSION_ABSOLUTE_SECONDS=28800
```

Explain that `ALLOW_INSECURE_CORS` and
`ALLOW_INSECURE_AUTH_COOKIE` are independent, that passwords, pages, API
responses, and session cookies are unencrypted, and that the profile is a
temporary compatibility mode for `http://101.126.86.254/`.

- [ ] **Step 3: Document HTTPS rollback and verification**

Add:

```dotenv
ALLOW_INSECURE_AUTH_COOKIE=false
AUTH_COOKIE_SECURE=true
```

Document clearing the old `ad_session`, redeploying, and confirming login plus
`GET /api/auth/me` after switching to HTTPS. Add checklist items for explicit
HTTP authorization and the startup/deployment warnings.

- [ ] **Step 4: Check documentation formatting and content**

Run:

```bash
git diff --check -- .env.example docs/deployment/application-server-first-deployment.md
rg -n "ALLOW_INSECURE_AUTH_COOKIE|AUTH_COOKIE_SECURE=false|public HTTP|公网 HTTP" \
  .env.example docs/deployment/application-server-first-deployment.md
```

Expected: no whitespace errors and both files contain the new configuration
contract.

- [ ] **Step 5: Commit template and documentation**

```bash
git add .env.example docs/deployment/application-server-first-deployment.md
git commit -m "docs(deploy): document public HTTP auth opt-in"
```

### Task 6: Integrated Verification, Production Proof, and Debug Cleanup

**Files:**
- Verify: `backend/app/core/config.py`
- Verify: `backend/app/main.py`
- Verify: `backend/tests/test_config.py`
- Verify: `backend/tests/test_main.py`
- Verify: `backend/tests/test_auth_api.py`
- Verify: `scripts/deploy_server.sh`
- Verify: `scripts/tests/test_deploy_server.sh`
- Keep until confirmation: `frontend/lib/api-client.ts`
- Delete after confirmation: `debug-production-auth-cookie.md`
- Delete after confirmation: `.dbg/production-auth-cookie.env`
- Delete after confirmation: `.dbg/trae-debug-log-production-auth-cookie.ndjson`

- [ ] **Step 1: Run all focused backend tests**

Run:

```bash
.venv/bin/pytest \
  backend/tests/test_config.py \
  backend/tests/test_main.py \
  backend/tests/test_auth_api.py -q
```

Expected: all selected tests pass.

- [ ] **Step 2: Run static checks and deployment tests**

Run:

```bash
.venv/bin/ruff check \
  backend/app/core/config.py \
  backend/app/main.py \
  backend/tests/test_config.py \
  backend/tests/test_main.py \
  backend/tests/test_auth_api.py
bash -n scripts/deploy_server.sh scripts/tests/test_deploy_server.sh
bash scripts/tests/test_deploy_server.sh
git diff --check
```

Expected: every command exits zero.

- [ ] **Step 3: Confirm commit and worktree boundaries**

Run:

```bash
git status --short
git log --oneline -6
```

Expected: implementation files are committed. Only the active debugger
artifacts remain modified or untracked:

```text
 M frontend/lib/api-client.ts
?? debug-production-auth-cookie.md
```

- [ ] **Step 4: Configure and deploy the production server**

On the production server, set:

```dotenv
APP_ENV=production
CORS_ORIGINS=*
ALLOW_INSECURE_CORS=true
ALLOW_INSECURE_AUTH_COOKIE=true
AUTH_COOKIE_SECURE=false
AUTH_SESSION_IDLE_SECONDS=1800
AUTH_SESSION_ABSOLUTE_SECONDS=28800
```

Run:

```bash
cd /root/AD-Creativity-Platform
bash scripts/deploy_server.sh
```

Expected: preflight prints both wildcard CORS and insecure authentication
Cookie warnings; backend and frontend health checks pass.

- [ ] **Step 5: Collect post-fix production evidence**

Clear the current local debug log before reproduction:

```bash
: > .dbg/trae-debug-log-production-auth-cookie.ndjson
```

Open `http://101.126.86.254/`, clear the old `ad_session`, sign in as `admin`,
open the generated outputs page, and invoke one authenticated action.

Expected production evidence:

```text
POST /api/auth/login 200
GET /api/auth/me 200
```

The page remains authenticated and no action redirects to `/login`. Confirm
TLS contains `security.insecure_auth_cookie_enabled` once at backend startup
and does not contain the Cookie or session token.

- [ ] **Step 6: Request the mandatory user confirmation**

Use the debugger confirmation gate with these outcomes:

- Fixed / no longer reproducible
- Still reproducible
- Symptoms changed
- Abort debugging

Do not remove instrumentation before the user selects Fixed or Abort.

- [ ] **Step 7: Clean up only after Fixed or Abort confirmation**

Remove both `#region debug-point A,B,C` blocks from
`frontend/lib/api-client.ts`, stop the debug server listening on port 7777, and
delete:

```text
debug-production-auth-cookie.md
.dbg/production-auth-cookie.env
.dbg/trae-debug-log-production-auth-cookie.ndjson
```

Run:

```bash
npm run lint -- --no-cache
npm run typecheck
git status --short
```

from `frontend/` for the first two commands. Expected: frontend checks pass,
and the debugger-only worktree changes are gone.

- [ ] **Step 8: Report the pre-fix/post-fix comparison**

Record:

```text
pre-fix: HTTP login response succeeded, GET /api/auth/me returned 401
post-fix: HTTP login response succeeded, GET /api/auth/me returned 200
```

Summarize that the database session implementation was unchanged; the fix
made the browser's HTTP Cookie policy match the explicitly authorized
deployment mode.
