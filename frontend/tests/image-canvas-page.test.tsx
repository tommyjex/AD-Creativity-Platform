import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ImageCanvasPage,
  fitNodeSize,
  fitOutputNodeSize,
  fitReferenceNodeSize,
  isLegacyReferenceNodeSize,
  resizeReferenceNodeSize
} from "@/components/workspace/image-canvas-page";
import {
  REFERENCE_NODE_HORIZONTAL_CHROME,
  REFERENCE_NODE_VERTICAL_CHROME,
  type OutputNodeData,
  type ReferenceNodeData
} from "@/components/workspace/canvas/canvas-context";
import type {
  Asset,
  CanvasLayout,
  CanvasNode,
  Project
} from "@/lib/api-types";

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks
}));

// Keep the real React Flow module (the page relies on `useNodesState`), but the
// `NodeResizer` overlay depends on the internal RF store, which is not available
// once we swap the canvas for a jsdom-friendly renderer below.
vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return { ...actual, NodeResizer: () => null };
});

// React Flow does not lay out / render custom nodes in jsdom (nodes need a
// measured viewport). Swap the canvas container for a lightweight renderer that
// mounts the real reference/output node components so their DOM and handlers are
// exercised through the page exactly as in the browser.
vi.mock("@/components/workspace/canvas/node-canvas", async () => {
  const { ReferenceNode } = await import(
    "@/components/workspace/canvas/reference-node"
  );
  const { OutputNode } = await import(
    "@/components/workspace/canvas/output-node"
  );
  const { useCanvasHandlers } = await import(
    "@/components/workspace/canvas/canvas-context"
  );

  type FlowNode = {
    id: string;
    type?: string;
    data: Record<string, unknown>;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    measured?: { height?: number; width?: number };
    style?: { height?: number; width?: number };
    zIndex?: number;
  };

  const baseProps = (node: FlowNode) => ({
    deletable: true,
    draggable: true,
    dragging: false,
    height: node.height ?? node.style?.height ?? node.measured?.height,
    id: node.id,
    isConnectable: false,
    positionAbsoluteX: node.position.x,
    positionAbsoluteY: node.position.y,
    selectable: true,
    selected: false,
    width: node.width ?? node.style?.width ?? node.measured?.width,
    zIndex: node.zIndex ?? 0
  });

  const NodeCanvas = ({
    children,
    nodes,
    onNodesChange
  }: {
    children?: ReactNode;
    nodes: FlowNode[];
    onNodesChange?: (changes: Record<string, unknown>[]) => void;
  }) => {
    const handlers = useCanvasHandlers();
    return (
      <div data-testid="node-canvas">
        {nodes.map((node) => {
          const props = baseProps(node);
          return (
            <div
              data-effective-height={props.height}
              data-effective-width={props.width}
              data-measured-height={node.measured?.height}
              data-measured-width={node.measured?.width}
              data-testid={`flow-node-${node.id}`}
              key={node.id}
              style={{
                ...node.style,
                height: node.height ?? node.style?.height,
                width: node.width ?? node.style?.width
              }}
            >
              {node.type === "reference" ? (
                <ReferenceNode
                  {...props}
                  data={node.data as ReferenceNodeData}
                  type="reference"
                />
              ) : (
                <OutputNode
                  {...props}
                  data={node.data as OutputNodeData}
                  type="output"
                />
              )}
            </div>
          );
        })}
        {nodes[0] ? (
          <>
          <button
            aria-label="测试节点位置变化"
            onClick={() =>
              onNodesChange?.([
                {
                  dragging: true,
                  id: nodes[0].id,
                  position: {
                    x: nodes[0].position.x + 10,
                    y: nodes[0].position.y + 10
                  },
                  type: "position"
                }
              ])
            }
            type="button"
          />
          <button
            aria-label="测试节点尺寸变化"
            onClick={() =>
              onNodesChange?.([
                {
                  dimensions: {
                    height: (nodes[0].height ?? 260) + 10,
                    width: (nodes[0].width ?? 260) + 10
                  },
                  id: nodes[0].id,
                  resizing: false,
                  setAttributes: true,
                  type: "dimensions"
                }
              ])
            }
            type="button"
          />
          <button
            aria-label="测试节点测量"
            onClick={() =>
              onNodesChange?.([
                {
                  dimensions: {
                    height: nodes[0].height ?? 260,
                    width: nodes[0].width ?? 260
                  },
                  id: nodes[0].id,
                  type: "dimensions"
                }
              ])
            }
            type="button"
          />
          <button
            aria-label="测试滞后快照首次加载"
            onClick={() => {
              handlers.onReferenceImageLoad(nodes[0].id, 1472, 542);
              onNodesChange?.([
                {
                  dimensions: { height: 190, width: 520 },
                  id: nodes[0].id,
                  setAttributes: true,
                  type: "dimensions"
                }
              ]);
            }}
            type="button"
          />
          <button
            aria-label="测试节点选择变化"
            onClick={() =>
              onNodesChange?.([
                { id: nodes[0].id, selected: true, type: "select" }
              ])
            }
            type="button"
          />
          </>
        ) : null}
        {children}
      </div>
    );
  };

  return { NodeCanvas };
});

