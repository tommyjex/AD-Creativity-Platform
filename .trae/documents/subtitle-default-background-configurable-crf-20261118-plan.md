# 字幕接口默认底色与可配置 CRF 实施计划

状态：已完成实施、离线验收、0.3.8 构建与本地加载（2026-11-18，北京时间）。

> 执行说明：批准后按下列任务逐项实施与验证，优先在当前会话内联执行。保留现有未提交改动；本计划不包含提交、推送、生产部署或自动发起真实计费任务。

**目标：** 字幕压制请求不提交文字底板及画布的 `background_color`，前端支持保存并使用 0–30 的整数 CRF。

**架构：** 工作区保存 CRF，压制任务冻结配置，共享字幕包统一生成和校正提交参数。PNG 内部绘制仍沿用现有底板规则，Text 元素和画布使用 MediaKit 接口默认底色。

**技术栈：** Next.js / React / TypeScript、FastAPI / Pydantic、Python / Pillow、pytest / Vitest / Playwright，独立字幕包通过 vendor wheel 引入平台。

## 一、当前状态

- 独立字幕包当前为 0.3.7，平台通过 `requirements.txt` 中的 vendor wheel 安装。
- `standalone/video-subtitle-grounding/src/video_subtitle_grounding/layout.py` 给文字元素写入 `background_color`，给画布写入 `#000000FF`，输出 codec 固定为 H.264 / CRF 16。
- 共享 `render.py` 与平台 `backend/app/services/subtitle_translation.py` 的提交入口再次强制 CRF 16。只改前端或编译器不足以实现配置传递。
- `_resolve_render_encoding` 缓存的编码配置、任务身份及前端摘要也固定为 CRF 16。
- PNG 的底板已经由 `raster.py::draw_layer` 绘进图像；`product_layout.py` 的产品混排图层也复用这一绘制函数。
- 前端在工作区配置区保存压制方式，主界面和校对弹窗使用同一份已保存配置。校对界面仍提供底板样式控件，Text 的 DOM 示意也会显示这些底板颜色。
- 工作区使用现有 JSON 持久化；增加 CRF 无需数据库表或列迁移。

## 二、已确认的范围与设计决策

1. 用户已选择“仅省略接口字段”：所有新字幕压制的 `canvas.background_color` 和原生 `type=text` 元素的 `background_color` 均完全省略；不是传 `null`、透明色或空字符串。
2. PNG 图片内部仍保持原有自动及人工底板规则。PNG 生成、字体或存储失败后回退的 Text 元素也不传底板字段。
3. 识别结果中的 `segment.background_color` 是画面背景估计，保留；`style.background_color` 作为 PNG 样式也保留。删除范围仅限供应商请求对应位置。
4. 工作区字段命名为 `crf`，默认沿用当前值 **16**。前端使用原生下拉框提供 **0 至 30 共 31 个整数选项**，保存后刷新保持。
5. PNG、Text、独立 render API 和异常回退统一使用保存或冻结的 CRF；继续使用 H.264，完全不传 `video_bit_rate`。
6. 不增加 `preset`、`audio_codec`、字重、字体、字号或产品文字拆分等改动。保留 24px 自动脚注、现有文字色算法、时间、位置、对齐、音轨和 PNG 抗锯齿。
7. 只改 CRF 时，失效当前 render 阶段关联和当前成片关联，保留字幕、译文、识别缓存、排版字段、PNG 图层、提取/翻译关联和所有历史产物。相同 CRF 的保存不触发这些失效。
8. Text 的底板样式控件隐藏并提示“底板使用接口默认值”；切回 PNG 时原有配置仍可使用。Text DOM 示意不绘制自定义背景，不把浏览器的透明显示宣称为 MediaKit 默认值或真实成片效果。
9. 已提交供应商任务只轮询，不改变原请求或补造 CRF 信息。未提交、必须重新提交的旧任务使用其冻结配置：有合法 `crf` 则使用；否则有合法冻结 `encoding_result.crf` 则沿用；两者均缺失默认 16。不得套用工作区后来修改的 CRF。
10. 本轮将独立包升级为 **0.3.8**，新布局版本为 `single-line-png-text-default-background-v8`，编码策略版本为 `configurable-crf-h264-v3`，防止复用旧参数任务。

