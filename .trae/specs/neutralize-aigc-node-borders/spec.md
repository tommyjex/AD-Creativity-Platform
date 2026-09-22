# AIGC 画布节点中性边框 Spec

## Why

AIGC 画布当前使用文本蓝、图片绿、视频橙、音频玫红等模态颜色绘制节点最外层边框。彩色边框视觉权重较高，使画布在节点较多时显得杂乱。用户已在视觉对比中选择方案 A：去掉节点边框的模态颜色，保留统一中性边框。

## What Changes

- 所有 AIGC 画布节点的最外层边框统一使用现有 `border-border` 中性灰。
- 普通态和选中态均不再使用模态颜色或主色作为节点边框颜色。
- 选中节点继续使用现有 `ring-2 ring-primary/20` 蓝色光环表达选择状态。
- 文本、图片、视频、音频等端口颜色保持不变。
- 连线颜色、节点库图标颜色和节点内部控件边框保持不变。
- 不修改节点数据、自动保存、运行、拖拽、连线或响应式行为。

## Design Decision

采用视觉方案 A“中性灰边框”。节点仍保留 `1px` 外边框，以维持深色画布中的结构边界和卡片辨识度；仅移除边框的模态着色。相比完全无边框，该方案在低对比度背景上更稳定；相比仅选中态描边，该方案可避免未选中节点与画布融为一体。

## Requirements

### Requirement: 节点外边框统一

系统 SHALL 为所有 AIGC 画布节点使用统一中性外边框。

#### Scenario: 模态节点

- **WHEN** 画布渲染文本、图片、视频或音频节点
- **THEN** 节点最外层使用 `border-border`
- **AND** 不设置 `--aigc-modality-*-border` 内联边框颜色

#### Scenario: 模型与控制节点

- **WHEN** 画布渲染模型或控制节点
- **THEN** 节点最外层继续使用 `border-border`
- **AND** 视频增强、人脸打码、字幕提取等节点不再使用视频橙色边框

### Requirement: 选中态保持清晰

- **WHEN** 用户选中任意节点
- **THEN** 节点继续显示 `ring-2 ring-primary/20`
- **AND** 节点边框仍为 `border-border`
- **AND** 不切换为 `border-primary`

### Requirement: 模态识别与功能不变

- **WHEN** 节点边框改为中性颜色
- **THEN** 端口、连线和节点库图标继续使用现有模态颜色
- **AND** 节点尺寸、标题、内容、拖拽、缩放、连接和运行行为不变

## Affected Files

- `frontend/components/workspace/aigc/aigc-flow-node.tsx`
- `frontend/tests/aigc-flow-node.test.tsx`
- `frontend/scripts/verify-aigc-workbench-layout.mjs`
