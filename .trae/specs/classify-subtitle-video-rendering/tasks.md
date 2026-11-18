# 视频类型与字幕底板任务

Implemented and verified 2026-11-17. Tasks 1-7 are complete; all 26 checklist checkpoints passed within documented offline limits. Real model/MediaKit visual quality and live MySQL remain unverified; no deployment was performed.

- [x] 任务 1：建立任务级视频类型契约及失效规则。
  - 修改平台 schema 和前端 API 类型，新增 `video_category=product|unboxing`；创建/旧读取缺失默认开箱，PATCH 省略保留原值，拒绝非法值和显式 null。
  - 验证工作区 JSON、history 和任务快照保存类型，memory/SQL 仓库往返一致，不新增数据库列。
  - 类型变化纳入渲染内容失效和 revision 校验；保留原文、译文、样式、产品识别结果；类型进入渲染任务快照、幂等和可观测元数据。
  - 在 `backend/tests/test_subtitle_translation_workspace.py`、`test_subtitle_translation_routes.py`、`test_subtitle_translation_execution.py` 验证默认值、更新、409/403、失效、晚到任务保护及恢复轮询。
  - Task1 verified 2026-11-17: 120 focused offline backend tests passed across those three modules, including memory and SQL repository paths (SQLite fixture, not a live MySQL server). Ruff fatal checks, Python compilation, TypeScript and whitespace checks passed. Service contract edits complete; task4 can now add runtime category forwarding in `preview()` and `_render()`. Detailed evidence and boundaries are in checklist.md.

- [x] 任务 2：在独立字幕包统一实现两类底板策略。
  - 修改 `layout.py` 的统一配色路径，读取 render video 中的类型；产品有效底板强制透明，并排除被忽略的人工底板对文字色的影响；开箱保持当前行为。
  - 确认 `product_layout.py` 的 PNG 绘制、`render.py` 的物化失败回退与平台编译调用使用同一类型。
  - 更新排版版本，图层缓存键纳入类型/有效策略，阻止旧灰底图层误复用。
  - 在独立 `tests/test_layout.py`、`test_product_layout.py`、`test_render_api.py` 覆盖白/黑/复杂/未知背景、人工底板/文字色、多字体 PNG 透明像素、失败回退及旧调用兼容。

- [x] 任务 3：实现入口分类和预览一致性。
  - 修改 `panel.tsx`，提供产品/开箱两类新建入口，创建请求携带类型，历史列表显示类型。
  - 修改 `workspace-editor.tsx` 和 hook，显示并保存任务类型；运行/busy/Viewer 状态禁用修改，切换后清空旧预览派生结果。
  - 将类型传入 `review-dialog.tsx`、`segment-editor.tsx`、`video-preview.tsx` 与 `subtitleColors`；产品隐藏底板编辑控件，PNG 加载失败和文字占位均透明，开箱原控件保持。
  - 保留逐条底板配置供切回开箱恢复；产品相关提示按实际策略展示，不要求型号/规格人工校验。
  - 前端字幕 Vitest 验证两类新建请求、历史默认、切换/冲突/只读、底板控件、颜色及预览回退。
  - Verified frontend task3: 107 focused tests across 6 Vitest files passed; TypeScript (`--noEmit --incremental false`), full ESLint (`--max-warnings=0`), and `git diff --check` passed. Includes existing color/warning and automatic product-name regressions. API types remain task1-owned. No build, Playwright, paid calls, commit, or deployment performed by task3; browser handoff is recorded in checklist.md.

