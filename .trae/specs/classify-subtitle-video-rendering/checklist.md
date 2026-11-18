# 视频类型与字幕底板验收清单

Implemented and verified 2026-11-17: all 26/26 checkpoints passed within documented offline limits. Task5 and Task7 are complete. Real model/MediaKit visual quality and live MySQL remain unverified; no deployment was performed.

- [x] 入口提供产品视频与开箱视频两类新建方式，文案明确字幕底板区别；请求携带所选类型。
- [x] 工作区、列表、刷新、历史和阶段快照保存并显示类型；两份视频共享任务类型。
- [x] 旧 workspace、旧任务和独立 render video 缺失类型时沿用开箱行为，无 GET 补写和数据库 DDL 迁移。
- [x] PATCH 省略类型保留原值；非法类型或显式 null 安全报错；memory/SQL 往返一致。
- [x] 产品视频所有普通字幕、标题、正文和脚注的有效底板均为透明。
- [x] 产品名称 Black/Light 混合 PNG 的非文字区域透明，不出现可见灰底；字体、基线与完整比例保留。
- [x] 产品视频复杂/未知背景、非透明人工底板及跨行名称均不绕过无底板策略。
- [x] 产品视频保留文字色覆盖；被忽略的人工底板不再改变文字色推荐，不新增描边或阴影。
- [x] 普通文字回退、PNG 生成/存储/物化失败与浏览器图片加载失败都不恢复产品灰底。
- [x] 开箱视频白/黑背景透明，复杂/未知背景保持 `#33333359`；人工底板及文字色优先级与现状一致。
- [x] 产品类型隐藏底板模式/颜色/不透明度/原始字段控件，其他字幕编辑能力可用；开箱控件保持。
- [x] 类型切换不删除逐条样式，切回开箱可恢复原底板设置。
- [x] 类型切换使当前布局、旧 PNG 引用及成片引用失效，保留提取、译文、型号/规格判定和指纹；不额外调用提取/翻译/名称模型。
- [x] DOM 示意、服务端预览、PNG、失败占位与压制参数使用同一任务类型，不能显示旧灰底图层。
- [x] 产品类型下提示不错误宣称已加灰底，不建议启用底板，不引入产品型号/规格人工校验。
- [x] 类型改变进入 revision、渲染内容失效、缓存及新排版版本幂等；同版本/类型重复压制仍幂等。
- [x] 旧 revision 更新返回 409；运行中 UI 禁用类型修改；API 并发变更后晚到压制任务不能覆盖当前成片。
- [x] 已提交旧任务按冻结快照恢复轮询，历史成片/图层保留；旧版任务不被新版新压制误复用。
- [x] Viewer 可查看类型和预览，不能创建或修改；未登录 401、Viewer 修改 403 沿用。
- [x] 单行扩框、字幕时间截断、原 BBox、字体和字号、对齐、音轨、输入视频展示比例保持。
- [x] 独立 `0.3.2` wheel/sdist、平台 requirements、vendor SHA 和源码归档一致，真实安装导入无源码路径遮蔽。
- [x] 更新排版版本为 `single-line-adaptive-panel35-video-category-v4`，字典版本保持，线上仍只拉平台仓库。
- [x] 独立、平台和前端定向及必要回归通过，Ruff/编译/差异检查、lint/typecheck/build 和部署脚本回归通过。
- [x] Playwright 在 1440×900、834×1112、390×844 验证两类新建、类型切换、预览/回退、控件/权限、原生播放操作和无水平溢出。
- [x] 验证记录区分实际字体/PNG 像素、mock 供应商契约与真实成片；未执行真实模型/MediaKit 时不声称通过。
- [x] 用户已有改动保留；无未经授权的提交、推送、部署、生产写入或真实计费调用。

## 实施后记录

### Task7 Delegated Failed-Checkpoint Correction

Completed 2026-11-17. The initial task5 broad run found a stale version assertion; Task7 corrected and reran it without application changes.

