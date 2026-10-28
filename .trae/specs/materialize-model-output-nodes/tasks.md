# Tasks

- [x] Task 1: 扩展自动模态节点契约与校验。
  - [x] SubTask 1.1: 为统一 `image`、`video` 节点增加 `generated_by_model_node_id`、`generated_output_handle`、`generated_from_run_id` 可选字段，并要求三者同时为空或有效。
  - [x] SubTask 1.2: 在前后端定义可自动物化模型与主输出映射，首期覆盖图片模型及生视频、视频增强、人脸打码模型。
  - [x] SubTask 1.3: 增加 `(source model, output handle)` 唯一性、来源类型、Handle、模态和系统连线一致性校验。
  - [x] SubTask 1.4: 更新 definition 迁移、模板清理和序列化测试，保持已有 schema v2 与历史 Run 兼容。

- [x] Task 2: 实现后端幂等原子物化。
  - [x] SubTask 2.1: 新增纯 definition helper，识别终端主图片/视频输出；既有对应自动节点执行更新，尚无自动节点但已有其他出边、结果不可用或类型不支持时直接跳过。
  - [x] SubTask 2.2: 首次创建对应 `image` 或 `video` 节点、标准同模态连线和备用 `asset_id`，使用确定性右侧无碰撞布局。
  - [x] SubTask 2.3: 重跑按来源键复用节点，更新来源 Run 与备用资产，并保留 ID、位置、尺寸、自定义名称和额外下游连线。
  - [x] SubTask 2.4: 删除自动连线时将节点安全转为普通本地节点；删除自动节点后允许后续运行重建。
  - [x] SubTask 2.5: 扩展 Repository Protocol、MemoryRepository 和 MySQLRepository，在 Pipeline 行锁和单事务内提交 definition 与 revision。
  - [x] SubTask 2.6: 添加纯 helper 及双仓储参数化测试，覆盖创建、跳过、复用、布局、去重、解除、来源变化、事务回滚和并发 revision。

- [x] Task 3: 将物化接入成功与复用执行路径。
  - [x] SubTask 3.1: 在图片/视频模型真实任务成功且主资产可用后触发自动物化，不阻塞任务结果提交。
  - [x] SubTask 3.2: 在缓存复用节点解析成功后执行相同幂等物化，且不创建 Task Attempt 或复制资产。
  - [x] SubTask 3.3: 多图结果只选择主图片 ordinal `0`；视频结果只选择主视频，不为视频尾帧创建图片节点。
  - [x] SubTask 3.4: 物化失败时保持模型 `succeeded/reused`，回滚部分 definition，并发送不含媒体 URL、Provider 正文或凭据的 TLS 结构化事件。
  - [x] SubTask 3.5: 增加 Executor 测试，覆盖成功、复用、失败、取消、unavailable、多图片、尾帧、已有下游和来源节点并发变化。

- [x] Task 4: 扩展前端 revision 合并与自动关系解除。
  - [x] SubTask 4.1: 将自动模态节点来源键纳入现有服务端 revision 受限三方合并，支持服务端新增、ID 重映射和系统连线合并。
  - [x] SubTask 4.2: 本地 clean 时应用最新 definition；本地 dirty 时保留用户配置、移动、重命名和连线，并基于最新 revision 继续自动保存。
  - [x] SubTask 4.3: 删除自动入边时清除来源字段、保留备用资产并切换为可编辑本地模式；撤销/重做和删除节点保持一致。
  - [x] SubTask 4.4: 添加 Store 与自动保存时序测试，覆盖物化先后顺序、重复通知、用户删除、冲突和刷新恢复。

- [x] Task 5: 实现当前 Run 即时结果投影和 UI。
  - [x] SubTask 5.1: 为首次物化且不在 snapshot 中的自动节点增加严格来源 Run 投影，只读取匹配 Run 的来源模型主结果。
  - [x] SubTask 5.2: 后续 Run 存在权威模态 RunNode 时继续使用普通投影，切换其他历史 Run 时禁止展示不匹配结果。
  - [x] SubTask 5.3: 自动图片节点复用等比预览、原图和下载；自动视频节点复用播放器、放大、全屏和下载。
  - [x] SubTask 5.4: 在物化 revision 到达后保持当前节点选择、结果 Tab、viewport 和未保存编辑，不重复创建或闪烁节点。
  - [x] SubTask 5.5: 增加结果投影、节点卡片和编辑器测试，覆盖即时展示、历史隔离、普通手工节点、多产物及不可用状态。

- [x] Task 6: 完成回归与浏览器验收。
  - [x] SubTask 6.1: 运行后端 schema、DAG、物化 helper、Memory/MySQL 仓储与 Executor 定向测试，以及完整相关回归、Ruff 致命检查和 compileall。
  - [x] SubTask 6.2: 运行前端 migration、Store、result projection、节点和编辑器测试，以及 TypeScript、ESLint 和 production build。
  - [x] SubTask 6.3: 使用 Mock Provider 验证无预置输出节点的图片模型成功后自动创建图片节点并立即显示结果。
  - [x] SubTask 6.4: 使用 Mock Provider 验证无预置输出节点的视频模型成功后自动创建视频节点并立即播放主视频，且不为尾帧创建图片节点。
  - [x] SubTask 6.5: 验证已有下游不重复创建、缓存复用可创建、重跑复用节点、解除关系后重建、历史 Run 隔离和 dirty revision 合并。
  - [x] SubTask 6.6: 在 `1440x900`、`834x1112`、`390x844` 验证自动布局、图片/视频原始比例、播放/放大/全屏/下载、无重叠或水平溢出。
  - [x] SubTask 6.7: 确认 Mock 验收不调用真实计费 Provider 或生产 TOS，并运行 `git diff --check`。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 2。
- Task 4 依赖 Task 1 和 Task 2，可与 Task 3 并行。
- Task 5 依赖 Task 1、Task 3 和 Task 4。
- Task 6 依赖 Task 1 至 Task 5。
