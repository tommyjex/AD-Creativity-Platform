# Versioned subtitle backend dependency

`video_subtitle_grounding-0.3.8-py3-none-any.whl` 是平台使用的固定版本 Python 包，源码由独立 `video-subtitle-grounding` 仓库维护。wheel 是部署所需发布产物，应随平台适配层一起发布。此前所有发布包继续保留，回滚时同步恢复对应平台适配层。

## 0.3.8 接口默认底色与可配置 CRF

工作区及独立 render API 支持严格整数 CRF 0–30，默认 16；新任务冻结配置，PNG / Text 及回退统一采用 H.264 与所选 CRF。字幕请求省略 `canvas.background_color`、原生 `text.background_color` 和 `video_bit_rate`。PNG 内部自动/人工底板保持，字体、字重、几何及 24px 自动脚注保持。单独修改 CRF 只失效当前压制和成片关联；历史任务仅依据已有冻结编码信息展示。

- 排版版本：`single-line-png-text-default-background-v8`。
- 编码策略：`configurable-crf-h264-v3`。
- Wheel SHA256：`ef0f94bb4ce782972f595a5b6a614197e6e57ebf1cead51da768e54e5ea6e4a3`。
- Sdist / 源码归档 SHA256：`27fb0dd3484ea7f1cfcc4c2f3ea373deb10ea7ab9d4175f9b0351aec881fda97`。
- 构建路径及快照：`/tmp/subtitle-crf-v3-release/`。先构建 sdist，再从解包的 sdist 构建 wheel；源码导出与 sdist 字节一致，42 个旧产物与五个 egg-info 文件保持。

本轮离线检查验证提交契约和浏览器交互；接口默认底色、真实成片质量及文件大小须通过真实压制另行确认。

2026-11-18 验收：共享源码、隔离安装、本地安装完整测试各 902 passed；安装 wheel 后平台相关回归 899 passed；前端 151 passed，lint/typecheck 及三视口 creator/viewer 六场景通过。隔离与本地 verifier 各通过 513 项真实字体策略检查，23 个 Python 模块及 51 个非生成归档文件匹配。Ruff 致命检查、编译、两仓库 diff、部署脚本离线测试通过。证据位于 `/tmp/subtitle-crf-v3-release/`、`/tmp/subtitle-crf-v3-browser/output/`；详细执行记录见 `.trae/documents/subtitle-default-background-configurable-crf-20261118-plan.md`。

两次只读确认 queued=0 / running=0 后，本地后端以原启动命令安全重启（PID 36421），health 200 / ok；包从 `.venv/lib/python3.14/site-packages` 导入 0.3.8。现有前端服务、历史产物、参数还原文件及用户改动已保留；无 commit、push、线上部署或真实计费任务。

## 0.3.7 PNG / Text And CRF 16

Both selectable subtitle modes submit `output.codec={"video_codec":"h264","crf":16}` and omit `video_bit_rate`, including PNG-to-Text fallback. Source bitrate metadata is retained but does not control new subtitle encoding. PNG remains the default, with actual-font 4x sampling and automatic 24px footnotes. Text uses native text elements without PNG materialization; existing non-headline bold remains, and product mixed-font lines explicitly warn `text_product_font_fallback` when using the whole-line font.

- Layout version: `single-line-png-text-footnote24-v7`.
- Encoding policy: `crf16-h264-v2`.
- Wheel: `vendor/video_subtitle_grounding-0.3.7-py3-none-any.whl`.
- Wheel SHA256: `594956a82db00fd926cc3ac65c61fc79a2e3371da6a0c8d53250698e5b568e32`.
- Sdist: `vendor/video_subtitle_grounding-0.3.7.tar.gz`.
- Source export: `exports/video-subtitle-grounding-0.3.7-source.tar.gz`, byte-identical to sdist.
- Sdist / source SHA256: `e62749acd40dcc7d6b3518453e712152cf0e4a9e1f255266b70db24db65ef421`.

Built and regenerated on 2026-11-17 using `/tmp/subtitle-nonheadline-bold/build-env`, first sdist then wheel from sdist. The stale `tests/test_layout.py` version assertion now expects 0.3.7, and the shared README identifies the current release. Isolated installation imports from `/private/tmp/subtitle-crf16-release.aZKLB7/isolated/video_subtitle_grounding/__init__.py`; local installation imports from `/Users/bytedance/AD-Creativity/.venv/lib/python3.14/site-packages/video_subtitle_grounding/__init__.py`, never standalone source. Both verifier modes passed 481 offline actual-font policy cases and confirmed all 22 Python modules and 49 non-generated archive contents match current source. Both full package suites passed 842 tests with zero failures/skips; installed-wheel platform regressions passed 826 tests across 18 related modules. External deprecation warnings remain.

