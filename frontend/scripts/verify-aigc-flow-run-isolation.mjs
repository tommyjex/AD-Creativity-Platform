import { chromium } from "@playwright/test";

const fixture = parseFixture(process.env.AIGC_FLOW_ISOLATION_FIXTURE);
const viewports = [
  { height: 1000, name: "desktop-1440x1000", width: 1440 },
  { height: 768, name: "desktop-1024x768", width: 1024 },
  { height: 844, name: "mobile-390x844", width: 390 }
];
const successfulBranchA = runDetail({
  id: "acceptance-run-a",
  mode: "from_node",
  resultAsset: {
    asset_id: "acceptance-branch-a-image",
    ordinal: 0,
    mime_type: "image/png",
    download_url: "/api/assets/acceptance-branch-a-image/content",
    available: true,
    metadata: {}
  },
  resultNodeIds: ["branch-a-model", "branch-a-output"],
  runNumber: 101,
  startNodeId: "branch-a-model",
  status: "succeeded"
});
const activeBranchB = runDetail({
  id: "acceptance-run-b",
  mode: "from_node",
  runNumber: 102,
  runningNodeId: "branch-b-model",
  startNodeId: "branch-b-model",
  status: "running"
});
const failedBranchC = runDetail({
  errorNodeId: "branch-c-model",
  id: "acceptance-run-c",
  mode: "from_node",
  runNumber: 103,
  startNodeId: "branch-c-model",
  status: "failed"
});
const paginatedRuns = [
  failedBranchC.run,
  activeBranchB.run,
  successfulBranchA.run,
  ...Array.from({ length: 100 }, (_, index) =>
    historicalRun(100 - index)
  )
];
const browser = await chromium.launch({
  args: ["--disable-breakpad", "--disable-crash-reporter"],
  headless: !process.argv.includes("--headed")
});
const results = [];

