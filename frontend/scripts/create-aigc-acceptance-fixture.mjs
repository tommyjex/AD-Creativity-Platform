const backendBaseUrl = (
  process.env.BACKEND_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");
const frontendBaseUrl = (
  process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "");
const createNodeLabelsFixture = process.argv.includes("--node-labels");
const createCustomDimensionsFixture = process.argv.includes(
  "--custom-dimensions"
);
const createFlowIsolationFixture = process.argv.includes("--flow-isolation");

if (
  [
    createNodeLabelsFixture,
    createCustomDimensionsFixture,
    createFlowIsolationFixture
  ].filter(Boolean).length > 1
) {
  throw new Error(
    "--node-labels、--custom-dimensions 与 --flow-isolation 不能同时使用"
  );
}

const defaultDefinition = {
  schemaVersion: 2,
  nodes: [
    {
      id: "acceptance-prompt",
      type: "text",
      position: { x: 40, y: 40 },
      size: { width: 240, height: 160 },
      config: {
        text: "验收 fixture：仅用于保存和布局检查，不执行生成。",
        bbox_references: [],
        title: null
      }
    },
    {
      id: "acceptance-video-input",
      type: "video",
      position: { x: 40, y: 260 },
      size: { width: 240, height: 180 },
      config: { asset_id: null, title: null }
    },
    {
      id: "acceptance-audio-input",
      type: "audio",
      position: { x: 40, y: 480 },
      size: { width: 240, height: 160 },
      config: { asset_id: null, title: null }
    },
    {
      id: "acceptance-video-model",
      type: "video_generation",
      position: { x: 360, y: 120 },
      size: { width: 260, height: 220 },
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
      id: "acceptance-video-output",
      type: "video",
      position: { x: 700, y: 120 },
      size: { width: 260, height: 220 },
      config: { asset_id: null, title: "验收视频结果" }
    }
  ],
  edges: [
    {
      id: "acceptance-prompt-edge",
      sourceNodeId: "acceptance-prompt",
      sourceHandle: "text",
      targetNodeId: "acceptance-video-model",
      targetHandle: "prompt"
    },
    {
      id: "acceptance-output-edge",
      sourceNodeId: "acceptance-video-model",
      sourceHandle: "video",
      targetNodeId: "acceptance-video-output",
      targetHandle: "video"
    }
  ],
  viewport: { x: 0, y: 0, zoom: 0.85 }
};

function textNode(id, x, y, text) {
  return {
    id,
    type: "text",
    position: { x, y },
    size: { width: 240, height: 160 },
    config: { bbox_references: [], text, title: null }
  };
}

function llmNode(id, x, y) {
  return {
    id,
    type: "llm",
    position: { x, y },
    size: { width: 260, height: 180 },
    config: {
      model: "doubao-seed-evolving",
      system_prompt: "",
      temperature: 0.7
    }
  };
}

function imageModelNode(id, x, y) {
  return {
    id,
    type: "text_to_image",
    position: { x, y },
    size: { width: 260, height: 200 },
    config: {
      model: "doubao-seedream-5-0-pro-260628",
      aspect_ratio: "1:1",
      size: "2K",
      format: "png"
    }
  };
}

function imageNode(id, x, y, title) {
  return {
    id,
    type: "image",
    position: { x, y },
    size: { width: 260, height: 220 },
    config: {
      asset_id: null,
      bbox: null,
      bbox_asset_id: null,
      title
    }
  };
}

function textEdge(sourceNodeId, targetNodeId, id, targetHandle = "text") {
  return {
    id,
    sourceNodeId,
    sourceHandle: "text",
    targetNodeId,
    targetHandle
  };
}

const flowIsolationDefinition = {
  schemaVersion: 2,
  nodes: [
    textNode("shared-input", 40, 300, "共享输入"),
    llmNode("shared-model", 340, 300),
    textNode("shared-json", 640, 300, "{\"items\":[]}"),
    {
      id: "shared-parser",
      type: "json_parser",
      position: { x: 940, y: 300 },
      size: { width: 260, height: 180 },
      config: { json_path: "$.items" }
    },
    ...["a", "b", "c"].flatMap((branch, index) => {
      const y = 40 + index * 300;
      return [
        {
          ...textNode(
            `branch-${branch}-prompt`,
            1240,
            y,
            `分支 ${branch.toUpperCase()} 提示词`
          ),
          config: {
            bbox_references: [],
            text: `分支 ${branch.toUpperCase()} 提示词`,
            title: `分支 ${branch.toUpperCase()} 提示词`,
            generated_by_parser_node_id: "shared-parser",
            generated_item_index: index,
            generated_from_run_id: null
          }
        },
        imageModelNode(`branch-${branch}-model`, 1540, y),
        imageNode(
          `branch-${branch}-output`,
          1840,
          y,
          `分支 ${branch.toUpperCase()} 图片`
        )
      ];
    })
  ],
  edges: [
    textEdge("shared-input", "shared-model", "shared-input-model", "prompt"),
    textEdge("shared-model", "shared-json", "shared-model-json"),
    textEdge("shared-json", "shared-parser", "shared-json-parser"),
    ...["a", "b", "c"].flatMap((branch) => [
      {
        id: `shared-parser-${branch}`,
        sourceNodeId: "shared-parser",
        sourceHandle: "items",
        targetNodeId: `branch-${branch}-prompt`,
        targetHandle: "text"
      },
      textEdge(
        `branch-${branch}-prompt`,
        `branch-${branch}-model`,
        `branch-${branch}-prompt-model`,
        "prompt"
      ),
      {
        id: `branch-${branch}-model-output`,
        sourceNodeId: `branch-${branch}-model`,
        sourceHandle: "image",
        targetNodeId: `branch-${branch}-output`,
        targetHandle: "image"
      }
    ])
  ],
  viewport: { x: 0, y: 0, zoom: 0.65 }
};

const nodeLabelFixtureNodeIds = {
  firstImage: "task5-image-primary",
  secondImage: "task5-image-secondary",
  firstText: "task5-text-with-bbox",
  secondText: "task5-text-plain",
  firstImageModel: "task5-image-to-image-primary",
  secondImageModel: "task5-image-to-image-secondary",
  singleVideo: "task5-video-singleton"
};

const customDimensionsFixtureNodeIds = {
  customTextPrompt: "task6-custom-text-prompt",
  customTextToImage: "task6-custom-text-to-image",
  bboxImageInput: "task6-bbox-image-input",
  customImagePrompt: "task6-custom-image-prompt",
  customImageToImage: "task6-custom-image-to-image",
  presetTextPrompt: "task6-preset-text-prompt",
  presetTextToImage: "task6-preset-text-to-image",
  presetImageInput: "task6-preset-image-input",
  presetImagePrompt: "task6-preset-image-prompt",
  presetImageToImage: "task6-preset-image-to-image",
  imageEditPrompt: "task6-image-edit-prompt",
  imageEdit: "task6-image-edit",
  layerDecomposition: "task6-layer-decomposition"
};

async function findAccessibleImageAssets(fixtureName) {
  const response = await fetch(`${backendBaseUrl}/api/assets?status=succeeded`);
  if (!response.ok) {
    throw new Error(
      `查询可复用图片资产失败 (${response.status}): ${await response.text()}`
    );
  }

  const assets = (await response.json())
    .filter(
      (asset) =>
        asset.mime_type?.startsWith("image/") &&
        asset.tool_asset_role === "input" &&
        asset.metadata?.origin === "aigc" &&
        asset.url
    )
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  const accessible = [];
  for (const asset of assets) {
    const contentResponse = await fetch(
      new URL(asset.url, `${backendBaseUrl}/`),
      { headers: { range: "bytes=0-0" } }
    );
    await contentResponse.body?.cancel();
    if (contentResponse.ok && contentResponse.headers.get("content-type")?.startsWith("image/")) {
      accessible.push(asset);
    }
    if (accessible.length === 2) break;
  }
  if (accessible.length < 2) {
    throw new Error(
      `创建${fixtureName}至少需要两张可访问的 AIGC 输入图片`
    );
  }
  return accessible;
}

async function createNodeLabelsDefinition() {
  const [firstImage, secondImage] = await findAccessibleImageAssets(
    "节点显示名验收 fixture"
  );
  const ids = nodeLabelFixtureNodeIds;
  return {
    assets: [firstImage, secondImage],
    definition: {
      schemaVersion: 2,
      nodes: [
        {
          id: ids.firstImage,
          type: "image",
          position: { x: 40, y: 40 },
          size: { width: 260, height: 220 },
          config: {
            asset_id: firstImage.id,
            bbox_asset_id: firstImage.id,
            bbox: { type: "bbox", x1: 100, y1: 180, x2: 700, y2: 820 }
          }
        },
        {
          id: ids.secondImage,
          type: "image",
          position: { x: 40, y: 320 },
          size: { width: 260, height: 220 },
          config: { asset_id: secondImage.id }
        },
        {
          id: ids.firstText,
          type: "text",
          position: { x: 360, y: 40 },
          size: { width: 280, height: 220 },
          config: {
            text: "Task 5 验收：保留整体构图并调整框选区域。",
            bbox_references: [
              {
                source_node_id: ids.firstImage,
                instruction: "将框选主体替换为红色包装，保持其余区域不变"
              }
            ]
          }
        },
        {
          id: ids.secondText,
          type: "text",
          position: { x: 360, y: 320 },
          size: { width: 280, height: 180 },
          config: {
            text: "Task 5 验收：生成第二张参考图的简洁商业版本。",
            bbox_references: []
          }
        },
        {
          id: ids.firstImageModel,
          type: "image_to_image",
          position: { x: 720, y: 40 },
          size: { width: 280, height: 240 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            operation: "image_to_image",
            aspect_ratio: "1:1",
            size: "2K",
            format: "png"
          }
        },
        {
          id: ids.secondImageModel,
          type: "image_to_image",
          position: { x: 720, y: 340 },
          size: { width: 280, height: 240 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            operation: "image_to_image",
            aspect_ratio: "1:1",
            size: "2K",
            format: "png"
          }
        },
        {
          id: ids.singleVideo,
          type: "video",
          position: { x: 1080, y: 180 },
          size: { width: 260, height: 180 },
          config: { asset_id: null }
        }
      ],
      edges: [
        {
          id: "task5-primary-image-edge",
          sourceNodeId: ids.firstImage,
          sourceHandle: "image",
          targetNodeId: ids.firstImageModel,
          targetHandle: "image"
        },
        {
          id: "task5-primary-prompt-edge",
          sourceNodeId: ids.firstText,
          sourceHandle: "text",
          targetNodeId: ids.firstImageModel,
          targetHandle: "prompt"
        },
        {
          id: "task5-secondary-image-edge",
          sourceNodeId: ids.secondImage,
          sourceHandle: "image",
          targetNodeId: ids.secondImageModel,
          targetHandle: "image"
        },
        {
          id: "task5-secondary-prompt-edge",
          sourceNodeId: ids.secondText,
          sourceHandle: "text",
          targetNodeId: ids.secondImageModel,
          targetHandle: "prompt"
        }
      ],
      viewport: { x: 10, y: 20, zoom: 0.78 }
    }
  };
}

async function createCustomDimensionsDefinition() {
  const [bboxImage, presetImage] = await findAccessibleImageAssets(
    "自定义尺寸验收 fixture"
  );
  const ids = customDimensionsFixtureNodeIds;
  return {
    assets: [bboxImage, presetImage],
    definition: {
      schemaVersion: 2,
      nodes: [
        {
          id: ids.customTextPrompt,
          type: "text",
          position: { x: 40, y: 40 },
          size: { width: 260, height: 180 },
          config: {
            text: "Task 6 受控验收：生成 2048x1024 横版商品海报。",
            bbox_references: []
          }
        },
        {
          id: ids.customTextToImage,
          type: "text_to_image",
          position: { x: 360, y: 40 },
          size: { width: 280, height: 240 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            aspect_ratio: "1:1",
            size: "2048x1024",
            format: "png"
          }
        },
        {
          id: ids.bboxImageInput,
          type: "image",
          position: { x: 40, y: 300 },
          size: { width: 260, height: 220 },
          config: {
            asset_id: bboxImage.id,
            bbox_asset_id: bboxImage.id,
            bbox: { type: "bbox", x1: 100, y1: 180, x2: 700, y2: 820 }
          }
        },
        {
          id: ids.customImagePrompt,
          type: "text",
          position: { x: 360, y: 320 },
          size: { width: 280, height: 220 },
          config: {
            text: "Task 6 受控验收：保留构图并修改框选商品。",
            bbox_references: [
              {
                source_node_id: ids.bboxImageInput,
                instruction: "将框选商品替换为红色包装，保持其余区域不变"
              }
            ]
          }
        },
        {
          id: ids.customImageToImage,
          type: "image_to_image",
          position: { x: 720, y: 320 },
          size: { width: 300, height: 260 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            operation: "image_to_image",
            aspect_ratio: "1:1",
            size: "2048x1024",
            format: "png"
          }
        },
        {
          id: ids.presetTextPrompt,
          type: "text",
          position: { x: 40, y: 620 },
          size: { width: 260, height: 180 },
          config: {
            text: "Task 6 回归：使用预设档位生成方形商品图。",
            bbox_references: []
          }
        },
        {
          id: ids.presetTextToImage,
          type: "text_to_image",
          position: { x: 360, y: 620 },
          size: { width: 280, height: 240 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            aspect_ratio: "1:1",
            size: "2K",
            format: "png"
          }
        },
        {
          id: ids.presetImageInput,
          type: "image",
          position: { x: 40, y: 900 },
          size: { width: 260, height: 220 },
          config: { asset_id: presetImage.id }
        },
        {
          id: ids.presetImagePrompt,
          type: "text",
          position: { x: 360, y: 900 },
          size: { width: 280, height: 180 },
          config: {
            text: "Task 6 回归：普通预设图生图。",
            bbox_references: []
          }
        },
        {
          id: ids.presetImageToImage,
          type: "image_to_image",
          position: { x: 720, y: 900 },
          size: { width: 300, height: 240 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            operation: "image_to_image",
            aspect_ratio: "4:3",
            size: "2K",
            format: "png"
          }
        },
        {
          id: ids.imageEditPrompt,
          type: "text",
          position: { x: 1080, y: 300 },
          size: { width: 280, height: 180 },
          config: {
            text: "Task 6 回归：图片编辑仅修改单一目标。",
            bbox_references: []
          }
        },
        {
          id: ids.imageEdit,
          type: "image_to_image",
          position: { x: 1440, y: 300 },
          size: { width: 300, height: 240 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            operation: "image_edit",
            aspect_ratio: "1:1",
            size: "2K",
            format: "png"
          }
        },
        {
          id: ids.layerDecomposition,
          type: "image_to_image",
          position: { x: 1080, y: 620 },
          size: { width: 300, height: 240 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            operation: "layer_decomposition",
            aspect_ratio: "1:1",
            size: "auto",
            format: "png"
          }
        }
      ],
      edges: [
        {
          id: "task6-custom-text-edge",
          sourceNodeId: ids.customTextPrompt,
          sourceHandle: "text",
          targetNodeId: ids.customTextToImage,
          targetHandle: "prompt"
        },
        {
          id: "task6-custom-image-edge",
          sourceNodeId: ids.bboxImageInput,
          sourceHandle: "image",
          targetNodeId: ids.customImageToImage,
          targetHandle: "image"
        },
        {
          id: "task6-custom-image-prompt-edge",
          sourceNodeId: ids.customImagePrompt,
          sourceHandle: "text",
          targetNodeId: ids.customImageToImage,
          targetHandle: "prompt"
        },
        {
          id: "task6-preset-text-edge",
          sourceNodeId: ids.presetTextPrompt,
          sourceHandle: "text",
          targetNodeId: ids.presetTextToImage,
          targetHandle: "prompt"
        },
        {
          id: "task6-preset-image-edge",
          sourceNodeId: ids.presetImageInput,
          sourceHandle: "image",
          targetNodeId: ids.presetImageToImage,
          targetHandle: "image"
        },
        {
          id: "task6-preset-image-prompt-edge",
          sourceNodeId: ids.presetImagePrompt,
          sourceHandle: "text",
          targetNodeId: ids.presetImageToImage,
          targetHandle: "prompt"
        },
        {
          id: "task6-image-edit-source-edge",
          sourceNodeId: ids.presetImageInput,
          sourceHandle: "image",
          targetNodeId: ids.imageEdit,
          targetHandle: "edit_image"
        },
        {
          id: "task6-image-edit-prompt-edge",
          sourceNodeId: ids.imageEditPrompt,
          sourceHandle: "text",
          targetNodeId: ids.imageEdit,
          targetHandle: "prompt"
        },
        {
          id: "task6-layer-decomposition-edge",
          sourceNodeId: ids.presetImageInput,
          sourceHandle: "image",
          targetNodeId: ids.layerDecomposition,
          targetHandle: "image"
        }
      ],
      viewport: { x: 20, y: 20, zoom: 0.65 }
    }
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertCustomDimensionsDefinition(definition) {
  const nodes = new Map(definition.nodes.map((node) => [node.id, node]));
  const ids = customDimensionsFixtureNodeIds;
  const expected = [
    [ids.customTextToImage, "text_to_image", undefined, "2048x1024"],
    [
      ids.customImageToImage,
      "image_to_image",
      "image_to_image",
      "2048x1024"
    ],
    [ids.presetTextToImage, "text_to_image", undefined, "2K"],
    [ids.presetImageToImage, "image_to_image", "image_to_image", "2K"],
    [ids.imageEdit, "image_to_image", "image_edit", "2K"],
    [
      ids.layerDecomposition,
      "image_to_image",
      "layer_decomposition",
      "auto"
    ]
  ];
  for (const [nodeId, type, operation, size] of expected) {
    const node = nodes.get(nodeId);
    if (
      !node ||
      node.type !== type ||
      node.config.operation !== operation ||
      node.config.size !== size
    ) {
      throw new Error(`Pipeline definition 回读校验失败：${nodeId}`);
    }
  }
  const bboxReferences =
    nodes.get(ids.customImagePrompt)?.config.bbox_references ?? [];
  if (
    bboxReferences.length !== 1 ||
    bboxReferences[0].source_node_id !== ids.bboxImageInput
  ) {
    throw new Error("Pipeline definition 回读校验失败：BBox 引用缺失");
  }
}

const nodeLabelsFixture = createNodeLabelsFixture
  ? await createNodeLabelsDefinition()
  : null;
const customDimensionsFixture = createCustomDimensionsFixture
  ? await createCustomDimensionsDefinition()
  : null;
const definition =
  (createFlowIsolationFixture ? flowIsolationDefinition : null) ??
  nodeLabelsFixture?.definition ??
  customDimensionsFixture?.definition ??
  defaultDefinition;
const timestamp = new Date().toISOString();
const pipelineResponse = await fetch(`${backendBaseUrl}/api/aigc/pipelines`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: createCustomDimensionsFixture
      ? `[验收 Task 6 自定义图片尺寸] ${timestamp}`
      : createNodeLabelsFixture
        ? `[验收 Task 5 节点显示名] ${timestamp}`
        : createFlowIsolationFixture
          ? `[验收 Run 流程隔离] ${timestamp}`
          : `AIGC 验收 Fixture ${timestamp}`,
    description: createCustomDimensionsFixture
      ? "自定义尺寸与既有图片模式回归专用；复用已有资产，验收页禁用执行。"
      : createNodeLabelsFixture
        ? "节点编号与内嵌 BBox 浏览器验收专用；复用已有资产，不执行生成。"
        : createFlowIsolationFixture
          ? "共享 JSON Parser 上游的三个生图分支；仅用于确定性 Run API 验收，不执行生成。"
          : "开发环境验收数据；执行入口已禁用。",
    definition
  })
});

