# AIGC 视频画质增强节点 Spec

## Why

当前 AIGC 画布可以生成、输入和输出视频，但无法在工作流中继续提升视频分辨率、流畅度、清晰度和色彩表现。需要接入 AI MediaKit 画质增强异步 API，使生成视频或上传视频可在同一 DAG 中完成增强、持久化和下游复用。

## What Changes

- 新增可执行节点 `video_enhancement`，接收一个 `video_asset`，输出一个增强后的 `video_asset`。
- 接入 AI MediaKit `POST /api/v1/tools/enhance-video` 和 `GET /api/v1/tasks/{task_id}`。
- 支持标准版与专业版、场景、增强风格、输出尺寸、帧率、码率和专业版色深配置。
- 默认配置为 `standard + aigc + hd + 1080p + 保持原帧率 + medium + 8-bit`，高成本配置必须由用户显式选择。
- 将供应商临时结果及时转存至现有对象存储，保存为可追溯的 AIGC 输出资产。
- 接入现有 Run、Task Attempt、缓存、重试、取消、运行日志和视频输出节点。
- 复用已配置的 `MEDIAKIT_API_KEY`；不新增或展示密钥。
- 自动化测试和浏览器验收使用 Mock，不自动发起计费的真实画质增强任务。

## Impact

- Affected specs: AIGC 节点契约、强类型 DAG、AIGC 执行器、MediaKit 异步任务、视频资产、运行日志、视频结果展示
- Affected code:
  - `backend/app/core/config.py`
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/aigc_dag.py`
  - `backend/app/services/aigc_executor.py`
  - `backend/app/services/aigc_gateway.py`
  - `backend/app/services/mediakit_video_enhancement.py`
  - `backend/app/services/assets.py`
  - `backend/app/api/dependencies.py`
  - `frontend/lib/aigc/types.ts`
  - `frontend/lib/aigc/node-registry.ts`
  - `frontend/lib/aigc/editor-store.ts`
  - `frontend/lib/aigc/result-projection.ts`
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - 相关前后端测试

## ADDED Requirements

### Requirement: 视频画质增强节点契约

系统 SHALL 在 AIGC 画布中提供可执行节点 `video_enhancement`，节点具有一个必填 `video` 输入端口和一个 `video` 输出端口，端口类型均为 `video_asset`。

#### Scenario: 添加并连接节点

- **WHEN** 用户从节点面板添加“视频画质增强”节点
- **THEN** 节点以视频模态配色显示
- **AND** 节点可接收视频输入、生视频或其他视频画质增强节点输出的视频
- **AND** 节点输出可连接视频输出节点或另一个视频画质增强节点
- **AND** 非 `video_asset` 端口连接在前端被拒绝，绕过前端保存时也被后端拒绝

#### Scenario: 输入未连接

- **WHEN** 用户运行未连接 `video` 输入的画质增强节点
- **THEN** 系统在调度阶段拒绝执行
- **AND** 错误明确定位节点和缺失的 `video` 输入
- **AND** 不调用 MediaKit

### Requirement: 画质增强参数配置

系统 SHALL 在节点配置面板提供与 MediaKit API 一致且互斥关系明确的参数，并使用保守默认值。

#### Scenario: 使用默认配置

- **WHEN** 用户新建视频画质增强节点
- **THEN** `tool_version` 默认为 `standard`
- **AND** `scene` 默认为 `aigc`
- **AND** `enhance_style` 默认为 `hd`
- **AND** 输出尺寸模式默认为预设分辨率，`resolution` 默认为 `1080p`
- **AND** `fps` 默认留空以保持原视频帧率
- **AND** 码率模式默认为档位，`bitrate_level` 默认为 `medium`
- **AND** `bit_depth` 默认为 `8`

#### Scenario: 选择标准版

- **WHEN** `tool_version` 为 `standard`
- **THEN** 用户可选择 `common`、`ugc`、`short_series`、`aigc` 或 `old_film`
- **AND** 用户可选择 `hd` 或 `natural`
- **AND** 色深控件不可编辑，提交时不向供应商发送 `bit_depth`

#### Scenario: 选择专业版

- **WHEN** `tool_version` 切换为 `professional`
- **THEN** `scene` 不再生效且提交时不发送该字段
- **AND** 用户可选择 `8`、`10`、`12` 或 `16` bit
- **AND** 用户仍可选择 `hd` 或 `natural`

#### Scenario: 配置输出尺寸

- **WHEN** 用户选择预设分辨率模式
- **THEN** 可选值为 `240p`、`360p`、`480p`、`540p`、`720p`、`1080p`、`2k`、`4k`、`8k`
- **AND** 请求只发送 `resolution`
- **WHEN** 用户选择短边像素模式
- **THEN** `resolution_limit` 必须为 `[128, 4320]` 内的整数
- **AND** 请求只发送 `resolution_limit`
- **AND** 两种尺寸参数不得同时进入任务快照或供应商请求

#### Scenario: 配置帧率和码率

- **WHEN** 用户选择保持原帧率
- **THEN** 请求不发送 `fps`
- **WHEN** 用户指定目标帧率
- **THEN** `fps` 必须位于 `[15, 120]`
- **WHEN** 用户按档位配置码率
- **THEN** 请求只发送 `bitrate_level=low|medium|high`
- **WHEN** 用户指定精确码率
- **THEN** `bitrate` 必须为 `[10, 150000]` 内的整数，单位为 kbps
- **AND** 请求不同时发送 `bitrate_level`

#### Scenario: 配置 16-bit 输出

- **WHEN** 专业版选择 `bit_depth=16`
- **THEN** 输入视频时长必须不超过 40 秒
- **AND** 输出格式按供应商约定为 MOV
- **AND** 请求不发送 `bitrate` 或 `bitrate_level`
- **AND** 输入时长不符合要求时在调用供应商前失败

### Requirement: 输入视频校验与解析

系统 SHALL 在调用供应商前重新校验输入资产状态、类型、可访问性和 MediaKit 输入规格。

#### Scenario: 解析有效输入

- **WHEN** 上游结果包含一个公开、成功且可访问的视频资产
- **THEN** 系统生成受控临时访问 URL
- **AND** 通过媒体探测读取宽度、高度、时长、帧率、容器和 MIME
- **AND** 输入短边必须位于 `[360, 1440]`
- **AND** 输入长边必须位于 `[360, 2560]`
- **AND** 系统记录 `slot=video`、`ordinal=0` 的输入资产引用

#### Scenario: 输入无效

- **WHEN** 输入资产不存在、不可访问、不是成功的公开视频、MIME 不是视频，或分辨率超出 MediaKit 范围
- **THEN** 节点以 `invalid_input` 或 `invalid_media_input` 失败
- **AND** 错误阶段为 `input_resolution`
- **AND** 不向前端暴露签名 URL、对象存储凭证或供应商密钥

### Requirement: MediaKit 异步调用

系统 SHALL 使用现有 `MEDIAKIT_API_KEY` 和 `MEDIAKIT_BASE_URL` 提交、轮询并解析画质增强任务。

#### Scenario: 提交增强任务

- **WHEN** 节点输入与配置校验通过
- **THEN** 系统调用 `POST /api/v1/tools/enhance-video`
- **AND** 使用 `Authorization: Bearer {MEDIAKIT_API_KEY}`
- **AND** 请求包含受控 `video_url` 和当前有效配置
- **AND** 系统使用不超过 64 个可打印 ASCII 字符的稳定 `client_token` 避免同一 Run 节点重复计费
- **AND** 不发送 `callback_url`、`callback_args`、`queue_id` 或 `media_output_destination`
- **AND** 供应商 `task_id` 和安全格式的 `request_id` 被保存在 Task Attempt 可追踪信息中

#### Scenario: 轮询任务

- **WHEN** 提交接口返回 `task_id`
- **THEN** 系统轮询 `GET /api/v1/tasks/{task_id}`
- **AND** `running` 保持节点运行中
- **AND** `completed` 解析 `video_url`、`duration`、`fps`、`resolution` 和 `tool_version`
- **AND** `failed` 映射为脱敏后的 AIGC 任务错误
- **AND** 未知状态、非法响应、网络错误和超时使用明确错误码与阶段

#### Scenario: 任务取消或 Worker 失效

- **WHEN** Run 被取消、Task Attempt 被替换或 Worker 租约失效
- **THEN** 晚到的供应商结果不得覆盖当前状态
- **AND** 已转存但未被接受的输出资产按现有清理策略处理
- **AND** 独立分支继续遵循现有 AIGC 调度语义

### Requirement: 增强结果持久化

系统 SHALL 在 MediaKit 临时下载地址失效前，将增强结果保存为本系统 AIGC 输出资产。

#### Scenario: 转存增强视频

- **WHEN** MediaKit 任务完成并返回 HTTPS `video_url`
- **THEN** 系统以流式方式下载并上传至对象存储，避免将大尺寸视频完整缓存在内存
- **AND** 转存过程使用可配置的超时与最大字节数
- **AND** 输出资产状态为 `succeeded`、角色为 `public`、类型为视频
- **AND** MP4/MOV MIME 和扩展名与实际结果一致
- **AND** 资产关联 pipeline、run、node、task 及输入资产

#### Scenario: 保存增强元数据

- **WHEN** 输出资产创建成功
- **THEN** 元数据包含 `provider=mediakit`、`operation=video_enhancement`、供应商任务 ID、版本、场景、增强风格、输出尺寸模式、分辨率或短边、帧率、码率模式、码率配置、色深、时长和 executor version
- **AND** 不保存 API Key、原始供应商响应体或完整签名 URL

#### Scenario: 转存失败

- **WHEN** 临时 URL 过期、下载失败、媒体类型不匹配、超出配置大小或对象存储写入失败
- **THEN** 节点以 `asset_transfer` 阶段失败
- **AND** 可重试错误按现有 Attempt 策略重试
- **AND** 不创建成功状态的空资产或残留数据库引用

### Requirement: 执行、缓存和并发

系统 SHALL 将视频画质增强作为独立 AIGC Task 类型执行，并纳入现有运行控制。

#### Scenario: 创建执行快照

- **WHEN** 调度器解析视频画质增强节点
- **THEN** 创建 `VIDEO_ENHANCEMENT` Task Attempt
- **AND** 参数快照包含全部规范化配置与输入资产 ID
- **AND** input hash 包含节点配置、输入视频内容摘要和 executor version
- **AND** 任一有效参数或输入资产变化都会使缓存失效

#### Scenario: 复用成功结果

- **WHEN** 同一 Pipeline 的成功任务具有相同 input hash 且输出资产仍可用
- **THEN** 系统复用增强结果而不再次调用 MediaKit
- **AND** RunNode 标记为 `reused`

#### Scenario: 限制并发与超时

- **WHEN** 多个画质增强节点同时等待执行
- **THEN** 系统使用独立、可配置且默认值为 `1` 的画质增强并发限制
- **AND** 使用独立的轮询间隔和任务超时配置
- **AND** 长时间专业版任务不会占用 Seedance 生视频并发槽位

### Requirement: 画布配置与结果体验

系统 SHALL 在节点卡片和右侧配置面板中提供紧凑、可扫描的画质增强体验。

#### Scenario: 编辑节点配置

- **WHEN** 用户选中视频画质增强节点
- **THEN** 配置面板按版本与风格、尺寸、帧率、码率、色深分组展示
- **AND** 可并排的短配置项在桌面宽度下横向排列
- **AND** 互斥或不适用字段被隐藏或禁用
- **AND** 节点卡片摘要显示版本、目标尺寸、目标帧率或“原帧率”以及增强风格
- **AND** 专业版、4K/8K 或 12/16-bit 配置具有明显的高成本标识

#### Scenario: 查看增强结果

- **WHEN** 节点执行成功
- **THEN** 运行日志展示状态、开始与结束时间、耗时、Attempt 次数和脱敏供应商错误
- **AND** 右侧结果面板可播放增强后视频并展示分辨率、帧率、时长、版本和色深
- **AND** 下游视频输出节点可播放、全屏和下载该资产
- **AND** 视频始终使用 `object-contain` 保持原始宽高比

#### Scenario: 从节点继续与失败重试

- **WHEN** 用户从画质增强节点继续执行或重试失败节点
- **THEN** 系统复用未变化且仍可用的上游视频
- **AND** 创建新的 Attempt 并遵循现有 Run 状态收敛规则
- **AND** 不自动触发未确认的真实计费验收任务

## MODIFIED Requirements

### Requirement: AIGC 节点白名单与强类型端口

系统 SHALL 在现有节点基础上允许 `video_enhancement`，并在前后端节点注册表、Pydantic/TypeScript 联合类型、DAG 校验、执行器映射和结果投影中保持同构。`video_enhancement.video` 输入与输出均使用现有 `video_asset` 端口类型，旧 `schemaVersion=1` 画布无需迁移即可继续加载。

### Requirement: MediaKit 配置

系统 SHALL 复用现有 `MEDIAKIT_API_KEY` 和 `MEDIAKIT_BASE_URL`，并增加画质增强专用的轮询间隔、超时、并发和输出转存限制。配置校验和日志不得输出密钥值；未配置密钥时，生产请求 SHALL 明确失败，测试和本地验收 SHALL 使用注入式 Mock。

### Requirement: AIGC 视频结果

视频结果投影 SHALL 同时支持生视频节点、视频画质增强节点和视频输出节点。增强结果 SHALL 使用现有共享播放器、受控下载地址和文件命名规则，并保持历史 Run 切换、不可用资产和全屏播放行为一致。

## REMOVED Requirements

无。
