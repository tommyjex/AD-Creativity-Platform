# Tasks

- [x] Task 1: 建立 AIGC 领域契约与前端基础依赖。
  - [x] SubTask 1.1: 新增 AIGC Pydantic/TypeScript 类型，定义模板、Pipeline、definition schema、节点注册表、端口类型、运行、任务、错误、指标和分页响应。
  - [x] SubTask 1.2: 固定首期节点白名单：`text_input`、`image_input`、`llm`、`text_to_image`、`image_to_image`、`text_output`、`image_output`，并为每类节点定义配置 schema 和输入/输出端口。
  - [x] SubTask 1.3: 明确稳定 `nodeId`、结构化 `{runId,nodeId}`/展示 nodeRunKey、唯一 `taskId` 和 attempt 的映射；任务参数与上游依赖使用不可变深拷贝快照。
  - [x] SubTask 1.4: 在前端显式安装并声明 Zustand 与 React Query，增加仅作用于 `/workspace/aigc` 的 Query Provider。

- [x] Task 2: 实现 MySQL 与内存仓储的 AIGC 持久化。
  - [x] SubTask 2.1: 新增 `pipeline_templates`、`pipelines`、`pipeline_assets`、`pipeline_runs`、`pipeline_run_nodes`、`pipeline_tasks`、`pipeline_task_assets`、带 fencing_token 的 `pipeline_worker_lease` ORM 表、索引、外键、唯一约束和状态字段。
  - [x] SubTask 2.2: 使用 SQLAlchemy `JSON` 映射 MySQL 原生 JSON，保存 definition、输入、参数、结果、错误和指标快照；禁止引入 PostgreSQL `JSONB`。
  - [x] SubTask 2.3: 扩展 Repository Protocol、InMemoryRepository 和 MySQLRepository，覆盖模板/画布 CRUD、revision 乐观锁、运行/RunNode/attempt 状态、原子 attempt 分配、重试链路和资产关联。
  - [x] SubTask 2.4: 更新数据库初始化逻辑以创建 AIGC 新表；不修改现有资产 owner 约束，AIGC 归属通过 `pipeline_assets`、`pipeline_task_assets` 和安全 metadata 表达。
  - [x] SubTask 2.5: 添加 memory/mysql 参数化仓储契约测试，验证 revision 冲突、唯一键、运行快照不可变、RunNode 状态、并发 attempt 幂等和资产删除保护。

- [x] Task 3: 实现模板、我的画布和 AIGC 图片上传 API。
  - [x] SubTask 3.1: 实现只读 node registry，以及模板列表/筛选/详情/创建/更新和实例化 API；更新模板必须提交 `expected_revision`。
  - [x] SubTask 3.2: 实现 Pipeline 列表/筛选/创建/详情/保存和另存为模板 API；保存冲突返回 `409`。
  - [x] SubTask 3.3: 规范化 definition：顶层仅保存 schemaVersion/nodes/edges/viewport，node 保存 id/type/position/size/config，edge 保存 source/target handles；剔除运行时 task/result/error/progress。
  - [x] SubTask 3.4: 实现 AIGC 图片上传 API，复用现有对象存储和文件校验，创建资产库可见的 standalone input asset，并写入安全 `origin=aigc` metadata。
  - [x] SubTask 3.5: 添加 API 契约测试，覆盖名称筛选、默认排序、从模板克隆、模板与实例隔离、上传校验、404/409/422。

- [x] Task 4: 实现 DAG 校验、拓扑计划与增量复用。
  - [x] SubTask 4.1: 实现纯函数 DAG validator，校验节点/边上限、ID 唯一、端点存在、端口类型、单值输入、自环、环路、必填输入、节点配置和资产引用。
  - [x] SubTask 4.2: 使用 Kahn 拓扑算法生成执行计划，区分非执行节点与模型节点，并计算 ready/blocked 分支。
  - [x] SubTask 4.3: 实现规范化 `inputHash`，纳入 nodeType、executorVersion、模型、配置和上游结果摘要。
  - [x] SubTask 4.4: 实现全量执行与“从此节点运行”的计划生成；全量强制全部模型节点，增量强制目标及后代，祖先缓存缺失/失效时自动补算且仅允许同 Pipeline 复用。
  - [x] SubTask 4.5: 添加 DAG 单元测试，覆盖合法多分支、无模型节点、环路、非法端口、缺失输入、失败传播、canonical inputHash 和祖先缓存命中/失效。