- Changed only the literal version expectation at `backend/tests/test_subtitle_translation_layout.py:346` to `single-line-adaptive-panel35-video-category-v4`, matching the workspace test and approved installed package. Alias identity assertions remain intact; no application code changed.
- Confirmed root `.venv` imports installed `0.3.2` from `/Users/bytedance/AD-Creativity/.venv/lib/python3.14/site-packages/video_subtitle_grounding/__init__.py`, layout v4, using `PYTHONPATH=.` without standalone source shadowing.
- Failed layout file rerun first: **124 collected, 124 passed, 0 failed, 0 skipped, 0 errors**, exit 0, **1.97 seconds**, 1 external deprecation warning. JUnit: `/tmp/subtitle-category-task7-layout.xml`.
- Exact broad suite rerun next: **761 collected, 761 passed, 0 failed, 0 skipped, 0 errors**, exit 0, **59.33 seconds**, 5 external deprecation warnings. JUnit: `/tmp/subtitle-category-task7-platform.xml`. Both JUnit totals independently parsed; no exclusions or skips.
- Task7 checked only after both runs passed. Task5 subsequently completed Next build and three-viewport Playwright acceptance. No frontend build/browser operation or application change by Task7; no commit, deployment or paid calls. Temporary outputs are outside the workspace and concurrent changes are preserved.

Exact commands, cwd `/Users/bytedance/AD-Creativity`, root installed `.venv`, paid smoke disabled and pytest cache disabled:

```bash
env RUN_PAID_MODELARK_SMOKE=false PYTHONPATH=. PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m pytest -p no:cacheprovider backend/tests/test_subtitle_translation_layout.py -q --basetemp=/tmp/subtitle-category-task7-layout --junitxml=/tmp/subtitle-category-task7-layout.xml
env RUN_PAID_MODELARK_SMOKE=false PYTHONPATH=. PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m pytest -p no:cacheprovider backend/tests/test_subtitle_translation_*.py backend/tests/test_subtitle_product_names.py backend/tests/test_video_subtitle_grounding_*.py backend/tests/test_modelark_subtitle_translation.py backend/tests/test_modelark_video_subtitle_grounding.py backend/tests/test_aigc_video_subtitle_extraction_contract.py backend/tests/test_mediakit_*.py backend/tests/test_composer_subtitles.py backend/tests/test_asset_multitrack_storage.py backend/tests/test_workspace_contracts.py -q --basetemp=/tmp/subtitle-category-task7-platform --junitxml=/tmp/subtitle-category-task7-platform.xml
```

### Task5 Final Independent Evidence

Completed after explicit approval on 2026-11-17. Task5 owns evidence records and restoration of only its build-generated config differences; no application/test/verifier fixes.

