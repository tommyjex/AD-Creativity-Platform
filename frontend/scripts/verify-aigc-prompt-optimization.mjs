import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const backendBaseUrl = (
  process.env.BACKEND_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");
const frontendBaseUrl = (
  process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "");
const artifactsPath = fileURLToPath(
  new URL("../../test-results/aigc-prompt-optimization/", import.meta.url)
);
const viewports = [
  { height: 900, name: "desktop-1440x900", width: 1440 },
  { height: 844, name: "narrow-390x844", width: 390 }
];
const scenarios = [
  {
    id: "local-add-text",
    mode: "local",
    expectedType: "图像编辑",
    expected: [
      '"限时优惠"',
      "ACME",
      "Pro-X1",
      "红色",
      "2",
      "不要增加阴影"
    ],
    bbox: true
  },
  {
    id: "local-color",
    mode: "local",
    expectedType: "图像编辑",
    expected: ["ACME", "Pro-X1", "蓝色"]
  },
  {
    id: "local-background",
    mode: "local",
    expectedType: "图像编辑",
    expected: ["ACME", "ZX-9", "红色"]
  },
  { id: "full-no-image", mode: "full", expectedType: "文生图" },
  {
    id: "full-style",
    mode: "full",
    expectedType: "参考图生图",
    expected: ["不要多余人物"]
  },
  { id: "full-recompose", mode: "full", expectedType: "参考图生图" },
  {
    id: "full-multi-reference",
    mode: "full",
    expectedType: "参考图生图",
    expected: ["ACME", "Pro-X1", "红色", "2", "不要多余人物"]
  },
  {
    id: "full-text-to-image",
    mode: "full",
    expectedType: "文生图",
    expected: [
      '"新品上市"',
      "ACME",
      "Pro-X1",
      "蓝色",
      "2",
      "不要多余人物"
    ]
  }
];

await mkdir(artifactsPath, { recursive: true });
const initialAudit = await fetchJson(`${backendBaseUrl}/api/_acceptance/audit`);
const browser = await chromium.launch({
  args: ["--disable-breakpad", "--disable-crash-reporter"],
  headless: !process.argv.includes("--headed")
});
const results = [];
const allOptimizeRequests = [];
const forbiddenRequests = [];

try {
  for (const viewport of viewports) {
    const pipeline = await createPipeline(viewport.name);
    results.push(
      await verifyViewport(browser, viewport, pipeline, {
        allOptimizeRequests,
        forbiddenRequests
      })
    );
  }
} finally {
  await browser.close();
}

const finalAudit = await fetchJson(`${backendBaseUrl}/api/_acceptance/audit`);
const expectedClicks = viewports.length * (scenarios.length + 1);
const requestsPerViewport = scenarios.length + 1;
const providerCalls = finalAudit.provider.optimization_calls.slice(
  initialAudit.provider.optimization_calls.length
);
const optimizationLogs = finalAudit.logs.slice(initialAudit.logs.length);

assert(
  allOptimizeRequests.length === expectedClicks,
  "每次点击只发送一个优化 HTTP 请求",
  { actual: allOptimizeRequests.length, expected: expectedClicks }
);
for (let viewportIndex = 0; viewportIndex < viewports.length; viewportIndex += 1) {
  const requests = allOptimizeRequests.slice(
    viewportIndex * requestsPerViewport,
    (viewportIndex + 1) * requestsPerViewport
  );
  const expectedSources = [
    ["image-a", "image"],
    ["image-a", "image"],
    ["image-a", "edit_image"],
    null,
    ["image-a", "image"],
    ["image-a", "image"],
    null
  ];
  for (let index = 0; index < expectedSources.length; index += 1) {
    const request = requests[index];
    const context = request.pipeline_context;
    assert(
      context?.pipeline_id === results[viewportIndex].pipelineId &&
        context.definition_snapshot?.schemaVersion === 2,
      `${viewports[viewportIndex].name}/${scenarios[index].id}: 请求包含当前 Pipeline 快照`
    );
    const expectedSource = expectedSources[index];
    if (expectedSource === null) {
      assert(
        context.source_image === null,
        `${viewports[viewportIndex].name}/${scenarios[index].id}: 无合格单图来源`
      );
    } else {
      assert(
        context.source_image?.source_node_id === expectedSource[0] &&
          context.source_image?.target_handle === expectedSource[1] &&
          context.source_image?.asset_id === "prompt-optimization-image-a" &&
          context.source_image?.run_id === null,
        `${viewports[viewportIndex].name}/${scenarios[index].id}: source_image 身份与端口正确`,
        context.source_image
      );
    }
  }
  const bboxRequest = requests[0];
  const bboxNode = bboxRequest.pipeline_context.definition_snapshot.nodes.find(
    (node) => node.id === "image-a"
  );
  assert(
    bboxNode?.config?.bbox?.x1 === 120 &&
      bboxNode?.config?.bbox?.y1 === 180 &&
      bboxNode?.config?.bbox?.x2 === 760 &&
      bboxNode?.config?.bbox?.y2 === 820 &&
      bboxRequest.reference_instructions.length === 1,
    `${viewports[viewportIndex].name}: 请求快照保留 BBox 与引用说明`
  );
  assert(
    requests[7].target_type === "text_to_image" &&
      !("pipeline_context" in requests[7]),
    `${viewports[viewportIndex].name}/full-text-to-image: 不发送图生图上下文`
  );
}
assert(
  providerCalls.length === expectedClicks,
  "每次点击只调用一次 Mock Provider",
  { actual: providerCalls.length, expected: expectedClicks }
);
assert(
  providerCalls.every((call) => call.input_image_count <= 1),
  "每次 Provider 调用最多发送一张受控图片",
  providerCalls
);
assert(
  providerCalls.filter((call) => call.input_image_count === 1).length ===
    viewports.length * 6,
  "局部场景、单图完整设计和全屏草稿优化发送受控图片",
  providerCalls
);
assert(
  allOptimizeRequests.every(
    (request) =>
      !/https?:\/\/|object_key|signed|binary|base64/i.test(
        JSON.stringify(request)
      )
  ),
  "浏览器优化请求未泄露 URL、对象 Key 或图片二进制"
);
assert(
  forbiddenRequests.length === 0,
  "未发送 Run/Task/图片生成 mutation",
  forbiddenRequests
);
assert(
  finalAudit.provider.image_generation_calls ===
    initialAudit.provider.image_generation_calls,
  "Mock Provider 未调用图片生成"
);
for (const key of ["runs", "tasks", "tool_tasks", "assets"]) {
  assert(
    finalAudit.persistence[key] === initialAudit.persistence[key],
    `持久化 ${key} 数量未变化`,
    {
      before: initialAudit.persistence[key],
      after: finalAudit.persistence[key]
    }
  );
}
assert(
  optimizationLogs.filter(
    (record) => record.message === "AIGC prompt optimization completed"
  ).length === expectedClicks &&
    optimizationLogs.every(
      (record) =>
        !/https?:\/\/|asset[_ -]?id|run[_ -]?id|secret|token/i.test(
          JSON.stringify(record)
        )
    ),
  "优化日志完整且不包含 URL、资产 ID、Run ID 或密钥",
  optimizationLogs
);

console.log(
  JSON.stringify(
    {
      artifactsPath,
      optimizationHttpRequests: allOptimizeRequests.length,
      optimizationLogs: optimizationLogs.length,
      providerCalls,
      result: "PASS",
      viewports: results
    },
    null,
    2
  )
);

async function verifyViewport(browserInstance, viewport, pipeline, audit) {
  const context = await browserInstance.newContext({
    viewport: { height: viewport.height, width: viewport.width }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const responseErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    requestFailures.push(
      `${request.failure()?.errorText ?? "failed"} ${request.url()}`
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      const url = new URL(response.url());
      if (url.hostname === "127.0.0.1" && url.port === "7778") return;
      responseErrors.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
    }
  });
  await page.route("**/favicon.ico", (route) =>
    route.fulfill({ body: "", status: 204 })
  );
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      url.hostname === "127.0.0.1" &&
      ["7777", "7778"].includes(url.port) &&
      url.pathname === "/event"
    ) {
      await route.fulfill({ body: "", status: 204 });
      return;
    }
    if (isForbiddenMutation(request.method(), url.pathname)) {
      audit.forbiddenRequests.push(`${request.method()} ${url.pathname}`);
      await route.abort("blockedbyclient");
      return;
    }
    if (
      !isLocalHost(url.hostname) &&
      !["data:", "blob:"].includes(url.protocol)
    ) {
      await route.abort("blockedbyclient");
      return;
    }
    if (
      request.method() === "POST" &&
      url.pathname === "/api/aigc/prompts/optimize"
    ) {
      audit.allOptimizeRequests.push(request.postDataJSON());
    }
    await route.continue();
  });

  try {
    await page.goto(
      `${frontendBaseUrl}/workspace/aigc/acceptance?pipelineId=${pipeline.id}`,
      { timeout: 120_000, waitUntil: "domcontentloaded" }
    );
    await page.getByTestId("aigc-editor-header").waitFor();
    await page.locator('.react-flow__node[data-id="local-add-text"]').waitFor();

    const scenarioResults = [];
    for (const scenario of scenarios) {
      const result = await optimizeScenario(page, scenario, viewport.name);
      scenarioResults.push(result);
      if (scenario.id === "local-add-text" || scenario.id === "full-multi-reference") {
        await page.screenshot({
          fullPage: true,
          path: `${artifactsPath}/${viewport.name}-${scenario.id}.png`
        });
      }
    }
    const fullscreenEditor = await verifyFullscreenPromptEditor(
      page,
      viewport,
      viewport.name,
      audit
    );

    assert(
      consoleErrors.length === 0,
      `${viewport.name}: 控制台无错误`,
      { consoleErrors, requestFailures }
    );
    assert(
      pageErrors.length === 0,
      `${viewport.name}: 页面无运行时错误`,
      pageErrors
    );
    assert(
      responseErrors.length === 0,
      `${viewport.name}: 页面请求无 HTTP 错误`,
      responseErrors
    );
    return {
      height: viewport.height,
      name: viewport.name,
      pipelineId: pipeline.id,
      scenarios: scenarioResults,
      fullscreenEditor,
      width: viewport.width
    };
  } finally {
    await context.close();
  }
}

