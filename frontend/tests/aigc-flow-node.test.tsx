import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AigcFlowNodeCard,
  type AigcFlowNode
} from "@/components/workspace/aigc/aigc-flow-node";
import {
  AigcLayerPreviewRunProvider,
  AigcRunActionsProvider,
  AigcRunProvider
} from "@/components/workspace/aigc/aigc-run-context";
import { AigcEditorStoreProvider } from "@/components/workspace/aigc/providers/aigc-editor-store-provider";
import { AigcQueryProvider } from "@/components/workspace/aigc/providers/aigc-query-provider";
import {
  createAigcEditorStore,
  type AigcEditorStore
} from "@/lib/aigc/editor-store";
import type {
  AigcNode,
  AigcPipelineRunDetail
} from "@/lib/aigc/types";
import type { Asset } from "@/lib/api-types";

const apiMocks = vi.hoisted(() => ({
  getAigcInternalRunAsset: vi.fn(),
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
      type,
      title
    }: {
      "aria-label"?: string;
      id?: string;
      isConnectable?: boolean;
      style?: CSSProperties;
      type?: string;
      title?: string;
    }) => (
      <span
        aria-label={ariaLabel}
        data-connectable={String(isConnectable)}
        data-handle-id={id}
        data-handle-type={type}
        style={style}
        title={title}
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
      getAigcInternalRunAsset: apiMocks.getAigcInternalRunAsset,
      getAsset: apiMocks.getAsset
    }
  };
});

function nodeProps(
  node: AigcNode,
  selected = false
): NodeProps<AigcFlowNode> {
  return {
    data: { node },
    dragging: false,
    id: node.id,
    isConnectable: true,
    positionAbsoluteX: node.position.x,
    positionAbsoluteY: node.position.y,
    selected,
    type: node.type,
    zIndex: 0
  } as NodeProps<AigcFlowNode>;
}

let store: AigcEditorStore;

function renderNode(
  node: AigcNode,
  runDetail: AigcPipelineRunDetail | null = null,
  selected = false,
  runActions: {
    continueFromNode: (nodeId: string) => void;
    pending: boolean;
  } | null = null,
  layerPreviewRun: AigcPipelineRunDetail | null = null
) {
  return render(
    nodeView(node, runDetail, selected, runActions, layerPreviewRun)
  );
}

function nodeView(
  node: AigcNode,
  runDetail: AigcPipelineRunDetail | null = null,
  selected = false,
  runActions: {
    continueFromNode: (nodeId: string) => void;
    pending: boolean;
  } | null = null,
  layerPreviewRun: AigcPipelineRunDetail | null = null
) {
  return (
    <AigcQueryProvider>
      <AigcEditorStoreProvider store={store}>
        <AigcRunActionsProvider value={runActions}>
          <AigcRunProvider value={runDetail}>
            <AigcLayerPreviewRunProvider value={layerPreviewRun}>
              <AigcFlowNodeCard {...nodeProps(node, selected)} />
            </AigcLayerPreviewRunProvider>
          </AigcRunProvider>
        </AigcRunActionsProvider>
      </AigcEditorStoreProvider>
    </AigcQueryProvider>
  );
}

