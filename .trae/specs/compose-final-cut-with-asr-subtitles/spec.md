# 剪辑成片接入 MediaKit ASR 字幕 Spec

## Why

当前字幕依赖 Seedance 视频模型直出，受模型能力限制经常出现字体崩坏、乱码，成片质量差。改为在"生成剪辑成片"阶段，用火山引擎 AI MediaKit 的语音转字幕（ASR）服务，把成片语音识别为带时间戳文本，转换成标准 SRT，再用 ffmpeg 压制到视频中，得到稳定、清晰、可读的字幕。同时不再要求视频模型自己烧录字幕。

## What Changes

- 剪辑成片流程升级为：拼接基础成片 → 提交 MediaKit ASR 任务 → 轮询获取带时间戳字幕 JSON → 转换为 SRT → ffmpeg 压制字幕 → 生成最终成片。
- 用户点击"生成剪辑成片 / 重新剪辑成片"时触发该流程，并在界面上按节点回显状态（如"视频字幕提取中""字幕 SRT 文件提取完成""剪辑完成"）。
- compose 阶段由当前同步阻塞执行，改为后台执行 + 前端轮询任务状态（复用 `BackgroundTaskRunner`），使多节点状态可回显。
- `GenerationTask` 增加可空 `progress_message` 字段，用于承载当前节点文案。
- 新增 MediaKit ASR 客户端（真实 HTTP + mock），真实客户端使用 MediaKit API Key（Bearer 鉴权），未配置时回退 mock，保证本地开发与测试可运行。
- 新增字幕 JSON→SRT 转换与 ffmpeg 字幕压制能力；字幕位于底部安全区、白字黑描边、最多两行。
- SRT 作为独立字幕资产随成片一起保存，便于查看与复用。
- 视频语音为空（无旁白）时，ASR 返回空字幕，跳过压制，直接产出基础成片。
- **BREAKING**：从视频生成提示词中删除"烧录/显示字幕"指令（保留语音/旁白指令，因为 ASR 依赖成片中的语音）。`【语音与字幕】` 章节重命名为 `【语音】`，相关校验同步更新。
- 新增配置：`MEDIAKIT_API_KEY`、`MEDIAKIT_BASE_URL`、`MEDIAKIT_ASR_POLL_INTERVAL_SECONDS`、`MEDIAKIT_ASR_TIMEOUT_SECONDS`、可选 `MEDIAKIT_ASR_LANGUAGE`。

## Impact

- Affected specs:
  - 剪辑成片（Compose）能力
  - Seedance 视频提示词构建与校验
  - ModelArk 提示词优化器
  - 异步任务与前端轮询
- Affected code:
  - `backend/app/core/config.py`
  - `backend/app/services/mediakit.py`（新增 ASR 客户端）
  - `backend/app/services/subtitles.py`（新增 SRT 转换）
  - `backend/app/services/composer.py`（拆分基础拼接与字幕压制）
  - `backend/app/services/workflow.py`（任务进度节点更新）
  - `backend/app/schemas/task.py`（`progress_message`）
  - `backend/app/schemas/enums.py`（新增 `SUBTITLE` 资产类型）
  - `backend/app/repositories/mysql.py`、`backend/app/repositories/memory.py`（任务 ORM/更新）
  - `backend/app/api/dependencies.py`、`backend/app/api/routes.py`（compose 后台化与编排）
  - `backend/app/video_prompt.py`（删除字幕指令、章节重命名、校验更新）
  - `backend/app/services/modelark.py`（优化器 system prompt 更新）
  - `frontend/lib/api-types.ts`、`frontend/lib/api-client.ts`
  - `frontend/components/workspace/project-detail-tabs.tsx`（ComposePanel 节点状态与轮询）
  - 后端与前端相关测试

## ADDED Requirements

### Requirement: MediaKit ASR 客户端

系统 SHALL 提供 MediaKit 语音转字幕客户端，封装异步"提交任务 + 轮询结果"两步调用。

- 提交：`POST {base}/api/v1/tools/asr-subtitles`，`Authorization: Bearer {MEDIAKIT_API_KEY}`，请求体至少包含 `video_url`，可选 `language`、`enable_speaker_info`。
- 查询：`GET {base}/api/v1/tasks/{task_id}`，轮询直至 `status == "completed"`，或 `failed`/超时。
- 解析 `result.subtitles[]`，每项含 `start_time`（秒）、`end_time`（秒）、`subtitle_text`，可选 `speaker`。
- 真实客户端与 mock 客户端 SHALL 使用相同的返回契约（有序字幕片段列表）。
- 未配置 `MEDIAKIT_API_KEY` 时使用 mock 客户端，返回确定性字幕，不发起网络请求。

