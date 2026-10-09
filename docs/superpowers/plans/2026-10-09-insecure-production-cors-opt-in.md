# Production Wildcard CORS Opt-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow production deployments to use `CORS_ORIGINS=*` only when `ALLOW_INSECURE_CORS=true` is explicitly configured.

**Architecture:** Add one strict boolean security setting shared by backend validation and deployment preflight semantics. When wildcard origins and the opt-in are both active, bypass the backend's non-safe-method Origin guard so writes from any origin reach the route; otherwise preserve the existing `403` guard. Keep `CORSMiddleware.allow_credentials=false` for wildcard origins, meaning no credentialed CORS authorization is returned and browser scripts cannot read credentialed cross-origin responses.

**Tech Stack:** Python 3, Pydantic, FastAPI/Starlette CORS middleware, Bash, pytest, shell test harness, Ruff.

---

## File Map

- Modify `backend/app/core/config.py`: parse and validate the explicit insecure-CORS opt-in.
- Modify `backend/tests/test_config.py`: specify backend production behavior and environment parsing.
- Modify `backend/app/main.py`: bypass the non-safe-method Origin guard only for wildcard plus explicit opt-in.
- Modify `backend/tests/test_auth_api.py`: cover allowed wildcard writes, retained `403` behavior, and response CORS headers.
- Modify `scripts/deploy_server.sh`: enforce the same opt-in during deployment preflight.
- Modify `scripts/tests/test_deploy_server.sh`: cover rejected and accepted wildcard deployments.
- Modify `.env.example`: document the secure default.
- Modify `docs/deployment/application-server-first-deployment.md`: document risk, configuration, and verification.

### Task 1: Backend configuration contract

**Files:**
- Modify: `backend/tests/test_config.py:42-115`
- Modify: `backend/app/core/config.py:94-108`
- Modify: `backend/app/core/config.py:188-245`

- [x] **Step 1: Write failing model-validation tests**

Replace the wildcard portion of
`test_production_rejects_wildcard_cors_and_insecure_cookie` and add an
opt-in success test:

```python
def test_production_rejects_wildcard_cors_without_explicit_opt_in() -> None:
    with pytest.raises(ValueError, match="ALLOW_INSECURE_CORS"):
        Settings(
            environment="production",
            cors_origins=["*"],
            site_origin="https://app.example.com",
            auth_cookie_secure=True,
        )


def test_production_allows_wildcard_cors_with_explicit_opt_in() -> None:
    settings = Settings(
        environment="production",
        cors_origins=["*"],
        site_origin="https://app.example.com",
        auth_cookie_secure=True,
        allow_insecure_cors=True,
    )

    assert settings.cors_origins == ["*"]
    assert settings.allow_insecure_cors is True
```

Keep the insecure-cookie assertion as its own test:

```python
def test_production_rejects_insecure_cookie() -> None:
    with pytest.raises(ValueError, match="AUTH_COOKIE_SECURE"):
        Settings(
            environment="production",
            cors_origins=["https://app.example.com"],
            site_origin="https://app.example.com",
            auth_cookie_secure=False,
        )
```

- [x] **Step 2: Write failing environment-loading tests**

Add the success case and strict-value rejection coverage:

```python
def test_production_wildcard_cors_opt_in_is_loaded_from_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    monkeypatch.setenv("SITE_ORIGIN", "https://app.example.com")
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "true")
    monkeypatch.setenv("ALLOW_INSECURE_CORS", "  true  ")

    settings = Settings.from_env()

    assert settings.cors_origins == ["*"]
    assert settings.allow_insecure_cors is True


@pytest.mark.parametrize("alias", ["1", "yes", "on", "TRUE"])
def test_insecure_cors_environment_rejects_boolean_aliases(
    monkeypatch: pytest.MonkeyPatch,
    alias: str,
) -> None:
    monkeypatch.setenv("ALLOW_INSECURE_CORS", alias)

    with pytest.raises(
        ConfigurationError,
        match=r"ALLOW_INSECURE_CORS.*exactly 'true' or 'false'",
    ):
        Settings.from_env()
```

The parser trims surrounding whitespace, then accepts only the exact lowercase
values `true` and `false`. Boolean aliases and case variants are rejected.