- Final broad platform offline suite: **761 collected, 761 passed, 0 failed, 0 skipped, 0 errors**, exit 0, **59.33 seconds**, **5 external warnings**, across all 23 requested modules. Evidence: `/tmp/subtitle-category-task7-platform.xml`. Initial run `/tmp/subtitle-category-task5-final-platform.xml` had 760 passes and one stale v3 expectation at `backend/tests/test_subtitle_translation_layout.py:346`; Task7 corrected only that assertion and verified the layout file **124/124** before the broad rerun. No tests excluded.
- Installed import independently confirmed: `0.3.2`, `/Users/bytedance/AD-Creativity/.venv/lib/python3.14/site-packages/video_subtitle_grounding/__init__.py`, layout v4. Platform tests used `PYTHONPATH=.` without standalone `src` shadowing.
- Existing actual-installed package JUnit independently parsed: **680 tests, 680 passed, 0 skipped, 0 failures, 0 errors**, including **25 actual-font pixel tests**. Evidence: `/tmp/subtitle-category-release-0.3.2/installed-tests.xml`; not redundantly rerun. Installed and isolated release JSON reports both read and confirmed `result=passed`, **222 policy cases each**, 19 matching source modules, category cache isolation, actual-font SHA records, unchanged dictionary `tineco-names-20261116-v1`, and `real_model_called=false`, `real_mediakit_called=false`. Task6 actual passing evidence is confirmed.
- Artifact SHA256 independently recomputed: wheel `f5f4806ac028742900b5af3c460d024e0fcc3f5426d19f8d63069bb6d00d410d`; sdist/source archive both `d08f30e46437c340129f3dc8045de747f1d6a09e1fb05813f031c6ef6405cb75`, matching both release reports and vendor documentation.
- Final platform fatal Ruff (`backend` and the three release/category/browser verification scripts), configured package Ruff (`src tests`), both Python compileall checks and both repository `git diff --check` checks passed, exit 0. Compile caches are external `/tmp/subtitle-category-task5-final-{platform,package}-pycache`.
- Reused unchanged frontend evidence: **107 tests passed across 6 files**, full ESLint zero warnings and non-incremental TypeScript passed. Reused offline deployment-script evidence: **38 PASS cases**. No new frontend edits by task5; no unnecessary repeat.
- Inspected `verify-subtitle-product-fonts.py`: it hardcodes output under another spec's workspace evidence and is not parameterized for external fonts/output. It was not run or changed. Existing v4 actual-installed font tests and both release verifiers supply the required evidence without workspace artifacts or font downloads.
- Next.js **16.3.6** production build **passed**, exit 0: webpack compilation **8.1 seconds**, TypeScript **8.0 seconds**, static generation **14/14**, optimization and build traces completed. Output `/tmp/subtitle-category-task5-build-env-20261117/next`; full log `/tmp/subtitle-category-task5-next-build-pass-20261117.log`. The default Turbopack attempt rejected external dist before compilation; webpack initially compiled but generated `/tmp` types could not resolve dependencies. A `node_modules` symlink in the temporary parent directory resolved this environment-only issue. No application/config feature changes or disabled type checks.
- Restored the two generated imports in `frontend/next-env.d.ts` and removed only the two build-added includes in `frontend/tsconfig.json`, matching the pre-build snapshot and preserving all existing external includes. Final config diff and whitespace checks passed. No additional lint/test run was needed because bindings were restored exactly and no application code changed.
- Installed frontend tool versions independently read: Node **20.20.0**, Next.js **16.3.6**, TypeScript **5.9.3**, Vitest **3.2.7**, ESLint **9.39.5**, React **19.2.8**, `@playwright/test` **1.62.1**. Package **0.3.2**, layout `single-line-adaptive-panel35-video-category-v4`, dictionary `tineco-names-20261116-v1`.
- Final records independently counted **26 checked / 0 unchecked** checklist rows and **7 checked / 0 unchecked** tasks. Parsed Task7 JUnit confirms layout **124** and broad **761**, both zero failures/skips/errors; installed-package JUnit confirms **680**, also zero failures/skips/errors. Artifact SHA256 was recomputed again and matched the values above; both repository whitespace checks passed and `git diff -- frontend/next-env.d.ts frontend/tsconfig.json frontend/next.config.mjs` was empty.
- Actual browser **24/24 passed**, four suites x six Creator/Viewer viewport combinations; fixture **8/8 passed**. See actual acceptance below. All **26/26** rows and task5 checked only after build and Task7 passing evidence were available.
- No paid calls, real ModelArk/MediaKit render, live MySQL check, production writes, commit, push or deployment. Row 25 passes disclosure only, not real-provider visual quality. SQL tests use memory/SQLite fixtures; browser fixture PNG bytes are not new compiler/vendor output.

Exact successful build command, cwd `/Users/bytedance/AD-Creativity/frontend`; temporary parent dependency link points to `frontend/node_modules`:

```bash
set -o pipefail
NEXT_DIST_DIR=../../../../tmp/subtitle-category-task5-build-env-20261117/next NODE_PATH=/Users/bytedance/AD-Creativity/frontend/node_modules NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack 2>&1 | tee /tmp/subtitle-category-task5-next-build-pass-20261117.log
```

