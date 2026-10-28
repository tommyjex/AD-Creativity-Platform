# 视频字幕翻译系统验收记录

验收日期：2026-10-26。任务 8 负责人独立核验；实施已批准，无需再次审批。

## 当前状态

最终复核完成，完整当前证据见 `final-validation.md`：

- 后端无排除全量2174通过、1个禁用计费skip，TCP连接与尝试均0；日志守卫与初始化清理通过。
- 前端独立全量83文件1021通过，含CN/JP同字体契约及中文warnings；
  前端所有者最终定向84项、tsc/lint/build通过，本次按主会话要求不重复生成命令。
- 最终三视口6个Mock场景通过，未知API/外部请求/debug均0；辅助服务已停止。
- Ruff致命、编译、脚本编译及diff通过；任务3/7/9/10/11完成，任务8自动化子项完成。
- 清单42/43项通过，仅供应商综合第32项未验证，任务8整体严格验收仍未通过。
  Mock不能证明真实容量、vertical glyph anchor或literal grammar；不再请求审批或付费调用。

## 历史状态

以下完整保留上轮失败、修复交接和测试细节，不覆盖上述最终结论。

- 最新独立复跑：后端字幕翻译八模块 `215 passed, 2 warnings`，包含初始化
  失败清理守卫、实际 FastAPI preview 和双仓储；TCP 允许连接及尝试均为 0。
- 第三轮 Mock Playwright 六个场景通过：每档 Creator 68 次、Viewer 8 次业务
  请求；未知 API/外部访问和 debug 均为 0。计算排版、保存冲突/刷新、局部重试、
  render 重试、结果隔离、Viewer 和旧标签页回归通过；辅助服务全部停止。
- 最新 `typecheck`、`lint`、独立 `.next-subtitle-build` 构建、全 backend Ruff
  致命检查和 compileall 通过。前端定向 `75 passed, 1 failed`，字体契约仍失败。
- 最新首轮全前端 `1015 passed, 2 failed`：字体 SC/CN 不一致与 Next 代理旧
  200 MB 预期。任务9已把代理改为512 MB，验收仅更新旧测试预期；第二轮
  `1016 passed, 1 failed`（83文件），仅字体契约失败，不能宣称全前端通过。
- 初始化失败清理产品修复已落盘，并由独立测试验证 runtime.stop、
  TLS detach/aclose 各执行一次；下述历史失败记录保留用于追踪。
- 最新相关后端12文件 `328 passed, 7 warnings`，包含字幕定位、工具资产/视频、
  MediaKit多轨、RBAC、认证、生命周期和数据库；TCP允许连接及尝试均为0。
- 全后端完成：`2168 passed, 2 failed, 1 skipped, 44 warnings`，
  TCP允许连接及尝试均为0。两项失败为既有gateway日志守卫及修复前加载的
  初始化清理逻辑；当前代码复核后初始化清理已通过，日志守卫仍失败。
- 清单43项已逐项复核：39项以代码/离线测试/Mock证据通过，4项保持未勾选：
  第32项供应商综合契约、第38项日志、第39项后端整体质量、第40项前端整体质量。
  任务8仅定向/相关回归、Mock浏览器及证据复核子项完成，整体未完成。
- 当前明确修复责任交接：后端产品代理处理gateway四处7777上报；
  前端产品代理对齐SY_Black的CN固定版本资源、中文warning映射并删除重复英文
  CAPACITY提示。验收不替代实现；修复后须重新全量回归、静态检查和三视口流程。
- 当前初始化清理与结构化日志模块联合复核：`10 passed, 1 failed, 1 warning`，
  唯一失败明确为 `services/aigc_gateway.py:127.0.0.1:7777`。
  验收仅改守卫诊断为违规文件/标记列表，不再打印完整拼接源码，不削弱检查。

以下准备/实施期间记录为历史基线，不覆盖上述最新结果：