#### Scenario: 提交并轮询成功

- **WHEN** 传入可访问的成片 URL 且服务可用
- **THEN** 客户端提交任务并轮询到 `completed`
- **AND** 返回按时间排序的字幕片段列表

#### Scenario: 任务失败或超时

- **WHEN** MediaKit 返回 `failed`、非 2xx 或轮询超时
- **THEN** 客户端抛出脱敏错误（不含 API Key、原始供应商响应体或签名 URL）

#### Scenario: 未配置 API Key

- **WHEN** `MEDIAKIT_API_KEY` 未设置
- **THEN** 使用 mock 客户端返回确定性字幕
- **AND** 不发起任何 MediaKit 网络请求

### Requirement: 字幕 JSON 转 SRT

系统 SHALL 将 ASR 字幕片段转换为标准 SRT 文本。

- 每个片段生成递增序号、`HH:MM:SS,mmm --> HH:MM:SS,mmm` 时间轴、字幕文本。
- 时间戳以毫秒精度格式化，起点小于终点；相邻片段时间可相接但不得重叠交换顺序。
- 字幕列表为空时返回空字符串，调用方据此跳过压制。
- 默认不注入说话人前缀（未开启 `enable_speaker_info`）。

#### Scenario: 常规字幕转换

- **WHEN** 传入非空字幕片段
- **THEN** 输出合法 SRT，序号从 1 递增，时间戳格式正确

#### Scenario: 空字幕

- **WHEN** 字幕片段为空
- **THEN** 返回空字符串

### Requirement: ffmpeg 字幕压制

系统 SHALL 在拼接出的基础成片上，用 ffmpeg 将 SRT 压制为硬字幕。

- 使用 `subtitles` 滤镜，`force_style` 设置底部安全区对齐、白字、黑色描边、字号适配移动端、最多两行显示。
- 保留原始音轨。
- SRT 为空时跳过压制，直接返回基础成片。
- 压制失败或超时抛出脱敏的合成错误。

#### Scenario: 有字幕压制

- **WHEN** 存在非空 SRT
- **THEN** 输出带硬字幕的 MP4，字幕位于底部安全区、白字黑描边

#### Scenario: 无字幕跳过

- **WHEN** SRT 为空
- **THEN** 直接返回未叠加字幕的基础成片

### Requirement: 剪辑成片 ASR 字幕编排

系统 SHALL 编排完整成片流程，并在每个节点更新任务进度文案。

流程与节点文案：

1. 拼接基础成片 —— `progress_message="正在合成基础视频"`。
2. 准备可供 ASR 访问的成片来源 —— `progress_message="视频字幕提取中"`。
3. 提交 ASR 任务并轮询完成，转换为 SRT —— `progress_message="字幕 SRT 文件提取完成"`。
4. ffmpeg 压制字幕 —— `progress_message="字幕压制中"`。
5. 上传最终成片（及 SRT 字幕资产），完成 —— `progress_message="剪辑完成"`。

- 最终成片 SHALL 作为 `type=final_video`、`stage=compose`、`status=succeeded` 资产存储，`latestFinalVideoAsset` 可正确识别。
- SRT SHALL 作为 `type=subtitle`、`stage=compose` 资产存储，metadata 关联成片。
- 无语音（字幕为空）时流程 SHALL 成功产出基础成片，`progress_message` 说明已跳过字幕。
- 任一节点失败 SHALL 通过 `workflow.fail_task` 记录脱敏错误，不产出残缺成片。

#### Scenario: 完整成片带字幕

- **WHEN** 分镜视频存在语音且服务可用
- **THEN** 依次经过全部节点，最终产出带硬字幕成片
- **AND** 任务终态 `succeeded`，`progress=1.0`，`progress_message="剪辑完成"`
- **AND** 生成 `final_video` 与 `subtitle` 两类资产

#### Scenario: 无语音成片

- **WHEN** ASR 返回空字幕
- **THEN** 跳过字幕压制，产出基础成片
- **AND** 任务 `succeeded`，`progress_message` 说明已跳过字幕

