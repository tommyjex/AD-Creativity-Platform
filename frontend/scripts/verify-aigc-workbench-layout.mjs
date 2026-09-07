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
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.goto(fixture.pipelineUrl, { waitUntil: "domcontentloaded" });
    await page.getByTestId("aigc-editor-header").waitFor();
    await page.locator(".react-flow__node").first().waitFor();
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
      desktop ? await palette.isVisible() : (await palette.count()) === 0,
      `${viewport.name}: 节点库默认形态正确`
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
      const paletteBox = await palette.boundingBox();
      assert(
        paletteBox !== null && Math.abs(paletteBox.width - 184) <= 1,
        `${viewport.name}: 桌面节点库宽度为 184px`,
        paletteBox
      );
      await page.locator(".react-flow__node").first().click();
    } else {
      await page.getByRole("button", { name: "打开节点面板" }).click();
      assert(await palette.isVisible(), `${viewport.name}: 节点浮层可打开`);
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

    const header = page.getByTestId("aigc-editor-header");
    const actions = page.getByTestId("aigc-editor-actions");
    const [headerBox, actionsBox] = await Promise.all([
      header.boundingBox(),
      actions.boundingBox()
    ]);
    assert(
      headerBox !== null &&
        actionsBox !== null &&
        actionsBox.x >= 0 &&
        actionsBox.x + actionsBox.width <= viewport.width + 1 &&
        headerBox.width <= viewport.width + 1,
      `${viewport.name}: 顶部命令未溢出视口`,
      { actionsBox, headerBox }
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
  console.log(
    JSON.stringify(
      {
        artifactsPath,
        result: "PASS",
        viewports,
        ...fixture
      },
      null,
      2
    )
  );
} finally {
  await browser?.close();
}

async function verifyTemplate(browserInstance) {
  const context = await browserInstance.newContext({
    viewport: { height: 900, width: 1440 }
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto(fixture.templateUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("aigc-editor-header").waitFor();
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
  return parsed;
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
