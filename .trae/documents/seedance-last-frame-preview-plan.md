# Seedance 2.5 尾帧生成与预览实施计划

## Summary

为单分镜 Seedance 2.5 视频生成启用 `return_last_frame=true`。任务成功后读取 `content.last_frame_url`，将 PNG 尾帧作为视频资产的附属对象上传至 TOS，但不创建独立 Asset 记录，因此不会进入资产库。

分镜视频预览区升级为两页媒体轮播：第一页视频、第二页尾帧。支持鼠标拖拽、触屏滑动、左右箭头、分页点和键盘左右键；默认展示视频。历史视频或尾帧处理失败时保持现有单视频预览，不影响视频任务成功状态。

## Current State Analysis

### Seedance 调用

- `backend/app/services/modelark.py`
  - `BytePlusModelArkAdapter.generate_video()` 通过 `content_generation.tasks.create` 提交 Seedance 2.5 任务。
  - 当前参数包含 `generate_audio=True`、`watermark=False`，但未传 `return_last_frame`。
  - 轮询成功后只读取 `completed.content.video_url`。
- 当前 SDK 已确认：
  - 任务提交可透传 `return_last_frame=True`。
  - 查询任务响应的 `content` 模型包含 `video_url`、`last_frame_url`、`file_url`。

### 视频转存与数据模型

- `backend/app/api/routes.py::_generate_single_storyboard_shot_video`
  - 将视频 URL 交给 `WorkflowService.create_assets_from_sources()` 下载并上传 TOS。
  - 创建 `storyboard_video` Asset，并把 Asset ID 写入 `StoryboardShot.video_asset_id`。
- `backend/app/services/assets.py`
  - 现有逻辑只支持“上传并创建 Asset”。
  - TOS 私有对象通过 `/api/assets/{asset_id}/content` 代理访问。
- `Asset.metadata` 支持字符串、数字和布尔值，可保存附属对象的内部信息。
- 尾帧不应进入资产库，因此不创建 Asset，不新增 `storyboard_shots` 数据库列。

### 前端预览

- `frontend/components/workspace/storyboard-video-workspace.tsx::VideoPreviewPanel`
  - 当前主预览和沉浸式预览均只渲染一个 `<video>`。
  - 已按 Brief 比例自适应，适合复用为视频/尾帧轮播容器。
- `frontend/lib/asset-display.ts`
  - 当前只解析视频资产自身的 `/api/assets/{id}/content` 地址。

## Proposed Changes

### 1. Seedance 请求并返回尾帧源地址

**文件：`backend/app/services/modelark.py`**

- 在 Seedance 2.5 任务创建参数中加入：
  - `return_last_frame=True`
- 任务成功后：
  - 继续严格校验 `content.video_url`，视频 URL 缺失仍视为生成失败。
  - 读取并规范化可选的 `content.last_frame_url`。
  - 将尾帧 URL 放入 `GeneratedAssetResult.last_frame_url`，不写入持久化 metadata，避免临时签名 URL 泄漏或过期。
- 保持 `watermark=False`、`resolution`、`ratio`、`duration`、同步音频等现有行为不变。

**文件：`backend/app/services/modelark.py`、`backend/app/services/generation.py`**

- 为 `GeneratedAssetResult` 增加可选字段 `last_frame_url`。
- 新增工作流边界模型，例如 `StoryboardVideoGenerationResult`：
  - `asset: AssetCreate`
  - `last_frame_url: str | None`
- `generate_storyboard_shot_video_asset()` 返回上述结构，避免把临时尾帧 URL塞入 Asset metadata。
- 其他图片、批量视频和角色生成接口保持原返回契约。

### 2. 尾帧作为视频资产附属 TOS 对象保存

**文件：`backend/app/services/assets.py`**

- 新增附属对象上传能力，例如 `upload_asset_companion_from_source()`：
  1. 使用现有 `RemoteAssetDownloader` 下载尾帧，要求 MIME 为 `image/png`。
  2. 生成稳定对象键：
     - `projects/{project_id}/video/{video_asset_id}-last-frame.png`
  3. 上传至 TOS。
  4. 更新父视频 Asset metadata：
     - `last_frame_object_key`
     - `last_frame_mime_type: image/png`
     - `last_frame_size_bytes`
     - `last_frame_status: available`
  5. 不调用 `repository.create_asset()`，确保资产库数量不变。
