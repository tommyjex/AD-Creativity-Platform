# Canvas Workspace List Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the shared workspace navigation and the AIGC canvas list as the approved dark, restrained, teal-accented “星图创作台” while preserving all existing data, permission, mutation, and editor behavior.

**Architecture:** Keep `AppShell` as the single shared navigation owner and keep `AigcWorkspace` as the existing query/mutation boundary. Apply the redesign through focused JSX and Tailwind class changes, retaining the current thumbnail/topology fallback and extracting no new business abstractions. Lock behavior and responsive contracts with Vitest first, then update the existing Playwright acceptance script for the approved desktop, tablet, and mobile viewports.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, TanStack Query, Lucide React, Vitest, Testing Library, Playwright

---

## File Map

- Modify: `frontend/components/layout/app-shell.tsx`
  - Replace the temporary National Day navigation skin with the persistent dark workspace navigation.
  - Preserve route activation, mobile menu behavior, account controls, and immersive editor routing.
- Modify: `frontend/tests/workspace-navigation.test.tsx`
  - Replace holiday-theme assertions with dark-shell, teal-active-state, and responsive navigation assertions.
- Modify: `frontend/components/workspace/aigc/aigc-workspace.tsx`
  - Recompose the title, count, toolbar, grid, cards, and page states.
  - Preserve all current query, mutation, permission, thumbnail, and navigation behavior.
- Modify: `frontend/tests/aigc-workspace.test.tsx`
  - Update responsive layout expectations and add coverage for media fallback, event isolation, read-only controls, and page states.
- Modify: `frontend/scripts/verify-aigc-workspace.mjs`
  - Validate 4/2/1 columns at `1440x900`, `768x1024`, and `390x844`.
  - Check overflow, media containment, mobile navigation, text overlap, and key interactions.
- Reference only: `docs/superpowers/specs/2026-10-10-canvas-workspace-list-redesign-design.md`
  - Approved product and visual contract.

### Task 1: Replace the Shared Navigation Theme

**Files:**
- Modify: `frontend/tests/workspace-navigation.test.tsx:286-333`
- Modify: `frontend/components/layout/app-shell.tsx:16-194`

- [ ] **Step 1: Replace the holiday-theme test with the persistent dark-shell contract**

Replace the `renders the decorative National Day navigation theme` test and extend the layout test:

```tsx
it("renders the persistent dark workspace navigation theme", () => {
  render(
    <AppShell>
      <div>首页内容</div>
    </AppShell>
  );

  expect(
    screen.queryByTestId("app-shell-navigation-background")
  ).toBeNull();
  expect(screen.getByRole("banner")).toHaveClass(
    "border-white/10",
    "bg-[#080c0b]/95"
  );
  expect(screen.getByTestId("app-shell-brand-mark")).toHaveClass(
    "border-emerald-400/40",
    "bg-emerald-400/10"
  );
  expect(screen.getByRole("link", { name: "项目" })).toHaveClass(
    "bg-emerald-400/10",
    "text-emerald-300"
  );
});

it("keeps the primary navigation centered and the account slot at the viewport edge", () => {
  render(
    <AppShell>
      <div>首页内容</div>
    </AppShell>
  );

  expect(screen.getByTestId("app-shell-navigation-layout")).toHaveClass(
    "mx-auto",
    "max-w-[1440px]",
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
});
```

- [ ] **Step 2: Run the focused navigation test and verify the visual contract fails**

Run:

```bash
cd frontend && npm test -- tests/workspace-navigation.test.tsx
```

Expected: FAIL because the existing banner still uses `bg-[#b61519]`, renders `app-shell-navigation-background`, and lacks the new dark/teal classes.

- [ ] **Step 3: Implement the dark shared navigation without changing navigation behavior**

Delete `navigationBackgroundUrl` and both holiday overlay elements. Keep `navItems`, route matching, mobile state, `AccountMenu`, and the immersive route branch unchanged.

Use this structure and class contract for the normal shell:

