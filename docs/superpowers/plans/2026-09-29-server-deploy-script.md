# Server Deploy Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-server script that installs dependencies, builds both application layers, restarts systemd services, and verifies health after code has been updated manually.

**Architecture:** A strict-mode Bash entry point derives the repository root, validates prerequisites, and finishes all fallible build work before touching running services. A standalone Bash test harness injects fake executables through `PATH` and a temporary application root so success and failure paths can be verified without changing the workstation.

**Tech Stack:** Bash, systemd, `flock`, curl, Python/pip, Node.js/npm

---

## File Structure

- Create `scripts/deploy_server.sh`: deployment orchestration, preflight checks, locking, restart, health polling, and diagnostics.
- Create `scripts/tests/test_deploy_server.sh`: isolated command-stub tests for deployment behavior.
- Modify `docs/deployment/application-server-first-deployment.md`: daily deployment usage and supported overrides.

### Task 1: Build The Isolated Test Harness

**Files:**
- Create: `scripts/tests/test_deploy_server.sh`
- Test: `scripts/tests/test_deploy_server.sh`

- [ ] **Step 1: Create a temporary application fixture**

Add helpers that create `.env`, `requirements.txt`, `backend/`, `frontend/package.json`,
`frontend/package-lock.json`, and a fake `.venv/bin/python`. Every fake executable appends
its invocation to `COMMAND_LOG`.

- [ ] **Step 2: Add the success-path assertions**

Run:

```bash
APP_ROOT="$fixture" \
PATH="$fake_bin:$PATH" \
COMMAND_LOG="$command_log" \
HEALTH_CHECK_ATTEMPTS=1 \
HEALTH_CHECK_INTERVAL_SECONDS=0 \
bash scripts/deploy_server.sh
```

Assert that pip installation and compilation precede `npm ci` and `npm run build`, that
the restart happens only afterward, both URLs are checked, and the build observes an empty
`NEXT_PUBLIC_BACKEND_BASE_URL`.

- [ ] **Step 3: Add failure-path assertions**

Use `FAKE_NPM_BUILD_FAIL=1`, `FAKE_CURL_FAIL=1`, and `FAKE_NODE_VERSION=v20.19.0`
in separate fixtures. Assert that build and version failures do not restart services, while
health failure invokes both `systemctl status` and `journalctl`.

- [ ] **Step 4: Run the test to verify it fails before implementation**

Run:

```bash
bash scripts/tests/test_deploy_server.sh
```

Expected: nonzero exit because `scripts/deploy_server.sh` does not exist.

### Task 2: Implement Deployment Orchestration

**Files:**
- Create: `scripts/deploy_server.sh`
- Test: `scripts/tests/test_deploy_server.sh`

- [ ] **Step 1: Add strict mode, configuration, logging, and deployment locking**

Use:

```bash
set -Eeuo pipefail
APP_ROOT="${APP_ROOT:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-/tmp/ad-creativity-deploy.lock}"
exec 9>"$DEPLOY_LOCK_FILE"
flock -n 9
```

Emit timestamped phase messages and fail clearly when another deployment owns the lock.

- [ ] **Step 2: Implement preflight validation**

Require the application files, virtual-environment Python, `flock`, `curl`, `node`, `npm`,
and `systemctl`. Require `sudo -n true` for non-root users and reject Node.js versions below 22.

- [ ] **Step 3: Implement dependency installation and build**

Run:

```bash
"$APP_ROOT/.venv/bin/python" -m pip install -r "$APP_ROOT/requirements.txt"
"$APP_ROOT/.venv/bin/python" -m compileall -q "$APP_ROOT/backend"
(cd "$APP_ROOT/frontend" && npm ci)
(cd "$APP_ROOT/frontend" && env -u NEXT_PUBLIC_BACKEND_BASE_URL npm run build)
```

No service command may run before all four commands succeed.

- [ ] **Step 4: Implement restart, health polling, and diagnostics**

Restart both configured units, verify `is-active --quiet`, and poll the two configured URLs.
After the restart begins, an error trap prints no-pager service status plus the last 100 journal
lines for each unit. The trap preserves a nonzero exit.

- [ ] **Step 5: Run deployment-script tests**

Run:

```bash
bash scripts/tests/test_deploy_server.sh
```

Expected: all named test cases print `PASS` and the script exits zero.

### Task 3: Document Daily Deployment

**Files:**
- Modify: `docs/deployment/application-server-first-deployment.md`

- [ ] **Step 1: Add the post-pull deployment workflow**

Document:

```bash
cd /opt/ad-creativity/app
git pull --ff-only
./scripts/deploy_server.sh
```

State explicitly that the script does not pull code, reload Nginx, run the full test suite, or
automatically roll back.

- [ ] **Step 2: Document configuration and failure investigation**

List service-name, health-URL, retry, interval, lock-file, and application-root environment
overrides. Include direct `systemctl status` and `journalctl` commands for follow-up.

### Task 4: Verify And Commit

**Files:**
- Create: `scripts/deploy_server.sh`
- Create: `scripts/tests/test_deploy_server.sh`
- Modify: `docs/deployment/application-server-first-deployment.md`
- Create: `docs/superpowers/specs/2026-09-29-server-deploy-script-design.md`
- Create: `docs/superpowers/plans/2026-09-29-server-deploy-script.md`

- [ ] **Step 1: Run syntax checks**

Run:

```bash
bash -n scripts/deploy_server.sh
bash -n scripts/tests/test_deploy_server.sh
```

Expected: both commands exit zero without output.

- [ ] **Step 2: Run isolated behavior tests**

Run:

```bash
bash scripts/tests/test_deploy_server.sh
```

Expected: all test cases pass.

- [ ] **Step 3: Check whitespace and review the scoped diff**

Run:

```bash
git diff --check
git diff -- scripts/deploy_server.sh scripts/tests/test_deploy_server.sh docs/deployment/application-server-first-deployment.md docs/superpowers/specs/2026-09-29-server-deploy-script-design.md docs/superpowers/plans/2026-09-29-server-deploy-script.md
```

Expected: no whitespace errors and no unrelated changes.

- [ ] **Step 4: Commit only deployment-script files**

Run:

```bash
git add scripts/deploy_server.sh scripts/tests/test_deploy_server.sh docs/deployment/application-server-first-deployment.md docs/superpowers/specs/2026-09-29-server-deploy-script-design.md docs/superpowers/plans/2026-09-29-server-deploy-script.md
git commit -m "feat(deploy): add server deployment script"
```

Expected: the pre-existing staged `frontend/package-lock.json` is excluded from this commit by
committing with explicit paths.
