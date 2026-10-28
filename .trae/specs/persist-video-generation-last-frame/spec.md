# 视频生成尾帧资产 Spec

## Why

AIGC 画布使用的共享 Seedance 入口目前未显式请求和解析尾帧，网关也只持久化视频主产物，导致尾帧无法在资产库中复用、预览和下载。本变更补齐请求、响应解析和独立图片资产存储。

## What Changes

- 所有 AIGC `VIDEO_GENERATION` Provider 创建请求显式设置 `"return_last_frame": true`。
- 视频生成成功且响应包含有效 `last_frame_url` 时，除视频主资产外，再持久化一个公开的 `generated_image` 尾帧资产。
- 尾帧资产使用本次最终视频节点名称命名为 `xxx视频尾帧.<实际扩展名>`，并保持节点后续改名后的动态下载命名一致。
- 尾帧资产记录来源视频、Pipeline、Run、Node、Task、Provider 和命名状态等可追溯元数据，并建立 `output:last_frame` 任务资产关系。
- Run 结果中视频保持 ordinal `0`，尾帧使用 ordinal `1`；现有 `video` 输出端口和下游视频连接语义保持不变。
- 资产库将该图片识别为“视频尾帧”图片产物，可预览、搜索和下载。
- AIGC 视频生成节点的右侧“结果”页在主视频下方展示独立“视频尾帧”结果，支持应用内放大查看和受控下载。
- Provider 未返回尾帧或尾帧转存失败时，已成功的视频主产物仍可成功发布；系统记录脱敏的结构化失败状态，但不创建不可用尾帧资产。
- 本期不新增画布 `last_frame` 输出 Handle，不改变现有视频生成节点连线契约。

## Impact

