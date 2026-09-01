import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AigcPromptEditor } from "@/components/workspace/aigc/aigc-prompt-editor";
import { AigcEditorStoreProvider } from "@/components/workspace/aigc/providers/aigc-editor-store-provider";
import { AigcQueryProvider } from "@/components/workspace/aigc/providers/aigc-query-provider";
import {
  createAigcEditorStore,
  type AigcEditorStore
} from "@/lib/aigc/editor-store";
import type { AigcNode, AigcPipelineDefinition } from "@/lib/aigc/types";
import type { Asset } from "@/lib/api-types";

const apiMocks = vi.hoisted(() => ({
  getAsset: vi.fn(),
  optimizeAigcImagePrompt: vi.fn()
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getAsset: apiMocks.getAsset,
      optimizeAigcImagePrompt: apiMocks.optimizeAigcImagePrompt
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

describe("AIGC structured prompt editor", () => {
  let store: AigcEditorStore;

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getAsset.mockResolvedValue({
      id: "asset-1",
      metadata: { name: "产品图.png" },
      url: "https://example.com/product.png"
    } as unknown as Asset);
    apiMocks.optimizeAigcImagePrompt.mockResolvedValue({
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

  it("renders live bbox data, edits instructions, and blocks manual tags", async () => {
    const node = store
      .getState()
      .definition.nodes.find((candidate) => candidate.id === "prompt") as Extract<
      AigcNode,
      { type: "text_input" }
    >;
    render(
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcPromptEditor node={node} />
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );

    expect(await screen.findByText("bbox 100 200 700 800")).toBeInTheDocument();
    const instruction = screen.getByRole("textbox", {
      name: "框选引用说明：image"
    });
    fireEvent.change(instruction, { target: { value: "保留商标位置" } });
    let prompt = store
      .getState()
      .definition.nodes.find((candidate) => candidate.id === "prompt");
    if (prompt?.type === "text_input") {
      expect(prompt.config.bbox_references?.[0]?.instruction).toBe("保留商标位置");
    }

    const baseText = screen.getByRole("textbox", { name: "基础文本" });
    fireEvent.change(baseText, {
      target: { value: "伪造 <bbox>1 2 3 4</bbox>" }
    });
    expect(
      screen.getByRole("alert", { name: "" })
    ).toHaveTextContent("坐标标签由框选生成，不能手工输入。");
    prompt = store
      .getState()
      .definition.nodes.find((candidate) => candidate.id === "prompt");
    if (prompt?.type === "text_input") {
      expect(prompt.config.text).toBe("将");
    }

    fireEvent.click(screen.getByRole("button", { name: "移除框选引用：image" }));
    await waitFor(() => {
      const updated = store
        .getState()
        .definition.nodes.find((candidate) => candidate.id === "prompt");
      expect(
        updated?.type === "text_input"
          ? updated.config.bbox_references
          : undefined
      ).toEqual([]);
    });
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
    const node = store
      .getState()
      .definition.nodes.find((candidate) => candidate.id === "prompt") as Extract<
      AigcNode,
      { type: "text_input" }
    >;

    render(
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcPromptEditor node={node} />
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );

    expect(screen.getByRole("button", { name: "优化生图提示词" })).toBeDisabled();
    expect(apiMocks.optimizeAigcImagePrompt).not.toHaveBeenCalled();
  });

  it("optimizes the structured prompt as one undoable update", async () => {
    const node = store
      .getState()
      .definition.nodes.find((candidate) => candidate.id === "prompt") as Extract<
      AigcNode,
      { type: "text_input" }
    >;
    render(
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcPromptEditor node={node} />
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "优化生图提示词" }));

    await waitFor(() => {
      expect(apiMocks.optimizeAigcImagePrompt).toHaveBeenCalledWith({
        generation_modes: ["image_to_image"],
        reference_image_count: 1,
        reference_instructions: ["替换为红色包装"],
        text: "将"
      });
    });
    await screen.findByText("提示词已优化，可撤销恢复。");
    let prompt = store
      .getState()
      .definition.nodes.find((candidate) => candidate.id === "prompt");
    expect(prompt?.type === "text_input" ? prompt.config : null).toMatchObject({
      text: "将包装优化为鲜明红色，保持产品结构不变",
      bbox_references: [
        {
          source_node_id: "image",
          instruction: "保持商标位置与比例不变"
        }
      ]
    });

    act(() => store.getState().undo());
    prompt = store
      .getState()
      .definition.nodes.find((candidate) => candidate.id === "prompt");
    expect(prompt?.type === "text_input" ? prompt.config : null).toMatchObject({
      text: "将",
      bbox_references: [
        { source_node_id: "image", instruction: "替换为红色包装" }
      ]
    });
  });

  it("does not overwrite prompt changes made while optimization is pending", async () => {
    let resolveOptimization:
      | ((value: {
          optimized_text: string;
          optimized_reference_instructions: string[];
        }) => void)
      | undefined;
    apiMocks.optimizeAigcImagePrompt.mockReturnValue(
      new Promise((resolve) => {
        resolveOptimization = resolve;
      })
    );
    const node = store
      .getState()
      .definition.nodes.find((candidate) => candidate.id === "prompt") as Extract<
      AigcNode,
      { type: "text_input" }
    >;
    render(
      <AigcQueryProvider>
        <AigcEditorStoreProvider store={store}>
          <AigcPromptEditor node={node} />
        </AigcEditorStoreProvider>
      </AigcQueryProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "优化生图提示词" }));
    expect(screen.getByRole("button", { name: "优化生图提示词" })).toBeDisabled();
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
      "提示词已发生变化，本次优化结果未应用，请重新优化。"
    );
    const prompt = store
      .getState()
      .definition.nodes.find((candidate) => candidate.id === "prompt");
    expect(prompt?.type === "text_input" ? prompt.config.text : null).toBe(
      "用户在等待时更新"
    );
  });
});
