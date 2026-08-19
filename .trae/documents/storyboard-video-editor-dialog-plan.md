# 分镜视频编辑弹窗实施计划

## Summary

依据已批准的设计文档
[`docs/superpowers/specs/2026-08-11-storyboard-video-editor-dialog-design.md`](../../docs/superpowers/specs/2026-08-11-storyboard-video-editor-dialog-design.md)，
将分镜视频工作台中位于镜头列表下方的提示词和参考素材编辑区迁移到弹窗。

已确认的产品决策：

- 点击镜头卡片时，同时切换右侧预览并打开该镜头的编辑弹窗。
- 弹窗采用单列布局，参考素材位于提示词上方。
- 素材按类型独立编号为 `参考图1`、`参考视频1`、`参考音频1` 等。
- 点击素材卡片主体在 textarea 当前光标处插入引用；预览和移除使用独立按钮。
- 图片和视频显示缩略预览，音频显示类型封面；三类素材都支持独立预览层。
- 删除素材造成编号变化时，自动同步提示词中的标准引用并将草稿标记为未保存。
- 保存成功后弹窗保持打开。
- 未保存提示词关闭时显示二次确认。
- 不修改后端接口、数据库结构和视频生成流程。

## Current State Analysis

### 工作台结构

文件：

- `frontend/components/workspace/storyboard-video-workspace.tsx`

当前实现：

- `StoryboardVideoWorkspace` 同时承担镜头选择、配置加载、提示词草稿、参考素材操作、任务轮询和视频预览。
- 左栏先渲染可滚动的 `ShotSelector` 列表，再在列表下方渲染 `PromptEditor` 与 `ReferenceManager`。
- 点击镜头仅更新 `selectedShotId` 和 `draftPrompt`，不会打开独立编辑界面。
- `selectedShotId` 变化时通过 `getStoryboardShotVideoConfig` 加载配置，并用 `requestSequence` 防止过期响应覆盖当前镜头。
- 提示词保存、素材上传、资产库关联、素材移除均已使用现有 API，无需后端改动。
- `pendingAction` 是串行操作锁；素材操作与提示词保存期间会阻止其他编辑操作。
- `feedback` 同时承载编辑操作和视频生成操作的反馈，目前只显示在右侧视频预览区域上方。
- 文件已超过 1200 行，继续把完整弹窗、媒体卡片与预览层直接堆入该文件会进一步降低可维护性。

### UI 基础组件

文件：

- `frontend/components/ui/button.tsx`
- `frontend/components/ui/textarea.tsx`
- `frontend/components/ui/*`
- `frontend/package.json`
- `frontend/package-lock.json`

当前实现：

- 项目已使用 `@radix-ui/react-slot`，但尚未安装 `@radix-ui/react-dialog`。
- 没有通用 Dialog 组件，也没有现成焦点锁定、Portal、遮罩关闭和焦点恢复实现。
- `Textarea` 已通过 `forwardRef` 暴露原生 textarea ref，可直接用于光标插入和选择区恢复。

### 素材与安全 URL

文件：

- `frontend/lib/asset-display.ts`
- `frontend/lib/api-types.ts`

当前实现：

- `getSafePreviewUrl(asset)` 只允许后端内容地址和 `http/https` URL，可直接复用。
- `getWorkspaceAssetDescription(asset)` 可用于素材卡片名称、`alt` 和无障碍标签。
- `StoryboardShotVideoConfig` 分别保存图片、视频、音频资产 ID 数组，数组顺序可作为各类型编号顺序。
- 上传接口返回 `asset_id + config`，当前前端先构造 URL 为空的临时 Asset；若要显示缩略图，需要在上传成功后刷新项目资产。

### 测试

文件：

- `frontend/tests/project-workspace.test.tsx`
- `frontend/tests/api-client.test.ts`

当前实现：

- `project-workspace.test.tsx` 已覆盖提示词保存、图片上传、视频/音频关联、素材移除、镜头切换和视频生成重试。
- 现有素材夹具默认 `url: null`，需要增加带安全 URL、无效 URL和不同媒体类型的夹具。
- 本次不改 API client 契约，因此 `api-client.test.ts` 不需要新增行为测试。

## Proposed Changes

### 1. 引入并封装可访问的 Dialog 基础组件

文件：

