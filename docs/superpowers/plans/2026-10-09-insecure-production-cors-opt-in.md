# Production Wildcard CORS Opt-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow production deployments to use `CORS_ORIGINS=*` only when `ALLOW_INSECURE_CORS=true` is explicitly configured.

**Architecture:** Add one boolean security setting shared by backend validation and deployment preflight semantics. Preserve all existing HTTPS and secure-cookie checks, and preserve FastAPI's current behavior of disabling credentialed CORS when wildcard origins are active.

**Tech Stack:** Python 3, Pydantic, FastAPI/Starlette CORS middleware, Bash, pytest, shell test harness, Ruff.

---

## File Map

- Modify `backend/app/core/config.py`: parse and validate the explicit insecure-CORS opt-in.
- Modify `backend/tests/test_config.py`: specify backend production behavior and environment parsing.
- Modify `scripts/deploy_server.sh`: enforce the same opt-in during deployment preflight.
- Modify `scripts/tests/test_deploy_server.sh`: cover rejected and accepted wildcard deployments.
- Modify `.env.example`: document the secure default.
- Modify `docs/deployment/application-server-first-deployment.md`: document risk, configuration, and verification.

### Task 1: Backend configuration contract

**Files:**
- Modify: `backend/tests/test_config.py:42-115`
- Modify: `backend/app/core/config.py:94-108`
- Modify: `backend/app/core/config.py:188-245`

- [ ] **Step 1: Write failing model-validation tests**

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

- [ ] **Step 2: Write a failing environment-loading test**

Add:

```python
def test_production_wildcard_cors_opt_in_is_loaded_from_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    monkeypatch.setenv("SITE_ORIGIN", "https://app.example.com")
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "true")
    monkeypatch.setenv("ALLOW_INSECURE_CORS", "true")

    settings = Settings.from_env()

    assert settings.cors_origins == ["*"]
    assert settings.allow_insecure_cors is True
```

- [ ] **Step 3: Run the focused tests and verify they fail**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_config.py::test_production_rejects_wildcard_cors_without_explicit_opt_in \
  backend/tests/test_config.py::test_production_allows_wildcard_cors_with_explicit_opt_in \
  backend/tests/test_config.py::test_production_wildcard_cors_opt_in_is_loaded_from_environment \
  -q
```

Expected: failures because `Settings` has no `allow_insecure_cors` field and
still rejects every production wildcard.

- [ ] **Step 4: Add the setting and production validator**

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

Load the field in `Settings.from_env()`:

```python
allow_insecure_cors=_parse_bool_env(
    "ALLOW_INSECURE_CORS",
    False,
),
```

- [ ] **Step 5: Run backend tests and static checks**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/test_config.py -q
.venv/bin/ruff check backend/app/core/config.py backend/tests/test_config.py
```

Expected: all configuration tests pass and Ruff reports no errors.

- [ ] **Step 6: Commit the backend contract**

```bash
git add backend/app/core/config.py backend/tests/test_config.py
git commit -m "feat(config): allow explicit production wildcard CORS"
```

### Task 2: Deployment preflight opt-in

**Files:**
- Modify: `scripts/tests/test_deploy_server.sh:55-75`
- Modify: `scripts/tests/test_deploy_server.sh:225-270`
- Modify: `scripts/deploy_server.sh:124-175`

- [ ] **Step 1: Add a failing wildcard opt-in deployment test**

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

- [ ] **Step 2: Update the wildcard rejection case**

Replace the existing `wildcard_cors` fixture with:

```bash
assert_security_preflight_failure \
  wildcard_cors_without_opt_in \
  'APP_ENV=production\nCORS_ORIGINS=*\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=true\n' \
  "CORS_ORIGINS='*' requires ALLOW_INSECURE_CORS=true"
```

Add a second case proving non-`true` values do not opt in:

