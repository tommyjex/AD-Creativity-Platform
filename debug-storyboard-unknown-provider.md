# Debug Session: storyboard-unknown-provider
- **Status**: [OPEN]
- **Issue**: 项目模块生成视频分镜脚本时返回服务暂时不可用，方舟错误码 `UnknownProviderError`
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-storyboard-unknown-provider.ndjson`

## Reproduction Steps
1. 进入项目模块的视频分镜脚本生成流程。
2. 提交生成请求。
3. 前端显示服务暂时不可用，并展示方舟错误码 `UnknownProviderError`。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Provider 返回具体错误，但异常解析未提取嵌套错误码 | High | Low | Provisionally rejected: no provider exception event |
| B | 网络超时、断连、TLS 或 DNS 异常被 SDK 包装为未知错误 | High | Low | Provisionally rejected: no transport exception event |
| C | 分镜模型或 Endpoint 不支持当前请求参数 | Medium | Low | Provisionally rejected: stream request started normally |
| D | 限流、鉴权或内容风控错误未被映射 | Medium | Low | Provisionally rejected: no HTTP/provider error event |
| E | 前端错误提示掩盖了后端业务异常 | Low | Medium | Confirmed: 27 schema `extra_forbidden` errors |

## Log Evidence
Instrumentation points in `backend/app/services/modelark.py`:

- B-C-E: storyboard text-stream entry, model, transport, image count, prompt length.
- A-B-C-D: provider exception type, safe code fields, request ID, HTTP status, cause type.
- E: successful JSON parsing and storyboard shot count.

Pre-fix run 1:

- Log line 1: storyboard request used model `doubao-seed-evolving`,
  `chat_completions`, no image inputs, prompt length 4016.
- Backend runtime log: stream failed with `ModelArkTextParseError`.
- No provider exception event was emitted, so `UnknownProviderError` is a
  presentation fallback rather than the original exception category.

Pre-fix run 3:

- Log line 2: the Provider returned complete JSON (`endsWithObjectClose=true`)
  containing all required top-level fields.
- Pydantic reported 27 `extra_forbidden` errors.
- Every shown failure was one of `camera_movement`, `sound`, or
  `transition_recommendation` under a storyboard shot.

## Verification Conclusion
Root cause confirmed: the prompt asks each shot to include camera movement,
sound, and transition guidance, but the JSON example and persisted shot schema
expect those details inside `description`. The model returned them as separate
fields, and strict schema validation rejected the otherwise complete storyboard.
`ModelArkTextParseError` then inherited provider-detail formatting, causing the
misleading `UnknownProviderError` label.

## Fix

- Normalize the known Provider fields `camera_movement`, `sound`, and
  `transition_recommendation` into each shot's `description`.
- Keep unknown extra shot fields forbidden.
- Update the storyboard prompt so those details must be written inside
  `description` and only the seven supported shot keys are returned.
- Report future text-response parse failures as
  `phase=response_validation` instead of `provider_code=UnknownProviderError`.
- Targeted ModelArk and API tests: `151 passed`.

Post-fix user verification pending.

## Post-Fix Iteration 1

- Lines 1 and 3: Provider requests completed through the expected storyboard
  `chat_completions` path.
- Lines 2 and 4: known extra fields no longer fail validation.
- The only remaining error is
  `storyboard_shots[1].visual_prompt` with type `missing`.
- Both responses are complete JSON objects and include all top-level fields.

The remaining field can be deterministically recovered from the same shot's
required `description`; no second Provider call is needed.

## Fix Iteration 2

- Recover a missing or blank `visual_prompt` from the same shot's non-empty
  `description`.
- Keep missing/invalid `description` as a schema failure.
- Targeted ModelArk and API tests: `152 passed`.

Second post-fix user verification pending.

## Post-Fix Iteration 2 Evidence

- Log line 2: Provider payload parsed successfully.
- Parsed payload contained 3 storyboard shots.
- The failure occurs after Provider parsing, inside storyboard business validation.
- Next evidence point records only indexes and durations to distinguish sequence,
  positive-duration, and total-duration failures.

## Post-Fix Iteration 3 Evidence

- Provider payload parsed successfully with 3 shots.
- Shot indexes are valid and consecutive: `[1, 2, 3]`.
- Every shot duration is positive: `[5.0, 5.0, 3.0]`.
- Actual total duration is `13.0s`, while the brief requires `30s`.

The remaining failure is the strict total-duration check. The safe repair is to
scale positive shot durations proportionally to the brief duration and assign
the rounding remainder to the final shot.

## Fix Iteration 3

- Normalize positive storyboard shot durations proportionally to the brief's
  requested total duration.
- Assign the two-decimal rounding remainder to the final shot.
- Apply the same normalization to synchronous and streaming storyboard paths.
- Keep empty shots, non-positive durations, and non-consecutive indexes as hard
  failures.
- Focused regression tests: `5 passed`.

Third post-fix user verification pending.

## Post-Fix Iteration 3 Evidence

- The UI received and displayed streamed `content` before the terminal error.
- The Provider returned a complete JSON object.
- The sole validation error was a missing `index` on
  `storyboard_shots[1]`.

`index` and `project_id` are server-owned facts. They should be normalized from
array order and the current request instead of trusted to stochastic model output.

## Fix Iteration 4

- Rebuild shot indexes from array order (`1..N`).
- Force every shot to the current request's `project_id`.
- Recover `description` from `visual_prompt`, or `visual_prompt` from
  `description`, when exactly one is missing.
- Targeted ModelArk and API regression suite: `154 passed`.

Fourth post-fix user verification pending.
