# 图片画布目标图下载与目标图单图编辑计划

## Summary

本次变更解决三个画布行为问题：

1. 在图片编辑画布的目标图区域增加下载入口，使用现有安全预览 URL 直接下载目标图，不新增后端下载接口。
2. 对已有目标图执行“单图编辑”和“图层拆分”时，只把目标图作为模型输入；画布左侧参考图仅用于首张图片生成，不参与目标图编辑和拆分的模型请求。
3. 对目标图框选后，提示词编辑器里的引用卡片应显示“图1”，因为从模型视角本次编辑只有目标图这一张输入图。

用户已确认：只限制已有目标图后的编辑/拆分；无目标图时的首张图片生成仍允许使用左侧参考图。下载行为走 `<a download>` + 当前签名 URL。

## Current State Analysis

### 前端画布

相关文件：`frontend/components/workspace/image-canvas-editor.tsx`

- `ImageCanvasEditor` 当前负责三栏画布：
  - 左侧：参考图上传、选择、框选。
  - 中间：目标图 `BboxCanvas`。
  - 右侧：参数、可视化提示词编辑器、生成按钮。
- 目标图区域当前只有“目标图 / 当前目标”标题和预览/框选画布，没有下载入口。
- `CanvasEditInput` 当前包含：
  - `annotation`
  - `editMode`
  - `prompt`
  - `referenceAssetIds`
  - `referenceRegions`
  - `targetBbox`
- 当目标图存在且左侧参考图存在框选区域时，`submitMode` 会变成 `reference_replace`：
  - `referenceRegions` 会按左侧参考图框选顺序提交。
  - 目标图框选卡片当前显示为 `imageLabel: "目标图"`，序列化引用为 `目标图<bbox>...</bbox>`。
- 首张图片生成时，`referenceAssetIds` 会从 `selectedReferenceAssets` 提交给上层，用于文生图参考图输入。

### 前端提交入口

相关文件：

- `frontend/components/workspace/image-project-workspace.tsx`
- `frontend/components/workspace/image-project-read-only-detail.tsx`

当前已有两个上层入口消费 `CanvasEditInput`：

- `ImageProjectWorkspace.handleEditSubmit`：旧详情页/版本卡片编辑入口。
- `ImageProjectReadOnlyDetail.handleCanvasSubmit`：当前只读详情页进入画布后的编辑入口。

两者在目标图编辑时都会调用：

```ts
apiClient.editProjectImage(project.id, {
  annotation,
  edit_mode: editMode,
  source_asset_id: targetAsset.id,
  ...(editMode === "reference_replace"
    ? { reference_regions: referenceRegions, target_bbox: targetBbox }
    : {})
})
```

因此只要前端仍提交 `reference_replace`，后端就会冻结左侧参考图资产，并在模型请求中追加参考图 URL。

### 后端图片编辑请求

相关文件：

- `backend/app/schemas/image_generation.py`
- `backend/app/api/routes.py`
- `backend/app/services/generation.py`
- `backend/app/services/modelark.py`

当前行为：

- `ImageToImageGenerationRequest` 的 `reference_replace` 要求同时存在：
  - `target_bbox`
  - 非空 `reference_regions`
- `backend/app/api/routes.py` 中 `submit_image_generation` 在 `reference_replace` 下会：
  - 校验每个 `reference_regions[].asset_id`
  - 拒绝 `region.asset_id == source_asset.id`
  - 写入 `FrozenImageGenerationInput.reference_assets/reference_regions`
- `_run_image_generation_task` 会把 `frozen.reference_assets` 转换为 `reference_urls`。
- `ModelArkAdapter.generate_project_image` 会将输入图片组装为：

```py
image_urls = [
    source_image_url,
    *reference_image_urls,
]
kwargs["image"] = image_urls[0] if len(image_urls) == 1 else image_urls
```

因此要满足“目标图便是参考图、不要把画布参考图 URL 加进去”，必须保证目标图编辑任务的 `reference_assets` 为空，`reference_image_urls` 为空，只保留 `source_image_url`。

### 图层拆分

相关文件：

- `frontend/components/workspace/image-canvas-editor.tsx`
- `frontend/components/workspace/image-project-read-only-detail.tsx`
- `frontend/components/workspace/image-project-workspace.tsx`
- `backend/app/api/routes.py`
- `backend/app/services/generation.py`
- `backend/app/services/modelark.py`

当前图层拆分入口 `onLayerDecompose` 不依赖画布左侧参考图：

- 前端通过当前目标图/选中版本设置 `decomposeAsset`。
- 后端 `submit_image_layer_decomposition` 只接收 `source_asset_id`、`bbox`、`prompt`、`size`、`format`。
- 模型请求 `decompose_image_layers` 只传一个 `image_url`。

所以图层拆分的核心风险是 UI 语义：入口需要保持只针对目标图，不从左侧参考图框选或选择状态派生任何输入。现有后端路径已符合该要求。

## Proposed Changes

### 1. `frontend/components/workspace/image-canvas-editor.tsx`

