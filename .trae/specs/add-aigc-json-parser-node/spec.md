# AIGC JSON 解析器节点 Spec

## Why

AIGC 画布中的 LLM 节点可以输出 JSON 文本，但现有节点只能把整段文本作为单值继续传递，无法把指定数组拆分为多个可独立编排的文本结果。系统需要新增 JSON 解析器节点，将 JSONPath 命中的数组按顺序物化为多个统一文本节点。

## What Changes

- 新增控制节点 `json_parser`，接收一个上游文本并通过 JSONPath 选择一个数组。
- 支持纯 JSON 文本和仅包裹一层 Markdown JSON 代码块的文本。
- 将数组 item 序列化为文本，最多生成 20 个受管文本节点。
- 解析成功后由后端原子创建、更新或收敛自动文本节点及连线。
- 重跑时按 item 索引复用节点，保留用户位置和下游连线。
- 保持 Run definition snapshot 不可变；首次生成的节点从后续 Run 开始参与 DAG。
- 前端处理后端系统 revision 更新，并与本地未保存编辑安全合并。
- 为解析、物化和拓扑变化提供稳定错误码、状态展示与测试。

## Impact

- Affected specs:
  - AIGC 节点注册表与 Pipeline definition
  - AIGC DAG 校验与执行器
  - AIGC Run 结果与状态投影
  - AIGC Pipeline revision 与自动保存
  - AIGC 统一文本节点
