# 资产库功能更新 Spec

## Why
当前资产库只展示“角色 / 场景”两类资产：`workspace-asset-library.tsx` 硬编码 `CATEGORIES = ["character", "scene"]`，并通过 `assets.filter((a) => a.category !== null)` 丢弃所有 `category=null` 的资产。这导致创作过程中真正的“产物”——分镜视频片段（`storyboard_video`）、视频编辑结果（`final_video`）以及分镜视频派生的尾帧图——完全无法在资产库中查看与管理。同时资产库缺少删除入口和分页，资产数量增多后不利于浏览和治理。

本次更新把资产库重构为“角色 / 场景 / 商品 / 产物”四个分区，暴露产物类资产，并补齐删除与分页能力。

## What Changes
- 资产库分区从“角色 / 场景”扩展为四个分区：**角色（character）、场景（scene）、商品（product）、产物（artifacts）**。
- **商品分区**：本期仅预留分区与筛选项，展示空态占位（“商品资产上传能力即将开放”类文案）。不新增后端商品资产模型，也不新增上传入口（`product` 目前仅为 `brief.product_name` 文本，无商品资产）。
- **产物分区**：按资产 `type` 归类，不改动数据模型（这些资产 `category` 保持 `null`）。产物包含三类子项：
  - 分镜视频片段：`AssetType.STORYBOARD_VIDEO`
  - 尾帧图：由 `STORYBOARD_VIDEO` 资产的 `metadata.last_frame_status === "available"` 派生为虚拟展示卡片，复用 `GET /api/assets/{asset_id}/last-frame` 内容端点（尾帧不是独立资产行）。
  - 视频编辑结果：`AssetType.FINAL_VIDEO`
- **资产删除**：资产库卡片新增删除入口，调用既有后端 `DELETE /api/projects/{project_id}/assets/{asset_id}`（前端 `apiClient.deleteAsset`）。删除需二次确认。尾帧图为派生卡片，删除时删除其宿主 `STORYBOARD_VIDEO` 资产（并在 UI 明确提示“将同时删除对应分镜视频片段”）。
- **分页展示**：资产库支持分页。前端在客户端对当前分区/筛选结果做分页展示（默认每页固定条数），不依赖后端新增分页参数；后端 `list_assets` 与 `GET /api/assets` 保持现状。
- 资产库需从 server component 拆分出承载删除/分页交互的 client component。
- 顶层筛选“资产类型”下拉扩展为“角色 / 场景 / 商品 / 产物”四类（沿用现有 URL query 过滤心智）；`product` 与 `artifacts` 作为前端聚合分区，不直接透传为后端 `category` 参数。

## Impact
- Affected specs: 前端资产库展示与治理、资产分类模型（前端聚合层）
- Affected code:
  - [frontend/components/workspace/workspace-asset-library.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/workspace-asset-library.tsx)（四分区、删除、分页；拆分 client 交互组件）
  - [frontend/app/workspace/assets/page.tsx](file:///Users/bytedance/AD-Creativity/frontend/app/workspace/assets/page.tsx)（筛选解析扩展至新分区）
  - [frontend/lib/asset-display.ts](file:///Users/bytedance/AD-Creativity/frontend/lib/asset-display.ts)（分区标签、产物子类型标签、尾帧派生展示辅助）
  - [frontend/lib/api-client.ts](file:///Users/bytedance/AD-Creativity/frontend/lib/api-client.ts)（复用既有 `deleteAsset`，如需可扩展 `AssetFilters`）
  - [frontend/tests/workspace-asset-library.test.tsx](file:///Users/bytedance/AD-Creativity/frontend/tests/workspace-asset-library.test.tsx)（新增四分区、产物展示、删除、分页断言）
- Not changed（明确排除）:
  - 后端 `AssetCategory` 枚举、`list_assets` 签名、`GET /api/assets` 接口保持不变。
  - 不新增商品资产模型或商品上传接口。
  - 删除复用既有后端接口，不新增删除端点。

## ADDED Requirements

### Requirement: 资产库四分区展示
资产库 SHALL 将资产组织为“角色 / 场景 / 商品 / 产物”四个分区。角色分区展示 `category=character` 资产，场景分区展示 `category=scene` 资产，产物分区按资产 `type` 聚合展示分镜视频片段、尾帧图与视频编辑结果，商品分区在本期展示空态占位。

#### Scenario: 展示产物类资产
- **WHEN** 项目存在 `type=storyboard_video` 或 `type=final_video` 的资产
- **THEN** 这些资产在“产物”分区中展示，且不因 `category=null` 被过滤丢弃

#### Scenario: 展示尾帧图
- **WHEN** 某 `storyboard_video` 资产的 `metadata.last_frame_status` 为 `"available"`
- **THEN** 产物分区额外展示一张“尾帧图”卡片，其预览取自 `/assets/{asset_id}/last-frame`

#### Scenario: 商品分区空态
- **WHEN** 用户查看“商品”分区
- **THEN** 展示空态占位文案，说明商品资产能力尚未开放，且不报错

### Requirement: 资产删除
资产库 SHALL 为可管理资产提供删除入口，删除前进行二次确认，删除通过既有接口 `DELETE /api/projects/{project_id}/assets/{asset_id}` 完成。

#### Scenario: 确认后删除资产
- **WHEN** 用户点击某资产的删除入口并在确认弹窗中确认
- **THEN** 前端调用 `apiClient.deleteAsset(project_id, asset_id)`，成功后该资产从列表移除

#### Scenario: 取消删除
- **WHEN** 用户在确认弹窗中取消
- **THEN** 不发起删除请求，资产保留

#### Scenario: 删除尾帧图卡片
- **WHEN** 用户删除一张“尾帧图”派生卡片
- **THEN** 确认弹窗提示将同时删除对应分镜视频片段，确认后删除其宿主 `storyboard_video` 资产

### Requirement: 资产分页展示
资产库各分区 SHALL 在资产条数超过每页阈值时进行分页展示，提供页码/翻页控制，切换分页不重新请求后端。

#### Scenario: 超过阈值分页
- **WHEN** 某分区可展示资产条数超过每页阈值
- **THEN** 仅渲染当前页资产，并提供翻页控制

#### Scenario: 未超过阈值不分页
- **WHEN** 某分区资产条数不超过每页阈值
- **THEN** 一次性展示全部资产，不显示翻页控制

## MODIFIED Requirements

### Requirement: 资产库分类集合
资产库分类集合 SHALL 从“角色 / 场景”扩展为“角色 / 场景 / 商品 / 产物”。“产物”按资产 `type`（`storyboard_video` / `final_video` 及派生尾帧图）聚合，而非依赖后端 `category` 字段；`category=null` 的资产不再被无条件过滤丢弃。

### Requirement: 资产库筛选项
资产库“资产类型”筛选 SHALL 提供“角色 / 场景 / 商品 / 产物”四个选项。选择“角色 / 场景”按 `category` 透传后端筛选；选择“商品 / 产物”为前端聚合分区筛选，不透传为后端 `category` 参数。

## Notes / Constraints
- 遵循用户交互偏好：删除采用弹窗二次确认（复用 [dialog.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/ui/dialog.tsx)），不在页面内联滚动确认。
- 产物归类采用“按资产 type 分类”方案，不新增 `AssetCategory.ARTIFACT`，不做历史数据回填。
- 商品采用“预留分类 + 空态占位”方案，后续单独接入商品图上传时再扩展后端。
- 前端测试与验证在项目约定下运行（`npm test` / `npm run typecheck` / `npm run lint`）。
