# Seed 视频字幕定位后端预研 Spec

## Why

现有 MediaKit 视频字幕提取能力只能生成字幕文本和时间轴，无法返回字幕在视频画面中的位置。本预研使用默认模型 `doubao-seed-evolving` 验证“视频 URL → 硬字幕文字、出现时间、BBox”的可行性，并依据火山方舟 Grounding 官方教程在后端将模型的 1000×1000 比例坐标反算为视频真实像素坐标。

## What Changes

- 新增隔离的后端实验服务和管理员接口，不开发前端、不修改现有 AIGC 节点、不创建资产或任务。
- 接收一个 HTTPS 视频 URL，安全下载到临时文件并使用 FFprobe 获取展示宽高、时长和旋转信息。
- 使用默认模型 `doubao-seed-evolving` 调用 ModelArk Responses API，要求严格结构化输出。
- 识别画面中实际可见的硬字幕，要求模型按官方 Grounding 格式输出 `<bbox>x_min y_min x_max y_max</bbox>`，同时输出字幕文字和开始/结束时间。
- 后端权威校验模型结果，并反算、裁剪为视频展示空间中的真实像素坐标。
- 提供 Mock 自动化测试和显式 opt-in 的真实模型冒烟脚本；普通测试不得调用计费接口。
- 记录延迟、Token、片段数和安全错误阶段，不记录完整视频 URL、查询参数或模型原始响应。

## Impact

- Affected specs:
  - ModelArk 多模态视频理解
  - 后端实验接口
  - 远程媒体安全下载与探测
  - 字幕时间轴与视觉定位数据契约
- Affected code:
  - `backend/app/core/config.py`
  - `backend/app/schemas/` 下新增实验请求/响应 schema
  - `backend/app/services/` 下新增字幕定位、远程视频获取与坐标转换服务
  - `backend/app/services/modelark.py`
  - `backend/app/api/dependencies.py`
  - `backend/app/api/routes.py`
  - `backend/tests/` 下新增单元、适配器、接口和 opt-in 冒烟测试

## Definitions

### 硬字幕

硬字幕是直接绘制在视频画面中的对话字幕或说明性字幕。本预研不转写仅存在于音轨中的语音，也不把 Logo、水印、商品包装、界面按钮、角标或场景文字当作字幕。

### 坐标空间

- `bbox`：模型原始输出的官方 Grounding 标签，格式严格为 `<bbox>x_min y_min x_max y_max</bbox>`。
- `bbox_normalized`：后端从 `bbox` 标签解析出的 `[x_min, y_min, x_max, y_max]`，左上角为原点，每个坐标均为 `[0,999]` 内的整数。
- `bbox_pixels`：后端按视频**展示方向**宽高反算出的像素坐标，格式同为 `[x1, y1, x2, y2]`。
- 对含 90°/270°旋转元数据的视频，展示宽高 SHALL 交换；返回坐标对应用户实际观看到的画面方向，而不是编码帧方向。

### 字幕片段

一个字幕片段表示同一字幕文字在同一位置连续可见的时间区间。文字变化、BBox 明显变化或中间不可见时 SHALL 拆分为不同片段。

## ADDED Requirements

### Requirement: 隔离的实验接口

系统 SHALL 提供管理员可访问的同步实验接口：

`POST /api/experiments/video-subtitle-grounding`

请求体：

```json
{
  "video_url": "https://example.com/input.mp4",
  "sampling_fps": 2.0
}
```

`sampling_fps` 可选，默认 `2.0`，允许范围 `0.5..5.0`。响应 SHALL 包含模型、视频元数据、字幕片段、用量和总耗时，不创建数据库记录、资产、AIGC Run 或 Tool Task。

#### Scenario: 管理员提交有效视频

- **WHEN** 管理员提交一个符合约束的 HTTPS 视频 URL
- **THEN** 后端完成下载、探测、模型识别、校验和坐标反算
- **AND** 返回结构化字幕定位结果
- **AND** 请求结束后删除临时视频文件

