# 画布化图片编辑 Spec

## Why

当前图片项目支持单图 bbox 编辑和图层拆分，但操作入口分散在图片卡片和弹窗中，无法直观表达参考图对象替换、精准区域编辑与图层变换。需要将这些能力收敛到画布优先的编辑体验，使用户能直接在图像上完成选择、指令和结果生成。

## What Changes

- 新增图片编辑画布工作区，支持将一张图片设为目标图，并并排加载最多 10 张项目参考图。
- 支持在目标图和参考图上框选区域；用户输入指令后，将参考图对象引用到目标图的指定区域。
- 自动生成带图片编号和 `bbox` 坐标的 Seedream 5.0 Pro 编辑上下文，用户无需手动输入坐标标签。
- 将现有单图区域编辑迁移为画布工具：在目标图框选区域并输入指令，调用 Seedream 5.0 Pro 精准编辑。
- 将现有图层拆分后的移动、缩放、编辑能力整合进画布编辑器，突出图层的直接操控。
- 保留现有图片版本、任务冻结、失败重试、图层集合 revision 和内部资产隔离语义。

## Impact

- Affected specs: `add-image-asset-project-workflow`
- Affected code:
  - `frontend/components/workspace/image-project-workspace.tsx`
  - `frontend/components/workspace/image-edit-dialog.tsx`
  - `frontend/components/workspace/layer-editor-dialog.tsx`
  - `frontend/lib/api-client.ts`
  - `frontend/lib/api-types.ts`
  - `backend/app/schemas/image_generation.py`
  - `backend/app/api/routes.py`
  - `backend/app/services/generation.py`
  - `backend/app/services/modelark.py`
  - 图片生成、图层编辑相关前后端测试

## ADDED Requirements

### Requirement: 多参考图区域对象替换

系统 SHALL 允许用户在画布中选择一张目标图和一张或多张参考图，在目标图和参考图各框选一个区域，并将参考图框选区域内的对象引用或替换到目标图的框选区域。

#### Scenario: 成功提交对象替换

- **WHEN** 用户选择目标图、至少一张参考图，分别在目标图和参考图完成有效 bbox 框选，并输入非空编辑指令
- **THEN** 系统将目标图、参考图、各自图片编号和归一化 bbox 坐标冻结为一次图片编辑任务
- **AND THEN** 调用 Seedream 5.0 Pro 多图编辑能力生成新的公共图片版本
- **AND THEN** 新版本记录目标源图片、参考图片 ID 列表、区域标注和最终指令元数据

#### Scenario: 自动带入区域上下文

- **WHEN** 用户完成任一画布框选
- **THEN** 指令面板显示不可手工篡改的图片编号与 bbox 引用条目
- **AND THEN** 生成任务使用这些结构化数据生成模型指令，不信任用户输入的原始坐标标签

#### Scenario: 不完整选择不可提交

- **WHEN** 用户未选择目标图、未选择参考图、任一所需 bbox 无效，或未输入指令
- **THEN** 生成操作保持禁用并显示对应的可恢复提示

### Requirement: 单图精准区域编辑画布

系统 SHALL 在同一画布工作区支持单张目标图的 bbox 精准编辑。

#### Scenario: 单图区域编辑

- **WHEN** 用户仅选择一张目标图，在画布上框选有效区域并输入编辑指令
- **THEN** 系统调用现有 Seedream 5.0 Pro 单图精准编辑链路
- **AND THEN** 自动将目标图片编号和归一化 bbox 坐标加入最终指令
- **AND THEN** 成功结果作为新的不可变图片版本，不覆盖源图或当前成品

#### Scenario: 选择工具切换

- **WHEN** 用户在画布中切换“单图编辑”与“参考图替换”模式
- **THEN** 画布仅显示该模式需要的选择槽和框选标记
- **AND THEN** 已完成但不适用于当前模式的临时框选不参与提交

### Requirement: 图层画布直接编辑

系统 SHALL 在拆分后的图层画布中支持选择图层、移动、等比缩放，以及对选中图层发起 Seedream 编辑。

#### Scenario: 图层变换与保存

- **WHEN** 用户在图层画布选择一个非底图图层并拖动或缩放
- **THEN** 画布即时按底图坐标系预览变换
- **AND THEN** 用户保存后沿用集合 revision 乐观锁持久化图层位置和缩放

#### Scenario: 图层内容编辑

- **WHEN** 用户选择一个非底图图层并输入编辑指令
- **THEN** 系统使用该图层作为源图调用 Seedream 5.0 Pro 编辑
- **AND THEN** 成功结果替换该图层的内部图像资产引用，并保留原始图层资产可追溯
- **AND THEN** 图层集合 revision 递增，冲突时不覆盖远端状态

### Requirement: 画布优先交互与响应式可用性

系统 SHALL 将图片编辑入口呈现为宽屏画布工作区，而非以表单或卡片为中心的流程。

#### Scenario: 桌面工作区

- **WHEN** 用户打开图片编辑
- **THEN** 主区域显示目标图和参考图画布，右侧显示指令、已选区域引用、模式与生成操作
- **AND THEN** 参考图缩略图区支持清晰显示图片编号、选择状态和区域标记

#### Scenario: 移动端工作区

- **WHEN** 视口不足以并列显示画布和指令面板
- **THEN** 指令与素材面板以抽屉或堆叠区域呈现
- **AND THEN** 画布、框选手柄和主要操作均可访问且不发生重叠或横向溢出

## MODIFIED Requirements

### Requirement: 图片编辑任务输入

图片编辑任务 SHALL 支持单图和多参考图两种冻结输入。多参考图输入必须保存目标图、按顺序排列的参考图、每个区域的图片编号与 bbox 快照、用户指令、规范化最终指令、模型与输出参数；失败重试必须使用原冻结输入。

### Requirement: 图层编辑状态

图层编辑 SHALL 保持现有移动、缩放、可见性、排序与 revision 语义，并扩展为支持替换选中图层的内容资产。底图仍不可被移动、缩放或内容编辑。

## REMOVED Requirements

### Requirement: 独立单图编辑弹窗作为主要编辑入口

**Reason**: 画布工作区需要同时容纳目标图、参考图、区域标注和图层操控，独立弹窗不再适合作为主要工作流。

**Migration**: 现有图片卡片“编辑”操作改为打开画布编辑器，并预选该卡片为目标图；既有单图编辑 API 保持兼容。
