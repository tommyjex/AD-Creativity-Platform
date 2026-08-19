# Seedance 分镜视频输入参数校验实施计划

## Summary

为分镜视频生成增加“首帧模式”和“参考素材模式”互斥校验，避免再次向 Seedance 2.5 提交 `first_frame` 与 `reference_image/reference_video/reference_audio` 混用的非法请求。

采用已确认的产品规则：

- 首帧模式与全部参考媒体互斥。
- 设置首帧时若已有参考素材，阻止操作并提示，不自动删除素材。
- 添加任意参考素材时若已有首帧，阻止操作并提示，不自动清除首帧。
- 历史冲突配置不自动迁移或清理；允许用户移除任一侧配置后恢复合法状态。
- 生成前必须再次校验，且校验发生在创建本地任务和调用方舟之前。
- 保留 `return_last_frame=true`。它是请求返回生成结果尾帧的输出参数，不属于输入 `role=last_frame`，不参与本次互斥。

## Current State Analysis

### 后端

- [`backend/app/services/modelark.py`](../../backend/app/services/modelark.py) 的 `generate_video()` 会先追加 `role="first_frame"`，再无条件追加全部 `reference_*` 内容，当前没有互斥校验。
- [`backend/app/api/routes.py`](../../backend/app/api/routes.py) 的单分镜生成流程会先解析首帧和参考素材、创建并启动本地任务，然后调用生成服务。非法组合会消耗一次失败任务，并由方舟返回 `400 InvalidParameter`。
- 首帧设置、上一镜尾帧设置、资产库参考素材关联、本地参考素材上传和本地首帧上传是独立接口，均允许形成冲突配置。
- 上传接口当前先创建并上传 Asset，再写入分镜配置；若只在写入后校验，会产生未使用的孤立资产，因此必须在上传前检查。
- 现有错误日志已经可以记录方舟脱敏错误码和 Request ID，但参数冲突应在本地作为 `validation_error` 处理，不应进入方舟错误链路。

### 前端

- [`frontend/components/workspace/storyboard-shot-editor-dialog.tsx`](../../frontend/components/workspace/storyboard-shot-editor-dialog.tsx) 同时展示参考图、首帧和其他参考素材，所有添加入口目前可同时操作。
- [`frontend/components/workspace/storyboard-video-workspace.tsx`](../../frontend/components/workspace/storyboard-video-workspace.tsx) 的生成按钮只受 pending/running 状态控制，不检查素材模式冲突。
- 当前参考素材卡片的添加和移除共用 `disabled` 状态。实施时需要拆分“禁止新增”和“禁止移除”，确保历史冲突配置仍可通过移除一侧修复。
- 现有测试明确断言首帧和参考图会同时传给生成服务，该断言需要按新规则改写。

## Proposed Changes

### 1. 建立统一的输入模式判定

#### `backend/app/api/routes.py`

增加内部校验辅助函数，统一判断：

- `has_first_frame`：`first_frame_asset_id` 或 `first_frame_source_video_asset_id` 任一存在。
- `has_reference_media`：参考图、参考视频、参考音频任一列表非空。
- 两者同时存在时抛出 `WorkflowError(ErrorCode.VALIDATION_ERROR, ...)`，使用明确且可直接展示的中文提示：
  `首帧控制不能与参考图、参考视频或参考音频同时使用，请移除其中一类素材后重试。`

辅助函数支持校验“当前配置”和“即将执行的操作”，避免各接口复制不同规则。

#### `backend/app/services/modelark.py`

在 `VideoGenerationRequest` 增加 Pydantic 模型级互斥校验：

- `image_url` 存在时，`reference_image_urls`、`reference_video_urls`、`reference_audio_urls` 必须全部为空。
- 该校验是 SDK 调用前的最后一道防线，防止未来新增调用方绕过 API 路由校验。
- 保持纯参考素材模式和纯首帧模式均可用。
- 不修改 `return_last_frame=True`。

