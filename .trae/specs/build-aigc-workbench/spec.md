# AIGC 工作台 Spec

## Why

当前系统的 AIGC 能力分散在项目流程、图片画布和独立工具中，缺少可复用、可编排、可追踪执行的通用节点工作台。需要新增与“项目 / 资产库 / 工具”平级的“AIGC工作台”，让用户从模板创建独立画布，以 DAG 方式组合输入、模型和输出节点，并保存、运行、重试和复用结果。

## What Changes

- 顶部全局导航新增“AIGC工作台”，入口为 `/workspace/aigc`，与项目、资产库、工具平级。
- AIGC 列表页提供“画布模板”和“我的画布”两个视图；默认展示模板，支持按名称筛选，桌面端每行 5 个缩略图。
- 点击模板默认创建独立画布实例；模板只通过“编辑模板”入口修改，模板后续修改不影响已创建实例。
- 新建独立全屏画布页，保留全局顶部导航，主体使用 `100dvh - 4rem`；不使用弹窗或列表内展开。
- 画布使用 React Flow，包含节点面板、连线、画布工具栏、右侧配置/结果/运行面板和节点状态徽标。
- 首期支持文本输入、图片输入、LLM、文生图、图生图、文本输出、图片输出节点；条件、合并、参数控制、超分/修复、视频生成后续扩展。
- 前端显式引入 Zustand 管理画布会话状态，引入 React Query 管理模板、画布、运行和任务服务端状态及轮询。
- 后端新增模板、画布实例、运行、运行节点、节点任务、画布资产引用和任务资产关联模型；MySQL 使用原生 `JSON` 列保存定义与不可变快照，不使用 `JSONB`。
- 新增 DAG 校验、拓扑调度、增量执行、失败传播、重试、进程内有界任务队列、Worker 池、模型族并发限制和节点超时。
- 图片输入支持本地上传或从现有资产库选择；媒体输出自动进入现有资产库，并记录所属画布、运行、节点任务和输入/输出角色。
- **BREAKING（数据契约）**：用户草案中的 `taskId = node.id` 调整为稳定 `nodeId` 与唯一 `taskId` 分离；同一节点在每次运行/重试中产生唯一任务 ID，通过 `runId + nodeId` 建立投影关系。
- 首期明确为数据库租约保护的单活进程内调度能力；Redis/Celery、分布式 Worker、SSE、可靠远端取消、视频节点和控制节点不在本次验收范围。

## Impact

- Affected specs:
  - 顶部导航与工作区路由
  - React Flow 通用画布能力
  - 资产库与工具资产
  - ModelArk 文本/图片模型调用
  - 异步任务状态、错误脱敏与重试
  - MySQL/内存双仓储
- Affected code:
  - `frontend/components/layout/app-shell.tsx`
  - `frontend/app/workspace/aigc/**`
  - `frontend/components/workspace/aigc/**`
  - `frontend/components/canvas/**`
  - `frontend/lib/aigc/**`
  - `frontend/lib/api-client.ts`
  - `frontend/lib/api-types.ts`
  - `frontend/package.json`
  - `backend/app/db/models.py`
  - `backend/app/db/session.py`
  - `backend/app/schemas/aigc.py`
  - `backend/app/repositories/base.py`
  - `backend/app/repositories/memory.py`
  - `backend/app/repositories/mysql.py`
  - `backend/app/api/routes.py`
  - `backend/app/services/aigc_pipeline.py`
  - `backend/app/services/aigc_executor.py`
  - `backend/app/services/modelark.py`
  - 前后端相关测试

## 首期边界

### 纳入首期

- 单租户、单活调度器，沿用当前系统无用户身份的访问边界。
- 模板列表、我的画布列表、名称筛选、空白画布、从模板创建实例、编辑模板、另存为模板。
- 文本/图片输入，LLM/文生图/图生图执行，文本/图片输出。
- 全量执行、从指定节点增量执行、失败节点重试。
- 持久运行与节点任务状态、React Query 轮询、结果预览和媒体资产入库。
- 进程内 `asyncio.Queue` 与有界 Worker 池；重启恢复 queued 任务，安全终结中断的 running 任务。

### 不纳入首期

- 条件分支、合并、循环、动态子图和任意代码节点。
- 超分/修复、视频生成及第三方自定义模型节点。
- Redis/Celery/RQ/Arq、跨实例任务抢占、全局分布式限流、死信队列。
- SSE/WebSocket、多人协作、权限体系、模板市场、模板发布审核。
- exactly-once、远端任务可靠取消及供应商调用超时后的费用回滚。

