# Tasks
- [x] Task 1: 补齐分镜生成后端依赖与工作流。
  - [x] SubTask 1.1: 将 `storyboard` 阶段改为依赖最新成功 `script` 文本产物，缺失或非成功状态时返回依赖缺失错误。
  - [x] SubTask 1.2: 在分镜生成服务中显式传入项目 brief 和最新剧本内容，不再允许无剧本生成占位分镜。
  - [x] SubTask 1.3: 生成成功后同时写入 `storyboard` 文本产物和结构化 `StoryboardShot` 列表，并保持任务状态、项目状态和下游 stale 规则正确。

- [x] Task 2: 实现 Seed 文本分镜生成能力。
  - [x] SubTask 2.1: 扩展文本生成适配层的分镜 prompt，明确包含剧本正文、商品、平台、比例、总时长、风格和受众。
  - [x] SubTask 2.2: 让模型输出或 mock 输出可解析为结构化镜头列表，字段覆盖镜头编号、时长、画面描述、主体/场景、运镜、旁白或字幕、音效和转场建议。
  - [x] SubTask 2.3: 实现分镜时长分配与校验，确保镜头总时长在明确容差内匹配 brief `duration_seconds`，且每个镜头时长大于 0。
  - [x] SubTask 2.4: 处理模型调用、结构化解析或数据写入失败，确保任务失败信息和 API 错误脱敏。

- [x] Task 3: 接入工作台分镜脚本展示与任务刷新。
  - [x] SubTask 3.1: 在工作台项目详情中提供分镜脚本查看入口，展示最新 `storyboard` 文本产物的标题、版本、更新时间、状态和正文。
  - [x] SubTask 3.2: 展示结构化分镜镜头列表，包含镜头编号、时长、画面描述、旁白或字幕、视觉提示词和状态。
  - [x] SubTask 3.3: 确认分镜生成按钮、任务状态、失败提示、重试入口和成功后项目详情刷新可用。

- [x] Task 4: 添加自动化测试。
  - [x] SubTask 4.1: 添加后端 API/工作流测试，覆盖缺少成功剧本、分镜成功生成、写入文本产物和镜头列表、失败重试、下游 stale 标记。
  - [x] SubTask 4.2: 添加文本生成适配层测试，验证分镜 prompt 或 mock 输出包含剧本内容、brief 关键字段和总时长约束。
  - [x] SubTask 4.3: 添加时长校验测试，验证结构化镜头总时长与 brief `duration_seconds` 在容差内匹配，镜头编号连续且时长均大于 0。
  - [x] SubTask 4.4: 添加前端测试，覆盖分镜生成触发、任务状态展示、成功刷新、分镜文本展示和镜头列表展示。

- [x] Task 5: 完成验证。
  - [x] SubTask 5.1: 在项目根目录 `.venv` 中运行后端测试。
  - [x] SubTask 5.2: 运行前端 lint、typecheck、test 和 build。
  - [x] SubTask 5.3: 在本地前后端服务中执行一次“剧本已生成 -> 触发分镜脚本生成 -> 查看分镜文本和镜头列表 -> 校验总时长”的 smoke test。

# Task Dependencies
- Task 2 depends on Task 1。
- Task 3 depends on Task 1。
- Task 4 depends on Task 1、Task 2 and Task 3。
- Task 5 depends on Task 4。