### 新请求的关键结构

以 CRF 12 为例：

```json
{
  "canvas": {"width": 1920, "height": 1080},
  "output": {
    "format": "mp4",
    "fps": 25,
    "disable_audio": false,
    "codec": {"video_codec": "h264", "crf": 12}
  }
}
```

轨道、文字和 transform 仍按现有逻辑生成；原生文字元素没有 `background_color`，PNG 的 image 元素使用已有绘制结果。通用多轨剪辑 API 的其他调用不受本次字幕专用策略影响。

## 三、实施任务

### 任务 1：统一 CRF 输入契约

文件：

- `backend/app/schemas/subtitle_translation.py`
- `standalone/video-subtitle-grounding/src/video_subtitle_grounding/translation_schemas.py`
- `standalone/video-subtitle-grounding/src/video_subtitle_grounding/api.py`
- `frontend/lib/api-types.ts`
- `backend/tests/test_subtitle_translation_routes.py`
- `backend/tests/test_subtitle_render_mode.py`
- `standalone/video-subtitle-grounding/tests/test_render_api.py`

- [x] 工作区 create/read 添加 `crf: StrictInt = Field(default=16, ge=0, le=30)`；update 添加可省略字段，但显式 `null` 加入 `required_values` 拒绝名单。
- [x] 独立 `SubtitleRenderRequest` 添加相同严格整数 CRF，默认 16。API 将顶层 `crf` 注入 runtime video；顶层字段为权威输入，不让未声明的 `video.crf` 覆盖。
- [x] 前端 workspace/create/patch 类型添加 `crf?: number`，兼容缺字段旧工作区；新的任务输入类型加入 `crf` 并更新编码策略版本。
- [x] 覆盖缺字段、0、12、16、30；拒绝 -1、31、小数、浮点 JSON 值、字符串、布尔值及显式 null。配置错误返回现有 422 输入错误，不发起供应商请求。

关键 schema：

```python
crf: StrictInt = Field(default=16, ge=0, le=30)
# Update 字段可以缺失，但显式 null 被 model_validator 拒绝。
crf: StrictInt | None = Field(default=None, ge=0, le=30)
```

### 任务 2：共享字幕输出策略

文件：

- 新建 `standalone/video-subtitle-grounding/src/video_subtitle_grounding/encoding.py`
- `standalone/video-subtitle-grounding/src/video_subtitle_grounding/layout.py`
- `standalone/video-subtitle-grounding/src/video_subtitle_grounding/render.py`
- 新建 `standalone/video-subtitle-grounding/tests/test_encoding.py`
- `standalone/video-subtitle-grounding/tests/test_layout.py`
- `standalone/video-subtitle-grounding/tests/test_render_mode.py`
- `standalone/video-subtitle-grounding/tests/test_product_layout.py`
- `standalone/video-subtitle-grounding/tests/test_raster.py`

- [x] 将 CRF 校验及字幕专用输出策略集中在 `encoding.py`；保留 `layout.ENCODING_POLICY_VERSION` 的兼容导出，已有平台导入无需断裂。
- [x] `layout.py` 从 runtime video 读取 `crf`，缺字段默认 16；在生成图层和内部度量后，对最终 project 应用输出策略。内部 summary 和 PNG 绘制输入仍保留底板色。
- [x] `render.py` 在实际提交前再次使用同一策略，兼容注入编译器及 PNG → Text 回退。回退保留原 CRF，不以固定 16 覆盖。
- [x] 提交事件及返回结果中的 CRF 使用实际值；不修改通用 `mediakit.py` 的多轨请求行为。
- [x] 更新布局和编码策略版本。PNG 内容像素与底板规则保持，图层身份随布局版本升级。

