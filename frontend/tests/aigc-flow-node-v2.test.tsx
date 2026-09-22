import { act, fireEvent, render, screen } from "@testing-library/react";
import type { NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AigcFlowNodeCard,
  type AigcFlowNode
} from "@/components/workspace/aigc/aigc-flow-node";
import { AigcRunProvider } from "@/components/workspace/aigc/aigc-run-context";
import { AigcEditorStoreProvider } from "@/components/workspace/aigc/providers/aigc-editor-store-provider";
import { AigcQueryProvider } from "@/components/workspace/aigc/providers/aigc-query-provider";
import { createAigcEditorStore } from "@/lib/aigc/editor-store";
import type { AigcRunProjection } from "@/lib/aigc/run-scope";
import type {
  AigcNode,
  AigcPipelineDefinitionV2,
  AigcPipelineRunDetail,
  AigcV2Node
} from "@/lib/aigc/types";

const apiMocks = vi.hoisted(() => ({
  getAsset: vi.fn()
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    Handle: ({
      "aria-label": ariaLabel,
      id,
      isConnectable,
      style,
      type
    }: {
      "aria-label"?: string;
      id?: string;
      isConnectable?: boolean;
      style?: CSSProperties;
      type?: string;
    }) => (
      <span
        aria-label={ariaLabel}
        data-connectable={String(isConnectable)}
        data-handle-id={id}
        data-handle-type={type}
        style={style}
      />
    ),
    NodeResizer: () => null
  };
});

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getAsset: apiMocks.getAsset
    }
  };
});

function nodeProps(node: AigcV2Node): NodeProps<AigcFlowNode> {
  const compatibleNode = node as unknown as AigcNode;
  return {
    data: { node: compatibleNode },
    dragging: false,
    id: node.id,
    isConnectable: true,
    positionAbsoluteX: node.position.x,
    positionAbsoluteY: node.position.y,
    selected: false,
    type: node.type,
    zIndex: 0
  } as NodeProps<AigcFlowNode>;
}

function renderNode(
  node: AigcV2Node,
  definition: AigcPipelineDefinitionV2,
  runDetail: AigcPipelineRunDetail | null = null
) {
  const store = createAigcEditorStore({
    definition,
    description: "",
    entityId: "pipeline-1",
    mode: "pipeline",
    name: "v2 模态",
    revision: 1
  });
  const view = (visibleRun: AigcPipelineRunDetail | null) => (
    <AigcQueryProvider>
      <AigcEditorStoreProvider store={store}>
        <AigcRunProvider value={singleRunProjection(visibleRun)}>
          <AigcFlowNodeCard {...nodeProps(node)} />
        </AigcRunProvider>
      </AigcEditorStoreProvider>
    </AigcQueryProvider>
  );
  const rendered = render(view(runDetail));
  return {
    ...rendered,
    rerenderRun: (visibleRun: AigcPipelineRunDetail | null) =>
      rendered.rerender(view(visibleRun)),
    store
  };
}

function singleRunProjection(
  detail: AigcPipelineRunDetail | null
): AigcRunProjection {
  const active =
    detail?.run.status === "queued" || detail?.run.status === "running";
  return {
    activeRunForNode: () => (active ? detail : null),
    displayRunForNode: () => detail,
    hasAnyActiveRun: active,
    isNodeActive: () => active,
    latestSuccessfulRunForNode: () =>
      detail?.run.status === "succeeded" ? detail : null
  };
}

function runDetail(
  definition: AigcPipelineDefinitionV2,
  nodeId: string,
  result: AigcPipelineRunDetail["nodes"][number]["result"],
  status: AigcPipelineRunDetail["nodes"][number]["status"] = "succeeded",
  error: AigcPipelineRunDetail["nodes"][number]["error"] = null
): AigcPipelineRunDetail {
  const sourceNodeId = definition.edges.find(
    (edge) => edge.targetNodeId === nodeId
  )?.sourceNodeId;
  return {
    run: {
      id: "run-1",
      pipeline_id: "pipeline-1",
      run_number: 1,
      pipeline_revision: 1,
      mode: "full",
      start_node_id: null,
      source_run_id: null,
      source_node_id: null,
      status: status === "failed" ? "failed" : "succeeded",
      definition_snapshot: definition as unknown as AigcPipelineRunDetail["run"]["definition_snapshot"],
      input_snapshot: {},
      error: null,
      cancellation_requested: false,
      created_at: "2026-09-04T00:00:00Z",
      updated_at: "2026-09-04T00:00:01Z",
      started_at: "2026-09-04T00:00:00Z",
      finished_at: "2026-09-04T00:00:01Z"
    },
    nodes: [
      ...(sourceNodeId
        ? [
            {
              node_id: sourceNodeId,
              included_in_plan: true,
              status,
              current_task_id: "source-task",
              reused_from_task_id: null,
              input_hash: null,
              result,
              attempts: []
            }
          ]
        : []),
      {
        node_id: nodeId,
        included_in_plan: true,
        status,
        current_task_id: null,
        reused_from_task_id: null,
        input_hash: null,
        result,
        error,
        attempts: []
      }
    ]
  };
}

