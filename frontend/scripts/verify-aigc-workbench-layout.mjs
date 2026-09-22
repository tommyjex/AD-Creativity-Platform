import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const fixture = parseFixture(process.env.AIGC_WORKBENCH_FIXTURE);
const artifactsPath =
  process.env.PLAYWRIGHT_ARTIFACTS_PATH ||
  "/tmp/ad-creativity-aigc-workbench-acceptance";
const headed = process.argv.includes("--headed");
const viewports = [
  { height: 900, name: "desktop", width: 1440 },
  { height: 768, name: "threshold", width: 1024 },
  { height: 1024, name: "tablet", width: 768 },
  { height: 844, name: "mobile", width: 390 }
];
let browser;
let summary;

try {
  await mkdir(artifactsPath, { recursive: true });
  browser = await chromium.launch({
    args: ["--disable-breakpad", "--disable-crash-reporter"],
    headless: !headed
  });

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { height: viewport.height, width: viewport.width }
    });
    const page = await context.newPage();
    const browserErrors = [];
    await page.route("http://127.0.0.1:7778/**", (route) =>
      route.fulfill({ status: 204 })
    );
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("requestfailed", (request) => {
      if (isDebugTelemetryRequest(request.url())) return;
      browserErrors.push(
        `${request.url()}: ${request.failure()?.errorText ?? "request failed"}`
      );
    });

    await page.goto(fixture.pipelineUrl, { waitUntil: "domcontentloaded" });
    await page.getByTestId("aigc-editor-header").waitFor();
    await page.locator(".react-flow__node").first().waitFor();
    await verifyImmersiveToolbar(page, viewport, "pipeline");
    const nodeCardStyles = await page
      .locator(".react-flow__node")
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const card = node.firstElementChild;
          const style = getComputedStyle(card);
          return {
            borderColor: style.borderColor,
            hasNeutralBorderClass: card.classList.contains("border-border"),
            inlineBorderColor: card.style.borderColor
          };
        })
      );
    assert(
      nodeCardStyles.length > 0 &&
        nodeCardStyles.every(
          (style) =>
            style.hasNeutralBorderClass && style.inlineBorderColor === ""
        ) &&
        new Set(nodeCardStyles.map((style) => style.borderColor)).size === 1,
      `${viewport.name}: 所有节点使用统一中性外边框`,
      nodeCardStyles
    );
    const initialNodeShadow = await page
      .locator(".react-flow__node")
      .first()
      .evaluate((node) =>
        getComputedStyle(node.firstElementChild).boxShadow
      );
    const titleRowStyle = await page
      .getByTestId("aigc-node-title-row")
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          borderBottomWidth: style.borderBottomWidth,
          height: style.height
        };
      });
    assert(
      titleRowStyle.height === "28px" &&
        titleRowStyle.backgroundColor === "rgba(0, 0, 0, 0)" &&
        titleRowStyle.borderBottomWidth === "0px",
      `${viewport.name}: 节点使用无底色紧凑标题行`,
      titleRowStyle
    );
    const titleStyle = await page
      .getByTestId("aigc-node-title")
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          fontSize: style.fontSize,
          fontWeight: style.fontWeight
        };
      });
    assert(
      titleStyle.fontSize === "11px" && titleStyle.fontWeight === "500",
      `${viewport.name}: 节点标题使用小号中等字重`,
      titleStyle
    );
    assert(
      (await page.getByRole("button", { name: /删除节点/ }).count()) === 0,
      `${viewport.name}: 节点不显示删除按钮`
    );
    assert(
      (await page
        .locator(".react-flow__node")
        .first()
        .getByText("acceptance-prompt", { exact: true })
        .count()) === 0,
      `${viewport.name}: 节点底栏已移除`
    );

    const desktop = viewport.width >= 1024;
    const palette = page.getByTestId("aigc-node-palette");
    assert(
      (await palette.count()) === 0,
      `${viewport.name}: 节点库默认隐藏`
    );
    assert(
      await page
        .getByRole("button", {
          name: desktop ? "打开节点库" : "打开节点面板"
        })
        .isVisible(),
      `${viewport.name}: 节点库入口可见`
    );
    assert(
      (await page.getByTestId("aigc-inspector").count()) === 0,
      `${viewport.name}: 详情栏默认收起`
    );

    const controls = page.getByTestId("rf__controls");
    await controls.waitFor();
    const canvasBackground = await page
      .getByTestId("node-canvas-root")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    assert(
      canvasBackground === "rgb(16, 19, 24)",
      `${viewport.name}: 画布使用层级黑灰近黑背景`,
      canvasBackground
    );
    assert(
      await controls.evaluate((element) =>
        element.classList.contains("horizontal")
      ),
      `${viewport.name}: 工具坞横向排列`
    );
    const [controlsBox, flowBox] = await Promise.all([
      controls.boundingBox(),
      page.locator(".react-flow").boundingBox()
    ]);
    assert(
      controlsBox !== null &&
        flowBox !== null &&
        Math.abs(
          controlsBox.x +
            controlsBox.width / 2 -
            (flowBox.x + flowBox.width / 2)
        ) <= 4,
      `${viewport.name}: 工具坞底部居中`,
      { controlsBox, flowBox }
    );

    if (desktop) {
      await page.screenshot({
        fullPage: true,
        path: `${artifactsPath}/${viewport.name}-palette-hidden.png`
      });
      await page.getByRole("button", { name: "打开节点库" }).click();
      const paletteBox = await palette.boundingBox();
      assert(
        paletteBox !== null && Math.abs(paletteBox.width - 184) <= 1,
        `${viewport.name}: 桌面节点库宽度为 184px`,
        paletteBox
      );
      assert(
        (await page
          .getByRole("button", { name: "隐藏节点库" })
          .getAttribute("aria-expanded")) === "true",
        `${viewport.name}: 桌面隐藏按钮表达展开状态`
      );
      await page.screenshot({
        fullPage: true,
        path: `${artifactsPath}/${viewport.name}-palette-visible.png`
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId("aigc-editor-header").waitFor();
      await palette.waitFor();
      assert(
        await palette.isVisible(),
        `${viewport.name}: 刷新后恢复显示偏好`
      );
      await page.getByRole("button", { name: "隐藏节点库" }).click();
      assert(
        (await palette.count()) === 0,
        `${viewport.name}: 桌面节点库可隐藏`
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId("aigc-editor-header").waitFor();
      await page.locator(".react-flow__node").first().waitFor();
      assert(
        (await palette.count()) === 0,
        `${viewport.name}: 刷新后恢复隐藏偏好`
      );

      await page.getByRole("button", { name: "打开节点库" }).click();
      await page.setViewportSize({ height: viewport.height, width: 1023 });
      await page
        .getByRole("button", { name: "打开节点面板" })
        .waitFor();
      assert(
        (await palette.count()) === 0 &&
          (await page
            .getByRole("button", { name: "打开节点面板" })
            .isVisible()),
        `${viewport.name}: 进入窄屏不自动打开覆盖面板`
      );
      await page.setViewportSize({
        height: viewport.height,
        width: viewport.width
      });
      await palette.waitFor();
      assert(
        await palette.isVisible(),
        `${viewport.name}: 返回桌面恢复显示偏好`
      );
      await page.locator(".react-flow__node").first().click();
      const selectedNodeShadow = await page
        .locator(".react-flow__node")
        .first()
        .evaluate((node) =>
          getComputedStyle(node.firstElementChild).boxShadow
        );
      assert(
        selectedNodeShadow !== initialNodeShadow,
        `${viewport.name}: 选中节点保留可见光环`,
        { initialNodeShadow, selectedNodeShadow }
      );
    } else {
      await page.getByRole("button", { name: "打开节点面板" }).click();
      assert(await palette.isVisible(), `${viewport.name}: 节点浮层可打开`);
      const paletteBox = await palette.boundingBox();
      assert(
        paletteBox !== null && Math.abs(paletteBox.width - 240) <= 1,
        `${viewport.name}: 窄屏节点浮层宽度为 240px`,
        paletteBox
      );
      await page.screenshot({
        fullPage: true,
        path: `${artifactsPath}/${viewport.name}-node-overlay.png`
      });
      await page.getByRole("button", { name: "打开检查器" }).click();
      assert(
        (await palette.count()) === 0,
        `${viewport.name}: 节点库与详情栏互斥`
      );
    }

    const inspector = page.getByTestId("aigc-inspector");
    await inspector.waitFor();
    const inspectorBox = await inspector.boundingBox();
    assert(
      inspectorBox !== null && inspectorBox.width <= 320,
      `${viewport.name}: 详情栏不超过 320px`,
      inspectorBox
    );
    assert(
      await page
        .getByRole("tab", { name: "配置" })
        .getAttribute("aria-selected") === "true",
      `${viewport.name}: 节点或详情入口打开配置`
    );

    await page.getByRole("button", { name: "关闭详情栏" }).click();
    assert(
      (await inspector.count()) === 0,
      `${viewport.name}: 详情栏可显式关闭`
    );
    await page.getByRole("button", { name: "详情" }).click();
    await page.getByRole("tab", { name: "运行" }).click();
    assert(
      await page
        .getByRole("tab", { name: "运行" })
        .getAttribute("aria-selected") === "true",
      `${viewport.name}: 详情栏可切换运行标签`
    );
    await clickCanvasPane(page);
    assert(
      (await inspector.count()) === 0,
      `${viewport.name}: 点击画布空白关闭详情栏`
    );

    assert(
      (await page.getByRole("button", { name: "撤销" }).count()) === 0 &&
        (await page.getByRole("button", { name: "重做" }).count()) === 0 &&
        (await page.getByRole("button", { name: "运行记录" }).count()) === 0,
      `${viewport.name}: 顶部栏仅保留核心命令`
    );

    await page.screenshot({
      fullPage: true,
      path: `${artifactsPath}/${viewport.name}.png`
    });
    assert(
      browserErrors.length === 0,
      `${viewport.name}: 浏览器控制台无错误`,
      browserErrors
    );
    await context.close();
  }

  await verifyTemplate(browser);
  summary = {
    artifactsPath,
    result: "PASS",
    viewports,
    ...fixture
  };
} finally {
  await browser?.close();
}

console.log(JSON.stringify(summary, null, 2));

async function verifyTemplate(browserInstance) {
  const context = await browserInstance.newContext({
    viewport: { height: 900, width: 1440 }
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("aigc.node-palette.visible.v1", "true");
  });
  const page = await context.newPage();
  const browserErrors = [];
  await page.route("http://127.0.0.1:7778/**", (route) =>
    route.fulfill({ status: 204 })
  );
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (isDebugTelemetryRequest(request.url())) return;
    browserErrors.push(
      `${request.url()}: ${request.failure()?.errorText ?? "request failed"}`
    );
  });

  await page.goto(fixture.templateUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("aigc-editor-header").waitFor();
  await page.getByTestId("aigc-node-palette").waitFor();
  await verifyImmersiveToolbar(
    page,
    { height: 900, name: "template", width: 1440 },
    "template"
  );
  assert(
    await page.getByTestId("aigc-node-palette").isVisible(),
    "template: 恢复共享的桌面节点库偏好"
  );
  assert(
    (await page.getByRole("button", { name: "运行记录" }).count()) === 0,
    "template: 不展示运行记录"
  );
  assert(
    (await page.getByRole("button", { name: "另存为模板" }).count()) === 0,
    "template: 不展示另存为模板"
  );
  assert(
    (await page.getByRole("button", { name: "执行" }).count()) === 0,
    "template: 不展示执行"
  );

  await page.getByRole("button", { name: "详情" }).click();
  await page.getByRole("tab", { name: "结果" }).click();
  assert(
    await page.getByRole("heading", { name: "暂无结果" }).isVisible(),
    "template: 结果标签显示空状态"
  );
  await page.getByRole("tab", { name: "运行" }).click();
  assert(
    await page
      .getByText("模板不可执行，请先创建画布实例。")
      .isVisible(),
    "template: 运行标签显示不可执行状态"
  );
  assert(browserErrors.length === 0, "template: 浏览器控制台无错误", browserErrors);
  await context.close();
}

