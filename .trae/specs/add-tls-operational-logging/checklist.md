- [x] 后端日志以单行 JSON 输出，并包含时间、级别、事件、服务、环境、结果和关联 ID
- [x] HTTP 请求的响应 `X-Request-ID` 与起止日志中的 `request_id` 一致
- [x] 并发 HTTP 请求、后台任务与 AIGC Worker 的关联上下文不串用
- [x] 项目、素材、AIGC Pipeline/Template、Run、Task Attempt、提示词优化及 Provider 调用均覆盖关键生命周期事件
- [x] 请求、Provider 调用和任务完成日志记录安全耗时、状态、阶段和白名单上下文
- [x] 异常、重试、取消、超时和 Worker 未处理错误均记录安全事件且不改变既有业务语义
- [x] 日志不会包含密钥、认证头、Cookie、密码、完整提示词、完整模型输入输出、原始请求响应、签名 URL、URL 查询参数、对象 Key 或堆栈
- [x] 脱敏规则对标准输出和 TLS Sink 一致生效
- [x] `TLS_ENABLED=false` 时不发起任何 TLS 网络请求，业务服务正常启动
- [x] 启用 TLS 后使用指定 endpoint、Project ID、Topic ID、Protobuf `LogGroupList`、签名和必需请求头调用 `PutLogs`
- [x] TLS 日志批次遵守单条、单组和单请求大小限制，并可安全拆分
- [x] TLS 成功时批次从队列移除；网络、5xx 和限流时指数退避重试
- [x] TLS 队列满、凭证缺失、签名失败或服务不可用时不阻塞 API、AIGC Worker 或应用关闭，本地 JSON 日志仍可用
- [x] TLS 日志上传、失败、重试、丢弃与降级本身有安全可查询事件，且不造成递归投递
- [x] 现有 `.dbg` 文件读取、Debug Server 上报和固定本地调试端口已从业务代码移除
- [x] Settings 与环境变量示例不输出 TLS 凭证，TLS 认证字段使用 `SecretStr`
- [x] 结构化日志、脱敏、TLS 编码/签名/重试及 HTTP/AIGC 生命周期测试通过
- [x] 完整后端 pytest、范围化静态检查和健康检查通过

## 验收证据（2026-09-20）

- 范围 Ruff：`cd backend && ../.venv/bin/ruff check app/core/config.py app/core/logging.py app/core/tls_logging.py app/main.py tests/test_config.py tests/test_main.py tests/test_structured_logging.py tests/test_tls_logging.py`，结果 `All checks passed!`。
- TLS/HTTP/AIGC mock：`cd backend && PYTHONPATH=.. ../.venv/bin/pytest tests/test_config.py tests/test_structured_logging.py tests/test_tls_logging.py tests/test_main.py tests/test_aigc_routes.py tests/test_aigc_executor.py tests/test_aigc_gateway.py`，结果 `315 passed, 1 warning in 18.86s`。
- 完整回归：`cd backend && PYTHONPATH=.. ../.venv/bin/pytest`，结果 `1532 passed, 36 warnings in 50.82s`。
- 现有真实健康服务：`curl --noproxy '*' --connect-timeout 2 --max-time 5 http://127.0.0.1:8000/health`，结果 `HTTP/1.1 200 OK`、健康 JSON 和 `X-Request-ID` 响应头；未读取或输出 `.env` 凭据。
