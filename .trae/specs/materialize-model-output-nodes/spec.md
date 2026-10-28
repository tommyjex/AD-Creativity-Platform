# 自动物化模型输出节点 Spec

## Why

AIGC 画布目前允许模型节点直接展示结果，但用户若希望在画布中保留、查看或继续传递图片和视频，仍需在运行前手工添加并连接对应模态节点。本变更让终端图片/视频模型在结果可用后自动物化一个统一模态节点，并立即展示本次 Run 的主结果。

## What Changes

- 图片或视频模型节点的主媒体输出成功或复用成功后，若该输出尚无对应自动节点且没有任何下游连线，系统自动创建一个对应的 `image` 或 `video` 统一模态节点。
- 自动节点与来源模型建立标准同模态连线，持久化到最新 Pipeline definition，并记录来源模型、输出 Handle 和来源 Run。
- 新节点在当前 Run 中立即展示来源模型的主结果；后续 Run 按普通模态节点拓扑投影。
- 重跑复用同一个自动节点，更新来源 Run 与备用资产，同时保留用户移动、缩放、重命名和额外下游连线。
- 用户已手工连接任意下游时不自动添加节点，避免重复节点和改变既有 DAG。
- 用户删除自动连线后，节点转为普通本地模态节点并保留当前媒体；后续成功运行可重新创建新的自动节点。
- Run definition snapshot 保持不可变；系统 revision 通过现有受限三方合并同步到前端。
- 自动节点创建失败不得回滚已成功的模型任务，只记录脱敏结构化事件并允许后续刷新或运行重试。

## Impact

- Affected specs:
  - AIGC 统一模态节点
  - 模型结果投影
  - Pipeline definition revision 与自动保存
  - 生成媒体资产引用
  - 画布自动布局与历史 Run
