import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.AIGC_ACCEPTANCE_URL || "https://localhost:3000";
const outputDir = path.resolve("test-results/model-output-materialization");
const pipelineId = "acceptance-materialized-output";
const runId = "acceptance-materialized-run";
const historicalRunId = "acceptance-materialized-history";
const viewports = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 }
];
const imageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEElEQVR42mP8z8AARAwMjD4ABf8CAQE9Z1kAAAAASUVORK5CYII=",
  "base64"
);
const videoBytes = fs.readFileSync(
  path.resolve("public/acceptance/aigc-video-fullscreen.mp4")
);

const persistedDefinition = {
  schemaVersion: 2,
  nodes: [
    {
      id: "shared-prompt",
      type: "text",
      custom_name: "Mock 提示词",
      position: { x: -280, y: 340 },
      size: { width: 240, height: 180 },
      config: {
        text: "deterministic mock materialization",
        bbox_references: [],
        title: null
      }
    },
    node("image-model", "text_to_image", 40, 40, "终端图片模型"),
    generatedNode(
      "auto-image",
      "image",
      360,
      40,
      "自动图片",
      "image-model",
      "acceptance-materialized-image"
    ),
    node("video-model", "video_generation", 40, 340, "终端视频模型"),
    generatedNode(
      "auto-video",
      "video",
      360,
      340,
      "自动视频",
      "video-model",
      "acceptance-materialized-video"
    ),
    node("connected-model", "text_to_image", 40, 640, "已有下游模型"),
    localImageNode("manual-output", 360, 640, "手工下游"),
    node("reused-model", "text_to_image", 40, 940, "缓存复用模型"),
    generatedNode(
      "auto-reused-image",
      "image",
      360,
      940,
      "复用自动图片",
      "reused-model",
      "acceptance-reused-image"
    )
  ],
  edges: [
    textEdge("prompt-image-edge", "image-model"),
    textEdge("prompt-video-edge", "video-model"),
    textEdge("prompt-connected-edge", "connected-model"),
    textEdge("prompt-reused-edge", "reused-model"),
    edge("auto-image-edge", "image-model", "auto-image", "image"),
    edge("auto-video-edge", "video-model", "auto-video", "video"),
    edge("manual-edge", "connected-model", "manual-output", "image"),
    edge(
      "auto-reused-edge",
      "reused-model",
      "auto-reused-image",
      "image"
    )
  ],
  viewport: { x: 80, y: 30, zoom: 0.72 }
};
const snapshotDefinition = {
  ...structuredClone(persistedDefinition),
  nodes: persistedDefinition.nodes.filter(
    (item) =>
      !["auto-image", "auto-video", "auto-reused-image"].includes(item.id)
  ),
  edges: persistedDefinition.edges.filter(
    (item) =>
      !["auto-image-edge", "auto-video-edge", "auto-reused-edge"].includes(
        item.id
      )
  )
};
const pipeline = {
  id: pipelineId,
  name: "Mock 自动物化验收",
  description: "确定性 Mock-only 验收。",
  definition: persistedDefinition,
  source_template_id: null,
  source_template_revision: null,
  revision: 4,
  latest_run_status: "succeeded",
  thumbnail_asset_id: "acceptance-materialized-image",
  thumbnail: null,
  created_at: "2026-10-23T00:00:00Z",
  updated_at: "2026-10-23T00:00:04Z"
};
const currentRun = run(runId, 2, "succeeded");
const historicalRun = run(historicalRunId, 1, "failed");
const currentDetail = {
  run: currentRun,
  nodes: [
    runNode("image-model", "succeeded", [
      asset("acceptance-secondary-image", 1, "image/png"),
      asset("acceptance-materialized-image", 0, "image/png")
    ]),
    runNode("video-model", "succeeded", [
      {
        ...asset("acceptance-video-tail", 1, "image/png"),
        metadata: { name_variant: "video_last_frame" }
      },
      asset("acceptance-materialized-video", 0, "video/mp4")
    ]),
    runNode("connected-model", "succeeded", [
      asset("acceptance-manual-image", 0, "image/png")
    ]),
    runNode("manual-output", "succeeded", [
      asset("acceptance-manual-image", 0, "image/png")
    ]),
    runNode("reused-model", "reused", [
      asset("acceptance-reused-image", 0, "image/png")
    ])
  ]
};
const historicalDetail = {
  run: historicalRun,
  nodes: [
    runNode("image-model", "failed", []),
    runNode("video-model", "failed", [])
  ]
};

