import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useEffect } from "react";
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
import { migrateAigcDefinitionV2 } from "@/lib/aigc/definition-migration";
import { formatAigcLogTime } from "@/lib/aigc/run-log";
import type {
  AigcEdge,
  AigcNode,
  AigcPipeline,
  AigcPipelineDefinition,
  AigcPipelineDefinitionV2,
  AigcPipelineRun,
  AigcPipelineRunDetail,
  AigcPipelineRunNode,
  AigcPipelineTaskAttempt,
  AigcPipelineTemplate,
  AigcResultAsset,
  AigcV2Node
} from "@/lib/aigc/types";

const apiMocks = vi.hoisted(() => ({
  cancelAigcRun: vi.fn(),
  createAigcRun: vi.fn(),
  getAigcPipeline: vi.fn(),
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
const navigationMocks = vi.hoisted(() => ({
  push: vi.fn()
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: apiMocks,
  getBackendBaseUrl: () => "http://localhost:8000",
  getUserFacingErrorMessage: () => "请求失败",
  isApiError: apiMocks.isApiError
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigationMocks
}));

vi.mock("@/components/workspace/canvas/node-canvas", async () => {
  const { useAigcRunActions } = await import(
    "@/components/workspace/aigc/aigc-run-context"
  );
  return {
    NodeCanvas: ({
      backgroundProps,
      className,
      controlsProps,
      nodes,
      reactFlowProps
    }: {
      backgroundProps?: {
        color?: string;
        gap?: number;
        size?: number;
      };
      className?: string;
      controlsProps?: {
        className?: string;
        orientation?: string;
        position?: string;
      };
      nodes: Array<{
        id: string;
        style?: { height?: number; width?: number };
        type?: string;
      }>;
      reactFlowProps?: {
        fitViewOptions?: { minZoom?: number };
        minZoom?: number;
        onMoveEnd?: (
          event: unknown,
          viewport: { x: number; y: number; zoom: number }
        ) => void;
        onNodeClick?: (
          event: unknown,
          node: {
            id: string;
          }
        ) => void;
        onNodeContextMenu?: (
          event: React.MouseEvent,
          node: { id: string }
        ) => void;
        onPaneContextMenu?: (event: React.MouseEvent) => void;
        onInit?: (instance: {
          screenToFlowPosition: (position: {
            x: number;
            y: number;
          }) => { x: number; y: number };
        }) => void;
        onPaneClick?: () => void;
        translateExtent?: unknown;
      };
    }) => {
      const runActions = useAigcRunActions();
      useEffect(() => {
        reactFlowProps?.onInit?.({
          screenToFlowPosition: ({ x, y }) => ({ x: x - 100, y: y - 50 })
        });
      }, [reactFlowProps]);
      const layerCanvas = nodes.find((node) => node.type === "layer_canvas");
      const layerComposite = nodes.find(
        (node) => node.type === "layer_composite"
      );
      return (
        <div
          className={className}
          data-background-color={backgroundProps?.color ?? "default"}
          data-background-gap={backgroundProps?.gap ?? "default"}
          data-background-size={backgroundProps?.size ?? "default"}
          data-fit-view-min-zoom={reactFlowProps?.fitViewOptions?.minZoom ?? "default"}
          data-controls-class={controlsProps?.className ?? ""}
          data-controls-orientation={controlsProps?.orientation ?? "default"}
          data-controls-position={controlsProps?.position ?? "default"}
          data-layer-canvas-size={
            layerCanvas
              ? `${layerCanvas.style?.width}x${layerCanvas.style?.height}`
              : "none"
          }
          data-layer-composite-size={
            layerComposite
              ? `${layerComposite.style?.width}x${layerComposite.style?.height}`
              : "none"
          }
          data-min-zoom={reactFlowProps?.minZoom ?? "default"}
          data-testid="node-canvas"
          data-translate-extent={String("translateExtent" in (reactFlowProps ?? {}))}
        >
          {nodes.length} nodes
          {runActions && layerCanvas ? (
            <>
              <button
                disabled={runActions.pendingForNode(layerCanvas.id)}
                onClick={() => runActions.continueFromNode(layerCanvas.id)}
                type="button"
              >
                从图层节点继续
              </button>
              <button
                onClick={() =>
                  runActions.openLayerEditor(
                    `/workspace/aigc/pipelines/pipeline-1/nodes/${layerCanvas.id}/layers`
                  )
                }
                type="button"
              >
                打开图层编辑器
              </button>
            </>
          ) : null}
          <button
            onClick={() =>
              reactFlowProps?.onMoveEnd?.(null, { x: 12, y: 24, zoom: 0.8 })
            }
            type="button"
          >
            移动画布视口
          </button>
          <button
            onClick={() => {
              const target = nodes.find((node) => node.id === "model") ?? nodes[0];
              if (target) reactFlowProps?.onNodeClick?.(null, target);
            }}
            type="button"
          >
            选择画布节点
          </button>
          {nodes.map((node) => (
            <button
              aria-label={`选择节点 ${node.id}`}
              key={node.id}
              onClick={() => reactFlowProps?.onNodeClick?.(null, node)}
              onContextMenu={(event) =>
                reactFlowProps?.onNodeContextMenu?.(event, node)
              }
              type="button"
            >
              {node.id}
            </button>
          ))}
          <button onClick={() => reactFlowProps?.onPaneClick?.()} type="button">
            点击画布空白
          </button>
          <button
            aria-label="右键画布空白"
            onContextMenu={(event) =>
              reactFlowProps?.onPaneContextMenu?.(event)
            }
            type="button"
          >
            右键画布空白
          </button>
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
  latest_run_status: null,
  thumbnail_asset_id: null,
  thumbnail: null
};

function modalityPipeline(): AigcPipeline {
  const definitionV2: AigcPipelineDefinitionV2 = {
    schemaVersion: 2,
    nodes: [
      {
        id: "producer",
        type: "llm",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          model: "doubao-seed-evolving",
          system_prompt: "",
          temperature: 0.7
        }
      },
      {
        id: "model",
        type: "text",
        position: { x: 320, y: 0 },
        size: { width: 240, height: 180 },
        config: {
          text: "断开后恢复的本地文案",
          bbox_references: [],
          title: "广告文案"
        }
      }
    ],
    edges: [
      {
        id: "text-upstream",
        sourceNodeId: "producer",
        sourceHandle: "text",
        targetNodeId: "model",
        targetHandle: "text"
      }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
  return {
    ...pipeline,
    definition: definitionV2 as unknown as AigcPipelineDefinition
  };
}

function jsonParserPipeline(): AigcPipeline {
  const definitionV2: AigcPipelineDefinitionV2 = {
    schemaVersion: 2,
    nodes: [
      {
        id: "parser",
        type: "json_parser",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: { json_path: "$.items" }
      }
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
  return {
    ...pipeline,
    definition: definitionV2 as unknown as AigcPipelineDefinition
  };
}

function managedJsonTextPipeline(): AigcPipeline {
  const entity = jsonParserPipeline();
  const parser = (entity.definition as AigcPipelineDefinitionV2).nodes[0]!;
  const managedText: AigcV2Node = {
    id: "managed-text",
    type: "text",
    position: { x: 320, y: 0 },
    size: { width: 240, height: 160 },
    config: {
      text: "来自 JSON 数组的只读长文本内容",
      bbox_references: [],
      title: "JSON 项 1",
      generated_by_parser_node_id: parser.id,
      generated_item_index: 0,
      generated_from_run_id: "run-1"
    }
  };
  return {
    ...entity,
    definition: {
      ...(entity.definition as AigcPipelineDefinitionV2),
      nodes: [parser, managedText],
      edges: [
        {
          id: "parser-item-1",
          sourceNodeId: parser.id,
          sourceHandle: "items",
          targetNodeId: managedText.id,
          targetHandle: "text"
        }
      ]
    } as unknown as AigcPipelineDefinition
  };
}

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

function disconnectedPipeline(): AigcPipeline {
  const disconnectedDefinition: AigcPipelineDefinitionV2 = {
    schemaVersion: 2,
    nodes: [
      {
        id: "flow-a-model",
        type: "llm",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          model: "doubao-seed-evolving",
          system_prompt: "",
          temperature: 0.7
        }
      },
      {
        id: "flow-b-model",
        type: "llm",
        position: { x: 360, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          model: "doubao-seed-evolving",
          system_prompt: "",
          temperature: 0.7
        }
      }
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
  return {
    ...pipeline,
    definition:
      disconnectedDefinition as unknown as AigcPipelineDefinition
  };
}

function sharedImageBranchPipeline(): AigcPipeline {
  const imageModelConfig = {
    model: "doubao-seedream-5-0-pro-260628",
    aspect_ratio: "1:1" as const,
    size: "2K" as const,
    format: "png" as const
  };
  const sharedDefinition: AigcPipelineDefinitionV2 = {
    schemaVersion: 2,
    nodes: [
      {
        id: "shared-input",
        type: "text",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: { text: "共享输入", bbox_references: [], title: null }
      },
      {
        id: "shared-model",
        type: "llm",
        position: { x: 280, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          model: "doubao-seed-evolving",
          system_prompt: "",
          temperature: 0.7
        }
      },
      {
        id: "branch-a-model",
        type: "text_to_image",
        position: { x: 560, y: -180 },
        size: { width: 240, height: 160 },
        config: imageModelConfig
      },
      {
        id: "branch-a-output",
        type: "image",
        position: { x: 840, y: -180 },
        size: { width: 240, height: 160 },
        config: {
          asset_id: null,
          bbox: null,
          bbox_asset_id: null,
          title: "分支 A 图片"
        }
      },
      {
        id: "branch-b-model",
        type: "text_to_image",
        position: { x: 560, y: 180 },
        size: { width: 240, height: 160 },
        config: imageModelConfig
      },
      {
        id: "branch-b-output",
        type: "image",
        position: { x: 840, y: 180 },
        size: { width: 240, height: 160 },
        config: {
          asset_id: null,
          bbox: null,
          bbox_asset_id: null,
          title: "分支 B 图片"
        }
      }
    ],
    edges: [
      {
        id: "shared-input-model",
        sourceNodeId: "shared-input",
        sourceHandle: "text",
        targetNodeId: "shared-model",
        targetHandle: "prompt"
      },
      {
        id: "shared-branch-a",
        sourceNodeId: "shared-model",
        sourceHandle: "text",
        targetNodeId: "branch-a-model",
        targetHandle: "prompt"
      },
      {
        id: "branch-a-output-edge",
        sourceNodeId: "branch-a-model",
        sourceHandle: "image",
        targetNodeId: "branch-a-output",
        targetHandle: "image"
      },
      {
        id: "shared-branch-b",
        sourceNodeId: "shared-model",
        sourceHandle: "text",
        targetNodeId: "branch-b-model",
        targetHandle: "prompt"
      },
      {
        id: "branch-b-output-edge",
        sourceNodeId: "branch-b-model",
        sourceHandle: "image",
        targetNodeId: "branch-b-output",
        targetHandle: "image"
      }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
  return {
    ...pipeline,
    definition: sharedDefinition as unknown as AigcPipelineDefinition
  };
}

function scopedRun(
  definitionSnapshot: AigcPipelineDefinition | AigcPipelineDefinitionV2,
  id: string,
  runNumber: number,
  startNodeId: string,
  status: AigcPipelineRun["status"]
): AigcPipelineRun {
  return runFixture({
    id,
    run_number: runNumber,
    mode: "from_node",
    start_node_id: startNodeId,
    status,
    definition_snapshot: definitionSnapshot,
    finished_at:
      status === "queued" || status === "running"
        ? null
        : "2026-08-29T03:01:05Z"
  });
}

function scopedRunDetail(
  run: AigcPipelineRun,
  nodeId: string,
  text: string | null = null
): AigcPipelineRunDetail {
  const active = run.status === "queued" || run.status === "running";
  return {
    run,
    nodes: [
      runNodeFixture(nodeId, {
        status: active ? "running" : "succeeded",
        result:
          text === null
            ? {
                kind: "none",
                text: null,
                text_digest: null,
                assets: []
              }
            : {
                kind: "text",
                text,
                text_digest: "digest",
                assets: []
              }
      })
    ]
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

function videoEnhancementPipeline(): AigcPipeline {
  return {
    ...pipeline,
    definition: {
      schemaVersion: 1,
      nodes: [
        {
          id: "video-source",
          type: "video_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: "asset-video" }
        },
        {
          id: "video-enhancement",
          type: "video_enhancement",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 180 },
          config: {
            tool_version: "standard",
            scene: "aigc",
            enhance_style: "hd",
            resolution_mode: "preset",
            resolution: "1080p",
            resolution_limit: null,
            fps: null,
            bitrate_mode: "level",
            bitrate_level: "medium",
            bitrate: null,
            bit_depth: 8
          }
        },
        {
          id: "video-output",
          type: "video_output",
          position: { x: 640, y: 0 },
          size: { width: 240, height: 160 },
          config: { title: "增强结果" }
        }
      ],
      edges: [
        {
          id: "enhancement-input",
          sourceNodeId: "video-source",
          sourceHandle: "video",
          targetNodeId: "video-enhancement",
          targetHandle: "video"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  };
}

function videoFaceBlurPipeline(): AigcPipeline {
  return {
    ...pipeline,
    definition: {
      schemaVersion: 1,
      nodes: [
        {
          id: "video-source",
          type: "video_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: "asset-video" }
        },
        {
          id: "face-blur",
          type: "video_face_blur",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 160 },
          config: { mask_mode: "mosaic", mask_strength: "medium" }
        },
        {
          id: "video-output",
          type: "video_output",
          position: { x: 640, y: 0 },
          size: { width: 240, height: 180 },
          config: { title: "脱敏成片" }
        }
      ],
      edges: [
        {
          id: "face-blur-input",
          sourceNodeId: "video-source",
          sourceHandle: "video",
          targetNodeId: "face-blur",
          targetHandle: "video"
        },
        {
          id: "face-blur-output",
          sourceNodeId: "face-blur",
          sourceHandle: "video",
          targetNodeId: "video-output",
          targetHandle: "video"
        }
      ],
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
  store = createEditorStore(entity, mode),
  options: { openInspector?: boolean } = {}
) {
  const view = render(
    <AigcQueryProvider>
      <AigcEditor entity={entity} mode={mode} store={store} />
    </AigcQueryProvider>
  );
  if (options.openInspector !== false) {
    fireEvent.click(screen.getByRole("button", { name: "详情" }));
  }
  return {
    ...view,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
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
    first.getState().addNode("video");

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
    const current = migrateAigcDefinitionV2(definition);
    expect(
      isValidAigcConnection(
        {
          source: "model",
          sourceHandle: "image",
          target: "output",
          targetHandle: "image"
        },
        current.nodes,
        current.edges
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
        current.nodes,
        current.edges
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
        current.nodes,
        current.edges
      )
    ).toBe(false);
  });

  it("accepts video enhancement chains and rejects non-video inputs", () => {
    const current = videoEnhancementPipeline();
    const currentDefinition = migrateAigcDefinitionV2(current.definition);
    const imageSource = {
      id: "image-source",
      type: "image" as const,
      position: { x: 0, y: 220 },
      size: { width: 240, height: 160 },
      config: {
        asset_id: "asset-image",
        bbox: null,
        bbox_asset_id: null,
        title: null
      }
    };

    expect(
      isValidAigcConnection(
        {
          source: "video-source",
          sourceHandle: "video",
          target: "video-enhancement",
          targetHandle: "video"
        },
        currentDefinition.nodes,
        []
      )
    ).toBe(true);
    expect(
      isValidAigcConnection(
        {
          source: "video-enhancement",
          sourceHandle: "video",
          target: "video-output",
          targetHandle: "video"
        },
        currentDefinition.nodes,
        currentDefinition.edges
      )
    ).toBe(true);
    expect(
      isValidAigcConnection(
        {
          source: imageSource.id,
          sourceHandle: "image",
          target: "video-enhancement",
          targetHandle: "video"
        },
        [...currentDefinition.nodes, imageSource],
        []
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
    const output: AigcV2Node = {
      id: "output",
      type: "image",
      position: { x: 900, y: 220 },
      size: { width: 240, height: 180 },
      config: {
        asset_id: null,
        bbox: null,
        bbox_asset_id: null,
        title: "最终扁平图"
      }
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
    const sourceNodes: AigcV2Node[] = [
      {
        id: "text-source",
        type: "text",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: { text: "提示词", bbox_references: [], title: null }
      },
      {
        id: "image-source",
        type: "image",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          asset_id: "image-asset",
          bbox: null,
          bbox_asset_id: null,
          title: null
        }
      },
      {
        id: "video-source",
        type: "video",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: { asset_id: "video-asset", title: null }
      },
      {
        id: "audio-source",
        type: "audio",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: { asset_id: "audio-asset", title: null }
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
    const imageSource: AigcV2Node = {
      id: "image-source",
      type: "image",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        asset_id: "image-asset",
        bbox: null,
        bbox_asset_id: null,
        title: null
      }
    };
    const incompatibleEdge: AigcEdge = {
      id: "stale-image-edge",
      sourceNodeId: imageSource.id,
      sourceHandle: "image",
      targetNodeId: "video-model",
      targetHandle: "first_frame"
    };

    expect(
      toFlowEdge(incompatibleEdge, [
        ...migrateAigcDefinitionV2(current.definition).nodes,
        imageSource
      ])
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
    const seedream: AigcV2Node = {
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
    const output: AigcV2Node = {
      id: "output",
      type: "image",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        asset_id: null,
        bbox: null,
        bbox_asset_id: null,
        title: "结果"
      }
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
      type: "image" as const,
      position: { x: 0, y: index * 40 },
      size: { width: 240, height: 160 },
      config: {
        asset_id: `asset-${index + 1}`,
        bbox: null,
        bbox_asset_id: null,
        title: null
      }
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
      type: "image" as const,
      position: { x: 0, y: index * 40 },
      size: { width: 240, height: 160 },
      config: {
        asset_id: `asset-${index}`,
        bbox: null,
        bbox_asset_id: null,
        title: null
      }
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
    const currentDefinition = migrateAigcDefinitionV2(current.definition);
    const image = {
      id: "image-source",
      type: "image" as const,
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        asset_id: "asset-image",
        bbox: null,
        bbox_asset_id: null,
        title: null
      }
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
        [...currentDefinition.nodes, image],
        []
      )
    ).toBe("input_not_allowed_for_mode");
    expect(
      connectionValidationFeedback(
        "input_not_allowed_for_mode",
        connection,
        [...currentDefinition.nodes, image]
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
    const image = (
      state.definition as unknown as AigcPipelineDefinitionV2
    ).nodes.find((node) => node.id === "image");
    const prompt = (
      state.definition as unknown as AigcPipelineDefinitionV2
    ).nodes.find((node) => node.id === "prompt");
    expect(image?.type).toBe("image");
    expect(prompt?.type).toBe("text");
    if (
      image?.type === "image" &&
      prompt?.type === "text"
    ) {
      expect(image.config.bbox_asset_id).toBe("asset-1");
      expect(prompt.config.bbox_references).toEqual([
        { source_node_id: "image", instruction: "" }
      ]);
    }

    store.getState().undo();
    state = store.getState();
    const undoneNodes = (
      state.definition as unknown as AigcPipelineDefinitionV2
    ).nodes;
    const undoneImage = undoneNodes.find((node) => node.id === "image");
    const undonePrompt = undoneNodes.find(
      (node) => node.id === "prompt"
    );
    if (
      undoneImage?.type === "image" &&
      undonePrompt?.type === "text"
    ) {
      expect(undoneImage.config.bbox).toBeNull();
      expect(undonePrompt.config.bbox_references).toEqual([]);
    }

    store.getState().redo();
    store.getState().updateNodeConfig("image", {
      asset_id: "asset-2",
      bbox: image?.type === "image" ? image.config.bbox : null,
      bbox_asset_id: "asset-1",
      title: null
    });
    state = store.getState();
    const changedImage = state.definition.nodes.find(
      (node) => node.id === "image"
    );
    const changedPrompt = state.definition.nodes.find(
      (node) => node.id === "prompt"
    );
    if (
      changedImage?.type === "image" &&
      changedPrompt?.type === "text"
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
    navigationMocks.push.mockReset();
    window.localStorage.clear();
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
    apiMocks.getAigcPipeline.mockResolvedValue(pipeline);
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

  it("isolates active controls, results, cancellation, and top-level execution by flow", async () => {
    const entity = disconnectedPipeline();
    const activeA = scopedRun(
      entity.definition,
      "run-active-a",
      2,
      "flow-a-model",
      "running"
    );
    const successfulB = scopedRun(
      entity.definition,
      "run-success-b",
      1,
      "flow-b-model",
      "succeeded"
    );
    const detailA = scopedRunDetail(activeA, "flow-a-model");
    const detailB = scopedRunDetail(
      successfulB,
      "flow-b-model",
      "流程 B 结果"
    );
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [activeA, successfulB],
      page: 1,
      page_size: 100,
      total: 2
    });
    apiMocks.getAigcRun.mockImplementation(async (runId: string) =>
      runId === activeA.id ? detailA : detailB
    );
    apiMocks.cancelAigcRun.mockResolvedValue({
      ...detailA,
      run: { ...activeA, status: "canceled" }
    });
    renderEditor(entity, "pipeline");

    await waitFor(() => {
      expect(apiMocks.listAigcRuns).toHaveBeenCalledWith(entity.id, {
        page: 1,
        pageSize: 100
      });
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(activeA.id);
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(successfulB.id);
    });
    expect(screen.getByTestId("aigc-command-execute")).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 flow-a-model" })
    );
    expect(
      screen.getByRole("button", { name: "从此节点运行" })
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 flow-b-model" })
    );
    expect(
      screen.getByRole("button", { name: "从此节点运行" })
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("tab", { name: "结果" }));
    expect(screen.getByText("流程 B 结果")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "运行" }));
    fireEvent.click(screen.getByRole("button", { name: "取消运行" }));
    await waitFor(() => {
      expect(apiMocks.cancelAigcRun).toHaveBeenCalledWith(activeA.id);
    });
  });

  it("preserves a completed image branch while a shared-upstream sibling runs", async () => {
    const entity = sharedImageBranchPipeline();
    const branchA = scopedRun(
      entity.definition,
      "run-branch-a",
      4,
      "branch-a-model",
      "succeeded"
    );
    const branchB = scopedRun(
      entity.definition,
      "run-branch-b",
      5,
      "branch-b-model",
      "running"
    );
    const imageAsset = {
      asset_id: "branch-a-asset",
      ordinal: 0,
      mime_type: "image/png",
      download_url: "/api/assets/branch-a-asset/content",
      available: true,
      metadata: {}
    } satisfies AigcResultAsset;
    const branchADetail: AigcPipelineRunDetail = {
      run: branchA,
      nodes: [
        runNodeFixture("branch-a-model", {
          result: {
            kind: "assets",
            text: null,
            text_digest: null,
            assets: [imageAsset]
          }
        }),
        runNodeFixture("branch-a-output", {
          result: {
            kind: "assets",
            text: null,
            text_digest: null,
            assets: [imageAsset]
          }
        })
      ]
    };
    const branchBDetail: AigcPipelineRunDetail = {
      run: branchB,
      nodes: [
        runNodeFixture("branch-b-model", {
          status: "running"
        }),
        runNodeFixture("branch-b-output", {
          status: "idle"
        })
      ]
    };
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [branchB, branchA],
      page: 1,
      page_size: 100,
      total: 2
    });
    apiMocks.getAigcRun.mockImplementation(async (runId: string) =>
      runId === branchA.id ? branchADetail : branchBDetail
    );
    renderEditor(entity, "pipeline");

    await waitFor(() => {
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(branchA.id);
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(branchB.id);
    });
    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 branch-a-output" })
    );
    fireEvent.click(screen.getByRole("tab", { name: "结果" }));

    expect(await screen.findByAltText("分支 A 图片")).toHaveClass(
      "object-contain"
    );
    expect(
      screen.getByRole("link", { name: "下载图片" }).getAttribute("href")
    ).toContain("/api/assets/branch-a-asset/content");

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 branch-a-model" })
    );
    expect(
      screen.getByRole("button", { name: "从此节点运行" })
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 branch-b-model" })
    );
    expect(
      screen.getByRole("button", { name: "从此节点运行" })
    ).toBeDisabled();
  });

  it("keeps a sibling image when an active branch detail fails", async () => {
    const entity = sharedImageBranchPipeline();
    const branchA = scopedRun(
      entity.definition,
      "run-branch-a",
      4,
      "branch-a-model",
      "succeeded"
    );
    const branchB = scopedRun(
      entity.definition,
      "run-branch-b",
      5,
      "branch-b-model",
      "running"
    );
    const imageAsset = {
      asset_id: "branch-a-asset",
      ordinal: 0,
      mime_type: "image/png",
      download_url: "/api/assets/branch-a-asset/content",
      available: true,
      metadata: {}
    } satisfies AigcResultAsset;
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [branchB, branchA],
      page: 1,
      page_size: 100,
      total: 2
    });
    apiMocks.getAigcRun.mockImplementation(async (runId: string) => {
      if (runId === branchB.id) throw new Error("branch B detail failed");
      return {
        run: branchA,
        nodes: [
          runNodeFixture("branch-a-output", {
            result: {
              kind: "assets",
              text: null,
              text_digest: null,
              assets: [imageAsset]
            }
          })
        ]
      };
    });
    renderEditor(entity, "pipeline");

    await waitFor(() => {
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(branchA.id);
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(branchB.id);
    });
    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 branch-a-output" })
    );
    fireEvent.click(screen.getByRole("tab", { name: "结果" }));
    expect(await screen.findByAltText("分支 A 图片")).toHaveClass(
      "object-contain"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 branch-b-model" })
    );
    expect(
      screen.getByRole("button", { name: "从此节点运行" })
    ).toBeDisabled();
  });

  it("allows shared-upstream sibling submissions while blocking their parent scope", async () => {
    const entity = sharedImageBranchPipeline();
    const pendingA = deferred<AigcPipelineRunDetail>();
    const pendingB = deferred<AigcPipelineRunDetail>();
    const runA = scopedRun(
      entity.definition,
      "pending-branch-a",
      1,
      "branch-a-model",
      "queued"
    );
    const runB = scopedRun(
      entity.definition,
      "pending-branch-b",
      2,
      "branch-b-model",
      "queued"
    );
    apiMocks.createAigcRun.mockImplementation(
      (
        _pipelineId: string,
        payload: { start_node_id: string | null }
      ) =>
        payload.start_node_id === "branch-a-model"
          ? pendingA.promise
          : pendingB.promise
    );
    renderEditor(entity, "pipeline");
    await waitFor(() => {
      expect(screen.getByTestId("aigc-command-execute")).toBeEnabled();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 branch-a-model" })
    );
    fireEvent.click(screen.getByRole("button", { name: "从此节点运行" }));
    await waitFor(() => {
      expect(apiMocks.createAigcRun).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 branch-b-model" })
    );
    const executeBranchB = screen.getByRole("button", {
      name: "从此节点运行"
    });
    expect(executeBranchB).toBeEnabled();
    fireEvent.click(executeBranchB);
    await waitFor(() => {
      expect(apiMocks.createAigcRun).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 shared-model" })
    );
    expect(
      screen.getByRole("button", { name: "从此节点运行" })
    ).toBeDisabled();

    await act(async () => {
      pendingA.resolve(scopedRunDetail(runA, "branch-a-model"));
      pendingB.resolve(scopedRunDetail(runB, "branch-b-model"));
      await Promise.all([pendingA.promise, pendingB.promise]);
    });
  });

  it("loads two active runs independently and disables both scopes", async () => {
    const entity = disconnectedPipeline();
    const activeA = scopedRun(
      entity.definition,
      "run-active-a",
      2,
      "flow-a-model",
      "running"
    );
    const activeB = scopedRun(
      entity.definition,
      "run-active-b",
      3,
      "flow-b-model",
      "queued"
    );
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [activeB, activeA],
      page: 1,
      page_size: 100,
      total: 2
    });
    apiMocks.getAigcRun.mockImplementation(async (runId: string) =>
      runId === activeA.id
        ? scopedRunDetail(activeA, "flow-a-model")
        : scopedRunDetail(activeB, "flow-b-model")
    );
    renderEditor(entity, "pipeline");

    await waitFor(() => {
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(activeA.id);
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(activeB.id);
    });
    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 flow-b-model" })
    );
    expect(
      screen.getByRole("button", { name: "从此节点运行" })
    ).toBeDisabled();
  });

  it("projects selected history only onto its own flow", async () => {
    const entity = disconnectedPipeline();
    const latestA = scopedRun(
      entity.definition,
      "run-latest-a",
      4,
      "flow-a-model",
      "succeeded"
    );
    const latestB = scopedRun(
      entity.definition,
      "run-latest-b",
      3,
      "flow-b-model",
      "succeeded"
    );
    const historyA = scopedRun(
      entity.definition,
      "run-history-a",
      2,
      "flow-a-model",
      "succeeded"
    );
    const details = new Map([
      [
        latestA.id,
        scopedRunDetail(latestA, "flow-a-model", "流程 A 最新结果")
      ],
      [
        latestB.id,
        scopedRunDetail(latestB, "flow-b-model", "流程 B 保留结果")
      ],
      [
        historyA.id,
        scopedRunDetail(historyA, "flow-a-model", "流程 A 历史结果")
      ]
    ]);
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [latestA, latestB, historyA],
      page: 1,
      page_size: 100,
      total: 3
    });
    apiMocks.getAigcRun.mockImplementation(async (runId: string) => {
      const detail = details.get(runId);
      if (!detail) throw new Error(`Unexpected Run ${runId}`);
      return detail;
    });
    renderEditor(entity, "pipeline");

    fireEvent.click(screen.getByRole("tab", { name: "运行" }));
    fireEvent.change(await screen.findByLabelText("运行历史"), {
      target: { value: historyA.id }
    });
    await waitFor(() => {
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(historyA.id);
    });

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 flow-a-model" })
    );
    fireEvent.click(screen.getByRole("tab", { name: "结果" }));
    expect(await screen.findByText("流程 A 历史结果")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 flow-b-model" })
    );
    fireEvent.click(screen.getByRole("tab", { name: "结果" }));
    expect(screen.getByText("流程 B 保留结果")).toBeInTheDocument();
    expect(screen.queryByText("流程 A 历史结果")).toBeNull();
  });

  it("allows disjoint pending submissions in parallel and blocks full execution", async () => {
    const entity = disconnectedPipeline();
    const pendingA = deferred<AigcPipelineRunDetail>();
    const pendingB = deferred<AigcPipelineRunDetail>();
    const runA = scopedRun(
      entity.definition,
      "run-created-a",
      1,
      "flow-a-model",
      "queued"
    );
    const runB = scopedRun(
      entity.definition,
      "run-created-b",
      2,
      "flow-b-model",
      "queued"
    );
    apiMocks.createAigcRun.mockImplementation(
      (
        _pipelineId: string,
        payload: { start_node_id: string | null }
      ) =>
        payload.start_node_id === "flow-a-model"
          ? pendingA.promise
          : pendingB.promise
    );
    renderEditor(entity, "pipeline");
    await waitFor(() => {
      expect(screen.getByTestId("aigc-command-execute")).toBeEnabled();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 flow-a-model" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "从此节点运行" })
    );
    await waitFor(() => {
      expect(apiMocks.createAigcRun).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("aigc-command-execute")).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 flow-b-model" })
    );
    const executeB = screen.getByRole("button", {
      name: "从此节点运行"
    });
    expect(executeB).toBeEnabled();
    fireEvent.click(executeB);
    await waitFor(() => {
      expect(apiMocks.createAigcRun).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      pendingA.resolve(scopedRunDetail(runA, "flow-a-model"));
      pendingB.resolve(scopedRunDetail(runB, "flow-b-model"));
      await Promise.all([pendingA.promise, pendingB.promise]);
    });
  });

  it("blocks every local scope while a full submission is pending", async () => {
    const entity = disconnectedPipeline();
    const pendingFull = deferred<AigcPipelineRunDetail>();
    const fullRun = runFixture({
      id: "run-created-full",
      definition_snapshot: entity.definition,
      status: "queued",
      finished_at: null
    });
    apiMocks.createAigcRun.mockReturnValue(pendingFull.promise);
    renderEditor(entity, "pipeline");

    await waitFor(() => {
      expect(screen.getByTestId("aigc-command-execute")).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "执行" }));
    await waitFor(() => {
      expect(apiMocks.createAigcRun).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("button", { name: "运行中" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "运行中" })).toHaveAttribute(
      "title",
      "运行中"
    );
    expect(screen.getByTestId("aigc-editor-header")).toHaveClass("h-14");
    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 flow-b-model" })
    );
    expect(
      screen.getByRole("button", { name: "从此节点运行" })
    ).toBeDisabled();

    await act(async () => {
      pendingFull.resolve(scopedRunDetail(fullRun, "flow-a-model"));
      await pendingFull.promise;
    });
  });

  it("does not let an invalid disconnected flow block local execution", async () => {
    const entity = disconnectedPipeline();
    const disconnectedDefinition =
      entity.definition as unknown as AigcPipelineDefinitionV2;
    disconnectedDefinition.nodes[0] = {
      id: "flow-a-model",
      type: "image_to_image",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        operation: "image_to_image",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    } as AigcV2Node;
    const createdB = scopedRun(
      entity.definition,
      "run-created-b",
      1,
      "flow-b-model",
      "queued"
    );
    apiMocks.createAigcRun.mockResolvedValue(
      scopedRunDetail(createdB, "flow-b-model")
    );
    const { store } = renderEditor(entity, "pipeline");
    await waitFor(() => {
      expect(screen.getByTestId("aigc-command-execute")).toBeEnabled();
    });
    act(() => {
      store.getState().updateNodeConfig("flow-a-model", {
        model: "doubao-seedream-5-0-pro-260628",
        operation: "image_to_image",
        aspect_ratio: "1:1",
        size: "invalid",
        format: "png"
      } as never);
    });
    expect(screen.getByTestId("aigc-autosave-status")).toHaveTextContent(
      "草稿无效"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 flow-b-model" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "从此节点运行" })
    );

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledWith(
        entity.id,
        expect.objectContaining({
          definition: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "flow-a-model",
                config: expect.objectContaining({ size: "invalid" })
              })
            ])
          })
        })
      );
      expect(apiMocks.createAigcRun).toHaveBeenCalledWith(
        entity.id,
        expect.objectContaining({
          expected_revision: 4,
          mode: "from_node",
          start_node_id: "flow-b-model"
        }),
        expect.any(String)
      );
    });
  });

  it("keeps an active scope disabled while its detail is missing", async () => {
    const entity = disconnectedPipeline();
    const activeA = scopedRun(
      entity.definition,
      "run-active-without-detail",
      1,
      "flow-a-model",
      "running"
    );
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [activeA],
      page: 1,
      page_size: 100,
      total: 1
    });
    apiMocks.getAigcRun.mockReturnValue(new Promise(() => {}));
    renderEditor(entity, "pipeline");

    await waitFor(() => {
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(activeA.id);
    });
    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 flow-a-model" })
    );
    expect(
      screen.getByRole("button", { name: "从此节点运行" })
    ).toBeDisabled();
    expect(screen.getByTestId("aigc-command-execute")).toBeDisabled();
  });

  it("conservatively locks execution while the Run list is loading or failed", async () => {
    const pendingRuns = deferred<{
      items: AigcPipelineRun[];
      page: number;
      page_size: number;
      total: number;
    }>();
    apiMocks.listAigcRuns.mockReturnValue(pendingRuns.promise);
    const first = renderEditor(disconnectedPipeline(), "pipeline");

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 flow-b-model" })
    );
    expect(screen.getByTestId("aigc-command-execute")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "从此节点运行" })
    ).toBeDisabled();

    await act(async () => {
      pendingRuns.resolve({
        items: [],
        page: 1,
        page_size: 100,
        total: 0
      });
      await pendingRuns.promise;
    });
    await waitFor(() => {
      expect(screen.getByTestId("aigc-command-execute")).toBeEnabled();
    });
    first.unmount();

    apiMocks.listAigcRuns.mockRejectedValue(new Error("list failed"));
    renderEditor(disconnectedPipeline(), "pipeline");
    await waitFor(() => {
      expect(apiMocks.listAigcRuns).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId("aigc-command-execute")).toBeDisabled();
  });

  it("keeps an active detail error visible and the scope locked", async () => {
    const entity = disconnectedPipeline();
    const activeA = scopedRun(
      entity.definition,
      "run-active-detail-error",
      1,
      "flow-a-model",
      "running"
    );
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [activeA],
      page: 1,
      page_size: 100,
      total: 1
    });
    apiMocks.getAigcRun.mockRejectedValue(new Error("detail failed"));
    renderEditor(entity, "pipeline");

    fireEvent.click(screen.getByRole("tab", { name: "运行" }));
    expect(
      await screen.findByText("运行详情加载失败，正在重试。")
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 flow-a-model" })
    );
    expect(
      screen.getByRole("button", { name: "从此节点运行" })
    ).toBeDisabled();
  });

  it("guards retries with the flow active and pending state", async () => {
    const entity = disconnectedPipeline();
    const activeA = scopedRun(
      entity.definition,
      "run-active-a",
      3,
      "flow-a-model",
      "running"
    );
    const failedA = scopedRun(
      entity.definition,
      "run-failed-a",
      2,
      "flow-a-model",
      "failed"
    );
    const failedDetail = scopedRunDetail(failedA, "flow-a-model");
    failedDetail.nodes[0].status = "failed";
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [activeA, failedA],
      page: 1,
      page_size: 100,
      total: 2
    });
    apiMocks.getAigcRun.mockImplementation(async (runId: string) =>
      runId === activeA.id
        ? scopedRunDetail(activeA, "flow-a-model")
        : failedDetail
    );
    const first = renderEditor(entity, "pipeline");
    fireEvent.click(screen.getByRole("tab", { name: "运行" }));
    fireEvent.change(await screen.findByLabelText("运行历史"), {
      target: { value: failedA.id }
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "重试节点：flow-a-model" })
    );
    expect(apiMocks.retryAigcRunNode).not.toHaveBeenCalled();
    first.unmount();

    const entityB = disconnectedPipeline();
    const failedB = scopedRun(
      entityB.definition,
      "run-failed-b",
      1,
      "flow-b-model",
      "failed"
    );
    const failedBDetail = scopedRunDetail(failedB, "flow-b-model");
    failedBDetail.nodes[0].status = "failed";
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [failedB],
      page: 1,
      page_size: 100,
      total: 1
    });
    apiMocks.getAigcRun.mockResolvedValue(failedBDetail);
    const pendingRetry = deferred<AigcPipelineRunDetail>();
    apiMocks.retryAigcRunNode.mockReturnValue(pendingRetry.promise);
    const second = renderEditor(entityB, "pipeline");
    fireEvent.click(screen.getByRole("tab", { name: "运行" }));
    const retry = await screen.findByRole("button", {
      name: "重试节点：flow-b-model"
    });
    await waitFor(() => {
      expect(screen.getByTestId("aigc-command-execute")).toBeEnabled();
    });
    fireEvent.click(retry);
    fireEvent.click(retry);
    await waitFor(() => {
      expect(apiMocks.retryAigcRunNode).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      pendingRetry.resolve(
        scopedRunDetail(
          { ...failedB, id: "run-retry-b", status: "queued" },
          "flow-b-model"
        )
      );
      await pendingRetry.promise;
    });
    second.unmount();
  });

  it("edits upstream text as a local override and restores it after disconnect", async () => {
    const entity = modalityPipeline();
    const run = runFixture({
      definition_snapshot: entity.definition
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
        runNodeFixture("producer", {
          result: {
            kind: "text",
            text: "来自 Run 的文案",
            text_digest: "digest",
            assets: []
          }
        })
      ]
    });
    const { store } = renderEditor(entity, "pipeline");

    fireEvent.click(screen.getByRole("button", { name: "选择画布节点" }));
    fireEvent.click(await screen.findByTestId("aigc-prompt-preview"));
    const editor = await screen.findByLabelText("完整基础文本");
    expect(editor).toHaveValue("来自 Run 的文案");
    expect(screen.queryByText("上游")).toBeNull();
    expect(screen.queryByText("本地")).toBeNull();
    expect(screen.getByLabelText("内容标题")).toBeDisabled();
    fireEvent.change(editor, { target: { value: "当前节点覆盖文案" } });
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    expect(
      (
        store.getState().definition as AigcPipelineDefinitionV2
      ).nodes.find((node) => node.id === "model")?.config
    ).toMatchObject({ upstream_text_override: "当前节点覆盖文案" });
    fireEvent.click(screen.getByRole("button", { name: "恢复上游文本" }));
    expect(screen.getByTestId("aigc-prompt-preview")).toHaveTextContent(
      "来自 Run 的文案"
    );

    act(() => store.getState().removeEdge("text-upstream"));

    expect(screen.getByLabelText("内容标题")).toBeEnabled();
    expect(screen.getByTestId("aigc-prompt-preview")).toHaveTextContent(
      "断开后恢复的本地文案"
    );
    expect(
      screen.getByRole("button", { name: "优化提示词" })
    ).toBeDisabled();
  });

  it("renders all four modality results with title-based media downloads", async () => {
    const definitionV2: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [
        {
          id: "text-result",
          type: "text",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { text: "", bbox_references: [], title: "文案交付" }
        },
        {
          id: "image-result",
          type: "image",
          position: { x: 280, y: 0 },
          size: { width: 240, height: 160 },
          config: {
            asset_id: null,
            bbox: null,
            bbox_asset_id: null,
            title: "海报交付"
          }
        },
        {
          id: "video-result",
          type: "video",
          position: { x: 560, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: null, title: "视频交付" }
        },
        {
          id: "audio-result",
          type: "audio",
          position: { x: 840, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: null, title: "音频交付" }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const entity = {
      ...pipeline,
      definition: definitionV2 as unknown as AigcPipelineDefinition
    };
    const run = runFixture({ definition_snapshot: entity.definition });
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [run],
      page: 1,
      page_size: 20,
      total: 1
    });
    apiMocks.getAigcRun.mockResolvedValue({
      run,
      nodes: [
        runNodeFixture("text-result", {
          result: {
            kind: "text",
            text: "最终广告文案",
            text_digest: "digest",
            assets: []
          }
        }),
        ...([
          ["image-result", "image/png", "image-asset"],
          ["video-result", "video/mp4", "video-asset"],
          ["audio-result", "audio/mpeg", "audio-asset"]
        ] as const).map(([nodeId, mimeType, assetId]) =>
          runNodeFixture(nodeId, {
            result: {
              kind: "assets",
              text: null,
              text_digest: null,
              assets: [
                {
                  asset_id: assetId,
                  ordinal: 0,
                  mime_type: mimeType,
                  download_url: `/api/assets/${assetId}/content`,
                  available: true,
                  metadata: { duration_seconds: 9.5 }
                }
              ]
            }
          })
        )
      ]
    });
    renderEditor(entity, "pipeline");

    fireEvent.click(screen.getByRole("tab", { name: "结果" }));

    expect(await screen.findByText("最终广告文案")).toBeInTheDocument();
    expect(screen.getByAltText("海报交付")).toHaveClass("object-contain");
    expect(screen.getByLabelText("播放视频：视频交付")).toHaveClass(
      "object-contain"
    );
    expect(screen.getByLabelText("播放音频：音频交付")).toBeInTheDocument();
    expect(screen.getByLabelText("音频信息：音频交付")).toHaveTextContent(
      "9.5s · audio/mpeg"
    );
    expect(screen.getByRole("link", { name: "下载图片" })).toHaveAttribute(
      "download",
      "海报交付.png"
    );
    expect(screen.getByRole("link", { name: "下载视频" })).toHaveAttribute(
      "download",
      "视频交付.mp4"
    );
    expect(screen.getByRole("link", { name: "下载音频" })).toHaveAttribute(
      "download",
      "音频交付-1.mp3"
    );
  });

  it("uses the selected node derived display name in the config group", () => {
    const firstTextNode: AigcNode = {
      id: "first-text",
      type: "text_input",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { text: "第一段提示词", bbox_references: [] }
    };
    const selectedTextNode: AigcNode = {
      ...firstTextNode,
      id: "model",
      position: { x: 0, y: 200 },
      config: { text: "第二段提示词", bbox_references: [] }
    };
    const duplicateTextPipeline: AigcPipeline = {
      ...pipeline,
      definition: {
        schemaVersion: 1,
        nodes: [firstTextNode, selectedTextNode],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    };
    const { store } = renderEditor(duplicateTextPipeline, "pipeline");

    fireEvent.click(screen.getByRole("button", { name: "选择画布节点" }));
    expect(
      screen.getByRole("heading", { name: "文本节点2" })
    ).toBeInTheDocument();

    act(() => {
      store.getState().moveNode(firstTextNode.id, { x: 800, y: 600 });
      store.getState().moveNode(selectedTextNode.id, { x: -200, y: -100 });
    });
    expect(
      screen.getByRole("heading", { name: "文本节点2" })
    ).toBeInTheDocument();

    act(() => store.getState().removeNode(firstTextNode.id));
    expect(
      screen.getByRole("heading", { name: "文本节点" })
    ).toBeInTheDocument();
  });

  it("edits a node name independently from its content title", () => {
    const { store } = renderEditor(modalityPipeline(), "pipeline");
    fireEvent.click(screen.getByRole("button", { name: "选择画布节点" }));

    const nodeName = screen.getByRole("textbox", { name: "节点名称" });
    fireEvent.change(nodeName, { target: { value: "商品主视觉输入" } });
    fireEvent.blur(nodeName);

    expect(
      store.getState().definition.nodes.find((node) => node.id === "model")
        ?.custom_name
    ).toBe("商品主视觉输入");
    expect(
      screen.getByRole("heading", { name: "商品主视觉输入" })
    ).toBeInTheDocument();
  });

  it.each([
    ["pipeline", pipeline, "/workspace/aigc?view=pipelines"],
    ["template", template, "/workspace/aigc?view=templates"]
  ] as const)(
    "returns from the %s editor to its matching workspace view",
    (mode, entity, expectedHref) => {
      renderEditor(entity, mode);

      expect(screen.getByTitle("返回 AIGC 工作台")).toHaveAttribute(
        "href",
        expectedHref
      );
      expect(screen.getByTestId("aigc-editor-title")).toHaveTextContent(
        entity.name
      );
      expect(screen.getByTestId("aigc-editor-title")).toHaveAttribute(
        "title",
        entity.name
      );
      expect(screen.getByTestId("aigc-editor-mode")).toHaveTextContent(
        mode === "pipeline" ? "画布" : "模板"
      );
    }
  );

  it("uses the professional workbench shell with an on-demand inspector", () => {
    renderEditor(
      pipeline,
      "pipeline",
      createEditorStore(pipeline, "pipeline"),
      { openInspector: false }
    );

    expect(screen.queryByTestId("aigc-node-palette")).toBeNull();
    expect(screen.getByRole("button", { name: "打开节点库" })).toHaveAttribute(
      "aria-controls",
      "aigc-node-palette"
    );
    expect(screen.getByRole("button", { name: "打开节点库" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByTestId("aigc-editor-shell")).toHaveClass(
      "h-[100dvh]",
      "bg-[#101318]",
      "[--card:220_13%_11%]"
    );
    expect(screen.getByTestId("aigc-editor-header")).toHaveClass(
      "bg-[#171a1f]",
      "border-[#30353d]",
      "h-14",
      "overflow-hidden",
      "shadow-[0_3px_12px_rgba(0,0,0,0.22)]"
    );
    expect(screen.getByTestId("aigc-editor-title-row")).toHaveClass(
      "min-w-0",
      "flex-1"
    );
    expect(screen.getByTestId("aigc-editor-title")).toHaveClass("truncate");
    const starMap = screen.getByTestId("aigc-toolbar-star-map");
    expect(starMap).toHaveAttribute("aria-hidden", "true");
    expect(starMap).toHaveClass("pointer-events-none", "hidden", "xl:block");
    expect(
      within(starMap).getAllByTestId("aigc-toolbar-star-line")
    ).toHaveLength(11);
    const starPoints = within(starMap).getAllByTestId(
      "aigc-toolbar-star-point"
    );
    expect(starPoints).toHaveLength(12);
    const modalities = ["text", "image", "video", "audio"] as const;
    for (const [index, point] of starPoints.entries()) {
      const modality = modalities[index % modalities.length];
      expect(point).toHaveAttribute("data-modality", modality);
      expect(point).toHaveStyle({
        backgroundColor: `var(--aigc-modality-${modality})`
      });
    }
    expect(screen.getByTestId("aigc-autosave-status")).toHaveAttribute(
      "aria-live",
      "polite"
    );
    expect(screen.getByTestId("aigc-autosave-status")).toHaveAttribute(
      "data-status",
      "idle"
    );
    expect(screen.getByTestId("aigc-autosave-status")).toHaveClass("sr-only");
    expect(
      screen.getByTestId("aigc-autosave-status").querySelector("svg")
    ).toBeNull();
    expect(screen.getByTestId("aigc-command-group-panel")).toHaveAttribute(
      "aria-label",
      "面板命令"
    );
    expect(screen.getByTestId("aigc-command-group-document")).toHaveAttribute(
      "aria-label",
      "文档命令"
    );
    expect(screen.getByTestId("aigc-command-group-execution")).toHaveAttribute(
      "aria-label",
      "执行命令"
    );
    expect(screen.getByTestId("aigc-command-inspector")).toHaveClass(
      "h-10",
      "w-10"
    );
    expect(screen.getByTestId("aigc-command-save-template")).toHaveClass(
      "h-10",
      "min-w-10"
    );
    expect(screen.getByTestId("aigc-command-execute")).toHaveClass(
      "h-10",
      "min-w-10",
      "bg-blue-600"
    );
    for (const label of ["详情", "另存为模板", "执行"]) {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute(
        "title",
        label
      );
    }
    expect(screen.getByTestId("node-canvas")).toHaveClass("bg-[#101318]");
    expect(screen.getByTestId("node-canvas")).toHaveAttribute(
      "data-background-color",
      "#39404a"
    );
    expect(screen.queryByTestId("aigc-inspector")).toBeNull();
    expect(screen.getByTestId("node-canvas")).toHaveAttribute(
      "data-controls-position",
      "bottom-center"
    );
    expect(screen.getByTestId("node-canvas")).toHaveAttribute(
      "data-controls-orientation",
      "horizontal"
    );

    fireEvent.click(screen.getByRole("button", { name: "打开节点库" }));
    expect(screen.getByTestId("aigc-node-palette")).toHaveClass("w-[184px]");
    expect(screen.getByRole("button", { name: "隐藏节点库" })).toHaveAttribute(
      "aria-controls",
      "aigc-node-palette"
    );
    expect(screen.getByRole("button", { name: "隐藏节点库" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "选择画布节点" }));
    expect(screen.getByTestId("aigc-inspector")).toHaveClass("w-80");
    expect(screen.getByRole("tab", { name: "配置" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "点击画布空白" }));
    expect(screen.queryByTestId("aigc-inspector")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "选择画布节点" }));
    fireEvent.click(screen.getByRole("tab", { name: "运行" }));
    expect(screen.getByRole("tab", { name: "运行" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "点击画布空白" }));
    expect(screen.queryByTestId("aigc-inspector")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    fireEvent.click(screen.getByRole("tab", { name: "结果" }));
    expect(screen.getByRole("tab", { name: "结果" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "点击画布空白" }));
    expect(screen.queryByTestId("aigc-inspector")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "选择画布节点" }));
    expect(screen.getByTestId("aigc-inspector")).toHaveClass("w-80");
    expect(screen.getByRole("tab", { name: "配置" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("keeps toolbar-only interactions out of the persistent draft", async () => {
    const { store } = renderEditor(
      pipeline,
      "pipeline",
      createEditorStore(pipeline, "pipeline"),
      { openInspector: false }
    );
    const initialDefinition = structuredClone(store.getState().definition);

    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    expect(screen.getByTestId("aigc-inspector")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    expect(screen.queryByTestId("aigc-inspector")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "另存为模板" }));
    expect(
      screen.getByRole("heading", { name: "另存为模板" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 850));
    });
    expect(store.getState().definition).toEqual(initialDefinition);
    expect(store.getState().definition.viewport).toEqual(
      initialDefinition.viewport
    );
    expect(apiMocks.updateAigcPipeline).not.toHaveBeenCalled();
    expect(apiMocks.updateAigcTemplate).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["false", "false"],
    ["invalid", "invalid"]
  ])("defaults the desktop node palette to hidden for %s preference", (_, value) => {
    if (value !== null) {
      window.localStorage.setItem("aigc.node-palette.visible.v1", value);
    }

    renderEditor(
      pipeline,
      "pipeline",
      createEditorStore(pipeline, "pipeline"),
      { openInspector: false }
    );

    expect(screen.queryByTestId("aigc-node-palette")).toBeNull();
    expect(
      screen.getByRole("button", { name: "打开节点库" })
    ).toBeInTheDocument();
  });

  it("restores a visible desktop node palette from the shared browser preference", () => {
    window.localStorage.setItem("aigc.node-palette.visible.v1", "true");

    const first = renderEditor(
      pipeline,
      "pipeline",
      createEditorStore(pipeline, "pipeline"),
      { openInspector: false }
    );
    expect(screen.getByTestId("aigc-node-palette")).toHaveClass("w-[184px]");
    first.unmount();

    renderEditor(
      template,
      "template",
      createEditorStore(template, "template"),
      { openInspector: false }
    );
    expect(screen.getByTestId("aigc-node-palette")).toHaveClass("w-[184px]");
  });

  it("falls back to hidden when reading the node palette preference fails", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage unavailable");
      });

    try {
      renderEditor(
        pipeline,
        "pipeline",
        createEditorStore(pipeline, "pipeline"),
        { openInspector: false }
      );
      expect(screen.queryByTestId("aigc-node-palette")).toBeNull();
      expect(screen.getByTestId("node-canvas")).toBeInTheDocument();
    } finally {
      getItem.mockRestore();
    }
  });

  it("keeps palette controls usable when writing the preference fails", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage unavailable");
      });

    try {
      renderEditor(
        pipeline,
        "pipeline",
        createEditorStore(pipeline, "pipeline"),
        { openInspector: false }
      );
      fireEvent.click(screen.getByRole("button", { name: "打开节点库" }));
      expect(screen.getByTestId("aigc-node-palette")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "隐藏节点库" }));
      expect(screen.queryByTestId("aigc-node-palette")).toBeNull();
    } finally {
      setItem.mockRestore();
    }
  });

  it("persists explicit visibility while preserving editor context", () => {
    const { store } = renderEditor(
      pipeline,
      "pipeline",
      createEditorStore(pipeline, "pipeline"),
      { openInspector: false }
    );
    const initialViewport = store.getState().definition.viewport;

    fireEvent.click(screen.getByRole("button", { name: "选择画布节点" }));
    fireEvent.click(screen.getByRole("tab", { name: "运行" }));
    fireEvent.click(screen.getByRole("button", { name: "打开节点库" }));

    expect(window.localStorage.getItem("aigc.node-palette.visible.v1")).toBe(
      "true"
    );
    expect(store.getState().selectedNodeId).toBe("model");
    expect(store.getState().definition.viewport).toEqual(initialViewport);
    expect(screen.getByRole("tab", { name: "运行" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    const initialNodeCount = store.getState().definition.nodes.length;
    fireEvent.click(screen.getByRole("button", { name: "LLM" }));
    fireEvent.click(screen.getByRole("button", { name: "LLM" }));
    expect(store.getState().definition.nodes).toHaveLength(initialNodeCount + 2);
    expect(screen.getByTestId("aigc-node-palette")).toBeInTheDocument();
    const selectedNodeBeforeHide = store.getState().selectedNodeId;

    fireEvent.click(screen.getByRole("button", { name: "隐藏节点库" }));
    expect(window.localStorage.getItem("aigc.node-palette.visible.v1")).toBe(
      "false"
    );
    expect(store.getState().selectedNodeId).toBe(selectedNodeBeforeHide);
    expect(store.getState().definition.viewport).toEqual(initialViewport);
    expect(screen.getByRole("tab", { name: "运行" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("does not autosave visibility-only node palette changes", async () => {
    renderEditor(
      pipeline,
      "pipeline",
      createEditorStore(pipeline, "pipeline"),
      { openInspector: false }
    );

    fireEvent.click(screen.getByRole("button", { name: "打开节点库" }));
    fireEvent.click(screen.getByRole("button", { name: "隐藏节点库" }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 850));
    });
    expect(apiMocks.updateAigcPipeline).not.toHaveBeenCalled();
    expect(apiMocks.updateAigcTemplate).not.toHaveBeenCalled();
  });

  it("opens a searchable pane menu and creates at the converted position", () => {
    const { store } = renderEditor(pipeline, "pipeline");

    fireEvent.contextMenu(
      screen.getByRole("button", { name: "右键画布空白" }),
      { clientX: 500, clientY: 400 }
    );

    expect(screen.getByTestId("aigc-canvas-node-picker")).toBeInTheDocument();
    const search = screen.getByRole("textbox", { name: "搜索节点" });
    fireEvent.change(search, { target: { value: "text_to_image" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(store.getState().definition.nodes.at(-1)).toMatchObject({
      type: "text_to_image",
      custom_name: null,
      position: { x: 288, y: 272 }
    });
    expect(screen.queryByTestId("aigc-canvas-node-picker")).toBeNull();
  });

  it("keeps node and pane context menus mutually exclusive", () => {
    renderEditor(pipeline, "pipeline");

    fireEvent.contextMenu(
      screen.getByRole("button", { name: "选择节点 model" }),
      { clientX: 300, clientY: 200 }
    );

    expect(screen.getByTestId("aigc-node-context-menu")).toBeInTheDocument();
    expect(screen.queryByTestId("aigc-canvas-node-picker")).toBeNull();
    expect(screen.getByRole("menuitem", { name: "重命名" })).toBeVisible();

    fireEvent.contextMenu(
      screen.getByRole("button", { name: "右键画布空白" }),
      { clientX: 500, clientY: 400 }
    );
    expect(screen.queryByTestId("aigc-node-context-menu")).toBeNull();
    expect(screen.getByTestId("aigc-canvas-node-picker")).toBeInTheDocument();
  });

  it("keeps narrow panels isolated and restores the desktop palette preference across breakpoints", () => {
    let matches = true;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQuery = {
      get matches() {
        return matches;
      },
      media: "(min-width: 1024px)",
      onchange: null,
      addEventListener: (
        _type: string,
        listener: (event: MediaQueryListEvent) => void
      ) => listeners.add(listener),
      removeEventListener: (
        _type: string,
        listener: (event: MediaQueryListEvent) => void
      ) => listeners.delete(listener),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    };
    window.matchMedia = vi.fn(() => mediaQuery as unknown as MediaQueryList);
    renderEditor(
      pipeline,
      "pipeline",
      createEditorStore(pipeline, "pipeline"),
      { openInspector: false }
    );

    expect(screen.queryByTestId("aigc-node-palette")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "打开节点库" }));
    expect(screen.getByTestId("aigc-node-palette")).toHaveClass("w-[184px]");
    expect(window.localStorage.getItem("aigc.node-palette.visible.v1")).toBe(
      "true"
    );

    matches = false;
    act(() =>
      listeners.forEach((listener) =>
        listener({ matches: false } as MediaQueryListEvent)
      )
    );
    expect(screen.queryByTestId("aigc-node-palette")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "打开节点面板" }));
    expect(screen.getByTestId("aigc-node-palette")).toHaveClass("w-60");
    expect(
      screen.getByRole("button", { name: "关闭节点面板" })
    ).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "LLM" }));
    expect(screen.queryByTestId("aigc-node-palette")).toBeNull();
    expect(window.localStorage.getItem("aigc.node-palette.visible.v1")).toBe(
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "打开节点面板" }));
    fireEvent.click(screen.getByRole("button", { name: "打开检查器" }));
    expect(screen.queryByTestId("aigc-node-palette")).toBeNull();
    expect(screen.getByTestId("aigc-inspector")).toHaveClass(
      "w-[min(320px,100vw)]"
    );
    expect(
      screen.queryByRole("button", { name: "打开节点面板" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "打开检查器" })
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "关闭详情栏" }));
    expect(
      screen.getByRole("button", { name: "打开节点面板" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "打开检查器" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开节点面板" }));
    matches = true;
    act(() =>
      listeners.forEach((listener) =>
        listener({ matches: true } as MediaQueryListEvent)
      )
    );
    expect(screen.getByTestId("aigc-node-palette")).toHaveClass("w-[184px]");

    matches = false;
    act(() =>
      listeners.forEach((listener) =>
        listener({ matches: false } as MediaQueryListEvent)
      )
    );
    expect(screen.queryByTestId("aigc-node-palette")).toBeNull();
    expect(
      screen.getByRole("button", { name: "打开节点面板" })
    ).toBeInTheDocument();

    matches = true;
    act(() =>
      listeners.forEach((listener) =>
        listener({ matches: true } as MediaQueryListEvent)
      )
    );
    expect(screen.getByTestId("aigc-node-palette")).toHaveClass("w-[184px]");

    fireEvent.click(screen.getByRole("button", { name: "隐藏节点库" }));
    matches = false;
    act(() =>
      listeners.forEach((listener) =>
        listener({ matches: false } as MediaQueryListEvent)
      )
    );
    matches = true;
    act(() =>
      listeners.forEach((listener) =>
        listener({ matches: true } as MediaQueryListEvent)
      )
    );
    expect(screen.queryByTestId("aigc-node-palette")).toBeNull();
    expect(
      screen.getByRole("button", { name: "打开节点库" })
    ).toBeInTheDocument();
  });

  it("adds JSON parser from the control palette and edits JSONPath with local feedback", () => {
    const entity = jsonParserPipeline();
    const { store } = renderEditor(entity, "pipeline");

    fireEvent.click(screen.getByRole("button", { name: "选择节点 parser" }));
    const input = screen.getByLabelText("JSONPath");
    expect(input).toHaveValue("$.items");
    expect(
      screen.getByText("保存和运行时将由服务端校验完整语法。", {
        exact: false
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Item 数量")).toBeInTheDocument();
    expect(screen.getByText("未运行")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "items" } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "JSONPath 必须以 $ 开头。"
    );
    expect(
      store.getState().definition.nodes.find((node) => node.id === "parser")
    ).toMatchObject({ config: { json_path: "items" } });

    const parserCount = store.getState().definition.nodes.length;
    fireEvent.click(screen.getByRole("button", { name: "打开节点库" }));
    fireEvent.click(screen.getByRole("button", { name: "JSON 解析器" }));
    expect(store.getState().definition.nodes).toHaveLength(parserCount + 1);
    expect(store.getState().definition.nodes.at(-1)).toMatchObject({
      type: "json_parser",
      config: { json_path: "$.items" }
    });
  });

  it("keeps managed JSON text read-only in the inspector", () => {
    renderEditor(managedJsonTextPipeline(), "pipeline");

    fireEvent.click(
      screen.getByRole("button", { name: "选择节点 managed-text" })
    );

    expect(screen.getByRole("heading", { name: "JSON 项 1" })).toBeInTheDocument();
    expect(screen.getByLabelText("内容标题")).toBeDisabled();
    expect(screen.queryByLabelText("基础文本")).toBeNull();
    expect(screen.getByText("只读上游内容 · 来源：JSON 解析器")).toBeInTheDocument();
    expect(screen.getByLabelText("JSON 项 1只读内容")).toHaveTextContent(
      "来自 JSON 数组的只读长文本内容"
    );
  });

  it("refreshes the Pipeline after parser success and rebases a dirty draft", async () => {
    const entity = jsonParserPipeline();
    const run = runFixture({
      id: "run-parser-success",
      definition_snapshot: entity.definition,
      pipeline_revision: entity.revision,
      status: "succeeded"
    });
    const materialized = managedJsonTextPipeline();
    const remoteManaged = (
      materialized.definition as AigcPipelineDefinitionV2
    ).nodes.find((node) => node.id === "managed-text");
    if (remoteManaged?.type !== "text") {
      throw new Error("expected managed text");
    }
    remoteManaged.config.text = "服务端物化内容";
    remoteManaged.config.generated_from_run_id = run.id;
    const remote = {
      ...materialized,
      name: "服务端名称",
      revision: 4
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
        runNodeFixture("parser", {
          result: {
            kind: "text_items",
            text: null,
            text_digest: "digest",
            items: [
              { index: 0, text: "服务端物化内容", summary: "服务端物化内容" }
            ],
            assets: []
          },
          status: "succeeded"
        })
      ]
    });
    apiMocks.getAigcPipeline.mockResolvedValue(remote);
    apiMocks.updateAigcPipeline.mockResolvedValue({
      ...remote,
      name: "本地未保存名称",
      revision: 5
    });
    const { store } = renderEditor(entity, "pipeline");

    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "本地未保存名称" }
    });

    await waitFor(() => {
      expect(apiMocks.getAigcPipeline).toHaveBeenCalledWith(entity.id);
      expect(screen.getByTestId("node-canvas")).toHaveTextContent("2 nodes");
    });
    expect(store.getState()).toMatchObject({
      dirty: true,
      name: "本地未保存名称",
      revision: 4
    });
    expect(
      store.getState().definition.nodes.find(
        (node) => node.id === "managed-text"
      )
    ).toMatchObject({
      config: {
        text: "服务端物化内容",
        generated_from_run_id: run.id
      }
    });

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledWith(
        entity.id,
        expect.objectContaining({
          expected_revision: 4,
          name: "本地未保存名称",
          definition: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "managed-text",
                config: expect.objectContaining({
                  text: "服务端物化内容"
                })
              })
            ])
          })
        })
      );
    }, { timeout: 2_000 });
    expect(await screen.findByText("已保存 Revision 5")).toBeInTheDocument();
  });

  it("refreshes and authoritatively rebases an AI-generated node name", async () => {
    const entity = structuredClone(pipeline);
    entity.definition.edges.push({
      id: "edge-model-output",
      sourceNodeId: "model",
      sourceHandle: "image",
      targetNodeId: "output",
      targetHandle: "image"
    });
    const run = runFixture({
      id: "run-generated-name-success",
      definition_snapshot: entity.definition,
      pipeline_revision: entity.revision,
      status: "succeeded"
    });
    const remote = structuredClone(entity);
    remote.name = "服务端画布";
    remote.revision = entity.revision;
    const remoteOutput = remote.definition.nodes.find(
      (node) => node.id === "output"
    );
    if (!remoteOutput) throw new Error("expected output node");
    remoteOutput.custom_name = null;
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
          result: {
            kind: "assets",
            naming: {
              status: "succeeded",
              model: "doubao-seed-2-0-mini-260428",
              name: "秋日咖啡"
            },
            text: null,
            text_digest: null,
            assets: [
              {
                asset_id: "generated-name-asset",
                ordinal: 0,
                mime_type: "image/png",
                download_url: "/api/assets/generated-name-asset/content",
                available: true,
                metadata: {}
              }
            ]
          },
          status: "succeeded"
        })
      ]
    });
    apiMocks.getAigcPipeline.mockResolvedValue(remote);
    apiMocks.updateAigcPipeline.mockResolvedValue({
      ...remote,
      name: "本地未保存名称",
      revision: remote.revision + 1
    });
    const { store } = renderEditor(entity, "pipeline");

    act(() => {
      store.getState().setNodeCustomName("model", "运行中人工名称");
    });
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "本地未保存名称" }
    });

    await waitFor(() => {
      expect(apiMocks.getAigcPipeline).toHaveBeenCalledWith(entity.id);
      expect(store.getState().revision).toBe(remote.revision);
      expect(
        store.getState().definition.nodes.find((node) => node.id === "output")
          ?.custom_name
      ).toBe("秋日咖啡");
    });

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledWith(
        entity.id,
        expect.objectContaining({
          expected_revision: remote.revision,
          name: "本地未保存名称",
          definition: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "output",
                custom_name: "秋日咖啡"
              })
            ])
          })
        })
      );
    }, { timeout: 2_000 });
  });

  it("keeps template editing non-executable and autosaves by revision", async () => {
    renderEditor(template, "template");

    expect(screen.queryByRole("button", { name: "执行" })).toBeNull();
    expect(screen.queryByTestId("aigc-command-group-document")).toBeNull();
    expect(screen.queryByTestId("aigc-command-group-execution")).toBeNull();
    expect(screen.getByTestId("aigc-command-group-panel")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "运行记录" })).toBeNull();
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "更新模板" }
    });
    expect(screen.getByTestId("aigc-autosave-status")).toHaveTextContent(
      "等待自动保存"
    );
    expect(screen.getByTestId("aigc-autosave-status")).toHaveAttribute(
      "data-status",
      "pending"
    );

    await waitFor(() => {
      expect(apiMocks.updateAigcTemplate).toHaveBeenCalledWith(
        "template-1",
        expect.objectContaining({
          expected_revision: 3,
          name: "更新模板"
        })
      );
    }, { timeout: 2_000 });
    expect(await screen.findByText("已保存 Revision 4")).toBeInTheDocument();
  });

  it("shows pipeline execution entry and adds registered nodes", async () => {
    renderEditor(pipeline, "pipeline");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "执行" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "打开节点库" }));
    fireEvent.click(screen.getByRole("button", { name: "LLM" }));

    await waitFor(() => {
      expect(screen.getByTestId("node-canvas")).toHaveTextContent("4 nodes");
    });
    expect(screen.getByText("等待自动保存")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
  });

  it("contracts the toolbar without losing priority commands at 390px", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390
    });
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
    const narrowPipeline = {
      ...pipeline,
      name: "这是一个用于验证窄屏标题截断行为的超长 AIGC 工作流名称"
    };
    const store = createEditorStore(narrowPipeline, "pipeline");
    store.getState().setName(`${narrowPipeline.name}（已修改）`);

    renderEditor(narrowPipeline, "pipeline", store);
    await waitFor(() => {
      expect(screen.getByTestId("aigc-command-execute")).toBeEnabled();
    });

    expect(screen.getByTestId("aigc-editor-header")).toHaveClass(
      "h-14",
      "flex-row",
      "items-center",
      "overflow-hidden"
    );
    expect(screen.getByTestId("aigc-editor-title-row")).toHaveClass(
      "min-w-0",
      "flex-1"
    );
    expect(screen.getByTestId("aigc-editor-title")).toHaveClass("truncate");
    expect(screen.getByTestId("aigc-editor-title")).toHaveAttribute(
      "title",
      `${narrowPipeline.name}（已修改）`
    );
    expect(screen.getByTestId("aigc-editor-mode")).toHaveClass(
      "hidden",
      "md:inline-flex"
    );
    expect(screen.getByText("等待自动保存")).toBeInTheDocument();
    expect(screen.getByTestId("aigc-autosave-status")).toHaveClass("sr-only");

    const actions = screen.getByTestId("aigc-editor-actions");
    expect(actions).toHaveClass("shrink-0", "justify-end");
    for (const command of [
      "aigc-command-inspector",
      "aigc-command-save-template",
      "aigc-command-execute"
    ]) {
      expect(within(actions).getByTestId(command)).toBeInTheDocument();
    }
    expect(within(actions).queryByRole("button", { name: "撤销" })).toBeNull();
    expect(within(actions).queryByRole("button", { name: "重做" })).toBeNull();
    expect(
      within(actions).queryByRole("button", { name: "运行记录" })
    ).toBeNull();
    expect(
      within(actions).getByRole("button", { name: "另存为模板" })
    ).toBeEnabled();
    expect(within(actions).getByRole("button", { name: "执行" })).toBeEnabled();
    expect(within(actions).queryByRole("button", { name: "保存" })).toBeNull();
    expect(within(actions).getByText("另存为模板")).toHaveClass(
      "hidden",
      "lg:inline"
    );
    expect(within(actions).getByText("执行")).toHaveClass("hidden", "lg:inline");
    expect(screen.getByTitle("返回 AIGC 工作台")).toHaveClass("h-10", "w-10");
    expect(screen.getByRole("button", { name: "详情" })).toHaveClass(
      "h-10",
      "w-10"
    );
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

  it("renders legacy layer nodes at their normalized minimum sizes immediately", () => {
    const layerPipeline: AigcPipeline = {
      ...pipeline,
      id: "pipeline-layers",
      definition: {
        schemaVersion: 1,
        nodes: [
          {
            id: "canvas",
            type: "layer_canvas",
            position: { x: 0, y: 0 },
            size: { width: 240, height: 160 },
            config: {
              selected_layer_id: null,
              source_layer_set: null,
              transform_patches: []
            }
          },
          {
            id: "composite",
            type: "layer_composite",
            position: { x: 360, y: 0 },
            size: { width: 288, height: 210 },
            config: {}
          }
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    };

    renderEditor(layerPipeline, "pipeline");

    expect(screen.getByTestId("node-canvas")).toHaveAttribute(
      "data-layer-canvas-size",
      "380x420"
    );
    expect(screen.getByTestId("node-canvas")).toHaveAttribute(
      "data-layer-composite-size",
      "360x340"
    );
  });

  it("reinitializes synchronously when the route entity changes", () => {
    const view = render(
      <AigcQueryProvider>
        <AigcEditor entity={pipeline} mode="pipeline" />
      </AigcQueryProvider>
    );

    expect(screen.getByText("已保存 Revision 3")).toBeInTheDocument();
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

    expect(screen.getByText("已保存 Revision 7")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    expect(screen.getByLabelText("名称")).toHaveValue("切换后的画布");
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
    let videoNode = (
      store.getState().definition as unknown as AigcPipelineDefinitionV2
    ).nodes.find((node) => node.id === "video-input");
    expect(videoNode?.type).toBe("video");
    if (videoNode?.type === "video") {
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
    videoNode = (
      store.getState().definition as unknown as AigcPipelineDefinitionV2
    ).nodes.find((node) => node.id === "video-input");
    expect(videoNode?.type).toBe("video");
    if (videoNode?.type === "video") {
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
    videoNode = (
      store.getState().definition as unknown as AigcPipelineDefinitionV2
    ).nodes.find((node) => node.id === "video-input");
    expect(videoNode?.type).toBe("video");
    if (videoNode?.type === "video") {
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

  it("creates and configures video enhancement nodes with dynamic fields", async () => {
    const { store } = renderEditor(videoEnhancementPipeline(), "pipeline");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "执行" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "打开节点库" }));
    fireEvent.click(
      screen.getByRole("button", { name: "视频画质增强" })
    );
    const createdNode = store.getState().definition.nodes.at(-1);
    expect(createdNode).toMatchObject({
      type: "video_enhancement",
      config: {
        tool_version: "standard",
        scene: "aigc",
        enhance_style: "hd",
        resolution: "1080p",
        fps: null,
        bitrate_level: "medium",
        bit_depth: 8
      }
    });

    act(() => store.getState().selectNode("video-enhancement"));
    expect(await screen.findByLabelText("版本")).toHaveValue("standard");
    expect(screen.getByLabelText("场景")).toHaveValue("aigc");
    expect(screen.getByLabelText("色深")).toBeDisabled();
    expect(screen.queryByLabelText("短边像素")).toBeNull();
    expect(screen.queryByLabelText("目标 FPS")).toBeNull();
    expect(screen.queryByLabelText("码率 (kbps)")).toBeNull();

    fireEvent.change(screen.getByLabelText("版本"), {
      target: { value: "professional" }
    });
    expect(screen.queryByLabelText("场景")).toBeNull();
    expect(screen.getByLabelText("色深")).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("尺寸模式"), {
      target: { value: "short_edge" }
    });
    expect(screen.queryByLabelText("分辨率")).toBeNull();
    fireEvent.change(screen.getByLabelText("短边像素"), {
      target: { value: "5000" }
    });
    expect(screen.getByLabelText("短边像素")).toHaveValue(4320);

    fireEvent.change(screen.getByLabelText("帧率"), {
      target: { value: "custom" }
    });
    fireEvent.change(screen.getByLabelText("目标 FPS"), {
      target: { value: "10" }
    });
    expect(screen.getByLabelText("目标 FPS")).toHaveValue(15);

    fireEvent.change(screen.getByLabelText("码率模式"), {
      target: { value: "custom" }
    });
    fireEvent.change(screen.getByLabelText("码率 (kbps)"), {
      target: { value: "200000" }
    });
    expect(screen.getByLabelText("码率 (kbps)")).toHaveValue(150000);

    fireEvent.change(screen.getByLabelText("色深"), {
      target: { value: "16" }
    });
    expect(screen.queryByLabelText("码率模式")).toBeNull();
    expect(screen.queryByLabelText("码率 (kbps)")).toBeNull();
    expect(screen.getByText(/16-bit 为高成本 MOV 输出/)).toBeInTheDocument();

    const node = store
      .getState()
      .definition.nodes.find(
        (candidate) => candidate.id === "video-enhancement"
      );
    expect(node).toMatchObject({
      config: {
        tool_version: "professional",
        scene: null,
        resolution_mode: "short_edge",
        resolution: null,
        resolution_limit: 4320,
        fps: 15,
        bitrate_mode: null,
        bitrate_level: null,
        bitrate: null,
        bit_depth: 16
      }
    });

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledWith(
        "pipeline-1",
        expect.objectContaining({
          definition: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "video-enhancement",
                config: expect.objectContaining({
                  tool_version: "professional",
                  scene: null,
                  resolution_limit: 4320,
                  fps: 15,
                  bitrate_mode: null,
                  bit_depth: 16
                })
              })
            ])
          })
        })
      );
    }, { timeout: 2_000 });
  });

  it("creates, configures, and persists compact video face blur settings", async () => {
    const { store } = renderEditor(videoFaceBlurPipeline(), "pipeline");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "执行" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "打开节点库" }));
    fireEvent.click(
      screen.getByRole("button", { name: "视频人脸打码" })
    );
    expect(store.getState().definition.nodes.at(-1)).toMatchObject({
      type: "video_face_blur",
      config: {
        mask_mode: "mosaic",
        mask_strength: "medium"
      }
    });

    act(() => store.getState().selectNode("face-blur"));
    expect(await screen.findByLabelText("打码方式")).toHaveValue("mosaic");
    expect(screen.getByLabelText("打码强度")).toHaveValue("medium");
    expect(screen.getByLabelText("打码方式").closest("fieldset")).toBe(
      screen.getByLabelText("打码强度").closest("fieldset")
    );

    fireEvent.change(screen.getByLabelText("打码方式"), {
      target: { value: "blur" }
    });
    fireEvent.change(screen.getByLabelText("打码强度"), {
      target: { value: "high" }
    });

    expect(
      store
        .getState()
        .definition.nodes.find((node) => node.id === "face-blur")
    ).toMatchObject({
      config: {
        mask_mode: "blur",
        mask_strength: "high"
      }
    });

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledWith(
        "pipeline-1",
        expect.objectContaining({
          definition: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "face-blur",
                config: {
                  mask_mode: "blur",
                  mask_strength: "high"
                }
              })
            ])
          })
        })
      );
    }, { timeout: 2_000 });
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
    }, { timeout: 2_000 });
  });

  it("keeps incompatible edges on mode switch and blocks autosave with a located error", async () => {
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
    expect(
      screen.getByTestId("aigc-autosave-status")
    ).toHaveTextContent(
      "草稿无效：生视频节点（video-model）：首帧不适用于当前生成模式，请断开对应连线"
    );
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
    await waitFor(() => {
      expect(screen.getByTestId("aigc-command-execute")).toBeEnabled();
    });
    act(() => store.getState().selectNode("seedream"));

    expect(
      screen.getByRole("button", { name: "图生图" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "自定义像素" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "自定义像素" }));
    expect(screen.getByLabelText("宽度")).toHaveValue(2048);
    expect(screen.getByLabelText("高度")).toHaveValue(2048);
    expect(
      store.getState().definition.nodes.find((node) => node.id === "seedream")
    ).toMatchObject({
      config: { operation: "image_to_image", size: "2048x2048" }
    });

    fireEvent.click(screen.getByRole("button", { name: "图层拆分" }));

    expect(store.getState().definition.edges).toHaveLength(3);
    expect(
      store.getState().definition.nodes.find((node) => node.id === "seedream")
    ).toMatchObject({
      config: { operation: "layer_decomposition", size: "auto" }
    });
    expect(screen.getByLabelText("拆分尺寸")).toHaveValue("auto");
    expect(screen.queryByLabelText("画幅")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "自定义像素" })
    ).toBeNull();
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
    expect(
      screen.queryByRole("button", { name: "自定义像素" })
    ).toBeNull();
  });

  it("keeps an invalid text-to-image size draft local and blocks autosave and execution", async () => {
    const { store } = renderEditor(pipeline, "pipeline");
    await waitFor(() => {
      expect(screen.getByTestId("aigc-command-execute")).toBeEnabled();
    });
    act(() => store.getState().selectNode("model"));

    fireEvent.click(screen.getByRole("button", { name: "自定义像素" }));
    fireEvent.change(screen.getByLabelText("宽度"), {
      target: { value: "" }
    });

    expect(
      store.getState().definition.nodes.find((node) => node.id === "model")
    ).toMatchObject({ config: { size: "x2048" } });
    expect(screen.getByText("请输入宽度")).toBeInTheDocument();
    expect(screen.getByTestId("aigc-autosave-status")).toHaveTextContent(
      "草稿无效：Seedream 图片节点（model）：图片尺寸格式必须为 WIDTHxHEIGHT"
    );

    fireEvent.click(screen.getByRole("button", { name: "执行" }));

    expect(
      await screen.findByText(
        "Seedream 图片节点（model）：图片尺寸格式必须为 WIDTHxHEIGHT"
      )
    ).toBeInTheDocument();
    expect(apiMocks.updateAigcPipeline).not.toHaveBeenCalled();
    expect(apiMocks.createAigcRun).not.toHaveBeenCalled();
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

    await waitFor(() => {
      expect(screen.getByTestId("aigc-command-execute")).toBeEnabled();
    });
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
      type: "video_enhancement",
      status: "failed",
      error: {
        code: "mediakit_task_failed",
        message: "MediaKit 画质增强失败",
        request_id: "request-task-2",
        stage: "provider"
      }
    });
    const tracedAttempt = attemptFixture(1, {
      task_id: "task-face-blur",
      node_id: "face-blur",
      run_id: run.id,
      type: "video_face_blur",
      result: {
        kind: "assets",
        text: null,
        text_digest: null,
        assets: [
          {
            asset_id: "face-blur-result",
            ordinal: 0,
            mime_type: "video/mp4",
            download_url: "/api/assets/face-blur-result/content",
            available: true,
            metadata: {
              provider_task_id: "mediakit-face-123",
              provider_request_id: "request-face-456"
            }
          }
        ]
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
        runNodeFixture("face-blur", {
          current_task_id: tracedAttempt.task_id,
          attempts: [tracedAttempt],
          result: tracedAttempt.result
        }),
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
      "错误码：SCHEDULING_FAILED · 阶段：validate · Request ID：request-run-7"
    );

    const modelLog = screen.getByRole("group", { name: "节点日志：model" });
    expect(modelLog).toHaveTextContent("失败 · 2 次尝试 · Attempt #2");
    expect(modelLog).toHaveTextContent("MediaKit 画质增强失败");
    expect(modelLog).toHaveTextContent(
      "错误码：mediakit_task_failed · 阶段：provider · Request ID：request-task-2"
    );
    expect(modelLog).not.toHaveTextContent("旧 attempt 错误");

    const timeoutLog = screen.getByRole("group", {
      name: "节点日志：timeout"
    });
    expect(timeoutLog).toHaveTextContent("执行失败，未提供详细原因");
    expect(
      screen.getByRole("group", { name: "节点日志：blocked" })
    ).toHaveTextContent("因上游失败被阻塞");
    const providerTrace = screen.getByLabelText(
      "供应商追踪标识：face-blur"
    );
    expect(providerTrace).toHaveTextContent(
      "供应商任务 IDmediakit-face-123"
    );
    expect(providerTrace).toHaveTextContent(
      "供应商 Request IDrequest-face-456"
    );
    expect(
      screen.getByRole("group", { name: "节点日志：input" })
    ).not.toHaveTextContent("Attempt #");
  });

  it("shows stable JSON parser error codes with actionable Chinese in inspector and run log", async () => {
    const entity = jsonParserPipeline();
    const parserError = {
      code: "json_parser_result_not_array",
      message: "result is not array",
      request_id: null,
      stage: "validate"
    };
    const run = runFixture({
      id: "run-parser-failed",
      status: "failed",
      definition_snapshot: entity.definition,
      error: parserError
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
        runNodeFixture("parser", {
          status: "failed",
          error: parserError
        })
      ]
    });

    renderEditor(entity, "pipeline");
    fireEvent.click(screen.getByRole("button", { name: "选择节点 parser" }));

    expect(
      await screen.findByText(
        "JSONPath 的结果不是数组，请选择一个数组字段。"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("json_parser_result_not_array")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "运行" }));
    const nodeLog = await screen.findByRole("group", {
      name: "节点日志：parser"
    });
    expect(nodeLog).toHaveTextContent(
      "JSONPath 的结果不是数组，请选择一个数组字段。"
    );
    expect(nodeLog).toHaveTextContent(
      "错误码：json_parser_result_not_array"
    );
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
    expect(downloads[0]).toHaveAttribute("download", "结果.webp");
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
    renderEditor(
      { ...pipeline, definition: videoDefinition },
      "pipeline",
      createEditorStore(
        { ...pipeline, definition: videoDefinition },
        "pipeline"
      ),
      { openInspector: false }
    );

    await waitFor(() => {
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(latestRun.id);
    });
    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    fireEvent.click(screen.getByRole("tab", { name: "结果" }));
    const video = await screen.findByLabelText("播放视频：广告成片");
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
    ).toHaveAttribute("download", "广告成片.mp4");

    expect(
      screen.queryByRole("button", { name: "放大预览：广告成片" })
    ).toBeNull();

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

  it("shows face blur results and keeps historical Run metadata isolated", async () => {
    const currentDefinition =
      videoFaceBlurPipeline().definition as AigcPipelineDefinition;
    const historicalDefinition: AigcPipelineDefinition = {
      ...structuredClone(currentDefinition),
      nodes: currentDefinition.nodes.map((node) =>
        node.type === "video_face_blur"
          ? {
              ...structuredClone(node),
              config: { mask_mode: "blur", mask_strength: "high" }
            }
          : structuredClone(node)
      )
    };
    const currentRun = runFixture({
      id: "run-face-current",
      run_number: 4,
      definition_snapshot: currentDefinition
    });
    const historicalRun = runFixture({
      id: "run-face-history",
      run_number: 3,
      definition_snapshot: historicalDefinition
    });
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [currentRun, historicalRun],
      page: 1,
      page_size: 20,
      total: 2
    });
    apiMocks.getAigcRun.mockImplementation(async (runId: string) => {
      const historical = runId === historicalRun.id;
      const run = historical ? historicalRun : currentRun;
      return {
        run,
        nodes: [
          runNodeFixture("face-blur", {
            result: {
              kind: "assets",
              text: null,
              text_digest: null,
              assets: [
                {
                  asset_id: historical
                    ? "face-blur-history"
                    : "face-blur-current",
                  ordinal: 0,
                  mime_type: "video/mp4",
                  download_url: `/api/assets/${
                    historical ? "face-blur-history" : "face-blur-current"
                  }/content`,
                  available: true,
                  metadata: {
                    duration_seconds: historical ? 8 : 12.5,
                    mask_mode: historical ? "blur" : "mosaic",
                    mask_strength: historical ? "high" : "medium",
                    provider_task_id: historical
                      ? "provider-history"
                      : "provider-current",
                    provider_request_id: historical
                      ? "request-history"
                      : "request-current"
                  }
                }
              ]
            }
          })
        ]
      };
    });
    renderEditor(
      { ...videoFaceBlurPipeline(), definition: currentDefinition },
      "pipeline"
    );

    fireEvent.click(screen.getByRole("tab", { name: "结果" }));
    expect(
      await screen.findByLabelText("播放视频：人脸打码结果-1")
    ).toHaveClass("object-contain");
    const currentMetadata = screen.getByLabelText("视频输出信息");
    expect(currentMetadata).toHaveTextContent("时长12.5s");
    expect(currentMetadata).toHaveTextContent("打码方式马赛克");
    expect(currentMetadata).toHaveTextContent("打码强度中等强度");
    expect(
      screen.getByRole("link", { name: "下载视频" })
    ).toHaveAttribute("download", "人脸打码结果.mp4");

    fireEvent.click(screen.getByRole("tab", { name: "运行" }));
    fireEvent.change(await screen.findByLabelText("运行历史"), {
      target: { value: historicalRun.id }
    });
    await waitFor(() => {
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(historicalRun.id);
    });
    fireEvent.click(screen.getByRole("tab", { name: "结果" }));

    const historicalMetadata = await screen.findByLabelText("视频输出信息");
    expect(historicalMetadata).toHaveTextContent("时长8s");
    expect(historicalMetadata).toHaveTextContent("打码方式高斯模糊");
    expect(historicalMetadata).toHaveTextContent("打码强度高强度");
  });

  it("shows multi-track render details and isolates an unavailable historical Run", async () => {
    const multiTrackDefinition: AigcPipelineDefinitionV2 = {
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
            tracks: []
          }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const currentRun = runFixture({
      id: "run-multitrack-current",
      run_number: 5,
      definition_snapshot: multiTrackDefinition
    });
    const historicalRun = runFixture({
      id: "run-multitrack-history",
      run_number: 4,
      definition_snapshot: multiTrackDefinition
    });
    const output = {
      asset_id: "multi-track-output",
      ordinal: 0,
      mime_type: "video/mp4",
      download_url: "/api/assets/multi-track-output/content",
      available: true,
      metadata: {
        provider: "mediakit",
        operation: "multi_track_edit",
        provider_task_id: "mediakit-task-5",
        provider_request_id: "mediakit-request-5",
        track_count: 4,
        element_count: 12,
        duration_ms: 12_500,
        width: 1920,
        height: 1080,
        fps: 30
      }
    } satisfies AigcResultAsset;
    const attempt = attemptFixture(2, {
      task_id: "task-multitrack-2",
      run_id: currentRun.id,
      node_id: "edit",
      type: "multi_track_edit",
      result: {
        kind: "assets",
        text: null,
        text_digest: null,
        assets: [output]
      },
      started_at: "2026-08-29T03:00:00Z",
      finished_at: "2026-08-29T03:00:02Z"
    });
    apiMocks.listAigcRuns.mockResolvedValue({
      items: [currentRun, historicalRun],
      page: 1,
      page_size: 20,
      total: 2
    });
    apiMocks.getAigcRun.mockImplementation(async (runId: string) => ({
      run: runId === historicalRun.id ? historicalRun : currentRun,
      nodes: [
        runNodeFixture("edit", {
          current_task_id:
            runId === historicalRun.id ? null : attempt.task_id,
          result:
            runId === historicalRun.id
              ? {
                  kind: "unavailable",
                  text: null,
                  text_digest: null,
                  assets: [{ ...output, available: false, download_url: null }]
                }
              : attempt.result,
          attempts: runId === historicalRun.id ? [] : [attempt]
        })
      ]
    }));
    renderEditor(
      {
        ...pipeline,
        definition:
          multiTrackDefinition as unknown as AigcPipelineDefinition
      },
      "pipeline"
    );

    fireEvent.click(screen.getByRole("tab", { name: "结果" }));
    expect(
      await screen.findByLabelText("播放视频：多轨剪辑成片-1")
    ).toHaveClass("object-contain");
    expect(
      screen.queryByRole("button", { name: "全屏播放：多轨剪辑成片-1" })
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "下载视频" })
    ).toHaveAttribute("download", "多轨剪辑成片.mp4");
    const metadata = screen.getByLabelText("视频输出信息");
    expect(metadata).toHaveTextContent("轨道4");
    expect(metadata).toHaveTextContent("元素12");
    expect(metadata).toHaveTextContent("分辨率1920x1080");
    expect(metadata).toHaveTextContent("帧率30 fps");
    expect(metadata).toHaveTextContent("时长12.5s");
    expect(metadata).toHaveTextContent("供应商mediakit");
    expect(metadata).toHaveTextContent("供应商任务mediakit-task-5");
    const execution = screen.getByLabelText("结果执行信息：edit");
    expect(execution).toHaveTextContent("状态已完成");
    expect(execution).toHaveTextContent("耗时2 秒");
    expect(execution).toHaveTextContent("Attempt#2");
    expect(execution).toHaveTextContent("Request IDmediakit-request-5");

    fireEvent.click(screen.getByRole("tab", { name: "运行" }));
    fireEvent.change(await screen.findByLabelText("运行历史"), {
      target: { value: historicalRun.id }
    });
    await waitFor(() => {
      expect(apiMocks.getAigcRun).toHaveBeenCalledWith(historicalRun.id);
    });
    fireEvent.click(screen.getByRole("tab", { name: "结果" }));
    expect(
      await screen.findByText(
        "历史结果已不可用，资产可能已删除或无权访问"
      )
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/播放视频：多轨剪辑成片/)).toBeNull();
    expect(screen.queryByRole("link", { name: "下载视频" })).toBeNull();
  });

  it("shows enhanced metadata and cache reuse in the shared result panel", async () => {
    const enhancementDefinition: AigcPipelineDefinition = {
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
            fps: 60,
            bitrate_mode: "level",
            bitrate_level: "medium",
            bitrate: null,
            bit_depth: 10
          }
        },
        {
          id: "video-output",
          type: "video_output",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 180 },
          config: { title: "增强/交付片" }
        }
      ],
      edges: [
        {
          id: "enhanced-output",
          sourceNodeId: "enhance",
          sourceHandle: "video",
          targetNodeId: "video-output",
          targetHandle: "video"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const run = runFixture({
      id: "run-enhancement-reused",
      run_number: 3,
      status: "succeeded",
      definition_snapshot: enhancementDefinition
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
        runNodeFixture("enhance", {
          status: "reused",
          reused_from_task_id: "enhancement-task-previous",
          result: {
            kind: "assets",
            text: null,
            text_digest: null,
            assets: [
              {
                asset_id: "enhanced-mov",
                ordinal: 0,
                mime_type: "video/quicktime",
                download_url: "/api/assets/enhanced-mov/content",
                available: true,
                metadata: {
                  resolution: "3840x2160",
                  fps: 59.94,
                  duration_seconds: 12.5,
                  tool_version: "professional",
                  bit_depth: 10
                }
              }
            ]
          }
        })
      ]
    });
    renderEditor(
      { ...pipeline, definition: enhancementDefinition },
      "pipeline"
    );

    fireEvent.click(screen.getByRole("tab", { name: "结果" }));

    expect(await screen.findByText("复用")).toBeInTheDocument();
    expect(
      screen.getByText(
        "enhancement-task-previous",
        { selector: "dd" }
      )
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("播放视频：画质增强结果-1")
    ).toHaveClass("object-contain");
    const metadata = screen.getByLabelText("视频输出信息");
    expect(metadata).toHaveTextContent("分辨率3840x2160");
    expect(metadata).toHaveTextContent("帧率59.94 fps");
    expect(metadata).toHaveTextContent("时长12.5s");
    expect(metadata).toHaveTextContent("版本专业版");
    expect(metadata).toHaveTextContent("色深10-bit");
    expect(
      screen.getByRole("link", { name: "下载视频" })
    ).toHaveAttribute("download", "画质增强结果.mov");
  });

  it("saves a pipeline as a template through an in-app dialog", async () => {
    renderEditor(pipeline, "pipeline");
    fireEvent.change(screen.getByLabelText("描述"), {
      target: { value: "另存前更新的描述" }
    });

    fireEvent.click(screen.getByRole("button", { name: "另存为模板" }));

    expect(
      screen.getByRole("heading", { name: "另存为模板" })
    ).toBeInTheDocument();
    const nameInput = screen.getByLabelText("模板名称");
    expect(nameInput).toHaveValue("商品模板");
    fireEvent.change(nameInput, { target: { value: "商品模板副本" } });
    fireEvent.click(screen.getByRole("button", { name: "保存模板" }));

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledWith(
        "pipeline-1",
        expect.objectContaining({
          description: "另存前更新的描述",
          expected_revision: 3
        })
      );
      expect(apiMocks.saveAigcPipelineAsTemplate).toHaveBeenCalledWith(
        "pipeline-1",
        {
          name: "商品模板副本",
          description: "另存前更新的描述"
        }
      );
    });
    expect(
      apiMocks.updateAigcPipeline.mock.invocationCallOrder[0]
    ).toBeLessThan(apiMocks.saveAigcPipelineAsTemplate.mock.invocationCallOrder[0]);
    expect(
      await screen.findByText("已保存为模板：商品模板副本")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "另存为模板" })
    ).not.toBeInTheDocument();
  });

  it("autosaves every persistent editor field and clears unload protection", async () => {
    const { store } = renderEditor(pipeline, "pipeline");

    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "自动保存画布" }
    });
    fireEvent.change(screen.getByLabelText("描述"), {
      target: { value: "自动保存描述" }
    });
    fireEvent.click(screen.getByRole("button", { name: "移动画布视口" }));
    act(() => {
      store.getState().moveNode("model", { x: 400, y: 32 });
      store.getState().resizeNode("model", { width: 300, height: 220 });
      store.getState().updateNodeConfig("input", {
        text: "更新后的提示词",
        bbox_references: [],
        title: null
      });
      store.getState().connect({
        id: "edge-output",
        sourceNodeId: "model",
        sourceHandle: "image",
        targetNodeId: "output",
        targetHandle: "image"
      });
    });

    expect(screen.getByText("等待自动保存")).toBeInTheDocument();
    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledWith(
        "pipeline-1",
        {
          expected_revision: 3,
          name: "自动保存画布",
          description: "自动保存描述",
          definition: expect.objectContaining({
            edges: expect.arrayContaining([
              expect.objectContaining({ id: "edge-output" })
            ]),
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "input",
                config: expect.objectContaining({
                  text: "更新后的提示词"
                })
              }),
              expect.objectContaining({
                id: "model",
                position: { x: 400, y: 32 },
                size: { width: 300, height: 220 }
              })
            ]),
            viewport: { x: 12, y: 24, zoom: 0.8 }
          })
        }
      );
    }, { timeout: 2_000 });
    expect(await screen.findByText("已保存 Revision 4")).toBeInTheDocument();
    expect(store.getState().dirty).toBe(false);

    const savedEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(savedEvent);
    expect(savedEvent.defaultPrevented).toBe(false);
  });

  it("keeps a newer draft dirty until its follow-up save completes", async () => {
    const firstSave = deferred<AigcPipeline>();
    const secondSave = deferred<AigcPipeline>();
    apiMocks.updateAigcPipeline
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);
    const { store } = renderEditor(pipeline, "pipeline");

    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "第一版草稿" }
    });
    fireEvent.click(screen.getByTitle("返回 AIGC 工作台"));
    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledTimes(1);
      expect(screen.getByText("正在保存")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("描述"), {
      target: { value: "请求期间的新修改" }
    });
    await act(async () => {
      firstSave.resolve({ ...pipeline, name: "第一版草稿", revision: 4 });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledTimes(2);
      expect(apiMocks.updateAigcPipeline).toHaveBeenLastCalledWith(
        "pipeline-1",
        expect.objectContaining({
          description: "请求期间的新修改",
          expected_revision: 4
        })
      );
    });
    expect(store.getState().dirty).toBe(true);
    expect(navigationMocks.push).not.toHaveBeenCalled();

    await act(async () => {
      secondSave.resolve({
        ...pipeline,
        description: "请求期间的新修改",
        revision: 5
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByText("已保存 Revision 5")).toBeInTheDocument();
      expect(navigationMocks.push).toHaveBeenCalledWith(
        "/workspace/aigc?view=pipelines"
      );
    });
    expect(store.getState().dirty).toBe(false);
  });

  it("blocks dependent commands when autosave fails", async () => {
    apiMocks.updateAigcPipeline.mockRejectedValue({
      status: 400,
      message: "invalid"
    });
    renderEditor(pipeline, "pipeline");
    await waitFor(() => {
      expect(screen.getByTestId("aigc-command-execute")).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "保存失败草稿" }
    });

    fireEvent.click(screen.getByRole("button", { name: "执行" }));
    expect(
      await screen.findByText("自动保存失败：请求失败")
    ).toBeInTheDocument();
    expect(screen.getByTestId("aigc-autosave-status")).toHaveAttribute(
      "data-status",
      "failed"
    );
    expect(screen.getByTestId("aigc-autosave-status")).toHaveClass("sr-only");
    expect(screen.getByTestId("aigc-autosave-status")).toHaveAttribute(
      "aria-label",
      "自动保存状态：自动保存失败：请求失败"
    );
    expect(screen.getByTestId("aigc-editor-header")).toHaveClass("h-14");
    expect(apiMocks.createAigcRun).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle("返回 AIGC 工作台"));
    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledTimes(2);
    });
    expect(navigationMocks.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "另存为模板" }));
    fireEvent.click(screen.getByRole("button", { name: "保存模板" }));
    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledTimes(3);
    });
    expect(apiMocks.saveAigcPipelineAsTemplate).not.toHaveBeenCalled();
  });

  it("flushes before opening the layer editor", async () => {
    const entity = layerCanvasPipeline();
    renderEditor(entity, "pipeline");
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "图层编辑前保存" }
    });

    fireEvent.click(screen.getByRole("button", { name: "打开图层编辑器" }));

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledWith(
        entity.id,
        expect.objectContaining({
          expected_revision: entity.revision,
          name: "图层编辑前保存"
        })
      );
      expect(navigationMocks.push).toHaveBeenCalledWith(
        `/workspace/aigc/pipelines/${entity.id}/nodes/layer-canvas/layers`
      );
    });
  });

  it("keeps invalid drafts local and blocks navigation and execution", async () => {
    renderEditor(pipeline, "pipeline");
    await waitFor(() => {
      expect(screen.getByTestId("aigc-command-execute")).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "   " }
    });

    expect(screen.getByTestId("aigc-autosave-status")).toHaveTextContent(
      "草稿无效：名称不能为空。"
    );
    fireEvent.click(screen.getByRole("button", { name: "执行" }));
    fireEvent.click(screen.getByTitle("返回 AIGC 工作台"));

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).not.toHaveBeenCalled();
      expect(apiMocks.createAigcRun).not.toHaveBeenCalled();
      expect(navigationMocks.push).not.toHaveBeenCalled();
    });
  });

  it("surfaces revision conflicts without marking the draft saved", async () => {
    apiMocks.updateAigcPipeline.mockRejectedValue({ status: 409 });
    renderEditor(pipeline, "pipeline");

    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "冲突画布" }
    });
    fireEvent.click(screen.getByTitle("返回 AIGC 工作台"));

    expect(
      await screen.findByText("保存冲突：服务端已有更新，请刷新后重新编辑。")
    ).toBeInTheDocument();
    expect(screen.getByTestId("aigc-autosave-status")).toHaveAttribute(
      "data-status",
      "conflict"
    );
    expect(screen.getByTestId("aigc-autosave-status")).toHaveClass("sr-only");
    expect(screen.getByTestId("aigc-editor-header")).toHaveClass("h-14");
    expect(navigationMocks.push).not.toHaveBeenCalled();

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
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

  it("flushes the latest draft before continuing from a layer canvas", async () => {
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
    const view = renderEditor(entity, "pipeline");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "从图层节点继续" })
      ).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "继续执行前保存" }
    });
    fireEvent.click(screen.getByRole("button", { name: "从图层节点继续" }));

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledWith(
        entity.id,
        expect.objectContaining({
          expected_revision: entity.revision,
          name: "继续执行前保存"
        })
      );
      expect(apiMocks.createAigcRun).toHaveBeenLastCalledWith(
        entity.id,
        {
          expected_revision: 4,
          mode: "from_node",
          start_node_id: "layer-canvas"
        },
        expect.any(String)
      );
    });
    expect(apiMocks.createAigcRun).toHaveBeenCalledTimes(1);
    view.unmount();
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
    await waitFor(() => {
      expect(screen.getByTestId("aigc-command-execute")).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "执行最新草稿" }
    });

    fireEvent.click(screen.getByRole("button", { name: "执行" }));

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledWith(
        "pipeline-1",
        expect.objectContaining({
          expected_revision: 3,
          name: "执行最新草稿"
        })
      );
      expect(apiMocks.createAigcRun).toHaveBeenCalledWith(
        "pipeline-1",
        {
          expected_revision: 4,
          mode: "full",
          start_node_id: null
        },
        expect.any(String)
      );
    });
  });
});
