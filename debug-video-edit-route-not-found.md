# Debug Session: video-edit-route-not-found
- **Status**: [OPEN]
- **Issue**: Clicking "生成编辑候选" first returned route-level 404; after loading the route, Seedance rejected editing parameters with `InvalidParameter.TaskTypeConstraint`.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-video-edit-route-not-found.ndjson`

## Reproduction Steps
1. Open a project with a generated storyboard video.
2. Click "编辑视频".
3. Enter an edit prompt.
4. Click "生成编辑候选".
5. Observe HTTP 404 Not Found.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Port 8000 is running a backend process started before the new routes were implemented. | High | Low | Confirmed: pre-fix OpenAPI has no edit/select routes; process started at 11:17. |
| B | Frontend and backend route paths differ. | Low | Low | Rejected: source paths both use `/storyboard/shots/{shot_id}/edit-video`. |
| C | Frontend is calling a different backend host or port. | Medium | Low | Rejected: frontend defaults to port 8000 and port 8000 is healthy. |
| D | Route source exists but is not registered in the running FastAPI app. | High | Low | Confirmed as consequence of A: running OpenAPI omits both new routes. |
| E | Video editing incorrectly reuses normal generation `ratio` and `duration`. | High | Low | Confirmed: runtime sent `9:16/4`; editing requires `adaptive/-1`. |
| F | Candidate URL or MIME type is invalid. | Medium | Low | Rejected: both assets are valid `video/mp4` files with MP4 signatures. |
| G | Comparison player state prevents otherwise valid videos from playing. | Medium | Medium | Rejected: isolated Chromium playback succeeds after the proxy fix without changing the player. |
| H | Asset proxy drops HTTP byte-range semantics required to read MP4 metadata at the file tail. | High | Low | Confirmed: pre-fix Range returned 200/full file; `moov` is near EOF. |

## Log Evidence
- Pre-fix `GET http://127.0.0.1:8000/openapi.json`: no paths containing `edit-video` or `select-video`.
- Port 8000 PID 33787 command: `python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --env-file .env`.
- PID 33787 start time: 2026-08-15 11:17:01 Beijing time.
- Current source contains both new routes and frontend uses the matching paths.
- Debug log line 1 records the pre-fix process age, missing OpenAPI routes, and matching source paths.
- Debug log line 2 records the restarted PID 67282, both registered routes, healthy backend, and a 422 schema response from `edit-video`.
- Debug log line 3 records provider code `InvalidParameter.TaskTypeConstraint`, sent values `9:16/4`, and required editing values `adaptive/-1`.
- Debug log line 4 records captured post-fix values `adaptive/-1`, the `reference_video` role, 76 passing focused tests, and restarted backend PID 80003.
- Debug log line 5 records pre-fix media evidence: no range response, browser abort, and `moov` metadata near EOF.
- Debug log line 6 records post-fix `206`, exact 64-byte response, and successful synchronized Chromium playback.
- Debug log line 7 records recovery of an already-open comparison through the explicit reload control, with all retried media requests returning 206.

## Verification Conclusion
- Pre-fix: PID 33787 omitted both routes, so FastAPI returned route-level 404.
- Post-fix: PID 67282 exposes both routes in OpenAPI.
- A direct POST with an empty JSON body now returns 422 `prompt` required, proving the request reaches the new endpoint instead of returning route-level 404.
- No business logic change was required; restarting the stale backend loaded the implemented routes.
- Second-stage root cause: `BytePlusModelArkAdapter.edit_video()` delegates to the normal generation path, which derives ratio and duration from the storyboard shot instead of using editing-task sentinel values.
- Post-fix: normal generation retains its existing parameter derivation, while editing overrides only the provider task values to `ratio=adaptive` and `duration=-1`.
- Automated verification: 28 ModelArk adapter tests and 48 storyboard video workspace tests passed.
- Playback root cause: `/api/assets/{asset_id}/content` did not forward browser Range requests or upstream partial-response headers.
- Playback fix: forward `Range`, preserve upstream status, and return `Accept-Ranges`, `Content-Length`, `Content-Range`, `ETag`, and `Last-Modified`.
- Post-fix browser evidence: both original and candidate reached readyState 4, duration 4.064s, and advanced in sync with no media errors.
- Full backend verification: 225 tests passed.
- Existing-dialog recovery: comparison controls now always expose "重新加载视频"; it reloads both sources without attempting blocked autoplay.
- Independent playback: the comparison board renders two self-contained players; each version has its own play/pause, seek, mute, fullscreen, and reload so versions can be reviewed one at a time.
- Aspect-ratio adaptation: each player frame starts from the project ratio and re-fits to the video's real `videoWidth/videoHeight` on `loadedmetadata`, capped at `min(62dvh, 40rem)` so portrait candidates stay fully visible.
- Frontend verification: TypeScript, focused lint, and 27 workspace tests passed.
