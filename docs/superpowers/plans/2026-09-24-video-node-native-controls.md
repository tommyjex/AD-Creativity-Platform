# 画布视频节点原生控件保护 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将画布视频节点划分为上半区拖拽/双击播放、下半区浏览器原生播放器操作区，恢复播放、音量、全屏、更多菜单和进度条的直接使用。

**Architecture:** 保留原生 `<video controls>` 作为完整播放器，不读取浏览器私有 Shadow DOM。节点模式仅在视频上半区叠加现有透明交互层，下半区直接命中 `<video>`；现有事件隔离继续阻止原生操作冒泡到 React Flow。

**Tech Stack:** React 19、TypeScript、Tailwind CSS、Vitest、Testing Library、Playwright/Chromium、React Flow

---

## 文件结构

- Modify: `frontend/components/workspace/aigc/aigc-video-player.tsx`
  - 仅负责将节点模式透明交互层限制在视频上半区。
- Modify: `frontend/tests/aigc-video-player.test.tsx`
  - 验证透明层边界、原生控件事件隔离、拖拽与双击播放行为。
- Runtime acceptance: `/tmp/verify-aigc-video-native-controls.py`
  - 临时 Playwright 脚本，不提交仓库；验证上下半区真实命中元素和多视口布局。

### Task 1: 用失败测试固定上下半区交互边界

**Files:**
- Modify: `frontend/tests/aigc-video-player.test.tsx`

- [ ] **Step 1: 将透明层边界断言改为“只覆盖上半区”**

在 `keeps native controls available while marking React Flow gesture boundaries` 测试中，将旧的 `bottom-12` 断言替换为：

```tsx
expect(surface).toHaveClass(
  "pointer-events-none",
  "bottom-1/2",
  "[@media(pointer:fine)]:pointer-events-auto"
);
expect(surface).not.toHaveClass("bottom-12");
```

这条测试明确禁止再次使用固定 48px 预留区。

- [ ] **Step 2: 运行聚焦测试并确认先失败**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-video-player.test.tsx
```

Expected: FAIL，报告透明层仍包含 `bottom-12`，缺少 `bottom-1/2`。

- [ ] **Step 3: 保留原生事件隔离回归覆盖**

确认现有 `isolates native controls from node and canvas gesture handlers` 测试继续覆盖：

```tsx
fireEvent.pointerDown(video, { pointerId: 1 });
fireEvent.mouseDown(video);
fireEvent.touchStart(video);
fireEvent.click(video);
fireEvent.doubleClick(video);
fireEvent.wheel(video);

Object.values(events).forEach((handler) => {
  expect(handler).not.toHaveBeenCalled();
});
```

不得把事件隔离迁移到透明层，也不得删除 `<video>` 上的 `nodrag nopan nowheel`。

### Task 2: 将透明交互层限制在视频上半区

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-video-player.tsx`
- Test: `frontend/tests/aigc-video-player.test.tsx`

- [ ] **Step 1: 修改节点模式透明层的 Tailwind 边界**

将：

```tsx
className="pointer-events-none absolute inset-x-1.5 bottom-12 top-1.5 z-10 cursor-grab [@media(pointer:fine)]:pointer-events-auto active:cursor-grabbing"
```

改为：

```tsx
className="pointer-events-none absolute inset-x-1.5 bottom-1/2 top-1.5 z-10 cursor-grab [@media(pointer:fine)]:pointer-events-auto active:cursor-grabbing"
```

结果：

- 上半区透明层接收精确指针事件，继续使用 `useAigcNodeSurfaceActivation`。
- 下半区没有覆盖元素，事件直接进入 `<video controls>`。
- 触摸设备仍由 `pointer-events-none` 直接使用原生播放器。

- [ ] **Step 2: 运行视频播放器测试**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-video-player.test.tsx
```

Expected: PASS；透明层边界、双击播放、拖拽阈值、Promise rejection 和面板模式测试全部通过。

- [ ] **Step 3: 运行相关画布节点回归测试**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-video-player.test.tsx tests/aigc-flow-node.test.tsx tests/aigc-editor.test.tsx
```