- 准备阶段：已读取 spec.md、tasks.md、checklist.md、现有字幕定位与尾帧验收资料。
- 实现代理仍运行，最终验收须在任务 1 至 7 稳定后执行。
- 任务 2 已独立复核，对应 checklist 第 8 至 12 项通过；任务 8 尚未通过。
- 任务 1、2、5 已交接；任务 3、4、6、7 与主代理新增的任务 9、10 仍实施中。
- 三档 Mock 浏览器流程已完成一次通过；任务 9/10 修复稳定后必须重新执行。
- 仅允许编辑验收脚本、测试和记录。产品问题报告主代理分配修复。
- 大量无关未提交改动保留，不回滚、不提交或部署。
- 当前工具未暴露 send_message，协作计划通过会话同步，无法直接查询其他代理状态。

## 安全边界

- 普通验收不调用真实 ModelArk、MediaKit 或 TOS。
- `scripts/verify-subtitle-translation-offline.py` 显式关闭付费冒烟与 TLS 发送，并在 pytest 进程内阻断 IPv4/IPv6 TCP 连接；报告阻断次数，不输出地址或字幕原文。
- 浏览器验收须 Mock 所有业务 API，并拒绝非本地请求和未声明的 API；禁止将未匹配请求透传到真实后端。
- 模型原文仅允许既有 TLS-only 通道；Mock 不能证明真实模型识别质量或最终渲染质量。
- 历史规格中的真实字幕定位冒烟不作为本功能翻译、背景色或压制的真实证据。

## 测试入口

根目录后端：

```bash
PYTHONPATH=.:backend .venv/bin/python scripts/verify-subtitle-translation-offline.py backend/tests/test_subtitle_translation*.py -q
PYTHONPATH=.:backend .venv/bin/python scripts/verify-subtitle-translation-offline.py backend/tests/test_video_subtitle_grounding*.py backend/tests/test_modelark_video_subtitle_grounding.py backend/tests/test_tool*.py backend/tests/test_mediakit*.py backend/tests/test_role_permissions.py backend/tests/test_auth_api.py -q
.venv/bin/ruff check backend --select E9,F63,F7,F82
.venv/bin/python -m compileall -q backend/app backend/tests
git diff --check
```

前端目录：

```bash
npm run test -- tests/subtitle-translation*.test.* tests/tools-workspace.test.tsx
npm run typecheck
npm run lint
npm run build
```

Playwright：1440x900、834x1112、390x844，覆盖导入、提取、局部翻译失败与重试、
校对、保存、刷新、冲突、压制、结果、工作区切换、Viewer 只读和旧工具回归。
脚本：`scripts/verify-subtitle-translation-browser.py`。根目录复现：

```bash
.venv/bin/python /Users/bytedance/.trae-cn/skills/webapp-testing/scripts/with_server.py --server '.venv/bin/python scripts/verify-subtitle-translation-browser.py --serve-fixture' --port 8058 --server 'env BACKEND_INTERNAL_BASE_URL=http://127.0.0.1:8058 NEXT_DIST_DIR=.next-subtitle-acceptance npm --prefix frontend run dev -- --webpack --hostname 127.0.0.1 --port 3058' --port 3058 --timeout 120 -- .venv/bin/python scripts/verify-subtitle-translation-browser.py
```

SSR fixture 只响应工具初始资产/任务；浏览器全面拦截业务 API，未知 API 直接失败，
不透传。预览字体使用本地 OFL ABeeZee 测试夹具，不访问公开字体服务器。
已有本地 7777 调试发送被拦截并单独计数；任务 9 移除后该计数应为 0。
截图在 `browser-acceptance/`，全部是 Mock 内容，不是 Seed/MediaKit 产物。

## 执行结果

实现期间基线（不代替最终稳定后的复跑）：

- 后端字幕定位、工具资产/视频、MediaKit、RBAC 与认证 12 文件：
  `305 passed, 7 warnings`，`blocked_tcp_attempts=0`。
- 前端 `tools-workspace.test.tsx` 与
  `aigc-video-subtitle-extraction-contract.test.ts`：2 文件、50 项通过。
