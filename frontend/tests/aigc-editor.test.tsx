import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AigcEditor,
  connectionValidationFeedback,
  getAigcConnectionValidationError,
  isValidAigcConnection,
  toFlowEdge
} from "@/components/workspace/aigc/aigc-editor";
import { AigcQueryProvider } from "@/components/workspace/aigc/providers/aigc-query-provider";
import {
  AigcEditorStoreProvider,
  useAigcEditorStore
} from "@/components/workspace/aigc/providers/aigc-editor-store-provider";
import {
  createAigcEditorStore,
  type AigcEditorStore
} from "@/lib/aigc/editor-store";
import { formatAigcLogTime } from "@/lib/aigc/run-log";
import type {
  AigcEdge,
  AigcNode,
  AigcPipeline,
  AigcPipelineDefinition,
  AigcPipelineRun,
  AigcPipelineRunNode,
  AigcPipelineTaskAttempt,
  AigcPipelineTemplate
} from "@/lib/aigc/types";

const apiMocks = vi.hoisted(() => ({
  cancelAigcRun: vi.fn(),
  createAigcRun: vi.fn(),
  getAigcRun: vi.fn(),
  isApiError: vi.fn(),
  listAssets: vi.fn(),
  listAigcRuns: vi.fn(),
  listToolAssets: vi.fn(),
  retryAigcRunNode: vi.fn(),
  saveAigcPipelineAsTemplate: vi.fn(),
  uploadAigcMedia: vi.fn(),
  updateAigcPipeline: vi.fn(),
  updateAigcTemplate: vi.fn()
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: apiMocks,
  getBackendBaseUrl: () => "http://localhost:8000",
  getUserFacingErrorMessage: () => "请求失败",
  isApiError: apiMocks.isApiError
}));

vi.mock("@/components/workspace/canvas/node-canvas", async () => {
  const { useAigcRunActions } = await import(
    "@/components/workspace/aigc/aigc-run-context"
  );
  return {
    NodeCanvas: ({
      nodes,
      reactFlowProps
    }: {
      nodes: Array<{ id: string; type?: string }>;
      reactFlowProps?: {
        fitViewOptions?: { minZoom?: number };
        minZoom?: number;
        translateExtent?: unknown;
      };
    }) => {
      const runActions = useAigcRunActions();
      const layerCanvas = nodes.find((node) => node.type === "layer_canvas");
      return (
        <div
          data-fit-view-min-zoom={reactFlowProps?.fitViewOptions?.minZoom ?? "default"}
          data-min-zoom={reactFlowProps?.minZoom ?? "default"}
          data-testid="node-canvas"
          data-translate-extent={String("translateExtent" in (reactFlowProps ?? {}))}
        >
          {nodes.length} nodes
          {runActions && layerCanvas ? (
            <button
              disabled={runActions.pending}
              onClick={() => runActions.continueFromNode(layerCanvas.id)}
              type="button"
            >
              从图层节点继续
            </button>
          ) : null}
        </div>
      );
    }
  };
});

const definition: AigcPipelineDefinition = {
  schemaVersion: 1,
  nodes: [
    {
      id: "input",
      type: "text_input",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { text: "商品海报" }
    },
    {
      id: "model",
      type: "text_to_image",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    },
    {
      id: "output",
      type: "image_output",
      position: { x: 640, y: 0 },
      size: { width: 240, height: 160 },
      config: { title: "结果" }
    }
  ],
  edges: [
    {
      id: "edge-input",
      sourceNodeId: "input",
      sourceHandle: "text",
      targetNodeId: "model",
      targetHandle: "prompt"
    }
  ],
  viewport: { x: 0, y: 0, zoom: 1 }
};

const template: AigcPipelineTemplate = {
  id: "template-1",
  name: "商品模板",
  description: "模板描述",
  definition,
  revision: 3,
  created_at: "2026-08-29T01:00:00Z",
  updated_at: "2026-08-29T02:00:00Z"
};
const pipeline: AigcPipeline = {
  ...template,
  id: "pipeline-1",
  source_template_id: template.id,
  source_template_revision: template.revision,
  latest_run_status: null
};

function runFixture(
  overrides: Partial<AigcPipelineRun> = {}
): AigcPipelineRun {
  return {
    id: "run-1",
    pipeline_id: pipeline.id,
    run_number: 1,
    pipeline_revision: pipeline.revision,
    mode: "full",
    start_node_id: null,
    source_run_id: null,
    source_node_id: null,
    status: "succeeded",
    definition_snapshot: definition,
    input_snapshot: {},
    error: null,
    cancellation_requested: false,
    created_at: "2026-08-29T03:00:00Z",
    updated_at: "2026-08-29T03:01:05Z",
    started_at: "2026-08-29T03:00:00Z",
    finished_at: "2026-08-29T03:01:05Z",
    ...overrides
  };
}

function attemptFixture(
  attempt: number,
  overrides: Partial<AigcPipelineTaskAttempt> = {}
): AigcPipelineTaskAttempt {
  return {
    task_id: `task-${attempt}`,
    pipeline_id: pipeline.id,
    run_id: "run-1",
    node_id: "model",
    attempt,
    type: "text_to_image",
    status: "succeeded",
    progress: 100,
    params: {},
    upstream: [],
    result: {
      kind: "none",
      text: null,
      text_digest: null,
      assets: []
    },
    error: null,
    metrics: { cost_tokens: 0, duration_ms: 0 },
    created_at: "2026-08-29T03:00:00Z",
    started_at: "2026-08-29T03:00:00Z",
    finished_at: "2026-08-29T03:01:05Z",
    ...overrides
  };
}

function runNodeFixture(
  nodeId: string,
  overrides: Partial<AigcPipelineRunNode> = {}
): AigcPipelineRunNode {
  return {
    node_id: nodeId,
    included_in_plan: true,
    status: "succeeded",
    current_task_id: null,
    reused_from_task_id: null,
    input_hash: null,
    result: {
      kind: "none",
      text: null,
      text_digest: null,
      assets: []
    },
    attempts: [],
    ...overrides
  };
}

