# 视频字幕翻译任务

- [x] 任务 1：建立工作区和阶段任务契约。
  - [x] 定义工作区、字幕草稿、样式覆盖、revision、失效规则和阶段响应 schema。
  - [x] 增加 `video_subtitle_translation` ToolTask 类型；实现工作区仓库、MySQL 迁移及内存仓库对应行为。
  - [x] 实现输入/语言/草稿更新、历史快照、幂等、active task 防晚到覆盖和中断阶段恢复规则。
  - [x] 验证 MySQL/内存仓库一致、revision 冲突、阶段隔离和现有工具任务兼容。

Task 1 evidence (2026-10-26): workspace parameterized tests 16 passed across memory
and SQL repository (SQLite fixture exercising MySQLRepository); independently authored
acceptance plus translation adapter tests brought the targeted run to 53 passed.
Existing tool-video route regression: 38 passed. No paid calls. Contract is in
`api-contract.md`; new table uses existing `init_database/create_all` and additive
migrations, with row lock plus persistence-version CAS for workspace/task transactions.
Live MySQL deployment/concurrency has not been run.

- [x] 任务 2：扩展 Seed 提取背景色。
  - [x] 扩展现有 prompt、JSON Schema、适配器和领域响应，输出 `background_color`，历史缺失兼容 null。
  - [x] 保留现有全画面、多行拆分、字号角色、block/line、Files API 与 2 FPS 行为。
  - [x] 背景色不可信时降级并提示，接入任务服务可复用的提取入口，不放开管理员实验路由。
  - [x] 验证正常/复杂背景、缺失/非法颜色和既有字幕定位回归。

Task 2 handoff (2026-10-26): backend integration `arun_6aded88681abfce5309545c8`;
acceptance `arun_6aded8c881abfce53095465e`.

- Reusable interface: import `VideoSubtitleGroundingService` from
  `backend.app.services.video_subtitle_grounding`; call
  `await service.extract(prepared, sampling_fps=2.0)` for a `VideoSubtitleGroundingResponse`.
- `prepared` is `PreparedRemoteVideo(path, mime_type, size_bytes, metadata)` from
  `backend.app.services.video_subtitle_grounding_media`, with `VideoDisplayMetadata`.
  Callers enforce asset permissions, safe preparation and input limits, and own local-file
  cleanup. The service shares Files cleanup, validation, safe errors and aggregate logging.
  Existing `run(VideoSubtitleGroundingRequest)` retains secure URL preparation.
- Valid scene backgrounds normalize to uppercase `#RRGGBB`. Missing, invalid and
  explicitly unknown colors become null with per-subtitle
  `warnings=["background_color_unavailable"]`; historical missing fields also get null
  and the warning. Completion logs count these in `style_fallback_counts.background_color`.
  Colors exclude glyphs/outlines and are not text colors or drawing backplates.
- Verification: all six grounding test modules passed, `193 passed, 1 skipped`.
  Paid smoke was explicitly disabled with `RUN_PAID_MODELARK_SMOKE=false`; no paid calls.
  Coverage includes bright/dark/unknown backgrounds, invalid types/hex, historical data,
  full-frame single-row blocks/roles, Files FPS/cleanup, borrowed-path extraction,
  cancellation/errors, HTTP serialization, admin gating and debug-log redaction.
- Ruff default and fatal checks (`E9,F63,F7,F82`) passed for the eight owned schema,
  adapter, validation, service and test files. Python compileall and `git diff --check`
  passed. Real model background-estimation quality remains unverified.
- Reproduce grounding regression from repository root:
  `PYTHONPATH="$PWD" RUN_PAID_MODELARK_SMOKE=false .venv/bin/python -m pytest backend/tests/test_*subtitle_grounding*.py -q --tb=short`.

- [x] 任务 3：实现双视频导入和阶段工具接口。
  - [x] 支持工具资产引用、本地上传和 HTTPS TOS URL 流式导入、转存、探测与清理。
  - [x] 核对现有上传设施容量，为本工具满足参考视频 512 MiB/600 秒边界。
  - [x] 实现工作区 CRUD、提取/翻译/压制阶段路由及现有任务查询/重试分发。
  - [x] 接入认证、Creator/Viewer 权限映射和资产可见性验证。
  - [x] 验证签名 URL、SSRF、旋转、时长差提示、资源访问、失败清理和日志脱敏。
  - Backend complete: dedicated raw-byte upload accepts 512 MiB and probes reference
    duration at 600s, without increasing other upload defaults. Nginx allows 2g.
    任务9已验证Next 512mb配置、专用raw stream route、声明长度/分块512MiB
    守卫及其他工具原上传上限不变。本次后端2174、前端1021全量及三视口Mock
    均通过，容量子项和整体据此勾选；未真实传输512MiB，不代表生产代理负载验证。

