# AIGC MediaKit 多轨剪辑 Spec

## Why

AIGC 画布已有视频生成、增强和人脸打码，但不能将多个视频、图片、音频、文字和字幕编排成完整时间线。需要以单个执行节点承接 DAG 依赖，并使用独立全屏编辑器编辑 MediaKit 的画布、轨道、元素和基础滤镜。

## What Changes

- 新增 `multi_track_edit` 执行节点，接受多路视频、图片、音频和文本输入，输出一个视频资产。
- 新增全屏时间线编辑路由 `/workspace/aigc/pipelines/{pipelineId}/nodes/{nodeId}/timeline`。
- 首版支持视频、图片、音频、文字、SRT 字幕、片段拖拽/分割/裁切、Transform、倍速、音量、淡入淡出、视频转场、自定义画布和 MP4 帧率。
- 新增 MediaKit `multi-track-edit` 异步客户端、独立并发配置、执行器接入、缓存、重试和流式结果转存。
- 时间线只保存稳定节点/资产引用，不保存临时 URL。
- 自动化与浏览器验收仅使用 Mock MediaKit，不调用真实计费接口。

## Impact

- Affected specs: AIGC 节点契约、DAG、时间线编辑、MediaKit 异步任务、视频资产、运行日志、模板净化。
- Affected code: `backend/app/schemas/aigc.py`、`backend/app/services/aigc_*`、`backend/app/services/assets.py`、`backend/app/core/config.py`、`frontend/lib/aigc/*`、`frontend/components/workspace/aigc/*`、全屏路由与测试。

## ADDED Requirements

### Requirement: 多轨剪辑节点

系统 SHALL 提供 `multi_track_edit` 执行节点：

- `videos: video_asset`，多值，最多 30 条连接；
- `images: image_asset`，多值，最多 50 条连接；
- `audios: audio_asset`，多值，最多 30 条连接；
- `texts: text`，多值，最多 30 条连接；
- `video: video_asset` 输出。

#### Scenario: 添加与连接节点

- **WHEN** 用户从节点面板添加“多轨剪辑”
- **THEN** 节点显示视频、图片、音频、文本多值输入和视频输出
- **AND** 类型错误、超连接上限、自环和环路在前后端被拒绝

### Requirement: 稳定素材绑定

媒体元素 SHALL 通过 `source_node_id + source_handle` 引用剪辑节点的直接上游；文字元素可引用直接上游文本或保存内联文本；字幕元素引用节点内上传的 SRT 资产。

#### Scenario: 删除上游连接

- **WHEN** 时间线元素引用的画布入边被删除
- **THEN** 元素保留并显示“来源缺失”
- **AND** 草稿仍可保存
- **AND** 执行被阻止且不调用 MediaKit

#### Scenario: 执行时解析素材

- **WHEN** 剪辑节点执行
- **THEN** 系统从当前 RunNode 解析上游文本或资产 ID
- **AND** 生成受控可访问 URL 后构造 MediaKit 请求
- **AND** Pipeline definition、Task 参数和日志中不保存签名 URL

### Requirement: 剪辑工程模型

系统 SHALL 保存规范化 `MultiTrackEditConfig`，包含画布、MP4 输出和轨道数组；最多 20 条轨道和 200 个元素，时间单位为整数毫秒。

支持的元素为：

- 视频：裁切、循环、Transform、倍速、音量、淡入淡出、转场；
- 音频：裁切、循环、倍速、音量、淡入淡出；
- 图片：循环、Transform；
- 文字：上游或内联文本、基础字体样式、Transform；
- 字幕：SRT 资产、基础字体样式、Transform。

#### Scenario: 轨道层级

- **WHEN** 用户调整轨道顺序
- **THEN** 配置中的轨道数组同步更新
- **AND** 数组索引越大，提交 MediaKit 时渲染层级越高

#### Scenario: 字幕轨道

- **WHEN** 用户添加 SRT 字幕
- **THEN** 字幕独占轨道
- **AND** 字幕轨道总数不超过 10 条

### Requirement: 全屏时间线编辑器

系统 SHALL 提供全屏黑灰时间线编辑器，顶栏包含返回、保存状态、撤销、重做、放弃和执行；上半区为输出预览与检查器；下半区为轨道头、时间标尺、播放头和时间线。

#### Scenario: 编辑片段

- **WHEN** 用户拖动、裁切或分割片段
- **THEN** 片段位置和长度即时更新
- **AND** 结果吸附到播放头、相邻边界或整秒刻度
- **AND** 最终保存值规范化为整数毫秒

#### Scenario: 精确编辑

- **WHEN** 用户在检查器修改时间、Transform、速度、音量、淡入淡出或转场
- **THEN** 时间线和预览同步更新
- **AND** 非法值就地提示并阻止执行

#### Scenario: 响应式

- **WHEN** 视口小于 `1024px`
- **THEN** 检查器进入互斥抽屉且时间线可横向滚动
- **AND** 核心数值编辑、拖拽、保存和执行操作可达且不重叠

### Requirement: 浏览器预览边界

系统 SHALL 提供当前播放头的结构化预览，用于检查画布布局、可见元素和基础节奏；MediaKit 合成结果 SHALL 是转场、音频混合和字体渲染的最终权威结果。

