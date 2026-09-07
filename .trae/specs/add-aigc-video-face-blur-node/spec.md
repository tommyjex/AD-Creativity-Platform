# AIGC 视频人脸打码节点 Spec

## Why

当前 AIGC 画布可以生成、输入、增强和输出视频，但无法在工作流中对视频中的全部人脸进行隐私打码。系统已有工具页 MediaKit 人脸打码客户端，本变更将复用该能力并接入 AIGC DAG，使上传视频或上游生成视频可在同一 Run 中完成打码、持久化和下游复用。

## What Changes

- 新增可执行节点 `video_face_blur`，接收一个 `video_asset`，输出一个打码后的 `video_asset`。
- 首版仅开放打码方式 `mosaic|blur` 和打码强度 `low|medium|high`；`face_confidence` 与 `face_box_expand` 使用 MediaKit 默认值。
- 复用现有 `FaceBlurVideoClient`、`MEDIAKIT_API_KEY` 与任务查询接口；扩展客户端以支持 AIGC 稳定幂等 token，不改变工具页既有调用行为。
- 在调用供应商前校验视频资产、可访问性、时长、帧率和最高 4K 限制。
- 将 24 小时有效的供应商结果地址及时流式转存为可追溯 AIGC 视频资产。
- 接入现有 Run、Task Attempt、缓存、重试、取消、独立并发、运行日志、结果面板和视频输出节点。
- 自动化测试和浏览器验收全部使用 Mock，不自动调用真实计费的 MediaKit 人脸打码接口。

## Impact

