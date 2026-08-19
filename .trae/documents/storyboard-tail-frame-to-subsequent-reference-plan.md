# 分镜尾帧批量设为后续参考图计划

## Summary

在分镜视频页面新增一个小功能：用户选中某个已经生成视频且具备可用尾帧的分镜后，可以一键将该分镜视频的尾帧作为参考图追加到全部后续镜头。

已确认产品决策：

- 作用范围：当前分镜之后的全部后续镜头。
- 冲突策略：遇到已有首帧的后续镜头跳过，不自动清除首帧，不放宽现有“首帧与参考素材互斥”规则。
- 已有关联：如果某个后续镜头已经关联同一个尾帧参考图，则跳过并计入统计。

## Current State Analysis

当前分镜视频工作台主要实现位于：

- `frontend/components/workspace/storyboard-video-workspace.tsx`
  - 左侧镜头列表、右侧视频/尾帧预览、分镜编辑弹窗入口均在此组件内。
  - 当前已有参考图上传与关联逻辑：`handleUploadReference()`、`handleAttachReference()`、`handleRemoveReference()`。
  - 当前已有“上一分镜尾帧设为当前首帧”逻辑：`handleSetPreviousShotLastFrame()`。
  - `VideoPreviewPanel` 已能展示当前视频尾帧，并通过 `last_frame_url` 在视频/尾帧之间切换。

- `frontend/components/workspace/storyboard-shot-editor-dialog.tsx`
  - 当前编辑弹窗里，上一分镜尾帧只支持“设为首帧”。
  - 参考图区域与首帧区域互斥，首帧存在时禁用参考素材添加。

- `frontend/lib/api-client.ts`
  - 已有 `attachStoryboardShotReference()`、`uploadStoryboardShotReference()`、`setStoryboardShotFirstFrame()` 等分镜视频配置 API 封装。
  - 需要新增一个批量接口封装。

- `frontend/lib/api-types.ts`
  - `StoryboardShot` 与 `StoryboardShotVideoConfig` 已包含 `reference_image_asset_ids`、`first_frame_asset_id`、`first_frame_source_video_asset_id`、`video_asset_id`。
  - 需要新增批量操作响应类型。

- `backend/app/schemas/storyboard.py`
  - 当前已有 `StoryboardShotReferenceRequest`、`StoryboardShotVideoConfig` 等 schema。
  - 需要新增批量响应 schema，避免使用裸 dict。

- `backend/app/api/routes.py`
  - 现有接口：
    - `POST /projects/{project_id}/storyboard/shots/{shot_id}/references`
    - `POST /projects/{project_id}/storyboard/shots/{shot_id}/first-frame`
    - `GET /assets/{asset_id}/last-frame`
  - 当前 `_previous_shot_last_frame_asset()` 只允许“上一镜视频尾帧作为当前首帧”，不适合本需求，因为本需求是“当前镜头尾帧作为后续镜头参考图”。
  - 当前 `_validate_storyboard_video_input_mode()` 明确禁止首帧与参考图/视频/音频共存，本功能应保留该约束，并在批量操作时跳过冲突镜头。

- `backend/app/services/assets.py`
  - `ObjectStorageClient` 支持 `get_object()`、`put_object()`。
  - `AssetStorageService.upload_asset()` 可创建稳定资产对象。
  - 视频尾帧目前存储在原 storyboard video asset 的 `metadata.last_frame_object_key` 中；不能直接把同一个 object key 注册成另一个资产，否则删除参考图资产时可能误删原视频尾帧对象。因此需要复制尾帧对象为新的图片资产。

## Proposed Changes

### 1. 后端新增批量应用接口

文件：`backend/app/api/routes.py`

新增接口：

`POST /api/projects/{project_id}/storyboard/shots/{shot_id}/last-frame-reference`

语义：

- `shot_id` 是源镜头。
- 读取源镜头当前 `video_asset_id`。
- 校验源视频资产：
  - 属于当前项目。
  - 类型为 `storyboard_video`。
  - 状态为 `succeeded`。
  - `metadata.last_frame_status == "available"`。
  - `metadata.last_frame_object_key` 存在。
- 将源视频尾帧对象复制成一个可作为参考图使用的图片资产。
- 将该图片资产追加到所有 `index > source.index` 的后续镜头 `reference_image_asset_ids`。
- 遇到以下情况跳过：
  - 目标镜头有 `first_frame_asset_id` 或 `first_frame_source_video_asset_id`。
  - 目标镜头已包含该参考图资产。

