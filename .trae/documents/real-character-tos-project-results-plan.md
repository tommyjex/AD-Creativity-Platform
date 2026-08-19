# 项目故事/角色查看与真实角色图 TOS 存储实施计划

## Summary

本次变更包含两个相互关联的目标：

1. 在工作台 `/workspace/projects` 的项目详情中，以 `Brief / 故事 / 角色` Tab 展示项目内容；不修改兼容路由 `/projects/[projectId]`。
2. 将角色生成从固定 Mock 结果升级为真实 BytePlus ModelArk Seedream 生图，并把模型返回的角色图片下载后真实上传到 `.env` 配置的 TOS；TOS 成功后再持久化 MySQL 资产记录。

验收标准：

- 用户选择项目后能切换查看可编辑 Brief、最新有效故事全文和成功角色图片。
- 角色生成调用 `.env` 中的 Ark API Key 和 `ARK_IMAGE_MODEL`，默认模型为 `dola-seedream-5-0-pro-260628`。
- 每个新角色图片在 TOS 中存在真实对象，MySQL `assets` 保存正确的 `object_key`、TOS URL、大小、MIME、角色元数据和来源任务。
- 图片下载、TOS 上传或数据库批量写入失败时，角色任务进入 `failed`，不向前端暴露伪成功资产，并可沿用现有重试入口。
- 既有两条只登记 object key 的历史角色记录不迁移、不删除；重新生成后产生真实 TOS 对象。
- 自动化测试全部通过，并使用现有 `.env` 执行一次会产生费用的真实 ModelArk → TOS 端到端联调。

## Current State Analysis

### 前端

- 工作台项目详情由 `frontend/components/workspace/project-workspace.tsx` 的 `ProjectDetail` 渲染，当前顺序是项目摘要、`WorkspaceCreativeWorkflow`、独立 `ProjectEditor`。
- `Project` 响应已经包含 `text_artifacts` 和 `assets`，无需新增读取 API：
  - 故事来自 `text_artifacts` 中 `stage === "story"` 的最新有效版本。
  - 角色来自 `assets` 中 `category === "character"` 的成功资产。
- 当前 UI 没有 Tabs 基础组件，依赖中也没有 Radix Tabs；应实现一个小型、可访问的业务 Tab 组件，避免为三项切换增加新前端依赖。
- `frontend/components/workspace/workspace-asset-library.tsx` 和 `frontend/lib/asset-display.ts` 已有资产预览、描述回退、状态和日期展示模式，可复用其 URL 安全处理及视觉语言。

### 后端

- 故事已通过 `WorkflowService.write_text_artifact` 写入 MySQL `text_artifacts`。
- 角色生成入口是 `POST /api/projects/{project_id}/characters`，`backend/app/api/routes.py::_generate_characters` 当前调用 `ModelArkGenerationService` 后使用 `workflow.create_asset`。
- `ModelArkGenerationService()` 默认使用 `MockModelArkAdapter`；应用依赖工厂也返回该默认实例，因此生产运行没有调用真实 ModelArk。
- Mock 角色 URL 是 `mock://...`。
- `AssetStorageService.register_asset` 只生成 TOS object key/URL 并写数据库，不调用 TOS `put_object`；`upload_asset` 才会真实上传字节。
- `.env` 已配置 Ark Key 别名和完整 TOS 参数，但 `Settings` 尚未读取 Ark API Key/Base URL。
- `backend/pyproject.toml` 尚未安装官方 `byteplus-python-sdk-v2[ark]`；`httpx` 目前只在 dev 依赖中。
- 官方当前 Python 接口为 `from byteplussdkarkruntime import Ark` 和 `client.images.generate(...)`，Seedream 5.0 Pro 支持 `2K`、`png`、URL 响应：
  - https://docs.byteplus.com/en/docs/ModelArk/1824121
  - https://docs.byteplus.com/en/docs/ModelArk/1541523

### 仓库与兼容性

- 当前目录不是 Git 仓库，计划不包含 commit。
- 保留 `MockModelArkAdapter` 供单元/集成测试使用。
- 旧 `/projects/[projectId]` 页面、故事 API、角色跳过语义、剧本依赖和通用资产注册能力保持兼容。

## Proposed Changes

### 1. 补齐 ModelArk 与下载配置

**文件：`backend/pyproject.toml`**

- 将 `httpx>=0.28.0,<1.0.0` 加入运行时依赖。
- 将官方 `byteplus-python-sdk-v2[ark]` 加入运行时依赖，替换现有未使用的 `volcengine-python-sdk` optional 占位。
- 测试依赖仍保留 pytest，不在测试中访问真实外部服务。

