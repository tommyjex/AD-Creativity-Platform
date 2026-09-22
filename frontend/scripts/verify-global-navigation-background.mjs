import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3000";
const artifactsPath = fileURLToPath(
  new URL("../test-results/global-navigation-background/", import.meta.url)
);
const headed = process.argv.includes("--headed");
const viewports = [
  { name: "desktop-wide", width: 1920, height: 1080 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 }
];

await mkdir(artifactsPath, { recursive: true });
const browser = await chromium.launch({
  args: ["--disable-breakpad", "--disable-crash-reporter"],
  headless: !headed
});

try {
  const results = [];
  for (const viewport of viewports) {
    results.push(await verifyViewport(browser, viewport));
  }
  await verifyFallback(browser);

  console.log(
    JSON.stringify(
      {
        artifactsPath,
        result: "PASS",
        viewports: results
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}

async function verifyViewport(browserInstance, viewport) {
  const context = await browserInstance.newContext({
    viewport: { width: viewport.width, height: viewport.height }
  });
  const page = await context.newPage();
  const navigationAssetRequests = [];
  const generationRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("navigation-generative-constellation.webp")) {
      navigationAssetRequests.push(request.url());
    }
    if (request.url().includes("/api/ide/v1/text_to_image")) {
      generationRequests.push(request.url());
    }
  });

  try {
    await page.goto(`${baseUrl}/workspace/aigc?view=pipelines`, {
      waitUntil: "domcontentloaded"
    });

    const header = page.getByRole("banner");
    await expect(header).toBeVisible();
    await expect(header).toHaveCSS("height", "64px");
    await expect(page.getByText("BRIEF READY")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "进入工作台" })
    ).toHaveCount(0);

    const background = page.getByTestId(
      "app-shell-navigation-background"
    );
    await expect(background).toBeVisible();
    const [backgroundImage, headerColor] = await Promise.all([
      background.evaluate(
        (element) => getComputedStyle(element).backgroundImage
      ),
      header.evaluate(
        (element) => getComputedStyle(element).backgroundColor
      )
    ]);
    await expect.poll(() => navigationAssetRequests.length).toBe(1);
    assert.match(
      backgroundImage,
      /navigation-generative-constellation\.webp/
    );
    assert.equal(generationRequests.length, 0);
    assert.notEqual(headerColor, "rgb(255, 255, 255)");

    const brand = page.getByRole("link", {
      name: /AD CREATIVITY Campaign generation deck/
    });
    await expect(brand).toBeVisible();
    const desktopNavigation = page.getByRole("navigation", {
      name: "主导航"
    });
    const navigationLayout = page.getByTestId(
      "app-shell-navigation-layout"
    );

    if (viewport.width >= 768) {
      await expect(desktopNavigation).toBeVisible();
      await expect(
        desktopNavigation.getByRole("link", { name: "AIGC工作台" })
      ).toHaveAttribute("aria-current", "page");
      await expect(
        page.getByRole("button", { name: "打开导航菜单" })
      ).toBeHidden();

      const [brandBox, navigationBox] = await Promise.all([
        brand.boundingBox(),
        desktopNavigation.boundingBox()
      ]);
      assert(brandBox && navigationBox, `${viewport.name}: 导航布局不可测量`);
      assert(
        brandBox.x + brandBox.width <= navigationBox.x,
        `${viewport.name}: 品牌与桌面导航重叠`
      );
      assertInsideViewport(navigationBox, viewport, `${viewport.name}: 主导航`);

      if (viewport.name === "desktop-wide") {
        const layoutBox = await navigationLayout.boundingBox();
        assert(layoutBox, "desktop-wide: 导航容器不可测量");
        assert(
          Math.abs(layoutBox.width - 1600) <= 1,
          "desktop-wide: 导航容器宽度应为 1600px"
        );
      }
    } else {
      await expect(desktopNavigation).toBeHidden();
      const trigger = page.getByRole("button", { name: "打开导航菜单" });
      await expect(trigger).toBeVisible();
      await trigger.click();

      const menu = page.getByTestId("mobile-navigation-menu");
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("link")).toHaveCount(4);
      await expect(
        menu.getByRole("link", { name: "AIGC工作台" })
      ).toHaveAttribute("aria-current", "page");

      const menuBox = await menu.boundingBox();
      assert(menuBox, `${viewport.name}: 移动导航不可测量`);
      assertInsideViewport(menuBox, viewport, `${viewport.name}: 移动导航`);

      const linksFit = await menu.getByRole("link").evaluateAll((links) =>
        links.every(
          (link) =>
            link.scrollWidth <= link.clientWidth &&
            link.scrollHeight <= link.clientHeight
        )
      );
      assert(linksFit, `${viewport.name}: 移动导航文字溢出`);
    }

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    assert(!hasHorizontalOverflow, `${viewport.name}: 页面横向溢出`);

    await page.screenshot({
      fullPage: true,
      path: `${artifactsPath}/${viewport.name}.png`
    });

    return {
      backgroundImage,
      headerColor,
      name: viewport.name,
      size: `${viewport.width}x${viewport.height}`
    };
  } finally {
    await context.close();
  }
}

async function verifyFallback(browserInstance) {
  const context = await browserInstance.newContext({
    viewport: { width: 390, height: 844 }
  });
  await context.route(
    "**/images/navigation-generative-constellation.webp",
    (route) => route.abort()
  );
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/workspace/projects`, {
      waitUntil: "domcontentloaded"
    });
    const header = page.getByRole("banner");
    await expect(header).toHaveCSS("background-color", "rgb(20, 25, 31)");
    await expect(
      page.getByRole("button", { name: "打开导航菜单" })
    ).toBeVisible();
    await page.screenshot({
      path: `${artifactsPath}/mobile-image-fallback.png`
    });
  } finally {
    await context.close();
  }
}

function assertInsideViewport(box, viewport, label) {
  assert(
    box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= viewport.width + 0.5 &&
      box.y + box.height <= viewport.height + 0.5,
    `${label} 超出视口`
  );
}