- 独立新增 `backend/tests/test_subtitle_translation_acceptance.py`：
  `20 passed, 1 warning`，`blocked_tcp_attempts=0`。覆盖内存/SQL 仓储读取和历史副本隔离、
  工作区/任务原子提交与缺失资产回滚、稳定 ID 唯一性、控制字符、数据/样式分离和八种语言。
- 2026-10-26 schema 关注点增量核验：该文件现为 `32 passed, 1 warning`，
  `blocked_tcp_attempts=0`。继承字段重定义后，背景色格式校验及 null fallback warning
  均仍生效，序列化重建不重复 warning；provider 非法背景色的可恢复降级发生在
  grounding validation 层，不是任意 PATCH 输入的宽松转换。
- PATCH 双仓储实测：用户改写 `text` 被拒绝，revision、当前原文及历史均不变；
  修改 `translated_text` 可正常保存并继续保留原文。500 个不同稳定 ID 字幕
  可完整保存，501 个在 PATCH schema 层拒绝。没有据此推断模型实际能提取
  500 条或 MediaKit 能处理 500 个文字元素；实际提取质量及供应商容量仍未真实验证。
- 独立验收新增 HTTP 原文保护与 14 项匿名/Viewer 写路由测试后：
  `47 passed, 1 warning`，TCP 允许连接 0、阻断尝试 0。401/403 均发生在执行依赖之前。
- 当前翻译工作区、布局、独立验收与 Seed 翻译适配器合计：
  `148 passed, 1 warning`，`blocked_tcp_attempts=0`。
- 字幕定位、工具资产/视频、MediaKit、RBAC 和认证相关回归：
  `361 passed, 7 warnings`，`blocked_tcp_attempts=0`。
- 前端四个定向文件：`69 passed`。修复了两项测试夹具/预期：
  raw upload 使用共享客户端既有 `same-origin` 默认凭据；Node Request 输入改为
  `Uint8Array`，避免 JSDOM Blob 被字符串化。未修改产品认证或上传逻辑。
- `npm run typecheck`、`npm run lint` 通过；独立 `.next-subtitle-build` 生产构建通过。
  Ruff 全 backend 致命检查通过。以上仍需任务 9/10 完成后复跑。
- 全量前端正在运行；新增字体跨模块契约测试确认 SC/CN 字体资源不一致，未通过。
- 全量后端第一次因实施中的媒体测试引用不存在的 `AssetRole.PRIVATE` 导致收集失败；
  实现代理已改为 `INTERNAL_BASE`，独立全量复跑正在进行。首次收集错误不计为通过。
- 全量前端完成：`1010 passed, 1 failed`，83 文件；唯一失败为已报告的 SC/CN
  字体契约。其余 82 文件通过，但整体不能称通过。
- 全量后端完成：`2126 passed, 12 failed, 1 skipped, 41 warnings`；
  TCP 允许连接 0、阻断尝试 0。失败涉及新表未加入旧测试断言、生命周期测试缺失
  新增 recovery 仓储依赖、既有后端 7777 日志守卫及实施中的媒体竞争测试。
  本验收只修改数据库预期表集合和生命周期离线依赖夹具；媒体竞争清理由实现代理修复。
- 上述夹具修复后，数据库/生命周期、媒体、阶段执行、预览和路由 6 文件定向复跑：
  `85 passed, 4 warnings`，`blocked_tcp_attempts=0`。Pydantic 有两项 list→tuple
  序列化提示，不影响 HTTP 返回契约；最终状态还需静态和全量复跑。
- 任务 10 独立实际路由验证：`test_subtitle_translation_preview.py` 用真实 FastAPI
  GET、PATCH、POST `/preview`，真实 Pillow/FreeType、Mock 字体 HTTP、内存与
  SQL 仓储运行。验证预压制估算/有效字号、worker thread、GET/unsaved preview
  不修改持久化/history/revision、长译文缩字、409、未译条目/单条布局失败可恢复、
  字体失败安全降级、原文/稳定 ID 防篡改以及 capacity notice；未请求 MediaKit。
