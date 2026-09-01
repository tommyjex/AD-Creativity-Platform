import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AigcLayerEditor } from "@/components/workspace/aigc/aigc-layer-editor";
import { AigcQueryProvider } from "@/components/workspace/aigc/providers/aigc-query-provider";
import { ApiError } from "@/lib/api-client";
import type { AigcLayerSet, AigcPipeline } from "@/lib/aigc/types";
import type { Asset } from "@/lib/api-types";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const apiMocks = vi.hoisted(() => ({
  createAigcRun: vi.fn(),
  getAigcInternalRunAsset: vi.fn(),
  updateAigcPipeline: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      createAigcRun: apiMocks.createAigcRun,
      getAigcInternalRunAsset: apiMocks.getAigcInternalRunAsset,
      updateAigcPipeline: apiMocks.updateAigcPipeline
    }
  };
});

const digest = "a".repeat(64);
const layerSet: AigcLayerSet = {
  id: "set-1",
  parent_layer_set_id: null,
  source_asset_id: "source",
  base_asset_id: "base",
  canvas_width: 1000,
  canvas_height: 500,
  version: 0,
  digest,
  layers: [
    {
      id: "layer-1",
      asset_id: "asset-1",
      z_index: 1,
      name: "商品",
      description: "商品主体",
      bbox_absolute: [100, 50, 300, 250],
      bbox_normalized: [100, 100, 300, 500],
      visible: true,
      x: 100,
      y: 50,
      scale: 1
    },
    {
      id: "layer-2",
      asset_id: "asset-2",
      z_index: 2,
      name: "文字",
      description: "标题文字",
      bbox_absolute: [400, 100, 700, 200],
      bbox_normalized: [400, 200, 700, 400],
      visible: true,
      x: 400,
      y: 100,
      scale: 1
    }
  ]
};