- [x] 任务 4：完成平台预览与压制集成、构建发布包。
  - 在平台 `preview()` 和 `_render()` 的运行时 video 字典传递已保存/冻结的类型，核对普通图层和产品失败回退。
  - 在 `backend/tests/test_subtitle_translation_preview.py`、`test_subtitle_product_names.py` 验证 GET/POST 预览、有效底板、缓存隔离、存储失败和压制参数。
  - 发布独立 `0.3.2` wheel/sdist，更新平台 requirements、vendor SHA 与源码归档；保留旧包及历史任务。
  - 从源码目录外安装新版 wheel 并验证导入位置、源码一致性、排版版本和两类策略；同步原发布说明，不执行部署。
  - Task4 integration verified 2026-11-17: runtime preview forwards `workspace.video_category`; render and PNG-storage fallback share frozen `snapshot.get("video_category", "unboxing")`. Installed metadata confirms `0.3.2` from root `.venv/site-packages`, layout v4. All 218 focused preview/product/execution/workspace offline tests passed; Ruff fatal checks, compilation and diff whitespace checks passed. Packaging completion is recorded in `vendor/README.md`; installed/isolated release reports passed and artifact hashes were independently matched. Task5 completed broader regression/browser acceptance separately.

- [x] 任务 5：按 checklist 完成回归和浏览器验收。
  - 跑独立包完整离线测试、实际安装 wheel 的平台字幕/多轨相关回归和前端字幕测试。
  - 通过独立配置 Ruff、平台 `E9,F63,F7,F82`、Python 编译、双方 `git diff --check`、全量 ESLint、TypeScript、Next build 和部署脚本离线回归。
  - 更新既有 `scripts/verify-subtitle-translation-browser.py`，以离线 API fixture 在桌面/平板/手机验证两类入口、保存刷新、切换、底板/PNG 回退、权限、原生播放器及无溢出。
  - 按 checklist 逐项检查并记录证据；临时截图与测试输出保存在工作区外，未执行的真实模型和 MediaKit 验收明确标注。
  - Completed 2026-11-17: Task7 corrected the stale v3 assertion; final platform broad suite **761 passed, 0 failed, 0 skipped, 0 errors** across 23 modules. Installed package **680 passed**, including **25 actual-font pixel tests**; installed/isolated release verifiers **222 policy cases each**; frontend **107 passed / 6 files**; deployment-script fixtures **38 PASS**. Both repositories' Ruff/compilation/diff checks and frontend full lint/non-incremental TypeScript passed.
  - Actual Playwright **24/24 passed**: four suites, each Creator/Viewer at all three required viewports; fixture **8/8 passed**. Servers stopped and browser-generated configs restored.
  - Next.js **16.3.6** production build passed with `npm run build -- --webpack`, output `/tmp/subtitle-category-task5-build-env-20261117/next`, log `/tmp/subtitle-category-task5-next-build-pass-20261117.log`. Turbopack rejects external dist; webpack external TypeScript resolution required a dependency symlink in the temporary parent directory. Compilation, TypeScript, **14/14** static pages and build tracing passed, exit 0. Only build-introduced generated config differences were restored; no app changes or extra test runs.
  - All **26/26** checklist checkpoints checked after Task7 and build results were available. Exact versions, artifact hashes, commands and evidence limits are in checklist.md. No commit, push, deployment, paid call or real-provider acceptance.

- [x] 任务 6：修复发布校验器 RGBA 预期不一致（失败检查点补充任务）。
  - Packaging agent owns the targeted fix in `scripts/verify-subtitle-product-release.py`: compare normalized eight-digit RGBA text colors (`#000000FF`, `#FFFFFFFF`, `#FF0000FF`) without changing application rendering behavior.
  - Packaging owner fixed normalized RGBA assertions; actual installed and isolated verifier reports both passed 222 policy cases. Commands and results are recorded in `vendor/README.md` and `/tmp/subtitle-category-release-0.3.2/verification/release-{installed,isolated}.json`. Completion confirmed from passing reports, not source inspection alone.