Final evidence: `/tmp/subtitle-crf16-release.aZKLB7/{rebuild-report.json,isolated-final-tests.xml,installed-final-tests.xml,platform-installed-final-tests.xml,verification-final/,preserved-final-check.log,runtime-verification-final.json,final-report.md}`. The original `preexisting-sha256.txt`, five-file `source-egg-info` snapshot, initial build report and failed `isolated-tests.xml` remain unchanged as baseline evidence. All 59 retained snapshot entries passed SHA checks, including 27 old package artifacts and exact restoration of all five source egg-info files. Only this authorized README and regenerated 0.3.7 targets are excluded. Ruff fatal checks, compilation, both repository diff checks and deployment-script offline tests passed. Frontend acceptance reports 144 tests, six browser scenarios, standard lint/typecheck and exact config/cache cleanup passed.

Immediately before local installation and again before stopping the verified backend PID 35583, the database had zero queued/running tool tasks (26 succeeded, four failed). The backend restarted with the saved `.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --env-file .env` command in this checkout. New PID 57378, command `emuyrvgzqp`, health HTTP 200; installed package version 0.3.7 and encoding policy `crf16-h264-v2` verified. The application health response retains its separate platform version 0.1.0. Tasks 6/9 are complete within offline scope.

This records packaging and offline policy verification only. No live model or MediaKit calls, commits, pushes or production deployment were performed. Actual PNG/Text encoded-video clarity and file-size comparison require separately authorized rendering; DOM or local PNG previews are not supplier-output acceptance.

## 0.3.6 PNG 绘制与 24px 脚注

普通与混合字体字幕共用透明 RGBA PNG 绘制，以最终尺寸 4 倍采样、预乘 Alpha/LANCZOS 缩回原尺寸。image transform 与 PNG 像素尺寸一致，图层复用现有私有 TOS 存储和同源鉴权预览。实际字体及字重保持；PNG 不添加合成 bold。自动脚注目标 24px，人工字号优先，按真实度量扩框并保护相邻字幕与画布边界；空间不足时缩字号并警告。存储失败使用显式原生文字编译，保留原有非 headline bold 回退规则。

- 排版版本：`single-line-supersampled-png-footnote24-v6`。
- wheel SHA256：`9b1d7154abbb3a7b6facee6055f681a60ded3757f540012a8f25853e988ad602`。
- sdist / exports 源码归档 SHA256：`437a9e6c4780512cd9781c9e5a453cb4c39c801d03c9c7326f9e5bfeddaef8f0`。
- 源码、wheel、sdist、平台安装与隔离安装的 22 个模块一致。两个安装验证模式各通过 234 个实际字体策略用例。独立包安装测试 779 passed，平台 16 个相关测试模块 687 passed。
- Playwright：1440×900、834×1112、390×844 的 creator/viewer 六场景通过，覆盖三行实际字体 PNG、24px 脚注、计算预览、加载失败回退与无横向溢出。
- 原有 24 个包产物 SHA 和构建前源 egg-info 保持，原视频流码率、产品命名、品牌排除、时间与底板策略保持；无数据库迁移。

证据：`.trae/specs/png-subtitles-footnote24/evidence/`。29 秒本地样张：`exports/29秒_新PNG字幕预览_脚注24px.png`，对应旧快照标题 41px、正文 34px 保持，脚注 19px → 24px，脚注框扩为 `[125,995,766,1030]`。样张为实际字体的本地 PNG，未调用真实 MediaKit，不能代替有损编码后的成片验收。仅本地构建安装和重启，未提交、推送或生产部署。

## 0.3.5 非 headline 文字字幕加粗

- wheel：`vendor/video_subtitle_grounding-0.3.5-py3-none-any.whl`，60,571 bytes。
- wheel SHA256：`a084bba07cbe6e47af0b8a809e7fdf5b0510614d09dc611c28b151f4eab36712`
- sdist：`vendor/video_subtitle_grounding-0.3.5.tar.gz`，136,498 bytes。
- 源码归档：`exports/video-subtitle-grounding-0.3.5-source.tar.gz`，与 sdist 字节一致。
- sdist / 源码 SHA256：`1fa551badfba57fa7ad87a62d49e6b1092add414d04d77edb6b9d1f45a500253`
- 排版版本：`single-line-adaptive-panel35-nonheadline-bold-v5`。

