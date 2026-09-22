# AIGC 生成产物智能命名与一致下载 Spec

## Why

AIGC 画布中的生图和生视频节点目前沿用人工名称或通用类型名，生成完成后无法快速从节点名称识别产物内容；下载文件还会追加画布名、类型和固定序号，与节点当前名称不一致。系统需要在真实生成期间根据冻结的提示词与视觉参考自动生成短名称，并让节点、资产和下载文件使用一致语义。

## What Changes

- 文生图、普通图生图、图片编辑和生视频任务每次实际调用生成 Provider 时，并行调用一次固定模型 `doubao-seed-2-0-mini-260428` 生成 1–10 个 Unicode 字符的产物名称。
- 命名模型输入使用该任务冻结后的有效生成提示词，以及实际传给生成任务的参考图片和参考视频；不传入参考音频，不传入尚未生成的产物。
- 视频参考在命名模型请求中固定使用 `fps=0.3`；图片参考按原图输入；所有参考素材保持任务快照中的稳定语义顺序。
- 主生成与命名并行执行。生成失败或取消时不落名；命名超时、失败或响应非法时不影响主生成成功，并回退到任务完成时的既有节点显示名。
- 有效 AI 名称在主生成成功后始终覆盖目标节点的 `custom_name`，即使节点运行前已有自定义名称。
- 新产物资产记录生成名称及命名状态；节点名称写入、资产命名和任务成功发布保持一致，避免成功状态下节点名与文件名分叉。
- 下载文件名改为 `{当前节点名称}.{扩展名}`；一个节点单次产生多个资产时，第一个不追加序号，第二个起使用 `{当前节点名称}-2.{扩展名}`。
- 当前 Pipeline 或节点不可用时，下载按资产中冻结的生成名称回退；仍不可用时沿用现有安全文件名规则。
- **BREAKING**：可追溯到 AIGC 生图/生视频节点的图片和视频下载不再默认使用 `画布名-节点名-资产类型序号.扩展名`，而使用当前节点名称。

## Impact

- Affected specs:
  - `add-aigc-asset-library-source` 的 AIGC 输出资产命名
  - `enable-aigc-canvas-context-node-actions` 的节点 `custom_name` 与 revision 合并
  - `add-aigc-video-workflow-nodes` 的视频结果下载
  - `add-aigc-prompt-optimization-download` 的图片结果下载
  - `unify-aigc-modality-nodes` 的结果投影与下载
- Affected code:
  - `backend/app/services/modelark.py`
  - `backend/app/services/generation.py`
  - `backend/app/services/aigc_gateway.py`
  - `backend/app/services/aigc_asset_naming.py`
  - `backend/app/repositories/base.py`
  - `backend/app/repositories/memory.py`
  - `backend/app/repositories/mysql.py`
  - `backend/app/schemas/aigc.py`
  - `backend/app/api/routes.py`
  - `frontend/lib/aigc/download.ts`
  - `frontend/lib/aigc/editor-store.ts`
  - AIGC 执行、资产命名、下载和编辑器相关测试

## ADDED Requirements

### Requirement: 生成产物短名称模型契约

系统 SHALL 使用固定模型 `doubao-seed-2-0-mini-260428` 为受支持的 AIGC 生成任务返回一个可直接用作节点名称的短名称。

模型响应 SHALL 使用结构化 JSON，唯一业务字段为 `name`。`name` 经 Unicode trim 后必须：

- 长度为 1–10 个 Unicode code point；
- 为单行文本，不含控制字符、路径分隔符、文件扩展名或外围引号；
- 能概括提示词与视觉参考表达的主体或场景；
- 不输出解释、编号、Markdown 或候选列表。

Provider 响应为空、超长、结构错误或包含非法字符时，系统 SHALL 将命名判定为失败，不得截断后冒充有效模型结果。

#### Scenario: 返回合法中文短名称

- **WHEN** 输入提示词描述“雨夜霓虹街道中的红色跑车”
- **AND** 命名模型返回 `{"name":"雨夜霓虹跑车"}`
- **THEN** 系统接受该名称
- **AND** 名称不包含扩展名

#### Scenario: 拒绝非法名称

- **WHEN** 模型返回超过 10 个 Unicode code point、换行、路径分隔符、解释文本或非结构化内容
- **THEN** 系统将本次命名标记为失败
- **AND** 主生成任务继续按失败降级规则完成

### Requirement: 命名输入只包含有效提示词和视觉参考

系统 SHALL 使用 Run definition snapshot 和任务参数快照构造命名输入，不得读取运行中再次编辑后的提示词或连线。

命名输入 SHALL 包含：

- 实际用于该生成任务的最终有效提示词；
- 文生图：不附加参考素材；
- 普通图生图：按执行顺序附加全部参考图片；
- 图片编辑：附加被编辑原图及实际参考图片；
- 生视频：按 `first_frame`、`last_frame`、`reference_images`、`reference_videos` 的固定端口顺序，以及同端口 definition edge 顺序附加参考图片和视频。

