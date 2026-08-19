# Brief 目标语言与下游语言一致性 Spec

## Why
当前项目 Brief 没有目标语言字段，角色描述、剧本、分镜脚本和分镜视频提示词中的语言由固定中文模板决定，无法支持英文广告生产。需要让用户在 Brief 中选择中文或英文，并确保所有受影响的后续生成结果使用一致的目标语言。

## What Changes
- Brief 新增必填字段 `target_language`，仅允许 `zh`（中文）和 `en`（英文），默认值为 `zh`。
- 新建项目和编辑 Brief 表单增加“目标语言”选择，项目摘要与 Brief 查看态展示当前语言。
- 数据库 `project_briefs` 表新增非空语言字段；历史项目通过兼容迁移补为 `zh`。
- 角色提取、角色描述/生图提示词、剧本、分镜脚本及结构化镜头字段按 Brief 目标语言生成。
- 分镜视频默认提示词、合并提示词和 AI 优化结果按目标语言生成，并使用对应语言的固定章节与语音约束。
- 英文模式下不得继续注入“中文标题”“普通话语音”等中文专属约束；中文模式保持现有行为。
- 目标语言变更后，故事不作废；角色及其下游文本、提示词和生成阶段标记为需更新，历史产物与素材保留。
- 不自动翻译历史产物，不新增第三种语言，不改变字幕后处理能力。
- 不包含 **BREAKING** 变更；未提供该字段的旧客户端请求和历史数据库记录按中文处理。

## Impact
- Affected specs: 项目 Brief、角色生成、剧本生成、分镜脚本、分镜视频提示词、AI 提示词优化、工作流失效逻辑
- Affected code:
  - `backend/app/schemas/brief.py`
  - `backend/app/schemas/enums.py`
  - `backend/app/db/models.py`
  - `backend/app/db/session.py`
  - `backend/app/repositories/memory.py`
  - `backend/app/repositories/mysql.py`
  - `backend/app/services/modelark.py`
  - `backend/app/services/generation.py`
  - `backend/app/video_prompt.py`
  - `backend/app/api/routes.py`
  - `frontend/lib/api-types.ts`
  - `frontend/components/workspace/project-workspace.tsx`
  - 相关前后端测试

## ADDED Requirements

### Requirement: Brief 目标语言字段
The system SHALL 在 Brief 中保存广告目标语言 `target_language`，其值只能为 `zh` 或 `en`。

#### Scenario: 新建中文项目
- **WHEN** 用户新建项目并选择“中文”
- **THEN** 前端应提交 `target_language: "zh"`，后端应保存并在项目详情中返回该值

#### Scenario: 新建英文项目
- **WHEN** 用户新建项目并选择“英文”
- **THEN** 前端应提交 `target_language: "en"`，后端应保存并在项目详情中返回该值

#### Scenario: 旧客户端未提交语言
- **WHEN** 创建请求未包含 `target_language`
- **THEN** 后端应使用默认值 `zh`，保持现有中文项目行为

#### Scenario: 非法语言值
- **WHEN** 客户端提交 `zh`、`en` 之外的值或显式提交空值
- **THEN** 后端应返回统一的参数校验错误，不保存项目或 Brief 更新

### Requirement: 目标语言界面
The system SHALL 在项目新建、Brief 编辑和 Brief 查看区域提供清晰的目标语言控件与状态展示。

#### Scenario: 选择目标语言
- **WHEN** 用户打开新建项目或编辑 Brief 表单
- **THEN** 页面应提供仅含“中文”和“英文”的选择控件，默认或当前值应正确回显

#### Scenario: 查看当前语言
- **WHEN** 用户查看项目摘要或 Brief 详情
- **THEN** 页面应展示“目标语言”及其中文标签，不要求用户理解内部代码 `zh` / `en`

### Requirement: 英文角色描述
The system SHALL 在 `target_language == "en"` 时生成英文角色名称、角色描述及单角色形象生图提示词。

#### Scenario: 从中文故事提取英文角色
- **WHEN** 英文项目使用中文或英文故事生成角色
- **THEN** 角色名称和 `description` 应使用英文表达，并保持品牌名、人物专名等必要原文

#### Scenario: 英文角色设定图提示词
- **WHEN** 英文项目为角色卡生成角色形象图
- **THEN** 最终生图提示词中的三视图、白底、禁止场景/动作演绎和画幅比例约束均应使用英文

#### Scenario: 中文角色生成保持兼容
- **WHEN** `target_language == "zh"`
- **THEN** 角色提取与角色形象图提示词应保持现有中文规范

### Requirement: 英文剧本
The system SHALL 在 `target_language == "en"` 时生成英文剧本标题和完整正文。

#### Scenario: 生成英文剧本
- **WHEN** 英文项目基于上游故事生成剧本
- **THEN** 标题、场次标题、画面描述、人物动作、对白/旁白、商品露出、节奏说明和行动号召均应使用英文

#### Scenario: 保留专有内容
- **WHEN** Brief 或故事包含品牌名、商品名、人物名或必须保留的专有文本
- **THEN** 英文剧本可保留这些专有内容，不应为了语言一致性篡改其含义