try {
  for (const viewport of viewports) {
    results.push(await verifyViewport(browser, viewport));
  }
  console.log(
    JSON.stringify(
      {
        pipelineId: fixture.pipelineId,
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
    viewport: { height: viewport.height, width: viewport.width }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestedListPages = new Set();
  const unexpectedRunRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/favicon.ico", (route) =>
    route.fulfill({ body: "", status: 204 })
  );
  await page.route("http://127.0.0.1:7777/event", (route) =>
    route.fulfill({ body: "", status: 204 })
  );
  await installFlowIsolationRoutes(
    page,
    fixture.pipelineId,
    requestedListPages,
    unexpectedRunRequests
  );

  try {
    await page.goto(fixture.pipelineUrl, { waitUntil: "domcontentloaded" });
    await page.getByTestId("aigc-editor-header").waitFor();
    await page
      .locator('.react-flow__node[data-id="branch-a-model"]')
      .waitFor();
    await waitForCondition(
      () => requestedListPages.has(1) && requestedListPages.has(2),
      `${viewport.name}: Run 列表完成多页请求`
    );
    assert(
      await page.getByTestId("aigc-command-execute").isDisabled(),
      `${viewport.name}: 活动分支存在时禁止执行全部`
    );

    await selectNode(page, "branch-a-model");
    const branchAButton = page.getByRole("button", {
      name: "从此节点运行"
    });
    await branchAButton.waitFor();
    assert(
      await branchAButton.isEnabled(),
      `${viewport.name}: 分支 A 不受活动分支 B 影响`
    );
    assertButtonInsideViewport(
      await branchAButton.boundingBox(),
      viewport,
      `${viewport.name}: 分支 A 局部执行按钮`
    );

    await page.getByRole("button", { name: "关闭详情栏" }).click();
    await selectNode(page, "branch-b-model");
    const branchBButton = page.getByRole("button", {
      name: "从此节点运行"
    });
    await branchBButton.waitFor();
    assert(
      await branchBButton.isDisabled(),
      `${viewport.name}: 活动分支 B 禁止重复运行`
    );
    assertButtonInsideViewport(
      await branchBButton.boundingBox(),
      viewport,
      `${viewport.name}: 分支 B 局部执行按钮`
    );
    await page.getByRole("tab", { name: "运行" }).click();
    const inspector = page.getByTestId("aigc-inspector");
    await inspector
      .getByLabel("运行历史")
      .selectOption(activeBranchB.run.id);
    await inspector.getByText("Run #102", { exact: true }).waitFor();
    await inspector.getByText("运行中", { exact: true }).first().waitFor();

    await page.getByRole("button", { name: "关闭详情栏" }).click();
    await selectNode(page, "branch-c-model");
    await page.getByRole("tab", { name: "运行" }).click();
    await inspector
      .getByLabel("运行历史")
      .selectOption(failedBranchC.run.id);
    await inspector.getByText("Run #103", { exact: true }).waitFor();
    await inspector
      .getByText("分支 C Mock 失败", { exact: true })
      .first()
      .waitFor();

    await page.getByRole("button", { name: "关闭详情栏" }).click();
    await selectNode(page, "branch-a-output");
    await inspector.waitFor();
    await inspector.getByRole("tab", { name: "结果" }).click();
    const branchAImage = inspector.getByAltText("分支 A 图片");
    await branchAImage.waitFor();
    assert(
      await branchAImage.isVisible(),
      `${viewport.name}: 分支 A 历史成功图片保持可见`
    );
    assert(
      await inspector.getByRole("link", { name: "下载图片" }).isVisible(),
      `${viewport.name}: 分支 A 图片仍可下载`
    );

    const layout = await inspectLayout(page);
    assert(
      !layout.horizontalOverflow,
      `${viewport.name}: 页面无横向溢出`,
      layout
    );
    assert(
      layout.outsideViewport.length === 0,
      `${viewport.name}: 可见操作按钮均位于视口内`,
      layout.outsideViewport
    );
    assert(
      layout.overlaps.length === 0,
      `${viewport.name}: 可见操作按钮互不重叠`,
      layout.overlaps
    );
    assert(
      unexpectedRunRequests.length === 0,
      `${viewport.name}: Run API 请求均命中确定性响应`,
      unexpectedRunRequests
    );
    assert(
      consoleErrors.length === 0,
      `${viewport.name}: 控制台无错误`,
      consoleErrors
    );
    assert(
      pageErrors.length === 0,
      `${viewport.name}: 页面无运行时错误`,
      pageErrors
    );

    return {
      height: viewport.height,
      name: viewport.name,
      requestedListPages: [...requestedListPages].sort((a, b) => a - b),
      width: viewport.width
    };
  } finally {
    await context.close();
  }
}

async function installFlowIsolationRoutes(
  page,
  pipelineId,
  requestedListPages,
  unexpectedRunRequests
) {
  const escapedPipelineId = escapeRegExp(pipelineId);
  await page.route(
    new RegExp(
      `/api/aigc/pipelines/${escapedPipelineId}/runs(?:\\?.*)?$`
    ),
    async (route) => {
      const request = route.request();
      if (request.method() !== "GET") {
        unexpectedRunRequests.push(`${request.method()} ${request.url()}`);
        await route.fulfill({ body: "", status: 405 });
        return;
      }
      const url = new URL(request.url());
      const pageNumber = positiveInteger(url.searchParams.get("page"), 1);
      const pageSize = positiveInteger(
        url.searchParams.get("page_size"),
        20
      );
      const start = (pageNumber - 1) * pageSize;
      requestedListPages.add(pageNumber);
      await route.fulfill({
        contentType: "application/json",
        json: {
          items: paginatedRuns.slice(start, start + pageSize),
          page: pageNumber,
          page_size: pageSize,
          total: paginatedRuns.length
        }
      });
    }
  );
  await page.route(/\/api\/aigc\/runs\/[^/?]+(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const runId = decodeURIComponent(
      new URL(request.url()).pathname.split("/").at(-1) ?? ""
    );
    const detail =
      runId === activeBranchB.run.id
        ? activeBranchB
        : runId === successfulBranchA.run.id
          ? successfulBranchA
          : runId === failedBranchC.run.id
            ? failedBranchC
            : null;
    if (request.method() !== "GET" || detail === null) {
      unexpectedRunRequests.push(`${request.method()} ${request.url()}`);
      await route.fulfill({
        contentType: "application/json",
        json: { detail: "Unexpected Run API request" },
        status: 404
      });
      return;
    }
    await route.fulfill({ contentType: "application/json", json: detail });
  });
  await page.route(
    "**/api/assets/acceptance-branch-a-image/content*",
    (route) =>
      route.fulfill({
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64"
        ),
        contentType: "image/png",
        status: 200
      })
  );
}

function getProjectionIds(definition, startNodeId) {
  const nodeIds = new Set(definition.nodes.map((node) => node.id));
  const children = new Map(
    definition.nodes.map((node) => [node.id, new Set()])
  );
  const parents = new Map(
    definition.nodes.map((node) => [node.id, new Set()])
  );
  for (const edge of definition.edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      continue;
    }
    children.get(edge.sourceNodeId)?.add(edge.targetNodeId);
    parents.get(edge.targetNodeId)?.add(edge.sourceNodeId);
  }
  const projected = walkIds(startNodeId, children);
  const pending = [...projected];
  while (pending.length > 0) {
    const current = pending.shift();
    for (const parent of parents.get(current) ?? []) {
      if (projected.has(parent)) continue;
      projected.add(parent);
      pending.push(parent);
    }
  }
  return projected;
}

