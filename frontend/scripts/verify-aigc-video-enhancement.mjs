import { chromium } from "@playwright/test";

const baseUrl = process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3000";
const url = `${baseUrl}/workspace/aigc/acceptance?scenario=video-enhancement`;
const artifactsPath =
  process.env.PLAYWRIGHT_ARTIFACTS_PATH ||
  "/tmp/ad-creativity-video-enhancement-acceptance";
const browser = await chromium.launch({
  args: ["--disable-breakpad", "--disable-crash-reporter"],
  downloadsPath: artifactsPath,
  headless: !process.argv.includes("--headed")
});
const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { height: 900, width: 1440 }
});
const forbiddenRequests = [];

await context.addInitScript(() => {
  const reads = [];
  const originalGetItem = Storage.prototype.getItem;
  Storage.prototype.getItem = function (key) {
    reads.push(String(key));
    return originalGetItem.call(this, key);
  };
  window.__acceptanceStorageReads = reads;
});
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
page.on("request", (request) => {
  if (
    isForbiddenUrl(request.url()) &&
    !forbiddenRequests.includes(request.url())
  ) {
    forbiddenRequests.push(request.url());
  }
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitUntilReady(page);

  await page.getByRole("button", { name: "添加视频画质增强" }).click();
  await page.getByRole("button", { name: "添加视频节点（上游）" }).click();
  await page.getByRole("button", { name: "连接完整流程" }).click();
  assert(
    await page.getByText("视频画质增强", { exact: true }).isVisible(),
    "添加视频画质增强节点"
  );
  assert(
    (await page.locator(".react-flow__edge").count()) === 2,
    "连接两条视频边"
  );

  await page.getByLabel("工具版本").selectOption("professional");
  assert((await page.getByLabel("场景").count()) === 0, "专业版隐藏场景");
  await page.getByLabel("色深").selectOption("16");
  assert(await page.getByLabel("码率模式").isDisabled(), "16-bit 禁用码率");

  await page.getByRole("button", { name: "保存" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitUntilReady(page);
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="工具版本"]')?.value ===
      "professional"
  );
  assert(
    (await page.getByLabel("工具版本").inputValue()) === "professional",
    "重载后保留工具版本"
  );
  assert(
    (await page.getByLabel("色深").inputValue()) === "16",
    "重载后保留色深"
  );

  await page.getByRole("button", { name: "执行", exact: true }).click();
  await expectText(page, "状态：失败 · Attempt 1");
  await page.getByRole("button", { name: "重试失败节点" }).click();
  await expectText(page, "状态：成功 · Attempt 2");

  const video = page.getByLabel("播放视频：画质增强 Mock 输出.mp4");
  await video.waitFor();
  await page.waitForFunction(
    (element) => element.readyState >= HTMLMediaElement.HAVE_METADATA,
    await video.elementHandle()
  );
  const media = await video.evaluate((element) => ({
    duration: element.duration,
    height: element.videoHeight,
    src: element.currentSrc,
    width: element.videoWidth
  }));
  assert(media.duration > 0 && media.width > 0 && media.height > 0, "本地视频有效");

  await page
    .getByRole("button", { name: "放大预览：画质增强 Mock 输出.mp4" })
    .click();
  assert(
    await page
      .getByRole("dialog", { name: "视频预览" })
      .isVisible(),
    "放大预览可用"
  );
  await page.keyboard.press("Escape");

  const fullscreen = page.getByRole("button", {
    name: "全屏播放：画质增强 Mock 输出.mp4"
  });
  assert(!(await fullscreen.isDisabled()), "Fullscreen API 可用");
  await fullscreen.click();
  await page.waitForFunction(() => document.fullscreenElement !== null);
  assert(
    (await page.evaluate(() => document.fullscreenElement?.tagName)) === "DIV",
    "产品全屏进入播放器容器"
  );
  await page.evaluate(() => document.exitFullscreen());

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载增强视频" }).click();
  const download = await downloadPromise;
  assert(
    download.suggestedFilename() === "画质增强-Mock-输出.mp4",
    "下载文件名正确"
  );
  assert((await download.createReadStream()) !== null, "下载内容可读取");

  const storageReads = await page.evaluate(
    () => window.__acceptanceStorageReads || []
  );
  assert(
    storageReads.every(
      (key) => !/(?:api|access)[_-]?key|token|secret/i.test(key)
    ),
    "未读取 API Key 或密钥存储项",
    storageReads
  );
  assert(forbiddenRequests.length === 0, "零 MediaKit/enhance-video 请求");

  console.log(
    JSON.stringify(
      {
        forbiddenRequests,
        media,
        result: "PASS",
        storageReads: [...new Set(storageReads)],
        url
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}

function isForbiddenUrl(value) {
  const parsed = new URL(value);
  return (
    parsed.hostname.toLowerCase().includes("mediakit") ||
    /\/enhance-video(?:[/?#]|$)/i.test(parsed.pathname)
  );
}

async function expectText(page, text) {
  const locator = page.getByText(text, { exact: false });
  await locator.waitFor();
  assert(await locator.isVisible(), text);
}

async function waitUntilReady(page) {
  await page
    .getByTestId("video-enhancement-acceptance")
    .getAttribute("data-ready")
    .then((value) => {
      if (value === "true") return;
      return page.waitForFunction(
        () =>
          document.querySelector(
            '[data-testid="video-enhancement-acceptance"]'
          )?.getAttribute("data-ready") === "true"
      );
    });
}

function assert(condition, label, detail = null) {
  if (!condition) {
    throw new Error(
      `ASSERT FAIL ${label}${detail === null ? "" : `: ${JSON.stringify(detail)}`}`
    );
  }
  console.log(`ASSERT PASS ${label}`);
}
