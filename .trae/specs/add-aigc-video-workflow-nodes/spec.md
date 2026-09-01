# AIGC 视频工作流节点 Spec

## Why

AIGC 工作台当前只能编排文本与图片生成，无法在同一画布中接入视频、音频素材并执行 Seedance 生视频。项目已有独立工具的 Seedance 异步调用、参数校验和资产转存链路，本变更应在不复制供应商实现的前提下，将这些能力扩展为可编排的视频节点。

## What Changes

- 新增 `video_input`、`audio_input`、`video_generation`、`video_output` 四类 AIGC 节点。
- 生视频节点支持四个模型：Seedance 2.5、Seedance 2.0、Seedance 2.0 Fast、Seedance 2.0 Mini。
- 生视频节点提供文生视频、首帧图生视频、首尾帧图生视频、全模态参考生视频四种互斥模式，并按模式启用对应输入端口。
- 按模型限制参考图片、视频、音频数量，以及分辨率和时长；Seedance 2.0 系列禁止仅输入音频。
- 宽高比支持 `16:9`、`4:3`、`1:1`、`3:4`、`9:16`、`21:9`、`adaptive`。
- 支持有声和无声视频，生视频节点通过 `generate_audio` 显式控制是否生成音频。
- 复用并泛化现有 ModelArk Seedance 任务创建、轮询、错误脱敏和结果转存能力；AIGC 继续使用自身 Run、RunNode、Task 和 Worker 调度体系。
- 视频输出自动进入资产库，并可在节点和结果面板中播放、查看规格及下载。
- 画布定义保持 `schemaVersion=1`，旧画布无需迁移即可继续加载。

## Impact

- Affected specs:
  - AIGC 节点与端口契约
  - AIGC DAG 校验、执行计划、缓存与 Worker 并发
  - AIGC 媒体上传、资产引用和结果展示
  - Seedance 模型能力与供应商适配
- Affected code:
  - `backend/app/schemas/aigc.py`
  - `backend/app/schemas/tool_task.py`
  - `backend/app/services/aigc_dag.py`
  - `backend/app/services/aigc_executor.py`
  - `backend/app/services/aigc_gateway.py`
  - `backend/app/services/modelark.py`
  - `backend/app/api/aigc_routes.py`
  - `frontend/lib/aigc/types.ts`
  - `frontend/lib/aigc/node-registry.ts`
  - `frontend/lib/aigc/editor-store.ts`
  - `frontend/components/workspace/aigc/**`
  - 前后端相关测试

## 设计决策

### 节点与端口

| 节点 | 类别 | 输入 | 输出 | 是否创建任务 |
| --- | --- | --- | --- | --- |
| `video_input` | 输入 | 无 | `video_asset` | 否 |
| `audio_input` | 输入 | 无 | `audio_asset` | 否 |
| `video_generation` | 模型 | `prompt`、`first_frame`、`last_frame`、`reference_images`、`reference_videos`、`reference_audios` | `video_asset` | 是 |
| `video_output` | 输出 | `video_asset` | 无 | 否 |

- `prompt` 接受文本输入节点或 LLM 节点输出。
- `first_frame`、`last_frame` 和 `reference_images` 接受现有图片输入或图片模型节点输出。
- `reference_videos` 接受视频输入或上游生视频节点输出。
- `reference_audios` 接受音频输入节点输出。
- 多素材端口按画布 definition 中入边的稳定顺序编号；该顺序进入供应商请求、参数快照和缓存 Hash。
- 生成模式决定有效端口，互斥模式的端口不得混用。

### 生视频节点配置

```text
model:
  doubao-seedance-2-5-260628
  doubao-seedance-2-0-260128
  doubao-seedance-2-0-fast-260128
  doubao-seedance-2-0-mini-260615
generation_mode:
  text_to_video
  first_frame
  first_last_frame
  multimodal_reference
resolution: 480p | 720p | 1080p | 4k
aspect_ratio: 16:9 | 4:3 | 1:1 | 3:4 | 9:16 | 21:9 | adaptive
duration_seconds: -1 或模型允许的整数秒
generate_audio: boolean
```