```bash
assert_security_preflight_failure \
  wildcard_cors_false_opt_in \
  'APP_ENV=production\nCORS_ORIGINS=*\nALLOW_INSECURE_CORS=false\nSITE_ORIGIN=https://ad.example.com\nAUTH_COOKIE_SECURE=true\n' \
  "CORS_ORIGINS='*' requires ALLOW_INSECURE_CORS=true"
```

- [ ] **Step 3: Run the shell tests and verify they fail**

Run:

```bash
bash scripts/tests/test_deploy_server.sh
```

Expected: wildcard opt-in success test fails because preflight still rejects
`*`.

- [ ] **Step 4: Implement the preflight branch**

Declare and load the optional value:

```bash
local allow_insecure_cors

allow_insecure_cors="$(read_dotenv_value "ALLOW_INSECURE_CORS" || true)"
allow_insecure_cors="${allow_insecure_cors:-false}"
```

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

- [ ] **Step 5: Run deployment tests and shell syntax validation**

Run:

```bash
bash -n scripts/deploy_server.sh scripts/tests/test_deploy_server.sh
bash scripts/tests/test_deploy_server.sh
```

Expected: syntax validation succeeds and all deployment tests pass.

- [ ] **Step 6: Commit deployment preflight support**

```bash
git add scripts/deploy_server.sh scripts/tests/test_deploy_server.sh
git commit -m "feat(deploy): gate wildcard CORS behind explicit opt-in"
```

### Task 3: Environment template and operator documentation

**Files:**
- Modify: `.env.example:1-9`
- Modify: `docs/deployment/application-server-first-deployment.md:168-190`
- Modify: `docs/deployment/application-server-first-deployment.md:665-678`

- [ ] **Step 1: Document the secure default in the environment template**

Add immediately after `CORS_ORIGINS`:

```dotenv
ALLOW_INSECURE_CORS=false
```

- [ ] **Step 2: Add the production opt-in example**

After the recommended same-origin environment block, add:

````markdown
生产环境默认拒绝通配 CORS。只有明确接受任意来源访问无凭证接口时，
才同时配置：

```dotenv
CORS_ORIGINS=*
ALLOW_INSECURE_CORS=true
```

该模式不会允许浏览器在跨域请求中携带认证 Cookie。需要跨域登录时，应
配置明确的 HTTPS 来源，而不是使用通配来源。
````

- [ ] **Step 3: Update the deployment checklist**

Replace the CORS checklist item with:

```markdown
- [ ] `SITE_ORIGIN` 使用正式 HTTPS 域名；`AUTH_COOKIE_SECURE=true`。
- [ ] `CORS_ORIGINS` 使用明确来源；若使用 `*`，已同时设置
      `ALLOW_INSECURE_CORS=true` 并接受跨域无凭证访问风险。
```

- [ ] **Step 4: Validate documentation formatting**

Run:

```bash
git diff --check -- .env.example \
  docs/deployment/application-server-first-deployment.md
```

Expected: no whitespace errors.

- [ ] **Step 5: Commit documentation**

```bash
git add .env.example docs/deployment/application-server-first-deployment.md
git commit -m "docs(deploy): document wildcard CORS opt-in"
```

### Task 4: Integrated verification

**Files:**
- Verify: `backend/app/core/config.py`
- Verify: `backend/tests/test_config.py`
- Verify: `scripts/deploy_server.sh`
- Verify: `scripts/tests/test_deploy_server.sh`
- Verify: `.env.example`
- Verify: `docs/deployment/application-server-first-deployment.md`

- [ ] **Step 1: Run all focused tests**

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/test_config.py -q
bash scripts/tests/test_deploy_server.sh
```

Expected: all tests pass.

- [ ] **Step 2: Run static validation**

```bash
.venv/bin/ruff check backend/app/core/config.py backend/tests/test_config.py
bash -n scripts/deploy_server.sh scripts/tests/test_deploy_server.sh
git diff --check HEAD~3..HEAD
```

Expected: no Ruff, shell syntax, or whitespace failures.

- [ ] **Step 3: Verify secure and insecure production examples**

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