- [x] **Step 3: Run the focused tests and verify they fail**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_config.py::test_production_rejects_wildcard_cors_without_explicit_opt_in \
  backend/tests/test_config.py::test_production_allows_wildcard_cors_with_explicit_opt_in \
  backend/tests/test_config.py::test_production_wildcard_cors_opt_in_is_loaded_from_environment \
  backend/tests/test_config.py::test_insecure_cors_environment_rejects_boolean_aliases \
  -q
```

Expected: failures because `Settings` has no `allow_insecure_cors` field and
still rejects every production wildcard.

- [x] **Step 4: Add the setting and production validator**

Add the field next to `cors_origins`:

```python
allow_insecure_cors: bool = False
```

Replace the production wildcard branch with:

```python
if "*" in self.cors_origins and not self.allow_insecure_cors:
    raise ConfigurationError(
        "CORS_ORIGINS='*' in production requires "
        "ALLOW_INSECURE_CORS=true."
    )
```

Guard the existing site-origin membership check:

```python
if (
    "*" not in self.cors_origins
    and self.site_origin not in self.cors_origins
):
    raise ConfigurationError(
        "CORS_ORIGINS must include SITE_ORIGIN in production."
    )
```

Add a dedicated strict environment parser:

```python
def _parse_strict_bool_env(name: str, default: bool) -> bool:
    raw_value = getenv(name)
    if raw_value is None:
        return default
    normalized = raw_value.strip()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    raise ConfigurationError(f"{name} must be exactly 'true' or 'false'.")
```

Load the field in `Settings.from_env()` with that parser:

```python
allow_insecure_cors=_parse_strict_bool_env(
    "ALLOW_INSECURE_CORS",
    False,
),
```

- [x] **Step 5: Run backend tests and static checks**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/test_config.py -q
.venv/bin/ruff check backend/app/core/config.py backend/tests/test_config.py
```

Expected: all configuration tests pass and Ruff reports no errors.

- [x] **Step 6: Commit the backend contract**

```bash
git add backend/app/core/config.py backend/tests/test_config.py
git commit -m "feat(config): allow explicit production wildcard CORS"
```

### Task 2: Backend runtime Origin guard

**Files:**
- Modify: `backend/tests/test_auth_api.py:184-250`
- Modify: `backend/app/main.py:172-190`

- [x] **Step 1: Write failing API behavior tests**

Add `test_production_wildcard_cors_allows_cross_origin_write_when_enabled`.
Configure the test app with production settings, `cors_origins=["*"]`, and
`allow_insecure_cors=True`, then send a cross-origin `POST /api/auth/setup`.
Assert:

- the route processes the request and returns `201`;
- `Access-Control-Allow-Origin` is `*`;
- `Access-Control-Allow-Credentials` is absent.

Add `test_explicit_cors_origins_still_reject_cross_origin_write`. Configure an
explicit origin while leaving `allow_insecure_cors=True`, send the same
cross-origin `POST`, and assert `403 origin_forbidden` with no state change.

- [x] **Step 2: Run the focused API tests and verify they fail**

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_auth_api.py::test_production_wildcard_cors_allows_cross_origin_write_when_enabled \
  backend/tests/test_auth_api.py::test_explicit_cors_origins_still_reject_cross_origin_write \
  -q
```

Expected: the wildcard case fails with `403` because the existing Origin guard
does not yet recognize the opt-in.

- [x] **Step 3: Gate the non-safe-method Origin check**

Update `backend/app/main.py` so the existing Origin/Referer validation is
skipped only when both conditions are true:

```python
if request.method not in {"GET", "HEAD", "OPTIONS"} and not (
    settings.allow_insecure_cors and "*" in settings.cors_origins
):
    supplied_origin = request.headers.get("origin")
    if supplied_origin is None:
        supplied_origin = request.headers.get("referer")
    if not _origin_matches(supplied_origin, settings.site_origin):
        response = JSONResponse(
            status_code=403,
            content={
                "detail": {
                    "code": "origin_forbidden",
                    "message": "Request origin is not allowed.",
                }
            },
        )
        response.headers["X-Request-ID"] = request_id
        reset_log_context(token)
        return response