- 默认模型为 Seedance 2.5，默认分辨率为 `720p`，默认宽高比为 `adaptive`，默认时长为 `-1`，默认生成音频。
- 切换模型后，若当前分辨率或时长不合法，前端收敛为 `720p` 或 `-1`。
- 切换生成模式不会静默删除连线；不属于新模式的既有连线被标记为无效，保存与执行前必须由用户断开。

### 模型能力矩阵

| 模型 | 参考图片 | 参考视频 | 参考音频 | 分辨率 | 时长 |
| --- | ---: | ---: | ---: | --- | --- |
| Seedance 2.5 | 0-30 | 0-10 | 0-10 | 480p、720p、1080p | `-1` 或 4-30 秒 |
| Seedance 2.0 | 0-9 | 0-3 | 0-3 | 480p、720p、1080p、4k | `-1` 或 4-15 秒 |
| Seedance 2.0 Fast | 0-9 | 0-3 | 0-3 | 480p、720p | `-1` 或 4-15 秒 |
| Seedance 2.0 Mini | 0-9 | 0-3 | 0-3 | 480p、720p | `-1` 或 4-15 秒 |

### 复用策略

- 将现有工具链中的模型白名单、时长、分辨率和素材组合校验提取为 Seedance 共享能力定义，工具页与 AIGC 共用同一数据源。
- 将现有 `generate_tool_video` 内部的供应商请求构造、异步轮询和结果解析泛化为领域中立的 Seedance 调用；原工具入口继续委托该实现，保持现有 API 行为。
- AIGC 网关负责解析上游资产、记录输入资产引用、调用共享 Seedance 能力、转存结果和记录输出资产引用。
- 不复用 `ToolTask` 作为 AIGC 任务；AIGC 运行状态仍由 `PipelineRun`、`RunNode` 和 `PipelineTask` 管理。

## ADDED Requirements

### Requirement: 视频与音频输入节点

系统 SHALL 提供可保存、复用并连接到生视频节点的视频输入和音频输入节点。

#### Scenario: 选择输入素材

- **WHEN** 用户在视频输入或音频输入节点上传本地文件或从资产库选择兼容资产
- **THEN** 节点保存对应 `asset_id`
- **AND** 视频节点仅接受可用的视频资产，音频节点仅接受可用的音频资产
- **AND** 上传资产进入现有资产库并标记 `origin=aigc` 和 `aigc_role=input`
- **AND** 模板创建、更新和实例化时清除视频及音频输入节点的具体 `asset_id`

#### Scenario: 预览输入素材

- **WHEN** 输入节点已绑定可用资产
- **THEN** 视频输入节点提供保持原始宽高比的播放和放大预览
- **AND** 音频输入节点提供播放、暂停和时长信息
- **AND** 节点显示文件名及可获得的分辨率、时长或 MIME 信息

#### Scenario: 输入资产不可用

- **WHEN** 节点引用的资产被删除、类型不匹配或不再可访问
- **THEN** 节点显示不可用状态
- **AND** 保存可保留该引用以便用户修复
- **AND** 执行时后端拒绝该节点并返回可定位的输入错误

### Requirement: 生视频节点与生成模式

系统 SHALL 通过一个 `video_generation` 模型节点支持四种互斥的 Seedance 生成模式。

#### Scenario: 文生视频

- **WHEN** `generation_mode=text_to_video`
- **THEN** `prompt` 必须连接且解析后为非空文本
- **AND** 所有图片、视频和音频输入端口必须为空
- **AND** 系统提交纯文本 Seedance 请求

#### Scenario: 首帧图生视频

- **WHEN** `generation_mode=first_frame`
- **THEN** `first_frame` 必须且只能连接一张图片
- **AND** `prompt` 可以不连接或为空
- **AND** 系统将该图片以 `role=first_frame` 提交
- **AND** `last_frame` 与全部参考素材端口必须为空

