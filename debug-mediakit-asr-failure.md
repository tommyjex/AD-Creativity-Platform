# Debug Session: mediakit-asr-failure
- **Status**: [OPEN]
- **Issue**: Editing composition fails with "MediaKit ASR subtitle extraction failed".
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-mediakit-asr-failure.ndjson

## Reproduction Steps
1. Open the storyboard video workspace.
2. Click the action that generates the edited final video.
3. Observe failure during MediaKit ASR subtitle extraction.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Expected Signal | Evidence |
|----|------------|------------|--------|-----------------|----------|
| A | MediaKit API authentication is invalid | Medium | Low | Submit response is HTTP 401/403 or an auth error code | Rejected: pre-fix line 8 is HTTP 200 with `success=true` |
| B | Submit payload or media URL is invalid | High | Low | Submit response is HTTP 4xx with parameter/media error | Rejected: pre-fix line 8 returns a task id |
| C | Async task submits but later fails | High | Medium | Submit returns task ID; polling reaches failed state | Confirmed variant: pre-fix line 9 returns valid in-progress status `running`, which the client rejects |
| D | Result download or JSON parsing fails | Medium | Medium | Polling succeeds; failure occurs during result fetch/parse | Inconclusive: parser is not reached in the real run |
| E | Source video is not publicly reachable | High | Low | Submitted URL is local/private/expired or MediaKit reports fetch failure | Inconclusive: signed HTTPS TOS URL is accepted and task enters `running` |

## Instrumentation Design
1. Report redacted submit request metadata and source URL characteristics.
2. Report submit HTTP status and redacted provider response.
3. Report polling status transitions and provider failure details.
4. Report result URL characteristics, download status, and parse outcome.
5. Report the exception type and stage before the public error wrapper.

## Log Evidence
- Existing failed compose task `4b646cb9-bad5-4276-a403-920e60b4efeb` recorded
  `phase=poll; reason=unexpected_status`. Submission therefore completed and
  polling returned a status outside the currently accepted set.
- Pre-fix line 7: source is a signed HTTPS TOS URL.
- Pre-fix line 8: submit returned HTTP 200, `success=true`, and a task id.
- Pre-fix line 9: first real poll returned HTTP 200 and `status=running`.
- The client currently accepts only `pending` and `processing` as in-progress
  statuses, so it incorrectly raises `unexpected_status` for the provider's
  real `running` value.

## Verification Conclusion
Root cause confirmed: MediaKit returns `running` for an active ASR task, but
`MediaKitAsrSubtitleClient._poll` does not recognize that documented runtime
state. Minimal fix: treat `running` as an in-progress state and continue
polling.

Post-fix evidence:
- Line 3-6: repeated HTTP 200 responses with `status=running` are accepted.
- Line 7: MediaKit reaches `status=completed` with a result object.
- Line 8: 17 subtitle segments are parsed successfully.
- The compose task advances from progress 0.45 (ASR) to 0.82 (subtitle burn),
  proving the original MediaKit ASR failure is fixed.
- A separate downstream issue is now exposed: FFmpeg subtitle burning exits
  with return code 234. This is outside the confirmed MediaKit root cause and
  requires a separate evidence cycle if debugging continues.

## FFmpeg Iteration

### Hypotheses
| ID | Hypothesis | Likelihood | Effort | Expected Signal | Evidence |
|----|------------|------------|--------|-----------------|----------|
| F1 | FFmpeg 8.1 subtitles syntax incompatibility | Medium | Low | stderr reports filter parse error | Confirmed: runtime line 10 reports `No option name near ...subs.srt` |
| F2 | Configured FFmpeg lacks libass/subtitles filter | High | Low | filter listing omits subtitles; stderr reports unknown filter | Confirmed: corrected standalone command reports `No such filter: subtitles` |
| F3 | Chinese encoding, font, or style initialization fails | Medium | Medium | stderr reports fontconfig/libass/style error | Rejected at current stage: filter never initializes |
| F4 | Input codec/time base conflicts with subtitle transcode | Low | Medium | stderr reports decoder/encoder/time-base error | Rejected: input streams are read successfully before filter parse failure |
| F5 | Temporary subtitle path escaping fails | Medium | Low | stderr reports invalid filename/filter argument | Confirmed variant: positional quoted path is parsed as an unnamed option |