- 新增初始化失败清理独立测试已复现产品缺陷：
  `test_subtitle_initialization_failure_closes_started_runtime_and_tls` 失败，
  `runtime.stops=0`（应为 1）；修复已报告主代理，不能据 85 项通过宣称生命周期全通过。

三视口 Mock 浏览器首轮全部通过：

| 视口 | Creator | Viewer | 业务 API 请求 | 已拦截既有调试请求 |
| --- | --- | --- | --- | --- |
| 1440x900 | 通过 | 通过 | 65 / 7 | 4 / 2 |
| 834x1112 | 通过 | 通过 | 65 / 7 | 4 / 2 |
| 390x844 | 通过 | 通过 | 65 / 7 | 4 / 2 |

覆盖：工具资产引用、参考视频 URL 导入、无字幕视频本地上传、提取、局部翻译失败、
只提交缺失稳定 ID 重试且保留成功译文、原文/译文编辑、未保存关闭提示、保存、
409 保留本地草稿、远端重载与页面刷新、压制失败后仅重试 render、成片播放/放大/
下载链接、工作区切换不显示旧成片、语言切换失效、Viewer 无写请求、旧工具标签页。
检查页面无水平溢出、视频 `object-fit: contain` 和原生 `controls`。
该流程 Mock 的是业务状态变化，不能代替真实后端阶段/存储测试或实际供应商质量。
任务 10 的压制前测量尚未完成，本轮未证明校对中的字号已由后端实际测量。

任务 9/10 落盘后第二轮三视口全部通过：Creator 每档 68 请求、Viewer 每档 8 请求，
未知 API/外部访问为 0，本地 debug 请求为 0。新增断言包含压制前中文支持边界、
“计算排版 · 不保存”后的估算 32/有效 24 显示、Mock 持久化草稿不变、未保存状态
仍保留、Viewer 禁用计算、Dialog 本体无水平溢出。字号数字来自 Mock 业务响应，
真实后端端点度量的证据是上述 preview suite，而不是 Mock 数字。
字体/中文 warning 文案修复后仍需最后一次复跑。

任务 2 独立复跑：

```bash
PYTHONPATH=.:backend .venv/bin/python scripts/verify-subtitle-translation-offline.py backend/tests/test_*subtitle_grounding*.py -q --tb=short
```

- `193 passed, 1 skipped, 4 warnings`；付费冒烟显式关闭，TCP 允许连接 0、阻断尝试 0。
- Task 2 八个所属文件 Ruff `E9,F63,F7,F82` 通过；四个实现文件 compileall 通过；
  当前工作树 `git diff --check` 通过。
- `VideoSubtitleGroundingService.extract(prepared, sampling_fps=2.0)` 复用适配器、
  校验及 TLS-only 原文通道，不接管调用者临时文件清理。权限与准备由工具调用方负责，
  后续联调仍需核验实际调用路径。

## 清单证据

最终勾选状态以 `checklist.md` 和本节为准；后续表格保留实施期间分项追踪历史：

| 清单项 | 最终独立复核 |
| --- | --- |
| 1–31、33–37、41–43 | 已通过代码/离线测试/Mock证据；不代表真实Seed、MediaKit、TOS或MySQL验证 |
| 32 | 未通过：官方未公开text/track容量，真实字形垂直锚点及特殊文本解释未验证 |
| 38 | 未通过：新字幕适配器TLS-only测试通过，但既有gateway debug依赖守卫仍失败 |
| 39 | 未通过：定向215项、相关328项及静态通过，完整后端运行仍有失败；不拼接定向结果冒充全量通过 |
| 40 | 未通过：定向75项/全量1016项通过，SC/CN字体契约失败；tsc/lint/build通过不代替契约 |