共享策略的核心实现约定：

```python
DEFAULT_CRF = 16
ENCODING_POLICY_VERSION = "configurable-crf-h264-v3"

def validate_crf(value):
    if type(value) is not int or not 0 <= value <= 30:
        raise ValueError("invalid_crf")
    return value

def apply_subtitle_output_policy(project, crf):
    crf = validate_crf(crf)
    project.setdefault("canvas", {}).pop("background_color", None)
    for track in project.get("track", []):
        for element in track:
            if element.get("type") == "text":
                element.pop("background_color", None)
    codec = project.setdefault("output", {}).setdefault("codec", {})
    codec.pop("video_bit_rate", None)
    codec.update(video_codec="h264", crf=crf)
    return project
```

编译和共享 render 入口将校验异常映射为现有 `SubtitleLayoutError("invalid_crf")`，保持独立 API 的稳定诊断契约。所有读取都用 `get("crf", DEFAULT_CRF)`，不用 `or 16`，避免把 0 错误替换为默认值。

- [x] 参数矩阵覆盖两种模式、两种视频类别、0/12/16/30、人工底板与自动底板、产品混排、缺字/生成/物化失败；断言最终 canvas/text 中字段不存在，codec 无视频码率。
- [x] 测试 PNG 内部非透明底板仍存在，且 CRF 改变不改变图层像素或同版本的图层资产身份。
- [x] 真实字体复核第 29 秒 41/34/24px、全文、时间、框与字重保持。仅输出字段和编码配置变化。

### 任务 3：平台冻结配置、失效与恢复

文件：

- `backend/app/services/subtitle_translation.py`
- `backend/app/services/subtitle_translation_media.py`
- `backend/tests/test_subtitle_render_mode.py`
- `backend/tests/test_subtitle_translation_workspace.py`
- `backend/tests/test_subtitle_translation_preview.py`
- `backend/tests/test_subtitle_translation_execution.py`
- `backend/tests/test_subtitle_translation_media.py`
- `backend/tests/test_structured_logging.py`

- [x] 预览 runtime video 传入工作区 CRF；render runtime video 使用任务快照 CRF。实际提交前调用共享输出策略，保证注入编译器和所有回退也省略两类背景字段。
- [x] 将 CRF 加入新 render 幂等身份、任务快照和 `encoding_result={source_asset_id, video_codec:"h264", crf:<冻结值>}`。新任务提交时即冻结工作区值，执行前验证缓存属于相同 CRF、布局及编码策略。
- [x] 拆分现有 `content_changed`：排版相关变化仍清理布局；新增 `crf_changed` 仅参与 render/output 失效。CRF 单独修改不清空 `LAYOUT_FIELDS` 或识别、翻译数据。
- [x] CRF 变化纳入 render 晚到结果写回和旧失败任务重试的陈旧快照检查。相同 CRF 不额外失效；仍增加正常保存 revision。
- [x] 保留现有并发规则。前端有活动阶段时禁用配置；后端若已有 render 冻结后 CRF 发生变化，原任务继续使用快照，只保存历史结果，不覆盖当前成片。无关 extract/translate 延续现有 writeback revision 保护。
- [x] 已有 `provider_task_id` 的任务绕过编译与新策略解析，只轮询并保留原 metadata；未提交旧任务采用冻结 CRF 的兼容规则，取得新策略身份并清除不再适用的旧编码解析/布局摘要。
- [x] 成片 metadata、task result 和安全结构化日志记录实际 CRF。现有日志白名单已有 `crf`，只补充必要测试，不扩大敏感数据记录。
- [x] 测试不同 CRF 不复用任务，CRF 0 正确冻结、提交、回退和展示；CRF 单独修改保留 PNG/排版，晚到旧结果仅进入历史；历史任务不伪造 CRF。