describe("AIGC v2 modality node card", () => {
  beforeEach(() => {
    apiMocks.getAsset.mockResolvedValue({
      id: "asset-image",
      project_id: null,
      type: "generated_image",
      stage: "image",
      category: null,
      asset_role: "input",
      status: "succeeded",
      object_key: "asset-image.png",
      url: "https://example.com/asset-image.png",
      mime_type: "image/png",
      size_bytes: 100,
      source_task_id: null,
      metadata: { name: "本地图片.png" },
      created_at: "2026-09-04T00:00:00Z",
      updated_at: "2026-09-04T00:00:00Z"
    });
  });

  it("renders the local image thumbnail and both same-modality handles", async () => {
    const node: AigcV2Node = {
      id: "image",
      type: "image",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        asset_id: "asset-image",
        bbox: null,
        bbox_asset_id: null,
        title: null
      }
    };
    const definition: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [node],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    renderNode(node, definition);

    expect(screen.queryByTestId("aigc-modality-mode")).toBeNull();
    expect(screen.getByLabelText("图片输入")).toHaveAttribute(
      "data-connectable",
      "true"
    );
    expect(screen.getByLabelText("图片输出")).toHaveAttribute(
      "data-connectable",
      "true"
    );
    expect(await screen.findByAltText("本地图片.png")).toHaveClass(
      "object-contain"
    );
  });

  it("keeps a local image preview on the asset proxy while a run is active", async () => {
    const node: AigcV2Node = {
      id: "image",
      type: "image",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        asset_id: "asset-image",
        bbox: null,
        bbox_asset_id: null,
        title: null
      }
    };
    const definition: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [node],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const detail = runDetail(definition, node.id, {
      kind: "assets",
      text: null,
      text_digest: null,
      assets: [
        {
          asset_id: "asset-image",
          ordinal: 0,
          mime_type: "image/png",
          download_url: "https://object-storage.example/asset-image.png",
          available: true,
          metadata: { name: "本地图片.png" }
        }
      ]
    });
    detail.run.status = "running";
    detail.run.finished_at = null;

    renderNode(node, definition, detail);

    expect(await screen.findByAltText("图片节点")).toHaveAttribute(
      "src",
      "http://localhost:8000/api/assets/asset-image/content"
    );
  });

  it("summarizes a multi-track project and links to its full-screen route", () => {
    const node: AigcV2Node = {
      id: "edit-node",
      type: "multi_track_edit",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
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
            elements: [
              {
                id: "clip-1",
                type: "video",
                source: {
                  source_node_id: "source-video",
                  source_handle: "video"
                },
                target_time: { start_ms: 0, end_ms: 5_000 },
                source_trim: null,
                loop: false,
                transform: {
                  x: 0,
                  y: 0,
                  width: 1920,
                  height: 1080,
                  rotation: 0
                },
                speed: 1,
                volume: 1,
                fade_in_ms: 0,
                fade_out_ms: 0,
                transition: null
              }
            ]
          },
          {
            id: "audio-track",
            name: "音频",
            type: "audio",
            order: 1,
            hidden: false,
            muted: false,
            elements: []
          }
        ]
      }
    };
    const source: AigcV2Node = {
      id: "source-video",
      type: "video",
      position: { x: -300, y: 0 },
      size: { width: 240, height: 160 },
      config: { asset_id: null, title: null }
    };
    const definition: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [source, node],
      edges: [
        {
          id: "source-to-edit",
          sourceNodeId: source.id,
          sourceHandle: "video",
          targetNodeId: node.id,
          targetHandle: "videos"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };

    renderNode(node, definition);

    expect(screen.getByText("2 轨道")).toBeInTheDocument();
    expect(screen.getByText("1 元素")).toBeInTheDocument();
    expect(screen.getByText("00:05")).toBeInTheDocument();
    expect(screen.getByText("1920 × 1080")).toBeInTheDocument();
    expect(screen.getByText("30 FPS")).toBeInTheDocument();
    expect(screen.getByText("已保存")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "编辑时间线" })).toHaveAttribute(
      "href",
      "/workspace/aigc/pipelines/pipeline-1/nodes/edit-node/timeline"
    );
  });

  it("plays, expands, and downloads a multi-track result and disables unavailable output", () => {
    const node: AigcV2Node = {
      id: "edit-node",
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
    };
    const definition: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [node],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const available = runDetail(definition, node.id, {
      kind: "assets",
      text: null,
      text_digest: null,
      assets: [
        {
          asset_id: "multi-track-output",
          ordinal: 0,
          mime_type: "video/mp4",
          download_url: "/api/assets/multi-track-output/content",
          available: true,
          metadata: {
            operation: "multi_track_edit",
            track_count: 4,
            element_count: 12,
            duration_ms: 12_500,
            width: 1920,
            height: 1080,
            fps: 30
          }
        }
      ]
    });
    const { rerenderRun } = renderNode(node, definition, available);

    expect(
      screen.getByLabelText("播放视频：多轨剪辑成片")
    ).toHaveClass("object-contain");
    expect(
      screen.queryByRole("button", { name: "全屏播放：多轨剪辑成片" })
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "下载视频：多轨剪辑成片" })
    ).toHaveAttribute("download", "多轨剪辑成片.mp4");
    expect(screen.getByText("4 轨道")).toBeInTheDocument();
    expect(screen.getByText("12 元素")).toBeInTheDocument();
    expect(screen.getByText("00:13")).toBeInTheDocument();

    rerenderRun(
      runDetail(
        definition,
        node.id,
        {
          kind: "unavailable",
          text: null,
          text_digest: null,
          assets: [
            {
              asset_id: "multi-track-output",
              ordinal: 0,
              mime_type: "video/mp4",
              download_url: null,
              available: false,
              metadata: {
                operation: "multi_track_edit",
                track_count: 4,
                element_count: 12
              }
            }
          ]
        },
        "succeeded"
      )
    );
    expect(screen.getByText("多轨成片已不可用")).toBeInTheDocument();
    expect(screen.queryByLabelText(/播放视频：多轨剪辑成片/)).toBeNull();
    expect(
      screen.queryByRole("link", { name: "下载视频：多轨剪辑成片" })
    ).toBeNull();
  });

  it("keeps the selected run frozen and restores local text after leaving it", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const node: AigcV2Node = {
      id: "text",
      type: "text",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        text: "本地备用文案",
        bbox_references: [],
        title: "投放文案"
      }
    };
    const definition: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [
        {
          id: "llm",
          type: "llm",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: {
            model: "doubao-seed-evolving",
            system_prompt: "",
            temperature: 0.7
          }
        },
        node
      ],
      edges: [
        {
          id: "upstream-text",
          sourceNodeId: "llm",
          sourceHandle: "text",
          targetNodeId: node.id,
          targetHandle: "text"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const detail = runDetail(definition, node.id, {
      kind: "text",
      text: "Run 上游文案",
      text_digest: "digest",
      assets: []
    });
    const { rerenderRun, store } = renderNode(node, definition, detail);

    expect(screen.queryByTestId("aigc-modality-mode")).toBeNull();
    expect(screen.getByText("Run 上游文案")).toBeInTheDocument();
    expect(screen.queryByText("本地备用文案")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "复制文本：投放文案" }));
    expect(writeText).toHaveBeenCalledWith("Run 上游文案");

    act(() => store.getState().removeEdge("upstream-text"));
    expect(screen.getByText("本地备用文案")).toBeInTheDocument();

    rerenderRun(null);
    expect(screen.queryByTestId("aigc-modality-mode")).toBeNull();
    expect(screen.getByText("本地备用文案")).toBeInTheDocument();
  });

  it("renders upstream image, video, and audio with title-based downloads", () => {
    const cases = [
      {
        asset: {
          asset_id: "image-result",
          ordinal: 0,
          mime_type: "image/png",
          download_url: "/api/assets/image-result/content",
          available: true,
          metadata: {}
        },
        label: "下载图片：海报成片",
        node: {
          id: "result",
          type: "image",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 160 },
          config: {
            asset_id: "local-image",
            bbox: null,
            bbox_asset_id: null,
            title: "海报成片"
          }
        } satisfies AigcV2Node,
        expectedFilename: "海报成片.png"
      },
      {
        asset: {
          asset_id: "video-result",
          ordinal: 0,
          mime_type: "video/mp4",
          download_url: "/api/assets/video-result/content",
          available: true,
          metadata: { duration_seconds: 6.5 }
        },
        label: "下载视频：视频成片",
        node: {
          id: "result",
          type: "video",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: "local-video", title: "视频成片" }
        } satisfies AigcV2Node,
        expectedFilename: "视频成片.mp4"
      },
      {
        asset: {
          asset_id: "audio-result",
          ordinal: 0,
          mime_type: "audio/wav",
          download_url: "/api/assets/audio-result/content",
          available: true,
          metadata: { duration_seconds: 8 }
        },
        label: "下载音频：旁白成片",
        node: {
          id: "result",
          type: "audio",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: "local-audio", title: "旁白成片" }
        } satisfies AigcV2Node,
        expectedFilename: "旁白成片-1.wav"
      }
    ] as const;

    for (const testCase of cases) {
      const definition: AigcPipelineDefinitionV2 = {
        schemaVersion: 2,
        nodes: [testCase.node],
        edges: [
          {
            id: `edge-${testCase.node.type}`,
            sourceNodeId: "producer",
            sourceHandle: testCase.node.type,
            targetNodeId: testCase.node.id,
            targetHandle: testCase.node.type
          }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      };
      const detail = runDetail(definition, testCase.node.id, {
        kind: "assets",
        text: null,
        text_digest: null,
        assets: [testCase.asset]
      });
      const view = renderNode(testCase.node, definition, detail);

      const download = screen.queryByRole("link", { name: testCase.label });
      if (testCase.node.type === "audio") {
        expect(download).toHaveAttribute("download", testCase.expectedFilename);
      } else {
        expect(download).toBeNull();
      }
      if (testCase.node.type === "image") {
        expect(screen.getByAltText("海报成片")).toHaveClass("object-contain");
      }
      if (testCase.node.type === "video") {
        expect(screen.getByLabelText("播放视频：视频成片")).toHaveClass(
          "object-contain"
        );
      }
      if (testCase.node.type === "audio") {
        expect(screen.getByLabelText("播放音频：旁白成片")).toBeInTheDocument();
        expect(screen.getByLabelText("音频信息：旁白成片")).toHaveTextContent(
          "8s · audio/wav"
        );
      }
      view.unmount();
    }
  });

  it("opens precise editing with the current upstream image result", () => {
    const producer: AigcV2Node = {
      id: "producer",
      type: "text_to_image",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    };
    const node: AigcV2Node = {
      id: "result",
      type: "image",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        asset_id: "local-backup",
        bbox: null,
        bbox_asset_id: null,
        title: "海报成片",
        upstream_bbox: {
          type: "bbox",
          x1: 100,
          y1: 200,
          x2: 700,
          y2: 800
        },
        upstream_bbox_asset_id: "previous-upstream-image"
      }
    };
    const definition: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [producer, node],
      edges: [
        {
          id: "producer-result",
          sourceNodeId: producer.id,
          sourceHandle: "image",
          targetNodeId: node.id,
          targetHandle: "image"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const detail = runDetail(definition, node.id, {
      kind: "assets",
      text: null,
      text_digest: null,
      assets: [
        {
          asset_id: "upstream-image",
          ordinal: 0,
          mime_type: "image/png",
          download_url: "/api/assets/upstream-image/content",
          available: true,
          metadata: { name: "上游海报.png" }
        }
      ]
    });

    renderNode(node, definition, detail);
    fireEvent.click(
      screen.getByRole("button", { name: "精准编辑：上游海报.png" })
    );

    expect(
      screen.getByRole("heading", { name: "精准编辑 · 上游海报.png" })
    ).toBeInTheDocument();
    expect(screen.getByAltText("精准编辑：上游海报.png")).toHaveAttribute(
      "src",
      "http://localhost:8000/api/assets/upstream-image/content"
    );
    expect(
      screen.getByText("上游图片已更新，请重新框选")
    ).toBeInTheDocument();
    expect(screen.queryByText("local-backup")).toBeNull();
  });

  it("rejects a bbox submission when the upstream asset changes while open", () => {
    const producer: AigcV2Node = {
      id: "producer",
      type: "text_to_image",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    };
    const node: AigcV2Node = {
      id: "result",
      type: "image",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        asset_id: "local-backup",
        bbox: null,
        bbox_asset_id: null,
        title: "海报成片",
        upstream_bbox: {
          type: "bbox",
          x1: 100,
          y1: 200,
          x2: 700,
          y2: 800
        },
        upstream_bbox_asset_id: "upstream-image"
      }
    };
    const definition: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [producer, node],
      edges: [
        {
          id: "producer-result",
          sourceNodeId: producer.id,
          sourceHandle: "image",
          targetNodeId: node.id,
          targetHandle: "image"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const result = (assetId: string) =>
      runDetail(definition, node.id, {
        kind: "assets",
        text: null,
        text_digest: null,
        assets: [
          {
            asset_id: assetId,
            ordinal: 0,
            mime_type: "image/png",
            download_url: `/api/assets/${assetId}/content`,
            available: true,
            metadata: { name: "上游海报.png" }
          }
        ]
      });
    const { rerenderRun, store } = renderNode(
      node,
      definition,
      result("upstream-image")
    );

    fireEvent.click(
      screen.getByRole("button", { name: "精准编辑：上游海报.png" })
    );
    rerenderRun(result("new-upstream-image"));
    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    fireEvent.click(screen.getByRole("button", { name: "清除框选" }));

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent("上游图片已更新，请重新框选");
    const image = store.getState().definition.nodes.find(
      (candidate) => candidate.id === node.id
    );
    expect(image?.type).toBe("image");
    if (image?.type !== "image") throw new Error("expected image node");
    expect(image.config.upstream_bbox_asset_id).toBe("upstream-image");
  });

  it.each([
    ["running", "等待上游视频结果"],
    ["failed", "上游视频生成失败"],
    ["succeeded", "上游视频结果不可用"]
  ] as const)("shows %s upstream state without falling back locally", (status, copy) => {
    const node: AigcV2Node = {
      id: "video",
      type: "video",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: { asset_id: "local-video", title: null }
    };
    const definition: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [node],
      edges: [
        {
          id: "edge-video",
          sourceNodeId: "producer",
          sourceHandle: "video",
          targetNodeId: node.id,
          targetHandle: "video"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    renderNode(
      node,
      definition,
      runDetail(
        definition,
        node.id,
        status === "succeeded"
          ? {
              kind: "unavailable",
              text: null,
              text_digest: null,
              assets: []
            }
          : { kind: "none", text: null, text_digest: null, assets: [] },
        status
      )
    );

    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(screen.queryByLabelText("播放视频：视频节点")).toBeNull();
  });

  it("renders parser status, structured item count, error copy, and a locked items handle", () => {
    const node: AigcV2Node = {
      id: "parser",
      type: "json_parser",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { json_path: "$.items" }
    };
    const definition: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [node],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const result = {
      kind: "text_items" as const,
      text: null,
      text_digest: null,
      items: [
        { index: 0, text: "一", summary: "first" },
        { index: 1, text: "二", summary: "second" }
      ],
      assets: []
    };
    const { rerenderRun } = renderNode(
      node,
      definition,
      runDetail(definition, node.id, result)
    );

    expect(screen.getByText("$.items")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText("2 项")).toBeInTheDocument();
    expect(screen.getByLabelText("文本项输出，仅系统可连接")).toHaveAttribute(
      "data-connectable",
      "false"
    );

    rerenderRun(
      runDetail(
        definition,
        node.id,
        { ...result, kind: "none", items: undefined },
        "failed",
        {
          code: "json_parser_invalid_json",
          message: "invalid JSON",
          request_id: null,
          stage: "validate"
        }
      )
    );
    expect(screen.getByText("失败")).toBeInTheDocument();
    expect(screen.getByText("json_parser_invalid_json")).toBeInTheDocument();
    expect(
      screen.getByText(
        "上游内容不是有效 JSON，请只传入纯 JSON 或单个 JSON 代码块。"
      )
    ).toBeInTheDocument();
  });

  it("renders managed text as a read-only JSON item with parser provenance", () => {
    const parser: AigcV2Node = {
      id: "parser",
      type: "json_parser",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { json_path: "$.items" }
    };
    const longText = "长文本内容".repeat(80);
    const node: AigcV2Node = {
      id: "managed-text",
      type: "text",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        text: longText,
        bbox_references: [],
        title: "JSON 项 1",
        generated_by_parser_node_id: parser.id,
        generated_item_index: 0,
        generated_from_run_id: "run-1"
      }
    };
    const definition: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [parser, node],
      edges: [
        {
          id: "system-item",
          sourceNodeId: parser.id,
          sourceHandle: "items",
          targetNodeId: node.id,
          targetHandle: "text"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };

    renderNode(node, definition);

    expect(screen.getByTestId("aigc-node-title")).toHaveTextContent("JSON 项 1");
    expect(screen.getByText("来源：JSON 解析器")).toBeInTheDocument();
    expect(screen.getByText(longText)).toHaveClass("break-words");
    expect(screen.getByText("只读上游内容")).toBeInTheDocument();
  });
});