### Instrumentation
1. Report FFmpeg executable and subtitle-command characteristics before launch.
2. Report return code and stderr tail after the subtitle command exits.

### Evidence
- FFmpeg pre-fix line 10: return code 234 and filter graph error
  `No option name near '/.../subs.srt:force_style=...'`.
- A standalone command using explicit `filename=` gets past that parse point,
  then fails with `No such filter: subtitles`.
- The configured bundled FFmpeg 8.1.2 has no `--enable-libass` and does not
  list the `subtitles` filter.

### Minimal Fix
1. Use explicit `subtitles=filename='...'` filter syntax.
2. Configure a `ffmpeg-full` binary built with `libass`.

### Post-Fix Evidence
- FFmpeg post-fix line 9 uses
  `/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg` with the `subtitles` filter.
- FFmpeg post-fix line 10 exits with return code 0 and renders all 629 frames.
- Compose task `3fdb31f4-f6f2-4527-9ea5-83692f379af0` reaches
  `succeeded`, progress 1.0, message `剪辑完成`.
- Final MP4 asset `f5a5f74c-48dd-490f-9c01-239ced596c7a` returns HTTP 200
  with `video/mp4`.
- SRT asset `a02f1166-32c0-47d8-8905-fd09e5a717ac` returns HTTP 200 with
  `application/x-subrip`.
- Backend full suite passes: 219 tests.

## Final Video Preview Iteration

### Hypotheses
| ID | Hypothesis | Likelihood | Effort | Expected Signal | Evidence |
|----|------------|------------|--------|-----------------|----------|
| P1 | Frontend selects the SRT output instead of final video | High | Low | Preview asset MIME/type is not video | Confirmed: DOM source is subtitle asset `a02f...` |
| P2 | Project data is not refreshed after compose completion | High | Low | Task succeeds but UI project has no new final-video asset | Rejected: API payload contains latest MP4 and SRT |
| P3 | Browser cannot fetch/range-load the asset | Medium | Medium | Network/CORS/Range error for content endpoint | Rejected: requests complete with 200/206 and no request failure |
| P4 | Video component source state does not update | Medium | Medium | DOM video source differs from latest API asset URL | Confirmed variant: state updates to the wrong latest compose asset |
| P5 | MP4 codec/container is not browser-decodable | Low | Medium | Media error with correct 200 MP4 response | Rejected: browser never attempts the final MP4 in this panel |

### Instrumentation Plan
1. Inspect the backend project/asset payload and final-video MIME metadata.
2. Inspect rendered video/source DOM attributes after project load.
3. Capture browser console, failed requests, media error, readyState and networkState.

### Evidence
- Subtitle asset timestamp `03:00:26` is newer than final MP4 timestamp
  `03:00:25`.
- `latestFinalVideoAsset` accepts every succeeded `stage === "compose"` asset,
  so sorting picks the subtitle.
- Browser DOM source is the subtitle content endpoint; MIME is
  `application/x-subrip`.
- Browser reports media error code 4, readyState 0, networkState 3.

### Minimal Fix
Select only succeeded assets whose type is `final_video` and MIME type starts
with `video/`.

### Post-Fix Evidence
- The compose preview DOM source is final MP4 asset
  `f5a5f74c-48dd-490f-9c01-239ced596c7a`, not the newer SRT asset.
- Chromium reports readyState 4, networkState 1, duration 26.325 seconds, and
  no media error.
- Final MP4 request returns HTTP 200 with `video/mp4`; no failed requests.
- Frontend full suite passes: 133 tests.
- TypeScript typecheck passes.