- Affected specs: AIGC 节点契约、强类型 DAG、AIGC 执行器、MediaKit 人脸打码、视频资产、运行日志、视频结果展示。
- Affected code:
  - `backend/app/core/config.py`
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/aigc_dag.py`
  - `backend/app/services/aigc_executor.py`
  - `backend/app/services/aigc_gateway.py`
  - `backend/app/services/mediakit_face_blur.py`
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

### Requirement: 视频人脸打码节点契约

系统 SHALL 在 AIGC 画布中提供可执行节点 `video_face_blur`，节点具有一个必填 `video` 输入端口和一个 `video` 输出端口，端口类型均为 `video_asset`。

#### Scenario: 添加并连接节点

- **WHEN** 用户从节点面板添加“视频人脸打码”节点
- **THEN** 节点以视频模态配色显示
- **AND** 节点可接收视频输入、生视频、视频画质增强或其他视频人脸打码节点输出
- **AND** 节点输出可连接视频输出、视频画质增强或另一个视频人脸打码节点
- **AND** 非 `video_asset` 连接在前端被拒绝，绕过前端保存时也被后端拒绝

#### Scenario: 输入未连接

- **WHEN** 用户运行未连接 `video` 输入的人脸打码节点
- **THEN** 系统在调度阶段拒绝执行
- **AND** 错误明确定位节点和缺失的 `video` 输入
- **AND** 不调用 MediaKit

### Requirement: 人脸打码参数

系统 SHALL 为节点提供与现有工具页一致的基础打码参数，并使用 MediaKit 保守默认值。

#### Scenario: 使用默认配置

- **WHEN** 用户新建视频人脸打码节点
- **THEN** `mask_mode` 默认为 `mosaic`
- **AND** `mask_strength` 默认为 `medium`
- **AND** 节点摘要显示“马赛克 · 中等强度”

#### Scenario: 配置打码方式与强度

- **WHEN** 用户选中视频人脸打码节点
- **THEN** 用户可选择 `mosaic`（马赛克）或 `blur`（高斯模糊）
- **AND** 用户可选择 `low`、`medium` 或 `high`
- **AND** 保存的节点配置只包含 `mask_mode` 与 `mask_strength`
- **AND** 任一非法枚举值在前后端契约校验阶段被拒绝

#### Scenario: 使用供应商默认高级参数

- **WHEN** 系统提交人脸打码任务
- **THEN** 请求不发送 `face_confidence` 或 `face_box_expand`
- **AND** MediaKit 分别使用默认值 `0.35` 和 `0.2`
- **AND** 节点配置面板不展示这两个高级参数

### Requirement: 输入视频校验

系统 SHALL 在调用供应商前重新校验输入视频的资产状态、类型、可访问性和 MediaKit 输入限制。

#### Scenario: 解析有效输入

- **WHEN** 上游结果包含一个公开、成功且可访问的视频资产
- **THEN** 系统生成受控临时访问 URL
- **AND** 通过媒体探测读取宽度、高度、时长、帧率、容器和 MIME
- **AND** 输入时长不得超过 600 秒
- **AND** 输入帧率必须位于 `[25, 60]`
- **AND** 输入分辨率不得超过 4K，即长边不超过 4096 且短边不超过 2160
- **AND** 系统记录 `slot=video`、`ordinal=0` 的输入资产引用

#### Scenario: 输入无效

- **WHEN** 输入资产不存在、不可访问、不是成功的公开视频、MIME 不是视频，或媒体规格超出限制
- **THEN** 节点以 `invalid_input` 或 `invalid_media_input` 失败
- **AND** 错误阶段为 `input_resolution`
- **AND** 不调用 MediaKit
- **AND** 错误不暴露签名 URL、对象存储凭证或供应商密钥

### Requirement: MediaKit 异步调用

系统 SHALL 复用现有 `FaceBlurVideoClient` 和 MediaKit 鉴权配置提交、轮询并解析 AIGC 人脸打码任务。

#### Scenario: 提交打码任务

- **WHEN** 节点输入与配置校验通过
- **THEN** 系统调用 `POST /api/v1/tools/face-blur-video`
- **AND** 请求使用 `Authorization: Bearer {MEDIAKIT_API_KEY}`
- **AND** 请求只包含受控 `video_url`、`mask_mode`、`mask_strength` 和 AIGC 稳定 `client_token`
- **AND** `client_token` 不超过 64 个可打印 ASCII 字符，并稳定关联当前 Run、节点和 Attempt
- **AND** 请求不发送 `face_confidence`、`face_box_expand`、`callback_url`、`callback_args`、`queue_id` 或 `media_output_destination`
- **AND** 现有工具页调用仍不要求 `client_token`，行为保持兼容

#### Scenario: 轮询任务

- **WHEN** 提交接口返回供应商 `task_id`
- **THEN** 系统轮询 `GET /api/v1/tasks/{task_id}`
- **AND** `queued` 或 `running` 保持节点运行中
- **AND** `completed` 解析 `video_url` 和 `duration`
- **AND** `failed`、未知状态、非法响应、网络错误和超时映射为脱敏 AIGC 任务错误
- **AND** 供应商 `task_id` 与安全格式的 `request_id` 可在 Task Attempt 中追踪

#### Scenario: 任务取消或 Worker 失效

- **WHEN** Run 被取消、Task Attempt 被替换或 Worker 租约失效
- **THEN** 晚到的供应商结果不得覆盖当前状态
- **AND** 已转存但未被接受的输出资产按现有清理策略处理
- **AND** 独立分支继续遵循现有 AIGC 调度与 Run 收敛语义

### Requirement: 打码结果持久化

系统 SHALL 在 MediaKit 临时下载地址失效前，将结果视频保存为本系统 AIGC 输出资产。

#### Scenario: 流式转存结果

- **WHEN** MediaKit 任务完成并返回 HTTPS `video_url`
- **THEN** 系统使用共享的流式远程视频转存能力下载并上传至对象存储
- **AND** 大型视频不得完整缓存在内存
- **AND** 转存过程使用可配置超时和最大字节数
- **AND** 输出资产状态为 `succeeded`、角色为 `public`、类型为视频
- **AND** 输出 MIME、扩展名与实际 MP4/MOV 内容一致
- **AND** 资产关联 pipeline、run、node、task 及输入资产

#### Scenario: 保存打码元数据

- **WHEN** 输出资产创建成功
- **THEN** 元数据包含 `provider=mediakit`、`operation=face_blur_video`、供应商任务 ID、打码方式、打码强度、时长和 executor version
- **AND** 元数据包含 pipeline、run、node、task 和输入资产标识
- **AND** 不保存 API Key、原始供应商响应体或完整签名 URL

#### Scenario: 转存失败

- **WHEN** 临时 URL 过期、下载失败、媒体类型不匹配、超出大小限制或对象存储写入失败
- **THEN** 节点以 `asset_transfer` 阶段失败
- **AND** 可重试错误按现有 Attempt 策略重试
- **AND** 不创建成功状态的空资产或残留数据库引用

### Requirement: 执行、缓存与并发

系统 SHALL 将视频人脸打码作为独立 AIGC Task 类型执行，并纳入现有运行控制。

#### Scenario: 创建执行快照

- **WHEN** 调度器解析视频人脸打码节点
- **THEN** 创建 `VIDEO_FACE_BLUR` Task Attempt
- **AND** 参数快照包含规范化的 `mask_mode`、`mask_strength` 与输入资产 ID
- **AND** input hash 包含节点配置、输入视频内容摘要和 executor version
- **AND** 输入视频或任一配置变化都会使缓存失效

#### Scenario: 复用成功结果

- **WHEN** 同一 Pipeline 的成功任务具有相同 input hash 且输出资产仍可用
- **THEN** 系统复用打码结果而不再次调用 MediaKit
- **AND** RunNode 标记为 `reused`

#### Scenario: 限制并发与超时

- **WHEN** 多个人脸打码节点同时等待执行
- **THEN** 系统使用独立、可配置且默认值为 `1` 的人脸打码并发限制
- **AND** 使用独立的轮询间隔、任务超时、转存超时和最大输出字节配置
- **AND** 人脸打码不占用 Seedance 或视频画质增强并发槽位

### Requirement: 画布配置与结果体验

系统 SHALL 在节点卡片、右侧配置面板、结果面板和运行日志中提供完整的人脸打码体验。

#### Scenario: 编辑节点配置

- **WHEN** 用户选中视频人脸打码节点
- **THEN** 配置面板以紧凑同栏方式展示打码方式和打码强度
- **AND** 节点卡片摘要显示当前方式和强度
- **AND** 保存并重新加载画布后配置保持不变
- **AND** 仅包含该节点的有效 Pipeline 也允许点击“执行”

#### Scenario: 查看打码结果

- **WHEN** 节点执行成功
- **THEN** 运行日志展示状态、开始与结束时间、耗时、Attempt 次数和脱敏失败原因
- **AND** 右侧结果面板可播放打码后视频，并展示时长、打码方式和强度
- **AND** 下游视频输出节点可播放、放大、全屏和下载该资产
- **AND** 视频始终使用 `object-contain` 保持原始宽高比

#### Scenario: 从节点继续与失败重试

- **WHEN** 用户从人脸打码节点继续执行或重试失败节点
- **THEN** 系统复用未变化且仍可用的上游视频
- **AND** 创建新的 Attempt 并遵循现有 Run 状态收敛规则
- **AND** 自动化验收不触发未经确认的真实计费任务

## MODIFIED Requirements

### Requirement: AIGC 节点白名单与强类型端口

系统 SHALL 在现有节点基础上允许 `video_face_blur`，并在前后端节点注册表、Pydantic/TypeScript 联合类型、保存校验、执行按钮白名单、DAG 校验、执行器映射和结果投影中保持同构。`video_face_blur.video` 输入与输出均使用现有 `video_asset` 端口类型，旧 `schemaVersion=1` 画布无需迁移即可继续加载。

### Requirement: 共享 MediaKit 人脸打码客户端

现有 `FaceBlurVideoClient` SHALL 同时服务工具页和 AIGC 画布。客户端 SHALL 支持可选稳定 `client_token`；工具页保持现有参数与响应行为，AIGC 调用增加幂等 token。客户端不得输出 API Key、签名 URL 查询参数、供应商原始错误正文或堆栈信息。

### Requirement: AIGC 视频结果

视频结果投影 SHALL 同时支持生视频、视频画质增强、视频人脸打码和视频输出节点。人脸打码结果 SHALL 使用现有共享播放器、受控下载地址和文件命名规则，并保持历史 Run 切换、缓存复用、不可用资产和全屏播放行为一致。

## REMOVED Requirements

无。