所有非 headline 的 MediaKit text 元素设置 `bold=true`，包括 body、footnote、null、缺失及未知角色，以及人工选择字体和 PNG 物化失败后的文字回退。headline 保留既有实际字体与缺字回退规则。PNG/image 不增加 bold，混合字体像素保持；字号下限仍 1px，底板、品牌、产品字典和原视频流码率策略保持。

2026-11-17 按用户授权从 sdist 构建 wheel，安装到平台 `.venv` 及 `/tmp/subtitle-nonheadline-bold/isolated`。两个验证模式各通过 234 个真实字体策略用例，确认 21 个源码模块与源码、wheel、sdist 和安装文件一致；验证普通文字 bold、实际提交回退参数、PNG 像素、底板与视频码率。安装包全量离线测试 767 passed，含 25 个真实字体测试，无跳过。此前全部 21 个产物 SHA 与构建前 egg-info 字节保持。

平台安装包回归 687 passed；Ruff、编译、两仓库 diff 与部署脚本离线测试通过。确认无 queued/running 工具任务后本地后端按保存命令重启，健康接口 200，平台共享编译器导入来自 `.venv` 的 0.3.5 包。

证据：`/tmp/subtitle-nonheadline-bold/{build-report.json,installed-tests.xml,platform-installed-tests.xml,runtime-verification.json,verification/}`；验收记录：`.trae/specs/bold-nonheadline-subtitle-text/checklist.md`。本轮仅本地打包安装验证，未提交、推送或生产部署，未调用真实模型或 MediaKit。离线提交参数验证不代表供应商最终成片字重及字宽验收，前端预览仍沿用原字体显示。

## 0.3.4 字幕压制沿用底片视频流码率

- wheel：`vendor/video_subtitle_grounding-0.3.4-py3-none-any.whl`，60,517 bytes。
- wheel SHA256：`7f816efcca87293eaa03c6b255062fb6b50cce0abdb152bc976a4535a2cb821e`
- sdist：`vendor/video_subtitle_grounding-0.3.4.tar.gz`，136,132 bytes。
- 源码归档：`exports/video-subtitle-grounding-0.3.4-source.tar.gz`，与 sdist 字节一致。
- sdist / 源码 SHA256：`e639e0dfa17267eea971fc928a5c2c68ed2422633dd04f84b44b68538e72d724`
- 编码策略：`source-video-bit-rate-v1`，纳入新 render 任务幂等身份。
- 排版、品牌与产品字典版本不变。

实际无字幕底片的视频流 FFprobe `bit_rate` 直接按 bps 写入 MediaKit `output.codec.video_bit_rate`：7000 → 7000，7000000 → 7000000。不会以容器总码率、音频码率或固定值替代。无法读取时省略 codec 参数，保留默认编码并返回 `source_video_bit_rate_unavailable`。该参数是重新编码的目标，实际输出平均码率不保证严格相等。

新上传复用现有探测；旧底片首次新压制按需安全探测并缓存完成状态（包括不可用）。提交前冻结底片资产 ID、码率、完成状态和来源，不修改工作区 revision。已提交供应商的历史任务恢复/重试只轮询，不重编译；未提交的旧策略任务重新执行时获得新编码身份。普通文字、PNG 与失败回退共用冻结码率。平台 schema、前端可选类型和安全警告映射同步；无新增码率编辑控件或数据库迁移。

2026-11-17 从 sdist 构建 wheel，安装到平台 `.venv` 及 `/tmp/subtitle-bitrate-release-0.3.4/isolated`。两种验证模式确认 21 个源码模块与 wheel/sdist/源码归档/安装文件一致，222 个真实字体排版策略案例同时验证输出 codec。安装包离线测试 740 passed；平台字幕、媒体和日志离线测试 706 passed；前端 Vitest 75 passed，lint/typecheck 通过。Playwright 品牌/类型回归覆盖三个视口、creator/viewer，共 6 场景通过，无横向溢出。

