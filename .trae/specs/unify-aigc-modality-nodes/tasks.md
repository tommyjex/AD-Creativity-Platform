# Tasks

- [x] Task 1: 建立 v2 统一模态节点契约与迁移器。
  - [x] SubTask 1.1: 在前后端定义 `text / image / video / audio` 四类节点及其同模态可选单值输入、同模态输出和 `executable=false` 注册信息。
  - [x] SubTask 1.2: 定义统一节点配置，保留文本/BBox、媒体 asset、图片 BBox 和旧输出标题字段。
  - [x] SubTask 1.3: 将 Pipeline definition 升级为 `schemaVersion=2`，实现前后端共享等价的 v1→v2 纯迁移规则。
  - [x] SubTask 1.4: 迁移时保留 node/edge ID、位置、尺寸、端口和配置；旧输入/输出节点映射到对应模态节点。
  - [x] SubTask 1.5: 增加缺失/未知/混合版本、逐类型 golden fixture、幂等迁移、非法旧图不掩盖、历史快照只读适配和前后端同构测试。

- [x] Task 2: 改造 DAG、运行计划和模态值解析。
  - [x] SubTask 2.1: 将模态节点纳入拓扑依赖但排除出执行节点集合，输入端口最多一条入边，继续拒绝类型错误、自环和环路。
  - [x] SubTask 2.2: Run 初始化时为本地模式模态节点生成无 Task Attempt 的结果快照，并重新校验本地媒体资产。
  - [x] SubTask 2.3: 上游成功或复用后即时为上游模式模态节点投影同一值，更新 RunNode 并释放下游，不复制媒体资产。
  - [x] SubTask 2.4: 上游失败、取消、超时或 unavailable 时阻塞模态节点及后代，禁止回退本地备用内容。
  - [x] SubTask 2.5: 支持同模态节点链、从模态节点继续执行、历史 Run 和 unavailable 投影。
  - [x] SubTask 2.6: 明确空本地值、未消费终端和纯模态 Pipeline 的 RunNode/Run 聚合状态。
  - [x] SubTask 2.7: 增加本地源、终端、单/多级中继、空值、失败传播、增量执行和无 Task Attempt 测试。

- [x] Task 3: 更新任务参数、Hash 和结果投影语义。
  - [x] SubTask 3.1: 下游模型统一从模态节点有效结果解析文本或资产；本地文本到普通图生图时继续按目标编译结构化 BBox prompt。
  - [x] SubTask 3.2: 本地模式内容或有效上游摘要进入下游 `inputHash`，上游模式未生效的本地备用内容不进入 Hash。
  - [x] SubTask 3.3: 将文本、图片、视频和音频展示能力从特殊输出节点投影改为按选中 Run 的 definition snapshot 与统一模态 RunNode 结果投影，禁止混入当前 definition。
  - [x] SubTask 3.4: 保持模型任务的 `pipeline_task_assets` 输入/输出追溯，不为中继节点创建重复资产或虚假任务关系。
  - [x] SubTask 3.5: 添加 BBox 编译、缓存命中/失效、Run 切换、资产可用性和追溯测试。

- [x] Task 4: 改造前端节点注册表、Store 和连接交互。
  - [x] SubTask 4.1: 节点面板调整为“模态 / 模型 / 控制”，只提供四类统一模态节点并移除独立输入/输出新增入口。
  - [x] SubTask 4.2: Store 创建新模态节点的统一配置，并在加载 v1 Pipeline、模板和历史 Run 快照时执行只读迁移。
  - [x] SubTask 4.3: 根据入边派生 `local / upstream` 模式，不持久化 mode；连接/断开时保留本地配置并自动切换有效值。
  - [x] SubTask 4.4: 连接阶段拒绝第二条入边、类型错误、自环和环路，允许输出连接多个下游及合法同模态中继。
  - [x] SubTask 4.5: 更新模态节点显示名、自动编号、缩略图、删除、撤销重做、dirty 和保存序列化测试。