## 确定性约束

| 项目 | 首期固定值/规则 |
| --- | --- |
| 名称 | 去除首尾空格后 1-120 字符；描述最多 500 字符 |
| 列表分页 | 默认 20 条，最大 100 条；按 `updated_at DESC, id ASC` 稳定排序 |
| 名称筛选 | 最多 120 字符，不区分大小写的包含匹配 |
| 列表列数 | `>=1280px` 为 5 列，`768-1279px` 为 3 列，`480-767px` 为 2 列，`<480px` 为 1 列 |
| 图规模 | 最多 100 个节点、200 条边 |
| 撤销历史 | 最多保留 50 个客户端图编辑快照 |
| 活动运行 | 同一 Pipeline 同时最多 1 个 `queued/running` Run；重复提交返回 `409` |
| 轮询 | 当前选中 Run 活跃时每 2 秒轮询；全部终态后停止 |
| 队列/Worker | 队列容量默认 100，Worker 默认 4；LLM 与图片并发默认各 2，均可通过配置覆盖 |
| 节点超时 | LLM 默认 120 秒；文生图/图生图默认 300 秒 |
| attempt | 首次为 1；同一 Run 内仅自动重试增加 attempt；手动重试创建新 Run 并从 1 开始 |
| 自动重试 | 仅网络错误、429、供应商 5xx；同一 Run 最多额外 2 次，总 attempt 最多 3 |
| definition | `schemaVersion=1`；顶层仅含 `nodes`、`edges`、`viewport` |
| 调度边界 | 首期同一时刻仅 1 个进程持有数据库 scheduler lease 并运行 Worker；其他进程只提供 API |

## 数据表约束

| 表 | 主键/唯一约束 | 关键外键与删除策略 |
| --- | --- | --- |
| `pipeline_templates` | UUID `id`；`revision >= 0` | 无项目归属；首期不提供删除 |
| `pipelines` | UUID `id`；`revision >= 0` | `source_template_id -> pipeline_templates.id ON DELETE SET NULL`；首期不提供删除 |
| `pipeline_assets` | `(pipeline_id, node_id, slot)` | Pipeline `CASCADE`；Asset `RESTRICT` |
| `pipeline_runs` | UUID `id`；`UNIQUE(pipeline_id, run_number)`；`UNIQUE(pipeline_id, idempotency_key)` | Pipeline `CASCADE`；source run `SET NULL` |
| `pipeline_run_nodes` | `(run_id, node_id)` | Run `CASCADE`；current/reused task 外键 `SET NULL` |
| `pipeline_tasks` | UUID `id`；`UNIQUE(run_id, node_id, attempt)`；`UNIQUE(run_id, node_id, idempotency_key)` | `(run_id, node_id) -> pipeline_run_nodes`；retry task `SET NULL` |
| `pipeline_task_assets` | `(task_id, direction, slot, ordinal)` | Task `CASCADE`；Asset `CASCADE`，删除资产后历史结果标记 unavailable |
| `pipeline_worker_lease` | 固定主键 `aigc_scheduler` | 保存 owner_id、单调 fencing_token、lease_expires_at 和 heartbeat_at |

所有状态、revision、attempt、时间、外键和幂等键使用普通列并建立必要索引；JSON 只保存定义、参数、输入、输出、错误和指标快照。应用创建 JSON 值，不依赖特定 MySQL 版本的 JSON 默认表达式。

## ADDED Requirements

### Requirement: 顶级导航与独立页面

系统 SHALL 在全局顶部导航中提供“AIGC工作台”入口，并为列表和画布编辑器提供独立路由。

#### Scenario: 进入 AIGC 工作台

- **WHEN** 用户点击顶部“AIGC工作台”
- **THEN** 页面跳转到 `/workspace/aigc`
- **AND** 顶部“AIGC工作台”标记为当前项

#### Scenario: 打开画布实例

- **WHEN** 用户新建画布、从模板创建实例或打开“我的画布”
- **THEN** 页面跳转到 `/workspace/aigc/pipelines/{pipelineId}`
- **AND** 画布作为新页面展示，不使用 Dialog 或列表内展开
- **AND** 顶部全局导航保留且“AIGC工作台”持续高亮
- **AND** 编辑区占满 `100dvh - 4rem` 的剩余视口

#### Scenario: 编辑模板

- **WHEN** 用户点击模板卡片的“编辑模板”
- **THEN** 页面跳转到 `/workspace/aigc/templates/{templateId}`
- **AND** 模板编辑器复用画布交互，但提供“保存模板”和“从模板创建画布”，不直接执行模板
- **AND** dirty 模板点击“从模板创建画布”时先保存模板；保存冲突或失败时不得实例化

