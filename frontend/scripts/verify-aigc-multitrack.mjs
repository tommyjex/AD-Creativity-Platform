import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3000";
const url =
  `${baseUrl}/workspace/aigc/pipelines/acceptance-multitrack/` +
  "nodes/acceptance-multitrack/timeline";
const artifactsPath =
  process.env.PLAYWRIGHT_ARTIFACTS_PATH ||
  "/tmp/ad-creativity-aigc-multitrack-acceptance";
const viewports = [
  { height: 900, name: "desktop-1440x900", width: 1440 },
  { height: 768, name: "tablet-1023x768", width: 1023 },
  { height: 844, name: "mobile-390x844", width: 390 }
];
const forbiddenRequests = [];
const results = [];

await mkdir(artifactsPath, { recursive: true });
const browser = await chromium.launch({
  args: ["--disable-breakpad", "--disable-crash-reporter"],
  downloadsPath: artifactsPath,
  headless: !process.argv.includes("--headed")
});

try {
  for (const viewport of viewports) {
    results.push(await verifyViewport(browser, viewport));
  }
  assert(forbiddenRequests.length === 0, "零真实 MediaKit/多轨供应商请求");
  console.log(
    JSON.stringify(
      {
        artifactsPath,
        forbiddenRequests,
        result: "PASS",
        url,
        viewports: results
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}

async function verifyViewport(browser, viewport) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { height: viewport.height, width: viewport.width }
  });
  const consoleErrors = [];
  const pageErrors = [];
  await context.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    if (isForbiddenUrl(requestUrl)) {
      forbiddenRequests.push(requestUrl);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await waitUntilReady(page);

    await page.getByRole("button", { name: "添加多轨剪辑" }).click();
    await page.getByRole("button", { name: "添加视频结果节点" }).click();
    await page.getByRole("button", { name: "连接完整流程" }).click();
    assert(
      (await page.locator(".react-flow__edge").count()) === 2,
      `${viewport.name} 创建并连接多轨节点`
    );
    await page.getByRole("button", { name: "进入全屏时间线" }).click();
    await page.getByTestId("aigc-timeline-editor").waitFor();
    assert(
      new URL(page.url()).pathname.endsWith(
        "/nodes/acceptance-multitrack/timeline"
      ),
      `${viewport.name} 位于 /timeline`
    );

    const editorBox = await page.getByTestId("aigc-timeline-editor").boundingBox();
    assert(
      editorBox &&
        Math.abs(editorBox.height - viewport.height) <= 1 &&
        Math.abs(editorBox.width - viewport.width) <= 1,
      `${viewport.name} 时间线占满视口`,
      editorBox
    );

    await page
      .getByLabel("添加上游素材")
      .selectOption({ label: "视频 · acceptance-video-source" });
    const videoClip = page.getByRole("button", {
      name: "选择片段 acceptance-video-source"
    });
    await videoClip.waitFor();
    const originalBox = await videoClip.boundingBox();
    assert(originalBox, `${viewport.name} 视频片段已创建`);

    await videoClip.hover();
    await page.mouse.move(originalBox.x + 24, originalBox.y + 18);
    await page.mouse.down();
    await page.mouse.move(originalBox.x + 68, originalBox.y + 18);
    await page.mouse.up();
    const movedBox = await videoClip.boundingBox();
    assert(
      movedBox && movedBox.x > originalBox.x + 20,
      `${viewport.name} 片段拖拽生效`
    );
    await page.getByRole("button", { name: "撤销" }).click();

    if (viewport.width < 600) {
      await page
        .getByTestId("timeline-scroll-area")
        .evaluate((element) => {
          element.scrollLeft = 250;
        });
    }
    await videoClip.hover();
    const rightTrim = videoClip.getByLabel("向右裁切");
    const trimBox = await rightTrim.boundingBox();
    const visibleClipBox = await videoClip.boundingBox();
    assert(visibleClipBox && trimBox, `${viewport.name} 裁切控制可达`);
    await page.mouse.move(trimBox.x + trimBox.width / 2, trimBox.y + 8);
    await page.mouse.down();
    await page.mouse.move(trimBox.x - 40, trimBox.y + 8);
    await page.mouse.up();
    const trimmedBox = await videoClip.boundingBox();
    assert(
      trimmedBox && trimmedBox.width < visibleClipBox.width - 20,
      `${viewport.name} 片段裁切生效`
    );
    await page.getByRole("button", { name: "撤销" }).click();
    if (viewport.width < 600) {
      await page
        .getByTestId("timeline-scroll-area")
        .evaluate((element) => {
          element.scrollLeft = 0;
        });
    }

    const ruler = page.getByRole("button", { name: "时间标尺" });
    const rulerBox = await ruler.boundingBox();
    assert(rulerBox, `${viewport.name} 时间标尺可达`);
    await page.mouse.click(rulerBox.x + 176, rulerBox.y + 14);
    await page.waitForTimeout(100);
    const playheadLeft = await page
      .getByTestId("timeline-playhead")
      .evaluate((element) => Number.parseFloat(element.style.left));
    const clipBeforeSplit = await videoClip.boundingBox();
    assert(
      clipBeforeSplit &&
        playheadLeft > 0 &&
        playheadLeft < clipBeforeSplit.width,
      `${viewport.name} 播放头位于片段内部`,
      { clipBeforeSplit, playheadLeft }
    );
    await videoClip.click();
    await videoClip.hover();
    await videoClip
      .getByRole("button", { name: "在播放头分割" })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '[aria-label="选择片段 acceptance-video-source"]'
        ).length === 2
    );
    assert(
      (await page.getByRole("button", {
        name: "选择片段 acceptance-video-source"
      }).count()) === 2,
      `${viewport.name} 播放头分割生效`
    );

    const firstSplitClip = page
      .getByRole("button", { name: "选择片段 acceptance-video-source" })
      .first();
    await firstSplitClip.click();
    if (viewport.width < 1024) {
      await page.getByRole("button", { name: "打开检查器" }).click();
      await page
        .getByTestId("mobile-inspector-drawer")
        .waitFor({ state: "visible" });
    }
    const inspector =
      viewport.width < 1024
        ? page.getByTestId("mobile-inspector-drawer")
        : page.getByRole("complementary", { name: "属性检查器" });
    await inspector.getByLabel("音量").fill("0.8");
    assert(
      (await inspector.getByLabel("音量").inputValue()) === "0.8",
      `${viewport.name} 检查器精确编辑生效`
    );
    if (viewport.width < 1024) {
      await page.getByRole("button", { name: "关闭检查器" }).click();
    }

    if (viewport.width >= 1024) {
      await page.getByTitle("视频轨道").click();
      await inspector.getByLabel("轨道名称").fill("主视频轨道");
      const videoTrackHeader = page.getByTitle("主视频轨道").locator("..");
      await videoTrackHeader.getByRole("button", { name: "轨道静音" }).click();
      await videoTrackHeader.getByRole("button", { name: "取消静音" }).click();
      assert(
        await page.getByTitle("主视频轨道").isVisible(),
        `${viewport.name} 轨道重命名与静音可用`
      );
    }

    await page.getByRole("button", { name: "保存到节点" }).click();
    await page.getByText("草稿已保存。").waitFor();
    const stored = await page.evaluate(() =>
      localStorage.getItem("aigc.acceptance.multitrack.v1")
    );
    assert(Boolean(stored), `${viewport.name} 草稿保存到 fixture`);

    await page.screenshot({
      fullPage: true,
      path: `${artifactsPath}/${viewport.name}-timeline.png`
    });
    const layout = await inspectLayout(page);
    assert(
      layout.documentOverflow <= 1,
      `${viewport.name} 页面无横向异常溢出`,
      layout
    );
    assert(
      layout.overlaps.length === 0,
      `${viewport.name} 顶部文本与控件无重叠`,
      layout.overlaps
    );

    await page.getByRole("button", { name: "执行剪辑" }).click();
    await page.getByText("状态：失败 · Attempt 1").waitFor();
    await page.getByRole("button", { name: "重试失败节点" }).click();
    await page.getByText("状态：成功 · Attempt 2").waitFor();

    const video = page.getByLabel("播放视频：多轨剪辑 Mock 成片.mp4");
    await video.waitFor();
    await page.waitForFunction(
      (element) => element.readyState >= HTMLMediaElement.HAVE_METADATA,
      await video.elementHandle()
    );
    const media = await video.evaluate((element) => ({
      duration: element.duration,
      height: element.videoHeight,
      width: element.videoWidth
    }));
    assert(
      media.duration > 0 && media.height > 0 && media.width > 0,
      `${viewport.name} Mock 成片可播放`,
      media
    );

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "下载多轨成片" }).click();
    const download = await downloadPromise;
    assert(
      download.suggestedFilename() === "多轨剪辑-Mock-成片.mp4",
      `${viewport.name} 成片下载文件名正确`
    );
    assert(
      (await download.createReadStream()) !== null,
      `${viewport.name} 成片下载内容可读取`
    );
    await page.screenshot({
      fullPage: true,
      path: `${artifactsPath}/${viewport.name}-result.png`
    });

    await page.getByRole("button", { name: "关闭 Mock 结果" }).click();
    await page.getByRole("button", { name: "执行剪辑" }).click();
    await page.getByText("状态：缓存复用 · Attempt 2").waitFor();
    assert(
      await page.getByText("缓存命中：复用 Attempt 2 的可用成片。").isVisible(),
      `${viewport.name} 相同输入命中缓存`
    );

    assert(consoleErrors.length === 0, `${viewport.name} 控制台无新增错误`, {
      consoleErrors
    });
    assert(pageErrors.length === 0, `${viewport.name} 页面无运行时错误`, {
      pageErrors
    });
    return {
      consoleErrors,
      media,
      name: viewport.name,
      pageErrors,
      screenshots: [
        `${artifactsPath}/${viewport.name}-timeline.png`,
        `${artifactsPath}/${viewport.name}-result.png`
      ]
    };
  } finally {
    await context.close();
  }
}