- [x] 任务 4：实现 Seed 分批翻译。
  - [x] 使用稳定 segment ID、目标语言和文字块上下文调用 `doubao-seed-evolving`，按 Token 预算分批。
  - [x] 按 ID 合并译文，保留位置/时间/样式，不执行字幕中的指令。
  - [x] 保存成功条目，对缺失、重复、未知 ID 和截断提供局部重试及人工补齐路径。
  - [x] 验证响应重排、多行分组、部分失败、语言切换失效和字幕关联准确性。

- [x] 任务 5：实现字号、颜色与 MediaKit 工程编译。
  - [x] 核对供应商文字元素的容量、锚点、位置/字号/字体字段和纯文本转义契约；确定明确支持边界。
  - [x] 复用支持目标语言的字体资源，以实际字体度量拟合 BBox 高度与单行译文宽度；输出估算/有效字号及警告。
  - [x] 实现背景亮度选黑/白字、未知颜色降级、用户覆盖、目标视频坐标映射与时间边界调整清单。
  - [x] 将无字幕视频和逐条 text 编译为多轨工程，支持同时出现的文字、音轨保留和合法帧率回退。
  - [x] 验证长德语、重音字符、缺字字体、横竖屏旋转、留边投影、同帧多标签、低对比与不静默截断。
  - 任务5实现与离线验证完成；不代表真实成片质量或供应商未公布容量已验证。详细证据、测试入口与主会话/验收交接见 `task5-validation.md`。
  - API 为 `compile_subtitle_project(segments, video) -> {project, layouts, warnings}`；`layouts` 已改为按 `segment_id` 索引的字典，解决任务7交接中提到的 list/`.get()` 不匹配。
  - 官方文档确认 transform 的显示区域/左上角位置、横排对齐和 `line_max_width=-1`；真实字形垂直锚点、特殊文本解释与非30FPS供应商支持仍未实渲验证。500条/每条4000字符只是工具边界，不是供应商容量保证。
  - 字体实际下载、Pillow测量与 `font_type` 使用同一固定版本思源文件URL及SHA-256；80项布局离线测试及相关回归通过，四模块最新合计138项。无计费调用。
  - 前端提交前应展示 `CAPACITY_NOTICE`；后端容量错误应保留可读说明。以上集成展示由对应所有权agent完成，供应商容量/锚点/转义综合证据清单保持未勾选。

- [x] 任务 6：执行压制并持久化成片。
  - [x] 冻结 revision 快照，复用 MediaKit 客户端提交、查询和恢复轮询，使用稳定 client token 防重复提交。
  - [x] 输出流式转存工具资产，成功后关联工作区、阶段任务及资产库。
  - [x] 实现失败/超时/转存失败的阶段重试、部分对象清理及晚到结果隔离。
  - [x] 验证重复点击、重启恢复、旧 revision、渲染失败和存储/数据库失败，确认不重跑提取和翻译。
  - Offline backend evidence: targeted suite 139 passed (2026-10-26). Concurrent
    transfers deduplicate output creation inside the repository transaction and
    delete losing uploads. Failed asset inserts clean objects; a durable asset
    survives workspace-link failure for retry/recovery. Cancellation waits for
    blocking uploads before object/local-file cleanup. No paid calls or live MySQL.