### Requirement: 模板与我的画布列表

系统 SHALL 在 AIGC 列表页提供“画布模板”和“我的画布”两个视图，默认展示画布模板。

#### Scenario: 展示模板缩略图

- **WHEN** 用户进入模板视图
- **THEN** 模板按更新时间倒序展示
- **AND** 在宽屏桌面视口每行固定展示 5 个模板卡片
- **AND** 卡片显示由节点和连线定义派生的拓扑缩略图、模板名称、节点数量和更新时间
- **AND** 窄屏按 3 / 2 / 1 列响应，不得水平溢出

#### Scenario: 按名称筛选

- **WHEN** 用户输入模板或画布名称并提交筛选
- **THEN** 当前视图按名称执行不区分大小写的包含匹配
- **AND** 清空筛选恢复完整列表
- **AND** 无结果时展示明确空状态

#### Scenario: 从模板创建实例

- **WHEN** 用户点击模板卡片主体或“使用模板”
- **THEN** 系统复制模板当前 definition 和 revision 创建独立 Pipeline
- **AND** 新实例记录 `source_template_id` 和 `source_template_revision`
- **AND** 后续模板修改不自动改变实例
- **AND** 创建成功后跳转到该 Pipeline 的独立画布页

#### Scenario: 打开我的画布

- **WHEN** 用户切换到“我的画布”
- **THEN** 页面展示已保存 Pipeline，按更新时间倒序排列
- **AND** 卡片显示名称、拓扑缩略图、最近运行状态和更新时间
- **AND** 点击卡片打开对应独立画布页

### Requirement: 画布定义与编辑

系统 SHALL 使用版本化的画布定义保存节点、端口、连线、位置和视口，不在定义中保存运行时任务状态。

#### Scenario: 编辑画布

- **WHEN** 用户在节点面板添加节点、拖动节点、连接端口、修改配置或删除节点/连线
- **THEN** Zustand store 更新当前草稿和 dirty 状态
- **AND** React Flow 只渲染画布拓扑和节点状态投影
- **AND** 节点 ID 在该 Pipeline 生命周期内稳定且唯一

#### Scenario: 保存画布

- **WHEN** 用户点击“保存”
- **THEN** 客户端提交 `expected_revision` 与规范化 definition
- **AND** 后端保存成功后 revision 加一并清除 dirty 状态
- **AND** revision 冲突返回 `409`，前端提示重新加载或另存，不静默覆盖

#### Scenario: 执行存在未保存修改的画布

- **WHEN** 用户在 dirty 状态点击“执行画布”或“从此节点运行”
- **THEN** 前端先以当前 expected_revision 保存画布，保存成功后再使用返回的新 revision 创建 Run
- **AND** 保存冲突或失败时不得创建 Run
- **AND** 每个 Run 始终绑定一个已持久化的 Pipeline revision，不执行仅存在于浏览器内的草稿

#### Scenario: 离开未保存画布

- **WHEN** 当前画布存在未保存修改且用户导航离开
- **THEN** 系统显示离开确认
- **AND** 用户取消时保留当前页面和草稿

#### Scenario: 保存为模板

- **WHEN** 用户在 Pipeline 中点击“另存为模板”并填写有效名称
- **THEN** 系统基于当前已保存 definition 创建新模板
- **AND** 只保留节点配置、位置、连线和视口，不复制运行状态、taskId、进度、错误或结果投影
- **AND** 模板保留文本默认值和模型配置，但清除图片输入节点中的具体 assetId，避免模板持有实例资产引用
- **AND** 所有模板创建、更新和实例化入口均由后端 canonicalizer 强制清除 image_input.assetId；模板编辑模式不提供资产选择

### Requirement: 首期节点与端口契约

系统 SHALL 仅允许白名单节点类型，并使用强类型端口校验连线。

#### Scenario: 使用输入节点

- **WHEN** 用户添加 `text_input`
- **THEN** 节点提供可编辑文本并输出 `text`
- **WHEN** 用户添加 `image_input`
- **THEN** 节点支持本地上传或资产库选择，并输出 `image_asset`
- **AND** 输入节点不创建 PipelineTask

#### Scenario: 使用模型节点

