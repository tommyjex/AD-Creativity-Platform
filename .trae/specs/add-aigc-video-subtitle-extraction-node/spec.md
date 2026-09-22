# AIGC 视频字幕提取节点 Spec

## Why

当前 AIGC 画布可以生成、输入、增强和处理视频，也能在多轨编辑器中使用手动上传的 SRT，但无法从视频画面中提取已经烧录的硬字幕。需要接入 AI MediaKit 视频识别字幕（OCR）能力，将视频中的中英文硬字幕转换为可下载、可继续编排的 SRT 字幕资产。

## What Changes

- 新增可执行节点 `video_subtitle_extraction`，显示名称为“视频字幕提取”。
- 节点接收一个 `video_asset`，固定使用 MediaKit `mode=Subtitle`，输出一个 `subtitle_asset`。
- 新增独立 `VIDEO_SUBTITLE_EXTRACTION` AIGC Task 类型和 `MediaKitVideoOcrClient`，调用 `POST /api/v1/tools/video-ocr` 并轮询 `GET /api/v1/tasks/{task_id}`。
- 复用现有 `MEDIAKIT_API_KEY`、`MEDIAKIT_BASE_URL`、受控临时视频 URL、`SubtitleSegment` 和 `segments_to_srt`。
- 新增 OCR 专用轮询、超时和并发配置；不占用 ASR、Seedance、画质增强或人脸打码并发槽位。
- 将识别结果保存为 `type=subtitle`、`mime_type=application/x-subrip` 的 AIGC 输出资产，并支持结果预览与下载。
- 新增 `subtitle_asset` 强类型端口；多轨剪辑节点新增最多 10 个字幕输入，并按稳定连线顺序创建字幕轨。
- 未识别到有效字幕时节点成功结束但不创建空 SRT，结果区显示“未识别到字幕”，依赖字幕资产的下游保持不可执行。
- 自动化测试和浏览器验收只使用 Mock MediaKit，不自动调用真实计费接口。

## Impact

- Affected specs:
  - AIGC 节点与强类型端口契约
  - AIGC DAG、执行器、Gateway、Task Attempt 与缓存
  - MediaKit 视频 OCR
  - 字幕资产与多轨剪辑字幕输入
  - AIGC 结果投影、运行日志与下载