建议实现细节：

- 新增 helper：`_source_shot_last_frame_asset(repository, project_id, shot)` 或复用并泛化现有尾帧校验逻辑。
- 新增 helper：`_copy_last_frame_to_reference_asset(repository, asset_storage, project_id, source_shot, source_video_asset, last_frame_object_key)`。
- 复制方式：
  - 通过 `asset_storage.client.get_object(key=last_frame_object_key)` 读取尾帧 bytes。
  - 用 `asset_storage.upload_asset()` 写入一个新的 `AssetType.GENERATED_IMAGE` 或 `AssetType.UPLOADED_IMAGE` 资产。
  - 推荐类型：`AssetType.GENERATED_IMAGE`，因为来源是系统生成的视频尾帧，不是用户上传。
  - `category=AssetCategory.REFERENCE`，`stage=Stage.VIDEO`，`status=Status.SUCCEEDED`。
  - `mime_type` 从源视频资产 `metadata.last_frame_mime_type` 读取；缺省使用 `image/png`。
  - metadata 包含：
    - `reference_kind: "image"`
    - `usage: "storyboard_video_tail_frame_reference"`
    - `source_shot_id`
    - `source_video_asset_id`
    - `source_last_frame_object_key`
    - `name: "分镜 {index} 尾帧参考图"`
- 幂等处理：
  - 在项目资产列表中查找同项目、同 `usage`、同 `source_video_asset_id` 的已有尾帧参考图资产。
  - 若已存在且状态为 `succeeded`，复用该资产，避免重复点击生成多个相同参考图资产。
  - 若不存在，再复制创建。

返回：

新增响应 schema，建议命名为 `StoryboardTailFrameReferenceApplyResponse`：

- `source_shot_id: str`
- `source_video_asset_id: str`
- `reference_asset_id: str`
- `applied_shot_ids: list[str]`
- `skipped: list[StoryboardTailFrameReferenceSkip]`

`StoryboardTailFrameReferenceSkip`：

- `shot_id: str`
- `shot_index: int`
- `reason: Literal["has_first_frame", "already_attached"]`

不直接返回完整 Project，前端操作成功后调用已有 `refreshProject()` 获取最新资产 URL 和分镜配置，保持接口响应轻量。

### 2. 后端 schema 导出

文件：

- `backend/app/schemas/storyboard.py`
- `backend/app/schemas/__init__.py`

新增并导出：

- `StoryboardTailFrameReferenceSkip`
- `StoryboardTailFrameReferenceApplyResponse`

这样 `routes.py` 可以使用类型化 `response_model`。

### 3. 前端 API 类型与客户端

文件：

- `frontend/lib/api-types.ts`
- `frontend/lib/api-client.ts`

新增类型：

- `StoryboardTailFrameReferenceSkipReason = "has_first_frame" | "already_attached"`
- `StoryboardTailFrameReferenceSkip`
- `StoryboardTailFrameReferenceApplyResponse`

新增 API 方法：

`applyStoryboardShotLastFrameReference(projectId, shotId, requestOptions?)`

请求：

- `POST /api/projects/{projectId}/storyboard/shots/{shotId}/last-frame-reference`

响应：

- `StoryboardTailFrameReferenceApplyResponse`

### 4. 分镜视频页面 UI 与状态处理

文件：`frontend/components/workspace/storyboard-video-workspace.tsx`

新增 handler：

`handleApplyLastFrameToSubsequentReferences()`

行为：

- 仅当 `selectedShot` 存在、当前视频 asset 存在、asset metadata 有 `last_frame_url`、且存在后续镜头时可执行。
- 设置 `pendingAction`，建议 key：`last-frame-reference:${selectedShot.id}`。
- 调用新增 API。
- 成功后调用 `refreshProject()`，同步新增资产和后续镜头参考图。
- 成功反馈：
  - 若 applied > 0：`已将当前尾帧加入 {applied} 个后续镜头参考图。`
  - 若 skipped > 0：追加 `已跳过 {skipped} 个已有首帧或已关联的镜头。`
  - 若 applied == 0：`没有可更新的后续镜头，已跳过已有首帧或已关联的镜头。`
- 失败时复用 `getUserFacingErrorMessage(error)`。

