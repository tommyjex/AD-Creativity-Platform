# Tasks

- [x] Task 1: 扩展 AIGC 图层数据与节点契约。
  - [x] SubTask 1.1: 为 Seedream 图片模型配置增加 `operation`，兼容旧节点默认 `image_to_image`。
  - [x] SubTask 1.2: 增加 `layer_set`、`image_layer`、`edited_layer` 端口类型，以及 `layer_canvas`、`layer_composite` 节点 schema。
  - [x] SubTask 1.3: 定义不可变图层集、图层上下文、变换补丁和摘要模型，明确 ID、parent、version、digest 规则。
  - [x] SubTask 1.4: 同步前后端节点注册表、默认节点配置、序列化和旧 definition 兼容测试。

- [x] Task 2: 实现模式感知的 DAG 校验与任务解析。
  - [x] SubTask 2.1: 根据 `operation` 启用 Seedream 固定端口，校验图生图、普通图片编辑、指定图层编辑和图层拆分的输入组合。
  - [x] SubTask 2.2: 校验图层画布和图层合成节点的端口数量、类型、选择状态及快照来源。
  - [x] SubTask 2.3: 扩展执行计划、任务类型、参数解析、输出投影和 `inputHash`，覆盖图层结构化结果。
  - [x] SubTask 2.4: 增加 DAG、任务参数、缓存隔离和旧画布兼容测试。

- [x] Task 3: 实现 Seedream 图层拆分和内部资产持久化。
  - [x] SubTask 3.1: 在 AIGC 网关复用现有 Seedream `layer_decomposition=true` 调用与响应解析。
  - [x] SubTask 3.2: 对单张 PNG/JPEG 执行格式、比例、总像素和大小权威校验。
  - [x] SubTask 3.3: 保存底图与 1 至 16 个透明 PNG 图层为内部工具资产，建立完整任务资产关联。
  - [x] SubTask 3.4: 构建根 `layer_set` 快照，并在部分下载、校验、上传或关联失败时完整回滚。
  - [x] SubTask 3.5: 增加 Provider 参数、响应异常、透明通道、资产关系和失败清理测试。

- [x] Task 4: 实现图层画布派生快照与指定图层输出。
  - [x] SubTask 4.1: 将节点变换补丁应用到输入图层集，处理移动、缩放、排序、显隐和删除并生成新快照。
  - [x] SubTask 4.2: 输出绑定派生快照 ID、version、digest 的 `selected_layer`，拒绝底图、已删除图层和过期选择。
  - [x] SubTask 4.3: 将图层选择、变换补丁和上游摘要纳入任务参数与 `inputHash`。
  - [x] SubTask 4.4: 增加不可变性、层级连续性、过期草稿和缓存测试。

- [x] Task 5: 实现指定图层图片编辑和规范化。
  - [x] SubTask 5.1: 扩展图片编辑任务以接收 `image_layer` 并调用 Seedream 5.0 Pro。
  - [x] SubTask 5.2: 将结果缩放到原 bbox 像素尺寸，强制 PNG，并使用原图层 alpha 蒙版限制内容边界。
  - [x] SubTask 5.3: 保存新内部图层资产并返回保留完整来源上下文的 `edited_layer`。
  - [x] SubTask 5.4: 增加普通图片编辑、图层编辑、透明通道、规范化失败和原资产不变测试。

- [x] Task 6: 实现图层替换和最终合成。
  - [x] SubTask 6.1: 校验 `layer_set` 与 `edited_layer` 的 ID、version、digest、layer ID 和像素尺寸完全一致。
  - [x] SubTask 6.2: 复用像素合成服务，仅替换目标图层资产，生成新的派生图层集。
  - [x] SubTask 6.3: 按布局、显隐和层级合成公共图片资产，并记录输入/输出任务资产关联。
  - [x] SubTask 6.4: 增加成功合成、来源冲突、其他图层不变、父快照不变和失败回滚测试。

- [x] Task 7: 实现前端 Seedream 三模式与动态端口。
  - [x] SubTask 7.1: 在检查器中增加“图生图 / 图片编辑 / 图层拆分”三段式控件和模式专属参数。
  - [x] SubTask 7.2: 根据模式与编辑目标启用固定输入/输出端口，保留并标记不兼容连线。
  - [x] SubTask 7.3: 更新节点标题、摘要、端口颜色、连接限制和运行前反馈。
  - [x] SubTask 7.4: 增加模式切换、动态端口、旧配置兼容和连线错误测试。