```tsx
<div
  className="relative min-h-screen overflow-hidden bg-[#090d0c] text-foreground"
  data-testid="app-shell"
>
  <AtmosphereLayer />
  <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-white/10 bg-[#080c0b]/95 text-white shadow-[0_8px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl">
    <div
      className="relative mx-auto flex h-full w-full max-w-[1440px] items-center gap-4 px-4 lg:px-6"
      data-testid="app-shell-navigation-layout"
    >
      <Link className="group flex shrink-0 items-center gap-3" href="/">
        <BrandMark />
        <div className="leading-none">
          <div className="text-sm font-semibold tracking-[0.18em] text-white">
            AD CREATIVITY
          </div>
          <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-white/45">
            Campaign generation deck
          </div>
        </div>
      </Link>

      <nav
        aria-label="主导航"
        className="hidden items-center gap-1 border border-white/10 bg-white/[0.035] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.2)] md:absolute md:left-1/2 md:flex md:-translate-x-1/2"
        data-testid="app-shell-primary-navigation"
      >
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                isActive
                  ? "bg-emerald-400/10 text-emerald-300"
                  : "text-white/60 hover:bg-white/[0.055] hover:text-white"
              )}
              href={item.href as Route}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        className="ml-auto hidden shrink-0 md:block"
        data-testid="app-shell-account-slot"
      >
        <AccountMenu />
      </div>

      <button
        aria-controls="mobile-navigation-menu"
        aria-expanded={isMobileNavOpen}
        aria-label={isMobileNavOpen ? "关闭导航菜单" : "打开导航菜单"}
        className="ml-auto grid h-10 w-10 shrink-0 place-items-center border border-white/15 bg-white/[0.04] text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 md:hidden"
        onClick={() =>
          setMobileNavPathname(isMobileNavOpen ? null : pathname)
        }
        type="button"
      >
        {isMobileNavOpen ? (
          <X aria-hidden="true" size={19} />
        ) : (
          <Menu aria-hidden="true" size={19} />
        )}
      </button>
    </div>

    {isMobileNavOpen ? (
      <nav
        aria-label="移动导航"
        className="absolute inset-x-4 top-[calc(100%+0.5rem)] grid gap-1 border border-white/10 bg-[#0d1311]/98 p-2 shadow-2xl backdrop-blur-xl md:hidden"
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
                "px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-emerald-400/10 text-emerald-300"
                  : "text-white/65 hover:bg-white/[0.055] hover:text-white"
              )}
              href={item.href as Route}
              key={item.href}
              onClick={() => setMobileNavPathname(null)}
            >
              {item.label}
            </Link>
          );
        })}
        <AccountMenu
          mode="mobile"
          onNavigate={() => setMobileNavPathname(null)}
        />
      </nav>
    ) : null}
  </header>

  <div className="relative z-10 pt-16" data-testid="app-shell-content">
    {children}
  </div>
</div>
```

Update `BrandMark` and remove rounded decorative geometry:

```tsx
function BrandMark() {
  return (
    <div
      className="relative grid h-10 w-10 place-items-center border border-emerald-400/40 bg-emerald-400/10"
      data-testid="app-shell-brand-mark"
    >
      <Workflow aria-hidden="true" className="h-5 w-5 text-emerald-300" />
    </div>
  );
}
```

Add `Workflow` to the existing Lucide import. Keep `AtmosphereLayer`, but replace its colored orbs with a neutral grid and top vignette:

```tsx
function AtmosphereLayer() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      <div className="ad-noise absolute inset-0 opacity-50" />
      <div className="ad-shell-grid absolute inset-0 opacity-35" />
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-emerald-400/[0.035] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#090d0c] via-[#090d0c]/70 to-transparent" />
    </div>
  );
}
```

- [ ] **Step 4: Run the navigation suite and verify all routing and account behavior still passes**

Run:

```bash
cd frontend && npm test -- tests/workspace-navigation.test.tsx
```

Expected: PASS, including immersive editor routing, mobile open/close, account actions, and active route tests.

- [ ] **Step 5: Commit the shared navigation change**