if (!pipelineResponse.ok) {
  throw new Error(
    `创建 Pipeline 验收 fixture 失败 (${pipelineResponse.status}): ${await pipelineResponse.text()}`
  );
}

const pipeline = await pipelineResponse.json();
if (createFlowIsolationFixture) {
  const fixture = {
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    pipelineUrl: `${frontendBaseUrl}/workspace/aigc/pipelines/${pipeline.id}`,
    pipeline,
    definition: pipeline.definition,
    creationCommand:
      "npm run acceptance:aigc-flow-isolation:fixture"
  };
  console.log(
    process.argv.includes("--json")
      ? JSON.stringify(fixture)
      : JSON.stringify(fixture, null, 2)
  );
} else if (createCustomDimensionsFixture) {
  const readbackResponse = await fetch(
    `${backendBaseUrl}/api/aigc/pipelines/${pipeline.id}`
  );
  if (!readbackResponse.ok) {
    throw new Error(
      `回读 Pipeline 验收 fixture 失败 (${readbackResponse.status}): ${await readbackResponse.text()}`
    );
  }
  const readback = await readbackResponse.json();
  if (canonicalJson(readback.definition) !== canonicalJson(pipeline.definition)) {
    throw new Error("Pipeline definition API 回读与创建响应不一致");
  }
  assertCustomDimensionsDefinition(readback.definition);
  const fixture = {
    pipelineId: readback.id,
    pipelineName: readback.name,
    pipelineUrl: `${frontendBaseUrl}/workspace/aigc/acceptance?pipelineId=${readback.id}`,
    assetIds: customDimensionsFixture.assets.map((asset) => asset.id),
    nodeIds: customDimensionsFixtureNodeIds,
    definitionVerified: true,
    executionDisabled: true,
    customSize: "2048x1024",
    creationCommand:
      "npm run acceptance:aigc -- --custom-dimensions --json"
  };
  console.log(
    process.argv.includes("--json")
      ? JSON.stringify(fixture)
      : JSON.stringify(fixture, null, 2)
  );
} else if (createNodeLabelsFixture) {
  const ids = nodeLabelFixtureNodeIds;
  const fixture = {
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    pipelineUrl: `${frontendBaseUrl}/workspace/aigc/acceptance?pipelineId=${pipeline.id}`,
    assetIds: nodeLabelsFixture.assets.map((asset) => asset.id),
    nodeIds: ids,
    expectedDisplayNames: {
      [ids.firstImage]: "图片节点1",
      [ids.secondImage]: "图片节点2",
      [ids.firstText]: "文本节点1",
      [ids.secondText]: "文本节点2",
      [ids.firstImageModel]: "图生图1",
      [ids.secondImageModel]: "图生图2",
      [ids.singleVideo]: "视频节点"
    },
    creationCommand: "npm run acceptance:aigc -- --node-labels --json"
  };
  console.log(
    process.argv.includes("--json")
      ? JSON.stringify(fixture)
      : JSON.stringify(fixture, null, 2)
  );
} else {
  const templateResponse = await fetch(`${backendBaseUrl}/api/aigc/templates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `AIGC 模板验收 Fixture ${timestamp}`,
      description: "开发环境模板布局验收数据。",
      definition
    })
  });

  if (!templateResponse.ok) {
    throw new Error(
      `创建模板验收 fixture 失败 (${templateResponse.status}): ${await templateResponse.text()}`
    );
  }

  const template = await templateResponse.json();
  const fixture = {
    pipelineUrl: `${frontendBaseUrl}/workspace/aigc/acceptance?pipelineId=${pipeline.id}`,
    templateUrl: `${frontendBaseUrl}/workspace/aigc/templates/${template.id}`
  };

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(fixture));
  } else {
    console.log(fixture.pipelineUrl);
    console.log(
      `${frontendBaseUrl}/workspace/aigc/acceptance?scenario=mock-results`
    );
    console.log(fixture.templateUrl);
  }
}
