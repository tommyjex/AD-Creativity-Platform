# 分镜首帧指定与参考图紧凑化实施计划

## Summary

在分镜参考素材编辑弹窗中新增独立的“首帧”区域，固定放在“参考图”和“其他参考素材”之间。首帧为单选图片，支持本地上传、从资产库选择、预览、替换和移除；上传后的图片正常进入资产库。

生成 Seedance 2.5 视频时，首帧以 `role=first_frame` 提交，普通参考图仍以 `role=reference_image` 提交，两类图片可以同时存在。首帧不参与“参考图1”等提示词引用编号。

同时缩小参考图缩略图卡片及图片资产候选卡片的高度。首帧卡片复用同一紧凑规格，使高频的参考图、首帧和提示词集中在更小的纵向空间内。

## Current State Analysis

### 数据与接口

- `backend/app/schemas/storyboard.py`
  - `StoryboardShotBase` 当前包含 `image_asset_id`、`video_asset_id` 和三类参考素材 ID 列表。
  - `StoryboardShotVideoConfig` 暂无显式首帧字段。
- `backend/app/db/models.py`
  - `storyboard_shots` 暂无 `first_frame_asset_id` 列。
  - `image_asset_id` 是已有分镜图字段，不应复用为用户在视频编辑器中明确指定的首帧，否则会混淆分镜图和视频首帧的生命周期。
- `backend/app/api/routes.py`
  - 当前参考素材关联接口只支持 `image / video / audio` 多选。
  - 上传参考图片会创建 `uploaded_image` Asset，分类为参考素材并进入资产库。
- `frontend/lib/api-types.ts`、`frontend/lib/api-client.ts`
  - 前端配置类型和 API 客户端均没有首帧字段或首帧操作。

### Seedance 生成

- `backend/app/services/modelark.py::BytePlusModelArkAdapter.generate_video()`
  - 当前如果存在 `reference_image_urls`，只发送 `role=reference_image`。
  - 仅在没有普通参考图时，才把 `request.image_url` 作为 `role=first_frame` 发送。
- `backend/app/api/routes.py::_generate_single_storyboard_shot_video`
  - 当前只解析三类参考素材，没有读取独立首帧资产。
- 因此现状无法同时指定首帧和参考图。

### 编辑弹窗

- `frontend/components/workspace/storyboard-shot-editor-dialog.tsx`
  - 当前顺序为“参考图 → 其他参考素材 → 视频生成提示词”。
  - `ReferenceAssetCard` 和 `AssetCandidateCard` 均使用 `aspect-video` 缩略图。
  - 选中参考图卡片还包含较大的文本区和底部操作区，纵向占用较高。
  - “其他参考素材”已默认折叠，适合在它之前插入高频首帧区域。

## Proposed Changes

### 1. 新增首帧持久化字段

**文件：`backend/app/schemas/storyboard.py`**

- 在 `StoryboardShotBase` 增加：
  - `first_frame_asset_id: Optional[str] = None`
- 在 `StoryboardShotVideoConfig` 增加：
  - `first_frame_asset_id: Optional[str] = None`
- 新增请求模型：
  - `StoryboardShotFirstFrameRequest`
  - 字段 `asset_id: str`
  - 执行 trim 和非空校验。
- 首帧不加入 `reference_image_asset_ids`，保证其不参与参考图编号与提示词重排。

**文件：`backend/app/schemas/__init__.py`**

- 导出新增首帧请求模型。

**文件：`backend/app/db/models.py`**

- 在 `StoryboardShotORM` 增加可空 `first_frame_asset_id`：
  - 字符串长度 36。
  - 外键指向 `assets.id`，删除资产时置空。
- 增加对应关系字段时使用独立 foreign key，避免与 `image_asset_id` 混淆。

**文件：`backend/app/db/session.py`**

- 在现有轻量 schema 补列逻辑中加入：
  - MySQL：`first_frame_asset_id VARCHAR(36) NULL`
  - SQLite 测试：`first_frame_asset_id VARCHAR(36) NULL`
- 不回填历史数据；历史分镜默认无首帧。

**文件：`backend/app/repositories/base.py`、`memory.py`、`mysql.py`**

- 新增仓储方法：
  - `set_storyboard_shot_first_frame(project_id, shot_id, asset_id)`
  - `clear_storyboard_shot_first_frame(project_id, shot_id)`
- MySQL 和内存仓储的创建、读取、更新、项目同步均携带 `first_frame_asset_id`。
- 删除 Asset 时，如果任一分镜引用它作为首帧，自动清空 `first_frame_asset_id`。
- `replace_project_storyboard()` 保留输入中的首帧字段；新生成的分镜默认为空。

### 2. 增加首帧 API

**文件：`backend/app/api/routes.py`**