async function verifyImmersiveToolbar(page, viewport, mode) {
  const prefix = `${viewport.name} ${mode}`;
  const shell = page.getByTestId("aigc-editor-shell");
  const header = page.getByTestId("aigc-editor-header");
  const identity = page.getByTestId("aigc-editor-title-row");
  const autosave = page.getByTestId("aigc-autosave-status");
  const actions = page.getByTestId("aigc-editor-actions");
  const [shellBox, headerBox, identityBox, actionsBox, metrics] =
    await Promise.all([
      shell.boundingBox(),
      header.boundingBox(),
      identity.boundingBox(),
      actions.boundingBox(),
      page.evaluate(() => ({
        bodyScrollHeight: document.body.scrollHeight,
        bodyScrollWidth: document.body.scrollWidth,
        clientHeight: document.documentElement.clientHeight,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth
      }))
    ]);

  assert(
    (await page.getByRole("banner").count()) === 0 &&
      (await page.getByText("AD CREATIVITY", { exact: true }).count()) === 0 &&
      (await page.getByRole("button", { name: "打开导航菜单" }).count()) === 0,
    `${prefix}: 不渲染全局导航、品牌或移动菜单`
  );
  assert(
    shellBox !== null &&
      Math.abs(shellBox.y) <= 1 &&
      Math.abs(shellBox.height - metrics.viewportHeight) <= 1,
    `${prefix}: 编辑器从视口顶部占满 100dvh`,
    { metrics, shellBox }
  );
  assert(
    metrics.scrollWidth <= metrics.clientWidth &&
      metrics.bodyScrollWidth <= metrics.viewportWidth &&
      metrics.scrollHeight <= metrics.clientHeight &&
      metrics.bodyScrollHeight <= metrics.viewportHeight,
    `${prefix}: 页面无横向或纵向溢出`,
    metrics
  );
  assert(
    headerBox !== null &&
      Math.abs(headerBox.height - 56) <= 1 &&
      Math.abs(headerBox.y) <= 1 &&
      headerBox.width <= viewport.width + 1,
    `${prefix}: 工具栏是顶部唯一且高度稳定的命令栏`,
    headerBox
  );
  assert(
    boxesAreOrdered(identityBox, actionsBox) &&
      actionsBox.x + actionsBox.width <= viewport.width + 1,
    `${prefix}: 身份与命令区依次排列且互不覆盖`,
    { actionsBox, identityBox }
  );

  const title = page.getByTestId("aigc-editor-title");
  const titleText = (await title.textContent())?.trim() ?? "";
  assert(
    titleText.length > 0 &&
      (await title.getAttribute("title")) === titleText &&
      (await title.evaluate((element) =>
        getComputedStyle(element).whiteSpace
      )) === "nowrap",
    `${prefix}: 画布名称单行截断且完整名称可访问`,
    { title: titleText }
  );
  const modeBadge = page.getByTestId("aigc-editor-mode");
  assert(
    (await modeBadge.textContent())?.trim() ===
      (mode === "pipeline" ? "画布" : "模板") &&
      ((viewport.width >= 768 && (await modeBadge.isVisible())) ||
        (viewport.width < 768 && !(await modeBadge.isVisible()))),
    `${prefix}: 模式身份按响应式优先级展示`
  );
  const starMap = page.getByTestId("aigc-toolbar-star-map");
  const starModalities = ["text", "image", "video", "audio"];
  const starPoints = await starMap
    .getByTestId("aigc-toolbar-star-point")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        color: element.style.backgroundColor,
        modality: element.dataset.modality
      }))
    );
  const expectedStarPoints = Array.from({ length: 12 }, (_, index) => {
    const modality = starModalities[index % starModalities.length];
    return {
      color: `var(--aigc-modality-${modality})`,
      modality
    };
  });
  const starMapBox = await starMap.boundingBox();
  assert(
    viewport.width < 1280 ||
      (starMapBox !== null &&
        headerBox !== null &&
        Math.abs(headerBox.width - starMapBox.width) <= 20),
    `${prefix}: 宽屏星链横向延伸至工具栏两侧`,
    { headerBox, starMapBox }
  );
  assert(
    (viewport.width >= 1280 && (await starMap.isVisible())) ||
      (viewport.width < 1280 && !(await starMap.isVisible())),
    `${prefix}: 全宽四色星链仅在宽屏显示`
  );
  assert(
    (await starMap.getAttribute("aria-hidden")) === "true" &&
      (await starMap.getByTestId("aigc-toolbar-star-line").count()) === 11 &&
      JSON.stringify(starPoints) === JSON.stringify(expectedStarPoints),
    `${prefix}: 星链使用 12 个文本、图片、视频、音频循环坐标点`,
    { starPoints }
  );
  assert(
    (await autosave.getAttribute("aria-live")) === "polite" &&
      (await autosave.getAttribute("aria-label"))?.startsWith(
        "自动保存状态："
      ) &&
      ((await autosave.getAttribute("class")) ?? "").split(/\s+/).includes(
        "sr-only"
      ) &&
      (await autosave.locator("svg").count()) === 0,
    `${prefix}: 自动保存状态仅保留隐藏的 aria-live 播报`
  );

  const returnCommand = page.getByRole("link", { name: "返回" });
  const detailCommand = page.getByRole("button", { name: "详情" });
  await assertMinimumTarget(returnCommand, 40, `${prefix}: 返回命令可达`);
  await assertMinimumTarget(detailCommand, 40, `${prefix}: 详情命令可达`);
  assert(
    (await detailCommand.getAttribute("title")) === "详情",
    `${prefix}: 详情图标命令保留 title`
  );

  const panelGroup = page.getByTestId("aigc-command-group-panel");
  assert(
    (await panelGroup.getAttribute("role")) === "group" &&
      (await panelGroup.getAttribute("aria-label")) === "面板命令",
    `${prefix}: 面板命令组语义明确`
  );
  if (mode === "pipeline") {
    const documentGroup = page.getByTestId("aigc-command-group-document");
    const executionGroup = page.getByTestId("aigc-command-group-execution");
    const groupBoxes = await Promise.all([
      panelGroup.boundingBox(),
      documentGroup.boundingBox(),
      executionGroup.boundingBox()
    ]);
    assert(
      boxesAreOrdered(...groupBoxes),
      `${prefix}: 面板、文档与执行命令按语义分组`,
      groupBoxes
    );
    const saveTemplate = page.getByRole("button", {
      name: "另存为模板"
    });
    const execute = page.getByRole("button", { name: "执行" });
    await assertMinimumTarget(
      saveTemplate,
      40,
      `${prefix}: 另存为模板命令可达`
    );
    await assertMinimumTarget(execute, 40, `${prefix}: 执行命令可达`);
    assert(
      (await saveTemplate.getAttribute("title")) === "另存为模板" &&
        (await execute.getAttribute("title")) === "执行",
      `${prefix}: Pipeline 图标命令保留完整提示`
    );
    const secondaryTextVisible = await page
      .getByTestId("aigc-command-save-template")
      .getByText("另存为模板", { exact: true })
      .isVisible();
    const executeTextVisible = await page
      .getByTestId("aigc-command-execute")
      .getByText("执行", { exact: true })
      .isVisible();
    assert(
      viewport.width >= 1024
        ? secondaryTextVisible && executeTextVisible
        : !secondaryTextVisible && !executeTextVisible,
      `${prefix}: 命令文字按 1024px 断点确定性收缩`,
      { executeTextVisible, secondaryTextVisible }
    );
  } else {
    assert(
      (await page.getByTestId("aigc-command-group-document").count()) === 0 &&
        (await page.getByTestId("aigc-command-group-execution").count()) ===
          0 &&
        (await page.getByRole("button", { name: "另存为模板" }).count()) ===
          0 &&
        (await page.getByRole("button", { name: "执行" }).count()) === 0,
      `${prefix}: 模板不展示文档或执行命令组`
    );
  }
}