```bash
git add frontend/components/layout/app-shell.tsx frontend/tests/workspace-navigation.test.tsx
git commit -m "feat(layout): redesign shared workspace navigation"
```

### Task 2: Recompose the Workspace Header and Toolbar

**Files:**
- Modify: `frontend/tests/aigc-workspace.test.tsx:170-205`
- Modify: `frontend/components/workspace/aigc/aigc-workspace.tsx:225-330`

- [ ] **Step 1: Write failing tests for the constrained workspace shell and toolbar**

Replace the current workspace-shell assertion and add a toolbar assertion:

```tsx
it("renders the constrained constellation workspace shell and current view total", () => {
  renderWorkspace();

  expect(screen.getByTestId("aigc-workspace")).toHaveClass(
    "bg-[#090d0c]",
    "text-slate-100"
  );
  expect(screen.getByTestId("aigc-workspace-content")).toHaveClass(
    "mx-auto",
    "max-w-[1400px]"
  );
  expect(screen.getByText("DAG CREATION WORKSPACE")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "星图创作台" })).toBeInTheDocument();
  expect(screen.getByText("1 个模板")).toHaveClass(
    "rounded-full",
    "border-emerald-400/20"
  );
});

it("keeps tabs, submitted search, clear action and creation in one responsive toolbar", () => {
  renderWorkspace();

  expect(screen.getByTestId("aigc-workspace-toolbar")).toHaveClass(
    "flex-col",
    "lg:flex-row"
  );
  expect(screen.getByRole("tablist", { name: "AIGC 视图" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "按名称筛选" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "筛选" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "新建空白画布" })).toBeInTheDocument();

  fireEvent.change(screen.getByRole("textbox", { name: "按名称筛选" }), {
    target: { value: "商品" }
  });
  expect(
    screen.getByRole("button", { name: "清空筛选" })
  ).toBeInTheDocument();
  expect(apiMocks.listAigcTemplates).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused tests and verify they fail on the old structure**

Run:

```bash
cd frontend && npm test -- tests/aigc-workspace.test.tsx -t "constrained constellation|responsive toolbar"
```

Expected: FAIL because `aigc-workspace-content` and `aigc-workspace-toolbar` do not exist, the root color is different, and the count has no pill styling.

- [ ] **Step 3: Implement the new page shell, title block, count, and toolbar**

Keep all state, query, mutation, and handlers above the return unchanged. Replace the outer page/header/toolbar structure with:

```tsx
<main
  className="min-h-[calc(100dvh-4rem)] w-full bg-[#090d0c] px-4 py-8 text-slate-100 sm:px-6 sm:py-10 lg:px-8"
  data-testid="aigc-workspace"
