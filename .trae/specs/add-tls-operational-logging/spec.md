# TLS 业务操作日志 Spec

## Why

当前后端日志格式和覆盖范围不一致，核心操作的请求、状态转换、外部调用和失败无法跨模块关联，问题排查依赖本地进程输出。需要建立统一、脱敏、可关联的操作日志，并可选择推送至火山引擎 TLS 集中查询。

## What Changes

- 新增后端结构化操作日志模块，所有日志以单行 JSON 输出到标准输出。
- 为 HTTP 请求、项目与资产操作、AIGC Pipeline/Run/Task 生命周期、模型与媒体服务调用、后台任务和未处理异常记录统一事件。
- 每条事件携带时间、级别、事件名、请求关联 ID、耗时及允许的业务上下文；禁止记录敏感内容。
- 新增可选 TLS Sink，按批次将结构化日志编码为 TLS `LogGroupList` Protobuf 并通过 `PutLogs` 上传至指定日志主题。
- TLS 连接信息通过环境变量配置，默认关闭；TLS 投递失败采用本地降级和受控重试，不阻塞 API、任务或应用关闭。
- 清理遗留的临时 Debug Server 插桩，禁止业务代码依赖 `.dbg/*.env` 或向本地调试端口写入。

## Impact

- Affected specs: 后端运行时、HTTP 请求链路、AIGC 执行与网关、资产服务、后台任务、部署配置与安全约束。
- Affected code: `backend/app/main.py`、`backend/app/core/config.py`、新增 `backend/app/core/logging.py` / TLS sink、核心 API 与服务边界、`requirements.txt`、测试与部署环境变量示例。

## ADDED Requirements

### Requirement: 统一结构化操作日志

系统 SHALL 将所有后端操作日志输出为 UTF-8 单行 JSON，使用稳定的事件名和字段白名单。

每条日志至少包含：

- `timestamp`：UTC ISO 8601 毫秒时间；
- `level`、`event`、`service`、`environment`；
- `request_id`：HTTP 请求存在时使用入口生成或透传的关联 ID；
- `trace_id`：AIGC Run、Task、Provider 请求或异步操作存在时使用对应安全关联标识；
- `duration_ms`：已完成的请求或外部调用记录耗时；
- `outcome`：`started`、`succeeded`、`failed`、`canceled`、`retried` 或 `skipped`。

#### Scenario: HTTP 请求完成

- **WHEN** 任意 API 请求完成、失败或被取消
- **THEN** 系统记录一条请求结束事件，包含方法、路由模板、HTTP 状态、耗时和 `request_id`
- **AND** 响应头 `X-Request-ID` 与日志中的 `request_id` 相同

#### Scenario: 后台任务异常

- **WHEN** 后台任务、AIGC Worker 或生命周期钩子出现未处理异常
- **THEN** 系统记录 `error` 级别事件和安全的异常类别、阶段及关联 ID
- **AND** 保持现有异常传播、重试和任务状态语义

### Requirement: 核心业务操作覆盖

系统 SHALL 对核心业务操作记录开始、成功、失败和重试事件，并采用低基数、可检索的上下文字段。

核心范围至少包括：

- 项目、Brief、素材上传/下载/删除及资产持久化；
- AIGC Pipeline 和 Template 的创建、更新、删除、执行；
- AIGC Run、RunNode、Task Attempt 的排队、开始、重用、成功、失败、超时、取消和重试；
- 文本、图片、视频、音频、MediaKit 与 ModelArk Provider 调用的提交、轮询、解析、转存和失败；
- 提示词优化请求的目标类型、阶段、结果状态和安全失败分类；
- TLS Sink 的批次投递、丢弃、重试和降级状态。

#### Scenario: AIGC 模型任务

- **WHEN** AIGC Task Attempt 调用外部模型并完成
- **THEN** 系统记录调用开始和结束事件，包含 `pipeline_id`、`run_id`、`node_id`、`task_id`、任务类型、Provider 名称、模型别名、阶段、耗时与结果状态
- **AND** 可用时记录供应商 request ID、供应商任务 ID 和脱敏错误码

#### Scenario: 提示词优化失败

- **WHEN** 提示词优化调用失败、解析失败或结果校验失败
- **THEN** 系统记录目标类型、错误分类、HTTP/Provider 状态、耗时和 `request_id`
- **AND** 不记录提示词正文、优化结果正文、系统提示词或供应商原始响应

### Requirement: 隐私与密钥脱敏

系统 SHALL 在本地和 TLS 日志中执行统一字段过滤与长度限制。

禁止记录：

- API Key、AccessKey、SecretKey、Authorization、Cookie、数据库密码及任何环境变量值；
- 完整提示词、模型完整输入/输出、完整上游 JSON、用户上传文件内容；
- 签名 URL、URL 查询参数、对象存储 Key、完整外部 Provider 响应、调用栈；
- 原始请求或响应体。

