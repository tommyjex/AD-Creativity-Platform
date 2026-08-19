# 分镜脚本生成模块 Spec

## Why
当前分镜脚本阶段已有入口和首版 mock 结果，但生成逻辑未严格依赖最新剧本，也没有稳定按 brief 设定的视频总时长拆解镜头。需要补齐基于 Seed 文本模型的分镜脚本生成能力，让剧本能被拆解为可执行、可追踪、可用于后续生图和生视频的镜头列表。

## What Changes
- 后端分镜脚本阶段必须读取当前项目最新成功的 `script` 文本产物；缺失或过期时拒绝生成。
- 后端通过文本生成适配层调用 Seed 文本模型，基于剧本正文和完整 brief 生成分镜脚本。
- 分镜结果同时保存为 `storyboard` 阶段文本产物，并写入结构化 `StoryboardShot` 列表。
- 每个镜头包含镜头编号、时长、画面描述、主体/场景、运镜、旁白或字幕、音效和转场建议等信息。
- 结构化镜头的 `duration_seconds` 总和应参考 brief 的 `duration_seconds`，并在可控容差内匹配目标总时长。
- 工作台项目详情展示分镜脚本文本和结构化镜头列表，任务成功后刷新项目详情。
- 分镜生成任务支持运行状态、失败脱敏、重试和下游 stale 规则。
- **BREAKING**：无；保留现有故事、角色、剧本、图片、视频和剪辑接口兼容。

## Impact
- Affected specs: `create-ad-video-prd` 的分镜脚本生成需求；`write-technical-solution` 的文本模型与工作流编排；`implement-backend-modules` 的分镜阶段 API；`restructure-creative-workspace` 的创作流程管理。
- Affected code: FastAPI 分镜生成路由、WorkflowService 阶段依赖、ModelArk 文本适配层、分镜 schema/仓储写入、工作台项目详情 Tabs/分镜展示、后端和前端测试。

## ADDED Requirements
### Requirement: 基于剧本和 Brief 生成分镜脚本
The system SHALL 使用最新成功剧本和项目 brief 调用 Seed 文本模型生成分镜脚本。

#### Scenario: 分镜脚本生成成功
- **WHEN** 项目存在最新成功剧本，且用户触发分镜脚本生成
- **THEN** 后端应读取该剧本和项目 brief，并生成包含镜头编号、镜头时长、画面描述、主体/场景、运镜、旁白或字幕、音效和转场建议的分镜脚本
- **AND** 系统应将结果保存为 `storyboard` 阶段文本产物，状态为 `succeeded`
- **AND** 系统应写入按镜头编号排序的结构化 `StoryboardShot` 列表

#### Scenario: 分镜脚本继承剧本内容
- **WHEN** 系统生成分镜脚本
- **THEN** 分镜脚本应体现剧本中的场次、人物动作、商品露出、台词/旁白和转化号召
- **AND** 每个镜头应能从描述或旁白中看出其对应的剧本片段或叙事目的

#### Scenario: 分镜脚本体现 Brief 约束
- **WHEN** 系统生成分镜脚本
- **THEN** 分镜脚本应体现 brief 中的商品名称、广告需求、投放平台、画面比例、视频时长、视觉风格和目标受众

### Requirement: 分镜总时长约束
The system SHALL 使结构化分镜镜头总时长参考 brief 的视频时长设定。

#### Scenario: 总时长匹配 Brief
- **WHEN** brief 设置了 `duration_seconds`
- **THEN** 生成的全部 `StoryboardShot.duration_seconds` 之和应等于或合理接近该时长
- **AND** 自动化测试应使用明确容差验证总时长，避免浮点舍入导致误判

#### Scenario: 镜头时长有效
- **WHEN** 系统保存结构化分镜镜头
- **THEN** 每个镜头的 `duration_seconds` 必须大于 0，且镜头编号从 1 开始连续递增

### Requirement: 分镜生成依赖校验
The system SHALL 在分镜脚本生成前校验最新成功剧本依赖。

#### Scenario: 缺少成功剧本
- **WHEN** 项目没有成功剧本，且用户触发分镜脚本生成
- **THEN** 后端应拒绝生成请求，返回可理解的依赖缺失错误，不创建分镜文本产物，也不替换已有分镜镜头

#### Scenario: 上游剧本过期或变更
- **WHEN** 剧本被编辑或重新生成导致下游分镜过期
- **THEN** 用户重新触发分镜生成时，系统应基于最新成功剧本和最新 brief 生成新的分镜文本版本和镜头列表

### Requirement: 分镜生成任务状态
The system SHALL 管理分镜脚本生成任务的创建、运行、成功、失败和重试状态。

#### Scenario: 创建分镜任务
- **WHEN** 用户触发分镜脚本生成
- **THEN** 系统应创建 `storyboard` 阶段任务并进入 `running` 或后续完成状态

#### Scenario: 分镜生成失败
- **WHEN** Seed 文本模型调用、结果解析或镜头写入失败
- **THEN** 任务应标记为 `failed`
- **AND** API 和前端错误提示不得暴露密钥、堆栈或供应商原始敏感错误
- **AND** 用户应能通过现有任务重试入口重新触发

### Requirement: 分镜结果展示
The system SHALL 在工作台项目详情展示最新分镜脚本和镜头列表。

#### Scenario: 查看分镜脚本
- **WHEN** 分镜脚本生成成功并返回项目详情
- **THEN** 工作台应展示分镜标题、状态、版本、更新时间、正文内容和结构化镜头列表

#### Scenario: 分镜任务刷新
- **WHEN** 用户触发分镜生成任务
- **THEN** 前端应展示运行状态，并在任务成功后刷新项目详情，显示最新分镜文本和镜头列表

## MODIFIED Requirements
### Requirement: 工作台创作流程管理
The system SHALL 在工作台项目详情中按“故事、角色、剧本、分镜脚本、分镜视频、剪辑成片”推进创作流程，其中分镜脚本阶段必须基于最新成功剧本和 brief 时长约束生成可供生图、生视频阶段使用的结构化镜头。

### Requirement: ModelArk 文本生成适配层
The system SHALL 使用文本生成适配层支持故事生成、剧本生成和分镜脚本生成；分镜脚本生成必须显式接收剧本内容和 brief 约束，并调用配置的 Seed 文本模型，不得只返回与剧本无关的固定占位镜头。

## REMOVED Requirements
### Requirement: 分镜脚本可在缺少剧本时生成占位内容
**Reason**: 分镜脚本是剧本的镜头化执行稿，缺少成功剧本会导致下游生图、生视频依据不可靠。
**Migration**: 历史已有占位分镜不迁移；新触发的分镜生成必须通过最新成功剧本依赖校验。
