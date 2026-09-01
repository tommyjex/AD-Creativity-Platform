# Tasks

- [x] Task 1: 建立共享 Seedance 能力矩阵与 AIGC 视频契约。
  - [x] SubTask 1.1: 将四个 Seedance 模型的白名单、显示名、参考素材上限、分辨率、宽高比和时长校验提取为工具页与 AIGC 共用的单一数据源，保持现有工具 API 兼容。
  - [x] SubTask 1.2: 扩展后端 Pydantic 与前端 TypeScript 契约，新增 `video_input`、`audio_input`、`video_generation`、`video_output`、`video_asset`、`audio_asset` 和 `VIDEO_GENERATION` task type。
  - [x] SubTask 1.3: 定义生视频节点四种生成模式、配置默认值、模式化端口、模型参数收敛规则及有声/无声开关。
  - [x] SubTask 1.4: 更新前后端节点注册表，同时保持 `schemaVersion=1` 旧画布兼容。

- [x] Task 2: 扩展 DAG 校验、执行快照与缓存语义。
  - [x] SubTask 2.1: 扩展强类型连线校验，支持视频和音频端口，并按生成模式校验必填、禁用及互斥端口。
  - [x] SubTask 2.2: 按模型校验多参考素材数量：2.5 为 30/10/10，2.0 系列为 9/3/3；拒绝 2.0 系列仅音频输入。
  - [x] SubTask 2.3: 为首帧、首尾帧、文生视频和全模态模式实现完整输入组合校验，保证前端保存与后端执行规则一致。
  - [x] SubTask 2.4: 将稳定素材顺序、模型、模式、提示词、分辨率、宽高比、时长、音频开关和上游摘要写入参数快照及 inputHash。
  - [x] SubTask 2.5: 补充 DAG 与缓存测试，覆盖合法模式、非法混用、数量边界、素材重排失效和旧画布兼容。

- [x] Task 3: 泛化并复用现有 Seedance 供应商调用链路。
  - [x] SubTask 3.1: 将现有 `generate_tool_video` 的请求构造、异步任务创建、轮询、结果解析和错误脱敏提取为领域中立的 Seedance 调用，原工具入口委托该实现。
  - [x] SubTask 3.2: 支持文本可选、首帧/尾帧角色、三类参考素材稳定顺序及 `generate_audio` 参数，并以强校验字段传递 resolution、ratio 和 duration。
  - [x] SubTask 3.3: 在 Mock 与真实适配器中返回一致的模型、模式、素材数量、时长、分辨率、宽高比、音频开关和供应商任务元数据。
  - [x] SubTask 3.4: 补充 ModelArk 测试，覆盖四种模式、四个模型、素材角色、音频开关、轮询成功/失败/超时和既有工具链回归。

- [x] Task 4: 将视频任务接入 AIGC 网关和 Worker。
  - [x] SubTask 4.1: 在执行器中解析视频节点上游文本和有序媒体资产，生成不可变参数快照并创建 `VIDEO_GENERATION` attempt。
  - [x] SubTask 4.2: 在网关中重新校验资产状态和 MIME 类型，生成受控临时 URL，记录三类输入资产的 slot 与 ordinal。
  - [x] SubTask 4.3: 调用共享 Seedance 能力并将结果视频转存为 AIGC 输出资产，记录 pipeline/run/node/task 关联及安全元数据。
  - [x] SubTask 4.4: 增加独立视频 semaphore、可配置超时、错误分类、自动重试、取消和晚到结果保护。
  - [x] SubTask 4.5: 补充执行器与网关测试，覆盖参数映射、输入引用、输出转存、失败传播、重试、增量复用和取消。

- [x] Task 5: 实现视频与音频输入节点。
  - [x] SubTask 5.1: 扩展 AIGC 媒体上传和资产选择能力，按节点类型筛选并校验视频或音频资产。
  - [x] SubTask 5.2: 实现视频输入节点的固定媒体区、等比播放、放大预览、文件名、分辨率及时长展示。
  - [x] SubTask 5.3: 实现音频输入节点的播放控制、文件名、时长和 MIME 信息展示。
  - [x] SubTask 5.4: 处理上传、替换、不可用资产和模板清除 asset_id 的状态同步。
  - [x] SubTask 5.5: 补充输入节点、上传、资产选择、类型过滤和模板 canonicalization 测试。

