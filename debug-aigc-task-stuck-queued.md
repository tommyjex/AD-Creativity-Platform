# Debug Session: aigc-task-stuck-queued
- **Status**: [OPEN]
- **Issue**: Task `text_to_image-608ef76c-a1db-4265-8cf2-a6474d513318` remains queued for about 10 minutes without a start time.

## Reproduction Steps
1. Open the affected AIGC pipeline.
2. Start the relevant flow.
3. Observe task Attempt #1 remains queued with no start time.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Expected Signal |
|----|------------|------------|--------|-----------------|
| A | Backend restart orphaned a persisted queued task from its in-memory worker | Rejected | Low | Task was created long after the current backend process started. |
| B | Scheduler coroutine failed before claiming the queued task | Confirmed | Medium | Heartbeat crashed during lease-loss recovery; task stayed queued with no active scheduler. |
| C | Same-subgraph conflict incorrectly blocks dispatch | Rejected | Medium | Only one queued task exists and no running tasks occupy its scope. |
| D | Provider capacity or remote API wait is shown as queued | Rejected | Low | Attempt has no start time or provider task ID; provider was never called. |

## Log Evidence
Target resolution:
- User-facing node ID: `text_to_image-608ef76c-a1db-4265-8cf2-a6474d513318`
- Persisted task ID: `e609612d-ccc9-4c3f-8465-6a0ff6fb26e9`
- Pipeline: `56198c0b-e0e1-4f43-9494-d41ce379ab2d`
- Run: `0d22fe4e-102d-4f95-97a7-92989f4db63a` (#6)
- Task created: `2026-09-07T01:33:24Z`
- Task status: queued; `started_at=null`

Scheduler evidence:
- Only this task is queued; no task is running.
- Worker lease heartbeat stopped at `2026-09-06T23:14:29Z`.
- Lease expired at `2026-09-06T23:14:59Z`.
- Backend process remained healthy and served HTTP requests.
- Server traceback shows MySQL DNS failure in `_heartbeat_loop()`.
- `_handle_lease_loss()` immediately retried a DB query, raised the same
  `OperationalError`, and exited before `_ensure_lease_retry()`.

## Verification Conclusion
The HTTP server remained alive after a transient MySQL DNS failure, but the
AIGC scheduler heartbeat died permanently. Subsequent tasks were persisted as
queued but could not be claimed.

The recovery path must clear the stale lease/workers first and schedule lease
reacquisition in a `finally` block even when DB convergence temporarily fails.

Implemented:
- Snapshot affected Run IDs on a best-effort basis.
- Clear stale lease state and stop stale workers even if the database query
  fails.
- Always schedule lease reacquisition from `finally`.
- Preserve existing interrupted-task convergence when the database is
  available.

Post-fix evidence after backend restart:
- Lease fencing token advanced to `129`.
- Worker count is `4`; all workers report `done=false`.
- Queue size returned to `0`.
- Target task moved from `queued` to `running` at
  `2026-09-07T01:48:53Z`.
- Target task succeeded at `2026-09-07T01:50:22Z`.
- Run #6 succeeded at `2026-09-07T01:50:25Z`.
- Output asset: `81704daf-0926-4cc5-993b-8fd3cf857666`.

Verification:
- Lease acquisition, lease-loss restart, recovery DB failure, and interrupted
  task convergence tests: 4 passed.
- `git diff --check`: passed.

Waiting for user confirmation before removing instrumentation and debug files.
