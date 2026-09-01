# 图片编辑画布目标图等比完整展示修复计划

## Summary

当前图片编辑画布的目标图存在“没有按照宽高比展示、被截断”的问题。修复目标是：目标图在画布中始终完整等比显示，不裁切；允许在容器剩余区域留背景边距；同时保持现有点击放大、拖拽框选、bbox 坐标计算和删除框选能力。

本次修复只涉及前端画布展示逻辑，不改后端接口、资产数据结构或生成任务流程。

## Current State Analysis

- 目标图画布位于 `frontend/components/workspace/image-canvas-editor.tsx`。
- 目标图通过 `BboxCanvas` 渲染：
  - 外层容器：`relative grid w-full place-items-center overflow-hidden ...`
  - 图片：`h-full max-h-full w-full max-w-full object-contain`
  - 目标图传入高度：`h-[42dvh] min-h-64 max-h-[520px] lg:h-[58dvh] lg:max-h-[620px]`
- 虽然图片使用了 `object-contain`，但当前实现仍有两个风险：
  - 图片元素自身被拉伸到容器完整宽高，浏览器在 replaced element 内部做 contain，视觉上容易出现与实际图片内容边界不一致的问题。
  - `BboxOverlay` 目前按整个 `BboxCanvas` 容器百分比定位，而 `normalizeImagePoint` 又基于 `getContainedImageRect(...)` 计算真实图片内容区域；当图片存在上下或左右留白时，框选坐标和叠层显示可能不对齐。
- 旧 `ImageEditDialog` 中图片使用 `h-auto w-auto max-h... max-w... object-contain`，更接近“按原比例在可用区域内收缩”的表达方式。
- 资产 metadata 可能包含 `width` / `height`，但不是所有上传/生成资产都可靠具备这些字段；浏览器图片加载后的 `naturalWidth` / `naturalHeight` 是最可靠前端来源。
- 相关测试位于 `frontend/tests/image-canvas-editor.test.tsx`，目前主要验证 bbox 坐标、拖拽、点击原图预览和画布操作按钮。尚未验证目标图图片元素的等比 sizing 类名和 overlay 绑定到真实图片框。

## Proposed Changes

### 1. 调整 `BboxCanvas` 图片布局为真实等比内容框

文件：`frontend/components/workspace/image-canvas-editor.tsx`

- 保留外层画布容器作为可用空间和暗色背景，不裁切内容：
  - 外层继续使用固定响应式高度，保证单屏可控。
  - 外层继续 `overflow-hidden`，但内部图片框必须完整落在外层范围内。
- 将当前图片样式从：

```tsx
className="block h-full max-h-full w-full max-w-full select-none object-contain touch-none"
```

调整为：

```tsx
className="block h-auto max-h-full w-auto max-w-full select-none object-contain touch-none"
```

- 外层图片承载节点继续 `place-items-center`，让宽图/高图都在容器内居中完整显示。
- 不使用 `object-cover`，不使用固定裁切容器，不根据 brief 强制裁切图片。

### 2. 让 bbox overlay 绑定到实际图片显示区域

文件：`frontend/components/workspace/image-canvas-editor.tsx`

- 在 `BboxCanvas` 中新增实际图片尺寸状态：

```ts
const [renderedImageRect, setRenderedImageRect] = useState<ImageRect | null>(null);
```

- 在图片 `onLoad`、pointer 交互前、必要的窗口尺寸变化后更新该 rect。
  - 计算仍复用现有 `getContainedImageRect(...)`。
  - 为避免额外依赖，可先实现 `updateRenderedImageRect()`，在 `onLoad`、`handlePointerDown`、`handlePointerMove`、`handlePointerUp` 中调用。
  - 如果需要更稳定的 resize 响应，再用 `ResizeObserver` 监听外层容器；只在浏览器支持时启用，并在 cleanup 中 disconnect。
- 调整 overlay 渲染结构：
  - 外层保持整块背景。
  - 新增一个绝对定位或相对定位的“图片内容层”，其尺寸等于 `renderedImageRect.width/height`，位置居中或由 rect 相对外层换算。
  - 图片和 `BboxOverlay` 放在同一个内容层中。
  - `BboxOverlay` 的百分比仍按 0-1000 坐标换算，但其定位基准变为实际图片内容层，而不是整块背景容器。
