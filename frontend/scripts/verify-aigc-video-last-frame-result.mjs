import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.AIGC_ACCEPTANCE_URL || "https://localhost:3000";
const outputDir = path.resolve("test-results/video-last-frame-result");
const videoBytes = fs.readFileSync(
  path.resolve("public/acceptance/aigc-video-fullscreen.mp4")
);
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEElEQVR42mP8z8AARAwMjD4ABf8CAQE9Z1kAAAAASUVORK5CYII=",
  "base64"
);
const viewports = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 }
];
const pipelineId = "acceptance-video-last-frame";
const runId = "acceptance-video-last-frame-run";
const unicodeName =
  "秋日新品「鎏金」✨超长名称用于验证不会溢出容器视频尾帧.png";
const definition = {
  schemaVersion: 1,
  nodes: [
    {
      id: "video-model",
      type: "video_generation",
      custom_name: "秋日新品「鎏金」✨超长名称用于验证不会溢出容器",
      position: { x: 80, y: 100 },
      size: { width: 260, height: 190 },
      config: {
        model: "doubao-seedance-2-5-260628",
        generation_mode: "text_to_video",
        resolution: "1080p",
        aspect_ratio: "16:9",
        duration_seconds: 12,
        generate_audio: true
      }
    },
    {
      id: "video-output",
      type: "video_output",
      position: { x: 440, y: 100 },
      size: { width: 260, height: 190 },
      config: { title: "下游成片" }
    }
  ],
  edges: [
    {
      id: "video-edge",
      sourceNodeId: "video-model",
      sourceHandle: "video",
      targetNodeId: "video-output",
      targetHandle: "video"
    }
  ],
  viewport: { x: 0, y: 0, zoom: 1 }
};
const run = {
  id: runId,
  pipeline_id: pipelineId,
  run_number: 1,
  pipeline_revision: 1,
  mode: "full",
  start_node_id: null,
  source_run_id: null,
  source_node_id: null,
  status: "succeeded",
  definition_snapshot: definition,
  input_snapshot: {},
  error: null,
  cancellation_requested: false,
  created_at: "2026-10-22T00:00:00Z",
  updated_at: "2026-10-22T00:00:02Z",
  started_at: "2026-10-22T00:00:00Z",
  finished_at: "2026-10-22T00:00:02Z"
};
const videoAsset = {
  asset_id: "acceptance-main-video",
  ordinal: 0,
  mime_type: "video/mp4",
  download_url: "/api/assets/acceptance-main-video/content",
  available: true,
  metadata: {
    display_node_id: "video-model",
    generated_name: "运行时旧名称",
    name_scheme: "aigc_generated_node_v2"
  }
};
const tailAsset = {
  asset_id: "acceptance-video-tail",
  ordinal: 1,
  mime_type: "image/png",
  download_url: "/api/assets/acceptance-video-tail/content",
  available: true,
  metadata: {
    display_node_id: "video-model",
    generated_name: "运行时旧名称",
    name_scheme: "aigc_generated_node_v2",
    name_variant: "video_last_frame"
  }
};
const detail = {
  run,
  nodes: [
    runNode("video-model", [tailAsset, videoAsset]),
    runNode("video-output", [videoAsset])
  ]
};

fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const reports = [];
try {
  for (const viewport of viewports) {
    reports.push(await verifyViewport(viewport));
  }
} finally {
  await browser.close();
}
fs.writeFileSync(
  path.join(outputDir, "report.json"),
  JSON.stringify({ passed: reports.length, providerCalls: 0, reports }, null, 2)
);
console.log(
  JSON.stringify({ passed: reports.length, providerCalls: 0, reports }, null, 2)
);