### 任务 4：前端 CRF 选择与 Text 默认底板示意

文件：

- `frontend/lib/subtitle-translation.ts`
- `frontend/components/workspace/subtitle-translation/workspace-editor.tsx`
- `frontend/components/workspace/subtitle-translation/use-subtitle-workspace.ts`
- `frontend/components/workspace/subtitle-translation/review-dialog.tsx`
- `frontend/components/workspace/subtitle-translation/segment-editor.tsx`
- `frontend/components/workspace/subtitle-translation/video-preview.tsx`
- `frontend/tests/subtitle-translation-render-mode.test.tsx`
- `frontend/tests/subtitle-translation-audit.test.tsx`
- `frontend/tests/subtitle-translation.test.tsx`
- `frontend/tests/subtitle-translation-fixtures.ts`

- [x] 增加历史默认 helper `subtitleCrf(workspace) => workspace.crf ?? 16`；在压制方式旁放置单一 CRF 选择器，采用现有 `blocked`、保存/revision/冲突规则。

```tsx
<select
  aria-label="压制 CRF"
  className={subtitleFieldClass}
  disabled={blocked}
  value={subtitleCrf(workspace)}
  onChange={(event) => void state.update({ crf: Number(event.target.value) })}
>
  {Array.from({ length: 31 }, (_, crf) => (
    <option key={crf} value={crf}>{crf}</option>
  ))}
</select>
```

- [x] 展示“整数 0–30；数值越小质量通常越高，文件通常越大”，不将 CRF 当作固定码率或体积承诺。
- [x] 两个压制入口共用已保存 CRF，不在弹窗维护独立配置；主界面和弹窗说明展示当前保存值。
- [x] hook 的 `crfChanged` 单独清除 render/output 关联，保留服务端返回的排版、图层和识别/翻译数据。更新禁用保护，不使用真假值判断 CRF 0。
- [x] task/asset 摘要显示有证据的真实 CRF。优先合法 task result，其次冻结 `encoding_result`/快照；仅明确旧 `crf16-h264-v2` 策略可推知 16，没有编码证据继续标“历史参数”。不得从当前工作区补造历史参数。
- [x] 给 `SubtitleSegmentEditor` 传递 `renderMode`；Text 隐藏底板模式/颜色/不透明度/RGBA 控件，提示接口默认；PNG 控件和已保存值保持。
- [x] Text DOM 预览不设置自定义背景色。Text 及 PNG 原生文字回退的说明避免“已添加深灰底板”等不符合提交参数的表述；保留背景估计与现行文字颜色算法。
- [x] Text 的“产品视频无底板”文案改为接口默认底板说明，不断言省略参数一定等价于透明。PNG 产品视频仍显示既有无底板策略。
- [x] Vitest 覆盖 31 个选项、默认值、0/12/30 保存刷新、两个入口一致、只读/busy/conflict/活动任务禁用、精准失效、动态 CRF 摘要、历史参数、Text 控件隐藏及 PNG 样式保留。

### 任务 5：集成、三视口及提交参数验收

复用依据：

- `scripts/verify-subtitle-png-browser.py`
- `scripts/verify-subtitle-translation-browser.py`
- `scripts/verify-subtitle-product-release.py`

- [x] 在工作区外的任务临时目录准备离线 fixture 与验收脚本；Mock MediaKit 捕获实际提交 body，不调用真实供应商服务。
- [x] 1440×900、834×1112、390×844，creator/viewer 各一组；验证 CRF 0→12→30 的保存刷新与权限，两种模式、两个压制入口，以及字段省略。
- [x] 校对“计算排版 · 不保存”保持 revision 语义；Text 无自定义底板，PNG 保留原底板控件和绘制效果。
- [x] 验证修改 CRF 后内容、产品缓存、提取/翻译关联和 PNG 图层不变，旧输出退出当前关联，历史仍可定位。
- [x] 验证原生播放器控件、object-contain 和无水平溢出。
- [x] 测试 Next 使用从 frontend cwd 计算出的外部相对 `NEXT_DIST_DIR` 路径；避免绝对路径被解释成 workspace 内 `private/tmp`。启动前精确快照 next-env/tsconfig，停止测试进程后仅恢复自身自动改动，保留原有 `.next` 和现有服务。
- [x] 将接口默认底色的最终视觉明确留给后续真实压制确认，不用 DOM 示意证明供应商默认值。

