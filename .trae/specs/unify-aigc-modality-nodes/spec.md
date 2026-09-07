# AIGC 统一模态节点 Spec

## Why

AIGC 画布目前将文本、图片和视频拆成独立输入/输出节点，音频又只有输入节点。同一模态因此存在重复节点、重复 UI 和不同结果投影逻辑，用户在搭建工作流时还必须提前判断节点属于“输入”还是“输出”。系统需要将节点语义收敛为文本、图片、视频、音频四种模态，使同一个节点既可提供本地内容，也可接收、展示并继续传递上游结果。

## What Changes

- 新增四类统一模态节点：`text`、`image`、`video`、`audio`。
- 每类模态节点固定提供一个可选同模态输入端口和一个同模态输出端口。
- 无上游入边时，节点使用本地文本或本地选择/上传的媒体资产作为有效值。
- 有上游入边时，上游结果优先；节点展示并透传上游值，本地内容保留但不生效。备用配置仍须满足字段结构约束并继续保护其本地资产，但不参与当前有效值、必填内容或下游 Hash 计算。
- 模态节点不创建 `PipelineTaskAttempt`，但在 Run 中生成可追踪的 `RunNode` 结果快照。
- 删除独立输入/输出节点的新增入口；节点面板只按“模态 / 模型 / 控制”分类。
- 将 `schemaVersion` 升级为 `2`；旧 `schemaVersion=1` definitions 在读取、保存、模板实例化和执行前自动迁移；历史 Run 只做内存只读适配。
- 旧节点迁移时保留 node ID、位置、尺寸、连线和可兼容配置，不修改历史 Run 快照。
- 文本 BBox 引用、图片精准框选、媒体资产选择、模板资产清理、结果复制/预览/播放/下载继续可用。
- 不改变 LLM、图片模型、视频模型、画质增强、人脸打码和图层工作流的模型任务语义。

## Impact

- Affected specs:
  - AIGC 节点注册表与 Pipeline definition
  - AIGC DAG 校验、运行计划与结果投影
  - AIGC 模态节点编辑和结果展示
  - AIGC 模板规范化与媒体资产引用
  - AIGC BBox 提示词引用
- Affected code:
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/aigc_pipeline.py`
  - `backend/app/services/aigc_dag.py`
  - `backend/app/services/aigc_executor.py`
  - `frontend/lib/aigc/types.ts`
  - `frontend/lib/aigc/node-registry.ts`
  - `frontend/lib/aigc/editor-store.ts`
  - `frontend/lib/aigc/result-projection.ts`
  - `frontend/lib/aigc/node-display-name.ts`
  - `frontend/lib/aigc/bbox-references.ts`
  - `frontend/lib/aigc/video-generation.ts`
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/components/workspace/aigc/aigc-prompt-editor.tsx`
  - `frontend/components/workspace/aigc/aigc-precise-edit-dialog.tsx`
  - AIGC API、DAG、执行器、组件与浏览器验收测试

## ADDED Requirements

### Requirement: 四类统一模态节点

系统 SHALL 只向用户提供以下四种模态节点：

| 节点类型 | 显示名 | 输入端口 | 输出端口 | 本地内容 |
| --- | --- | --- | --- | --- |
| `text` | 文本节点 | `text: text`，可选、单值 | `text: text` | 文本、BBox 引用及说明 |
| `image` | 图片节点 | `image: image_asset`，可选、单值 | `image: image_asset` | 单个图片资产及可选 BBox |
| `video` | 视频节点 | `video: video_asset`，可选、单值 | `video: video_asset` | 单个视频资产 |
| `audio` | 音频节点 | `audio: audio_asset`，可选、单值 | `audio: audio_asset` | 单个音频资产 |

所有模态节点 SHALL 为非执行节点，不调用模型、不创建 Task Attempt。一个输出端口可以连接多个下游；输入端口最多接受一条入边。

#### Scenario: 从节点面板添加模态节点

- **WHEN** 用户打开节点面板
- **THEN** “模态”分组只显示文本、图片、视频和音频四种节点
- **AND** 不再显示独立“文本输入 / 图片输入 / 视频输入 / 音频输入 / 文本输出 / 图片输出 / 视频输出”

#### Scenario: 模态节点作为本地输入

- **WHEN** 模态节点没有上游入边
- **THEN** 文本节点使用本地文本，媒体节点使用本地选择或上传的资产
- **AND** 有效值从同模态输出端口提供给任意兼容下游

#### Scenario: 模态节点作为输出

- **WHEN** 模态节点接收到一个同模态上游结果且没有下游
- **THEN** 节点展示选中 Run 的上游结果
- **AND** 提供该模态对应的复制、预览、播放或下载能力
- **AND** 不需要再增加独立输出节点