- [x] Task 6: 实现生视频节点配置与画布交互。
  - [x] SubTask 6.1: 在节点面板和 React Flow 中加入生视频节点及模式化 handles，显示参考图片/视频/音频连接数量。
  - [x] SubTask 6.2: 在右侧配置面板实现模型、生成模式、分辨率、宽高比、时长和生成音频控件。
  - [x] SubTask 6.3: 切换模型时收敛非法分辨率和时长；切换模式时标记但不静默删除不兼容连线。
  - [x] SubTask 6.4: 在连接阶段拒绝类型不兼容和数量超限，并在保存或运行前展示可定位的模式组合错误。
  - [x] SubTask 6.5: 补充前端测试，覆盖四种模式、模型能力矩阵、动态选项、连接上限、非法连线和配置持久化。

- [x] Task 7: 实现视频输出节点与结果体验。
  - [x] SubTask 7.1: 实现视频输出节点和结果面板播放器，使用固定媒体区并通过 `object-contain` 保持原始宽高比。
  - [x] SubTask 7.2: 展示可获得的视频分辨率、时长、音频状态和资产可用性。
  - [x] SubTask 7.3: 接入受控下载地址，文件名遵循“节点标题-序号.扩展名”。
  - [x] SubTask 7.4: 补充视频结果投影、播放、下载、历史 Run 切换和 unavailable 状态测试。

- [x] Task 8: 完成全链路回归与浏览器验收。
  - [x] SubTask 8.1: 在仓库根目录使用 `.venv/bin/pytest` 运行后端完整回归。
  - [x] SubTask 8.2: 在 `frontend` 运行 `npm run test`、`npm run lint`、`npm run typecheck` 和 `npm run build`。
  - [x] SubTask 8.3: 使用浏览器验证四类新节点的添加、上传/选择、连线、保存、重新加载、执行、重试、预览和下载。
  - [x] SubTask 8.4: 验证四个模型的分辨率、时长、素材上限、2.5 仅音频和 2.0 系列仅音频拒绝逻辑。
  - [x] SubTask 8.5: 验证桌面与窄屏下节点、配置面板和播放器无重叠，视频保持原始宽高比。

- [x] Task 9: 修复编辑器实例状态初始化并建立可靠验收 fixture。
  - [x] SubTask 9.1: 将 AIGC 编辑器改为实例级 Zustand Store Provider，由服务端 entity 同步创建 store，确保首屏、hydration 和路由切换使用正确 revision/definition，且不同编辑器实例之间不泄漏状态。
  - [x] SubTask 9.2: 增加持久化 API 回归，验证 PUT 后通过独立 GET 仍保留 revision 和 definition；增加前端首屏 revision/节点、重载/换实体及多实例隔离测试。
  - [x] SubTask 9.3: 修复并测试“生成音频”checkbox 可在 true/false 间切换，且控件不是 readonly。
  - [x] SubTask 9.4: 提供受保护的本地浏览器验收 fixture 或开发路径，支持保存重载、窄屏、媒体空态和 Mock 结果验证，且不创建真实生成任务。
  - [x] SubTask 9.5: 运行聚焦后端/前端测试、typecheck 和 lint，并记录不触发付费生成的验收 URL 与步骤。

- [x] Task 10: 修复 Mock 下载验收与窄屏画布缩放。
  - [x] SubTask 10.1: 为 Mock 验收 fixture 构造可用视频资产，复用 `getAigcVideoDownload` 渲染受控下载链接及“节点标题-序号.扩展名”，并保留 unavailable/空态。
  - [x] SubTask 10.2: 仅在窄屏将 React Flow `minZoom` 与 `fitViewOptions.minZoom` 降至 0.25，桌面保持默认值且不设置平移边界。
  - [x] SubTask 10.3: 补充 Mock 下载和宽窄屏 viewport 配置测试，并运行相关 Vitest、`npm run typecheck` 与 `npm run lint`。

- [x] Task 11: 阻止绕过前端保存非法 AIGC definition。
  - [x] SubTask 11.1: 为 pipeline/template 创建与更新增加保存期结构校验，拒绝端口类型不匹配、模式禁用端口、重复连线及模型参考素材数量超限，同时允许保存待补全输入或暂不可用资产引用。
  - [x] SubTask 11.2: 将保存期结构校验错误映射为包含 node/edge 定位信息的 422 响应。
  - [x] SubTask 11.3: 补充 pipeline/template API 回归测试，覆盖非法 definition 被拒绝及不完整草稿仍可保存。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 1。
- Task 4 依赖 Task 2 和 Task 3。
- Task 5 依赖 Task 1，可与 Task 2、Task 3 并行。
- Task 6 依赖 Task 1、Task 2，可与 Task 4、Task 5 的后端部分并行。
- Task 7 依赖 Task 4 和 Task 6。
- Task 8 依赖 Task 1 至 Task 7。
- Task 9 依赖 Task 1 至 Task 7。
- Task 10 依赖 Task 9。
- Task 11 依赖 Task 2。
