# 文本生成校验失败 TLS 日志设计

## 背景

故事、剧本和分镜脚本共用 ModelArk 文本生成适配器。模型返回内容在 JSON
解析、Pydantic Schema 校验或分镜业务校验失败时，任务只保存
`phase=response_validation`，现有 TLS 事件也只记录通用 `log.error`。运维能够
定位失败请求，但无法判断具体缺失字段、类型错误或模型输出结构变化。

系统已有 `emit_tls_only_event()`，可以在不写入 stdout 和 systemd journal 的
前提下，将最多 32 KiB 原始模型输出写入 TLS。本设计复用该安全边界补齐文本
响应校验的诊断证据。

## 目标

- 覆盖故事、剧本和分镜脚本全部文本生成阶段，并使用 `stage` 区分。
- 在响应解析或校验失败时，将原始模型响应写入 TLS-only 事件。
- 在同一事件中记录可检索的异常类型、失败阶段和校验异常摘要。
- 同步与流式文本生成使用相同字段契约，每次失败只记录一次。
- stdout、systemd journal、API 响应和任务错误不得包含模型原始响应或异常原文。

## 非目标

- 不记录成功的模型原始响应。
- 不记录请求 Prompt、图片 URL、认证信息或 Provider 请求对象。
- 不改变文本生成 Prompt、Schema、归一化规则、任务状态机或重试策略。
- 不扩大 TLS 原始输出的 32 KiB 上限。
- 不为非文本生成的图片、视频或提示词优化路径改变日志行为。

## 方案选择

采用“适配器解析边界统一记录”方案：

- ModelArk 适配器持有完整原始响应、当前 `stage` 和解析异常，是唯一同时具备
  三类诊断信息的边界。
- 同步 `generate_text()` 与流式 `stream_text()` 在调用共享解析辅助方法时传入
  `stage`。
- 共享辅助方法捕获响应解析和 Schema 校验异常，发出一次 TLS-only 事件后重新
  抛出原异常或现有 `ModelArkTextParseError`。
- 分镜业务校验发生在适配器解析之后，因此生成服务在该边界复用已保留的原始
  响应上下文，并以相同事件契约记录业务校验失败。

不在路由层记录原文，因为路由层只能得到规范化异常，无法访问模型响应。不让
底层 `_parse_text_payload()` 隐式读取全局 `stage`，避免解析器与请求上下文
耦合及重复日志。

## 组件与数据流

### 原始响应上下文

`GeneratedTextResult` 增加 Pydantic 私有属性 `_raw_output`。私有属性不属于模型
字段，不参与 `model_dump()`、JSON Schema、数据库写入或 API 序列化，只在当前
Python 调用链内存活。

- 同步路径使用 Provider 返回的完整文本设置 `_raw_output`。
- 流式路径使用流结束后的 `extractor.raw_json` 设置 `_raw_output`。
- JSON 或 Schema 解析在结果构造前失败时，适配器直接使用局部原始字符串记录
  TLS-only 事件。
- 分镜解析成功但后续业务校验失败时，生成服务从结果私有属性读取原始响应并
  记录 TLS-only 事件。

是否已经记录校验失败由调用栈决定：适配器解析失败不会返回结果；生成服务只
处理已经成功返回结果后的业务校验，因此两条路径天然互斥，不需要可变全局
标记。

### TLS-only 事件

统一事件名：

`aigc.text_generation.response_validation_failed`

字段契约：

| 字段 | 通道 | 说明 |
|---|---|---|
| `event` | TLS-only | 固定事件名 |
| `outcome` | TLS-only | 固定为 `failed` |
| `stage` | TLS-only | `story`、`script` 或 `storyboard` |
| `phase` | TLS-only | 固定为 `response_validation` |
| `error_type` | TLS-only | 最外层业务异常类型 |
| `validation_error_type` | TLS-only | 根因类型，如 `ValidationError` 或 `JSONDecodeError` |
| `exception_message` | TLS-only | 根因异常摘要，最多 500 字符 |
| `output_text` | TLS-only | 原始模型响应，最多 32 KiB |
| `output_truncated` | TLS-only | 是否因大小限制截断 |
| `request_id` | TLS-only | 沿用当前异步请求日志上下文 |

