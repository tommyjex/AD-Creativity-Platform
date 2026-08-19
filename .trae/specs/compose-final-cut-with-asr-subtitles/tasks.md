# Tasks

- [x] Task 1: 扩展配置、任务模型与资产类型，支撑 MediaKit ASR 与进度节点。
  - [x] SubTask 1.1: 在 `backend/app/core/config.py` 新增 `mediakit_api_key`、`mediakit_base_url`、`mediakit_asr_poll_interval_seconds`、`mediakit_asr_timeout_seconds`、可选 `mediakit_asr_language`，并在 `from_env` 读取环境变量；新增 `require_mediakit_config`。
  - [x] SubTask 1.2: 在 `backend/app/schemas/task.py` 的 `GenerationTaskBase` 增加可空 `progress_message: str | None`。
  - [x] SubTask 1.3: 在 `backend/app/schemas/enums.py` 的 `AssetType` 增加 `SUBTITLE = "subtitle"`；在 `frontend/lib/api-types.ts` 的 `ASSET_TYPES` 同步增加 `"subtitle"`。
  - [x] SubTask 1.4: 在 `mysql.py` 与 `memory.py` 的任务 ORM/模型与 `update_task` 中支持持久化并返回 `progress_message`（含数据库列/映射）。

- [x] Task 2: 实现 MediaKit ASR 客户端（真实 + mock）。
  - [x] SubTask 2.1: 新建 `backend/app/services/mediakit.py`，定义 `SubtitleSegment`（start/end/text/可选 speaker）、`AsrSubtitleClient` Protocol，及脱敏异常 `MediaKitAsrError`。
  - [x] SubTask 2.2: 实现真实客户端：`POST /api/v1/tools/asr-subtitles` 提交、`GET /api/v1/tasks/{task_id}` 轮询到 `completed`，解析 `result.subtitles`，处理 `failed`/超时/非 2xx 并脱敏。
  - [x] SubTask 2.3: 实现 mock 客户端返回确定性字幕；新增工厂 `get_asr_subtitle_client()`：配置齐全用真实，否则用 mock。

- [x] Task 3: 实现 SRT 转换与 ffmpeg 字幕压制。
  - [x] SubTask 3.1: 新建 `backend/app/services/subtitles.py`，实现 `segments_to_srt(segments)`：递增序号、`HH:MM:SS,mmm` 时间轴、空列表返回空串。
  - [x] SubTask 3.2: 在 `backend/app/services/composer.py` 拆分：保留基础拼接为 `compose`（或 `compose_base`），新增 `burn_subtitles(base_video_bytes, srt_text, brief)`，用 `subtitles` 滤镜 + `force_style`（底部安全区、白字黑描边、最多两行），空 SRT 直接返回原视频，失败脱敏抛错。

- [x] Task 4: 后端 compose 后台化与工作流进度更新。
  - [x] SubTask 4.1: 在 `workflow.py` 新增 `update_task_progress(task_id, progress, message)` 持久化进度与文案。
  - [x] SubTask 4.2: 在 `dependencies.py` 新增 `get_asr_subtitle_client` 依赖（复用已有 `get_background_task_runner`、`get_composer_service`）。
  - [x] SubTask 4.3: 在 `routes.py` 改造 `compose_video`：校验依赖、创建并 `start_task` 后立即返回 `RUNNING`，用 `BackgroundTaskRunner.schedule` 调度编排协程（参考 `submit_character_asset_iteration` 模板）。
  - [x] SubTask 4.4: 实现编排协程：拼接基础成片 → 上传/取得 ASR 可访问 URL → 提交并轮询 ASR → `segments_to_srt` → 压制 → 上传 `final_video` 与 `subtitle` 资产 → `complete_task`；每节点调用 `update_task_progress` 写入文案；空字幕跳过压制；异常走 `fail_task` 脱敏。

- [x] Task 5: 删除视频提示词中的字幕指令并同步校验与优化器。
  - [x] SubTask 5.1: 在 `video_prompt.py`：`_PROMPT_HEADERS` 将 `【语音与字幕】` 改为 `【语音】`；删除 per-shot `字幕：...` 行；`【语音】` 段只保留语音表述；无旁白分支删除"不显示字幕"字样；`【负向约束】` 删除字幕相关表述；同步 `extract_timeline_ranges` 的 `next_marker`。
  - [x] SubTask 5.2: 在 `video_prompt.py` 更新 `validate_optimized_video_prompt`：章节顺序用新名，移除字幕子串强校验，仅按需保留语音校验。
  - [x] SubTask 5.3: 在 `modelark.py` 的 `build_video_prompt_optimization_messages` 更新章节名与规则：去掉字幕要求，保留语音要求。

- [x] Task 6: 前端类型、API client 与 ComposePanel 节点状态轮询。
  - [x] SubTask 6.1: 在 `frontend/lib/api-types.ts` 的 `GenerationTask` 增加可空 `progress_message`。
  - [x] SubTask 6.2: 在 `project-detail-tabs.tsx` 的 `StageGenerateButton`/`ComposePanel`：提交后捕获任务 ID，每 2500ms 轮询 `getTask`，展示 `progress_message` 节点文案，`succeeded` 刷新项目、`failed` 展示脱敏错误，进行中禁用按钮。

- [x] Task 7: 自动化测试与验证。
  - [x] SubTask 7.1: 后端测试 MediaKit 客户端提交/轮询/失败/未配置回退 mock；`segments_to_srt` 常规与空列表。
  - [x] SubTask 7.2: 后端测试 compose 编排：带字幕全流程产出 `final_video`+`subtitle` 且节点文案推进；空字幕跳过压制；ASR/压制失败任务 `failed` 无残缺资产；依赖缺失不建后台任务。
  - [x] SubTask 7.3: 后端测试 `video_prompt` 单/合并分镜不含字幕指令、含 `【语音】` 且校验通过；优化器输出经更新后的校验。
  - [x] SubTask 7.4: 前端测试 ComposePanel 轮询展示节点文案、成功刷新、失败提示；api-types/序列化含 `progress_message`。
  - [x] SubTask 7.5: 使用项目根目录 `.venv` 运行后端全量测试；运行前端 Vitest 与 TypeScript 类型检查。

# Task Dependencies

- Task 2 depends on Task 1。
- Task 3 depends on Task 1。
- Task 4 depends on Task 1、Task 2 and Task 3。
- Task 6 depends on Task 1 and Task 4。
- Task 5 可与 Task 2/3/4 并行（仅依赖对 `video_prompt`/`modelark` 的理解）。
- Task 7 depends on Task 4、Task 5 and Task 6。
