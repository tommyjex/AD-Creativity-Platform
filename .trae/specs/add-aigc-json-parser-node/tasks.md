# Tasks

- [x] Task 1: 扩展 JSON 解析器领域契约与节点注册表。
  - [x] SubTask 1.1: 在后端 Pydantic 与前端 TypeScript 中新增 `json_parser` 节点、`json_path` 配置、受管文本节点来源字段和结构化 item 列表结果类型。
  - [x] SubTask 1.2: 在前后端节点注册表中加入“JSON 解析器”控制节点，配置单值 `text` 输入和最多 20 条系统生成连线的 `items` 输出。
  - [x] SubTask 1.3: 扩展 definition、模板和 Run snapshot 的序列化/迁移规则，保证历史 schema v2 definition 不受影响。
  - [x] SubTask 1.4: 添加 schema 与注册表测试，验证默认 JSONPath、字段边界、端口一致性和受管键约束。

- [x] Task 2: 实现确定性 JSONPath 解析内核。
  - [x] SubTask 2.1: 引入成熟 JSONPath 解析库，封装表达式编译和执行，禁止前后端自行实现两套解析语义。
  - [x] SubTask 2.2: 实现纯 JSON 与单一 Markdown JSON 代码块规范化，严格拒绝代码块外说明文字。
  - [x] SubTask 2.3: 实现唯一数组匹配校验、0 至 20 项限制和稳定错误码。
  - [x] SubTask 2.4: 实现字符串原样输出及其他 JSON 类型的 canonical JSON 序列化、逐项摘要和列表结果快照。
  - [x] SubTask 2.5: 添加解析单元测试，覆盖合法输入、JSONPath 边界、混合类型、Unicode、空数组及 20/21 项。

- [x] Task 3: 实现受管文本节点原子物化。
  - [x] SubTask 3.1: 扩展 Repository Protocol、MemoryRepository 和 MySQLRepository，提供在 Pipeline 行锁内按解析器与索引收敛受管节点和系统连线的原子操作。
  - [x] SubTask 3.2: 实现首次创建与稳定布局，生成“JSON 项 N”文本节点、来源字段和系统连线，整个 definition 只递增一次 revision。
  - [x] SubTask 3.3: 实现重跑按序复用、增量创建、无额外下游节点删除及有下游节点保留为“无对应 item”。
  - [x] SubTask 3.4: 保留复用节点的 ID、位置、尺寸和额外下游连线；来源解析器删除或类型变化时拒绝物化。
  - [x] SubTask 3.5: 实现删除系统连线后的受管关系解除，保留节点内容并清除来源字段。
  - [x] SubTask 3.6: 添加 Memory/MySQL 参数化测试，覆盖唯一性、revision、并发保存合并、事务回滚和来源变化。

- [x] Task 4: 将 JSON 解析器接入 DAG 与执行器。
  - [x] SubTask 4.1: 扩展 DAG 保存期与运行期校验，覆盖必填文本输入、JSONPath、系统输出连线、环路和最多 20 项约束。
  - [x] SubTask 4.2: 为 `json_parser` 创建本地确定性 Task executor，解析上游文本并提交结构化 item 列表结果。
  - [x] SubTask 4.3: 在 Task 成功提交后调用原子物化，并保证物化失败时 Task 失败且不保留部分 definition。
  - [x] SubTask 4.4: 保持当前 Run snapshot 与 RunNode 集合不可变；后续 Run 按受管索引将 parser item 投影到文本节点并释放下游。
  - [x] SubTask 4.5: 将解析器纳入 input hash、缓存、取消、重试、失败传播、连通子图范围和历史 Run 展示。
  - [x] SubTask 4.6: 添加执行器测试，覆盖首次运行、后续运行、空数组、重跑增减、受保护节点、失败、取消、重试和独立子图。

- [x] Task 5: 实现前端节点编辑与受管节点交互。
  - [x] SubTask 5.1: 在节点面板“控制”分组加入 JSON 解析器，并实现节点卡片、状态、item 数量和错误展示。
  - [x] SubTask 5.2: 在右侧配置面板提供 JSONPath 输入和语法提示，禁止用户从 `items` 端口手工创建连线。
  - [x] SubTask 5.3: 受管文本节点沿用文本蓝色和上游只读展示，显示来源解析器名称与“JSON 项 N”。
  - [x] SubTask 5.4: 支持删除系统连线以解除受管关系，以及直接删除受管节点；保持撤销/重做和选择状态一致。
  - [x] SubTask 5.5: 添加节点注册、配置、连接校验、受管展示和关系解除组件/store 测试。

- [x] Task 6: 处理系统 revision 与前端自动保存合并。
  - [x] SubTask 6.1: 解析器物化成功后刷新 Pipeline 查询，使页面关闭、刷新和多端场景都能取得服务端节点。
  - [x] SubTask 6.2: 本地 clean 时使用最新 definition；本地 dirty 时仅合并服务端受管节点与系统连线，并基于最新 revision 重放用户修改。
  - [x] SubTask 6.3: 定义同一受管键以后端为准、其他用户编辑保留的冲突规则，禁止完整 definition 静默覆盖。
  - [x] SubTask 6.4: 添加自动保存时序测试，覆盖用户保存先提交、物化先提交、重复通知和刷新恢复。

- [x] Task 7: 完成端到端验收与回归。
  - [x] SubTask 7.1: 运行后端 JSON 解析、DAG、仓储和执行器测试，并执行后端完整回归。
  - [x] SubTask 7.2: 运行前端 lint、typecheck、完整 Vitest 和 production build。
  - [x] SubTask 7.3: 使用 Playwright 验证 LLM → JSON 解析器首次运行后自动创建文本节点。
  - [x] SubTask 7.4: 验证重跑时 0、增加、减少及 20 个 item 的节点收敛、位置保留和下游连线保护。
  - [x] SubTask 7.5: 在宽屏、1024px 和移动端检查自动布局、文本溢出、状态展示及交互无重叠。
  - [x] SubTask 7.6: 修复解析器将完整上游 JSON 持久化到 Task Attempt `params["text"]` 的信息暴露；任务详情、错误响应、日志和快照仅保留长度、摘要等安全元数据，并添加回归测试证明完整 JSON、密钥和堆栈不会被记录。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 1 和 Task 2。
- Task 4 依赖 Task 1、Task 2 和 Task 3。
- Task 5 依赖 Task 1，可与 Task 2、Task 3 的后端工作并行。
- Task 6 依赖 Task 3 和 Task 5。
- Task 7 依赖 Task 1 至 Task 6。
