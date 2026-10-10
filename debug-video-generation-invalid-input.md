# Debug Session: video-generation-invalid-input
- **Status**: [OPEN]
- **Issue**: Task video_generation-35c3cba6-910f-4c83-819f-643616147282 failed during validate with invalid_input after 3m43s.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-video-generation-invalid-input.ndjson

## Reproduction Steps
1. Open the failed video generation node.
2. Run the node with its current upstream connections and configuration.
3. Observe `invalid_input` at stage `validate`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Referenced asset is missing, unavailable, or has an incompatible type | High | Low | Rejected: failure occurred while downloading generated output |
| B | Required prompt, first frame, or reference video is absent from the task input snapshot | High | Low | Rejected: provider execution ran for 3m43s and returned an output URL |
| C | An upstream node did not complete successfully, so its output cannot be resolved | Medium | Low | Rejected: task reached provider dispatch and output transfer |
| D | Node configuration contains a removed or model-incompatible parameter | Medium | Medium | Rejected: no provider validation failure was logged |
| E | Another backend instance executed the task, so local logs are incomplete | Medium | Low | Confirmed environment difference; production TLS supplied complete evidence |

## Log Evidence
- Production TLS at 2026-10-10 10:38:50 CST records task
  `a3cf7b98-b43d-4bf4-9ff0-3bbd69dc0f49` for node
  `video_generation-35c3cba6-910f-4c83-819f-643616147282`.
- The root exception is `ValueError: generated asset exceeds maximum size`.
- Stack frames point to `assets.py:upload_assets_from_sources -> fetch ->
  stream_to_file`, after provider dispatch.
- The configured generic generated-asset limit defaults to 30 MiB.
- Pre-fix local evidence at
  `.dbg/trae-debug-log-video-generation-invalid-input.ndjson:1` confirms the
  downloader raises when the declared output size exceeds `maxBytes`.

## Verification Conclusion
The model output was generated successfully, but its video file exceeded the
30 MiB generic download limit while the backend was transferring it to TOS.
The outer gateway then converted that transfer `ValueError` into the misleading
`invalid_input / input_resolution` error shown by the UI.

## Post-Fix Evidence
- Generated images retain the 30 MiB downloader limit.
- Generated videos use an isolated 200 MiB downloader limit configurable with
  `AIGC_VIDEO_TRANSFER_MAX_BYTES`.
- A 9-byte video succeeds with an image limit of 4 bytes and a video limit of
  10 bytes; no post-fix size-limit event is emitted.
- Transfer validation failures are reported as
  `asset_transfer_failed / asset_transfer`, not `invalid_input`.
- Focused verification: 73 tests passed, followed by 2 post-fix comparison
  tests passed.
- Full backend verification: 1663 tests passed. The sole failure is the
  expected debug-dependency guard while temporary instrumentation remains.
- Production deployment and rerun are pending user approval.
