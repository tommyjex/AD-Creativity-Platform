import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const workspaceUrl = process.env.AIGC_WORKSPACE_URL;
if (!workspaceUrl) {
  throw new Error(
    "AIGC_WORKSPACE_URL must point to a seeded /workspace/aigc page"
  );
}
const sessionToken = process.env.AIGC_WORKSPACE_SESSION_TOKEN;
const workspaceQuery = process.env.AIGC_WORKSPACE_QUERY;
const workspaceOrigin = new URL(workspaceUrl).origin;

const artifactsPath =
  process.env.PLAYWRIGHT_ARTIFACTS_PATH ||
  "test-results/aigc-workspace";
const viewports = [
  { height: 900, name: "desktop", columns: 4, width: 1440 },
  { height: 1024, name: "tablet", columns: 2, width: 768 },
  { height: 844, name: "mobile", columns: 1, width: 390 }
];

await mkdir(artifactsPath, { recursive: true });

const browser = await chromium.launch({
  args: ["--disable-breakpad", "--disable-crash-reporter"],
  headless: true
});

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    if (sessionToken) {
      await context.addCookies([
        {
          name: "ad_session",
          url: workspaceOrigin,
          value: sessionToken
        }
      ]);
    }
    const page = await context.newPage();
    const errors = [];

    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(workspaceUrl, { waitUntil: "networkidle" });
    await page.getByTestId("aigc-workspace").waitFor();
    await page.getByRole("tab", { name: "画布模板" }).waitFor();
    if (workspaceQuery) {
      await page
        .getByRole("textbox", { name: "按名称筛选" })
        .fill(workspaceQuery);
      await page
        .getByRole("button", { name: "筛选", exact: true })
        .click();
      await page.waitForFunction(
        (query) => {
          const cards = [
            ...document.querySelectorAll('[data-testid="aigc-card"]')
          ];
          return (
            cards.length > 0 &&
            cards.every((card) => card.textContent?.includes(query))
          );
        },
        workspaceQuery
      );
      errors.length = 0;
    }
    await page.getByTestId("aigc-card").first().waitFor();

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
      const hasClippedText = [
        ...document.querySelectorAll("button, a, h1, h2, p")
      ]
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

    if (viewport.name !== "desktop") {
      await page.getByRole("button", { name: "打开导航菜单" }).click();
      await page.getByTestId("mobile-navigation-menu").waitFor();
      await page.getByRole("button", { name: "关闭导航菜单" }).click();
    }

    await page.screenshot({
      fullPage: true,
      path: `${artifactsPath}/${viewport.name}.png`
    });

    await context.close();

    const invalidCardWidth = measurements.cardWidths.some(
      (width) => width < 240
    );
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
  }
} finally {
  await browser.close();
}
