# Debug Session: image-input-invalid
- **Status**: [OPEN]
- **Issue**: `image_to_image-ed8c7b37-d0b9-4328-9470-51c713aeb55b` fails during validate with `invalid_input`.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-image-input-invalid.ndjson`

## Reproduction Steps
1. Run the affected `image_to_image` node.
2. Observe Attempt #1 fail during `validate` with `AIGC node input is invalid or unavailable`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Referenced source asset is missing, deleted, or inaccessible | High | Low | Rejected: log line 3 shows a public, succeeded uploaded image with object key and URL |
| B | Source asset exists but status, media type, or URL is rejected | High | Low | Rejected: log line 3 shows valid image status, type, MIME, and storage fields |
| C | Saved node configuration fields differ from backend expectations | Medium | Medium | Rejected: log lines 1-2 show current code accepts the persisted Flash/1.5K parameters |
| D | Upstream edge or output-handle mapping does not resolve to an image | Medium | Medium | Rejected: persisted task contains one resolved reference asset ID and current code loads it |
| E | Validation rejects a recoverable remote or proxied asset too early | Low | Medium | Rejected: current code reaches the provider boundary with the asset |
| F | Running backend predates Flash support and still only permits the Pro model | High | Low | Confirmed: process started 2026-10-09 13:17; Flash support commit is 2026-10-10 16:34 |

## Log Evidence
Pre-fix runtime evidence:
- Line 1: persisted task uses `doubao-seedream-5-0-flash-260915`, size `1.5K`, and one reference.
- Line 2: current disk code validates those parameters successfully.
- Line 3: referenced asset is public, succeeded, `uploaded_image`, `image/jpeg`, and has storage access fields.
- Failed task finished before any input reference was recorded.
- Backend PID 94263 started on 2026-10-09 13:17:11, before commit `2fdd60c` added Flash to `AIGC_ENABLED_IMAGE_MODELS` on 2026-10-10 16:34:53.

Post-fix runtime evidence:
- Backend restarted as PID 76247 from the current working tree.
- Log lines 1-3 show the restarted backend accepted the same Flash/1.5K params and loaded the same reference asset.
- Retry Run #2 (`b507bc9c-b674-4842-8ecc-95091d2cd440`) entered the ModelArk provider call instead of failing validation.
- Provider call succeeded in 18,693 ms.
- Task `0df9cc75-d90f-4a38-8943-137f02ff588c` and Run #2 both finished with `succeeded` and no error.
- Output asset `b84fafb3-463a-47db-95cf-75c8a322ed88` was persisted and loaded by the canvas.

## Verification Conclusion
The failure was produced by a stale backend process running code from before Flash model support. Restarting the backend loaded commit `2fdd60c`; the same node then succeeded end to end. Awaiting user confirmation before removing instrumentation and all debug artifacts.
