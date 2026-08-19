# 优化角色生成功能 Spec

## Why
当前角色生成固定产出“品牌体验官”和“目标用户”两类角色，和故事文本中的真实角色不一致。需要改为先从故事文本中提取角色，再由用户按角色卡片逐个生成形象，提升角色数量和内容的可控性。

## What Changes
- 废弃首轮角色生成中的固定“品牌体验官”和“目标用户”两类角色分类。
- 角色数量和角色名称完全根据最新故事文本由 Seed 文本模型提取确定。
- 角色页先生成角色卡片，卡片包含角色名字、角色描述/生图提示词、图片预占位、更新时间和操作按钮。
- 角色名字和描述区域支持双击进入编辑，保存后更新角色卡片数据。
- 每张角色卡提供“形象生成”“重新生成”“删除”操作。
- 点击“形象生成”后调用 Seedream 模型生成该角色图片，后端下载并上传到 TOS，前端刷新后加载图片。
- “重新生成”用于已有图片角色重新调用 Seedream 生成新图，并延续既有角色迭代能力。
- **BREAKING**：首轮角色生成不再默认产出“品牌体验官”和“目标用户”两张图片；生成角色阶段先产出角色卡片，图片由用户逐个触发生成。

## Impact
- Affected specs: `enable-character-image-iteration` 的角色重新生成入口；`restructure-creative-workspace` 的角色选项卡；`write-technical-solution` 的 Seed 文本模型、Seedream 生图和 TOS 资产存储方案。
- Affected code: `backend/app/api/routes.py`、`backend/app/services/workflow.py`、`backend/app/services/generation.py`、`backend/app/services/modelark.py`、repository/schema 层、`frontend/components/workspace/project-detail-tabs.tsx`、`frontend/lib/api-client.ts`、相关前后端测试。

## ADDED Requirements
### Requirement: 从故事文本提取角色
The system SHALL extract character definitions from the latest story text before any character image is generated.

#### Scenario: 生成角色卡片成功
- **WHEN** 用户在角色页点击“生成角色”
- **THEN** 后端应读取项目最新成功故事文本
- **AND** 调用 Seed 文本模型从故事文本中提取角色列表
- **AND** 根据提取结果创建角色卡片数据
- **AND** 前端刷新后展示角色卡片而不是直接展示固定角色图片

#### Scenario: 故事文本没有明确角色
- **WHEN** Seed 文本模型未能从故事文本中提取出明确角色
- **THEN** 系统应返回可理解提示，说明当前故事未识别到角色
- **AND** 不应创建“品牌体验官”或“目标用户”等兜底固定角色

#### Scenario: 缺少故事依赖
- **WHEN** 项目没有最新成功故事文本
- **THEN** 系统应拒绝生成角色卡片，并提示用户先生成故事

### Requirement: 角色卡片展示与编辑
The system SHALL display extracted characters as editable cards in the character tab.

#### Scenario: 展示角色卡片
- **WHEN** 项目存在已提取的角色卡片
- **THEN** 角色页应展示每张角色卡片
- **AND** 卡片顶部展示图片预占位或已生成图片
- **AND** 卡片内容展示角色名字、角色描述/生图提示词、更新时间
- **AND** 角色名字右侧展示“形象生成”“重新生成”“删除”按钮

#### Scenario: 双击编辑角色名字
- **WHEN** 用户双击角色名字区域
- **THEN** 前端应进入角色名字编辑态
- **AND** 用户保存后，系统应更新该角色卡片的名字和更新时间

#### Scenario: 双击编辑角色描述
- **WHEN** 用户双击角色描述区域
- **THEN** 前端应进入角色描述编辑态
- **AND** 用户保存后，系统应更新该角色卡片的描述/生图提示词和更新时间

### Requirement: 单角色形象生成
The system SHALL generate a character image only when the user explicitly clicks the image generation action for a character card.

#### Scenario: 点击形象生成
- **WHEN** 用户点击某张角色卡的“形象生成”
- **THEN** 前端应提交该角色卡 ID、角色名字和角色描述/生图提示词
- **AND** 后端应调用 Seedream 模型生成该角色图片
- **AND** 后端应下载生成图片并上传到 `.env` 配置的 TOS
- **AND** 后端应将生成图片作为角色资产写入 MySQL，并关联到该角色卡
- **AND** 前端刷新后应在该卡片顶部展示 TOS 可访问图片

#### Scenario: 形象生成失败
- **WHEN** Seedream 调用、图片下载、TOS 上传或 MySQL 写入失败
- **THEN** 系统应将任务标记为失败
- **AND** 不应创建不完整角色图片资产
- **AND** 前端应保留角色卡片和图片预占位，允许用户再次点击“形象生成”

### Requirement: 单角色重新生成与删除
The system SHALL allow users to regenerate or delete each extracted character independently.

#### Scenario: 重新生成角色图片
- **WHEN** 用户点击已有图片角色卡的“重新生成”
- **THEN** 系统应基于当前角色名字和描述/生图提示词重新调用 Seedream 生成图片
- **AND** 新图片应上传到 TOS 并作为该角色的最新图片展示
- **AND** 历史图片资产应保留可追溯关系

#### Scenario: 删除角色卡
- **WHEN** 用户点击角色卡的“删除”
- **THEN** 系统应删除该角色卡和其关联展示关系
- **AND** 角色页不应再展示该角色卡
- **AND** 删除不应影响故事、剧本或其它角色卡

## MODIFIED Requirements
### Requirement: 角色阶段生成
The system SHALL treat the character stage as a two-step workflow: first extract editable character cards from story text using the Seed text model, then generate each character image on demand using Seedream.

### Requirement: 角色选项卡空态
The system SHALL show the initial empty state when a project has no extracted character cards or all character cards have been deleted, even if stale or inaccessible historical character image assets remain in storage.

### Requirement: 角色资产展示
The system SHALL display character cards as the primary unit in the character tab. A character card may exist without an image; image assets are optional outputs attached to a card after explicit generation.

## REMOVED Requirements
### Requirement: 固定角色分类
**Reason**: 固定“品牌体验官”和“目标用户”无法反映故事文本中的真实角色，且会产生无关角色图片。
**Migration**: 历史已生成的固定角色资产保留在资产库和历史记录中；新的角色生成流程不再创建这两类固定角色。