function boxesAreOrdered(...boxes) {
  if (boxes.some((box) => box === null)) return false;
  return boxes.every(
    (box, index) =>
      index === 0 || boxes[index - 1].x + boxes[index - 1].width <= box.x + 1
  );
}

async function assertMinimumTarget(locator, minimum, label) {
  const box = await locator.boundingBox();
  assert(
    box !== null && box.width >= minimum && box.height >= minimum,
    label,
    box
  );
}

async function clickCanvasPane(page) {
  const point = await page.locator(".react-flow__pane").evaluate((pane) => {
    const bounds = pane.getBoundingClientRect();
    for (let y = bounds.top + 16; y < bounds.bottom - 16; y += 24) {
      for (let x = bounds.left + 16; x < bounds.right - 16; x += 24) {
        if (document.elementFromPoint(x, y) === pane) return { x, y };
      }
    }
    throw new Error("未找到可点击的画布空白区域");
  });
  await page.mouse.click(point.x, point.y);
}

function parseFixture(rawFixture) {
  if (!rawFixture) {
    throw new Error(
      "缺少 AIGC_WORKBENCH_FIXTURE，请先运行 create-aigc-acceptance-fixture.mjs --json。"
    );
  }
  const parsed = JSON.parse(rawFixture);
  if (!parsed.pipelineUrl || !parsed.templateUrl) {
    throw new Error("AIGC_WORKBENCH_FIXTURE 必须包含 pipelineUrl 和 templateUrl。");
  }
  const pipelineUrl = new URL(parsed.pipelineUrl);
  if (pipelineUrl.pathname === "/workspace/aigc/acceptance") {
    const pipelineId = pipelineUrl.searchParams.get("pipelineId");
    if (!pipelineId) {
      throw new Error("AIGC acceptance URL 缺少 pipelineId。");
    }
    pipelineUrl.pathname = `/workspace/aigc/pipelines/${pipelineId}`;
    pipelineUrl.search = "";
  }
  return { ...parsed, pipelineUrl: pipelineUrl.toString() };
}

function isDebugTelemetryRequest(rawUrl) {
  const url = new URL(rawUrl);
  return (
    url.hostname === "127.0.0.1" &&
    url.port === "7778" &&
    url.pathname === "/event"
  );
}

function assert(condition, label, detail = null) {
  if (!condition) {
    throw new Error(
      `ASSERT FAIL ${label}${detail === null ? "" : `: ${JSON.stringify(detail)}`
      }`
    );
  }
  console.log(`ASSERT PASS ${label}`);
}