- [x] Task7: delegated targeted correction for the failed task5 layout-version checkpoint.
  - Own only `backend/tests/test_subtitle_translation_layout.py` and targeted records in `tasks.md` / `checklist.md`; match the existing workspace test's approved `single-line-adaptive-panel35-video-category-v4` expectation without application changes.
  - Run the failed layout file first, then the exact 761-test offline platform suite from checklist using root `.venv`, installed `0.3.2`, `RUN_PAID_MODELARK_SMOKE=false`, `PYTHONPATH=.`, no pytest cache and external temporary outputs.
  - Task7 was checked after both runs passed. Task5 subsequently completed Next build and browser evidence. Preserve concurrent changes; no frontend build by Task7, commit, deployment or paid call.
  - Verified 2026-11-17: failed layout file **124 passed, 0 failed, 0 skipped, 0 errors**, 1 external warning, 1.97 seconds; broad suite **761 passed, 0 failed, 0 skipped, 0 errors**, 5 external warnings, 59.33 seconds, both exit 0. JUnit totals independently parsed from `/tmp/subtitle-category-task7-{layout,platform}.xml`. Root installed import confirmed `0.3.2` from `.venv/lib/python3.14/site-packages`, approved layout v4. Exact commands and remaining parent-owned checks are in checklist.md.

## 依赖关系

- 任务 2、任务 3 依赖任务 1 的类型契约，可并行实施。
- 任务 4 依赖任务 1、任务 2、任务 3。
- 任务 5 依赖任务 4。
- 任务 6 为发布校验失败检查点的定向修复；实际通过证据是任务 4 发布校验及任务 5 最终验收的前置条件。
- 不包含提交、推送、部署或真实计费调用；这些动作不由本规格自动授权。

## Task2 Verification And Handoff

- Completed 2026-11-17: package source version `0.3.2`, layout version `single-line-adaptive-panel35-video-category-v4`; product panels forced to `#00000000`, ignored manual panels do not affect automatic text color or contrast diagnostics, input styles remain unchanged, absent category matches explicit unboxing.
- PNG cache fingerprints include normalized category, effective transparent/panel policy, effective panel color and layout version. Existing `render.py` already forwards the same video dictionary to its ordinary-text fallback; no render source change was necessary. Existing `translation_schemas.py` preserves runtime video dictionary fields without a schema change.
- Full offline suite: **680 passed, zero skipped**, including 24 actual-font multi-name Black/Light/ordinary text-only PNG pixel comparisons across headline/body/footnote, four background cases and automatic/manual text color; one actual-font unboxing gray/custom-panel pixel test; API generation/font/storage/materialization failures and successful PNG submission use mocked clients only.
- Command from `standalone/video-subtitle-grounding`: `env PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src:/tmp/subtitle-role-fonttools SUBTITLE_REAL_FONT_DIR=/tmp/subtitle-role-real-fonts /tmp/ad-subtitle-role-font-wheel-env/bin/python -m pytest --basetemp=/tmp/subtitle-category-task2-final --junitxml=/tmp/subtitle-category-task2-results.xml -q`. Four actual font files are cached outside the workspace in `/tmp/subtitle-role-real-fonts`. JUnit evidence: `/tmp/subtitle-category-task2-results.xml`. One external Starlette/httpx deprecation warning remains.
- Package Ruff (`--no-cache src tests`), Python compilation (`PYTHONPYCACHEPREFIX=/tmp/subtitle-category-task2-pycache`) and package diff whitespace checks passed. No build, paid model/MediaKit call, commit, push or deployment was performed.
- Task4 completed saved/frozen category forwarding, storage-failure recompilation, cache/idempotency and old-task recovery verification. Task5 supplies platform/browser acceptance; real provider output remains unverified.
- Task4 completed the package build, wheel installation, source archive and platform pins together; release evidence is in `vendor/README.md`.
- Changed package files (7): `pyproject.toml`, `src/video_subtitle_grounding/__init__.py`, `src/video_subtitle_grounding/layout.py`, `src/video_subtitle_grounding/product_layout.py`, `tests/test_layout.py`, `tests/test_product_layout.py`, `tests/test_render_api.py`. Only this task record was changed outside the package.