- [x] Task 5: 实现统一模态节点 UI 与输出操作。
  - [x] SubTask 5.1: 文本节点本地模式保留提示词/BBox/优化，上游模式展示 Run 文本、复制操作和只读备用内容。
  - [x] SubTask 5.2: 图片节点本地模式保留上传/资产选择/预览/精准框选，上游模式展示等比结果、原图和下载。
  - [x] SubTask 5.3: 视频节点本地模式保留上传/选择/播放器，上游模式展示共享播放器、元数据、全屏和下载。
  - [x] SubTask 5.4: 音频节点本地模式保留上传/选择/播放，上游模式展示播放、时长、MIME、下载并支持继续透传。
  - [x] SubTask 5.5: 上游模式禁用所有本地编辑操作并显示明确说明；等待、失败、不可用和断开恢复状态完整。
  - [x] SubTask 5.6: 结果面板支持四类模态节点，下载文件名使用显示标题，媒体保持原始宽高比。
  - [x] SubTask 5.7: 添加节点卡片、配置栏、结果操作、媒体播放器、可访问名称和窄屏抽屉测试。

- [x] Task 6: 迁移 BBox、模板和资产引用规则。
  - [x] SubTask 6.1: 将 BBox 引用、提示词编辑器和精准框选的节点类型判断迁移到本地模式 `text / image`。
  - [x] SubTask 6.2: 文本或图片切为上游模式时将相关 BBox 引用暂停但保留，运行时不编译；两端恢复本地模式后重新生效。
  - [x] SubTask 6.3: 模板创建、更新和实例化清除统一图片/视频/音频节点的本地 asset 与图片 BBox，并同步删除文本中的对应结构化引用、token 和说明。
  - [x] SubTask 6.4: `pipeline_assets` 继续保护 definition 中保存的本地备用媒体资产；上游有效资产不新增本地引用，历史 unavailable 语义保持不变。
  - [x] SubTask 6.5: 更新 acceptance fixtures 和模板/BBox/资产回归测试。

- [x] Task 7: 更新 API 兼容入口和移除旧节点专用逻辑。
  - [x] SubTask 7.1: Pipeline/template 创建、更新、实例化和执行入口接受 v1/v2，并在活动 definition 持久化前规范为 v2。
  - [x] SubTask 7.2: 历史 Run snapshot 保持不可变，API DTO 和前端读取层可只读展示 v1 结果。
  - [x] SubTask 7.3: 删除前后端注册表、编辑器、结果投影和执行器中只服务于 `*_input / *_output` 的分支，保留兼容迁移类型边界。
  - [x] SubTask 7.4: 更新默认模板、内置模板、空白画布和验收 fixture 为 v2。
  - [x] SubTask 7.5: 添加 API 往返、v1 保存升级、模板实例化、默认 definition 和历史 Run 回归测试。

- [x] Task 8: 完成全量和浏览器验收。
  - [x] SubTask 8.1: 运行后端迁移、DAG、执行器、模板、资产与 API 定向测试及完整 pytest。
  - [x] SubTask 8.2: 运行前端迁移、Store、节点、BBox、结果投影定向测试及完整 Vitest、TypeScript、ESLint 和 production build。
  - [x] SubTask 8.3: 使用隔离 v2 Pipeline 验证四类节点的本地输入、终端输出和中继链路，确认模态节点无 Task Attempt。
  - [x] SubTask 8.4: 使用 v1 fixture 验证自动迁移、保存为 v2、历史 Run 切换、输出标题和连线保持。
  - [x] SubTask 8.5: 在 `1440x900`、`1023x768` 和 `390x844` 验证模态节点添加、连接/断开、本地恢复、复制/预览/播放/下载、BBox 和无重叠；音频输出使用“本地音频 → 音频节点”中继链验收。
  - [x] SubTask 8.6: 验证浏览器控制台无新增错误，模型节点、图层工作流、增量执行、缓存和资产库无回归。

# Task Dependencies

- Task 2、Task 4 依赖 Task 1，可并行。
- Task 3 依赖 Task 1、Task 2。
- Task 5 依赖 Task 3、Task 4。
- Task 6 依赖 Task 1、Task 3、Task 4，可与 Task 5 并行。
- Task 7 依赖 Task 1、Task 2、Task 3、Task 4、Task 6。
- Task 8 依赖 Task 1 至 Task 7。