- 新增接口：
  - `POST /api/projects/{project_id}/storyboard/shots/{shot_id}/first-frame`
    - 请求：`{"asset_id": "..."}`
    - 校验 Asset 属于当前项目、状态成功、类型为 `uploaded_image` 或 `generated_image`。
    - 设置或替换当前首帧，返回 `StoryboardShotVideoConfig`。
  - `DELETE /api/projects/{project_id}/storyboard/shots/{shot_id}/first-frame`
    - 清空首帧，返回更新后的配置。
  - `POST /api/projects/{project_id}/storyboard/shots/{shot_id}/first-frame/upload`
    - 参数沿用参考图上传的 `filename`、`mime_type` 和二进制 Body。
    - 复用图片 MIME、扩展名、大小校验。
    - 上传为 `uploaded_image` Asset，`category=reference`、`stage=video`。
    - metadata 标记：
      - `reference_kind: image`
      - `usage: storyboard_video_first_frame`
      - 原始文件名。
    - 上传成功后设置为当前首帧，返回 `{asset_id, config}`。
- `_shot_video_config()` 返回 `first_frame_asset_id`。
- 首帧替换只更新分镜关联，不删除旧 Asset，旧图继续留在资产库。
- 输入哈希加入首帧资产 ID、更新时间和对象信息，首帧变化后可重新生成，不复用旧任务。

### 3. Seedance 同时提交首帧和参考图

**文件：`backend/app/services/modelark.py`**

- 调整 `generate_video()` 的内容构造顺序：
  1. 文本提示词。
  2. 若 `request.image_url` 存在，加入一项 `role=first_frame`。
  3. 遍历 `reference_image_urls`，加入 `role=reference_image`。
  4. 参考视频和参考音频。
- 移除当前 `if reference_image_urls ... elif image_url ...` 的互斥关系。
- metadata 中 `uses_first_frame` 只取决于 `request.image_url` 是否存在。

**文件：`backend/app/api/routes.py`**

- 单分镜生成时：
  - 读取并校验 `shot.first_frame_asset_id` 对应图片资产。
  - 获取 TOS 签名访问 URL。
  - 将其通过明确参数 `first_frame_url` 传给生成服务。
  - 普通参考图列表保持不变。
- 视频生成 metadata 记录：
  - `first_frame_asset_id`
  - `uses_first_frame`
  - 不把首帧计入 `reference_image_count`。

**文件：`backend/app/services/generation.py`**

- `generate_storyboard_shot_video_asset()` 新增 `first_frame_url` 参数。
- 将 `first_frame_url` 映射到 `VideoGenerationRequest.image_url`。
- 不再使用普通参考图列表第一项隐式充当首帧。

### 4. 扩展前端类型和 API 客户端

**文件：`frontend/lib/api-types.ts`**

- `StoryboardShot` 和 `StoryboardShotVideoConfig` 增加：
  - `first_frame_asset_id: string | null`
- 新增 `StoryboardShotFirstFrameRequest`。
- 继续复用 `StoryboardShotReferenceUploadResponse` 作为上传返回结构，或改名为通用图片关联上传响应；保持 JSON 结构为 `{asset_id, config}`。

**文件：`frontend/lib/api-client.ts`**

- 新增：
  - `setStoryboardShotFirstFrame(projectId, shotId, {asset_id})`
  - `clearStoryboardShotFirstFrame(projectId, shotId)`
  - `uploadStoryboardShotFirstFrame(projectId, shotId, file, options)`
- 上传请求沿用二进制传输方式和文件名/MIME 参数。

### 5. 接入工作台状态与操作

**文件：`frontend/components/workspace/storyboard-video-workspace.tsx`**

- 为弹窗提供首帧操作回调：
  - `handleSetFirstFrame(assetId)`
  - `handleClearFirstFrame()`
  - `handleUploadFirstFrame(event)`
- 操作完成后：
  - 更新当前 `configs[shotId]`。
  - 通过 `shotFromConfig()` 同步 `first_frame_asset_id`。
  - 上传成功时把临时 Asset 加入本地列表，再刷新项目获取可访问缩略图。
- pending action 使用独立键：
  - `first-frame:set:{assetId}`
  - `first-frame:clear`
  - `first-frame:upload`
- 首帧操作不调用参考编号重排，也不修改提示词。
- `configFromShot()`、`shotFromConfig()` 加入首帧字段。

### 6. 新增首帧区域并压缩图片卡片

**文件：`frontend/components/workspace/storyboard-shot-editor-dialog.tsx`**

- `ReferenceManager` 内固定顺序：
  1. 参考图
  2. 首帧
  3. 其他参考素材
- 新增 `FirstFrameSection`：
  - 标题“首帧”，Badge 显示“已指定”或“未指定”。
  - 说明首帧控制视频起始画面，不参与“参考图1”编号。
  - 右侧“上传本地首帧”。
  - 已指定时显示一张紧凑图片卡片：
    - 图片缩略图。
    - 资产名。
    - 预览按钮。
    - 移除按钮。
    - 不显示“点击卡片插入引用”。
  - 未指定时显示紧凑空状态。
  - 下方资产库选择只展示状态成功的图片资产。
  - 选择另一张图直接替换，不弹二次确认，旧 Asset 保留。
- 预览复用现有 `ReferenceAssetPreviewDialog` 的图片模式，首帧预览标题使用“首帧”。

