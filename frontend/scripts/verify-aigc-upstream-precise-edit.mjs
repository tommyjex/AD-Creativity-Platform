import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseUrl = process.env.FRONTEND_BASE_URL ?? "http://127.0.0.1:3000";
const url = `${baseUrl}/workspace/aigc/acceptance?scenario=upstream-precise-edit`;
const artifactsPath = "test-results/upstream-precise-edit";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1023, height: 768 },
  { name: "mobile", width: 390, height: 844 }
];

await mkdir(artifactsPath, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    await page.route("**/favicon.ico", (route) =>
      route.fulfill({ body: "", status: 204 })
    );
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(url, { waitUntil: "domcontentloaded" });
    const trigger = page.getByRole("button", {
      name: "精准编辑：上游商品图.png"
    });
    await trigger.waitFor({ state: "visible" });
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    const image = page.getByAltText("精准编辑：上游商品图.png");
    await image.waitFor({ state: "visible" });
    await image.evaluate(
      (element) =>
        element.complete && element.naturalWidth > 0
          ? undefined
          : new Promise((resolve, reject) => {
              element.addEventListener("load", () => resolve(), { once: true });
              element.addEventListener(
                "error",
                () => reject(new Error("acceptance image failed to load")),
                { once: true }
              );
            })
    );

    const layout = await page.evaluate(() => {
      const dialogElement = document.querySelector('[role="dialog"]');
      const imageElement = document.querySelector(
        'img[alt="精准编辑：上游商品图.png"]'
      );
      const resetButton = [...document.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "重置"
      );
      const footerText = [...document.querySelectorAll("p")].find((element) =>
        element.textContent?.includes("坐标由框选生成")
      );
      const confirmButton = [...document.querySelectorAll("button")].find(
        (button) => button.textContent?.includes("引用到")
      );
      if (
        !dialogElement ||
        !imageElement ||
        !resetButton ||
        !footerText ||
        !confirmButton
      ) {
        throw new Error("精准编辑弹窗缺少必要元素");
      }
      const dialogBox = dialogElement.getBoundingClientRect();
      const imageBox = imageElement.getBoundingClientRect();
      const resetBox = resetButton.getBoundingClientRect();
      const footerTextBox = footerText.getBoundingClientRect();
      const confirmBox = confirmButton.getBoundingClientRect();
      return {
        bodyOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
        dialogInsideViewport:
          dialogBox.left >= 0 &&
          dialogBox.right <= window.innerWidth &&
          dialogBox.top >= 0 &&
          dialogBox.bottom <= window.innerHeight,
        imageVisible: imageBox.width > 0 && imageBox.height > 0,
        footerNoOverlap:
          footerTextBox.bottom <= confirmBox.top ||
          footerTextBox.right <= confirmBox.left,
        resetReachable:
          resetBox.left >= 0 &&
          resetBox.right <= window.innerWidth &&
          resetBox.top >= 0 &&
          resetBox.bottom <= window.innerHeight
      };
    });

    assert(!layout.bodyOverflow, `${viewport.name}: 页面无横向溢出`);
    assert(
      layout.dialogInsideViewport,
      `${viewport.name}: 弹窗位于视口内`
    );
    assert(layout.imageVisible, `${viewport.name}: 上游图片可见`);
    assert(layout.footerNoOverlap, `${viewport.name}: 底栏文本与按钮不重叠`);
    assert(layout.resetReachable, `${viewport.name}: 框选操作可达`);
    assert(consoleErrors.length === 0, `${viewport.name}: 控制台无错误`, {
      consoleErrors
    });
    assert(pageErrors.length === 0, `${viewport.name}: 页面无运行时错误`, {
      pageErrors
    });

    await page.screenshot({
      fullPage: true,
      path: `${artifactsPath}/${viewport.name}.png`
    });
    results.push({ ...viewport, ...layout });
    await context.close();
  }

  console.log(JSON.stringify({ results, url }, null, 2));
} finally {
  await browser.close();
}

function assert(condition, message, details) {
  if (condition) return;
  throw new Error(
    details ? `${message}: ${JSON.stringify(details)}` : message
  );
}