verifyLifecycleFixture();
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const reports = [];
try {
  for (const viewport of viewports) {
    reports.push(await verifyViewport(browser, viewport));
  }
} finally {
  await browser.close();
}
const report = {
  passed: reports.length,
  providerCalls: 0,
  tosCalls: 0,
  reports
};
fs.writeFileSync(
  path.join(outputDir, "report.json"),
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report, null, 2));

async function verifyViewport(browserInstance, viewport) {
  const context = await browserInstance.newContext({
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    viewport
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const externalRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    requestFailures.push({
      error: request.failure()?.errorText ?? "unknown",
      url: request.url()
    });
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin !== new URL(baseUrl).origin &&
      url.origin !== "http://127.0.0.1:7777" &&
      !url.pathname.startsWith("/_next/")
    ) {
      externalRequests.push(request.url());
    }
  });
  await installRoutes(page);
  const label = `${viewport.width}x${viewport.height}`;
  try {
    await page.goto(
      `${baseUrl}/workspace/aigc/acceptance?scenario=materialized-output`,
      { waitUntil: "domcontentloaded" }
    );
    await page.getByTestId("aigc-editor-header").waitFor({ timeout: 15000 });

    const imageNode = page.locator(
      '.react-flow__node[data-id="auto-image"]'
    );
    await imageNode.dispatchEvent("click");
    const inspector = page.getByTestId("aigc-inspector");
    await inspector.getByRole("tab", { name: "结果" }).click();
    const image = inspector.getByRole("img", { name: "自动图片" });
    await expect(image).toBeVisible();
    assert(
      (await image.evaluate((element) => getComputedStyle(element).objectFit)) ===
        "contain",
      `${label}: image uses object-contain`
    );
    await expect(
      inspector.getByRole("link", { name: "查看原图：自动图片" })
    ).toBeVisible();
    await assertDownload(
      inspector.getByRole("link", { name: "下载图片" }),
      "acceptance-materialized-image"
    );

    await page
      .locator('.react-flow__node[data-id="auto-video"]')
      .dispatchEvent("click");
    await inspector.getByRole("tab", { name: "结果" }).click();
    const video = inspector.locator('video[aria-label="播放视频：自动视频"]');
    await expect(video).toBeVisible();
    assert(await video.getAttribute("controls") !== null, `${label}: video controls`);
    assert(
      (await video.evaluate((element) => getComputedStyle(element).objectFit)) ===
        "contain",
      `${label}: video uses object-contain`
    );
    assert(
      await video.evaluate(
        (element) => typeof element.requestFullscreen === "function"
      ),
      `${label}: native fullscreen is available`
    );
    await assertDownload(
      inspector.getByRole("link", { name: "下载视频" }),
      "acceptance-materialized-video"
    );
    await expect(
      page.locator('.react-flow__node[data-id="acceptance-video-tail"]')
    ).toHaveCount(0);
    await expect(
      page.locator('.react-flow__node[data-id="auto-reused-image"]')
    ).toHaveCount(1);

    await inspector.getByRole("tab", { name: "运行" }).click();
    await inspector.getByLabel("运行历史").selectOption(historicalRunId);
    await page
      .locator('.react-flow__node[data-id="auto-image"]')
      .dispatchEvent("click");
    await inspector.getByRole("tab", { name: "结果" }).click();
    await expect(
      inspector.getByRole("img", { name: "自动图片" })
    ).toHaveCount(0);
    await expect(
      inspector.getByText("暂无结果", { exact: true })
    ).toBeVisible();

    const layout = await inspectLayout(page);
    assert(!layout.horizontalOverflow, `${label}: no horizontal overflow`, layout);
    assert(layout.outside.length === 0, `${label}: controls stay in viewport`, layout);
    assert(layout.nodeOverlaps.length === 0, `${label}: nodes do not overlap`, layout);
    assert(pageErrors.length === 0, `${label}: no page errors`, pageErrors);
    assert(consoleErrors.length === 0, `${label}: no console errors`, {
      consoleErrors,
      requestFailures
    });
    assert(
      externalRequests.length === 0,
      `${label}: no real Provider or TOS requests`,
      externalRequests
    );
    await page.screenshot({
      path: path.join(outputDir, `${label}.png`),
      fullPage: true
    });
    return {
      ...viewport,
      horizontalOverflow: false,
      nodeOverlaps: 0,
      consoleErrors: 0
    };
  } finally {
    await context.close();
  }
}

