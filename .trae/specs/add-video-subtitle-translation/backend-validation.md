# Backend Implementation Evidence

Date: 2026-10-26. Scope: tasks 1, 3, 4, 6 and task 10 backend.
All providers/storage are mocked. No paid calls were made.

## Implemented

- Persistent independent workspace, revisions/history and atomic stage-task updates
  for memory and SQL repositories. Additive table/type migration; existing
  `init_database` creates the table and upgrades persistence-version/type capacity.
- Precision invalidation, immutable original text/IDs, idempotent submission/retry,
  stale completion isolation and preservation of manual translations while an
  unaffected in-flight translation finishes.
- Authenticated CRUD/stage/query/retry integration. Generic ToolTask creation cannot
  fabricate managed subtitle stages. Viewer/anonymous mutations deny before IO.
- Secure 512 MiB streamed URL imports/local raw-byte uploads, public tool-video
  visibility validation, reference duration at 600s, ffprobe display rotation,
  FPS/audio metadata, temporary-file and partial-object cleanup.
- Stable-ID Seed batches with visual-block/adjacent context, TLS-only model raw text,
  reordered/duplicate/unknown/truncated response handling, successful partial
  persistence and missing-only retries/manual completion.
- Frozen MediaKit render, stable submit token, saved provider ID, recoverable
  polling/transfer retries, fresh submission only after provider failure, atomic
  output deduplication and stale historical results.
- Startup recovery and shutdown cleanup. Failed output inserts delete uploaded
  objects; durable outputs survive workspace-link failure and are reused. Upload
  cancellation waits for blocking storage IO before cleanup.
- Task 10: detail GET/PATCH and independent POST `/{id}/preview` return actual
  compiler font measurements in worker threads without creating tasks or modifying
  preview revisions/history. Missing translations and font/layout failures return
  editable drafts, null unavailable sizes and safe warnings.
- Measured responses include exact `font_type` URL and `font_sha256`. Measurements
  cannot masquerade as draft edits or invalidate a current render. CAPACITY_NOTICE
  appears before rendering and survives capacity errors in message/failure_reason.

## Verification

- Targeted workspace/media/execution/routes/preview/adapter and independent acceptance:
  **139 passed** before final font-field assertions.
- Final combined targeted + layout/tool assets/video/MediaKit/database/RBAC/auth/
  logging/grounding run: **548 passed, 1 skipped, 1 deselected**.
  The skip is the explicitly disabled paid smoke. The deselection is documented
  below, not a claim of all backend tests passing.
- Default Ruff passes the owned schema/service/repository/API/test modules.
- Whole backend app/tests Ruff fatal selection `E9,F63,F7,F82` passes.
- Python `compileall` and `git diff --check` pass.
- Real FreeType/Pillow measurement uses deterministic OFL fixture font HTTP; tests
  verify worker-thread execution, actual fitting, unsaved preview, revision conflict,
  partial measurement/fallback and provider non-use.
- SQL coverage uses `MySQLRepository` against SQLite fixtures. Live MySQL multi-worker
  locking/deployment, real 512 MiB HTTP transfer and real cloud storage were not run.

Reproduce the final combined run from the repository root:

```sh
PYTHONPATH="$PWD" RUN_PAID_MODELARK_SMOKE=false .venv/bin/python -m pytest \
  backend/tests/test_subtitle_translation_*.py \
  backend/tests/test_modelark_subtitle_translation.py \
  backend/tests/test_tool_video_routes.py backend/tests/test_tool_assets.py \
  backend/tests/test_mediakit_multitrack.py backend/tests/test_database.py \
  backend/tests/test_role_permissions.py backend/tests/test_auth_api.py \
  backend/tests/test_structured_logging.py \
  backend/tests/test_modelark_video_subtitle_grounding.py \
  backend/tests/test_video_subtitle_grounding_contract.py \
  backend/tests/test_video_subtitle_grounding_media.py \
  backend/tests/test_video_subtitle_grounding_service.py \
  backend/tests/test_video_subtitle_grounding_validation.py \
  backend/tests/test_paid_modelark_video_subtitle_grounding_smoke.py \
  -k 'not business_code_has_no_local_debug_reporting_dependencies' -q --tb=short
```

## Integration Limits

- An earlier unfiltered related run was **406 passed, 1 failed**:
  `test_business_code_has_no_local_debug_reporting_dependencies` finds existing
  `127.0.0.1:7777/event` reporting in `backend/app/services/aigc_gateway.py`.
  This file is outside this agent's assigned ownership and was not edited. The
  global logging guard must pass before system acceptance; do not hide this failure.
- Task 9 owns the frontend 200mb proxy bottleneck/debug URL reporting. Backend
  accepts 512 MiB only on the dedicated route; production Nginx already permits 2g.
  End-to-end upload capacity remains unchecked until frontend verification.