const pipeline: AigcPipeline = {
  id: "pipeline-1",
  name: "图层流程",
  description: "测试",
  definition: {
    schemaVersion: 1,
    nodes: [
      {
        id: "canvas-node",
        type: "layer_canvas",
        position: { x: 0, y: 0 },
        size: { width: 260, height: 220 },
        config: {
          selected_layer_id: "layer-1",
          source_layer_set: { id: "set-1", version: 0, digest },
          transform_patches: [{ layer_id: "layer-1", x: 150, scale: 1.2 }]
        }
      }
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  },
  source_template_id: null,
  source_template_revision: null,
  revision: 7,
  latest_run_status: "succeeded",
  created_at: "2026-08-30T10:00:00Z",
  updated_at: "2026-08-30T10:00:00Z"
};

function asset(id: string): Asset {
  return {
    id,
    project_id: null,
    type: "generated_image",
    stage: "image",
    category: null,
    asset_role: id === "base" ? "internal_base" : "internal_layer",
    status: "succeeded",
    object_key: `private/${id}.png`,
    url: `https://assets.local/${id}.png`,
    mime_type: "image/png",
    size_bytes: 100,
    source_task_id: "task-1",
    metadata: {},
    created_at: "2026-08-30T10:00:00Z",
    updated_at: "2026-08-30T10:00:00Z"
  };
}

function renderEditor(
  sourcePipeline: AigcPipeline = pipeline,
  sourceLayerSet: AigcLayerSet = layerSet
) {
  return render(
    <AigcQueryProvider>
      <AigcLayerEditor
        layerSet={sourceLayerSet}
        nodeId="canvas-node"
        pipeline={sourcePipeline}
        runId="run-17"
      />
    </AigcQueryProvider>
  );
}

describe("AigcLayerEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getAigcInternalRunAsset.mockImplementation(
      (_pipelineId: string, _runId: string, id: string) =>
      Promise.resolve(asset(id))
    );
    apiMocks.updateAigcPipeline.mockResolvedValue({
      ...pipeline,
      revision: 8
    });
  });

  it("restores the saved draft and keeps the base image locked", async () => {
    renderEditor();

    expect(screen.getByLabelText("X 坐标")).toHaveValue(150);
    expect(screen.getByLabelText("图层缩放数值")).toHaveValue(1.2);
    expect(screen.getByLabelText("底图锁定")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除图层 底图" })).toBeNull();
    expect(screen.getByRole("button", { name: "保存到节点" })).toBeDisabled();
    expect(await screen.findByAltText("锁定底图")).toHaveAttribute(
      "src",
      "https://assets.local/base.png"
    );
    expect(apiMocks.getAigcInternalRunAsset).toHaveBeenCalledWith(
      "pipeline-1",
      "run-17",
      "base"
    );
  });

  it("keeps available previews when one internal layer asset fails", async () => {
    apiMocks.getAigcInternalRunAsset.mockImplementation(
      (_pipelineId: string, _runId: string, id: string) =>
        id === "asset-1"
          ? Promise.reject(new Error("missing layer"))
          : Promise.resolve(asset(id))
    );

    renderEditor();

    expect(await screen.findByAltText("锁定底图")).toBeInTheDocument();
    expect(await screen.findByAltText("文字")).toHaveAttribute(
      "src",
      "https://assets.local/asset-2.png"
    );
    expect(screen.queryByAltText("商品")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "图层资产加载失败：asset-1"
    );
  });

  it("keeps every editor region reachable in the responsive mobile flow", () => {
    renderEditor();

    expect(screen.getByTestId("aigc-layer-editor-workspace")).toHaveClass(
      "flex",
      "flex-col",
      "overflow-y-auto",
      "lg:grid",
      "lg:overflow-hidden"
    );
    expect(screen.getByTestId("aigc-layer-editor-toolbar")).toHaveClass(
      "overflow-x-auto",
      "lg:flex-col"
    );
    expect(screen.getByTestId("aigc-layer-editor-canvas-region")).toHaveClass(
      "min-h-[24rem]",
      "lg:min-h-0"
    );
    expect(screen.getByTestId("aigc-layer-editor-sidebar")).toHaveClass(
      "border-t",
      "lg:border-l"
    );
    expect(screen.getByLabelText("X 坐标")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存到节点" })).toBeVisible();
  });

  it("supports selection, movement, scaling, ordering, visibility, deletion, undo, and redo", () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText("X 坐标"), {
      target: { value: "220" }
    });
    fireEvent.change(screen.getByLabelText("图层缩放数值"), {
      target: { value: "1.5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "隐藏图层 商品" }));
    fireEvent.click(screen.getByRole("button", { name: "上移图层 商品" }));
    fireEvent.click(screen.getByRole("button", { name: "选择图层 文字" }));
    fireEvent.click(screen.getByRole("button", { name: "删除图层 文字" }));

    expect(screen.queryByRole("button", { name: "选择图层 文字" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(screen.getByRole("button", { name: "选择图层 文字" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重做" }));
    expect(screen.queryByRole("button", { name: "选择图层 文字" })).toBeNull();
  });

  it("saves only the target node config with expected revision and does not run", async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText("X 坐标"), {
      target: { value: "240" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存到节点" }));

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledWith(
        "pipeline-1",
        expect.objectContaining({
          expected_revision: 7,
          name: pipeline.name,
          description: pipeline.description,
          definition: expect.objectContaining({
            nodes: [
              expect.objectContaining({
                id: "canvas-node",
                config: {
                  selected_layer_id: "layer-1",
                  source_layer_set: { id: "set-1", version: 0, digest },
                  transform_patches: [
                    { layer_id: "layer-1", scale: 1.2, x: 240 }
                  ]
                }
              })
            ]
          })
        })
      );
    });
    expect(apiMocks.createAigcRun).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      "/workspace/aigc/pipelines/pipeline-1"
    );
  });

  it("keeps the local draft after a revision conflict", async () => {
    apiMocks.updateAigcPipeline.mockRejectedValue(
      new ApiError({
        code: "invalid_state",
        message: "revision conflict",
        responseBody: null,
        status: 409
      })
    );
    renderEditor();
    fireEvent.change(screen.getByLabelText("X 坐标"), {
      target: { value: "333" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存到节点" }));

    expect(
      await screen.findByText(/保存冲突：Pipeline 已被更新/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText("X 坐标")).toHaveValue(333);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("marks a changed upstream digest stale and refuses to apply old patches", () => {
    renderEditor(pipeline, { ...layerSet, digest: "b".repeat(64) });

    expect(screen.getByText(/上游图层集已变化/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "选择图层 商品" }));
    expect(screen.getByLabelText("X 坐标")).toHaveValue(100);
    expect(screen.getByRole("button", { name: "保存到节点" })).toBeEnabled();
  });

  it("blocks unload and return while the local draft is dirty", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderEditor();
    fireEvent.change(screen.getByLabelText("X 坐标"), {
      target: { value: "260" }
    });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    fireEvent.click(screen.getByRole("button", { name: "返回 AIGC 画布" }));

    expect(event.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