Exact broad command, cwd `/Users/bytedance/AD-Creativity`:

```bash
env RUN_PAID_MODELARK_SMOKE=false PYTHONPATH=. PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m pytest -p no:cacheprovider backend/tests/test_subtitle_translation_*.py backend/tests/test_subtitle_product_names.py backend/tests/test_video_subtitle_grounding_*.py backend/tests/test_modelark_subtitle_translation.py backend/tests/test_modelark_video_subtitle_grounding.py backend/tests/test_aigc_video_subtitle_extraction_contract.py backend/tests/test_mediakit_*.py backend/tests/test_composer_subtitles.py backend/tests/test_asset_multitrack_storage.py backend/tests/test_workspace_contracts.py -q --basetemp=/tmp/subtitle-category-task5-final-platform --junitxml=/tmp/subtitle-category-task5-final-platform.xml
```

Final checkpoint map (all 26 rows inspected):

| Row | Final evidence | Status / limit |
| --- | --- | --- |
| 1 | Frontend explicit two-category create requests, `panel.tsx` copy | Passed offline; browser row separate |
| 2 | `test_video_category_json_history_and_stage_snapshot`, route create/read/PATCH tests; frontend reload/history | Passed memory/SQLite and Vitest; shared reference/input category |
| 3 | `test_legacy_workspace_category_defaults_without_rewriting_json`, frozen legacy retry, standalone absent-category equivalence | Passed; no DDL change or GET write observed |
| 4 | Null/invalid/omitted route tests and repository round-trips | Passed; SQLite, not live MySQL |
| 5 | Standalone role/background/panel matrix; 84 platform preview cases | Passed; ordinary/headline/body/footnote transparent |
| 6 | Installed 25 actual-font tests; shared baseline/font-size and PNG alpha comparisons | Passed actual font binaries; no real video render |
| 7 | `test_product_policy_preserves_colors_styles_and_layout`, `test_product_text_obeys_common_preflight` | Passed; multiline remains rejected by existing preflight, not rendered with a panel |
| 8 | `test_product_manual_text_color_and_contrast_use_actual_background`, preview policy and frontend colors | Passed; normalized RGBA preserved, no new stroke/shadow |
| 9 | Standalone generation/font/storage/materialization failure matrix; platform upload failure; Vitest PNG onError | Passed mock contracts/component fallback; browser row separate |
| 10 | `test_explicit_unboxing_is_identical_to_legacy`, actual unboxing gray/custom panel pixels and frontend controls | Passed existing thresholds and manual priority |
| 11 | Segment editor control exclusion and other-edit assertions | Passed Vitest |
| 12 | Category switch/switch-back retained style tests, platform PNG cache isolation | Passed without deleting manual settings |
| 13 | `test_category_change_invalidates_only_render_and_preserves_product_fingerprints`, hook reset | Passed; no added extraction/translation/recognition call |
| 14 | Saved/draft preview tests, frozen/legacy render tests, PNG storage fallback and category cache tests | Passed integrated installed package and DOM fixtures |
| 15 | Product warnings and automatic product-name frontend regressions | Passed Vitest |
| 16 | Same-category identity, pre-category identity rejection, layout-version identity and cache-switch tests | Passed; stale alias version assertion corrected and verified by Task7 |
| 17 | Revision conflict, category writeback guard, late polling history-only and UI running/busy cases | Passed offline concurrency fixtures |
| 18 | Frozen snapshot recovery/logging, legacy retry, old-layout rejection, retained layer cache tests | Passed mocked provider recovery, no old layer deletion |
| 19 | Category 401/403/Viewer routes and frontend Viewer/preview guards | Passed offline |
| 20 | 124 passing platform layout tests after Task7, media/audio/multitrack suites, standalone geometry/font tests, Vitest projection and actual browser controls | Passed offline/browser fixtures; no real provider output |
| 21 | Installed 680-test report, both release JSON reports, current artifact SHA and requirements/vendor pins | Passed actual-installed/isolated evidence without source shadowing |
| 22 | Installed layout v4 and dictionary v1; release pin and offline deployment architecture | Passed; no deployment performed |
| 23 | Task7 platform 761 pass / 0 fail / 0 skip / 0 error; package 680 pass; frontend 107 pass; both Ruff/compile/diff pass; deploy stubs 38 pass; Next 16.3.6 webpack production build exit 0 | Passed; exact generated-config restoration, no application changes |
| 24 | Actual Playwright 24/24: category/product/roles/workflow each Creator/Viewer at 1440x900, 834x1112, 390x844; fixture 8/8 | Passed actual Chromium against offline fixture API; screenshots/results below |
| 25 | Actual-font/pixel evidence separately identified from mocked supplier contracts and unpaid real render | Passed disclosure only; real model/MediaKit visual quality unverified |
| 26 | Task5 evidence-only edits and external pytest/compile outputs | Passed; preserved existing/user/browser-owned changes |

