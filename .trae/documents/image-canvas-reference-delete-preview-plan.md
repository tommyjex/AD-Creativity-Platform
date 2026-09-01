# 图片编辑画布参考图删除与目标图预览实施计划

## Summary

本次改动聚焦图片编辑画布的两个体验问题：

1. 已添加到当前图片项目的参考图支持删除。
2. 目标图显示区域降低高度，使画布主要内容更容易在单屏内完整查看；点击目标图可放大查看原图。

实现范围限定在现有 `ImageProjectReadOnlyDetail` + `ImageCanvasEditor` 主路径，不新增路由，不改变底层资产生命周期。参考图“删除”按已确认语义处理为“从当前项目参考图列表移除，后端资产仍保留”，沿用旧 `ImageProjectWorkspace` 中已有文案和 API 模式。

## Current State Analysis

- 当前画布组件为 `frontend/components/workspace/image-canvas-editor.tsx`。
  - 左栏参考图支持展示、框选、清除框选区域，以及无目标图时“设为目标图”。
  - 已有 `onReferenceFiles` 用于添加参考图。
  - 当前没有 `onRemoveReference` 或删除参考图入口。
  - 参考图本地状态包括 `selectedReferenceIds`、`referenceBboxes`、`bboxOrder`，删除参考图后需要同步清理这些本地状态，避免提示词引用卡片残留。
  - 目标图使用同一个 `BboxCanvas` 组件渲染，当前桌面高度为 `lg:min-h-[calc(100dvh-12rem)]`，导致目标图区域接近满高，右侧参数/按钮和下方内容更容易超出单屏。
  - `BboxCanvas` 当前通过 pointer down/move/up 直接创建或调整 bbox，不区分点击和拖拽，也没有原图预览入口。
- 当前只读详情容器为 `frontend/components/workspace/image-project-read-only-detail.tsx`。
  - 已有 `handleReferenceFiles` 上传参考图并调用 `apiClient.setImageProjectReferenceSelection(...)` 持久化 `image_reference_asset_ids`。
  - 已有 `handleSetReferenceAsTarget(asset)`。
  - 尚无 `handleRemoveReference(asset)`。
- 旧工作台 `frontend/components/workspace/image-project-workspace.tsx` 已有参考图移除模式：
  - 调用 `apiClient.setImageProjectReferenceSelection(project.id, { asset_ids: currentIds.filter(id => id !== assetId) })`。
  - 成功文案为“已从项目参考图中移除，后端资产仍保留。”
  - 不调用 `deleteAsset`，不删除资产文件。
- 前端 API 客户端 `frontend/lib/api-client.ts` 已提供：
  - `setImageProjectReferenceSelection(projectId, payload)`。
  - `uploadImageProjectReference(projectId, file, options)`。
  - `deleteAsset(...)` 虽然存在，但本次不使用。
- 后端已有 `PUT /api/projects/{project_id}/image-reference-selection`，会校验传入资产属于当前项目、是 public succeeded uploaded image，并更新项目参考图 ID 列表。
- 相关测试：
  - `frontend/tests/image-canvas-editor.test.tsx` 已覆盖画布按钮、框选、提示词拼接和参考图设目标。
  - `frontend/tests/image-project-read-only-detail.test.tsx` 已覆盖画布打开、生成、设目标图、图层拆分。
  - `frontend/tests/image-project-workspace.test.tsx` 已覆盖旧工作台“支持累积添加并移除持久化参考图”，可作为语义参考。

## Proposed Changes

### 1. 在画布参考图卡片中增加删除入口

文件：`frontend/components/workspace/image-canvas-editor.tsx`

- 从 `lucide-react` 引入 `Trash2` 图标。
- 为 `ImageCanvasEditor` 新增可选 prop：

```ts
onRemoveReference?: (asset: Asset) => void;
```