- [x] Task 8: 实现图层画布节点和独立编辑路由。
  - [x] SubTask 8.1: 实现图层画布节点卡片的组合预览、选中层、图层数、修改数和编辑入口。
  - [x] SubTask 8.2: 新增 `/workspace/aigc/pipelines/[pipelineId]/nodes/[nodeId]/layers` 路由，加载已保存 Pipeline 和最新成功上游图层集。
  - [x] SubTask 8.3: 抽取复用现有图层编辑器的坐标、拖拽、等比缩放、排序、显隐、删除、撤销和重做逻辑。
  - [x] SubTask 8.4: 保存时只更新目标节点配置并携带 Pipeline `expected_revision`；冲突时保留本地草稿，不自动运行。
  - [x] SubTask 8.5: 增加节点预览、路由直达、编辑操作、保存恢复、未保存主画布拦截和冲突测试。

- [x] Task 9: 实现图层合成节点和结果展示。
  - [x] SubTask 9.1: 增加图层合成节点的输入状态、目标替换层和输出摘要。
  - [x] SubTask 9.2: 在结果面板和图片输出节点展示最终扁平图片，并保留新 `layer_set` 供后续串联。
  - [x] SubTask 9.3: 增加合成节点连接、运行状态、结果投影和连续编辑测试。

- [x] Task 10: 完成回归和浏览器验收。
  - [x] SubTask 10.1: 在 `.venv` 中运行后端完整 pytest。
  - [x] SubTask 10.2: 运行前端 lint、typecheck、完整 Vitest 和 production build。
  - [x] SubTask 10.3: 使用浏览器验证三种模式、动态端口、图层组合预览和独立编辑路由。
  - [x] SubTask 10.4: 使用隔离数据执行完整“拆分 → 图层画布 → 指定图层编辑 → 合成 → 输出”链路并清理测试数据。
  - [x] SubTask 10.5: 在桌面和移动视口验证图层画布、工具栏、图层列表、文本和操作按钮无重叠或不可达。

- [x] Task 11: 修复独立验证发现的问题。
  - [x] SubTask 11.1: 缓存可用性检查要求所有必要图层资产存在且状态为 `succeeded`，并补失效资产测试。
  - [x] SubTask 11.2: 为 `layer_canvas` 派生任务记录完整输入/输出任务资产关系，并补追溯测试。
  - [x] SubTask 11.3: 增加图层拆分专用前端预检，支持 `auto` 尺寸并保持前后端类型一致。
  - [x] SubTask 11.4: 消除独立图层编辑器查询最近 20 次 Run 的边界，可靠加载最新成功上游图层集。
  - [x] SubTask 11.5: 为图层编辑器增加移动端响应式布局，保证画布、工具栏、图层列表和属性操作均可到达。
  - [x] SubTask 11.6: 重新运行前后端完整质量门禁并独立复核上述失败检查点。

- [x] Task 12: 修复真实运行发现的任务类型数据库兼容问题。
  - [x] SubTask 12.1: 将 `pipeline_tasks.type` 的模型和正式数据库迁移扩展到至少 `VARCHAR(32)`，兼容所有新增图层任务类型。
  - [x] SubTask 12.2: 修复创建首个任务失败后 Run 仍停留在 `running` 的状态机，确保失败可见且不会形成无任务孤立 Run。
  - [x] SubTask 12.3: 增加长任务类型持久化、迁移和任务创建失败回滚测试。
  - [x] SubTask 12.4: 应用迁移、重启后端、取消孤立验收 Run 并重新执行全量后端测试。

- [x] Task 13: 修复 AIGC 图层资产来源外键错误。
  - [x] SubTask 13.1: 拆分、指定图层编辑和图层合成创建 AIGC 资产时不得将 Pipeline Task ID 写入仅引用 Generation Task 的 `assets.source_task_id`。
  - [x] SubTask 13.2: AIGC 资产来源与输入输出追溯统一由 `pipeline_task_assets` 表表达，保持现有 Generation Task 资产语义不变。
  - [x] SubTask 13.3: 增加真实 MySQL 外键约束、三类图层任务资产创建、关系追溯和失败回滚测试。
  - [x] SubTask 13.4: 保留调试插桩完成 post-fix 对比，并重新执行后端全量测试和真实拆分 Run。

- [x] Task 14: 修复真实图层编辑器的数据加载与内部资产访问。
  - [x] SubTask 14.1: 增加按 Pipeline 和任务资产关系校验的 AIGC 内部图层资产读取能力，不放宽普通公共资产接口。
  - [x] SubTask 14.2: 图层编辑器改用受控内部资产 URL/接口加载底图和图层，单个图层失败不应丢弃全部预览。
  - [x] SubTask 14.3: 最新成功 Run 查询改为按新到旧顺序短路并设置请求超时，禁止单个 Run 详情永久阻塞路由。
  - [x] SubTask 14.4: 增加 17 层真实数据形状、内部资产授权/越权、部分图层失败、超时和最新成功短路测试。
  - [x] SubTask 14.5: 重新运行前后端完整质量门禁并完成桌面/移动浏览器复核。

