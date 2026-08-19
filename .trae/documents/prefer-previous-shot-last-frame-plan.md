# 分镜首帧优先选择上一分镜尾帧实施计划

## Summary

在分镜编辑弹窗的“首帧”区域顶部增加“上一分镜尾帧”推荐卡片。当前分镜不是第一镜、上一分镜已有成功视频且该视频具备可用尾帧时，用户可一键将该尾帧指定为当前分镜首帧。

选中后不复制 PNG、不创建图片 Asset、不进入资产库；当前分镜直接引用上一分镜视频 Asset 的附属尾帧对象。该来源与现有“图片资产首帧”互斥，用户选择任一来源都会替换另一来源。

## Current State Analysis

### 首帧

- `StoryboardShot.first_frame_asset_id` 仅支持独立图片 Asset。
- 首帧支持本地上传、资产库选择、预览、替换和移除。
- 单分镜视频生成时，后端获取该图片 Asset 的签名 URL，以 `role=first_frame` 传给 Seedance。
- 首帧区域由 `FirstFrameSection` 渲染，当前只认识图片资产。

### 尾帧

- Seedance 返回的尾帧作为视频 Asset 的附属 TOS 对象保存。
- 视频 Asset 内部 metadata 保存 `last_frame_object_key`；API 输出隐藏该键，只暴露 `metadata.last_frame_url`。
- 尾帧不创建独立 Asset，不进入资产库。
- `/api/assets/{video_asset_id}/last-frame` 提供受控预览。
- 删除视频 Asset 时，其附属尾帧对象一并清理。

### 分镜关系

- 分镜按 `index` 排序。
- “上一分镜”应定义为按 `index` 升序排列后，当前分镜前一个实际存在的分镜，不要求 index 连续。
- 当前弹窗只接收当前 `shot`，但工作台拥有完整 `shots` 和 `assets`，可在父组件派生上一分镜及其视频 Asset。

## Proposed Changes

### 1. 新增尾帧首帧来源字段

**文件：`backend/app/schemas/storyboard.py`**

- 在 `StoryboardShotBase` 和 `StoryboardShotVideoConfig` 增加：
  - `first_frame_source_video_asset_id: Optional[str] = None`
- 扩展 `StoryboardShotFirstFrameRequest`：
  - `asset_id: Optional[str]`
  - `source_video_asset_id: Optional[str]`
  - model validator 强制两者恰好提供一个。
- 语义：
  - `first_frame_asset_id`：独立图片 Asset。
  - `first_frame_source_video_asset_id`：使用指定视频 Asset 的附属尾帧。
  - 持久化状态中两者必须互斥。

**文件：`backend/app/db/models.py`**

- 在 `StoryboardShotORM` 增加可空字段：
  - `first_frame_source_video_asset_id VARCHAR(36)`
  - 外键指向 `assets.id`，`ON DELETE SET NULL`。
- 使用独立 relationship/foreign key，避免与 `video_asset_id` 混淆。

**文件：`backend/app/db/session.py`**

- 在轻量补列逻辑中为 MySQL 和 SQLite 增加该列。
- 历史分镜默认 `NULL`，不做回填。

**文件：`backend/app/repositories/base.py`、`memory.py`、`mysql.py`**

- 将现有 `set_storyboard_shot_first_frame()` 扩展为可同时接收：
  - `asset_id`
  - `source_video_asset_id`
- 设置图片首帧时清空尾帧来源。
- 设置尾帧来源时清空图片首帧。
- 清除首帧时两个字段同时置空。
- 创建、读取、替换分镜和项目同步携带新字段。
- 删除视频 Asset 时：
  - 所有引用它作为尾帧首帧来源的分镜自动清空 `first_frame_source_video_asset_id`。
  - 不影响这些分镜的其他参考素材。

### 2. 扩展首帧设置 API

**文件：`backend/app/api/routes.py`**

- 继续复用：
  - `POST /api/projects/{project_id}/storyboard/shots/{shot_id}/first-frame`
- 请求支持二选一：

```json
{"asset_id": "image-asset-id"}
```

或：

```json
{"source_video_asset_id": "previous-video-asset-id"}
```

- 图片来源沿用现有校验。
- 视频尾帧来源校验：
  - Asset 属于当前项目。
  - Asset 类型为 `storyboard_video`。
  - Asset 状态为 `succeeded`。
  - metadata 中存在非空 `last_frame_object_key`。
  - `last_frame_status` 为 `available`。
