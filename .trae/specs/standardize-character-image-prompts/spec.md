# 规范角色形象图提示词 Spec

## Why
当前角色描述会作为后续角色形象生图提示词使用，但描述内容可能包含场景、表情或肢体动作演绎，导致生成结果偏离“角色形象设定图”的用途。需要将角色描述规范为人物或动物三视图、白底背景，并继承项目 Brief 的画面比例约束。

## What Changes
- 角色提取阶段生成的角色描述 SHALL 明确面向“角色形象图/角色设定图”。
- 角色形象 SHALL 特指人物或动物的三视图，白底背景。
- 角色描述 SHALL 避免场景、表情演绎、肢体动作演绎、剧情化画面等内容。
- 角色描述 SHALL 包含项目 Brief 设定的画面比例，并将该比例作为后续生图提示词的一部分。
- 单角色形象生成时，后端组装的最终生图提示词 SHALL 保留三视图、白底背景、无场景、无表情或肢体动作演绎、画面比例等约束。

## Impact
- Affected specs: `optimize-character-generation` 的角色卡片描述/生图提示词要求。
- Affected code: `backend/app/services/modelark.py` 的角色提取提示词，`backend/app/services/generation.py` 的角色卡片生图提示词，相关后端测试。

## ADDED Requirements
### Requirement: 角色描述符合角色形象图规范
The system SHALL generate character descriptions as character image prompts for person or animal turnarounds.

#### Scenario: 从故事提取人物角色
- **WHEN** 系统从故事文本中提取人物角色
- **THEN** 生成的角色描述应描述该人物的三视图角色形象
- **AND** 角色描述应要求白底背景
- **AND** 角色描述不应包含具体场景、表情演绎或肢体动作演绎

#### Scenario: 从故事提取动物角色
- **WHEN** 系统从故事文本中提取动物角色
- **THEN** 生成的角色描述应描述该动物的三视图角色形象
- **AND** 角色描述应要求白底背景
- **AND** 角色描述不应包含具体场景、表情演绎或肢体动作演绎

### Requirement: 角色描述继承 Brief 画面比例
The system SHALL include the project Brief aspect ratio in each generated character description.

#### Scenario: Brief 设置为竖屏比例
- **WHEN** 项目 Brief 的画面比例为 `9:16`
- **THEN** 生成的角色描述应包含 `画面比例：9:16`
- **AND** 后续角色形象生图提示词也应包含该比例约束

#### Scenario: Brief 设置为横屏或方形比例
- **WHEN** 项目 Brief 的画面比例为 `16:9`、`1:1`、`4:3` 或 `3:4`
- **THEN** 生成的角色描述应包含对应的 `画面比例：<aspect_ratio>`
- **AND** 后续角色形象生图提示词也应包含对应比例约束

## MODIFIED Requirements
### Requirement: 从故事文本提取角色
The system SHALL extract concrete person or animal characters from the latest story text and generate each character card description as a clean character image prompt: three-view turnaround, white background, no scene, no expression performance, no body-action performance, and including the project Brief aspect ratio.

### Requirement: 单角色形象生成
The system SHALL generate each character image from the current character card name and description, while preserving the required prompt constraints: person or animal three-view turnaround, white background, no scene, no expression performance, no body-action performance, and the project Brief aspect ratio.

## REMOVED Requirements
### Requirement: 场景化角色描述
**Reason**: 场景化、剧情化或动作化描述会使角色形象图偏离三视图设定用途。
**Migration**: 后续新生成的角色描述和角色形象图提示词统一使用三视图白底规范；历史已保存角色卡不强制迁移，用户可通过编辑描述后重新生成图片。
