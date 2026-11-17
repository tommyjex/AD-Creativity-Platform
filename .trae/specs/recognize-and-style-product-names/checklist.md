# 产品名称识别与混合字体验收

实施和离线验收完成，记录日期为 2026-11-16（北京时间）。没有调用计费模型、真实 MediaKit 或生产 TOS；没有提交、推送或部署。

- [x] 附件 72 个名称、型号/规格分界、大小写、来源页逐项核对。
- [x] `FLOOR ONE S7 / Stretch Steam` 使用指定 Black / Light；`FLOOR ONE STRETCH S6` 整段 Black。
- [x] 翻译保护与恢复规范名称，内部标记不泄露；标记丢失和重复保留警告。
- [x] 最长匹配、词边界、重复和多产品、大小写/重复空格兼容、同块跨行规格及上下文失效。
- [x] 未收录型号/规格由模型参照完整字典范式拆分，结构一致即可应用；没有字典成员拦截。模型行为由 HTTP fixture 验证。
- [x] 识别失败、非法拆分或缺乏跨行依据时保留文本和其他字幕的处理能力。
- [x] 普通 Steam、Pro、Stretch 不独立套用产品字体。
- [x] 产品区间字体优先；普通文字保留人工与角色字体。
- [x] 产品型号/规格自动判定结果只读展示，无人工拆分输入、关闭复选框、手动识别按钮或人工校验提示；译文编辑使旧图层失效。
- [x] 翻译、保存和 POST 排版计算自动判定；修改后重判，重复操作复用文本/同块上下文/字典版本指纹；异常自动重试一次。
- [x] Unicode code point、emoji、区间及纯文本往返一致。
- [x] 实际多字体共同字号与基线、名称空格完整、单行扩框、边界及对齐。
- [x] 透明 RGBA、单一底板、抗锯齿和字形 overhang 无裁切；没有合成加粗或描边。
- [x] 真实 Source Han Sans 文件覆盖混排中的中文缺字，保留分段字体和警告；无法覆盖的字符可回退普通文字。
- [x] 预览和压制复用 PNG 编译结果，供应商提交前物化为 HTTPS 图片 source；物化失败退回普通文字并警告。
- [x] 匿名图层请求 401，Viewer 名称识别 POST 403，跨工作区图层 404；缓存复用及同源预览。
- [x] 签名 URL 仅供运行时提交，工作区/布局不持久化；旧图层保留，编辑不删除历史对象。生产存储清理策略沿用环境配置，未在此部署变更。
- [x] 排版/字典版本进入任务幂等，旧任务与成片保持；并发编辑不会被识别结果覆盖。
- [x] 0.3.1 wheel、sdist、平台 vendor/requirements 和 SHA 一致，服务器只需拉平台仓库。
- [x] 独立包、安装包平台回归、Ruff fatal、编译、双方差异格式检查及部署脚本通过。
- [x] 前端 Vitest、TypeScript、全量 lint 和生产 build 通过。
- [x] Playwright 三视口、两种权限验证 PNG、保存/预览自动重判、无人工产品控件、失效、加载错误回退、只读及无水平溢出。
- [x] 真实模型识别质量和真实 MediaKit 输出均明确记录为未执行，不计作验证通过。
- [x] 用户已有修改保留，没有执行提交、推送或部署，测试服务已停止。

## 验证结果

| 检查 | 结果与边界 |
| --- | --- |
| 独立包完整 pytest | 396 passed（0.3.1，新增识别自动重试恢复） |
| 平台字幕/提取/翻译/多轨/压制相关 pytest | 641 passed，`PYTHONPATH=.`，从根 `.venv` 实际安装的 0.3.1 wheel 导入；含产品自动保存/预览/重试/缓存与 memory/MySQL 并发冲突 |
| 前端字幕、API、上传和提取契约 Vitest | 76 passed / 6 files |
| TypeScript / ESLint / Next build | 全部通过 |
| Ruff | 独立包配置及平台要求的 `E9,F63,F7,F82` 通过；尝试平台全部规则发现既有大范围风格问题，未修改无关模块，不宣称全部 Ruff 规则通过 |
| compileall / 两仓库 git diff --check | 全部通过 |
| 部署脚本回归 | 全部通过，不执行实际部署 |
| 字体像素 | 72 个字典名称 + 4 个未收录/混排/中文回退样例，共 76 个 |
| 浏览器 | 1440×900、834×1112、390×844 × Creator/Viewer × 产品/角色字体/原工作流，共 18 组全部通过 |
| 真实模型 / MediaKit / 生产 TOS | 均未调用；模型、存储和供应商契约使用 mock |

真实字体哈希与每个样例的分段、基线、字号、PNG 哈希和透明边界见 [real-font-evidence.json](evidence/real-font-evidence.json)。Black 为 Avenir LT Std 95 Black（28,688 字节），Light 为 Avenir LT Std 35 Light（28,084 字节）。中文回退使用实际 Source Han Sans CN Regular（8,429,224 字节）。普通角色字体通过 Chromium 实际 PostScript 字体检查。

0.3.1 浏览器证据（业务 API 为 fixture，实际 PNG 和普通角色字体为真实文件）：

- [自动判定与 PNG 预览](file:///tmp/subtitle-automation-acceptance/products/results.json)
- [角色字体回归](file:///tmp/subtitle-automation-acceptance/roles/results.json)
- [原工作流回归](file:///tmp/subtitle-automation-acceptance/workflow/results.json)
- [桌面自动判定截图](file:///tmp/subtitle-automation-acceptance/products/product-creator-1440.png)
- [手机自动判定截图](file:///tmp/subtitle-automation-acceptance/products/product-creator-390.png)

以下为此前 0.3.0 产品交互的历史证据，不代表当前已移除的人工操作：

- [产品校对结果](evidence/browser/results.json)
- [角色字体回归](evidence/role-regression/results.json)
- [原工作流回归](evidence/workflow-regression/results.json)
- [桌面产品校对截图](evidence/browser/product-creator-1440.png)
- [手机产品校对截图](evidence/browser/product-creator-390.png)
- [字体联系表](evidence/product-font-contact-sheet.png)

## 包与部署

排版版本为 `single-line-adaptive-panel35-product-font-v3`，字典版本为 `tineco-names-20261116-v1`。0.3.1 wheel SHA256 为 `a146a6221ba12adc52c2b1009f49a66f9167f2b4954e0eb999e041614c392ed6`，源码归档 SHA256 为 `c6933c7ecd3dca11711b2d6b2b5decde6965bd4835e45d88d321ef6718bca71b`。

[实际安装验证](evidence/release-installed.json)和[隔离副本验证](evidence/release-isolated.json)均确认导入路径不是 standalone 源码目录，wheel 中所有 Python 源码与当前独立源码一致。产物为 `vendor/video_subtitle_grounding-0.3.1-py3-none-any.whl` 和 `exports/video-subtitle-grounding-0.3.1-source.tar.gz`；旧版保留供同步回滚。

后续上线需一起发布平台后端适配层、前端及 wheel，线上拉取平台仓库后运行 `scripts/deploy_server.sh`，脚本安装依赖、构建前端和重启服务。无需拉独立仓库，也没有数据库 DDL 迁移。旧译文中的未知名称在保存、POST 排版计算及前端压制前保存时自动判定，GET 读取不调用模型；重新压制产生新成片，不自动改写历史输出。回滚必须同步恢复适配层和前端，不能仅替换 wheel。