async function installRoutes(page) {
  await page.route("http://127.0.0.1:7777/event", (route) =>
    route.fulfill({ status: 204 })
  );
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
      created_at: "2026-10-23T00:00:00Z",
      updated_at: "2026-10-23T00:00:00Z",
      last_login_at: "2026-10-23T00:00:00Z"
    })
  );
  await page.route(`**/api/aigc/pipelines/${pipelineId}`, (route) =>
    json(route, pipeline)
  );
  await page.route(`**/api/aigc/pipelines/${pipelineId}/runs*`, (route) =>
    json(route, {
      items: [currentRun, historicalRun],
      page: 1,
      page_size: 20,
      total: 2
    })
  );
  await page.route(`**/api/aigc/runs/${runId}`, (route) =>
    json(route, currentDetail)
  );
  await page.route(`**/api/aigc/runs/${historicalRunId}`, (route) =>
    json(route, historicalDetail)
  );
  await page.route(/\/api\/assets(?:\?.*)?$/, (route) => json(route, []));
  await page.route(/\/api\/tools\/assets(?:\?.*)?$/, (route) => json(route, []));
  for (const id of [
    "acceptance-materialized-image",
    "acceptance-secondary-image",
    "acceptance-manual-image",
    "acceptance-reused-image",
    "acceptance-video-tail"
  ]) {
    await page.route(`**/api/assets/${id}/content*`, (route) =>
      route.fulfill({
        body: imageBytes,
        contentType: "image/png",
        headers: downloadHeaders(route, `${id}.png`)
      })
    );
  }
  await page.route(
    "**/api/assets/acceptance-materialized-video/content*",
    (route) =>
      route.fulfill({
        body: videoBytes,
        contentType: "video/mp4",
        headers: downloadHeaders(route, "acceptance-materialized-video.mp4")
      })
  );
}