async function optimizeScenario(page, scenario, viewportName) {
  await page
    .locator(`.react-flow__node[data-id="${scenario.id}"]`)
    .dispatchEvent("click");
  const inspector = page.getByTestId("aigc-inspector");
  await inspector.waitFor({ state: "visible" });
  const promptPreview = inspector.getByTestId("aigc-prompt-preview");
  await promptPreview.waitFor({ state: "visible" });
  await inspector.getByRole("button", { name: "优化提示词" }).click();

  const dialog = page.getByTestId("aigc-prompt-optimization-dialog");
  await dialog.waitFor({ state: "visible" });
  const dialogLayout = await inspectDialogLayout(page, dialog);
  assert(
    !dialogLayout.horizontalOverflow &&
      dialogLayout.insideViewport &&
      dialogLayout.actionsReachable &&
      !dialogLayout.footerOverlap,
    `${viewportName}/${scenario.id}: 优化弹窗无溢出、重叠且操作可达`,
    dialogLayout
  );
  await dialog.getByRole("button", { name: "开始优化" }).click();
  await dialog.waitFor({ state: "hidden" });
  await inspector
    .getByText(
      new RegExp(`^提示词已优化（${scenario.expectedType}）(?:：|$)`)
    )
    .waitFor();

  const optimized = (await promptPreview.textContent()) ?? "";
  assert(
    optimized?.trim().length > 0 &&
      !/(?:Composition|Negative Prompt|Edit Instructions):/i.test(optimized),
    `${viewportName}/${scenario.id}: 显示 Seedream 自然语言提示词`,
    optimized
  );
  for (const expected of scenario.expected ?? []) {
    assert(
      optimized.toLowerCase().includes(expected.toLowerCase()),
      `${viewportName}/${scenario.id}: 保留关键字面量 ${expected}`,
      optimized
    );
  }

  let bboxVerified = false;
  if (scenario.bbox) {
    const bboxGroup = inspector.getByRole("group", {
      name: /BBox 引用：.*bbox 120 180 760 820/
    });
    await bboxGroup.waitFor({ state: "visible" });
    const reference = inspector.locator(
      'textarea[aria-label^="框选引用说明："]'
    );
    const referenceText = await reference.inputValue();
    assert(
      referenceText === '保持框选区域内的 "ACME" logo 不变',
      `${viewportName}/${scenario.id}: BBox 引用说明原样保留`,
      referenceText
    );
    bboxVerified = true;
  }

  const layout = await inspectResultLayout(page, inspector, promptPreview);
  assert(
    !layout.horizontalOverflow &&
      layout.textReadable &&
      layout.inspectorInsideViewport,
    `${viewportName}/${scenario.id}: 优化结果可读且无横向溢出`,
    layout
  );
  return {
    bboxVerified,
    id: scenario.id,
    lineCount: optimized.split("\n").length,
    mode: scenario.mode
  };
}

