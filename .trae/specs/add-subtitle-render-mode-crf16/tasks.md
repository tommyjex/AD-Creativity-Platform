# PNG / Text 双路字幕压制实施计划

状态：已完成（离线范围）。

目标：用户能选择 PNG 或 Text 压制字幕，两路统一 H.264 / CRF 16，可识别回退并从历史任务定位对比产物。

架构：复用共享包 PNG 与显式 Text 入口；工作区保存方式，render 使用冻结快照；共享编译器统一 codec，平台复用既有任务、资产和预览流程。

技术栈：Python/Pydantic/Pillow/FastAPI、Next.js/TypeScript、pytest/Vitest/Playwright。按当前 Spec 模式要求委派实施与验证，独立文件范围并行推进。

## Tasks

- [x] 1. 定义方式与快照契约。
  - 在 `backend/app/schemas/subtitle_translation.py` 的 workspace create/update/read 加 `render_mode=png|text`，默认 PNG，拒绝显式 null/非法值。
  - 在共享 `translation_schemas.py` 的独立 render 请求加默认 PNG 的方式字段，`api.py` / `render.py` 传递；布局摘要提供实际方式，render 汇总提供实际 png/text/mixed。
  - 对应 schema/routes/独立 render API 测试验证缺字段兼容与参数传递；保持自定义 compiler 注入接口可用。

- [x] 2. 共享编译器实现主动 Text 和 CRF 16。
  - `layout.py` 根据 runtime video 的 render_mode 选择现有 PNG 或显式 `rasterize=False` 文字路径；`compile_text_subtitle_project` 始终强制 text，避免递归/模式覆盖冲突。
  - 统一 output.codec 为 `video_codec=h264, crf=16`，完全省略 video_bit_rate；删除新编译的码率缺失警告，保留 fps/音轨/画布行为。
  - Text 不生成 layers；产品混排保持整行字体回退并返回 `text_product_font_fallback`，不改变产品识别记录。
  - 保持当前字重规则、24px 脚注、原生单行文字参数和 PNG 抗锯齿；默认请求方式与每行实际方式分别记录。
  - 更新布局与编码策略版本；单测覆盖两类视频、普通/产品行、人工样式、缺字/生成/物化失败。
  - 验证命令：`PYTHONPATH=standalone/video-subtitle-grounding/src .venv/bin/python -m pytest standalone/video-subtitle-grounding/tests -q -p no:cacheprovider`；应无失败，实际字体测试使用已缓存字体目录。

- [x] 3. 平台贯通预览、模式失效和冻结任务。
  - `subtitle_translation.py` 将 render_mode 加入预览 runtime video、render 快照、幂等身份与恢复逻辑；方式变化采用既有类别变化的精准失效流程，保留内容/产品识别/历史产物。
  - 替换 `_resolve_render_encoding` 的码率补探：冻结 H.264 / CRF 16 和底片 asset_id，不专门下载探测码率；清理旧编码解析结果，已提交任务绕过重新编译。
  - Text 绕过 layers.prepare；PNG 异常保留原生回退并记录实际方式；预览切换不得继承 PNG URL 或旧文字摘要。
  - `subtitle_translation_media.py` 的成片 metadata 保存请求/实际方式与 codec；`core/logging.py` 添加安全字段，保留 TLS/敏感数据边界。
  - 更新 workspace/preview/execution/product/brand/routes 与日志测试，覆盖新旧任务、方式变化、重复提交、失败重试、晚到结果和权限。
  - 验证命令：`PYTHONPATH=. .venv/bin/python -m pytest backend/tests/test_subtitle_translation_workspace.py backend/tests/test_subtitle_translation_preview.py backend/tests/test_subtitle_translation_execution.py backend/tests/test_subtitle_translation_routes.py backend/tests/test_subtitle_product_names.py backend/tests/test_subtitle_brand_exclusion.py backend/tests/test_mediakit_multitrack.py -q -p no:cacheprovider`，并运行相关媒体/日志测试。

- [x] 4. 前端选择与一致预览。
  - `api-types.ts` 同步方式字段；`subtitle-translation.ts` 提供历史缺字段的 PNG 默认值与产品字体/回退提示。
  - `workspace-editor.tsx` 增加单一选择器，保存后刷新保持；task 卡片和当前成片摘要标明方式及必要回退，CRF 不增加可编辑控件。
  - `use-subtitle-workspace.ts` 将方式变化加入精准失效、并发与权限保护；主压制和校对弹窗共用已保存方式，不触发额外翻译或产品识别。
  - `review-dialog.tsx` 显示当前方式；`video-preview.tsx` 防止 Text 复用残留 PNG，保持 object-contain、原生播放器控件和示意文案。
  - Vitest 覆盖默认/切换/保存刷新、两个按钮一致、只读/busy/conflict、任务与回退标签、Text 无 PNG 和旧任务“历史参数”。
  - 验证命令（cwd frontend）：`npm run test -- subtitle-translation`、`npm run lint`、`npm run typecheck`；预期通过。

