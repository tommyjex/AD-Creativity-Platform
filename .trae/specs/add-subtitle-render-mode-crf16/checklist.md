# PNG / Text 双路字幕压制验收清单

状态：已完成（离线范围）。

- [x] 创建/读取/保存支持 render_mode=png|text，缺字段默认 PNG，非法枚举/null 的配置校验明确。
- [x] 选择器可保存和刷新，creator 可修改，viewer/busy/conflict/活动任务禁用。
- [x] 主界面压制与弹窗保存压制共用已保存方式，没有第二套模式状态。
- [x] PNG 默认保持实际字体、4 倍采样、透明图层与现有底板策略。
- [x] Text 全部字幕元素为原生 text，不生成或上传 PNG，不依赖图层存储。
- [x] 普通三类字幕保持全文、字体 URL、度量、框、时间与颜色；自动脚注 24px，人工字号优先。
- [x] Text 现有 bold 行为不暗改，预览标明示意；两路字重差异在对比说明中明确。
- [x] Text 产品混排整行字体回退明确提示，识别数据保留，无隐式 PNG。
- [x] 两路、独立 API、生成/字体/物化失败回退均提交 output.codec.video_codec=h264、crf=16。
- [x] 最终提交 output.codec 完全不含 video_bit_rate，源数据有值/缺失/损坏均一致。
- [x] 新压制不为码率下载补探、不生成码率缺失警告，正常媒体探测与其他剪辑工具保持。
- [x] 模式切换清理旧 PNG/文字摘要和排版提示，只失效当前 render/成片关联，保留提取、翻译、识别与历史产物。
- [x] 请求模式/实际模式分开记录，每行有效方式可追溯；PNG 回退不会伪装成纯 PNG。
- [x] 幂等身份包含模式与新编码策略，两种方式对应不同任务。
- [x] 编码配置在提交前冻结，已提交历史任务只轮询，未提交旧任务升级策略而不套用当前工作区模式。
- [x] 修改模式后的旧任务结果不能覆盖当前成片，revision/并发/晚到保护通过。
- [x] task 摘要与产物 metadata 标明方式及必要回退；无字段历史产物不标造假的 CRF 16。
- [x] 安全结构化日志记录模式与编码参数，沿用 TLS，无模型原文/签名 URL/凭据泄露。
- [x] 独立包与平台相关回归、实际字体对比用例、前端 Vitest/lint/typecheck 通过。
- [x] Playwright 六场景通过：三视口×两权限，切换/刷新/预览/两个压制入口/回退，无横向溢出。
- [x] 第 29 秒普通三行度量基线 41/34/24px 及时间/全文一致；本地结果不冒充真实成片。
- [x] 0.3.7 wheel/sdist/源码/安装文件一致，requirements 正确，所有旧产物与用户改动保留。
- [x] Ruff 致命检查、编译、两仓库 diff、部署脚本离线测试和安全本地健康验证通过。
- [x] 真实计费成片对比未自动执行，未提交/推送/生产部署；交付明确实际视觉验收边界。

## 最终系统复核记录（2026-11-17）

独立审计阶段仅修改本规格文档，只读检查实现与离线证据，无实现修复或生产/计费操作。随后父任务委派的 release_finalize 修正任务 9 的旧版本测试及当前共享 README，重新构建、安装并在零活动任务保护下安全重启本地后端。未修改其他共享实现、后端或前端实现，未发现需新增编号修复任务的具体代码缺口。

证据口径：

