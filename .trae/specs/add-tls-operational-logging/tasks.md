# Tasks

- [x] Task 1: 建立结构化日志契约与安全过滤器。
  - [x] SubTask 1.1: 定义稳定事件模型、日志级别、结果状态、关联上下文和字段白名单。
  - [x] SubTask 1.2: 实现 JSON 标准输出 Handler、请求/异步 ContextVar 传递和安全异常规范化。
  - [x] SubTask 1.3: 实现密钥、签名 URL、查询参数、提示词、原始请求响应和超长字段的统一脱敏与截断。
  - [x] SubTask 1.4: 为配置、事件序列化、脱敏和并发上下文添加单元测试。

- [x] Task 2: 接入 HTTP、业务服务和 AIGC 生命周期日志。
  - [x] SubTask 2.1: 在 FastAPI 生命周期与 HTTP middleware 中生成/透传 `X-Request-ID`，记录请求开始、结束、异常和耗时。
  - [x] SubTask 2.2: 为项目、Brief、资产、AIGC Pipeline/Template 和提示词优化入口接入核心操作事件。
  - [x] SubTask 2.3: 为 AIGC Run/Task Attempt、Worker 排队/执行/重试/取消、ModelArk、MediaKit 和存储调用接入开始/结束/失败事件。
  - [x] SubTask 2.4: 清理业务代码中遗留的 `.dbg` 读取、Debug Server HTTP 上报和本地调试端口依赖。
  - [x] SubTask 2.5: 添加路由、服务和执行器测试，验证关联 ID、事件覆盖及现有状态语义不变。

- [x] Task 3: 实现可选 TLS 批量日志 Sink。
  - [x] SubTask 3.1: 在 Settings 中增加 TLS endpoint、project/topic、AK/SK、开关、批量、队列、重试和超时配置；敏感配置使用 `SecretStr`。
  - [x] SubTask 3.2: 实现 TLS `LogGroupList` Protobuf 编码、火山引擎签名和 `PutLogs` 请求。
  - [x] SubTask 3.3: 实现非阻塞内存队列、批量刷新、大小分片、指数退避、容量丢弃指标与优雅关闭。
  - [x] SubTask 3.4: TLS 配置缺失、认证/协议/网络错误时安全降级，不阻塞本地 JSON 日志或业务请求。
  - [x] SubTask 3.5: 以 Mock HTTP 服务覆盖编码、签名、请求头、成功、限流、重试、丢弃、关闭和不泄露凭证。

- [x] Task 4: 完成部署配置、回归与验收。
  - [x] SubTask 4.1: 更新环境变量示例与运维说明，记录 TLS 所需 AK/SK 的安全注入方式和默认 Project/Topic。
  - [x] SubTask 4.2: 运行后端完整 pytest、范围化 Ruff 检查及现有应用启动健康检查。
  - [x] SubTask 4.3: 使用 TLS Mock 及本地标准输出验证请求、AIGC 任务、提示词优化失败和后台异常的日志可查询性、关联性和脱敏。
  - [x] SubTask 4.4: 验证 TLS 关闭、缺少凭证、网络中断和 TLS 限流时核心 API 与 AIGC Worker 不被阻塞。

- [x] Task 5: 完成后端日志变更的范围化 Ruff 验收。
  - [x] SubTask 5.1: 对 TLS 日志新增/修改的配置、日志、入口和测试文件运行 Ruff 并通过；不重构当前工作区其余文件。全仓 `app tests` 在 2026-09-20 实测为 763 项既有/无关报告，任务原述的 744 项未作为实测结论。

- [x] Task 6: 使用现有后端健康检查服务完成验证。
  - [x] SubTask 6.1: 未读取或输出 `.env` 凭据；使用既有真实 Uvicorn `127.0.0.1:8000` 服务重新运行 `/health` 并返回 200。

# Task Dependencies

- Task 2 和 Task 3 依赖 Task 1，可并行。
- Task 4 依赖 Task 1 至 Task 3。
- Task 5 的范围化 Ruff 验收完成后可勾选 Task 4.2；全仓既有报告不属于本次变更范围。
- Task 6 的现有真实服务健康检查完成后可勾选 Task 4.2。

## 验收证据（2026-09-20）

- `cd backend && ../.venv/bin/ruff check app/core/config.py app/core/logging.py app/core/tls_logging.py app/main.py tests/test_config.py tests/test_main.py tests/test_structured_logging.py tests/test_tls_logging.py`：`All checks passed!`
- `cd backend && PYTHONPATH=.. ../.venv/bin/pytest tests/test_config.py tests/test_structured_logging.py tests/test_tls_logging.py tests/test_main.py tests/test_aigc_routes.py tests/test_aigc_executor.py tests/test_aigc_gateway.py`：`315 passed, 1 warning in 18.86s`；覆盖 TLS `httpx.MockTransport`、HTTP `TestClient` 和 AIGC 路由/执行器/网关 mock。
- `cd backend && PYTHONPATH=.. ../.venv/bin/pytest`：`1532 passed, 36 warnings in 50.82s`。
- `curl --noproxy '*' --connect-timeout 2 --max-time 5 http://127.0.0.1:8000/health`：`HTTP/1.1 200 OK`，响应为 `{"status":"ok","name":"AD Creativity Backend","version":"0.1.0"}`，并返回 `X-Request-ID`。