- Frontend font resource must match backend pinned CN/JP file, not the former SC
  variant. Response font metadata and `api-contract.md` support that integration.
- Task 10's browser display/readable-warning acceptance remains frontend/acceptance
  ownership. Backend measurements and degraded responses are covered offline.
- Actual Seed translation/background quality, MediaKit capacity/vertical glyph
  anchor/literal interpretation and real final renders remain unverified.

## 任务 11 前两项修复证据

日期：2026-10-26。此节更新 gateway 日志守卫状态；上文排除守卫的运行仅为历史
记录，不作为最终验证命令或全量通过证据。任务 11 第三项仍待最终验证代理执行。

- 产品代码仅修改 `backend/app/services/aigc_gateway.py`：删除四处本地 7777 HTTP
  上报、专用 `time`/`urllib.request` 导入及仅为上报包裹的验证异常处理。
  保留参数验证、模型白名单、资产检查、输入关联、生成/持久化及原有结构化日志。
  ModelArk 的既有 `emit_tls_only_event` 原文通道未改动。
- 当前实际守卫为
  `backend/tests/test_structured_logging.py::test_business_code_has_no_local_debug_reporting_dependencies`；
  当前测试树不存在 `test_aigc_gateway_uses_tls_debug_logger_without_local_http_dependency`。
  修复前同一离线入口复现 `1 failed, 10 passed`，唯一失败指向 gateway。
  初始化清理测试修复前本轮已通过，不改动 `main.py` 或清理逻辑。
- 修复后下述六模块完整运行：`198 passed, 1 warning`，无 `-k`、无排除或跳过。
  包含 gateway 全部测试、structured logging 全部守卫及
  `test_subtitle_initialization_failure_closes_started_runtime_and_tls`。
  清理断言为 `runtime.stop`、TLS `aclose`、detach 各一次。
- 另行运行既有三组 ModelArk TLS 日志测试（含参数化）：`6 passed, 1 warning`，
  验证 TLS 私有原文/验证证据及 stdout 隔离。两轮均
  `paid_smoke_enabled=false`、`tcp_connections_allowed=0`、`blocked_tcp_attempts=0`。
  未改写或削弱测试；无需额外修正测试预期。
- 全 backend Ruff 致命检查 `E9,F63,F7,F82`、app/tests 编译及 `git diff --check`
  通过。额外 gateway 默认 Ruff 不通过：27 项均为既存问题，HEAD 基线为 39 项；
  此范围不做无关 import 排序、异常处理或未使用变量清理。
- 未触碰前端、未回滚其他未提交改动、未调用计费服务，未打印模型原文或凭据。
  不据定向通过宣称全量后端或最终系统验收通过。

根目录复现（离线 TCP 闸门，无排除失败用例）：

```sh
PYTHONPATH=.:backend .venv/bin/python scripts/verify-subtitle-translation-offline.py \
  backend/tests/test_aigc_gateway.py backend/tests/test_structured_logging.py \
  backend/tests/test_main.py backend/tests/test_subtitle_translation_acceptance.py \
  backend/tests/test_modelark_subtitle_translation.py \
  backend/tests/test_modelark_video_subtitle_grounding.py -q --tb=no
PYTHONPATH=.:backend .venv/bin/python scripts/verify-subtitle-translation-offline.py \
  backend/tests/test_modelark.py::test_text_response_validation_tls_records_stage_and_safe_schema_summary \
  backend/tests/test_modelark.py::test_stream_text_response_validation_tls_records_json_location \
  backend/tests/test_modelark.py::test_storyboard_business_validation_tls_records_private_raw_output \
  -q --tb=no
.venv/bin/ruff check backend --select E9,F63,F7,F82
.venv/bin/python -m compileall -q backend/app backend/tests
git diff --check
```

## 本次最终全量

2026-10-26，日志修复后的无排除全量：`2174 passed, 1 skipped, 42 warnings`
（153.20秒，退出码0）。唯一skip为禁用计费冒烟；没有deselected或日志守卫排除。
`paid_smoke_enabled=false`、`tcp_connections_allowed=0`、`blocked_tcp_attempts=0`。
全backend Ruff致命检查、app/tests编译、diff检查通过。历史排除命令不再是最终入口。

```sh
PYTHONPATH=.:backend .venv/bin/python scripts/verify-subtitle-translation-offline.py backend/tests -q --tb=short
```

不重复已覆盖的198+6定向测试。任务7/9/10已交接，前端独立全量1021及三视口
6个Mock场景通过，任务11第三项已完成。任务8整体还受第32项供应商契约缺口约束。
最新系统结论见 `final-validation.md`；上文待修复/待交接措辞均为历史记录。
