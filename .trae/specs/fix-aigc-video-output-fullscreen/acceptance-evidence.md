# 视频输出全屏验收证据

日期：2026-09-01（北京时间）

## 根因

独立复核使用的 `mock-results` 页面引用
`/api/assets/acceptance-video/content`，该资源实际返回 404。经过
`getSafeAssetContentUrl` 后页面没有有效可播放媒体，不能作为 UA 原生控件验收基础。
对无效媒体或过期坐标进行真实指针点击不会产生 `fullscreenchange`。

新增本地固定 H.264/AAC MP4 和真实 260×220 React Flow 节点验收页后，Chromium 151 的
headless/headed 模式均可通过 UA shadow DOM 只读定位原生按钮，并由
`page.mouse.click` 成功触发原生 `VIDEO` 全屏。因此本次失败不是 Chromium
禁用原生全屏，也不能归因于当前已移除的 `stopPropagation`。

当前目标文件均未纳入 Git 基线，无法从仓库历史还原旧事件拦截代码。该证据缺口保留。

## 本轮可审计前后对比

Git 历史不能提供基线是历史事实，但本线程最初已读取并明确记录旧实现，因此无需改动
Git 索引即可对 Task 1/4.1 做以下精确对比：

```diff
- onClick={stopFlowInteraction}
- onDoubleClick={stopFlowInteraction}
- onKeyDown={stopFlowInteraction}
- onMouseDown={stopFlowInteraction}
- onPointerDown={stopFlowInteraction}
- onTouchStart={stopFlowInteraction}
+ // 播放器容器不再注册上述六个传播拦截处理器
```

当前 `aigc-video-player.tsx:142-160` 的播放器容器只通过
`variant === "node" && "nodrag nopan nowheel"` 附加 React Flow 节点边界标记，并
保留原生 `<video controls playsInline>`。组件测试将 pointer、mouse、touch、wheel、
click、double-click 和 keydown 派发到视频元素，父级均收到一次，证明旧的完整事件链
拦截已移除；panel 与放大预览不附加节点标记。

## 2026-09-01 独立重跑

执行时间：2026-09-01 00:38-00:42 CST。

- 直接运行 `npm run acceptance:video-fullscreen` 时，全部浏览器断言与最终
  `result: "PASS"` 已输出，但 Chrome Crashpad 随后尝试写入沙箱外
  `settings.dat`，命令最终退出 1。该次不计为成功命令。
- 使用下述文档化隔离 `HOME` 重跑后，Chromium 151.0.7922.34 headless 退出 0；
  原生全屏事件为 `VIDEO -> null`，产品全屏事件为 `DIV -> null`。
- Chromium 151.0.7922.34 headed 退出 0，断言和事件序列与 headless 一致。
- Playwright WebKit 26.5 headed 退出 0，产品标准 Fullscreen API 事件为
  `DIV -> null`；播放状态、位置、音量、节点和画布状态连续性均通过。WebKit UA
  shadow controls 没有 Chromium CDP 等价定位能力，因此原生控件定位明确 SKIP，
  不把它虚报为通过。
- `safaridriver --version` 返回 Safari 26.3；本轮 `safaridriver -p 0` 退出 1。
  既有 `safari-attempt.log` 记录 `--enable` 需要图形化管理员授权及 WebDriver XPC
  服务中断。该项是环境限制；已运行的 WebKit 26.5 满足批准规格“在可用的
  WebKit/Safari 环境”。

## 可重复命令

前置条件：前端运行于 `http://127.0.0.1:3000`。

```bash
cd frontend
HOME=/tmp/aigc-playwright-home \
PLAYWRIGHT_BROWSERS_PATH="/Users/bytedance/Library/Caches/ms-playwright" \
npm run acceptance:video-fullscreen
HOME=/tmp/aigc-playwright-home \
PLAYWRIGHT_BROWSERS_PATH="/Users/bytedance/Library/Caches/ms-playwright" \
npm run acceptance:video-fullscreen -- --headed
HOME=/tmp/aigc-playwright-home \
PLAYWRIGHT_BROWSERS_PATH="/Users/bytedance/Library/Caches/ms-playwright" \
npm run acceptance:video-fullscreen -- --browser=webkit --headed
```

当前机器三个成功命令实际使用的缓存绝对路径为
`/Users/bytedance/Library/Caches/ms-playwright`。临时 `HOME` 用于避免受限执行环境
写入 Chrome for Testing 的 Crashpad 配置；不改变页面或浏览器能力。

## 原始结果

- `chromium-headless.log`：Chrome for Testing 151.0.7922.34，PASS。
- `chromium-headed.log`：Chrome for Testing 151.0.7922.34，PASS。
- `webkit-headed.log`：Playwright WebKit 26.5，产品 Fullscreen API PASS；
  UA 原生控件因无 Chromium CDP 等价定位能力明确 SKIP。
- `safari-attempt.log`：Safari 26.3；`safaridriver --enable` 需要图形化管理员授权，
  随后 WebDriver XPC 服务中断，Safari 原生控件验收未完成。

上述日志是实施阶段保存的原始输出；本轮没有改写日志文件，而是独立重新执行同一命令
并在本文件记录退出码和新证据。

Chromium 原始断言覆盖：播放、进度、静音、原生全屏进入/退出、产品全屏进入/退出、
播放位置/暂停/音量连续性、16:9 固有比例、`object-contain`、节点 bounding box、
节点 class/style、React Flow viewport transform/style、视频区域滚轮隔离。

## 静态与组件检查

```bash
cd frontend
npm test -- --run tests/aigc-video-player.test.tsx \
  tests/aigc-flow-node.test.tsx tests/aigc-editor.test.tsx \
  tests/aigc-acceptance.test.tsx
npm run typecheck
npm run lint
```

结果：4 个测试文件、64 项测试通过；TypeScript 和 ESLint 均通过。

## 本地媒体有效性

```bash
cd frontend
ffprobe -v error \
  -show_entries format=filename,format_name,duration,size:stream=index,codec_name,codec_type,width,height,duration \
  -of json public/acceptance/aigc-video-fullscreen.mp4
shasum -a 256 public/acceptance/aigc-video-fullscreen.mp4
```

结果：文件非空，大小 186288 字节；容器格式为 MP4，视频流 H.264 640×360、音频流
AAC，两个流时长均为 6 秒。SHA-256：
`9df2a985606af816fe78e43a7e3253b5f2c911c50f8483632a495c08ed65ee32`。

## 产品代码核对

- 原生 controls：主播放器和放大预览均保留 `controls`、`playsInline`。
- React Flow 隔离：仅节点变体附加 `nodrag nopan nowheel`，非节点变体不附加。
- 全屏入口：独立按钮优先调用容器 `requestFullscreen()`；标准 API 缺失时调用视频
  `webkitEnterFullscreen()`；均不支持时禁用并提供说明。
- 错误处理：全屏请求包裹于 `try/catch`，拒绝时写入可访问反馈，不产生未处理异常。
- 等比展示：主播放器和放大预览均使用 `object-contain`。
