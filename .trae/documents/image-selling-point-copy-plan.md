# 图片卖点文案双引号提示词实施计划

## Summary

图片素材项目的图片提示词必须包含将实际显示在图片上的卖点文案。AI 生成提示词时，从 Brief 的 `selling_points` 中择优选择 1–2 条，做简洁、符合目标语言的营销表达润色，但不得新增规格、功效、认证、价格或其他未提供事实。每条需要 Seedream 渲染的文字必须使用 ASCII 英文双引号包裹，例如：

```text
画面右上方加入简洁卖点文案："轻巧随行，随时鲜萃"
```

采用已确认的“纯文本契约 + 前后端双重校验”方案：

- 保持 `ImagePromptSuggestion`、`ImagePromptVersion` 和图片生成请求的现有纯文本数据结构。
- 不新增数据库字段，不迁移或删除历史提示词版本。
- AI 输出、新提示词版本保存、图片生成入口均执行相同的双引号文案规则。
- 历史版本仍可查看和载入编辑器；不合规版本禁止生成图片，用户需 AI 改写或手动补充后保存新版本。

## Current State Analysis

### Brief 与图片项目约束

- [`backend/app/schemas/brief.py`](../../backend/app/schemas/brief.py) 使用 `selling_points: list[str]` 保存卖点。
- [`backend/app/schemas/project.py`](../../backend/app/schemas/project.py) 已要求图片项目至少有一条卖点，因此 AI 生成时始终有可用事实来源。
- `target_language` 已支持 `zh` / `en`，应继续决定提示词及画面文案的语言。

### AI 图片提示词生成

- [`backend/app/api/routes.py`](../../backend/app/api/routes.py) 的
  `POST /api/projects/{project_id}/image-prompts/generate` 读取完整项目 Brief。
- [`backend/app/services/generation.py`](../../backend/app/services/generation.py)
  将 Brief 与可选 `current_prompt` 传给模型适配器。
- [`backend/app/services/modelark.py`](../../backend/app/services/modelark.py)
  的 `build_image_prompt_messages` 当前明确限制“除非 Brief 明确要求，否则不生成画面文字”，与本需求冲突。
- 当前模型输出只校验非空，不校验是否包含画面文案、引号是否成对或文案数量。
- Mock 适配器仅描述卖点，没有生成双引号包裹的可见文字。

### 保存与生图

- [`backend/app/schemas/image_prompt.py`](../../backend/app/schemas/image_prompt.py)
  仅校验提示词非空。
- [`backend/app/api/routes.py`](../../backend/app/api/routes.py) 保存 Prompt Version 时原样持久化提示词；生图时读取当前 Prompt Version 并冻结输入。
- [`backend/app/services/generation.py`](../../backend/app/services/generation.py)
  的 `normalize_project_image_prompt` 只追加比例和用途，不会移除或改写双引号，因此可保持文案原文进入 Seedream。
- 现有历史版本可能不包含双引号文案，必须在创建图片任务前增加兼容性拦截。

### 前端

- [`frontend/components/workspace/image-project-workspace.tsx`](../../frontend/components/workspace/image-project-workspace.tsx)
  管理 AI 生成、编辑、保存和生图按钮；当前只检查非空、长度和脏状态。
- [`frontend/lib/api-client.ts`](../../frontend/lib/api-client.ts) 与
  [`frontend/lib/api-types.ts`](../../frontend/lib/api-types.ts) 的 API 契约无需修改。
- 现有 UI 已有反馈区域和 `role="alert"` / `role="status"` 模式，可复用显示文案规则。

## Proposed Changes

### 1. 建立统一的图片提示词文案校验规则

**文件：** [`backend/app/schemas/image_prompt.py`](../../backend/app/schemas/image_prompt.py)

新增可复用的纯函数，例如 `validate_visible_selling_copy(prompt: str) -> str`，并定义唯一规则：

1. 只识别 ASCII 双引号 `"`；中文弯引号 `“”` 不视为合规，以匹配 Seedream 的提示词约定。
2. 提示词必须含 1–2 组成对双引号。
3. 每组双引号内部去除首尾空白后必须非空。
4. 不允许未闭合、游离或嵌套双引号。
5. 校验只验证格式和数量，不重新排版、不改写用户原文。

将该函数用于：

- `ImagePromptVersionSave.prompt`：API 请求阶段返回标准 422。
- `ImagePromptVersionCreate.prompt`：保护 repository 的内部写入入口，确保所有新版本一致。

历史数据库记录不回写，因此不会触发迁移。

### 2. 调整 Seed Evolving 图片提示词契约

**文件：** [`backend/app/services/modelark.py`](../../backend/app/services/modelark.py)