- Affected code:
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/aigc_executor.py`
  - `backend/app/services/aigc_dag.py`
  - `backend/app/repositories/base.py`
  - `backend/app/repositories/memory.py`
  - `backend/app/repositories/mysql.py`
  - 新增或复用后端 definition 物化 helper
  - `frontend/lib/aigc/types.ts`
  - `frontend/lib/aigc/definition-migration.ts`
  - `frontend/lib/aigc/editor-store.ts`
  - `frontend/lib/aigc/result-projection.ts`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - 相关后端、前端与 Playwright 测试

## Definitions

### 可自动物化的模型输出

可自动物化的模型输出必须同时满足：

1. 节点注册表类别为 `model`；
2. 节点成功或复用成功；
3. 结果包含一个可用的主 `image_asset` 或 `video_asset`；
4. 对应主输出 Handle 在最新 Pipeline definition 中没有任何出边，或仅存在指向同一来源键自动节点的既有受管连线。

首期覆盖：

- `text_to_image`、`image_to_image` 的主 `image` 输出；
- `video_generation`、`video_enhancement`、`video_face_blur` 的主 `video` 输出。

`llm` 文本、`video_subtitle_extraction` 字幕及 `control` 类节点不在本期范围。

### 自动模态节点

自动模态节点是系统为一个终端模型主输出创建的统一 `image` 或 `video` 节点。其配置 SHALL 记录：

- `generated_by_model_node_id`：来源模型节点 ID；
- `generated_output_handle`：来源主输出 Handle；
- `generated_from_run_id`：最近一次提供可用结果的 Run ID。

同一 Pipeline 内 `(generated_by_model_node_id, generated_output_handle)` SHALL 唯一。

## ADDED Requirements

### Requirement: 成功后自动创建对应模态节点

系统 SHALL 在可自动物化的模型输出变为可用后，向最新 Pipeline definition 原子添加一个对应模态节点及连线。

#### Scenario: 文生图成功且没有下游

- **WHEN** `text_to_image` 节点成功产生可用主图片
- **AND** 其 `image` 输出在最新 definition 中没有出边
- **THEN** 系统创建一个 `image` 节点
- **AND** 创建 `source=image model:image → target=image node:image` 的标准连线
- **AND** 新节点立即展示本次 Run 的主图片

#### Scenario: 生视频成功且没有下游

- **WHEN** `video_generation` 节点成功产生可用主视频
- **AND** 其 `video` 输出在最新 definition 中没有出边
- **THEN** 系统创建一个 `video` 节点
- **AND** 创建 `source=video model:video → target=video node:video` 的标准连线
- **AND** 新节点立即播放并支持放大、全屏和下载本次 Run 的主视频

#### Scenario: 缓存复用产生可用结果

- **WHEN** 模型节点以 `reused` 状态取得可用主媒体结果
- **AND** 满足自动物化条件
- **THEN** 系统执行与新任务成功相同的幂等物化
- **AND** 不为自动节点创建 Task Attempt 或复制媒体资产

#### Scenario: 已有下游连线

- **WHEN** 模型主输出尚无对应自动节点，但已连接手工统一模态节点、另一个模型或其他合法下游
- **THEN** 系统不创建自动模态节点
- **AND** 不修改、重排或删除任何现有节点和连线

### Requirement: 单一主结果与派生产物边界

每个来源模型主输出 SHALL 最多物化一个自动模态节点。自动节点仅展示该输出端口按既有投影规则选择的主结果。

#### Scenario: 图片任务返回多个图片资产

- **WHEN** 图片模型结果包含多个可用图片资产
- **THEN** 系统只创建一个 `image` 节点
- **AND** 该节点投影主图片 ordinal `0`
- **AND** 其他图片继续在模型结果页按现有多产物规则展示

#### Scenario: 视频任务同时返回视频和尾帧

- **WHEN** 生视频结果包含主视频和独立视频尾帧图片
- **THEN** 系统只为 `video` 主输出创建一个 `video` 节点
- **AND** 不为尾帧自动创建额外 `image` 节点
- **AND** 尾帧继续在原视频模型结果页和资产库按既有规则展示

#### Scenario: 结果不可用

- **WHEN** 模型任务失败、取消、超时或主媒体结果 unavailable
- **THEN** 系统不创建或更新自动模态节点
- **AND** 不使用旧 Run 结果冒充本次结果

### Requirement: 自动节点布局、复用与用户编辑

系统 SHALL 将新自动节点放置在来源模型右侧的最近无碰撞位置。首次创建后，节点 ID SHALL 稳定复用。

#### Scenario: 首次自动布局

- **WHEN** 来源模型右侧默认位置可用
- **THEN** 自动节点位于来源模型右侧并保持清晰间距
- **AND** 连线方向与现有左入右出布局一致

#### Scenario: 默认位置被占用

- **WHEN** 来源模型右侧与现有节点发生碰撞
- **THEN** 系统按确定性垂直槽位搜索最近无碰撞位置
- **AND** 不移动任何用户已有节点

#### Scenario: 重跑更新已有自动节点

- **GIVEN** 来源模型已有对应自动节点
- **WHEN** 后续 Run 再次成功或复用成功
- **THEN** 系统复用原节点和连线
- **AND** 更新 `generated_from_run_id` 与备用媒体资产为最新主结果
- **AND** 保留用户设置的位置、尺寸、自定义名称和该节点的额外下游连线

### Requirement: 解除自动关系

用户 SHALL 可以删除来源模型到自动模态节点的连线，将该节点转为普通本地模态节点。

#### Scenario: 删除自动连线

- **WHEN** 用户删除来源模型到自动节点的系统创建连线
- **THEN** 节点保留 ID、位置、尺寸、自定义名称和当前媒体资产
- **AND** 清除 `generated_by_model_node_id`、`generated_output_handle` 和 `generated_from_run_id`
- **AND** 节点切换为普通本地模式并可继续编辑或连接

#### Scenario: 解除后再次运行

- **WHEN** 原模型之后再次成功且主输出没有其他出边
- **THEN** 系统创建一个新的自动模态节点
- **AND** 已解除关系的本地节点不被更新、删除或重新接管

#### Scenario: 删除自动节点

- **WHEN** 用户删除自动节点
- **THEN** 节点与入边按现有删除规则移除
- **AND** 后续满足条件的成功运行可重新创建自动节点

### Requirement: 当前 Run 立即投影且历史 Run 隔离

系统 SHALL 保持 Run definition snapshot 与 RunNode 集合不可变。前端只可针对具有完整自动来源元数据的节点，为匹配 `generated_from_run_id` 的当前选中 Run 投影来源模型结果。

#### Scenario: 当前 Run 首次创建节点

- **WHEN** 自动节点在模型成功后才加入最新 Pipeline definition
- **AND** `generated_from_run_id` 等于当前选中 Run
- **THEN** 前端从该 Run 的来源模型 RunNode 投影主媒体结果
- **AND** 无需修改该 Run 的 definition snapshot 或追加 RunNode

#### Scenario: 切换到其他历史 Run

- **WHEN** 用户选择的历史 Run 不等于自动节点的 `generated_from_run_id`
- **AND** 该历史 Run snapshot 中不包含该节点
- **THEN** 自动节点不得显示其他 Run 的媒体结果
- **AND** 结果区显示等待或无可用结果状态

#### Scenario: 后续 Run 包含自动节点

- **WHEN** 新 Run 的 definition snapshot 已包含自动节点和连线
- **THEN** 执行器按普通非执行模态节点投影结果
- **AND** 不使用前端即时投影例外覆盖权威 RunNode

### Requirement: 原子 revision 与前端安全合并

后端物化 SHALL 在 Pipeline 行锁内读取最新 definition，只修改来源模型拥有的自动节点与连线，并将 revision 递增一次。前端 SHALL 复用受限三方合并，不得用完整服务端 definition 覆盖本地未保存编辑。

#### Scenario: 本地画布 clean

- **WHEN** 自动物化提交新 revision
- **THEN** 前端刷新 Pipeline 并显示新节点与连线

#### Scenario: 本地存在未保存修改

- **WHEN** 自动物化与用户移动、配置、连线或重命名同时发生
- **THEN** 前端合并服务端自动节点增量
- **AND** 保留不冲突的本地编辑
- **AND** 基于最新 revision 继续自动保存

#### Scenario: 来源节点在运行中被删除或改变

- **WHEN** 模型任务完成时，最新 definition 中来源节点已删除、类型变化或目标输出不再有效
- **THEN** 系统跳过自动物化
- **AND** 已成功的模型任务和媒体资产保持成功
- **AND** 记录不含媒体 URL、Provider 正文或凭据的结构化事件

### Requirement: 自动物化失败降级

自动输出节点属于画布便利能力，不得改变模型任务结果。

#### Scenario: 物化事务失败

- **WHEN** definition 校验、仓储提交或 revision 合并失败
- **THEN** 模型任务仍保持 `succeeded` 或 `reused`
- **AND** 不保留半个节点、孤立连线或部分 revision
- **AND** 系统记录稳定错误类型和来源 node/run/pipeline 标识
- **AND** 用户刷新或再次运行时可幂等重试

## MODIFIED Requirements

### Requirement: 统一模态节点配置

`image` 与 `video` 配置 SHALL 可选保存自动来源字段。三个自动来源字段必须同时为空或同时有效；普通本地节点和用户手工连接的上游节点无需这些字段。自动节点的 `asset_id` 作为断开后的本地备用值，在自动关系有效时仍严格以上游 Run 结果为展示和下游有效值。

### Requirement: 非执行节点结果投影

非执行模态节点继续按 Run definition snapshot 与 RunNode 投影。唯一例外是首次物化且不在当前 snapshot 中的自动节点：仅当其来源模型、输出 Handle 和来源 Run 全部匹配当前选中 Run 时，前端可即时投影该来源模型的主结果。不得对普通当前 definition 节点或不匹配的历史 Run 使用该例外。

### Requirement: Pipeline 资产引用

自动 `image` 或 `video` 节点保存的备用 `asset_id` SHALL 纳入 `pipeline_assets` 保护。自动节点投影和连线 SHALL 复用同一媒体资产，不创建重复资产、虚假 Task Attempt 或额外 `pipeline_task_assets` 输出关系。

## REMOVED Requirements

无。

## Non-Goals

- 不自动创建文本、音频、字幕、图层集或编辑图层节点。
- 不为 `control` 类节点自动创建媒体节点。
- 不为一个模型的多张图片或视频尾帧创建多个自动节点。
- 不修改当前 Run definition snapshot 或动态追加 RunNode。
- 不提供关闭自动物化的 Pipeline 或用户级开关。