#### Scenario: 模态节点作为中继

- **WHEN** 模态节点既有上游入边又有下游连线
- **THEN** 节点展示上游结果并从输出端口原样透传
- **AND** 不创建独立文本资产、媒体资产或任务，但在该节点 RunNode 中记录不可变的透传结果快照
- **AND** 下游使用同一个有效值与资产 ID

### Requirement: 上游优先与本地内容保留

系统 SHALL 根据入边自动派生模态节点模式，不保存额外 `mode` 字段：

- 无入边：`local`；
- 有一条入边：`upstream`。

`upstream` 模式下，上游值是唯一有效值。本地内容 SHALL 保留在节点配置中，但编辑、上传、资产选择、提示词优化和精准框选操作 SHALL 禁用，不得与上游值合并。

#### Scenario: 连接上游

- **WHEN** 用户为已有本地内容的模态节点连接上游
- **THEN** 节点立即切换为上游模式
- **AND** 本地内容保留并继续满足配置字段结构与资产引用约束，但不参与当前必填值校验、运行解析、展示结果或下游 Hash
- **AND** 界面明确提示“已连接上游，断开后恢复本地内容”

#### Scenario: 断开上游

- **WHEN** 用户删除模态节点唯一入边
- **THEN** 节点恢复本地模式
- **AND** 之前保留的本地文本、资产和合法 BBox 恢复显示并重新生效

#### Scenario: 拒绝第二条入边

- **WHEN** 模态节点已经存在一条入边
- **THEN** 前端连接阶段拒绝第二条入边
- **AND** 后端保存期与运行期校验同样拒绝绕过前端的重复输入

### Requirement: 模态值的 Run 解析与透传

系统 SHALL 在每次 Run 中为计划内模态节点创建 `RunNode`，但不创建 Task Attempt。

本地模式的模态节点在运行开始时解析为结果快照；上游模式的模态节点在其上游成功或复用后立即投影相同模态结果，并释放下游依赖。模态节点不得等到整个 Run 结束后才投影。

#### Scenario: 本地文本进入模型

- **WHEN** 本地文本节点连接到 LLM、文生图、图生图或生视频节点
- **THEN** 运行开始时文本节点解析为文本结果
- **AND** 下游从该结果取得文本
- **AND** 文本节点无 `current_task_id`

#### Scenario: 上游模型结果经过模态节点

- **WHEN** 模型节点成功输出图片并连接到图片节点，图片节点再连接另一个模型
- **THEN** 图片节点在上游成功后投影同一个图片资产
- **AND** 下游随后进入 ready 或执行状态
- **AND** 图片节点不复制资产、不创建任务

#### Scenario: 上游失败

- **WHEN** 上游节点失败、取消、超时或结果不可用
- **THEN** 依赖该上游的模态节点按现有传播语义进入 blocked 或 unavailable
- **AND** 其后代不会读取节点本地内容作为回退
- **AND** 独立分支继续运行

#### Scenario: 模态节点链

- **WHEN** 多个同模态节点首尾连接且图中无环
- **THEN** 有效值可依次透传到最终下游
- **AND** 每个模态节点均保留独立 RunNode 状态与结果
- **AND** 系统仍拒绝自环和任意间接环路

### Requirement: 文本模态行为

文本节点 SHALL 在本地模式提供现有基础文本、内嵌 BBox token、引用说明和提示词优化能力；在上游模式展示选中 Run 的文本结果并提供复制。

#### Scenario: 本地文本带 BBox 引用

- **WHEN** 本地文本节点与图片节点共同直接连接到普通图生图节点
- **THEN** 现有结构化 BBox 引用资格、顺序和运行时 `图N<bbox>…</bbox>` 编译保持不变

#### Scenario: 上游文本模式

- **WHEN** 文本节点连接 LLM 或另一个文本节点的输出
- **THEN** 本地文本和 BBox 编辑器变为只读非生效状态
- **AND** 节点显示选中 Run 的上游文本并支持复制
- **AND** 不把本地 BBox 引用编译进上游文本

#### Scenario: 上游结果尚未生成

- **WHEN** 文本节点有入边但当前未选择 Run或上游尚无结果
- **THEN** 节点显示等待结果状态
- **AND** 不显示本地文本冒充上游结果

### Requirement: 图片模态行为

图片节点 SHALL 在本地模式提供上传、资产选择、原图预览、精准框选和清除能力；在上游模式展示选中 Run 的图片结果，并提供原图预览与下载。

#### Scenario: 本地图片作为输入