**文件：`backend/app/core/config.py`**

- 新增：
  - `ark_api_key: SecretStr | None`，按 `ARK_API_KEY` → `BYTEPLUS_ARK_API_KEY` 顺序读取。
  - `ark_base_url`，默认 `https://ark.ap-southeast.bytepluses.com/api/v3`。
  - 角色图片下载超时默认 30 秒、最大 30 MiB；允许用环境变量覆盖，但不要求修改现有 `.env`。
- 新增 `require_modelark_config()`；错误只报告缺失变量名，不泄露 Key。
- 保留现有 `ARK_IMAGE_MODEL` 默认值和 TOS 配置读取方式。

**测试：`backend/tests/test_config.py`**

- 覆盖 `ARK_API_KEY` 与 `BYTEPLUS_ARK_API_KEY` 别名优先级、默认 Base URL、缺失 Key 的脱敏错误以及下载限制校验。

### 2. 实现真实 BytePlus ModelArk 角色生图适配器

**文件：`backend/app/services/modelark.py`**

- 新增 `BytePlusModelArkAdapter`，保持现有 `ModelArkAdapter` 协议。
- 用 `Ark(base_url=..., api_key=...)` 初始化官方客户端。
- `generate_characters` 延续现有两个角色定义：
  - 品牌体验官。
  - 目标用户。
- 为每个角色分别构造包含商品、目标受众、视觉风格、故事上下文、角色身份和“一致的广告角色设定图”约束的 prompt。
- 每个角色调用一次：
  - `model=settings.ark_image_model`
  - `size="2K"`
  - `output_format="png"`
  - `response_format="url"`
  - `watermark=False`
- SDK 是同步调用；在 async 适配器中通过 `asyncio.to_thread` 执行，避免阻塞事件循环。
- 校验响应至少包含一个非空 URL；将 URL、角色名称/描述、模型、prompt 摘要、角色序号写入 `GeneratedAssetResult`。
- 将 SDK 鉴权、限流、内容安全、空响应等异常统一包装为不含 Key/完整响应体的生成错误，交给现有 `_run_stage` 转为失败任务。
- 文本、分镜、视频仍暂时走 Mock；本次只把角色生图切换为真实适配器能力。

**文件：`backend/app/services/generation.py`**

- `ModelArkGenerationService` 继续支持注入 Mock。
- 新增明确的 `HybridModelArkAdapter`：`generate_characters` 委托 `BytePlusModelArkAdapter`，文本、生图和生视频方法委托 `MockModelArkAdapter`。
- `get_generation_service()` 固定构造上述混合适配器，避免扩大真实模型接入范围。
- 测试直接注入 `MockModelArkAdapter`，不因本地 `.env` 存在 Key 而访问外部服务。

**测试：新增或扩展 `backend/tests/test_modelark.py`**

- 使用 fake Ark client 验证两次 `images.generate` 的模型、prompt、尺寸、格式、URL 响应和无水印参数。
- 覆盖空数据、缺 URL、SDK 异常和敏感错误脱敏。
- 确认现有 Mock 结果仍可预测。

### 3. 下载角色图片并原子化转存 TOS

**文件：`backend/app/services/assets.py`**

- 新增可注入的 `RemoteAssetDownloader` 协议和基于 `httpx.AsyncClient` 的默认实现。
- 下载器只接受 `http`/`https`，跟随有限重定向，使用配置超时，流式累计最多 30 MiB。
- 要求 HTTP 2xx，校验最终 MIME 为图片类型，并优先使用响应 `Content-Type`；拒绝 HTML、空内容、超限内容和不支持协议。
- 新增角色批量转存方法，输入多个 `StoredAssetInput`：
  1. 先下载全部模型结果。
  2. 为每项预生成资产 ID、object key 和最终 TOS URL。
  3. 使用 `.env` 创建的 `TosObjectStorageClient` 上传每个对象。
  4. 所有 TOS 上传成功后，再批量写数据库。
- 扩展 TOS client 协议支持 `delete_object`。若中途上传失败或数据库写入失败，尽力删除本批已写入 TOS 的对象。
- 数据库 metadata 保留角色名称、描述、模型、prompt 摘要和来源域名；不保存带查询参数的完整临时模型 URL，也不得写入 Key 或完整错误响应。
- 上传后的 `size_bytes` 使用实际下载字节数，`mime_type` 使用验证后的响应类型，object key 保持 `projects/{project_id}/character/{asset_id}.png`。
- 保留 `register_asset` 与单文件 `upload_asset`，避免影响场景图、视频和已有测试。