允许记录安全摘要，例如长度、SHA-256 前缀、媒体 MIME 类型、尺寸、状态、白名单错误码和不含查询参数的域名。

#### Scenario: 异常含有敏感信息

- **WHEN** Provider、存储或 HTTP 异常消息含有 URL、密钥形态、请求体或超长文本
- **THEN** 日志模块仅输出已脱敏的错误类别、白名单错误码和截断安全详情
- **AND** TLS Sink 与标准输出得到相同的脱敏事件

### Requirement: TLS 异步批量投递

系统 SHALL 在启用 TLS 后将结构化事件异步、批量投递到火山引擎 TLS。

TLS 默认配置为：

- `TLS_ENDPOINT=https://tls-cn-beijing.volces.com`
- `TLS_PROJECT_ID=da00add8-5793-44ad-af84-a9de004161d5`
- `TLS_TOPIC_ID=4a3842fc-1201-46b7-994c-1368564e5e77`

认证 SHALL 使用后端环境变量中的 `TLS_ACCESS_KEY_ID` 与 `TLS_SECRET_ACCESS_KEY`，并采用火山引擎签名机制。`TLS_ENABLED` 默认 `false`；启用时必须同时配置主题与认证凭证。日志上传 SHALL 使用 `POST /PutLogs?TopicId=...`、`application/x-protobuf`、`x-tls-bodyrawsize` 和 TLS `LogGroupList` 编码。

#### Scenario: TLS 成功投递

- **WHEN** TLS 已启用且缓冲达到批量阈值或刷新间隔
- **THEN** Sink 将事件编码为不超过 TLS 单请求限制的 Protobuf 批次并上传
- **AND** 成功后从内存队列移除该批次

#### Scenario: TLS 瞬时失败

- **WHEN** TLS 网络错误、5xx、限流或超时
- **THEN** Sink 在内存容量范围内采用指数退避重试
- **AND** 业务请求、AIGC 执行和应用关闭不等待 TLS 重试完成
- **AND** 本地 JSON 标准输出持续可用

#### Scenario: TLS 配置缺失或无效

- **WHEN** `TLS_ENABLED=true` 但缺少凭证、主题或项目配置
- **THEN** 应用启动记录安全配置错误并禁用 TLS Sink
- **AND** 不输出凭证值，且不阻止本地开发与业务服务启动

### Requirement: 运行时关联与异步上下文

系统 SHALL 在 HTTP、后台任务、AIGC Worker 与外部调用间传递安全的关联上下文。

#### Scenario: API 启动异步任务

- **WHEN** API 请求创建 AIGC Run、Task Attempt 或后台任务
- **THEN** 后续异步日志可通过 `request_id`、`pipeline_id`、`run_id` 或 `task_id` 与入口请求关联
- **AND** 并发请求之间不得串用上下文

### Requirement: 临时调试清理

系统 SHALL 移除现有业务代码中的 Debug Server 网络上报和 `.dbg` 文件读取逻辑。

#### Scenario: 正常生产请求

- **WHEN** 应用处理健康检查、提示词优化、模型调用或任务调度
- **THEN** 业务代码不访问 `127.0.0.1` 调试端口、不读取 `.dbg/*.env`
- **AND** 诊断信息仅通过统一结构化日志模块输出

## MODIFIED Requirements

### Requirement: 后端日志与错误观测

后端 SHALL 通过统一结构化日志模块记录核心操作和异常。现有 `logging` 调用应逐步映射为稳定事件名、白名单字段和统一脱敏策略；原有 API 错误码、响应正文、任务状态和前端运行日志展示不因日志接入改变。

## REMOVED Requirements

### Requirement: 分散的本地调试上报

**Reason**: 临时 `.dbg` 配置文件与本地 HTTP 调试端口会污染业务链路、难以部署且不能替代集中可检索日志。

**Migration**: 用统一 JSON 操作日志替代；需要临时调试时使用隔离的开发工具，不将插桩保留在业务代码中。

## 验收状态（2026-09-20）

实现已完成最终验证。TLS、HTTP 和 AIGC mock 验证通过（`315 passed`），后端完整回归通过（`1532 passed`）；现有真实 Uvicorn 服务的 `http://127.0.0.1:8000/health` 返回 `200` 与健康 JSON。TLS 凭据未被读取或输出。

静态检查采用本次 TLS 日志变更的范围化 Ruff 验收并通过。当前脏工作区的全仓 `backend/app` 与 `backend/tests` Ruff 实测有 `763` 项既有/无关报告；不属于本 spec 的业务逻辑修复范围。