#### Scenario: 字幕服务失败

- **WHEN** ASR 或 ffmpeg 压制失败
- **THEN** 任务 `failed` 且携带脱敏错误
- **AND** 不产出最终成片资产

### Requirement: compose 阶段后台执行与任务进度节点

系统 SHALL 将 compose 阶段改为后台执行，并支持进度节点文案回显。

- `POST /api/projects/{project_id}/compose` SHALL 校验 `Stage.COMPOSE` 依赖（存在成功的 video 资产），创建并启动任务后立即返回 `RUNNING` 任务，实际编排交由 `BackgroundTaskRunner` 执行。
- `GenerationTask` SHALL 新增可空字段 `progress_message`，随任务状态一并持久化并由 `GET /api/tasks/{task_id}` 返回。
- `WorkflowService` SHALL 提供更新任务进度与文案的方法（如 `update_task_progress`）。

#### Scenario: 提交后立即返回运行中任务

- **WHEN** 依赖满足且用户触发 compose
- **THEN** 接口返回 `status=running` 的任务
- **AND** 后台协程继续执行成片编排

#### Scenario: 依赖缺失

- **WHEN** 不存在成功的分镜视频资产
- **THEN** 返回依赖缺失错误，不创建后台任务

#### Scenario: 轮询可见节点文案

- **WHEN** 前端轮询 `GET /api/tasks/{task_id}`
- **THEN** 返回体包含当前 `progress` 与 `progress_message`

### Requirement: 前端剪辑成片节点状态展示

系统 SHALL 在剪辑成片面板展示成片进度节点，并在完成后刷新成片。

- 用户点击"生成剪辑成片 / 重新剪辑成片"后，前端 SHALL 捕获返回任务 ID 并每 2500ms 轮询 `getTask`。
- 轮询期间 SHALL 展示 `progress_message` 作为节点状态；无文案时展示通用"处理中"。
- 任务进入 `succeeded` SHALL 刷新项目并展示最终成片；进入 `failed` SHALL 展示脱敏错误。
- 生成按钮在任务进行中 SHALL 禁用，避免并发触发。

#### Scenario: 展示节点进度

- **WHEN** compose 任务处于 `running`
- **THEN** 面板显示当前节点文案（如"视频字幕提取中"）

#### Scenario: 成片完成刷新

- **WHEN** compose 任务 `succeeded`
- **THEN** 面板刷新并显示带字幕的最终成片

#### Scenario: 成片失败提示

- **WHEN** compose 任务 `failed`
- **THEN** 面板显示可理解且脱敏的错误

## MODIFIED Requirements

### Requirement: 视频提示词规范

视频生成提示词 SHALL 保留语音/旁白要求，但 SHALL NOT 再指示模型显示或烧录字幕。

- 原 `【语音与字幕】` 章节重命名为 `【语音】`。
- 有旁白时仅要求生成自然、清晰的普通话语音，不再要求同步字幕、简体中文字幕、底部安全区、白字黑描边、最多两行等字幕表述。
- 无旁白时仅保留环境音与动作音表述，删除"不显示字幕"等字幕表述。
- `【负向约束】` 删除"字幕乱码/字幕遮挡主体"等字幕相关表述。
- `_PROMPT_HEADERS`、时间轴区间解析（`extract_timeline_ranges` 的章节标记）、`validate_optimized_video_prompt` 的章节顺序与语音校验 SHALL 与新章节名一致。
- 校验器 SHALL NOT 再强制字幕相关子串；有旁白时可保留对语音表述的校验。

### Requirement: ModelArk 提示词优化器

AI 优化器 system prompt SHALL 与新的视频提示词规范一致：要求依次且仅一次包含 `【整体要求】`、`【连续时间轴】`、`【语音】`、`【负向约束】`；有旁白时要求自然清晰普通话语音，SHALL NOT 再要求生成同步简体中文字幕；无旁白时仅保留环境音与动作音。

## REMOVED Requirements

### Requirement: 视频模型烧录字幕

**Reason**: 模型直出字幕质量差，改由 MediaKit ASR + ffmpeg 生成硬字幕。

**Migration**: 提示词不再要求字幕；字幕在剪辑成片阶段基于成片语音生成并压制；历史成片如需字幕可重新执行剪辑成片。