#### 1.1 目标图区域增加下载按钮

做法：

- 从 `lucide-react` 增加 `Download` 图标导入。
- 在目标图标题行右侧增加操作区：
  - 当 `targetAsset` 存在且 `getSafePreviewUrl(targetAsset)` 有值时，渲染下载链接。
  - 使用图标按钮样式，避免增加冗余说明文字：

```tsx
<a
  aria-label="下载目标图"
  download={assetDisplayName(targetAsset, "目标图")}
  href={targetPreviewUrl}
  rel="noreferrer"
  title="下载目标图"
>
  <Download className="h-4 w-4" />
</a>
```

- 当目标图不存在或 URL 不安全/不可用时，不展示下载按钮，避免空链接。
- 复用现有 `getSafePreviewUrl` 和 `assetDisplayName`，不新增后端接口、不绕过已有 URL 安全策略。

#### 1.2 目标图编辑永远走 `single_region`

做法：

- 将 `submitMode` 改为更明确的语义：
  - `targetAsset` 存在时，提交 `single_region`。
  - `targetAsset` 不存在时仍提交 `single_region`，首图生成由上层根据 `targetAsset` 分支调用 `generateProjectImage`。
- 点击“生成编辑版本”时：
  - `annotation` 继续使用 `targetBbox`。
  - `editMode` 固定为 `single_region`。
  - `referenceRegions` 固定为空数组。
  - `targetBbox` 可保留在前端回调对象中用于 UI/测试语义，但上层不应将它作为后端 `target_bbox` 提交。
  - `referenceAssetIds`：
    - 首图生成：继续为 `selectedReferenceAssets.map(asset => asset.id)`。
    - 已有目标图编辑：提交空数组，或者上层忽略；为了防误用，计划在 `ImageCanvasEditor` 内按 `isInitialGeneration` 分支提交空数组。

目标提交形态：

```ts
onSubmit({
  annotation: targetBbox,
  editMode: "single_region",
  prompt: prompt.trim(),
  referenceAssetIds: isInitialGeneration ? selectedReferenceIdsInOrder : [],
  referenceRegions: [],
  targetBbox
})
```

#### 1.3 目标图引用卡片显示“图1”

做法：

- `VisualPromptEditor` 中 target card 从：
  - `imageLabel: "目标图"`
  - `reference: "目标图<bbox>..."`
- 改为：
  - `imageLabel: "图1"`
  - `reference: "图1<bbox>..."`
- 只在 `targetAsset && targetBbox && !isInitialGeneration` 时生效。
- 左侧参考图在首图生成时仍按上传顺序显示 `图1/图2/...`，不受目标图编辑模式影响。
- 在已有目标图编辑场景下，左侧参考图框选卡片不应参与提交，也不应影响模型 prompt；UI 可以继续保留左栏用于资产管理，但右侧引用卡片列表建议只展示目标图卡片，避免用户误以为参考图会参与本次目标图编辑。

具体实现建议：

- 计算 `referenceCards` 时按场景分支：
  - `isInitialGeneration === true`：保留当前 `selectedReferenceAssets` 卡片逻辑。
  - `isInitialGeneration === false`：`referenceCards = []`，只展示目标图卡片。
- 这样提示词编辑器的可视化卡片与提交 payload 保持一致：目标图编辑只有 `图1` 一张输入图。

### 2. `frontend/components/workspace/image-project-workspace.tsx`

旧详情页/版本卡片编辑入口仍可能存在，需要同步防线。

做法：

- 在 `handleEditSubmit` 中忽略 `referenceRegions` 对目标图编辑的影响。
- 调用 `apiClient.editProjectImage` 时固定：
  - `edit_mode: "single_region"`
  - `annotation`
  - 不传 `target_bbox`
  - 不传 `reference_regions`
- 保留 `source_asset_id: editAsset.id`，确保模型输入只有目标图。

示例目标形态：

```ts
const task = await apiClient.editProjectImage(project.id, {
  annotation,
  edit_mode: "single_region",
  format,
  operation: "image_to_image",
  prompt: editPrompt,
  prompt_version_id: workspaceProject.current_image_prompt_version_id ?? undefined,
  size,
  source_asset_id: editAsset.id
});
```

### 3. `frontend/components/workspace/image-project-read-only-detail.tsx`

当前主画布入口需要同步。

做法：

- `targetAsset ? editProjectImage(...) : generateFirstImage(...)` 分支保持不变。
- 在 `targetAsset` 分支中固定：
  - `edit_mode: "single_region"`
  - `annotation: targetBbox`
  - 不传 `target_bbox`
  - 不传 `reference_regions`
- `generateFirstImage(prompt, referenceAssetIds)` 分支保持不变，继续允许首图生成使用左侧参考图。

### 4. `backend/app/schemas/image_generation.py`

后端现有 `reference_replace` 能力可以保留给未来专门的多图替换入口；本次不需要删除 schema。

计划只新增测试覆盖，除非前端测试不足以防回归。若要加后端防线，建议最小改动是保持 schema 不变，避免破坏已有 API 契约。

