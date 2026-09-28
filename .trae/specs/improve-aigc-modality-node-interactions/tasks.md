# Tasks

- [x] Task 1: 建立画布级文本编辑打开协议，复用现有全屏提示词编辑器。
  - [x] SubTask 1.1: 定义仅存在于前端运行时的节点交互 Context 或等价受控接口，支持按 `nodeId` 请求打开文本编辑器并记录焦点恢复目标。
  - [x] SubTask 1.2: 将 `AigcPromptEditor` 的全屏 Dialog 打开能力接入该协议，同时保留右侧检查器现有入口、草稿隔离、只读、优化、应用和取消语义。
  - [x] SubTask 1.3: 在目标节点删除、切换或重复打开时收敛状态，确保只有一个 Dialog 且不会把草稿写入错误节点。

- [x] Task 2: 调整图片节点的拖拽与双击放大行为。
  - [x] SubTask 2.1: 将有效图片画面从单击命令按钮改为可拖拽内容区，删除单击打开 Dialog 的行为。
  - [x] SubTask 2.2: 在未形成拖拽的双击事件中打开既有原图 Dialog，并阻止事件继续触发画布双击缩放。
  - [x] SubTask 2.3: 保留键盘 Enter 打开预览、精准编辑按钮、状态角标、图片 `object-contain` 和不可用占位行为。

- [x] Task 3: 调整视频节点的拖拽、双击播放与原生控件边界。
  - [x] SubTask 3.1: 在节点播放器中划分视频画面交互层与原生控制条，画面可作为拖拽起点，控制条继续使用 `nodrag`、`nopan` 和 `nowheel`。
  - [x] SubTask 3.2: 双击视频画面时调用当前视频元素的 `play()`，播放中保持连续，不重置进度或切换暂停。
  - [x] SubTask 3.3: 捕获并消化播放 Promise 拒绝，保留原生播放、暂停、进度、音量和全屏能力。
  - [x] SubTask 3.4: 确保实现不读取或依赖浏览器私有的原生控制条 DOM。

- [x] Task 4: 为文本节点增加双击全屏编辑。
  - [x] SubTask 4.1: 让文本摘要和空白内容区保持可拖拽，并在双击时请求打开当前节点的全屏提示词编辑器。
  - [x] SubTask 4.2: 双击时先选中目标节点，再传递当前有效 Run 上下文；托管文本沿用只读预览，可覆盖上游文本沿用 override 语义。
  - [x] SubTask 4.3: 为文本内容区提供键盘 Enter 等价入口，并在关闭 Dialog 后恢复焦点。

- [x] Task 5: 固化单击、拖拽、双击和控件操作的事件优先级。
  - [x] SubTask 5.1: 保持单击节点只执行选择和打开检查器，不触发图片、视频或文本的主操作。
  - [x] SubTask 5.2: 保证超过拖拽阈值的指针序列只移动节点，松开时不会追加触发双击动作。
  - [x] SubTask 5.3: 保持端口、按钮、链接、输入框和视频原生控制条不触发拖拽或画布缩放。

- [x] Task 6: 增加组件与集成回归测试。
  - [x] SubTask 6.1: 更新图片节点测试，覆盖单击不放大、从图片画面拖拽、双击放大、键盘打开、不可用图片和 Dialog `object-contain`。
  - [x] SubTask 6.2: 更新视频播放器测试，覆盖双击调用 `play()`、播放中不暂停、Promise 拒绝无未处理异常、原生控件保持隔离。
  - [x] SubTask 6.3: 更新文本节点与提示词编辑器测试，覆盖本地文本、上游 override、托管只读、取消丢弃、焦点恢复和节点删除。
  - [x] SubTask 6.4: 更新编辑器集成测试，覆盖单击选择、三类节点拖拽后坐标保存以及双击不触发画布缩放。

- [x] Task 7: 执行多视口浏览器验收与质量门禁。
  - [x] SubTask 7.1: 在桌面 Chromium 中真实拖动图片画面、视频画面和文本内容区，并验证坐标变化与刷新后持久化。
  - [x] SubTask 7.2: 在桌面 Chromium 中验证图片双击放大、视频双击播放、原生播放按钮和文本双击全屏编辑。
  - [x] SubTask 7.3: 在平板和手机视口确认节点、Dialog、视频控制条和文本编辑器无重叠；触摸操作无回归。
  - [x] SubTask 7.4: 运行相关 Vitest、完整前端测试、TypeScript、ESLint、生产构建和 `git diff --check`。

- [x] Task 8: 完成触摸端多视口补验。
  - [x] SubTask 8.1: 复盘上次超时，识别不稳定选择器、触摸模拟或验收数据原因，并改用稳定 acceptance fixture 与可访问选择器，避免重复盲等。
  - [x] SubTask 8.2: 在平板触摸上下文验证文本节点可打开全屏 Dialog，且 Dialog 与文本编辑器无重叠、裁切或溢出。
  - [x] SubTask 8.3: 在手机视口验证节点布局、图片 Dialog、视频原生 controls 和文本编辑器无重叠或溢出，并执行关键触摸操作确认无明显回归。
  - [x] SubTask 8.4: 对验收发现的产品缺陷实施最小修复，运行聚焦测试，并记录各视口、具体操作与结果。
  - [x] SubTask 8.5: 全部补验通过后勾选 SubTask 7.3 与 Task 8；确认 SubTask 7.1-7.4 全部完成后勾选 Task 7。

- [x] Task 9: 修复最终系统核验发现的 ESLint 生成目录污染。
  - [x] SubTask 9.1: 复现 `npm run lint` 扫描 `frontend/tmp/task8-next*` 内 Next 生成物并失败，确认业务源码不是报错来源。
  - [x] SubTask 9.2: 将隔离构建输出目录 `tmp/**` 加入 ESLint 忽略列表，不删除或修改既有验收缓存。
  - [x] SubTask 9.3: 复跑 ESLint、TypeScript、生产构建、完整前端 Vitest 和 `git diff --check`，确认最终门禁全部通过。

- [x] Task 10: 修复最终生产构建核验的临时副本环境。
  - [x] SubTask 10.1: 确认临时副本构建仅因 `node_modules` 符号链接越出 Turbopack 项目根而失败，未进入源码编译阶段。
  - [x] SubTask 10.2: 在原前端工作区使用全新的 `tmp/spec-seventh-final` 隔离输出目录执行生产构建，不复用既有构建缓存。
  - [x] SubTask 10.3: 构建成功后清理本次新建输出并恢复 Next 自动生成的声明引用，不触碰此前用户缓存。

- [x] Task 11: 修复最终浏览器补验脚本加载方式。
  - [x] SubTask 11.1: 确认补验脚本因带连字符的既有脚本文件名无法作为普通 Python 模块导入而立即失败，无浏览器进程残留。
  - [x] SubTask 11.2: 改用 `importlib.util.spec_from_file_location` 加载既有 fixture helper，并复跑桌面关键交互及平板、手机布局补验。

# Task Dependencies

- Task 2 和 Task 3 可在 Task 1 之外并行实现。
- Task 4 依赖 Task 1。
- Task 5 依赖 Task 2、Task 3 和 Task 4。
- Task 6 依赖对应功能任务完成，可按图片、视频、文本三组并行补充。
- Task 7 依赖 Task 1-6。