- 修改 `frontend/package.json`
- 修改 `frontend/package-lock.json`
- 新增 `frontend/components/ui/dialog.tsx`

实施：

- 安装与当前 React 版本兼容的 `@radix-ui/react-dialog`。
- 按现有 UI 组件风格封装并导出：
  - `Dialog`
  - `DialogTrigger`
  - `DialogPortal`
  - `DialogOverlay`
  - `DialogContent`
  - `DialogHeader`
  - `DialogFooter`
  - `DialogTitle`
  - `DialogDescription`
  - `DialogClose`
- `DialogContent` 默认包含：
  - 固定全屏遮罩。
  - 居中内容区。
  - 合理的 `z-index`。
  - 最大视口高度和内部滚动能力。
  - 窄屏接近全屏、桌面端圆角面板。
- 不在基础组件内写业务关闭确认逻辑；未保存拦截由分镜编辑弹窗的受控 `open` 状态处理。

验证：

- TypeScript 能正确推导 Radix props 和 ref。
- Dialog 打开后具备 `role="dialog"`、焦点锁定、Esc 关闭和焦点恢复。
- 基础组件不影响现有 Button、Textarea 和全局样式。

### 2. 提取素材引用纯函数

文件：

- 新增 `frontend/lib/storyboard-reference.ts`
- 新增 `frontend/tests/storyboard-reference.test.ts`

职责：

- 集中处理引用名称生成、光标插入文本和删除后的编号同步，避免业务组件中散落字符串替换。

计划导出：

- `getReferenceLabel(kind, index)`：
  - `image + 0 -> 参考图1`
  - `video + 0 -> 参考视频1`
  - `audio + 0 -> 参考音频1`
- `insertReferenceAtSelection(text, label, selectionStart, selectionEnd)`：
  - 替换当前选择区或在光标处插入。
  - 根据引用前后字符补充必要空格。
  - 返回新文本和插入后的新光标位置。
- `reindexReferencesAfterRemoval(text, kind, removedIndex, previousCount)`：
  - 删除被移除素材的标准引用。
  - 将同类型、编号大于被删除编号的标准引用依次减一。
  - 图片、视频、音频互不影响。
  - 使用一次性正则解析或临时占位映射，避免 `参考图2 -> 参考图1` 后再次参与替换。
  - 不改写超出原素材数量的文本、其他类型引用和非标准表述。

边界测试：

- 光标在开头、中间、末尾。
- 有选择区时替换选中文本。
- 中英文标点及空白相邻时不会产生明显粘连或重复空格。
- 删除首项、中间项、末项。
- 同一引用出现多次。
- `参考图1` 不误匹配 `参考图10`。
- 图片重排不改写视频和音频引用。
- 非标准文本“第一张参考图”保持不变。

### 3. 新增分镜编辑弹窗与素材预览组件

文件：

- 新增 `frontend/components/workspace/storyboard-shot-editor-dialog.tsx`

组件边界：

#### `StoryboardShotEditorDialog`

作为受控展示组件接收：

- 当前镜头与配置。
- 当前草稿提示词和最后保存值。
- 弹窗打开、配置加载和各操作 loading 状态。
- 项目资产列表。
- 保存、上传、关联、移除、草稿更新、请求关闭等回调。

职责：

- 渲染镜头编号、标题和时长。
- 按“参考素材 → 提示词 → 底部操作栏”的顺序组织内容。
- 配置加载中显示加载态。
- 配置加载失败时显示错误与重试按钮，不显示旧表单。
- 编辑反馈显示在弹窗内，不依赖右侧视频预览区域。
- 保存成功后保持打开。

#### `ReferenceManager`

调整现有能力并迁移到新文件：

- 按图片、视频、音频分组。
- 保留本地上传和资产库关联。
- 已关联素材改为响应式缩略卡片网格。
- 空分组显示简洁占位。
- 资产库候选列表继续过滤已关联和不兼容素材。

#### `ReferenceAssetCard`

每张卡片：

- 使用配置数组索引生成稳定的当前引用名。
- 图片：
  - 安全 URL 存在时渲染 `<img>` 缩略图。
- 视频：
  - 安全 URL 存在时渲染静音、`preload="metadata"` 的 `<video>` 缩略预览。
  - 不自动播放，避免列表同时拉取和播放多个视频。