async function verifyFullscreenPromptEditor(
  page,
  viewport,
  viewportName,
  audit
) {
  await page
    .locator('.react-flow__node[data-id="local-add-text"]')
    .dispatchEvent("click");
  const inspector = page.getByTestId("aigc-inspector");
  const preview = inspector.getByTestId("aigc-prompt-preview");
  await preview.waitFor({ state: "visible" });
  await preview.click();

  const dialog = page.getByTestId("aigc-fullscreen-prompt-editor");
  await dialog.waitFor({ state: "visible" });
  const textarea = dialog.getByRole("textbox", { name: "完整基础文本" });
  const initialValue = await textarea.inputValue();
  assert(
    initialValue.trim().length > 0,
    `${viewportName}: 全屏编辑器完整显示当前提示词`,
    initialValue
  );
  const layout = await inspectFullscreenEditorLayout(page, dialog, textarea);
  assert(
    !layout.horizontalOverflow &&
      layout.insideViewport &&
      layout.textareaReachable &&
      !layout.footerOverlap,
    `${viewportName}: 全屏编辑器无溢出、重叠且编辑区可达`,
    layout
  );
  await page.screenshot({
    fullPage: true,
    path: `${artifactsPath}/${viewportName}-fullscreen-prompt-editor-open.png`
  });

  const draftBeforeOptimization =
    "全屏草稿优化前：保留产品主体、品牌信息与镜头节奏。\n第二行用于验证未应用草稿。";
  const previewBeforeOptimization = await preview.textContent();
  await textarea.fill(draftBeforeOptimization);
  const requestCountBeforeOptimization = audit.allOptimizeRequests.length;
  await dialog.getByRole("button", { name: "优化提示词" }).click();
  const optimizationDialog = page.getByTestId(
    "aigc-prompt-optimization-dialog"
  );
  await optimizationDialog.waitFor({ state: "visible" });
  await optimizationDialog.getByRole("button", { name: "开始优化" }).click();
  await optimizationDialog.waitFor({ state: "hidden" });
  const optimizedDraft = await textarea.inputValue();
  const optimizationRequest =
    audit.allOptimizeRequests[requestCountBeforeOptimization];
  assert(
    optimizationRequest?.text === draftBeforeOptimization,
    `${viewportName}: 全屏优化使用未应用草稿`,
    optimizationRequest
  );
  assert(
    optimizedDraft.trim().length > 0,
    `${viewportName}: 全屏优化结果写回草稿`,
    optimizedDraft
  );
  assert(
    (await preview.textContent()) === previewBeforeOptimization,
    `${viewportName}: 优化结果在应用前不写回检查器`,
    await preview.textContent()
  );

  await textarea.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");
  await dialog.waitFor({ state: "hidden" });
  assert(
    (await preview.textContent()) === optimizedDraft,
    `${viewportName}: Cmd/Ctrl+Enter 写回优化后的完整提示词`,
    await preview.textContent()
  );

  await preview.click();
  await dialog.waitFor({ state: "visible" });
  await textarea.fill("未应用的草稿");
  await textarea.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert(
    (await preview.textContent()) === optimizedDraft,
    `${viewportName}: Escape 丢弃未应用草稿`,
    await preview.textContent()
  );
  await page.screenshot({
    fullPage: true,
    path: `${artifactsPath}/${viewportName}-fullscreen-prompt-editor.png`
  });
  return {
    initialLength: initialValue.length,
    layout,
    appliedLength: optimizedDraft.length,
    viewport
  };
}

