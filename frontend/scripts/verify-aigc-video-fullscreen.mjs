import { chromium, webkit } from "@playwright/test";

const baseUrl = process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3000";
const browserName =
  process.argv.find((arg) => arg.startsWith("--browser="))?.split("=")[1] ||
  "chromium";
const headed = process.argv.includes("--headed");
const browserType = browserName === "webkit" ? webkit : chromium;
const launchOptions =
  browserName === "chromium"
    ? { channel: "chromium", headless: !headed }
    : { headless: !headed };

const browser = await browserType.launch(launchOptions);
const context = await browser.newContext({
  viewport: { height: 800, width: 1280 }
});
const page = await context.newPage();
const fullscreenEvents = [];

await page.exposeFunction("recordFullscreenEvent", (event) => {
  fullscreenEvents.push(event);
});
await page.addInitScript(() => {
  document.addEventListener("fullscreenchange", () => {
    window.recordFullscreenEvent({
      fullscreen: Boolean(document.fullscreenElement),
      tagName: document.fullscreenElement?.tagName || null
    });
  });
});

try {
  await page.goto(
    `${baseUrl}/workspace/aigc/acceptance?scenario=video-fullscreen`,
    { waitUntil: "domcontentloaded" }
  );
  const video = page.getByLabel("播放视频：验收视频输出.mp4");
  await video.waitFor();
  await page.waitForFunction(
    (element) => element.readyState >= HTMLMediaElement.HAVE_METADATA,
    await video.elementHandle()
  );

  console.log(
    JSON.stringify(
      {
        browser: await browser.version(),
        browserName,
        command: process.argv.join(" "),
        headed,
        media: await mediaState(video),
        platform: await page.evaluate(() => navigator.platform),
        standardFullscreen: await page.evaluate(() => ({
          enabled: document.fullscreenEnabled,
          requestFullscreen: typeof Element.prototype.requestFullscreen
        })),
        userAgent: await page.evaluate(() => navigator.userAgent)
      },
      null,
      2
    )
  );

  const initialLayout = await layoutState(page);
  assert(initialLayout.playerClasses.includes("nowheel"), "节点播放器标记 nowheel");
  assert(initialLayout.objectFit === "contain", "视频保持 object-contain");
  assert(
    initialLayout.videoRatio === 640 / 360,
    "视频固有宽高比为 16:9",
    initialLayout.videoRatio
  );

  if (browserName === "chromium") {
    await verifyChromiumNativeControls(page, context, video, initialLayout);
  } else {
    console.log(
      "ASSERT SKIP UA_NATIVE_CONTROLS: WebKit UA shadow controls cannot be located through Chromium CDP"
    );
  }

  await verifyProductFullscreen(page, video, initialLayout);
  console.log(
    JSON.stringify(
      {
        finalLayout: await layoutState(page),
        fullscreenEvents,
        result: "PASS"
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}

async function verifyChromiumNativeControls(
  targetPage,
  targetContext,
  video,
  initialLayout
) {
  const cdp = await targetContext.newCDPSession(targetPage);
  const controls = await nativeControlCenters(cdp, [
    "play-button",
    "timeline",
    "mute-button",
    "fullscreen-button"
  ]);

  await pointerClick(targetPage, controls["play-button"]);
  await targetPage.waitForFunction(
    (element) => !element.paused && element.currentTime > 0,
    await video.elementHandle()
  );
  assert(!(await mediaState(video)).paused, "原生播放按钮启动播放");

  await pointerClick(targetPage, controls.timeline, { xRatio: 0.65 });
  await targetPage.waitForFunction(
    (element) => element.currentTime > element.duration * 0.45,
    await video.elementHandle()
  );
  assert(
    (await mediaState(video)).currentTime > 2.7,
    "原生进度条真实指针跳转"
  );

  const mutedBefore = (await mediaState(video)).muted;
  await pointerClick(targetPage, controls["mute-button"]);
  assert(
    (await mediaState(video)).muted !== mutedBefore,
    "原生音量按钮真实指针切换静音"
  );

  const refreshed = await nativeControlCenters(cdp, ["play-button"]);
  await pointerClick(targetPage, refreshed["play-button"]);
  await targetPage.waitForFunction(
    (element) => element.paused,
    await video.elementHandle()
  );
  const beforeFullscreen = await mediaState(video);

  const enterControls = await nativeControlCenters(cdp, ["fullscreen-button"]);
  await pointerClick(targetPage, enterControls["fullscreen-button"]);
  await targetPage.waitForFunction(() => document.fullscreenElement !== null);
  const inFullscreen = await mediaState(video);
  assert(
    inFullscreen.fullscreenElement === "VIDEO",
    "原生全屏按钮进入 VIDEO 全屏"
  );
  assert(inFullscreen.paused, "原生全屏进入后保持暂停状态");
  assert(
    Math.abs(inFullscreen.currentTime - beforeFullscreen.currentTime) < 0.25,
    "原生全屏进入后保持播放位置"
  );
  assert(
    inFullscreen.muted === beforeFullscreen.muted &&
      inFullscreen.volume === beforeFullscreen.volume,
    "原生全屏进入后保持音量状态"
  );

  await targetPage.mouse.move(640, 780);
  const exitControls = await nativeControlCenters(cdp, ["fullscreen-button"]);
  await pointerClick(targetPage, exitControls["fullscreen-button"]);
  await targetPage.waitForFunction(() => document.fullscreenElement === null);
  const afterFullscreen = await mediaState(video);
  assert(afterFullscreen.paused, "原生全屏退出后保持暂停状态");
  assert(
    Math.abs(afterFullscreen.currentTime - beforeFullscreen.currentTime) < 0.25,
    "原生全屏退出后保持播放位置"
  );
  assert(
    afterFullscreen.muted === beforeFullscreen.muted &&
      afterFullscreen.volume === beforeFullscreen.volume,
    "原生全屏退出后保持音量状态"
  );
  assertLayoutUnchanged(await layoutState(targetPage), initialLayout, "原生全屏退出");

  const videoBox = await video.boundingBox();
  if (!videoBox) throw new Error("视频元素没有可点击区域");
  await targetPage.mouse.move(
    videoBox.x + videoBox.width / 2,
    videoBox.y + videoBox.height / 2
  );
  await targetPage.mouse.wheel(0, 500);
  await targetPage.waitForTimeout(100);
  assertLayoutUnchanged(await layoutState(targetPage), initialLayout, "视频区域滚轮");
}

async function verifyProductFullscreen(targetPage, video, initialLayout) {
  const button = targetPage.getByRole("button", {
    name: "全屏播放：验收视频输出.mp4"
  });
  if (await button.isDisabled()) {
    assert(
      (await button.getAttribute("title")) === "当前浏览器不支持页面全屏",
      "不支持 Fullscreen API 时产品入口禁用并说明原因"
    );
    console.log("ASSERT SKIP PRODUCT_FULLSCREEN: Fullscreen API unavailable");
    return;
  }

  const videoBox = await video.boundingBox();
  const buttonBox = await button.boundingBox();
  if (!videoBox || !buttonBox) throw new Error("产品全屏入口没有可点击区域");
  const beforeFullscreen = await mediaState(video);
  await pointerClick(targetPage, buttonBox);
  await targetPage.waitForFunction(() => document.fullscreenElement !== null);
  assert(
    (await mediaState(video)).fullscreenElement === "DIV",
    "产品 Fullscreen API 入口进入播放器容器全屏"
  );
  const inFullscreen = await mediaState(video);
  assert(
    inFullscreen.paused === beforeFullscreen.paused,
    "产品全屏进入后保持播放状态"
  );
  assert(
    Math.abs(inFullscreen.currentTime - beforeFullscreen.currentTime) < 0.25,
    "产品全屏进入后保持播放位置"
  );
  assert(
    inFullscreen.muted === beforeFullscreen.muted &&
      inFullscreen.volume === beforeFullscreen.volume,
    "产品全屏进入后保持音量状态"
  );

  const exitButton = targetPage.getByRole("button", {
    name: "退出全屏：验收视频输出.mp4"
  });
  const exitButtonBox = await exitButton.boundingBox();
  if (!exitButtonBox) throw new Error("产品退出全屏入口没有可点击区域");
  await pointerClick(targetPage, exitButtonBox);
  await targetPage.waitForFunction(() => document.fullscreenElement === null);
  await targetPage.waitForTimeout(50);
  const afterFullscreen = await mediaState(video);
  assert(
    afterFullscreen.paused === beforeFullscreen.paused,
    "产品全屏退出后保持播放状态"
  );
  assert(
    Math.abs(afterFullscreen.currentTime - beforeFullscreen.currentTime) < 0.25,
    "产品全屏退出后保持播放位置"
  );
  assert(
    afterFullscreen.muted === beforeFullscreen.muted &&
      afterFullscreen.volume === beforeFullscreen.volume,
    "产品全屏退出后保持音量状态"
  );
  assertLayoutUnchanged(await layoutState(targetPage), initialLayout, "产品全屏退出");
}

async function nativeControlCenters(cdp, names) {
  const root = (
    await cdp.send("DOM.getDocument", { depth: -1, pierce: true })
  ).root;
  const result = {};
  for (const name of names) {
    const node = findNode(root, (candidate) =>
      candidate.attributes?.some((value) => value.includes(name))
    );
    if (!node) throw new Error(`未在 Chromium UA shadow DOM 中找到 ${name}`);
    const box = (await cdp.send("DOM.getBoxModel", { nodeId: node.nodeId })).model
      .border;
    result[name] = {
      height: Math.abs(box[5] - box[1]),
      width: Math.abs(box[2] - box[0]),
      x: Math.min(box[0], box[2], box[4], box[6]),
      y: Math.min(box[1], box[3], box[5], box[7])
    };
  }
  return result;
}

function findNode(node, predicate) {
  if (predicate(node)) return node;
  for (const key of ["children", "shadowRoots", "pseudoElements"]) {
    for (const child of node[key] || []) {
      const match = findNode(child, predicate);
      if (match) return match;
    }
  }
  return null;
}

async function pointerClick(targetPage, box, { xRatio = 0.5 } = {}) {
  const point = {
    x: box.x + box.width * xRatio,
    y: box.y + box.height / 2
  };
  console.log(`POINTER click ${JSON.stringify(point)}`);
  await targetPage.mouse.click(point.x, point.y);
}

async function mediaState(video) {
  return video.evaluate((element) => ({
    currentTime: element.currentTime,
    duration: element.duration,
    fullscreenElement: document.fullscreenElement?.tagName || null,
    muted: element.muted,
    paused: element.paused,
    readyState: element.readyState,
    videoHeight: element.videoHeight,
    videoWidth: element.videoWidth,
    volume: element.volume
  }));
}

async function layoutState(targetPage) {
  return targetPage.evaluate(() => {
    const canvas = document.querySelector('[data-testid="acceptance-canvas"]');
    const node = document.querySelector(
      '[data-testid="acceptance-video-output-node"]'
    );
    const player = node?.querySelector(".nowheel");
    const video = node?.querySelector("video");
    const viewport = document.querySelector(".react-flow__viewport");
    if (!canvas || !node || !player || !video || !viewport) {
      throw new Error("验收页缺少画布、节点、播放器或 viewport");
    }
    return {
      canvasBox: canvas.getBoundingClientRect().toJSON(),
      nodeBox: node.getBoundingClientRect().toJSON(),
      nodeClass: node.className,
      nodeStyle: node.getAttribute("style"),
      objectFit: getComputedStyle(video).objectFit,
      playerClasses: player.className,
      videoRatio: video.videoWidth / video.videoHeight,
      viewportClass: viewport.className,
      viewportStyle: viewport.getAttribute("style"),
      viewportTransform: getComputedStyle(viewport).transform
    };
  });
}

function assertLayoutUnchanged(actual, expected, operation) {
  assert(
    JSON.stringify(actual.nodeBox) === JSON.stringify(expected.nodeBox),
    `${operation}后节点 bounding box 不变`
  );
  assert(actual.nodeClass === expected.nodeClass, `${operation}后节点 class 不变`);
  assert(actual.nodeStyle === expected.nodeStyle, `${operation}后节点 style 不变`);
  assert(
    actual.viewportTransform === expected.viewportTransform,
    `${operation}后画布 transform 不变`
  );
  assert(
    actual.viewportStyle === expected.viewportStyle,
    `${operation}后画布 style 不变`
  );
}

function assert(condition, name, detail = "") {
  if (!condition) throw new Error(`ASSERT FAIL ${name}: ${detail}`);
  console.log(`ASSERT PASS ${name}${detail === "" ? "" : `: ${detail}`}`);
}