| 清单项 | 结论 | 代码与测试证据 |
| --- | --- | --- |
| 8：模型/Files/默认 2 FPS | 提取服务契约通过，工具联调待后端完成 | `schemas/video_subtitle_grounding.py` 常量；`services/modelark_video_subtitle_grounding.py` `_upload`；`services/video_subtitle_grounding.py:extract`；`test_request_defaults_sampling_fps_and_accepts_boundaries` 与适配器上传测试 |
| 9：全画面/视觉行/排除非目标文字 | prompt 与解析契约通过；真实识别质量未验证 | `VIDEO_SUBTITLE_GROUNDING_PROMPT` 明确标题、标签、脚注、排除 Logo/印刷文字及逐视觉行；适配器 schema 测试与四角色/多块校验测试 |
| 10：位置、时间、样式与分组保留 | 通过 | `video_subtitle_grounding_validation.py` 保持原有安全校验、`_normalize_style`；定位验证回归及同帧 headline/body/footnote 多块测试 |
| 11：背景色语义与历史兼容 | 通过 | prompt 排除字形/描边，schema required 且可 null；`test_prompt_estimates_scene_background_excluding_text_and_outlines`、历史缺失响应测试 |
| 12：无效颜色可恢复降级 | 通过 | `_normalize_background_color` 校验并 uppercase；领域响应补 `background_color_unavailable`；缺失、null、非法类型/hex 和 HTTP 序列化参数测试 |

其余逐项核验状态（最终修复后复跑仍待完成）：

