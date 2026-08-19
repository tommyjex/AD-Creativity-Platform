# 分镜视频「多版本历史对比」实施计划

## Summary
让同一个分镜可以被多次编辑。对已经编辑过（存在历史编辑候选）的分镜，再次点击「编辑视频」按钮时，直接进入**多版本对比页**：一屏内展示该分镜的**原视频 + 所有历史编辑候选**，每个视频都能独立播放（复用现有 `ComparisonVideoPlayer`）。用户可以：
- 把**任意版本（含原视频）**设为「当前分镜视频」；
- 在对比页内点击「继续编辑」发起新一轮编辑，生成的新候选加入同一对比页并高亮。

从未编辑过的分镜，行为保持不变（点击「编辑视频」→ 直接进入编辑指令弹窗）。

## 现状复核（本轮已重新验证）
计划中的所有落点已按当前代码重新核对，仍准确：
- 对比弹窗 `StoryboardVideoComparisonDialog` 仍写死两资产/两列（[storyboard-video-edit-dialog.tsx:197-330](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-edit-dialog.tsx#L197-L330)），`ComparisonVideoPlayer` 独立播放 + 宽高比自适应已完成可复用（[storyboard-video-edit-dialog.tsx:332-560](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-edit-dialog.tsx#L332-L560)）。
- `VideoComparisonContext` 仍为 `{ candidateAssetId, originalAssetId, prompt, shotId }`（[storyboard-video-workspace.tsx:122-127](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx#L122-L127)）。
- 派生资产仍取两个 `comparisonOriginalAsset`/`comparisonCandidateAsset`（[storyboard-video-workspace.tsx:199-207](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx#L199-L207)）。
- `openVideoEdit()` 无条件开编辑弹窗（[storyboard-video-workspace.tsx:850-857](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx#L850-L857)）；`handleSubmitVideoEdit()` 生成后设两资产对比（[storyboard-video-workspace.tsx:859-923](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx#L859-L923)）；`handleKeepEditedVideo()` 固定选 `candidateAssetId`（[storyboard-video-workspace.tsx:939-965](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx#L939-L965)）；对比弹窗调用点 [storyboard-video-workspace.tsx:1355-1370](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx#L1355-L1370)。
- 后端 `select-video` 校验仍卡死 `operation == "video_edit"` 且 `source_shot_id == shot.id`（[routes.py:1554-1566](file:///Users/bytedance/AD-Creativity/backend/app/api/routes.py#L1554-L1566)）。
- 元数据：编辑候选带 `operation/source_asset_id/source_shot_id/shot_id/shot_index/edit_prompt`（[routes.py:2481-2489](file:///Users/bytedance/AD-Creativity/backend/app/api/routes.py#L2481-L2489)）；原视频带 `shot_id/shot_index/...`，无 `operation`（[routes.py:2713-2717](file:///Users/bytedance/AD-Creativity/backend/app/api/routes.py#L2713-L2717)）。
- 跨镜头拒绝用例 [test_storyboard_video_workspace.py:907-939](file:///Users/bytedance/AD-Creativity/backend/tests/test_storyboard_video_workspace.py#L907-L939) 的候选无 `shot_id`，放宽后仍会被拒（`source_shot_id`/`shot_id` 均不等于目标镜头）→ 保持绿。
- 待更新前端用例 [project-workspace.test.tsx:1673-1800](file:///Users/bytedance/AD-Creativity/frontend/tests/project-workspace.test.tsx#L1673-L1800)（对比 DOM 从「保留编辑后版本」全局按钮改为每卡「设为当前」）。

## Current State Analysis

### 数据已经足够，无需为「读取历史」改 schema
- 单镜头**原视频**资产带 `metadata.shot_id`、`metadata.shot_index`，但**没有** `operation` 字段（[routes.py:2713-2717](file:///Users/bytedance/AD-Creativity/backend/app/api/routes.py#L2713-L2717)）。
- **编辑候选**资产带 `metadata.operation == "video_edit"`、`source_shot_id`、`source_asset_id`、`shot_id`、`edit_prompt`（[routes.py:2481-2489](file:///Users/bytedance/AD-Creativity/backend/app/api/routes.py#L2481-L2489)）。
- `Asset` 带 `created_at`（[api-types.ts:296-311](file:///Users/bytedance/AD-Creativity/frontend/lib/api-types.ts#L296-L311)），可用于按时间排序历史候选。
- 因此「某分镜的全部视频版本」可完全在前端从 `project.assets` 过滤重建：
  - 属于该分镜：`asset.type === "storyboard_video"` 且 `metadata.shot_id === shotId`（原视频与候选都带 `shot_id`）。
  - 版本类型：有 `operation === "video_edit"` 的是编辑候选，否则是原视频/基底。

### 前端现状
- 状态 `videoComparison: { candidateAssetId, originalAssetId, prompt, shotId }` 只承载**两个**资产（[storyboard-video-workspace.tsx:122-127](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx#L122-L127)、[199-207](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx#L199-L207)）。
- `StoryboardVideoComparisonDialog` 接收 `originalAsset` / `candidateAsset` 两个资产，内部 `VideoComparisonBoard` 固定渲染两列（[storyboard-video-edit-dialog.tsx:203-330](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-edit-dialog.tsx#L203-L330)）。
- **`ComparisonVideoPlayer` 已支持独立播放 + 宽高比自适应**（上一步已完成），可直接复用。
- `openVideoEdit()` 无条件打开编辑指令弹窗（[storyboard-video-workspace.tsx:850-857](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx#L850-L857)）。
- `handleSubmitVideoEdit()` 生成候选后 `setVideoComparison({...})`（[storyboard-video-workspace.tsx:859-923](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx#L859-L923)）。
- `handleKeepEditedVideo()` 调 `selectStoryboardShotVideo(project.id, shotId, { asset_id: candidateAssetId })`（[storyboard-video-workspace.tsx:939-965](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx#L939-L965)）。

### 后端现状（唯一需要改动点）
- `select-video` 校验**只接受** `operation == "video_edit"` 的候选（[routes.py:1554-1566](file:///Users/bytedance/AD-Creativity/backend/app/api/routes.py#L1554-L1566)）。用户已确认「原视频也可回退」，所以必须放宽此校验，允许把**该分镜自身的原视频**重新设为当前视频。
- 现有测试 `test_storyboard_video_selection_rejects_candidate_from_another_shot`（[test:907-939](file:///Users/bytedance/AD-Creativity/backend/tests/test_storyboard_video_workspace.py#L907-L939)）依赖跨镜头拒绝逻辑，放宽时须保持「跨镜头资产仍被拒绝」。

## Proposed Changes

### 1. 后端：放宽 `select-video`，允许回退到本分镜原视频
**文件**：[backend/app/api/routes.py](file:///Users/bytedance/AD-Creativity/backend/app/api/routes.py)（`select_storyboard_shot_video`，约 1537-1574）

**What/Why**：当前只允许 `operation == "video_edit"` 候选被选中。需允许「本分镜自身的视频资产」被选中——既包括编辑候选，也包括原视频。

**How**：把校验拆成两类判断，二者取其一即可通过：
- 通用前置校验（保持不变）：`candidate.project_id == project_id`、`type == STORYBOARD_VIDEO`、`stage == Stage.VIDEO`、`status == Status.SUCCEEDED`。
- 归属判断（放宽）：满足以下任一即视为合法的本分镜版本：
  - **编辑候选**：`metadata.get("operation") == "video_edit"` 且 `metadata.get("source_shot_id") == shot.id`；
  - **本分镜原视频/基底**：`metadata.get("shot_id") == shot.id`（原视频与候选都写了 `shot_id`）。
- 仍拒绝：`shot_id` / `source_shot_id` 都不等于当前 `shot.id` 的资产（跨镜头拒绝逻辑保留）。

保持 `mark_downstream_stale(project_id, Stage.VIDEO)` 与返回 `_shot_video_config(updated)` 不变。

### 2. 前端类型/状态：对比上下文改为「多版本」
**文件**：[frontend/components/workspace/storyboard-video-workspace.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx)

**What/Why**：`VideoComparisonContext` 目前只存两个 asset id，无法承载多版本 + 当前选中版本。

**How**：
- 改写 `interface VideoComparisonContext`（约 122-127）为：
  ```ts
  interface VideoComparisonContext {
    shotId: string;
    // 高亮/滚动定位到的最新候选（编辑刚生成时），无则为 null
    highlightAssetId: string | null;
  }
  ```
  （不再存 original/candidate/prompt；版本清单每次渲染时从最新 `assets` 现算，保证刷新后一致。）
- 新增派生工具函数（放在本文件底部 helper 区，或 `frontend/lib/` 见第 6 点）：`collectShotVideoVersions(assets, shotId)` 返回按 `created_at` 升序的版本数组，每项含 `{ asset, kind: "original" | "edit", editPrompt?: string }`；原视频排在最前。
- 用 `useMemo` 基于 `assets` + `videoComparison.shotId` 计算 `comparisonVersions`，替换原来的 `comparisonOriginalAsset` / `comparisonCandidateAsset`（约 199-207）。
- 记录「当前分镜视频」= `selectedConfig?.video_asset_id`，传给对比页用于标注哪个版本是「当前」。

### 3. 前端逻辑：编辑入口按「是否有历史」分流
**文件**：[frontend/components/workspace/storyboard-video-workspace.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx)

**How**：
- `openVideoEdit()`（约 850-857）改为：
  - 计算该分镜是否已有编辑候选（`collectShotVideoVersions` 中存在 `kind === "edit"`）。
  - **有历史** → `setVideoComparison({ shotId, highlightAssetId: null })` 直接打开多版本对比页（不预先弹编辑指令）。
  - **无历史** → 维持原逻辑：`setVideoEditPrompt("")` + `setIsVideoEditOpen(true)`。
- `handleSubmitVideoEdit()`（约 859-923）：生成成功后改为 `setVideoComparison({ shotId, highlightAssetId: candidateAssetId })`，其余（刷新项目、关闭编辑弹窗）不变。
- 新增 `handleContinueEditing()`：从对比页「继续编辑」进入——设置 `videoEditPrompt=""`、`videoEditFeedback=null`、`setIsVideoEditOpen(true)`；**不清空** `videoComparison`（这样编辑弹窗关闭/生成后仍回到对比页）。注意与现有 `handleAdjustVideoEdit()`（约 933-937，会 `setVideoComparison(null)`）区分：`handleAdjustVideoEdit` 用于「无历史初次编辑」的返回；多版本页用新的 `handleContinueEditing`。
- `handleKeepEditedVideo()`（约 939-965）改为接收目标 `assetId` 参数：`selectStoryboardShotVideo(project.id, videoComparison.shotId, { asset_id: assetId })`。用于「把任意版本设为当前」。成功后 `setVideoComparison(null)` 并给出成功提示（区分原视频 vs 编辑版文案）。

### 4. 前端组件：对比弹窗支持 N 个版本
**文件**：[frontend/components/workspace/storyboard-video-edit-dialog.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-edit-dialog.tsx)

**What/Why**：`StoryboardVideoComparisonDialog` 与 `VideoComparisonBoard` 目前写死两列两资产，需要支持版本列表。

**How**：
- 定义导出类型：
  ```ts
  export interface ComparisonVersion {
    assetId: string;
    url: string;         // 已由 getSafePreviewUrl 处理
    kind: "original" | "edit";
    editPrompt?: string; // 仅编辑版
    createdAt: string;
    isCurrent: boolean;  // 是否为该分镜当前视频
  }
  ```
- 重写 `StoryboardVideoComparisonDialog` props：用 `versions: ComparisonVersion[]`、`highlightAssetId: string | null`、`shot`、`isSelecting`、`onContinueEdit`、`onSelectVersion(assetId)`、`onClose`、`aspectRatio` 取代原 `originalAsset/candidateAsset/editPrompt/onAdjust/onKeepEdited/onKeepOriginal`。
- `VideoComparisonBoard` 改为遍历 `versions` 渲染多个 `ComparisonVideoPlayer`：
  - 布局：2 版本 `lg:grid-cols-2`；≥3 版本用响应式网格（如 `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`，`items-start`，可纵向滚动——弹窗已有 `overflow-y-auto`）。
  - 每个版本卡片头部标签：原视频显示「原视频」；编辑版显示「编辑版 · {序号}」并在下方以 `line-clamp` 展示 `editPrompt`。
  - `isCurrent` 版本加视觉标记（如边框高亮 + 「当前」徽标）。
  - `highlightAssetId` 命中的版本额外高亮（最新生成），并可在挂载时 `scrollIntoView`。
  - 每个卡片底部提供「设为当前」按钮：`isCurrent` 时禁用并显示「当前版本」；否则点击 `onSelectVersion(version.assetId)`，`isSelecting` 时禁用全部并在目标卡片显示 loading。
- `ComparisonVideoPlayer` 复用现状（含独立播放、宽高比自适应），无需改内部逻辑。
- 底部操作区：保留「继续编辑」（`onContinueEdit`）与「关闭」（`onClose`）；移除原「保留原版/保留编辑后版本」两个全局按钮（改为每卡片的「设为当前」）。

### 5. 前端接线：更新对比弹窗调用点
**文件**：[frontend/components/workspace/storyboard-video-workspace.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx)（约 1355-1370）

**How**：把 `StoryboardVideoComparisonDialog` 的 props 换成新签名：
- `versions={comparisonVersions}`（第 2 点算出，映射为 `ComparisonVersion[]`，`isCurrent = asset.id === selectedConfig?.video_asset_id`，`url = getSafePreviewUrl(asset)`）；
- `highlightAssetId={videoComparison?.highlightAssetId ?? null}`；
- `onContinueEdit={handleContinueEditing}`；
- `onSelectVersion={handleKeepEditedVideo}`（改造为接收 assetId）；
- `onClose={() => setVideoComparison(null)}`；
- `open`、`isSelecting`、`shot={comparisonShot}`、`aspectRatio` 不变。

### 6. （可选，若逻辑变复杂）抽出纯函数便于测试
**文件**：新增 `frontend/lib/storyboard-video-versions.ts`
- `collectShotVideoVersions(assets: Asset[], shotId: string): ComparisonVersion[]` —— 过滤 + 排序 + 标注 kind/editPrompt 的纯函数，便于单测覆盖排序与分类。
- 若逻辑简单也可内联在 workspace 组件中；优先抽出以便单测。

## Assumptions & Decisions
- **可回退版本**：依据用户选择，**原视频与任意编辑版本都可设为当前**（需放宽后端 `select-video`，见第 1 点）。
- **继续编辑入口**：依据用户选择，在对比页内提供**「继续编辑」按钮**（第 3、4 点），不复用「返回调整」。
- **历史来源**：完全由前端从 `project.assets` 的 metadata（`shot_id` / `operation` / `source_shot_id` / `edit_prompt` / `created_at`）重建，**不新增后端「列出某分镜历史」接口**，减少改动面。
- **编辑源**：现有后端 `_edit_single_storyboard_shot_video` 始终以「分镜当前 `video_asset_id`」为编辑源（[routes.py:2403-2408](file:///Users/bytedance/AD-Creativity/backend/app/api/routes.py#L2403-L2408)）。因此「继续编辑」编辑的是**当前选中版本**；这符合直觉，不改此行为。
- **失败/未就绪版本**：只展示 `status === succeeded` 且有可用 `url` 的版本；异常项跳过。
- **未编辑过的分镜**：入口行为完全不变（直接进编辑指令弹窗）。
- 不改视频生成参数、Range 代理、宽高比播放器内部逻辑（均已完成且稳定）。

## Verification

### 后端
1. `.venv/bin/pytest backend/tests/test_storyboard_video_workspace.py -q` 全绿。
2. 更新/新增用例：
   - 新增 `test_select_video_allows_reverting_to_shot_original`：给分镜设一个原视频（带 `shot_id`，无 `operation`）+ 一个编辑候选，选中后把 `video_asset_id` 切到候选，再 `select-video` 回原视频 → 200 且 `video_asset_id` 回到原视频。
   - 保持 `test_storyboard_video_selection_rejects_candidate_from_another_shot` 绿（跨镜头仍 422）。
   - 保留既有「候选可被选中」用例绿。
3. `.venv/bin/pytest backend/tests -q` 冒烟无回归（至少跑 storyboard video 相关文件）。

### 前端
1. `tsc --noEmit` 通过（PATH 需含 `/opt/homebrew/bin`）。
2. `eslint components/workspace/storyboard-video-edit-dialog.tsx components/workspace/storyboard-video-workspace.tsx --max-warnings=0` 通过。
3. `vitest run tests/project-workspace.test.tsx` 通过；更新既有「edits a storyboard video as a candidate and selects it after comparison」用例以适配新对比页 DOM（版本卡片「设为当前」按钮、独立播放按钮）。
4. 新增/扩展用例覆盖：
   - 对**已有编辑历史**的分镜点击「编辑视频」→ 直接出现多版本对比页（含原视频 + ≥1 编辑版），不先出编辑指令弹窗。
   - 对**无历史**分镜点击「编辑视频」→ 出现编辑指令弹窗（回归）。
   - 在对比页点某编辑版「设为当前」→ 调 `selectStoryboardShotVideo(projectId, shotId, { asset_id })`，关闭对比页。
   - 在对比页点原视频「设为当前」→ 同样调用成功（依赖后端放宽）。
   - 若抽出 `storyboard-video-versions.ts`，新增其纯函数单测（排序、分类、isCurrent 标注）。
5. （建议，非阻塞）浏览器实测：多版本页各视频独立播放、竖屏/横屏宽高比正确、当前版本高亮、生成新候选后回到对比页并高亮最新版本。

## Notes
- 本计划仅在启用「原视频可回退」时才动后端；前端为主要改动面。
- 上一轮已完成的独立播放 + 宽高比自适应播放器（`ComparisonVideoPlayer`）在此直接复用，不重写。
