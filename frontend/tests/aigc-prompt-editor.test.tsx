import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AigcPromptEditor } from "@/components/workspace/aigc/aigc-prompt-editor";
import { AigcRunProvider } from "@/components/workspace/aigc/aigc-run-context";
import { AigcEditorStoreProvider } from "@/components/workspace/aigc/providers/aigc-editor-store-provider";
import { AigcQueryProvider } from "@/components/workspace/aigc/providers/aigc-query-provider";
import {
  createAigcEditorStore,
  type AigcEditorStore
} from "@/lib/aigc/editor-store";
import type {
  AigcPipelineDefinition,
  AigcPipelineDefinitionV2,
  AigcPipelineRunDetail,
  AigcV2Node
} from "@/lib/aigc/types";
import type { AigcRunProjection } from "@/lib/aigc/run-scope";
import type { Asset } from "@/lib/api-types";

const apiMocks = vi.hoisted(() => ({
  getAsset: vi.fn(),
  optimizeAigcPrompt: vi.fn()
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getAsset: apiMocks.getAsset,
      optimizeAigcPrompt: apiMocks.optimizeAigcPrompt
    }
  };
});

function promptDefinition(): AigcPipelineDefinition {
  return {
    schemaVersion: 1,
    nodes: [
      {
        id: "image",
        type: "image_input",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          asset_id: "asset-1",
          bbox_asset_id: "asset-1",
          bbox: { type: "bbox", x1: 100, y1: 200, x2: 700, y2: 800 }
        }
      },
      {
        id: "prompt",
        type: "text_input",
        position: { x: 0, y: 200 },
        size: { width: 240, height: 160 },
        config: {
          text: "将",
          bbox_references: [
            { source_node_id: "image", instruction: "替换为红色包装" }
          ]
        }
      },
      {
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
      }
    ],
    edges: [
      {
        id: "image-edge",
        sourceNodeId: "image",
        sourceHandle: "image",
        targetNodeId: "model",
        targetHandle: "image"
      },
      {
        id: "prompt-edge",
        sourceNodeId: "prompt",
        sourceHandle: "text",
        targetNodeId: "model",
        targetHandle: "prompt"
      }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
}

function getV2Node<TType extends AigcV2Node["type"]>(
  store: AigcEditorStore,
  nodeId: string,
  type: TType
): Extract<AigcV2Node, { type: TType }> {
  const definition =
    store.getState().definition as unknown as AigcPipelineDefinitionV2;
  const node = definition.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || node.type !== type) {
    throw new Error(`Expected ${nodeId} to be a ${type} node`);
  }
  return node as Extract<AigcV2Node, { type: TType }>;
}