### Requirement: 英文分镜脚本
The system SHALL 在 `target_language == "en"` 时生成英文分镜文本及英文结构化镜头字段。

#### Scenario: 生成英文分镜
- **WHEN** 英文项目基于剧本生成分镜脚本
- **THEN** 分镜标题、正文以及每个镜头的 `title`、`description`、`visual_prompt`、`narration` 应使用英文

#### Scenario: 分镜结构与时长不受语言影响
- **WHEN** 目标语言为英文
- **THEN** 镜头编号、时间边界、总时长校验、参考素材关系和结构化 JSON 契约应保持现有规则

### Requirement: 英文分镜视频提示词
The system SHALL 在 `target_language == "en"` 时构建和优化英文分镜视频提示词。

#### Scenario: 默认单镜头提示词
- **WHEN** 英文项目读取未保存自定义提示词的单镜头视频配置
- **THEN** `effective_video_prompt` 应使用英文固定章节、英文镜头描述和英文语音约束

#### Scenario: 合并镜头提示词
- **WHEN** 英文项目合并多个镜头
- **THEN** 合并提示词的整体要求、连续时间轴、语音和负向约束章节应使用英文，且保留全部原子镜头边界与顺序

#### Scenario: 英文语音约束
- **WHEN** 英文镜头包含旁白或对白
- **THEN** 提示词应要求自然、清晰的英语语音，不得要求普通话

#### Scenario: 英文 AI 优化
- **WHEN** 英文项目执行分镜视频提示词 AI 优化
- **THEN** 优化系统指令、固定章节校验和最终 `optimized_prompt` 应使用英文，并保持剧情、台词含义、时长、时间轴和参考素材关系

#### Scenario: 禁止字幕指令
- **WHEN** 系统生成中文或英文视频提示词
- **THEN** 提示词均不得包含添加字幕、画面文字或字幕样式的指令

### Requirement: 语言变更的精准失效
The system SHALL 在 Brief 目标语言变化时使受语言影响的角色及下游结果失效，但保留不受影响的故事和历史数据。

#### Scenario: 中文切换为英文
- **WHEN** 用户把 `target_language` 从 `zh` 更新为 `en`
- **THEN** 故事产物应保持有效，角色及其下游剧本、分镜、图片、视频和成片状态应标记为需更新

#### Scenario: 英文切换为中文
- **WHEN** 用户把 `target_language` 从 `en` 更新为 `zh`
- **THEN** 应执行相同的角色及下游精准失效规则

#### Scenario: 重复保存相同语言
- **WHEN** 用户保存 Brief 但 `target_language` 未发生变化
- **THEN** 系统不得仅因提交该字段而额外作废已有产物

#### Scenario: 历史产物保留
- **WHEN** 目标语言发生变化
- **THEN** 后端不得物理删除历史角色卡、文本产物、分镜或媒体资产，用户重新生成后再产生新版本

### Requirement: 数据库兼容升级
The system SHALL 为新旧数据库提供一致的目标语言默认值。

#### Scenario: 初始化新数据库
- **WHEN** 系统初始化空数据库
- **THEN** `project_briefs.target_language` 应为非空字段，默认值为 `zh`

#### Scenario: 升级既有数据库
- **WHEN** 系统启动且既有 `project_briefs` 表缺少语言字段
- **THEN** 增量迁移应幂等增加字段，并把所有历史 Brief 设为 `zh`

## MODIFIED Requirements

### Requirement: Brief 创建与更新
The system SHALL 在 Brief 创建、读取、列表摘要和原子更新契约中包含 `target_language`，并在内存仓储与 SQLAlchemy 仓储中保持一致。

#### Scenario: 更新语言并返回最新项目
- **WHEN** 用户通过项目更新 API 修改目标语言
- **THEN** 更新应原子持久化，响应中的项目和后续项目列表均应返回最新语言

### Requirement: 生成模型请求
The system SHALL 让真实 ModelArk 适配器与 mock 适配器同时遵守 Brief 目标语言，确保开发测试结果与生产提示词契约一致。

#### Scenario: 英文 mock 结果
- **WHEN** 测试或本地环境为英文项目调用 mock 生成
- **THEN** mock 角色、剧本、分镜和视频提示词结果也应使用英文，而不是继续返回中文模板

### Requirement: 视频提示词验证
The system SHALL 根据目标语言选择对应的固定章节集合，并继续验证章节顺序、唯一性、时间轴、字符上限、引用 token 和字幕禁用规则。

#### Scenario: 中英文契约分别校验
- **WHEN** 校验中文或英文结构化视频提示词
- **THEN** 系统应接受与目标语言匹配的章节，拒绝缺少章节、章节混用或顺序错误的结果

## REMOVED Requirements

### Requirement: 所有下游生成固定使用中文
**Reason**: Brief 已支持英文广告目标语言，角色描述、剧本、分镜及视频提示词不能继续由中文硬编码决定。

**Migration**: 历史项目和未携带语言字段的请求默认使用 `zh`；仅在项目明确选择 `en` 后启用英文生成契约。