Final handoff: task5 complete, all 26 rows checked. Parent can perform its final review; deployment and real-provider validation remain outside this approval.

### Task4 Platform Integration Evidence

- Changed only runtime video dictionaries in `preview()` and `_render()` within the service: saved/unsaved preview category is forwarded; render uses frozen `snapshot.get("video_category", "unboxing")`, including ordinary-text recompilation after PNG storage failure. Existing task1 service changes were preserved.
- Focused preview/product tests cover both categories, headline/body/footnote, white/black/complex/unknown backgrounds, ignored manual panels, GET/POST and unsaved preview without persisted category/history changes, category-aware immutable PNG cache reuse/isolation, transparent PNG corner pixels, upload failure, provider submission parameters and legacy frozen-category rendering. Existing recognition fixtures use mocked adapters; font HTTP is mocked. Updated the workspace layout-version regression assertion to approved v4; compiled text-color assertions use normalized eight-digit RGBA.
- Passed: `env PYTHONPATH=. PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m pytest backend/tests/test_subtitle_translation_preview.py backend/tests/test_subtitle_product_names.py backend/tests/test_subtitle_translation_execution.py backend/tests/test_subtitle_translation_workspace.py -q -p no:cacheprovider --basetemp=/tmp/ad-creativity-task4-integration-pytest-verified --junitxml=/tmp/ad-creativity-task4-integration-pytest-verified.xml --tb=short`: **218 passed**, zero skipped, one external Starlette/httpx deprecation warning. Memory and SQLite-backed SQL repository fixtures both passed; no live MySQL verification.
- Passed: scoped Ruff `--no-cache --select E9,F63,F7,F82`, Python compilation with external `PYTHONPYCACHEPREFIX=/tmp/ad-creativity-task4-integration-pycache`, and `git diff --check`. Installed version was checked with `importlib.metadata` before tests: `0.3.2`, root `.venv/lib/python3.14/site-packages/video_subtitle_grounding/__init__.py`, layout `single-line-adaptive-panel35-video-category-v4`.
- Packaging owner completed release evidence in `vendor/README.md`. Inspected installed/isolated reports under `/tmp/subtitle-category-release-0.3.2/verification`: both passed 222 policy cases with source/archive matches and no real provider calls. Independently matched wheel SHA256 `f5f4806ac028742900b5af3c460d024e0fcc3f5426d19f8d63069bb6d00d410d`; sdist/source SHA256 `d08f30e46437c340129f3dc8045de747f1d6a09e1fb05813f031c6ef6405cb75`. Task4 checked only after packaging completion and focused integration pass.
- No frontend builds, browser operations, package builds, paid model/MediaKit calls, commits, pushes or deployment by this integration owner. Temporary test outputs are outside the workspace. Task5 supplies broader regression/browser acceptance; real rendered output remains unverified.

### Task5 Supporting Commands

