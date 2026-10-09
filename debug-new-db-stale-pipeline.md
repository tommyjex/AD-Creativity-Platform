# Debug Session: new-db-stale-pipeline
- **Status**: [OPEN]
- **Issue**: 登录新数据库后仍进入旧 pipeline URL，页面显示 `AIGC pipeline not found`；期望进入新库中的有效工作区或可恢复页面。
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-new-db-stale-pipeline.ndjson`

## Reproduction Steps
1. 将后端数据库切换到空的 `ad-creativity-dev`。
2. 初始化并登录管理员账号。
3. 浏览器访问旧地址 `/workspace/aigc/pipelines/df05c59f-9711-4577-98d3-f5b170ba8b6e`。
4. 页面显示 `AIGC pipeline not found`。
5. 修复旧 URL 跳转后，在新画布上传视频。
6. 前端提示后端服务器不可用。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | URL 中保留旧库 pipeline ID，新库无对应数据 | High | Low | Confirmed: pre-fix lines 3-4 show the old ID returning authenticated 404 |
| B | 前端收到 404 后只显示错误，没有恢复导航 | High | Low | Confirmed: screenshot and route catch branch render the API message |
| C | 新库为空时没有默认 pipeline 可供跳转 | Medium | Low | Confirmed: database count is 0 |
| D | 登录 Cookie 状态不稳定导致后续请求 401 | Medium | Low | Rejected as primary cause: pre-fix lines 3-4 reproduce with a valid session |
| E | 视频内容上传或对象存储操作在 30 秒处超时 | High | Low | Confirmed at proxy layer: Next defaults rewrite proxy timeout to 30000 ms |
| F | 新库缺少上传所需的数据关联 | Medium | Low | Rejected: backend route body parsing never completed |
| G | 前端将结构化后端错误错误映射为网络不可用 | Medium | Low | Confirmed as secondary: browser receives unstructured 500 from proxy |
| H | 文件格式或媒体校验失败 | Low | Low | Rejected: route entry/inspection logs are absent |

## Log Evidence
- Backend request IDs `f6b0920c-...` and `08531300-...` returned 404 for the old pipeline immediately after a successful login.
- Screenshot URL contains the old pipeline ID and renders `AIGC pipeline not found`.
- Instrumentation added to the pipeline route for route entry, successful load, and API error status/code.
- `.dbg/trae-debug-log-new-db-stale-pipeline.ndjson:3-4` records the authenticated request and `404/not_found`.
- New database contains zero AIGC pipelines.
- Changed symptom: upload request `044d6d27-...` to `/api/aigc/assets/videos`
  returned 400 after 30034 ms while backend health remained 200.
- Upload instrumentation added at browser start/error and backend body-received,
  inspection-complete, normalization-complete, storage-start/complete, and
  exception boundaries.
- Upload pre-fix lines 1-6 show a 17,928,330-byte MP4 failing three times after
  about 30 seconds with an unstructured 500.
- Backend request durations are 30037-30054 ms and return 400; the route-entry
  event is absent, proving failure occurs while the proxy is still forwarding
  the request body.
- Installed Next.js proxy implementation defaults `proxyTimeout` to 30000 ms.
- Next development log reports the 17.9 MB request exceeded the default 10 MB
  proxy body clone limit.

## Verification Conclusion
Root cause confirmed: database switching intentionally removed the old pipeline,
but the route treats a missing pipeline as a terminal full-screen error instead
of recovering to the pipeline list.

Minimal fix:
- Redirect only pipeline `404` responses to `/workspace/aigc?view=pipelines`.
- Preserve the existing error view for authentication and service failures.
- Add a focused route regression test.

Post-fix evidence:
- `.dbg/trae-debug-log-new-db-stale-pipeline.ndjson:7-14` records the stale
  pipeline `404` during browser verification.
- Playwright ends at `/workspace/aigc?view=pipelines` and finds no
  `AIGC pipeline not found` text.
- `.dbg/trae-debug-log-new-db-stale-pipeline.ndjson:1-2,5-6` shows a valid
  new-database pipeline loads successfully.
- Vitest: 1 passed; TypeScript, ESLint, and diff checks passed.

Upload fix:
- Set Next.js `proxyClientMaxBodySize` to `200mb`, matching the backend video
  size limit.
- Set rewrite `proxyTimeout` to 900 seconds.
- Accept standard `24000/1001` (23.976 FPS) video while retaining rejection
  below 23.976 FPS.

Upload post-fix evidence:
- The same 17,928,330-byte MP4 reached the backend route
  (`trae-debug-log-new-db-stale-pipeline.ndjson:1`).
- Upload through `http://localhost:3000/api/aigc/assets/videos` returned 201.
- Created asset `70e5517b-6ff2-4d0a-8602-4b442d8f81ed` with status `succeeded`.
- Next config tests: 3 passed; media/subtitle tests: 19 passed; frontend
  TypeScript and ESLint passed.

Asset selection follow-up:
- Screenshot shows the uploaded asset disabled with
  `视频帧率需为 24-60 FPS`.
- Backend metadata reports the standard film frame rate `24000/1001`
  (approximately 23.976 FPS).
- Frontend compatibility validation used the stale 24 FPS lower bound.
- Frontend lower bound and helper text now match the backend at 23.976 FPS.
- Media validation, Next config, and route tests: 9 passed; TypeScript and
  ESLint passed.