describe("AIGC image nodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getAigcInternalRunAsset.mockImplementation(
      (_pipelineId: string, _runId: string, id: string) =>
        Promise.resolve({
          id,
          project_id: null,
          type: "generated_image",
          stage: "image",
          category: null,
          asset_role: id.includes("base") ? "internal_base" : "internal_layer",
          status: "succeeded",
          object_key: `${id}.png`,
          url: `https://assets.local/${id}.png`,
          mime_type: "image/png",
          size_bytes: 100,
          source_task_id: null,
          metadata: {},
          created_at: "2026-08-30T10:00:00Z",
          updated_at: "2026-08-30T10:00:00Z"
        })
    );
    store = createAigcEditorStore({
      definition: {
        schemaVersion: 1,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "测试画布",
      revision: 1
    });
  });

  it("applies each modality color to input card borders, headers, and icons", () => {
    const cases: Array<{
      label: string;
      node: AigcNode;
      token: string;
    }> = [
      {
        label: "文本输入",
        node: {
          id: "input-text",
          type: "text_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { text: "产品描述", bbox_references: [] }
        },
        token: "text"
      },
      {
        label: "图片输入",
        node: {
          id: "input-image",
          type: "image_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: null }
        },
        token: "image"
      },
      {
        label: "视频输入",
        node: {
          id: "input-video",
          type: "video_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: null }
        },
        token: "video"
      },
      {
        label: "音频输入",
        node: {
          id: "input-audio",
          type: "audio_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: null }
        },
        token: "audio"
      }
    ];

    for (const { label, node, token } of cases) {
      const { container, unmount } = renderNode(node);
      const card = container.firstElementChild as HTMLElement;
      const title = screen.getByText(label);
      const header = title.parentElement?.parentElement as HTMLElement;
      const icon = title.previousElementSibling as HTMLElement;

      expect(card).toHaveStyle({
        borderColor: `var(--aigc-modality-${token}-border)`
      });
      expect(header).toHaveStyle({
        backgroundColor: `var(--aigc-modality-${token}-light)`,
        borderBottomColor: `var(--aigc-modality-${token}-border)`
      });
      expect(icon).toHaveStyle({
        color: `var(--aigc-modality-${token})`
      });

      unmount();
    }
  });

  it("keeps model and output cards on their existing neutral category styles", () => {
    const cases: Array<{
      categoryClasses: string[];
      label: string;
      node: AigcNode;
    }> = [
      {
        categoryClasses: ["border-primary/25", "bg-primary/[0.07]"],
        label: "图生图",
        node: {
          id: "image-model",
          type: "image_to_image",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            aspect_ratio: "1:1",
            size: "2K",
            format: "png"
          }
        }
      },
      {
        categoryClasses: ["border-success/25", "bg-success/[0.08]"],
        label: "文本输出",
        node: {
          id: "text-output",
          type: "text_output",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { title: "文案结果" }
        }
      }
    ];

    for (const { categoryClasses, label, node } of cases) {
      const { container, unmount } = renderNode(node);
      const card = container.firstElementChild as HTMLElement;
      const title = screen.getByText(label);
      const header = title.parentElement?.parentElement as HTMLElement;
      const icon = title.previousElementSibling as HTMLElement;

      expect(card).toHaveClass("border-border");
      expect(card.style.borderColor).toBe("");
      expect(header).toHaveClass(...categoryClasses);
      expect(header.style.backgroundColor).toBe("");
      expect(icon.style.color).toBe("");

      unmount();
    }
  });

  it("preserves the modality border, primary selection ring, and dimensions", () => {
    const node: AigcNode = {
      id: "selected-text",
      type: "text_input",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { text: "选中节点", bbox_references: [] }
    };
    const { container } = renderNode(node, null, true);
    const card = container.firstElementChild as HTMLElement;
    const title = screen.getByText("文本输入");
    const header = title.parentElement?.parentElement as HTMLElement;

    expect(card).toHaveClass(
      "h-full",
      "w-full",
      "rounded-md",
      "border",
      "ring-2",
      "ring-primary/20"
    );
    expect(card).not.toHaveClass("border-primary");
    expect(card).toHaveStyle({
      borderColor: "var(--aigc-modality-text-border)"
    });
    expect(header).toHaveClass("h-9", "shrink-0", "px-2.5");
  });

  it("shows an input image without cropping and opens the original preview", async () => {
    apiMocks.getAsset.mockResolvedValue({
      id: "asset-1",
      metadata: { name: "产品横图.png" },
      mime_type: "image/png",
      status: "succeeded",
      type: "uploaded_image",
      url: "https://example.com/input.png"
    } as unknown as Asset);
    renderNode({
      id: "input-image",
      type: "image_input",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { asset_id: "asset-1" }
    });

    const image = await screen.findByAltText("产品横图.png");
    expect(image).toHaveClass(
      "absolute",
      "inset-0",
      "h-full",
      "w-full",
      "object-contain"
    );
    Object.defineProperty(image, "naturalWidth", { value: 1920 });
    Object.defineProperty(image, "naturalHeight", { value: 1080 });
    fireEvent.load(image);

    expect(screen.getByText("1920 × 1080")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看原图：产品横图.png" }));
    expect(screen.getByRole("heading", { name: "查看原图" })).toBeInTheDocument();
    expect(screen.getByAltText("产品横图.png 原图预览")).toHaveClass(
      "object-contain"
    );
  });

  it("opens precise editing and only enables strictly related text targets", async () => {
    const imageNode: AigcNode = {
      id: "input-image",
      type: "image_input",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { asset_id: "asset-1", bbox: null, bbox_asset_id: null }
    };
    const promptNode: AigcNode = {
      id: "prompt",
      type: "text_input",
      position: { x: 0, y: 200 },
      size: { width: 240, height: 160 },
      config: { text: "替换包装", bbox_references: [] }
    };
    const detachedPrompt: AigcNode = {
      id: "detached-prompt",
      type: "text_input",
      position: { x: 0, y: 400 },
      size: { width: 240, height: 160 },
      config: { text: "背景描述", bbox_references: [] }
    };
    const modelNode: AigcNode = {
      id: "model",
      type: "image_to_image",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    };
    store.getState().initialize({
      definition: {
        schemaVersion: 1,
        nodes: [imageNode, promptNode, detachedPrompt, modelNode],
        edges: [
          {
            id: "image-edge",
            sourceNodeId: imageNode.id,
            sourceHandle: "image",
            targetNodeId: modelNode.id,
            targetHandle: "image"
          },
          {
            id: "prompt-edge",
            sourceNodeId: promptNode.id,
            sourceHandle: "text",
            targetNodeId: modelNode.id,
            targetHandle: "prompt"
          }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "精准编辑",
      revision: 1
    });
    apiMocks.getAsset.mockResolvedValue({
      id: "asset-1",
      metadata: { name: "产品图.png" },
      mime_type: "image/png",
      status: "succeeded",
      type: "uploaded_image",
      url: "https://example.com/input.png"
    } as unknown as Asset);
    renderNode(imageNode);

    fireEvent.click(await screen.findByRole("button", { name: "精准编辑：产品图.png" }));

    expect(
      screen.getByRole("heading", { name: "精准编辑 · 产品图.png" })
    ).toBeInTheDocument();
    expect(screen.getByAltText("精准编辑：产品图.png")).toHaveClass(
      "absolute",
      "inset-0",
      "h-full",
      "w-full",
      "object-contain"
    );
    expect(screen.getByRole("checkbox", { name: /替换包装/ })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: /背景描述/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "清除框选" })).toBeDisabled();
  });

  it("shows the latest output image and its intrinsic resolution", () => {
    const node: AigcNode = {
      id: "output-image",
      type: "image_output",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { title: "生成结果" }
    };
    const runDetail = {
      nodes: [
        {
          node_id: node.id,
          result: {
            kind: "assets",
            text: null,
            text_digest: null,
            assets: [
              {
                asset_id: "result-1",
                ordinal: 0,
                mime_type: "image/png",
                download_url: "https://example.com/output.png",
                available: true
              }
            ]
          },
          status: "succeeded"
        }
      ]
    } as AigcPipelineRunDetail;
    renderNode(node, runDetail);

    const image = screen.getByAltText("生成结果");
    Object.defineProperty(image, "naturalWidth", { value: 1024 });
    Object.defineProperty(image, "naturalHeight", { value: 1536 });
    fireEvent.load(image);

    expect(image).toHaveClass("object-contain");
    expect(screen.getByText("1024 × 1536")).toBeInTheDocument();
    const download = screen.getByRole("link", {
      name: "下载图片：生成结果"
    });
    expect(download).toHaveAttribute(
      "href",
      "http://localhost:8000/api/assets/result-1/content?download=1&filename=%E7%94%9F%E6%88%90%E7%BB%93%E6%9E%9C-1.png"
    );
    expect(download).toHaveAttribute("download", "生成结果-1.png");
  });

  it("plays a projected video output with specs and controlled download", () => {
    const generationNode: AigcNode = {
      id: "video-model",
      type: "video_generation",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        model: "doubao-seedance-2-5-260628",
        generation_mode: "text_to_video",
        resolution: "720p",
        aspect_ratio: "16:9",
        duration_seconds: 8,
        generate_audio: false
      }
    };
    const node: AigcNode = {
      id: "video-output",
      type: "video_output",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 180 },
      config: { title: "最终/成片" }
    };
    const runDetail = {
      run: {
        id: "run-video",
        definition_snapshot: {
          schemaVersion: 1,
          nodes: [generationNode, node],
          edges: [
            {
              id: "video-output-edge",
              sourceNodeId: generationNode.id,
              sourceHandle: "video",
              targetNodeId: node.id,
              targetHandle: "video"
            }
          ],
          viewport: { x: 0, y: 0, zoom: 1 }
        }
      },
      nodes: [
        {
          node_id: node.id,
          result: {
            kind: "assets",
            text: null,
            text_digest: null,
            assets: [
              {
                asset_id: "video-result",
                ordinal: 1,
                mime_type: "video/mp4",
                download_url: "/api/assets/video-result/content",
                available: true
              }
            ]
          },
          status: "succeeded"
        }
      ]
    } as AigcPipelineRunDetail;
    renderNode(node, runDetail);

    const video = screen.getByLabelText("播放视频：最终/成片");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveClass("h-full", "w-full", "object-contain");
    expect(video.parentElement).toHaveClass("nodrag", "nopan", "nowheel");
    expect(screen.getByText(/720p · 8s · 无音频 · video\/mp4 · 可用/)).toBeInTheDocument();

    Object.defineProperty(video, "videoWidth", { value: 1280 });
    Object.defineProperty(video, "videoHeight", { value: 720 });
    Object.defineProperty(video, "duration", { value: 8.4 });
    fireEvent.loadedMetadata(video);
    expect(
      screen.getByText(/1280 × 720 · 8.4s · 无音频 · video\/mp4 · 可用/)
    ).toBeInTheDocument();

    const download = screen.getByRole("link", {
      name: "下载视频：最终/成片"
    });
    expect(download).toHaveAttribute("download", "最终-成片-2.mp4");
    expect(download).toHaveAttribute(
      "href",
      "http://localhost:8000/api/assets/video-result/content?download=1&filename=%E6%9C%80%E7%BB%88-%E6%88%90%E7%89%87-2.mp4"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "放大预览：最终/成片" })
    );
    const preview = screen.getByLabelText("最终/成片 放大预览");
    expect(preview).toHaveAttribute("controls");
    expect(preview).toHaveAttribute("autoplay");
    expect(preview).toHaveClass("object-contain");
  });

  it("disables video playback and download for an unavailable result", () => {
    const node: AigcNode = {
      id: "video-output",
      type: "video_output",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 180 },
      config: { title: "历史成片" }
    };
    renderNode(node, {
      run: {
        id: "run-unavailable",
        definition_snapshot: {
          schemaVersion: 1,
          nodes: [node],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 }
        }
      },
      nodes: [
        {
          node_id: node.id,
          result: {
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
          },
          status: "succeeded"
        }
      ]
    } as unknown as AigcPipelineRunDetail);

    expect(
      screen.getByText("历史视频结果已不可用，资产可能已删除或无权访问")
    ).toBeInTheDocument();
    expect(screen.getByText("播放和下载已禁用")).toBeInTheDocument();
    expect(screen.queryByLabelText(/播放视频/)).toBeNull();
    expect(screen.queryByRole("link", { name: /下载视频/ })).toBeNull();
  });

  it("shows the image reference count and marks a full input accessibly", () => {
    const node: AigcNode = {
      id: "image-model",
      type: "image_to_image",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        aspect_ratio: "16:9",
        size: "2K",
        format: "png"
      }
    };
    const sourceNodes = Array.from({ length: 10 }, (_, index) => ({
      id: `image-${index + 1}`,
      type: "image_input" as const,
      position: { x: 0, y: index * 40 },
      size: { width: 240, height: 160 },
      config: { asset_id: `asset-${index + 1}` }
    }));
    const edges = sourceNodes.map((source, index) => ({
      id: `edge-${index + 1}`,
      sourceNodeId: source.id,
      sourceHandle: "image",
      targetNodeId: node.id,
      targetHandle: "image"
    }));
    store.getState().initialize({
      definition: {
        schemaVersion: 1,
        nodes: [...sourceNodes, node],
        edges: edges.slice(0, 3),
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "测试画布",
      revision: 1
    });
    renderNode(node);

    expect(screen.getByText("参考图 3/10")).toBeInTheDocument();
    expect(
      screen.getByText("图生图 · doubao-seedream-5-0-pro-260628 · 2K")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("图片输入")).toHaveAttribute(
      "title",
      "图片输入"
    );

    act(() => {
      store.getState().initialize({
        definition: {
          schemaVersion: 1,
          nodes: [...sourceNodes, node],
          edges,
          viewport: { x: 0, y: 0, zoom: 1 }
        },
        description: "",
        entityId: "pipeline-1",
        mode: "pipeline",
        name: "测试画布",
        revision: 1
      });
    });

    expect(screen.getByText("参考图 10/10")).toBeInTheDocument();
    expect(
      screen.getByLabelText("图片输入，已达到 10 张上限")
    ).toHaveAttribute("title", "图片输入已满，最多支持 10 张参考图");
  });

  it("plays video inputs without cropping and opens an enlarged preview", async () => {
    apiMocks.getAsset.mockResolvedValue({
      id: "video-1",
      asset_role: "public",
      metadata: { name: "产品演示.mp4" },
      mime_type: "video/mp4",
      status: "succeeded",
      type: "uploaded_video",
      url: "https://example.com/input.mp4"
    } as unknown as Asset);
    renderNode({
      id: "input-video",
      type: "video_input",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 180 },
      config: { asset_id: "video-1" }
    });

    const video = await screen.findByLabelText("播放视频：产品演示.mp4");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveClass("h-full", "w-full", "object-contain");
    expect(video.parentElement).toHaveClass("nodrag", "nopan", "nowheel");
    Object.defineProperty(video, "videoWidth", { value: 1920 });
    Object.defineProperty(video, "videoHeight", { value: 1080 });
    Object.defineProperty(video, "duration", { value: 12.5 });
    fireEvent.loadedMetadata(video);

    expect(screen.getByText(/1920 × 1080 · 12.5s · video\/mp4/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "放大预览：产品演示.mp4" })
    );
    expect(screen.getByRole("heading", { name: "视频预览" })).toBeInTheDocument();
    const preview = screen.getByLabelText("产品演示.mp4 放大预览");
    expect(preview).toHaveAttribute("controls");
    expect(preview).toHaveAttribute("autoplay");
    expect(preview).toHaveClass("object-contain");
  });

  it("plays audio inputs and shows duration and MIME metadata", async () => {
    apiMocks.getAsset.mockResolvedValue({
      id: "audio-1",
      asset_role: "public",
      metadata: { name: "旁白.mp3" },
      mime_type: "audio/mpeg",
      status: "succeeded",
      type: "uploaded_audio",
      url: "https://example.com/voice.mp3"
    } as unknown as Asset);
    renderNode({
      id: "input-audio",
      type: "audio_input",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { asset_id: "audio-1" }
    });

    const audio = await screen.findByLabelText("播放音频：旁白.mp3");
    Object.defineProperty(audio, "duration", { value: 65.2 });
    fireEvent.loadedMetadata(audio);

    expect(screen.getByText("旁白.mp3")).toBeInTheDocument();
    expect(screen.getByText(/1:05.2 · audio\/mpeg/)).toBeInTheDocument();
  });

  it("keeps an incompatible media reference visible as unavailable", async () => {
    apiMocks.getAsset.mockResolvedValue({
      id: "wrong-type",
      asset_role: "public",
      metadata: { name: "错误图片.png" },
      mime_type: "image/png",
      status: "succeeded",
      type: "uploaded_image",
      url: "https://example.com/image.png"
    } as unknown as Asset);
    renderNode({
      id: "input-video",
      type: "video_input",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { asset_id: "wrong-type" }
    });

    expect(await screen.findByText("资产不可用，请替换")).toBeInTheDocument();
    expect(screen.queryByLabelText(/播放视频/)).not.toBeInTheDocument();
  });

  it("renders mode-specific video handles and model-specific reference counts", () => {
    const node: AigcNode = {
      id: "video-model",
      type: "video_generation",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        model: "doubao-seedance-2-0-mini-260615",
        generation_mode: "multimodal_reference",
        resolution: "720p",
        aspect_ratio: "adaptive",
        duration_seconds: -1,
        generate_audio: true
      }
    };
    store.getState().initialize({
      definition: {
        schemaVersion: 1,
        nodes: [node],
        edges: [
          {
            id: "image-edge",
            sourceNodeId: "image",
            sourceHandle: "image",
            targetNodeId: node.id,
            targetHandle: "reference_images"
          },
          {
            id: "video-edge",
            sourceNodeId: "video",
            sourceHandle: "video",
            targetNodeId: node.id,
            targetHandle: "reference_videos"
          },
          {
            id: "audio-edge",
            sourceNodeId: "audio",
            sourceHandle: "audio",
            targetNodeId: node.id,
            targetHandle: "reference_audios"
          }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "视频画布",
      revision: 1
    });
    renderNode(node);

    expect(screen.getByText(/图片 1\/9/)).toBeInTheDocument();
    expect(screen.getByText(/视频 1\/3/)).toBeInTheDocument();
    expect(screen.getByText(/音频 1\/3/)).toBeInTheDocument();
    expect(screen.getByLabelText("参考图片输入")).toBeInTheDocument();
    expect(screen.getByLabelText("参考视频输入")).toBeInTheDocument();
    expect(screen.getByLabelText("参考音频输入")).toBeInTheDocument();
    expect(screen.getByLabelText("提示词输入")).toHaveStyle({
      backgroundColor: "var(--aigc-modality-text)"
    });
    expect(screen.getByLabelText("参考图片输入")).toHaveStyle({
      backgroundColor: "var(--aigc-modality-image)"
    });
    expect(screen.getByLabelText("参考视频输入")).toHaveStyle({
      backgroundColor: "var(--aigc-modality-video)"
    });
    expect(screen.getByLabelText("参考音频输入")).toHaveStyle({
      backgroundColor: "var(--aigc-modality-audio)"
    });
    expect(screen.getByLabelText("视频输出")).toHaveStyle({
      backgroundColor: "var(--aigc-modality-video)"
    });
    expect(screen.queryByLabelText("首帧输入")).toBeNull();
    expect(screen.queryByLabelText("尾帧输入")).toBeNull();
  });

  it("colors first and last frame handles as images", () => {
    renderNode({
      id: "video-model",
      type: "video_generation",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        model: "doubao-seedance-2-5-260628",
        generation_mode: "first_last_frame",
        resolution: "720p",
        aspect_ratio: "adaptive",
        duration_seconds: -1,
        generate_audio: true
      }
    });

    for (const label of ["首帧输入", "尾帧输入"]) {
      expect(screen.getByLabelText(label)).toHaveStyle({
        backgroundColor: "var(--aigc-modality-image)"
      });
    }
    expect(screen.getByLabelText("提示词输入")).toHaveStyle({
      backgroundColor: "var(--aigc-modality-text)"
    });
  });

  it("uses port types for image generation, LLM, and output handles", () => {
    const nodes: Array<{
      node: AigcNode;
      handles: Array<[string, string, string]>;
    }> = [
      {
        node: {
          id: "text-to-image",
          type: "text_to_image",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            aspect_ratio: "1:1",
            size: "2K",
            format: "png"
          }
        },
        handles: [
          ["提示词输入", "target", "var(--aigc-modality-text)"],
          ["图片输出", "source", "var(--aigc-modality-image)"]
        ]
      },
      {
        node: {
          id: "image-to-image",
          type: "image_to_image",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            aspect_ratio: "1:1",
            size: "2K",
            format: "png"
          }
        },
        handles: [
          ["图片输入", "target", "var(--aigc-modality-image)"],
          ["提示词输入", "target", "var(--aigc-modality-text)"],
          ["图片输出", "source", "var(--aigc-modality-image)"]
        ]
      },
      {
        node: {
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
        handles: [
          ["提示词输入", "target", "var(--aigc-modality-text)"],
          ["文本输出", "source", "var(--aigc-modality-text)"]
        ]
      },
      {
        node: {
          id: "text-output",
          type: "text_output",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { title: "结果" }
        },
        handles: [
          ["文本输入", "target", "var(--aigc-modality-text)"]
        ]
      },
      {
        node: {
          id: "image-output",
          type: "image_output",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { title: "结果" }
        },
        handles: [
          ["图片输入", "target", "var(--aigc-modality-image)"]
        ]
      },
      {
        node: {
          id: "video-output",
          type: "video_output",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { title: "结果" }
        },
        handles: [
          ["视频输入", "target", "var(--aigc-modality-video)"]
        ]
      }
    ];

    for (const { node, handles } of nodes) {
      const view = renderNode(node);
      for (const [label, type, color] of handles) {
        const handle = screen.getByLabelText(label);
        expect(handle).toHaveAttribute("data-handle-type", type);
        expect(handle).toHaveStyle({ backgroundColor: color });
        expect(handle).toHaveAttribute("title", label);
      }
      view.unmount();
    }
  });

  it("keeps an incompatible connected handle visible and disables it", () => {
    const node: AigcNode = {
      id: "video-model",
      type: "video_generation",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        model: "doubao-seedance-2-5-260628",
        generation_mode: "text_to_video",
        resolution: "720p",
        aspect_ratio: "adaptive",
        duration_seconds: -1,
        generate_audio: true
      }
    };
    store.getState().initialize({
      definition: {
        schemaVersion: 1,
        nodes: [node],
        edges: [
          {
            id: "stale-first-frame",
            sourceNodeId: "image",
            sourceHandle: "image",
            targetNodeId: node.id,
            targetHandle: "first_frame"
          }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "视频画布",
      revision: 1
    });
    renderNode(node);

    const inactiveHandle = screen.getByLabelText(
      "首帧输入，与当前模式不兼容"
    );
    expect(inactiveHandle).toHaveAttribute("data-connectable", "false");
    expect(inactiveHandle).toHaveStyle({
      backgroundColor: "var(--aigc-modality-image)",
      opacity: "0.4"
    });
    expect(inactiveHandle).not.toHaveStyle({
      backgroundColor: "hsl(var(--destructive))"
    });
    expect(inactiveHandle).toHaveAttribute(
      "title",
      "首帧输入与当前模式不兼容，请断开连线"
    );
    expect(screen.queryByLabelText("尾帧输入")).toBeNull();
  });

  it("renders Seedream ports from the operation and edit target", () => {
    const node: AigcNode = {
      id: "seedream-edit",
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
    };
    store.getState().initialize({
      definition: {
        schemaVersion: 1,
        nodes: [node],
        edges: [
          {
            id: "selected-layer",
            sourceNodeId: "layer-canvas",
            sourceHandle: "selected_layer",
            targetNodeId: node.id,
            targetHandle: "edit_layer"
          },
          {
            id: "stale-image-output",
            sourceNodeId: node.id,
            sourceHandle: "image",
            targetNodeId: "image-output",
            targetHandle: "image"
          }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "图层编辑画布",
      revision: 1
    });
    renderNode(node);

    expect(screen.getByText("图片编辑")).toBeInTheDocument();
    expect(screen.queryByLabelText("图片输入")).toBeNull();
    expect(screen.queryByLabelText("编辑图片输入")).toBeNull();
    expect(
      screen.getByLabelText("编辑图层输入，已达到 1 个连接上限")
    ).toHaveStyle({
      backgroundColor: "var(--aigc-modality-image)"
    });
    expect(screen.getByLabelText("编辑图层输出")).toHaveAttribute(
      "data-connectable",
      "true"
    );
    expect(
      screen.getByLabelText("图片输出，与当前模式或编辑目标不兼容")
    ).toHaveAttribute("data-connectable", "false");
  });

  it("renders a layer canvas composite preview and blocks its entry while dirty", async () => {
    const digest = "a".repeat(64);
    const node: AigcNode = {
      id: "layer-canvas",
      type: "layer_canvas",
      position: { x: 320, y: 0 },
      size: { width: 260, height: 220 },
      config: {
        selected_layer_id: "layer-1",
        source_layer_set: { id: "set-1", version: 0, digest },
        transform_patches: [{ layer_id: "layer-1", x: 140 }]
      }
    };
    const source: AigcNode = {
      id: "source",
      type: "image_to_image",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        operation: "layer_decomposition",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    };
    const edge = {
      id: "layers-edge",
      sourceNodeId: source.id,
      sourceHandle: "layers",
      targetNodeId: node.id,
      targetHandle: "layers"
    };
    const layerSet = {
      id: "set-1",
      parent_layer_set_id: null,
      source_asset_id: "source-asset",
      base_asset_id: "base-asset",
      canvas_width: 1000,
      canvas_height: 500,
      version: 0,
      digest,
      layers: [
        {
          id: "layer-1",
          asset_id: "layer-asset",
          z_index: 1,
          name: "商品",
          description: "",
          bbox_absolute: [100, 50, 300, 250] as const,
          bbox_normalized: [100, 100, 300, 500] as const,
          visible: true,
          x: 100,
          y: 50,
          scale: 1
        }
      ]
    };
    const definition = {
      schemaVersion: 1 as const,
      nodes: [source, node],
      edges: [edge],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    store.getState().initialize({
      definition,
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "图层流程",
      revision: 1
    });
    const runDetail: AigcPipelineRunDetail = {
      run: {
        id: "run-1",
        pipeline_id: "pipeline-1",
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
        created_at: "2026-08-30T10:00:00Z",
        updated_at: "2026-08-30T10:00:00Z",
        started_at: "2026-08-30T10:00:00Z",
        finished_at: "2026-08-30T10:01:00Z"
      },
      nodes: [
        {
          node_id: source.id,
          included_in_plan: true,
          status: "succeeded",
          current_task_id: "task-1",
          reused_from_task_id: null,
          input_hash: "hash",
          result: {
            kind: "layer_set",
            text: null,
            text_digest: null,
            assets: [],
            layer_set: layerSet
          },
          attempts: []
        }
      ]
    };

    const continueFromNode = vi.fn();
    const view = renderNode(node, runDetail, false, {
      continueFromNode,
      pending: false
    });

    expect(screen.getByText("图层 2")).toBeInTheDocument();
    expect(screen.getByText("修改 1")).toBeInTheDocument();
    expect(screen.getByText("已选：商品")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "打开图层编辑器" })
    ).toHaveAttribute(
      "href",
      "/workspace/aigc/pipelines/pipeline-1/nodes/layer-canvas/layers"
    );
    await waitFor(() => {
      expect(screen.getByAltText("图层组合底图")).toHaveAttribute(
        "src",
        "https://assets.local/base-asset.png"
      );
    });
    expect(apiMocks.getAigcInternalRunAsset).toHaveBeenCalledWith(
      "pipeline-1",
      "run-1",
      "base-asset"
    );
    expect(apiMocks.getAigcInternalRunAsset).toHaveBeenCalledWith(
      "pipeline-1",
      "run-1",
      "layer-asset"
    );
    expect(apiMocks.getAsset).not.toHaveBeenCalled();
    const continueButton = screen.getByRole("button", {
      name: "从此节点继续"
    });
    expect(continueButton).toHaveAttribute(
      "title",
      "复用可用的上游结果，从图层画布节点重新执行当前节点及下游"
    );
    fireEvent.click(continueButton);
    expect(continueFromNode).toHaveBeenCalledWith("layer-canvas");

    view.rerender(
      nodeView(node, runDetail, false, {
        continueFromNode,
        pending: true
      })
    );
    expect(screen.getByRole("button", { name: "从此节点继续" })).toBeDisabled();

    act(() => store.setState({ dirty: true }));
    fireEvent.click(screen.getByRole("link", { name: "打开图层编辑器" }));
    expect(
      screen.getByText("主画布有未保存修改，请先保存 Pipeline。")
    ).toBeInTheDocument();
  });

  it("loads a real 17-layer preview through the selected run and preserves successful layers", async () => {
    const digest = "b".repeat(64);
    const layers = Array.from({ length: 16 }, (_, index) => ({
      id: `layer-${index + 1}`,
      asset_id: `asset-${index + 1}`,
      z_index: index + 1,
      name: `图层 ${index + 1}`,
      description: "",
      bbox_absolute: [index * 10, index * 5, 200 + index * 10, 150 + index * 5] as const,
      bbox_normalized: [0, 0, 200, 300] as const,
      visible: true,
      x: index * 10,
      y: index * 5,
      scale: 1
    }));
    const source: AigcNode = {
      id: "source-17",
      type: "image_to_image",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        operation: "layer_decomposition",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    };
    const node: AigcNode = {
      id: "canvas-17",
      type: "layer_canvas",
      position: { x: 320, y: 0 },
      size: { width: 260, height: 220 },
      config: {
        selected_layer_id: "layer-1",
        source_layer_set: { id: "set-17", version: 0, digest },
        transform_patches: []
      }
    };
    const definition = {
      schemaVersion: 1 as const,
      nodes: [source, node],
      edges: [{
        id: "edge-17",
        sourceNodeId: source.id,
        sourceHandle: "layers",
        targetNodeId: node.id,
        targetHandle: "layers"
      }],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const layerSet = {
      id: "set-17",
      parent_layer_set_id: null,
      source_asset_id: "source-asset",
      base_asset_id: "base-17",
      canvas_width: 1000,
      canvas_height: 500,
      version: 0,
      digest,
      layers
    };
    const makeRunDetail = (runId: string): AigcPipelineRunDetail => ({
      run: {
        id: runId,
        pipeline_id: "pipeline-1",
        run_number: runId === "run-18" ? 18 : 17,
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
        created_at: "2026-08-30T10:00:00Z",
        updated_at: "2026-08-30T10:01:00Z",
        started_at: "2026-08-30T10:00:00Z",
        finished_at: "2026-08-30T10:01:00Z"
      },
      nodes: [{
        node_id: source.id,
        included_in_plan: true,
        status: "succeeded",
        current_task_id: "task-17",
        reused_from_task_id: null,
        input_hash: "hash-17",
        result: {
          kind: "layer_set",
          text: null,
          text_digest: null,
          assets: [],
          layer_set: layerSet
        },
        attempts: []
      }]
    });
    store.getState().initialize({
      definition,
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "17 层流程",
      revision: 1
    });
    apiMocks.getAigcInternalRunAsset.mockImplementation(
      async (_pipelineId: string, runId: string, id: string) => {
        if (runId === "run-17" && id === "asset-6") {
          throw new Error("missing layer");
        }
        return {
          id,
          project_id: null,
          type: "generated_image",
          stage: "image",
          category: null,
          asset_role: id === "base-17" ? "internal_base" : "internal_layer",
          status: "succeeded",
          object_key: `${runId}/${id}.png`,
          url: `https://assets.local/${runId}/${id}.png`,
          mime_type: "image/png",
          size_bytes: 100,
          source_task_id: null,
          metadata: {},
          created_at: "2026-08-30T10:00:00Z",
          updated_at: "2026-08-30T10:00:00Z"
        } satisfies Asset;
      }
    );

    const view = renderNode(node, makeRunDetail("run-17"));

    await waitFor(() => {
      expect(view.container.querySelectorAll("img")).toHaveLength(16);
    });
    expect(apiMocks.getAigcInternalRunAsset).toHaveBeenCalledTimes(17);
    expect(screen.getByText("图层 17")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "1 个图层预览加载失败：图层 6（layer-6）"
    );
    expect(screen.getByAltText("图层组合底图")).toHaveAttribute(
      "src",
      "https://assets.local/run-17/base-17.png"
    );
    expect(apiMocks.getAsset).not.toHaveBeenCalled();

    const activeRun = makeRunDetail("run-18");
    activeRun.run.status = "running";
    activeRun.run.source_run_id = "run-17";
    activeRun.run.finished_at = null;
    activeRun.nodes.push({
      node_id: node.id,
      included_in_plan: true,
      status: "queued",
      current_task_id: "canvas-task-18",
      reused_from_task_id: null,
      input_hash: "canvas-hash-18",
      result: {
        kind: "none",
        text: null,
        text_digest: null,
        assets: [],
        layer_set: null
      },
      attempts: []
    });

    view.rerender(
      nodeView(node, activeRun, false, null, makeRunDetail("run-17"))
    );

    expect(screen.getByAltText("图层组合底图")).toHaveAttribute(
      "src",
      "https://assets.local/run-17/base-17.png"
    );

    const currentCanvas = activeRun.nodes.find(
      (candidate) => candidate.node_id === node.id
    );
    if (!currentCanvas) throw new Error("missing current canvas node");
    currentCanvas.status = "succeeded";

    view.rerender(
      nodeView(node, activeRun, false, null, makeRunDetail("run-17"))
    );

    await waitFor(() => {
      expect(screen.getByAltText("图层组合底图")).toHaveAttribute(
        "src",
        "https://assets.local/run-18/base-17.png"
      );
    });
    expect(apiMocks.getAigcInternalRunAsset).toHaveBeenCalledWith(
      "pipeline-1",
      "run-18",
      "asset-16"
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(view.container.querySelectorAll("img")).toHaveLength(17);
    expect(apiMocks.getAsset).not.toHaveBeenCalled();
  });

  it("shows an empty state without requesting assets when the current run has no successful layer set", () => {
    const node: AigcNode = {
      id: "empty-layer-canvas",
      type: "layer_canvas",
      position: { x: 0, y: 0 },
      size: { width: 260, height: 220 },
      config: {
        selected_layer_id: null,
        source_layer_set: null,
        transform_patches: []
      }
    };
    store.getState().initialize({
      definition: {
        schemaVersion: 1,
        nodes: [node],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "空图层流程",
      revision: 1
    });

    renderNode(node);

    expect(screen.getByText("当前 Run 无成功图层集")).toBeInTheDocument();
    expect(apiMocks.getAigcInternalRunAsset).not.toHaveBeenCalled();
    expect(apiMocks.getAsset).not.toHaveBeenCalled();
  });

  it("shows layer composite inputs, replacement target, run state, and both outputs", () => {
    const digest = "a".repeat(64);
    const canvas: AigcNode = {
      id: "canvas",
      type: "layer_canvas",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        selected_layer_id: "product",
        source_layer_set: { id: "set-0", version: 0, digest },
        transform_patches: []
      }
    };
    const edit: AigcNode = {
      id: "edit",
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
    const node: AigcNode = {
      id: "composite",
      type: "layer_composite",
      position: { x: 600, y: 0 },
      size: { width: 260, height: 210 },
      config: {}
    };
    const edges = [
      {
        id: "layers",
        sourceNodeId: canvas.id,
        sourceHandle: "layers",
        targetNodeId: node.id,
        targetHandle: "layers"
      },
      {
        id: "replacement",
        sourceNodeId: edit.id,
        sourceHandle: "edited_layer",
        targetNodeId: node.id,
        targetHandle: "replacement"
      }
    ];
    const outputLayerSet = {
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
          bbox_absolute: [100, 100, 500, 500] as const,
          bbox_normalized: [100, 100, 500, 500] as const,
          visible: true,
          x: 100,
          y: 100,
          scale: 1
        }
      ]
    };
    const definition = {
      schemaVersion: 1 as const,
      nodes: [canvas, edit, node],
      edges,
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    store.getState().initialize({
      definition,
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "连续图层编辑",
      revision: 1
    });
    renderNode(node, {
      run: {
        id: "run-composite",
        definition_snapshot: definition
      },
      nodes: [
        {
          node_id: edit.id,
          status: "succeeded",
          result: {
            kind: "edited_layer",
            text: null,
            text_digest: null,
            assets: [],
            edited_layer: {
              asset_id: "product-edited",
              layer_set_id: "set-1",
              layer_set_version: 1,
              layer_set_digest: digest,
              layer_id: "product",
              bbox_absolute: [100, 100, 500, 500],
              bbox_normalized: [100, 100, 500, 500],
              x: 100,
              y: 100,
              scale: 1,
              z_index: 1
            }
          }
        },
        {
          node_id: node.id,
          status: "succeeded",
          result: {
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
          }
        }
      ]
    } as unknown as AigcPipelineRunDetail);

    expect(screen.getByLabelText("图层集输入已连接")).toBeInTheDocument();
    expect(screen.getByLabelText("替换图层输入已连接")).toBeInTheDocument();
    expect(screen.getByText("商品")).toBeInTheDocument();
    expect(screen.getByText("扁平图片已生成")).toBeInTheDocument();
    expect(screen.getByText(/v2 · 2 层/)).toBeInTheDocument();
    expect(screen.getByText("SUCCEEDED")).toBeInTheDocument();
    expect(screen.getByLabelText("图片输出")).toHaveAttribute(
      "data-connectable",
      "true"
    );
    expect(screen.getByLabelText("图层集输出")).toHaveAttribute(
      "data-connectable",
      "true"
    );
  });

  it("shows an active layer composite as running", () => {
    const node: AigcNode = {
      id: "composite",
      type: "layer_composite",
      position: { x: 0, y: 0 },
      size: { width: 260, height: 210 },
      config: {}
    };
    renderNode(node, {
      run: {
        id: "run-composite",
        definition_snapshot: {
          schemaVersion: 1,
          nodes: [node],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 }
        }
      },
      nodes: [
        {
          node_id: node.id,
          status: "running",
          result: {
            kind: "none",
            text: null,
            text_digest: null,
            assets: []
          }
        }
      ]
    } as unknown as AigcPipelineRunDetail);

    expect(screen.getByText("正在合成")).toBeInTheDocument();
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
  });
});
