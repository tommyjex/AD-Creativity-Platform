# 视频字幕按视觉角色选择字重验收清单

- [x] 自动 `headline` 使用已有 Century Gothic Bold 文件。
- [x] 自动 `body` 使用用户提供的 Century Gothic Regular 文件。
- [x] 自动 `footnote` 使用相同 Regular 文件。
- [x] 缺失、`null` 或非法旧角色使用 Regular，不新增阻断。
- [x] 同一 `block_id` 的标题/正文分别选字体，不按 `line_index` 猜测字重。
- [x] 使用实际 Bold/Regular 文件时 MediaKit `bold: false`，避免重复合成加粗。
- [x] 字体测量、有效字号、摘要和压制使用同一实际选用字体。
- [x] 字重变化后重新计算宽度和字号，原始 BBox、时间、译文不变。
- [x] 保留单行扩框、边界保护、底板和对齐规则，不新增描边或强制换行。
- [x] 显式人工字体覆盖保持优先，旧人工 Bold 不被批量覆盖。
- [x] 清空人工字体后立即恢复按角色自动选择。
- [x] 自动缺字回退保持既有提示；预置字体标题请求加粗，正文/脚注不加粗。
- [x] 人工字体的既有缺字回退行为不被角色默认规则覆盖。
- [x] 不把回退字体估算度量或本地测试当作真实成片字重验证。
- [x] 字体下拉框默认文案说明角色自动规则，粗体目录项不再标注全局默认。
- [x] 旧派生 Bold `font_type` 不会让自动正文预览或新压制继续固定为粗体。
- [x] 前端字体契约检查以独立包资源定义为准，兼容入口不承载第二份规则。
- [x] 新 `LAYOUT_VERSION` 阻止复用旧压制任务，同版本重复提交仍幂等。
- [x] 旧成片保留；重新压制应用新规则，无需重新提取或翻译。
- [x] 包版本、wheel、平台 requirements 和发布说明统一为 0.2.2。
- [x] wheel 的隔离导入和平台实际安装验证通过；线上仍只拉取平台仓库。
- [x] 不新增数据库迁移，不修改 VLM 输出 Schema 或通用 AIGC 多轨编辑器字重策略。
- [x] 独立包及平台必要回归、Ruff、Python 编译和双方差异格式检查通过。
- [x] 字幕前端 Vitest、TypeScript、lint、构建通过。
- [x] Playwright 在桌面 1440×900、平板 834×1112、手机 390×844 验证字体选择、预览、人工覆盖、只读权限和无水平溢出。
- [x] 真实 MediaKit 验收的执行状态和边界明确，未调用计费接口时不宣称真实压制通过。
- [x] 用户已有改动保持；未经明确请求不提交、推送或部署。

## 最终验收证据（2026-11-16）

### 实际安装与宿主回归

- 本次仅编辑本 checklist；不修改业务代码、spec、tasks 或他人改动，不提交、推送或部署。未启动服务，全部验证命令已结束。
- 根目录实际执行以下命令，使用根 `.venv` 和 `PYTHONPATH=.`，无独立源码注入：**618 passed、1 skipped、5 warnings，30.21 秒**，共收集 619 项。跳过项为关闭的计费 smoke，警告为 Starlette/httpx 与 HTTP 422 名称弃用；未调用计费接口。

```bash
RUN_PAID_MODELARK_SMOKE=false PYTHONPATH=. .venv/bin/python -m pytest -p no:cacheprovider backend/tests/test_subtitle_translation_*.py backend/tests/test_video_subtitle_grounding_*.py backend/tests/test_modelark_subtitle_translation.py backend/tests/test_modelark_video_subtitle_grounding.py backend/tests/test_aigc_video_subtitle_extraction_contract.py backend/tests/test_mediakit_*.py backend/tests/test_composer_subtitles.py backend/tests/test_asset_multitrack_storage.py backend/tests/test_workspace_contracts.py backend/tests/test_paid_modelark_video_subtitle_grounding_smoke.py
```