| 清单项 | 当前结论 | 证据或未通过原因 |
| --- | --- | --- |
| 1：新入口/旧工具 | Mock UI 通过，最终复跑待任务 9/10 | 三视口 tab 切换；45 个既有 tools 测试 |
| 2：双视频分工/先翻译 | 代码/Mock 通过，联调待稳定 | 独立输入组件、extract 仅要求参考资产，translate 不要求 clean |
| 3：三种导入 | 当前代码齐全，后端媒体定向待复跑 | 每种角色都有资产 select、file、URL；三视口覆盖引用/URL/file 各一条 |
| 4：安全导入 | 待媒体测试最终通过 | 复用 SecureRemoteVideoDownloader 与路径探测/转存/finally 清理 |
| 5：512 MiB/600 秒 | 任务 9 修复后验收 | 专用 Next raw stream 路由已落盘，4 个代理单测通过；不增大普通工具上限；未真传 512 MiB |
| 6：方向/时长/帧率 | UI 代码可见，媒体测试待最终复跑 | 两份 metadata 显示；时长 >250 ms 警告；路径 FFprobe |
| 7：时间越界处理 | compiler 测试通过，UI 调整清单可见 | layout clipping/all-outside tests；workspace submit 无 renderable 条目拒绝 |
| 13：原文/译文/样式分离 | 通过 | 47 个独立验收含继承 fallback、HTTP 及双仓储原文保护 |
| 14：实际字体度量字号 | compiler 离线测试通过 | real FreeType ascent/descent、宽度/overhang、整数复测；不代表供应商真实像素 |
| 15：长译文/校对字号 | 后端实际 preview 与第二轮 Mock 通过，最终联调待文案/字体修复 | GET/PATCH/POST preview 的 FreeType 测量及长译文测试；计算排版显示估算/有效字号 |
| 16：同帧多行独立排版 | compiler/预览契约通过 | deterministic interval packing、多标签测试；preview 按 segment BBox 独立映射 |
| 17：线性 sRGB/颜色降级 | 通过 | layout contrast/alpha composite/unknown background tests |
| 18：用户覆盖/仅警告 | 通过 | schema 样式独立、时间/BBox 编辑；layout override/small font/low contrast tests |
| 19：测量/渲染同字体 | 后端编译器已通过；预览另有缺陷 | 下载测量 bytes 与 wire font URL/SHA 一致；frontend SY_Black 为 SC、backend 为 CN 的预览契约测试失败，已报告主代理，前端质量项不勾选 |
| 20：八语言 | 通过 | schema 八语言参数测试与 frontend language options |
| 21：分批/上下文/ID | 通过 | 5 个 ModelArk adapter 离线测试；字节估算 Token 预算、同块及相邻 context-only |
| 22：重排/截断/局部重试 | 通过 | adapter 重排/重复/未知 ID/截断/后批失败 tests，三视口只重试 line-2 |
| 23：完整校对数据 | 第二轮 Mock 与 actual endpoint 通过，最终复跑待修复 | 对照/编辑/警告、色样；preview 实际度量，UI 计算后显示 |
| 24：定位/投影/原生控件 | Mock UI/单测通过，最终复跑待修复 | containedVideoRect、seek/seekRequest、pointer-events-none；三视口 controls/contain |
| 25：revision/刷新/关闭 | Mock UI 通过，最终复跑待修复 | 409 保留本地草稿、confirm reload、refresh persisted text、未保存关闭路径 |
| 26：工作区/任务持久化 | 通过（非生产 MySQL） | 双仓储副本/历史/原子性 tests，SQL fixture 使用 SQLite 运行 MySQLRepository |
| 27：精确失效 | 通过 | workspace reference/language/clean/edit invalidation 与 unaffected extraction rebase tests |
| 28：幂等/旧结果隔离 | 通过 | 同 revision 同操作复用、重复 retry、stale active/revision writeback tests |
| 29：重启恢复 | 离线契约通过 | model stage 中断失败、已提交 render schedule/poll 恢复 workspace tests |
| 30：底层视频/音轨/方向/FPS | compiler/本地客户端契约通过 | clean video track 0、audio、display rotation、24/25/30/50/60 tests；真实成片未验证 |
| 31：逐条 text/非拉伸 | compiler 契约通过 | font_size、extra transform、单行 literal、same-frame packing tests |
| 32：供应商容量/锚点/转义 | **未完成，保持未勾选** | 官方无 text/track 数字上限；vertical glyph anchor 和 literal grammar 不完整，未真实 render |
| 33：token/冻结快照 | workspace 测试通过，任务 6 最终验收待完成 | revision/snapshot/idempotency tests；已提交 provider ID 的恢复/转存重试待服务测试 |
| 34：转存与关联/清理 | 新媒体/执行定向通过，最终全量待修复 | 85 项包含 concurrent loser-object cleanup、上传/DB/转存/关联失败及 provider retry/recovery |
| 35：成片/资产库/隔离 | Mock UI 通过，后端转存联调待完成 | 三视口 output/放大/download=1/切换工作区；asset library 既有回归正在运行 |
| 36：新路由 RBAC | 通过 | 14 个新路径匿名/Viewer 用例；HTTP 管理员 PATCH 原文保护；通用 guard 支持 Creator |
| 37：资产可见性/实验权限 | 新媒体/路由定向通过 | validate_video_asset 拒绝 project/internal/nonvideo/failure；new route visibility test 与 grounding admin regression |
| 38：TLS/原文/脱敏 | 任务 9 修复后复跑 | 主代理已分配 7777 debug URL 问题；adapter raw emit_tls_only_event，ordinary aggregate logs |
| 39：后端/静态质量 | 未通过，待产品修复后复跑 | full backend 2126 pass/12 fail；夹具修复后定向85通过，但新增初始化失败清理守卫仍失败；compile/diff通过 |
| 40：前端/质量 | 尚未最终通过 | 四文件 69、tsc/lint/build 通过；字体契约 fail，完整修复后复跑 |
| 41：三视口 Mock | 第二轮通过，最终文案/字体变更后再复跑 | 6 个 Creator/Viewer 场景，增加 task10 preview 与 debug=0；无水平溢出，不作为真实质量证据 |
| 42：无计费/真实边界 | 通过 | Python TCP 闸门、paid smoke false，浏览器全 API/字体 Mock；本记录明确未真实验证 |
| 43：旧工具/实验/多轨/资产 | 相关回归通过，全量回归待完成 | 361 后端相关回归、45 tools；全量测试不能在未结束或失败时称通过 |

## 待主代理处理的风险

- `frontend/next.config.mjs` 的 `proxyClientMaxBodySize="200mb"` 与本工具 512 MiB
  同源上传上限有潜在不一致，需核验上传路径与代理行为后处理。
- `frontend/lib/api-client.ts` 存在既有 `127.0.0.1:7777/event` 调试上报，
  请求 URL（含查询参数）被发送到本地服务，存在普通日志/调试通道泄漏风险。
  此为产品代码，不由验收代理修改；需主代理分配移除或按规范脱敏。