### 任务 6：0.3.8 发布与本地加载

文件：

- `standalone/video-subtitle-grounding/pyproject.toml`
- `standalone/video-subtitle-grounding/src/video_subtitle_grounding/__init__.py`
- `standalone/video-subtitle-grounding/README.md`
- `standalone/video-subtitle-grounding/tests/test_layout.py` 中的版本断言
- `requirements.txt`
- `vendor/README.md`
- `scripts/verify-subtitle-product-release.py`
- 新增 `vendor/video_subtitle_grounding-0.3.8-py3-none-any.whl`
- 新增 `vendor/video_subtitle_grounding-0.3.8.tar.gz`
- 新增 `exports/video-subtitle-grounding-0.3.8-source.tar.gz`

- [x] 更新版本和发布 verifier，增加可配置 CRF、接口背景字段省略、PNG 图片底板保留的矩阵断言。不要继续断言 Text payload 与 PNG 内部底板 summary 相同。
- [x] 保存旧 vendor/exports SHA 和构建前 egg-info；由 sdist 构建 wheel，生成匹配源码归档，恢复构建产生的 egg-info 变化。
- [x] 隔离及本地安装验证源码/wheel/sdist/归档/安装文件一致；模块数量依据当前源码发现，不沿用旧包固定数量。
- [x] 执行完整共享包测试和相关平台回归，前端检查、Ruff 致命检查、编译、两仓库 diff 及部署脚本离线测试。中间缓存和测试结果保存在工作区外。
- [x] 本地安装及重启前即时查询 queued/running 工具任务。无活动任务才使用保存的启动命令安全重启并确认 `/health` 200、导入位置和 0.3.8 版本；若存在活动任务，保留当前服务并明确记录等待本地加载，不能强停。
- [x] 更新执行进度与验收记录。保留所有旧包、此前参数还原文件及用户改动；不提交、不推送、不部署线上，不发起真实计费压制。

## 四、验证命令与通过标准

执行阶段为临时目录设置 `PYTHONPYCACHEPREFIX` 和 pytest `--basetemp`；按下列命令完成验证。

共享包源代码回归（平台根目录）：

```bash
PYTHONPATH=standalone/video-subtitle-grounding/src .venv/bin/python -m pytest standalone/video-subtitle-grounding/tests -q -p no:cacheprovider
```

平台相关回归：

```bash
PYTHONPATH=standalone/video-subtitle-grounding/src:. .venv/bin/python -m pytest backend/tests/test_subtitle_render_mode.py backend/tests/test_subtitle_translation_workspace.py backend/tests/test_subtitle_translation_preview.py backend/tests/test_subtitle_translation_execution.py backend/tests/test_subtitle_translation_routes.py backend/tests/test_subtitle_translation_media.py backend/tests/test_subtitle_translation_layout.py backend/tests/test_subtitle_product_names.py backend/tests/test_subtitle_brand_exclusion.py backend/tests/test_structured_logging.py backend/tests/test_mediakit_multitrack.py -q -p no:cacheprovider
```

安装后共享包在 sdist 解包目录运行完整测试，平台回归改用 `PYTHONPATH=.`，不得将 standalone/src 加入搜索路径，确认确实测试 vendor wheel。

前端（cwd `frontend`）：

```bash
npm run test -- subtitle-translation
npm run lint
npm run typecheck
```

部署离线和差异检查：

```bash
bash scripts/tests/test_deploy_server.sh
git diff --check
git -C standalone/video-subtitle-grounding diff --check
```

