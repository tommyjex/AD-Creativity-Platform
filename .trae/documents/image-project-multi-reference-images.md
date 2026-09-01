# 图片素材项目多参考图支持计划

## Summary

图片素材详情页的“参考图”从单张、仅当前页面临时生效，升级为最多 10 张的项目级持久选择。用户可一次选择或拖拽多张图片，上传后的选择会在刷新和重新进入项目后恢复；点击“生成图片”时，按用户当前排序将全部参考图发送给 Seedream 5.0 Pro。

参考图预览在窄屏每行展示 2 张，在 `sm` 及以上视口每行展示 4 张，保证移动端缩略图和操作按钮仍可用。

## Current State Analysis

- `frontend/components/workspace/image-project-workspace.tsx`
  - 使用单个 `referenceAsset: Asset | null` 状态，隐藏文件输入未设置 `multiple`，只读取 `files[0]`。
  - 当前 UI 显示“仅支持 1 张”，只有单个缩略图、替换和移除操作。
  - 图片生成提交 `reference_asset_id`，该选择不写入项目数据，刷新后丢失。
- `backend/app/schemas/image_generation.py`、`backend/app/api/routes.py`
  - 文生图请求、任务冻结快照和后台执行均只支持一个 `reference_asset_id`。
  - 后台任务只生成一个签名 URL，`ProjectImageGenerationRequest` 只含 `reference_image_url`。
- `backend/app/services/modelark.py`
  - 默认图片模型为 `doubao-seedream-5-0-pro-260628`，官方能力支持 2 至 10 张参考图融合；SDK 的 `image` 参数可传多图数组。
- `backend/app/db/models.py`、`backend/app/db/session.py`
  - `projects` 已使用增量迁移方式增加图片工作台字段，适合新增 JSON 参考图 ID 列。
- `frontend/tests/image-project-workspace.test.tsx` 和 `backend/tests/test_image_generation.py`
  - 已覆盖单图上传、单图生成快照、失败重试和引用有效性，需扩展为多图与上限行为。

## Assumptions & Decisions

- 选择状态是项目级持久状态：上传和移除会立即保存；刷新、重新进入项目后恢复。
- 上限为 10 张，顺序就是模型接收顺序；重复资产 ID 视为无效。
- 单个文件仍限制 PNG、JPEG、WebP 且不超过 20 MB，沿用既有前端和服务端校验。
- 一次选择导致总数超过 10 张时，前端不上传本批文件并提示剩余容量，避免产生用户未选择的孤立资产。
- 批量上传按选择顺序逐张完成，成功上传的图片立即纳入持久选择；若中途某张失败，已成功的图片保留并反馈失败结果，后续图片不再继续上传。
- 移除仅从项目选择列表删除，不删除已上传资产，保持现有资产库语义。
- “图片编辑”继续使用单张 `source_asset_id`，不接入多参考图；本功能只扩展“生成图片”的文生图参考图。
- API 保留旧 `reference_asset_id` 入参和既有单图冻结字段的读取兼容。新前端只发送 `reference_asset_ids`；新任务记录有序多图快照。

## Proposed Changes

### 1. 持久化项目参考图选择

修改：

- `backend/app/schemas/project.py`
- `backend/app/db/models.py`
- `backend/app/db/session.py`
- `backend/app/repositories/base.py`
- `backend/app/repositories/memory.py`
- `backend/app/repositories/mysql.py`

实施：

- 在项目 DTO（完整项目和项目列表项）增加 `image_reference_asset_ids: list[str]`，默认空数组。
- `ProjectORM` 增加非空 JSON 列 `image_reference_asset_ids`，默认 `[]`。
- 在 `_apply_additive_migrations` 增加幂等列迁移，使既有 MySQL/SQLite 项目自动获得空数组默认值。
- 在内存仓库与 MySQL 仓库的创建、读取、列表映射中携带该字段。
- 在 Repository 协议新增专用的 `set_image_reference_asset_ids(project_id, asset_ids)` 方法；实现中更新项目时间戳并保留调用顺序。

### 2. 提供持久选择接口并校验资产

修改：

- `backend/app/schemas/image_generation.py`
- `backend/app/schemas/__init__.py`
- `backend/app/api/routes.py`
- `frontend/lib/api-types.ts`
- `frontend/lib/api-client.ts`

实施：

- 新增 `ImageReferenceSelectionUpdate` 请求模型：`asset_ids` 长度 0 至 10，元素非空且不能重复。
- 新增 `PUT /api/projects/{project_id}/image-reference-selection`，返回更新后的完整 `Project`。
- 接口要求图片项目，并逐项复用当前图片生成参考图资产规则：资产属于该项目、公开、状态成功、类型为上传图片、MIME 合法。跨项目或失效资产不会写入选择。
- 客户端增加 `setImageProjectReferenceSelection(projectId, { asset_ids })` 方法和对应类型。

