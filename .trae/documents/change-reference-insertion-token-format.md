# 修改分镜提示词参考素材插入格式实施计划

## Summary

将分镜提示词编辑器中“点击参考素材卡片，在光标处插入引用”的文本格式从：

- `参考图1`
- `参考视频1`
- `参考音频1`

修改为：

- `(参考@图1)`
- `(参考@视频1)`
- `(参考@音频1)`

括号由系统自动添加。素材卡片、预览标题、按钮可访问名称和素材数量摘要继续使用现有显示标签，不改成括号样式。

历史提示词中的旧格式不自动迁移；素材移除后的引用删除和重编号同时兼容新旧格式。AI 提示词优化上下文改用新 token，确保优化结果遵循当前编辑器引用规范。

## Current State Analysis

### 引用标签与插入逻辑

文件：`frontend/lib/storyboard-reference.ts`

当前实现：

- `getReferenceLabel(kind, index)` 同时承担素材卡片显示标签和提示词插入文本，返回 `参考图1`、`参考视频1`、`参考音频1`。
- `insertReferenceAtSelection(text, label, start, end)` 在光标或选区位置插入传入标签，并根据中文标点和空白自动补空格。
- `reindexReferencesAfterRemoval()` 只识别旧格式 `参考图N / 参考视频N / 参考音频N`。

不能直接修改 `getReferenceLabel()`，否则素材卡片标题、预览按钮、可访问名称等 UI 也会显示 `(参考@图1)`，超出本次“提示词插入样式”范围。

### 编辑器调用

文件：`frontend/components/workspace/storyboard-shot-editor-dialog.tsx`

当前素材卡片通过 `getReferenceLabel()` 得到显示标签，并把同一个标签传给 `insertReferenceAtSelection()`。编辑器辅助文案仍写着“使用‘参考图1’‘参考视频1’等标准名称”。

### 素材移除与重编号

文件：`frontend/components/workspace/storyboard-video-workspace.tsx`

移除参考素材后调用 `reindexReferencesAfterRemoval()` 更新当前草稿。例如删除第二张图后，旧的 `参考图3` 会变为 `参考图2`。

新格式上线后，该函数必须同时处理：

- 历史旧格式：`参考图1`
- 新格式：`(参考@图1)`

两类格式可在同一个历史提示词中混用，且应各自保持原格式完成删除和重编号。

### AI 提示词优化上下文

文件：

- `backend/app/services/generation.py`
- `backend/app/services/modelark.py`
- `backend/tests/test_video_prompt_optimization.py`
- `backend/tests/test_modelark.py`

当前 AI 优化上下文中的 `reference_asset_labels` 使用旧格式。若不更新，AI 优化可能继续生成或保留旧引用格式，与编辑器新插入行为不一致。

## Proposed Changes

### 1. 分离显示标签与提示词 token

**文件：`frontend/lib/storyboard-reference.ts`**

保留现有：

```ts
getReferenceLabel("image", 0) === "参考图1"
```

新增：

```ts
getReferencePromptToken("image", 0) === "(参考@图1)"
getReferencePromptToken("video", 0) === "(参考@视频1)"
getReferencePromptToken("audio", 0) === "(参考@音频1)"
```

内部使用两个明确映射：

- 显示前缀：
  - image -> `参考图`
  - video -> `参考视频`
  - audio -> `参考音频`
- 提示词 token 类型：
  - image -> `图`
  - video -> `视频`
  - audio -> `音频`

索引继续使用各素材类型内独立的 1-based 编号。

`insertReferenceAtSelection()` 保持通用插入函数，不把素材类型逻辑写入该函数；调用方传入完整新 token。现有空格和光标定位算法继续使用，光标应落在闭括号之后。

示例：

- `镜头呈现产品`，光标在“镜头”后 -> `镜头 (参考@图1) 呈现产品`
- `画面：细节`，光标在冒号后 -> `画面：(参考@图1) 细节`
- `结尾。`，光标在句号前 -> `结尾 (参考@图1)。`
- 选中旧文本后点击视频素材 -> 选区替换为 `(参考@视频1)`
- 没有有效选区时 -> 在末尾插入 `(参考@音频1)`

### 2. 编辑器仅在插入时使用新 token

**文件：`frontend/components/workspace/storyboard-shot-editor-dialog.tsx`**

在素材卡片构建时：

- 继续用 `getReferenceLabel()` 生成卡片展示和 `aria-label`，例如“参考图1”。
- 点击插入时，根据 `kind` 和 `index` 调用 `getReferencePromptToken()`。
- 将新 token 传给 `insertReferenceAtSelection()`。

调整辅助文案为：

> 点击素材卡片会在光标处插入“(参考@图1)”“(参考@视频1)”等标准引用。

首帧仍不参与参考素材编号，也不新增 `@首帧` token。

### 3. 新旧格式兼容的删除与重编号

**文件：`frontend/lib/storyboard-reference.ts`**

扩展 `reindexReferencesAfterRemoval()`，对目标素材类型分别处理：

1. 新格式完整 token：`(参考@图N)` / `(参考@视频N)` / `(参考@音频N)`。
2. 旧格式标签：`参考图N` / `参考视频N` / `参考音频N`。

