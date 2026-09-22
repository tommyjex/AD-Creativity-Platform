# 首页生成产物画廊 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将网站首页重写为汇总所有公开生成图片与视频的分类瀑布流画廊，并支持无裁切放大预览。

**Architecture:** 首页服务端组件并行读取项目资产与工具/AIGC 资产，将统一列表交给一个专用客户端画廊。纯函数负责按资产角色和来源排除参考/内部素材、识别媒体类型及倒序排序；客户端组件只维护分类、搜索和预览状态。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Tailwind CSS、Radix Dialog、Lucide React、Vitest、Testing Library、Playwright

---

## 文件结构

- Create: `frontend/lib/home-media-gallery.ts`
  - 首页专用的公开生成媒体筛选、归类、排序和展示模型。
- Create: `frontend/components/home-generated-media-gallery.tsx`
  - 分类控件、搜索、响应式瀑布流、空态/错误态和媒体预览。
- Modify: `frontend/app/page.tsx`
  - 删除旧 Brief 营销首页，并行请求两类现有资产接口。
- Create: `frontend/app/loading.tsx`
  - 与画廊列宽一致的首页加载骨架。
- Create: `frontend/tests/home-media-gallery.test.ts`
  - 纯函数筛选、去重、媒体识别与排序测试。
- Create: `frontend/tests/home-generated-media-gallery.test.tsx`
  - 分类、搜索、空态、错误态和预览交互测试。
- Create: `frontend/tests/home-page.test.tsx`
  - 首页服务端聚合和错误处理测试。
- Create: `frontend/scripts/verify-home-generated-media-gallery.py`
  - 桌面、平板、手机视口及图片/视频 Dialog 的 Playwright 验收。
- Modify: `frontend/package.json`
  - 增加首页验收脚本入口。

### Task 1: 建立首页媒体筛选模型

**Files:**
- Create: `frontend/lib/home-media-gallery.ts`
- Test: `frontend/tests/home-media-gallery.test.ts`

- [ ] **Step 1: 编写失败测试**

创建资产工厂并覆盖以下输入：项目 `generated_image`、项目 `uploaded_image`、公开工具输出 `uploaded_image/uploaded_video`、工具输入、AIGC 输出、内部图层、音频和重复 ID。断言结果只包含公开生成媒体、重复 ID 只保留一次，并按 `updated_at` 倒序。

```ts
expect(buildHomeMediaItems(assets)).toEqual([
  expect.objectContaining({ id: "new-video", kind: "video" }),
  expect.objectContaining({ id: "generated-image", kind: "image" })
]);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- --run tests/home-media-gallery.test.ts`

Expected: FAIL，提示 `@/lib/home-media-gallery` 或 `buildHomeMediaItems` 不存在。

- [ ] **Step 3: 实现最小筛选模型**

导出稳定展示类型和纯函数：

```ts
export type HomeMediaKind = "image" | "video";

export interface HomeMediaItem {
  asset: Asset;
  downloadUrl: string;
  id: string;
  kind: HomeMediaKind;
  name: string;
  previewUrl: string;
  updatedAt: string;
}

export function buildHomeMediaItems(assets: Asset[]): HomeMediaItem[] {
  // 先按 ID 去重，再排除 internal、项目 uploaded_image、
  // tool_asset_role=input 和非媒体资产，最后按 updated_at 倒序。
}
```

媒体识别规则：

```ts
const IMAGE_TYPES = new Set<AssetType>(["generated_image", "uploaded_image"]);
const VIDEO_TYPES = new Set<AssetType>([
  "storyboard_video",
  "final_video",
  "uploaded_video"
]);
```

只有 `getSafePreviewUrl(asset)` 和 `getAssetDownloadUrl(asset)` 均有效的资产进入展示列表；名称使用 `getWorkspaceAssetDescription(asset)`。

- [ ] **Step 4: 运行测试并确认通过**

Run: `npm test -- --run tests/home-media-gallery.test.ts`

Expected: PASS。

### Task 2: 构建分类瀑布流与预览

**Files:**
- Create: `frontend/components/home-generated-media-gallery.tsx`
- Test: `frontend/tests/home-generated-media-gallery.test.tsx`

- [ ] **Step 1: 编写失败组件测试**

覆盖：

```tsx
render(<HomeGeneratedMediaGallery assets={assets} />);
expect(screen.getByRole("tab", { name: /图片/ })).toHaveAttribute(
  "aria-selected",
  "true"
);
expect(screen.getByText("图片产物")).toBeInTheDocument();
expect(screen.queryByText("视频产物")).not.toBeInTheDocument();
```

并验证切换视频、按名称搜索、清空搜索、图片 Dialog 的 `object-contain`、视频 `controls` 且无 `autoplay`、下载链接和关闭后视频卸载。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- --run tests/home-generated-media-gallery.test.tsx`

Expected: FAIL，提示组件不存在。

- [ ] **Step 3: 实现页面头部与分类控件**

组件签名：

```ts
interface HomeGeneratedMediaGalleryProps {
  assets: Asset[];
  error?: string;
}
```

使用带 `role="tablist"` 的图片/视频分段控件，默认状态为 `"image"`；标题区展示两类总数。搜索仅过滤当前分类，并提供带图标的清空按钮。

- [ ] **Step 4: 实现原始比例瀑布流**

使用响应式列容器，并按媒体预计高度将卡片分配到当前最短列：

```tsx
<div
  className="grid items-start gap-3"
  data-column-count={columnCount}
  style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
  data-testid="home-media-masonry"