Ruff 致命错误检查、Python 编译、两仓库 diff 及部署脚本离线测试通过；此前全部 18 个发布产物 SHA 和源 egg-info 字节保持。临时浏览器服务已停止，仅本次自动生成的 Next 测试路径已清理。验收记录：`.trae/specs/preserve-subtitle-source-bitrate/checklist.md`。证据：`/tmp/subtitle-bitrate-release-0.3.4/{build-report.json,package-tests.xml,platform-final-tests.xml,verification/,browser/results.json}`。

未提交、推送或生产部署；未调用真实模型或 MediaKit。真实编码产物的清晰度、体积及实际码率尚未验收。本地后端已按保存命令重启加载新版实现；重启前确认无 queued/running 工具任务。

## 0.3.3 品牌 Logo 与固定标语排除

- wheel：`vendor/video_subtitle_grounding-0.3.3-py3-none-any.whl`，60,232 bytes。
- wheel SHA256：`0fc75ad9f648f62bb5c84a3de6c359b7b08e7b3c17c9f0d2483ed399dd53534d`
- sdist：`vendor/video_subtitle_grounding-0.3.3.tar.gz`，135,113 bytes。
- 源码归档：`exports/video-subtitle-grounding-0.3.3-source.tar.gz`，与 sdist 字节一致。
- sdist / 源码 SHA256：`4c1b423624da22ff7c5d0ba2c5ba9510c9be7ea98dc3ef32a728aaeaf06cb78d`
- 品牌规则版本：`tineco-brand-20261117-v1`。
- 排版版本保持 `single-line-adaptive-panel35-video-category-v4`；产品字典版本保持 `tineco-names-20261116-v1`。

产品、开箱及缺少类型的调用统一排除独立 Logo 和固定标语。共享提示词与严格文字规则同时生效：仅完整 `Tineco`、完整 `Live Easy. Enjoy Life.` 及具备真实同块、连续行号与共同时间重叠的完整分行标语被排除。名称、规格、产品说明与不完整短语保留。翻译、名称识别、普通文字/PNG 预览及压制均使用有效集合；历史源文、译文和人工样式保留，新预览显示“品牌片尾已跳过”。

新阶段快照包含品牌规则版本。已冻结旧提取/翻译使用保留的旧策略入口；已提交旧压制任务继续轮询供应商任务，不重新编译或删除旧图层。线上部署仍只拉平台仓库，通过现有部署脚本安装 vendor wheel，无数据库迁移。

2026-11-17 从 sdist 构建 wheel，安装到平台 `.venv` 和 `/tmp/subtitle-brand-release-0.3.3/isolated`。两个隔离验证模式确认 21 个模块与源码/wheel/sdist/源码归档一致，222 个真实字体排版策略用例通过。安装包离线测试 703 passed，平台相关离线测试 661 passed；前端 Vitest 74 passed，lint/typecheck 通过。品牌与视频类型两组 Playwright 各覆盖三个视口、creator/viewer，共 12 个场景通过。Ruff、编译、两仓库 diff 检查与部署脚本离线测试通过；此前 15 个包产物及源目录 egg-info 字节保持。

离线证据：`/tmp/subtitle-brand-release-0.3.3/{package-tests.xml,platform-tests.xml,verification/}`；浏览器证据：`/tmp/subtitle-brand-browser/results.json`、`/tmp/subtitle-brand-category-regression/results.json`。部署脚本测试使用 stub，未部署；真实模型提取质量和 MediaKit 成片需另行授权验收。本轮没有提交、推送或计费调用。

## 0.3.2 历史发布记录

- 版本：0.3.2
- wheel：`vendor/video_subtitle_grounding-0.3.2-py3-none-any.whl`，57,267 bytes。
- wheel SHA256：`f5f4806ac028742900b5af3c460d024e0fcc3f5426d19f8d63069bb6d00d410d`
- sdist：`vendor/video_subtitle_grounding-0.3.2.tar.gz`，130,209 bytes。
- 源码归档：`exports/video-subtitle-grounding-0.3.2-source.tar.gz`（与独立包 sdist 字节一致）。
- sdist / 源码归档 SHA256：`d08f30e46437c340129f3dc8045de747f1d6a09e1fb05813f031c6ef6405cb75`
- 本地独立仓库：`standalone/video-subtitle-grounding`（平台 Git 忽略此目录）。
- wheel 包含提取、翻译、排版与 MediaKit 多轨压制 Python 源码及包元数据，不含配置密钥、业务数据或测试视频。

