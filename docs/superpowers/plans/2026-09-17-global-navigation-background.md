# 全局导航栏背景底图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将所有非全屏页面的纯白全局导航改为方案 C 暗色背景图导航，删除无效操作，并提供完整移动端菜单。

**Architecture:** 保持 `AppShell` 作为唯一全局导航入口，在现有 64px Header 内增加装饰图片层与固定渐变遮罩层。桌面端改为品牌与导航胶囊双区布局；移动端复用同一 `navItems` 数据，通过局部 React 状态控制紧凑菜单，不引入新 UI 依赖。

**Tech Stack:** React 19、Next.js 16、TypeScript、Tailwind CSS、Lucide React、Vitest、Testing Library、Playwright

---

## 文件结构

- 修改 `frontend/components/layout/app-shell.tsx`：背景底图、桌面布局、删除无效操作、移动菜单。
- 修改 `frontend/tests/workspace-navigation.test.tsx`：组件行为与可访问性测试。
- 新建 `frontend/scripts/verify-global-navigation-background.mjs`：多视口浏览器验收。
- 修改 `frontend/package.json`：增加导航验收脚本入口。

### Task 1：用组件测试锁定新导航契约

**Files:**
- Modify: `frontend/tests/workspace-navigation.test.tsx`

- [x] **Step 1：添加删除无效操作的失败测试**

在 `AppShell top navigation` 测试组中替换“进入工作台”链接测试：

```tsx
it("removes the redundant status and workspace actions", () => {
  render(
    <AppShell>
      <div>首页内容</div>
    </AppShell>
  );

  expect(screen.queryByText("BRIEF READY")).toBeNull();
  expect(screen.queryByRole("link", { name: "进入工作台" })).toBeNull();
});
```

- [x] **Step 2：添加背景层和桌面布局失败测试**

```tsx
it("renders the decorative dark navigation background", () => {
  render(
    <AppShell>
      <div>首页内容</div>
    </AppShell>
  );

  const background = screen.getByTestId("app-shell-navigation-background");
  expect(background).toHaveAttribute("aria-hidden", "true");
  expect(background.style.backgroundImage).toContain(
    "copilot-cn.bytedance.net/api/ide/v1/text_to_image"
  );
  expect(screen.getByRole("banner")).toHaveClass("bg-[#14191f]");
});
```

- [x] **Step 3：添加移动菜单失败测试**

```tsx
it("opens and closes the mobile navigation menu", () => {
  render(
    <AppShell>
      <div>首页内容</div>
    </AppShell>
  );

  const trigger = screen.getByRole("button", { name: "打开导航菜单" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByTestId("mobile-navigation-menu")).toBeNull();

  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  const menu = screen.getByTestId("mobile-navigation-menu");
  expect(within(menu).getByRole("link", { name: "项目" })).toHaveAttribute(
    "aria-current",
    "page"
  );

  fireEvent.click(screen.getByRole("button", { name: "关闭导航菜单" }));
  expect(screen.queryByTestId("mobile-navigation-menu")).toBeNull();
});
```

补充点击移动导航链接后菜单关闭的测试：

```tsx
fireEvent.click(within(menu).getByRole("link", { name: "资产库" }));
expect(screen.queryByTestId("mobile-navigation-menu")).toBeNull();
```

- [x] **Step 4：运行测试确认失败**

Run:

```bash
cd frontend
npm test -- tests/workspace-navigation.test.tsx
```

Expected: 新测试因背景层和移动菜单尚不存在、旧操作仍存在而失败。

### Task 2：实现暗色背景和桌面双区布局

**Files:**
- Modify: `frontend/components/layout/app-shell.tsx`

- [x] **Step 1：清理无效依赖和操作区**

删除：

```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
```

并删除渲染 `BRIEF READY` 与“进入工作台”的整个右侧容器。

- [x] **Step 2：定义稳定的背景图 URL**

在 `navItems` 后定义：

```tsx
const navigationBackgroundUrl =
  "https://copilot-cn.bytedance.net/api/ide/v1/text_to_image" +
  "?prompt=ultra-wide%20cinematic%20abstract%20background%20for%20an%20AI" +
  "%20creative%20workflow%20navigation%20bar%2C%20dark%20graphite%20glass" +
  "%20and%20obsidian%20surfaces%2C%20fine%20electric%20blue%20light%20traces" +
  "%2C%20small%20orange%20green%20and%20magenta%20signals%2C%20realistic" +
  "%20high-end%20technology%20photography%2C%20controlled%20contrast%2C" +
  "%20clean%20negative%20space%2C%20no%20text%2C%20no%20logos" +
  "&image_size=landscape_16_9";
```

- [x] **Step 3：增加背景层和遮罩层**

将 Header 改为：

```tsx
<header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#14191f] text-white">
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 bg-cover bg-center"
    data-testid="app-shell-navigation-background"
    style={{ backgroundImage: `url("${navigationBackgroundUrl}")` }}
  />
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(11,15,20,0.96)_0%,rgba(13,18,24,0.72)_52%,rgba(10,14,19,0.90)_100%)]"
  />
  ...
</header>
```

纯色 `bg-[#14191f]` 是图片失败时的回退。

- [x] **Step 4：调整桌面布局和视觉状态**

将容器保持为：

```tsx
<div className="container relative z-10 flex h-16 items-center justify-between gap-6">
```

品牌文字改为：

```tsx
<div className="text-sm font-semibold tracking-[0.18em] text-white">
  AD CREATIVITY
</div>
<div className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-slate-400">
  Campaign generation deck
</div>
```