- Affected code:
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/aigc_dag.py`
  - `backend/app/services/aigc_executor.py`
  - `backend/app/services/aigc_pipeline.py`
  - `backend/app/repositories/base.py`
  - `backend/app/repositories/memory.py`
  - `backend/app/repositories/mysql.py`
  - `frontend/lib/aigc/types.ts`
  - `frontend/lib/aigc/node-registry.ts`
  - `frontend/lib/aigc/editor-store.ts`
  - `frontend/lib/aigc/result-projection.ts`
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - 后端 DAG、执行器、仓储及前端组件、状态和浏览器测试

## Definitions

### 受管文本节点

受管文本节点是由一个 JSON 解析器依据数组 item 自动创建的统一 `text` 节点。其配置 SHALL 保存：

- `generated_by_parser_node_id`：来源解析器节点 ID；
- `generated_item_index`：0-based item 索引；
- `generated_from_run_id`：最近一次提供内容的 Run ID。

同一 Pipeline 内，`(generated_by_parser_node_id, generated_item_index)` SHALL 唯一。受管关系只由来源解析器到该文本节点的系统生成连线维持；用户主动删除该连线后，节点 SHALL 转为普通本地文本节点并清除以上来源字段。

### 额外下游连线

额外下游连线是除来源解析器到受管文本节点的系统生成连线之外，以该文本节点为 source 的任意连线。该定义用于判断 item 减少时能否安全删除节点。

## ADDED Requirements

### Requirement: JSON 解析器节点契约

系统 SHALL 新增 `json_parser` 控制节点，显示名为“JSON 解析器”。节点 SHALL：

- 提供一个必填输入端口 `text`，类型为 `text`，最多一条入边；
- 提供一个输出端口 `items`，类型为 `text`，允许最多 20 条系统生成连线；
- 配置 `json_path`，默认值为 `$.items`；
- 不调用外部模型；
- 作为确定性执行节点创建 RunNode 和 Task Attempt。

JSONPath SHALL 使用后端成熟解析库执行。保存期和运行期都必须校验表达式语法，前后端不得各自实现不一致的 JSONPath 解释器。

#### Scenario: 添加 JSON 解析器

- **WHEN** 用户从“控制”分组添加 JSON 解析器
- **THEN** 画布创建一个默认 `json_path="$.items"` 的节点
- **AND** 节点可接收 LLM、文本节点或其他文本输出

#### Scenario: 配置 JSONPath

- **WHEN** 用户在右侧配置面板修改 JSONPath
- **THEN** 系统在本地提供语法反馈
- **AND** 保存期和运行期由后端执行权威校验

#### Scenario: 非法连接

- **WHEN** 用户连接第二条文本入边、非文本入边或手工向 `items` 端口连接任意节点
- **THEN** 前端拒绝该连接
- **AND** 后端保存和运行校验同样拒绝绕过前端的非法 definition

### Requirement: JSON 输入规范化

解析器 SHALL 接受以下输入：

1. 去除首尾空白后的纯 JSON 文本；
2. 仅由一个 Markdown `json` 代码块包裹的 JSON 文本，代码块外只允许空白。

系统 SHALL 使用标准 JSON 解析器，不得使用字符串切割、正则表达式或代码执行解析 JSON。代码块外存在其他说明文字、JSON 为空或 JSON 非法时，解析任务 SHALL 失败。

#### Scenario: 解析纯 JSON

- **WHEN** 上游文本是合法 JSON
- **THEN** 解析器使用该 JSON 作为 JSONPath 输入

#### Scenario: 解析 Markdown JSON 代码块

- **WHEN** 上游文本仅包含一个合法的 Markdown JSON 代码块
- **THEN** 系统移除代码块边界后解析其中 JSON

#### Scenario: 拒绝混合说明文字

- **WHEN** JSON 代码块前后存在非空说明文字
- **THEN** 任务失败并返回 `json_parser_invalid_json`
- **AND** 不创建、更新或删除任何文本节点

### Requirement: JSONPath 数组选择

`json_path` SHALL 精确匹配一个 JSON 值，且该值必须为数组。数组长度 SHALL 为 0 至 20。

#### Scenario: 命中一个数组

- **WHEN** JSONPath 精确命中一个长度不超过 20 的数组
- **THEN** 系统按数组原始顺序生成 item 列表

#### Scenario: 无匹配

- **WHEN** JSONPath 没有匹配
- **THEN** 任务失败并返回 `json_parser_path_not_found`

#### Scenario: 多匹配

- **WHEN** JSONPath 返回多个匹配结果
- **THEN** 任务失败并返回 `json_parser_path_ambiguous`

#### Scenario: 匹配值不是数组

- **WHEN** JSONPath 唯一命中的值不是数组
- **THEN** 任务失败并返回 `json_parser_result_not_array`

#### Scenario: 超过上限

- **WHEN** 数组包含 21 个或更多 item
- **THEN** 任务失败并返回 `json_parser_item_limit_exceeded`
- **AND** 错误包含实际数量和上限 20
- **AND** Pipeline definition 不发生部分修改

### Requirement: Item 文本序列化

系统 SHALL 将每个 item 确定性转换为文本：

- JSON string：使用字符串值本身，不附加引号；
- object、array、number、boolean 和 null：使用 UTF-8、键排序、无多余空白的标准 JSON 文本；
- item 顺序保持数组顺序；
- 输出文本及摘要 SHALL 写入解析器 Task 和 RunNode 的结构化结果快照。

解析器结果 SHALL 使用专用结构化结果类型表达 item 列表，不得将整个数组拼成一个普通文本结果后再依赖前端二次解析。

#### Scenario: 混合类型数组

- **WHEN** 数组包含字符串、对象、数组、数字、布尔值和 null
- **THEN** 每个 item 按规定独立转换为文本
- **AND** 相同 JSON 输入始终产生相同文本和摘要

#### Scenario: 空数组

- **WHEN** JSONPath 命中空数组
- **THEN** 解析任务成功并记录空 item 列表
- **AND** 系统执行受管节点收敛，不创建新节点

### Requirement: 首次原子物化

解析任务成功后，后端 SHALL 在锁定当前 Pipeline 行的事务内，将 item 列表物化为受管文本节点和系统生成连线。物化 SHALL：

- 针对每个索引创建一个统一 `text` 节点；
- 节点标题为“JSON 项 N”，其中 N 为 1-based 序号；
- 节点本地文本为该 item 的序列化文本；
- 创建 `json_parser.items -> text.text` 连线；
- 保存受管来源字段；
- 在解析器右侧按稳定纵向间距排列，并以现有节点布局边界避免明显重叠；
- 原子更新 definition 和 Pipeline revision。

任何一个节点、边或 definition 校验失败时，整个物化事务 SHALL 回滚。解析 Task 进入失败状态，不得保留部分节点。

#### Scenario: 首次生成多个节点

- **WHEN** 解析器首次成功得到 3 个 item
- **THEN** 系统创建 3 个受管文本节点和 3 条系统连线
- **AND** 节点分别显示对应 item 文本
- **AND** Pipeline revision 只递增一次

#### Scenario: 页面关闭时完成

- **WHEN** 解析器运行期间用户关闭或刷新画布页面
- **THEN** 后端仍完成物化
- **AND** 用户再次打开页面时可看到生成的文本节点

#### Scenario: 来源解析器已变化

- **WHEN** Run 完成前，当前 Pipeline 中的来源解析器已被删除或改为其他类型
- **THEN** 系统不创建幽灵节点
- **AND** Task 失败并返回 `json_parser_source_changed`

### Requirement: Run 快照与首次运行边界

已创建 Run 的 `definition_snapshot` SHALL 保持不可变。首次运行中物化的文本节点不得追加到该 Run 的快照、执行计划或 RunNode 集合。

新节点 SHALL 在当前 Pipeline 中立即可见并显示本次 item 文本。它们从下一次基于新 revision 创建的 Run 开始，按正常 DAG 规则创建 RunNode、接收对应索引结果并释放自身下游。

#### Scenario: 首次运行

- **WHEN** Run 快照中尚不存在受管文本节点
- **THEN** 解析器成功后物化节点
- **AND** 当前 Run 不动态增加 RunNode
- **AND** 当前 Run 的其他既有分支不受影响

#### Scenario: 后续运行

- **WHEN** 新 Run 的快照已包含解析器和受管文本节点
- **THEN** 解析器成功后，各受管文本节点按索引投影本次 item
- **AND** 对应下游按正常依赖规则继续执行

### Requirement: 重跑收敛

解析器重跑成功后，系统 SHALL 按 `generated_item_index` 收敛受管文本节点：

- 相同索引：复用节点 ID、位置、尺寸和额外下游连线，更新文本与 `generated_from_run_id`；
- 新增索引：创建新受管文本节点和系统连线；
- 消失索引且无额外下游连线：删除受管节点及系统连线；
- 消失索引且存在额外下游连线：保留节点和连线，清除本次有效结果并标记“无对应 item”；
- 不得把上一 Run 的旧文本作为本次有效上游值。

#### Scenario: Item 数量增加

- **GIVEN** 上次生成 2 个受管节点
- **WHEN** 本次得到 4 个 item
- **THEN** 前 2 个节点按序复用
- **AND** 系统补建索引 2 和 3 的节点

#### Scenario: Item 数量减少且无下游

- **GIVEN** 上次生成 4 个受管节点
- **WHEN** 本次只得到 2 个 item
- **THEN** 前 2 个节点按序复用
- **AND** 后 2 个无额外下游的节点被删除

#### Scenario: Item 数量减少且有下游

- **GIVEN** 消失索引对应的文本节点已有额外下游连线
- **WHEN** 本次不再产生该索引
- **THEN** 节点和用户连线被保留
- **AND** 节点显示“无对应 item”
- **AND** 本次 Run 中依赖该节点的后代进入 `blocked`

#### Scenario: 保留用户布局

- **WHEN** 用户移动或调整受管节点尺寸后重新运行
- **THEN** 复用节点保持用户设置的位置和尺寸

### Requirement: 受管关系解除

用户 SHALL 可以通过删除来源解析器到受管文本节点的系统连线，将该节点转为普通本地文本节点。解除后：

- 保留节点 ID、位置、尺寸、标题和当前文本；
- 清除全部受管来源字段；
- 后续解析器运行不再更新或删除该节点；
- 若对应索引仍存在，系统新建一个受管文本节点承接该索引。

#### Scenario: 用户解除受管关系

- **WHEN** 用户删除解析器到“JSON 项 2”的系统连线
- **THEN** 该节点转为普通本地文本节点
- **AND** 下次运行重新创建索引 1 对应的受管节点

#### Scenario: 用户删除受管节点

- **WHEN** 用户直接删除一个受管文本节点
- **THEN** 节点及其连线正常删除
- **AND** 下次运行在对应 item 仍存在时重建该索引

### Requirement: Revision 与前端同步

后端物化 SHALL 基于当前最新 definition 做受限合并，只允许修改来源解析器拥有的受管节点和系统连线，不得覆盖其他用户节点、配置、位置、连线、名称或 viewport。

物化提交后，前端 SHALL 刷新 Pipeline 实体和 revision：

- 本地无未保存修改时，用最新 definition 更新画布；
- 本地存在未保存修改时，将服务端受管节点增量合并到当前草稿，并以服务端最新 revision 继续自动保存；
- 同一受管键冲突时以后端物化内容为准，其他用户编辑保持不变；
- 不得静默用完整服务端 definition 覆盖本地草稿。

#### Scenario: 物化与自动保存串行

- **WHEN** 自动保存先提交，随后解析器物化
- **THEN** 物化读取最新 revision 并保留刚保存的用户修改

#### Scenario: 物化先于自动保存

- **WHEN** 后端先递增 revision，前端随后以旧 revision 保存
- **THEN** 前端获取最新 definition
- **AND** 仅重放本地用户修改与受管节点增量
- **AND** 不丢失任一方修改

### Requirement: UI 与状态反馈

节点面板 SHALL 在“控制”分组展示“JSON 解析器”。节点卡片和右侧配置面板 SHALL 展示 JSONPath、解析状态、item 数量和最近错误。

受管文本节点 SHALL 使用文本模态蓝色，并以只读上游模式展示内容。节点需显示来源解析器名称及“JSON 项 N”，但不得展示截断 UUID 作为主要名称。

#### Scenario: 解析成功

- **WHEN** JSON 解析器成功输出 5 个 item
- **THEN** 节点卡片显示“5 项”
- **AND** 新增或更新的 5 个文本节点出现在画布

#### Scenario: 解析失败

- **WHEN** JSON 或 JSONPath 校验失败
- **THEN** 节点卡片和运行面板显示失败
- **AND** 用户可看到稳定错误码和可操作的中文说明
- **AND** 上一次成功物化的节点保持原状

## MODIFIED Requirements

### Requirement: AIGC 节点注册表

控制节点注册表 SHALL 包含 `json_parser`。后端与前端注册表 SHALL 对节点类型、分类、可执行性、端口 ID、端口类型、多连接限制和默认配置保持一致。

### Requirement: AIGC Task 结果

`AigcTaskResult` SHALL 增加可表达有序文本 item 列表的结构化结果类型，并为每项保存索引、文本和摘要。该结果用于 Run 详情、重试、缓存摘要、后续受管文本节点投影和历史展示。

### Requirement: DAG 校验与运行范围

JSON 解析器 SHALL 参与正常拓扑排序、连通子图范围、活动 Run 冲突、取消、重试、失败传播和缓存。解析器没有合法上游文本时不可运行；解析失败只阻塞其后代，不影响独立子图。

### Requirement: 模板规范化

模板 SHALL 保留 JSON 解析器及 `json_path`，但清除受管文本节点中的 `generated_from_run_id` 和运行结果。没有可复用静态意义的自动内容 SHALL 不作为模板实例的有效上游结果；模板实例需在首次运行后重新物化。

## Error Handling

系统 SHALL 至少提供以下稳定错误码：

- `json_parser_invalid_path`
- `json_parser_invalid_json`
- `json_parser_path_not_found`
- `json_parser_path_ambiguous`
- `json_parser_result_not_array`
- `json_parser_item_limit_exceeded`
- `json_parser_source_changed`
- `json_parser_materialization_failed`

错误响应、Run 快照和日志不得包含完整上游 JSON、密钥、供应商原始响应或堆栈。允许记录输入长度、JSONPath、匹配数量、item 数量、索引和安全摘要。

## Testing

- 后端 schema/registry 测试覆盖节点、配置和端口契约。
- JSON 解析单元测试覆盖纯 JSON、Markdown 代码块、非法 JSON、JSONPath 无匹配/多匹配/非数组、空数组及 20/21 项边界。
- 序列化测试覆盖全部 JSON 类型、Unicode、键排序和稳定摘要。
- Memory/MySQL 仓储测试覆盖原子物化、唯一受管键、revision 递增、并发自动保存和回滚。
- Executor 测试覆盖首次物化、后续 Run 投影、重跑增删、受保护节点、失败传播、取消、重试、缓存和独立子图。
- 前端测试覆盖节点添加、JSONPath 编辑、系统 revision 合并、受管节点展示、解除受管关系及错误状态。
- Playwright 在桌面与移动视口验证 LLM 到 JSON 解析器的首次运行、重跑增减、用户移动节点和下游连线保留。

## Non-Goals

- 不允许一个 JSONPath 同时拆分多个数组。
- 不支持超过 20 个 item 的分页或分批物化。
- 不在首次 Run 中动态修改 `definition_snapshot` 或追加 RunNode。
- 不自动为生成的文本节点连接新的模型节点。
- 不提供通用 JSON 编辑器、JSON Schema 校验器、字段映射器或表达式计算器。
- 不解析包含代码块外说明文字的混合 LLM 响应。