- Affected code:
  - `backend/app/core/config.py`
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/aigc_dag.py`
  - `backend/app/services/aigc_executor.py`
  - `backend/app/services/aigc_gateway.py`
  - `backend/app/services/mediakit_video_ocr.py`（新增）
  - `backend/app/services/mediakit.py`
  - `backend/app/services/subtitles.py`
  - `backend/app/services/assets.py`
  - `backend/app/api/dependencies.py`
  - `frontend/lib/aigc/types.ts`
  - `frontend/lib/aigc/node-registry.ts`
  - `frontend/lib/aigc/editor-store.ts`
  - `frontend/lib/aigc/result-projection.ts`
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - 相关前后端测试

## ADDED Requirements

### Requirement: 视频字幕提取节点契约

系统 SHALL 在 AIGC 画布中提供可执行节点 `video_subtitle_extraction`，节点具有一个必填 `video` 输入端口和一个 `subtitle` 输出端口，端口类型分别为 `video_asset` 与 `subtitle_asset`。

- 节点固定执行画面硬字幕 OCR，不分析音轨，不替代现有 MediaKit ASR。
- 首版固定使用 `mode=Subtitle`，不提供 `Detailed` 模式、文字坐标、水印或台标识别配置。
- 节点配置保存固定值 `mode="Subtitle"`，用于任务快照、缓存 Hash 和后续契约演进。
- 旧 `schemaVersion=1` 画布无需迁移即可继续加载。

#### Scenario: 添加并连接节点

- **WHEN** 用户从节点面板添加“视频字幕提取”节点
- **THEN** 节点以视频模态配色显示
- **AND** 节点卡片摘要显示“硬字幕 OCR · SRT”
- **AND** 节点可接收视频输入、生视频、视频画质增强、视频人脸打码或其他 `video_asset` 输出
- **AND** 节点输出可连接多轨剪辑的字幕输入
- **AND** 非兼容端口连接在前端被拒绝，绕过前端保存时也被后端拒绝

#### Scenario: 输入未连接

- **WHEN** 用户运行未连接 `video` 输入的字幕提取节点
- **THEN** 系统在调度阶段以可定位的 `invalid_input` 拒绝执行
- **AND** 不调用 MediaKit

### Requirement: OCR 输入视频校验

系统 SHALL 在调用供应商前重新校验输入视频资产的状态、类型、可访问性和 MediaKit 视频 OCR 限制。

- 输入资产必须存在、状态成功、角色公开且 MIME 为视频。
- 系统通过媒体探测读取容器、宽度、高度和时长。
- 支持容器范围为 MP4、FLV、TS、AVI、MOV、WMV、MKV。
- 视频时长必须大于 0 且不超过 600 秒。
- 视频分辨率必须位于 240p 至 4K：短边不小于 240，长边不超过 4096，短边不超过 2160。
- 系统仅向 MediaKit 提交受控的 HTTP/HTTPS 临时 URL，不直接传递对象存储凭证。
- MediaKit 当前仅识别简体中文和英语；首版不提供语言选择或本地语言预检。

#### Scenario: 解析有效视频

- **WHEN** 上游提供一个符合格式、时长和分辨率限制的视频资产
- **THEN** 系统生成受控临时 URL
- **AND** 记录 `slot=video`、`ordinal=0` 的输入资产引用
- **AND** 进入 MediaKit 提交阶段

#### Scenario: 拒绝无效视频

- **WHEN** 输入资产不存在、不可访问、未成功、非视频、容器不支持、时长超过 10 分钟或分辨率超限
- **THEN** 节点以 `invalid_input` 或 `invalid_media_input` 失败
- **AND** 错误阶段为 `input_resolution`
- **AND** 不调用 MediaKit
- **AND** 错误不暴露签名 URL、对象存储凭证或 API Key

### Requirement: MediaKit 视频 OCR 客户端

系统 SHALL 提供独立的 `MediaKitVideoOcrClient`，封装提交、查询、状态归一化和结果解析，不将画面 OCR 合并进现有语音 ASR 客户端。

#### Scenario: 提交 OCR 任务

- **WHEN** 输入视频校验通过
- **THEN** 系统调用 `POST {MEDIAKIT_BASE_URL}/api/v1/tools/video-ocr`
- **AND** 请求使用 `Authorization: Bearer {MEDIAKIT_API_KEY}`
- **AND** 请求体只包含受控 `video_url`、`mode="Subtitle"` 和稳定 `client_token`
- **AND** `client_token` 不超过 64 个可打印 ASCII 字符，并稳定关联当前 Run、节点和 Attempt
- **AND** 请求不发送 `callback_url`、`callback_args`、`queue_id` 或 `Detailed` 模式参数
- **AND** 未配置 MediaKit 凭证时节点明确失败，生产运行不自动回退 Mock

#### Scenario: 轮询 OCR 任务

- **WHEN** 提交响应返回 `task_id`
- **THEN** 系统轮询 `GET /api/v1/tasks/{task_id}`
- **AND** `pending`、`queued`、`processing` 或 `running` 保持任务运行中
- **AND** `completed`、`succeeded` 或 `success` 进入结果解析
- **AND** `failed`、`error`、`cancelled`、`canceled` 或 `expired` 映射为脱敏失败
- **AND** 未知状态、非法 JSON、缺失字段、网络错误和超时使用明确错误阶段
- **AND** 安全格式的供应商 `task_id` 与 `request_id` 可写入 Task Attempt 追踪信息

#### Scenario: 保护敏感信息

- **WHEN** 提交、轮询或解析失败
- **THEN** 日志与前端错误不得包含 API Key、完整临时视频 URL、URL 查询参数或供应商原始响应体
- **AND** 仅记录阶段、HTTP 状态、安全错误码、任务 ID 和请求 ID

### Requirement: OCR 结果转换与字幕资产

系统 SHALL 将 MediaKit `result.subtitles` 转换为标准 SRT，并保存为可追溯的 AIGC 字幕资产。

- `result.subtitles` 必须为数组；缺失或类型错误视为供应商响应错误。
- 每个有效片段读取 `start_time`、`end_time` 和 `subtitle_text`。
- 空文本、非数值时间、负时间或 `end_time < start_time` 的片段被丢弃并记录结构化 warning，不中断其他有效片段。
- 有效片段按 `start_time`、`end_time` 和原始序号稳定排序。
- 复用 `segments_to_srt` 生成递增序号及 `HH:MM:SS,mmm` 时间轴；文本内部换行和多余空白折叠为空格。
- 有效片段非空时创建一个 `AssetType.SUBTITLE`、`application/x-subrip`、UTF-8 编码的公开 AIGC 输出资产。
- 资产 metadata 包含 `provider=mediakit`、`operation=video_ocr`、`mode=Subtitle`、片段数、输入视频时长、供应商任务 ID、请求 ID、pipeline/run/node/task、输入资产 ID 和 executor version。
- 不保存 API Key、完整临时 URL或供应商原始响应。

#### Scenario: 成功提取字幕

- **WHEN** MediaKit 返回一个或多个有效字幕片段
- **THEN** 节点生成一个非空 SRT 字幕资产
- **AND** Task 与 RunNode 标记为 `succeeded`
- **AND** 结果面板可以预览片段并下载 `.srt`
- **AND** 下游多轨剪辑可以消费该字幕资产

#### Scenario: 未识别到字幕

- **WHEN** `subtitles` 为空或清理后没有有效片段
- **THEN** Task 与 RunNode 标记为 `succeeded`
- **AND** 结果类型为成功的无资产结果
- **AND** Task 结果只保存 `empty=true`、源视频时长和安全供应商追踪字段，不保存空文件
- **AND** 不创建空 SRT 或空资产记录
- **AND** 结果面板显示“未识别到字幕”
- **AND** 依赖 `subtitle_asset` 的下游节点保持不可执行

#### Scenario: 字幕资产写入失败

- **WHEN** SRT 编码、对象存储写入或资产登记失败
- **THEN** 节点以 `asset_storage` 阶段失败
- **AND** 不创建成功状态的空资产或残留数据库引用

### Requirement: 执行、缓存与运行控制

系统 SHALL 将视频字幕提取作为独立 AIGC Task 类型执行，并纳入现有 Run、Attempt、缓存、重试、取消、租约和状态收敛机制。

#### Scenario: 创建执行快照

- **WHEN** 字幕提取节点进入 ready 状态
- **THEN** 系统创建 `VIDEO_SUBTITLE_EXTRACTION` Task Attempt
- **AND** 参数快照包含 `mode=Subtitle`、输入资产 ID、输入资产摘要和 executor version
- **AND** input hash 包含上述字段
- **AND** 输入视频内容、模式或 executor version 变化都会使缓存失效

#### Scenario: 复用成功结果

- **WHEN** 同一 Pipeline 存在相同 input hash 的成功任务
- **THEN** 非空且仍可用的 SRT 资产可被复用
- **AND** 成功的无字幕结果也可被复用，避免重复计费
- **AND** RunNode 标记为 `reused`

#### Scenario: 限制并发与超时

- **WHEN** 多个字幕提取节点同时等待执行
- **THEN** 系统使用独立、可配置且默认值为 1 的 OCR 并发限制
- **AND** 使用独立的轮询间隔和任务超时
- **AND** 不占用 Seedance、ASR、画质增强或人脸打码并发槽位

#### Scenario: 重试、取消与晚到结果

- **WHEN** 出现可重试网络错误、Run 被取消、Attempt 被替换或 Worker 租约失效
- **THEN** 系统遵循现有自动重试和取消策略
- **AND** 晚到结果不得覆盖当前状态
- **AND** 独立 DAG 分支继续运行和收敛

### Requirement: 节点与结果体验

系统 SHALL 在节点卡片、结果面板和运行日志中提供可扫描的视频字幕提取体验。

#### Scenario: 查看运行中节点

- **WHEN** OCR 任务处于排队或运行中
- **THEN** 节点显示当前状态、Attempt 和耗时
- **AND** 运行日志展示提交、轮询或存储阶段
- **AND** 不展示 API Key 或签名 URL

#### Scenario: 查看字幕结果

- **WHEN** 节点成功生成 SRT
- **THEN** 结果面板显示字幕片段数和源视频时长
- **AND** 通过现有受控资产内容接口读取并解析 SRT，按时间顺序预览字幕文本与起止时间
- **AND** 完整字幕文本不重复写入资产 metadata 或 Task 日志
- **AND** 提供下载图标按钮，下载文件名遵循“节点标题-序号.srt”
- **AND** 长字幕列表使用内部滚动，不撑高画布节点

#### Scenario: 空结果与失败

- **WHEN** 节点成功但没有识别到字幕
- **THEN** 节点与结果面板显示“未识别到字幕”
- **WHEN** 节点失败
- **THEN** 结果面板显示可理解且脱敏的错误与失败阶段
- **AND** 用户可以从该节点重试

## MODIFIED Requirements

### Requirement: AIGC 节点白名单与强类型端口

系统 SHALL 在现有节点基础上允许 `video_subtitle_extraction`，并新增 `subtitle_asset` 端口类型。前后端节点注册表、Pydantic/TypeScript 联合类型、保存期 DAG 校验、执行按钮白名单、执行器映射和结果投影 SHALL 保持同构。旧画布不包含新节点或新端口时行为不变。

#### Scenario: 拒绝字幕端口错连

- **WHEN** 用户将 `subtitle_asset` 连接到文本、图片、视频或音频端口
- **THEN** 前端拒绝连接并显示类型不兼容
- **AND** 后端拒绝绕过前端保存的非法 definition

### Requirement: 多轨剪辑字幕输入

多轨剪辑节点 SHALL 新增可选、多连接的 `subtitles` 输入端口，类型为 `subtitle_asset`，最多连接 10 个字幕资产。

- 上游字幕资产按画布入边稳定顺序解析。
- 每个上游 SRT 生成一条字幕轨和一个字幕元素，不覆盖节点配置中已有的字幕轨。
- 合并后的字幕轨总数仍不得超过现有上限 10。
- 相同资产已存在于节点配置时不得重复插入。
- 输入资产必须为可访问的成功 SRT，MIME 允许 `application/x-subrip`、`text/srt` 或 `text/plain`，内容必须通过现有 SRT 校验。
- 字幕资产 ID 与内容摘要进入多轨任务快照和 input hash。

#### Scenario: 连接字幕提取结果

- **WHEN** 用户将字幕提取节点连接到多轨剪辑 `subtitles` 输入
- **THEN** 多轨任务按稳定顺序加入对应字幕轨
- **AND** 字幕可在全屏时间线编辑器中查看和调整
- **AND** 保存并重新加载后连接关系保持不变

#### Scenario: 字幕总数超限

- **WHEN** 配置内字幕轨与上游字幕连接合计超过 10
- **THEN** 前端保存前提示上限错误
- **AND** 后端保存或执行时拒绝非法 definition

### Requirement: MediaKit 配置

系统 SHALL 复用现有 `MEDIAKIT_API_KEY` 和 `MEDIAKIT_BASE_URL`，并新增 OCR 专用的轮询间隔、任务超时和执行并发配置。配置校验和日志不得输出密钥值；本地和测试通过依赖注入使用 Mock，生产运行缺少凭证时明确失败。

### Requirement: AIGC 字幕资产结果

AIGC 结果投影 SHALL 支持 `subtitle_asset`，使视频字幕提取结果可被预览、下载、历史 Run 切换和下游多轨剪辑消费。不可用或已删除的字幕资产 SHALL 显示不可用状态并禁止下载，不得回退到历史签名 URL。

## REMOVED Requirements

无。