async function inspectDialogLayout(page, dialog) {
  return page.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const footer = element.querySelector(
      '[data-testid="aigc-prompt-optimization-footer"]'
    );
    const body = element.querySelector(
      '[data-testid="aigc-prompt-optimization-body"]'
    );
    const buttons = [...element.querySelectorAll("button")].filter(
      (button) => button.offsetParent !== null
    );
    const footerBox = footer?.getBoundingClientRect();
    const bodyBox = body?.getBoundingClientRect();
    return {
      actionsReachable: buttons.every((button) => {
        const buttonBox = button.getBoundingClientRect();
        return (
          buttonBox.left >= 0 &&
          buttonBox.right <= window.innerWidth &&
          buttonBox.top >= 0 &&
          buttonBox.bottom <= window.innerHeight
        );
      }),
      footerOverlap:
        Boolean(footerBox && bodyBox) && bodyBox.bottom > footerBox.top + 1,
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      insideViewport:
        box.left >= 0 &&
        box.right <= window.innerWidth &&
        box.top >= 0 &&
        box.bottom <= window.innerHeight
    };
  }, await dialog.elementHandle());
}

async function inspectFullscreenEditorLayout(page, dialog, textarea) {
  return page.evaluate(
    ([dialogElement, textElement]) => {
      const dialogBox = dialogElement.getBoundingClientRect();
      const textBox = textElement.getBoundingClientRect();
      const footer = dialogElement.querySelector(
        '[data-testid="aigc-fullscreen-prompt-editor-footer"]'
      );
      const footerBox = footer?.getBoundingClientRect();
      return {
        footerOverlap:
          Boolean(footerBox) && textBox.bottom > footerBox.top + 1,
        horizontalOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
        insideViewport:
          dialogBox.left >= 0 &&
          dialogBox.right <= window.innerWidth &&
          dialogBox.top >= 0 &&
          dialogBox.bottom <= window.innerHeight,
        textareaReachable:
          textBox.width > 0 &&
          textBox.height > 0 &&
          textBox.left >= dialogBox.left &&
          textBox.right <= dialogBox.right
      };
    },
    [await dialog.elementHandle(), await textarea.elementHandle()]
  );
}