function verifyLifecycleFixture() {
  assert(
    !snapshotDefinition.nodes.some((item) =>
      ["auto-image", "auto-video", "auto-reused-image"].includes(item.id)
    ),
    "Run snapshot has no pre-added auto output nodes"
  );
  assert(
    currentDetail.nodes.every(
      (item) => !["auto-image", "auto-video", "auto-reused-image"].includes(item.node_id)
    ),
    "RunNode set remains immutable"
  );
  assertManaged("image-model", "auto-image", "image");
  assertManaged("video-model", "auto-video", "video");
  assertManaged("reused-model", "auto-reused-image", "image");
  assert(
    persistedDefinition.nodes.filter(
      (item) =>
        item.config?.generated_by_model_node_id === "connected-model"
    ).length === 0,
    "existing downstream skips auto creation"
  );
  assert(
    persistedDefinition.nodes.filter((item) => item.type === "image").length ===
      3,
    "video tail frame does not create an image node"
  );

  const rerun = structuredClone(persistedDefinition);
  const rerunNode = rerun.nodes.find((item) => item.id === "auto-image");
  rerunNode.position = { x: 712, y: 96 };
  rerunNode.size = { width: 332, height: 244 };
  rerunNode.custom_name = "用户编辑名称";
  rerunNode.config.asset_id = "acceptance-rerun-image";
  rerunNode.config.generated_from_run_id = "acceptance-rerun";
  rerun.edges.push(edge("user-downstream", "auto-image", "manual-output", "image"));
  assert(rerunNode.id === "auto-image", "rerun keeps stable node ID");
  assert(
    rerunNode.position.x === 712 &&
      rerunNode.size.width === 332 &&
      rerunNode.custom_name === "用户编辑名称",
    "rerun preserves layout and user edits"
  );
  assert(
    rerun.edges.some((item) => item.id === "user-downstream"),
    "rerun preserves user downstream edges"
  );

  const detached = structuredClone(rerunNode);
  detached.config.generated_by_model_node_id = null;
  detached.config.generated_output_handle = null;
  detached.config.generated_from_run_id = null;
  assert(
    detached.config.asset_id === "acceptance-rerun-image",
    "edge detach preserves local asset"
  );
  const replacement = generatedNode(
    "auto-image-recreated",
    "image",
    1060,
    96,
    "重建自动图片",
    "image-model",
    "acceptance-recreated-image"
  );
  assert(
    replacement.id !== detached.id &&
      detached.config.generated_by_model_node_id === null,
    "detached node stays local and a new managed node is created"
  );

  const dirtyLocal = structuredClone(rerunNode);
  const server = structuredClone(rerunNode);
  dirtyLocal.position = { x: 800, y: 140 };
  dirtyLocal.custom_name = "本地未保存命名";
  server.config.asset_id = "acceptance-server-image";
  server.config.generated_from_run_id = "acceptance-server-run";
  const merged = {
    ...server,
    position: dirtyLocal.position,
    custom_name: dirtyLocal.custom_name
  };
  assert(
    merged.position.x === 800 &&
      merged.custom_name === "本地未保存命名" &&
      merged.config.asset_id === "acceptance-server-image",
    "dirty revision merge preserves local edits and accepts server provenance"
  );
  assert(
    historicalRun.id !== rerunNode.config.generated_from_run_id,
    "historical Run provenance is isolated"
  );
}

function assertManaged(sourceId, targetId, modality) {
  const target = persistedDefinition.nodes.find((item) => item.id === targetId);
  const matching = persistedDefinition.edges.filter(
    (item) =>
      item.sourceNodeId === sourceId &&
      item.sourceHandle === modality &&
      item.targetNodeId === targetId &&
      item.targetHandle === modality
  );
  assert(
    target?.config.generated_by_model_node_id === sourceId &&
      target.config.generated_output_handle === modality &&
      target.config.generated_from_run_id === runId &&
      matching.length === 1,
    `${sourceId} has one persisted managed node and standard edge`
  );
}

async function assertDownload(link, assetId) {
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("download", /.+/);
  const href = await link.getAttribute("href");
  assert(href?.includes(`/api/assets/${assetId}/content?download=1`), "download URL");
  const response = await link.page().evaluate(async (url) => {
    const result = await fetch(url);
    return {
      disposition: result.headers.get("content-disposition"),
      ok: result.ok
    };
  }, href);
  assert(response.ok && response.disposition, "controlled download responds");
}

async function inspectLayout(page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const controls = [...document.querySelectorAll("button, a, select")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          box.width > 0 &&
          box.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, right: box.right };
      });
    const nodes = [...document.querySelectorAll(".react-flow__node")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          id: element.getAttribute("data-id"),
          x: box.x,
          y: box.y,
          right: box.right,
          bottom: box.bottom
        };
      });
    const nodeOverlaps = [];
    for (let index = 0; index < nodes.length; index += 1) {
      for (let other = index + 1; other < nodes.length; other += 1) {
        const left = nodes[index];
        const right = nodes[other];
        if (
          Math.min(left.right, right.right) - Math.max(left.x, right.x) > 2 &&
          Math.min(left.bottom, right.bottom) - Math.max(left.y, right.y) > 2
        ) {
          nodeOverlaps.push([left.id, right.id]);
        }
      }
    }
    return {
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      outside: controls.filter((item) => item.x < -1 || item.right > width + 1),
      nodeOverlaps
    };
  });
}