Expected: PASS；视频节点拖拽、节点选择和画布事件隔离无回归。

- [ ] **Step 4: 提交实现和组件测试**

```bash
git add frontend/components/workspace/aigc/aigc-video-player.tsx \
  frontend/tests/aigc-video-player.test.tsx
git commit -m "fix: preserve video node native controls"
```

### Task 3: Chromium 真实命中区域验收

**Files:**
- Create temporarily: `/tmp/verify-aigc-video-native-controls.py`
- Do not modify repository files unless a product defect is found.

- [ ] **Step 1: 确认前后端健康**

Run:

```bash
curl --max-time 10 --fail http://127.0.0.1:3000/ >/dev/null
curl --max-time 10 --fail http://127.0.0.1:8000/health
```

Expected: 两个请求均成功，后端返回 `"status":"ok"`。

- [ ] **Step 2: 使用现有 acceptance fixture 准备视频节点**

Run:

```bash
cd frontend
npm run acceptance:aigc
```

Expected: 输出可访问的 AIGC acceptance 页面或 Pipeline 标识，页面中包含可用视频节点。

- [ ] **Step 3: 编写临时 Playwright 命中测试**

`/tmp/verify-aigc-video-native-controls.py` 使用 `sync_playwright()`，在精确指针 Chromium 中：

```python
surface = page.get_by_test_id("aigc-video-surface")
video = page.locator('video[controls]').first

surface_box = surface.bounding_box()
video_box = video.bounding_box()
assert surface_box is not None
assert video_box is not None

assert surface_box["y"] <= video_box["y"] + 2
assert surface_box["y"] + surface_box["height"] <= (
    video_box["y"] + video_box["height"] / 2 + 2
)

upper_tag = page.evaluate(
    '''([x, y]) => document.elementFromPoint(x, y)?.dataset.testid ?? ""''',
    [
        video_box["x"] + video_box["width"] / 2,
        video_box["y"] + video_box["height"] * 0.25,
    ],
)
lower_tag = page.evaluate(
    '''([x, y]) => document.elementFromPoint(x, y)?.tagName ?? ""''',
    [
        video_box["x"] + video_box["width"] / 2,
        video_box["y"] + video_box["height"] * 0.75,
    ],
)

assert upper_tag == "aigc-video-surface"
assert lower_tag == "VIDEO"
```

下半区命中 `<video>` 即证明播放、音量、全屏、更多菜单和进度条没有被应用层覆盖。测试不得查询原生 controls 的 Shadow DOM。

- [ ] **Step 4: 验证上半区行为**

在同一脚本中：

```python
before = video.evaluate("(el) => el.currentTime")
surface.dblclick()
page.wait_for_timeout(300)
after = video.evaluate("(el) => el.currentTime")
assert after >= before
```

随后从上半区拖动节点，断言 React Flow 节点位置发生变化且未抛出页面错误。

- [ ] **Step 5: 验证多视口无溢出**

分别使用 `1024x768` 和 `390x844` 视口，断言：

```python
assert page.evaluate(
    "() => document.documentElement.scrollWidth <= document.documentElement.clientWidth"
)
```

在触摸上下文中，透明交互层应为 `pointer-events: none`，视频下半区保持直接命中。

### Task 4: 最终质量门禁

**Files:**
- Verify only.

- [ ] **Step 1: 运行完整前端测试**

Run:

```bash
cd frontend
npm test
```

Expected: 所有 Vitest 测试通过。

- [ ] **Step 2: 运行 TypeScript 和 ESLint**

Run:

```bash
cd frontend
npm run typecheck
npm run lint
```

Expected: 两个命令退出码均为 0，无 warning。

- [ ] **Step 3: 运行生产构建**

Run:

```bash
cd frontend
npm run build
```

Expected: Next.js 构建成功，所有页面生成完成。

- [ ] **Step 4: 检查最终差异**

Run:

```bash
git diff --check
git diff -- frontend/components/workspace/aigc/aigc-video-player.tsx \
  frontend/tests/aigc-video-player.test.tsx
```

Expected: `git diff --check` 无输出；最终差异仅包含透明层边界和对应测试更新。