- [x] Task 15: 修复 AIGC 主画布图层节点预览的内部资产访问。
  - [x] SubTask 15.1: 图层画布节点卡片使用当前选中 Run 的受控 AIGC 资产接口加载组合预览，不调用普通公共资产接口。
  - [x] SubTask 15.2: Run 切换、无成功结果和单层加载失败时，节点预览正确更新且不影响其他图层。
  - [x] SubTask 15.3: 增加主画布真实 17 层预览、Run 切换、部分失败和无公共资产 404 的测试。
  - [x] SubTask 15.4: 重新运行前端完整门禁并用生产浏览器确认主画布无内部资产 404。

- [x] Task 16: 修复图层草稿过期时的 Run 状态并提供继续执行入口。
  - [x] SubTask 16.1: 将任务参数解析、哈希和创建纳入统一异常边界；调度校验失败时当前节点 failed、后代 blocked、Run failed。
  - [x] SubTask 16.2: Worker 增加最终异常隔离，单个任务调度异常不得终止消费协程。
  - [x] SubTask 16.3: 图层画布节点提供“从此节点继续”操作，使用现有 `from_node` 模式复用祖先拆分结果并执行下游。
  - [x] SubTask 16.4: 增加 stale 状态收敛、worker 存活、full 强制重算、from_node 复用及前端操作测试。
  - [x] SubTask 16.5: 取消悬挂验收 Run，重新运行全量门禁，并从图层画布执行真实编辑合成链路。

- [x] Task 17: 修复部分图层变换补丁的空值覆盖。
  - [x] SubTask 17.1: `layer_canvas` 应仅应用变换补丁中的显式非空字段，`null` 表示保持原图层属性。
  - [x] SubTask 17.2: 覆盖仅移动缩放、仅显隐、仅层级、删除及混合补丁，确保输出 schema 始终有效。
  - [x] SubTask 17.3: 保留调试插桩完成 `canvas-post-fix` 对比，并重新运行后端全量测试和真实 `from_node` Run。

- [x] Task 18: 修复 `from_node` 执行计划的外部依赖闭包。
  - [x] SubTask 18.1: `from_node` 计划包含起点后代以及这些后代所需的全部外部祖先依赖。
  - [x] SubTask 18.2: 外部输入/投影节点进入计划并产出结果；可复用模型祖先按哈希与资产可用性复用，避免无关模型重算。
  - [x] SubTask 18.3: 计划内节点若依赖计划外 idle 节点，调度器必须失败收敛而不是永久 running。
  - [x] SubTask 18.4: 增加多分支汇合 DAG、文本外部依赖、缓存模型祖先和不可满足依赖状态机测试。
  - [x] SubTask 18.5: 取消悬挂 Run，运行全量门禁，并重新从图层画布执行真实完整链路。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 1、Task 2。
- Task 4 依赖 Task 1、Task 2，可与 Task 3 的网关实现并行。
- Task 5 依赖 Task 1、Task 2、Task 3、Task 4。
- Task 6 依赖 Task 3、Task 4、Task 5。
- Task 7 依赖 Task 1、Task 2，可与 Task 3、Task 4 并行。
- Task 8 依赖 Task 4、Task 7。
- Task 9 依赖 Task 6、Task 7。
- Task 10 依赖 Task 1 至 Task 9。
- Task 11.1、Task 11.2 依赖 Task 4，可并行实施。
- Task 11.3、Task 11.4、Task 11.5 依赖 Task 7、Task 8，可与后端修复并行实施。
- Task 10.3 至 Task 10.5 依赖 Task 11。
- Task 10.4 依赖 Task 12。
- Task 13 依赖 Task 3、Task 5、Task 6；Task 10.3 至 Task 10.5 同时依赖 Task 13。
- Task 14 依赖 Task 8、Task 13；Task 10.3 至 Task 10.5 同时依赖 Task 14。
- Task 15 依赖 Task 9、Task 14；Task 10.3 至 Task 10.5 同时依赖 Task 15。
- Task 16 依赖 Task 4、Task 8、Task 15；Task 10.3 至 Task 10.5 同时依赖 Task 16。
- Task 17 依赖 Task 16；Task 16.5 和 Task 10.3 至 Task 10.5 同时依赖 Task 17。
- Task 18 依赖 Task 16、Task 17；Task 16.5 和 Task 10.3 至 Task 10.5 同时依赖 Task 18。
