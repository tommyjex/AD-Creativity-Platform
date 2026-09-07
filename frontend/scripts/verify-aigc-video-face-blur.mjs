import { chromium } from "@playwright/test";

const baseUrl = process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3000";
const url = `${baseUrl}/workspace/aigc/acceptance?scenario=video-face-blur`;
const artifactsPath =
  process.env.PLAYWRIGHT_ARTIFACTS_PATH ||
  "/tmp/ad-creativity-video-face-blur-acceptance";
const forbiddenRequests = [];
let browser;

try {
  browser = await chromium.launch({
    args: ["--disable-breakpad", "--disable-crash-reporter"],
    downloadsPath: artifactsPath,
    headless: !process.argv.includes("--headed")
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { height: 900, width: 1440 }
  });

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

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitUntilReady(page);

  assert(
    (await page.getByLabel("打码方式").inputValue()) === "mosaic",
    "默认打码方式为 mosaic"
  );
  assert(
    (await page.getByLabel("打码强度").inputValue()) === "medium",
    "默认打码强度为 medium"
  );

  await page.getByRole("button", { name: "添加视频人脸打码" }).click();
  await page.getByRole("button", { name: "添加视频节点（上游）" }).click();
  await page.getByRole("button", { name: "连接完整流程" }).click();
  assert(
    await page.getByText("视频人脸打码", { exact: true }).isVisible(),
    "添加视频人脸打码节点"
  );
  assert(
    (await page.locator(".react-flow__edge").count()) === 2,
    "连接两条视频边"
  );

  await page.getByLabel("打码方式").selectOption("blur");
  await page.getByLabel("打码强度").selectOption("high");
  await page.getByRole("button", { name: "保存" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitUntilReady(page);
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="打码方式"]')?.value === "blur"
  );
  assert(
    (await page.getByLabel("打码方式").inputValue()) === "blur",
    "重载后保留 blur"
  );
  assert(
    (await page.getByLabel("打码强度").inputValue()) === "high",
    "重载后保留 high"
  );

  await page.getByRole("button", { name: "执行", exact: true }).click();
  await expectText(page, "状态：失败 · Attempt 1");
  await page.getByRole("button", { name: "重试失败节点" }).click();
  await expectText(page, "状态：成功 · Attempt 2");

  const video = page.getByLabel("播放视频：人脸打码 Mock 输出.mp4");
  await video.waitFor();
  await page.waitForFunction(
    (element) => element.readyState >= HTMLMediaElement.HAVE_METADATA,
    await video.elementHandle()
  );
  const media = await video.evaluate(async (element) => {
    element.muted = true;
    await element.play();
    const played = !element.paused;
    element.pause();
    return {
      duration: element.duration,
      height: element.videoHeight,
      played,
      src: element.currentSrc,
      width: element.videoWidth
    };
  });
  assert(
    media.played &&
      media.duration > 0 &&
      media.width > 0 &&
      media.height > 0,
    "本地 MP4 可播放"
  );

  await page
    .getByRole("button", { name: "放大预览：人脸打码 Mock 输出.mp4" })
    .click();
  assert(
    await page.getByRole("dialog", { name: "视频预览" }).isVisible(),
    "放大预览可用"
  );
  await page.keyboard.press("Escape");

  const fullscreen = page.getByRole("button", {
    name: "全屏播放：人脸打码 Mock 输出.mp4"
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
  await page.getByRole("link", { name: "下载打码视频" }).click();
  const download = await downloadPromise;
  assert(
    download.suggestedFilename() === "人脸打码-Mock-输出.mp4",
    "下载文件名正确"
  );
  assert((await download.createReadStream()) !== null, "下载内容可读取");

  const storageReads = await page.evaluate(
    () => window.__acceptanceStorageReads || []
  );
  assert(
    storageReads.includes("aigc.acceptance.video-face-blur.v2"),
    "读取专属 fixture 存储项",
    storageReads
  );
  assert(
    storageReads.every(
      (key) => !/(?:api|access)[_-]?key|token|secret/i.test(key)
    ),
    "未读取 API Key、token 或 secret 存储项",
    storageReads
  );
  assert(
    forbiddenRequests.length === 0,
    "零 MediaKit/face-blur-video 请求",
    forbiddenRequests
  );

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
  await browser?.close();
}

function isForbiddenUrl(value) {
  const parsed = new URL(value);
  return (
    parsed.hostname.toLowerCase().includes("mediakit") ||
    /\/(?:enhance-video|face-blur-video)(?:[/?#]|$)/i.test(parsed.pathname)
  );
}

async function expectText(page, text) {
  const locator = page.getByText(text, { exact: false });
  await locator.waitFor();
  assert(await locator.isVisible(), text);
}

async function waitUntilReady(page) {
  await page
    .getByTestId("video-face-blur-acceptance")
    .getAttribute("data-ready")
    .then((value) => {
      if (value === "true") return;
      return page.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="video-face-blur-acceptance"]')
            ?.getAttribute("data-ready") === "true"
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
