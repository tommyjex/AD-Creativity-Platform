# AIGC 分支运行隔离 Spec

## Why
同一画布中的多个生图分支可以共享 LLM、JSON Parser 等上游节点，但旧运行隔离逻辑按无向连通子图划分流程。共享上游会使所有分支被视为同一流程，后发 Run 会覆盖兄弟分支的结果，也无法并行提交。

## What Changes
- 将局部 Run 的并发冲突范围改为“起始节点及其全部下游节点”。
- 将局部 Run 的状态与结果投影范围改为“冲突范围及执行所需的全部上游节点”。
- 允许下游冲突范围不相交的分支并行，即使它们共享上游且上游没有缓存。
- 前端按节点选择最新相关 Run，不再按整张无向连通图选择唯一 Run。
- 分支 Run 启动、完成或失败时，仅更新共享依赖及自身分支，不清空兄弟分支已有结果。
- 局部预检只覆盖当前分支及其必要依赖，不被无关兄弟分支配置阻塞。
- 历史 Run 通过已有 `definition_snapshot`、`mode` 和 `start_node_id` 采用新规则，无需数据迁移。
- 不改变 Run 创建 API、数据库结构、节点任务契约或资产契约。

## Impact
- Affected specs:
  - `isolate-aigc-connected-flow-runs`
  - AIGC DAG 局部执行
  - Run 并发冲突
  - 节点级 Run 状态与结果投影
- Affected code:
  - `backend/app/aigc_run_scope.py`
  - `backend/app/services/aigc_dag.py`
  - `backend/app/services/aigc_executor.py`
  - `backend/app/repositories/memory.py`
  - `backend/app/repositories/mysql.py`
  - `frontend/lib/aigc/run-scope.ts`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - AIGC 后端、前端及 Playwright 验收测试

## Definitions

### 冲突范围
局部 Run 的冲突范围 SHALL 为 `start_node_id` 本身及从该节点沿有向边可达的全部下游节点。

- `full` Run 的冲突范围为快照中的全部节点。
- `from_node` 和 `retry_node` 使用各自 `start_node_id` 的下游闭包。
- 共享上游不属于下游分支 Run 的冲突范围。
- 起始节点不存在时必须拒绝请求，不得退化为全画布范围。

### 投影范围
局部 Run 的投影范围 SHALL 为：

1. 起始节点及其全部下游节点；
2. 为执行上述节点所需的全部递归上游依赖。

投影范围与 `build_aigc_execution_plan` 的 relevant 节点语义保持一致。普通兄弟输出分支不属于投影范围；如果另一分支是当前下游汇合节点的必要上游输入，则它作为依赖被纳入投影范围。

### 共享上游并行
两个局部 Run 只按冲突范围判定是否冲突。即使投影范围因共享上游而相交，只要冲突范围不相交，两个 Run 仍可并行。

共享上游没有可复用缓存时，系统允许每个 Run 独立计算该上游。重复调用产生的任务、结果和资产均归属各自 Run，不得跨 Run 覆盖或复用未完成结果。

## ADDED Requirements

### Requirement: 有向分支范围计算
系统 SHALL 在前后端提供语义一致的有向下游范围和依赖投影范围计算。

#### Scenario: 共享上游的兄弟分支
- **GIVEN** JSON Parser 分别连接文生图分支 A、B 和 C
- **WHEN** 从分支 A 的文生图节点创建 Run
- **THEN** 冲突范围只包含分支 A 文生图节点及其下游输出
- **AND** 投影范围包含分支 A 的必要上游依赖
- **AND** 两个范围均不包含分支 B、C 的节点

#### Scenario: 从共同上游运行
- **WHEN** 从 JSON Parser 或更早的共同上游创建 Run
- **THEN** 其冲突范围包含所有可达下游分支
- **AND** 该 Run 与任一分支局部 Run 冲突