>
```
每列第一张图片 eager 加载，其余图片继续 lazy 加载；媒体区先使用 metadata 宽高比或保守默认比例占位，加载后以真实像素比校正。图片/视频封面使用 `h-full w-full object-contain`，卡片保持紧凑，只显示名称、更新时间、媒体类型图标和放大提示。

- [ ] **Step 5: 实现媒体 Dialog 与状态反馈**

图片：

```tsx
<img className="max-h-[78dvh] max-w-full object-contain" ... />
```

视频：

```tsx
<video
  aria-label={`${item.name}播放`}
  className="max-h-[78dvh] max-w-full object-contain"
  controls
  playsInline
  preload="metadata"
  src={item.previewUrl}
/>
```

Dialog 关闭后将选中项设为 `null`，使播放器卸载。错误态展示重试链接，分类空态与搜索空态使用不同文案。

- [ ] **Step 6: 运行组件测试并确认通过**

Run: `npm test -- --run tests/home-generated-media-gallery.test.tsx`

Expected: PASS。

### Task 3: 替换首页并接入加载态

**Files:**
- Modify: `frontend/app/page.tsx`
- Create: `frontend/app/loading.tsx`
- Test: `frontend/tests/home-page.test.tsx`

- [ ] **Step 1: 编写失败首页路由测试**

Mock `createApiClient` 和画廊组件，断言：

```ts
expect(apiMocks.listAssets).toHaveBeenCalledWith(
  {},
  { next: { revalidate: 30 } }
);
expect(apiMocks.listToolAssets).toHaveBeenCalledWith({
  next: { revalidate: 30 }
});
expect(screen.getByTestId("home-gallery-assets")).toHaveTextContent("2");
```

再让任一请求 reject，断言画廊收到统一错误文案且页面仍可渲染。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- --run tests/home-page.test.tsx`

Expected: FAIL，因为首页仍渲染 Brief 页面。

- [ ] **Step 3: 实现首页服务端聚合**

将 `frontend/app/page.tsx` 简化为：

```tsx
export default async function Home() {
  const api = createApiClient();
  let assets: Asset[] = [];
  let error: string | undefined;

  try {
    const [projectAssets, toolAssets] = await Promise.all([
      api.listAssets({}, { next: { revalidate: 30 } }),
      api.listToolAssets({ next: { revalidate: 30 } })
    ]);
    assets = [...projectAssets, ...toolAssets];
  } catch (requestError) {
    error = getUserFacingErrorMessage(requestError);
  }

  return <HomeGeneratedMediaGallery assets={assets} error={error} />;
}
```

- [ ] **Step 4: 实现首页加载骨架**

加载页保留标题、分段控件和响应式 columns，使用固定的多种 `aspect-ratio` 骨架块，避免加载完成时整体跳动。

- [ ] **Step 5: 运行首页测试并确认通过**

Run: `npm test -- --run tests/home-page.test.tsx`

Expected: PASS。

### Task 4: 全量回归与多视口验收

**Files:**
- Create: `frontend/scripts/verify-home-generated-media-gallery.py`
- Modify: `frontend/package.json`

- [ ] **Step 1: 添加 Playwright 验收脚本**

脚本拦截：

```js
await page.route("**/api/assets**", route =>
  route.fulfill({ contentType: "application/json", body: JSON.stringify(projectAssets) })
);
await page.route("**/api/tools/assets", route =>
  route.fulfill({ contentType: "application/json", body: JSON.stringify(toolAssets) })
);
```

在 `1440x1000`、`1024x768`、`390x844` 验证：

- 首页不存在 Brief 表单和营销能力卡片。
- 默认图片分类，仅出现可公开展示的生成图片。
- 图片/视频切换和搜索有效。
- 瀑布流媒体 `naturalWidth/naturalHeight` 与渲染比例一致，不裁切或拉伸。
- 点击图片和视频均打开 Dialog，视频不自动播放。
- 页面无横向滚动、卡片与控件无重叠。

- [ ] **Step 2: 增加脚本命令**

在 `frontend/package.json` 增加：

```json
"acceptance:home-gallery": "../.venv/bin/python scripts/verify-home-generated-media-gallery.py"
```

- [ ] **Step 3: 运行定向测试**

Run:

```bash
npm test -- --run tests/home-media-gallery.test.ts tests/home-generated-media-gallery.test.tsx tests/home-page.test.tsx
```

Expected: 所有定向测试 PASS。

- [ ] **Step 4: 运行前端质量检查**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 全部退出码为 0。

- [ ] **Step 5: 启动服务并执行浏览器验收**

Run:

```bash
npm run dev
npm run acceptance:home-gallery
```

Expected: 脚本输出 `result: "PASS"`，并在 `frontend/test-results/home-generated-media-gallery/` 生成三个视口及预览 Dialog 截图。

- [ ] **Step 6: 检查最终差异**

Run:

```bash
git diff --check
git status --short
```

Expected: 无空白错误；只报告本功能文件以及用户原有未提交改动。