更新 `MockModelArkAdapter.build_image_prompt_messages`：

- 移除“默认不请求可见文字”的旧约束。
- 明确要求从 `brief.selling_points` 中选择最适合画面表达的 1–2 条。
- 对选中卖点做简洁营销表达润色，但只能重组已提供事实。
- 中文项目生成中文文案，英文项目生成英文文案。
- 每条最终画面文字必须使用 ASCII 双引号包裹。
- 提示词需要说明文字的层级、位置、可读性与画面融合，但禁止增加价格、角标、认证、虚构 CTA 或额外文案。
- 若存在 `current_prompt`，保留其中事实和构图意图，同时修正或补充为合规的双引号文案格式。
- 继续遵守中文 300 字、英文 600 词的现有建议长度。

更新真实 `BytePlusModelArkAdapter.generate_image_prompt`：

- `_plain_text_output` 后调用统一校验函数。
- 模型返回无双引号、空引号、未闭合引号或超过 2 组时，转换为
  `ModelArkTextParseError`。
- 沿用现有脱敏 502 行为，不覆盖编辑器、不保存版本、不创建任务。

更新 `MockModelArkAdapter.generate_image_prompt`：

- 从前两条卖点确定性生成 1–2 组双引号文案。
- 中文和英文输出均符合相同格式，维持本地开发与测试的一致性。

### 3. 拦截不合规历史版本生成图片

**文件：** [`backend/app/api/routes.py`](../../backend/app/api/routes.py)

在 `submit_image_generation` 读取 `prompt_version` 后、创建冻结输入和任务之前：

- 对 `prompt_version.prompt` 执行统一校验。
- 不合规时返回 HTTP 409 / `invalid_state`，使用可操作但不泄露内部信息的提示：
  “当前提示词版本缺少 1–2 条由英文双引号包裹的卖点文案，请修改并保存新版本后重试。”
- 不创建 GenerationTask，不生成输入哈希，不调用 Seedream。

对合规提示词保持现有数据流不变：

`Prompt Version -> normalize_project_image_prompt -> FrozenImageGenerationInput -> ProjectImageGenerationRequest -> Seedream`

双引号原文必须在 `prompt`、`normalized_prompt`、`final_prompt` 和资产 metadata 中保持不变。

### 4. 增加前端即时校验与操作引导

**新增文件：** `frontend/lib/image-prompt-copy.ts`

实现与后端等价、无副作用的校验函数，返回：

- 是否合规；
- 已识别的文案数组；
- 供 UI 使用的明确错误类型/提示。

该函数不自动修改提示词，避免前后端隐藏式改写用户输入。

**文件：** [`frontend/components/workspace/image-project-workspace.tsx`](../../frontend/components/workspace/image-project-workspace.tsx)

在提示词编辑区：

- 输入框下常驻简短说明：
  “图片中需要显示的 1–2 条卖点文案，请使用英文双引号包裹。”
- 合规时可显示已识别文案数量；不合规时使用 `role="alert"` 显示具体原因。
- 更新 placeholder，给出双引号示例，但不填充虚构卖点。

操作规则：

- AI 返回合规提示词后维持当前“写入编辑器但不自动保存”行为。
- “保存新版本”在提示词不合规时禁用；不发 API 请求。
- “生成图片”在当前已保存版本不合规时禁用，并引导用户先改写和保存。
- 已有脏内容替换确认、超长二次确认、参考图、版本历史和失败重试行为保持不变。

### 5. 文档同步

**文件：** [`docs/superpowers/specs/2026-08-16-ai-image-prompt-reference-design.md`](../../docs/superpowers/specs/2026-08-16-ai-image-prompt-reference-design.md)

更新原设计中的冲突条款：

- 将“默认不生成画面文案”替换为图片素材必须包含 1–2 条润色卖点文案。
- 写明 ASCII 双引号、事实边界、中英文规则、历史版本兼容策略和保存/生成拦截。

不新增另一份重复规格文档。

## Interfaces And Data Flow

### API

以下接口路径和 JSON 结构保持不变：

- `POST /api/projects/{project_id}/image-prompts/generate`
- `POST /api/projects/{project_id}/image-prompt-versions`
- `POST /api/projects/{project_id}/image-generations`

行为变化：

- AI 模型输出不符合文案契约：现有脱敏 502。
- 保存不合规提示词：422 validation error。
- 使用不合规历史版本生图：409 invalid state。

### 合规示例

中文：

```text
高端棚拍电商主图，产品居中，柔和侧光突出金属质感。画面左上方加入主卖点文案："轻巧随行，随时鲜萃"，右下方辅助文案："一键开启新鲜时刻"。文字清晰易读，与背景保持高对比，1:1 构图。
```

