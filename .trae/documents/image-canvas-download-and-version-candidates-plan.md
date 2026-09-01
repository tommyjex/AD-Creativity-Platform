# 图片画布下载修复与版本候选选择计划

## Summary

本次变更解决两个问题：

1. 修复目标图下载按钮：点击后应触发浏览器下载到本地，而不是打开图片大图预览页。
2. 单图编辑图片生成完成后，画布目标图区域展示当前目标图与全部图片版本，支持用户在画布内选择任意一张作为新的目标图。

已确认的产品决策：

- 目标候选范围为“全部版本”，而不是仅本次生成结果。
- 选择新目标图仍使用现有 `PATCH /api/projects/{project_id}/current-image`，保持 `image_revision` 冲突保护。
- 目标图下载应走后端受控下载能力，确保 `Content-Disposition: attachment`，不依赖浏览器对跨域图片 URL 的 `download` 属性支持。

## Current State Analysis

### 下载现状

相关文件：

- `frontend/components/workspace/image-canvas-editor.tsx`
- `frontend/lib/asset-display.ts`
- `backend/app/api/routes.py`
- `backend/tests/test_assets.py`

当前画布目标图下载按钮使用：

```tsx
<a download={assetDisplayName(targetAsset, "目标图")} href={targetPreviewUrl}>
```

其中 `targetPreviewUrl` 来自 `getSafePreviewUrl(targetAsset)`。

后端 `AssetStorageService.with_access_url()` 在 TOS 客户端存在时，会把资产 URL 改写为：

```py
url = f"/api/assets/{asset.id}/content"
```

前端 `getSafePreviewUrl()` 会将其转换为：

```ts
http://localhost:8000/api/assets/{asset_id}/content
```

但后端 `GET /api/assets/{asset_id}/content` 当前只返回图片 `Content-Type` 和缓存/Range 相关 header，没有返回：

```http
Content-Disposition: attachment; filename="..."
```

因此浏览器会按图片资源预览逻辑打开大图页面。`<a download>` 对跨 origin 或后端返回 inline 图片的场景也不可靠，所以应由后端明确提供下载语义。

### 画布与任务完成现状

相关文件：

- `frontend/components/workspace/image-project-read-only-detail.tsx`
- `frontend/components/workspace/image-canvas-editor.tsx`
- `frontend/lib/api-client.ts`
- `backend/app/api/routes.py`

当前只读详情页中：

- `targetAsset = currentTargetAsset(project)`，只传一个目标图给 `ImageCanvasEditor`。
- 画布单图编辑通过 `apiClient.editProjectImage()` 提交任务。
- 任务轮询成功后调用 `refreshProject()`，并显示“编辑版本已生成。”。
- 后端 `_run_image_generation_task()` 只在 `project.current_image_asset_id is None` 时自动把新图设为当前目标图。
- 因此已有目标图的编辑结果会成为新的 `generated_image` 资产，但不会自动替换当前目标图。

这与新需求匹配：编辑完成后应展示原目标和新生成版本并列，让用户手动选择。

### 现有选择当前图能力

相关文件：

- `frontend/lib/api-client.ts`
- `frontend/components/workspace/image-project-read-only-detail.tsx`
- `backend/app/api/routes.py`
- `backend/app/repositories/memory.py`
- `backend/app/repositories/mysql.py`

已有接口：

```ts
apiClient.selectCurrentImage(projectId, {
  asset_id,
  expected_image_revision
})
```

后端对应：

```http
PATCH /api/projects/{project_id}/current-image
```

它会校验目标资产必须是 succeeded public image，并使用 `expected_image_revision` 做冲突保护。当前空画布中“设为目标图”已经复用了该能力。

### 画布组件接口现状

相关文件：`frontend/components/workspace/image-canvas-editor.tsx`

当前 `ImageCanvasEditor` 只接收：

```ts
targetAsset: Asset | null;
```

