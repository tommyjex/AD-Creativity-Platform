# Tasks

- [x] Task 1: 建立视频画质增强节点与参数契约。
  - [x] SubTask 1.1: 在前后端节点类型、Task 类型和联合类型中新增 `video_enhancement` / `VIDEO_ENHANCEMENT`，保持 `schemaVersion=1` 兼容。
  - [x] SubTask 1.2: 定义标准版/专业版、场景、增强风格、尺寸模式、帧率、码率模式和色深的强类型配置及保守默认值。
  - [x] SubTask 1.3: 在前后端节点注册表增加单一 `video_asset` 输入和输出，并扩展保存期 DAG 校验。
  - [x] SubTask 1.4: 增加参数互斥、范围、专业版色深及 16-bit 时长限制的契约测试。

- [x] Task 2: 实现 MediaKit 画质增强客户端。
  - [x] SubTask 2.1: 新增隔离的画质增强客户端，使用现有 MediaKit 鉴权提交 `enhance-video`，并以稳定 `client_token` 保证幂等。
  - [x] SubTask 2.2: 实现统一任务查询、状态归一化和结果解析，覆盖 `video_url`、时长、帧率、分辨率、版本及供应商追踪 ID。
  - [x] SubTask 2.3: 实现参数白名单、互斥字段剔除、HTTP/响应结构校验和脱敏异常。
  - [x] SubTask 2.4: 增加 Mock Transport 测试，覆盖标准版、专业版、非法配置、运行、成功、失败、未知状态、超时和密钥不泄露。

- [x] Task 3: 将画质增强接入 AIGC 执行链路。
  - [x] SubTask 3.1: 扩展调度器以解析单一视频输入，生成规范化参数快照、输入引用和稳定 input hash。
  - [x] SubTask 3.2: 在 Gateway 中重新校验资产状态、MIME、可访问性、输入分辨率及 16-bit 时长，随后提交和轮询 MediaKit。
  - [x] SubTask 3.3: 增加画质增强专用并发、轮询和超时配置，使其不占用 Seedance 并发槽位。
  - [x] SubTask 3.4: 接入失败重试、取消、Worker 租约、晚到结果保护、从节点继续和同 Pipeline 缓存复用。
  - [x] SubTask 3.5: 补充执行器和 Gateway 测试，覆盖执行快照、缓存失效、输入引用、错误阶段、重试、取消及独立分支收敛。

- [x] Task 4: 安全转存并登记增强视频。
  - [x] SubTask 4.1: 为大型远程视频实现有超时和最大字节限制的流式对象存储转存，避免完整文件常驻内存。
  - [x] SubTask 4.2: 按实际 MP4/MOV 结果创建公开 AIGC 输出资产，并记录 pipeline、run、node、task 和输入资产关联。
  - [x] SubTask 4.3: 保存白名单化增强元数据，不持久化 API Key、原始响应体或完整签名 URL。
  - [x] SubTask 4.4: 为临时 URL 过期、类型不匹配、大小超限、下载中断、对象存储失败和回滚增加测试。

- [x] Task 5: 实现画布节点和配置交互。
  - [x] SubTask 5.1: 在节点面板、React Flow 节点卡片和编辑器 Store 中支持“视频画质增强”节点及视频模态配色。
  - [x] SubTask 5.2: 在右侧配置面板实现版本/风格、场景、尺寸模式、帧率、码率和色深控件，并根据配置隐藏或禁用不适用字段。
  - [x] SubTask 5.3: 在节点卡片展示版本、目标尺寸、帧率和风格摘要，并标识专业版、4K/8K、12/16-bit 高成本配置。
  - [x] SubTask 5.4: 增加前端测试，覆盖默认值、动态字段、互斥参数、范围校验、节点创建、连线和配置持久化。

- [x] Task 6: 接入运行结果与日志。
  - [x] SubTask 6.1: 扩展结果投影，使画质增强资产可在结果面板和视频输出节点中播放、全屏和下载。
  - [x] SubTask 6.2: 展示输出分辨率、帧率、时长、版本、色深、状态、时间、耗时、Attempt 和脱敏错误。
  - [x] SubTask 6.3: 补充成功、失败、历史 Run 切换、缓存复用、不可用资产和下载文件名测试。

- [x] Task 7: 完成回归与非计费浏览器验收。
  - [x] SubTask 7.1: 在仓库根目录 `.venv` 环境运行相关后端 pytest，并覆盖现有 MediaKit ASR、人物打码和 Seedance 回归。
  - [x] SubTask 7.2: 在 `frontend` 运行相关 Vitest、`npm run typecheck`、`npm run lint` 和生产构建。
  - [x] SubTask 7.3: 使用 Mock MediaKit 在浏览器验证节点添加、连线、参数联动、保存重载、执行、失败重试、结果预览、全屏和下载。
  - [x] SubTask 7.4: 确认自动化和浏览器验收未向真实 MediaKit 画质增强接口发起计费请求。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 1 和 Task 2。
- Task 4 依赖 Task 2，可与 Task 3 的调度部分并行。
- Task 5 依赖 Task 1，可与 Task 2、Task 3、Task 4 并行。
- Task 6 依赖 Task 3、Task 4 和 Task 5。
- Task 7 依赖 Task 1 至 Task 6。