英文：

```text
Premium studio product hero, centered composition and controlled soft light. Add the headline "Fresh Coffee, Wherever You Go" with clear hierarchy and strong contrast. Keep the layout uncluttered in a 1:1 format.
```

### 不合规示例

- 无引号：`画面加入轻巧便携的卖点文案`
- 空引号：`画面加入文案：""`
- 未闭合：`画面加入文案："轻巧便携`
- 使用中文弯引号：`画面加入文案：“轻巧便携”`
- 超过两组：`"卖点一"、"卖点二"、"卖点三"`

## Edge Cases And Failure Modes

- Brief 有多于两条卖点：AI 只选择最适合当前图片用途和目标受众的 1–2 条，其余卖点仍可通过视觉表现，但不得再作为额外引号文案。
- Brief 卖点本身包含双引号：作为数据传给模型，但模型输出时必须重写为不嵌套的最终短文案；手动输入嵌套引号会被格式校验拒绝。
- 用户手动删除引号：前端立即提示并禁用保存；后端仍作为最终防线。
- AI 返回格式错误：保留原编辑器内容，沿用现有失败反馈。
- 历史版本不合规：可查看、可载入编辑器、不可生图；保存为新版本后恢复。
- 图片编辑模式：本次不强制编辑指令本身包含卖点双引号；其 `base_prompt` 仍来自已保存版本。需求范围仅覆盖图片项目基础 Prompt Version 和基于该版本的生成。
- 图层编辑、视频项目、Brief 数据结构、资产归档、任务冻结、哈希去重和失败重试不调整。

## Assumptions & Decisions

- 已确认：AI 从多条卖点中择优生成 1–2 条，而不是全部铺到画面。
- 已确认：手动提示词不合规时在保存阶段强制拦截。
- 已确认：历史不合规版本禁止继续生图，但不删除、不改写。
- 双引号统一指 ASCII `"`，不兼容中文弯引号。
- 文案润色遵循“表达可优化、事实不可扩展”。
- 本次不增加单独的“画面文案”字段或数据库列；完整提示词仍是唯一事实来源。
- 根目录当前不是 Git 仓库，因此执行阶段不包含提交操作。

## Verification

### 后端单元与 API 测试

更新：

- [`backend/tests/test_modelark.py`](../../backend/tests/test_modelark.py)
  - system prompt 包含 1–2 条、ASCII 双引号、目标语言、禁止虚构事实等契约。
  - 中文/英文 Mock 输出均含合规双引号文案。
  - 真实适配器接受合规输出。
  - 无引号、空引号、未闭合引号和超过 2 组分别抛出安全解析错误。
- [`backend/tests/test_image_prompts.py`](../../backend/tests/test_image_prompts.py)
  - 合规提示词可保存并保持版本单调。
  - 不合规提示词保存返回 422，且不创建版本。
  - AI suggestion 返回合规文案但不自动保存版本。
- [`backend/tests/test_image_generation.py`](../../backend/tests/test_image_generation.py)
  - 合规双引号文案原样进入 Seedream 请求和冻结输入。
  - 模拟历史不合规 Prompt Version，生图返回 409 且不创建任务。

运行：

```bash
.venv/bin/pytest backend/tests/test_modelark.py backend/tests/test_image_prompts.py backend/tests/test_image_generation.py
.venv/bin/pytest
```

### 前端测试

更新：

- [`frontend/tests/image-project-workspace.test.tsx`](../../frontend/tests/image-project-workspace.test.tsx)
  - 将通用提示词 fixture 更新为合规双引号格式。
  - AI 生成结果展示 1–2 条双引号文案。
  - 缺失、空、未闭合、中文弯引号和超过 2 组时显示错误并禁用保存。
  - 合规输入可保存。
  - 历史不合规版本禁用生图并显示更新指引。
  - 合规提示词继续携带正确 Prompt Version 提交生图。

运行：

```bash
PATH=/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH npm run typecheck -- --pretty false
PATH=/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH npm run lint -- --no-cache
PATH=/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH npm run build
```

### 浏览器验收

使用现有图片项目验证：

1. 中文 Brief 点击“AI 生成”，编辑器出现 1–2 组 ASCII 双引号中文文案。
2. 英文 Brief 得到英文文案，且不混入中文。
3. 删除双引号后，保存和生成均不可用，并显示明确原因。
4. 修正并保存后，生成按钮恢复。
5. 查看历史无文案版本时仍可读取内容，但不能生图。
6. 生成成功后检查任务冻结输入和资产 metadata，确认文案双引号未被归一化移除。
7. 桌面与 390px 移动视口无新增溢出或按钮遮挡，浏览器控制台无错误。

