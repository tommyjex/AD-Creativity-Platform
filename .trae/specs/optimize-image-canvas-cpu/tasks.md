# Tasks

- [x] Task 1: 初始化证据驱动调试会话，不修改业务逻辑。
  - [x] SubTask 1.1: 首次写入项目根目录 `debug-canvas-cpu-spike.md`，记录 `[OPEN]` 状态、复现路径、环境和假设优先级。
  - [x] SubTask 1.2: 启动 Debug Server，使用 `sessionId=canvas-cpu-spike`、`runId=pre-fix`，清空本会话旧日志并保持服务运行。

- [x] Task 2: 添加最小性能插桩并采集修复前基线。
  - [x] SubTask 2.1: 在 3-8 个关键位置添加网络上报插桩，覆盖页面提交/节点变更、`ResizeObserver` 与尺寸写回、输出任务轮询、资源挂载与清理；插桩必须绑定假设 ID，禁止使用 `console.log`。
  - [x] SubTask 2.2: 分别复现空画布、含参考图节点画布、含待处理输出节点画布，采集资源加载后至少 10 秒的空闲数据及一轮平移、缩放、节点变换和 bbox 操作数据。
  - [x] SubTask 2.3: 使用浏览器 Performance/React Profiler 与 NDJSON 日志形成基线，逐项将假设标记为 CONFIRMED、REJECTED 或 INCONCLUSIVE，并在调试记录中引用具体证据。

- [x] Task 3: 根据已确认根因实施最小修复。
  - [x] SubTask 3.1: 只修改被证据确认的高频调用链，消除无实质变化的状态写入、反馈循环、重复调度或未释放资源。
  - [x] SubTask 3.2: 保持调试插桩，补充聚焦回归测试，覆盖根因触发条件及卸载清理；不改变 bbox、节点尺寸、轮询和布局保存的既有契约。
  - [x] SubTask 3.3: 根据已确认根因，停止 pending 输出节点的持续动画，同时保留明确加载状态与无障碍语义。

- [x] Task 4: 执行修复后对照验证。
  - [x] SubTask 4.1: 清空会话日志并切换为 `runId=post-fix`，按 Task 2 的同环境、同项目、同路径重新采样。
  - [x] SubTask 4.2: 证明静置 10 秒期间 CPU 不再持续接近 100%，CPU 中位值较修复前下降至少 70%，且高频回调或状态更新在 2 秒内收敛。
  - [x] SubTask 4.3: 运行前端 `npm run lint`、`npm run typecheck`、相关 Vitest 和 `npm run build`；如修复触及后端，则在仓库根目录使用 `.venv` 运行 pytest。

- [x] Task 5: 完成用户确认与调试清理。
  - [x] SubTask 5.1: 向用户展示根因判定及 pre-fix/post-fix 对照证据，收集“已修复、仍可复现、症状变化或中止调试”的明确反馈。
  - [x] SubTask 5.2: 仅在用户确认已修复或中止后，移除全部 `debug-point` 插桩、停止 Debug Server，并删除 `debug-canvas-cpu-spike.md`、`.dbg/canvas-cpu-spike.env` 和对应 NDJSON 日志。
  - [x] SubTask 5.3: 清理后重新运行受影响的前端检查，确认业务代码与测试中无临时调试逻辑残留。

# Task Dependencies
- Task 2 依赖 Task 1。
- Task 3 依赖 Task 2 的运行时证据，未确认根因前不得修改业务逻辑。
- Task 4 依赖 Task 3。
- Task 5 依赖 Task 4 和用户明确反馈。