- 在左栏参考图卡片操作区增加删除按钮：
  - `aria-label={`移除参考图：${referenceName(asset)}`}`
  - `title={`移除参考图：${referenceName(asset)}`}`
  - 使用 `Trash2` 图标，`size="icon"` 或紧凑 `size="sm"`。
  - 与“设为目标图”“清除区域”并列，但视觉上保持紧凑，不扩大卡片高度过多。
- 删除按钮禁用条件：
  - `isSubmitting`
  - `isUploadingReference`
  - `!onRemoveReference`
- 删除触发时调用 `onRemoveReference(asset)`，不在子组件内直接调用 API。
- 删除参考图后需要清理本地状态：
  - 新增 `useEffect` 监听 `referenceAssets` ID 集合变化。
  - 将 `selectedReferenceIds` 过滤为仍存在的 asset ID。
  - 从 `referenceBboxes` 中移除不存在的 asset ID。
  - 从 `bboxOrder` 中移除不存在的参考图 ID，但保留 `TARGET_BBOX_ORDER_KEY`。
- 如果被移除的参考图曾被设为当前目标图：
  - 删除只影响 `image_reference_asset_ids`，不会清空 `current_image_asset_id`。
  - 因为底层资产仍保留，目标图仍继续显示，这是预期行为。

### 2. 在只读详情中实现参考图移除持久化

文件：`frontend/components/workspace/image-project-read-only-detail.tsx`

- 新增 `handleRemoveReference(asset: Asset)`：
  - 若 `isSubmitting || isUploadingReference`，直接 return。
  - 设置 `isUploadingReference(true)` 复用当前参考图操作忙碌态。
  - 调用：

```ts
apiClient.setImageProjectReferenceSelection(project.id, {
  asset_ids: (project.image_reference_asset_ids ?? []).filter(
    (id) => id !== asset.id
  )
});
```

  - 成功后 `onProjectUpdated(nextProject)`。
  - 成功反馈文案：`已从项目参考图中移除，后端资产仍保留。`
  - 失败时显示 `getUserFacingErrorMessage(error)`。
  - `finally` 中恢复 `isUploadingReference(false)`。
- 将 `onRemoveReference={handleRemoveReference}` 传入 `ImageCanvasEditor`。
- 不新增后端 API，不调用 `apiClient.deleteAsset`。

### 3. 降低目标图显示区域高度

文件：`frontend/components/workspace/image-canvas-editor.tsx`

- 将目标图 `BboxCanvas` 当前高度从接近整屏的：

```tsx
className="min-h-72 lg:min-h-[calc(100dvh-12rem)]"
```

调整为更适合单屏查看的固定响应式高度，例如：

```tsx
className="h-[42dvh] min-h-64 max-h-[520px] lg:h-[58dvh] lg:max-h-[620px]"
```

- 保持内部图片 `object-contain`，确保原图按比例完整显示，不裁切。
- 目标图列继续允许滚动，但常规 1440x900 桌面视口下，应能同时看到：
  - 顶部工具栏。
  - 目标图完整容器。
  - 右侧参数区、提示词输入区域和生成按钮。
- 左栏参考图仍独立滚动，不受目标图高度降低影响。

### 4. 点击目标图放大查看原图

文件：`frontend/components/workspace/image-canvas-editor.tsx`

- 为 `ImageCanvasEditor` 增加本地状态：

```ts
const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
```

- 为 `BboxCanvas` 增加可选 prop：

```ts
onPreview?: () => void;
previewLabel?: string;
```

- 仅目标图传入 `onPreview={() => targetAsset && setPreviewAsset(targetAsset)}`。
- 点击与框选冲突处理：
  - 在 `BboxCanvas` 中记录 pointer down 起点。
  - pointer move 距离超过阈值（例如 4px）才创建/更新 bbox。
  - pointer up 时如果移动距离未超过阈值，且存在 `onPreview`，则触发原图预览。
  - 拖拽框选、调整 bbox handle、删除 bbox 均不触发预览。
- 鼠标样式：
  - 有 `onPreview` 且未禁用时，可用 `cursor-zoom-in`。
  - 拖拽框选仍可通过明显拖拽完成；不再让单击误生成零尺寸 bbox。