- **WHEN** 图片节点无入边且绑定可用图片资产
- **THEN** 该资产可连接到图片模型或生视频节点
- **AND** Pipeline 资产引用与运行前资产校验保持不变

#### Scenario: 上游图片作为输出或中继

- **WHEN** 图片节点连接文生图、图生图或图层合成的图片输出
- **THEN** 节点按原始宽高比完整预览所选 Run 的图片
- **AND** 可预览、下载并继续连接到兼容下游
- **AND** 不创建重复图片资产

#### Scenario: 上游模式禁用精准框选

- **WHEN** 图片节点存在入边
- **THEN** 本地资产选择、上传和精准框选操作禁用
- **AND** 本地 `asset_id / bbox / bbox_asset_id` 保留但不参与有效值或 BBox 引用
- **AND** 断开上游后恢复本地精准框选状态

#### Scenario: 图片节点切换为上游模式

- **WHEN** 本地图片节点已有 BBox 和文本反向引用，随后连接上游图片
- **THEN** 图片 BBox 与关联文本 token 保留为暂停状态但不参与当前运行编译
- **AND** 配置界面明确标记引用因来源节点处于上游模式而暂停
- **AND** 保存不将暂停引用视为悬空错误

#### Scenario: 文本节点切换为上游模式

- **WHEN** 带 BBox 引用的本地文本节点连接上游文本
- **THEN** 其全部本地 BBox token 与说明保留为暂停状态但不参与运行编译
- **AND** 断开上游且相关图片节点仍为本地模式时引用恢复生效

### Requirement: 视频与音频模态行为

视频和音频节点 SHALL 在本地模式提供现有上传、资产选择和播放能力；在上游模式播放选中 Run 的上游资产，并可下载及继续透传。

#### Scenario: 视频节点接收生成或处理结果

- **WHEN** 视频节点连接生视频、视频画质增强或视频人脸打码节点
- **THEN** 节点使用共享视频播放器按原始宽高比播放
- **AND** 显示可获得的分辨率、时长、音频状态和处理元数据
- **AND** 提供受控下载

#### Scenario: 音频节点接收上游结果

- **WHEN** 音频节点接收到 `audio_asset`
- **THEN** 节点提供播放、时长、MIME 和受控下载能力
- **AND** 可将同一资产继续连接到生视频或未来兼容节点

#### Scenario: 当前没有音频生产模型

- **WHEN** 当前节点注册表没有输出 `audio_asset` 的模型节点
- **THEN** 音频节点仍提供可选输入端口以保持统一契约和未来兼容性
- **AND** 本地音频输入行为不受影响

### Requirement: 空值与纯模态 Pipeline 状态

系统 SHALL 区分可保存草稿与可执行有效值。模态节点本地值可以为空并保存；只有当该节点被计划内下游消费时，运行校验才要求非空文本或可用媒体资产。未被消费的空终端模态节点不阻止包含其他模型节点的 Run。

#### Scenario: 被模型消费的空本地节点

- **WHEN** 本地文本为空或本地媒体没有可用资产，且其输出连接到计划内模型节点
- **THEN** 运行前返回可定位到模态节点的 `invalid_input`
- **AND** 不创建下游模型任务

#### Scenario: 未被消费的空终端节点

- **WHEN** 空模态节点没有计划内下游
- **THEN** Pipeline 可以保存
- **AND** 包含其他有效模型分支的 Run 不因该节点失败
- **AND** 该节点 RunNode 保持 `idle` 且结果为空

#### Scenario: 仅包含模态节点

- **WHEN** Pipeline 不包含任何可执行模型或控制节点
- **THEN** 系统沿用现有规则拒绝创建 Run，并提示至少需要一个可执行节点

### Requirement: 模态节点结果与历史 Run

系统 SHALL 按当前选中 Run 的 definition snapshot 和 RunNode 为模态节点投影模式、状态与结果。切换历史 Run 时，节点状态、文本或资产、可用性和下载地址必须来自同一个 Run，不得混用当前 Pipeline definition、本地备用配置或其他 Run。

#### Scenario: 切换历史 Run

- **WHEN** 用户从当前 Run 切换到历史 Run
- **THEN** 上游模式模态节点显示历史 Run 对应结果
- **AND** 历史 Run 中的本地模式节点显示该 RunNode 冻结的本地结果快照
- **AND** 当前 definition 后续发生的文本、资产或连线修改不改变历史展示
- **AND** unavailable 历史资产显示不可用状态且不提供无效下载

#### Scenario: 模态节点作为终点

- **WHEN** 一个模态节点没有下游边
- **THEN** 它仍参与所选 Run 的结果投影
- **AND** 结果面板可展示其有效文本或媒体
- **AND** 它不改变 Run 是否成功的模型任务汇总规则