### 2. 在所有后端写入口对称阻止冲突

#### `backend/app/api/routes.py`

以下入口在任何写入或上传之前执行校验：

1. `POST .../first-frame`
   - 设置图片首帧或上一镜尾帧首帧前，若任一参考素材列表非空，返回 HTTP 422 `validation_error`。
   - 清除首帧接口始终允许。

2. `POST .../first-frame/upload`
   - 读取分镜后先校验是否已有任意参考素材。
   - 冲突时在上传 TOS、创建 Asset 前返回 422，避免孤立资产。

3. `POST .../references`
   - 关联任意图片、视频、音频参考素材前，若已有任一首帧来源，返回 422。
   - 移除参考素材接口始终允许。

4. `POST .../references/upload`
   - 读取分镜后先校验是否已有首帧。
   - 冲突时不上传 TOS、不创建 Asset。

5. `_generate_single_storyboard_shot_video`
   - 获取分镜后立即校验历史配置。
   - 冲突时返回 422，不创建 GenerationTask、不计算签名 URL、不调用 ModelArk。

仓储数据结构和数据库 Schema 不变，不做数据迁移。

### 3. 前端提供即时、可恢复的约束反馈

#### 新增 `frontend/lib/storyboard-video-validation.ts`

集中提供：

- `hasStoryboardFirstFrame(config)`
- `hasStoryboardReferenceMedia(config)`
- `getStoryboardVideoInputConflict(config)`
- 统一中文冲突提示

该工具由编辑弹窗和视频工作台共同使用，避免前后两个界面规则漂移。

#### `frontend/components/workspace/storyboard-shot-editor-dialog.tsx`

调整禁用状态：

- 已有首帧时：
  - 禁用参考图、参考视频、参考音频的上传和资产库关联。
  - 显示提示：“已启用首帧控制，如需添加参考素材，请先移除首帧。”
  - 已有关联素材的预览和移除按钮仍可用。

- 已有任意参考素材时：
  - 禁用本地首帧上传、资产库首帧选择和“上一分镜尾帧设为首帧”。
  - 显示提示：“当前分镜已有参考素材，如需使用首帧控制，请先移除全部参考素材。”
  - 当前首帧的预览和清除按钮仍可用。

- 历史冲突配置：
  - 在弹窗顶部显示醒目的校验警告。
  - 两侧新增入口均禁用。
  - 清除首帧、移除参考素材仍可操作，用户可自主选择保留哪种模式。

为实现可恢复行为，将参考素材区和首帧区的单一 `disabled` 拆分为：

- 全局 pending 禁用。
- 新增/选择入口禁用。
- 删除/清除入口禁用。

#### `frontend/components/workspace/storyboard-video-workspace.tsx`

- 根据当前 `StoryboardShotVideoConfig` 派生冲突状态。
- `handleGenerateVideo()` 在调用 API 前再次检查；若冲突则显示本地错误提示并直接返回。
- `VideoPreviewPanel` 接收校验错误：
  - 在生成按钮附近显示具体冲突提示。
  - 禁用“生成当前分镜视频 / 重新生成当前分镜”按钮。
- API 422 仍作为后端兜底，由现有 `getUserFacingErrorMessage()` 展示服务端校验消息。

### 4. 调整与新增测试

#### `backend/tests/test_storyboard_video_workspace.py`

新增参数化测试覆盖：

- 已有参考图、参考视频或参考音频时，设置图片首帧均返回 422。
- 已有参考素材时，设置上一镜尾帧为首帧返回 422。
- 已有首帧时，资产库关联三类参考素材均返回 422。
- 已有首帧时，本地上传三类参考素材返回 422，且资产数量和 TOS put 次数不变。
- 已有参考素材时，本地上传首帧返回 422，且不产生 Asset/TOS 对象。
- 历史冲突配置点击生成返回 422：
  - 不创建本地任务。
  - 不调用生成服务。
  - 不新增视频资产。