async function inspectLayout(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const toolbar = document.querySelector(
      '[aria-label="时间线编辑操作"]'
    );
    const controls = toolbar
      ? [...toolbar.querySelectorAll("button, h1, p, span")].filter(
          (element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0
            );
          }
        )
      : [];
    const overlaps = [];
    for (let leftIndex = 0; leftIndex < controls.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < controls.length;
        rightIndex += 1
      ) {
        const left = controls[leftIndex];
        const right = controls[rightIndex];
        if (left.contains(right) || right.contains(left)) continue;
        const a = left.getBoundingClientRect();
        const b = right.getBoundingClientRect();
        const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapHeight =
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapWidth > 1 && overlapHeight > 1) {
          overlaps.push(
            `${left.tagName}:${left.textContent?.trim()} <> ` +
              `${right.tagName}:${right.textContent?.trim()}`
          );
        }
      }
    }
    return {
      documentOverflow: root.scrollWidth - window.innerWidth,
      overlaps
    };
  });
}

function isForbiddenUrl(value) {
  const parsed = new URL(value);
  return (
    parsed.hostname.toLowerCase().includes("mediakit") ||
    /\/multi-track-edit(?:[/?#]|$)/i.test(parsed.pathname)
  );
}

async function waitUntilReady(page) {
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="multitrack-acceptance"]')
        ?.getAttribute("data-ready") === "true"
  );
}

function assert(condition, label, detail = null) {
  if (!condition) {
    throw new Error(
      `ASSERT FAIL ${label}${detail === null ? "" : `: ${JSON.stringify(detail)}`}`
    );
  }
  console.log(`ASSERT PASS ${label}`);
}
