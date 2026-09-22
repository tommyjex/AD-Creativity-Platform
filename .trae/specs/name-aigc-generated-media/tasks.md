# Tasks

- [x] Task 1: 定义生成产物命名契约与 Seed 2.0 Mini 适配能力。
  - [x] SubTask 1.1: 在后端 schema 中增加命名请求、结构化响应和命名状态类型，名称严格校验为 trim 后 1–10 个 Unicode code point、单行、无控制字符、路径分隔符和扩展名。
  - [x] SubTask 1.2: 在 ModelArk 适配层新增固定模型 `doubao-seed-2-0-mini-260428` 的多模态命名调用，要求只返回 `{"name":"..."}`。
  - [x] SubTask 1.3: 将图片映射为输入图片块，将视频映射为输入视频块并固定 `fps=0.3`；不接受音频输入。
  - [x] SubTask 1.4: 为真实与 Mock adapter 增加测试，覆盖模型 ID、图片/视频顺序、视频 fps、音频排除、合法响应、超长名称和非结构化响应。

- [x] Task 2: 从冻结任务快照构造稳定命名输入。
  - [x] SubTask 2.1: 为 `TEXT_TO_IMAGE`、`IMAGE_TO_IMAGE`、`IMAGE_EDIT`、`VIDEO_GENERATION` 解析实际最终提示词和受控视觉参考 URL。
  - [x] SubTask 2.2: 图生图按执行参数顺序传入全部参考图片；生视频按 `first_frame`、`last_frame`、`reference_images`、`reference_videos` 及同端口 edge 顺序传入。
  - [x] SubTask 2.3: 明确排除参考音频、输出产物和内部元数据，禁止持久化或记录签名 URL。
  - [x] SubTask 2.4: 增加参数解析测试，覆盖文生图无参考、图生图多参考、图片编辑、生视频混合参考及顺序稳定性。

- [x] Task 3: 将命名调用并行接入图片和视频生成 Attempt。
  - [x] SubTask 3.1: 在视觉参考解析后并行启动主生成与命名调用，并为命名调用设置独立 30 秒超时。
  - [x] SubTask 3.2: 保证每个实际生成 TaskAttempt 至多调用一次命名模型；Provider 轮询、资产转存和前端轮询不得重复调用。
  - [x] SubTask 3.3: 自动重试的新 Attempt 可再次调用一次；缓存命中、`REUSED`、非目标任务类型不得调用。
  - [x] SubTask 3.4: 主生成失败或取消时取消/丢弃命名结果；命名超时、Provider 失败或响应非法时使用 fallback 名称且不使主任务失败。
  - [x] SubTask 3.5: 增加并发、超时、取消、生成失败、命名失败、重试、缓存复用和调用次数测试。

- [x] Task 4: 原子更新节点名称并归档一致的资产名称。
  - [x] SubTask 4.1: 在 Memory/MySQL Repository 增加只修改指定节点 `custom_name` 的原子操作，使用行锁或等价机制读取最新 definition、保留其他字段并递增 Pipeline revision。
  - [x] SubTask 4.2: 有效 AI 名称在生成成功后始终覆盖当前节点名称；同 Pipeline 多节点并发完成时合并各自局部更新，禁止覆盖完整 definition。
  - [x] SubTask 4.3: 扩展 AIGC 资产命名，新增 `aigc_generated_node_v2`，写入 `generated_name`、`name_source`、`naming_model`、`naming_status` 和既有追溯元数据。
  - [x] SubTask 4.4: 单产物使用 `{节点名称}.{扩展名}`；多产物从第二个开始追加 `-2` 等序号，并沿用 Unicode、非法字符和 180-byte 安全规则。
  - [x] SubTask 4.5: 将节点局部更新、资产可见性和 TaskAttempt 成功发布纳入一致提交/补偿流程；内部持久化失败时不得留下可见半成品或名称分叉。
  - [x] SubTask 4.6: 前端在 Run 完成后同步最新 Pipeline revision，并以服务端 AI 名称覆盖该节点的本地名称，避免后续自动保存用旧名称回写。
  - [x] SubTask 4.7: 增加仓储、并发 revision、始终覆盖、资产回滚、前端 rebase 和历史 snapshot/inputHash 不变测试。