- 若 metadata 更新失败，回滚已上传的尾帧对象，避免孤立对象。
- 新增按 object key 生成签名访问 URL及删除附属对象的内部方法。
- `with_access_url()` 返回 API 数据时：
  - 若存在 `last_frame_object_key`，移除该内部键。
  - 注入 `last_frame_url: /api/assets/{video_asset_id}/last-frame`。
  - 保留现有视频 `url: /api/assets/{video_asset_id}/content`。
- 尾帧上传失败时不抛出到视频任务：
  - 视频 Asset 正常保留并关联分镜。
  - Asset metadata 写入 `last_frame_status: unavailable`。
  - 只记录脱敏失败类型，不保存 Provider 原始错误或签名 URL。

### 3. 提供受控尾帧访问接口和清理逻辑

**文件：`backend/app/api/routes.py`**

- 新增：
  - `GET /api/assets/{asset_id}/last-frame`
- 接口行为：
  - 校验 Asset 存在且 metadata 含有效 `last_frame_object_key`。
  - 通过 TOS 签名 URL流式返回 `image/png`。
  - 设置与现有资产内容接口一致的私有缓存策略。
  - 缺失尾帧返回 404，不暴露内部 object key。
- 单分镜视频生成流程调整为：
  1. 生成并转存视频。
  2. 将视频 Asset 关联到分镜。
  3. 若 Provider 返回尾帧 URL，则尝试上传附属尾帧并更新视频 Asset。
  4. 尾帧失败只降级，不将视频任务标记为失败。
  5. 完成任务时仍只返回视频 Asset ID。
- 删除视频 Asset 时，最佳努力删除：
  - 视频对象。
  - metadata 指向的尾帧对象。
- 历史 Asset 无尾帧 metadata 时保持原删除和访问行为。

### 4. 前端识别尾帧预览地址

**文件：`frontend/lib/api-types.ts`**

- 继续使用现有 `Asset.metadata`，不新增尾帧 Asset 类型。
- 不修改 Project、StoryboardShot 或 StoryboardShotVideoConfig 的接口结构。

**文件：`frontend/lib/asset-display.ts`**

- 新增 `getSafeLastFrameUrl(asset)`：
  - 只接受 metadata 中字符串类型的 `last_frame_url`。
  - 支持后端相对路径 `/api/assets/{id}/last-frame`，拼接 backend base URL。
  - 对绝对 URL继续执行 HTTP/HTTPS 协议白名单校验。
- 不读取或展示 `last_frame_object_key`。

### 5. 视频/尾帧滑动预览

**文件：`frontend/components/workspace/storyboard-video-workspace.tsx`**

- 从 `VideoPreviewPanel` 中抽出内部复用组件，例如 `StoryboardMediaCarousel`，供工作台主预览和沉浸式弹窗共同使用。
- 数据规则：
  - 第 1 页固定为视频。
  - `getSafeLastFrameUrl(asset)` 有值时增加第 2 页尾帧。
  - 切换分镜或视频 Asset ID 后重置到第 1 页。
  - 无尾帧时不显示轮播控制，保留当前单视频体验。
- 视觉与交互：
  - 两页均沿用 Brief 比例容器和 `object-contain`，不裁切。
  - 视频页渲染原生 controls。
  - 尾帧页渲染 PNG `<img>`，标记“尾帧”。
  - 左右箭头位于媒体区域两侧；首尾页对应方向禁用。
  - 底部显示“视频 / 尾帧”分页点及当前页名称。
  - 右箭头、键盘 `ArrowRight`、向右拖拽/触屏滑动切换到尾帧。
  - 左箭头、键盘 `ArrowLeft`、向左拖拽/触屏滑动返回视频。
  - 设置约 40px 水平位移阈值，垂直滚动不触发切页。
  - 视频 controls 的普通点击不会切页。
  - 控件带完整 `aria-label`、当前页状态和键盘焦点样式。