更新时在独立仓库测试并构建新版本，替换平台 `requirements.txt` 的固定文件名，再运行字幕提取、翻译、压制和多轨集成测试。生产部署通过 `scripts/deploy_server.sh` 从项目根目录安装，不依赖服务器登录 GitHub。

0.3.0 新增 72 条产品命名范式、未知型号/规格模型识别与名称保护。确认型号使用实际 Avenir Black，规格使用 Avenir Light，普通文字保留角色及人工字体规则。产品行用共同字号/基线绘制整行透明 PNG，平台内部 TOS 图层不进入公共资产画廊；预览读取同源鉴权 URL，供应商提交时刷新签名 URL。存储失败退回普通文字并返回警告。

0.3.1 将型号/规格判定设为全自动：翻译、保存、POST 排版计算及前端压制前保存自动识别；异常重试一次，仍失败保留普通字幕。文本、同块上下文与字典版本组成判定指纹，预览与重复保存复用结果；移除人工拆分、产品关闭和手动识别 UI，产品提示不要求人工校验。

0.3.2 新增 `video_category=product|unboxing`：产品视频有效底板强制透明，被忽略的人工底板不改变自动文字色，人工文字色仍保留；开箱及缺失类型保持原底板策略。普通文字、混合字体 PNG 和物化失败回退使用同一类型，图层缓存包含类型及有效底板策略。

排版版本：`single-line-adaptive-panel35-video-category-v4`；字典版本保持 `tineco-names-20261116-v1`。平台 JSON 新字段无需数据库迁移。线上只拉平台仓库后运行部署脚本，不拉第二个仓库；需要同时发布后端适配层、前端和 wheel 并重启。GET 读取和纯排版函数不调用模型；历史成片需重新压制才更新。回滚必须同步恢复平台适配层、前端及对应排版/任务指纹版本，不能只换 wheel。

本地已验证真实 Black/Light PNG、源包/wheel 一致性、安装位置和模拟接口。真实模型识别质量及真实 MediaKit 成片尚未验收，详见 `.trae/specs/recognize-and-style-product-names/checklist.md`。

0.3.1 回滚 wheel SHA256：`a146a6221ba12adc52c2b1009f49a66f9167f2b4954e0eb999e041614c392ed6`；源码归档 SHA256：`c6933c7ecd3dca11711b2d6b2b5decde6965bd4835e45d88d321ef6718bca71b`。对应排版版本 `single-line-adaptive-panel35-product-font-v3`，字典版本不变。

0.2.2 回滚 wheel SHA256：`3108406c8e99f5877fc00eeace68beaba63f00af27272cea3fa91c551daa25ca`；源码归档 SHA256：`f71fbc66f53ffa111820f9f33ff7f119ee02f59f88686010bdb7a2157f241b56`。

0.2.2 使用 `single-line-adaptive-panel35-role-font-v2` 排版版本。自动模式逐条按 `visual_role` 选择实际字体：`headline` 使用 Century Gothic Bold，`body`、`footnote`、缺失及未知角色使用 Century Gothic Regular（不是 Light/Thin）；人工 `style.font` 覆盖优先。文件字体提交保持 `bold: false`；自动缺字回退到 `ALi_PuHui` 时只有标题请求加粗，仍保留未验证提示。回滚到 0.2.1 时需同步恢复排版版本与前端默认字体规则，不能仅替换 wheel。离线验证不代表真实 MediaKit 成片字重验收。

0.2.1 回滚 wheel SHA256：`02bdef75ac48cfd98cad654167bf6c89ee260eced27104df2486529160f17db8`。

0.2.1 新增异步上传回调；平台使用它在 Files 上传成功后立即持久化任务到文件 ID 的关联。数据库保存失败会停止推理并清理供应商文件。任务快照字段为 `provider_file_id` 与 `provider_file_uploaded_at`，不变更提取接口响应或数据库结构。

## 0.3.2 Packaging Evidence

Built 2026-11-17 from the approved task2 source, with wheel built from sdist. Installed into the platform `.venv` with no dependencies installed, and into an isolated `/tmp` target. Both verifier modes passed 222 policy cases, actual-font text-only PNG comparisons, panel pixels, category cache isolation, absent-category compatibility, manual text colors and mocked render fallback. All 19 Python modules match current source, wheel, sdist/source archive and installed files. The installed wheel passed the full offline suite: 680 passed, zero skipped, including 25 actual-font tests; one external Starlette/httpx deprecation warning.

Exact resolved imports:

- Installed: `/Users/bytedance/AD-Creativity/.venv/lib/python3.14/site-packages/video_subtitle_grounding/__init__.py`
- Isolated: `/private/tmp/subtitle-category-release-0.3.2/isolated/video_subtitle_grounding/__init__.py`

Build command, cwd `/Users/bytedance/AD-Creativity/standalone/video-subtitle-grounding`:

```bash
env PYTHONDONTWRITEBYTECODE=1 /tmp/ad-subtitle-split-build/isolated-env/bin/python -m build --no-isolation --outdir /tmp/subtitle-category-release-0.3.2/dist --report /tmp/subtitle-category-release-0.3.2/build-report.json
```

Artifact copies, cwd `/Users/bytedance/AD-Creativity`:

```bash
cp -p /tmp/subtitle-category-release-0.3.2/dist/video_subtitle_grounding-0.3.2-py3-none-any.whl /tmp/subtitle-category-release-0.3.2/dist/video_subtitle_grounding-0.3.2.tar.gz vendor/
cp -p /tmp/subtitle-category-release-0.3.2/dist/video_subtitle_grounding-0.3.2.tar.gz exports/video-subtitle-grounding-0.3.2-source.tar.gz
```

Install, verify and test commands, cwd `/tmp` (no source `PYTHONPATH`):

```bash
/Users/bytedance/AD-Creativity/.venv/bin/python -m pip install --no-deps --no-compile /Users/bytedance/AD-Creativity/vendor/video_subtitle_grounding-0.3.2-py3-none-any.whl
/Users/bytedance/AD-Creativity/.venv/bin/python -m pip install --no-deps --no-compile --target /tmp/subtitle-category-release-0.3.2/isolated /Users/bytedance/AD-Creativity/vendor/video_subtitle_grounding-0.3.2-py3-none-any.whl
env PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/tmp/subtitle-role-fonttools /Users/bytedance/AD-Creativity/.venv/bin/python /Users/bytedance/AD-Creativity/scripts/verify-subtitle-product-release.py --font-dir /tmp/subtitle-role-real-fonts --output-dir /tmp/subtitle-category-release-0.3.2/verification
env PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/tmp/subtitle-role-fonttools /Users/bytedance/AD-Creativity/.venv/bin/python /Users/bytedance/AD-Creativity/scripts/verify-subtitle-product-release.py --isolated --isolated-target /tmp/subtitle-category-release-0.3.2/isolated --font-dir /tmp/subtitle-role-real-fonts --output-dir /tmp/subtitle-category-release-0.3.2/verification
env PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/tmp/subtitle-role-fonttools SUBTITLE_REAL_FONT_DIR=/tmp/subtitle-role-real-fonts /Users/bytedance/AD-Creativity/.venv/bin/python -m pytest /Users/bytedance/AD-Creativity/standalone/video-subtitle-grounding/tests --basetemp=/tmp/subtitle-category-release-0.3.2/pytest-temp --junitxml=/tmp/subtitle-category-release-0.3.2/installed-tests.xml -q
```

Additional passing packaging checks, cwd `/Users/bytedance/AD-Creativity`:

```bash
.venv/bin/ruff check --no-cache --select E9,F63,F7,F82 scripts/verify-subtitle-product-release.py
env PYTHONPYCACHEPREFIX=/tmp/subtitle-category-release-0.3.2/pycache .venv/bin/python -m py_compile scripts/verify-subtitle-product-release.py
git diff --check
bash scripts/tests/test_deploy_server.sh
shasum -a 256 -c /tmp/subtitle-category-release-prior-artifacts.sha256
shasum -a 256 vendor/video_subtitle_grounding-0.3.2* exports/video-subtitle-grounding-0.3.2-source.tar.gz
```

`git diff --check` also passed with cwd `/Users/bytedance/AD-Creativity/standalone/video-subtitle-grounding`. The deployment-script suite uses offline stubs, not a real deployment.

Evidence: `/tmp/subtitle-category-release-0.3.2/{build-report.json,installed-tests.xml,verification/release-installed.json,verification/release-isolated.json}`. Preexisting source changes and package artifacts were preserved; old artifact SHA checks passed and build-generated source egg-info was restored byte-for-byte from its pre-build snapshot. No backend service edits, paid calls, commits, pushes or deployment. This records packaging only; task4 remains unchecked pending parent-owned platform integration and broader acceptance in `.trae/specs/classify-subtitle-video-rendering`.