- 主代理已新增任务 9 处理上述上传代理/debug，任务 10 处理压制前字号和容量提示；
  本验收仅在修复后独立复跑，不代替产品实现。
- 确认字体契约不一致：前端 `SUBTITLE_FONTS.SY_Black` 使用
  `SC/SourceHanSansSC-Regular.otf`，后端 `FONT_RESOURCES.SY_Black` 使用
  `CN/SourceHanSansCN-Regular.otf`。需前端 agent 对齐版本和具体文件；
  `frontend/tests/subtitle-translation-font-contract.test.ts` 为跨模块守卫。
- 确认字幕恢复生命周期清理缺陷：`backend/app/main.py` 中
  `initialize_subtitle_translation_service` 位于 `await runtime.start()` 后，
  但在保护 `yield` 的 try/finally 之前。初始化/依赖解析抛错会留下已启动 runtime
  和 TLS sink；独立失败注入测试确认 `runtime.stop` 未调用。
  请求主代理分配后端 agent 将初始化/恢复纳入启动失败与关闭清理路径，并验证
  runtime.stop、TLS detach/aclose、service discard 在各失败点正确执行。
- 全量 logging 守卫仍因既有 `backend/app/services/aigc_gateway.py` 的
  4 处 `127.0.0.1:7777/event` 上报失败。虽不是本验收新增代码，也不能跳过守卫
  后宣称全量通过；需主代理按当前日志规范分配处理，验收不修改 gateway 产品代码。

## 供应商契约

布局代理证据：`task5-validation.md`，官方 API
https://docs.volcengine.com/docs/6448/2673861 与用法
https://docs.volcengine.com/docs/6448/2673939。文档确认 text 的 `font_size` 整数像素、
font URL、RGBA、`extra` transform 左上角 display region、横排对齐、
`line_max_width=-1`、轨道时间互斥及视频源音轨规则。

未公布 text 字符/元素或通用 track 最大容量。500 条、每条译文 4000 字符是应用草稿
边界，201 个同时 text 可编译成 202 轨不是供应商能接受该规模的证明。
文档未明确字形 vertical anchor/baseline/padding 与特殊文本 literal grammar；
JSON roundtrip/Pillow/Mock 都不证明供应商实际解释或字形位置。
供应商 guide 的十条 subtitle 文件轨限制不能机械套用到本工具的 text 元素。
30 FPS 为官方示例；24/25/50/60 目前是本地 adapter enum 契约，不是独立实渲证据。
首轮浏览器截图已看到压制提交前的 500/4000 及供应商容量/锚点/特殊文本未验证提示；
任务 9/10 完成后还会加入断言复跑。综合清单第 32 项不勾选。

## 构建生成文件

独立 dev/build 生成了 `next-env.d.ts` 的 dist-dir 导入和 `tsconfig.json` 的
`.next-subtitle-acceptance`/`.next-subtitle-build` include。这些是 Next 自动生成，
不是扩大类型配置的设计变更。首轮服务/构建停止后已只移除本次四个 include，
`git diff -- frontend/tsconfig.json` 为空。清理前另一轮构建已把 `next-env.d.ts`
改为标准 `.next/types`，本验收未覆盖该改动。后续独立 dev 可能再生成本次目录引用，
最后停服后再仅清理本次引用；保留已有其他 acceptance/tmp include，不回滚其他代理或用户改动。

第三轮服务/构建均已结束。已仅移除本次四个subtitle dist include，
`git diff -- frontend/tsconfig.json`为空；通过标准`NEXT_DIST_DIR=.next next typegen`
重建next-env默认目录引用，未留下独立验收目录导入。清理后typecheck通过。

## 未真实验证

- 本轮真实 Seed 提取、背景色识别与翻译质量。
- 真实供应商德语/中文/日文字形、锚点和位置的最终渲染。
- 真实 MediaKit 容量、渲染轮询、云存储转存与生产 MySQL 部署。
