# 日志服务可观测性提升设计

## 背景

当前后端使用统一的结构化 Formatter 将日志同时输出到 stdout 和火山引擎
TLS。该设计保证了本地日志不会泄露异常原文，但存在以下可观测性缺口：

- HTTP 路由正常返回 `4xx` 或 `5xx` Response 时，日志仍标记为
  `outcome=succeeded`。
- AIGC 任务不同失败路径记录的字段不一致；中断和恢复路径缺少
  `error_code`、`error_stage`、`error_type`。
- 异常规范化只保留类型和可选错误码，TLS 无法查看异常消息和有限调用位置。
- TLS Sink 在应用关闭时立即取消上传协程，不排空已入队事件，服务重启可能
  丢失最后一批关键错误。
- 普通 `logger.exception()` 经过当前 Formatter 后不保留日志消息或
  Traceback 信息，难以定位未知异常。

## 目标

- HTTP `4xx` 和 `5xx` 响应统一标记为失败并使用可检索的日志级别。
- 所有 AIGC 任务失败事件统一包含 `error_code`、`error_stage` 和
  `error_type`。
- TLS 安全保留原始异常消息、Traceback 指纹和有限应用栈帧。
- stdout、systemd journal 等本地日志不输出异常原始消息或栈帧。
- TLS Sink 在应用正常关闭时有界排空队列，减少尾部日志丢失。
- 保持现有敏感业务上下文、请求体、响应体、Prompt 和凭证的脱敏规则。

## 非目标

- 不把请求体、响应体、Prompt、模型原始输出或完整 Traceback 加入普通结构化
  日志。
- 不改变 API 响应结构、AIGC 任务状态机或重试策略。
- 不保证进程被 `SIGKILL`、OOM Kill 或主机断电时排空 TLS 队列。
- 不引入新的日志服务、消息队列或外部 tracing SDK。
- 不将任意 `logging` extra 字段自动放入结构化日志。

## 方案选择

采用双通道 Formatter：

- stdout Handler 使用安全模式，只输出现有基础字段、关联字段和统一错误索引
  字段。
- TLS Handler 使用 TLS 模式，在相同基础事件上额外输出 TLS-only 异常摘要。
- `log_event()` 在构造 `LogRecord` 时生成结构化错误元数据和 TLS-only
  异常摘要；Formatter 决定当前输出通道是否包含摘要。

不采用“每个失败分支单独调用 `emit_tls_only_event()`”，因为 AIGC 执行器和
Provider 存在多条失败路径，调用点分散会导致遗漏和字段漂移。不采用让 TLS
transport 直接理解业务异常，因为 transport 只应负责批处理、重试和投递。

## 结构化字段契约

所有日志通道允许以下错误索引字段：

| 字段 | 约束 | 用途 |
|---|---|---|
| `error_code` | 最多 256 字符，沿用现有清洗 | 稳定错误分类 |
| `error_stage` | 最多 256 字符，沿用现有清洗 | 明确失败阶段 |
| `error_type` | 最多 256 字符，沿用现有清洗 | 异常或合成错误类型 |

为兼容现有查询，业务事件可以继续保留 `phase`。失败事件同时写
`error_stage`，后续查询不再依赖 `phase` 推断错误阶段。

TLS-only 异常摘要包含：

| 字段 | 约束 |
|---|---|
| `exception_message` | 原始 `str(exception)`，UTF-8，最多 500 字符，不脱敏 |
| `traceback_fingerprint` | 根据异常链类型与应用栈帧生成的稳定 SHA-256 摘要 |
| `stack_frames` | 最多 3 个应用代码栈帧，每项只含模块相对路径、函数名和行号 |

`exception_message` 明确允许包含供应商返回的原始错误文本，因此只能出现在
TLS Handler 生成的事件中。stdout Formatter、systemd journal 和普通本地
控制台不得输出该字段。异常摘要不包含局部变量、源码行、请求体、响应体、
Prompt、完整 URL 查询参数或完整 Traceback。