**文件：`backend/app/repositories/base.py`**

- 新增 `create_assets(items)` 批量接口，用于一批角色资产的可观察原子提交。

**文件：`backend/app/repositories/mysql.py`**

- 在单个 `session.begin()` 中批量插入角色资产并一次提交；任一行失败则回滚整批。

**文件：`backend/app/repositories/memory.py`**

- 在锁内完成批量校验后一次写入，行为与 MySQL 契约一致。

**文件：`backend/app/services/workflow.py`**

- 新增 async 角色资产转存入口，委托 `AssetStorageService` 完成下载、TOS 上传和批量落库，然后统一更新项目状态。
- 现有 `create_asset` 继续服务其他阶段。

**文件：`backend/app/api/routes.py`**

- `_generate_characters` 不再调用只登记地址的 `workflow.create_asset`。
- 将真实模型返回的全部角色来源 URL 交给 async 批量转存入口。
- 仅在整批 TOS 上传和 MySQL 写入成功后调用 `complete_task`。
- 任一步失败由现有 `_run_stage` 将角色任务标记 `failed`；返回安全错误，重试继续使用 `POST /api/tasks/{task_id}/retry`。

**测试：`backend/tests/test_assets.py`**

- fake HTTP downloader + fake TOS client 覆盖：
  - 下载并真实调用 `put_object`。
  - MIME、大小、object key、URL 和 metadata。
  - 下载失败、超限、非图片、TOS 失败。
  - 中途失败时 best-effort 删除已上传对象。
  - 全部成功后才批量持久化。

**测试：`backend/tests/test_database.py` / `backend/tests/test_character_workflow.py`**

- 覆盖 MySQL 批量插入成功与回滚。
- 覆盖角色任务成功时两张图均有真实上传调用和数据库记录。
- 覆盖下载/TOS 失败时任务为 `failed`、无角色资产记录、可创建重试任务。
- 更新原先断言 `metadata.source_url.startswith("mock://")` 的测试；测试环境为 `MockModelArkAdapter` 注入可识别 `mock://` 的 fake downloader，并通过 fake TOS client 验证真实字节上传语义。

### 4. 在工作台项目详情增加 Brief / 故事 / 角色 Tab

**新增文件：`frontend/components/workspace/project-detail-tabs.tsx`**

- 实现无额外依赖的可访问 Tab：
  - `role="tablist"`、`role="tab"`、`role="tabpanel"`。
  - `aria-selected`、`aria-controls`、明确 focus 样式。
  - 默认选中 `Brief`；项目切换时组件用 `key={project.id}` 重置到 Brief。
- Props：
  - `project: Project`
  - `briefPanel: ReactNode`
- `Brief` 面板渲染传入的现有 `ProjectEditor`，不复制表单逻辑。
- `故事` 面板：
  - 从 `project.text_artifacts` 过滤 `stage === "story"` 且非 `stale`，按版本/更新时间取最新。
  - 展示标题、版本、状态、更新时间和 `whitespace-pre-wrap` 正文。
  - 无故事时展示空状态和“请先在创作流程生成故事”的说明。
- `角色` 面板：
  - 过滤 `project.assets` 中 `category === "character"` 且 `status === "succeeded"`。
  - 复用 `getSafePreviewUrl`、`getWorkspaceAssetDescription` 和日期格式化。
  - 响应式网格展示 TOS 图片、角色名、描述和生成时间。
  - 图片加载失败显示稳定占位，不把 `object_key` 当可直接访问 URL。
  - 无角色时区分“已跳过角色阶段”和“尚未生成”，提供清晰说明；不在此新增生成按钮，生成仍由上方流程负责。
- 视觉沿用现有蓝白卡片、边框和状态 Badge，不引入新的主题或动画。

**文件：`frontend/components/workspace/project-workspace.tsx`**

- `ProjectDetail` 保持“摘要 → 创作流程 → 内容 Tab”。
- 用 `ProjectDetailTabs` 替换独立渲染的编辑表单，将原 `ProjectEditor` 作为 `briefPanel` 传入。
- `onUpdated` 仍使用现有状态提升；保存 Brief 后故事和角色面板立即收到最新 `Project`。

**测试：`frontend/tests/project-workspace.test.tsx`**

- 扩展项目 fixture，包含多版本故事、stale 故事、成功角色和失败角色。
- 验证默认 Brief、Tab 可访问属性和切换。
- 验证故事只显示最新有效版本及元数据。
- 验证角色只显示成功角色，图片使用 TOS URL，展示名称/描述/时间。
- 验证无故事、无角色、角色已跳过和图片失败占位。
- 保持现有项目创建、编辑、失败保留输入测试。