- [x] Task 5: 建立首期模型网关与 AIGC 结果资产流转。
  - [x] SubTask 5.1: 基于现有 ModelArkAdapter 增加通用 LLM executor，接受白名单模型和文本配置，输出安全文本快照。
  - [x] SubTask 5.2: 基于现有图片模型低层能力增加独立于 Project 的文生图/图生图 executor；资产 ID 由后端转换为 TOS 临时签名 URL。
  - [x] SubTask 5.3: 将图片结果转存对象存储并创建资产库可见的 output asset；通过 `pipeline_task_assets` 保存 input/output、slot 和 ordinal。
  - [x] SubTask 5.4: 统一模型超时、错误脱敏、白名单瞬时错误判断和 executorVersion；禁止持久化密钥、临时签名参数、原始响应和堆栈。
  - [x] SubTask 5.5: 添加模型网关测试，覆盖 LLM、文生图、图生图、无效资产、超时、敏感错误脱敏和输出入库。

- [x] Task 6: 实现 Pipeline 编排器、队列和 Worker 池。
  - [x] SubTask 6.1: 实现 PipelineRun 创建事务：锁定 Pipeline 行，校验 expectedRevision/Idempotency-Key/活动 Run，冻结快照，创建全部 RunNode 与首批 attempt，并返回 `202`。
  - [x] SubTask 6.2: 实现有界 `asyncio.Queue` 和生命周期受控的 Worker 池；数据库 queued 记录为权威状态，队列满时由调度扫描补入队。
  - [x] SubTask 6.3: 实现携带 fencing_token 的 queued -> running 原子 claim、模型族 semaphore、节点 deadline、晚到结果保护、结果提交和下游释放。
  - [x] SubTask 6.4: 实现同 Run 瞬时错误最多 2 次指数退避；手动重试以幂等方式创建新 retry_node Run；blocked 后代恢复、独立分支继续并按计划内模型节点汇总终态。
  - [x] SubTask 6.5: 实现数据库 scheduler lease 与启动恢复：仅 lease holder 运行扫描/Worker，queued 重新入队，失效 lease 遗留 running 标记 `worker_interrupted`。
  - [x] SubTask 6.6: 实现运行列表/详情、节点重试和 best-effort 取消 API；用 Run/Task CAS 线性化取消与成功提交，晚到媒体使用临时对象补偿清理。
  - [x] SubTask 6.7: 添加编排集成测试，覆盖活动 Run 冲突、并发分支、队列容量、超时/晚到结果、自动/并发手动重试、失败传播、增量补算、恢复和取消。

- [x] Task 7: 构建 AIGC 顶级导航与双视图列表页。
  - [x] SubTask 7.1: 在全局导航加入“AIGC工作台”并支持 `/workspace/aigc/**` 子路由持续高亮，不增加第二个平级画布导航项。
  - [x] SubTask 7.2: 新增 `/workspace/aigc`，默认模板视图，并提供“画布模板 / 我的画布”切换、名称筛选、清空、新建空白画布和空/错/加载状态。
  - [x] SubTask 7.3: 实现拓扑缩略图卡片；宽屏固定 5 列，窄屏按 3 / 2 / 1 列响应；模板和 Pipeline 均按更新时间倒序。
  - [x] SubTask 7.4: 实现点击模板创建实例并跳转、打开我的画布、模板“编辑模板”入口和分页。
  - [x] SubTask 7.5: 添加导航、筛选、五列布局、模板实例化和双视图组件测试。