- **WHEN** 用户添加 `llm`
- **THEN** 节点接收一个 `text` 输入，配置白名单文本模型、系统指令和温度，并输出 `text`
- **WHEN** 用户添加 `text_to_image`
- **THEN** 节点接收一个 `text` 提示词，配置白名单图片模型、画幅、分辨率和格式，并输出 `image_asset`
- **WHEN** 用户添加 `image_to_image`
- **THEN** 节点接收一个必填 `image_asset` 和一个必填 `text`，配置白名单图片模型、画幅、分辨率和格式，并输出 `image_asset`
- **AND** 每个模型节点在 Run 中都有 RunNode；只有实际执行 attempt 时 currentTaskId 非空
- **AND** idle/blocked/reused 模型节点可没有 currentTaskId，其中 reused 使用 reusedFromTaskId 指向来源

#### Scenario: 使用输出节点

- **WHEN** 用户添加 `text_output` 或 `image_output`
- **THEN** 节点分别只接受 `text` 或 `image_asset`
- **AND** 输出节点不创建 PipelineTask
- **AND** 输出节点展示用户当前选中 Run 的上游结果，并提供文本复制或图片预览/下载
- **AND** 未选择历史 Run 时默认选中当前活动 Run；没有活动 Run 时默认选中最近一次 Run

#### Scenario: 拒绝非法连线

- **WHEN** 用户连接类型不兼容的端口、创建自环、重复占用单值输入端口或形成环
- **THEN** 前端拒绝或撤销该连线并展示原因
- **AND** 输出端口允许连接多个下游，输入端口首期均为单值且最多接受一条入边
- **AND** 后端在保存和执行时重复校验，不信任客户端图结构

### Requirement: 画布交互布局

系统 SHALL 在独立画布页提供固定工具栏、左侧节点面板、中央 React Flow 画布和右侧详情面板。

#### Scenario: 使用画布工具

- **WHEN** 用户打开 Pipeline
- **THEN** 顶部工具栏显示返回列表、画布名称、保存状态、保存、另存为模板和执行画布
- **AND** 左侧节点面板按输入、模型、输出分组
- **AND** 中央区域支持平移、缩放、适应视图、节点选择、拖拽、连线和删除
- **AND** 右侧使用“配置 / 结果 / 运行”标签展示当前节点配置、结果预览和运行详情

#### Scenario: 窄屏使用画布

- **WHEN** 视口宽度低于 1024px 且不低于 360px
- **THEN** 中央画布继续占满可用区域
- **AND** 左侧节点面板和右侧详情面板改为由工具栏按钮打开的抽屉，同一时刻最多打开一个
- **AND** 工具栏使用图标与紧凑命令，不得与画布或抽屉重叠
- **AND** 视口宽度达到 1024px 时恢复固定左侧 `w-60` 和右侧 `w-72`

#### Scenario: 查看状态徽标

- **WHEN** Pipeline 存在当前运行
- **THEN** 模型节点显示 `idle / queued / running / succeeded / failed / canceled / blocked / reused / timed_out` 状态徽标
- **AND** 运行中节点显示阶段型进度，不虚构模型真实百分比
- **AND** 选中节点后右侧显示当前 taskId、attempt、耗时、错误或输出摘要

### Requirement: 模板、画布与运行持久化

系统 SHALL 使用规范化主表与 MySQL 原生 `JSON` 列保存 AIGC 数据。

#### Scenario: 保存模板和画布

- **WHEN** 系统持久化模板或 Pipeline
- **THEN** `pipeline_templates` 保存名称、描述、definition JSON、schema_version、revision 和时间
- **AND** `pipelines` 保存名称、来源模板及版本、definition JSON、schema_version、revision、最近运行状态和时间
- **AND** definition 顶层固定为 `schemaVersion`、`nodes`、`edges`、`viewport`
- **AND** 每个 node 内固定包含 id、type、position、size 和 config；端口由 node type 注册表定义，不由客户端任意声明
- **AND** 每条 edge 包含 id、sourceNodeId、sourceHandle、targetNodeId 和 targetHandle
- **AND** definition 不包含任务状态、供应商响应或临时签名 URL

#### Scenario: 保存画布资产引用

- **WHEN** Pipeline definition 包含图片输入节点的 assetId
- **THEN** 系统在保存 definition 的同一事务内同步维护 `pipeline_assets(pipeline_id, node_id, slot, asset_id)`
- **AND** 删除被 Pipeline 引用的资产必须返回 `409`
- **AND** 用户移除或替换节点资产后，旧引用关系随保存事务删除

#### Scenario: 创建运行快照

