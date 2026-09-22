import { chromium } from "@playwright/test";

const fixture = JSON.parse(
  process.env.AIGC_NODE_ACTIONS_FIXTURE ||
    (() => {
      throw new Error("缺少 AIGC_NODE_ACTIONS_FIXTURE");
    })()
);
const backendBaseUrl = (
  process.env.BACKEND_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const viewports = [
  { width: 1440, height: 1000, name: "desktop-1440x1000" },
  { width: 1024, height: 768, name: "desktop-1024x768" },
  { width: 390, height: 844, name: "mobile-390x844" }
];
const browser = await chromium.launch({
  args: ["--disable-breakpad", "--disable-crash-reporter"],
  headless: !process.argv.includes("--headed")
});
const results = [];

try {
  for (const viewport of viewports) {
    results.push(await verifyViewport(browser, viewport));
  }
  console.log(
    JSON.stringify(
      {
        pipelineId: fixture.pipelineId,
        result: "PASS",
        viewports: results
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
  await fetch(`${backendBaseUrl}/api/aigc/pipelines/${fixture.pipelineId}`, {
    method: "DELETE"
  });
}

async function verifyViewport(browserInstance, viewport) {
  const context = await browserInstance.newContext({
    viewport: { width: viewport.width, height: viewport.height }
  });
  const page = await context.newPage();
  const unexpectedRunRequests = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/api\/aigc\/(?:pipelines\/[^/]+\/)?runs(?:\/|$)/.test(request.url())
    ) {
      unexpectedRunRequests.push(request.url());
    }
  });

  try {
    await page.goto(fixture.pipelineUrl, { waitUntil: "domcontentloaded" });
    await page.getByTestId("aigc-editor-header").waitFor();
    const sourceNode = page.locator(
      `.react-flow__node[data-id="${fixture.nodeIds.firstText}"]`
    );
    await sourceNode.waitFor();
    const customName = `分镜输入-${viewport.width}`;

    await sourceNode.click({ button: "right" });
    const nodeMenu = page.getByTestId("aigc-node-context-menu");
    await nodeMenu.waitFor();
    assertInsideViewport(
      await nodeMenu.boundingBox(),
      viewport,
      `${viewport.name}: 节点菜单`
    );
    await page.getByRole("menuitem", { name: "重命名" }).click();
    const inlineInput = sourceNode.getByRole("textbox", { name: "节点名称" });
    await inlineInput.fill(customName);
    const renameSave = waitForPipelineSave(page, fixture.pipelineId);
    await inlineInput.press("Enter");
    await renameSave;
    await sourceNode
      .getByTestId("aigc-node-title")
      .getByText(customName, { exact: true })
      .waitFor();

    await sourceNode.click();
    const inspectorName = page.getByRole("textbox", { name: "节点名称" });
    await inspectorName.waitFor();
    assert(
      (await inspectorName.inputValue()) === customName,
      `${viewport.name}: 配置栏名称与画布不同步`
    );
    const contentTitle = page.getByRole("textbox", { name: "内容标题" });
    assert(
      (await contentTitle.inputValue()) !== customName,
      `${viewport.name}: 节点名称不应覆盖内容标题`
    );
    const closeInspector = page.getByRole("button", { name: "关闭详情栏" });
    if (await closeInspector.isVisible()) await closeInspector.click();

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("aigc-editor-header").waitFor();
    const persistedNode = page.locator(
      `.react-flow__node[data-id="${fixture.nodeIds.firstText}"]`
    );
    await persistedNode
      .getByTestId("aigc-node-title")
      .getByText(customName, { exact: true })
      .waitFor();

    const panePoint = await findPanePoint(page);
    await dispatchPaneContextMenu(page, panePoint);
    const picker = page.getByTestId("aigc-canvas-node-picker");
    await picker.waitFor();
    assertInsideViewport(
      await picker.boundingBox(),
      viewport,
      `${viewport.name}: 添加节点面板`
    );
    assert(
      await picker.getByText("控制", { exact: true }).isVisible(),
      `${viewport.name}: 缺少控制分类`
    );
    await picker.getByRole("textbox", { name: "搜索节点" }).press("Escape");
    assert(
      !(await picker.isVisible()),
      `${viewport.name}: Escape 未关闭添加节点面板`
    );

    await dispatchPaneContextMenu(page, panePoint);
    const search = page.getByRole("textbox", { name: "搜索节点" });
    await search.fill("JSON 解析器");
    const addSave = waitForPipelineSave(page, fixture.pipelineId);
    await search.press("Enter");
    await addSave;
    const parserNode = page
      .locator(".react-flow__node")
      .filter({ hasText: "JSON 解析器" })
      .last();
    await parserNode.waitFor();
    const parserBox = await parserNode.boundingBox();
    assert(
      parserBox &&
        Math.abs(parserBox.x + parserBox.width / 2 - panePoint.x) <= 40 &&
        Math.abs(parserBox.y + parserBox.height / 2 - panePoint.y) <= 40,
      `${viewport.name}: 新节点未以右键位置为中心`
    );
    assert(
      unexpectedRunRequests.length === 0,
      `${viewport.name}: 验收期间触发了 Run POST`
    );

    return {
      contextMenusInsideViewport: true,
      createdAtPointer: true,
      customName,
      noRunRequests: true,
      persistedAfterReload: true,
      viewport: viewport.name
    };
  } finally {
    await context.close();
  }
}

async function findPanePoint(page) {
  return page.locator(".react-flow__pane").evaluate((pane) => {
    const bounds = pane.getBoundingClientRect();
    for (let row = 1; row <= 9; row += 1) {
      for (let column = 1; column <= 9; column += 1) {
        const x = bounds.left + (bounds.width * column) / 10;
        const y = bounds.top + (bounds.height * row) / 10;
        const target = document.elementFromPoint(x, y);
        if (
          target?.closest(".react-flow__pane") &&
          !target.closest(".react-flow__node") &&
          !target.closest(".react-flow__controls")
        ) {
          return {
            x,
            y,
            relativeX: x - bounds.left,
            relativeY: y - bounds.top
          };
        }
      }
    }
    throw new Error("未找到可右键的画布空白区域");
  });
}

async function dispatchPaneContextMenu(page, point) {
  await page.locator(".react-flow__pane").click({
    button: "right",
    force: true,
    position: { x: point.relativeX, y: point.relativeY }
  });
}

async function waitForPipelineSave(page, pipelineId) {
  const response = await page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().includes(`/api/aigc/pipelines/${pipelineId}`),
    { timeout: 60_000 }
  );
  if (!response.ok()) {
    throw new Error(
      `Pipeline 自动保存失败 (${response.status()}): ${await response.text()}`
    );
  }
  return response;
}

function assertInsideViewport(box, viewport, label) {
  assert(box, `${label}: 元素不可见`);
  assert(box.x >= 0 && box.y >= 0, `${label}: 左侧或顶部溢出`);
  assert(
    box.x + box.width <= viewport.width &&
      box.y + box.height <= viewport.height,
    `${label}: 右侧或底部溢出`
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