#### Scenario: 多输入下游节点
- **WHEN** 当前分支的下游节点依赖多个上游输入
- **THEN** 投影范围包含这些输入的全部递归上游
- **AND** 冲突范围仍只由起始节点的下游闭包决定

### Requirement: 共享上游分支并行
系统 SHALL 允许冲突范围不相交的局部 Run 在同一 Pipeline 中同时处于 `queued` 或 `running`。

#### Scenario: 共享上游已有缓存
- **GIVEN** 分支 A 与 B 共享上游且缓存可复用
- **WHEN** 两个分支同时提交
- **THEN** 两个 Run 均创建成功并独立执行

#### Scenario: 共享上游没有缓存
- **GIVEN** 分支 A 与 B 共享上游且没有可复用缓存
- **WHEN** 两个分支同时提交
- **THEN** 两个 Run 均创建成功
- **AND** 每个 Run 可独立计算共享上游
- **AND** 任一 Run 的完成、失败或取消不改变另一 Run 的任务状态

#### Scenario: 同一分支重复提交
- **GIVEN** 分支 A 已有活动 Run
- **WHEN** 再次从分支 A 或其上游覆盖范围内提交相交 Run
- **THEN** 后端原子返回现有 `ActiveRunConflictError` 语义

#### Scenario: Full Run 冲突
- **GIVEN** 任一局部分支存在活动 Run
- **WHEN** 提交 `full` Run
- **THEN** 后端拒绝提交
- **AND** 活动 `full` Run 同样阻止所有局部分支 Run

### Requirement: 兄弟分支结果保留
系统 SHALL 为每个节点独立选择其最新相关 Run，不得使用兄弟分支的 Run 覆盖该节点。

#### Scenario: 后发分支不清空已有图片
- **GIVEN** 文生图分支 A 已成功生成图片
- **WHEN** 文生图分支 B 开始运行
- **THEN** 分支 A 的文生图节点和图片输出节点继续显示原成功结果
- **AND** 分支 A 不显示运行中状态

#### Scenario: 后发分支成功
- **GIVEN** 分支 A 与 B 分别成功
- **THEN** 两个分支分别显示各自最近成功资产
- **AND** 结果面板按当前选中节点展示对应分支结果

#### Scenario: 兄弟分支失败
- **GIVEN** 分支 A、B 已成功
- **WHEN** 分支 C 运行失败
- **THEN** 分支 A、B 的图片结果保持可见和可下载
- **AND** 失败状态只投影到分支 C 及其相关依赖

#### Scenario: 共享上游状态
- **GIVEN** 两个并行 Run 均计算同一共享上游
- **THEN** 共享上游节点可以显示最新相关活动 Run
- **AND** 兄弟分支节点仍分别解析到各自 Run

### Requirement: 节点级 Run 详情选择
前端 SHALL 加载每个当前节点所需的最新终态 Run、最新成功 Run、全部活动 Run和显式选择的历史 Run。

前端 SHALL 仅使用 Run 列表已有的 `definition_snapshot`、`mode` 和 `start_node_id` 计算投影范围，不依赖详情请求成功后才能判断 Run 与节点的关系。

#### Scenario: 多个分支对应不同历史 Run
- **GIVEN** 分支 A 最近结果来自 Run #4，分支 B 来自 Run #5
- **THEN** 前端同时加载 Run #4 和 Run #5 的详情
- **AND** 任一详情请求完成不得从缓存或投影中移除另一 Run

#### Scenario: 选择历史 Run
- **WHEN** 用户选择分支 B 的历史 Run
- **THEN** 只对该 Run 投影范围内的节点应用历史状态
- **AND** 分支 A 继续显示自身最新结果

### Requirement: 分支级提交状态
前端 SHALL 按冲突范围判断局部提交中状态。

#### Scenario: 两个分支请求同时提交
- **GIVEN** 分支 A 的创建 Run 请求尚未返回
- **WHEN** 用户从冲突范围不相交的分支 B 提交
- **THEN** 分支 B 的按钮保持可用并可并行提交