async function inspectResultLayout(page, inspector, promptPreview) {
  return page.evaluate(
    ([inspectorElement, textElement]) => {
      const inspectorBox = inspectorElement.getBoundingClientRect();
      const textBox = textElement.getBoundingClientRect();
      return {
        horizontalOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
        inspectorInsideViewport:
          textBox.left >= 0 &&
          textBox.right <= window.innerWidth &&
          textBox.bottom > 0 &&
          textBox.top < window.innerHeight,
        textReadable:
          textBox.width > 0 &&
          textBox.height > 0 &&
          textBox.left >= inspectorBox.left &&
          textBox.right <= inspectorBox.right + 1
      };
    },
    [await inspector.elementHandle(), await promptPreview.elementHandle()]
  );
}

async function createPipeline(viewportName) {
  const response = await fetch(`${backendBaseUrl}/api/aigc/pipelines`, {
    body: JSON.stringify({
      definition: buildDefinition(),
      description:
        "Task 7.3-7.7 mock-only prompt optimization browser acceptance.",
      name: `[验收 提示词优化 ${viewportName}] ${new Date().toISOString()}`
    }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(
      `创建提示词优化验收 Pipeline 失败 (${response.status}): ${await response.text()}`
    );
  }
  return response.json();
}

function buildDefinition() {
  const nodes = [
    imageNode("image-a", 20, 20, "prompt-optimization-image-a", true),
    imageNode("image-b", 20, 300, "prompt-optimization-image-b"),
    textNode(
      "local-add-text",
      340,
      20,
      '在 ACME Pro-X1 海报底部增加文字 "限时优惠"，保留 2 件红色商品，不要增加阴影，其他内容不变。',
      [
        {
          instruction: '保持框选区域内的 "ACME" logo 不变',
          source_node_id: "image-a"
        }
      ]
    ),
    imageModel("local-add-text-target", 680, 20, "image_to_image"),
    textNode(
      "local-color",
      340,
      300,
      "把 ACME Pro-X1 外套从红色改为蓝色，保持人物、姿势、背景和光线不变，不要增加文字。"
    ),
    imageModel("local-color-target", 680, 300, "image_to_image"),
    textNode(
      "local-background",
      340,
      580,
      "只替换背景，保留红色产品，品牌: ACME，型号: ZX-9。"
    ),
    imageModel("local-background-target", 680, 580, "image_edit"),
    textNode(
      "full-no-image",
      1040,
      20,
      "为商品海报增加底部标题，保持其他内容不变。"
    ),
    imageModel("full-no-image-target", 1380, 20, "image_to_image"),
    textNode(
      "full-style",
      1040,
      300,
      "将 ACME Pro-X1 商品海报整体换风格为复古海报，保留 2 件商品，不要多余人物。"
    ),
    imageModel("full-style-target", 1380, 300, "image_to_image"),
    textNode(
      "full-recompose",
      1040,
      580,
      "重新构图 ACME Pro-X1 商品场景，保留蓝色包装，不要增加文字。"
    ),
    imageModel("full-recompose-target", 1380, 580, "image_to_image"),
    textNode(
      "full-multi-reference",
      1040,
      860,
      "结合两张参考图设计 ACME Pro-X1 海报，保留 2 件红色商品，不要多余人物。"
    ),
    imageModel("full-multi-reference-target", 1380, 860, "image_to_image"),
    textNode(
      "full-text-to-image",
      1040,
      1140,
      '为 ACME Pro-X1 创作文生图海报，展示 2 件蓝色商品和文字 "新品上市"，不要多余人物。'
    ),
    textToImageNode("full-text-to-image-target", 1380, 1140)
  ];
  const edges = [
    imageEdge("image-a", "local-add-text-target", "image"),
    promptEdge("local-add-text", "local-add-text-target"),
    imageEdge("image-a", "local-color-target", "image"),
    promptEdge("local-color", "local-color-target"),
    imageEdge("image-a", "local-background-target", "edit_image"),
    promptEdge("local-background", "local-background-target"),
    promptEdge("full-no-image", "full-no-image-target"),
    imageEdge("image-a", "full-style-target", "image"),
    promptEdge("full-style", "full-style-target"),
    imageEdge("image-a", "full-recompose-target", "image"),
    promptEdge("full-recompose", "full-recompose-target"),
    imageEdge("image-a", "full-multi-reference-target", "image"),
    imageEdge("image-b", "full-multi-reference-target", "image"),
    promptEdge("full-multi-reference", "full-multi-reference-target"),
    promptEdge("full-text-to-image", "full-text-to-image-target")
  ];
  return {
    edges,
    nodes,
    schemaVersion: 2,
    viewport: { x: 0, y: 0, zoom: 0.6 }
  };
}

function imageNode(id, x, y, assetId, withBbox = false) {
  return {
    config: {
      asset_id: assetId,
      ...(withBbox
        ? {
            bbox: { type: "bbox", x1: 120, x2: 760, y1: 180, y2: 820 },
            bbox_asset_id: assetId
          }
        : {}),
      title: id === "image-a" ? "素材图 A" : "素材图 B"
    },
    id,
    position: { x, y },
    size: { height: 220, width: 260 },
    type: "image"
  };
}

function textNode(id, x, y, text, bboxReferences = []) {
  return {
    config: {
      bbox_references: bboxReferences,
      text,
      title: id
    },
    id,
    position: { x, y },
    size: { height: 220, width: 280 },
    type: "text"
  };
}

function imageModel(id, x, y, operation) {
  return {
    config: {
      aspect_ratio: "1:1",
      format: "png",
      model: "doubao-seedream-5-0-pro-260628",
      operation,
      size: "2K"
    },
    id,
    position: { x, y },
    size: { height: 240, width: 300 },
    type: "image_to_image"
  };
}

function textToImageNode(id, x, y) {
  return {
    config: {
      aspect_ratio: "1:1",
      format: "png",
      model: "doubao-seedream-5-0-pro-260628",
      size: "2K"
    },
    id,
    position: { x, y },
    size: { height: 240, width: 300 },
    type: "text_to_image"
  };
}

function imageEdge(sourceNodeId, targetNodeId, targetHandle) {
  return {
    id: `${sourceNodeId}-${targetNodeId}-${targetHandle}`,
    sourceHandle: "image",
    sourceNodeId,
    targetHandle,
    targetNodeId
  };
}

function promptEdge(sourceNodeId, targetNodeId) {
  return {
    id: `${sourceNodeId}-${targetNodeId}-prompt`,
    sourceHandle: "text",
    sourceNodeId,
    targetHandle: "prompt",
    targetNodeId
  };
}

function isForbiddenMutation(method, pathname) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;
  return (
    /\/api\/aigc\/pipelines\/[^/]+\/runs(?:\/|$)/.test(pathname) ||
    /\/api\/aigc\/runs(?:\/|$)/.test(pathname) ||
    /\/api\/tools\/tasks(?:\/|$)/.test(pathname) ||
    /(?:generate|image-generation|images\/generate)/i.test(pathname)
  );
}

function isLocalHost(hostname) {
  return ["127.0.0.1", "localhost"].includes(hostname);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`请求失败 (${response.status}): ${url}`);
  }
  return response.json();
}

function assert(condition, label, detail = null) {
  if (!condition) {
    throw new Error(
      `ASSERT FAIL ${label}${detail === null ? "" : `: ${JSON.stringify(detail)}`}`
    );
  }
  console.log(`ASSERT PASS ${label}`);
}
