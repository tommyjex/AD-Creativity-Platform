# Task 7.1 后端回归记录

- 日期：2026-09-01
- Python：3.14.3
- pytest：8.4.2
- 执行目录：仓库根目录
- 环境：`ARK_API_KEY=pytest-placeholder-not-a-real-key`

## 定向回归

使用 `.venv/bin/python -m pytest` 覆盖画质增强契约与客户端、MediaKit
ASR、人物打码、AIGC schema/DAG/executor/gateway/routes、Seedance、通用 asset
storage 和画质增强流式转存。

结果：`470 passed, 0 failed, 2 warnings`，耗时 15.22 秒。

## 后端全量

命令：

```shell
ARK_API_KEY=pytest-placeholder-not-a-real-key \
  .venv/bin/python -m pytest backend/tests
```

结果：`900 passed, 0 failed, 36 warnings`，耗时 36.52 秒。

告警均为 FastAPI/Starlette 的既有弃用告警，不影响测试结果。没有失败需要归因
或修复。

## 网络审计

两轮 pytest 均加载临时 socket/DNS 审计插件，并对
`mediakit.cn-beijing.volces.com` 设置立即失败保护。定向与全量运行各记录 285
条底层事件，均对应 95 次访问 `127.0.0.1:7777` 的现有本地调试埋点尝试。

审计中未出现 `mediakit.cn-beijing.volces.com`。画质增强 HTTP 测试全部使用
`httpx.MockTransport`，因此没有向真实
`https://mediakit.cn-beijing.volces.com/api/v1/tools/enhance-video` 发起请求。