- [x] 任务 7：实现工具页面与宽屏校对窗口。
  - 前端已收尾（2026-10-26）：原 frontend agent 已关闭，本次只修复剩余字体、警告和契约展示；主体继续使用 `frontend/components/workspace/subtitle-translation/`。
  - Contract aligned to actual schema/routes: `reference_video_asset_id`, `clean_video_asset_id`, original `text`, `translation_status`, `style.font`, `stage_task_ids`, `expected_revision`; import/upload include `role=reference|clean`, dedicated raw-byte `/upload-video` supports 512 MiB. No backend/checklist edits by frontend agent.
  - 原交接中的 layouts list/ID map 与预压制测量问题已由后端任务5/10完成；本次复用 GET、PATCH、POST preview，无重写。此前三视口 Mock 证据见 validation.md；最终字体/文案改动后的浏览器复核交独立验收代理。
  - [x] 新增标签页、双视频导入/预览、语言选择、工作区历史和逐阶段状态/操作。
  - [x] 实现原文/译文对比、视频时间定位、BBox 和译文示意、逐条属性编辑/排除与警告展示。
  - [x] 实现保存 revision、冲突反馈、未保存关闭提示、局部翻译重试、当前结果失效和刷新恢复。
  - [x] 实现成片播放、放大、下载，保持 object-contain 和原生播放器控件可用。
  - [x] 验证只读权限、跨工作区切换、不同视口布局及现有工具标签页回归。

- [ ] 任务 8：完成系统验收。
  - 本次最终复核状态见 `final-validation.md`；后端全量2174通过、1个计费skip，
    TCP连接与尝试均0；前端独立全量1021通过、三视口6个Mock场景通过。
    字体CN/JP契约及日志守卫均已通过。第32项已分层记录证据，当前规格下整体仍不通过；
    主会话决定如实交付已完成实现及验证缺口，不请求再审批或付费调用。
  - [x] 运行后端定向测试及相关工具/字幕/MediaKit/RBAC 回归，使用正确 PYTHONPATH。
  - [x] 运行前端定向测试、TypeScript、lint 和 build；运行 Ruff 致命检查、Python 编译和 git diff --check。
  - [x] 使用 Mock Playwright 在 1440×900、834×1112、390×844 覆盖完整流程、刷新、部分失败、重试、冲突和权限。
  - [x] 逐项复核 checklist.md，记录供应商容量证据与真实验证状态；未授权不运行计费接口。
  - 自动化子项全部完成，清单42/43项通过；前端所有者最终定向84项及
    tsc/lint/build通过，本次不重复生成命令。仅供应商综合证据第32项仍未验证，
    不以Mock补足，不降低规格；任务8整体严格验收未通过。历史失败见validation.md。

- [x] 任务 9：修复验收发现的上传与日志问题。
  - [x] 核对 Next.js 同源代理 200 MB 限制，为本工具提供可用的 512 MiB 上传路径，保持其他工具的默认限制。
  - [x] 移除 API 客户端向本地调试服务发送完整 URL 的上报，避免签名参数进入普通调试通道。
  - [x] 验证上传链路容量配置与请求日志脱敏，复核相关验收项。
  - 前端定向复核通过：既有 `proxyClientMaxBodySize=512mb` 与专用 raw-byte 流式路由、声明长度/分块超限拒绝、Cookie/Origin/RBAC 转发与安全连接错误均通过。跨模块守卫确认普通上传图像20 MiB/视频200 MiB/音频50 MiB仍保持，不修改后端；未真实上传512 MiB。API 客户端认证/签名 URL 测试确认没有额外 telemetry fetch 或 console 输出。

- [x] 任务 10：补齐压制前的字号校对和容量提示。
  - [x] 在校对阶段提供使用实际字体测量的估算/有效字号与警告，不能等压制完成后才显示。
  - [x] 压制前展示供应商未公开容量上限及最终字形锚点/特殊文本解释未真实验证的边界；容量错误保留可读原因。
  - [x] 对齐前端预览与后端测量/提交的字体文件及版本，修复 SC/CN 资源差异；将内部警告码映射为可读提示。
  - [x] 使用 Mock 验证上述数据显示与错误反馈，不调用计费接口。
  - Backend delivered: actual-font measurements run in worker threads for detail
    GET, successful PATCH and independent POST `/workspaces/{id}/preview`.
    Preview accepts the PATCH schema and never changes revision/history. Missing
    translations, font download errors and individual layout errors preserve
    editable drafts and null unavailable sizes, with safe warnings.
  - Responses expose `font_type` and `font_sha256` from the same compiler used
    for submission. Backend uses pinned CN/JP resources; frontend CN/JP alignment
    and readable warnings are complete and independently verified in full/browser.
  - CAPACITY_NOTICE is present before rendering and retained in capacity task
    errors plus `failure_reason`. Offline tests include real FreeType measurement
    with mocked font HTTP, worker-thread verification, unsaved preview, revision
    conflicts, mixed failures and safe fallback. API handoff: `api-contract.md`.
  - 前端完成：SY_Black 与 backend FONT_RESOURCES 完全一致，固定 revision `a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2` 的 `CN/SourceHanSansCN-Regular.otf`，字体选项使用中文标签。预览优先使用响应的实际 `font_type`，包含后端缺字回退；属性详情展示实际字体 URL/SHA-256，编辑后清空旧测量与字体摘要。
  - warning 映射成中文操作提示，包含 `layout_preview:*` 与片段前缀；保留原响应 codes 与 `data-warning-code`，不改后台数据。删除重复英文 CAPACITY_NOTICE 和原始 provider 码展示，仅保留明确的中文容量/字形/转义未实渲边界；容量失败显示中文原因并保留草稿。