桌面导航改为：

```tsx
<nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl md:flex">
```

当前与非当前链接分别使用：

```tsx
isActive
  ? "bg-primary/90 text-white shadow-sm"
  : "text-slate-300 hover:bg-white/10 hover:text-white"
```

- [x] **Step 5：调整品牌标志**

给 `BrandMark` 传入暗色导航样式：

```tsx
<BrandMark className="border-blue-400/40 bg-blue-500/15" />
```

保留现有内部蓝色标识，不改变品牌图形。

- [x] **Step 6：运行组件测试**

Run:

```bash
cd frontend
npm test -- tests/workspace-navigation.test.tsx
```

Expected: 删除项和背景层测试通过；移动菜单测试仍失败。

### Task 3：实现移动导航菜单

**Files:**
- Modify: `frontend/components/layout/app-shell.tsx`
- Test: `frontend/tests/workspace-navigation.test.tsx`

- [x] **Step 1：增加路径派生状态和图标**

新增导入：

```tsx
import { Menu, X } from "lucide-react";
import { useState } from "react";
```

在 `AppShell` 中增加：

```tsx
const [mobileNavPathname, setMobileNavPathname] = useState<string | null>(null);
const isMobileNavOpen = mobileNavPathname === pathname;
```

菜单打开时记录当前 `pathname`，路由变化后派生状态自动变为关闭，避免在 Effect 中同步更新状态。

- [x] **Step 2：增加移动菜单按钮**

```tsx
<button
  aria-controls="mobile-navigation-menu"
  aria-expanded={isMobileNavOpen}
  aria-label={isMobileNavOpen ? "关闭导航菜单" : "打开导航菜单"}
  className="grid h-10 w-10 place-items-center rounded-md border border-white/15 bg-black/25 text-slate-100 transition hover:bg-white/10 md:hidden"
  onClick={() => setMobileNavPathname(isMobileNavOpen ? null : pathname)}
  type="button"
>
  {isMobileNavOpen ? <X aria-hidden="true" size={19} /> : <Menu aria-hidden="true" size={19} />}
</button>
```

- [x] **Step 3：增加移动菜单浮层**

仅在打开时渲染：

```tsx
{isMobileNavOpen ? (
  <nav
    className="absolute inset-x-4 top-[calc(100%+0.5rem)] grid gap-1 rounded-md border border-white/10 bg-[#171c23]/95 p-2 shadow-2xl backdrop-blur-xl md:hidden"
    data-testid="mobile-navigation-menu"
    id="mobile-navigation-menu"
  >
    {navItems.map((item) => {
      const isActive =
        pathname === item.href || pathname.startsWith(`${item.href}/`);
      return (
        <Link
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "rounded px-3 py-2.5 text-sm transition",
            isActive
              ? "bg-primary/90 text-white"
              : "text-slate-300 hover:bg-white/10 hover:text-white"
          )}
          href={item.href as Route}
          key={item.href}
          onClick={() => setMobileNavPathname(null)}
        >
          {item.label}
        </Link>
      );
    })}
  </nav>
) : null}
```

- [x] **Step 4：运行组件测试**

Run:

```bash
cd frontend
npm test -- tests/workspace-navigation.test.tsx
```

Expected: 全部测试通过。

### Task 4：增加多视口浏览器验收

**Files:**
- Create: `frontend/scripts/verify-global-navigation-background.mjs`
- Modify: `frontend/package.json`

- [x] **Step 1：创建 Playwright 验收脚本**

脚本使用 `@playwright/test` 的 Chromium，检查：

```javascript
const viewports = [
  { name: "desktop-wide", width: 1920, height: 1080 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 }
];
```

每个视口访问：

```javascript
await page.goto(`${baseUrl}/workspace/aigc?view=pipelines`, {
  waitUntil: "networkidle"
});
```

断言：

```javascript
const header = page.getByRole("banner");
await expect(header).toHaveCSS("height", "64px");
await expect(page.getByText("BRIEF READY")).toHaveCount(0);
await expect(page.getByRole("link", { name: "进入工作台" })).toHaveCount(0);
const background = page.getByTestId("app-shell-navigation-background");
await expect(background).toBeVisible();
const backgroundImage = await background.evaluate(
  (element) => getComputedStyle(element).backgroundImage
);
assert(backgroundImage.includes("text_to_image"));
```

桌面和平板断言导航胶囊可见且当前项高亮；手机断言菜单按钮可见、点击后四个入口均在视口内。

截图输出到：

```text
frontend/test-results/global-navigation-background/
```

- [x] **Step 2：增加 npm script**

在 `frontend/package.json` 中增加：

```json
"acceptance:navigation-background": "node scripts/verify-global-navigation-background.mjs"
```

- [x] **Step 3：运行验收**

Run:

```bash
cd frontend
npm run acceptance:navigation-background
```

Expected: 四种视口全部通过并生成截图。

### Task 5：完整验证和服务检查

**Files:**
- Verify all files above.

- [x] **Step 1：运行前端完整测试**

Run:

```bash
cd frontend
npm test
```

Expected: 全部测试通过。

- [x] **Step 2：运行静态检查与构建**

Run:

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
```

Expected: 三个命令全部通过。

- [x] **Step 3：检查差异**

Run:

```bash
git diff --check
```

Expected: 无输出。

- [x] **Step 4：启动并验证服务**

Run:

```bash
curl -sS http://127.0.0.1:8000/health
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000
```

Expected: 后端返回 `status: ok`，前端返回 `200`。