- `npm test -- tests/subtitle-translation.test.tsx tests/subtitle-product-names.test.tsx tests/subtitle-translation-api.test.ts tests/subtitle-translation-font-contract.test.ts tests/subtitle-translation-upload-route.test.ts tests/aigc-video-subtitle-extraction-contract.test.ts`: **107 passed, 6 files**, exit 0, Vitest 3.2.7.
- `npm run lint`: full ESLint, zero warnings, exit 0.
- `npx tsc --noEmit --incremental false`: exit 0.
- `.venv/bin/ruff check --no-cache --select E9,F63,F7,F82 backend`: passed, exit 0.
- Platform `git diff --check`: passed, exit 0, including final post-integration/config-restoration check.
- `bash scripts/tests/test_deploy_server.sh`: **38 PASS cases**, exit 0; local fixture tests only, no deployment performed.
- Independent configured package Ruff (`.venv/bin/ruff check --no-cache src tests` from standalone root), package `git diff --check`, and both Python compileall checks passed, including final post-integration checks. Compile caches are outside the workspace.
- Task6 corrected release-verifier assertions to normalized RGBA (`#000000FF`, `#FFFFFFFF`, `#FF0000FF`); installed and isolated release reports each passed 222 cases. Task5 made no verifier changes.

### Task1 Contract Evidence And Handoff

- Changed `backend/app/schemas/subtitle_translation.py`, task1 contract paths in `backend/app/services/subtitle_translation.py`, `frontend/lib/api-types.ts`, and `backend/tests/test_subtitle_translation_{workspace,routes,execution}.py`. Added only `video_category` to the shared safe-log allowlist in `backend/app/core/logging.py`; otherwise structured logs would silently drop category. No repository implementation or database model/DDL change was needed.
- Create/read defaults to `unboxing`; PATCH omission preserves saved category and explicit null/invalid category returns 422. Workspace JSON, list/history and stage snapshots round-trip both categories. Legacy payload reads do not rewrite history or SQL payloads. Category switches clear derived layout/font/text-run/PNG references, layout diagnostics, output and render task references, increment revision, and preserve inputs, source text, translations, styles, product mentions and recognition/text fingerprints.
- Render identity includes category plus existing layout/catalog versions. Same identity is idempotent; pre-category identities are not reused. Category edits retain unaffected extraction/translation writeback using existing revision rebasing, but block changed render writeback. Tests cover late polling results retained only in task history, revision/category guards, stale retry rejection, frozen product/unboxing recovery, and missing-category legacy retry normalized to unboxing without rewriting the original task.
- Passed: `env PYTHONPATH=. .venv/bin/python -m pytest backend/tests/test_subtitle_translation_workspace.py backend/tests/test_subtitle_translation_routes.py backend/tests/test_subtitle_translation_execution.py -q -p no:cacheprovider --basetemp=/tmp/ad-creativity-task1-pytest --junitxml=/tmp/ad-creativity-task1-pytest.xml --tb=short`: **120 passed**, two external Starlette/httpx deprecation warnings. SQL coverage uses the existing SQLite-backed SQL repository fixture; no live MySQL test was performed.
- Passed: scoped Ruff `--no-cache --select E9,F63,F7,F82`, Python compilation with `PYTHONPYCACHEPREFIX=/tmp/ad-creativity-task1-pycache`, frontend `tsc --noEmit --incremental false --pretty false`, and `git diff --check`. Temporary test data and JUnit evidence are outside the workspace. No paid model/MediaKit calls, commit, push, deployment or production writes.
- Task4 completed saved/request category forwarding in `preview()` and frozen `snapshot.get("video_category", "unboxing")` forwarding in `_render()`, including storage-failure fallback and old-task recovery. Task1 deliberately did not modify those dictionaries or package/release/browser paths.
- Task4 updated the workspace version expectation; Task7 corrected the remaining layout alias assertion. Final release/browser acceptance is recorded by Task5; real provider output remains unverified.
- Direct parent-agent messaging and `update_plan` were not exposed by tool discovery; completion was communicated in commentary and this shared record. Concurrent frontend, standalone, release and browser changes were left untouched.

