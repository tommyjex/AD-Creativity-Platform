import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const workspaceUrl = process.env.AIGC_WORKSPACE_URL;
if (!workspaceUrl) {
  throw new Error(
    "AIGC_WORKSPACE_URL must point to a seeded /workspace/aigc page"
  );
}

const artifactsPath =
  process.env.PLAYWRIGHT_ARTIFACTS_PATH ||
  "test-results/aigc-workspace";
const viewports = [
  { height: 900, name: "desktop", columns: 5, width: 1440 },
  { height: 1024, name: "tablet", columns: 4, width: 900 },
  { height: 844, name: "mobile", columns: 2, width: 390 }
];

await mkdir(artifactsPath, { recursive: true });

const browser = await chromium.launch({
  args: ["--disable-breakpad", "--disable-crash-reporter"],
  headless: true
});

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];

    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(workspaceUrl, { waitUntil: "networkidle" });
    await page.getByTestId("aigc-workspace").waitFor();
    await page.getByRole("tab", { name: "画布模板" }).waitFor();
    await page.getByTestId("aigc-card").first().waitFor();

    const measurements = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="aigc-workspace"]');
      const cards = [
        ...document.querySelectorAll('[data-testid="aigc-card"]')
      ];
      const firstCardTop = cards[0]?.getBoundingClientRect().top;
      const firstRow = cards.filter(
        (card) => card.getBoundingClientRect().top === firstCardTop
      );

      return {
        columns: firstRow.length,
        rootWidth: root?.scrollWidth ?? 0,
        viewportWidth: document.documentElement.clientWidth
      };
    });

    await page.screenshot({
      fullPage: true,
      path: `${artifactsPath}/${viewport.name}.png`
    });

    await context.close();

    if (
      measurements.columns !== viewport.columns ||
      measurements.rootWidth > measurements.viewportWidth ||
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