规则保持不变：

- 编号等于被删除素材：删除整个引用。
  - 新格式必须连同左右括号整体删除。
  - 旧格式只删除旧标签。
- 编号大于被删除素材且不超过删除前数量：编号减 1。
- 其他素材类型、超出原数量的编号和相似自然语言不变。
- 清理删除引用产生的重复空格和标点空格。

兼容示例：

```text
(参考@图1) 开场，参考图2 转场，(参考@图3) 收尾。
```

删除第 2 张图后：

```text
(参考@图1) 开场，转场，(参考@图2) 收尾。
```

不在打开或保存编辑器时批量迁移历史旧格式，避免无意产生未保存修改。

### 4. AI 优化上下文使用新引用 token

**文件：`backend/app/services/generation.py`**

将 `reference_asset_labels` 的生成格式改为：

- `(参考@图1..N)`
- `(参考@视频1..N)`
- `(参考@音频1..N)`

仍只传递类型和编号，不传签名 URL、资产内容或未选择素材。

**文件：`backend/app/services/modelark.py`**

更新 AI 优化指令中的引用规范描述：

- 只能使用 `reference_asset_labels` 中提供的完整 token。
- token 包含括号和 `@`，必须原样保留。
- 不得去掉括号、去掉 `@`、改回旧格式或新增不存在的编号。

视频生成实际参考素材仍通过现有 request role/URL 参数传递，本次不改变模型素材传参方式。

### 5. 测试更新

#### 前端 helper 测试

**文件：`frontend/tests/storyboard-reference.test.ts`**

新增/更新覆盖：

- `getReferenceLabel()` 仍返回旧显示标签。
- `getReferencePromptToken()` 对 image/video/audio 返回新格式。
- 光标插入、选区替换、末尾追加都使用自动括号的新 token。
- 光标位置位于闭括号之后。
- 新格式删除第一个、中间和最后一个引用。
- 新格式后续编号正确前移。
- 同一文本混用新旧格式时，两类都正确删除/重排且保持各自格式。
- 其他素材类型、超范围编号、相似文本不被修改。

#### 前端组件测试

**文件：`frontend/tests/storyboard-shot-editor-dialog.test.tsx`**

调整点击素材卡片插入引用的断言：

- 卡片和可访问名称仍显示“参考视频1”。
- 编辑框插入结果变为 `(参考@视频1)`。
- 已有旧提示词文本保持原样，点击新素材时只新增新格式 token。
- 辅助文案展示新格式示例。

其他素材上传、预览和选择测试不需要修改显示标签断言。

#### 后端 AI 优化测试

**文件：**

- `backend/tests/test_video_prompt_optimization.py`
- `backend/tests/test_modelark.py`

更新断言：

- 优化上下文中的引用列表使用新格式。
- system/user 消息包含新 token。
- AI 输出约束要求原样保留括号与 `@`。
- 安全性断言继续确认上下文不包含签名 URL。

### 6. 验证

按以下顺序执行：

1. 前端引用 helper 测试：

   ```bash
   cd frontend && npm test -- storyboard-reference
   ```

2. 前端编辑器组件测试：

   ```bash
   cd frontend && npm test -- storyboard-shot-editor-dialog
   ```

3. 后端 AI 优化相关测试（使用项目 `.venv`）：

   ```bash
   .venv/bin/python -m pytest \
     backend/tests/test_video_prompt_optimization.py \
     backend/tests/test_modelark.py -q
   ```

4. 前端全量测试与类型检查：

   ```bash
   cd frontend && npm test
   cd frontend && npm run typecheck
   ```

5. 后端全量测试：

   ```bash
   .venv/bin/python -m pytest backend/tests/ -q
   ```

6. UI smoke test：

   - 打开分镜提示词编辑弹窗。
   - 将光标放在文本中间，点击第一张参考图，确认插入 `(参考@图1)`。
   - 点击第一段参考视频和参考音频，确认分别插入 `(参考@视频1)`、`(参考@音频1)`。
   - 确认素材卡片仍显示“参考图1 / 参考视频1 / 参考音频1”。
   - 在混有旧格式和新格式的草稿中移除中间素材，确认新旧引用均正确删除/重编号。
   - 执行 AI 优化，确认新引用 token 被原样保留，不退回旧格式。

## Assumptions & Decisions

- 本次只改变“写入提示词的引用 token”，不改变素材卡片和 UI 展示标签。
- 图片、视频、音频三类素材统一使用 `(参考@类型N)`。
- 括号使用半角英文圆括号 `()`，`@` 使用半角字符。
- token 内不包含空格：`(参考@图1)`，而不是 `(参考 @图 1)`。
- 历史提示词不自动迁移，避免打开或保存时产生隐式文本修改。
- 删除/重编号逻辑长期兼容新旧格式。
- 首帧和上一镜头尾帧不参与参考素材编号，不生成新 token。
- AI 优化上下文使用新 token，并要求模型原样保留。
- 不修改后端 API schema、数据库结构、视频生成素材传参或资产关联逻辑。