```

With wildcard plus opt-in, `POST`, `PUT`, `PATCH`, `DELETE`, and other non-safe
methods from any origin proceed to route handling. In every other configuration,
the existing mismatch behavior remains `403 origin_forbidden`.

Do not change the `CORSMiddleware` expression:

```python
allow_credentials="*" not in settings.cors_origins
```

For wildcard origins this remains `false`: the response does not grant
credentialed CORS access, and browser scripts cannot read a credentialed
cross-origin response. This does not guarantee that a browser never sends a
Cookie.

- [x] **Step 4: Run API tests and static checks**

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/test_auth_api.py -q
.venv/bin/ruff check backend/app/main.py backend/tests/test_auth_api.py
```

Expected: authentication API tests pass and Ruff reports no errors.

### Task 3: Deployment preflight opt-in

**Files:**
- Modify: `scripts/tests/test_deploy_server.sh:55-75`
- Modify: `scripts/tests/test_deploy_server.sh:225-270`
- Modify: `scripts/deploy_server.sh:124-175`

- [x] **Step 1: Add a failing wildcard opt-in deployment test**

Add:

```bash
test_wildcard_cors_opt_in_deploys() {
  create_fixture wildcard_cors_opt_in
  printf '%s\n' \
    'APP_ENV=production' \
    'CORS_ORIGINS=*' \
    'ALLOW_INSECURE_CORS=true' \
    'SITE_ORIGIN=https://ad.example.com' \
    'AUTH_COOKIE_SECURE=true' >"$APP_ROOT/.env"

  run_deploy || {
    fail "explicit wildcard CORS opt-in should deploy"
    return
  }

  assert_contains "$OUTPUT_LOG" "WARNING: wildcard CORS is enabled" \
    "wildcard deployment should print a security warning"
  pass "wildcard CORS deploys only with explicit opt-in"
}
```

Invoke `test_wildcard_cors_opt_in_deploys` before the final failure-count
check.

- [x] **Step 2: Update the wildcard rejection case**

Replace the existing `wildcard_cors` fixture with:

```bash
assert_security_preflight_failure \
  wildcard_cors_without_opt_in \
  'APP_ENV=production\nCORS_ORIGINS=*\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=true\n' \
  "CORS_ORIGINS='*' requires ALLOW_INSECURE_CORS=true"
```

Add a wildcard case proving `false` does not opt in, plus invalid-value cases
for wildcard and explicit origins. The explicit-origin case proves validation
is unconditional rather than limited to the wildcard branch:

```bash
assert_security_preflight_failure \
  wildcard_cors_false_opt_in \
  'APP_ENV=production\nCORS_ORIGINS=*\nALLOW_INSECURE_CORS=false\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=true\n' \
  "CORS_ORIGINS='*' requires ALLOW_INSECURE_CORS=true"

assert_security_preflight_failure \
  wildcard_cors_uppercase_opt_in \
  'APP_ENV=production\nCORS_ORIGINS=*\nALLOW_INSECURE_CORS=TRUE\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=true\n' \
  "ALLOW_INSECURE_CORS must be exactly true or false"

assert_security_preflight_failure \
  explicit_cors_uppercase_opt_in \
  'APP_ENV=production\nCORS_ORIGINS=https://ad.example.com\nALLOW_INSECURE_CORS=TRUE\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=true\n' \
  "ALLOW_INSECURE_CORS must be exactly true or false"

assert_security_preflight_failure \
  explicit_cors_alias_opt_in \
  'APP_ENV=production\nCORS_ORIGINS=https://ad.example.com\nALLOW_INSECURE_CORS=yes\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=true\n' \
  "ALLOW_INSECURE_CORS must be exactly true or false"
```

- [x] **Step 3: Run the shell tests and verify they fail**

Run:

```bash
bash scripts/tests/test_deploy_server.sh
```

Expected: wildcard opt-in success test fails because preflight still rejects
`*`.

- [x] **Step 4: Implement the preflight branch**

Declare and load the optional value:

```bash
local allow_insecure_cors

allow_insecure_cors="$(read_dotenv_value "ALLOW_INSECURE_CORS" || true)"
allow_insecure_cors="${allow_insecure_cors:-false}"
```

Immediately validate the effective value, regardless of whether
`CORS_ORIGINS` contains a wildcard:

```bash
[[ "$allow_insecure_cors" == "true" || "$allow_insecure_cors" == "false" ]] ||
  die "ALLOW_INSECURE_CORS must be exactly true or false in $APP_ROOT/.env"
```

Only exact lowercase `true` and `false` are accepted. A missing or empty value
uses the secure default `false`; aliases and case variants fail preflight even
when `CORS_ORIGINS` lists an explicit source.