#### Scenario: 首尾帧图生视频

- **WHEN** `generation_mode=first_last_frame`
- **THEN** `first_frame` 与 `last_frame` 各必须且只能连接一张图片
- **AND** `prompt` 可以不连接或为空
- **AND** 系统分别以 `role=first_frame` 和 `role=last_frame` 提交
- **AND** 全部参考素材端口必须为空

#### Scenario: 全模态参考生视频

- **WHEN** `generation_mode=multimodal_reference`
- **THEN** 系统接受可选提示词及模型允许数量内的参考图片、参考视频和参考音频
- **AND** 至少存在提示词或一种参考素材
- **AND** Seedance 2.5 允许仅连接音频
- **AND** Seedance 2.0、2.0 Fast、2.0 Mini 在存在音频时必须同时存在至少一张参考图片或一个参考视频
- **AND** `first_frame` 与 `last_frame` 端口必须为空

#### Scenario: 编辑或延长视频

- **WHEN** 全模态模式连接一个或多个参考视频，并由提示词描述编辑或延长目标
- **THEN** 系统按稳定顺序将视频作为 `reference_video` 提交
- **AND** 不新增与供应商语义重复的独立编辑或延长节点

### Requirement: 模型能力约束

系统 SHALL 在前端连接、保存和后端执行三个阶段按所选模型校验素材数量及参数组合。

#### Scenario: 限制 Seedance 2.5 素材数量

- **WHEN** 用户选择 Seedance 2.5
- **THEN** 全模态模式最多连接 30 张参考图片、10 个参考视频和 10 个参考音频
- **AND** 第一个超限连接在前端被拒绝并显示原因
- **AND** 后端对绕过前端的超限 definition 返回验证错误

#### Scenario: 限制 Seedance 2.0 系列素材数量

- **WHEN** 用户选择 Seedance 2.0、2.0 Fast 或 2.0 Mini
- **THEN** 全模态模式最多连接 9 张参考图片、3 个参考视频和 3 个参考音频
- **AND** 第一个超限连接在前端被拒绝并显示原因
- **AND** 后端对绕过前端的超限 definition 返回验证错误

#### Scenario: 校验分辨率

- **WHEN** 用户选择模型或提交运行
- **THEN** Seedance 2.5 仅允许 480p、720p、1080p
- **AND** Seedance 2.0 仅允许 480p、720p、1080p、4k
- **AND** Seedance 2.0 Fast 和 Mini 仅允许 480p、720p
- **AND** 默认值为 720p

#### Scenario: 校验宽高比

- **WHEN** 用户配置生视频节点
- **THEN** 四个模型均可选择 `16:9`、`4:3`、`1:1`、`3:4`、`9:16`、`21:9`、`adaptive`
- **AND** `adaptive` 由模型根据任务类型和输入内容自动适配
- **AND** 其他值被前后端拒绝

#### Scenario: 校验视频时长

- **WHEN** 用户选择 Seedance 2.5
- **THEN** 时长允许 `-1` 或 4 至 30 的整数
- **WHEN** 用户选择任一 Seedance 2.0 系列模型
- **THEN** 时长允许 `-1` 或 4 至 15 的整数
- **AND** `-1` 表示智能选择并原样传给供应商

#### Scenario: 选择有声或无声输出

- **WHEN** 用户开启或关闭“生成音频”
- **THEN** 系统分别以 `generate_audio=true` 或 `generate_audio=false` 提交
- **AND** 该值进入节点参数快照、缓存 Hash 和结果元数据

### Requirement: 视频执行与资产流转

系统 SHALL 复用 AIGC 调度体系执行生视频任务，并复用 Seedance 供应商异步链路生成一个视频资产。

#### Scenario: 创建视频任务