- 音频：
  - 使用 `FileAudio` 类型封面，不在卡片内渲染完整播放器。
- URL 缺失、不安全或媒体加载错误：
  - 切换为对应媒体类型占位。
- 卡片主体是“插入引用”按钮。
- 预览与移除是独立按钮，并阻止事件冒泡，确保不会误插入引用。

#### `ReferenceAssetPreviewDialog`

- 作为编辑弹窗之上的受控二级 Dialog。
- 图片渲染大图。
- 视频渲染带 `controls` 的播放器。
- 音频渲染带 `controls` 的播放器。
- 无安全 URL 或媒体加载失败时显示“暂无法预览”。
- 关闭后焦点由 Radix 恢复到对应预览按钮。

#### `PromptEditor`

- 使用 `Textarea` ref 保存 `selectionStart/selectionEnd`。
- 在 `onSelect`、`onKeyUp`、`onClick` 和 `onChange` 后记录最近光标位置。
- 收到素材插入请求时调用 `insertReferenceAtSelection`，更新草稿。
- 下一帧恢复 textarea 焦点与新光标位置。
- 未聚焦或光标不可用时使用文本末尾。
- 保存按钮位于弹窗固定底部，不在 PromptEditor 标题内重复出现。

响应式要求：

- 桌面端 `DialogContent` 最大宽度约 `960px`。
- 内容区最大高度为视口高度减安全边距并可滚动。
- 底部操作栏 sticky，始终可见。
- 素材卡片按视口宽度从单列扩展到多列。

### 4. 重构工作台的选择、加载与编辑状态

文件：

- 修改 `frontend/components/workspace/storyboard-video-workspace.tsx`

状态调整：

- 保留：
  - `shots`
  - `assets`
  - `selectedShotId`
  - `configs`
  - `shotTasks`
  - `pendingAction`
- 将现有单一 `feedback` 拆分为：
  - `editorFeedback`：配置、提示词和素材操作。
  - `workspaceFeedback`：视频生成、删除和任务轮询。
- 新增：
  - `isEditorOpen`
  - `isConfigLoading`
  - `configLoadError`
  - `draftPrompt`
  - `savedPrompt`
  - `isDiscardConfirmOpen`

镜头点击：

- `ShotSelector.onSelect` 执行：
  1. 更新 `selectedShotId`。
  2. 清理上一个镜头的编辑反馈。
  3. 打开编辑弹窗。
- 不再直接用缓存配置初始化可编辑草稿，避免旧数据闪现。

配置加载：

- 将现有选择镜头 effect 改为仅在 `isEditorOpen && selectedShotId` 时请求最新配置。
- 请求开始时：
  - `isConfigLoading = true`
  - 清理 `configLoadError`
  - 暂不展示可编辑表单。
- 请求成功时：
  - 写入 `configs[shotId]`
  - `draftPrompt` 与 `savedPrompt` 同时设置为
    `video_prompt ?? effective_video_prompt`
  - 清理 loading。
- 请求失败时：
  - 保持弹窗打开。
  - 设置 `configLoadError` 和安全错误文案。
  - 提供调用同一加载函数的重试入口。
- 继续使用递增请求序号；关闭弹窗或快速切换时使旧响应失效。

关闭流程：

- `isDirty = draftPrompt !== savedPrompt`。
- 所有关闭入口统一调用 `requestCloseEditor()`：
  - 非 dirty：关闭弹窗并清理编辑临时状态。
  - dirty：保持弹窗打开，打开二次确认。
- “继续编辑”：关闭确认层，保留草稿。
- “放弃修改”：恢复 `savedPrompt`，关闭确认层和编辑弹窗。
- 素材即时操作已经持久化，不因放弃提示词草稿而回滚。
- pending 操作期间禁用关闭和提交，避免用户把“隐藏弹窗”误解为取消上传或关联。

提示词保存：

- 沿用 `updateStoryboardShotVideoConfig`。
- 保存成功后：
  - 更新 `configs`。
  - 更新对应 `shots[].video_prompt`。
  - 通过 `commitLocal` 通知父级项目。
  - 使用服务端返回值同时更新 `draftPrompt` 和 `savedPrompt`。
  - 设置 editor success feedback。
  - 保持弹窗打开。
- 保存失败保留草稿。

素材上传：