- API 不依赖客户端声明“上一分镜”；后端额外校验该视频 Asset 正是当前分镜按排序计算出的上一分镜的 `video_asset_id`，防止任意视频被伪装成“上一镜尾帧”。
- 设置尾帧来源后返回配置：
  - `first_frame_asset_id = null`
  - `first_frame_source_video_asset_id = previous video asset id`
- `DELETE /first-frame` 同时清空两类来源。
- `_shot_video_config()` 返回新字段。

### 3. 生成时解析尾帧首帧 URL

**文件：`backend/app/api/routes.py`**

- `_generate_single_storyboard_shot_video()` 根据互斥字段解析首帧：
  - 图片 Asset：沿用 `signed_access_url(asset)`。
  - 视频尾帧来源：
    1. 获取视频 Asset。
    2. 再次校验项目、状态、类型和尾帧可用性。
    3. 从内部 metadata 读取 `last_frame_object_key`。
    4. 调用 `asset_storage.signed_url_for_key()` 获取 TOS 签名 URL。
- 将解析结果继续通过 `first_frame_url` 传给生成服务，Seedance 请求结构无需新增类型。
- 视频生成 metadata 增加：
  - `first_frame_source_type: image_asset | previous_shot_last_frame`
  - `first_frame_asset_id` 或 `first_frame_source_video_asset_id`
- 输入哈希增加尾帧来源视频 Asset 的：
  - ID
  - 更新时间
  - `last_frame_status`
  - `last_frame_object_key`
- 尾帧来源失效时生成请求返回可理解的前置校验错误，不静默回退为无首帧。

### 4. 前端类型与 API

**文件：`frontend/lib/api-types.ts`**

- `StoryboardShot`、`StoryboardShotVideoConfig` 增加：
  - `first_frame_source_video_asset_id: string | null`
- `StoryboardShotFirstFrameRequest` 改为互斥联合类型：
  - `{ asset_id: string; source_video_asset_id?: never }`
  - `{ source_video_asset_id: string; asset_id?: never }`

**文件：`frontend/lib/api-client.ts`**

- 复用 `setStoryboardShotFirstFrame()`，允许传入图片或视频尾帧来源 payload。
- 不新增尾帧复制或上传接口。

### 5. 派生上一分镜尾帧推荐项

**文件：`frontend/components/workspace/storyboard-video-workspace.tsx`**

- 对当前选中分镜：
  1. 使用 `sortShots(shots)`。
  2. 找到当前分镜位置。
  3. 取前一个实际分镜作为 `previousShot`。
  4. 通过 `previousShot.video_asset_id` 查找视频 Asset。
  5. 使用 `getSafeLastFrameUrl(asset)` 判断尾帧是否可预览。
- 传给编辑弹窗新的推荐数据：
  - 上一分镜序号和标题。
  - 视频 Asset。
  - 尾帧预览 URL。
  - 当前是否已选中该尾帧。
- 新增操作：
  - `handleSetPreviousShotLastFrame(videoAssetId)`
  - 调用现有首帧设置 API，payload 为 `{source_video_asset_id: videoAssetId}`。
- `configFromShot()` 和 `shotFromConfig()` 同步新字段。
- 设置、清除、上传或选择图片首帧时保持来源互斥，以后端响应为准更新本地状态。

### 6. 首帧区域顶部推荐卡片

**文件：`frontend/components/workspace/storyboard-shot-editor-dialog.tsx`**

- `StoryboardShotEditorDialog` 和 `ReferenceManager` 新增 `previousShotLastFrame` 可选属性。
- `FirstFrameSection` 顶部顺序：
  1. 标题和说明。
  2. 上一分镜尾帧推荐卡片。
  3. 当前已选首帧卡片或空状态。
  4. 上传入口与资产库图片选择。
- 推荐卡片显示：
  - `推荐` Badge。
  - “使用上一分镜尾帧”。
  - `Shot XX · 上一分镜标题`。
  - 固定 `h-20` 尾帧缩略图。
  - “预览”和“设为首帧”图标/按钮。
- 当前已经使用该尾帧时：
  - 卡片显示“当前首帧”状态。
  - 选择按钮禁用或替换为选中标识。
- 用户点击“设为首帧”后：
  - 图片首帧被替换。
  - 当前首帧卡片使用该尾帧缩略图。
  - 移除按钮仍调用统一清除接口。
- 第一分镜：
  - 不显示推荐卡片。
  - 显示简短提示“第一分镜没有上一分镜尾帧”。
- 上一分镜没有视频或尾帧不可用：
  - 不显示不可点击的素材卡。
  - 显示“上一分镜暂无可用尾帧”。
- 尾帧来源不进入下方“从资产库选择首帧”列表。
- 首帧图片资产与上一分镜尾帧均使用相同 `h-20` 当前卡片规格。