function walkIds(startNodeId, adjacency) {
  const visited = new Set([startNodeId]);
  const pending = [startNodeId];
  while (pending.length > 0) {
    const current = pending.shift();
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      pending.push(neighbor);
    }
  }
  return visited;
}

function runDetail({
  errorNodeId = null,
  id,
  mode,
  resultAsset = null,
  resultNodeIds = [],
  runNumber,
  runningNodeId = null,
  startNodeId,
  status
}) {
  const now = "2026-09-05T14:00:00Z";
  const run = {
    id,
    pipeline_id: fixture.pipelineId,
    run_number: runNumber,
    pipeline_revision: fixture.pipeline.revision,
    mode,
    start_node_id: startNodeId,
    source_run_id: null,
    source_node_id: null,
    status,
    definition_snapshot: fixture.definition,
    input_snapshot: {},
    error:
      errorNodeId === null
        ? null
        : {
            code: "MOCK_BRANCH_FAILED",
            message: "分支 C Mock 失败",
            request_id: null,
            stage: "provider"
          },
    cancellation_requested: false,
    created_at: now,
    updated_at: now,
    started_at: now,
    finished_at: status === "running" ? null : now
  };
  const projectedIds = getProjectionIds(fixture.definition, startNodeId);
  const nodes = fixture.definition.nodes.map((node) => ({
    node_id: node.id,
    included_in_plan: projectedIds.has(node.id),
    status:
      node.id === runningNodeId
        ? "running"
        : node.id === errorNodeId
          ? "failed"
          : resultNodeIds.includes(node.id)
            ? "succeeded"
            : "idle",
    current_task_id: null,
    reused_from_task_id: null,
    input_hash: null,
    result: {
      kind:
        resultAsset !== null && resultNodeIds.includes(node.id)
          ? "assets"
          : "none",
      text: null,
      text_digest: null,
      assets:
        resultAsset !== null && resultNodeIds.includes(node.id)
          ? [resultAsset]
          : []
    },
    error:
      node.id === errorNodeId
        ? {
            code: "MOCK_BRANCH_FAILED",
            message: "分支 C Mock 失败",
            request_id: null,
            stage: "provider"
          }
        : null,
    attempts: []
  }));
  return { nodes, run };
}