### 3. 扩展图片生成契约、冻结快照与模型请求

修改：

- `backend/app/schemas/image_generation.py`
- `backend/app/api/routes.py`
- `backend/app/services/modelark.py`
- `frontend/lib/api-types.ts`
- `frontend/components/workspace/image-project-workspace.tsx`

实施：

- `TextToImageGenerationRequest` 新增 `reference_asset_ids: list[str]`，长度最多 10；保留旧 `reference_asset_id`，并在模型校验中将旧字段规范为单元素列表、拒绝与新列表同时传入。
- 引入有序参考图冻结快照结构，包含每张图的资产 ID、对象键和创建时间；新任务的 hash 包含该完整有序列表，确保相同提示词但不同参考图集合不会错误去重。
- 后端提交时逐项校验并冻结参考资产；后台执行时逐项核对对象键和创建时间，获得全部签名 URL。任一快照不匹配或 URL 无法访问时，任务失败而非使用变化后的素材。
- 为已存在的失败单图任务保留 `reference_asset_id`、对象键和创建时间的读取回退，保证重试仍可执行。
- `ProjectImageGenerationRequest` 使用 `reference_image_urls` 列表（最多 10）；图生图仍拒绝参考图列表。
- BytePlus 适配器在无参考图时不传 `image`，一张时传字符串，2 至 10 张时按官方 SDK 传 URL 数组。Mock 适配器和生成资产 metadata 使用 `reference_image_count` 与有序 `reference_asset_ids`；为单图结果继续写入旧 `reference_asset_id` 以兼容历史读取。

### 4. 重构详情页上传、恢复与四列预览

修改：

- `frontend/components/workspace/image-project-workspace.tsx`

实施：

- 将单个 `referenceAsset` 改为有序 `referenceAssets: Asset[]`；从 `project.image_reference_asset_ids` 恢复，并按 ID 顺序从完整项目资产中解析。若某个历史 ID 不可用，前端忽略该项并在下次选择变更时写回有效集合。
- 文件输入增加 `multiple`，拖拽逻辑改为读取全部文件；上传前验证每张文件格式、大小以及总数不超过 10。
- 上传期间禁用上传与生成；成功上传后调用选择保存接口并用返回项目刷新本地工作区和上层项目状态。
- 将“更换参考图”改为“添加参考图”，显示 `n / 10`。达到上限后禁用添加并提供明确状态文本。
- 每张预览图独立展示缩略图、文件名和图标移除操作，按钮具备包含文件名的无障碍名称。
- 预览容器使用稳定栅格：`grid-cols-2 sm:grid-cols-4`，在目标桌面宽度一行 4 张，缩略图固定比例且文本截断，避免布局跳动。
- 生成 payload 改为 `reference_asset_ids: referenceAssets.map(asset => asset.id)`；无选择时不传该字段。

### 5. 回归测试与迁移测试

修改：

- `frontend/tests/image-project-workspace.test.tsx`
- `frontend/tests/api-client.test.ts`
- `backend/tests/test_image_generation.py`
- `backend/tests/test_project_types.py`

实施：

- 前端覆盖：一次上传多张、刷新初始化恢复顺序、生成请求携带有序 ID 列表、达到 10 张后拒绝新增、批量越界不触发上传、移除后持久化、预览网格在 `sm` 以上为四列。
- API 客户端覆盖：选择保存接口、数组请求体和上传 URL 保持正确编码。
- 后端覆盖：选择接口的持久化、10 张边界、重复/跨项目/失效/非图片资产拒绝，多图冻结快照、任务 hash 对顺序敏感、签名 URL 列表传入模型、生成 metadata 和记忆失败任务重试兼容。
- 模型适配器覆盖：0、1、2 和 10 张参考图分别生成正确的 `image` 参数，不传不支持的组图参数。
- 数据库迁移覆盖：旧项目数据库第二次初始化仍幂等，新增 JSON 列默认空数组，MySQL 与内存仓库均能读写和回传该字段。

## Verification

1. 后端在项目根目录使用 `.venv/bin/pytest` 运行：
   - `backend/tests/test_image_generation.py`
   - `backend/tests/test_project_types.py`
   - 与图片项目 API 契约相关的回归测试集。
2. 前端在 `frontend/` 运行：
   - `npm test -- image-project-workspace.test.tsx api-client.test.ts`
   - `npm run typecheck -- --pretty false`
   - `npm run lint`
3. 手工验收：
   - 在图片项目中一次选择 4 张 PNG/JPEG/WebP，预览在桌面一行 4 张，刷新页面后顺序与选择保持一致。
   - 累积上传至 10 张后，添加入口不可继续上传；移除任一张后可再次添加。
   - 生成请求实际使用全部已选参考图；生成产物 metadata 显示正确的参考图数量与 ID 顺序。
   - 已有单张参考图任务和失败任务重试行为保持可用。
