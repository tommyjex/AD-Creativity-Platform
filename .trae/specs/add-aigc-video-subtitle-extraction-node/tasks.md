# Tasks

- [x] Task 1: 建立视频字幕提取节点与字幕端口契约。
  - [x] SubTask 1.1: 在后端节点类型、Task 类型、联合类型和前端 TypeScript 类型中新增 `video_subtitle_extraction` / `VIDEO_SUBTITLE_EXTRACTION`。
  - [x] SubTask 1.2: 新增 `subtitle_asset` 端口类型，定义节点单一 `video_asset` 输入与单一 `subtitle_asset` 输出。
  - [x] SubTask 1.3: 定义固定 `mode="Subtitle"` 的节点配置、默认值、节点卡片摘要和 `schemaVersion=1` 兼容行为。
  - [x] SubTask 1.4: 扩展前后端节点注册表、保存期校验、执行按钮白名单与 DAG 校验。
  - [x] SubTask 1.5: 增加节点默认值、非法模式、缺失/多余输入、端口错连和旧画布兼容测试。

- [x] Task 2: 实现独立 MediaKit 视频 OCR 客户端。
  - [x] SubTask 2.1: 新建 `backend/app/services/mediakit_video_ocr.py`，定义任务状态、任务结果、脱敏错误和可注入 Transport 的客户端。
  - [x] SubTask 2.2: 实现 `POST /api/v1/tools/video-ocr`，请求仅发送 `video_url`、`mode=Subtitle` 和稳定 `client_token`。
  - [x] SubTask 2.3: 实现 `GET /api/v1/tasks/{task_id}` 查询、状态归一化、超时处理和安全的 `task_id` / `request_id` 提取。
  - [x] SubTask 2.4: 解析 `duration` 与 `subtitles`，稳定排序有效片段，对单条非法片段记录 warning，对非法整体结构失败。
  - [x] SubTask 2.5: 增加 Mock Transport 测试，覆盖提交、运行、成功、空字幕、部分非法片段、失败、未知状态、非法 JSON、网络错误、超时、幂等 token 和敏感信息不泄露。

- [x] Task 3: 将字幕提取接入 AIGC 执行链路。
  - [x] SubTask 3.1: 在执行器中解析单一视频输入，生成包含 `mode`、输入资产 ID、摘要和 executor version 的不可变参数快照与 input hash。
  - [x] SubTask 3.2: 在 Gateway 中重新校验资产状态、MIME、容器、可访问性、最长 600 秒及 240p–4K 分辨率。
  - [x] SubTask 3.3: 使用受控临时 HTTP/HTTPS URL 提交并轮询 MediaKit，映射 Task Attempt 状态、供应商追踪标识和脱敏错误阶段。
  - [x] SubTask 3.4: 新增 OCR 专用轮询、任务超时与默认并发 1 的配置和 semaphore，不占用其他视频任务槽位。
  - [x] SubTask 3.5: 接入自动重试、取消、Worker 租约、晚到结果保护、从节点继续、独立分支收敛和同 Pipeline 缓存。
  - [x] SubTask 3.6: 增加执行器与 Gateway 测试，覆盖输入解析、规格限制、快照、缓存失效、状态映射、重试、取消和空结果复用。

- [x] Task 4: 生成并持久化 SRT 字幕资产。
  - [x] SubTask 4.1: 复用现有 `SubtitleSegment` 与 `segments_to_srt`，确保 OCR 片段生成 UTF-8 标准 SRT。
  - [x] SubTask 4.2: 在资产服务中新增 AIGC OCR 字幕存储，创建 `AssetType.SUBTITLE`、`application/x-subrip` 的公开输出资产。
  - [x] SubTask 4.3: 保存白名单化 metadata，包括 provider、operation、mode、片段数、时长、供应商追踪 ID、执行关联和输入资产。
  - [x] SubTask 4.4: 实现空字幕成功无资产结果，并使非空资产与空结果均可按 input hash 复用。
  - [x] SubTask 4.5: 测试标准 SRT、空结果、非法片段清理、存储失败回滚、资产删除后不复用和元数据脱敏。

- [x] Task 5: 将字幕资产接入多轨剪辑。
  - [x] SubTask 5.1: 为前后端多轨节点注册表增加可选 `subtitles` 输入，类型为 `subtitle_asset`、多连接、上限 10。
  - [x] SubTask 5.2: 按稳定入边顺序解析上游字幕资产，校验资产状态、类型、MIME 与 SRT 内容，并写入输入引用和内容摘要。
  - [x] SubTask 5.3: 将上游 SRT 转为字幕轨和字幕元素，与配置内字幕轨合并，按资产 ID 去重并保持字幕轨总数不超过 10。
  - [x] SubTask 5.4: 确保字幕连接顺序、资产内容或配置字幕轨变化会使多轨缓存失效。
  - [x] SubTask 5.5: 增加连接、保存重载、顺序、去重、总数上限、无效 SRT、缓存和 Provider 项目映射测试。

- [x] Task 6: 实现节点卡片、结果投影和下载体验。
  - [x] SubTask 6.1: 在节点面板、React Flow 卡片和 Editor Store 中支持“视频字幕提取”节点及视频模态配色。
  - [x] SubTask 6.2: 节点卡片展示“硬字幕 OCR · SRT”、连接状态、运行状态和空字幕成功状态；首版不展示无效配置控件。
  - [x] SubTask 6.3: 扩展结果投影，通过受控资产内容接口读取并解析 SRT，展示字幕片段数、源视频时长、按时间排序的字幕预览和脱敏错误阶段。
  - [x] SubTask 6.4: 提供 SRT 下载图标按钮，文件名遵循“节点标题-序号.srt”；不可用资产禁用下载。
  - [x] SubTask 6.5: 增加节点创建、连线、保存重载、运行状态、空结果、历史 Run、不可用资产、预览滚动和下载文件名测试。

- [x] Task 7: 完成回归与非计费验收。
  - [x] SubTask 7.1: 在仓库根目录 `.venv` 环境运行新增与相关后端 pytest，并覆盖现有 MediaKit ASR、人脸打码、画质增强、多轨剪辑和 Seedance 回归。
  - [x] SubTask 7.2: 在 `frontend` 运行相关 Vitest、`npm run typecheck`、`npm run lint` 和 production build。
  - [x] SubTask 7.3: 使用 Mock MediaKit 在浏览器验证节点添加、视频连线、保存重载、执行、字幕预览、SRT 下载、空结果、失败重试和连接多轨字幕输入。
  - [x] SubTask 7.4: 在桌面与窄屏验证节点、结果面板和多轨字幕轨无重叠，视频与文本区域尺寸稳定。
  - [x] SubTask 7.5: 审计浏览器网络请求，确认自动化验收未调用真实计费的 `video-ocr` 接口，并关闭测试浏览器进程。

# Task Dependencies

- Task 2 depends on Task 1 的模式与结果契约。
- Task 3 depends on Task 1 and Task 2。
- Task 4 depends on Task 2 的结果模型，可与 Task 3 的调度部分并行。
- Task 5 depends on Task 1，可与 Task 2、Task 3、Task 4 并行开发。
- Task 6 depends on Task 1 and Task 4，可与 Task 5 并行开发。
- Task 7 depends on Task 1 至 Task 6。