### Task3 Frontend Evidence

- Implemented in `frontend/components/workspace/subtitle-translation/{panel,workspace-editor,use-subtitle-workspace,review-dialog,segment-editor,video-preview}` and `frontend/lib/subtitle-translation.ts`. Updated `frontend/tests/subtitle-translation.test.tsx` and `subtitle-translation-fixtures.ts`; did not edit `frontend/lib/api-types.ts`.
- Passed: `npm test -- tests/subtitle-translation.test.tsx tests/subtitle-product-names.test.tsx tests/subtitle-translation-api.test.ts tests/subtitle-translation-font-contract.test.ts tests/subtitle-translation-upload-route.test.ts tests/aigc-video-subtitle-extraction-contract.test.ts`: 107 tests, 6 files (71 category/review/workspace/projection tests; 36 API/font/upload/product-name/extraction regressions).
- Passed: `npx tsc --noEmit --incremental false`, `npm run lint` (full ESLint, zero warnings), and `git diff --check`.
- Focused evidence covers explicit create requests, missing-field historical default, category persistence via PATCH/reload, 409 retention/reload, Viewer/running/active-task/busy guards, preserved styles and inference fingerprints, cleared layout/PNG/output/render references, product text colors independent of ignored panels, transparent PNG load-failure fallback, unchanged unboxing controls and color/warning regressions.
- No Next build or Playwright run by task3; these are completed under Task5/browser evidence above. No real model/MediaKit requests, commits, deployment, or temporary workspace artifacts by task3.

### Browser Handoff

### Actual Browser Acceptance: Passed 2026-11-17

- Actual headless Chromium/Playwright against fixture API 8058 and Next dev 3058: **24/24 passed**, comprising category matrix **6/6** plus existing product **6/6**, role-font **6/6**, and workflow **6/6** baseline. Each suite ran Creator and Viewer at 1440x900, 834x1112, and 390x844. Fixture self-tests also passed **8/8**.
- Authoritative final results: `/tmp/subtitle-category-browser-final/summary.json`; per-suite `results.json`, logs and screenshots are in `/tmp/subtitle-category-browser-final/{category,product,roles,workflow}` (logs also at the parent directory). Servers stopped after helper exit 0; Task5 subsequently passed the isolated production build.
- Category checks passed explicit product/unboxing create payloads, missing-field legacy default without GET backfill, saved type/list/reload, both-direction switching, revision and layout/PNG/output/render-reference invalidation, preserved inputs/text/translations/styles/product recognition fingerprints, transparent DOM and PNG-error fallback, hidden product panel controls, correct warning copy, restored unboxing custom/transparent panels, Viewer no mutations and extract/translate/render type locks, native play/pause/seek/volume/control-strip hit testing and no horizontal overflow.
- Corrected only browser assertions: Creator entry buttons retain existing panel `busy || !canWrite` behavior while workspace pipeline stages lock the category selector; Viewer entries remain disabled. Chromium serializes preserved `#CC220080` as alpha `0.5`, so the custom-panel assertion accepts equivalent `0.5`/`0.502` serialization.
- Initial setup errors: system Python lacked Playwright (used project `.venv`); role-font checks lacked fontTools (used existing `/tmp/subtitle-role-fonttools`); Turbopack external dist exited; webpack launched from repository root missed Tailwind configuration; external webpack dist lacked Node module resolution. Successful run used frontend cwd, webpack, relative external dist and `NODE_PATH=frontend/node_modules`. No application defect found or application code changed.
- Restored only generated `frontend/next-env.d.ts` imports and four added category dist `tsconfig.json` includes with targeted patches; preserved all pre-existing `/tmp` includes. No paid calls, commits, push or deployment. Category PNGs are fixture composites from existing real-font PNGs, not acceptance of the backend compiler or actual vendor output. Role-font baseline verified Chromium custom PostScript fonts against local real font files.
- Visual evidence inspected: `category/category-creator-1440-product-png.png`, `category/category-creator-390-product-failed-png.png`, and `category/category-creator-1440-unboxing-restored.png` under the final output directory. Fixture pixel measurement: `/tmp/subtitle-category-browser-final/fixture-pixel-evidence.json`, generated by `.venv/bin/python /tmp/measure-subtitle-category-fixture-pixels.py`. The exact fixture composite is 1022x70: product has **64,503 fully transparent pixels**, all four corner RGBA values `[0,0,0,0]`; unboxing custom panel has **0 fully transparent pixels**, all four corners `[204,34,0,128]`. Product PNG SHA-256 `8dbd8e4cf68a7ae41a45d9623969d6349cf017505239f4563efb0de9d26944b5`; unboxing `a572441c86c062b8feda58f810b0cc905444a01d5fb346f3d1a979f4f7a8150b`. These measure fixture bytes only, not new compiler output. Earlier `failure-creator-1440.png` files may remain from setup attempts; final `results.json` and suite logs are authoritative.
- Exact successful orchestration command (cwd `/Users/bytedance/AD-Creativity/frontend`):