并在中间目标图区只渲染一个 `BboxCanvas`。要支持“全部版本并列选择”，需要扩展为候选列表能力，但仍保持现有目标图为主编辑对象。

## Proposed Changes

### 1. 后端下载语义：`backend/app/api/routes.py`

#### 1.1 为资产内容接口增加下载参数

修改 `get_asset_content()`，新增 query 参数：

```py
download: bool = False
```

行为：

- `download=False`：保持现有预览行为，继续支持图片/video inline 预览与 Range 请求。
- `download=True`：返回流式内容时添加：

```http
Content-Disposition: attachment; filename="{safe_filename}"
```

#### 1.2 client 为 None 时也避免下载退化成预览

当前逻辑：

```py
if asset_storage.client is None:
    return RedirectResponse(access_url)
```

计划改为：

- `download=False` 时保留 redirect，兼容现有本地/外部 URL 预览行为。
- `download=True` 时不 redirect，而是复用后续 httpx 代理流式下载逻辑，从 `access_url` 拉取内容并加 `Content-Disposition`。

这样无论真实内容在 TOS 签名 URL 还是外部模型 URL，下载按钮都能由同源后端响应附件下载。

#### 1.3 文件名生成

新增一个小的私有 helper，例如 `_asset_download_filename(asset: Asset) -> str`：

- 优先使用 `asset.metadata["name"]` 中的字符串。
- 否则使用 `asset.object_key` 的 basename。
- 否则使用 `asset.id`。
- 根据 `asset.mime_type` 或 `object_key` 补 `.png` / `.jpg` / `.webp` 等扩展名。
- 清理 CR/LF、引号、路径分隔符，避免非法 header 或路径注入。

header 使用 Starlette/FastAPI 普通 `Content-Disposition` 即可，文件名保持 ASCII 安全格式，例如：

```http
attachment; filename="target-image.png"
```

不在本次引入复杂 `filename*` 编码，降低兼容风险。

### 2. 前端下载 URL：`frontend/lib/asset-display.ts`

新增 helper：

```ts
export function getAssetDownloadUrl(asset: Asset): string | null
```

实现策略：

- 直接基于资产 ID 构造后端同源下载代理：

```ts
`${getBackendBaseUrl().replace(/\/+$/, "")}/api/assets/${encodeURIComponent(asset.id)}/content?download=1`
```

- 只要资产有 `id` 即可生成 URL；后端仍负责 public/internal 权限校验。
- 该 helper 与 `getSafePreviewUrl()` 分离：预览仍走原来的安全预览 URL，下载走明确的下载 endpoint。

原因：

- 避免把 `?download=1` 拼在 `getSafePreviewUrl()` 上破坏其 `endsWith("/content")` 安全校验。
- 避免跨域资源的 `<a download>` 退化成预览页。

### 3. 目标候选能力：`frontend/components/workspace/image-canvas-editor.tsx`

#### 3.1 扩展 props

新增可选 props：

```ts
candidateTargetAssets?: Asset[];
currentTargetAssetId?: string | null;
isSelectingTarget?: boolean;
onSelectTargetAsset?: (asset: Asset) => void;
```

默认兼容：

- 未传 `candidateTargetAssets` 时，候选列表为 `targetAsset ? [targetAsset] : []`。
- 未传 `onSelectTargetAsset` 时，只展示，不可选择。

#### 3.2 下载按钮使用下载 URL

目标图下载按钮改为：

```tsx
const targetDownloadUrl = targetAsset ? getAssetDownloadUrl(targetAsset) : null;
```

并使用：

```tsx
href={targetDownloadUrl}
download={assetDisplayName(targetAsset, "目标图")}
```

保留图标按钮位置和样式。

#### 3.3 目标图区域展示候选版本

当有目标图且候选数量大于 1 时，在目标图区加入一个紧凑候选条/网格：

