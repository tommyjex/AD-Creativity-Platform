# 图片画布生成与三栏布局调整实施计划

## Summary

本次改动聚焦图片项目的画布工作区体验：生成/编辑图片时不再退出画布，画布内始终可添加参考图；当存在目标图时可以直接发起图层拆分；当目标图为空时，可以把参考图设置为目标图。布局从当前二栏结构调整为左中右三栏：左栏参考图，中栏目标图，右栏提示词编辑器和参数。

本计划以现有 `ImageProjectReadOnlyDetail` + `ImageCanvasEditor` 为主路径，不新增 URL 路由。这里的“画布页面”按现有“进入画布”打开的全屏 Dialog 实现，视觉和行为上保持在画布内。

## Current State Analysis

- 图片项目详情入口位于 `frontend/components/workspace/project-workspace.tsx`，`image_asset` 项目当前渲染 `ImageProjectReadOnlyDetail`。
- 只读详情组件 `frontend/components/workspace/image-project-read-only-detail.tsx`：
  - 通过 `targetAsset` 计算当前目标图。
  - `handleCanvasSubmit` 在生成/编辑任务提交后调用 `setIsCanvasOpen(false)`，导致画布关闭。
  - 已有参考图上传逻辑 `handleReferenceFiles`，传入 `ImageCanvasEditor`。
  - 目前没有图层拆分任务状态、图层集合加载、图层拆分弹窗或图层编辑弹窗。
- 画布组件 `frontend/components/workspace/image-canvas-editor.tsx`：
  - 当前是 Dialog 内二栏布局：左侧目标图/参考图，右侧参数和提示词。
  - 顶部按钮包含“单图编辑”“参考图替换”和清除目标区域。
  - 参考图区域只在 `targetAsset === null` 或 `mode === "reference_replace"` 时显示；因此有目标图且单图编辑状态下不能添加/查看参考图。
  - 提交按钮已支持 `isSubmitting` 转为 spinner 文案，但文案为“正在提交”。
  - 视觉引用卡片已经按框选顺序显示，但 `CanvasEditInput.prompt` 目前可能包含 `<bbox>` 文本；后端 `ImageToImageGenerationRequest` 当前禁止 prompt 中出现坐标标签。
- 图层拆分已有能力主要在 `frontend/components/workspace/image-project-workspace.tsx`：
  - 使用 `LayerDecomposeDialog`、`LayerEditorDialog`、`apiClient.decomposeImageLayers`、`listImageLayerSets`、任务轮询。
  - 该旧 workspace 不是当前 `image_asset` 详情主路径，但可复用其状态流和辅助函数思路。
- 后端能力：
  - `PATCH /api/projects/{project_id}/current-image` 当前只允许 `public + generated_image + succeeded` 设为当前图。
  - 图片编辑接口允许 source 是 `uploaded_image` 或 `generated_image`。
  - 图层拆分接口当前要求 source 是 `generated_image`，因此如果参考图被设为目标图，还需要放宽为 `uploaded_image | generated_image`。

## Proposed Changes

### 1. 画布提交后留在画布内

文件：`frontend/components/workspace/image-project-read-only-detail.tsx`

- 在 `handleCanvasSubmit` 中移除任务提交成功后的 `setIsCanvasOpen(false)`。
- 保留 `activeTask` 作为画布内生成状态来源。
- 提交成功后反馈文案改为画布内状态，例如：
  - 首张生成：`首张图片生成中，请留在画布查看结果。`
  - 编辑版本：`编辑版本生成中，请留在画布查看结果。`
- 任务轮询成功后继续 `apiClient.getProject(..., { cache: "no-store" })` 并 `onProjectUpdated(nextProject)`。
- 当父组件传入刷新后的 `project` 时，画布仍保持打开并显示新的 `targetAsset`。

文件：`frontend/components/workspace/image-canvas-editor.tsx`

- 生成按钮文案从“正在提交”调整为更明确的“生成中”。
- `Dialog` 的 `onOpenChange` 保持生成中禁止关闭，避免中途误关。

### 2. 参考图在任何画布状态都可添加

文件：`frontend/components/workspace/image-canvas-editor.tsx`

- 移除 `isInitialGeneration || mode === "reference_replace"` 对参考图区域的渲染限制。
- 参考图栏始终显示：
  - 参考图列表。
  - 上传按钮。
  - 当前数量。
- 上传按钮只受 `isSubmitting`、`isUploadingReference`、数量上限和 `onReferenceFiles` 可用性控制。
- 参考图框选在任意状态可用；框选后自动加入 `selectedReferenceIds`，删除框选后从选中引用中移除。
- 未框选参考图只作为可见素材和首图生成参考图；已有目标图编辑时，只有已框选参考图会进入 `reference_regions`。