- 清除首帧和移除参考素材在冲突配置下仍成功。
- 合法的纯首帧模式、纯参考素材模式仍可生成。

修改现有“首帧与参考图同时提交”测试，拆分为两个合法模式测试。

#### `backend/tests/test_modelark.py`

- 删除/改写当前允许 `first_frame + reference_image` 的断言。
- 新增 `VideoGenerationRequest` 对以下组合的模型校验测试：
  - 首帧 + 参考图：拒绝。
  - 首帧 + 参考视频：拒绝。
  - 首帧 + 参考音频：拒绝。
  - 仅首帧：允许并生成 `role=first_frame`。
  - 仅多模态参考素材：允许且保留对应 `reference_*` role。

#### `frontend/tests/storyboard-shot-editor-dialog.test.tsx`

- 首帧存在时，全部参考素材新增入口禁用并显示原因，移除入口仍可用。
- 任一参考素材存在时，全部首帧选择入口禁用并显示原因，已有素材移除仍可用。
- 历史冲突配置显示警告且可通过清除/移除恢复。

#### `frontend/tests/project-workspace.test.tsx`

- 冲突配置下生成按钮禁用并展示明确提示。
- 触发 handler 的防御路径时不调用 `generateStoryboardShotVideo`。
- 合法配置下生成和重试流程保持原行为。

#### 可选新增 `frontend/tests/storyboard-video-validation.test.ts`

对共享判定工具做表驱动测试，覆盖无素材、纯首帧、三类纯参考素材和冲突状态。

## Assumptions & Decisions

- “全部参考媒体”包括 `reference_image`、`reference_video`、`reference_audio`。
- “上一分镜尾帧作为当前首帧”最终以 `role=first_frame` 提交，因此属于首帧模式。
- `return_last_frame=true` 只是要求方舟返回生成视频尾帧，继续始终开启。
- 当前产品没有显式输入 `role=last_frame` 字段；若未来增加，应纳入与首帧相同的互斥校验。
- 不自动删除或迁移任何历史配置，避免不可逆地丢失用户素材关联。
- 参数冲突属于本地 `validation_error`，不写成方舟供应商错误，不进入重试逻辑。
- 所有后端校验返回 HTTP 422，并使用同一条用户可理解的提示。
- 不修改数据库、API 请求/响应 Schema 或现有首帧来源字段。

## Verification

1. 后端静态检查：
   - `.venv/bin/python -m compileall -q backend/app backend/tests`

2. 后端相关测试：
   - `PYTHONPATH=. .venv/bin/pytest -q backend/tests/test_modelark.py backend/tests/test_storyboard_video_workspace.py`

3. 后端全量测试：
   - `PYTHONPATH=. .venv/bin/pytest -q backend/tests`

4. 前端类型与静态检查：
   - `npm run typecheck`
   - `npm run lint`

5. 前端相关与全量测试：
   - `npm test -- --run tests/storyboard-shot-editor-dialog.test.tsx tests/project-workspace.test.tsx tests/storyboard-video-validation.test.ts`
   - `npm test`

6. 前端生产构建：
   - `npm run build`

7. API 验收：
   - 构造一个已有参考素材的分镜，设置首帧应返回 422。
   - 构造一个已有首帧的分镜，关联或上传参考素材应返回 422。
   - 检查失败前后任务数、资产数和 TOS 上传数不变。

8. 浏览器验收：
   - 首帧模式下参考素材新增入口禁用且原因可见。
   - 参考素材模式下首帧新增入口禁用且原因可见。
   - 历史冲突配置下生成按钮禁用，但清除首帧和移除参考素材可用。
   - 修复冲突后生成按钮恢复可用。

9. 部署前操作：
   - 加载项目根目录 `.env` 重启后端。
   - 检查 `/api/projects` 返回 200。
   - 不在验收中调用真实 Seedance 生成，避免额外计费。