#### Scenario: 非管理员访问

- **WHEN** Creator、Viewer 或未登录用户调用实验接口
- **THEN** 系统分别返回 `403` 或 `401`
- **AND** 不下载视频、不调用模型

#### Scenario: 生产环境默认关闭

- **WHEN** `APP_ENV=production`
- **AND** 未显式设置 `ENABLE_EXPERIMENTAL_VIDEO_SUBTITLE_GROUNDING=true`
- **THEN** 接口返回 `404`
- **AND** 不暴露实验能力的内部配置或错误细节

### Requirement: 视频 URL 安全获取

系统 SHALL 只接受 HTTPS URL，并在后端安全下载视频用于 FFprobe 和模型输入准备。

- 禁止 URL userinfo、fragment、非 HTTPS scheme、空 host 和非法 port。
- DNS 解析出的全部 IPv4/IPv6 地址必须是公网地址；拒绝 loopback、private、link-local、multicast、reserved、unspecified 及云元数据地址。
- 每次重定向重新执行同等校验，最多 3 次；禁止 HTTPS 降级。
- 响应必须为允许的视频 MIME，下载上限默认 512 MiB，连接、读取和总耗时均有独立超时。
- 下载流式写入权限受限的临时文件，不将完整视频载入内存。
- 模型调用 SHALL 使用受控临时文件上传至 Files API，不把用户 URL直接交给 Provider 二次抓取。
- 无论成功、失败、取消或超时，临时文件和已上传的临时 File SHALL best-effort 清理。

#### Scenario: 拒绝 SSRF URL

- **WHEN** URL 指向 localhost、私网、链路本地、云元数据地址，或重定向到这些地址
- **THEN** 接口以 `invalid_video_url` 拒绝
- **AND** 不向目标发送后续请求
- **AND** 错误响应不回显完整 URL 或 DNS 结果

#### Scenario: 下载过大或非视频

- **WHEN** Content-Length 超限、流式读取超过上限或内容不是受支持视频
- **THEN** 接口以 `invalid_video_input` 失败
- **AND** 删除部分临时文件
- **AND** 不调用 ModelArk

### Requirement: 视频元数据与展示尺寸

系统 SHALL 使用 FFprobe 验证临时视频并获取：

- 编码宽度、高度；
- 展示旋转角度；
- 展示宽度、高度；
- 时长；
- 容器和视频 codec。

首期仅接受时长大于 0 且不超过 600 秒、展示宽高均为正数的视频。模型返回的时间不得超过探测时长加 250ms 容差。

#### Scenario: 横向无旋转视频

- **WHEN** 编码尺寸为 `1920×1080` 且无旋转
- **THEN** 展示尺寸为 `1920×1080`
- **AND** 像素 BBox 按该尺寸反算

#### Scenario: 旋转竖屏视频

- **WHEN** 编码尺寸为 `1920×1080` 且旋转为 90°或 270°
- **THEN** 展示尺寸为 `1080×1920`
- **AND** 返回的像素坐标对应竖屏展示空间

### Requirement: Seed Evolving 视频字幕识别

系统 SHALL 使用 ModelArk Responses API 和默认模型 `doubao-seed-evolving` 执行视频理解。

- 临时视频通过 Files API 以 `purpose=user_data` 上传。
- 视频预处理使用请求中的 `sampling_fps`，默认 `2.0`。
- Responses 输入包含一个 `input_video` File ID 和一个固定任务提示词。
- `thinking` 默认关闭，`temperature=0`，设置有限的 `max_output_tokens` 和请求超时。
- 输出使用严格 JSON Schema，不接受 Markdown、解释文本或 schema 外字段；BBox 字段仍须遵循官方 Grounding 标签格式。
- 提示词明确只识别画面硬字幕，不根据音轨补全，不识别 Logo、水印、商品或 UI 文本。
- 提示词明确要求每条字幕的 BBox 使用 `<bbox>x_min y_min x_max y_max</bbox>`，坐标为基于 `1000×1000` 比例空间的 `[0,999]` 整数。

