# Multi-track Run Failure Debug Session

## Status

[OPEN]

## Session

- ID: `multitrack-run-failure`
- Symptom: A multi-track edit node failed during execution.

## Expected

The timeline renders to a successful video asset.

## Actual

The first failure was fixed, but Run #3 now reaches MediaKit and is rejected
during submission with request ID
`202609092046216AB337E6BBEF261F49F3`.

## Hypotheses

| ID | Hypothesis | Evidence needed |
| --- | --- | --- |
| H1 | Timeline references unavailable or incompatible assets | Run snapshot, task params, asset states |
| H2 | Clip trim range exceeds source duration | Timeline clips and ffprobe durations |
| H3 | Backend executor rejects a valid-looking layout/transition/audio combination | Structured task error and executor stage |
| H4 | FFmpeg/ffprobe, timeout, codec, disk, or temporary-file failure | Attempt error and backend process logs |
| H5 | Run used a stale definition snapshot | Run revision and current Pipeline revision |
| H6 | Internal time objects are sent where MediaKit expects arrays | Sanitized submit payload shape |
| H7 | Media URL is sent under the wrong field | Sanitized submit payload keys |
| H8 | Internal transform shape is sent instead of provider `extra` operations | Sanitized element keys |
| H9 | Auto canvas null dimensions are rejected | Sanitized canvas keys and Provider error |
| H10 | Provider-side transient rejection | Provider error code/message without schema hints |

## Evidence

- Pipeline: `7fc13c4b-d2f9-4757-b88c-2943f77d31c2` (`视频多轨剪辑test`)
- Run: `75703e84-9fbc-4938-a532-7bdf2bbb6234` (Run #1, pipeline revision 27)
- Task: `4cbfdafd-c5f4-4d57-b154-f451701e8b4f`
- Stored runtime instrumentation reports:
  - exception type: `TypeError`
  - message: `'Depends' object is not callable`
  - location: `_execute_multi_track:2109`
- The referenced video asset is `succeeded`, `video/mp4`, duration `8.065s`; the requested trim is only `0-3s`.
- Task params contain valid resolved video/text sources and passed timeline validation.
- `backend/app/main.py::_lifespan` manually calls `get_aigc_pipeline_runtime` but does not resolve/pass `multitrack_client_factory`.
- The omitted argument therefore retains the function signature default `Depends(get_multitrack_client_factory)` instead of a callable factory.
- `AigcModelGateway._execute_multi_track` later executes `self.multitrack_client_factory()` and raises before any MediaKit request is submitted.

## Hypothesis Results

| ID | Status | Evidence |
| --- | --- | --- |
| H1 | Rejected | Referenced assets and resolved source types are valid. |
| H2 | Rejected | 3s trim is within the 8.065s video duration. |
| H3 | Rejected | Timeline validation completed before the failing line. |
| H4 | Confirmed, dependency wiring subtype | Worker raised before MediaKit/FFmpeg: a FastAPI `Depends` marker was called as a factory. |
| H5 | Rejected | Run snapshot revision 27 matches the submitted task params. |
| H6 | Confirmed | MediaKit `InvalidParameter`: `target_time` has type `object`, wants `array`. |
| H7 | Confirmed | Provider task requires `Source`; request used `url`. |
| H8 | Inconclusive | Provider validation stopped at `target_time`. |
| H9 | Confirmed | After time normalization, Provider rejected editor-only canvas field `mode`. |
| H10 | Rejected | Provider returned a deterministic schema validation error. |

## Conclusion

The application lifespan manually constructs the runtime without resolving and
passing `get_multitrack_client_factory`. The gateway receives a `Depends`
object and crashes at `client = self.multitrack_client_factory()`.

## Fix

- `backend/app/main.py::_lifespan` now resolves
  `get_multitrack_client_factory` through application dependency overrides and
  passes the callable into `get_aigc_pipeline_runtime`.
- Added a lifespan regression test that asserts the configured gateway factory
  is callable and returns the expected client.

## Verification

| Phase | Factory type | Callable | Result |
| --- | --- | --- | --- |
| Pre-fix | `Depends` | `false` | Worker crashes before MediaKit submission |
| Post-fix | `type` | `true` | Runtime dependency wiring is valid |

- Focused backend suite: `86 passed`.
- Backend restarted with the fix on port `8000`.
- A live retry is intentionally left to the user because it submits a real
  MediaKit multi-track task.

### Provider request iteration

- Provider-pre-fix request ID:
  `2026090920511975CD1DB992E8B2158C81`
- Provider response:
  `InvalidParameter`; `target_time` received an object and requires an array.
- Confirmed minimal translation:
  `{"start_ms": 0, "end_ms": 8000}` -> `[0, 8000]`.
- The same translation is applied to optional `source_trim`.
- Focused multi-track gateway tests: `6 passed`.
- Provider-post-fix request ID:
  `202609092054492823AAE2C6609118B4A1`
- Time arrays passed validation; MediaKit next rejected internal canvas field
  `mode` as an unexpected additional property.
- H9 is confirmed: Provider canvas must omit editor-only `mode` and null
  dimensions.
- After the canvas fix, MediaKit accepted submission but the asynchronous task
  entered `failed` during polling. This rejects H10's transient-submit variant
  but requires the task's nested error code/message to distinguish H7/H8 from
  media download or render failures.
- Provider task `amk-tool-multi-track-edit-1161893633538` reported
  `InvalidParameter`: `Track 0 0` is missing required property `Source`.
- H7 is confirmed: media elements must use Provider field `source`, not `url`.