function historicalRun(runNumber) {
  const now = "2026-09-04T14:00:00Z";
  const nodeId = `historical-node-${runNumber}`;
  return {
    id: `historical-run-${runNumber}`,
    pipeline_id: fixture.pipelineId,
    run_number: runNumber,
    pipeline_revision: fixture.pipeline.revision,
    mode: "from_node",
    start_node_id: nodeId,
    source_run_id: null,
    source_node_id: null,
    status: "failed",
    definition_snapshot: {
      schemaVersion: 2,
      nodes: [
        {
          id: nodeId,
          type: "text",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { bbox_references: [], text: "", title: null }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    },
    input_snapshot: {},
    error: null,
    cancellation_requested: false,
    created_at: now,
    updated_at: now,
    started_at: now,
    finished_at: now
  };
}

async function selectNode(page, nodeId) {
  const node = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  await node.waitFor();
  await node.dispatchEvent("click");
}

async function inspectLayout(page) {
  return page.evaluate(() => {
    const selectors = [
      '[data-testid="aigc-editor-actions"] button',
      '[data-testid="aigc-inspector"] button'
    ];
    const buttons = selectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)]
    );
    const visible = buttons.flatMap((button, index) => {
      const box = button.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return [];
      return [
        {
          box: {
            bottom: box.bottom,
            left: box.left,
            right: box.right,
            top: box.top
          },
          label:
            button.getAttribute("aria-label") ||
            button.textContent?.trim() ||
            `button-${index}`
        }
      ];
    });
    const outsideViewport = visible
      .filter(
        ({ box }) =>
          box.left < -0.5 ||
          box.top < -0.5 ||
          box.right > window.innerWidth + 0.5 ||
          box.bottom > window.innerHeight + 0.5
      )
      .map(({ label }) => label);
    const overlaps = [];
    for (let leftIndex = 0; leftIndex < visible.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < visible.length;
        rightIndex += 1
      ) {
        const left = visible[leftIndex];
        const right = visible[rightIndex];
        const overlapWidth =
          Math.min(left.box.right, right.box.right) -
          Math.max(left.box.left, right.box.left);
        const overlapHeight =
          Math.min(left.box.bottom, right.box.bottom) -
          Math.max(left.box.top, right.box.top);
        if (overlapWidth > 0.5 && overlapHeight > 0.5) {
          overlaps.push([left.label, right.label]);
        }
      }
    }
    return {
      horizontalOverflow:
        document.documentElement.scrollWidth >
        window.innerWidth + 1,
      outsideViewport,
      overlaps
    };
  });
}

function assertButtonInsideViewport(box, viewport, label) {
  assert(
    box !== null &&
      box.x >= -0.5 &&
      box.y >= -0.5 &&
      box.x + box.width <= viewport.width + 0.5 &&
      box.y + box.height <= viewport.height + 0.5,
    `${label}位于视口内`,
    box
  );
}

async function waitForCondition(predicate, label, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`等待超时: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function parseFixture(rawFixture) {
  if (!rawFixture) {
    throw new Error(
      "缺少 AIGC_FLOW_ISOLATION_FIXTURE，请先运行 acceptance:aigc-flow-isolation:fixture。"
    );
  }
  const parsed = JSON.parse(rawFixture);
  if (
    !parsed.pipelineId ||
    !parsed.pipelineUrl ||
    !Number.isInteger(parsed.pipeline?.revision) ||
    !parsed.definition
  ) {
    throw new Error(
      "AIGC_FLOW_ISOLATION_FIXTURE 必须包含 pipelineId、pipelineUrl、pipeline 和 definition。"
    );
  }
  const nodeIds = new Set(parsed.definition.nodes?.map((node) => node.id));
  for (const nodeId of [
    "shared-parser",
    "branch-a-model",
    "branch-a-output",
    "branch-b-model",
    "branch-b-output",
    "branch-c-model",
    "branch-c-output"
  ]) {
    if (!nodeIds.has(nodeId)) {
      throw new Error(`AIGC_FLOW_ISOLATION_FIXTURE 缺少节点 ${nodeId}。`);
    }
  }
  return parsed;
}

function positiveInteger(rawValue, fallback) {
  const value = Number.parseInt(rawValue ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assert(condition, label, detail = null) {
  if (!condition) {
    throw new Error(
      `ASSERT FAIL ${label}${
        detail === null ? "" : `: ${JSON.stringify(detail)}`
      }`
    );
  }
  console.log(`ASSERT PASS ${label}`);
}