### Requirement: 节点显示与配置体验

统一节点 SHALL 沿用文本蓝、图片绿、视频橙、音频玫红的模态色。显示名按现有 definition 顺序编号为“文本节点N / 图片节点N / 视频节点N / 音频节点N”，单个同模态节点不追加编号。

#### Scenario: 本地模式卡片

- **WHEN** 模态节点没有入边
- **THEN** 卡片展示本地内容摘要和“本地”状态
- **AND** 右侧配置面板显示对应编辑或资产选择控件

#### Scenario: 上游模式卡片

- **WHEN** 模态节点存在入边
- **THEN** 卡片展示上游结果摘要和“上游”状态
- **AND** 右侧面板优先展示结果及复制、预览、播放、下载操作
- **AND** 本地配置收纳为只读备用内容，不与结果并列造成歧义

#### Scenario: 窄屏操作

- **WHEN** 视口小于 `1024px`
- **THEN** 模态节点配置与结果在现有互斥抽屉中完整可达
- **AND** 播放器、预览、文本、操作按钮和输入/输出 Handle 不重叠

### Requirement: Definition v1 到 v2 兼容迁移

系统 SHALL 将 Pipeline definition 版本升级为 `schemaVersion=2`，并以一份规范、前后端等价纯函数完成以下转换：

| v1 节点 | v2 节点 |
| --- | --- |
| `text_input` | `text` |
| `text_output` | `text` |
| `image_input` | `image` |
| `image_output` | `image` |
| `video_input` | `video` |
| `video_output` | `video` |
| `audio_input` | `audio` |

模型节点与控制节点类型保持不变。迁移 SHALL 保留 node ID、position、size 和 edge ID；现有端口 ID 已同为 `text / image / video / audio`，迁移不得重建或重排连线。

逐类型配置迁移规则如下：

| v1 类型 | v2 配置迁移 |
| --- | --- |
| `text_input` | 保留 `text`、有序 `bbox_references`，`title=null` |
| `text_output` | 本地 `text=""`、`bbox_references=[]`，保留 `title` |
| `image_input` | 保留 `asset_id / bbox / bbox_asset_id`，`title=null` |
| `image_output` | 本地 `asset_id / bbox / bbox_asset_id=null`，保留 `title` |
| `video_input` | 保留 `asset_id`，`title=null` |
| `video_output` | 本地 `asset_id=null`，保留 `title` |
| `audio_input` | 保留 `asset_id`，`title=null` |

缺失 `schemaVersion` 按 v1 处理；值为 `1` 时迁移；值为 `2` 时只做规范化；未知版本、同一 definition 混用 v1/v2 模态类型或迁移后出现额外未知配置字段时 SHALL 被拒绝，不得猜测修复。

#### Scenario: 迁移旧输入节点

- **WHEN** 系统读取 v1 `image_input`
- **THEN** 节点迁移为 v2 `image`
- **AND** `asset_id / bbox / bbox_asset_id` 原样保留
- **AND** 节点新增可选图片输入端口

#### Scenario: 迁移旧输出节点

- **WHEN** 系统读取 v1 `image_output`
- **THEN** 节点迁移为 v2 `image`
- **AND** 原入边、节点 ID、位置和尺寸保持不变
- **AND** 原 `title` 迁移为可选展示标题
- **AND** 节点新增图片输出端口

#### Scenario: 保存迁移后的 definition

- **WHEN** 用户保存由 v1 自动迁移的 Pipeline 或模板
- **THEN** 服务端持久化规范 v2 definition
- **AND** 后续读取不重复迁移或改变节点 ID

#### Scenario: 历史 Run 快照

- **WHEN** 用户查看迁移前创建的历史 Run
- **THEN** 历史 definition snapshot 保持不可变
- **AND** 前端可对 v1 快照执行只读迁移后展示旧输入/输出结果
- **AND** 不回写历史 Run 或 Task 数据

#### Scenario: 缺失或未知版本

- **WHEN** definition 未包含 `schemaVersion`
- **THEN** 系统按 v1 执行确定性迁移
- **WHEN** definition 版本不是 1 或 2，或混用 v1/v2 模态类型
- **THEN** 系统返回明确版本错误且不持久化

#### Scenario: 非法旧 definition

- **WHEN** v1 definition 本身包含类型错误、重复单值输入或环路
- **THEN** 迁移不得掩盖原错误
- **AND** 保存或运行返回包含 node ID / edge ID 的可定位错误

### Requirement: 模板与资产安全