- 桌面端建议放在目标图画布下方，仍在中栏范围内。
- 使用 `grid-cols-2` 起步，较宽时可 3 列；保持缩略图固定比例和高度，避免挤压主画布。
- 每个候选项包含：
  - 缩略图。
  - 当前选中状态标记：“当前目标”。
  - 图片类型/来源小标签，例如复用 `assetDisplayName(asset, "图片版本")` 或生成序号。
  - “设为目标图”图标/按钮，当前目标禁用。

视觉约束：

- 不引入大卡片嵌套大卡片。
- 候选条是中栏目标图区域的一部分，样式保持紧凑、工具化。
- 主 `BboxCanvas` 始终绑定当前 `targetAsset`，候选缩略图不参与框选。

#### 3.4 选择候选后的本地状态处理

选择候选由父组件处理，画布内部只调用：

```ts
onSelectTargetAsset?.(asset)
```

同时建议在 `targetAsset?.id` 变化时清理 `targetBbox` 与目标图 bbox 顺序：

- 避免旧目标图的框选区域残留到新目标图。
- 该清理只作用于目标图 bbox，不清理左侧参考图选择。

### 4. 当前只读详情页接入：`frontend/components/workspace/image-project-read-only-detail.tsx`

#### 4.1 计算全部目标候选

新增 `candidateTargetAssets`：

```ts
const candidateTargetAssets = useMemo(
  () => targetCandidateAssets(project, targetAsset),
  [project, targetAsset]
);
```

候选规则：

- 包含当前 `targetAsset`，即使它是从上传参考图设为目标图的 `uploaded_image`。
- 包含项目中所有公开、成功或 stale 的 `generated_image` 版本。
- 去重，当前目标排第一，其余按 `created_at` 倒序。

注意：

- 不把普通左侧参考图全部加入候选，除非它已经是当前目标图。
- 不把 internal layer / internal base 加入候选。

#### 4.2 画布内选择新目标

新增状态：

```ts
const [isSelectingTarget, setIsSelectingTarget] = useState(false);
```

新增 handler：

```ts
async function handleSelectCanvasTarget(asset: Asset) {
  if (asset.id === project.current_image_asset_id || isSubmitting || isSelectingTarget) return;
  const nextProject = await apiClient.selectCurrentImage(project.id, {
    asset_id: asset.id,
    expected_image_revision: project.image_revision
  });
  onProjectUpdated(nextProject);
  setFeedback("已设为目标图。");
}
```

失败处理：

- 409 revision conflict：显示用户可理解错误，并调用 `refreshProject()` 同步最新项目状态。
- 其他错误：显示 `getUserFacingErrorMessage(error)`。
- finally 恢复 `isSelectingTarget=false`。

传给 `ImageCanvasEditor`：

```tsx
candidateTargetAssets={candidateTargetAssets}
currentTargetAssetId={project.current_image_asset_id}
isSelectingTarget={isSelectingTarget}
onSelectTargetAsset={handleSelectCanvasTarget}
```

#### 4.3 任务完成后候选刷新

现有任务成功后已经调用 `refreshProject()`。计划保留该逻辑：

- 单图编辑任务成功后，新生成资产进入 `project.assets`。
- `onProjectUpdated(nextProject)` 后父级 rerender，`candidateTargetAssets` 自动包含新版本。
- 当前目标仍是旧图，用户可在候选区手动选择新图。

### 5. 旧工作区兼容：`frontend/components/workspace/image-project-workspace.tsx`

旧工作区当前也使用 `ImageCanvasEditor`，但主要已有版本网格。

最小兼容策略：

- 可以不传 `candidateTargetAssets`，让 `ImageCanvasEditor` 默认只展示当前编辑资产。
- 或传入 `imageAssets` 与 `handleSelectCurrent`，与旧版本网格能力一致。

本计划选择“最小兼容”：

- 不改变旧工作区的信息架构。
- 只确保新增 props 为可选，不破坏旧入口。
- 下载修复自动生效，因为按钮在 `ImageCanvasEditor` 内。

### 6. Tests