- **WHEN** 用户执行完整画布或从节点增量执行
- **THEN** `pipeline_runs` 保存 pipeline_id、运行序号、pipeline revision、definition_snapshot、input_snapshot、运行模式和状态
- **AND** 快照创建后不可被后续画布编辑修改
- **AND** 创建事务使用 `SELECT ... FOR UPDATE` 锁定 Pipeline 行，再检查活动 Run、分配 run_number 和写入 idempotency_key
- **AND** 同一 Pipeline 已存在 queued/running Run 时拒绝创建新 Run 并返回 `409`

#### Scenario: 保存运行节点投影

- **WHEN** PipelineRun 创建
- **THEN** 系统为 definition_snapshot 中每个节点创建唯一 `(run_id, node_id)` 的 `pipeline_run_nodes`
- **AND** RunNode 保存节点级 `idle / ready / queued / running / succeeded / failed / timed_out / canceled / blocked / reused` 状态、current_task_id、reused_from_task_id、input_hash 和结果摘要
- **AND** 不在本次增量执行范围内的节点保持 idle
- **AND** blocked/reused 等不产生执行 attempt 的状态也可独立持久化

#### Scenario: 保存节点任务

- **WHEN** 编排器为模型节点创建执行尝试
- **THEN** `pipeline_tasks` 保存唯一 taskId、runId、nodeId、attempt、type、深拷贝 params、upstream node IDs、状态、进度、结果摘要、错误、指标和时间
- **AND** `(run_id, node_id, attempt)` 唯一
- **AND** retry 通过 `retry_of_task_id` 保留链路
- **AND** 首个 attempt 为 1，分配 attempt 时锁定对应 RunNode；并发重复重试使用幂等键返回同一结果，不创建重复 attempt
- **AND** 数据库不在 task 行冗余 pipeline_id；API 通过 run 关系派生 pipelineId
- **AND** TaskAttempt DTO 提供 `taskId`、`pipelineId`、`runId`、`nodeId`、`attempt`、`type`、`params`、`upstream`、`status`、`progress`、`result`、`error`、`metrics.costTokens` 和 `metrics.durationMs`
- **AND** `result` 固定为 `{kind: "none"|"text"|"assets"|"unavailable", text?, textDigest?, assets: [{assetId, ordinal, mimeType, downloadUrl, available}]}`
- **AND** `downloadUrl` 是读取响应时生成的受控 URL；多图片结果按 ordinal 排序，首期模型默认只产生 1 张
- **AND** TaskAttempt 与 RunNode 共用该 Result DTO：未产出为 none，文本为 text，至少一个媒体资产可用为 assets，预期媒体结果全部删除/失效为 unavailable
- **AND** 历史 output_snapshot 保留 assetId 以返回 `available=false` 项，但任何 JSON 快照均不持久化临时签名 URL

### Requirement: nodeId 与 taskId 映射

系统 SHALL 将稳定画布节点身份与运行尝试身份分离。

#### Scenario: 首次执行节点

- **WHEN** run 中的可执行 node 首次入队
- **THEN** nodeId 保持画布定义中的稳定值
- **AND** 系统生成全局唯一 taskId
- **AND** API 返回 `nodeId`、结构化 `{runId, nodeId}` 以及展示键 `nodeRunKey = "{runId}:{nodeId}"`、`currentTaskId` 和 attempts

#### Scenario: 自动重试同一节点

- **WHEN** 自动重试策略再次执行同一 Run 的同一 node
- **THEN** nodeId 不变
- **AND** attempt 递增并创建新的 taskId
- **AND** 前端仍将最新任务状态投影到同一画布节点

### Requirement: DAG 校验与拓扑调度

系统 SHALL 在执行前严格校验 DAG，并只调度依赖已满足的模型节点。

#### Scenario: 校验可执行图

- **WHEN** 用户提交执行
- **THEN** 后端校验 schemaVersion、节点/边数量上限、唯一 nodeId、合法端点、端口类型、必填输入、节点配置、资产可访问性和 DAG 无环
- **AND** 图中必须至少包含 1 个模型节点；输出节点可选
- **AND** 校验失败返回 `422` 和可定位到 nodeId/edgeId 的安全错误，不创建运行

#### Scenario: 调度就绪节点

- **WHEN** 运行创建成功
- **THEN** 编排器按拓扑依赖计算 ready 节点
- **AND** 只有全部上游成功或复用成功的模型节点进入 queued
- **AND** 无依赖的独立分支可并发运行
- **AND** 输入和输出节点只参与数据解析与结果投影，不进入 Worker 队列

#### Scenario: 上游失败