若异常存在 `__cause__` 或 `__context__`，摘要选择异常链中最深的业务根因作为
`exception_message` 和 `error_type` 来源；Traceback 指纹覆盖可用的异常链类型
和筛选后的应用栈帧。显式传入的 `error_code`、`error_stage`、`error_type`
优先于自动推断值。

## HTTP 日志语义

HTTP middleware 在获得 Response 后按状态码生成完成事件：

| 状态码 | `outcome` | 日志级别 |
|---|---|---|
| `100-399` | `succeeded` | `INFO` |
| `400-499` | `failed` | `WARNING` |
| `500-599` | `failed` | `ERROR` |

完成事件继续包含 `method`、`route`、`status_code`、`duration_ms` 和
`request_id`。只有抛出异常进入 middleware `except` 时才附加异常摘要；
普通 `4xx/5xx` Response 没有异常对象，因此只提供状态语义和关联字段。

Origin guard 在 middleware 开始事件之前直接返回 `403` 的现有路径也必须输出
一条完成事件，标记为 `failed`、`WARNING`，并带 `status_code=403` 和
`error_code=origin_forbidden`，避免该类拒绝完全缺失。

## AIGC 任务失败日志

执行器提供一个内部失败事件辅助方法，接受：

- 任务关联上下文；
- `AigcTaskError`；
- 可选原始异常；
- 日志级别；
- 最终 `outcome`。

该方法统一输出 `event=aigc.task` 以及：

- `error_code=task_error.code`
- `error_stage=task_error.stage`，为空时使用当前执行阶段
- `error_type`：优先使用显式类型，其次使用原始异常根因类型，最后使用稳定
  合成类型
- `provider_request_id=task_error.request_id`

覆盖范围：

| 失败路径 | 错误类型来源 | 结果 |
|---|---|---|
| Worker 正常关闭取消任务 | `CancelledError` | `failed` |
| 启动恢复遗留 RUNNING 任务 | `WorkerInterrupted` | `failed` |
| JSON parser 错误 | 原始 parser 异常 | `failed` |
| Gateway/Provider 错误 | Gateway 根因异常 | `failed` |
| 未处理 Worker 异常 | 原始异常 | `failed` |
| Worker item 隔离收敛 | 原始异常或 `WorkerError` | `failed` |

数据库状态仍是错误事实源，日志是可检索观测副本。仅当任务状态更新或提交被
接受时记录最终失败事件，避免租约 fencing 拒绝后生成误导日志。Retry 事件
继续单独记录；发生重试的 attempt 仍记录该 attempt 的失败事件。

执行器中遗留的临时 Debug Server 上报块违反现有
`test_business_code_has_no_local_debug_reporting_dependencies` 约束，也可能绕过
正式日志安全边界；实施本设计时应删除这些临时块，不将其迁移到新日志体系。

## 普通异常日志

`logger.exception()` 和没有通过 `log_event()` 产生的 ERROR 记录保持最小本地
输出，但 TLS Formatter应保留：

- `event=log.error`
- `error_type`
- TLS-only 异常摘要

普通日志 message 不自动作为 `exception_message`。只有 `record.exc_info` 中的
真实异常进入 TLS-only 摘要，避免把任意日志文本误当成允许原样上传的异常。

## TLS 正常关闭与排空

TLS Sink 使用显式关闭信号替代立即取消：

1. `aclose()` 拒绝新的普通事件。
2. 向内部队列写入关闭信号。
3. Worker 立即结束当前 batch 等待，上传 batch 和关闭信号之前的剩余事件。
4. 在有界关闭超时内等待 Worker 退出。
5. 超时后取消 Worker，累计未投递数量，并在本地记录
   `tls.sink.shutdown_timeout`。
6. 最后关闭 HTTP client。

新增配置：

```dotenv
TLS_SHUTDOWN_TIMEOUT_SECONDS=5
```

