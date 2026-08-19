# 文本生成模型切换与图文输入支持计划

## Summary

本次目标是后端优先启用真实文本生成能力：文本生成模型使用 `doubao-seed-evolving`，并让故事生成、剧本生成、分镜脚本生成等文本阶段具备“文本 + 图片”输入能力。实施范围先限定在后端，不改前端交互；后端 API 和服务层预留可选图片输入，后续前端可在工作台选择资产库图片后接入。

成功标准：
- `ARK_TEXT_MODEL` 默认值和 `.env` 均明确为 `doubao-seed-evolving`。
- 真实 ModelArk 文本生成不再总是回退到 mock；故事、剧本、分镜脚本阶段可通过真实 ARK 文本模型生成。
- 文本阶段支持纯文本输入和可选图片 URL 输入：无图片时走 Chat Completions，有图片时走 Responses API 的 `input_text` + `input_image`。
- 真实调用错误和解析错误不暴露 API Key、签名 URL、原始 provider 错误。
- 现有 mock 测试继续稳定，新增后端单元测试覆盖纯文本调用、图文调用、输出解析、错误脱敏和配置读取。

## Current State Analysis

已确认的现状：
- 配置文件：[backend/app/core/config.py](file:///Users/bytedance/AD-Creativity/backend/app/core/config.py)
  - `ark_text_model` 默认已是 `dola-seed-evolving`，不是本次指定的 `doubao-seed-evolving`。
  - `ark_image_model`、`ark_video_model`、`ark_base_url` 已是国内火山引擎配置。
  - `Settings.from_env()` 已读取 `ARK_TEXT_MODEL`、`ARK_IMAGE_MODEL`、`ARK_VIDEO_MODEL`、`ARK_BASE_URL`。
- 环境文件：[.env](file:///Users/bytedance/AD-Creativity/.env)
  - 当前包含 `ARK_API_KEY`、`ARK_BASE_URL`、`ARK_IMAGE_MODEL`、`ARK_VIDEO_MODEL`。
  - 当前未显式包含 `ARK_TEXT_MODEL`。
- 文本请求模型：[backend/app/services/modelark.py](file:///Users/bytedance/AD-Creativity/backend/app/services/modelark.py)
  - `TextGenerationRequest` 当前只有 `project_id`、`stage`、`brief`、`upstream_content`，没有图片输入字段。
  - `BytePlusModelArkAdapter.generate_text()` 当前直接抛出 `real text generation is not enabled...`。
  - `HybridModelArkAdapter.generate_text()` 当前直接转发到 `fallback_adapter.generate_text()`，所以故事、剧本、分镜脚本仍走 `MockModelArkAdapter`。
  - `MockModelArkAdapter` 已有稳定的故事、剧本、分镜脚本文本生成逻辑和 prompt builder，可复用其 prompt 构造逻辑。
- 生成服务：[backend/app/services/generation.py](file:///Users/bytedance/AD-Creativity/backend/app/services/generation.py)
  - `generate_story()` 只传 brief。
  - `generate_script()` 传 brief + 上游故事文本。
  - `generate_storyboard()` 传 brief + 上游剧本文本。
  - 当前没有向文本生成传递图片 URL。
- 路由：[backend/app/api/routes.py](file:///Users/bytedance/AD-Creativity/backend/app/api/routes.py)
  - `POST /api/projects/{project_id}/story` 无 payload。
  - `POST /api/projects/{project_id}/script` 无 payload。
  - `POST /api/projects/{project_id}/storyboard` 无 payload。
  - 项目资产访问 URL 已通过 `AssetStorageService.with_access_url()` / `with_project_access_urls()` 生成短期签名 URL。
- 技术方案：[.trae/specs/write-technical-solution/spec.md](file:///Users/bytedance/AD-Creativity/.trae/specs/write-technical-solution/spec.md)
  - 已写明文本模型适用阶段和图文输入方向。
  - 目前仍写 `ARK_TEXT_MODEL=dola-seed-evolving`，需要改为 `doubao-seed-evolving`。
- SDK 现状：
  - `byteplussdkarkruntime.Ark` 支持 `api_key`、`base_url`、`timeout`、`http_client`。
  - SDK 中存在 `client.chat.completions.create(...)` 和 `client.responses.create(...)`。
  - Responses API 支持 `input_text`、`input_image`，图片字段为 `image_url`，返回结构中可从 `output[*].content[*].text` 抽取文本。

## Proposed Changes

### 1. 更新文本模型配置

文件：
- [backend/app/core/config.py](file:///Users/bytedance/AD-Creativity/backend/app/core/config.py)
- [.env](file:///Users/bytedance/AD-Creativity/.env)
- [backend/tests/test_config.py](file:///Users/bytedance/AD-Creativity/backend/tests/test_config.py)

变更：
- 将 `Settings.ark_text_model` 默认值从 `dola-seed-evolving` 改为 `doubao-seed-evolving`。
- 在 `.env` 增加：
  - `ARK_TEXT_MODEL=doubao-seed-evolving`
- 更新配置测试，断言默认文本模型和环境覆盖能力。

原因：
- 用户明确指定文本生成模型为 `doubao-seed-evolving`。
- `.env` 显式写入可避免本地运行依赖代码默认值。

### 2. 扩展文本生成请求，支持图片输入

文件：
- [backend/app/services/modelark.py](file:///Users/bytedance/AD-Creativity/backend/app/services/modelark.py)
- [backend/app/services/generation.py](file:///Users/bytedance/AD-Creativity/backend/app/services/generation.py)

变更：
- 给 `TextGenerationRequest` 增加：
  - `image_urls: list[str] = Field(default_factory=list)`
- 给 `ModelArkGenerationService` 的文本阶段方法增加可选参数：
  - `generate_story(..., image_urls: Sequence[str] | None = None)`
  - `generate_script(..., image_urls: Sequence[str] | None = None)`
  - `generate_storyboard(..., image_urls: Sequence[str] | None = None)`
- 当前路由层先传空列表，保留后端接口能力；后续前端或 API payload 可接入图片选择。

原因：
- 保持后端优先范围，先打通服务层和适配层能力。
- 不破坏现有无 payload 的生成接口。

### 3. 实现真实文本生成适配器

文件：
- [backend/app/services/modelark.py](file:///Users/bytedance/AD-Creativity/backend/app/services/modelark.py)

变更：
- 将 `BytePlusModelArkAdapter.generate_text()` 从“未启用”改为真实调用。
- 调用策略：
  - `request.image_urls` 为空：使用 `client.chat.completions.create(...)`。
  - `request.image_urls` 非空：使用 `client.responses.create(...)`，输入包含一个 `input_text` 和多个 `input_image`。
- prompt 构造：
  - `Stage.STORY` 新增 `build_story_prompt()`。
  - `Stage.SCRIPT` 复用并完善 `MockModelArkAdapter.build_script_prompt()`。
  - `Stage.STORYBOARD` 复用并完善 `MockModelArkAdapter.build_storyboard_prompt()`。
- 输出格式：
  - 先要求模型输出 JSON，后端用 Pydantic/结构化解析转为 `GeneratedTextResult`。
  - 故事和剧本至少解析 `title`、`content`。
  - 分镜脚本解析 `title`、`content`、`storyboard_shots`，并继续由 `ModelArkGenerationService._validate_storyboard_shots()` 校验时长和镜头编号。
- 文本抽取：
  - Chat Completions：读取 `response.choices[0].message.content`。
  - Responses：遍历 `response.output`，抽取 `output_text` 的 `text`。
- 错误处理：
  - provider 异常统一转成 `ModelArkProviderError("text generation failed for stage ...")`。
  - JSON 解析/字段校验失败统一转成 `ModelArkTextParseError(...)`。
  - 错误消息不包含 API Key、签名 URL、原始 provider 文本。
- metadata：
  - 写入 `model=self.settings.ark_text_model`。
  - 写入 `provider="volcengine-modelark"` 或保持兼容字符串但不影响业务。
  - 写入 `artifact_kind`、`has_upstream`、`image_input_count`、`prompt_summary`。

原因：
- 让故事、剧本、分镜脚本真正使用 `doubao-seed-evolving`。
- 对图文输入使用 Responses API，符合 SDK 能力和技术方案。

### 4. 调整 Hybrid 路由策略

文件：
- [backend/app/services/modelark.py](file:///Users/bytedance/AD-Creativity/backend/app/services/modelark.py)
- [backend/app/services/generation.py](file:///Users/bytedance/AD-Creativity/backend/app/services/generation.py)

变更：
- 将 `HybridModelArkAdapter.generate_text()` 改为优先调用真实 adapter。
- 保留 mock adapter 作为测试注入能力，但生产默认 `get_generation_service()` 应使用真实文本/角色 adapter。
- 可选实现方式：
  - 将构造参数从 `character_adapter` 改成更通用的 `primary_adapter` + `fallback_adapter`。
  - 或保持类名和字段名，最小改动为 `generate_text()` 调用 `character_adapter.generate_text()`，图片/视频仍按现有路由。

推荐：
- 采用最小改动，避免大范围重命名；类名后续可单独重构。

原因：
- 当前真实 adapter 已承担 ARK 客户端初始化；复用它可减少 SDK 客户端重复。

### 5. 后端路由预留图片输入接口

文件：
- [backend/app/api/routes.py](file:///Users/bytedance/AD-Creativity/backend/app/api/routes.py)
- [backend/app/schemas/asset.py](file:///Users/bytedance/AD-Creativity/backend/app/schemas/asset.py) 或新增轻量请求 schema 文件

变更：
- 新增轻量请求体，例如：
  - `TextGenerationInputRequest`
  - 字段：`reference_asset_ids: list[str] = []`
- 对以下接口保持向后兼容：
  - `POST /api/projects/{project_id}/story`
  - `POST /api/projects/{project_id}/script`
  - `POST /api/projects/{project_id}/storyboard`
- 请求体设为可选，未传时行为不变。
- 若传 `reference_asset_ids`：
  - 校验资产属于当前项目。
  - 仅允许图片类资产或 `mime_type` 以 `image/` 开头。
  - 通过 `AssetStorageService.with_access_url(asset)` 获取短期可访问 URL。
  - 将 URL 列表传给对应 `_generate_story/_generate_script/_generate_storyboard`。

原因：
- 后端先具备图文输入能力，前端后续只需调用已有接口并传资产 ID。
- 不把 TOS 私有 object key 暴露给模型，仍走短期签名 URL。

### 6. 测试补充

文件：
- [backend/tests/test_config.py](file:///Users/bytedance/AD-Creativity/backend/tests/test_config.py)
- [backend/tests/test_modelark.py](file:///Users/bytedance/AD-Creativity/backend/tests/test_modelark.py)
- [backend/tests/test_api.py](file:///Users/bytedance/AD-Creativity/backend/tests/test_api.py)

新增/更新测试：
- 配置：
  - 默认 `ark_text_model == "doubao-seed-evolving"`。
  - `ARK_TEXT_MODEL` 环境变量可覆盖。
- ModelArk 适配层：
  - 纯文本请求调用 `chat.completions.create()`，模型为 `doubao-seed-evolving`。
  - 图文请求调用 `responses.create()`，输入包含 `input_text` 和 `input_image`。
  - Responses 输出文本可被正确抽取。
  - 故事/剧本 JSON 被解析为 `GeneratedTextResult`。
  - 分镜 JSON 被解析为 `StoryboardShotCreate` 列表。
  - provider 异常和解析异常不泄露原始错误、API Key、签名 URL。
- API：
  - 不传请求体时，故事/剧本/分镜接口保持现有行为。
  - 传 `reference_asset_ids` 时，仅图片资产被转换成签名 URL 并传给 generation service。
  - 传不存在、跨项目、非图片资产时返回安全错误。

### 7. 文档同步

文件：
- [.trae/specs/write-technical-solution/spec.md](file:///Users/bytedance/AD-Creativity/.trae/specs/write-technical-solution/spec.md)
- [.trae/specs/implement-backend-modules/spec.md](file:///Users/bytedance/AD-Creativity/.trae/specs/implement-backend-modules/spec.md)

变更：
- 将文本模型引用从 `dola-seed-evolving` 改为 `doubao-seed-evolving`。
- 补充后端优先阶段的图文输入约定：
  - API 传资产 ID。
  - 后端转换为短期签名 URL。
  - 图文输入走 Responses API。
  - 纯文本输入走 Chat Completions。

## Assumptions & Decisions

- 本次按用户确认的“后端优先”实施，不改前端 UI。
- “故事生成、剧本生成等场景”按当前文本阶段统一覆盖：`story`、`script`、`storyboard`。
- 图片输入先使用项目内已有图片资产的 ID，不新增本地图片上传入口。
- 签名 URL 只在后端调用模型时短期使用，不写入文本产物正文。
- 不做真实付费模型 smoke 调用；验证通过 fake client/unit test 完成。
- 不重命名 `BytePlusModelArkAdapter`，避免本次夹带大范围重构；后续可单独改名为更中性的 `ModelArkAdapter`。
- 保留 `BYTEPLUS_ARK_API_KEY` 作为兼容读取别名，但 `.env` 主配置使用 `ARK_API_KEY`。

## Verification Steps

实施后执行：

```bash
.venv/bin/python -m pytest backend/tests/test_config.py backend/tests/test_modelark.py backend/tests/test_api.py -q
```

再执行全量后端测试：

```bash
.venv/bin/python -m pytest backend/tests -q
```

静态检查：

```bash
rg -n "dola-seed-evolving" backend .trae/specs .env -S
rg -n "doubao-seed-evolving|ARK_TEXT_MODEL" backend .trae/specs .env -S
```

配置读取验证，禁止打印 API Key：

```bash
set -a; source .env; set +a; .venv/bin/python - <<'PY'
from backend.app.core.config import Settings
settings = Settings.from_env()
print("ark_text_model=" + settings.ark_text_model)
print("ark_api_key_set=" + str(settings.ark_api_key is not None))
PY
```