- Affected specs: AIGC 视频生成、生成媒体命名、AIGC 资产库、任务结果投影
- Affected code:
  - `backend/app/services/modelark.py`
  - `backend/app/services/aigc_gateway.py`
  - `backend/app/services/aigc_asset_naming.py`
  - `backend/app/repositories/memory.py`
  - `backend/app/repositories/mysql.py`
  - `backend/app/services/assets.py`
  - `backend/app/api/routes.py`
  - `backend/app/services/aigc_executor.py`
  - `frontend/lib/asset-display.ts`
  - `frontend/lib/aigc/download.ts`
  - `frontend/components/workspace/workspace-asset-library.tsx`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/tests/aigc-editor.test.tsx`
  - 相关后端、前端与 Playwright 测试

### 现状与范围

- 分镜生成入口已有 `return_last_frame=True`，但共享 `generate_seedance_video` 入口缺少该参数；本次补齐共享入口，既有分镜尾帧功能按原规则运行。
- 仅为 AIGC `VIDEO_GENERATION` 自动创建独立尾帧资产；不扩展独立工具任务或历史资产回填。
- 尾帧直接复用本次视频命名结果，不单独调用命名模型。
- 新版本视频执行缓存必须与旧版本区分，避免旧的仅视频结果被当作已完成双资产输出；历史 Run 仍可正常查看。
- 竖向尾帧预览采用独立媒体区，使用绝对定位与 `object-contain`，详情区独立滚动，以保持原始比例并确保下载按钮可达。

## ADDED Requirements

### Requirement: 视频生成任务默认请求尾帧

系统 SHALL 在所有 AIGC 视频生成任务的 Seedance 创建请求中显式传递 `return_last_frame=true`，不得依赖 Provider 默认值。

#### Scenario: 创建视频生成任务

- **WHEN** AIGC Worker 为 `VIDEO_GENERATION` Attempt 创建 Seedance 任务
- **THEN** Provider 请求包含 `"return_last_frame": true`
- **AND** 文生视频、首帧、首尾帧和全模态参考模式使用同一规则

#### Scenario: Provider 返回尾帧 URL

- **WHEN** Seedance 任务成功并返回非空 `content.last_frame_url`
- **THEN** ModelArk 适配层将该 URL 写入领域结果的 `last_frame_url`
- **AND** 普通日志、数据库和 API 响应不得保存 Provider 签名 URL 原文

### Requirement: 尾帧保存为独立图片资产

系统 SHALL 在视频主资产持久化成功后，将有效的 `last_frame_url` 转存为独立公共图片资产。

#### Scenario: 视频和尾帧均成功转存

- **WHEN** Provider 同时返回有效视频 URL 和尾帧 URL
- **THEN** 系统创建一个 `storyboard_video` 视频资产
- **AND** 系统创建一个 `generated_image` 尾帧资产
- **AND** 尾帧资产使用实际下载内容的 MIME 类型和扩展名
- **AND** 两个资产均写入 TOS，不保留 Provider 原始 URL
- **AND** 视频资产记录 `last_frame_status=available` 和 `last_frame_asset_id`
- **AND** 视频资产与任务建立 `direction=output, slot=video, ordinal=0` 关系
- **AND** 尾帧资产与任务建立 `direction=output, slot=last_frame, ordinal=0` 关系

#### Scenario: Run 结果保持视频优先

- **WHEN** 视频和尾帧资产均可用
- **THEN** `AigcTaskResult.assets` 中视频为 ordinal `0`
- **AND** 尾帧为 ordinal `1`
- **AND** 现有视频结果预览、下载和下游 `video` 端口仍选择视频资产

#### Scenario: Provider 未返回尾帧

- **WHEN** 视频生成成功但 `last_frame_url` 缺失或为空
- **THEN** 视频主资产仍成功发布
- **AND** 系统不创建尾帧资产或尾帧输出关系
- **AND** 系统记录 `last_frame_status=unavailable` 和稳定错误类型 `MissingProviderUrl`
- **AND** 状态记录于视频资产元数据，结构化事件发送至 TLS
- **AND** 任务结果不包含虚假的不可用尾帧条目

#### Scenario: 尾帧转存失败

- **WHEN** 视频主资产已成功持久化，但尾帧下载、校验、上传或关系写入失败
- **THEN** 视频主资产仍成功发布
- **AND** 已上传但未完成登记的尾帧对象和资产记录被清理
- **AND** 系统记录脱敏的结构化错误类型和 `last_frame_status=unavailable`
- **AND** 状态记录于视频资产元数据，结构化事件发送至 TLS
- **AND** 错误信息不得包含签名 URL、凭据或 Provider 响应正文

### Requirement: 尾帧资产具有稳定命名和追溯信息

系统 SHALL 使用视频节点最终显示名称构造尾帧资产名称，并在命名成功提交时与视频资产一起原子发布名称元数据。

#### Scenario: AI 命名成功

- **WHEN** 视频生成命名结果为 `春日清洁`
- **AND** 尾帧实际 MIME 类型为 `image/png`
- **THEN** 视频资产名称为 `春日清洁.mp4`
- **AND** 尾帧资产名称为 `春日清洁视频尾帧.png`
- **AND** 尾帧资产沿用 `aigc_generated_node_v2` 命名方案
- **AND** 尾帧资产记录 `name_variant=video_last_frame`

#### Scenario: AI 命名失败

- **WHEN** 命名调用失败、超时或返回非法名称
- **THEN** 系统使用生成完成时的视频节点回退名称作为 `xxx`
- **AND** 尾帧名称仍为 `xxx视频尾帧.<实际扩展名>`
- **AND** 视频生成任务不因命名失败而失败

#### Scenario: 节点后续改名

- **WHEN** 用户在生成完成后将视频节点改名为 `厨房清洁`
- **THEN** 尾帧下载文件名动态解析为 `厨房清洁视频尾帧.<实际扩展名>`
- **AND** Pipeline 或节点不可用时回退到资产冻结名称
- **AND** 用户显式重命名尾帧资产时，沿用 `user_defined_v1` 的最高优先级

#### Scenario: 记录来源关系

- **WHEN** 尾帧资产持久化成功
- **THEN** 元数据至少包含 `origin=aigc`、`aigc_role=video_last_frame`、`operation=video_last_frame`
- **AND** 元数据包含 `source_video_asset_id`、`pipeline_id`、`run_id`、`node_id` 和 `task_id`
- **AND** 元数据包含模型、Provider 任务标识及现有安全追溯字段

### Requirement: 资产库展示视频尾帧图片

系统 SHALL 将独立尾帧资产作为 AIGC 图片产物展示，而不是继续依赖视频资产 metadata 派生虚拟卡片。

#### Scenario: 浏览 AIGC 资产

- **WHEN** 资产列表包含 `operation=video_last_frame` 的公开 `generated_image`
- **THEN** 资产库将其归入可见图片产物
- **AND** 类型标签显示“视频尾帧”
- **AND** 预览使用 `object-contain` 保持原始宽高比
- **AND** 用户可以按 `xxx视频尾帧` 搜索该资产

### Requirement: 视频生成节点结果页展示尾帧

系统 SHALL 在 AIGC `video_generation` 节点的右侧“结果”页中，将可用的独立尾帧资产显示为主视频的配套图片结果。

#### Scenario: 新 Run 同时包含视频和尾帧

- **WHEN** 用户选择一个已完成且结果中包含视频 ordinal `0` 与尾帧 ordinal `1` 的视频生成节点
- **AND** 用户打开右侧“结果”页
- **THEN** 结果页先显示现有主视频播放器、视频元数据和“下载视频”按钮
- **AND** 在主视频结果下方显示标题为“视频尾帧”的独立图片区块
- **AND** 尾帧缩略图使用稳定媒体区和 `object-contain`，保持原始宽高比
- **AND** 尾帧区块显示“放大查看”和“下载尾帧”两个明确操作
- **AND** 尾帧不得被误标为第二个普通图片结果或 `生成结果 2`

#### Scenario: 放大查看尾帧

- **WHEN** 用户点击结果页中的尾帧缩略图或“放大查看”
- **THEN** 系统在应用内 Dialog 中显示尾帧大图
- **AND** 大图使用 `object-contain`，不得裁切、拉伸或跳转到新浏览器标签页
- **AND** Dialog 显示当前尾帧名称，并提供关闭和下载操作
- **AND** 用户点击遮罩、关闭按钮或按 Escape 后返回原结果页，滚动位置和当前节点选择保持不变

#### Scenario: 从结果页下载尾帧

- **WHEN** 用户点击结果页尾帧区块或放大 Dialog 中的下载操作
- **THEN** 下载通过现有受控资产内容端点完成
- **AND** 建议文件名与后端 `Content-Disposition` 一致
- **AND** 文件名遵循当前视频节点显示名称、冻结名称和用户显式资产名称的既有优先级

#### Scenario: 尾帧缺失或不可用

- **WHEN** 视频生成成功但该 Run 未包含可用尾帧资产
- **THEN** 结果页继续正常显示主视频及其下载操作
- **AND** 不显示空白尾帧卡片、损坏图片或不可用下载按钮
- **AND** 历史仅含视频资产的 Run 行为保持不变

#### Scenario: 下游视频节点查看结果

- **WHEN** 视频生成结果连接到 `video` 或 `video_output` 节点
- **THEN** 下游节点和其结果页继续只显示主视频
- **AND** 尾帧只在拥有该独立尾帧资产的原始视频生成节点结果中展示
- **AND** 本变更不新增 `last_frame` 输出 Handle，也不改变现有连线契约

#### Scenario: 下载尾帧

- **WHEN** 用户从节点结果、运行记录或资产库下载尾帧资产
- **THEN** 前端建议文件名与后端 `Content-Disposition` 均为 `xxx视频尾帧.<实际扩展名>`
- **AND** 下载通过现有受控资产内容端点完成

## MODIFIED Requirements

### Requirement: 生成媒体多产物命名

生成媒体提交逻辑 SHALL 根据输出关系语义区分普通多产物和视频尾帧派生产物。普通同类多产物继续使用 `xxx`、`xxx-2`、`xxx-3`；`slot=last_frame` 或 `name_variant=video_last_frame` 的资产必须使用 `xxx视频尾帧`，不得命名为 `xxx-2`。

#### Scenario: 视频任务产生两个不同角色的资产

- **WHEN** 一个视频生成 Attempt 产生视频和尾帧两个资产
- **THEN** 视频命名为 `xxx.mp4`
- **AND** 尾帧命名为 `xxx视频尾帧.png`
- **AND** 两者不得被视为两个普通同类输出

### Requirement: AIGC 视频结果兼容

视频生成节点现有 `video` 输出、视频输出节点、结果面板和缓存复用 SHALL 保持兼容。

#### Scenario: 旧 Run 仅包含视频资产

- **WHEN** 系统加载变更前创建且仅含一个视频资产的历史 Run
- **THEN** 视频预览、下载、缓存摘要和下游执行行为保持不变

#### Scenario: 新 Run 包含视频和尾帧资产

- **WHEN** 系统加载包含两个资产的新 Run
- **THEN** 视频模态投影仍使用 ordinal `0` 的视频资产
- **AND** 缓存命中复用视频和尾帧两个可用资产
- **AND** 删除或清理任务输出时同时清理两个资产及对象
- **AND** 原始视频生成节点的结果页展示主视频与独立尾帧
- **AND** 下游视频模态节点仍只投影主视频，不重复展示尾帧

## REMOVED Requirements

无。
