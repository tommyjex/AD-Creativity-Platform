# 非 headline 字幕加粗验收

状态：用户追加授权本地打包安装验证。0.3.5 已构建安装，源码与安装包离线验收完成，本地后端已重启，健康接口 200。

- [x] `body`、`footnote`、null、缺失及未知角色的文字元素提交 `bold=true`。
- [x] `headline` 的实际字体文件仍 `bold=false`；自动缺字回退仍 true；人工标题字体行为保持。
- [x] 非 headline 的人工字体选择仍按要求加粗，font_type 保持所选字体。
- [x] 产品视频、开箱视频及缺少视频类型的独立 API 都按角色传递 bold。
- [x] PNG 图片不携带 bold；PNG 无物化器回退为文字时，四种角色分别验证标题 false、其余 true。
- [x] 字号下限、单行、内容、时间、底板、视频码率、品牌与字典规则回归通过。
- [x] 新排版版本为 `single-line-adaptive-panel35-nonheadline-bold-v5`；新草稿 render 幂等及历史已提交任务恢复回归通过。
- [x] 共享源码完整 pytest：767 passed，含 25 个真实字体测试，无跳过。
- [x] 平台字幕/媒体相关 pytest：687 passed，无失败。
- [x] Ruff 致命错误、Python 编译、两仓库 `git diff --check` 通过。
- [x] 源码阶段版本配置保持；本地打包阶段按授权更新配置，21 个既有产物 SHA 继续保持。
- [x] 从 sdist 构建 0.3.5 wheel，安装平台 `.venv` 与隔离副本；21 个模块与源码、wheel、sdist 和安装文件一致。
- [x] 两种安装模式各通过 234 个真实字体策略用例，确认文字 bold、PNG 字段与像素、底板及码率。
- [x] 安装包完整离线测试 767 passed，含 25 个真实字体测试，无跳过。
- [x] 平台使用安装包回归：687 passed，无失败。
- [x] 构建前 egg-info 字节保持；Ruff、编译、两仓库 diff 与部署脚本离线测试通过。
- [x] 本地后端重启后健康接口 200；平台编译器与安装包共享函数一致，导入来自 `.venv`，包版本 0.3.5、排版版本 v5。
- [x] 未提交、推送或生产部署，未调用真实模型/MediaKit。
- [ ] 真实 MediaKit 合成加粗后的字重、字宽与排版验收（需另行授权）。

执行证据在 `/tmp/subtitle-nonheadline-bold`：

- `source-complete-tests.xml`：共享源码 767 项。
- `platform-tests.xml`：平台源码集成 687 项。
- `unpublished-baseline.sha256`：发布文件保持。
- `fonts/`：临时真实字体缓存；四个字体 SHA 与此前已验证版本相同。

首次共享源码测试的 25 个错误均为临时真实字体文件缺失，未出现断言失败；补齐字体后全量通过。外部 Starlette/httpx 和 HTTP 422 常量存在弃用警告。

源码阶段独立测试采用 `PYTHONPATH=src`，平台显式加入共享源码；本地安装阶段改为安装包验证，从 `/tmp` 运行共享测试，平台仅使用根路径。当前磁盘安装包为 0.3.5，排版版本为 `single-line-adaptive-panel35-nonheadline-bold-v5`。重启前确认 queued/running 工具任务为 0，并核对旧监听进程所属路径和启动命令。

本地包证据：`build-report.json`、`installed-tests.xml`、`platform-installed-tests.xml`、`verification/release-installed.json`、`verification/release-isolated.json`、`prior-artifacts.json`。两个验证模式确认实际模拟提交的非 headline 文字 bold=true、标题原规则及 image 无 bold。供应商最终成片和前端精确字重预览不属于离线验证结论。

运行证据：`runtime-verification.json`。本地后端以 `.trae/environments/run.json` 的原保存命令重启，监听 PID 从 15149 更换为 23301，服务保持运行。健康接口返回的是平台版本 0.1.0；字幕包版本通过同一 `.venv` 的导入验证为 0.3.5。未通过健康接口宣称返回了字幕包版本。