默认 5 秒，必须为正整数。该超时限制整个排空过程，不承诺完成所有重试。
关闭阶段优先投递已经入队的事件；到达上限后快速退出，避免部署或 systemd
停止无限等待。

## 安全与隐私

- `exception_message` 不脱敏是经明确批准的 TLS-only 例外。
- 系统不主动从 TLS 配置、HTTP Authorization、Cookie、请求/响应正文或 Prompt
  采集 TLS-only 摘要；但未经脱敏的 `exception_message` 可能包含上游异常原文
  回显的敏感值，这是该边界下明确接受的剩余风险。
- 不从异常对象的任意属性、`repr()`、局部变量或 Provider 请求对象中采集数据。
- stdout 与 TLS 使用不同 Formatter 实例，测试必须证明 TLS-only 字段不会出现在
  stdout。
- TLS-only 字段不得放入 `structured_context`，避免被安全 Formatter意外序列化。
- 栈帧只接受项目 `backend/` 下的相对路径；第三方包和绝对路径不上传。

## 测试

### 结构化日志

- stdout 事件包含统一 `error_code/error_stage/error_type`。
- stdout 不包含 `exception_message`、`traceback_fingerprint`、
  `stack_frames` 或异常原文。
- TLS Formatter 包含原始异常消息、稳定指纹和最多 3 个应用栈帧。
- TLS 异常消息按 500 字符截断但不脱敏。
- 显式错误字段覆盖自动推断值。
- 普通敏感上下文字段仍按现有规则脱敏。

### HTTP

- `2xx` 和 `3xx` 完成事件为 `INFO + succeeded`。
- `4xx` 完成事件为 `WARNING + failed`。
- `5xx` 完成事件为 `ERROR + failed`。
- 抛出异常的请求包含统一错误字段，原始异常消息只进入 TLS。
- Origin guard 的 `403` 产生可检索失败事件。

### AIGC

- 取消、恢复、parser、Gateway 和未知异常路径的 `aigc.task` 失败事件均包含
  三个统一错误字段。
- Gateway 错误包含 provider request ID。
- fencing 拒绝提交时不生成最终失败事件。
- Retry attempt 同时具备失败事件和 retry 事件。
- 源码扫描不包含 Debug Server URL 或 `.dbg` 依赖。

### TLS Transport

- 正常关闭会投递排队事件和未满 batch。
- 关闭信号会提前结束 flush interval 等待。
- 关闭超时会取消 Worker 并关闭 client。
- 队列满、投递重试、永久错误和递归保护的现有行为保持。

### 验证命令

使用项目 `.venv`：

```bash
.venv/bin/pytest \
  backend/tests/test_structured_logging.py \
  backend/tests/test_tls_logging.py \
  backend/tests/test_main.py \
  backend/tests/test_aigc_executor.py -q
.venv/bin/ruff check backend/app backend/tests
```

## 验收标准

- TLS 可按 `outcome=failed`、`error_code`、`error_stage`、`error_type` 检索 HTTP
  和 AIGC 失败。
- 生产服务正常重启时，关闭前已入队的失败事件在 5 秒预算内完成投递。
- TLS 能查看允许范围内的异常原始消息和调用位置摘要。
- journal 中不出现异常原始消息、TLS-only 栈帧或凭证。
- 所列单元测试和 Ruff 检查通过。

## 风险与回滚

主要风险是 TLS 中的原始异常消息可能包含供应商返回的敏感内容。该风险通过
TLS-only 通道、长度限制、不遍历异常属性和严格访问控制降低，但不能完全消除。
TLS Topic 的访问权限和保留周期应按敏感运维数据管理。

若新增 Formatter 导致日志兼容问题，可回滚 TLS-only 摘要，同时保留统一错误字段
和 HTTP 状态语义。若排空影响停止耗时，可临时将
`TLS_SHUTDOWN_TIMEOUT_SECONDS` 调低；超时后仍会执行强制取消，不会无限阻塞
服务停止。