- [x] 5. 集成与三视口验收。
  - Playwright 使用离线接口和实际字体，覆盖 1440×900、834×1112、390×844，creator/viewer 两角色。
  - PNG → Text → PNG，保存/刷新、计算排版、不保存语义、两个压制入口、加载失败、产品混排说明和无横向溢出；断言实际请求模式和 CRF 16，不调用真实模型/MediaKit。
  - 普通第 29 秒三行对比共享度量结果：41/34/24px，完整译文、框与时间一致；明确原生 bold 差异，不将 DOM 预览当成供应商验收。
  - 测试脚本、输出和缓存放在工作区外的任务临时目录；只最终交付包/必要样张留在工作区。
  - 最终证据：`/private/tmp/subtitle-render-mode-crf16-task5/output/final-report.md`、`final-report.json`、`results.json` 实读六项通过；修正外部缓存后 mobile creator 另行重测，其余五场景沿用此前成功证据。第 29 秒普通 PNG/Text 的 41/34/24px、字体、全文、框及时间证据已复核。
  - 清理完成：仅移除精确 run-owned 工作区缓存，原有 `.next`/无关父目录内容保留；两配置字节精确恢复，3058/8058 停止，3000/8000 未触碰；标准 lint/typecheck 退出 0，父任务提供最终 diff 检查通过证据。无真实计费或生产调用。

- [x] 6. 构建和本地验证。
  - 共享包更新 0.3.7，从 sdist 构建 wheel，提供 exports 源码归档，更新 requirements、vendor/README 与 release verifier。
  - 本地与隔离安装确认源码/wheel/sdist 一致、旧产物 SHA 和构建前 egg-info 保持；验证提交 wire payload 两路均为 CRF 16、无 video_bit_rate。
  - 运行完整共享包及平台相关回归、Ruff 致命检查、Python 编译、前端检查、两仓库 `git diff --check` 与部署脚本离线测试。
  - 本地安装前确认活动工具任务；允许安全重启时按既有 run 命令加载新版，health 200，记录导入位置与版本。不得干扰活动任务。
  - 更新本规格任务和验收清单；不提交、不推送、不生产部署，不自动计费压制。
  - 最终证据：`/tmp/subtitle-crf16-release.aZKLB7/final-report.md`；隔离及本地共享包各 842 passed，平台安装包 18 模块 826 passed，两个 verifier 各 481 策略用例通过。22 模块及 49 个非生成归档文件一致；Ruff、编译、两仓库 diff 和部署脚本离线测试通过。
  - 安装前及停止原后端前即时确认 queued/running=0；验证完整 process command/cwd 后按保存命令重启。新 PID 57378，命令 `emuyrvgzqp`，health 200；0.3.7 导入来自 `.venv/lib/python3.14/site-packages/video_subtitle_grounding/__init__.py`。

- [x] 7. 任务完成前展示已冻结的实际方式（前端）。
  - 复核发现任务摘要只读取 result，遗漏提交后写入 input_snapshot.effective_render_mode 的回退信息。
  - 优先读取有效结果；结果缺失时读取快照，不从当前工作区推断，不虚构历史 CRF。
  - 已覆盖运行中和提交后失败的 PNG → Text/mixed 任务及历史参数；前端累计 144 项测试通过。
  - 最终文档复核重新运行 `subtitle-translation-audit`：21 项通过；确认有效 result 优先、缺失/非法 result 使用有效快照、不得从工作区或请求推断历史实际方式/CRF。

- [x] 8. 完整清理模式切换后的排版提示（后端与前端）。
  - 后端清理 background_unknown、low_contrast、contrast_unverified 等衍生颜色提示；前端清理 png_text_fallback、png_mixed_fallback、subtitle_raster_unavailable。
  - 同时覆盖工作区与字幕行，保留识别、翻译、品牌提示、历史任务和资产诊断。
  - 前端 144 项测试、后端 700 项源代码回归通过，浏览器六场景验证切换提示清理。
  - 最终文档复核独立重跑前端审计 21 项、后端定向 12 项通过（111 项未选择）；确认 workspace/row 清理及识别、翻译、品牌、冻结任务、历史资产保留。完整套件计数沿用父任务前次报告，不与定向测试相加。

- [x] 9. 修正版本测试并重新验证 0.3.7 发布包。
  - 隔离完整测试发现 tests/test_layout.py 仍断言旧版本 0.3.6；修正为本轮 0.3.7。
  - 从源码重新生成 sdist，再从 sdist 构建 wheel，更新源码归档，重跑隔离完整测试和发布验证。
  - 保留此前所有旧产物 SHA 和构建前 egg-info；本地安装及健康检查仍遵守活动任务保护。
  - 初次隔离完整测试 841 项通过、1 项旧版本断言失败，原报告保留；修复后完整结果见 `isolated-final-tests.xml`、`installed-final-tests.xml`，各 842 passed、零失败/跳过，不使用初次 verifier 或升级前结果替代。
  - `rebuild-report.json` 记录 sdist → wheel；vendor 与 exports 已同步。原 SHA 快照不变，59 个保留条目（27 个旧包产物及五个原 egg-info 文件等）一致；授权更新的 vendor README 和 0.3.7 目标归档不属于旧产物保留断言。

## 最终记账

- 已完成：任务 1–9 的离线实施、审计、发布验证与安全本地健康验收；详见 `checklist.md` 的 24 检查点证据表。
- 最终发布代理仅修正共享包旧版本测试、当前 README、发布 verifier、包产物和本规格记账；未修改其他共享实现、后端或前端实现，用户改动保留。
- 本规格已完成（离线范围）；真实计费成片对比仍为用户之后授权的范围外项，保持未勾选，未提交、推送或生产部署。

## Task Dependencies

- 任务 2、3、4 依赖任务 1 的字段契约；任务 3 依赖任务 2 的共享编译能力。
- 前端任务 4 可在契约确定后与后端实现并行准备，但集成完成依赖任务 3。
- 任务 5 依赖任务 2–4；任务 6 的最终发布验证依赖任务 5。
- 真实成片比较属于用户之后发起的验证，不作为离线实施完成的虚假通过项。
- 补充任务 7–8 完善任务 3–4；任务 9 完善任务 6，全部完成后才关闭对应验收项。
