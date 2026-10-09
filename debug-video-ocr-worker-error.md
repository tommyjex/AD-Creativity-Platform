# Debug Session: video-ocr-worker-error
- **Status**: [OPEN]
- **Issue**: `video_subtitle_extraction-8c81e702-a2a6-43e9-9970-78212dad4a16` 在 Attempt #1 启动后立即以 `worker_error` / `worker` 失败，耗时 0 ms；期望进入视频 OCR 执行流程并生成 SRT。
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-video-ocr-worker-error.ndjson`

## Reproduction Steps
1. 登录本地工作区并打开包含“视频识别字幕”节点的 AIGC 画布。
2. 为节点连接有效视频输入。
3. 执行节点。
4. 观察任务在 Attempt #1 立即失败并显示 `AIGC worker failed`。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Worker 仍运行旧代码，未加载新增任务类型或执行分支 | High | Low | Confirmed：本地实例连续无法取得租约，数据库租约由另一 owner 持续续期 |
| B | Worker 分发映射遗漏 `VIDEO_SUBTITLE_EXTRACTION` | High | Low | Rejected：Executor 与 Gateway 均存在该任务类型分支 |
| C | OCR Gateway 或 MediaKit 客户端依赖构造失败 | Medium | Low | Confirmed：pre-fix 日志显示 `ocrFactoryCallable=false`、类型为 `Depends` |
| D | 任务快照缺失必要输入或参数 | Medium | Medium | Rejected by persisted evidence：`mode`、`input_asset_id` 与 1 个上游引用均存在 |

## Log Evidence
Instrumentation added to `backend/app/services/aigc_executor.py`:
- Task claim: type, parameter keys, upstream count.
- Before and after Gateway dispatch.
- Worker exception: exception type, bounded message, and final traceback frames.

Persisted Attempt evidence:
- Database task ID: `b6474857-42c3-4180-a212-fdf7f997e7a0`
- Run ID: `8dd55d1d-f608-40fa-9871-1c25deeeea51`
- Type: `video_subtitle_extraction`
- Params: `mode=Subtitle`, `input_asset_id=f6b0ff92-9d11-4871-b46b-e1b88865c4ee`
- Upstream references: 1
- Started and failed within the same second at `2026-10-08 05:48:26+00:00`

Pre-fix runtime evidence:
- `.dbg/trae-debug-log-video-ocr-worker-error.ndjson:1-20` shows local owner
  `aigc-worker-b6138f52-e861-4408-9156-c5cf58ed35eb` repeatedly failed to
  acquire the lease.
- The same entries show `ocrFactoryCallable=false` and
  `ocrFactoryType=Depends`.
- Database lease owner `aigc-worker-3f9a1e83-d1f7-48e2-afc2-0d281fcc6342`
  continued heartbeating while only one local Uvicorn process existed.
- No local dequeue/claim/Gateway event was emitted for the reproduced run;
  another instance consumed and failed the task.

## Verification Conclusion
Minimal fix: explicitly resolve and pass `get_video_ocr_client_factory` from
the application lifespan into `get_aigc_pipeline_runtime`. Regression coverage
asserts that the runtime stores a callable factory and can create the expected
client.

Post-fix evidence:
- `.dbg/trae-debug-log-video-ocr-worker-error.ndjson:8-24` shows
  `ocrFactoryCallable=true` and `ocrFactoryType=type`.
- The focused lifecycle and subtitle contract suite passes: 9 tests.
- Ruff and `git diff --check` pass.
- The local runtime still reports `acquired=false`; `.env` uses a remote
  database and external owner
  `aigc-worker-3f9a1e83-d1f7-48e2-afc2-0d281fcc6342` continues renewing the
  global worker lease. The external worker must receive the fix or relinquish
  the lease before the local process can execute queued AIGC tasks.