const apiMocks = vi.hoisted(() => ({
  decomposeImageLayers: vi.fn(),
  generateProjectImage: vi.fn(),
  getProject: vi.fn(),
  getTask: vi.fn(),
  listImageLayerSets: vi.fn(),
  saveCanvasLayout: vi.fn(),
  saveImagePromptVersion: vi.fn(),
  setImageProjectReferenceSelection: vi.fn(),
  uploadImageProjectReference: vi.fn()
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...original,
    apiClient: apiMocks,
    getUserFacingErrorMessage: () => "请求失败"
  };
});

const generatedAsset: Asset = {
  asset_role: "public",
  category: null,
  created_at: "2026-08-24T08:05:00Z",
  id: "generated-1",
  metadata: {},
  mime_type: "image/png",
  object_key: "projects/image-project-1/generated-1.png",
  project_id: "image-project-1",
  size_bytes: 1024,
  source_task_id: "task-1",
  stage: "image",
  status: "succeeded",
  type: "generated_image",
  updated_at: "2026-08-24T08:05:00Z",
  url: "https://assets.example.com/generated-1.png"
};

const referenceAsset: Asset = {
  ...generatedAsset,
  category: "reference",
  id: "reference-1",
  metadata: { name: "参考产品图.png" },
  source_task_id: null,
  type: "uploaded_image",
  url: "https://assets.example.com/reference-1.png"
};

const project: Project = {
  assets: [generatedAsset, referenceAsset],
  brief: {
    aspect_ratio: "1:1",
    audience: "城市通勤人群",
    duration_seconds: null,
    image_purpose: "ecommerce_main",
    product_name: "便携咖啡机",
    prompt: "制作简洁的商品主图",
    selling_points: ["轻巧便携"],
    style: "自然晨光",
    summary: "突出轻巧便携与通勤场景。",
    target_language: "zh",
    target_platform: "tmall"
  },
  character_cards: [],
  created_at: "2026-08-24T08:00:00Z",
  current_image_asset_id: generatedAsset.id,
  current_image_prompt_version_id: "prompt-v2",
  current_stage: "image",
  id: "image-project-1",
  image_prompt_status: "succeeded",
  image_reference_asset_ids: [referenceAsset.id],
  image_revision: 1,
  name: "咖啡机主图",
  project_type: "image_asset",
  status: "draft",
  storyboard: [],
  tasks: [],
  text_artifacts: [],
  updated_at: "2026-08-24T08:05:00Z"
};

const draftProject: Project = {
  ...project,
  assets: [referenceAsset],
  current_image_asset_id: null,
  current_image_prompt_version_id: null,
  image_prompt_status: "draft"
};

const layerSet = {
  base_asset: generatedAsset,
  base_asset_id: generatedAsset.id,
  canvas_height: 1000,
  canvas_width: 1000,
  created_at: "2026-08-24T09:10:00Z",
  id: "set-1",
  layers: [],
  layers_assets: [],
  project_id: project.id,
  revision: 1,
  source_asset_id: generatedAsset.id,
  status: "succeeded" as const,
  updated_at: "2026-08-24T09:10:00Z"
};

const emptyLayout: CanvasLayout = {
  nodes: [],
  project_id: project.id,
  revision: 0,
  updated_at: "2026-08-24T08:05:00Z"
};

const referenceNode: CanvasNode = {
  asset_id: referenceAsset.id,
  bbox: null,
  height: 260,
  id: "reference-node-1",
  kind: "reference",
  order_index: 1,
  width: 260,
  x: 80,
  y: 80,
  z: 1
};

const referenceLayout: CanvasLayout = {
  nodes: [referenceNode],
  project_id: project.id,
  revision: 2,
  updated_at: "2026-08-24T08:05:00Z"
};

const outputLayout: CanvasLayout = {
  nodes: [
    {
      asset_id: generatedAsset.id,
      height: 260,
      id: "output-node-1",
      kind: "output",
      source: "text_to_image",
      task_id: "task-1",
      width: 260,
      x: 80,
      y: 80,
      z: 1
    }
  ],
  project_id: project.id,
  revision: 3,
  updated_at: "2026-08-24T08:05:00Z"
};

const pendingOutputLayout: CanvasLayout = {
  ...outputLayout,
  nodes: [
    {
      ...outputLayout.nodes[0],
      asset_id: null,
      task_id: "task-pending"
    }
  ]
};