不计划修改：

- `ImageToImageGenerationRequest.reference_replace` 的校验规则。
- `FrozenImageReferenceRegion.image_index >= 2` 的约束。
- “参考区域不能使用目标图自身”的后端校验。

原因：

- 本次产品语义改为目标图单图编辑走 `single_region + annotation`。
- 单图编辑目标图的 “图1<bbox>...” 提示词已经由 `build_image_edit_prompt(annotation=...)` 支持。
- 保留 `reference_replace` 可以减少后端契约变动与潜在兼容风险。

### 5. Tests

#### 5.1 `frontend/tests/image-canvas-editor.test.tsx`

新增/调整测试：

- 目标图存在 + 左侧参考图被选择/框选时，点击“生成编辑版本”应提交：
  - `editMode: "single_region"`
  - `annotation` 为目标图 bbox
  - `referenceAssetIds: []`
  - `referenceRegions: []`
  - `targetBbox` 保留目标图 bbox
- 目标图框选后的引用卡片显示：
  - `图1 框选 #1`
  - `图1<bbox>...`
  - 不显示 `目标图<bbox>...`
- 首图生成场景保持不变：
  - 左侧参考图卡片仍显示上传顺序图号。
  - `referenceAssetIds` 仍会提交已选参考图。
- 目标图存在且 URL 安全时，展示“下载目标图”链接：
  - `href` 等于目标图安全预览 URL。
  - 带 `download` 属性。

#### 5.2 `frontend/tests/image-project-workspace.test.tsx`

调整/新增测试：

- 版本卡片打开画布编辑时，即使 `CanvasEditInput` 携带 `referenceRegions`，`apiClient.editProjectImage` 也不应收到 `reference_regions` 或 `target_bbox`。
- `edit_mode` 应为 `single_region`。

#### 5.3 `frontend/tests/image-project-read-only-detail.test.tsx`

调整/新增测试：

- 当前画布编辑目标图时，`apiClient.editProjectImage` 不应收到 `reference_regions` 或 `target_bbox`。
- 首张图片生成仍应将 `reference_asset_ids` 传给 `generateProjectImage`。

#### 5.4 `backend/tests/test_image_generation.py`

新增后端回归测试，确认单图编辑模型请求只包含目标图：

- 提交 `operation=image_to_image`、`source_asset_id=target.id`、`annotation=bbox`、`edit_mode=single_region`。
- 后台任务执行后断言：
  - `request.source_image_url is not None`
  - `request.reference_image_urls == []`
  - `request.prompt` 包含 `图1<bbox>...`
  - 资产 metadata 中 `reference_asset_ids == []`
  - 资产 metadata 中 `reference_image_count == 0`
  - `generation_mode == "image_edit"`

现有 `test_reference_replace_uses_target_and_reference_images_in_order` 可以保留，作为后端旧模式契约测试；如果前端不再触发该模式，不影响后端兼容。

## Assumptions & Decisions

- 首图生成仍允许使用左侧参考图，这是用户确认的范围。
- 已有目标图后的“生成编辑版本”属于单图编辑，只使用目标图 `source_asset_id`，左侧参考图不参与提交、不参与模型请求。
- 图层拆分当前后端本来只使用 `source_asset_id` 对应图片，不需要改模型调用层；计划只补 UI/测试防线。
- 下载按钮只在目标图区域出现，不给参考图新增下载入口。
- 下载使用现有签名 URL 与浏览器下载行为，不新增 API。
- 后端 `reference_replace` 暂不删除，降低兼容风险；当前画布入口不再触发。
- 目标图框选卡片显示“图1”，用于对齐模型输入视角；左侧参考图的列表编号仍按上传顺序显示。

## Verification Steps

执行实现后需要验证：

1. 前端定向测试：

```bash
cd frontend
export PATH="/Users/bytedance/.real/.bin/node/bin:$PATH"
npm test -- image-canvas-editor.test.tsx
npm test -- image-project-read-only-detail.test.tsx
npm test -- image-project-workspace.test.tsx
```

2. 前端质量检查：

```bash
cd frontend
export PATH="/Users/bytedance/.real/.bin/node/bin:$PATH"
npm run lint
npm run typecheck
npm run build
```

3. 后端定向测试，必须使用 `.venv`：

```bash
source .venv/bin/activate
pytest backend/tests/test_image_generation.py
```

4. 手动验收：

- 打开图片项目画布，有目标图时目标图区域右上角出现下载按钮，点击可下载/打开目标图文件。
- 在目标图上框选区域，右侧引用卡片显示“图1 框选 #1”，引用文本为 `图1<bbox>...</bbox>`。
- 即使左侧参考图被选择或框选，点击“生成编辑版本”后，网络请求体不包含 `reference_regions`、`target_bbox`、`reference_asset_ids`。
- 无目标图首图生成时，左侧参考图仍可作为参考图提交。
- 图层拆分仍只针对当前目标图，拆分请求只包含目标图 `source_asset_id`。
