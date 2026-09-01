# Debug Session: backend-sighup-exit
- **Status**: [OPEN]
- **Issue**: Diagnose why the acceptance backend exited while Run `4d18560e-2fb2-4a89-a2b0-2c3542c89bba` was executing, distinguishing an unhandled application exception from process-launch/SIGHUP failure.
- **Debug Server**: Not used; existing backend log and operating-system process evidence are sufficient and business-code instrumentation is prohibited by the request.
- **Log File**: `/tmp/ad-creativity-acceptance/backend.log`

## Reproduction Steps
1. Inspect the existing backend log around the target Run.
2. Inspect backend process ancestry, session, signal-related exit evidence, and listening ports.
3. Query the backend's read-only Run and Task APIs for the latest state.
4. If evidence shows only a process-management failure, restart using the project's formal command under a persistent session, run a health check, observe for at least 15 seconds, and query Run/Task state again.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | An uncaught business exception terminated the backend | Medium | Low | Rejected: old log lines 1132-1135 show Uvicorn's complete graceful shutdown sequence with no fatal traceback at exit |
| B | The backend was tied to a parent shell and exited on SIGHUP/session teardown | High | Medium | Confirmed at the process-management level: the old non-persistent process exited when its controlling execution context ended; the exact delivered signal cannot be distinguished from logs alone |
| C | The launch command's backgrounding/redirection was incomplete | High | Low | Confirmed: the replacement process had to be detached; PID 32710 now has PPID 1, its own PGID, stdin `/dev/null`, and redirected stdout/stderr |
| D | Another process owns the expected port while the original backend exited | Low | Low | Rejected: PID 32710 is the expected project Uvicorn command and is the sole listener on 127.0.0.1:8000 |
| E | Run/Task recovery resumes after restart or has already reached a terminal state | Medium | Medium | Confirmed: Run proceeded through three attempts and reached terminal `failed`; retry/recovery worked, but all attempts failed with `asset_transfer_failed` |

## Log Evidence
- `/tmp/ad-creativity-acceptance/backend.log:2`: old server PID 25425 started.
- `/tmp/ad-creativity-acceptance/backend.log:69-205`: an earlier request returned 500 with `pymysql.err.DataError: (1406, "Data too long for column 'type' at row 1")`; the server continued serving hundreds of later requests, so this did not terminate the process and is unrelated to the target Run.
- `/tmp/ad-creativity-acceptance/backend.log:1132-1135`: `Shutting down`, application shutdown complete, and server process 25425 finished normally.
- `.dbg/backend-restart.log:26-31`: a first replacement PID 32603 was also gracefully stopped when its launch context ended.
- `.dbg/backend-restart.log:32-39`: persistent PID 32710 started successfully and passed health check.
- `.dbg/backend-restart.log:98-100`: target Run was accepted and queried successfully after the persistent restart.
- `.dbg/backend-restart.log:468-470`: health and target Run API remained responsive after prolonged observation.
- PID 32710: PPID 1, PGID 32710, cwd `/Users/bytedance/AD-Creativity`, stdin `/dev/null`, stdout/stderr `.dbg/backend-restart.log`, listener `127.0.0.1:8000`.
- Health checks returned HTTP 200 continuously from 23:41:59 through 23:45:20 +0800.
- Run `4d18560e-2fb2-4a89-a2b0-2c3542c89bba` finished at 23:45:13 +0800 with status `failed`.
- Task attempts `0f80215a-12da-4214-93ab-f1e5494b1391`, `d52fe1ff-1118-40c5-b1b4-b023120d13e9`, and `f1f1ee49-02f7-4299-800b-ed7a92c29cce` all failed with code `asset_transfer_failed`, stage `asset_transfer`, message `AIGC layer assets could not be stored`.

## Verification Conclusion
The backend exit was a process-lifecycle issue, not an uncaught business exception. Uvicorn received a handled termination signal and performed an orderly shutdown. The persistent replacement uses the project's documented command and survives its parent session. The target Run was created after that replacement started, remained queryable throughout observation, exhausted all three application-level retries, and reached a clean terminal `failed` state because output assets could not be stored. No code or database data was changed.