- **WHEN** 一个模型节点最终失败或超时
- **THEN** 其后代节点标记为 blocked
- **AND** 不依赖该节点的独立分支继续运行
- **AND** Run 终态只汇总执行计划内的模型 RunNode：任一为 failed/timed_out/blocked 则 Run 为 failed；全部为 succeeded/reused 则为 succeeded；取消请求完成后为 canceled
- **AND** 增量范围外 idle 节点以及不产生任务的输入/输出节点不参与 Run 终态汇总

#### Scenario: 查看多个运行

- **WHEN** Pipeline 存在多个历史 Run
- **THEN** 右侧运行面板按创建时间倒序展示
- **AND** 默认选中当前活动 Run，否则选中最近一次 Run
- **AND** 用户切换历史 Run 时，节点徽标和输出节点只投影所选 Run，不混用其他 Run 的状态或结果

### Requirement: 任务队列与 Worker 池

系统 SHALL 为首期单实例部署提供持久任务记录、进程内有界队列和 Worker 池。

#### Scenario: 任务入队

- **WHEN** 节点满足执行条件
- **THEN** 系统先在数据库创建 queued PipelineTask，再写入有界 `asyncio.Queue`
- **AND** 队列满时保留 queued 状态并由调度扫描稍后入队，不丢弃任务

#### Scenario: Worker 执行

- **WHEN** Worker 获取 queued task
- **THEN** 使用原子状态更新将其 claim 为 running
- **AND** 根据 task type 调用模型网关
- **AND** LLM 与图片模型分别受可配置 semaphore 限制
- **AND** 节点超时后标记 timed_out，晚到结果不得覆盖终态

#### Scenario: 原子提交媒体结果

- **WHEN** 图片 Worker 得到供应商结果
- **THEN** 先将文件写入临时对象 key
- **AND** 再在数据库事务中锁定 Run/RunNode/Task，只有 Run 未请求取消且 Task 仍为 running 时才创建 Asset、任务资产关联并提交 succeeded
- **AND** 取消与成功提交以该数据库锁/CAS 为线性化点，先提交者生效
- **AND** CAS 失败或取消先发生时不得创建 Asset 记录，并 best-effort 删除临时对象；清理失败由可重试孤儿对象清理任务处理

#### Scenario: 服务重启恢复

- **WHEN** 后端启动
- **THEN** 调度器扫描 queued task 并重新入队
- **AND** 旧进程遗留的 running task 标记为 failed，错误码为 `worker_interrupted`
- **AND** 用户可从失败节点重试

#### Scenario: 获取调度租约

- **WHEN** 一个后端进程尝试启动 AIGC 调度器
- **THEN** 它必须通过 `pipeline_worker_lease` 原子获取固定 scheduler lease、递增单调 fencing_token 并周期续租
- **AND** 未持有有效 lease 的进程只提供 API，不运行队列扫描或 Worker
- **AND** lease 过期后其他进程可接管并执行恢复扫描
- **AND** task claim、自动重试、下游释放和结果提交均写入并校验当前 fencing_token；旧 owner 恢复后的写入 CAS 必须失败
- **AND** 该租约只提供单活调度保护，不等同于分布式任务队列

### Requirement: 模型网关与安全调用

系统 SHALL 通过白名单模型网关执行首期模型节点，不允许客户端提交任意 Endpoint、URL 或代码。

#### Scenario: 执行 LLM 节点

- **WHEN** LLM task 开始
- **THEN** 网关将上游文本与节点配置转换为 ModelArk 文本请求
- **AND** 结果文本写入 task output_snapshot
- **AND** 错误仅保存白名单错误码、请求 ID、阶段和安全消息

#### Scenario: 执行图片节点

- **WHEN** 文生图或图生图 task 开始
- **THEN** 网关将资产 ID 转换为受控临时签名 URL
- **AND** 图生图不得直接接受用户任意外部 URL
- **AND** 成功结果转存对象存储并创建媒体资产
- **AND** 临时签名 URL、密钥、供应商原始响应和堆栈不得写入 JSON 快照或 API 响应

### Requirement: 重试与增量执行

系统 SHALL 支持受控自动重试、失败节点手动重试和从节点开始的增量执行。

#### Scenario: 自动重试瞬时错误

- **WHEN** task 遇到白名单网络错误、429 或供应商 5xx
- **THEN** 系统最多自动重试 2 次并使用指数退避
- **AND** 每次尝试创建新 taskId
- **AND** 非瞬时参数/内容安全错误不自动重试

#### Scenario: 手动重试失败节点