UI 入口：

- 在 `VideoPreviewPanel` 的操作按钮区域增加一个次级按钮。
- 按钮文案：`尾帧设为后续参考图`。
- 图标建议使用已有 lucide 图标，例如 `ImagePlus` 或 `Link2`。
- 禁用条件：
  - 当前没有视频资产。
  - 当前视频资产没有 `last_frame_url`。
  - 当前是最后一个镜头。
  - 当前有视频生成/编辑/删除 pending。
  - 当前批量操作 pending。
- 按钮不放进编辑弹窗，原因是用户是在右侧视频/尾帧预览里确认当前尾帧后执行批量操作，路径更短。

需要传入 `VideoPreviewPanel` 的新增 props：

- `hasSubsequentShots: boolean`
- `isApplyingLastFrameReference: boolean`
- `onApplyLastFrameReference: () => void`

### 5. 参考素材编号与 Prompt

本功能只追加 `reference_image_asset_ids`，不自动改写后续镜头的视频 prompt。

原因：

- 当前系统已有“插入参考图 token”手动机制。
- 自动改写多个后续镜头 prompt 风险较高，容易破坏用户已编辑的提示词。
- 视频生成时参考图会进入模型请求，用户如需在 prompt 中精确引用，可继续使用现有“插入参考图”按钮。

### 6. 风险与兼容性处理

- 不改变现有“首帧与参考素材互斥”规则，降低输入模式风险。
- 不复用原尾帧 object key 作为新资产 object key，避免删除参考图资产时影响原 storyboard video 的尾帧预览。
- 批量操作应是部分成功语义：有冲突镜头不导致整体失败，除非源镜头无可用尾帧、源视频无效、尾帧复制失败或存储不可用。
- 若没有任何后续镜头，前端禁用入口；后端也返回 422 或空应用结果均可。推荐后端返回 422 `the storyboard shot has no subsequent shots`，避免无意义创建参考图资产。

## Assumptions & Decisions

- “后续镜头”定义为同项目中 `index > 当前镜头.index` 的所有镜头。
- 只支持从当前镜头当前选中的 `video_asset_id` 提取尾帧。
- 如果当前视频曾重新生成并更新了 `video_asset_id`，新操作使用最新视频的尾帧。
- 本功能不修改目标镜头已有首帧。
- 本功能不自动进入分镜编辑弹窗，也不自动改写 prompt。
- 本功能允许目标镜头已有其他参考图/参考视频/参考音频，只要没有首帧，就追加尾帧参考图。

## Verification Steps

### 后端测试

使用项目约定的 `.venv`：

```bash
.venv/bin/python -m pytest backend/tests/test_storyboard_video_workspace.py -q
```

新增覆盖：

1. 源镜头有可用尾帧时，接口复制尾帧为参考图资产，并追加到所有无首帧的后续镜头。
2. 后续镜头已有首帧时跳过，并在响应 `skipped` 中标记 `has_first_frame`。
3. 重复调用复用同一个尾帧参考图资产，目标镜头不重复追加。
4. 源镜头无视频、视频无尾帧、当前为最后一镜时返回明确错误。
5. 复制/上传失败时不改变任何目标镜头参考图列表。

### 前端测试

```bash
PATH=/opt/homebrew/bin:$PATH npm test -- tests/project-workspace.test.tsx tests/api-client.test.ts
PATH=/opt/homebrew/bin:$PATH npm run lint -- --quiet
PATH=/opt/homebrew/bin:$PATH npm run typecheck -- --pretty false
```

新增覆盖：

1. 当前分镜有视频尾帧且存在后续镜头时，显示“尾帧设为后续参考图”按钮。
2. 点击按钮调用新增 API，成功后刷新项目并显示 applied/skipped 反馈。
3. 当前分镜无视频、无尾帧、或是最后一镜时按钮禁用或不显示。
4. `api-client` 正确调用新 endpoint。

### 手工验收

1. 进入分镜视频页面。
2. 选择一个已生成视频且有尾帧的非最后镜头。
3. 点击“尾帧设为后续参考图”。
4. 打开后续镜头编辑弹窗，确认参考图列表中出现该尾帧参考图。
5. 对已有首帧的后续镜头，确认未被修改，并在反馈中体现跳过数量。
6. 使用后续镜头生成视频，确认该尾帧参考图进入参考图资产列表。