- 同环境复核：发行版与模块版本均为 **0.2.2**，包及 layout 来自 `.venv/lib/python3.14/site-packages/video_subtitle_grounding/`；平台兼容入口与安装包 layout 为同一对象，排版版本为 `single-line-adaptive-panel35-role-font-v2`。
- 全量宿主回归包含 **124 项 layout、28 项 preview**；preview 修复已在实际 wheel 上通过。覆盖逐条角色、同 block 不同字重、旧粗体摘要、人工覆盖及清空、回退载荷和字体解析先于测量。
- 工作区测试验证新旧排版版本任务不同、同版本提交幂等、草稿与提取任务不变、旧任务/成片/历史保留，新压制无需重跑提取或翻译。
- 沿用既有独立源码 **379 passed**（1 warning，5.53 秒），本次未重复执行。隔离安装 wheel **379 passed**（1 warning，6.32 秒）及根安装 layout **124 passed**（1 warning，1.74 秒）见 [发布证据](release-evidence.md)；隔离测试禁止网络连接并校验安装来源。

### 发布产物与静态检查

- 实测 wheel **47,959 字节**，SHA256 `3108406c8e99f5877fc00eeace68beaba63f00af27272cea3fa91c551daa25ca`；源码归档 **111,045 字节**，SHA256 `f71fbc66f53ffa111820f9f33ff7f119ee02f59f88686010bdb7a2157f241b56`。均与独立 dist 逐字节一致，匹配 `vendor/README.md`。
- wheel 元数据/RECORD 哈希与大小、安装 `direct_url.json` 哈希通过；**17 个 Python 模块**与实际安装和当前源码逐字节一致，sdist 中 **31 个源码/测试文件**与当前树一致。0.1.0、0.2.0、0.2.1 回滚 wheel 与平台 HEAD 字节一致。
- 包版本定义、requirements、vendor 发布说明统一为 0.2.2；生产仍只需平台仓库及随仓库发布的 wheel，无需第二份仓库检出。
- 最终发布变更后重跑均通过：宿主 `.venv/bin/python -m ruff check backend --select E9,F63,F7,F82`、`.venv/bin/python -m compileall -q backend`；独立仓库使用根解释器运行 `ruff check src tests --select E9,F63,F7,F82`、`compileall -q src tests`；双方 `git diff --check`。
- 已有范围核查确认未新增数据库迁移、未变更 VLM Schema 或通用 AIGC 多轨编辑器字重策略；兼容入口不维护第二份字体规则。

### 前端与浏览器

- 已读取父任务证据 [verification.md](file:///tmp/subtitle-role-acceptance.1u01aO/verification.md)：字幕 Vitest **64 项、4 个文件**通过，TypeScript、全量 ESLint（零警告）、生产构建通过（14/14 静态页面）；本次未重复执行前端测试。
- 实际 Chromium Playwright：Creator/Viewer、既有流程/角色字体流程，在 **1440×900、834×1112、390×844** 三视口共 **12 个案例**通过；**54 次实际渲染字体检查、24 张验收截图**，检查 240 个禁用只读控件，Viewer 修改请求为零，无水平溢出。
- 使用实际下载的 Regular/Bold 文件，校验已加载 FontFace、实际字形与 PostScript 身份、`font-weight: 400`、`font-synthesis: none`；覆盖角色默认、忽略旧派生 Bold、人工 Regular/Bold、清空后立即恢复及保存/重载。
- `frontend/next-env.d.ts` 前后逐字节保持，SHA256 `0f70629890b72a0a82e91972cc032c04b658b26c265373cb711cf576bfbf8fcc`。父任务两个测试服务器均已停止；npm 旧日志环境曾回收，环境恢复单独处理，不将其计为产品失败。

### 剩余边界

- 本清单 **27/27 项已勾选**，无剩余离线、前端构建或浏览器验收项。浏览器业务接口、持久化和视频输出使用 fixture，不代表生产持久化或真实压制。
- **真实 MediaKit 压制未执行**。测试及 Chromium 实际字体检查不证明供应商成片字重、预置回退度量/覆盖、垂直锚点、扩展底板或容量；未使用计费 API，不能宣称真实成片验收通过。
- 生产生效仍需获授权的平台更新、安装该 wheel 并重启后端；本次未部署或重启。