- 沿用文件校验和 `uploadStoryboardShotReference`。
- 接口成功后先写入返回 config，并保留当前临时 Asset 作为降级展示。
- 随后调用 `refreshProject()` 获取带安全 URL 的正式资产。
- 刷新失败：
  - 不回滚已经成功的上传与关联。
  - 保留临时占位素材。
  - 在弹窗提示“素材已添加，缩略图暂不可用”。

素材关联：

- 沿用 `attachStoryboardShotReference`。
- 更新 config、对应 shot 和父级项目。
- 关联的资产已来自项目资产列表，无需额外刷新。

素材移除与编号同步：

- 调用 API 前记录当前类型 ID 数组、被删除索引和数量。
- API 成功后更新 config 和 shot。
- 调用 `reindexReferencesAfterRemoval` 更新 `draftPrompt`。
- 仅当草稿实际变化时：
  - 保持 `savedPrompt` 不变，使 dirty 状态成立。
  - 显示“引用编号已同步，请检查并保存提示词”。
- API 失败不修改 config、shot、草稿和编号。

布局调整：

- 左栏只保留镜头列表。
- 删除镜头列表下方内嵌的 `PromptEditor` 和 `ReferenceManager`。
- 右侧 `VideoPreviewPanel` 结构和生成逻辑保持不变。
- 在工作台 section 末尾渲染受控 `StoryboardShotEditorDialog`。

### 5. 扩展工作台集成测试

文件：

- 修改 `frontend/tests/project-workspace.test.tsx`

测试夹具调整：

- 为图片、视频、音频分别构造 Asset。
- 增加合法 `https` URL、后端相对内容 URL、`javascript:` 无效 URL和空 URL。
- 配置夹具包含多个同类型素材，以验证编号重排。

新增/重构测试：

1. **打开与数据加载**
   - 点击 Shot 01 后出现 `dialog` 和对应镜头标题。
   - 每次打开都调用 `getStoryboardShotVideoConfig`。
   - 加载期间不显示旧镜头可编辑表单。
   - 请求失败显示重试；重试成功后恢复表单。
2. **快速切换保护**
   - Shot 01 请求未完成时打开 Shot 02。
   - Shot 01 的迟到响应不会覆盖 Shot 02 草稿和素材。
3. **布局顺序**
   - 在 dialog 范围内确认“参考素材”节点位于“视频生成提示词”之前。
   - 工作台主区域不再存在内嵌提示词编辑器。
4. **缩略图与降级**
   - 图片渲染安全 URL 的 `<img>`。
   - 视频渲染安全 URL 的 `<video>`。
   - 音频显示类型封面。
   - 无效/缺失 URL 显示占位，不写入媒体 `src`。
5. **素材预览**
   - 点击预览按钮打开二级 dialog。
   - 图片、视频、音频分别渲染正确媒体元素。
   - 点击预览按钮不会改变提示词。
6. **插入引用**
   - 点击素材卡片在当前 textarea 光标处插入 `参考图1`。
   - 有选择区时替换选中内容。
   - textarea 未聚焦时追加到末尾。
   - 点击移除按钮不会额外插入引用。
7. **编号同步**
   - 配置包含三张参考图，草稿包含对应引用。
   - 删除第二张后移除 `参考图2`，原 `参考图3` 变为 `参考图2`。
   - 视频和音频引用不受影响。
   - 草稿进入未保存状态并显示同步提示。
8. **保存行为**
   - 保存调用现有 API 和正确 payload。
   - 保存成功后 dialog 仍存在。
   - 保存后的关闭不触发未保存确认。
   - 保存失败保留草稿并显示安全错误。
9. **关闭确认**
   - 修改草稿后点击关闭、取消或按 Esc，均出现确认层。
   - “继续编辑”保留草稿和主 dialog。
   - “放弃修改”关闭 dialog；重新打开恢复服务端值。
10. **现有能力回归**
    - 本地上传仍传递原文件、文件名和 MIME type。
    - 资产库关联和移除仍调用原 API。
    - 右侧视频生成、失败提示和重试仍正常。

现有“大而全”的分镜视频测试可拆成多个独立 `it`，避免一次失败掩盖其他行为，也减少 Dialog 引入后查询范围不清的问题。弹窗内元素优先通过 `within(dialog)` 查询。

### 6. 验证与浏览器验收

自动验证：