describe("AIGC structured prompt editor", () => {
  let store: AigcEditorStore;

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getAsset.mockResolvedValue({
      id: "asset-1",
      metadata: { name: "产品图.png" },
      url: "https://example.com/product.png"
    } as unknown as Asset);
    apiMocks.optimizeAigcPrompt.mockResolvedValue({
      optimized_text: "将包装优化为鲜明红色，保持产品结构不变",
      optimized_reference_instructions: ["保持商标位置与比例不变"]
    });
    store = createAigcEditorStore({
      definition: promptDefinition(),
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "精准编辑",
      revision: 1
    });
  });

  it("uses the node-scoped Run unless an explicit null Run is provided", () => {
    const definition: AigcPipelineDefinitionV2 = {
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
          id: "target",
          type: "text",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 160 },
          config: {
            text: "本地备用文本",
            bbox_references: [],
            title: null
          }
        }
      ],
      edges: [
        {
          id: "producer-target",
          sourceNodeId: "producer",
          sourceHandle: "text",
          targetNodeId: "target",
          targetHandle: "text"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    store.getState().initialize({
      definition,
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "Run 隔离",
      revision: 1
    });
    const detail = {
      run: {
        id: "run-target",
        status: "succeeded",
        definition_snapshot: definition
      },
      nodes: [
        {
          node_id: "producer",
          status: "succeeded",
          result: {
            kind: "text",
            text: "节点所属 Run 文本",
            text_digest: "digest",
            assets: []
          }
        }
      ]
    } as unknown as AigcPipelineRunDetail;
    const projection: AigcRunProjection = {
      activeRunForNode: () => null,
      displayRunForNode: (nodeId) =>
        nodeId === "target" ? detail : null,
      hasAnyActiveRun: false,
      isNodeActive: () => false,
      latestSuccessfulRunForNode: (nodeId) =>
        nodeId === "target" ? detail : null
    };
    const target = getV2Node(store, "target", "text");
    const view = (runDetail?: AigcPipelineRunDetail | null) => (
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcRunProvider value={projection}>
            <AigcPromptEditor node={target} runDetail={runDetail} />
          </AigcRunProvider>
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );
    const rendered = render(view());

    expect(screen.getByRole("textbox", { name: "基础文本" })).toHaveValue(
      "节点所属 Run 文本"
    );

    rendered.rerender(view(null));
    expect(screen.getByRole("textbox", { name: "基础文本" })).toHaveValue("");
    expect(screen.queryByDisplayValue("节点所属 Run 文本")).toBeNull();
  });

  it("renders text, compact bbox tokens, and instructions in one editor surface", async () => {
    const definition = promptDefinition();
    definition.nodes.splice(1, 0, {
      id: "image-second",
      type: "image_input",
      position: { x: 0, y: 100 },
      size: { width: 240, height: 160 },
      config: {
        asset_id: "asset-2",
        bbox_asset_id: "asset-2",
        bbox: { type: "bbox", x1: 10, y1: 20, x2: 300, y2: 400 }
      }
    });
    definition.nodes = definition.nodes.map((candidate) =>
      candidate.type === "text_input"
        ? {
            ...candidate,
            config: {
              ...candidate.config,
              bbox_references: [
                ...(candidate.config.bbox_references ?? []),
                {
                  source_node_id: "image-second",
                  instruction: "保留第二个主体"
                }
              ]
            }
          }
        : candidate
    );
    definition.edges.splice(1, 0, {
      id: "image-second-edge",
      sourceNodeId: "image-second",
      sourceHandle: "image",
      targetNodeId: "model",
      targetHandle: "image"
    });
    store.getState().initialize({
      definition,
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "多图片精准编辑",
      revision: 1
    });
    const node = getV2Node(store, "prompt", "text");
    render(
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcPromptEditor node={node} />
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );

    const editor = screen.getByRole("group", { name: "提示词编辑面" });
    expect(screen.queryByRole("group", { name: "框选引用" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "基础文本" })
    ).toBe(editor.querySelector("textarea"));
    const tokens = screen.getAllByRole("group", { name: /BBox 引用/ });
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toHaveAccessibleName(
      "BBox 引用：图片节点1，bbox 100 200 700 800"
    );
    expect(tokens[1]).toHaveAccessibleName(
      "BBox 引用：图片节点2，bbox 10 20 300 400"
    );
    expect(editor).toContainElement(tokens[0]);
    expect(editor).toContainElement(
      screen.getByRole("textbox", { name: "框选引用说明：图片节点1" })
    );
    expect(editor).toContainElement(tokens[1]);
    expect(editor).toContainElement(
      screen.getByRole("textbox", { name: "框选引用说明：图片节点2" })
    );
    expect(editor.textContent).not.toContain("image-second");

    const firstImage = getV2Node(store, "image", "image");
    act(() =>
      store.getState().updateNodeConfig(firstImage.id, {
        ...firstImage.config,
        bbox: { type: "bbox", x1: 120, y1: 240, x2: 720, y2: 840 }
      })
    );
    expect(
      screen.getByRole("group", {
        name: "BBox 引用：图片节点1，bbox 120 240 720 840"
      })
    ).toBeInTheDocument();
  });

  it("edits and removes references while blocking manual tags", async () => {
    const node = getV2Node(store, "prompt", "text");
    render(
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcPromptEditor node={node} />
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );

    expect(await screen.findByText("bbox 100 200 700 800")).toBeInTheDocument();
    const instruction = screen.getByRole("textbox", {
      name: "框选引用说明：图片节点"
    });
    fireEvent.change(instruction, { target: { value: "保留商标位置" } });
    let prompt = getV2Node(store, "prompt", "text");
    expect(prompt.config.bbox_references?.[0]?.instruction).toBe("保留商标位置");
    fireEvent.change(instruction, {
      target: { value: "伪造 <point>10 20</point>" }
    });
    prompt = getV2Node(store, "prompt", "text");
    expect(prompt.config.bbox_references?.[0]?.instruction).toBe("保留商标位置");

    const baseText = screen.getByRole("textbox", { name: "基础文本" });
    fireEvent.change(baseText, {
      target: { value: "伪造 <bbox>1 2 3 4</bbox>" }
    });
    expect(
      screen.getByRole("alert", { name: "" })
    ).toHaveTextContent("坐标标签由框选生成，不能手工输入。");
    prompt = getV2Node(store, "prompt", "text");
    expect(prompt.config.text).toBe("将");

    fireEvent.click(
      screen.getByRole("button", { name: "移除框选引用：图片节点" })
    );
    await waitFor(() => {
      expect(
        getV2Node(store, "prompt", "text").config.bbox_references
      ).toEqual([]);
    });
    const source = getV2Node(store, "image", "image");
    expect(source.config.bbox).toEqual({
      type: "bbox",
      x1: 100,
      y1: 200,
      x2: 700,
      y2: 800
    });
  });

  it("keeps an invalid reference in place as a compact removable token", () => {
    store.getState().initialize({
      definition: promptDefinition(),
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "失效引用",
      revision: 1
    });
    const validPrompt = getV2Node(store, "prompt", "text");
    store.getState().updateNodeConfig("prompt", {
      ...validPrompt.config,
      bbox_references: [
        { source_node_id: "missing-image", instruction: "仍可编辑说明" }
      ]
    });
    const node = getV2Node(store, "prompt", "text");

    render(
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcPromptEditor node={node} />
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );

    const editor = screen.getByRole("group", { name: "提示词编辑面" });
    expect(editor).toHaveTextContent("引用来源已失效");
    expect(editor).toContainElement(
      screen.getByRole("textbox", { name: "框选引用说明：失效图片节点" })
    );
    expect(
      screen.getByRole("button", { name: "移除框选引用：失效图片节点" })
    ).toBeEnabled();
    expect(editor.textContent).not.toContain("missing-image");
  });

  it("shows a valid upstream bbox reference for the current run asset", () => {
    const definition = structuredClone(
      store.getState().definition
    ) as unknown as AigcPipelineDefinitionV2;
    definition.nodes.push({
      id: "image-producer",
      type: "text_to_image",
      position: { x: -320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    });
    definition.edges.push({
      id: "image-upstream",
      sourceNodeId: "image-producer",
      sourceHandle: "image",
      targetNodeId: "image",
      targetHandle: "image"
    });
    const image = definition.nodes.find(
      (candidate) => candidate.id === "image"
    );
    if (image?.type !== "image") throw new Error("expected image node");
    image.config.upstream_bbox = {
      type: "bbox",
      x1: 450,
      y1: 168,
      x2: 614,
      y2: 912
    };
    image.config.upstream_bbox_asset_id = "upstream-image";
    store.getState().initialize({
      definition,
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "上游引用",
      revision: 1
    });
    const runDetail = {
      run: {
        id: "run-upstream",
        status: "succeeded",
        definition_snapshot: definition
      },
      nodes: [
        {
          node_id: "image",
          status: "succeeded",
          result: {
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
                metadata: {}
              }
            ]
          }
        }
      ]
    } as unknown as AigcPipelineRunDetail;

    render(
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcPromptEditor
            node={getV2Node(store, "prompt", "text")}
            runDetail={runDetail}
          />
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );

    expect(
      screen.getByRole("group", {
        name: "BBox 引用：图片节点，bbox 450 168 614 912"
      })
    ).not.toHaveTextContent("已暂停");
    expect(screen.queryByText("引用来源已失效")).toBeNull();
    expect(
      getV2Node(store, "prompt", "text").config.bbox_references
    ).toHaveLength(1);
  });

  it("disables optimization when every editable field is blank", () => {
    const empty = promptDefinition();
    empty.nodes = empty.nodes.map((candidate) =>
      candidate.type === "text_input"
        ? {
            ...candidate,
            config: { bbox_references: [], text: "" }
          }
        : candidate
    );
    store.getState().initialize({
      definition: empty,
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "空提示词",
      revision: 1
    });
    const node = getV2Node(store, "prompt", "text");

    render(
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcPromptEditor node={node} />
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );

    expect(screen.getByRole("button", { name: "优化提示词" })).toBeDisabled();
    expect(apiMocks.optimizeAigcPrompt).not.toHaveBeenCalled();
  });

  it("optimizes the structured prompt as one undoable update", async () => {
    const node = getV2Node(store, "prompt", "text");
    render(
      <StrictMode>
        <AigcQueryProvider>
          <AigcEditorStoreProvider store={store}>
            <AigcPromptEditor node={node} />
          </AigcEditorStoreProvider>
        </AigcQueryProvider>
      </StrictMode>
    );

    fireEvent.click(screen.getByRole("button", { name: "优化提示词" }));
    fireEvent.change(screen.getByRole("textbox", { name: "优化方向" }), {
      target: { value: "强化商品质感" }
    });
    fireEvent.click(screen.getByRole("button", { name: "开始优化" }));

    await waitFor(() => {
      expect(apiMocks.optimizeAigcPrompt).toHaveBeenCalledWith(
        {
          optimization_direction: "强化商品质感",
          reference_instructions: ["替换为红色包装"],
          target_config: {
            aspect_ratio: "1:1",
            model: "doubao-seedream-5-0-pro-260628",
            operation: "image_to_image",
            reference_image_count: 1,
            size: "2K"
          },
          target_node_id: "model",
          target_type: "image_to_image",
          text: "将"
        },
        { signal: expect.anything() }
      );
    });
    await screen.findByText("提示词已优化，可撤销恢复。");
    let prompt = getV2Node(store, "prompt", "text");
    expect(prompt.config).toMatchObject({
      text: "将包装优化为鲜明红色，保持产品结构不变",
      bbox_references: [
        {
          source_node_id: "image",
          instruction: "保持商标位置与比例不变"
        }
      ]
    });
    expect(
      screen.getAllByRole("group", { name: /BBox 引用/ })
    ).toHaveLength(1);
    expect(
      screen.getByRole("group", {
        name: "BBox 引用：图片节点，bbox 100 200 700 800"
      })
    ).toBeInTheDocument();
    const image = getV2Node(store, "image", "image");
    expect(image.config.bbox).toEqual({
      type: "bbox",
      x1: 100,
      y1: 200,
      x2: 700,
      y2: 800
    });

    act(() => store.getState().undo());
    prompt = getV2Node(store, "prompt", "text");
    expect(prompt.config).toMatchObject({
      text: "将",
      bbox_references: [
        { source_node_id: "image", instruction: "替换为红色包装" }
      ]
    });
  });

  it("lists direct model targets individually and sends the selected LLM context", async () => {
    const definition = promptDefinition();
    definition.nodes.push({
      id: "llm-target",
      type: "llm",
      position: { x: 640, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seed-evolving",
        system_prompt: "只输出 JSON",
        temperature: 0.2
      }
    });
    definition.edges.push({
      id: "prompt-llm",
      sourceNodeId: "prompt",
      sourceHandle: "text",
      targetNodeId: "llm-target",
      targetHandle: "prompt"
    });
    store.getState().initialize({
      definition,
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "多目标",
      revision: 1
    });
    apiMocks.optimizeAigcPrompt.mockResolvedValueOnce({
      optimized_text: "结构化后的 LLM 提示词",
      optimized_reference_instructions: []
    });
    const node = getV2Node(store, "prompt", "text");
    render(
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcPromptEditor node={node} />
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "优化提示词" }));
    const target = screen.getByRole("combobox", { name: "目标模型" });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    fireEvent.change(target, { target: { value: "llm-target" } });
    fireEvent.click(screen.getByRole("button", { name: "开始优化" }));

    await waitFor(() => {
      expect(apiMocks.optimizeAigcPrompt).toHaveBeenCalledWith(
        {
          optimization_direction: "",
          reference_instructions: [],
          target_config: {
            model: "doubao-seed-evolving",
            system_prompt: "只输出 JSON"
          },
          target_node_id: "llm-target",
          target_type: "llm",
          text: "将"
        },
        { signal: expect.anything() }
      );
    });
    expect(getV2Node(store, "prompt", "text").config.text).toBe(
      "结构化后的 LLM 提示词"
    );
  });

  it("does not overwrite prompt changes made while optimization is pending", async () => {
    let resolveOptimization:
      | ((value: {
          optimized_text: string;
          optimized_reference_instructions: string[];
        }) => void)
      | undefined;
    apiMocks.optimizeAigcPrompt.mockReturnValue(
      new Promise((resolve) => {
        resolveOptimization = resolve;
      })
    );
    const node = getV2Node(store, "prompt", "text");
    render(
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcPromptEditor node={node} />
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "优化提示词" }));
    fireEvent.click(screen.getByRole("button", { name: "开始优化" }));
    expect(
      screen.getByRole("button", { name: "取消优化" })
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "优化中" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "目标模型" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "优化方向" })).toBeDisabled();
    await act(async () => {
      store.getState().updateNodeConfig("prompt", {
        ...node.config,
        text: "用户在等待时更新"
      });
      resolveOptimization?.({
        optimized_text: "过期结果",
        optimized_reference_instructions: ["过期说明"]
      });
    });

    await screen.findByText(
      "文本、Run、目标配置或连线已变化，本次优化结果未应用。"
    );
    const prompt = getV2Node(store, "prompt", "text");
    expect(prompt.config.text).toBe("用户在等待时更新");
  });

  it("cancels an in-flight optimization and ignores its late result", async () => {
    let resolveOptimization:
      | ((value: {
          optimized_text: string;
          optimized_reference_instructions: string[];
        }) => void)
      | undefined;
    let signal: AbortSignal | undefined;
    apiMocks.optimizeAigcPrompt.mockImplementationOnce(
      (_request: unknown, options?: RequestInit) => {
        signal = options?.signal ?? undefined;
        return new Promise((resolve) => {
          resolveOptimization = resolve;
        });
      }
    );
    const node = getV2Node(store, "prompt", "text");
    render(
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcPromptEditor node={node} />
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "优化提示词" }));
    fireEvent.click(screen.getByRole("button", { name: "开始优化" }));
    fireEvent.click(screen.getByRole("button", { name: "取消优化" }));

    expect(signal?.aborted).toBe(true);
    expect(screen.getByText("已取消优化。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始优化" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeEnabled();

    await act(async () => {
      resolveOptimization?.({
        optimized_text: "不应应用的迟到结果",
        optimized_reference_instructions: ["不应应用"]
      });
    });
    expect(getV2Node(store, "prompt", "text").config.text).toBe("将");
  });

  it("releases the optimizing state when the provider request fails", async () => {
    apiMocks.optimizeAigcPrompt.mockRejectedValueOnce(
      new Error("request timed out")
    );
    const node = getV2Node(store, "prompt", "text");
    render(
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcPromptEditor node={node} />
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "优化提示词" }));
    fireEvent.click(screen.getByRole("button", { name: "开始优化" }));

    expect(
      await screen.findAllByText("请求未完成，请检查网络连接后重试。")
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "开始优化" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeEnabled();
  });
});
