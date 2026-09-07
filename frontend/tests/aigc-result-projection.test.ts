import { describe, expect, it } from "vitest";
import {
  isAigcVideoResult,
  projectAigcEffectiveText,
  projectAigcImageBboxBinding,
  projectAigcLayerCompositeResult,
  projectAigcModalityRunResult,
  projectAigcVideoResult
} from "@/lib/aigc/result-projection";
import type {
  AigcEditedLayer,
  AigcLayerSet,
  AigcPipelineDefinition,
  AigcPipelineDefinitionV2,
  AigcPipelineRunDetail,
  AigcPipelineRunNode,
  AigcResultAsset,
  AigcTaskResult
} from "@/lib/aigc/types";

const digest = "a".repeat(64);
const inputLayerSet: AigcLayerSet = {
  id: "set-1",
  parent_layer_set_id: null,
  source_asset_id: "source",
  base_asset_id: "base",
  canvas_width: 1000,
  canvas_height: 1000,
  version: 1,
  digest,
  layers: [
    {
      id: "product",
      asset_id: "product-original",
      z_index: 1,
      name: "商品",
      description: "",
      bbox_absolute: [100, 100, 500, 500],
      bbox_normalized: [100, 100, 500, 500],
      visible: true,
      x: 100,
      y: 100,
      scale: 1
    }
  ]
};
const replacement: AigcEditedLayer = {
  asset_id: "product-edited",
  layer_set_id: inputLayerSet.id,
  layer_set_version: inputLayerSet.version,
  layer_set_digest: inputLayerSet.digest,
  layer_id: "product",
  bbox_absolute: [100, 100, 500, 500],
  bbox_normalized: [100, 100, 500, 500],
  x: 100,
  y: 100,
  scale: 1,
  z_index: 1
};
const outputLayerSet: AigcLayerSet = {
  ...inputLayerSet,
  id: "set-2",
  parent_layer_set_id: inputLayerSet.id,
  version: 2,
  digest: "b".repeat(64),
  layers: [
    {
      ...inputLayerSet.layers[0],
      asset_id: replacement.asset_id
    }
  ]
};

const definition: AigcPipelineDefinition = {
  schemaVersion: 1,
  nodes: [
    {
      id: "canvas",
      type: "layer_canvas",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        selected_layer_id: "product",
        source_layer_set: { id: "set-0", version: 0, digest },
        transform_patches: []
      }
    },
    {
      id: "edit",
      type: "image_to_image",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        operation: "image_edit",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    },
    {
      id: "composite",
      type: "layer_composite",
      position: { x: 640, y: 0 },
      size: { width: 240, height: 180 },
      config: {}
    }
  ],
  edges: [
    {
      id: "layers",
      sourceNodeId: "canvas",
      sourceHandle: "layers",
      targetNodeId: "composite",
      targetHandle: "layers"
    },
    {
      id: "replacement",
      sourceNodeId: "edit",
      sourceHandle: "edited_layer",
      targetNodeId: "composite",
      targetHandle: "replacement"
    }
  ],
  viewport: { x: 0, y: 0, zoom: 1 }
};

function runNode(
  nodeId: string,
  result: AigcTaskResult
): AigcPipelineRunNode {
  return {
    node_id: nodeId,
    included_in_plan: true,
    status: "succeeded",
    current_task_id: null,
    reused_from_task_id: null,
    input_hash: null,
    result,
    attempts: []
  };
}

function modalityRun(
  definitionSnapshot: unknown,
  node: AigcPipelineRunNode,
  runId: string
): AigcPipelineRunDetail {
  return {
    run: {
      id: runId,
      pipeline_id: "pipeline",
      run_number: runId === "historical" ? 1 : 2,
      pipeline_revision: 1,
      mode: "full",
      start_node_id: null,
      source_run_id: null,
      source_node_id: null,
      status: "succeeded",
      definition_snapshot:
        definitionSnapshot as AigcPipelineDefinition,
      input_snapshot: {},
      error: null,
      cancellation_requested: false,
      created_at: "2026-09-04T00:00:00Z",
      updated_at: "2026-09-04T00:00:00Z",
      started_at: "2026-09-04T00:00:00Z",
      finished_at: "2026-09-04T00:00:01Z"
    },
    nodes: [node]
  };
}