#### 6.1 后端：`backend/tests/test_assets.py`

新增测试：

- `GET /api/assets/{id}/content?download=1` 返回 200/206 时包含：
  - `Content-Disposition: attachment; filename="..."`
  - `Content-Type` 保持原内容类型。
- `download` 未传时不包含 attachment header，保留预览行为。
- `asset_storage.client is None` 且 `download=1` 时不 redirect，仍代理返回附件下载。

保留现有 Range 测试；如 Range + download 同时出现，允许继续返回 206 并保留 `Content-Disposition`。

#### 6.2 前端工具：`frontend/lib/asset-display` 相关测试

如已有覆盖位置，新增：

- `getAssetDownloadUrl(asset)` 返回后端 `/api/assets/{id}/content?download=1`。
- 特殊字符 asset id 使用 `encodeURIComponent`。

若当前没有专门测试文件，可在 `frontend/tests/api-client.test.ts` 或新建轻量测试文件中覆盖。

#### 6.3 画布组件：`frontend/tests/image-canvas-editor.test.tsx`

新增/调整测试：

- 下载按钮 `href` 应为 `.../api/assets/{id}/content?download=1`，不再是预览 URL。
- 传入多个 `candidateTargetAssets` 时显示候选版本区域。
- 当前目标候选标记为“当前目标”，选择按钮禁用。
- 点击非当前候选调用 `onSelectTargetAsset(asset)`。
- `targetAsset.id` 变化后清空旧 `targetBbox`，避免旧框残留。

#### 6.4 当前只读详情页：`frontend/tests/image-project-read-only-detail.test.tsx`

新增/调整测试：

- 单图编辑任务成功后，`getProject()` 返回包含新生成图片版本；画布中同时出现旧目标和新版本候选。
- 点击新版本“设为目标图”调用：

```ts
apiClient.selectCurrentImage(project.id, {
  asset_id: newAsset.id,
  expected_image_revision: project.image_revision
})
```

- 成功后调用 `onProjectUpdated(nextProject)` 并显示“已设为目标图。”。
- 选择失败时调用 `refreshProject()` 同步状态。

## Assumptions & Decisions

- “全部版本”定义为项目内公开 `generated_image` 版本，加上当前目标图；如果当前目标图是上传参考图，也展示在候选中。
- 左侧参考图仍是参考素材管理区，不自动进入目标候选，除非用户已将某张参考图设为目标图。
- 单图编辑完成后不自动切换目标图，用户必须显式选择。
- 下载修复以 `download=1` query 参数实现，不新增独立 URL 路径，降低 API 面变化。
- 预览 URL 和下载 URL 分离：预览继续 inline，下载明确 attachment。
- 旧工作区保持最小兼容，不新增并列候选 UI；主只读画布先实现新体验。
- 保持现有 revision 保护，不绕过 409 冲突处理。

## Verification Steps

实施后执行：

1. 后端资产测试，必须使用 `.venv`：

```bash
source .venv/bin/activate
PYTHONPATH=. pytest backend/tests/test_assets.py
```

2. 前端定向测试：

```bash
cd frontend
export PATH="/Users/bytedance/.real/.bin/node/bin:$PATH"
npm test -- image-canvas-editor.test.tsx image-project-read-only-detail.test.tsx
```

3. 前端质量检查：

```bash
cd frontend
export PATH="/Users/bytedance/.real/.bin/node/bin:$PATH"
npm run lint
npm run typecheck
npm run build
```

4. 手动验收：

- 打开画布，点击目标图下载按钮，浏览器应下载文件，不应跳转到图片大图页面。
- 单图编辑生成完成后，画布目标图区出现当前目标图和全部图片版本候选。
- 当前目标图保持选中态；点击某个历史/新生成版本的“设为目标图”后，中间主画布切换为该图片。
- 切换目标图后旧框选区域清空。
- 若并发导致 revision 冲突，页面显示错误并刷新到最新项目状态。