- [x] Task 8: 构建独立 AIGC 画布编辑器与模板编辑器。
  - [x] SubTask 8.1: 新增 `/workspace/aigc/pipelines/[pipelineId]` 和 `/workspace/aigc/templates/[templateId]` 独立页面；保留顶部导航，主体使用 `h-[calc(100dvh-4rem)]`。
  - [x] SubTask 8.2: 抽取无业务语义的 React Flow 容器供图片画布和 AIGC 画布复用；AIGC node types 和 action context 保持独立，禁止复用 `ImageCanvasPage` 业务编排。
  - [x] SubTask 8.3: 实现左侧节点面板、中央画布、顶部工具栏和右侧“配置 / 结果 / 运行”标签；支持节点添加、拖拽、选中、连接、删除、平移、缩放和适应视图。
  - [x] SubTask 8.4: 实现 7 类首期节点 UI、强类型 handles、配置表单、图片上传/资产库选择、文本/图片结果预览和状态徽标。
  - [x] SubTask 8.5: 建立 Zustand store，管理 nodes、edges、viewport、selection、dirty、revision 和有限撤销/重做历史；使用细粒度 selector 控制重渲染。
  - [x] SubTask 8.6: 实现手动保存、revision 冲突处理、未保存离开确认和另存为模板；dirty 状态执行或从模板实例化必须先串行保存，模板编辑器不允许直接执行。
  - [x] SubTask 8.7: 添加 store、节点契约、连线校验、保存冲突、未保存拦截和模板模式组件测试。

- [x] Task 9: 接入 React Query 运行投影和增量操作。
  - [x] SubTask 9.1: 新增 AIGC query keys、queries 和 mutations，服务端首屏数据作为 initialData，避免 Zustand/Query/组件 state 重复保存服务端实体。
  - [x] SubTask 9.2: 接入执行画布、从此节点运行、失败节点重试和运行历史选择；活动 Run 优先，否则默认最近 Run。
  - [x] SubTask 9.3: 对 queued/running run 每 2 秒轮询，终态后停止；按选中 Run 的 RunNode 投影状态徽标和右侧运行面板。
  - [x] SubTask 9.4: 运行成功后刷新结果与资产查询；文本结果支持复制，图片结果保持原始比例预览和下载。
  - [x] SubTask 9.5: 添加执行、轮询停止、状态投影、重试、增量复用和结果刷新测试。

- [x] Task 10: 更新资产库并完成端到端验收。
  - [x] SubTask 10.1: 资产库识别并展示 AIGC input/output 资产；当前 Pipeline 或活动 Run 引用时删除返回 `409`，仅历史终态引用时允许删除并使历史结果 unavailable/缓存失效。
  - [x] SubTask 10.2: 在桌面浏览器验证模板每行 5 张、双视图、独立全屏画布、全局导航高亮、节点拖拽连线、保存、执行、重试和结果预览。
  - [x] SubTask 10.3: 验证窄屏列表不溢出；低于 1024px 时两侧面板使用互斥抽屉，高于等于 1024px 时固定为 `w-60/w-72`；图片严格保持原始宽高比。
  - [x] SubTask 10.4: 在仓库根目录使用 `.venv/bin/pytest` 运行后端完整回归。
  - [x] SubTask 10.5: 在 `frontend` 运行 `npm run lint`、`npm run typecheck`、`npm run test` 和 `npm run build`。

# Task Dependencies

- Task 2 与 Task 4.1-4.3 依赖 Task 1，可并行。
- Task 4.4-4.5 依赖 Task 2 和 Task 4.1-4.3。
- Task 5 依赖 Task 1、Task 2。
- Task 3 依赖 Task 2。
- Task 6 依赖 Task 2、Task 4、Task 5。
- Task 7 依赖 Task 1、Task 3。
- Task 8 依赖 Task 1、Task 3；可与 Task 6 并行。
- Task 9 依赖 Task 6、Task 8。
- Task 10 依赖 Task 3、Task 6、Task 7、Task 8、Task 9。