#### Scenario: 未合成预览

- **WHEN** 用户编辑尚未执行的时间线
- **THEN** 浏览器按目标时间和 Transform 近似叠加视频、图片和文字
- **AND** 界面不宣称该预览逐帧等同最终成片

### Requirement: 时间线权威校验

系统 SHALL 在前端编辑和后端执行前校验：

- 至少一条非隐藏轨道和一个有效元素；
- 轨道/元素 ID 唯一，数量在上限内；
- `target_time` 为非负整数且开始小于结束；
- 同轨元素不重叠，带合法转场的相邻视频除外；
- 来源为直接入边且 Run 结果可用、类型匹配；
- 源裁切合法，裁切时长经倍速换算后匹配目标时长；
- 倍速 `[0.1,4]`，音量非负，淡入淡出不超过片段时长；
- Transform 在画布内；
- 自定义画布宽高 `[160,8192]`，背景色为 RGBA 十六进制；
- 文字/字幕具有 Transform，SRT 资产有效；
- 转场位于前一个视频，且持续时间不超过相邻片段可用区间。

#### Scenario: 保存不完整草稿

- **WHEN** 时间线存在来源缺失或参数错误
- **THEN** 用户仍可保存节点草稿
- **AND** 编辑器显示全部问题
- **AND** “执行剪辑”不可用

#### Scenario: 绕过前端

- **WHEN** 客户端提交非法时间线并请求执行
- **THEN** 后端返回包含轨道/元素 ID 的 `invalid_input`
- **AND** 不创建供应商任务

### Requirement: MediaKit 异步调用

系统 SHALL 使用现有 `MEDIAKIT_API_KEY` 和 `MEDIAKIT_BASE_URL` 调用：

- `POST /api/v1/tools/multi-track-edit`
- `GET /api/v1/tasks/{task_id}`

请求 SHALL 使用白名单化 `canvas / track / output` 和稳定 `client_token`，不得发送回调、队列或供应商直存参数。

#### Scenario: 成功执行

- **WHEN** MediaKit 返回 completed 和 `result.video_url`
- **THEN** 系统记录供应商任务与请求 ID
- **AND** 进入结果流式转存阶段

#### Scenario: 供应商失败

- **WHEN** 提交、轮询、响应解析或超时失败
- **THEN** Task Attempt 以稳定错误阶段失败
- **AND** 错误不包含 API Key、完整响应或签名 URL

### Requirement: 结果资产与追溯

系统 SHALL 在临时 URL 失效前流式转存结果，创建公开 AIGC 视频资产，并记录所有上游媒体和字幕输入关系。

#### Scenario: 成片保存

- **WHEN** 合成结果通过 MIME、大小和视频检查
- **THEN** 输出资产记录 `provider=mediakit`、`operation=multi_track_edit`、轨道/元素数量、时长、分辨率、帧率、供应商 ID 和 executor version
- **AND** 节点结果可播放、全屏、下载并继续连接下游

#### Scenario: 转存失败

- **WHEN** URL 过期、下载中断、类型错误、大小超限、对象存储或数据库失败
- **THEN** 任务失败
- **AND** 不留下成功资产、缓存或孤立对象

### Requirement: 缓存、重试和并发

系统 SHALL 为多轨剪辑配置独立并发、轮询、超时和转存限制。`inputHash` SHALL 包含规范化工程、有效上游摘要和字幕资产摘要；重试使用冻结快照。

#### Scenario: 时间线变化

- **WHEN** 轨道、元素、时间、效果、画布、输出或输入资产变化
- **THEN** `inputHash` 变化且不复用旧成片

#### Scenario: 相同任务复用

- **WHEN** `inputHash` 相同且历史输出仍可用
- **THEN** 系统复用结果且不再次调用 MediaKit

### Requirement: 保存和执行

编辑器 SHALL 使用 Pipeline revision 乐观并发保存。“执行剪辑”先保存，再从该节点启动 Run。

#### Scenario: Revision 冲突

- **WHEN** Pipeline 已被其他页面修改
- **THEN** 当前编辑器不得覆盖远端
- **AND** 提示用户放弃本地修改并重新加载

## MODIFIED Requirements

### Requirement: AIGC 全屏编辑路由

`AppShell` SHALL 在图层编辑路由和多轨时间线编辑路由隐藏全局导航并使用完整视口；其他工作区页面保持原布局。

### Requirement: AIGC 视频结果

视频结果投影 SHALL 支持多轨剪辑节点输出，展示成片、轨道数、元素数、分辨率、帧率、时长、供应商追踪和脱敏错误。

### Requirement: 模板净化

Pipeline 模板 SHALL 保留多轨结构和内联文字，但清除 SRT 资产 ID；由上游节点提供的媒体绑定保持结构引用，模板实例化后来源缺失时作为可保存草稿处理。

## REMOVED Requirements

### Requirement: 首版剪辑不支持多轨时间线

**Reason**: AIGC 工作台需要通过 MediaKit 声明式时间线完成多素材合成。

**Migration**: 既有 Pipeline 不受影响；只有新建 `multi_track_edit` 节点时产生多轨配置。