Replace the unconditional wildcard rejection and source-membership block with:

```bash
if [[ "$cors_origins" == *"*"* ]]; then
  [[ "$allow_insecure_cors" == "true" ]] ||
    die "CORS_ORIGINS='*' requires ALLOW_INSECURE_CORS=true in $APP_ROOT/.env"
  log "WARNING: wildcard CORS is enabled; cross-origin credentials remain disabled."
else
  IFS=',' read -r -a configured_origins <<<"$cors_origins"
  for cors_origin in "${configured_origins[@]}"; do
    cors_origin="$(trim_whitespace "$cors_origin")"
    if [[ "$cors_origin" == "$site_origin" ]]; then
      cors_contains_site_origin=1
      break
    fi
  done
  [[ "$cors_contains_site_origin" -eq 1 ]] ||
    die "CORS_ORIGINS must include SITE_ORIGIN in $APP_ROOT/.env"
fi
```

Keep the production, HTTPS, non-empty, and secure-cookie checks unchanged.

- [x] **Step 5: Run deployment tests and shell syntax validation**

Run:

```bash
bash -n scripts/deploy_server.sh scripts/tests/test_deploy_server.sh
bash scripts/tests/test_deploy_server.sh
```

Expected: syntax validation succeeds and all deployment tests pass.

- [x] **Step 6: Commit deployment preflight support**

```bash
git add scripts/deploy_server.sh scripts/tests/test_deploy_server.sh
git commit -m "feat(deploy): gate wildcard CORS behind explicit opt-in"
```

### Task 4: Environment template and operator documentation

**Files:**
- Modify: `.env.example:1-9`
- Modify: `docs/deployment/application-server-first-deployment.md:168-190`
- Modify: `docs/deployment/application-server-first-deployment.md:665-678`

- [x] **Step 1: Document the secure default in the environment template**

Add immediately after `CORS_ORIGINS`:

```dotenv
ALLOW_INSECURE_CORS=false
```

- [x] **Step 2: Add the production opt-in example**

After the recommended same-origin environment block, add:

````markdown
生产环境默认拒绝通配 CORS。只有明确接受任意来源发起跨域请求和非安全
方法调用的风险时，才同时配置：

```dotenv
CORS_ORIGINS=*
ALLOW_INSECURE_CORS=true
```

`ALLOW_INSECURE_CORS` 去除首尾空白后仅接受精确小写 `true` 或 `false`。
该模式下服务端不会返回 credentialed CORS 授权；即使请求包含认证 Cookie，
浏览器脚本也无法读取带凭证的跨域响应。需要跨域登录时，应配置明确的
HTTPS 来源，而不是使用通配来源。
````

- [x] **Step 3: Update the deployment checklist**

Replace the CORS checklist item with:

```markdown
- [x] `SITE_ORIGIN` 使用正式 HTTPS 域名；`AUTH_COOKIE_SECURE=true`。
- [x] `CORS_ORIGINS` 使用明确来源；若使用 `*`，已同时设置
      `ALLOW_INSECURE_CORS=true` 并接受任意来源跨域调用风险。
```

- [x] **Step 4: Validate documentation formatting**

Run:

```bash
git diff --check -- .env.example \
  docs/deployment/application-server-first-deployment.md
```

Expected: no whitespace errors.

- [x] **Step 5: Commit documentation**

```bash
git add .env.example docs/deployment/application-server-first-deployment.md
git commit -m "docs(deploy): document wildcard CORS opt-in"
```

### Task 5: Integrated verification

**Files:**
- Verify: `backend/app/core/config.py`
- Verify: `backend/tests/test_config.py`
- Verify: `backend/app/main.py`
- Verify: `backend/tests/test_auth_api.py`
- Verify: `scripts/deploy_server.sh`
- Verify: `scripts/tests/test_deploy_server.sh`
- Verify: `.env.example`
- Verify: `docs/deployment/application-server-first-deployment.md`

- [x] **Step 1: Run all focused tests**

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_config.py \
  backend/tests/test_auth_api.py \
  -q
bash scripts/tests/test_deploy_server.sh
```

Expected: all tests pass.

- [x] **Step 2: Run static validation**

```bash
.venv/bin/ruff check \
  backend/app/core/config.py \
  backend/app/main.py \
  backend/tests/test_config.py \
  backend/tests/test_auth_api.py