async function verifyViewport(viewport) {
  const context = await browser.newContext({
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    viewport
  });
  const page = await context.newPage();
  const apiRequests = [];
  const apiResponses = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/api/")) apiRequests.push(request.url());
  });
  page.on("response", (response) => {
    if (response.url().includes("/api/")) {
      apiResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  await installRoutes(page);
  const label = `${viewport.width}x${viewport.height}`;
  try {
    await page.goto(
      `${baseUrl}/workspace/aigc/acceptance?scenario=video-last-frame-result`,
      { waitUntil: "domcontentloaded" }
    );
    try {
      await page.getByTestId("aigc-editor-header").waitFor({ timeout: 10000 });
    } catch (error) {
      throw new Error(
        `${label}: editor did not load at ${page.url()}\n${apiResponses.join("\n")}\n${(await page.locator("body").innerText()).slice(0, 1200)}`,
        { cause: error }
      );
    }
    await page.getByRole("group", {
      name: "秋日新品「鎏金」✨超长名称用于验证不会溢出容器",
      exact: true
    }).click();
    const inspector = page.getByTestId("aigc-inspector");
    await inspector.getByRole("tab", { name: "结果" }).click();
    const tail = inspector.getByRole("group", { name: "视频尾帧" });
    await tail.waitFor();

    const video = inspector.locator("video");
    await expect(video).toBeVisible();
    const order = await video.evaluate((element) => {
      const tailCard = document.querySelector('[role="group"][aria-label="视频尾帧"]');
      return Boolean(
        tailCard &&
          element.compareDocumentPosition(tailCard) &
            Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    assert(order, `${label}: main video precedes tail frame`);
    await expect(tail.getByText("视频尾帧", { exact: true })).toBeVisible();
    await expect(tail.getByText("生成结果 2")).toHaveCount(0);
    await expect(tail.getByText(unicodeName, { exact: true })).toBeVisible();

    const thumbnail = tail.getByRole("img", { name: `${unicodeName} 缩略图` });
    await expect(thumbnail).toBeVisible();
    assert(
      (await thumbnail.evaluate((element) => getComputedStyle(element).objectFit)) ===
        "contain",
      `${label}: thumbnail uses object-contain`
    );
    assert(
      await thumbnail.evaluate((element) => {
        const media = element.parentElement?.getBoundingClientRect();
        return Boolean(media && media.height >= 170);
      }),
      `${label}: thumbnail has a stable media region`
    );

    const cardDownload = tail.getByRole("link", { name: "下载尾帧" });
    await assertDownload(cardDownload, unicodeName);
    const contextBefore = await resultContext(inspector);

    await tail.getByRole("button", { name: "放大查看", exact: true }).click();
    await verifyDialog(page, unicodeName, label);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "视频尾帧" })).toHaveCount(0);
    await assertContext(inspector, contextBefore, `${label}: Escape`);

    await tail
      .getByRole("button", { name: `放大查看：${unicodeName}` })
      .click();
    await verifyDialog(page, unicodeName, label);
    await page.getByRole("dialog", { name: "视频尾帧" })
      .getByRole("button", { name: "关闭" })
      .click();
    await expect(page.getByRole("dialog", { name: "视频尾帧" })).toHaveCount(0);
    await assertContext(inspector, contextBefore, `${label}: close button`);

    await tail.getByRole("button", { name: "放大查看", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "视频尾帧" });
    await verifyDialog(page, unicodeName, label);
    await assertDownload(dialog.getByRole("link", { name: "下载尾帧" }), unicodeName);
    await page.locator('[data-state="open"].fixed.inset-0').click({
      position: { x: 2, y: 2 }
    });
    await expect(dialog).toHaveCount(0);
    await assertContext(inspector, contextBefore, `${label}: overlay`);

    await page
      .locator('.react-flow__node[data-id="video-output"]')
      .dispatchEvent("click");
    await inspector.getByRole("tab", { name: "结果" }).click();
    await expect(inspector.locator("video")).toBeVisible();
    await expect(inspector.getByRole("link", { name: "下载视频" })).toBeVisible();
    await expect(
      inspector.getByRole("group", { name: "视频尾帧" })
    ).toHaveCount(0);

    const layout = await inspectLayout(page);
    assert(!layout.horizontalOverflow, `${label}: no horizontal overflow`);
    assert(layout.outside.length === 0, `${label}: controls inside viewport`, layout);
    assert(layout.overlaps.length === 0, `${label}: controls do not overlap`, layout);
    assert(errors.length === 0, `${label}: no page errors`, errors);
    assert(
      apiRequests.every((url) => new URL(url).origin === new URL(baseUrl).origin),
      `${label}: no external API calls`,
      apiRequests
    );
    await page.screenshot({
      path: path.join(outputDir, `${label}.png`),
      fullPage: true
    });
    return {
      ...viewport,
      apiRequestCount: apiRequests.length,
      classification: "name_variant+image MIME with reversed asset order",
      filename: unicodeName,
      horizontalOverflow: false
    };
  } finally {
    await context.close();
  }
}

async function installRoutes(page) {
  await page.route("**/api/auth/setup-status", (route) =>
    json(route, { initialized: true })
  );
  await page.route("**/api/auth/me", (route) =>
    json(route, {
      id: "acceptance-user",
      username: "acceptance",
      display_name: "Acceptance",
      role: "admin",
      status: "active",
      must_change_password: false,
      created_at: "2026-10-22T00:00:00Z",
      updated_at: "2026-10-22T00:00:00Z",
      last_login_at: "2026-10-22T00:00:00Z"
    })
  );
  await page.route(`**/api/aigc/pipelines/${pipelineId}/runs*`, (route) => {
    return json(route, { items: [run], page: 1, page_size: 20, total: 1 });
  });
  await page.route(`**/api/aigc/runs/${runId}`, (route) =>
    json(route, detail)
  );
  await page.route(/\/api\/assets(?:\?.*)?$/, (route) => json(route, []));
  await page.route(/\/api\/tools\/assets(?:\?.*)?$/, (route) => json(route, []));
  await page.route("**/api/assets/acceptance-main-video/content*", (route) =>
    route.fulfill({
      body: videoBytes,
      contentType: "video/mp4",
      headers: downloadHeaders(route, "main-video.mp4")
    })
  );
  await page.route("**/api/assets/acceptance-video-tail/content*", (route) =>
    route.fulfill({
      body: pngBytes,
      contentType: "image/png",
      headers: downloadHeaders(route, unicodeName)
    })
  );
}

function runNode(nodeId, assets) {
  return {
    node_id: nodeId,
    included_in_plan: true,
    status: "succeeded",
    current_task_id: null,
    reused_from_task_id: null,
    input_hash: "acceptance",
    result: {
      kind: "assets",
      metadata: {},
      naming: null,
      text: null,
      text_digest: null,
      assets
    },
    error: null,
    attempts: []
  };
}

function json(route, body) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status: 200
  });
}