`emit_tls_only_event()` 扩展为接受受控的 TLS-only 元数据。元数据只允许显式
白名单字段，不能把任意字典直接合并到载荷中。`exception_message` 不进入
普通 `structured_context`。

### 异常摘要

- `ValidationError`：使用 Pydantic 的结构化错误列表生成紧凑摘要，保留字段
  路径、错误类型和消息，不包含输入值或 `input` 字段。
- `JSONDecodeError`：记录异常类型、消息、行号和列号，不重复嵌入原始文档。
- 其他响应校验异常：记录根因类型和截断后的 `str(root_exception)`。
- 摘要最多 500 字符；完整模型响应由 `output_text` 单独承载。

### 普通失败事件

文本流路由的失败分支改用 `log_event()` 并传入原始异常，事件名使用
`text_generation.stream_failed`。stdout 和 TLS 都可检索：

- `project_id`
- `task_id`
- `stage`
- `error_type`
- `error_code`
- `error_stage=response_validation`

只有 TLS Formatter 能附加异常消息、指纹和有限栈帧。普通日志仍不包含模型
响应。

## 去重规则

- 每次文本生成调用最多产生一个
  `aigc.text_generation.response_validation_failed`。
- 适配器 JSON/Schema 解析失败由适配器记录。
- 分镜业务校验失败只会在适配器成功返回结果后由生成服务记录。
- 路由失败事件是独立的任务生命周期事件，不计入 TLS-only 原始响应事件数量。
- Provider 调用失败且没有可用模型响应时，不产生原始响应事件，继续使用现有
  Provider 异常日志。

## 安全与隐私

- 模型原始响应只通过 `TlsLogHandler` 对应的 Sink 投递。
- stdout Formatter、journal 和 API 不得序列化 `output_text`、
  `exception_message` 或校验错误详情。
- 原始响应最多 32 KiB，异常摘要最多 500 字符。
- 校验摘要禁止包含 Pydantic `input`、Prompt、请求体、图片 URL、Cookie、
  Token、API Key 或任意对象 `repr()`。
- 没有启用 TLS 或 TLS Sink 不可用时，原始响应事件直接丢弃，不降级到本地
  日志。

## 测试

### TLS-only 载荷

- 故事、剧本、分镜脚本失败事件分别包含正确 `stage`。
- 原始响应超过 32 KiB 时截断并设置 `output_truncated=true`。
- Pydantic 摘要包含字段路径和错误类型，不包含 `input`。
- JSON 解码摘要包含行列信息。
- 请求上下文中的 `request_id` 被保留。

### 通道隔离

- 捕获 stdout，断言不包含模型原始响应、`output_text` 或
  `exception_message`。
- TLS Sink 捕获一次完整失败事件。
- TLS 未配置时不向 stdout 降级。

### 文本生成路径

- 同步解析失败记录一次事件并维持现有异常类型。
- 流式解析失败记录一次事件并维持现有 SSE 错误契约。
- 分镜业务校验失败记录原始响应和校验异常。
- Provider 失败且无响应时不生成原始响应事件。
- 成功响应不生成原始响应事件。

## 验证

运行范围化测试：

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_structured_logging.py \
  backend/tests/test_modelark.py \
  backend/tests/test_api.py -q

.venv/bin/ruff check \
  backend/app/core/logging.py \
  backend/app/services/modelark.py \
  backend/app/services/generation.py \
  backend/app/api/routes.py \
  backend/tests/test_structured_logging.py \
  backend/tests/test_modelark.py \
  backend/tests/test_api.py

python -m compileall -q backend/app
git diff --check
```

## 验收标准

- 三个文本生成阶段的响应校验失败均可在 TLS 按事件名和 `stage` 检索。
- TLS 事件能够看到受限长度的模型原始响应和具体校验失败摘要。
- 同一次失败只产生一条原始响应事件。
- stdout、journal、API 和数据库任务错误均不泄露模型原始响应。
- 现有文本生成行为、任务状态和前端错误契约保持不变。