function videoPipeline(
  generationMode:
    | "text_to_video"
    | "first_frame"
    | "first_last_frame"
    | "multimodal_reference" = "text_to_video",
  connectedHandle: string | null = "prompt"
): AigcPipeline {
  const sourceType = connectedHandle === "prompt"
    ? "text_input"
    : connectedHandle === "reference_videos"
      ? "video_input"
      : connectedHandle === "reference_audios"
        ? "audio_input"
        : "image_input";
  const source = {
    id: "video-source",
    type: sourceType,
    position: { x: 0, y: 0 },
    size: { width: 240, height: 160 },
    config:
      sourceType === "text_input"
        ? { text: "生成产品视频" }
        : { asset_id: "asset-source" }
  } as AigcNode;
  const model: AigcNode = {
    id: "video-model",
    type: "video_generation",
    position: { x: 320, y: 0 },
    size: { width: 240, height: 180 },
    config: {
      model: "doubao-seedance-2-5-260628",
      generation_mode: generationMode,
      resolution: "720p",
      aspect_ratio: "adaptive",
      duration_seconds: -1,
      generate_audio: true
    }
  };
  return {
    ...pipeline,
    definition: {
      schemaVersion: 1,
      nodes: [source, model],
      edges: connectedHandle
        ? [
            {
              id: "video-edge",
              sourceNodeId: source.id,
              sourceHandle:
                sourceType === "text_input"
                  ? "text"
                  : sourceType === "image_input"
                    ? "image"
                    : sourceType === "video_input"
                      ? "video"
                      : "audio",
              targetNodeId: model.id,
              targetHandle: connectedHandle
            }
          ]
        : [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  };
}

function layerCanvasPipeline(): AigcPipeline {
  return {
    ...pipeline,
    definition: {
      schemaVersion: 1,
      nodes: [
        {
          id: "image-source",
          type: "image_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: "layer-source" }
        },
        {
          id: "decompose",
          type: "image_to_image",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 180 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            operation: "layer_decomposition",
            aspect_ratio: "1:1",
            size: "auto",
            format: "png"
          }
        },
        {
          id: "layer-canvas",
          type: "layer_canvas",
          position: { x: 640, y: 0 },
          size: { width: 240, height: 220 },
          config: {
            selected_layer_id: "product",
            source_layer_set: null,
            transform_patches: []
          }
        }
      ],
      edges: [
        {
          id: "source-edge",
          sourceNodeId: "image-source",
          sourceHandle: "image",
          targetNodeId: "decompose",
          targetHandle: "image"
        },
        {
          id: "layers-edge",
          sourceNodeId: "decompose",
          sourceHandle: "layers",
          targetNodeId: "layer-canvas",
          targetHandle: "layers"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  };
}

function renderEditor(
  entity: AigcPipeline | AigcPipelineTemplate,
  mode: "pipeline" | "template",
  store = createEditorStore(entity, mode)
) {
  return {
    ...render(
    <AigcQueryProvider>
      <AigcEditor entity={entity} mode={mode} store={store} />
    </AigcQueryProvider>
    ),
    store
  };
}

function createEditorStore(
  entity: AigcPipeline | AigcPipelineTemplate,
  mode: "pipeline" | "template"
): AigcEditorStore {
  return createAigcEditorStore({
    definition: entity.definition,
    description: entity.description,
    entityId: entity.id,
    mode,
    name: entity.name,
    revision: entity.revision
  });
}

function InitialStateProbe() {
  const nodeCount = useAigcEditorStore(
    (state) => state.definition.nodes.length
  );
  const revision = useAigcEditorStore((state) => state.revision);
  return <span>{`Revision ${revision}, ${nodeCount} nodes`}</span>;
}

describe("AIGC editor store", () => {
  let store: AigcEditorStore;

  beforeEach(() => {
    store = createAigcEditorStore({
      definition,
      description: "初始描述",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "初始画布",
      revision: 1
    });
  });

  it("tracks node changes with bounded undo and redo history", () => {
    store.getState().addNode("llm");

    expect(store.getState().definition.nodes).toHaveLength(4);
    expect(store.getState().dirty).toBe(true);

    store.getState().undo();
    expect(store.getState().definition.nodes).toHaveLength(3);

    store.getState().redo();
    expect(store.getState().definition.nodes).toHaveLength(4);
  });

  it("renders the server entity synchronously on the first render", () => {
    const html = renderToString(
      <AigcEditorStoreProvider
        initialState={{
          definition,
          description: pipeline.description,
          entityId: pipeline.id,
          mode: "pipeline",
          name: pipeline.name,
          revision: pipeline.revision
        }}
      >
        <InitialStateProbe />
      </AigcEditorStoreProvider>
    );

    expect(html).toContain("Revision 3, 3 nodes");
  });

  it("keeps independent editor stores isolated", () => {
    const first = createEditorStore(pipeline, "pipeline");
    const second = createEditorStore(
      {
        ...pipeline,
        id: "pipeline-2",
        name: "第二个画布",
        revision: 8
      },
      "pipeline"
    );

    first.getState().setName("仅修改第一个");
    first.getState().addNode("video_input");

    expect(first.getState()).toMatchObject({
      dirty: true,
      name: "仅修改第一个",
      revision: 3
    });
    expect(second.getState()).toMatchObject({
      dirty: false,
      entityId: "pipeline-2",
      name: "第二个画布",
      revision: 8
    });
    expect(second.getState().definition.nodes).toHaveLength(3);
  });

  it("validates port types and enforces one incoming edge per input", () => {
    expect(
      isValidAigcConnection(
        {
          source: "model",
          sourceHandle: "image",
          target: "output",
          targetHandle: "image"
        },
        definition.nodes,
        definition.edges
      )
    ).toBe(true);
    expect(
      isValidAigcConnection(
        {
          source: "input",
          sourceHandle: "text",
          target: "output",
          targetHandle: "image"
        },
        definition.nodes,
        definition.edges
      )
    ).toBe(false);
    expect(
      isValidAigcConnection(
        {
          source: "input",
          sourceHandle: "text",
          target: "model",
          targetHandle: "prompt"
        },
        definition.nodes,
        definition.edges
      )
    ).toBe(false);
  });

  it("accepts layer composite connections and a continuous editing chain", () => {
    const firstCanvas: AigcNode = {
      id: "canvas-1",
      type: "layer_canvas",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        selected_layer_id: "product",
        source_layer_set: null,
        transform_patches: []
      }
    };
    const edit: AigcNode = {
      id: "edit-1",
      type: "image_to_image",
      position: { x: 300, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        operation: "image_edit",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    };
    const composite: AigcNode = {
      id: "composite-1",
      type: "layer_composite",
      position: { x: 600, y: 0 },
      size: { width: 240, height: 180 },
      config: {}
    };
    const nextCanvas: AigcNode = {
      ...firstCanvas,
      id: "canvas-2",
      position: { x: 900, y: 0 },
      config: {
        selected_layer_id: null,
        source_layer_set: null,
        transform_patches: []
      }
    };
    const output: AigcNode = {
      id: "output",
      type: "image_output",
      position: { x: 900, y: 220 },
      size: { width: 240, height: 180 },
      config: { title: "最终扁平图" }
    };
    const nodes = [firstCanvas, edit, composite, nextCanvas, output];
    const selectedLayerEdge: AigcEdge = {
      id: "selected-layer",
      sourceNodeId: firstCanvas.id,
      sourceHandle: "selected_layer",
      targetNodeId: edit.id,
      targetHandle: "edit_layer"
    };

    for (const connection of [
      {
        source: firstCanvas.id,
        sourceHandle: "layers",
        target: composite.id,
        targetHandle: "layers"
      },
      {
        source: edit.id,
        sourceHandle: "edited_layer",
        target: composite.id,
        targetHandle: "replacement"
      },
      {
        source: composite.id,
        sourceHandle: "layers",
        target: nextCanvas.id,
        targetHandle: "layers"
      },
      {
        source: composite.id,
        sourceHandle: "image",
        target: output.id,
        targetHandle: "image"
      }
    ]) {
      expect(
        isValidAigcConnection(connection, nodes, [selectedLayerEdge])
      ).toBe(true);
    }

    expect(
      getAigcConnectionValidationError(
        {
          source: composite.id,
          sourceHandle: "image",
          target: nextCanvas.id,
          targetHandle: "layers"
        },
        nodes,
        [selectedLayerEdge]
      )
    ).toBe("port_type_mismatch");
  });

  it("colors legal edges from their source port modality", () => {
    const sourceNodes: AigcNode[] = [
      {
        id: "text-source",
        type: "text_input",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: { text: "提示词" }
      },
      {
        id: "image-source",
        type: "image_input",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: { asset_id: "image-asset" }
      },
      {
        id: "video-source",
        type: "video_input",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: { asset_id: "video-asset" }
      },
      {
        id: "audio-source",
        type: "audio_input",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: { asset_id: "audio-asset" }
      }
    ];
    const cases = [
      ["text-source", "text", "var(--aigc-modality-text)"],
      ["image-source", "image", "var(--aigc-modality-image)"],
      ["video-source", "video", "var(--aigc-modality-video)"],
      ["audio-source", "audio", "var(--aigc-modality-audio)"]
    ] as const;

    for (const [sourceNodeId, sourceHandle, color] of cases) {
      expect(
        toFlowEdge(
          {
            id: `edge-${sourceHandle}`,
            sourceNodeId,
            sourceHandle,
            targetNodeId: "target",
            targetHandle: sourceHandle
          },
          sourceNodes
        )
      ).toMatchObject({
        animated: false,
        label: undefined,
        style: { stroke: color, strokeWidth: 2 }
      });
    }
  });

  it("prioritizes destructive styling for incompatible edges and falls back for unknown sources", () => {
    const current = videoPipeline("text_to_video", null);
    const imageSource: AigcNode = {
      id: "image-source",
      type: "image_input",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { asset_id: "image-asset" }
    };
    const incompatibleEdge: AigcEdge = {
      id: "stale-image-edge",
      sourceNodeId: imageSource.id,
      sourceHandle: "image",
      targetNodeId: "video-model",
      targetHandle: "first_frame"
    };

    expect(
      toFlowEdge(incompatibleEdge, [...current.definition.nodes, imageSource])
    ).toMatchObject({
      animated: true,
      label: "与当前模式不兼容",
      style: {
        stroke: "hsl(var(--destructive))",
        strokeWidth: 2
      }
    });
    expect(
      toFlowEdge({
        ...incompatibleEdge,
        id: "unknown-edge",
        sourceNodeId: "missing-source",
        sourceHandle: "missing",
        targetNodeId: "missing-target",
        targetHandle: "missing"
      })
    ).toMatchObject({
      animated: false,
      style: {
        stroke: "hsl(var(--border))",
        strokeWidth: 2
      }
    });
  });

  it("marks retained Seedream output edges as incompatible after a mode switch", () => {
    const seedream: AigcNode = {
      id: "seedream",
      type: "image_to_image",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        operation: "layer_decomposition",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    };
    const output: AigcNode = {
      id: "output",
      type: "image_output",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: { title: "结果" }
    };
    const staleEdge: AigcEdge = {
      id: "stale-output",
      sourceNodeId: seedream.id,
      sourceHandle: "image",
      targetNodeId: output.id,
      targetHandle: "image"
    };

    expect(toFlowEdge(staleEdge, [seedream, output], [staleEdge])).toMatchObject({
      animated: true,
      label: "与当前模式不兼容",
      style: {
        stroke: "hsl(var(--destructive))",
        strokeWidth: 2
      }
    });
  });

  it("allows ten image references, then rejects the eleventh and duplicates", () => {
    const imageNodes = Array.from({ length: 11 }, (_, index) => ({
      id: `image-${index + 1}`,
      type: "image_input" as const,
      position: { x: 0, y: index * 40 },
      size: { width: 240, height: 160 },
      config: { asset_id: `asset-${index + 1}` }
    }));
    const imageModel = {
      id: "image-model",
      type: "image_to_image" as const,
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        aspect_ratio: "1:1" as const,
        size: "2K" as const,
        format: "png" as const
      }
    };
    const imageEdges = imageNodes.slice(0, 10).map((node, index) => ({
      id: `edge-image-${index + 1}`,
      sourceNodeId: node.id,
      sourceHandle: "image",
      targetNodeId: imageModel.id,
      targetHandle: "image"
    }));
    const tenthConnection = {
      source: imageNodes[9].id,
      sourceHandle: "image",
      target: imageModel.id,
      targetHandle: "image"
    };
    const eleventhConnection = {
      source: imageNodes[10].id,
      sourceHandle: "image",
      target: imageModel.id,
      targetHandle: "image"
    };

    expect(
      isValidAigcConnection(
        tenthConnection,
        [...imageNodes, imageModel],
        imageEdges.slice(0, 9)
      )
    ).toBe(true);
    expect(
      getAigcConnectionValidationError(
        eleventhConnection,
        [...imageNodes, imageModel],
        imageEdges
      )
    ).toBe("target_connection_limit");
    expect(
      connectionValidationFeedback(
        "target_connection_limit",
        eleventhConnection,
        [...imageNodes, imageModel]
      )
    ).toBe("图生图节点最多支持 10 张参考图");
    expect(
      getAigcConnectionValidationError(
        tenthConnection,
        [...imageNodes, imageModel],
        imageEdges
      )
    ).toBe("duplicate_edge");
  });

  it("enforces the selected video model reference limit during connection", () => {
    const target = videoPipeline(
      "multimodal_reference",
      "reference_images"
    ).definition.nodes.find((node) => node.id === "video-model");
    expect(target?.type).toBe("video_generation");
    if (target?.type !== "video_generation") return;
    target.config.model = "doubao-seedance-2-0-mini-260615";
    const sources = Array.from({ length: 10 }, (_, index) => ({
      id: `reference-${index}`,
      type: "image_input" as const,
      position: { x: 0, y: index * 40 },
      size: { width: 240, height: 160 },
      config: { asset_id: `asset-${index}` }
    }));
    const edges = sources.slice(0, 9).map((source, index) => ({
      id: `reference-edge-${index}`,
      sourceNodeId: source.id,
      sourceHandle: "image",
      targetNodeId: target.id,
      targetHandle: "reference_images"
    }));
    const connection = {
      source: sources[9].id,
      sourceHandle: "image",
      target: target.id,
      targetHandle: "reference_images"
    };

    expect(
      getAigcConnectionValidationError(
        connection,
        [...sources, target],
        edges
      )
    ).toBe("target_connection_limit");
    expect(
      connectionValidationFeedback(
        "target_connection_limit",
        connection,
        [...sources, target]
      )
    ).toBe("参考图片最多支持 9 个连接");
  });

  it("rejects video handles that are disabled by the current mode", () => {
    const current = videoPipeline("text_to_video", null);
    const image = {
      id: "image-source",
      type: "image_input" as const,
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { asset_id: "asset-image" }
    };
    const connection = {
      source: image.id,
      sourceHandle: "image",
      target: "video-model",
      targetHandle: "first_frame"
    };

    expect(
      getAigcConnectionValidationError(
        connection,
        [...current.definition.nodes, image],
        []
      )
    ).toBe("input_not_allowed_for_mode");
    expect(
      connectionValidationFeedback(
        "input_not_allowed_for_mode",
        connection,
        [...current.definition.nodes, image]
      )
    ).toBe("首帧不适用于当前生成模式");
  });

  it("updates bbox bindings atomically and cleans them when the source changes", () => {
    const bboxDefinition: AigcPipelineDefinition = {
      schemaVersion: 1,
      nodes: [
        {
          id: "image",
          type: "image_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: "asset-1", bbox: null, bbox_asset_id: null }
        },
        {
          id: "prompt",
          type: "text_input",
          position: { x: 0, y: 200 },
          size: { width: 240, height: 160 },
          config: { text: "编辑", bbox_references: [] }
        },
        {
          id: "image-model",
          type: "image_to_image",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 160 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            aspect_ratio: "1:1",
            size: "2K",
            format: "png"
          }
        }
      ],
      edges: [
        {
          id: "image-edge",
          sourceNodeId: "image",
          sourceHandle: "image",
          targetNodeId: "image-model",
          targetHandle: "image"
        },
        {
          id: "prompt-edge",
          sourceNodeId: "prompt",
          sourceHandle: "text",
          targetNodeId: "image-model",
          targetHandle: "prompt"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    store.getState().initialize({
      definition: bboxDefinition,
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "精准编辑",
      revision: 1
    });

    store.getState().setImageBboxBindings(
      "image",
      { type: "bbox", x1: 100, y1: 200, x2: 700, y2: 800 },
      ["prompt"]
    );
    let state = store.getState();
    const image = state.definition.nodes.find((node) => node.id === "image");
    const prompt = state.definition.nodes.find((node) => node.id === "prompt");
    expect(image?.type).toBe("image_input");
    expect(prompt?.type).toBe("text_input");
    if (image?.type === "image_input" && prompt?.type === "text_input") {
      expect(image.config.bbox_asset_id).toBe("asset-1");
      expect(prompt.config.bbox_references).toEqual([
        { source_node_id: "image", instruction: "" }
      ]);
    }

    store.getState().undo();
    state = store.getState();
    const undoneImage = state.definition.nodes.find((node) => node.id === "image");
    const undonePrompt = state.definition.nodes.find(
      (node) => node.id === "prompt"
    );
    if (
      undoneImage?.type === "image_input" &&
      undonePrompt?.type === "text_input"
    ) {
      expect(undoneImage.config.bbox).toBeNull();
      expect(undonePrompt.config.bbox_references).toEqual([]);
    }

    store.getState().redo();
    store.getState().updateNodeConfig("image", {
      asset_id: "asset-2",
      bbox: image?.type === "image_input" ? image.config.bbox : null,
      bbox_asset_id: "asset-1"
    });
    state = store.getState();
    const changedImage = state.definition.nodes.find(
      (node) => node.id === "image"
    );
    const changedPrompt = state.definition.nodes.find(
      (node) => node.id === "prompt"
    );
    if (
      changedImage?.type === "image_input" &&
      changedPrompt?.type === "text_input"
    ) {
      expect(changedImage.config.bbox).toBeNull();
      expect(changedImage.config.bbox_asset_id).toBeNull();
      expect(changedPrompt.config.bbox_references).toEqual([]);
    }
  });
});

describe("AIGC editor modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(min-width: 1024px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
    apiMocks.isApiError.mockReturnValue(false);
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total: 0
    });
    apiMocks.listAssets.mockResolvedValue([]);
    apiMocks.listToolAssets.mockResolvedValue([]);
    apiMocks.saveAigcPipelineAsTemplate.mockResolvedValue(template);
    apiMocks.updateAigcPipeline.mockResolvedValue({
      ...pipeline,
      revision: 4
    });
    apiMocks.updateAigcTemplate.mockResolvedValue({
      ...template,
      revision: 4
    });
  });

  it("keeps template editing non-executable and saves by revision", async () => {
    renderEditor(template, "template");

    expect(screen.queryByRole("button", { name: "执行" })).toBeNull();
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "更新模板" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(apiMocks.updateAigcTemplate).toHaveBeenCalledWith(
        "template-1",
        expect.objectContaining({
          expected_revision: 3,
          name: "更新模板"
        })
      );
    });
    expect(await screen.findByText("已保存 Revision 4")).toBeInTheDocument();
  });

  it("shows pipeline execution entry and adds registered nodes", async () => {
    renderEditor(pipeline, "pipeline");

    expect(screen.getByRole("button", { name: "执行" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "LLM" }));

    await waitFor(() => {
      expect(screen.getByTestId("node-canvas")).toHaveTextContent("4 nodes");
    });
    expect(screen.getByText("未保存")).toBeInTheDocument();
  });

  it("uses a two-row narrow toolbar while keeping every command reachable at 390px", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390
    });
    const narrowPipeline = {
      ...pipeline,
      name: "这是一个用于验证窄屏标题截断行为的超长 AIGC 工作流名称"
    };
    const store = createEditorStore(narrowPipeline, "pipeline");
    store.getState().setName(`${narrowPipeline.name}（已修改）`);

    renderEditor(narrowPipeline, "pipeline", store);

    expect(screen.getByTestId("aigc-editor-header")).toHaveClass(
      "flex-col",
      "sm:flex-row",
      "sm:h-14"
    );
    expect(screen.getByTestId("aigc-editor-title-row")).toHaveClass(
      "w-full",
      "min-w-0"
    );
    expect(screen.getByTestId("aigc-editor-title")).toHaveClass(
      "min-w-0",
      "flex-1",
      "truncate"
    );
    expect(screen.getByText("Revision 3")).toBeInTheDocument();
    expect(screen.getByText("未保存")).toBeInTheDocument();

    const actions = screen.getByTestId("aigc-editor-actions");
    expect(actions).toHaveClass("w-full", "justify-end", "sm:w-auto");
    for (const command of [
      "aigc-command-undo",
      "aigc-command-redo",
      "aigc-command-save-template",
      "aigc-command-execute",
      "aigc-command-save"
    ]) {
      expect(within(actions).getByTestId(command)).toBeInTheDocument();
    }
    expect(within(actions).getByRole("button", { name: "撤销" })).toBeEnabled();
    expect(
      within(actions).getByRole("button", { name: "另存为模板" })
    ).toBeEnabled();
    expect(within(actions).getByRole("button", { name: "执行" })).toBeEnabled();
    expect(within(actions).getByRole("button", { name: "保存" })).toBeEnabled();
    expect(within(actions).getByText("另存为模板")).toHaveClass(
      "hidden",
      "sm:inline"
    );
    expect(within(actions).getByText("执行")).toHaveClass("hidden", "sm:inline");
    expect(within(actions).getByText("保存")).toHaveClass("hidden", "sm:inline");
  });

  it("lowers only the narrow-screen viewport minimum without bounding panning", () => {
    const desktopView = renderEditor(pipeline, "pipeline");
    expect(screen.getByTestId("node-canvas")).toHaveAttribute(
      "data-min-zoom",
      "default"
    );
    expect(screen.getByTestId("node-canvas")).toHaveAttribute(
      "data-fit-view-min-zoom",
      "default"
    );
    desktopView.unmount();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
    renderEditor(pipeline, "pipeline");

    expect(screen.getByTestId("node-canvas")).toHaveAttribute(
      "data-min-zoom",
      "0.25"
    );
    expect(screen.getByTestId("node-canvas")).toHaveAttribute(
      "data-fit-view-min-zoom",
      "0.25"
    );
    expect(screen.getByTestId("node-canvas")).toHaveAttribute(
      "data-translate-extent",
      "false"
    );
  });

  it("reinitializes synchronously when the route entity changes", () => {
    const view = render(
      <AigcQueryProvider>
        <AigcEditor entity={pipeline} mode="pipeline" />
      </AigcQueryProvider>
    );

    expect(screen.getByText("Revision 3")).toBeInTheDocument();
    expect(screen.getByTestId("node-canvas")).toHaveTextContent("3 nodes");

    const nextDefinition = structuredClone(definition);
    nextDefinition.nodes = nextDefinition.nodes.slice(0, 1);
    view.rerender(
      <AigcQueryProvider>
        <AigcEditor
          entity={{
            ...pipeline,
            id: "pipeline-2",
            name: "切换后的画布",
            revision: 7,
            definition: nextDefinition
          }}
          mode="pipeline"
        />
      </AigcQueryProvider>
    );

    expect(screen.getByText("Revision 7")).toBeInTheDocument();
    expect(screen.getByText("切换后的画布")).toBeInTheDocument();
    expect(screen.getByTestId("node-canvas")).toHaveTextContent("1 nodes");
  });

  it("filters media assets by node type and replaces them after upload", async () => {
    const mediaDefinition: AigcPipelineDefinition = {
      schemaVersion: 1,
      nodes: [
        {
          id: "video-input",
          type: "video_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 180 },
          config: { asset_id: "missing-video" }
        },
        {
          id: "audio-input",
          type: "audio_input",
          position: { x: 0, y: 220 },
          size: { width: 240, height: 160 },
          config: { asset_id: null }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const mediaPipeline = { ...pipeline, definition: mediaDefinition };
    const availableVideo = {
      id: "video-available",
      asset_role: "public",
      metadata: { name: "可用视频.mp4" },
      mime_type: "video/mp4",
      status: "succeeded",
      type: "uploaded_video"
    };
    apiMocks.listAssets.mockResolvedValue([
      availableVideo,
      {
        ...availableVideo,
        id: "96b6a118-aa5c-42f8-aafd-e5c8c0caf1f7",
        metadata: { name: "96b6a118-aa5c-42f8-aafd-e5c8c0caf1f7" }
      },
      {
        ...availableVideo,
        id: "video-failed",
        metadata: { name: "失败视频.mp4" },
        status: "failed"
      },
      {
        ...availableVideo,
        id: "wrong-image",
        metadata: { name: "图片.png" },
        mime_type: "image/png",
        type: "uploaded_image"
      }
    ]);
    apiMocks.listToolAssets.mockResolvedValue([
      {
        ...availableVideo,
        id: "audio-available",
        metadata: { name: "可用音频.mp3" },
        mime_type: "audio/mpeg",
        type: "uploaded_audio"
      }
    ]);
    apiMocks.uploadAigcMedia.mockResolvedValue({
      ...availableVideo,
      id: "video-uploaded",
      metadata: { name: "替换视频.mp4" }
    });
    const { store } = renderEditor(mediaPipeline, "pipeline");

    act(() => store.getState().selectNode("video-input"));
    expect(await screen.findByText(/当前资产不可用/)).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: "从资产库选择视频" })
    );
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("可用视频.mp4")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "选择视频：视频素材" })
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("失败视频.mp4")).toBeNull();
    expect(within(dialog).queryByText("图片.png")).toBeNull();
    expect(within(dialog).queryByText("可用音频.mp3")).toBeNull();
    fireEvent.change(within(dialog).getByLabelText("搜索资产库视频"), {
      target: { value: "不存在的素材" }
    });
    expect(within(dialog).getByText("没有匹配的素材")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("搜索资产库视频"), {
      target: { value: "可用" }
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "选择视频：可用视频.mp4" })
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    let videoNode = store
      .getState()
      .definition.nodes.find((node) => node.id === "video-input");
    expect(videoNode?.type).toBe("video_input");
    if (videoNode?.type === "video_input") {
      expect(videoNode.config.asset_id).toBe("missing-video");
    }

    fireEvent.click(
      screen.getByRole("button", { name: "从资产库选择视频" })
    );
    dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "选择视频：可用视频.mp4" })
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "确认选择" })
    );
    videoNode = store
      .getState()
      .definition.nodes.find((node) => node.id === "video-input");
    expect(videoNode?.type).toBe("video_input");
    if (videoNode?.type === "video_input") {
      expect(videoNode.config.asset_id).toBe("video-available");
    }

    fireEvent.change(screen.getByLabelText("本地上传"), {
      target: {
        files: [new File(["video"], "替换视频.mp4", { type: "video/mp4" })]
      }
    });
    await waitFor(() => {
      expect(apiMocks.uploadAigcMedia).toHaveBeenCalledWith(
        "video",
        expect.any(File),
        { filename: "替换视频.mp4", mimeType: "video/mp4" }
      );
    });
    videoNode = store
      .getState()
      .definition.nodes.find((node) => node.id === "video-input");
    expect(videoNode?.type).toBe("video_input");
    if (videoNode?.type === "video_input") {
      expect(videoNode.config.asset_id).toBe("video-uploaded");
    }

    act(() => store.getState().selectNode("audio-input"));
    fireEvent.click(
      await screen.findByRole("button", { name: "从资产库选择音频" })
    );
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("可用音频.mp3")).toBeInTheDocument();
    expect(within(dialog).queryByText("可用视频.mp4")).toBeNull();
  });

  it("configures video task type and warns when edit has no video", async () => {
    const videoDefinition: AigcPipelineDefinition = {
      schemaVersion: 1,
      nodes: [
        {
          id: "prompt",
          type: "text_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { text: "生成品牌短片" }
        },
        {
          id: "video-model",
          type: "video_generation",
          position: { x: 320, y: 0 },
          size: { width: 280, height: 200 },
          config: {
            model: "doubao-seedance-2-5-260628",
            generation_mode: "multimodal_reference",
            task_type: "generate",
            resolution: "720p",
            aspect_ratio: "adaptive",
            duration_seconds: -1,
            generate_audio: true
          }
        }
      ],
      edges: [
        {
          id: "prompt-edge",
          sourceNodeId: "prompt",
          sourceHandle: "text",
          targetNodeId: "video-model",
          targetHandle: "prompt"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const { store } = renderEditor(
      { ...pipeline, definition: videoDefinition },
      "pipeline"
    );

    act(() => store.getState().selectNode("video-model"));
    const taskType = await screen.findByLabelText("任务类型");
    expect(taskType).toHaveValue("generate");
    fireEvent.change(taskType, { target: { value: "edit" } });

    expect(
      store.getState().definition.nodes.find(
        (node) => node.id === "video-model"
      )
    ).toMatchObject({ config: { task_type: "edit" } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "编辑任务必须连接参考视频"
    );
  });

  it("configures video generation and normalizes unsupported model values", async () => {
    const { store } = renderEditor(videoPipeline(), "pipeline");
    act(() => store.getState().selectNode("video-model"));

    fireEvent.change(screen.getByLabelText("分辨率"), {
      target: { value: "1080p" }
    });
    fireEvent.change(screen.getByLabelText("时长"), {
      target: { value: "30" }
    });
    fireEvent.change(screen.getByLabelText("宽高比"), {
      target: { value: "21:9" }
    });
    const generateAudio = screen.getByRole("checkbox", { name: "生成音频" });
    expect(generateAudio).toBeChecked();
    expect(generateAudio).not.toHaveAttribute("readonly");
    fireEvent.click(generateAudio);
    expect(generateAudio).not.toBeChecked();
    fireEvent.click(generateAudio);
    expect(generateAudio).toBeChecked();
    fireEvent.click(generateAudio);
    expect(generateAudio).not.toBeChecked();
    fireEvent.change(screen.getByLabelText("模型"), {
      target: { value: "doubao-seedance-2-0-fast-260128" }
    });

    expect(screen.getByLabelText("分辨率")).toHaveValue("720p");
    expect(screen.getByLabelText("时长")).toHaveValue("-1");
    const node = store
      .getState()
      .definition.nodes.find((candidate) => candidate.id === "video-model");
    expect(node?.type).toBe("video_generation");
    if (node?.type === "video_generation") {
      expect(node.config).toMatchObject({
        aspect_ratio: "21:9",
        duration_seconds: -1,
        generate_audio: false,
        model: "doubao-seedance-2-0-fast-260128",
        resolution: "720p"
      });
    }

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledWith(
        "pipeline-1",
        expect.objectContaining({
          definition: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "video-model",
                config: expect.objectContaining({
                  aspect_ratio: "21:9",
                  generate_audio: false
                })
              })
            ])
          })
        })
      );
    });
  });

  it("keeps incompatible edges on mode switch and blocks save with a located error", async () => {
    const { store } = renderEditor(
      videoPipeline("first_frame", "first_frame"),
      "pipeline"
    );
    act(() => store.getState().selectNode("video-model"));

    fireEvent.change(screen.getByLabelText("生成模式"), {
      target: { value: "text_to_video" }
    });

    expect(store.getState().definition.edges).toHaveLength(1);
    expect(
      screen.getByText("首帧不适用于当前生成模式，请断开对应连线")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByText(
        "生视频节点（video-model）：首帧不适用于当前生成模式，请断开对应连线"
      )
    ).toBeInTheDocument();
    expect(apiMocks.updateAigcPipeline).not.toHaveBeenCalled();
  });

  it("switches Seedream operations without deleting edges and blocks an incompatible run", async () => {
    const seedreamDefinition: AigcPipelineDefinition = {
      schemaVersion: 1,
      nodes: [
        {
          id: "image-source",
          type: "image_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: "asset-image" }
        },
        {
          id: "prompt",
          type: "text_input",
          position: { x: 0, y: 200 },
          size: { width: 240, height: 160 },
          config: { text: "拆分商品" }
        },
        {
          id: "seedream",
          type: "image_to_image",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 180 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            aspect_ratio: "1:1",
            size: "2K",
            format: "png"
          }
        },
        {
          id: "output",
          type: "image_output",
          position: { x: 640, y: 0 },
          size: { width: 240, height: 160 },
          config: { title: "结果" }
        }
      ],
      edges: [
        {
          id: "image-edge",
          sourceNodeId: "image-source",
          sourceHandle: "image",
          targetNodeId: "seedream",
          targetHandle: "image"
        },
        {
          id: "prompt-edge",
          sourceNodeId: "prompt",
          sourceHandle: "text",
          targetNodeId: "seedream",
          targetHandle: "prompt"
        },
        {
          id: "output-edge",
          sourceNodeId: "seedream",
          sourceHandle: "image",
          targetNodeId: "output",
          targetHandle: "image"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const { store } = renderEditor(
      { ...pipeline, definition: seedreamDefinition },
      "pipeline"
    );
    act(() => store.getState().selectNode("seedream"));

    expect(
      screen.getByRole("button", { name: "图生图" })
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "图层拆分" }));

    expect(store.getState().definition.edges).toHaveLength(3);
    expect(
      store.getState().definition.nodes.find((node) => node.id === "seedream")
    ).toMatchObject({
      config: { operation: "layer_decomposition", size: "auto" }
    });
    expect(screen.getByLabelText("拆分尺寸")).toHaveValue("auto");
    expect(screen.queryByLabelText("画幅")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "图片输出不适用于当前编辑目标或模式，请断开对应连线"
    );

    fireEvent.click(screen.getByRole("button", { name: "执行" }));
    expect(
      await screen.findByText(
        "Seedream 图片节点（seedream）：图片输出不适用于当前编辑目标或模式，请断开对应连线"
      )
    ).toBeInTheDocument();
    expect(apiMocks.createAigcRun).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "图片编辑" }));
    expect(
      store.getState().definition.nodes.find((node) => node.id === "seedream")
    ).toMatchObject({ config: { operation: "image_edit", size: "2K" } });
  });

  it("blocks execution when aggregated layer decomposition preflight fails", async () => {
    const layerDefinition: AigcPipelineDefinition = {
      schemaVersion: 1,
      nodes: [
        {
          id: "image-source",
          type: "image_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: "asset-webp" }
        },
        {
          id: "seedream",
          type: "image_to_image",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 180 },
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
          id: "image-edge",
          sourceNodeId: "image-source",
          sourceHandle: "image",
          targetNodeId: "seedream",
          targetHandle: "image"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    apiMocks.listAssets.mockResolvedValue([
      {
        id: "asset-webp",
        project_id: null,
        type: "uploaded_image",
        category: null,
        status: "succeeded",
        stage: null,
        url: "/asset.webp",
        object_key: "asset.webp",
        mime_type: "image/webp",
        size_bytes: 1024,
        source_task_id: null,
        metadata: {
          inspection_version: 1,
          width: 1024,
          height: 1024
        },
        created_at: "2026-08-30T00:00:00Z",
        updated_at: "2026-08-30T00:00:00Z"
      }
    ]);
    const { store } = renderEditor(
      { ...pipeline, definition: layerDefinition },
      "pipeline"
    );
    act(() => store.getState().selectNode("seedream"));
    expect(
      await screen.findByText("图层拆分仅支持 PNG/JPEG 图片")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "执行" }));

    expect(
      await screen.findByText(
        "Seedream 图片节点（seedream）：图层拆分仅支持 PNG/JPEG 图片"
      )
    ).toBeInTheDocument();
    expect(apiMocks.createAigcRun).not.toHaveBeenCalled();
  });

  it("blocks execution and identifies an invalid video node", async () => {
    renderEditor(videoPipeline("text_to_video", null), "pipeline");

    fireEvent.click(screen.getByRole("button", { name: "执行" }));

    expect(
      await screen.findByText(
        "生视频节点（video-model）：文生视频模式必须连接提示词"
      )
    ).toBeInTheDocument();
    expect(apiMocks.createAigcRun).not.toHaveBeenCalled();
  });

  it("disables paid execution in acceptance mode", () => {
    render(
      <AigcQueryProvider>
        <AigcEditor
          allowExecution={false}
          entity={pipeline}
          mode="pipeline"
        />
      </AigcQueryProvider>
    );

    const executeButton = screen.getByRole("button", { name: "执行" });
    expect(executeButton).toBeDisabled();
    fireEvent.click(executeButton);
    expect(apiMocks.createAigcRun).not.toHaveBeenCalled();
  });

  it("shows run timing, scheduling errors, attempts, and node failure details", async () => {
    const run = runFixture({
      id: "run-log-details",
      run_number: 7,
      status: "failed",
      error: {
        code: "SCHEDULING_FAILED",
        message: "运行调度失败",
        request_id: "request-run-7",
        stage: "scheduling"
      }
    });
    const firstAttempt = attemptFixture(1, {
      task_id: "task-model-1",
      run_id: run.id,
      status: "failed",
      error: {
        code: "OLD_ERROR",
        message: "旧 attempt 错误",
        request_id: null,
        stage: null
      }
    });
    const secondAttempt = attemptFixture(2, {
      task_id: "task-model-2",
      run_id: run.id,
      status: "failed",
      error: {
        code: "PROVIDER_FAILED",
        message: "服务商处理失败",
        request_id: "request-task-2",
        stage: "provider"
      }
    });
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [run],
      page: 1,
      page_size: 20,
      total: 1
    });
    apiMocks.getAigcRun.mockResolvedValue({
      run,
      nodes: [
        runNodeFixture("model", {
          status: "failed",
          current_task_id: secondAttempt.task_id,
          attempts: [secondAttempt, firstAttempt]
        }),
        runNodeFixture("timeout", {
          status: "timed_out",
          current_task_id: "task-timeout",
          attempts: [
            attemptFixture(1, {
              task_id: "task-timeout",
              node_id: "timeout",
              run_id: run.id,
              status: "timed_out",
              error: null
            })
          ]
        }),
        runNodeFixture("blocked", { status: "blocked" }),
        runNodeFixture("input")
      ]
    });
    renderEditor(pipeline, "pipeline");

    fireEvent.click(screen.getByRole("tab", { name: "运行" }));

    const historyOption = await screen.findByRole("option", {
      name: `#7 · 失败 · ${formatAigcLogTime(run.created_at)}`
    });
    expect(historyOption).toBeInTheDocument();
    const summary = await screen.findByLabelText("Run 时间摘要");
    expect(
      within(summary).getByText(formatAigcLogTime(run.started_at))
    ).toBeInTheDocument();
    expect(
      within(summary).getByText(formatAigcLogTime(run.finished_at))
    ).toBeInTheDocument();
    expect(within(summary).getByText("1 分 5 秒")).toBeInTheDocument();

    const runError = screen.getByLabelText("Run 失败原因");
    expect(runError).toHaveTextContent("运行调度失败");
    expect(runError).toHaveTextContent(
      "错误码：SCHEDULING_FAILED · 阶段：scheduling · Request ID：request-run-7"
    );

    const modelLog = screen.getByRole("group", { name: "节点日志：model" });
    expect(modelLog).toHaveTextContent("失败 · 2 次尝试 · Attempt #2");
    expect(modelLog).toHaveTextContent("服务商处理失败");
    expect(modelLog).toHaveTextContent(
      "错误码：PROVIDER_FAILED · 阶段：provider · Request ID：request-task-2"
    );
    expect(modelLog).not.toHaveTextContent("旧 attempt 错误");

    const timeoutLog = screen.getByRole("group", {
      name: "节点日志：timeout"
    });
    expect(timeoutLog).toHaveTextContent("执行失败，未提供详细原因");
    expect(
      screen.getByRole("group", { name: "节点日志：blocked" })
    ).toHaveTextContent("因上游失败被阻塞");
    expect(
      screen.getByRole("group", { name: "节点日志：input" })
    ).not.toHaveTextContent("Attempt #");
  });

  it("shows active placeholders and isolates details when switching run history", async () => {
    const activeRun = runFixture({
      id: "run-active",
      run_number: 2,
      status: "running",
      created_at: "2026-08-29T04:00:00Z",
      updated_at: "2026-08-29T04:00:10Z",
      started_at: "2026-08-29T04:00:00Z",
      finished_at: null
    });
    const historicalRun = runFixture({
      id: "run-history",
      run_number: 1,
      status: "failed",
      error: {
        code: "HISTORICAL_FAILURE",
        message: "历史运行失败",
        request_id: null,
        stage: "execution"
      },
      created_at: "2026-08-29T02:00:00Z",
      updated_at: "2026-08-29T02:02:00Z",
      started_at: "2026-08-29T02:00:00Z",
      finished_at: "2026-08-29T02:02:00Z"
    });
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [activeRun, historicalRun],
      page: 1,
      page_size: 20,
      total: 2
    });
    apiMocks.getAigcRun.mockImplementation(async (runId: string) => {
      const run = runId === historicalRun.id ? historicalRun : activeRun;
      return {
        run,
        nodes: [
          runNodeFixture(runId === historicalRun.id ? "historical" : "active", {
            status: run.status === "running" ? "running" : "failed"
          })
        ]
      };
    });
    renderEditor(pipeline, "pipeline");

    fireEvent.click(screen.getByRole("tab", { name: "运行" }));
    const activeSummary = await screen.findByLabelText("Run 时间摘要");
    expect(within(activeSummary).getAllByText("进行中")).toHaveLength(2);
    expect(screen.queryByText("历史运行失败")).toBeNull();

    fireEvent.change(screen.getByLabelText("运行历史"), {
      target: { value: historicalRun.id }
    });

    const historicalError = await screen.findByText("历史运行失败");
    expect(historicalError).toBeInTheDocument();
    expect(screen.getByText("Run #1")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "节点日志：active" })).toBeNull();
    expect(
      screen.getByRole("group", { name: "节点日志：historical" })
    ).toBeInTheDocument();
    const historicalSummary = screen.getByLabelText("Run 时间摘要");
    expect(within(historicalSummary).queryByText("进行中")).toBeNull();
    expect(within(historicalSummary).getByText("2 分")).toBeInTheDocument();
  });

  it("offers a download action for every available image result", async () => {
    const run = {
      id: "run-download",
      pipeline_id: pipeline.id,
      run_number: 1,
      pipeline_revision: pipeline.revision,
      mode: "full",
      start_node_id: null,
      source_run_id: null,
      source_node_id: null,
      status: "succeeded",
      definition_snapshot: definition,
      input_snapshot: {},
      cancellation_requested: false,
      created_at: "2026-08-29T03:00:00Z",
      updated_at: "2026-08-29T03:00:00Z",
      started_at: "2026-08-29T03:00:00Z",
      finished_at: "2026-08-29T03:00:01Z"
    };
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [run],
      page: 1,
      page_size: 20,
      total: 1
    });
    apiMocks.getAigcRun.mockResolvedValue({
      run,
      nodes: [
        {
          node_id: "output",
          included_in_plan: true,
          status: "succeeded",
          current_task_id: null,
          reused_from_task_id: null,
          input_hash: null,
          attempts: [],
          result: {
            kind: "assets",
            text: null,
            text_digest: null,
            assets: [
              {
                asset_id: "asset-output-1",
                ordinal: 0,
                mime_type: "image/webp",
                download_url: "/api/assets/asset-output-1/content",
                available: true
              },
              {
                asset_id: "asset-output-2",
                ordinal: 1,
                mime_type: "image/jpeg",
                download_url: "/api/assets/asset-output-2/content",
                available: true
              }
            ]
          }
        }
      ]
    });
    renderEditor(pipeline, "pipeline");

    await waitFor(() => {
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith("run-download");
    });
    fireEvent.click(screen.getByRole("tab", { name: "结果" }));

    const downloads = await screen.findAllByRole("link", {
      name: "下载图片"
    });
    expect(downloads).toHaveLength(2);
    expect(downloads[0]).toHaveAttribute("download", "结果-1.webp");
    expect(downloads[1]).toHaveAttribute("download", "结果-2.jpg");
  });

  it("shows a layer composite flat image and preserves its layer set projection", async () => {
    const compositeDefinition: AigcPipelineDefinition = {
      schemaVersion: 1,
      nodes: [
        {
          id: "composite",
          type: "layer_composite",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 180 },
          config: {}
        },
        {
          id: "output",
          type: "image_output",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 180 },
          config: { title: "最终扁平图" }
        }
      ],
      edges: [
        {
          id: "flat-image",
          sourceNodeId: "composite",
          sourceHandle: "image",
          targetNodeId: "output",
          targetHandle: "image"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const run = {
      id: "run-composite",
      pipeline_id: pipeline.id,
      run_number: 1,
      pipeline_revision: pipeline.revision,
      mode: "full" as const,
      start_node_id: null,
      source_run_id: null,
      source_node_id: null,
      status: "succeeded" as const,
      definition_snapshot: compositeDefinition,
      input_snapshot: {},
      cancellation_requested: false,
      created_at: "2026-08-30T03:00:00Z",
      updated_at: "2026-08-30T03:00:01Z",
      started_at: "2026-08-30T03:00:00Z",
      finished_at: "2026-08-30T03:00:01Z"
    };
    const flattenedAsset = {
      asset_id: "flattened",
      ordinal: 0,
      mime_type: "image/png",
      download_url: "/api/assets/flattened/content",
      available: true
    };
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [run],
      page: 1,
      page_size: 20,
      total: 1
    });
    apiMocks.getAigcRun.mockResolvedValue({
      run,
      nodes: [
        {
          node_id: "composite",
          included_in_plan: true,
          status: "succeeded",
          current_task_id: "task-composite",
          reused_from_task_id: null,
          input_hash: "hash",
          attempts: [],
          result: {
            kind: "layer_composite",
            text: null,
            text_digest: null,
            assets: [flattenedAsset],
            layer_set: {
              id: "set-2",
              parent_layer_set_id: "set-1",
              source_asset_id: "source",
              base_asset_id: "base",
              canvas_width: 1000,
              canvas_height: 1000,
              version: 2,
              digest: "b".repeat(64),
              layers: [
                {
                  id: "product",
                  asset_id: "product-edited",
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
            }
          }
        },
        {
          node_id: "output",
          included_in_plan: true,
          status: "succeeded",
          current_task_id: null,
          reused_from_task_id: null,
          input_hash: null,
          attempts: [],
          result: {
            kind: "assets",
            text: null,
            text_digest: null,
            assets: [flattenedAsset]
          }
        }
      ]
    });
    const { store } = renderEditor(
      { ...pipeline, definition: compositeDefinition },
      "pipeline"
    );

    await waitFor(() => {
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(run.id);
    });
    act(() => store.getState().selectNode("composite"));
    fireEvent.click(screen.getByRole("tab", { name: "结果" }));

    expect(await screen.findByAltText("生成结果 1")).toHaveAttribute(
      "src",
      "http://localhost:8000/api/assets/flattened/content"
    );
    expect(screen.getByText("图层集 v2 · 2 个图层")).toBeInTheDocument();
    expect(
      screen.getByText("已保留新图层集，可连接后续图层画布继续编辑")
    ).toBeInTheDocument();

    act(() => store.getState().selectNode("output"));
    expect(await screen.findByAltText("生成结果 1")).toHaveAttribute(
      "src",
      "http://localhost:8000/api/assets/flattened/content"
    );
    expect(screen.queryByText("图层集 v2 · 2 个图层")).toBeNull();
  });

  it("projects video results and switches to an unavailable historical run", async () => {
    const videoDefinition: AigcPipelineDefinition = {
      schemaVersion: 1,
      nodes: [
        {
          id: "video-model",
          type: "video_generation",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 180 },
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
          position: { x: 320, y: 0 },
          size: { width: 240, height: 180 },
          config: { title: "广告成片" }
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
    const makeRun = (id: string, runNumber: number) => ({
      id,
      pipeline_id: pipeline.id,
      run_number: runNumber,
      pipeline_revision: pipeline.revision,
      mode: "full" as const,
      start_node_id: null,
      source_run_id: null,
      source_node_id: null,
      status: "succeeded" as const,
      definition_snapshot: videoDefinition,
      input_snapshot: {},
      cancellation_requested: false,
      created_at: `2026-08-29T0${runNumber}:00:00Z`,
      updated_at: `2026-08-29T0${runNumber}:00:01Z`,
      started_at: `2026-08-29T0${runNumber}:00:00Z`,
      finished_at: `2026-08-29T0${runNumber}:00:01Z`
    });
    const latestRun = makeRun("run-video-latest", 2);
    const oldRun = makeRun("run-video-old", 1);
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [latestRun, oldRun],
      page: 1,
      page_size: 20,
      total: 2
    });
    apiMocks.getAigcRun.mockImplementation(async (runId: string) => ({
      run: runId === oldRun.id ? oldRun : latestRun,
      nodes: [
        {
          node_id: "video-output",
          included_in_plan: true,
          status: "succeeded",
          current_task_id: null,
          reused_from_task_id: null,
          input_hash: null,
          attempts: [],
          result:
            runId === oldRun.id
              ? {
                  kind: "unavailable",
                  text: null,
                  text_digest: null,
                  assets: [
                    {
                      asset_id: "deleted-video",
                      ordinal: 0,
                      mime_type: "video/mp4",
                      download_url: null,
                      available: false
                    }
                  ]
                }
              : {
                  kind: "assets",
                  text: null,
                  text_digest: null,
                  assets: [
                    {
                      asset_id: "current-video",
                      ordinal: 0,
                      mime_type: "video/mp4",
                      download_url: "/api/assets/current-video/content",
                      available: true
                    }
                  ]
                }
        }
      ]
    }));
    renderEditor({ ...pipeline, definition: videoDefinition }, "pipeline");

    fireEvent.click(screen.getByRole("tab", { name: "结果" }));
    const video = await screen.findByLabelText("播放视频：广告成片-1");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveClass("h-full", "w-full", "object-contain");
    expect(video.parentElement).toHaveClass("h-44");
    expect(video.parentElement).not.toHaveClass("nodrag", "nopan", "nowheel");
    expect(
      screen.getByText(/1080p · 12s · 有音频 · video\/mp4 · 可用/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "下载视频" })
    ).toHaveAttribute("download", "广告成片-1.mp4");

    fireEvent.click(
      screen.getByRole("button", { name: "放大预览：广告成片-1" })
    );
    const preview = screen.getByLabelText("广告成片-1 放大预览");
    expect(preview).toHaveAttribute("controls");
    expect(preview).toHaveAttribute("autoplay");
    expect(preview).toHaveClass("object-contain");
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));

    fireEvent.click(screen.getByRole("tab", { name: "运行" }));
    fireEvent.change(await screen.findByLabelText("运行历史"), {
      target: { value: oldRun.id }
    });
    await waitFor(() => {
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(oldRun.id);
    });
    fireEvent.click(screen.getByRole("tab", { name: "结果" }));

    expect(
      await screen.findByText("历史结果已不可用，资产可能已删除或无权访问")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/播放视频：广告成片/)).toBeNull();
    expect(screen.queryByRole("link", { name: "下载视频" })).toBeNull();
  });

  it("saves a pipeline as a template through an in-app dialog", async () => {
    renderEditor(pipeline, "pipeline");

    fireEvent.click(screen.getByRole("button", { name: "另存为模板" }));

    expect(
      screen.getByRole("heading", { name: "另存为模板" })
    ).toBeInTheDocument();
    const nameInput = screen.getByLabelText("模板名称");
    expect(nameInput).toHaveValue("商品模板");
    fireEvent.change(nameInput, { target: { value: "商品模板副本" } });
    fireEvent.click(screen.getByRole("button", { name: "保存模板" }));

    await waitFor(() => {
      expect(apiMocks.saveAigcPipelineAsTemplate).toHaveBeenCalledWith(
        "pipeline-1",
        {
          name: "商品模板副本",
          description: "模板描述"
        }
      );
    });
    expect(
      await screen.findByText("已保存为模板：商品模板副本")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "另存为模板" })
    ).not.toBeInTheDocument();
  });

  it("surfaces revision conflicts without marking the draft saved", async () => {
    apiMocks.isApiError.mockReturnValue(true);
    apiMocks.updateAigcPipeline.mockRejectedValue({ status: 409 });
    renderEditor(pipeline, "pipeline");

    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "冲突画布" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByText("保存冲突：服务端已有更新，请刷新后重新编辑。")
    ).toBeInTheDocument();
    expect(screen.getByText("未保存")).toBeInTheDocument();
  });

  it("blocks browser unload while the editor is dirty", () => {
    renderEditor(pipeline, "pipeline");
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "未保存画布" }
    });

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("continues from a layer canvas with from_node without saving other drafts", async () => {
    const entity = layerCanvasPipeline();
    const sourceAsset = {
      id: "layer-source",
      project_id: null,
      type: "uploaded_image",
      category: null,
      status: "succeeded",
      stage: null,
      url: "/layer-source.png",
      object_key: "layer-source.png",
      mime_type: "image/png",
      size_bytes: 1024,
      source_task_id: null,
      metadata: {
        inspection_version: 1,
        width: 1024,
        height: 1024
      },
      created_at: "2026-08-30T03:00:00Z",
      updated_at: "2026-08-30T03:00:00Z"
    };
    apiMocks.listAssets.mockResolvedValue([sourceAsset]);
    apiMocks.createAigcRun.mockResolvedValue({
      run: {
        id: "run-from-layer-canvas",
        pipeline_id: entity.id,
        run_number: 1,
        pipeline_revision: entity.revision,
        mode: "from_node",
        start_node_id: "layer-canvas",
        source_run_id: null,
        source_node_id: null,
        status: "queued",
        definition_snapshot: entity.definition,
        input_snapshot: {},
        cancellation_requested: false,
        created_at: "2026-08-30T03:00:00Z",
        updated_at: "2026-08-30T03:00:00Z",
        started_at: null,
        finished_at: null
      },
      nodes: []
    });
    const first = renderEditor(entity, "pipeline");

    fireEvent.click(screen.getByRole("button", { name: "从图层节点继续" }));

    await waitFor(() => {
      expect(apiMocks.createAigcRun).toHaveBeenCalledWith(
        entity.id,
        {
          expected_revision: entity.revision,
          mode: "from_node",
          start_node_id: "layer-canvas"
        },
        expect.any(String)
      );
    });
    expect(apiMocks.updateAigcPipeline).not.toHaveBeenCalled();
    first.unmount();

    const second = renderEditor(entity, "pipeline");
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "尚未保存的其他草稿" }
    });
    fireEvent.click(screen.getByRole("button", { name: "从图层节点继续" }));

    expect(
      await screen.findByText(
        "主画布有未保存修改，请先保存 Pipeline 后再从此节点继续。"
      )
    ).toBeInTheDocument();
    expect(apiMocks.updateAigcPipeline).not.toHaveBeenCalled();
    expect(apiMocks.createAigcRun).toHaveBeenCalledTimes(1);
    second.unmount();
  });

  it("submits a full run with the saved pipeline revision", async () => {
    apiMocks.createAigcRun.mockResolvedValue({
      run: {
        id: "run-1",
        pipeline_id: pipeline.id,
        run_number: 1,
        pipeline_revision: pipeline.revision,
        mode: "full",
        start_node_id: null,
        source_run_id: null,
        source_node_id: null,
        status: "queued",
        definition_snapshot: definition,
        input_snapshot: {},
        cancellation_requested: false,
        created_at: "2026-08-29T03:00:00Z",
        updated_at: "2026-08-29T03:00:00Z",
        started_at: null,
        finished_at: null
      },
      nodes: []
    });
    renderEditor(pipeline, "pipeline");

    fireEvent.click(screen.getByRole("button", { name: "执行" }));

    await waitFor(() => {
      expect(apiMocks.createAigcRun).toHaveBeenCalledWith(
        "pipeline-1",
        {
          expected_revision: 3,
          mode: "full",
          start_node_id: null
        },
        expect.any(String)
      );
    });
  });
});
