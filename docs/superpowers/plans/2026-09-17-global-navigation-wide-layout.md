# 全局导航宽屏布局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将全局导航在 `2xl` 超宽屏下的最大宽度从 `1400px` 提升到 `1600px`，让品牌和导航胶囊向两侧展开，同时保持较小视口不变。

**Architecture:** 继续复用 Tailwind 全局 `container` 的居中和内边距，仅在 `AppShell` 导航布局容器上增加局部 `2xl:max-w-[1600px]` 覆盖。组件测试锁定类名契约，现有 Playwright 验收脚本在 1920px 视口检查实际 1600px 宽度。

**Tech Stack:** React 19、Next.js 16、TypeScript、Tailwind CSS、Vitest、Testing Library、Playwright

---

## 文件结构

- 修改 `frontend/components/layout/app-shell.tsx`：增加导航专属宽屏上限和稳定测试标识。
- 修改 `frontend/tests/workspace-navigation.test.tsx`：锁定 `1600px` 宽屏类名。
- 修改 `frontend/scripts/verify-global-navigation-background.mjs`：验证 1920px 下的实际容器宽度。

### Task 1：调整并验证宽屏导航容器

**Files:**
- Modify: `frontend/components/layout/app-shell.tsx`
- Test: `frontend/tests/workspace-navigation.test.tsx`
- Test: `frontend/scripts/verify-global-navigation-background.mjs`

- [x] **Step 1：添加失败的组件测试**

在导航背景测试后增加：

```tsx
it("uses a wider navigation container on extra-wide screens", () => {
  render(
    <AppShell>
      <div>首页内容</div>
    </AppShell>
  );

  expect(screen.getByTestId("app-shell-navigation-layout")).toHaveClass(
    "container",
    "2xl:max-w-[1600px]"
  );
});
```

- [x] **Step 2：运行测试确认失败**

Run:

```bash
cd frontend
npm test -- tests/workspace-navigation.test.tsx
```

Expected: 因导航布局尚无稳定测试标识和 `1600px` 类名而失败。

- [x] **Step 3：实现局部宽屏覆盖**

将导航布局容器改为：

```tsx
<div
  className="container relative z-10 flex h-full items-center justify-between gap-6 2xl:max-w-[1600px]"
  data-testid="app-shell-navigation-layout"
>
```

- [x] **Step 4：加强浏览器宽度验收**

在 `verifyViewport` 中获取布局容器，并仅对 `desktop-wide` 断言：

```javascript
const navigationLayout = page.getByTestId("app-shell-navigation-layout");
if (viewport.name === "desktop-wide") {
  const layoutBox = await navigationLayout.boundingBox();
  assert(layoutBox, "desktop-wide: 导航容器不可测量");
  assert(
    Math.abs(layoutBox.width - 1600) <= 1,
    "desktop-wide: 导航容器宽度应为 1600px"
  );
}
```

- [x] **Step 5：运行完整验证**

Run:

```bash
cd frontend
npm test -- tests/workspace-navigation.test.tsx
npm run typecheck
npm run lint
npm run acceptance:navigation-background
```

Expected: 全部通过，`desktop-wide.png` 显示 Logo 和导航胶囊向两侧移动且无重叠。

- [x] **Step 6：检查差异**

Run:

```bash
git diff --check
```

Expected: 无输出。