- 放大预览使用现有 Dialog 体系：
  - `DialogTitle`: `查看原图`
  - `DialogDescription`: 使用 `referenceName` 或资产名显示来源。
  - 内容区使用深色背景和 `object-contain` 展示 `getSafePreviewUrl(previewAsset)`。
  - 尺寸建议 `max-w-[96vw] h-[92dvh]` 或相近。
  - 图片 `alt` 为 `${assetName} 原图预览`。
  - 如果 URL 不可用，显示“图片暂不可预览”。
- 不把放大预览用于参考图，除非后续单独要求；本次只实现“目标图点击放大查看原图”。

### 5. 测试更新

文件：`frontend/tests/image-canvas-editor.test.tsx`

- 新增/更新测试：
  - 参考图卡片显示“移除参考图：xxx”按钮。
  - 点击删除按钮调用 `onRemoveReference(asset)`。
  - 删除按钮在 `isSubmitting` 或 `isUploadingReference` 时禁用。
  - 当 `referenceAssets` props 移除某张已框选参考图后，视觉引用卡片、`selectedReferenceIds`、`referenceRegions` 不再包含该资产。
  - 目标图单击打开“查看原图”预览 Dialog。
  - 拖拽目标图仍创建 bbox，不打开预览 Dialog。

文件：`frontend/tests/image-project-read-only-detail.test.tsx`

- 新增测试：
  - 在画布中点击“移除参考图：参考产品图.png”后，调用 `setImageProjectReferenceSelection(project.id, { asset_ids: [] })`。
  - 成功后调用 `onProjectUpdated(nextProject)` 并显示“已从项目参考图中移除，后端资产仍保留。”
  - 删除参考图不调用 `deleteAsset`。

### 6. 样式与可访问性约束

- 删除按钮使用图标按钮并设置 `aria-label/title`，不引入大块说明文字。
- 目标图预览 Dialog 可通过右上角关闭按钮关闭。
- 目标图区域缩小后，不允许右栏按钮、提示词、参数控件互相遮挡。
- 保持现有工具型工作台风格：紧凑、信息密度高、无营销式装饰。
- 不改变参考图编号规则：仍按 `referenceAssets` 上传/选择顺序显示为图1、图2、图3。

## Assumptions & Decisions

- “删除已添加的参考图”已确认解释为：只从当前项目参考图列表移除，后端资产仍保留。
- 不新增后端接口；复用 `PUT /api/projects/{project_id}/image-reference-selection`。
- 不删除对象存储文件，不调用 `deleteAsset`。
- 目标图点击放大只针对目标图；参考图预览不在本次范围。
- 目标图的“点击预览”和“拖拽框选”通过移动距离阈值区分，避免单击误画框。
- 当前目标图如果来自某张参考图，被移出参考图列表后仍作为目标图保留。

## Verification Steps

### 前端单元测试

在 `frontend` 目录运行：

```bash
export PATH="/Users/bytedance/.real/.bin/node/bin:$PATH"
npm test -- image-canvas-editor.test.tsx image-project-read-only-detail.test.tsx
npm run lint
npm run typecheck
```

### 前端构建

在 `frontend` 目录运行：

```bash
export PATH="/Users/bytedance/.real/.bin/node/bin:$PATH"
npm run build
```

### 浏览器验收

在前后端服务运行时，用 Playwright 或手动验证：

- 打开 `http://localhost:3000/workspace/projects`。
- 进入图片项目，点击“进入画布”。
- 左栏参考图卡片显示删除按钮。
- 点击删除按钮后，该参考图从左栏消失，刷新后仍不再显示。
- 删除参考图不会影响已经设为目标图的当前目标图显示。
- 目标图区域高度低于当前版本，桌面单屏内能看到目标图完整容器和右侧生成按钮。
- 单击目标图打开“查看原图”弹窗。
- 拖拽目标图仍能框选区域，不会打开原图弹窗。
- 关闭原图弹窗后仍停留在画布内。
