# 字幕源视频码率实施计划

按已批准 spec 在当前会话内联执行。

目标：从实际底片视频流读取 bps，冻结任务编码结果并传递 MediaKit `output.codec.video_bit_rate`。

架构：共享包负责严格的可选码率解析与输出编译；平台负责旧资产的一次性安全探测、缓存及任务快照。供应商任务已提交时跳过解析和编译，仅恢复轮询。

技术栈：Python/Pydantic/FFprobe、FastAPI、Next.js/TypeScript、pytest/Vitest/Playwright。

- [x] 共享元数据增加 `video_bit_rate` 和探测状态；解析仅接受正整数或数字字符串，测试 7000/7000000、容器与音频不同值以及损坏值。
- [x] 共享编译器有效值写入 `output.codec`，缺失提示；测试两类视频文字、PNG、失败回退和独立 render。
- [x] 平台 schema 同步字段；媒体服务新增 `require_video_bit_rate=False`，只有新压制旧底片时按需下载探测，缓存不可用结果。
- [x] render 幂等身份增加 `source-video-bit-rate-v1`；在供应商提交之前持久化源资产、码率、完成状态；旧任务重新提交升级策略，旧已提交任务继续恢复原快照。
- [x] 前端类型和警告文案同步，Vitest 与三视口浏览器验证。
- [x] 更新 0.3.4，构建 wheel/sdist/源码归档、固定 requirements、安装与隔离验证、记录 SHA 并确认旧产物未改。
- [x] 包与平台 pytest、Ruff、编译、前端 lint/typecheck、两仓库 diff 与部署脚本离线检查，更新验收记录。

主要文件与命令见 spec 的“文件与发布”和“验收”。不进行提交、推送、部署或真实计费调用。