#### Scenario: 模型返回字幕

- **WHEN** 视频中存在一条或多条可见硬字幕
- **THEN** 模型为每条字幕输出 `text`、`start_ms`、`end_ms` 和官方格式的 `bbox`
- **AND** 数组按 `start_ms`、`end_ms` 和原始顺序稳定排序

#### Scenario: 没有硬字幕

- **WHEN** 视频中没有符合定义的硬字幕
- **THEN** 模型返回空 `subtitles` 数组
- **AND** 接口以成功响应返回，不伪造字幕

#### Scenario: 模型调用失败

- **WHEN** Files API 上传、处理等待或 Responses 调用失败
- **THEN** 接口返回稳定的脱敏错误码与阶段
- **AND** best-effort 删除 Provider File
- **AND** 不返回模型原始响应、推理内容或堆栈

### Requirement: 严格字幕结果契约

模型原始结构 SHALL 为：

```json
{
  "subtitles": [
    {
      "text": "示例字幕",
      "start_ms": 1200,
      "end_ms": 2600,
      "bbox": "<bbox>120 820 880 920</bbox>"
    }
  ]
}
```

后端 SHALL 再次执行权威校验：

- `text` trim 后为 1..500 个 Unicode code point，不允许控制字符；
- `start_ms`、`end_ms` 为整数，`0 <= start_ms < end_ms`；
- `bbox` 必须是字符串，且完整匹配 `<bbox>x_min y_min x_max y_max</bbox>`；标签名、尖括号、四个以单个空格分隔的十进制整数和闭合标签均不得缺失，不接受逗号、数组、额外文字或多个 BBox；
- 后端从标签中解析恰好 4 个整数并生成 `bbox_normalized`；
- `0 <= x_min < x_max <= 999` 且 `0 <= y_min < y_max <= 999`；
- 片段数最多 500；
- 完全重复项去重；不擅自合并时间或空间接近的不同片段。

任一片段非法 SHALL 使整个响应以 `invalid_model_output` 失败，不得静默丢弃，以便预研准确暴露模型契约稳定性。

#### Scenario: 模型返回非法坐标

- **WHEN** 任一坐标越界、顺序倒置或不是整数
- **THEN** 整次请求以 `response_validation` 阶段失败
- **AND** 普通日志不记录字幕全文或原始响应

#### Scenario: 模型返回越界时间

- **WHEN** `end_ms` 超过视频时长 250ms 以上
- **THEN** 整次请求以 `invalid_model_output` 失败
- **AND** 不自动截断时间掩盖模型偏差

### Requirement: Grounding 坐标反向解析

后端 SHALL 依据官方 Grounding 教程，将合法的 `[0,999]` 比例坐标转换为展示空间像素坐标。四个坐标均使用 Python `int()` 等价的非负数截断算法：

```text
pixel_x_min = int(x_min * display_width / 1000)
pixel_y_min = int(y_min * display_height / 1000)
pixel_x_max = int(x_max * display_width / 1000)
pixel_y_max = int(y_max * display_height / 1000)
```

后端 SHALL 对转换结果执行边界和正面积校验，不使用 `ceil` 扩张右下角，也不将非法模型坐标静默修正为合法坐标。

#### Scenario: 1920×1080 视频坐标转换

- **WHEN** `bbox_normalized=[100,200,900,800]`
- **AND** 展示尺寸为 `1920×1080`
- **THEN** `bbox_pixels=[192,216,1728,864]`

#### Scenario: 非整除坐标转换

- **WHEN** 归一化坐标不能整除展示尺寸
- **THEN** 四个坐标均使用官方教程的 `int(coord * dimension / 1000)` 算法
- **AND** 不对右下角使用 `ceil`