- pointer 坐标计算继续使用 `getContainedImageRect(...)`，保证提交给后端的 bbox 坐标不变。

### 3. 保持点击原图预览和拖拽框选语义

文件：`frontend/components/workspace/image-canvas-editor.tsx`

- 保留现有 `onPreview`、`suppressClickPreviewRef`、拖拽阈值逻辑。
- 只调整触发区域：
  - 点击实际图片区域打开“查看原图”。
  - 点击图片外留白区域不打开预览，也不创建 bbox。
  - 拖拽图片区域继续创建 bbox。
- resize handle 和删除 bbox 按钮继续 `stopPropagation` 或通过 suppress 标记避免误触预览。

### 4. 目标图容器高度策略

文件：`frontend/components/workspace/image-canvas-editor.tsx`

- 保留当前较低高度策略作为最大显示空间：

```tsx
className="h-[42dvh] min-h-64 max-h-[520px] lg:h-[58dvh] lg:max-h-[620px]"
```

- 如果浏览器验收仍显示内容区域不完整，则仅在同一文件内微调为更保守的：

```tsx
className="h-[40dvh] min-h-64 max-h-[480px] lg:h-[54dvh] lg:max-h-[560px]"
```

- 不为了完整显示而扩大到超过单屏，避免回退到之前目标图过高的问题。

### 5. 测试更新

文件：`frontend/tests/image-canvas-editor.test.tsx`

- 新增/更新断言：
  - 目标图 `<img alt="目标图">` 具有 `h-auto w-auto max-h-full max-w-full object-contain`，不再使用 `h-full w-full`。
  - 点击目标图仍打开“查看原图”弹窗。
  - 拖拽目标图仍能创建 bbox，不打开预览。
  - 对 9:16 这类竖图模拟 `naturalWidth=900`、`naturalHeight=1600`，在宽容器中拖拽后 bbox 坐标按真实 contained rect 计算。
  - 如果实现了内容层，可断言 overlay 所在容器与图片内容层共享定位基准，避免 overlay 按外层背景偏移。
- 保留已有参考图删除、提示词引用、图层拆分相关测试，不改变这些行为。

### 6. 浏览器验收

使用本地前端 `http://localhost:3000/workspace/projects` 和后端 `http://127.0.0.1:8000`：

- 打开图片项目，进入画布。
- 对 9:16 目标图验收：
  - 目标图完整显示，顶部/底部不被裁切。
  - 图片按原比例显示，不横向或纵向拉伸。
  - 目标图容器仍低于单屏主要高度，右侧提示词/生成按钮可见。
  - 单击目标图打开原图预览。
  - 拖拽目标图生成 bbox，bbox 框贴合实际图片内容区域，而不是贴合黑色背景外框。
- 如当前项目没有可稳定复现的 9:16 目标图，则用现有“海报编辑”项目做浏览器截图和 DOM 尺寸检查；必要时在测试中模拟竖图尺寸覆盖坐标逻辑。

## Assumptions & Decisions

- 已确认展示策略为“完整等比显示”：图片不裁切，留背景边距可接受。
- 本次不改后端，不改资产 metadata，不迁移历史数据。
- 目标图和参考图共享 `BboxCanvas`，但本次重点修复目标图；参考图可受益于同一图片等比展示修复。
- bbox 坐标继续保持 0-1000 归一化格式，接口 payload 不变。
- 如果实际图片 URL 加载前 `naturalWidth/naturalHeight` 为 0，交互应等待图片可计算后再允许创建 bbox；点击预览可作为兜底打开原图。

## Verification Steps

### 前端单元测试

在 `frontend` 目录运行：

```bash
export PATH="/Users/bytedance/.real/.bin/node/bin:$PATH"
npm test -- image-canvas-editor.test.tsx
npm run lint
npm run typecheck
```

### 前端构建

在 `frontend` 目录运行：

```bash
export PATH="/Users/bytedance/.real/.bin/node/bin:$PATH"
npm run build
```

### 浏览器验收

在项目根目录或可用脚本环境中使用 Playwright：

- 进入 `http://localhost:3000/workspace/projects`。
- 打开图片项目画布。
- 截图确认目标图完整等比显示，无截断。
- 检查目标图元素 bounding box，确认图片本体在目标容器内完整可见。
- 单击目标图确认打开“查看原图”。
- 拖拽目标图确认 bbox 出现且未打开原图弹窗。