bash -n scripts/deploy_server.sh scripts/tests/test_deploy_server.sh
git diff --check
```

Expected: no Ruff, shell syntax, or whitespace failures.

- [x] **Step 3: Verify secure and insecure production examples**

Secure example:

```dotenv
APP_ENV=production
CORS_ORIGINS=https://ad.example.com
SITE_ORIGIN=https://ad.example.com
AUTH_COOKIE_SECURE=true
```

Explicit insecure example:

```dotenv
APP_ENV=production
CORS_ORIGINS=*
ALLOW_INSECURE_CORS=true
SITE_ORIGIN=https://ad.example.com
AUTH_COOKIE_SECURE=true
```

Expected: both pass deployment preflight; removing
`ALLOW_INSECURE_CORS=true` from the second example fails before dependency
installation or service restart.

### Task 6: Optional site origin in explicit wildcard mode

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/tests/test_config.py`
- Modify: `scripts/deploy_server.sh`
- Modify: `scripts/tests/test_deploy_server.sh`
- Modify: `.env.example`
- Modify: `docs/deployment/application-server-first-deployment.md`
- Modify: `docs/superpowers/specs/2026-10-09-insecure-production-cors-opt-in-design.md`

- [x] **Step 1: Specify backend conditional validation**

Add tests proving `Settings.from_env()` succeeds when production uses
`CORS_ORIGINS=*`, `ALLOW_INSECURE_CORS=true`, secure cookies, and no
`SITE_ORIGIN`; also prove a non-wildcard production configuration still
rejects the missing value.

- [x] **Step 2: Implement backend conditional validation**

Compute the explicit wildcard mode once:

```python
insecure_wildcard_cors = (
    "*" in self.cors_origins and self.allow_insecure_cors
)
```

Only enforce production HTTPS and `CORS_ORIGINS` membership when
`insecure_wildcard_cors` is false. Keep secure cookies mandatory in both modes.

- [x] **Step 3: Specify deployment preflight behavior**

Add successful fixtures proving that missing, empty, and whitespace-only
`SITE_ORIGIN` values are accepted with:

```dotenv
APP_ENV=production
CORS_ORIGINS=*
ALLOW_INSECURE_CORS=true
AUTH_COOKIE_SECURE=true
```

Also prove a valid non-empty HTTP origin and an uppercase HTTPS scheme succeed
after normalization. Prove values containing a path, query, userinfo,
fragment, whitespace, an empty host, or an invalid port fail before dependency
installation. Add comma-separated cases proving only an independently trimmed
entry exactly equal to `*` enables wildcard mode; `*` inside a URL path does
not. Keep the existing missing-`SITE_ORIGIN` failure for explicit CORS origins.

- [x] **Step 4: Implement deployment conditional requirement**

Read `SITE_ORIGIN` as optional. Require a non-empty HTTPS value only in the
non-wildcard branch. In the explicit wildcard branch, allow it to be missing,
empty, or whitespace-only. Parse `CORS_ORIGINS` into independently trimmed
comma-separated entries and treat only an entry exactly equal to `*` as a
wildcard. Validate and normalize non-empty `SITE_ORIGIN` values with Python
stdlib `urlsplit`, matching backend `normalize_http_origin`: case-insensitive
HTTP/HTTPS scheme, required host, legal port, no userinfo/query/fragment or
internal whitespace, and only an empty or `/` path. Require normalized HTTPS
outside wildcard mode, but allow normalized HTTP in wildcard mode. Compare
explicit origins after normalization and retain the existing security warning.

- [x] **Step 5: Update operator documentation**

Document that `SITE_ORIGIN` may be missing or empty only for the explicit
wildcard configuration, that wildcard detection is exact per comma-separated
entry, and the structured HTTP(S)-origin validation and normalization applied
to non-empty values. Keep the recommended same-origin production example
unchanged.

- [x] **Step 6: Run integrated verification**

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_config.py \
  backend/tests/test_auth_api.py \
  -q
.venv/bin/ruff check \
  backend/app/core/config.py \
  backend/app/main.py \
  backend/tests/test_config.py \
  backend/tests/test_auth_api.py
bash -n scripts/deploy_server.sh scripts/tests/test_deploy_server.sh
bash scripts/tests/test_deploy_server.sh
git diff --check
```

Expected: all tests and static checks pass.
