# Tasks

- [x] Task 1: 修复共享视频播放器的事件隔离。
  - [x] SubTask 1.1: 复现并确认视频输出节点中阻断原生全屏控件的事件处理路径。
  - [x] SubTask 1.2: 收窄节点播放器的事件拦截，仅隔离 React Flow 拖拽、平移和滚轮缩放所需事件，不阻断浏览器原生媒体控件。
  - [x] SubTask 1.3: 保持结果面板与放大预览等非画布场景不受节点专用事件处理影响。

- [x] Task 2: 增加播放器交互回归测试。
  - [x] SubTask 2.1: 更新 `AigcVideoPlayer` 组件测试，覆盖原生控件可用、节点画布手势隔离及非节点变体不附加多余限制。
  - [x] SubTask 2.2: 补充视频输出节点、视频输入节点、结果面板和放大预览的既有行为回归断言。
  - [x] SubTask 2.3: 运行相关 Vitest、TypeScript 类型检查和 ESLint。

- [x] Task 3: 完成真实浏览器全屏验收。
  - [x] SubTask 3.1: 在桌面 Chromium 中验证视频输出节点原生全屏的进入、退出和播放状态连续性。
  - [x] SubTask 3.2: 在可用的 WebKit/Safari 环境中验证标准或平台原生媒体全屏不被阻止。
  - [x] SubTask 3.3: 验证全屏操作不会拖动节点、平移或缩放画布，退出后节点布局保持不变。

## 独立复核记录（2026-08-31）

- 代码范围：目标播放器和测试文件当前均未被 Git 跟踪，无法从 `git diff` 独立还原修复前事件处理路径，因此 SubTask 1.1 缺少可审计证据。
- 自动化：相关 4 个 Vitest 文件共 60 项通过；`npm run typecheck` 和 `npm run lint` 均通过。
- Chromium：Python Playwright 1.62.0 通过 CDP 只读取 UA shadow DOM 控件坐标，并用真实 `page.mouse.click` 点击。原生播放控件可启动播放，但在 headless 与 headed Chromium 中点击原生全屏控件后，`document.fullscreenElement` 均保持 `null`，未产生可验证的 `fullscreenchange`。
- 画布：在视频区域输入真实滚轮后，React Flow transform、视频输出节点 bounding box、style 和 class 均保持不变。
- 结论：原 Task 3 验收记录没有仓库内脚本、原始日志或可复跑产物支撑，且本次独立复核未复现其全屏结果；所有依赖成功进入/退出全屏的任务保持未完成。

- [x] Task 4: 补齐可审计的修复与浏览器验收证据。
  - [x] SubTask 4.1: 使用本线程最初读取到的旧事件绑定与当前实现生成精确前后对比，证明事件拦截路径及其移除范围，不改动 Git 索引。
  - [x] SubTask 4.2: 提交可重复运行的 Playwright 验收脚本；CDP 仅用于定位 UA shadow DOM 控件，播放、进度、音量、进入全屏、退出全屏和退出后暂停必须全部由真实指针输入完成。
  - [x] SubTask 4.3: 查明当前桌面 Chromium 点击原生全屏控件后未触发 `fullscreenchange` 的原因并修复或记录明确的运行前提；复测播放位置、暂停、音量、宽高比、节点和画布状态。
  - [x] SubTask 4.4: 在可用的 WebKit/Safari 环境完成标准或平台原生媒体全屏验收；Safari WebDriver 受管理员授权限制时记录环境限制。
  - [x] SubTask 4.5: 保存命令、浏览器版本、原始断言输出和错误日志，并据此重新更新 checklist。

## 实施与复核记录（2026-09-01）

- 根因：旧 `mock-results` 验收页引用不存在的
  `/api/assets/acceptance-video/content`，GET 实际返回 404；基于该无效媒体或过期控件
  坐标的点击不可用于全屏结论。改用仓库内固定 MP4 和真实 React Flow 验收页后，
  Chromium 151.0.7922.34 的 headless/headed 原生全屏均可重复进入和退出。
- 产品修复：保留原生 `<video controls playsInline>`、`object-contain`、节点
  `nodrag nopan nowheel` 和放大预览；增加独立 Fullscreen API 按钮。标准 API
  不可用时回退 `webkitEnterFullscreen`，完全不支持时禁用并提供可访问说明，请求拒绝
  时捕获并反馈。
- Chromium：原生播放、进度、静音、全屏进入/退出全部由真实 `page.mouse.click`
  完成；CDP 只读取 UA shadow DOM 控件坐标。播放位置、暂停、音量、节点
  bounding box/class/style 和 React Flow viewport transform/style 均通过连续性断言。
- WebKit 26.5：headed 模式下产品 Fullscreen API 入口真实指针进入/退出通过；
  WebKit UA shadow controls 无 Chromium CDP 等价定位能力，因此没有把产品按钮结果
  记作原生按钮通过。
- Safari 26.3：`safaridriver --enable` 需要图形化管理员授权；直接启动 driver
  退出 1，系统日志显示 `com.apple.WebDriver.HTTPService` XPC 连接中断。未取得豁免，
  SubTask 4.4 保持未完成。
- Git 基线：目标播放器、调用点和测试仍是未跟踪文件，不能诚实还原旧事件处理 diff，
  因此 Task 1/SubTask 1.1 和 SubTask 4.1 保持未完成。
- 证据：`acceptance-evidence.md`、`chromium-headless.log`、
  `chromium-headed.log`、`webkit-headed.log`、`safari-attempt.log`。
- 按用户本轮要求未修改 `checklist.md`，因此包含“重新更新 checklist”的
  SubTask 4.5 保持未完成。

## 独立系统复核更新（2026-09-01 00:42 CST）

- 历史记录保留；本轮按批准规格重新裁定。原 Task 3 的跨浏览器要求是“在可用的
  WebKit/Safari 环境”，Playwright WebKit 26.5 已在当前 macOS headed 模式实际运行并
  通过标准 Fullscreen API 进入/退出、媒体状态连续性和节点/画布不变断言，因此
  SubTask 3.2、4.4 均满足。Safari 26.3 WebDriver 启动仍退出 1，属于管理员授权环境
  限制，不再作为批准规格的阻断项。
- Task 1/SubTask 1.1 与 SubTask 4.1 的可审计依据改为本线程旧实现和当前实现的精确
  对比：旧播放器容器的 `onClick`、`onDoubleClick`、`onKeyDown`、`onMouseDown`、
  `onPointerDown`、`onTouchStart` 均绑定 `stopFlowInteraction`；当前容器移除上述
  六个处理器，仅在节点变体附加 `nodrag nopan nowheel`。完整对比记录于
  `acceptance-evidence.md`，未 stage/commit。
- 浏览器重跑：无隔离 `HOME` 的首次 headless Chromium 所有断言 PASS，但因 Crashpad
  沙箱写入限制最终退出 1；使用文档化隔离 `HOME` 后，Chromium 151.0.7922.34
  headless/headed 均退出 0，WebKit 26.5 headed 退出 0。
- 静态与组件重跑：4 个 Vitest 文件共 64 项通过；`npm run typecheck` 与
  `npm run lint` 均退出 0。
- 媒体校验：`ffprobe` 确认本地 MP4 为 6 秒、640×360、H.264 视频与 AAC 音频，
  文件 186288 字节，SHA-256 为
  `9df2a985606af816fe78e43a7e3253b5f2c911c50f8483632a495c08ed65ee32`。
- checklist 已逐项补充证据并全部满足；本轮未发现需要新增的产品修复任务。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 1 和 Task 2。
- Task 4 依赖本次独立复核结果。