- 父任务提供的前次独立审计结果：前端 144 项通过；后端源代码回归 700 项通过，Ruff 致命检查、编译及 diff 通过；共享包在版本升级前 842 项通过。这些是前次报告，不是本轮重新运行的完整套件。
- 本轮独立重跑 `npm run test -- subtitle-translation-audit`：21 项通过，覆盖任务 7 快照回退及任务 8 前端清理。
- 本轮独立重跑 `PYTHONPATH=standalone/video-subtitle-grounding/src:. .venv/bin/python -m pytest backend/tests/test_subtitle_render_mode.py -k 'color_diagnostics_only or preserves_brand_notices_and_frozen_diagnostics or historical_provider_poll' -q -p no:cacheprovider --basetemp=/tmp/subtitle-spec-final-focused`，设置 `PYTHONPYCACHEPREFIX=/tmp/subtitle-spec-final-pycache`：12 项通过、111 项未选择，1 条 Starlette/httpx 弃用提示。不是完整后端回归。
- 本轮平台及共享包目录分别执行 `git diff --check`，均退出 0。未将其替代最终构建后检查。
- 初次隔离发布完整测试 841 项通过、1 项旧版本断言失败，原 `isolated-tests.xml` 和初次 [release-isolated.json](file:///tmp/subtitle-crf16-release.aZKLB7/verification/release-isolated.json) 保留为历史基线，不代表最终包。修复重建后 [isolated-final-tests.xml](file:///tmp/subtitle-crf16-release.aZKLB7/isolated-final-tests.xml) 与 [installed-final-tests.xml](file:///tmp/subtitle-crf16-release.aZKLB7/installed-final-tests.xml) 各 842 passed、零失败/跳过；[platform-installed-final-tests.xml](file:///tmp/subtitle-crf16-release.aZKLB7/platform-installed-final-tests.xml) 为 18 个安装包相关模块 826 passed、零失败/跳过，不与前次源代码 700 相加。
- 最终两个 [verifier 报告](file:///tmp/subtitle-crf16-release.aZKLB7/verification-final/) 各通过 481 个离线实际字体策略用例，22 个模块及 49 个非生成源码归档文件一致，包含修正测试与 README。`rebuild-report.json` 明确从 sdist 构建 wheel；vendor/exports 已同步。`preserved-final-check.log` 和 `runtime-verification-final.json` 确认 59 个原快照保留条目一致，含 27 个旧包产物与五个构建前 egg-info 文件；原快照保留，仅授权 vendor README 和本次 0.3.7 重生成目标不纳入旧文件断言。
- 最终 Ruff 致命检查、两仓库编译及 diff、部署脚本离线测试通过。安装前及停止原 PID 35583 前即时 DB 检查均 queued/running=0；完整 command/cwd 验证后按保存命令重启，PID 57378，命令 `emuyrvgzqp`，health 200。共享包 0.3.7 导入来自平台 `.venv/lib/python3.14/site-packages/video_subtitle_grounding/__init__.py`，health 的平台版本另为 0.1.0。详细命令与证据见 [最终发布报告](file:///tmp/subtitle-crf16-release.aZKLB7/final-report.md)。
- [浏览器 results.json](file:///tmp/subtitle-render-mode-crf16-task5/output/results.json) 实读为 6 场景通过；[config-restoration.json](file:///tmp/subtitle-render-mode-crf16-task5/output/config-restoration.json) 两文件均 `own_next_auto_edit_restored_exactly`，前后 SHA 一致。随后收到并实读 [final-report.md](file:///private/tmp/subtitle-render-mode-crf16-task5/output/final-report.md) 和 [final-report.json](file:///private/tmp/subtitle-render-mode-crf16-task5/output/final-report.json)：标准 lint/typecheck 退出码均为 0，父任务提供最终 diff 检查通过证据。初次绝对 dist 产生的精确 run-owned `frontend/private/tmp/subtitle-render-mode-crf16-task5` 已在进程退出后移除，原有 `.next` 及无关父目录内容保留；改为外部缓存后 mobile creator 重测通过，其余五场景沿用此前成功证据，不声称全部六场景再次重跑。配置按字节恢复，3058/8058 已停止，浏览器代理未触碰原有 3000/8000；后续发布代理仅安全重启 8000。准备阶段 `browser_tested=false` 不是最终浏览器状态。

下表序号对应上方 24 项检查；“通过”只指已验证的离线契约，不代表供应商成片视觉通过。

| 检查点 | 状态 | 实现引用与证据 |
| --- | --- | --- |
| 1. 方式契约 | 通过 | [平台 schema](file:///Users/bytedance/AD-Creativity/backend/app/schemas/subtitle_translation.py#L120-L151)、[平台模式测试](file:///Users/bytedance/AD-Creativity/backend/tests/test_subtitle_render_mode.py#L43-L116)；共享 `tests/test_render_mode.py::test_api_mode_defaults_png_and_rejects_explicit_null_or_invalid`。 |
| 2. 保存与禁用 | 通过 | [选择器](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/subtitle-translation/workspace-editor.tsx#L37-L75)、[hook 权限/冲突保护](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/subtitle-translation/use-subtitle-workspace.ts#L85-L112)；前端 144 项前次报告，浏览器结果含保存刷新、viewer 零写请求、active/conflict 禁用。 |
| 3. 统一入口 | 通过 | [run 使用当前已保存 workspace](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/subtitle-translation/use-subtitle-workspace.ts#L115-L144)；浏览器每个 creator 的 `entrance_modes` 均含主入口/弹窗的 text、png。 |
| 4. PNG 保持 | 通过 | [raster 实际字体与透明抗锯齿](file:///Users/bytedance/AD-Creativity/standalone/video-subtitle-grounding/src/video_subtitle_grounding/raster.py#L14-L65)；ordinary-png.json 三行 `raster_scale=4`。保留既有超大图层内存上限降采样，不承诺任意尺寸恒定 4 倍。 |
| 5. 原生 Text | 通过 | [共享编译分流](file:///Users/bytedance/AD-Creativity/standalone/video-subtitle-grounding/src/video_subtitle_grounding/layout.py#L606-L609)、[共享提交 Text 约束](file:///Users/bytedance/AD-Creativity/standalone/video-subtitle-grounding/src/video_subtitle_grounding/render.py#L39-L67)；平台 `test_text_invalid_custom_layers_never_prepare_or_submit`，ordinary-text.json 三行全为 text。 |
| 6. 参数与人工优先 | 通过 | 共享 `test_text_runtime_keeps_native_policy_without_raster`、`test_actual_29_second_three_lines_have_equal_measurement_in_both_modes`；[普通 PNG 证据](file:///tmp/subtitle-render-mode-crf16-task5/output/ordinary-png.json)、[普通 Text 证据](file:///tmp/subtitle-render-mode-crf16-task5/output/ordinary-text.json) 的字体 SHA、全文、框、时间、颜色一致。 |
| 7. 字重边界 | 通过 | 本 spec“对比范围与既有字体差异”；ordinary-text.json 的 headline/body/footnote 为 `bold=false/true/true`，PNG 不合成加粗；前端预览为示意。 |
| 8. 产品 Text 回退 | 通过 | [共享整行字体提示](file:///Users/bytedance/AD-Creativity/standalone/video-subtitle-grounding/src/video_subtitle_grounding/layout.py#L722-L755)、[前端提示](file:///Users/bytedance/AD-Creativity/frontend/lib/subtitle-translation.ts#L59-L62)；平台 `test_text_product_fallback_preserves_recognition`、[product-text.json](file:///tmp/subtitle-render-mode-crf16-task5/output/product-text.json)。 |
| 9. CRF 全路径 | 通过 | [共享提交 codec 兜底](file:///Users/bytedance/AD-Creativity/standalone/video-subtitle-grounding/src/video_subtitle_grounding/render.py#L49-L67)、[平台提交 codec 兜底](file:///Users/bytedance/AD-Creativity/backend/app/services/subtitle_translation.py#L1251-L1302)；共享 `test_render_api_fallback_keeps_category_policy` 覆盖生成/字体/物化失败，浏览器 `crf16_all_render_snapshots=true`。 |
| 10. 完全省略码率 | 通过 | 上述两个提交入口均 `codec.pop("video_bit_rate", None)`；共享 `test_codec_never_depends_on_metadata_and_keeps_audio_fps` 与平台 `test_render_encoding_freezes_clean_source_before_submit` 覆盖有值、缺失、损坏。 |
| 11. 无码率补探 | 通过 | [冻结编码仅保存底片 ID/H.264/CRF](file:///Users/bytedance/AD-Creativity/backend/app/services/subtitle_translation.py#L1372-L1419)，不调用 media 下载/补探；`test_encoding_cache_replaced_without_metadata_fetch`。正常媒体探测及其他工具未移除。 |
| 12. 精准失效及清理 | 通过 | [后端清理](file:///Users/bytedance/AD-Creativity/backend/app/services/subtitle_translation.py#L590-L610)、[前端清理](file:///Users/bytedance/AD-Creativity/frontend/lib/subtitle-translation.ts#L210-L242)；本轮 21 项前端及 12 项后端复核，涵盖颜色/PNG 回退提示和识别/翻译/品牌/历史保留。 |
| 13. 请求/实际方式 | 通过 | [逐行与汇总](file:///Users/bytedance/AD-Creativity/standalone/video-subtitle-grounding/src/video_subtitle_grounding/layout.py#L750-L810)、[提交快照](file:///Users/bytedance/AD-Creativity/backend/app/services/subtitle_translation.py#L1300-L1319)；[mixed](file:///tmp/subtitle-render-mode-crf16-task5/output/fallback-mixed.json)、[text](file:///tmp/subtitle-render-mode-crf16-task5/output/fallback-text.json) 离线失败证据。 |
| 14. 模式幂等身份 | 通过 | [任务身份](file:///Users/bytedance/AD-Creativity/backend/app/services/subtitle_translation.py#L664-L685)，平台 `test_mode_identity_is_distinct_even_at_same_revision`。 |
| 15. 冻结及历史恢复 | 通过 | [仅未提交任务编译](file:///Users/bytedance/AD-Creativity/backend/app/services/subtitle_translation.py#L1212-L1236)、[旧快照升级](file:///Users/bytedance/AD-Creativity/backend/app/services/subtitle_translation.py#L1372-L1419)；本轮 historical_provider_poll 用例通过，无重新编译/补探/提交/造假新 metadata。 |
| 16. 晚到保护 | 通过 | 平台 `test_mode_guard_prevents_late_writeback_and_stale_retry`、`test_mode_change_during_poll_keeps_success_history_only`、`test_queued_render_executes_frozen_mode_after_switch`；前端 `test` 覆盖冲突及晚到预览；前次源代码回归通过。 |
| 17. 摘要与历史 metadata | 通过 | [结果优先、有效快照兜底](file:///Users/bytedance/AD-Creativity/frontend/lib/subtitle-translation.ts#L30-L56)、[仅复制存在的冻结 metadata](file:///Users/bytedance/AD-Creativity/backend/app/services/subtitle_translation_media.py#L286-L310)；本轮 21 项前端覆盖 running/failed 的 text/mixed 与无字段“历史参数”，12 项后端含真实 store 路径的历史 metadata 验证。 |
| 18. 安全日志 | 通过 | [平台白名单](file:///Users/bytedance/AD-Creativity/backend/app/core/logging.py#L54-L58)、[安全日志回归](file:///Users/bytedance/AD-Creativity/backend/tests/test_structured_logging.py#L115-L169)，共享 `test_submitted_event_and_logging_whitelist_include_safe_render_contract`；前次后端源代码回归通过，新增路径无模型原文或签名 URL 输出。 |
| 19. 发布回归及前端标准检查 | 通过 | 最终隔离及本地共享包各 842 passed，安装包平台 18 模块 826 passed，两个 verifier 各 481 用例；对应 final XML 与 verification-final 报告。前端 144 为父任务报告，浏览器 final-report.json 确认清理后标准 lint/typecheck 退出 0。 |
| 20. Playwright 六场景 | 通过 | results.json 六项通过，无溢出、无真实计费；final-report.md/json 确认缓存边界修正、mobile creator 外部缓存重测、配置精确恢复及端口清理，原有 `.next` 和 3000/8000 保留。 |
| 21. 第 29 秒度量 | 通过 | ordinary-png/text.json 三行实际字号 41/34/24，时间均 `[28500,32000]`，全文、字体 SHA/URL、度量与框一致；仅离线字体与 wire payload，不是实际成片。 |
| 22. 0.3.7 包/安装/保留 | 通过 | `rebuild-report.json` 为 sdist → wheel；verification-final 两报告验证 22 模块/49 非生成归档文件、requirements、安装一致性。wheel SHA `594956a82db00fd926cc3ac65c61fc79a2e3371da6a0c8d53250698e5b568e32`，sdist/exports SHA `e62749acd40dcc7d6b3518453e712152cf0e4a9e1f255266b70db24db65ef421`。原 SHA 快照及五个 egg-info 原件保留；59 条目含 27 个旧包产物通过。 |
| 23. 质量检查与运行时健康 | 通过 | 最终 Ruff、两仓库编译/diff、部署脚本离线测试通过；`pre-restart-check.json` 验证原 PID 35583 command/cwd 和即时零活动任务；`runtime-verification-final.json` 验证重启后 PID 57378、health 200、包 0.3.7 及 `.venv` 导入位置。 |
| 24. 操作与视觉边界 | 通过 | 本轮只做文档与离线测试；浏览器六项 `paid_calls=false`。未执行 commit/push/生产部署；未授权也未执行真实 PNG/Text 成片比较。 |

## 关闭条件

- [x] 已收到并复核任务 5 代理最终清理与标准前端检查成功证据，关闭检查点 20 和任务 5。
- [x] 已完成任务 6/9 重建、隔离及本地完整回归、安装包平台回归、安全运行时健康和保留检查，关闭检查点 19/22/23 及任务 6/9；spec/tasks/checklist 均已完成（离线范围）。
- 真实计费成片比较不属于上述关闭条件；后续项保留未勾选，不阻塞离线范围完成。

## 后续真实成片验收（需用户发起或明确授权）

- [ ] 同一底片与字幕分别压制 PNG 和 Text，确认实际方式及 codec，重点检查第 29 秒正文毛边、脚注可读性与文件大小。