describe("AIGC modality Run result projection", () => {
  it("applies the current text override and restores the selected Run source", () => {
    const currentDefinition: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [
        {
          id: "source",
          type: "text",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 180 },
          config: { text: "本地源", bbox_references: [], title: null }
        },
        {
          id: "relay",
          type: "text",
          position: { x: 300, y: 0 },
          size: { width: 240, height: 180 },
          config: {
            text: "本地备用",
            bbox_references: [],
            title: null,
            upstream_text_override: "当前覆盖"
          }
        }
      ],
      edges: [
        {
          id: "source-relay",
          sourceNodeId: "source",
          sourceHandle: "text",
          targetNodeId: "relay",
          targetHandle: "text"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const detail = modalityRun(
      currentDefinition,
      runNode("relay", {
        kind: "text",
        text: "历史中继文本",
        text_digest: digest,
        assets: []
      }),
      "override"
    );
    detail.nodes.unshift(
      runNode("source", {
        kind: "text",
        text: "所选 Run 上游文本",
        text_digest: "b".repeat(64),
        assets: []
      })
    );

    expect(
      projectAigcEffectiveText(detail, currentDefinition, "relay")?.text
    ).toBe("当前覆盖");
    const restored = {
      ...currentDefinition,
      nodes: currentDefinition.nodes.map((node) =>
        node.id === "relay" && node.type === "text"
          ? {
              ...node,
              config: { ...node.config, upstream_text_override: null }
            }
          : node
      )
    };
    expect(projectAigcEffectiveText(detail, restored, "relay")?.text).toBe(
      "所选 Run 上游文本"
    );

    detail.nodes[0] = { ...detail.nodes[0], status: "failed" };
    const failed = projectAigcEffectiveText(detail, currentDefinition, "relay");
    expect(failed?.text).toBeNull();
    expect(failed?.available).toBe(false);
  });

  it("switches snapshots and RunNodes together without using local backup content", () => {
    const current = modalityRun(
      {
        schemaVersion: 2,
        nodes: [
          {
            id: "result",
            type: "text",
            position: { x: 0, y: 0 },
            size: { width: 240, height: 180 },
            config: {
              text: "当前备用文本",
              bbox_references: [],
              title: "当前标题"
            }
          }
        ],
        edges: [
          {
            id: "current-input",
            sourceNodeId: "producer",
            sourceHandle: "text",
            targetNodeId: "result",
            targetHandle: "text"
          }
        ]
      },
      runNode("result", {
        kind: "text",
        text: "当前 Run 结果",
        text_digest: digest,
        assets: []
      }),
      "current"
    );
    const historical = modalityRun(
      {
        schemaVersion: 2,
        nodes: [
          {
            id: "result",
            type: "text",
            position: { x: 0, y: 0 },
            size: { width: 240, height: 180 },
            config: {
              text: "历史备用文本",
              bbox_references: [],
              title: "历史标题"
            }
          }
        ],
        edges: [
          {
            id: "historical-input",
            sourceNodeId: "old-producer",
            sourceHandle: "text",
            targetNodeId: "result",
            targetHandle: "text"
          }
        ]
      },
      runNode("result", {
        kind: "text",
        text: "历史 Run 结果",
        text_digest: "b".repeat(64),
        assets: []
      }),
      "historical"
    );

    expect(projectAigcModalityRunResult(current, "result")).toMatchObject({
      mode: "upstream",
      text: "当前 Run 结果",
      title: "当前标题"
    });
    expect(projectAigcModalityRunResult(historical, "result")).toMatchObject({
      mode: "upstream",
      text: "历史 Run 结果",
      title: "历史标题"
    });
  });

  it("projects managed parser text by index and never falls back to stale text", () => {
    const currentDefinition: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [
        {
          id: "parser",
          type: "json_parser",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 180 },
          config: { json_path: "$.items" }
        },
        {
          id: "managed",
          type: "text",
          position: { x: 300, y: 0 },
          size: { width: 240, height: 180 },
          config: {
            text: "上一轮旧文本",
            bbox_references: [],
            title: "JSON 项 2",
            generated_by_parser_node_id: "parser",
            generated_item_index: 1,
            generated_from_run_id: "previous-run"
          }
        }
      ],
      edges: [
        {
          id: "parser-managed",
          sourceNodeId: "parser",
          sourceHandle: "items",
          targetNodeId: "managed",
          targetHandle: "text"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const detail = modalityRun(
      currentDefinition,
      runNode("managed", {
        kind: "none",
        text: null,
        text_digest: null,
        assets: []
      }),
      "current"
    );
    detail.nodes.unshift(
      runNode("parser", {
        kind: "text_items",
        text: null,
        text_digest: null,
        items: [
          { index: 0, text: "zero", summary: "0".repeat(64) },
          { index: 1, text: "current", summary: "1".repeat(64) }
        ],
        assets: []
      })
    );

    expect(
      projectAigcEffectiveText(detail, currentDefinition, "managed")
    ).toMatchObject({
      available: true,
      mode: "upstream",
      status: "succeeded",
      text: "current"
    });

    detail.nodes[0] = {
      ...detail.nodes[0],
      result: {
        ...detail.nodes[0].result,
        items: [{ index: 0, text: "only", summary: "2".repeat(64) }]
      }
    };
    expect(
      projectAigcEffectiveText(detail, currentDefinition, "managed")
    ).toMatchObject({
      available: false,
      text: null
    });
  });

  it("keeps unavailable media metadata but never exposes an invalid download", () => {
    const unavailable = runNode("result", {
      kind: "unavailable",
      text: null,
      text_digest: null,
      assets: [
        {
          asset_id: "deleted-image",
          ordinal: 0,
          mime_type: "image/png",
          download_url: "/api/assets/deleted-image/content",
          available: false
        }
      ]
    });
    unavailable.status = "blocked";
    const projection = projectAigcModalityRunResult(
      modalityRun(
        {
          schemaVersion: 2,
          nodes: [
            {
              id: "result",
              type: "image",
              position: { x: 0, y: 0 },
              size: { width: 240, height: 180 },
              config: {
                asset_id: "local-backup",
                bbox: null,
                bbox_asset_id: null,
                title: "历史图片"
              }
            }
          ],
          edges: [
            {
              id: "image-input",
              sourceNodeId: "producer",
              sourceHandle: "image",
              targetNodeId: "result",
              targetHandle: "image"
            }
          ]
        },
        unavailable,
        "historical"
      ),
      "result"
    );

    expect(projection).toMatchObject({
      asset: {
        asset_id: "deleted-image",
        available: false
      },
      available: false,
      mode: "upstream",
      title: "历史图片"
    });
    expect(projection?.downloadUrl).toBeNull();
  });

  it("marks an upstream bbox stale when the selected run asset changes", () => {
    const value: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [
        {
          id: "producer",
          type: "text_to_image",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 180 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            aspect_ratio: "1:1",
            size: "2K",
            format: "png"
          }
        },
        {
          id: "result",
          type: "image",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 180 },
          config: {
            asset_id: "local-backup",
            bbox: null,
            bbox_asset_id: null,
            title: null,
            upstream_bbox: {
              type: "bbox",
              x1: 100,
              y1: 200,
              x2: 700,
              y2: 800
            },
            upstream_bbox_asset_id: "bound-image"
          }
        }
      ],
      edges: [
        {
          id: "producer-result",
          sourceNodeId: "producer",
          sourceHandle: "image",
          targetNodeId: "result",
          targetHandle: "image"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };

    expect(
      projectAigcImageBboxBinding(value, "result", "bound-image")?.state
    ).toBe("valid");
    expect(
      projectAigcImageBboxBinding(value, "result", "new-image")?.state
    ).toBe("stale");
  });
});

describe("AIGC layer composite result projection", () => {
  it("projects the final image, derived layer set, and replacement target", () => {
    const projection = projectAigcLayerCompositeResult(
      definition,
      "composite",
      [
        runNode("canvas", {
          kind: "layer_canvas",
          text: null,
          text_digest: null,
          assets: [],
          layer_set: inputLayerSet
        }),
        runNode("edit", {
          kind: "edited_layer",
          text: null,
          text_digest: null,
          assets: [],
          edited_layer: replacement
        }),
        runNode("composite", {
          kind: "layer_composite",
          text: null,
          text_digest: null,
          assets: [
            {
              asset_id: "flattened",
              ordinal: 0,
              mime_type: "image/png",
              download_url: "/api/assets/flattened/content",
              available: true
            }
          ],
          layer_set: outputLayerSet
        })
      ]
    );

    expect(projection).toMatchObject({
      imageAsset: { asset_id: "flattened" },
      inputLayerSet: { id: "set-1", version: 1 },
      layerSet: { id: "set-2", version: 2 },
      layersConnected: true,
      replacement: { asset_id: "product-edited", layer_id: "product" },
      replacementConnected: true,
      targetLayer: { id: "product", name: "商品" }
    });
  });
});

describe("AIGC video enhancement result projection", () => {
  const videoDefinition: AigcPipelineDefinition = {
    schemaVersion: 1,
    nodes: [
      {
        id: "enhance",
        type: "video_enhancement",
        position: { x: 0, y: 0 },
        size: { width: 260, height: 180 },
        config: {
          tool_version: "professional",
          scene: null,
          enhance_style: "hd",
          resolution_mode: "preset",
          resolution: "4k",
          resolution_limit: null,
          fps: 30,
          bitrate_mode: "level",
          bitrate_level: "medium",
          bitrate: null,
          bit_depth: 10
        }
      },
      {
        id: "output",
        type: "video_output",
        position: { x: 320, y: 0 },
        size: { width: 240, height: 180 },
        config: { title: "增强成片" }
      }
    ],
    edges: [
      {
        id: "enhanced-video",
        sourceNodeId: "enhance",
        sourceHandle: "video",
        targetNodeId: "output",
        targetHandle: "video"
      }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
  const asset: AigcResultAsset = {
    asset_id: "enhanced-video",
    ordinal: 0,
    mime_type: "video/quicktime",
    download_url: "/api/assets/enhanced-video/content",
    available: true,
    metadata: {
      resolution: "3840x2160",
      fps: 59.94,
      duration_seconds: 12.5,
      tool_version: "professional",
      bit_depth: 10
    }
  };

  it("uses persisted output metadata for the enhancement and downstream output", () => {
    expect(
      projectAigcVideoResult(videoDefinition, "enhance", [asset])
    ).toMatchObject({
      asset,
      bitDepth: 10,
      duration: 12.5,
      fps: 59.94,
      resolution: "3840x2160",
      title: "画质增强结果",
      toolVersion: "professional"
    });
    expect(
      projectAigcVideoResult(videoDefinition, "output", [asset])
    ).toMatchObject({
      bitDepth: 10,
      duration: 12.5,
      fps: 59.94,
      resolution: "3840x2160",
      title: "增强成片",
      toolVersion: "professional"
    });
  });
});

describe("AIGC video face blur result projection", () => {
  const definition: AigcPipelineDefinition = {
    schemaVersion: 1,
    nodes: [
      {
        id: "face-blur",
        type: "video_face_blur",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: { mask_mode: "mosaic", mask_strength: "medium" }
      },
      {
        id: "output",
        type: "video_output",
        position: { x: 320, y: 0 },
        size: { width: 240, height: 180 },
        config: { title: "隐私保护成片" }
      }
    ],
    edges: [
      {
        id: "face-blur-output",
        sourceNodeId: "face-blur",
        sourceHandle: "video",
        targetNodeId: "output",
        targetHandle: "video"
      }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
  const asset: AigcResultAsset = {
    asset_id: "blurred-video",
    ordinal: 0,
    mime_type: "video/mp4",
    download_url: "/api/assets/blurred-video/content",
    available: true,
    metadata: {
      duration: 18.25,
      mask_mode: "blur",
      mask_strength: "high"
    }
  };

  it("projects persisted blur metadata for the node and downstream output", () => {
    expect(projectAigcVideoResult(definition, "face-blur", [asset])).toMatchObject({
      asset,
      duration: 18.25,
      maskMode: "blur",
      maskStrength: "high",
      title: "人脸打码结果"
    });
    expect(projectAigcVideoResult(definition, "output", [asset])).toMatchObject({
      duration: 18.25,
      maskMode: "blur",
      maskStrength: "high",
      title: "隐私保护成片"
    });
  });

  it("falls back to the saved node configuration when metadata is absent", () => {
    expect(
      projectAigcVideoResult(definition, "output", [
        { ...asset, metadata: {} }
      ])
    ).toMatchObject({
      maskMode: "mosaic",
      maskStrength: "medium"
    });
  });
});

describe("AIGC multi-track result projection", () => {
  const definition: AigcPipelineDefinitionV2 = {
    schemaVersion: 2,
    nodes: [
      {
        id: "edit",
        type: "multi_track_edit",
        position: { x: 0, y: 0 },
        size: { width: 320, height: 240 },
        config: {
          canvas: {
            mode: "custom",
            width: 1920,
            height: 1080,
            background_color: "#000000FF"
          },
          output: { format: "mp4", fps: 30 },
          tracks: [
            {
              id: "video-track",
              name: "视频",
              type: "video",
              order: 0,
              hidden: false,
              muted: false,
              elements: []
            }
          ]
        }
      }
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
  const asset: AigcResultAsset = {
    asset_id: "multitrack-video",
    ordinal: 0,
    mime_type: "video/mp4",
    download_url: "/api/assets/multitrack-video/content",
    available: true,
    metadata: {
      provider: "mediakit",
      operation: "multi_track_edit",
      provider_task_id: "mediakit-task-1",
      provider_request_id: "mediakit-request-1",
      track_count: 4,
      element_count: 12,
      duration_ms: 12_500,
      width: 1920,
      height: 1080,
      fps: 30
    }
  };

  it("projects persisted render metadata and recognizes the node as video", () => {
    expect(projectAigcVideoResult(definition, "edit", [asset])).toMatchObject({
      asset,
      duration: 12.5,
      elementCount: 12,
      fps: 30,
      provider: "mediakit",
      providerRequestId: "mediakit-request-1",
      providerTaskId: "mediakit-task-1",
      resolution: "1920x1080",
      title: "多轨剪辑成片",
      trackCount: 4
    });
    expect(isAigcVideoResult(definition, "edit", asset)).toBe(true);
  });
});