function downloadHeaders(route, filename) {
  return new URL(route.request().url()).searchParams.get("download") === "1"
    ? {
        "content-disposition":
          `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      }
    : {};
}

async function assertDownload(link, filename) {
  await expect(link).toHaveAttribute("download", filename);
  await expect(link).toHaveAttribute(
    "href",
    new RegExp(`/api/assets/acceptance-video-tail/content\\?download=1&filename=`)
  );
  const page = link.page();
  const href = await link.getAttribute("href");
  assert(href, "download link has an href");
  const response = await page.evaluate(async (downloadUrl) => {
    const result = await fetch(downloadUrl);
    return {
      disposition: result.headers.get("content-disposition"),
      ok: result.ok
    };
  }, href);
  assert(response.ok, "controlled download endpoint responds");
  assert(
    response.disposition?.includes(encodeURIComponent(filename)),
    `Content-Disposition filename matches: ${filename}`
  );
}

async function verifyDialog(page, filename, label) {
  const dialog = page.getByRole("dialog", { name: "视频尾帧" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(filename, { exact: true })).toBeVisible();
  const image = dialog.getByRole("img", { name: `${filename} 大图` });
  await expect(image).toBeVisible();
  assert(
    (await image.evaluate((element) => getComputedStyle(element).objectFit)) ===
      "contain",
    `${label}: dialog uses object-contain`
  );
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  assert(
    box &&
      viewport &&
      box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= viewport.width + 1 &&
      box.y + box.height <= viewport.height + 1,
    `${label}: dialog stays inside viewport`,
    box
  );
}

async function resultContext(inspector) {
  return inspector.evaluate((root) => {
    const scrollable = [...root.querySelectorAll("*")].find(
      (element) => element.scrollHeight > element.clientHeight + 1
    );
    return {
      resultSelected:
        root.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
      scrollTop: scrollable?.scrollTop ?? 0
    };
  });
}

async function assertContext(inspector, before, label) {
  const after = await resultContext(inspector);
  assert(after.resultSelected === "结果", `${label}: result tab preserved`, after);
  assert(after.scrollTop === before.scrollTop, `${label}: scroll preserved`, {
    before,
    after
  });
  await expect(
    inspector.getByRole("group", { name: "视频尾帧" })
  ).toBeVisible();
}

async function inspectLayout(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const visible = [...document.querySelectorAll("button, a")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          box.width > 0 &&
          box.height > 0
        );
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          label:
            element.getAttribute("aria-label") ||
            element.textContent?.trim().slice(0, 40) ||
            element.tagName
        };
      });
    const outside = visible.filter(
      ({ box }) => box.x < -1 || box.x + box.width > viewportWidth + 1
    );
    const overlaps = [];
    for (let index = 0; index < visible.length; index += 1) {
      for (let other = index + 1; other < visible.length; other += 1) {
        const a = visible[index];
        const b = visible[other];
        const overlap =
          Math.min(a.box.x + a.box.width, b.box.x + b.box.width) -
            Math.max(a.box.x, b.box.x) >
            2 &&
          Math.min(a.box.y + a.box.height, b.box.y + b.box.height) -
            Math.max(a.box.y, b.box.y) >
            2;
        if (overlap) overlaps.push([a.label, b.label]);
      }
    }
    return {
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      outside,
      overlaps
    };
  });
}

function assert(condition, message, detail) {
  if (!condition) {
    throw new Error(`${message}${detail ? `: ${JSON.stringify(detail)}` : ""}`);
  }
}