#### 紧凑卡片规格

- 为图片缩略图增加紧凑模式，参考图、首帧和图片候选共用：
  - 缩略图固定高度 `h-20`（移动端和桌面一致），`object-cover`。
  - 选中卡片文本区压缩为一行资产名和一行引用/状态说明。
  - 操作按钮保持至少 32px 点击区域。
  - 参考图选中列表改为 `sm:grid-cols-3 lg:grid-cols-4`，减少单卡宽度和纵向高度。
  - 图片资产库候选改为 `sm:grid-cols-3 lg:grid-cols-4`。
- 首帧已选卡片使用相同的 `h-20` 缩略图、文本区 padding 和按钮尺寸，确保与参考图卡片等高。
- 折叠区域内的视频和音频卡片保持现有规格，避免无关改动。
- 完整预览弹窗尺寸不缩小。

### 7. 测试覆盖

**后端：`backend/tests/test_storyboard_video_workspace.py`**

- 首帧可从资产库图片设置、替换和清除。
- 非图片、失败资产、跨项目资产不能设为首帧。
- 上传首帧创建图片 Asset、进入资产库并关联分镜。
- 替换首帧不删除旧 Asset。
- 删除首帧 Asset 时分镜字段自动置空。
- 配置响应包含 `first_frame_asset_id`。
- 单分镜生成将首帧 URL和普通参考图 URL分别传给生成服务。
- 输入哈希随首帧变化。

**后端：`backend/tests/test_modelark.py`**

- 同时存在首帧与普通参考图时，content 同时包含：
  - 一项 `role=first_frame`
  - 多项 `role=reference_image`
- 断言内容顺序稳定，metadata 计数正确。
- 无首帧时保持纯参考图生成。

**后端：Repository / schema 测试**

- MySQL/SQLite 补列后可读写 `first_frame_asset_id`。
- 内存与 MySQL repository 行为一致。

**前端：`frontend/tests/storyboard-shot-editor-dialog.test.tsx`**

- 文档顺序为“参考图 → 首帧 → 其他参考素材 → 提示词”。
- 首帧卡片与参考图卡片使用同一紧凑高度类。
- 首帧不显示插入提示词操作。
- 首帧支持预览、移除、上传和资产库选择。
- 参考图和图片候选缩略图使用 `h-20`，不再使用 `aspect-video` 撑高卡片。

**前端：`frontend/tests/project-workspace.test.tsx`、`api-client.test.ts`**

- 覆盖设置、替换、清除、上传首帧的 API 请求和本地状态同步。
- 断言首帧操作不更改提示词或参考图编号。
- 生成请求前配置中保留首帧。

## Assumptions & Decisions

- “首帧”为单选；选择新图片即替换当前首帧。
- 首帧支持“本地上传 + 资产库选择”。
- 本地上传首帧创建正常 Asset并进入资产库，便于后续复用。
- 首帧和参考图可同时使用，彼此不互斥。
- 首帧不属于参考图编号系统，不插入“首帧1”或“参考图N”文字，不参与删除参考图后的提示词重排。
- 现有 `image_asset_id` 保持原分镜图语义，不复用为显式首帧。
- 历史分镜迁移后 `first_frame_asset_id=NULL`，行为不变。
- 首帧只接受成功状态的 `uploaded_image` 或 `generated_image`。
- 首帧图片纵横比不在上传时裁切；编辑器缩略图使用 `object-cover`，Seedance 使用原始文件。
- 卡片紧凑化仅影响编辑器缩略图，不改变完整预览和资产库主页面。
- 不自动为历史分镜指定已有分镜图作为首帧。
- 不在测试中触发真实付费 Seedance 任务。

## Verification

1. 后端定向测试：
   - `.venv/bin/python -m pytest backend/tests/test_modelark.py backend/tests/test_storyboard_video_workspace.py -q`
2. 后端全量测试：
   - `.venv/bin/python -m pytest backend/tests -q`
3. 前端定向测试：
   - `cd frontend && npm test -- --run tests/storyboard-shot-editor-dialog.test.tsx tests/project-workspace.test.tsx tests/api-client.test.ts`
4. 前端质量检查：
   - `cd frontend && npm run typecheck`
   - `cd frontend && npm run lint`
   - `cd frontend && npm test`
   - `cd frontend && npm run build`
5. 浏览器桌面验收：
   - 打开分镜编辑弹窗，确认顺序为参考图、首帧、其他参考素材、提示词。
   - 确认参考图和首帧卡片等高且明显低于旧版。
   - 从资产库指定首帧，确认缩略图、预览、替换和移除正常。
   - 上传本地首帧，确认图片进入资产库且当前分镜自动选中。
   - 确认参考图编号和提示词不因首帧操作改变。
6. 浏览器窄屏验收：
   - 使用 390px 视口确认卡片不横向溢出、按钮可点击、提示词更早出现。
7. 后端重启与健康检查：
   - 使用项目 `.env` 重启。
   - `/health` 返回 200。
   - 检查首帧设置、清除接口契约。
   - 不自动提交真实 Seedance 任务。