- **WHEN** 用户在失败节点点击重试
- **THEN** 系统基于失败 Run 的不可变快照创建 `mode=retry_node` 的新 Run，并记录 sourceRunId/sourceNodeId
- **AND** 新 Run 中目标节点 attempt 从 1 开始，目标及后代执行，祖先按增量规则复用或补算
- **AND** 原失败 Run 保持终态不变，不重新进入轮询
- **AND** 当前 Pipeline 已有活动 Run 时返回 `409`
- **AND** retry 请求必须携带 `Idempotency-Key`；同一 key 的重复请求返回同一新 Run

#### Scenario: 从节点增量执行

- **WHEN** 用户选择“从此节点运行”
- **THEN** 系统创建新的 PipelineRun
- **AND** 强制执行目标 node 及其后代
- **AND** 目标节点祖先优先复用当前 Pipeline 最近成功且输出资产仍存在的匹配结果
- **AND** 任一必需祖先没有可复用结果、inputHash 已变化或资产已删除时，该祖先及其受影响下游自动补算
- **AND** 不在模板实例之间、Pipeline 之间或项目之间复用结果
- **AND** 被复用节点状态为 reused，并记录来源 taskId

#### Scenario: 计算 inputHash

- **WHEN** 系统判断节点结果能否复用
- **THEN** 使用 UTF-8、键排序、无多余空白的 canonical JSON 计算 SHA-256
- **AND** 输入包含 nodeType、executorVersion、model、规范化 config，以及按 `targetHandle/sourceNodeId/sourceHandle` 排序的上游摘要
- **AND** 文本摘要使用内容 SHA-256；资产摘要使用 assetId、objectKey、sizeBytes 和 updatedAt

#### Scenario: 取消运行

- **WHEN** 用户取消 queued/running Run
- **THEN** ready/queued 节点和未开始后代立即标记 canceled
- **AND** running task 记录 cancellation_requested 并尝试取消本地 await
- **AND** 供应商请求可能继续执行和计费；取消后返回的晚到结果必须丢弃且不得创建输出资产
- **AND** 所有 running task 收敛后 Run 标记 canceled

### Requirement: 资产输入与输出归档

系统 SHALL 允许复用现有资产或上传新图片，并将模型媒体输出自动归档到现有资产库。

#### Scenario: 从资产库选择图片

- **WHEN** 用户为图片输入节点选择现有兼容图片资产
- **THEN** Pipeline definition 只保存 assetId
- **AND** 执行时后端重新校验资产存在、状态成功且类型兼容
- **AND** 不复制原资产文件

#### Scenario: 本地上传图片

- **WHEN** 用户在图片输入节点上传有效图片
- **THEN** 系统将文件保存为现有资产库可见的独立输入资产
- **AND** metadata 标记 `origin=aigc` 和上传来源
- **AND** 画布节点保存返回的 assetId

#### Scenario: 保存模型输出

- **WHEN** 文生图或图生图节点成功
- **THEN** 系统创建现有资产库可见的输出图片资产
- **AND** `pipeline_task_assets` 记录 taskId、direction、slot、ordinal 和 assetId
- **AND** 可通过 task -> run -> pipeline 追溯所属画布和运行
- **AND** 文本输出不创建媒体资产，保存在任务结果快照并由文本输出节点展示

#### Scenario: 判断增量缓存有效

- **WHEN** 增量计划检查 LLM 来源 task
- **THEN** output_snapshot 中存在完整文本和内容摘要即视为结果存在
- **WHEN** 增量计划检查图片来源 task
- **THEN** 关联的 output asset 必须仍存在且可访问，否则缓存失效并补算

### Requirement: 前端状态分层

系统 SHALL 使用 Zustand 管理客户端画布会话，使用 React Query 管理服务端资源与运行轮询。

#### Scenario: 管理画布会话

- **WHEN** 用户编辑画布
- **THEN** Zustand store 管理 nodes、edges、viewport、selection、dirty、revision 和有限历史
- **AND** 高频 React Flow 更新使用细粒度 selector，避免整个页面无关重渲染
- **AND** 不在 Zustand 复制模板列表、资产列表或完整运行实体

#### Scenario: 管理任务状态

- **WHEN** 当前 PipelineRun 存在 queued 或 running task
- **THEN** React Query 按固定间隔轮询运行详情
- **AND** 根据用户当前选中 Run 的 RunNode 状态派生节点徽标与结果，不把服务端实体复制进 Zustand
- **AND** 全部任务进入终态后停止轮询并刷新资产查询
- **AND** 首期不要求 SSE，查询 key 和服务接口应允许后续替换为事件订阅

### Requirement: API 契约