模板创建、更新和实例化 SHALL 清除统一图片、视频和音频节点的本地 `asset_id`，并同步清除图片节点的 `bbox / bbox_asset_id`。任何指向被清除图片 BBox 的文本 `bbox_references`、token 与引用说明 SHALL 同步删除，禁止模板产生悬空引用。普通文本内容和输出标题可以保留。

#### Scenario: 上游模式媒体节点另存模板

- **WHEN** 有上游入边的图片、视频或音频节点被另存为模板
- **THEN** 本地备用 `asset_id` 仍被清除
- **AND** 入边和节点结构保留
- **AND** 模板不持有实例资产引用或临时下载 URL

#### Scenario: Pipeline 资产保护

- **WHEN** 模态节点本地配置引用媒体资产
- **THEN** 无论节点处于本地还是上游模式，`pipeline_assets` 都继续保护 definition 中保存的备用本地资产
- **WHEN** 模态节点仅透传上游资产
- **THEN** 不新增虚假的本地 Pipeline 资产引用
- **AND** 实际模型 Task 的输入/输出追溯继续由 `pipeline_task_assets` 表达

### Requirement: DAG 与缓存语义

统一模态节点 SHALL 参与拓扑依赖、增量执行和状态传播，但不计入模型执行节点集合。模态节点本地有效值或上游摘要变化必须使受影响下游模型的 `inputHash` 变化；未生效的备用本地内容变化不得使上游模式下游缓存失效。

#### Scenario: 修改本地有效值

- **WHEN** 本地模式文本或媒体节点内容变化
- **THEN** 依赖它的下游模型 `inputHash` 变化
- **AND** 不复用旧内容对应的缓存

#### Scenario: 修改未生效备用内容

- **WHEN** 上游模式节点的本地备用内容变化
- **THEN** 当前有效值和下游 `inputHash` 不变
- **AND** 断开上游后新的本地内容才参与 Hash

#### Scenario: 从模态节点继续执行

- **WHEN** 用户选择“从此节点继续”
- **THEN** 计划包含该模态节点的必要上游依赖和下游模型
- **AND** 可复用的模型祖先按现有规则复用
- **AND** 不为模态节点创建 Task Attempt

## MODIFIED Requirements

### Requirement: AIGC 节点注册表

节点注册表 SHALL 使用 `text / image / video / audio` 四类模态节点替代原输入/输出节点。模态节点类别为 `modality`，固定声明同类型可选输入与输出，`executable=false`。模型节点和控制节点保持现有类型、端口和可执行属性。

### Requirement: 非执行节点结果投影

非执行节点结果投影 SHALL 从“仅在 Run 末尾处理输出节点”改为“按拓扑即时解析模态节点”。本地模态节点在运行初始化阶段产生有效值，上游模态节点在依赖成功后产生透传值。输出展示不再依赖特殊 `*_output` 节点类型。

### Requirement: AIGC 结果展示

文本、图片、视频和音频结果 SHALL 由统一模态节点展示。文本支持复制；图片支持等比预览、原图和下载；视频支持等比播放、全屏和下载；音频支持播放和下载。模型节点自身的现有结果预览可以保留，但不得要求额外输出节点才能将结果用于展示或继续连接。

### Requirement: BBox 引用节点类型

BBox 引用 SHALL 使用本地模式 `image` 与本地模式 `text` 节点建立结构化绑定。上游模式模态节点不参与 BBox 编辑或运行时引用编译。现有同源唯一、最多 10 条、重新框选同步和安全标签规则保持不变。

### Requirement: 节点分类与自动编号

节点面板 SHALL 从“输入 / 模型 / 输出”调整为“模态 / 模型 / 控制”。自动编号 SHALL 按 `text / image / video / audio` 基础显示名分别计算；v1 只读快照在展示迁移后使用同一编号规则。

## REMOVED Requirements

### Requirement: 独立输入节点类型

**Reason**: 输入职责已由无上游入边的统一模态节点承担。

**Migration**: `text_input / image_input / video_input / audio_input` 自动迁移为同模态 v2 节点并保留本地配置。

### Requirement: 独立输出节点类型

**Reason**: 输出展示和终端消费已由有上游入边的统一模态节点承担。

**Migration**: `text_output / image_output / video_output` 自动迁移为同模态 v2 节点并保留入边和可选标题；音频无需迁移旧输出类型。

### Requirement: 仅在 Run 结束时投影输出节点

**Reason**: 统一模态节点可以作为中继，其结果必须在拓扑执行期间即时产生，才能释放下游。

**Migration**: 历史 Run 保持原快照；新 v2 Run 使用通用模态解析器，v1 历史展示通过只读迁移适配。