### 3. 去掉“参考图替换”按钮，重排顶部操作

文件：`frontend/components/workspace/image-canvas-editor.tsx`

- 顶部操作从当前：
  - `单图编辑`
  - `参考图替换`
  - `清除目标区域`

  改为：
  - `添加参考图`
  - `单图编辑`
  - `图层拆分`
  - `清除目标区域`（保留为小图标按钮，放在目标图区域或操作区末尾）

- 删除用户可见的“参考图替换”按钮和显式模式切换入口。
- 内部提交策略：
  - 没有目标图：`operation=text_to_image`，按首图生成逻辑提交。
  - 有目标图且没有参考区域：提交 `edit_mode="single_region"`，需要目标框选。
  - 有目标图且存在参考区域：前端内部提交 `edit_mode="reference_replace"` 以复用现有后端结构化区域契约，但 UI 不显示“参考图替换”这个模式名。
- `ImageEditMode` 类型暂不删除，避免扩散到后端 schema 和旧测试；只移除当前画布的显式按钮。

### 4. 三栏画布布局

文件：`frontend/components/workspace/image-canvas-editor.tsx`

- `DialogContent` 改为接近全屏：`h-[100dvh] max-h-[100dvh] w-[100vw] max-w-none`，保留 header 和内容区。
- 内容区改为桌面三栏：
  - 左栏：参考图，从上到下纵向排列，含“添加参考图”入口和参考图编号 `图1/图2/图3`。
  - 中栏：目标图画布，作为主视觉区；无目标图时显示空态，并提示可生成首图或把参考图设为目标图。
  - 右栏：参数选择、可视化提示词编辑器、状态提示和生成按钮，保持现有高信息密度风格。
- 响应式：
  - 大屏使用 `grid-cols-[18rem_minmax(0,1fr)_24rem]` 或接近比例。
  - 中小屏降级为纵向堆叠，不把本次移动端作为强制验收重点。
- 保持卡片半径不超过现有系统风格；避免嵌套卡片视觉过重。

### 5. 有目标图即可图层拆分

文件：`frontend/components/workspace/image-project-read-only-detail.tsx`

- 引入并复用：
  - `LayerDecomposeDialog`
  - `LayerEditorDialog`
  - `apiClient.decomposeImageLayers`
  - `apiClient.listImageLayerSets`
  - `apiClient.retryTask`
- 新增状态：
  - `layerTask`
  - `layerSets`
  - `editorSet`
  - `decomposeAsset`
  - `isLayerSetsLoading`
- 新增 handler：
  - `handleLayerDecomposeFromCanvas()`：当 `targetAsset` 存在时触发。
  - 若已有对应 `source_asset_id === targetAsset.id` 的 layer set，直接打开 `LayerEditorDialog`。
  - 若没有，打开 `LayerDecomposeDialog`。
  - 图层拆分任务成功后刷新 layer sets，并打开新建的图层编辑器。
- 将 `onLayerDecompose`、`isLayerTaskRunning`、`hasLayerTarget` 等必要 props 传入 `ImageCanvasEditor`，让画布顶部“图层拆分”按钮在有目标图时可用。
- 拆分按钮禁用条件：
  - 无目标图。
  - 正在图片生成/编辑。
  - 正在图层拆分。
  - 图层集合首次加载中。

文件：`backend/app/api/routes.py`

- 将图层拆分 source 类型校验从仅 `AssetType.GENERATED_IMAGE` 放宽为 `{AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE}`。
- 保持 `asset_role == public`、`status == succeeded`、`object_key` 和冻结快照校验不变。

### 6. 目标图为空时，把参考图设为目标图

文件：`frontend/components/workspace/image-canvas-editor.tsx`

- 左栏参考图每张卡片在 `targetAsset === null` 时显示“设为目标图”按钮。
- 点击后调用新增 prop `onSetReferenceAsTarget(asset)`。
- 成功后由父组件刷新 project，画布中栏目标图立即显示该参考图。
- 参考图仍保留在参考图列表中，不自动移除；这样用户仍可继续引用该素材。

文件：`frontend/components/workspace/image-project-read-only-detail.tsx`

- 新增 `handleSetReferenceAsTarget(asset)`：
  - 调用 `apiClient.selectCurrentImage(project.id, { asset_id: asset.id, expected_image_revision: project.image_revision })`。
  - 成功后 `onProjectUpdated(nextProject)`，反馈“已设为目标图。”
  - 409 revision 冲突时显示错误并重新拉取项目。
- 引入 `apiClient.selectCurrentImage` 到测试 mock。

文件：`backend/app/repositories/memory.py`、`backend/app/repositories/mysql.py`

