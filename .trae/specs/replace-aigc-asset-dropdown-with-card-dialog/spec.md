# AIGC 媒体资产卡片选择弹窗 Spec

## Why

AIGC 图片、视频和音频输入节点当前使用原生下拉菜单选择资产。资产较多时菜单只展示名称或 UUID，用户无法通过画面、时长和规格识别素材，选择效率低且容易选错。

## What Changes

- 将 AIGC 图片、视频和音频输入节点的资产下拉菜单替换为宽屏卡片选择弹窗。
- 弹窗按当前节点模态过滤资产，并展示缩略图或媒体类型占位、可读名称、规格、来源和创建时间。
- 支持按名称、文件名、资产 ID、MIME 类型和来源搜索。
- 单击卡片只更新弹窗内临时选择，点击“确认选择”后才写入节点；取消或关闭不改变节点。
- UUID 等不可读名称自动显示为“图片/视频/音频素材 + 北京时间”，并保留短 ID 用于区分和检索。
- 保留本地上传、当前资产摘要和不可用资产提示。

## Impact

- Affected specs: AIGC 媒体输入节点、资产选择交互。
- Affected code:
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/components/workspace/aigc/aigc-media-asset-dialog.tsx`
  - `frontend/tests/aigc-editor.test.tsx`

## ADDED Requirements

### Requirement: 媒体资产卡片选择

系统 SHALL 为 AIGC 图片、视频和音频输入节点提供宽屏卡片选择弹窗。

#### Scenario: 浏览兼容资产

- **WHEN** 用户点击“从资产库选择图片/视频/音频”
- **THEN** 系统打开对应模态的资产选择弹窗
- **AND** 仅展示状态可用且类型兼容的项目资产、工具资产和 AIGC 资产
- **AND** 每张卡片展示可读名称、预览、媒体规格、来源、创建时间和短 ID

#### Scenario: 搜索资产

- **WHEN** 用户输入名称、文件名、资产 ID、MIME 类型或来源
- **THEN** 列表实时筛选匹配资产
- **AND** 无匹配结果时展示明确空状态

#### Scenario: 确认单选

- **WHEN** 用户选择一张资产卡片并点击“确认选择”
- **THEN** 节点的 `asset_id` 更新为该资产
- **AND** 弹窗关闭

#### Scenario: 取消临时选择

- **WHEN** 用户改变弹窗内选择后点击取消或关闭
- **THEN** 节点保持打开弹窗前的资产引用

#### Scenario: 不可读名称

- **WHEN** 资产名称为空或为 UUID 等不透明标识
- **THEN** 卡片以媒体类型和北京时间生成可读名称
- **AND** 卡片详情保留短 ID，搜索仍支持完整 ID

#### Scenario: 响应式展示

- **WHEN** 用户在桌面端打开弹窗
- **THEN** 资产以三列卡片网格展示
- **WHEN** 用户在窄屏打开弹窗
- **THEN** 卡片收敛为单列且弹窗不产生页面横向溢出

## MODIFIED Requirements

### Requirement: AIGC 媒体输入节点

系统 SHALL 保留本地上传、当前资产摘要和不可用资产提示，并使用卡片弹窗代替原生下拉菜单完成资产库选择。

## REMOVED Requirements

### Requirement: 原生下拉菜单选择媒体资产

**Reason**: 无法展示预览和足够的识别信息，资产多时难以定位。

**Migration**: 节点继续保存同一 `asset_id`，无需数据迁移。
