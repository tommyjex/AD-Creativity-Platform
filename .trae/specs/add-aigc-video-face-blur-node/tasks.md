# Tasks

- [x] Task 1: 建立视频人脸打码节点与参数契约。
  - [x] SubTask 1.1: 在前后端节点类型、Task 类型和联合类型中新增 `video_face_blur` / `VIDEO_FACE_BLUR`，保持 `schemaVersion=1` 兼容。
  - [x] SubTask 1.2: 定义 `mask_mode=mosaic|blur`、`mask_strength=low|medium|high` 及默认值。
  - [x] SubTask 1.3: 在前后端节点注册表增加单一 `video_asset` 输入和输出，并覆盖保存校验、执行按钮白名单与 DAG 校验。
  - [x] SubTask 1.4: 增加默认值、非法枚举、单输入限制、端口类型和旧画布兼容测试。

- [x] Task 2: 扩展共享 MediaKit 人脸打码客户端。
  - [x] SubTask 2.1: 为现有 `FaceBlurVideoClient.submit` 增加可选 `client_token`，AIGC 调用传稳定 token，工具页调用保持兼容。
  - [x] SubTask 2.2: 保持供应商请求字段白名单，不发送置信度、框扩展、回调、队列或供应商直存参数。
  - [x] SubTask 2.3: 补充 Mock Transport 测试，覆盖幂等 token、兼容调用、运行、成功、失败、未知状态、非法响应和密钥脱敏。

- [x] Task 3: 将人脸打码接入 AIGC 执行链路。
  - [x] SubTask 3.1: 扩展调度器以解析单一视频输入，生成规范化参数快照、输入引用、稳定 input hash 和 executor version。
  - [x] SubTask 3.2: 在 Gateway 中校验资产状态、MIME、可访问性、最长 600 秒、25–60 FPS 和最高 4K 限制。
  - [x] SubTask 3.3: 提交并轮询 MediaKit，映射 Task Attempt 状态、供应商追踪标识和脱敏错误阶段。
  - [x] SubTask 3.4: 增加人脸打码专用并发、轮询、任务超时和转存限制，使其不占用 Seedance 或画质增强槽位。
  - [x] SubTask 3.5: 接入缓存复用、失败重试、取消、Worker 租约、晚到结果保护、从节点继续和独立分支收敛。

- [x] Task 4: 流式转存并登记打码视频。
  - [x] SubTask 4.1: 复用或抽取现有远程视频流式转存能力，避免将大型结果视频完整缓存在内存。
  - [x] SubTask 4.2: 按实际 MP4/MOV 内容创建公开 AIGC 输出资产，并记录 pipeline、run、node、task 和输入资产关联。
  - [x] SubTask 4.3: 保存白名单化的人脸打码元数据，不持久化 API Key、原始响应体或完整签名 URL。
  - [x] SubTask 4.4: 覆盖临时 URL 过期、类型不匹配、大小超限、下载中断、存储失败和数据库回滚。

- [x] Task 5: 实现画布节点配置与结果展示。
  - [x] SubTask 5.1: 在节点面板、React Flow 节点卡片和 Editor Store 中支持“视频人脸打码”节点及视频模态配色。
  - [x] SubTask 5.2: 在右侧配置面板紧凑展示打码方式和强度，节点卡片展示对应摘要。
  - [x] SubTask 5.3: 扩展结果投影，使打码资产可在结果面板和视频输出节点中播放、放大、全屏和下载。
  - [x] SubTask 5.4: 在运行日志中展示状态、时间、耗时、Attempt、供应商追踪标识和脱敏错误。
  - [x] SubTask 5.5: 增加节点创建、连线、配置持久化、执行按钮、结果展示、历史 Run 和下载文件名测试。

- [x] Task 6: 完成回归与非计费验收。
  - [x] SubTask 6.1: 在仓库根目录 `.venv` 环境运行相关后端 pytest，并覆盖现有工具页人脸打码、MediaKit ASR、视频画质增强和 Seedance 回归。
  - [x] SubTask 6.2: 在 `frontend` 运行相关 Vitest、`npm run typecheck`、`npm run lint` 和 production build。
  - [x] SubTask 6.3: 使用 Mock MediaKit 在浏览器验证节点添加、连线、配置、保存重载、执行、失败重试、结果播放、放大、全屏和下载。
  - [x] SubTask 6.4: 审计浏览器网络请求，确认自动化验收未调用真实 MediaKit 人脸打码接口，并在结束后关闭测试浏览器进程。

# Task Dependencies

- Task 2 依赖 Task 1 的参数契约。
- Task 3 依赖 Task 1 和 Task 2。
- Task 4 依赖 Task 3 的结果模型，可与 Task 3 的调度测试并行。
- Task 5 依赖 Task 1，可与 Task 2、Task 3 和 Task 4 并行开发。
- Task 6 依赖 Task 1 至 Task 5。
