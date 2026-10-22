# Tasks

- [x] Task 1: 固化 Seedance 尾帧请求与领域响应契约。
  - [x] SubTask 1.1: 为共享 Seedance 创建请求补充显式 `return_last_frame=true`，覆盖四种 AIGC 视频生成模式，保持既有分镜入口行为。
  - [x] SubTask 1.2: 校验成功响应中的 `last_frame_url` 解析与空值处理，确保 URL 不进入普通日志和持久化元数据。
  - [x] SubTask 1.3: 增加 ModelArk 适配器测试，验证请求参数、尾帧 URL 返回及缺失尾帧行为。

- [x] Task 2: 在 AIGC 网关持久化独立尾帧资产。
  - [x] SubTask 2.1: 视频主资产成功后，下载并校验尾帧内容，按实际 MIME 创建 `generated_image` 公共资产并上传 TOS。
  - [x] SubTask 2.2: 为尾帧写入 `output:last_frame` 任务资产关系和来源视频、Pipeline、Run、Node、Task、模型等追溯元数据。
  - [x] SubTask 2.3: 将视频与尾帧分别投影为 Run 结果 ordinal `0` 和 `1`，保持现有视频投影与下游 `video` 端口选择视频主资产。
  - [x] SubTask 2.4: 实现尾帧缺失、下载失败、上传失败和关系写入失败的清理与降级；视频主产物成功不被尾帧失败回滚。
  - [x] SubTask 2.5: 增加网关测试，覆盖双资产成功、尾帧缺失、转存失败、关系失败、对象清理、缓存复用和任务输出清理。
  - [x] SubTask 2.6: 更新视频执行版本与缓存键，避免复用变更前的仅视频输出；尾帧状态和资产 ID 写入视频安全元数据，失败事件进入 TLS。

- [x] Task 3: 扩展角色感知的生成媒体命名。
  - [x] SubTask 3.1: 为尾帧资产增加 `name_variant=video_last_frame`，生成 `xxx视频尾帧.<实际扩展名>`，普通多产物编号规则保持不变。
  - [x] SubTask 3.2: 更新 Memory 与 MySQL 生成媒体提交逻辑，按输出关系角色为视频和尾帧写入一致的 `aigc_generated_node_v2` 命名元数据。
  - [x] SubTask 3.3: 更新后端下载文件名解析，使节点后续改名后仍使用当前 `xxx视频尾帧`，节点不可用时回退冻结名称。
  - [x] SubTask 3.4: 增加命名 helper、双仓储实现和下载响应测试，覆盖 AI 名称、回退名称、后续节点改名、显式资产改名优先级、Unicode、实际扩展名和历史资产兼容；尾帧不增加命名模型调用。

- [x] Task 4: 在前端资产库识别和展示视频尾帧资产。
  - [x] SubTask 4.1: 将 `operation=video_last_frame` 纳入 AIGC 图片产物分类，并显示“视频尾帧”类型标签。
  - [x] SubTask 4.2: 复用现有安全预览和下载 helper，确保尾帧使用 `object-contain` 且建议文件名与后端一致。
  - [x] SubTask 4.3: 增加资产分区、搜索、预览和下载测试，确认独立尾帧资产不会重复生成旧式派生卡片。

- [x] Task 5: 完成回归与浏览器验收。
  - [x] SubTask 5.1: 运行 ModelArk、AIGC 网关、仓储、资产、命名和下载相关后端测试，以及 Ruff 致命错误检查和编译检查。
  - [x] SubTask 5.2: 运行资产库与 AIGC 结果相关 Vitest、TypeScript、ESLint 和 production build。
  - [x] SubTask 5.3: 使用 Mock Provider 验证视频和尾帧双资产全链路，不调用真实计费接口。
  - [x] SubTask 5.4: 使用 Playwright 在 `1440x900`、`834x1112`、`390x844` 验证尾帧可见、等比预览、搜索、下载及无重叠或水平溢出。
  - [x] SubTask 5.5: 运行 `git diff --check`，确认未覆盖工作树中既有的无关修改。

# Task Dependencies

实施与验证证据见 [validation.md](validation.md)。

- Task 2 depends on Task 1.
- Task 3 depends on Task 2.
- Task 4 depends on Tasks 2 and 3.
- Task 5 depends on Tasks 1–4.
- Task 2 的网关测试与 Task 3 的命名 helper 测试可在契约明确后并行准备。