- **WHEN** 生视频节点进入 ready 状态
- **THEN** 系统创建 `AigcTaskType.VIDEO_GENERATION` attempt
- **AND** 参数快照包含模型、生成模式、提示词、素材资产 ID 的稳定顺序、分辨率、宽高比、时长和音频开关
- **AND** 输入 Hash 包含上述全部参数及上游结果摘要
- **AND** 视频任务使用独立于 LLM 和图片任务的视频并发限制与超时配置

#### Scenario: 调用 Seedance

- **WHEN** Worker 执行视频任务
- **THEN** 后端重新校验所有输入资产状态和 MIME 类型
- **AND** 将资产转换为受控临时访问 URL
- **AND** 使用 request body 的强校验字段传递 `resolution`、`ratio`、`duration` 和 `generate_audio`
- **AND** 创建供应商异步任务并轮询至终态
- **AND** 供应商任务 ID、请求 ID和错误仅以脱敏字段记录

#### Scenario: 视频生成成功

- **WHEN** Seedance 返回成功视频 URL
- **THEN** 系统将视频转存到现有对象存储并创建资产库可见的 AIGC 输出资产
- **AND** 资产关联 pipeline、run、node、task、模型和安全的生成参数元数据
- **AND** Task 和 RunNode 更新为 succeeded
- **AND** 下游视频输出节点可消费该资产

#### Scenario: 视频生成失败或超时

- **WHEN** 创建、轮询、下载或转存失败，或达到视频任务超时
- **THEN** 系统按现有 AIGC 瞬时错误策略重试
- **AND** 最终失败时仅阻塞依赖该节点的后代，独立分支继续
- **AND** 晚到结果不得覆盖已取消、超时或由新 attempt 取代的状态

### Requirement: 视频输出节点

系统 SHALL 提供不创建任务的 `video_output` 节点，用于展示所选运行的视频结果。

#### Scenario: 查看视频结果

- **WHEN** 视频输出节点连接到成功的生视频节点
- **THEN** 节点与右侧结果面板显示可播放视频
- **AND** 播放器使用固定媒体区并保持视频原始宽高比，不裁切或拉伸
- **AND** 展示可获得的分辨率、时长、是否含音频和文件状态

#### Scenario: 下载视频结果

- **WHEN** 用户点击视频输出节点或结果面板的下载按钮
- **THEN** 系统通过受控资产下载地址下载文件
- **AND** 文件名遵循“节点标题-序号.扩展名”
- **AND** 不可用结果禁用播放和下载并显示原因

## MODIFIED Requirements

### Requirement: AIGC 节点白名单与强类型端口

系统 SHALL 在既有七类节点基础上允许 `video_input`、`audio_input`、`video_generation`、`video_output`，并新增 `video_asset` 与 `audio_asset` 端口类型。前后端节点注册表、Pydantic/TypeScript 联合类型、DAG 校验和执行器映射 SHALL 保持同构。

#### Scenario: 打开旧画布

- **WHEN** 用户打开不包含视频节点的 `schemaVersion=1` 画布
- **THEN** 系统按原定义加载且不产生迁移修改
- **AND** 原有文本与图片节点行为不变

#### Scenario: 拒绝跨类型连线

- **WHEN** 用户尝试将视频连接到图片或音频端口，或将音频连接到图片或视频端口
- **THEN** 前端拒绝连线并显示类型不兼容
- **AND** 后端保存与执行校验采用相同规则

### Requirement: AIGC 增量执行与缓存

系统 SHALL 将视频节点纳入现有全量执行、从节点执行、失败重试和同 Pipeline 缓存复用。

#### Scenario: 复用视频结果

- **WHEN** 生视频节点的模型、模式、提示词、素材顺序、素材摘要、分辨率、宽高比、时长、音频开关和 executorVersion 均与可用历史结果一致
- **THEN** 增量执行可以复用历史视频任务
- **AND** 任一字段、素材内容或顺序变化均使缓存失效

## REMOVED Requirements

无。