### 任务7/9/10前端完成证据与最终交接

- 2026-10-26 最终定向命令（frontend）：`npm test -- tests/subtitle-translation*.test.* tests/tools-workspace.test.tsx tests/next-config.test.mjs`，6文件84项全部通过：字幕UI24、API5、字体跨模块契约1、上传5、原工具45、Next配置4。新增 GET/PATCH/preview 测量与 URL/SHA 显示、字体回退、元数据失效、中文warning/容量错误、普通backend上传上限守卫。
- `npm run typecheck`、`npm run lint`、`NEXT_TELEMETRY_DISABLED=1 NEXT_DIST_DIR=.next-subtitle-close npm run build` 全通过，`git diff --check` 通过。本次隔离构建新增的两项 tsconfig include 已清理；`NEXT_DIST_DIR=.next npx next typegen` 恢复运行前的标准 next-env 引用，清理后 typecheck 再次通过，保留其他既有 dirty。
- 仅完成前端实现与定向证据，不代表系统最终验收通过。任务8/11与 checklist 均不代为勾选；任务3交由原负责方依据本节容量证据收尾。
- 最终验收代理 `arun_6adedfc981abfce530954d41` 负责独立 full/browser 与 final-validation/checklist；本代理未跑全量/Playwright，未修改后端或验收清单，无付费调用、提交或部署。
- 浏览器交接：原始英文notice/provider码/font_size_small文本断言应改为中文提示；原始codes仍可用 `data-warning-code` 检查。复核三视口、实际字体回退、字号/URL/SHA、保存/未保存preview/revision及无debug请求，不访问真实字体/计费服务。真实供应商容量、字形锚点与特殊文本解释仍未验证，不能用Mock替代。

- [x] 任务 11：修复后端日志守卫并完成最终复核。
  - [x] 移除 `aigc_gateway.py` 中向本地 7777 服务发送数据的调试上报，保留既有 TLS-only 模型原文通道。
  - [x] 验证日志守卫和字幕服务初始化失败清理，不排除失败用例。
  - [x] 在任务 9、10、11 修复完成后复跑必要回归，更新最终验收证据。
  - 最终证据见 `final-validation.md`：任务9/10已完成；无排除后端2174通过、
    1个禁用计费skip，TCP连接/尝试均0；最终前端1021通过，三视口6场景通过。
    所有者最终84项定向、tsc/lint/build和本次Ruff致命/编译/diff通过。
    第三项与整体据所有授权修复最终复核通过勾选；不意味着供应商第32项已验证。
  - 前两项证据（2026-10-26）：gateway/structured logging/main/字幕初始化清理及
    字幕适配器六模块离线 `198 passed`；既有 ModelArk TLS-only 日志另行 `6 passed`。
    无排除，TCP 连接及尝试均为 0；全 backend Ruff 致命检查、编译和 diff 检查通过。
    实际守卫名、复现命令及默认 Ruff 既存问题见 `backend-validation.md` 任务 11 节。
    该修复代理未触碰前端或清理实现；第三项已由最终验证代理完成上述系统复核。

## 依赖与并行

- 任务 1、任务 2 可并行。
- 任务 3 依赖任务 1；提取接入依赖任务 2。
- 任务 4 依赖任务 1，可与任务 2、任务 3 并行。
- 任务 5 依赖任务 1，可与任务 2、任务 3、任务 4 并行。
- 任务 6 依赖任务 3、任务 5。
- 任务 7 在任务 1 契约完成后可并行开发，最终联调依赖任务 2 至任务 6。
- 任务 8 依赖任务 1 至任务 7。
- 实施及验收按 Spec 模式要求委派专门子代理；每项完成后更新复选框。