function node(id, type, x, y, customName) {
  const config =
    type === "video_generation"
      ? {
          model: "doubao-seedance-2-5-260628",
          generation_mode: "text_to_video",
          resolution: "1080p",
          aspect_ratio: "16:9",
          duration_seconds: 5,
          generate_audio: true
        }
      : {
          model: "doubao-seedream-5-0-pro-260628",
          aspect_ratio: "1:1",
          size: "2K",
          format: "png"
        };
  return {
    id,
    type,
    custom_name: customName,
    position: { x, y },
    size: { width: 240, height: 180 },
    config
  };
}

function localImageNode(id, x, y, customName) {
  return {
    ...node(id, "image", x, y, customName),
    size: { width: 260, height: 220 },
    config: {
      asset_id: "acceptance-manual-image",
      bbox: null,
      bbox_asset_id: null,
      title: null
    }
  };
}

function generatedNode(id, type, x, y, customName, sourceId, assetId) {
  return {
    ...node(id, type, x, y, customName),
    size: { width: 260, height: 220 },
    config: {
      asset_id: assetId,
      ...(type === "image" ? { bbox: null, bbox_asset_id: null } : {}),
      title: null,
      generated_by_model_node_id: sourceId,
      generated_output_handle: type,
      generated_from_run_id: runId
    }
  };
}

function edge(id, sourceNodeId, targetNodeId, modality) {
  return {
    id,
    sourceNodeId,
    sourceHandle: modality,
    targetNodeId,
    targetHandle: modality
  };
}

function textEdge(id, targetNodeId) {
  return {
    id,
    sourceNodeId: "shared-prompt",
    sourceHandle: "text",
    targetNodeId,
    targetHandle: "prompt"
  };
}

function run(id, runNumber, status) {
  return {
    id,
    pipeline_id: pipelineId,
    run_number: runNumber,
    pipeline_revision: 1,
    mode: "full",
    start_node_id: null,
    source_run_id: null,
    source_node_id: null,
    status,
    definition_snapshot: snapshotDefinition,
    input_snapshot: {},
    error:
      status === "failed"
        ? { code: "mock_failed", message: "Mock history", stage: "test" }
        : null,
    cancellation_requested: false,
    created_at: `2026-10-23T00:00:0${runNumber}Z`,
    updated_at: `2026-10-23T00:00:0${runNumber + 1}Z`,
    started_at: `2026-10-23T00:00:0${runNumber}Z`,
    finished_at: `2026-10-23T00:00:0${runNumber + 1}Z`
  };
}

function runNode(nodeId, status, assets) {
  return {
    node_id: nodeId,
    included_in_plan: true,
    status,
    current_task_id: null,
    reused_from_task_id: status === "reused" ? "mock-cached-task" : null,
    input_hash: "acceptance",
    result: {
      kind: assets.length > 0 ? "assets" : "none",
      metadata: {},
      naming: null,
      text: null,
      text_digest: null,
      assets
    },
    error:
      status === "failed"
        ? { code: "mock_failed", message: "Mock history", stage: "test" }
        : null,
    attempts: []
  };
}

function asset(assetId, ordinal, mimeType) {
  return {
    asset_id: assetId,
    ordinal,
    mime_type: mimeType,
    download_url: `/api/assets/${assetId}/content`,
    available: true,
    metadata: {}
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

function assert(condition, message, detail) {
  if (!condition) {
    throw new Error(
      `${message}${detail === undefined ? "" : `: ${JSON.stringify(detail)}`}`
    );
  }
}
