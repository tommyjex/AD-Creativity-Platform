# Navigation Account Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将普通导航账号入口固定到视口最右侧，并为 AIGC 沉浸式工具栏预留账号空间，消除与“执行”按钮的覆盖。

**Architecture:** 普通导航改为全宽三段式，品牌与账号分别贴近左右边缘，主导航通过绝对定位保持视口居中。沉浸式账号菜单仍由 `AppShell` 统一渲染，AIGC 编辑器仅通过响应式右侧内边距预留空间，避免认证组件与编辑器耦合。

**Tech Stack:** Next.js 16、React 19、Tailwind CSS、Vitest、Testing Library、Playwright

---

### Task 1: 固定普通导航账号入口

**Files:**
- Modify: `frontend/components/layout/app-shell.tsx`
- Test: `frontend/tests/workspace-navigation.test.tsx`

- [x] **Step 1: 更新导航布局测试**

将原有“更宽容器”断言替换为全宽布局断言：

```tsx
expect(screen.getByTestId("app-shell-navigation-layout")).toHaveClass(
  "w-full",
  "px-4",
  "lg:px-6"
);
expect(screen.getByTestId("app-shell-primary-navigation")).toHaveClass(
  "md:absolute",
  "md:left-1/2",
  "md:-translate-x-1/2"
);
expect(screen.getByTestId("app-shell-account-slot")).toHaveClass(
  "ml-auto",
  "shrink-0"
);
```

- [x] **Step 2: 运行测试并确认先失败**

Run:

```bash
cd frontend && npm run test -- --run tests/workspace-navigation.test.tsx
```

Expected: FAIL，缺少新的 test id 和全宽布局 class。

- [x] **Step 3: 实现全宽三段式导航**

在 `app-shell.tsx` 中：

```tsx
<div
  className="relative z-10 flex h-full w-full items-center gap-4 px-4 lg:px-6"
  data-testid="app-shell-navigation-layout"
>
  {/* brand */}
  <nav
    className="hidden ... md:absolute md:left-1/2 md:flex md:-translate-x-1/2"
    data-testid="app-shell-primary-navigation"
  >
    ...
  </nav>
  <div
    className="ml-auto hidden shrink-0 md:block"
    data-testid="app-shell-account-slot"
  >
    <AccountMenu />
  </div>
  {/* mobile trigger */}
</div>
```

账号槽位负责右对齐，`AccountMenu` 的 desktop 根节点不再重复控制 `display`。

- [x] **Step 4: 运行导航测试**

Run:

```bash
cd frontend && npm run test -- --run tests/workspace-navigation.test.tsx
```

Expected: PASS。

### Task 2: 隔离 AIGC 工具栏账号区与执行区

**Files:**
- Modify: `frontend/components/layout/account-menu.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Test: `frontend/tests/aigc-editor.test.tsx`

- [x] **Step 1: 增加工具栏预留空间测试**

在专业工作台测试中加入：

```tsx
expect(screen.getByTestId("aigc-editor-header")).toHaveClass(
  "pr-[4.5rem]",
  "sm:pr-44"
);
expect(screen.getByTestId("aigc-editor-actions")).toHaveClass(
  "shrink-0",
  "justify-end"
);
```

并断言沉浸式账号菜单带稳定定位标记：

```tsx
expect(screen.getByTestId("immersive-account-menu")).toHaveClass(
  "fixed",
  "right-2",
  "top-2"
);
```

- [x] **Step 2: 运行测试并确认先失败**

Run:

```bash
cd frontend && npm run test -- --run tests/aigc-editor.test.tsx tests/workspace-navigation.test.tsx
```

Expected: FAIL，工具栏尚未预留空间，账号菜单尚无定位 test id。

- [x] **Step 3: 实现响应式账号槽位**

在 `account-menu.tsx` 的沉浸式根节点设置：

```tsx
className="fixed right-2 top-2 z-[90] sm:right-3"
data-testid="immersive-account-menu"
```

在 `aigc-editor.tsx` 的工具栏设置：

```tsx
className="... pl-2 pr-[4.5rem] sm:pl-3 sm:pr-44"
```

这样手机端为头像预留 72px，`sm` 以上为完整账号菜单预留 176px；执行区保持在预留空间左侧并至少留出 8px 间距。

- [x] **Step 4: 运行相关测试**

Run:

```bash
cd frontend && npm run test -- --run tests/aigc-editor.test.tsx tests/workspace-navigation.test.tsx
```

Expected: PASS。

### Task 3: 多视口视觉与质量验证

**Files:**
- Verify: `frontend/components/layout/app-shell.tsx`
- Verify: `frontend/components/layout/account-menu.tsx`
- Verify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Create screenshots: `.trae/artifacts/navigation-account-alignment/`

- [x] **Step 1: 运行静态质量检查**

Run:

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
```

Expected: 全部 PASS。

- [x] **Step 2: 运行 Playwright 三视口验证**

使用现有本地服务和测试账号，在以下视口检查普通导航与 AIGC 画布：

```text
desktop: 1440×900
tablet: 834×1112
mobile: 390×844
```

验证：

```text
账号入口靠导航最右侧
主导航水平居中
账号按钮与执行按钮边界不相交
没有横向溢出
没有 console error 或 pageerror
```

- [x] **Step 3: 保存前后对比截图**

将用户提供的原始截图作为“调整前”参考，并把三个视口的“调整后”截图保存到：

```text
.trae/artifacts/navigation-account-alignment/desktop-after.png
.trae/artifacts/navigation-account-alignment/tablet-after.png
.trae/artifacts/navigation-account-alignment/mobile-after.png
```

- [x] **Step 4: 检查差异**

Run:

```bash
git diff --check
git diff -- frontend/components/layout/app-shell.tsx frontend/components/layout/account-menu.tsx frontend/components/workspace/aigc/aigc-editor.tsx frontend/tests/workspace-navigation.test.tsx frontend/tests/aigc-editor.test.tsx
```

Expected: 无空白错误，差异仅包含布局、测试及必要的定位标记。