- “放大查看”仍只从视频页提供入口；打开沉浸式弹窗后复用同一轮播，并默认展示当前主预览页。

### 6. 测试

**文件：`backend/tests/test_modelark.py`**

- 断言任务创建含 `return_last_frame=True`。
- 覆盖成功响应同时返回 `video_url` 和 `last_frame_url`。
- 覆盖尾帧 URL 缺失时视频仍成功。

**文件：`backend/tests/test_assets.py`**

- 覆盖 PNG 附属对象下载、TOS 上传、父 Asset metadata 更新。
- 断言 repository 中只增加视频 Asset，不增加尾帧 Asset。
- 覆盖 metadata 更新失败后的 TOS 回滚。
- 覆盖 API 输出移除内部 object key、注入尾帧代理 URL。
- 覆盖删除时视频和尾帧对象均被清理。

**文件：`backend/tests/test_storyboard_video_workspace.py`、必要时 `backend/tests/test_api.py`**

- 覆盖单分镜生成后视频关联成功、尾帧不进入资产库。
- 覆盖尾帧访问接口返回 PNG、缺失时返回 404。
- 覆盖尾帧上传失败时任务仍为 succeeded，视频可播放，metadata 标记 unavailable。
- 断言任务 `output_asset_ids` 只包含视频 Asset。

**文件：`frontend/tests/project-workspace.test.tsx`、必要时新增独立轮播测试**

- 有尾帧时默认显示视频和两页控制。
- 点击右箭头、分页点、键盘右键后显示尾帧。
- 向右拖拽超过阈值显示尾帧，反向拖拽返回视频。
- 未超过阈值、垂直拖动或点击视频 controls 不切页。
- 切换分镜后重置为视频页。
- 无尾帧的历史视频不显示轮播控制。
- 沉浸式预览同步支持视频/尾帧切换。

## Assumptions & Decisions

- 尾帧只针对当前真实 Seedance 2.5 单分镜生成流程启用。
- `return_last_frame` 固定为 `True`，暂不提供前端开关。
- 尾帧格式固定校验为 `image/png`，不接受 HTML 或其他媒体类型。
- 尾帧不是独立 Asset，不出现在项目资产列表、资产库筛选或任务输出 Asset ID中。
- 使用视频 Asset metadata 持久化尾帧内部对象键，不新增数据库列或迁移。
- 视频成功但尾帧缺失、下载失败或 TOS 上传失败时，视频任务仍成功，不自动重新调用 Seedance。
- 历史视频不补生成尾帧；重新生成后才具备尾帧。
- 重新生成会创建新的视频 Asset及其附属尾帧；旧视频资产和旧尾帧继续按现有资产保留策略存在，直到用户删除旧视频资产。
- 删除视频 Asset 时同步清理其附属尾帧对象；清理失败采用最佳努力，不阻塞数据库删除。
- 不在自动测试中提交真实付费 Seedance 任务。

## Verification

1. 后端定向测试：
   - `.venv/bin/python -m pytest backend/tests/test_modelark.py backend/tests/test_assets.py backend/tests/test_storyboard_video_workspace.py -q`
2. 后端全量测试：
   - `.venv/bin/python -m pytest backend/tests -q`
3. 前端定向测试：
   - `cd frontend && npm test -- --run tests/project-workspace.test.tsx`
4. 前端质量检查：
   - `cd frontend && npm run typecheck`
   - `cd frontend && npm run lint`
   - `cd frontend && npm test`
   - `cd frontend && npm run build`
5. 浏览器验收：
   - 打开存在新生成视频和尾帧的分镜。
   - 确认默认展示视频，尾帧不出现在资产库。
   - 验证右箭头、向右拖拽、触屏滑动、分页点、键盘右键可查看尾帧。
   - 验证反向操作返回视频。
   - 验证主预览和沉浸式预览均保持 Brief 比例、图片无裁切。
   - 验证历史无尾帧视频仍正常播放且无多余控制。
   - 验证浏览器控制台无错误。
6. 后端重启并检查：
   - `/health` 返回 200。
   - 不自动发起真实付费生成；如需端到端真实验收，单独人工触发一条 4 秒测试分镜并核对 TOS 对象与尾帧代理接口。

