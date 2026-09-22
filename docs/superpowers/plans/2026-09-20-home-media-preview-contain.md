# 首页媒体预览完整显示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让首页生成媒体画廊的放大预览在所有画幅和目标视口中完整显示媒体内容。

**Architecture:** 保持 `MediaPreviewDialog` 的三行 Grid 架构，由标题栏与页脚占用内容高度，媒体区使用 `minmax(0, 1fr)` 获得稳定的可收缩空间。图片在黑色媒体区内用最大宽高和 `object-contain` 等比显示；视频保留原生播放器与相同的媒体区约束。

**Tech Stack:** Next.js、React、Tailwind CSS、Vitest、Testing Library、Playwright。

---

### Task 1: 固化媒体预览完整显示的组件契约

**Files:**
- Modify: `frontend/tests/home-generated-media-gallery.test.tsx`

- [ ] **Step 1: 扩展图片预览测试，断言媒体区和图片的约束类**

```tsx
expect(image).toHaveClass("max-h-full");
expect(image).toHaveClass("max-w-full");
expect(image).toHaveClass("object-contain");
expect(within(dialog).getByTestId("home-media-preview-stage")).toHaveClass(
  "min-h-0"
);
```

- [ ] **Step 2: 运行定向测试，验证当前实现缺少媒体区测试标识**

Run: `npm --prefix frontend test -- --run frontend/tests/home-generated-media-gallery.test.tsx`

Expected: FAIL，提示找不到 `home-media-preview-stage`。

- [ ] **Step 3: 提交测试变更**

```bash
git add frontend/tests/home-generated-media-gallery.test.tsx
git commit -m "test: cover home media preview containment"
```

### Task 2: 稳定首页预览 Dialog 的可用媒体区域

**Files:**
- Modify: `frontend/components/home-generated-media-gallery.tsx:442-489`

- [ ] **Step 1: 为媒体区添加测试标识和最小高度约束**

```tsx
<div
  className="grid min-h-0 min-w-0 place-items-center overflow-hidden bg-black"
  data-testid="home-media-preview-stage"
>
```

- [ ] **Step 2: 维持图片的完整显示约束**

```tsx
<img
  alt={`${item.name}大图`}
  className="max-h-full max-w-full object-contain"
  src={item.previewUrl}
/>
```

- [ ] **Step 3: 维持视频的原生播放与黑边容器**

```tsx
<video
  aria-label={`${item.name}播放`}
  className="h-full w-full object-contain"
  controls
  playsInline
  preload="metadata"
  src={item.previewUrl}
/>
```

- [ ] **Step 4: 运行组件测试**

Run: `npm --prefix frontend test -- --run frontend/tests/home-generated-media-gallery.test.tsx`

Expected: PASS。

- [ ] **Step 5: 提交实现变更**

```bash
git add frontend/components/home-generated-media-gallery.tsx frontend/tests/home-generated-media-gallery.test.tsx
git commit -m "fix: contain home media preview"
```

### Task 3: 完成静态与浏览器验收

**Files:**
- Verify: `frontend/components/home-generated-media-gallery.tsx`
- Verify: `frontend/scripts/verify-home-generated-media-gallery.py`

- [ ] **Step 1: 运行 TypeScript 与 ESLint**

Run: `npm --prefix frontend run typecheck && npm --prefix frontend run lint -- --file components/home-generated-media-gallery.tsx`

Expected: 两项命令均成功。

- [ ] **Step 2: 运行首页媒体画廊 Playwright 验收脚本**

Run: `python3 frontend/scripts/verify-home-generated-media-gallery.py`

Expected: 桌面 `1440x900`、平板与手机 `390x844` 截图中图片完整可见、黑边保留、无水平溢出和控件重叠。

- [ ] **Step 3: 检查差异格式**

Run: `git diff --check`

Expected: 无输出且退出码为 0。