系统 SHALL 提供模板、Pipeline、运行、任务和 AIGC 上传 API，并使用一致的状态码和 revision 语义。

#### Scenario: 管理模板

- **WHEN** 前端管理模板
- **THEN** 后端提供：
  - `GET /api/aigc/node-registry`
  - `GET /api/aigc/templates?q=&page=&page_size=`
  - `POST /api/aigc/templates`
  - `GET /api/aigc/templates/{templateId}`
  - `PUT /api/aigc/templates/{templateId}`
  - `POST /api/aigc/templates/{templateId}/instantiate`
- **AND** node registry 仅返回服务端配置并启用的节点类型、模型、参数枚举、端口契约和默认超时，不接受客户端扩展任意模型 ID

#### Scenario: 管理 Pipeline

- **WHEN** 前端管理我的画布
- **THEN** 后端提供：
  - `GET /api/aigc/pipelines?q=&page=&page_size=`
  - `POST /api/aigc/pipelines`
  - `GET /api/aigc/pipelines/{pipelineId}`
  - `PUT /api/aigc/pipelines/{pipelineId}`
  - `POST /api/aigc/pipelines/{pipelineId}/templates`

#### Scenario: 执行和查询

- **WHEN** 前端执行或查询 Pipeline
- **THEN** 后端提供：
  - `POST /api/aigc/pipelines/{pipelineId}/runs`
  - `GET /api/aigc/pipelines/{pipelineId}/runs`
  - `GET /api/aigc/runs/{runId}`
  - `POST /api/aigc/runs/{runId}/nodes/{nodeId}/retry`
  - `POST /api/aigc/runs/{runId}/cancel`
  - `POST /api/aigc/assets/images`
- **AND** 创建 run 请求必须包含 `expectedRevision`、`mode=full|from_node`；from_node 时必须包含 `startNodeId`，并携带 `Idempotency-Key`
- **AND** full 模式强制执行全部模型节点，不复用历史结果
- **AND** retry 请求携带 `Idempotency-Key`
- **AND** 同一资源与同一 `Idempotency-Key` 的重复 run/retry 请求返回首次创建的实体，不重复创建
- **AND** Run 详情固定为 `{run, nodes}`；每个 RunNode DTO 提供 `nodeId`、`includedInPlan`、`status`、`currentTaskId`、`reusedFromTaskId`、`inputHash`、`result` 和按 attempt 升序的 `attempts: TaskAttempt[]`
- **AND** `attempts` 只属于 RunNode 聚合，单个 TaskAttempt 不重复包含 attempts
- **AND** 创建 run 返回 `202`
- **AND** revision 冲突返回 `409`
- **AND** 已有活动 Run 或重复非幂等请求返回 `409`
- **AND** 图或节点配置非法返回 `422`
- **AND** 不存在资源返回 `404`

## MODIFIED Requirements

### Requirement: 顶部导航项集合

顶部导航 SHALL 包含品牌标识、`项目 / 资产库 / 工具 / AIGC工作台` 四个一级入口及既有“进入工作台”操作；AIGC 子路由均保持“AIGC工作台”高亮。

### Requirement: 资产库来源展示

现有资产库 SHALL 展示 AIGC 本地上传图片和模型输出图片。资产卡片应根据 metadata 与任务关联显示“AIGC 输入”或“AIGC 输出”，并允许正常预览和下载；删除仍遵守现有确认与引用保护规则。

#### Scenario: 删除被引用的 AIGC 资产

- **WHEN** 资产仍被当前 Pipeline definition 的 `pipeline_assets` 引用
- **THEN** 删除请求返回 `409` 并说明引用来源
- **WHEN** 资产仅被终态 Run 的 `pipeline_task_assets` 引用
- **THEN** 用户确认后允许删除资产，关联行通过 `ON DELETE CASCADE` 移除，历史结果显示 unavailable，后续增量缓存判定为失效
- **WHEN** 资产被 queued/running Run 的 `pipeline_task_assets` 引用
- **THEN** 删除请求返回 `409`，直至 Run 进入终态
- **AND** 不扫描 definition JSON 判断引用；`pipeline_assets` 和 `pipeline_task_assets` 是引用保护的权威来源

### Requirement: React Flow 通用容器

现有图片项目画布与新 AIGC 画布 SHALL 复用无业务语义的 React Flow 容器能力，但节点类型、节点 action context、任务逻辑和业务面板保持隔离。不得以继承或复制 `ImageCanvasPage` 的方式构建 AIGC 编排器。

## REMOVED Requirements

无。