命名输入 SHALL 排除：

- 参考音频；
- 文本节点以外的非视觉素材；
- 尚未生成的输出图片或视频；
- 资产 ID、对象存储 key、签名参数、密钥及其他内部元数据。

图片和视频 SHALL 使用后端解析出的受控临时访问 URL，仅存在于本次 Provider 请求中，不得持久化或写入普通日志。

#### Scenario: 图生图命名输入

- **WHEN** 图生图任务具有三张有序参考图片和一个最终有效提示词
- **THEN** 命名模型收到该提示词和三张图片
- **AND** 图片顺序与实际图生图请求一致
- **AND** 不收到任何音频或产物图片

#### Scenario: 生视频命名输入

- **WHEN** 生视频任务具有首帧、尾帧、两张参考图片、一个参考视频、一个参考音频和提示词
- **THEN** 命名模型收到提示词、首帧、尾帧、两张参考图片和一个参考视频
- **AND** 每个视频输入固定设置 `fps=0.3`
- **AND** 参考音频不进入命名请求

### Requirement: 每个实际生成 Attempt 只调用一次命名模型

系统 SHALL 为每个实际调用图片或视频生成 Provider 的 TaskAttempt 创建至多一个命名模型调用。

适用任务限定为：

- `TEXT_TO_IMAGE`；
- `IMAGE_TO_IMAGE`；
- `IMAGE_EDIT`；
- `VIDEO_GENERATION`。

图层拆分、图层合成、视频增强、视频人脸打码、视频字幕提取、多轨剪辑、LLM 和纯输出节点不触发命名。

同一 TaskAttempt 不得因 Provider 轮询、资产下载、前端重复轮询或结果投影重复调用命名模型。自动重试创建的新 TaskAttempt 可以再次调用一次。缓存复用或 `REUSED` 节点不创建生成 Attempt，因此不得额外调用命名模型。

#### Scenario: 生视频异步轮询

- **WHEN** 一个生视频 Attempt 创建 Provider 任务并轮询多次后成功
- **THEN** 整个 Attempt 只调用一次命名模型
- **AND** Provider 轮询次数不影响命名调用次数

#### Scenario: 缓存复用

- **WHEN** 节点命中可用历史结果并以 `REUSED` 完成
- **THEN** 系统不调用命名模型
- **AND** 继续使用复用结果关联的名称和下载语义

### Requirement: 命名与主生成并行且非阻塞

系统 SHALL 在视觉参考完成解析后并行启动主生成调用和命名调用。任务不得在命名完成后才开始主生成。

命名调用 SHALL 使用独立的 30 秒超时。主生成先完成时，任务最多等待命名超时结束；命名失败、超时或响应非法不得使主生成任务失败、重试或取消。

主生成失败、超时或取消时，系统 SHALL 取消或丢弃命名结果，不更新节点名称，不改变资产名称，也不单独发布命名结果。

#### Scenario: 命名先成功

- **WHEN** 命名模型先返回合法名称而主生成仍在运行
- **THEN** 系统暂存名称
- **AND** 仅在主生成和资产归档成功后发布名称

#### Scenario: 命名失败但生成成功

- **WHEN** 命名模型超时或返回非法响应
- **AND** 主生成及资产归档成功
- **THEN** 任务仍以成功完成
- **AND** 节点名称保持不变
- **AND** 下载文件名使用任务完成时解析出的既有节点名称
- **AND** 错误以脱敏诊断信息记录，不向任务暴露密钥、签名 URL 或原始 Provider 响应

#### Scenario: 生成失败

- **WHEN** 主生成失败、超时或被取消
- **THEN** 系统不写入 AI 名称
- **AND** 不因已完成的命名调用产生可见副作用

### Requirement: 生成成功后始终覆盖节点名称

当主生成成功且命名模型返回合法名称时，系统 SHALL 将名称写入目标节点顶层 `custom_name`，覆盖该节点当时的任何自动名称、旧 AI 名称或用户自定义名称。

节点名称更新 SHALL：

- 只修改目标节点的 `custom_name`；
- 保留当前 Pipeline 中其他节点、连线、配置和用户并发编辑；
- 在数据库行锁或等价原子更新中递增 Pipeline revision；
- 支持同一 Pipeline 不同节点并发完成时分别合并，禁止最后写入者覆盖完整 definition；
- 让前端在 Run 完成后接收最新 Pipeline revision，并以服务端生成名称为权威值解决该节点名称冲突；
- 不改变 Run definition snapshot、任务输入 hash、缓存键或已经执行的 Provider 参数。

#### Scenario: 覆盖已有名称

- **WHEN** 节点运行前名称为“商品主图”
- **AND** 命名模型返回“雪山冲锋衣”
- **AND** 主生成成功
- **THEN** 节点 `custom_name` 更新为“雪山冲锋衣”

#### Scenario: 运行期间用户手动改名

