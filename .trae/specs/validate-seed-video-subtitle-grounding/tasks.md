# Tasks

- [x] Task 1: 定义实验请求、响应与配置契约。
  - [x] SubTask 1.1: 新增管理员实验接口的请求、视频元数据、字幕片段、BBox、用量和响应 Pydantic schema。
  - [x] SubTask 1.2: 将字幕定位默认模型配置为 `doubao-seed-evolving`，增加实验开关、默认/边界采样 FPS、下载上限、下载超时和模型超时配置。
  - [x] SubTask 1.3: 定义稳定错误码与阶段，包括 URL 校验、下载、媒体探测、Files 上传/处理、Responses 调用、响应校验和清理。
  - [x] SubTask 1.4: 添加 schema 与配置测试，覆盖字段边界、额外字段拒绝、生产默认关闭和显式启用。

- [x] Task 2: 实现安全远程视频获取与展示元数据探测。
  - [x] SubTask 2.1: 实现 HTTPS URL 结构、DNS 公网地址和每跳重定向校验，拒绝 userinfo、fragment、私网、链路本地和云元数据目标。
  - [x] SubTask 2.2: 使用可注入 `httpx` Transport 将响应流式写入权限受限临时文件，执行 MIME、Content-Length、实际字节、重定向数量与超时限制。
  - [x] SubTask 2.3: 扩展 FFprobe 读取 rotation/display matrix，并生成编码尺寸、旋转、展示尺寸、时长、容器和 codec。
  - [x] SubTask 2.4: 确保成功、下载失败、探测失败、取消和超时均清理临时文件。
  - [x] SubTask 2.5: 添加 SSRF、DNS、重定向、过大、非视频、横竖屏旋转、时长与清理测试。

- [x] Task 3: 实现 Seed Evolving 字幕定位适配器。
  - [x] SubTask 3.1: 定义固定字幕识别 prompt 和严格 JSON Schema，限制最多 500 条字幕；每条包含文字、时间和完整匹配 `<bbox>x_min y_min x_max y_max</bbox>` 的官方 Grounding 字符串。
  - [x] SubTask 3.2: 通过 Files API 上传临时视频并等待处理，使用 `sampling_fps` 预处理配置。
  - [x] SubTask 3.3: 调用 Responses API，使用 `input_video` File ID、关闭 thinking、`temperature=0`、有限输出 Token 和独立超时。
  - [x] SubTask 3.4: 解析 SDK/Raw Response 输出文本、usage 和 request ID，兼容已知 SDK 反序列化问题且不泄露原始响应。
  - [x] SubTask 3.5: 对 Provider File 执行 best-effort 删除，并区分上传、处理、推理、解析和清理阶段。
  - [x] SubTask 3.6: 添加可注入 Client 测试，覆盖成功、空结果、上传/处理失败、Responses 失败、非法 JSON/schema、超时、用量和清理。

- [x] Task 4: 实现结果校验与坐标反算。
  - [x] SubTask 4.1: 严格解析官方 `<bbox>` 标签，权威校验字幕文字、整数毫秒时间、视频时长容差、4 个 `[0,999]` 整数、坐标顺序、片段上限与控制字符。
  - [x] SubTask 4.2: 完全重复项去重后按开始时间、结束时间和原始序号稳定排序，不合并近似片段。
  - [x] SubTask 4.3: 按官方教程对四个坐标统一使用 `int(coord * dimension / 1000)`，将比例坐标转换为展示空间像素坐标并校验边界与正面积。
  - [x] SubTask 4.4: 添加官方标签格式、数组/逗号/额外文本拒绝、横屏、旋转竖屏、非整除、`0/999` 边界、正面积、非法坐标、非法时间、超长文本和 500/501 条测试。

- [x] Task 5: 暴露隔离的管理员实验接口和安全日志。
  - [x] SubTask 5.1: 新增实验服务编排下载、探测、Provider 调用、结果校验、坐标转换和清理。
  - [x] SubTask 5.2: 增加依赖注入工厂和 `POST /api/experiments/video-subtitle-grounding`，限制管理员访问并实现生产关闭时 404。
  - [x] SubTask 5.3: 映射稳定 HTTP 状态与脱敏错误，确保 API 错误不含 URL、查询参数、字幕全文、原始响应或堆栈。
  - [x] SubTask 5.4: 记录安全结构化成功/失败事件；仅在显式实验调试开关下将截断原始模型输出写入 TLS-only 日志。
  - [x] SubTask 5.5: 添加路由与服务测试，覆盖权限、功能开关、成功、空结果、各失败阶段、取消和日志脱敏。

- [x] Task 6: 完成非计费回归与显式真实冒烟入口。
  - [x] SubTask 6.1: 添加 opt-in 真实冒烟测试或脚本，仅在 `RUN_PAID_MODELARK_SMOKE=true` 且配置完整时执行一次真实调用。
  - [x] SubTask 6.2: 真实冒烟仅输出模型、视频尺寸/时长、片段数、Token、延迟和坐标边界校验，不打印敏感信息或完整字幕。
  - [x] SubTask 6.3: 运行新增 schema、下载、探测、适配器、坐标和路由测试，确认普通测试 Provider/外网调用为 0。
  - [x] SubTask 6.4: 运行相关 ModelArk、媒体探测与认证路由回归，以及 Ruff 致命错误检查、compileall 和 `git diff --check`。
  - [x] SubTask 6.5: 记录真实冒烟为可选人工证据；未提供真实视频 URL 或未授权计费时不得将其误报为已验证。

# Task Dependencies

- Task 2、Task 3 依赖 Task 1，可并行。
- Task 4 依赖 Task 1 和 Task 2 的展示尺寸契约，可与 Task 3 并行。
- Task 5 依赖 Task 2、Task 3 和 Task 4。
- Task 6 依赖 Task 1 至 Task 5。