#### Scenario: 相交分支请求
- **GIVEN** 分支 A 的创建 Run 请求尚未返回
- **WHEN** 用户从与 A 冲突范围相交的节点提交
- **THEN** 前端阻止重复请求

### Requirement: 分支级预检
系统 SHALL 始终校验整个快照的基础图结构，包括节点与边引用、端口兼容、重复边和环。局部 Run 的节点配置完整性、资产可用性和模态特定约束 SHALL 只预检其投影范围。

#### Scenario: 兄弟分支配置无效
- **GIVEN** 分支 A 配置有效，兄弟分支 B 配置无效
- **WHEN** 用户从分支 A 提交局部 Run
- **THEN** 前后端对分支 A 及其必要依赖执行配置、资产和模态预检并允许提交
- **AND** `full` Run 仍校验整张画布

#### Scenario: 兄弟分支结构无效
- **GIVEN** 画布存在悬空边、非法端口或环
- **WHEN** 用户提交任一局部 Run
- **THEN** 系统拒绝运行，因为快照基础图结构不合法

## MODIFIED Requirements

### Requirement: Run 范围
`isolate-aigc-connected-flow-runs` 中局部 Run 使用“无向连通子图”的要求修改为：

- 并发冲突使用有向下游闭包。
- 状态、结果、历史记录和预检使用执行依赖投影范围。
- 无向连通范围不再参与局部 Run 冲突、结果选择或 pending 状态判断。

### Requirement: Run 查询与轮询
前端 SHALL 根据 Run summary 的快照字段按节点遍历当前定义并收集最新相关 Run ID。Run ID 去重后批量获取详情；活动 Run 继续独立轮询至终态。

### Requirement: Repository 活动 Run 冲突
Memory 与 MySQL Repository SHALL 在现有原子区段内比较新旧 Run 的冲突范围。投影范围重叠但冲突范围不相交时不得返回 409。

## REMOVED Requirements

### Requirement: 同一连通子图内不同分支禁止并行
**Reason**: 共享上游会将独立输出分支合并成一个巨大流程，直接导致兄弟分支结果覆盖且无法并行，违背当前产品需求。

**Migration**: 不迁移数据库。历史局部 Run 在查询和投影时根据快照重新计算冲突范围与投影范围。

## Error Handling
- 非法或缺失 `start_node_id` 继续返回校验错误。
- 冲突范围相交继续使用现有 HTTP 409 契约。
- 单个 Run 详情加载失败只影响其投影范围，不清空其他分支。
- 并行共享上游中的一个任务失败时，只按该 Run 的 DAG 传播失败。
- 不通过“失败时回退整张无向连通图”规避错误；无法计算范围时应明确失败。

## Testing
- 后端范围测试覆盖共享上游、多输入、线性链、分支、孤立节点、`full` 和历史快照。
- Memory/MySQL Repository 契约测试覆盖共享上游无缓存并行、相交范围冲突、并发原子性和幂等。
- Executor 测试覆盖共享上游重复计算、两个文生图分支并行、独立完成、失败和取消。
- 前端单元测试覆盖 Run 详情选择、节点投影、pending 范围、历史选择和兄弟结果保留。
- Playwright Fixture 使用“共同上游 JSON Parser -> 三个文本 -> 三个文生图 -> 三个图片输出”的真实拓扑。
- Playwright 在桌面、平板和移动视口验证并行运行、结果保留、失败隔离、无控制台错误和无布局重叠。
- 自动化验收使用 Mock 网关，不调用真实生图或其他计费接口。

## Non-Goals
- 不新增可编辑 `flow_id`、分组框或分支管理 UI。
- 不在并行 Run 之间共享进行中的上游任务。
- 不保证共享上游无缓存时只调用一次 Provider。
- 不改变单个 Run 内部已有 DAG 并发调度和缓存算法。
- 不改变同一冲突范围内的单活动 Run 约束。
- 不修改 Pipeline 或 Run 的公开请求响应字段。