- **WHEN** 任务运行期间用户将节点改名为“最终版本”
- **AND** 命名模型返回“雨夜跑车”
- **AND** 主生成成功
- **THEN** 服务端最终节点名称仍更新为“雨夜跑车”
- **AND** 前端同步最新 revision，不以旧草稿再次覆盖该 AI 名称

#### Scenario: 不同节点并发完成

- **WHEN** 同一 Pipeline 的两个生成节点并行完成并分别得到合法名称
- **THEN** 两个节点名称都被保留
- **AND** 任一更新不得丢失另一节点名称或用户对其他字段的编辑

### Requirement: 名称、资产和成功状态一致发布

系统 SHALL 在成功产物资产中保存：

- `generated_name`：合法 AI 名称，失败降级时为空；
- `name_source`：`ai` 或 `fallback`；
- `naming_model`：成功调用时为 `doubao-seed-2-0-mini-260428`；
- `naming_status`：`succeeded`、`timeout`、`provider_error`、`invalid_response` 或 `skipped`；
- 既有 pipeline、run、node、task、模型和输入追溯元数据。

AI 名称有效时，节点名称更新、资产名称写入和 TaskAttempt 成功发布 SHALL 形成一致提交边界。若内部持久化或 revision 合并失败，系统 SHALL 重试安全的局部更新；最终仍无法保持一致时任务不得发布为成功，并须清理不可见的半成品资产。

命名 Provider 自身失败属于明确例外：系统使用 fallback 名称完成资产归档，不更新节点名称，并允许任务成功。

#### Scenario: 持久化节点名称失败

- **WHEN** AI 名称有效且资产已转存，但节点局部更新最终失败
- **THEN** TaskAttempt 不发布成功
- **AND** 系统清理本次未发布资产或执行等价补偿
- **AND** 不留下节点名、资产名和任务状态互相矛盾的可见结果

## MODIFIED Requirements

### Requirement: AIGC 输出资产命名

受支持的生图和生视频新产物 SHALL 使用生成名称作为资产 `metadata.name` 的 basename，并写入新的 `name_scheme="aigc_generated_node_v2"`：

- 单产物：`{生成或回退节点名称}.{扩展名}`；
- 多产物第一个：`{生成或回退节点名称}.{扩展名}`；
- 多产物第二个及以后：`{生成或回退节点名称}-{ordinal}.{扩展名}`，其中 ordinal 为 2-based 可见序号。

文件名 SHALL 保留合法 Unicode，替换控制字符、路径分隔符和平台非法字符，保留完整 MIME 扩展名，并遵守现有 180-byte 上限。生成名称本身不包含扩展名。

历史 `aigc_canvas_node_v1` 资产不回填、不改对象存储 key、不改变资产 ID、引用关系和缓存键。

#### Scenario: 单张图片资产

- **WHEN** AI 名称为“雨夜霓虹跑车”且产物 MIME 为 `image/png`
- **THEN** 资产名称为 `雨夜霓虹跑车.png`
- **AND** `name_scheme` 为 `aigc_generated_node_v2`

#### Scenario: 命名失败回退

- **WHEN** 命名模型失败且节点当前显示名为“文生图2”
- **THEN** 产物资产名称为 `文生图2.扩展名`
- **AND** `name_source` 为 `fallback`

### Requirement: 图片和视频下载文件名

系统 SHALL 让可追溯到 AIGC 生图或生视频节点的图片、视频下载文件名与下载时的当前节点名称一致。

解析优先级为：

1. 当前 Pipeline 中目标节点的当前显示名称；
2. 资产冻结的 `generated_name`；
3. 资产 `metadata.name`；
4. 现有安全回退名称。

节点卡片、模态详情、结果面板和资产库下载 SHALL 使用相同 basename、序号和扩展名。前端 `download` 建议名与后端 `Content-Disposition` 必须一致；后端仍是最终权威来源。

节点后续被手动重命名时，仍可追溯的资产下载 SHALL 使用新节点名称；Pipeline 或节点已删除时使用资产冻结名称。用户在资产库执行显式资产重命名后，`user_defined_v1` 名称继续作为该资产的最高优先级。

#### Scenario: 节点后续改名

- **WHEN** 产物生成时节点名为“雨夜跑车”
- **AND** 用户随后将节点改名为“城市汽车广告”
- **THEN** 从节点、结果面板或资产库下载该单产物时文件名为 `城市汽车广告.扩展名`

#### Scenario: Pipeline 已删除

- **WHEN** 资产仍可下载但来源 Pipeline 或节点已不存在
- **THEN** 下载文件名使用资产中冻结的 `generated_name`
- **AND** 不因名称解析失败阻止资产下载

## REMOVED Requirements

### Requirement: 生图和生视频下载固定追加首个序号

**Reason**: 单产物下载需要与节点名称完全一致，固定追加 `-1` 或 `-图片1/-视频1` 会造成名称不一致。

**Migration**: 仅改变下载时的文件名解析和新资产名称；历史对象、资产 ID、Run、引用关系及存储 key 保持不变。多产物从第二个开始追加可见序号。