- [x] Task 5: 统一节点、结果面板和资产库下载文件名。
  - [x] SubTask 5.1: 后端下载解析按 `user_defined_v1` 显式资产名、当前节点名称、冻结 `generated_name`、资产名称和安全回退的顺序生成 `Content-Disposition`。
  - [x] SubTask 5.2: 对可追溯的 AIGC 生图/生视频历史资产动态解析当前节点名称；Pipeline 或节点不存在时回退冻结名称。
  - [x] SubTask 5.3: 更新前端 AIGC 下载 helper，使单产物不再追加 `-1`，多产物从第二个起追加序号，并与后端 filename 查询参数一致。
  - [x] SubTask 5.4: 节点卡片、模态详情、结果面板和资产库复用同一命名规则；不可用或不安全资产继续禁用下载。
  - [x] SubTask 5.5: 增加中文名、节点后续改名、显式资产改名、历史资产、节点删除、非法字符、多产物和 MIME 扩展名测试。

- [x] Task 6: 完成全链路回归和 Mock 浏览器验收。
  - [x] SubTask 6.1: 使用 Mock 图片/视频生成 Provider 与 Mock 命名 Provider 验证文生图、图生图、图片编辑和生视频成功路径，不调用真实计费接口。
  - [x] SubTask 6.2: 验证命名失败不阻塞生成、主生成失败不落名、运行中人工改名被有效 AI 名称覆盖、并行节点名称不丢失。
  - [x] SubTask 6.3: 验证生成后节点标题和配置栏立即更新，刷新后名称、revision 和资产元数据保持一致。
  - [x] SubTask 6.4: 验证图片和视频从节点、详情、结果面板及资产库下载时，文件名与当前节点名称一致。
  - [x] SubTask 6.5: 运行后端定向测试与完整 pytest；运行前端 Vitest、TypeScript、ESLint 和 production build。
  - [x] SubTask 6.6: 使用 Playwright 在 `1440x1000`、`1024x768`、`390x844` 验证节点名称更新、下载文件名、历史回退及无控制台错误。
  - [x] SubTask 6.7: 修复生成节点卡片缺少图片/视频下载入口的问题，并复用统一命名 helper 验证与详情、结果面板和资产库一致。

- [x] Task 7: 使用隔离服务完成生成媒体命名的独立浏览器验收。
  - [x] SubTask 7.1: 使用 `with_server.py` 管理独立 `8010` Mock 后端与受控 `3010` Next Webpack 服务生命周期；将 Next 缓存隔离到仓库根专用目录，显式禁用 Turbopack，并为首次编译设置合理超时。
  - [x] SubTask 7.2: Mock 同一生成节点的双产物，验证单产物不追加序号、多产物第二个起追加 `-2`，且全程不调用真实生成、命名或其他计费 Provider。
  - [x] SubTask 7.3: 验证生成命名后节点标题、配置栏和 revision 同步，刷新页面后名称、revision 与资产元数据持续一致。
  - [x] SubTask 7.4: 实际触发并校验节点、结果面板和资产库下载，覆盖单产物、多产物及 Pipeline/节点不可用时的冻结名称回退。
  - [x] SubTask 7.5: 在 `1440x1000`、`1024x768`、`390x844` 三个视口采集截图与结构化证据，验证 console/page errors、元素重叠、水平/局部溢出和关键操作可达性。
  - [x] SubTask 7.6: 验收后运行原始 `npm run lint` 并通过，清理临时服务及仓库根验收缓存，再勾选 Task 7；不修改 checklist 或 Task 6。

- [x] Task 8: 修复最终验收发现的 Unicode 单行名称校验缺口。
  - [x] SubTask 8.1: 拒绝命名结果中的 Unicode 行分隔符 `U+2028` 和段落分隔符 `U+2029`。
  - [x] SubTask 8.2: 增加非法名称回归用例并重新运行命名相关后端测试与 `git diff --check`。

# Task Dependencies

- Task 2 depends on Task 1.
- Task 3 depends on Tasks 1 and 2.
- Task 4 depends on Task 3.
- Task 5 depends on Task 4.
- Task 6 depends on Tasks 1–5.
- Task 7 depends on Tasks 1–5 and does not change Task 6 verification state.
- Task 8 depends on Task 1 and final acceptance review.
- Task 5 的后端下载解析与 Task 4 的前端 revision 同步可在各自契约稳定后并行开发。