```sh
env PYTHONPATH=/tmp/subtitle-role-fonttools /Users/bytedance/AD-Creativity/.venv/bin/python /Users/bytedance/.trae-cn/skills/webapp-testing/scripts/with_server.py --server '/Users/bytedance/AD-Creativity/.venv/bin/python /Users/bytedance/AD-Creativity/scripts/verify-subtitle-translation-browser.py --serve-fixture > /tmp/subtitle-category-fixture-8058.log 2>&1' --port 8058 --server 'env NODE_PATH=/Users/bytedance/AD-Creativity/frontend/node_modules BACKEND_INTERNAL_BASE_URL=http://127.0.0.1:8058 NEXT_DIST_DIR=../../../../tmp/subtitle-category-next-webpack-3058 /Users/bytedance/AD-Creativity/frontend/node_modules/.bin/next dev --webpack --hostname 127.0.0.1 --port 3058 > /tmp/subtitle-category-next-3058.log 2>&1' --port 3058 --timeout 120 -- /Users/bytedance/AD-Creativity/.venv/bin/python /tmp/run-subtitle-category-browser-acceptance.py
```

- Runner executes `scripts/verify-subtitle-translation-browser.py --base-url http://127.0.0.1:3058 --output-dir /tmp/subtitle-category-browser-final/<suite>` with `--category-checks`, `--product-checks`, `--role-font-checks --font-dir /tmp/subtitle-role-real-fonts`, then no extra flag for workflow. Exact child commands are printed in the helper output and retained in `/tmp/run-subtitle-category-browser-acceptance.py`.

### Prior Browser Handoff

Frontend stable for browser agent `arun_6afbd9987c8ccecc42462fbe` / parent. Direct agent messaging is unavailable in this task's toolset; this shared record and the commentary handoff provide the status.

- Replace old `新建字幕工作区` selectors with `新建产品视频任务` and `新建开箱视频任务`; retain existing unboxing expectations and add product assertions. Type selector accessible name: `视频类型`.
- Fixture create/list/GET/PATCH must round-trip `video_category`; retain a workspace missing the field to verify the unboxing default. Category-only PATCH sends `expected_revision` and `video_category`, not modified segment styles.
- Category PATCH must increment revision and clear derived layout/font/text-run/PNG references, output and render task reference while retaining inputs, text/translations, styles, and recognition fingerprints. Recomputed previews must use current category and new category-aware PNG URLs/cache keys.
- Cover both create flows, save/reload/history, switching both directions, read-only/running/busy/conflict controls, absent product panel controls and exact `产品视频：字幕无底板` copy, transparent DOM/PNG-error fallback, automatic text color on near-white with ignored custom panel, and unchanged product-name automatic flow.
- Preserve native video controls and object-contain; verify no horizontal overflow at 1440x900, 834x1112, and 390x844. Keep browser outputs/screenshots outside the workspace. Browser script remains browser-agent-owned.
