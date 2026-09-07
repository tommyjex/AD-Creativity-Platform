# Debug Session: aigc-worker-interrupted
- **Status**: [OPEN]
- **Issue**: LLM node `llm-62c83a5b-fcda-4fb6-8916-bf95d074d83c` failed after 37 seconds with `worker_interrupted`.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-aigc-worker-interrupted.ndjson`

## Reproduction Steps
1. Execute the pipeline containing LLM node `llm-62c83a5b-fcda-4fb6-8916-bf95d074d83c`.
2. Wait for the node execution result.
3. Observe `AIGC worker stopped before completing the task`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Uvicorn hot reload restarted the backend while the LLM task was running. | High | Low | Confirmed |
| B | Application shutdown cancelled the in-memory AIGC worker and marked the task interrupted. | High | Low | Confirmed |
| C | The worker loop crashed independently of process reload. | Medium | Medium | Rejected |
| D | Startup recovery marked a previously running task interrupted after restart. | Medium | Low | Confirmed |

## Log Evidence
- Run `693b6d1c-61a1-471e-95a1-fb5edce8faba` started its LLM attempt at
  `2026-09-05 22:06:27` Beijing time.
- `backend/app/services/modelark.py` changed at `22:07:02`.
- The task was finalized as `worker_interrupted` at `22:07:04`.
- The replacement Uvicorn worker process started at `22:07:06`.
- The attempt recorded zero provider metrics, matching cancellation during
  worker shutdown rather than a provider/model failure.

## Verification Conclusion
The development server's hot reload cancelled the in-memory worker while the
LLM node was executing. The runtime intentionally records cancelled running
attempts as `worker_interrupted`; failed runs are terminal and must be retried.
No production logic change is required for this incident.