>
  <div
    className="mx-auto w-full max-w-[1400px]"
    data-testid="aigc-workspace-content"
  >
    <header className="border-b border-white/10 pb-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] font-semibold uppercase text-emerald-400">
            DAG CREATION WORKSPACE
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
            星图创作台
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            从模板快速建立生成流程，或维护可重复执行的节点画布。
          </p>
          {!canWrite ? (
            <ReadOnlyNotice className="mt-3 max-w-xl border-white/10 bg-white/[0.035] text-slate-400" />
          ) : null}
        </div>
        <span className="w-fit shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 font-mono text-xs text-emerald-200">
          {activeData?.total ?? 0} 个{view === "templates" ? "模板" : "画布"}
        </span>
      </div>
    </header>

    <section
      className="mt-5 flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between"
      data-testid="aigc-workspace-toolbar"
    >
      <div
        aria-label="AIGC 视图"
        className="flex w-full gap-1 border border-white/10 bg-black/20 p-1 sm:w-fit"
        role="tablist"
      >
        <ViewButton
          active={view === "templates"}
          icon={<FileStack className="h-4 w-4" />}
          label="画布模板"
          onClick={() => changeView("templates")}
        />
        <ViewButton
          active={view === "pipelines"}
          icon={<Workflow className="h-4 w-4" />}
          label="我的画布"
          onClick={() => changeView("pipelines")}
        />
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
        <form
          className="flex min-w-0 flex-1 gap-2 lg:w-[25rem]"
          onSubmit={submitSearch}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              aria-label="按名称筛选"
              className="border-white/10 bg-black/20 pl-9 text-slate-100 placeholder:text-slate-600 focus-visible:ring-emerald-400"
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="按名称筛选"
              value={draftQuery}
            />
          </div>
          {draftQuery || query ? (
            <Button
              aria-label="清空筛选"
              className="border-white/10 text-slate-400 hover:bg-white/[0.055] hover:text-white"
              onClick={clearSearch}
              size="icon"
              title="清空筛选"
              type="button"
              variant="outline"
            >
              <Eraser className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            className="border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white"
            type="submit"
            variant="outline"
          >
            筛选
          </Button>
        </form>
        {canWrite ? (
          <Button
            className="bg-emerald-400 text-[#06100c] hover:bg-emerald-300"
            onClick={() => setIsCreateOpen(true)}
            type="button"
          >
            <Plus className="h-4 w-4" />
            新建空白画布
          </Button>
        ) : null}
      </div>
    </section>

```

Update `ViewButton` to use the teal active state and visible keyboard focus:

```tsx
className={cn(
  "flex min-h-9 flex-1 items-center justify-center gap-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:flex-none",
  active
    ? "bg-emerald-400/10 text-emerald-300"
    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-100"
)}
```

After the toolbar section, retain the current error/list/empty-state/dialog/
thumbnail-dialog JSX in its current order, then close the new content `div`
and `main`. No query, mutation, or dialog branches move outside the content
container.

- [ ] **Step 4: Run the workspace test suite**

Run:

```bash
cd frontend && npm test -- tests/aigc-workspace.test.tsx
```

Expected: PASS; the existing grid still uses its old classes at this stage, and no query or mutation behavior regresses.

- [ ] **Step 5: Commit the workspace frame and toolbar**

```bash
git add frontend/components/workspace/aigc/aigc-workspace.tsx frontend/tests/aigc-workspace.test.tsx
git commit -m "feat(aigc): redesign workspace header and toolbar"
```

### Task 3: Redesign the Responsive Card Grid and Cards

**Files:**
- Modify: `frontend/tests/aigc-workspace.test.tsx:178-280`
- Modify: `frontend/components/workspace/aigc/aigc-workspace.tsx:342-829`

- [ ] **Step 1: Update the grid contract and add media fallback coverage**

Replace the five-column test and add thumbnail tests:

```tsx
it("defaults to templates and uses the approved responsive grid", () => {
  renderWorkspace();

  expect(screen.getByRole("tab", { name: "画布模板" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.getByText("商品主图模板")).toBeInTheDocument();
  expect(screen.getByTestId("aigc-card-grid")).toHaveClass(
    "grid-cols-1",
    "sm:grid-cols-2",
    "lg:grid-cols-3",
    "xl:grid-cols-4"
  );
  expect(
    screen.getByRole("link", { name: "编辑模板：商品主图模板" })
  ).toHaveAttribute("href", "/workspace/aigc/templates/template-1");
});

it("prefers a contained pipeline image thumbnail", () => {
  renderWorkspace({
    initialView: "pipelines",
    initialPipelines: page([
      {
        ...pipeline,
        thumbnail_asset_id: "asset-image-1",
        thumbnail: {
          asset_id: "asset-image-1",
          kind: "image",
          mime_type: "image/png",
          source: "pinned",
          url: "https://example.test/preview.png"
        }
      }
    ])
  });

  expect(screen.getByRole("img", { name: "画布缩略图" })).toHaveClass(
    "aspect-[16/10]",
    "object-contain"
  );
  expect(screen.queryByTestId("aigc-topology-preview")).toBeNull();
});

it("falls back to topology when a pipeline thumbnail fails", () => {
  renderWorkspace({
    initialView: "pipelines",
    initialPipelines: page([
      {
        ...pipeline,
        thumbnail_asset_id: "asset-image-1",
        thumbnail: {
          asset_id: "asset-image-1",
          kind: "image",
          mime_type: "image/png",
          source: "pinned",
          url: "https://example.test/broken.png"
        }
      }
    ])
  });

  fireEvent.error(screen.getByRole("img", { name: "画布缩略图" }));

  expect(screen.getByTestId("aigc-topology-preview")).toBeInTheDocument();
});
```

- [ ] **Step 2: Add event-isolation and read-only tool tests**

Add:

```tsx
it("keeps card tool actions isolated from the primary open action", () => {
  renderWorkspace({ initialView: "pipelines" });

  fireEvent.click(
    screen.getByRole("button", { name: "选择缩略图：秋季活动画布" })
  );

  expect(navigationMocks.push).not.toHaveBeenCalled();
  expect(apiMocks.instantiateAigcTemplate).not.toHaveBeenCalled();
});

it("hides pipeline mutation tools from read-only viewers", () => {
  permissionMocks.canWrite = false;
  renderWorkspace({ initialView: "pipelines" });

  expect(screen.queryByRole("button", { name: /选择缩略图/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /删除画布/ })).toBeNull();
  expect(
    screen.getByRole("button", { name: "打开画布：秋季活动画布" })
  ).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the new card tests and verify the grid test fails**

Run:

```bash
cd frontend && npm test -- tests/aigc-workspace.test.tsx -t "approved responsive grid|thumbnail|isolated|read-only"
```

Expected: the new fallback and permission tests pass against preserved behavior; the grid test fails until the responsive classes are changed.

- [ ] **Step 4: Implement the 4/3/2/1 responsive grid and restrained card surface**

Change the grid:

```tsx
<div
  className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  data-testid="aigc-card-grid"
>
```

Update these existing `AigcCard` class attributes without changing their child
branches:

```tsx
// article
"group min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#101613] shadow-[0_14px_32px_rgba(0,0,0,0.22)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-400/45 hover:shadow-[0_18px_38px_rgba(0,0,0,0.3)] focus-within:border-emerald-400/55 focus-within:shadow-[0_0_0_1px_rgba(52,211,153,0.18)]"

// primary preview button
"block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"

// information surface
"border-t border-white/10 px-4 py-4"

// title row and title button
"flex min-w-0 items-start justify-between gap-3"
"min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
"block truncate text-sm font-semibold text-white transition-colors group-hover:text-emerald-300"

// description and metadata
"mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-400"
"mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[0.68rem] text-slate-500"

// primary card action base/template/pipeline classes
"mt-4 w-full"
"bg-emerald-400 text-[#06100c] hover:bg-emerald-300"
"border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
```

Keep the current `handleDelete` and `handleThumbnail` calls to both `preventDefault()` and `stopPropagation()`. Keep the current template edit anchor, status badge, thumbnail button, and delete button semantics, but give icon buttons teal focus rings and neutral hover surfaces.

Keep `PipelineThumbnailPreview` at a stable `aspect-[16/10]`, `w-full`, and `object-contain`. Change only its background to `bg-[#0b100e]`. Apply the same aspect and background to `TopologyPreview`, retain normalized node positions, retain tone-specific node colors, and change topology connectors from sky to teal:

```tsx
<line
  className="stroke-emerald-400/35"
  key={edge.id}
  strokeWidth="1.5"
  x1={`${source.x}%`}
  x2={`${target.x}%`}
  y1={`${source.y}%`}
  y2={`${target.y}%`}
/>
```

- [ ] **Step 5: Run the complete workspace test suite**

Run:

```bash
cd frontend && npm test -- tests/aigc-workspace.test.tsx
```

Expected: PASS for templates, pipelines, thumbnail selection/fallback, read-only mode, search, create, instantiate, delete, and navigation.

- [ ] **Step 6: Commit the responsive cards**

```bash
git add frontend/components/workspace/aigc/aigc-workspace.tsx frontend/tests/aigc-workspace.test.tsx
git commit -m "feat(aigc): redesign responsive canvas cards"
```

### Task 4: Align Loading, Error, Empty, Pagination, and Dialog States

**Files:**
- Modify: `frontend/tests/aigc-workspace.test.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-workspace.tsx:309-499`
- Modify: `frontend/components/workspace/aigc/aigc-workspace.tsx:849-934`

- [ ] **Step 1: Add deterministic tests for error, empty, loading, and pagination states**

Add a deferred helper near `page()`:

```tsx
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
```

Add these tests:

```tsx
it("shows a retryable request error", () => {
  renderWorkspace({ initialError: "请求失败" });

  expect(screen.getByRole("alert")).toHaveTextContent("请求失败");
  expect(screen.getByRole("alert")).toHaveClass(
    "rounded-lg",
    "border-red-400/30"
  );
  expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
});

it("distinguishes an empty list from an empty search result", async () => {
  apiMocks.listAigcTemplates.mockResolvedValue(page([]));
  renderWorkspace({ initialTemplates: page([]) });
  const emptyHeading = screen.getByRole("heading", { name: "暂无画布模板" });
  expect(emptyHeading).toBeInTheDocument();
  expect(emptyHeading.closest("div.mt-6")).toHaveClass("rounded-lg");

  fireEvent.change(screen.getByRole("textbox", { name: "按名称筛选" }), {
    target: { value: "不存在" }
  });
  fireEvent.click(screen.getByRole("button", { name: "筛选" }));

  expect(
    await screen.findByRole("heading", { name: "没有匹配的画布" })
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "清空筛选" })).toBeInTheDocument();
});

it("renders pagination for more than one page", () => {
  renderWorkspace({
    initialTemplates: {
      items: [template],
      page: 1,
      page_size: 20,
      total: 21
    }
  });

  expect(screen.getByRole("navigation", { name: "画布分页" })).toHaveTextContent(
    "1 / 2"
  );
  expect(screen.getByRole("navigation", { name: "画布分页" })).toHaveClass(
    "border-white/10"
  );
  expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "下一页" })).toBeEnabled();
});
```

Loading is already represented by `activeQuery.isPending`. Cover it by rendering the pipelines view with a pending query after switching from templates:

```tsx
it("shows the loading state while the selected view is pending", () => {
  const templatesRequest = deferred<AigcPage<AigcPipelineTemplate>>();
  apiMocks.listAigcTemplates.mockReturnValue(templatesRequest.promise);
  renderWorkspace({
    initialError: "初始加载失败"
  });

  expect(screen.getByRole("status")).toHaveTextContent("正在加载画布");
  expect(screen.getByRole("status")).toHaveClass("rounded-lg", "mt-6");
});
```

Add `initialError` to the render helper and pass it through:

```tsx
function renderWorkspace(options: {
  initialError?: string;
  initialPipelines?: AigcPage<AigcPipeline>;
  initialTemplates?: AigcPage<AigcPipelineTemplate>;
  initialView?: "templates" | "pipelines";
} = {}) {
  return render(
    <AigcQueryProvider>
      <AigcWorkspace
        initialError={options.initialError}
        initialPipelines={options.initialPipelines ?? page([pipeline])}
        initialTemplates={options.initialTemplates ?? page([template])}
        initialView={options.initialView}
      />
    </AigcQueryProvider>
  );
}
```

`initialError` intentionally suppresses React Query `initialData` through the
component's existing condition, so the unresolved templates request exercises
the real pending branch without changing production query behavior.

- [ ] **Step 2: Run state tests and confirm the expected failures**

Run:

```bash
cd frontend && npm test -- tests/aigc-workspace.test.tsx -t "retryable|empty list|pagination|loading state"
```

Expected: FAIL on the new `rounded-lg`, `border-white/10`, and spacing class assertions. The underlying error, empty, pagination, and loading behavior remains present.

- [ ] **Step 3: Apply the common dark state styling**

Use these class contracts while keeping labels and handlers unchanged:

```tsx
// Error
className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-red-400/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-300"

// Loading
className="mt-6 grid min-h-64 place-items-center rounded-lg border border-white/10 bg-white/[0.025]"

// Empty
className="mt-6 grid min-h-72 place-items-center rounded-lg border border-dashed border-white/15 bg-white/[0.025] px-6 text-center"

// Pagination
className="mt-6 flex items-center justify-between border-t border-white/10 pt-5"
```

Change empty-state accent icons and primary focus from sky to emerald. Keep destructive errors red and existing badge semantic variants unchanged.

Style both dialogs with `rounded-lg border-white/10 bg-[#111714] text-slate-100`, neutral secondary buttons, emerald primary create action, and the existing destructive delete action. Do not change dialog titles, descriptions, pending guards, or mutation callbacks.

- [ ] **Step 4: Run all focused unit tests**

Run:

```bash
cd frontend && npm test -- tests/aigc-workspace.test.tsx tests/workspace-navigation.test.tsx
```

Expected: PASS with no changed API call arguments, routes, permissions, or dialog behavior.

- [ ] **Step 5: Commit state and dialog styling**

```bash
git add frontend/components/workspace/aigc/aigc-workspace.tsx frontend/tests/aigc-workspace.test.tsx
git commit -m "style(aigc): align workspace states and dialogs"
```

### Task 5: Update Multi-Viewport Browser Acceptance

**Files:**
- Modify: `frontend/scripts/verify-aigc-workspace.mjs`

- [ ] **Step 1: Change the viewport matrix to the approved breakpoints**

Replace `viewports` with:

```js
const viewports = [
  { height: 900, name: "desktop", columns: 4, width: 1440 },
  { height: 1024, name: "tablet", columns: 2, width: 768 },
  { height: 844, name: "mobile", columns: 1, width: 390 }
];
```

- [ ] **Step 2: Extend measurements for overflow, card geometry, media containment, and toolbar overlap**

Replace the page evaluation with:

```js
const measurements = await page.evaluate(() => {
  const root = document.querySelector('[data-testid="aigc-workspace"]');
  const toolbar = document.querySelector(
    '[data-testid="aigc-workspace-toolbar"]'
  );
  const cards = [
    ...document.querySelectorAll('[data-testid="aigc-card"]')
  ];
  const media = [
    ...document.querySelectorAll(
      '[data-testid="aigc-card"] img, [data-testid="aigc-card"] video'
    )
  ];
  const firstCardTop = cards[0]?.getBoundingClientRect().top;
  const firstRow = cards.filter(
    (card) =>
      Math.abs(card.getBoundingClientRect().top - firstCardTop) < 1
  );
  const hasClippedText = [...document.querySelectorAll("button, a, h1, h2, p")]
    .filter(
      (element) =>
        element instanceof HTMLElement &&
        element.getBoundingClientRect().width > 0 &&
        element.getBoundingClientRect().height > 0
    )
    .some(
      (element) =>
        element.scrollWidth > element.clientWidth + 1 &&
        !element.classList.contains("truncate") &&
        !element.classList.contains("line-clamp-2")
    );

  return {
    cardWidths: cards.map((card) => card.getBoundingClientRect().width),
    columns: firstRow.length,
    hasClippedText,
    mediaContained: media.every(
      (element) => getComputedStyle(element).objectFit === "contain"
    ),
    rootWidth: root?.scrollWidth ?? 0,
    toolbarHeight: toolbar?.getBoundingClientRect().height ?? 0,
    viewportWidth: document.documentElement.clientWidth
  };
});
```

Before closing each context, verify the mobile menu at the mobile viewport:

```js
if (viewport.name === "mobile") {
  await page.getByRole("button", { name: "打开导航菜单" }).click();
  await page.getByTestId("mobile-navigation-menu").waitFor();
  await page.getByRole("button", { name: "关闭导航菜单" }).click();
}
```

Use this failure condition:

```js
const invalidCardWidth = measurements.cardWidths.some((width) => width < 240);
const invalidToolbar =
  viewport.name === "mobile" && measurements.toolbarHeight < 120;

if (
  measurements.columns !== viewport.columns ||
  measurements.rootWidth > measurements.viewportWidth ||
  measurements.hasClippedText ||
  !measurements.mediaContained ||
  invalidCardWidth ||
  invalidToolbar ||
  errors.length > 0
) {
  throw new Error(
    `${viewport.name}: ${JSON.stringify({ errors, measurements })}`
  );
}
```

- [ ] **Step 3: Run static validation before browser testing**

Run:

```bash
cd frontend && npm test -- tests/aigc-workspace.test.tsx tests/workspace-navigation.test.tsx
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run build
```

Expected: all commands exit `0`; Vitest reports both focused files passing, TypeScript emits no errors, ESLint emits no warnings, and Next.js completes a production build.

- [ ] **Step 4: Start or reuse the local application and run browser acceptance**

Use the project’s documented local environment. Start the backend and frontend only if matching project services are not already running:

```bash
.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
cd frontend && npm run dev
```

In a separate shell, seed or use an authenticated workspace with at least four visible template cards, then run:

```bash
cd frontend && AIGC_WORKSPACE_URL=http://localhost:3000/workspace/aigc npm run acceptance:aigc-workspace
```

Expected: exit `0` and screenshots written to:

```text
frontend/test-results/aigc-workspace/desktop.png
frontend/test-results/aigc-workspace/tablet.png
frontend/test-results/aigc-workspace/mobile.png
```

Inspect all three screenshots. Confirm:

- Desktop shows four complete cards in the first row.
- Tablet shows two columns and mobile shows one.
- The mobile menu opens above the page without colliding with the toolbar.
- Images and videos retain their full aspect ratio with letterboxing when needed.
- Titles, metadata, count, tabs, search controls, and primary actions do not overlap.
- Hover, focus, disabled, error, and read-only states remain distinguishable.

- [ ] **Step 5: Commit the acceptance coverage**

```bash
git add frontend/scripts/verify-aigc-workspace.mjs
git commit -m "test(aigc): update workspace responsive acceptance"
```

### Task 6: Final Regression and Scope Audit

**Files:**
- Verify: `frontend/components/layout/app-shell.tsx`
- Verify: `frontend/components/workspace/aigc/aigc-workspace.tsx`
- Verify: `frontend/tests/workspace-navigation.test.tsx`
- Verify: `frontend/tests/aigc-workspace.test.tsx`
- Verify: `frontend/scripts/verify-aigc-workspace.mjs`

- [ ] **Step 1: Confirm only approved files changed**

Run:

```bash
git status --short
git diff --stat HEAD~5..HEAD
```

Expected: only the five implementation/test files listed above are changed by the feature commits. The approved spec and this plan remain separate documentation commits.

- [ ] **Step 2: Scan for removed holiday styling and prohibited layout regressions**

Run:

```bash
rg -n "navigation-national-day-red|#b61519|#ffc348|grid-cols-5|object-cover" \
  frontend/components/layout/app-shell.tsx \
  frontend/components/workspace/aigc/aigc-workspace.tsx \
  frontend/tests/workspace-navigation.test.tsx \
  frontend/tests/aigc-workspace.test.tsx \
  frontend/scripts/verify-aigc-workspace.mjs
```

Expected: no matches.

- [ ] **Step 3: Run the final validation set**

Run:

```bash
cd frontend && npm test
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Expected: all frontend tests pass; typecheck, lint, build, and whitespace validation exit `0`.

- [ ] **Step 4: Review the final diff against the approved boundaries**

Run:

```bash
git diff HEAD~5..HEAD -- \
  frontend/components/layout/app-shell.tsx \
  frontend/components/workspace/aigc/aigc-workspace.tsx \
  frontend/tests/workspace-navigation.test.tsx \
  frontend/tests/aigc-workspace.test.tsx \
  frontend/scripts/verify-aigc-workspace.mjs
```

Confirm the diff does not change API calls, query keys, route construction, permission checks, mutation callbacks, data types, immersive editor matching, or other page bodies.

- [ ] **Step 5: Record the implementation result**

Summarize the five feature commits, unit/static/build results, Playwright viewport results, screenshot paths, and any residual visual risk in the execution handoff. Do not create an extra commit when the working tree is clean.