通过标准：

- CRF 0、12、16、30 在前端保存、任务快照、codec、日志及 metadata 中一致；非法配置不产生供应商调用。
- 每个新提交的字幕请求都没有 `canvas.background_color`、原生文字 `background_color` 或 `output.codec.video_bit_rate`。
- PNG 内部底板、文字颜色、实际字体、字重、24px 脚注与几何保持；Text 回退保持选定 CRF 并省略底板参数。
- CRF 单独修改不破坏排版和上游数据；旧任务/产物可追溯，晚到结果不覆盖当前配置。
- 源码、隔离包、安装包相关测试无失败，前端标准检查通过，六个浏览器场景通过，构建一致性及旧产物保留验证通过。
- 本地加载有明确活动任务保护和版本/健康证据；真实成片视觉、文件大小与接口默认底色行为不冒充离线已验证。

## 五、评审摘要

只省略 MediaKit 的两类背景字段，PNG 内部底板保持；CRF 默认 16、整数 0–30，在工作区统一保存并随任务冻结。用户已确认本计划，开始实施上述范围。

## 六、完成记录

- 共享源码、隔离 wheel、本地安装 wheel 的完整测试各 **902 passed**，无失败或跳过；真实字体目录 `/tmp/subtitle-nonheadline-bold/fonts`。隔离与本地安装均在 sdist 解包目录运行，不使用 standalone/src 作为包搜索路径。
- 本地安装 wheel 后的平台字幕相关回归 **899 passed**，包含两种 repository fixture、严格 schema、冻结/恢复、CRF 精准失效、晚到保护、metadata 与安全日志。证据 `/tmp/subtitle-crf-v3-release/platform-installed-tests.{xml,log}`。
- 前端 **151 passed**；标准 `lint` 与 `typecheck`（tsBuildInfoFile 位于 `/tmp`）通过。三视口 creator/viewer 共六场景通过，无页面错误、未声明网络请求或水平溢出；证据 `/tmp/subtitle-crf-v3-browser/output/results.json` 与各场景截图/请求/任务记录。
- Text 底板控件隐藏、PNG 控件保持；CRF 0→12→30 保存刷新，两个压制入口与任务编码保持一致。预览不保存 revision，文字 fallback 不绘制自定义底板。
- 第 29 秒真实字体复核保持 41/34/24px、全文、时间、框、颜色和字重；CRF 改变不改变图层像素及同版本资产身份。接口默认底色与真实成片体积/质量没有用离线示意代替验收。
- 隔离及本地发布 verifier 各 **513** 策略检查通过；**23** Python 模块及 **51** 非生成归档文件匹配。Wheel SHA256 `ef0f94bb4ce782972f595a5b6a614197e6e57ebf1cead51da768e54e5ea6e4a3`；sdist / source SHA256 `27fb0dd3484ea7f1cfcc4c2f3ea373deb10ea7ab9d4175f9b0351aec881fda97`。42 个旧产物（含此前参数还原文件）及五个 egg-info 文件校验保持。
- Ruff 致命检查、编译、两仓库 `git diff --check`、部署脚本离线测试通过。Next 验收使用外部相对缓存路径，next-env.d.ts 与 tsconfig.json 恢复到启动前精确字节；保留现有服务与既有修改。
- 本地安装和重启前两次只读查询均为 queued=0 / running=0；核实旧后端 PID 57378 及 cwd 后安全停止，按保存命令启动新 PID **36421**（command `eublljlmme`）。`http://127.0.0.1:8000/health` 返回 200 / ok；包从 `.venv/lib/python3.14/site-packages` 导入 **0.3.8**，编码策略 `configurable-crf-h264-v3`。平台 health 的独立版本仍为 0.1.0。
- 最终 wheel、sdist 与源码归档已写入 vendor/exports；未提交、推送或部署线上，未发起真实模型或 MediaKit 计费调用。