### 5. 配置、启动与真实联调

**配置使用**

- 不在代码、日志或测试输出中打印 `.env` 值。
- Ark 使用：
  - `ARK_API_KEY` 或 `BYTEPLUS_ARK_API_KEY`
  - `ARK_BASE_URL`（缺失时使用官方 ap-southeast-1 默认）
  - `ARK_IMAGE_MODEL`
- TOS 使用：
  - `TOS_ACCESS_KEY`/`TOS_AK`
  - `TOS_SECRET_KEY`/`TOS_SK`
  - `TOS_ENDPOINT`
  - `TOS_REGION`
  - `TOS_BUCKET`
  - `TOS_PUBLIC_ENDPOINT`

**真实联调步骤**

1. 安装更新后的 backend 依赖。
2. 加载 `.env`，重启 FastAPI；前端沿用现有服务。
3. 创建一个专用联调项目或使用明确的测试项目，生成故事后触发角色生成。
4. 等待任务结束，验证：
   - ModelArk 返回两张角色图。
   - TOS bucket 中存在对应 `projects/{project_id}/character/*.png`。
   - MySQL 中存在两条 `category=character` 资产，URL 指向 `TOS_PUBLIC_ENDPOINT`，大小大于 0。
   - 工作台项目详情“故事”和“角色”Tab 正常展示。
5. 联调会产生模型与存储费用；不删除既有历史角色记录。
6. 若真实模型、下载或 TOS 失败，保留失败任务用于诊断，不把 Key、完整供应商响应或签名信息写入日志。

## Assumptions & Decisions

- 仅增强工作台 `/workspace/projects`；兼容页 `/projects/[projectId]` 不变。
- UI 采用 `Brief / 故事 / 角色` Tab，默认 Brief。
- 本次接入真实 ModelArk 仅覆盖角色生图；故事、剧本、分镜和视频仍保持现有 Mock 行为。
- 使用官方 `byteplus-python-sdk-v2[ark]`，角色模型来自 `ARK_IMAGE_MODEL`，输出 2K PNG URL、无水印。
- 角色图由后端下载后上传 TOS，不让前端直接依赖模型临时 URL。
- TOS/下载/数据库任一步失败时任务失败并可重试；批次对用户保持全有或全无，外部对象失败时尽力清理。
- 历史角色记录不迁移、不删除；其对象可能不可访问，用户需重新生成获得真实 TOS 资产。
- `TOS_PUBLIC_ENDPOINT` 被视为浏览器可访问的资产域名；私有桶签名 URL 不在本次范围。
- 不增加角色编辑、删除、排序、选择主角色、场景图 TOS 转存或旧详情页展示。
- 当前目录无 Git 元数据，因此不安排 commit。

## Verification

### 后端自动化

```bash
.venv/bin/python -m pytest backend/tests/test_config.py -q
.venv/bin/python -m pytest backend/tests/test_modelark.py -q
.venv/bin/python -m pytest backend/tests/test_assets.py -q
.venv/bin/python -m pytest backend/tests/test_character_workflow.py -q
.venv/bin/python -m pytest backend -q
```

通过标准：

- 真实适配器参数和错误映射测试通过。
- 下载/TOS 批量转存与清理测试通过。
- MySQL 原子批量资产测试通过。
- 角色任务失败/重试测试通过。
- 后端全量无失败。

### 前端自动化

```bash
cd frontend
PATH="/opt/homebrew/Cellar/node@20/20.20.0/bin:$PATH" npm run lint
PATH="/opt/homebrew/Cellar/node@20/20.20.0/bin:$PATH" npm run typecheck
PATH="/opt/homebrew/Cellar/node@20/20.20.0/bin:$PATH" npm test
PATH="/opt/homebrew/Cellar/node@20/20.20.0/bin:$PATH" npm run build
```

通过标准：

- Tab 可访问性、故事版本选择、角色过滤和空状态测试通过。
- 既有工作台、资产库和流程测试不回归。
- lint、类型检查和生产构建通过。

### 浏览器与真实服务验收

- 桌面和 390px 窄屏检查 Tab 不溢出、键盘可切换、正文和角色网格可阅读。
- 浏览器 console 无业务错误，无真实 4xx/5xx。
- 使用 `.env` 执行一次真实角色生成，确认 ModelArk、TOS、MySQL 和前端展示四段链路完整。
- 记录安全摘要：任务 ID、项目 ID、TOS object key、HTTP 状态和测试结果；不输出密钥或完整临时模型 URL。