### Requirement: 实验响应与可观测性

成功响应 SHALL 包含：

```json
{
  "model": "doubao-seed-evolving",
  "video": {
    "width": 1920,
    "height": 1080,
    "duration_ms": 30000,
    "rotation": 0
  },
  "subtitles": [
    {
      "text": "示例字幕",
      "start_ms": 1200,
      "end_ms": 2600,
      "bbox_normalized": [120, 820, 880, 920],
      "bbox_pixels": [230, 885, 1689, 993]
    }
  ],
  "usage": {
    "input_tokens": 0,
    "output_tokens": 0,
    "total_tokens": 0
  },
  "latency_ms": 0
}
```

普通结构化日志 SHALL 仅记录：

- 事件名、结果、错误阶段和安全错误类型；
- 视频字节数、展示宽高、时长和采样 FPS；
- 模型 ID、片段数、Token 用量和延迟；
- Provider request ID 的安全形式。

完整视频 URL、查询参数、字幕全文、模型原始响应和思考内容不得进入 stdout、普通日志、数据库或 API 错误响应。若需要调试原始模型输出，只允许复用 TLS-only 受限事件并显式开启实验调试开关。

#### Scenario: 成功日志

- **WHEN** 实验调用成功
- **THEN** 记录安全统计信息
- **AND** 不记录视频 URL 或字幕文字

#### Scenario: 校验失败日志

- **WHEN** 模型响应未通过 schema 或领域校验
- **THEN** 记录 `phase=response_validation`、异常类型、响应长度和安全摘要
- **AND** 原始响应仅在显式开启时发送至 TLS-only 日志

### Requirement: Mock 与真实冒烟验证

自动化测试 SHALL 默认使用可注入的下载 Transport、FFprobe 结果和 ModelArk Client，不调用真实网络或计费接口。

系统 SHALL 提供显式 opt-in 的真实冒烟脚本，要求：

- 仅从环境变量读取测试视频 URL 和凭据；
- 缺少 `RUN_PAID_MODELARK_SMOKE=true` 时跳过；
- 输出脱敏后的结构化结果摘要，不打印 URL、密钥或完整字幕；
- 运行者明确知晓该调用会产生模型和 Files API 费用；
- 冒烟结果不作为普通 CI 的必过条件。

#### Scenario: 普通测试

- **WHEN** 运行后端 pytest
- **THEN** Provider 调用数为 0
- **AND** 不下载外部视频

#### Scenario: 显式真实冒烟

- **WHEN** 设置完整凭据、视频 URL 和 `RUN_PAID_MODELARK_SMOKE=true`
- **THEN** 脚本执行一次真实 `doubao-seed-evolving` 请求
- **AND** 校验至少响应结构、时间范围和像素坐标边界

## MODIFIED Requirements

### Requirement: ModelArk 适配器

ModelArk 适配器 SHALL 增加隔离的视频字幕定位方法，默认使用 `doubao-seed-evolving`、Files API、Responses API 严格 JSON Schema、官方 Grounding BBox 标签和可注入 Client。现有文本生成、图片生成、视频生成、媒体命名和 AIGC 节点行为保持不变。

### Requirement: 媒体探测

媒体探测能力 SHALL 能读取视频旋转元数据并提供展示方向尺寸。现有上传资产校验仍可使用编码尺寸；新增字段不得改变历史资产 metadata 或既有校验边界。

## REMOVED Requirements

无。

## Non-Goals

- 不开发前端页面、画布节点或交互。
- 不替换现有 MediaKit `video_subtitle_extraction` 和 SRT 资产链路。
- 不创建数据库记录、资产、Run、Task 或缓存。
- 不识别仅存在于音轨中的语音，不做说话人识别或翻译。
- 不按帧返回字幕轨迹，也不处理透视四边形；每个片段只返回一个轴对齐 BBox。
- 不在普通 CI 或自动验收中调用真实计费模型。
