# AIGC 连通子图运行隔离 Spec

## Why
同一张 AIGC 画布可以包含多个互不连线的独立流程，但当前前后端都把 Run 状态绑定到整个 Pipeline。任一流程运行时会禁用其他流程，并可能用单个 Run 的状态或结果覆盖整张画布。

## What Changes
- 将画布中按边的无向连通关系形成的每个连通子图定义为独立流程。
- 允许同一 Pipeline 内范围不相交的流程并行运行。
- 同一流程仍保持单活动 Run 约束，避免重复执行和结果竞争。
- 前端按节点所属流程解析活动 Run、最近 Run、状态、结果和操作权限。
- 历史 Run 仅投影到其所属流程，不覆盖其他流程。
- 保持顶部“执行全部”为整张画布操作；任一流程运行时禁止再次执行全部。
- 修正并发完成时 `latest_run_status` 的更新规则，防止旧 Run 覆盖较新 Run 摘要。

## Impact
- Affected specs: AIGC DAG 执行、Run 并发控制、画布状态投影、运行历史
- Affected code:
  - `backend/app/services/aigc_dag.py`
  - `backend/app/services/aigc_executor.py`
  - `backend/app/repositories/base.py`
  - `backend/app/repositories/memory.py`
  - `backend/app/repositories/mysql.py`
  - `frontend/lib/aigc/queries.ts`
  - `frontend/lib/aigc/run-scope.ts`
  - `frontend/components/workspace/aigc/aigc-run-context.tsx`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`

## Definitions

### Flow Scope
流程范围 SHALL 通过 Run 的 `definition_snapshot` 推导：

- 将 DAG 边视为无向边。
- `from_node` 和 `retry_node` Run 的范围为 `start_node_id` 所在连通子图的全部节点。
- `full` Run 的范围为快照中的全部节点。
- 无连线的孤立节点自身构成一个流程。
- 非法或缺失的 `start_node_id` SHALL 在提交阶段被拒绝，不得退化为全画布范围。

该设计不新增持久化 `flow_id`；节点 ID 集合是流程范围的稳定标识。运行期间即使当前画布发生变化，已启动 Run 仍以自身快照为准。

## ADDED Requirements

### Requirement: 连通子图范围计算
系统 SHALL 提供前后端语义一致的流程范围计算能力。

#### Scenario: 两个独立流程
- **WHEN** 画布包含两个没有任何连线关系的子图
- **THEN** 系统将其识别为两个不同流程

#### Scenario: 分支仍属于同一流程
- **WHEN** 节点通过上游、下游或分支间接连通
- **THEN** 系统将这些节点识别为同一流程

#### Scenario: 孤立节点
- **WHEN** 节点没有任何边
- **THEN** 该节点独立构成一个流程

### Requirement: 后端并行 Run 隔离
系统 SHALL 允许同一 Pipeline 中流程范围不相交的 Run 并行存在。

#### Scenario: 不同流程并行运行
- **GIVEN** 流程 A 存在 `queued` 或 `running` Run
- **WHEN** 用户提交流程 B 的 Run，且 A、B 节点集合不相交
- **THEN** 后端原子创建流程 B 的 Run

#### Scenario: 同一流程重复运行
- **GIVEN** 流程 A 存在 `queued` 或 `running` Run
- **WHEN** 用户再次提交流程 A 中任一节点的 Run
- **THEN** 后端返回活动 Run 冲突且不创建新 Run

#### Scenario: 执行全部与活动流程冲突
- **GIVEN** 任一流程存在活动 Run
- **WHEN** 用户提交 `full` Run
- **THEN** 后端返回活动 Run 冲突

#### Scenario: 活动 full Run 阻止局部运行
- **GIVEN** Pipeline 存在活动 `full` Run
- **WHEN** 用户提交任一流程的局部 Run
- **THEN** 后端返回活动 Run 冲突

#### Scenario: 并发提交原子性
- **WHEN** 两个请求同时提交同一流程的 Run
- **THEN** 仅一个请求创建成功

### Requirement: Pipeline 最新状态一致性
系统 SHALL 使 `latest_run_status` 始终表示最大 `run_number` 对应 Run 的当前状态。

#### Scenario: 较早 Run 后完成
- **GIVEN** Run #10 与 Run #11 在不同流程并行执行
- **WHEN** Run #10 在 Run #11 之后完成
- **THEN** Pipeline 的 `latest_run_status` 仍反映 Run #11，而不是 Run #10

### Requirement: 前端多流程状态投影
系统 SHALL 按节点所属流程提供对应 Run，不得将单个 Run 作为整张画布的全局状态。

#### Scenario: 一个流程运行
- **GIVEN** 流程 A 正在运行且流程 B 空闲
- **THEN** 仅流程 A 的节点显示运行状态
- **AND** 流程 B 的节点保留自己的最近结果和状态

#### Scenario: 多流程同时运行
- **GIVEN** 流程 A 与流程 B 同时存在活动 Run
- **THEN** 两个流程分别轮询和展示各自 Run
- **AND** 任一 Run 完成不会清除或覆盖另一流程状态

#### Scenario: 最近结果隔离
- **GIVEN** 流程 A 和流程 B 最近一次成功来自不同 Run
- **THEN** 两个流程分别显示各自最近成功结果

#### Scenario: 历史记录隔离
- **WHEN** 用户选择流程 A 的历史 Run
- **THEN** 仅流程 A 投影该历史状态和结果
- **AND** 流程 B 继续显示自身活动或最近 Run

### Requirement: 流程级操作权限
系统 SHALL 仅根据目标流程是否存在活动 Run 决定局部操作是否可用。

#### Scenario: 其他流程仍可执行
- **GIVEN** 流程 A 正在运行
- **WHEN** 用户选中流程 B 的可执行节点
- **THEN** “从此节点运行”保持可用

#### Scenario: 当前流程禁止重复执行
- **GIVEN** 流程 A 正在运行
- **WHEN** 用户选中流程 A 的节点
- **THEN** 该流程的运行操作被禁用

#### Scenario: 局部执行预检隔离
- **GIVEN** 流程 A 存在无效配置且流程 B 配置有效
- **WHEN** 用户从流程 B 的节点运行
- **THEN** 系统仅预检流程 B 并允许提交
- **AND** 顶部“执行全部”仍预检整张画布

#### Scenario: 取消操作
- **WHEN** 用户取消流程 A 的活动 Run
- **THEN** 仅流程 A 的 Run 被取消
- **AND** 流程 B 的 Run 不受影响

#### Scenario: 执行全部按钮
- **GIVEN** 任一流程存在活动 Run
- **THEN** 顶部“执行全部”按钮被禁用

## MODIFIED Requirements

### Requirement: Run 查询与轮询
前端 SHALL 从 Run 列表识别全部活动 Run，并获取每个活动 Run 的详情。对于无活动 Run 的流程，前端 SHALL 选择该流程范围内最新的相关终态 Run 作为结果投影。轮询 SHALL 仅持续到对应 Run 进入终态。

### Requirement: Run Context
Run Context SHALL 从单一 `runDetail` 改为节点可解析的多 Run 投影接口。节点、配置面板、结果面板和流程操作 SHALL 通过节点 ID 获取所属流程对应的 Run 与活动状态。

### Requirement: 活动 Run 冲突
Repository 的活动 Run 冲突检查 SHALL 从“同一 Pipeline 存在任意活动 Run”修改为“同一 Pipeline 存在范围相交的活动 Run”。内存与 MySQL 实现 SHALL 保持一致；MySQL 实现 SHALL 在 Pipeline 行锁事务内完成检查和创建。

## Error Handling
- 范围相交冲突继续使用 `ActiveRunConflictError` 和现有 HTTP 409 契约。
- Run 快照无法解析或起始节点不存在时返回校验错误，不允许绕过隔离规则。
- 某个 Run 详情加载失败时，仅其所属流程显示不可用状态，不清空其他流程投影。
- 当前定义与活动 Run 快照存在差异时，冲突判断采取保守策略：只要节点 ID 集合相交即视为同一执行范围。

## Testing
- 后端 DAG 单元测试覆盖连通、分支、孤立和全画布范围。
- Memory/MySQL Repository 测试覆盖相交冲突、不相交并行、并发提交和幂等。
- Executor 测试覆盖两个流程同时执行、独立完成、取消和重试。
- 前端单元测试覆盖多 Run 解析、节点状态、最近结果、历史切换和按钮隔离。
- 前端通过 TypeScript、ESLint、完整 Vitest 与 production build。
- Playwright 在桌面与移动视口验证两个独立流程同时运行时无状态串扰。

## Non-Goals
- 不引入用户可编辑的 `flow_id` 或流程分组 UI。
- 不改变单个流程内部的 DAG 调度、缓存或失败传播规则。
- 不允许同一连通子图内不同分支并行创建独立 Run。
- 不改变 Pipeline 删除和资产删除对活动 Run 的全局安全保护。