### 7. 生命周期与异常处理

- 上一分镜重新生成视频：
  - 当前分镜已选中的旧尾帧引用保持指向旧视频 Asset，保证生成输入稳定。
  - 编辑器推荐卡更新为上一分镜当前最新视频的尾帧；用户可主动切换。
- 旧视频 Asset 被删除：
  - 仓储自动清空当前分镜的尾帧来源。
  - 弹窗回到未指定首帧状态。
- 上一分镜视频存在但尾帧上传失败：
  - 不提供推荐选择。
- 尾帧代理 URL不可加载：
  - 推荐卡显示图片占位，但不改变后端可用性校验。
  - 用户仍可尝试预览；加载失败时展示现有预览失败状态。
- 不创建或复制任何 PNG Asset，资产库数量不变化。

### 8. 测试覆盖

**后端：`backend/tests/test_storyboard_video_workspace.py`**

- 第二分镜可将第一分镜当前视频尾帧设为首帧。
- 第一分镜不能设置“上一分镜尾帧”。
- 不能选择非上一分镜视频、跨项目视频、失败视频或无尾帧视频。
- 设置尾帧来源后图片首帧清空；设置图片首帧后尾帧来源清空。
- 清除首帧同时清空两类字段。
- 删除源视频 Asset 后引用自动置空。
- 单分镜生成使用尾帧 object key 的签名 URL作为 `first_frame_url`。
- 任务 metadata 和输入哈希区分图片首帧与上一镜尾帧。
- 资产列表数量不因选择尾帧而增加。

**后端：repository/schema 测试**

- SQLite/MySQL 补列后可读写新字段。
- 内存与 MySQL 仓储互斥行为一致。

**前端：`frontend/tests/storyboard-shot-editor-dialog.test.tsx`**

- 推荐卡位于首帧区域顶部。
- 推荐卡展示上一镜标题、序号和尾帧缩略图。
- 点击选择调用尾帧来源回调。
- 已选状态、无上一镜、无尾帧三种状态正确。
- 推荐尾帧不出现在资产库图片候选列表。

**前端：`frontend/tests/project-workspace.test.tsx`**

- 正确派生按 index 排序后的上一实际分镜。
- 调用 API payload 为 `{source_video_asset_id}`。
- API 响应后本地状态切换为尾帧来源，并清空图片来源。
- 选择图片、上传图片和清除首帧时状态保持互斥。
- 上一分镜重新生成并指向新视频时推荐项更新，已有选择不被自动替换。

**前端：`frontend/tests/api-client.test.ts`**

- 覆盖尾帧来源首帧请求路径、方法和 JSON payload。

## Assumptions & Decisions

- “优先选择”采用顶部推荐卡片，不自动设置。
- 上一分镜按排序后的前一个实际分镜定义，不要求 index 连续。
- 尾帧保持视频 Asset 附属对象，不创建图片 Asset，不进入资产库。
- 图片首帧与上一分镜尾帧互斥。
- 推荐来源仅限上一分镜当前 `video_asset_id` 的尾帧。
- 选择后引用具体视频 Asset，上一分镜后续重新生成不会静默改变当前分镜输入。
- 第一分镜不具备上一分镜尾帧来源。
- 不改变 Seedance `role=first_frame` 的调用格式。
- 不在自动测试中提交真实付费视频任务。

## Verification

1. 后端定向测试：
   - `.venv/bin/python -m pytest backend/tests/test_storyboard_video_workspace.py backend/tests/test_assets.py -q`
2. 后端全量测试：
   - `.venv/bin/python -m pytest backend/tests -q`
3. 前端定向测试：
   - `cd frontend && npm test -- --run tests/storyboard-shot-editor-dialog.test.tsx tests/project-workspace.test.tsx tests/api-client.test.ts`
4. 前端质量检查：
   - `cd frontend && npm run typecheck`
   - `cd frontend && npm run lint`
   - `cd frontend && npm test`
   - `cd frontend && npm run build`
5. 桌面浏览器验收：
   - 打开第二分镜编辑弹窗。
   - 确认首帧区域顶部显示上一镜尾帧推荐卡。
   - 预览尾帧并设为首帧。
   - 确认当前首帧缩略图更新，资产库数量不变化。
   - 改选图片首帧，确认尾帧来源被替换。
6. 窄屏浏览器验收：
   - 使用 390px 视口确认推荐卡不溢出、缩略图和按钮可操作。
7. 后端重启与健康检查：
   - 使用项目 `.env` 重启。
   - `/health` 返回 200。
   - 不触发真实 Seedance 生成。
