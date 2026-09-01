# 展示 AIGC 运行日志详情 Spec

## Why

当前 AIGC 运行面板只展示 Run 和节点状态，缺少明确的开始/结束时间与失败原因，用户需要借助后端接口或日志才能判断失败位置。运行日志应直接提供可操作且脱敏的状态、时间和错误信息。

## What Changes

- 在运行历史与当前 Run 摘要中展示运行状态和时间信息。
- 在执行计划节点日志中展示节点状态、attempt、时间和耗时。
- Run 级失败展示 `run.error`，Task 级失败展示对应 attempt 的安全错误原因。
- 对 blocked、缺少 attempt、缺少时间和缺少错误消息的情况提供稳定回退文案。
- 不展示堆栈、密钥、签名 URL、供应商原始响应或其他敏感内容。
- 不新增后端接口或持久化字段，复用现有 Run、RunNode 和 TaskAttempt DTO。

## Impact

- Affected specs: AIGC 工作台运行历史、运行状态投影、错误脱敏。
- Affected code:
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/lib/aigc/types.ts`
  - AIGC 运行日志展示辅助函数与前端测试

## ADDED Requirements

### Requirement: Run 日志摘要

系统 SHALL 在运行面板中为当前选中的 Run 展示 Run 编号、状态、开始时间、结束时间和耗时。时间使用用户本地时区并保持固定、可读格式。

#### Scenario: 已结束 Run

- **WHEN** 用户查看 succeeded、failed、canceled 或 timed_out Run
- **THEN** 面板展示开始时间和结束时间
- **AND** 使用二者计算并展示运行耗时

#### Scenario: 活动 Run

- **WHEN** 用户查看 queued 或 running Run
- **THEN** 面板展示当前状态和已有的开始时间
- **AND** 未产生的结束时间显示为“进行中”，不得显示无效日期

#### Scenario: 时间字段缺失

- **WHEN** Run 尚未开始或历史数据缺少时间字段
- **THEN** 对应字段显示“-”
- **AND** 页面不得抛出格式化异常

### Requirement: 运行历史选项包含状态与时间

系统 SHALL 在运行历史选择器中同时展示 Run 编号、状态和可用的创建时间，使同状态的多次运行可以区分。

#### Scenario: 选择历史 Run

- **WHEN** Pipeline 存在多个历史 Run
- **THEN** 每个选项展示 Run 编号、状态和本地时间
- **AND** 切换选项后日志详情只展示所选 Run 的数据

### Requirement: 节点执行日志

系统 SHALL 为执行计划内的每个节点展示节点状态；存在 TaskAttempt 时，还 SHALL 展示 attempt 编号、开始/结束时间和耗时。

#### Scenario: 节点执行成功

- **WHEN** 节点具有 succeeded TaskAttempt
- **THEN** 节点日志展示 succeeded、attempt 编号、时间和耗时

#### Scenario: 节点没有 TaskAttempt

- **WHEN** 节点为输入、输出、reused、blocked 或尚未创建 TaskAttempt
- **THEN** 节点日志仍展示节点状态
- **AND** 不伪造 attempt、执行时间或耗时

#### Scenario: 自动重试

- **WHEN** 同一节点具有多个 TaskAttempt
- **THEN** 节点日志明确显示 attempt 数量
- **AND** 时间与失败详情以最新相关 attempt 为准

### Requirement: 失败原因可见

系统 SHALL 在运行日志中展示可理解的失败原因，并区分 Run 级调度失败与 Task 级执行失败。

#### Scenario: Run 级调度失败

- **WHEN** Run 状态为 failed 且 `run.error` 存在
- **THEN** Run 摘要展示安全错误消息
- **AND** 可用时展示错误码、阶段和 request ID
- **AND** 即使失败节点没有 TaskAttempt，失败原因仍然可见

#### Scenario: Task 或 Provider 失败

- **WHEN** 节点最新失败或超时 attempt 包含 `error`
- **THEN** 对应节点日志展示安全错误消息
- **AND** 可用时展示错误码、阶段和 request ID

#### Scenario: blocked 节点

- **WHEN** 节点因上游失败处于 blocked
- **THEN** 日志显示“因上游失败被阻塞”
- **AND** 不将上游错误归属为该节点自身错误

#### Scenario: 缺少错误消息

- **WHEN** failed 或 timed_out 记录没有错误消息
- **THEN** 日志展示稳定回退文案“执行失败，未提供详细原因”

### Requirement: 错误信息安全

系统 SHALL 仅展示 API 已提供的脱敏错误字段，不拼接异常对象、响应正文或内部调用栈。

#### Scenario: 展示 Provider 错误

- **WHEN** 错误包含 code、message、stage 或 request ID
- **THEN** 前端仅按字段展示这些安全值
- **AND** 不展示 API Key、数据库凭据、签名 URL 查询参数、供应商原始响应或堆栈

## MODIFIED Requirements

### Requirement: AIGC 运行历史与状态投影

系统 SHALL 保持当前活动 Run 优先、否则最近 Run 的默认选择规则。右侧运行面板除状态徽标、取消和重试操作外，还 SHALL 展示所选 Run 的时间摘要、节点执行时间和脱敏失败原因；切换历史 Run 时不得混用其他 Run 的状态、时间或错误。

## REMOVED Requirements

无。