```bash
cd /Users/bytedance/AD-Creativity/frontend
npm test -- --run tests/storyboard-reference.test.ts
npm test -- --run tests/project-workspace.test.tsx
npm run typecheck
npm run lint
npm test
npm run build
```

浏览器 smoke test：

1. 使用项目根目录 `.env` 启动后端，避免数据库配置缺失：

```bash
cd /Users/bytedance/AD-Creativity
set -a
source .env
set +a
.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

2. 启动前端：

```bash
cd /Users/bytedance/AD-Creativity/frontend
NEXT_PUBLIC_BACKEND_BASE_URL=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3000
```

3. 打开 `http://127.0.0.1:3000/workspace/projects`，选择有分镜的项目并进入“分镜视频”：
   - 点击首个镜头，确认弹窗无需页面滚动即可操作。
   - 确认参考素材位于提示词上方。
   - 上传图片、关联视频和音频，确认缩略卡片及引用编号。
   - 将光标置于提示词中间，点击素材卡片，确认引用插入位置。
   - 打开三类素材预览。
   - 删除中间素材，确认后续编号和提示词引用同步。
   - 修改提示词后关闭，确认二次确认；继续编辑不丢值。
   - 保存提示词，确认弹窗保持打开，随后可直接关闭。
   - 关闭弹窗后确认右侧仍可生成、重试和删除当前镜头视频。
   - 在窄屏视口确认弹窗单列滚动、底部操作栏可用且无横向溢出。

## Implementation Order

1. 安装 Radix Dialog 并新增 UI 基础组件。
2. 实现并单测素材引用纯函数。
3. 新增分镜编辑弹窗、素材卡片和媒体预览组件。
4. 重构工作台状态、API 编排和布局，接入弹窗。
5. 重构并扩展工作台集成测试。
6. 依次运行定向测试、类型检查、Lint、全量测试和构建。
7. 启动本地服务进行桌面与窄屏 smoke test。

依赖关系：

- 第 3 步依赖第 1、2 步。
- 第 4 步依赖第 3 步。
- 第 5 步可在第 2 步完成后先写纯函数测试，其余集成测试依赖第 4 步。
- 第 6、7 步依赖所有实现步骤。

## Assumptions & Decisions

- 当前素材数组顺序就是用户可见编号顺序，不新增排序字段。
- 引用编号按媒体类型分别从 1 开始，不使用跨类型统一序号。
- 删除后的编号同步只修改当前未保存草稿；不会在素材移除请求中隐式提交提示词。
- 用户放弃提示词修改时，只放弃本地提示词草稿，不回滚已经即时持久化的素材操作。
- 素材操作进行中禁用弹窗关闭，不提供前端取消上传/关联。
- 视频缩略图不自动播放；完整视频仅在预览层播放。
- 媒体 URL 必须通过现有 `getSafePreviewUrl`，不新增其他 URL 白名单。
- 配置加载失败时不回退到缓存配置进行编辑，避免覆盖服务端最新值。
- 编辑反馈与视频任务反馈分离，避免弹窗错误只出现在弹窗背后的右侧区域。
- 不修改 `frontend/lib/api-client.ts` 和后端代码；所有 API 契约保持现状。
- 为控制 `storyboard-video-workspace.tsx` 体积，弹窗展示组件和纯字符串逻辑放入独立文件。
- 实施时不修改 `.superpowers/brainstorm` 视觉草图；该目录不是产品代码。

## Verification Steps

1. 确认依赖安装和 lockfile 一致：
   - `cd frontend && npm install`
2. 运行素材引用纯函数测试：
   - `cd frontend && npm test -- --run tests/storyboard-reference.test.ts`
3. 运行工作台定向测试：
   - `cd frontend && npm test -- --run tests/project-workspace.test.tsx`
4. 运行静态检查：
   - `cd frontend && npm run typecheck`
   - `cd frontend && npm run lint`
5. 运行前端全量测试与构建：
   - `cd frontend && npm test`
   - `cd frontend && npm run build`
6. 使用加载根目录 `.env` 的后端和本地前端完成浏览器 smoke test。
7. 最终检查：
   - 后端文件和 API schema 无变更。
   - 工作台主区域不再渲染内嵌提示词/素材编辑器。
   - 所有验收标准均在自动测试或 smoke test 中有对应证据。
