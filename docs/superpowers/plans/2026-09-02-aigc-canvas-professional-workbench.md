# AIGC Canvas Professional Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AIGC 编辑器重组为“窄节点库 + 大画布 + 按需详情栏 + 底部视图工具坞”的专业工作台，同时保持自动保存、运行和节点编辑契约不变。

**Architecture:** 面板开合继续由 `AigcEditorContent` 的本地 React 状态管理，不进入 Zustand editor store 或 Pipeline definition。共享 `NodeCanvas` 只增加可选 Controls 参数，AIGC 编辑器通过该接口定制底部居中位置，其他画布沿用默认行为。

**Tech Stack:** React 19、Next.js 16、TypeScript、Zustand、TanStack Query、React Flow、Tailwind CSS、Lucide React、Vitest、Testing Library、Playwright

---

### Task 1: 固化面板状态与交互契约

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx:331-342`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx:410-449`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx:633-896`
- Test: `frontend/tests/aigc-editor.test.tsx`

- [ ] **Step 1: 写面板默认值和节点选择的失败测试**

在 `frontend/tests/aigc-editor.test.tsx` 增加用例，先约束桌面默认不显示详情栏，并在节点选择后显示配置：

```tsx
it("keeps the desktop inspector closed until a node is selected", () => {
  renderEditor(pipeline, "pipeline");

  expect(screen.queryByTestId("aigc-inspector")).toBeNull();

  act(() => {
    screen.getByTestId("select-model-node").click();
  });

  expect(screen.getByTestId("aigc-inspector")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "配置" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
});
```

同时扩展 `NodeCanvas` mock，提供 `select-model-node` 和 `clear-selection` 按钮，分别调用 `reactFlowProps.onNodeClick` 与 `reactFlowProps.onPaneClick`。

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cd frontend && npm test -- tests/aigc-editor.test.tsx
```

Expected: FAIL，当前桌面 Inspector 默认常驻，且 mock 尚无节点选择入口。

- [ ] **Step 3: 实现统一面板状态与打开动作**

在 `AigcEditorContent` 中用本地状态替换 `mobilePanel`，并在同一任务增加顶部详情、运行记录和关闭入口：

```tsx
type EditorPanel = "nodes" | "inspector" | null;

const [openPanel, setOpenPanel] = useState<EditorPanel>(null);

const openInspector = useCallback((tab: InspectorTab) => {
  setInspectorTab(tab);
  setOpenPanel("inspector");
}, []);

const selectNodeAndInspect = useCallback(
  (nodeId: string) => {
    selectNode(nodeId);
    openInspector("config");
  },
  [openInspector, selectNode]
);
```

将节点点击和 `NodeChange` 的选中分支统一调用 `selectNodeAndInspect`；`onPaneClick` 只调用 `selectNode(null)`，不关闭详情栏或切换标签。桌面和窄屏 Inspector 均仅在 `openPanel === "inspector"` 时渲染。关闭按钮只执行 `setOpenPanel(null)`，不重置 `selectedNodeId`、`inspectorTab` 或 `selectedRunId`。

顶部“详情”使用以下状态规则：

```tsx
function toggleDetails() {
  if (openPanel === "inspector" && inspectorTab === "config") {
    setOpenPanel(null);
    return;
  }
  openInspector("config");
}
```

Pipeline 顶部“运行记录”调用 `openInspector("run")`；模板不渲染该入口。为依赖默认常驻 Inspector 的既有测试增加测试 helper：

```tsx
function openDetails() {
  fireEvent.click(screen.getByRole("button", { name: "详情" }));
}
```

所有直接查询名称、描述、配置、结果或运行标签的测试先调用 `openDetails()`，需要运行标签的测试再点击“运行”。

- [ ] **Step 4: 增加运行入口、关闭和空白取消选择测试**

测试以下状态转换：

```tsx
fireEvent.click(screen.getByRole("button", { name: "运行记录" }));
expect(screen.getByRole("tab", { name: "运行" })).toHaveAttribute(
  "aria-selected",
  "true"
);

fireEvent.click(screen.getByRole("button", { name: "详情" }));
expect(screen.getByRole("tab", { name: "配置" })).toHaveAttribute(
  "aria-selected",
  "true"
);
fireEvent.click(screen.getByRole("button", { name: "详情" }));
expect(screen.queryByTestId("aigc-inspector")).toBeNull();

fireEvent.click(screen.getByRole("button", { name: "关闭详情栏" }));
expect(screen.queryByTestId("aigc-inspector")).toBeNull();

fireEvent.click(screen.getByRole("button", { name: "详情" }));
fireEvent.click(screen.getByTestId("clear-selection"));
expect(screen.getByTestId("aigc-inspector")).toBeInTheDocument();
expect(screen.getByText("选择节点后编辑配置")).toBeInTheDocument();

fireEvent.click(screen.getByRole("tab", { name: "运行" }));
fireEvent.click(screen.getByTestId("clear-selection"));
expect(screen.getByRole("tab", { name: "运行" })).toHaveAttribute(
  "aria-selected",
  "true"
);

fireEvent.click(screen.getByRole("tab", { name: "结果" }));
fireEvent.click(screen.getByTestId("clear-selection"));
expect(screen.getByText("alpha-output")).toBeInTheDocument();
expect(screen.getByText("beta-output")).toBeInTheDocument();
```

结果用例使用节点 ID 为 `alpha-output`、`beta-output` 的两个成功结果构造 `runDetail` fixture，并断言取消节点选择后两项均展示；不得将 `ResultPanel` 现有的 `nodeId=null` 聚合语义改为空状态。

- [ ] **Step 5: 运行定向测试**

Run:

```bash
cd frontend && npm test -- tests/aigc-editor.test.tsx
```

Expected: PASS。

- [ ] **Step 6: 提交面板状态变更**

```bash
git add frontend/components/workspace/aigc/aigc-editor.tsx frontend/tests/aigc-editor.test.tsx
git commit -m "feat(aigc): add on-demand editor panels"
```

### Task 2: 重组顶部栏、节点库和详情栏

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx:633-896`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx:961-1150`
- Test: `frontend/tests/aigc-editor.test.tsx`

- [ ] **Step 1: 写桌面骨架和模式差异测试**

为节点库、详情栏和顶部入口增加稳定测试标识，并先写断言：

```tsx
const pipelineView = renderEditor(pipeline, "pipeline");
expect(screen.getByTestId("aigc-node-palette")).toHaveClass("w-[184px]");
expect(screen.queryByTestId("aigc-inspector")).toBeNull();
expect(screen.getByRole("button", { name: "详情" })).toBeEnabled();
expect(screen.getByRole("button", { name: "运行记录" })).toBeEnabled();
pipelineView.unmount();

const templateView = renderEditor(template, "template");
expect(screen.queryByRole("button", { name: "运行记录" })).toBeNull();
expect(screen.queryByRole("button", { name: "执行" })).toBeNull();
fireEvent.click(screen.getByRole("button", { name: "详情" }));
fireEvent.click(screen.getByRole("tab", { name: "结果" }));
expect(screen.getByRole("heading", { name: "暂无结果" })).toBeInTheDocument();
fireEvent.click(screen.getByRole("tab", { name: "运行" }));
expect(screen.getByText("模板不可执行，请先创建画布实例。")).toBeInTheDocument();
templateView.unmount();
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cd frontend && npm test -- tests/aigc-editor.test.tsx
```

Expected: FAIL，节点库仍为 `w-60`，详情栏常驻，顶部没有详情与运行入口。

- [ ] **Step 3: 实现顶部命令分层**

在 Lucide import 中保留 `PanelRight` 并增加适合运行记录的 `History`。整理 Task 1 已加入的入口样式，Pipeline 命令顺序固定为撤销、重做、详情、运行记录、另存模板、执行；模板只展示撤销、重做和详情。

```tsx
<Button
  aria-label="详情"
  aria-pressed={openPanel === "inspector" && inspectorTab !== "run"}
  onClick={toggleDetails}
  size="icon"
  title="详情"
  type="button"
  variant="ghost"
>
  <PanelRight className="h-4 w-4" />
</Button>
```

Pipeline 的运行记录按钮调用 `openInspector("run")`。保持现有 `execute()`、`saveAsTemplate()`、撤销、重做和 autosave 状态逻辑不变。

- [ ] **Step 4: 收窄节点库并改造 Inspector**

`NodePalette` 桌面基础类改为：

```tsx
"w-[184px] shrink-0 overflow-y-auto border-r border-border bg-card px-2 py-3"
```

为 `NodePalette` 添加 `data-testid="aigc-node-palette"`。为 `Inspector` 增加 `onClose`，宽度改为 `w-80`，头部在标签右侧提供图标关闭按钮：

```tsx
<Button
  aria-label="关闭详情栏"
  onClick={onClose}
  size="icon"
  title="关闭详情栏"
  type="button"
  variant="ghost"
>
  <PanelRightClose className="h-4 w-4" />
</Button>
```

桌面 Inspector 继续使用 Task 1 的条件渲染，并传入 `onClose={() => setOpenPanel(null)}`。

- [ ] **Step 5: 保护长标题和命令区**

顶部标题容器保留 `min-w-0 flex-1`，命令容器保持 `shrink-0`。自动保存 Badge 使用受限宽度与 `title`：

```tsx
className="max-w-40 shrink truncate normal-case tracking-normal lg:max-w-64"
```

不得隐藏图标命令。“另存为模板”和“执行”的文字标签固定使用 `hidden xl:inline`，只在不小于 `1280px` 时显示；`640px` 至 `1279px` 保持单行图标命令，低于 `640px` 使用现有两行结构。

- [ ] **Step 6: 运行定向测试并提交**

Run:

```bash
cd frontend && npm test -- tests/aigc-editor.test.tsx
```

Expected: PASS。

```bash
git add frontend/components/workspace/aigc/aigc-editor.tsx frontend/tests/aigc-editor.test.tsx
git commit -m "feat(aigc): restructure professional canvas shell"
```

### Task 3: 将共享画布 Controls 变为可配置工具坞

**Files:**
- Modify: `frontend/components/workspace/canvas/node-canvas.tsx:1-68`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx:804-834`
- Modify: `frontend/tests/aigc-editor.test.tsx:61-123`
- Test: `frontend/tests/node-canvas.test.tsx`

- [ ] **Step 1: 写 NodeCanvas 默认兼容测试**

创建 `frontend/tests/node-canvas.test.tsx`，mock React Flow 组件并验证不传参数时 Controls 仍使用库默认位置，传入参数时原样透传：

```tsx
render(<NodeCanvas nodes={[]} />);
expect(screen.getByTestId("controls")).not.toHaveAttribute("data-position");

render(
  <NodeCanvas
    controlsProps={{ position: "bottom-center", showInteractive: true }}
    nodes={[]}
  />
);
expect(screen.getAllByTestId("controls")[1]).toHaveAttribute(
  "data-position",
  "bottom-center"
);
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cd frontend && npm test -- tests/node-canvas.test.tsx
```

Expected: FAIL，`NodeCanvasProps` 尚不接受 `controlsProps`。

- [ ] **Step 3: 增加可选 Controls 参数**

在 `node-canvas.tsx` 引入 `ComponentProps`，扩展公共接口：

```tsx
import type { ComponentProps, ReactNode } from "react";

export interface NodeCanvasProps<NodeType extends Node = Node> {
  controlsProps?: ComponentProps<typeof Controls>;
  nodes: NodeType[];
  edges?: Edge[];
  nodeTypes?: NodeTypes;
  onNodesChange?: OnNodesChange<NodeType>;
  onNodeDragStop?: OnNodeDrag<NodeType>;
  reactFlowProps?: Omit<
    ReactFlowProps<NodeType>,
    "edges" | "nodeTypes" | "nodes" | "onNodeDragStop" | "onNodesChange"
  >;
  children?: ReactNode;
}
```

解构参数并透传：

```tsx
<Controls {...controlsProps} />
```

未传 `controlsProps` 时不得添加位置、样式或可见性默认值，以免影响图片画布。

- [ ] **Step 4: 为 AIGC 画布传入底部居中配置**

在 AIGC 的 `NodeCanvas` 调用中增加：

```tsx
controlsProps={{
  className:
    "!bottom-3 !left-1/2 !right-auto !top-auto !-translate-x-1/2 overflow-hidden rounded-md border border-border bg-card shadow-lg",
  orientation: "horizontal",
  position: "bottom-center",
  showInteractive: true
}}
```

扩展现有 `NodeCanvas` mock，将 `controlsProps.position`、`controlsProps.orientation` 和 `controlsProps.className` 输出为 data attribute，并断言位置为 `bottom-center`、方向为 `horizontal`，样式包含稳定的底部定位和边框背景。

- [ ] **Step 5: 运行共享与 AIGC 测试并提交**

Run:

```bash
cd frontend && npm test -- tests/node-canvas.test.tsx tests/aigc-editor.test.tsx
```

Expected: PASS。

```bash
git add frontend/components/workspace/canvas/node-canvas.tsx frontend/components/workspace/aigc/aigc-editor.tsx frontend/tests/node-canvas.test.tsx frontend/tests/aigc-editor.test.tsx
git commit -m "feat(canvas): support bottom-centered flow controls"
```

### Task 4: 完成窄屏互斥浮层

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx:760-893`
- Test: `frontend/tests/aigc-editor.test.tsx`

- [ ] **Step 1: 写 390px 面板互斥测试**

将 `window.matchMedia` 设为不匹配 `(min-width: 1024px)`，在 `390px` 和 `768px` 分别验证节点库和详情栏不会同时存在：

```tsx
fireEvent.click(screen.getByRole("button", { name: "打开节点面板" }));
expect(screen.getByTestId("aigc-node-palette")).toBeInTheDocument();

fireEvent.click(screen.getByRole("button", { name: "打开检查器" }));
expect(screen.queryByTestId("aigc-node-palette")).toBeNull();
expect(screen.getByTestId("aigc-inspector")).toHaveClass(
  "w-[min(320px,100vw)]"
);
```

再打开节点库并点击一个节点，断言节点数增加且节点库关闭。测试用可派发 `change` 事件的 `MediaQueryList` mock 将窗口从 `1023px` 切换到 `1024px`：`"nodes"` 状态必须清除，`"inspector"` 状态及当前标签必须保留。

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cd frontend && npm test -- tests/aigc-editor.test.tsx
```

Expected: FAIL，现有窄屏状态尚未与新的统一面板规则对齐。

- [ ] **Step 3: 实现互斥覆盖面板**

窄屏浮动入口分别执行：

```tsx
setOpenPanel((current) => (current === "nodes" ? null : "nodes"));
openInspector("config");
```

节点库使用：

```tsx
className="absolute inset-y-0 left-0 z-20 w-60 shadow-xl"
```

详情栏使用：

```tsx
className="absolute inset-y-0 right-0 z-20 w-[min(320px,100vw)] shadow-xl"
```

添加节点后调用 `setOpenPanel(null)`。选择节点时 `selectNodeAndInspect` 会把 `"nodes"` 原子替换为 `"inspector"`，保证互斥。

- [ ] **Step 4: 实现断点状态迁移**

在 `isDesktop` 变为 `true` 时只清理窄屏专属节点浮层：

```tsx
useEffect(() => {
  if (isDesktop) {
    setOpenPanel((current) => (current === "nodes" ? null : current));
  }
}, [isDesktop]);
```

`"inspector"` 在断点两侧保持不变：桌面渲染为停靠栏，窄屏渲染为右侧覆盖层。桌面无独立 `"nodes"` 状态，因为节点库始终常驻。

- [ ] **Step 5: 保持窄屏视口和顶部命令可达**

保留现有非桌面 React Flow 参数：

```tsx
fitViewOptions: { minZoom: 0.25 },
minZoom: 0.25
```

更新 390px 测试，使其覆盖详情和运行入口，并继续断言返回、撤销、重做、另存模板和执行按钮存在。增加 768px 测试，断言顶部保持单行，紧凑命令文字使用 `hidden xl:inline`，所有按钮仍可通过可访问名称定位。

- [ ] **Step 6: 运行定向测试并提交**

Run:

```bash
cd frontend && npm test -- tests/aigc-editor.test.tsx
```

Expected: PASS。

```bash
git add frontend/components/workspace/aigc/aigc-editor.tsx frontend/tests/aigc-editor.test.tsx
git commit -m "feat(aigc): add responsive overlay panels"
```

### Task 5: 验证自动保存和运行契约无回归

**Files:**
- Modify: `frontend/tests/aigc-editor.test.tsx`

- [ ] **Step 1: 增加纯 UI 状态不保存测试**

使用 fake timers 分别渲染 Pipeline 和模板，打开、切换和关闭详情栏，并在 Pipeline 中选择节点、切换 Run 与切换交互锁定：

```tsx
fireEvent.click(screen.getByRole("button", { name: "详情" }));
fireEvent.click(screen.getByRole("tab", { name: "结果" }));
fireEvent.click(screen.getByRole("button", { name: "关闭详情栏" }));
await vi.advanceTimersByTimeAsync(1_000);

expect(apiMocks.updateAigcPipeline).not.toHaveBeenCalled();
expect(apiMocks.updateAigcTemplate).not.toHaveBeenCalled();
```

- [ ] **Step 2: 增加执行后自动打开运行栏测试**

让 `createAigcRun` 返回新的 Run，分别点击顶部“执行”和节点“从此节点运行”，断言：

```tsx
expect(screen.getByTestId("aigc-inspector")).toBeInTheDocument();
expect(screen.getByRole("tab", { name: "运行" })).toHaveAttribute(
  "aria-selected",
  "true"
);
expect(screen.getByLabelText("运行历史")).toHaveValue("new-run-id");
```

实现时将 `execute()` 成功分支中的 `setInspectorTab("run")` 改为 `openInspector("run")`，继续保留 `setSelectedRunId(detail.run.id)`。

- [ ] **Step 3: 运行自动保存与命令前 flush 回归**

Run:

```bash
cd frontend && npm test -- tests/aigc-editor.test.tsx -t "autosave|flush|returns|execute|template|layer"
```

Expected: PASS，面板状态不会进入 autosave，返回、执行、另存模板和图层编辑器仍等待最新 revision。

- [ ] **Step 4: 运行全部编辑器测试**

Run:

```bash
cd frontend && npm test -- tests/aigc-editor.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 提交回归测试**

```bash
git add frontend/tests/aigc-editor.test.tsx
git commit -m "test(aigc): protect workbench state contracts"
```

### Task 6: 完成工程检查与浏览器验收

**Files:**
- Create: `frontend/scripts/verify-aigc-workbench-layout.mjs`
- Modify: `frontend/scripts/create-aigc-acceptance-fixture.mjs`
- Modify: `frontend/package.json`
- Modify after evidence: `.trae/specs/upgrade-aigc-canvas-professional-workbench/checklist.md`

- [ ] **Step 1: 运行完整前端测试**

Run:

```bash
cd frontend && npm test
```

Expected: 所有 Vitest 测试通过。

- [ ] **Step 2: 运行类型、Lint 和生产构建**

Run:

```bash
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run build
```

Expected: 三条命令退出码均为 0，ESLint 无 warning。

- [ ] **Step 3: 建立可重复的浏览器验收脚本**

扩展 `create-aigc-acceptance-fixture.mjs`，除 Pipeline 外向 `/api/aigc/templates` POST `{ name, description, definition }` 创建使用同一 definition 的模板，并在 `--json` 模式输出：

```json
{
  "pipelineUrl": "http://127.0.0.1:3000/workspace/aigc/acceptance?pipelineId=<id>",
  "templateUrl": "http://127.0.0.1:3000/workspace/aigc/templates/<id>"
}
```

新增 `verify-aigc-workbench-layout.mjs`。脚本读取 `AIGC_WORKBENCH_FIXTURE` JSON，监听 `pageerror` 和 console error，在 `1440x900`、`1024x768`、`390x844` 依次断言：

```js
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "threshold", width: 1024, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 }
];

assert(consoleErrors.length === 0, "浏览器控制台无 error");
await page.screenshot({
  fullPage: true,
  path: `${artifactsPath}/${viewport.name}.png`
});
```

Pipeline 页面验证默认收起、节点选择、详情关闭、运行入口、窄屏互斥和底部工具坞；模板页面验证不显示运行记录、另存模板和执行，并验证结果/运行空状态。截图固定写入 `PLAYWRIGHT_ARTIFACTS_PATH`，默认 `/tmp/ad-creativity-aigc-workbench-acceptance`。

在 `frontend/package.json` 增加：

```json
"acceptance:aigc-workbench": "node scripts/verify-aigc-workbench-layout.mjs"
```

- [ ] **Step 4: 启动本地服务**

在项目根目录的第一个终端运行：

```bash
.venv/bin/python -m uvicorn backend.app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --env-file .env
```

在第二个终端运行：

```bash
cd frontend && npm run dev
```

Expected: 后端 `http://127.0.0.1:8000/health` 返回 `status: ok`，前端可通过 `http://localhost:3000` 访问。若端口已被本项目服务占用，复用该实例。

若默认端口被其他服务占用，后端改用：

```bash
.venv/bin/python -m uvicorn backend.app.main:app \
  --host 0.0.0.0 \
  --port 8001 \
  --env-file .env
```

前端改用：

```bash
cd frontend
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8001 npm run dev -- --port 3001
```

- [ ] **Step 5: 执行 Playwright 验收**

在项目根目录生成固定 fixture：

```bash
cd frontend
AIGC_WORKBENCH_FIXTURE="$(node scripts/create-aigc-acceptance-fixture.mjs --json)" \
  npm run acceptance:aigc-workbench
```

备用端口对应命令为：

```bash
cd frontend
AIGC_WORKBENCH_FIXTURE="$(
  BACKEND_BASE_URL=http://127.0.0.1:8001 \
  FRONTEND_BASE_URL=http://127.0.0.1:3001 \
  node scripts/create-aigc-acceptance-fixture.mjs --json
)" \
FRONTEND_BASE_URL=http://127.0.0.1:3001 \
npm run acceptance:aigc-workbench
```

Expected: 输出 `result: PASS`，生成 `desktop.png`、`threshold.png`、`tablet.png` 和 `mobile.png`，所有布局、交互和控制台断言通过。

- [ ] **Step 6: 更新验收清单并提交**

只勾选已有自动化或浏览器证据支持的项目：

```bash
git add frontend/scripts/create-aigc-acceptance-fixture.mjs frontend/scripts/verify-aigc-workbench-layout.mjs frontend/package.json .trae/specs/upgrade-aigc-canvas-professional-workbench/checklist.md
git commit -m "test(aigc): verify professional canvas workbench"
```