- 放宽 `set_current_image_asset` 资格：
  - `asset_role == public`
  - `status == succeeded`
  - `type in {generated_image, uploaded_image}`
- 保持 revision 乐观锁不变。
- 错误文案从“only a succeeded public image can be current”可保留或调整为“only a succeeded public image asset can be current”。

文件：`frontend/components/workspace/image-project-read-only-detail.tsx`

- `targetAsset` 查询不再只从 `generated_image` 列表取。
- 新增 `currentTargetAsset(project)` helper：
  - 优先按 `project.current_image_asset_id` 在全部 `public + succeeded/stale + uploaded_image/generated_image` 中找。
  - 若找不到，再 fallback 到最新 `generated_image`。

### 7. 提示词与 bbox 数据提交兼容

文件：`frontend/components/workspace/image-canvas-editor.tsx`

- 保留视觉引用卡片和文本插入体验。
- `CanvasEditInput` 拆分为：
  - `promptText` 或继续使用 `prompt` 承载用户真实输入文字。
  - 引用坐标通过 `annotation`、`targetBbox`、`referenceRegions` 结构化字段提交。
- 避免在 `image_to_image` 请求的 `prompt` 字段中直接包含 `<bbox>` 标签，因为后端 schema 当前会拒绝坐标标签。
- 对 `text_to_image` 首图生成：
  - 如果仅有参考图无 bbox，继续传 `reference_asset_ids`。
  - 如果参考图有 bbox，首图生成可以继续把视觉编辑器序列化后的引用文本保存为提示词版本，因为现有 text-to-image 请求没有结构化 `reference_regions` 字段。
- 对已有目标图编辑：
  - 用户文字进入 `prompt`。
  - 目标框和参考框进入结构化字段，由后端 `build_image_edit_prompt` 生成最终模型 prompt。

## Assumptions & Decisions

- “画布页面”本次实现为现有全屏 Dialog，不新增 `/canvas` 路由。
- “参考图替换功能去掉”指去掉显式按钮和模式名；底层在“有目标图 + 有参考区域”时仍复用 `reference_replace` 结构化契约，保证后端不需要重新定义编辑语义。
- “无论画布处于什么状态，都支持添加参考图”指上传/展示入口始终可用；生成/上传中的并发保护仍会禁用上传按钮。
- “当目标图为空时，支持把参考图设置为目标图”采用同一资产设为 current，不复制资产、不改变参考图列表。
- 图层拆分以当前目标图为 source；目标图来自生成图或参考图都允许拆分。
- 本次不做移动端专项验收，但三栏布局需要在小屏下自然降级，不允许内容重叠。

## Verification Steps

### 前端单元测试

在 `frontend` 下运行：

```bash
export PATH="/Users/bytedance/.real/.bin/node/bin:$PATH"
npm run lint
npm run typecheck
npm test -- image-canvas-editor.test.tsx image-project-read-only-detail.test.tsx layer-editor-dialog.test.tsx
```

新增/更新断言：

- 提交首张图片后 `ImageProjectReadOnlyDetail` 不关闭画布，生成按钮显示“生成中”。
- 目标图存在时参考图栏和“添加参考图”仍可见可用。
- 顶部按钮顺序为“添加参考图”“单图编辑”“图层拆分”，不再出现“参考图替换”。
- 目标图为空时参考图卡片可点击“设为目标图”，并调用 `selectCurrentImage`。
- 目标图存在时“图层拆分”按钮可用，触发已有 layer set 时打开编辑器；无已有 layer set 时打开拆分弹窗。
- 已有目标图编辑时，`prompt` 不包含 `<bbox>` 标签，bbox 通过 `annotation/reference_regions/target_bbox` 提交。

### 后端回归测试

在项目根目录运行：

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/test_image_generation.py backend/tests/test_image_layers.py -q
```

新增/更新断言：

- `PATCH /current-image` 允许 succeeded public uploaded image 作为当前图。
- `PATCH /current-image` 仍拒绝 failed/stale/internal/non-image 资产，并保持 revision 冲突语义。
- 图层拆分允许 succeeded public uploaded image 作为 source。
- 图层拆分仍拒绝非 public、非 succeeded 或冻结快照不匹配的 source。

### 构建与浏览器验证

```bash
export PATH="/Users/bytedance/.real/.bin/node/bin:$PATH"
npm run build
```

本地浏览器验收：

- 打开图片项目详情，点击“进入画布”。
- 有目标图：画布显示左参考、中目标、右提示词三栏；参考图可继续上传；图层拆分按钮可用；生成编辑版本后画布保持打开且按钮进入生成中。
- 无目标图：可上传参考图；参考图卡片可设为目标图；目标图出现后可框选编辑和图层拆分。
- 确认“参考图替换”按钮不再出现。