function renderPage(initialProject: Project, initialLayout: CanvasLayout) {
  return render(
    <ImageCanvasPage
      initialLayout={initialLayout}
      initialProject={initialProject}
    />
  );
}

function drawBbox(image: HTMLElement) {
  Object.defineProperty(image, "naturalHeight", {
    configurable: true,
    value: 1000
  });
  Object.defineProperty(image, "naturalWidth", {
    configurable: true,
    value: 1000
  });
  Object.defineProperty(image, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100
    })
  });
  fireEvent.pointerDown(image, { clientX: 10, clientY: 20, pointerId: 1 });
  fireEvent.pointerMove(image, { clientX: 80, clientY: 90, pointerId: 1 });
  fireEvent.pointerUp(image, { clientX: 80, clientY: 90, pointerId: 1 });
}

describe("ImageCanvasPage", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    Object.values(routerMocks).forEach((mock) => mock.mockReset());
    apiMocks.listImageLayerSets.mockResolvedValue([]);
    apiMocks.saveCanvasLayout.mockResolvedValue({
      ...emptyLayout,
      revision: emptyLayout.revision + 1
    });
  });

  it("navigates back when the canvas closes", () => {
    renderPage(project, emptyLayout);

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));

    expect(routerMocks.back).toHaveBeenCalledTimes(1);
  });

  it("renders the fixed dock inline without a modal dialog shell", () => {
    renderPage(project, emptyLayout);

    // The page fills the canvas area and pins the generation dock; there is no
    // modal dialog overlay wrapping the canvas.
    expect(
      screen.getByRole("heading", { name: "生成配置" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭" })).toBeInTheDocument();
  });

  it("adds a reference node from the asset library and persists the layout", async () => {
    vi.useFakeTimers();
    apiMocks.setImageProjectReferenceSelection.mockResolvedValue(project);

    try {
      renderPage(project, emptyLayout);

      fireEvent.click(
        screen.getAllByRole("button", { name: "从资产库添加" })[0]
      );
      fireEvent.click(
        screen.getByRole("button", { name: "添加参考图：参考产品图.png" })
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(apiMocks.setImageProjectReferenceSelection).toHaveBeenCalledWith(
        project.id,
        { asset_ids: [referenceAsset.id] }
      );
      // Reference nodes are numbered「图N」by addition order.
      expect(screen.getByText("图1")).toBeInTheDocument();

      // The debounced saver serializes the new node against the loaded revision.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(apiMocks.saveCanvasLayout).toHaveBeenCalledWith(project.id, {
        expected_revision: emptyLayout.revision,
        nodes: expect.arrayContaining([
          expect.objectContaining({
            asset_id: referenceAsset.id,
            kind: "reference",
            order_index: 1
          })
        ])
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("uploads a local reference image and creates a reference node", async () => {
    apiMocks.uploadImageProjectReference.mockResolvedValue({
      ...referenceAsset,
      id: "reference-upload",
      metadata: { name: "新参考图.png" }
    });
    apiMocks.setImageProjectReferenceSelection.mockResolvedValue({
      ...project,
      assets: [
        ...project.assets,
        {
          ...referenceAsset,
          id: "reference-upload",
          metadata: { name: "新参考图.png" }
        }
      ]
    });

    renderPage(project, emptyLayout);

    const file = new File(["binary"], "新参考图.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("上传参考图"), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(apiMocks.uploadImageProjectReference).toHaveBeenCalledWith(
        project.id,
        file,
        { filename: "新参考图.png", mimeType: "image/png" }
      );
    });
    expect(await screen.findByText("新参考图.png")).toBeInTheDocument();
  });

  it("auto-references a framed bbox into the right dock prompt editor", () => {
    renderPage(project, referenceLayout);

    drawBbox(screen.getByAltText("参考图：参考产品图.png"));

    // The framed region surfaces as a tamper-proof reference card in the dock.
    expect(screen.getByText("图1 框选 #1")).toBeInTheDocument();
    expect(
      screen.getAllByText(/图1<bbox>100 200 800 900<\/bbox>/).length
    ).toBeGreaterThan(0);
  });

  it("removes a reference node without deleting the backend asset", async () => {
    apiMocks.setImageProjectReferenceSelection.mockResolvedValue({
      ...project,
      image_reference_asset_ids: []
    });

    renderPage(project, referenceLayout);

    fireEvent.click(
      screen.getByRole("button", { name: "移除参考图：参考产品图.png" })
    );
    fireEvent.click(screen.getByRole("button", { name: "移除" }));

    await waitFor(() => {
      expect(apiMocks.setImageProjectReferenceSelection).toHaveBeenCalledWith(
        project.id,
        { asset_ids: [] }
      );
    });
  });

  it("generates a text-to-image output when no region is referenced", async () => {
    apiMocks.saveImagePromptVersion.mockResolvedValue({
      id: "prompt-first",
      prompt: "生成首张咖啡机主图"
    });
    apiMocks.generateProjectImage.mockResolvedValue({
      error: null,
      id: "image-task-1",
      output_asset_ids: [],
      status: "queued"
    });
    apiMocks.getTask.mockResolvedValue({
      error: null,
      id: "image-task-1",
      output_asset_ids: [],
      status: "queued"
    });

    renderPage(draftProject, emptyLayout);

    fireEvent.change(screen.getByLabelText("图片提示词"), {
      target: { value: "生成首张咖啡机主图" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成图片" }));

    await waitFor(() => {
      expect(apiMocks.saveImagePromptVersion).toHaveBeenCalledWith(
        draftProject.id,
        { prompt: "生成首张咖啡机主图" }
      );
    });
    expect(apiMocks.generateProjectImage).toHaveBeenCalledWith(draftProject.id, {
      format: "png",
      operation: "text_to_image",
      prompt_version_id: "prompt-first",
      size: "2K"
    });
  });

  it("generates an image-to-image output using the framed region", async () => {
    apiMocks.saveImagePromptVersion.mockResolvedValue({
      id: "prompt-i2i",
      prompt: "只优化选区"
    });
    apiMocks.generateProjectImage.mockResolvedValue({
      error: null,
      id: "image-task-2",
      output_asset_ids: [],
      status: "queued"
    });
    apiMocks.getTask.mockResolvedValue({
      error: null,
      id: "image-task-2",
      output_asset_ids: [],
      status: "queued"
    });

    renderPage(project, referenceLayout);

    drawBbox(screen.getByAltText("参考图：参考产品图.png"));
    fireEvent.change(screen.getByLabelText("图片提示词"), {
      target: { value: "只优化选区" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成图片" }));

    await waitFor(() => {
      expect(apiMocks.generateProjectImage).toHaveBeenCalled();
    });
    const [, promptPayload] = apiMocks.saveImagePromptVersion.mock.calls[0];
    expect(promptPayload.prompt).toContain("图1<bbox>100 200 800 900</bbox>");
    const [, generatePayload] = apiMocks.generateProjectImage.mock.calls[0];
    expect(generatePayload.reference_asset_ids).toEqual([referenceAsset.id]);
    expect(generatePayload.operation).toBe("text_to_image");
  });

  it("exposes a static, accessible pending-output status", () => {
    renderPage(project, pendingOutputLayout);

    const status = screen
      .getByText("生成中，请留在画布查看结果。")
      .closest<HTMLElement>('[role="status"]');

    expect(status).not.toBeNull();
    const loader = status!.querySelector("svg");

    expect(status).toHaveAttribute("aria-live", "polite");
    expect(
      within(status!).getByText("生成中，请留在画布查看结果。")
    ).toBeInTheDocument();
    expect(loader).not.toBeNull();
    expect(loader).not.toHaveClass("animate-spin");
    expect(status!.querySelector(".animate-spin")).toBeNull();
  });

  it("keeps one pending-output polling chain across unrelated node changes and cleans it on unmount", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    apiMocks.getTask.mockResolvedValue({
      error: null,
      id: "task-pending",
      output_asset_ids: [],
      status: "running"
    });
    const view = renderPage(project, pendingOutputLayout);

    try {
      const pollingSchedules = () =>
        setTimeoutSpy.mock.calls.filter((call) => call[1] === 1000).length;
      const schedulesBeforeNodeChanges = pollingSchedules();

      fireEvent.click(
        screen.getByRole("button", { name: "测试节点位置变化" })
      );
      fireEvent.click(
        screen.getByRole("button", { name: "测试节点尺寸变化" })
      );
      fireEvent.click(
        screen.getByRole("button", { name: "测试节点选择变化" })
      );

      expect(pollingSchedules()).toBe(schedulesBeforeNodeChanges);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(apiMocks.getTask).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(apiMocks.getTask).toHaveBeenCalledTimes(2);

      view.unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(apiMocks.getTask).toHaveBeenCalledTimes(2);
    } finally {
      view.unmount();
      setTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("previews and sets an output image as a new reference node", async () => {
    apiMocks.setImageProjectReferenceSelection.mockResolvedValue(project);

    renderPage(project, outputLayout);

    fireEvent.click(
      screen.getByRole("button", { name: "查看原图：生成结果" })
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "查看原图" })
    ).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });

    fireEvent.click(
      screen.getByRole("button", { name: "设为参考图：生成结果" })
    );

    await waitFor(() => {
      expect(apiMocks.setImageProjectReferenceSelection).toHaveBeenCalledWith(
        project.id,
        { asset_ids: [referenceAsset.id, generatedAsset.id] }
      );
    });
    expect(await screen.findByText("图1")).toBeInTheDocument();
  });

  it.each([
    ["text_to_image", "文生图"],
    ["image_to_image", "参考图生图"],
    ["layer_decomposition", "图层拆分"]
  ] as const)(
    "fits a %s output node to the image's native aspect ratio",
    async (source, sourceLabel) => {
      vi.useFakeTimers();
      const layout: CanvasLayout = {
        ...outputLayout,
        nodes: [{ ...outputLayout.nodes[0], source }]
      };

      try {
        renderPage(project, layout);
        const image = screen.getByAltText("生成结果");
        Object.defineProperty(image, "naturalHeight", {
          configurable: true,
          value: 1600
        });
        Object.defineProperty(image, "naturalWidth", {
          configurable: true,
          value: 900
        });

        fireEvent.load(image);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        expect(screen.getByText(sourceLabel)).toBeInTheDocument();
        expect(image).toHaveClass("h-full", "w-full", "object-contain");
        const lastCall = apiMocks.saveCanvasLayout.mock.calls.at(-1);
        expect(lastCall?.[1].nodes[0]).toMatchObject(
          fitOutputNodeSize(900, 1600)
        );
      } finally {
        vi.useRealTimers();
      }
    }
  );

  it("navigates to an existing layer set from an output node", async () => {
    apiMocks.listImageLayerSets.mockResolvedValue([layerSet]);

    renderPage(project, outputLayout);

    const layerButton = await screen.findByRole("button", {
      name: "图层拆分：生成结果"
    });
    await waitFor(() => expect(layerButton).toBeEnabled());
    fireEvent.click(layerButton);

    expect(routerMocks.push).toHaveBeenCalledWith(
      `/projects/${project.id}/canvas/layers/${layerSet.id}`
    );
  });

  it("opens layer decomposition from an output node when no set exists", async () => {
    renderPage(project, outputLayout);

    const layerButton = await screen.findByRole("button", {
      name: "图层拆分：生成结果"
    });
    await waitFor(() => expect(layerButton).toBeEnabled());
    fireEvent.click(layerButton);

    expect(
      screen.getByRole("heading", { name: "创建可编辑图层" })
    ).toBeInTheDocument();
    expect(routerMocks.push).not.toHaveBeenCalled();
  });

  it("navigates to the new layer set once decomposition succeeds", async () => {
    vi.useFakeTimers();
    apiMocks.decomposeImageLayers.mockResolvedValue({
      error: null,
      frozen_input: {
        kind: "layer_decomposition",
        source_asset_id: generatedAsset.id
      },
      id: "layer-task-1",
      output_asset_ids: [],
      stage: "image",
      status: "queued"
    });
    apiMocks.getTask.mockResolvedValue({
      error: null,
      frozen_input: {
        kind: "layer_decomposition",
        source_asset_id: generatedAsset.id
      },
      id: "layer-task-1",
      output_asset_ids: [],
      stage: "image",
      status: "succeeded"
    });
    apiMocks.listImageLayerSets
      .mockResolvedValueOnce([])
      .mockResolvedValue([layerSet]);
    apiMocks.getProject.mockResolvedValue(project);

    try {
      renderPage(project, outputLayout);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      fireEvent.click(
        screen.getByRole("button", { name: "图层拆分：生成结果" })
      );
      fireEvent.click(screen.getByRole("button", { name: "开始拆分" }));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(apiMocks.decomposeImageLayers).toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(routerMocks.push).toHaveBeenCalledWith(
        `/projects/${project.id}/canvas/layers/${layerSet.id}`
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the remote layout on a save conflict and prompts a refresh", async () => {
    vi.useFakeTimers();
    apiMocks.setImageProjectReferenceSelection.mockResolvedValue(project);
    apiMocks.saveCanvasLayout.mockRejectedValue({ status: 409 });

    try {
      renderPage(project, emptyLayout);

      fireEvent.click(
        screen.getAllByRole("button", { name: "从资产库添加" })[0]
      );
      fireEvent.click(
        screen.getByRole("button", { name: "添加参考图：参考产品图.png" })
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
        await Promise.resolve();
      });

      expect(
        screen.getAllByText(/画布布局已在其它位置更新/).length
      ).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the generation dock usable at the narrower fixed width", () => {
    renderPage(project, emptyLayout);

    const dock = screen
      .getByRole("heading", { name: "生成配置" })
      .closest("aside");
    // Task 3: the dock is pinned at the narrower width档位 but every control
    // (aspect / resolution / format / prompt / generate) stays usable.
    expect(dock?.className).toContain("w-72");
    expect(screen.getByLabelText("画幅")).toBeInTheDocument();
    expect(screen.getByLabelText("画布分辨率")).toBeInTheDocument();
    expect(screen.getByLabelText("画布输出格式")).toBeInTheDocument();
    expect(screen.getByLabelText("图片提示词")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "生成图片" })
    ).toBeInTheDocument();
  });

  it("pads the remove-reference confirmation dialog on all sides", () => {
    renderPage(project, referenceLayout);

    fireEvent.click(
      screen.getByRole("button", { name: "移除参考图：参考产品图.png" })
    );

    // Task 2: the confirmation content is padded so title/description/buttons
    // no longer touch the dialog edge.
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("p-6");
    expect(
      within(dialog).getByRole("heading", { name: "移除参考图节点" })
    ).toBeInTheDocument();
  });

  it("reshapes a new reference node to the image's native aspect ratio", async () => {
    vi.useFakeTimers();
    apiMocks.setImageProjectReferenceSelection.mockResolvedValue(project);

    const originalImage = window.Image;
    // jsdom never loads images, so drive `new window.Image()` deterministically:
    // report a 1600x900 landscape source and fire onload on the next microtask.
    class FakeImage {
      naturalHeight = 900;
      naturalWidth = 1600;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Image = FakeImage;

    try {
      renderPage(project, emptyLayout);

      fireEvent.click(
        screen.getAllByRole("button", { name: "从资产库添加" })[0]
      );
      fireEvent.click(
        screen.getByRole("button", { name: "添加参考图：参考产品图.png" })
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      // Flush the debounced saver after the async onload resize commits.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
        await Promise.resolve();
      });

      const expected = fitReferenceNodeSize(1600, 900);
      const lastCall = apiMocks.saveCanvasLayout.mock.calls.at(-1);
      const savedNode = lastCall?.[1].nodes.find(
        (node: CanvasNode) => node.kind === "reference"
      );
      expect(savedNode).toMatchObject({
        height: expected.height,
        width: expected.width
      });
      // A landscape source is not square-cropped.
      expect(expected.width).not.toBe(expected.height);
      expect(screen.getByAltText("参考图：参考产品图.png")).toHaveClass(
        "h-full",
        "w-full",
        "object-contain"
      );
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Image = originalImage;
      vi.useRealTimers();
    }
  });

  it("migrates a legacy reference size once and persists the corrected size", async () => {
    vi.useFakeTimers();
    try {
      const firstRender = renderPage(project, referenceLayout);
      const legacyImage = screen.getByAltText("参考图：参考产品图.png");
      Object.defineProperty(legacyImage, "naturalHeight", {
        configurable: true,
        value: 900
      });
      Object.defineProperty(legacyImage, "naturalWidth", {
        configurable: true,
        value: 1600
      });

      fireEvent.load(legacyImage);
      fireEvent.load(legacyImage);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      const migratedSize = fitReferenceNodeSize(1600, 900);
      expect(apiMocks.saveCanvasLayout).toHaveBeenCalledTimes(1);
      expect(apiMocks.saveCanvasLayout.mock.calls[0]?.[1].nodes[0]).toMatchObject(
        migratedSize
      );

      firstRender.unmount();
      apiMocks.saveCanvasLayout.mockClear();
      const migratedLayout: CanvasLayout = {
        ...referenceLayout,
        nodes: [{ ...referenceNode, ...migratedSize }]
      };
      renderPage(project, migratedLayout);
      const migratedImage = screen.getByAltText("参考图：参考产品图.png");
      Object.defineProperty(migratedImage, "naturalHeight", {
        configurable: true,
        value: 900
      });
      Object.defineProperty(migratedImage, "naturalWidth", {
        configurable: true,
        value: 1600
      });

      fireEvent.load(migratedImage);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(apiMocks.saveCanvasLayout).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries migration after the first load observes a stale controlled size", async () => {
    vi.useFakeTimers();
    try {
      const migratedLayout: CanvasLayout = {
        ...referenceLayout,
        nodes: [
          {
            ...referenceNode,
            height: 242,
            width: 540
          }
        ]
      };
      renderPage(project, migratedLayout);

      fireEvent.click(
        screen.getByRole("button", { name: "测试滞后快照首次加载" })
      );
      const flowNode = screen.getByTestId("flow-node-reference-node-1");
      expect(flowNode).toHaveStyle({ height: "190px", width: "520px" });

      const image = screen.getByAltText("参考图：参考产品图.png");
      Object.defineProperty(image, "naturalHeight", {
        configurable: true,
        value: 542
      });
      Object.defineProperty(image, "naturalWidth", {
        configurable: true,
        value: 1472
      });
      fireEvent.load(image);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(flowNode).toHaveStyle({ height: "242px", width: "540px" });
      expect(apiMocks.saveCanvasLayout).toHaveBeenCalledTimes(1);
      expect(apiMocks.saveCanvasLayout.mock.calls[0]?.[1].nodes[0]).toMatchObject(
        { height: 242, width: 540 }
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("prefers explicit dimensions over stale measured dimensions when saving", async () => {
    vi.useFakeTimers();
    try {
      const logoAsset: Asset = {
        ...referenceAsset,
        metadata: { name: "乐橙logo.png" }
      };
      const logoProject: Project = {
        ...project,
        assets: [generatedAsset, logoAsset]
      };
      const logoLayout: CanvasLayout = {
        ...referenceLayout,
        nodes: [{ ...referenceNode, height: 190, width: 520 }]
      };
      renderPage(logoProject, logoLayout);

      // React Flow measures mounted nodes and stores those dimensions separately
      // from the controlled width/height fields.
      fireEvent.click(screen.getByRole("button", { name: "测试节点测量" }));

      const logoImage = screen.getByAltText("参考图：乐橙logo.png");
      Object.defineProperty(logoImage, "naturalHeight", {
        configurable: true,
        value: 542
      });
      Object.defineProperty(logoImage, "naturalWidth", {
        configurable: true,
        value: 1472
      });
      fireEvent.load(logoImage);

      const flowNode = screen.getByTestId("flow-node-reference-node-1");
      expect(flowNode).toHaveStyle({ height: "242px", width: "540px" });
      expect(flowNode).toHaveAttribute("data-effective-height", "242");
      expect(flowNode).toHaveAttribute("data-effective-width", "540");
      expect(flowNode).toHaveAttribute("data-measured-height", "190");
      expect(flowNode).toHaveAttribute("data-measured-width", "520");

      fireEvent.load(logoImage);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(apiMocks.saveCanvasLayout).toHaveBeenCalledTimes(1);
      expect(apiMocks.saveCanvasLayout.mock.calls[0]?.[1].nodes[0]).toMatchObject(
        { height: 242, width: 540 }
      );
      expect(flowNode).toHaveStyle({ height: "242px", width: "540px" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the bbox aligned to the actual image rect after resize and zoom", async () => {
    const fittedSize = fitReferenceNodeSize(1600, 900);
    const layout: CanvasLayout = {
      ...referenceLayout,
      nodes: [
        {
          ...referenceNode,
          ...fittedSize,
          bbox: { type: "bbox", x1: 100, x2: 900, y1: 200, y2: 800 }
        }
      ]
    };
    renderPage(project, layout);

    const image = screen.getByAltText("参考图：参考产品图.png");
    const mediaBox = image.parentElement?.parentElement;
    expect(mediaBox).not.toBeNull();

    let imageRect = {
      bottom: 170,
      height: 100,
      left: 110,
      right: 310,
      top: 70,
      width: 200
    };
    let layoutWidth = 200;
    Object.defineProperty(image, "naturalHeight", {
      configurable: true,
      value: 900
    });
    Object.defineProperty(image, "naturalWidth", {
      configurable: true,
      value: 1600
    });
    Object.defineProperty(image, "offsetWidth", {
      configurable: true,
      get: () => layoutWidth
    });
    Object.defineProperty(image, "getBoundingClientRect", {
      configurable: true,
      value: () => imageRect
    });
    Object.defineProperty(mediaBox, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 180,
        height: 120,
        left: 100,
        right: 320,
        top: 60,
        width: 220
      })
    });

    fireEvent.load(image);

    const overlay = screen.getByRole("button", {
      name: "删除框选区域"
    }).parentElement?.parentElement;
    await waitFor(() => {
      expect(overlay).toHaveStyle({
        height: "100px",
        left: "10px",
        top: "10px",
        width: "200px"
      });
    });

    layoutWidth = 300;
    imageRect = {
      bottom: 280,
      height: 200,
      left: 120,
      right: 720,
      top: 80,
      width: 600
    };
    fireEvent.pointerMove(image, { clientX: 400, clientY: 180 });

    await waitFor(() => {
      expect(overlay).toHaveStyle({
        height: "100px",
        left: "10px",
        top: "10px",
        width: "300px"
      });
    });
  });

  it("normalizes a reference resize against the media aspect ratio", async () => {
    vi.useFakeTimers();
    const currentSize = fitReferenceNodeSize(1600, 900);
    const layout: CanvasLayout = {
      ...referenceLayout,
      nodes: [{ ...referenceNode, ...currentSize }]
    };
    try {
      renderPage(project, layout);
      const image = screen.getByAltText("参考图：参考产品图.png");
      Object.defineProperty(image, "naturalHeight", {
        configurable: true,
        value: 900
      });
      Object.defineProperty(image, "naturalWidth", {
        configurable: true,
        value: 1600
      });
      fireEvent.load(image);
      await act(async () => {
        await Promise.resolve();
      });

      fireEvent.click(
        screen.getByRole("button", { name: "测试节点尺寸变化" })
      );
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      const expected = resizeReferenceNodeSize(
        currentSize.width + 10,
        currentSize.height + 10,
        currentSize.width,
        currentSize.height,
        16 / 9
      );
      expect(apiMocks.saveCanvasLayout.mock.calls[0]?.[1].nodes[0]).toMatchObject(
        expected
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes a framed region reference card from the prompt editor", () => {
    renderPage(project, referenceLayout);

    drawBbox(screen.getByAltText("参考图：参考产品图.png"));
    expect(screen.getByText("图1 框选 #1")).toBeInTheDocument();
    expect(
      screen.getAllByText(/图1<bbox>100 200 800 900<\/bbox>/).length
    ).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", { name: "移除框选引用：图1" })
    );

    // The card, the derived prompt reference, and the node's framing overlay all
    // clear together once the underlying bbox is nulled.
    expect(screen.queryByText("图1 框选 #1")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/图1<bbox>100 200 800 900<\/bbox>/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "删除框选区域" })
    ).not.toBeInTheDocument();
  });
});

describe("fitNodeSize", () => {
  it("fits a landscape source to the base width", () => {
    expect(fitNodeSize(1600, 900)).toEqual({ height: 146, width: 260 });
  });

  it("fits a portrait source to the base height", () => {
    expect(fitNodeSize(900, 1600)).toEqual({ height: 260, width: 146 });
  });

  it("keeps square sources square", () => {
    expect(fitNodeSize(500, 500)).toEqual({ height: 260, width: 260 });
  });

  it("clamps an extreme aspect to the minimum edge", () => {
    expect(fitNodeSize(2600, 100)).toEqual({ height: 80, width: 2080 });
  });

  it("falls back to a square when dimensions are unusable", () => {
    expect(fitNodeSize(0, 0)).toEqual({ height: 260, width: 260 });
    expect(fitNodeSize(-10, 200)).toEqual({ height: 260, width: 260 });
  });
});

describe("reference node sizing", () => {
  it.each([
    [1600, 900, { height: 198, width: 280 }],
    [900, 1600, { height: 312, width: 166 }],
    [500, 500, { height: 312, width: 280 }],
    [2600, 100, { height: 132, width: 2100 }]
  ])(
    "adds fixed node chrome around a %sx%s media box",
    (naturalWidth, naturalHeight, expected) => {
      const mediaSize = fitNodeSize(naturalWidth, naturalHeight);
      const nodeSize = fitReferenceNodeSize(naturalWidth, naturalHeight);

      expect(nodeSize).toEqual(expected);
      expect(nodeSize.width - mediaSize.width).toBe(
        REFERENCE_NODE_HORIZONTAL_CHROME
      );
      expect(nodeSize.height - mediaSize.height).toBe(
        REFERENCE_NODE_VERTICAL_CHROME
      );
    }
  );

  it.each([
    [0, 0],
    [-10, 200],
    [200, -10]
  ])(
    "uses the fallback media size before adding chrome for %sx%s",
    (width, height) => {
      expect(fitReferenceNodeSize(width, height)).toEqual({
        height: 260 + REFERENCE_NODE_VERTICAL_CHROME,
        width: 260 + REFERENCE_NODE_HORIZONTAL_CHROME
      });
    }
  );

  it("derives total resize dimensions from the media aspect ratio", () => {
    expect(resizeReferenceNodeSize(420, 198, 280, 198, 16 / 9)).toEqual({
      height: 277,
      width: 420
    });
    expect(resizeReferenceNodeSize(60, 60, 2100, 132, 26)).toEqual({
      height: 132,
      width: 2100
    });
  });

  it("distinguishes legacy media-only dimensions from migrated outer sizes", () => {
    expect(isLegacyReferenceNodeSize(260, 146, 16 / 9)).toBe(true);
    expect(isLegacyReferenceNodeSize(280, 198, 16 / 9)).toBe(false);
    expect(isLegacyReferenceNodeSize(520, 190, 1472 / 542)).toBe(true);
    expect(isLegacyReferenceNodeSize(540, 242, 1472 / 542)).toBe(false);
  });
});

describe("fitOutputNodeSize", () => {
  it("adds fixed node chrome around a landscape image area", () => {
    expect(fitOutputNodeSize(1600, 900)).toEqual({
      height: 228,
      width: 270
    });
  });

  it("adds fixed node chrome around a portrait image area", () => {
    expect(fitOutputNodeSize(900, 1600)).toEqual({
      height: 342,
      width: 156
    });
  });

  it("adds fixed node chrome around a square image area", () => {
    expect(fitOutputNodeSize(500, 500)).toEqual({
      height: 342,
      width: 270
    });
  });

  it("keeps the default node size when dimensions are unusable", () => {
    expect(fitOutputNodeSize(0, 0)).toEqual({ height: 260, width: 260 });
  });
});
