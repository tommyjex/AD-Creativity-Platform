import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clampLayerScale,
  getLayerFrame,
  LayerEditorDialog,
  moveLayer,
  positionFromDrag,
  scaleFromResize
} from "@/components/workspace/layer-editor-dialog";
import { ApiError } from "@/lib/api-client";
import type {
  Asset,
  ImageLayer,
  ImageLayerSetDetail
} from "@/lib/api-types";

const apiMocks = vi.hoisted(() => ({
  composeImageLayers: vi.fn(),
  getAsset: vi.fn(),
  getImageLayerSet: vi.fn(),
  getTask: vi.fn(),
  retryTask: vi.fn(),
  updateImageLayerSet: vi.fn()
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...original,
    apiClient: apiMocks
  };
});

function asset(id: string, role: Asset["asset_role"], url: string): Asset {
  return {
    asset_role: role,
    category: null,
    created_at: "2026-08-16T08:00:00Z",
    id,
    metadata: {},
    mime_type: "image/png",
    object_key: `private/${id}.png`,
    project_id: "project-1",
    size_bytes: 100,
    source_task_id: "task-1",
    stage: "image",
    status: "succeeded",
    type: "generated_image",
    updated_at: "2026-08-16T08:00:00Z",
    url
  };
}

const layers: ImageLayer[] = [
  {
    asset_id: "asset-layer-1",
    bbox_absolute: [100, 50, 300, 250],
    bbox_normalized: [100, 100, 300, 500],
    description: "商品主体",
    id: "layer-1",
    name: "商品",
    scale: 1,
    set_id: "set-1",
    visible: true,
    x: 100,
    y: 50,
    z_index: 1
  },
  {
    asset_id: "asset-layer-2",
    bbox_absolute: [400, 100, 600, 200],
    bbox_normalized: [400, 200, 600, 400],
    description: "前景标签",
    id: "layer-2",
    name: "标签",
    scale: 1,
    set_id: "set-1",
    visible: true,
    x: 400,
    y: 100,
    z_index: 2
  }
];

const layerSet: ImageLayerSetDetail = {
  base_asset: asset("base-1", "internal_base", "https://assets/base.png"),
  base_asset_id: "base-1",
  canvas_height: 500,
  canvas_width: 1000,
  created_at: "2026-08-16T08:00:00Z",
  id: "set-1",
  layers,
  layers_assets: [
    asset("asset-layer-1", "internal_layer", "https://assets/layer-1.png"),
    asset("asset-layer-2", "internal_layer", "https://assets/layer-2.png")
  ],
  project_id: "project-1",
  revision: 3,
  source_asset_id: "source-1",
  status: "succeeded",
  updated_at: "2026-08-16T08:00:00Z"
};

function renderEditor(
  props: Partial<React.ComponentProps<typeof LayerEditorDialog>> = {}
) {
  const onLayerSetChange = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <LayerEditorDialog
      initialLayerSet={layerSet}
      onLayerSetChange={onLayerSetChange}
      onOpenChange={onOpenChange}
      open
      {...props}
    />
  );
  return { onLayerSetChange, onOpenChange };
}

describe("图层编辑器", () => {
  beforeEach(() => {
    apiMocks.composeImageLayers.mockReset();
    apiMocks.getAsset.mockReset();
    apiMocks.getImageLayerSet.mockReset();
    apiMocks.getTask.mockReset();
    apiMocks.retryTask.mockReset();
    apiMocks.updateImageLayerSet.mockReset();
  });

  it("按底图像素、bbox 和 z_index 计算初始几何", () => {
    expect(getLayerFrame(layers[0], 1000, 500)).toEqual({
      heightPercent: 40,
      leftPercent: 10,
      topPercent: 10,
      widthPercent: 20
    });
    expect(
      positionFromDrag(
        { x: 100, y: 50 },
        50,
        25,
        500,
        250,
        1000,
        500
      )
    ).toEqual({ x: 200, y: 100 });
    expect(clampLayerScale(0)).toBe(0.05);
    expect(clampLayerScale(21)).toBe(20);
    expect(
      scaleFromResize(
        { layerHeight: 200, layerWidth: 200, scale: 1 },
        50,
        50,
        500,
        250,
        1000,
        500
      )
    ).toBe(1.5);
    expect(
      scaleFromResize(
        { layerHeight: 200, layerWidth: 200, scale: 1 },
        -1000,
        -1000,
        500,
        250,
        1000,
        500
      )
    ).toBe(0.05);
  });

  it("真实渲染底图和透明层，并提供锁定底图与移动折叠结构", () => {
    renderEditor();

    expect(screen.getByAltText("锁定底图")).toHaveAttribute(
      "src",
      "https://assets/base.png"
    );
    expect(screen.getByAltText("商品")).toHaveAttribute(
      "src",
      "https://assets/layer-1.png"
    );
    expect(screen.getByTestId("canvas-layer-layer-1")).toHaveStyle({
      height: "40%",
      left: "10%",
      top: "10%",
      width: "20%",
      zIndex: "1"
    });
    expect(screen.getByLabelText("底图锁定")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /删除/ })).not.toBeInTheDocument();

    const panel = screen.getByTestId("layer-panel");
    const toggle = within(panel).getByRole("button", {
      name: /图层与变换/
    });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("拖拽按画布显示比例换算为底图像素坐标", () => {
    renderEditor();
    const canvas = screen.getByTestId("layer-canvas");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      bottom: 250,
      height: 250,
      left: 0,
      right: 500,
      top: 0,
      width: 500,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });
    const layer = screen.getByTestId("canvas-layer-layer-1");
    fireEvent.pointerDown(layer, {
      clientX: 100,
      clientY: 100,
      pointerId: 1
    });
    fireEvent.pointerMove(layer, {
      clientX: 150,
      clientY: 125,
      pointerId: 1
    });
    fireEvent.pointerUp(layer, { pointerId: 1 });

    expect(screen.getByLabelText("X 坐标")).toHaveValue(200);
    expect(screen.getByLabelText("Y 坐标")).toHaveValue(100);
  });

  it("选中图层后拖拽右下角手柄，以左上角为锚点等比缩放", () => {
    renderEditor();
    const canvas = screen.getByTestId("layer-canvas");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      bottom: 250,
      height: 250,
      left: 0,
      right: 500,
      top: 0,
      width: 500,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });

    expect(screen.getByTestId("resize-handle-layer-2")).toBeInTheDocument();
    expect(
      screen.queryByTestId("resize-handle-layer-1")
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "选择图层 商品" }));
    const handle = screen.getByRole("slider", {
      name: "等比缩放图层 商品"
    });
    expect(
      screen.queryByTestId("resize-handle-layer-2")
    ).not.toBeInTheDocument();

    fireEvent.pointerDown(handle, {
      clientX: 200,
      clientY: 150,
      pointerId: 2
    });
    fireEvent.pointerMove(handle, {
      clientX: 250,
      clientY: 200,
      pointerId: 2
    });
    fireEvent.pointerUp(handle, { pointerId: 2 });

    expect(screen.getByLabelText("图层缩放数值")).toHaveValue(1.5);
    expect(screen.getByLabelText("X 坐标")).toHaveValue(100);
    expect(screen.getByLabelText("Y 坐标")).toHaveValue(50);
    expect(screen.getByTestId("canvas-layer-layer-1")).toHaveStyle({
      height: "60%",
      left: "10%",
      top: "10%",
      width: "30%"
    });
  });

  it("支持显隐、排序、缩放并提交完整 revision 状态", async () => {
    const moved = moveLayer(layers, "layer-1", "up");
    expect(moved.map((layer) => [layer.id, layer.z_index])).toEqual([
      ["layer-2", 1],
      ["layer-1", 2]
    ]);
    const updated: ImageLayerSetDetail = {
      ...layerSet,
      layers: moved.map((layer) =>
        layer.id === "layer-1"
          ? { ...layer, scale: 2.5, visible: false }
          : layer
      ),
      revision: 4
    };
    apiMocks.updateImageLayerSet.mockResolvedValue(updated);
    const { onLayerSetChange } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "选择图层 商品" }));
    fireEvent.click(screen.getByRole("button", { name: "隐藏图层 商品" }));
    fireEvent.click(screen.getByRole("button", { name: "上移图层 商品" }));
    fireEvent.change(screen.getByLabelText("图层缩放数值"), {
      target: { value: "2.5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存图层" }));

    await waitFor(() => {
      expect(apiMocks.updateImageLayerSet).toHaveBeenCalledWith(
        "project-1",
        "set-1",
        {
          expected_revision: 3,
          layers: [
            {
              id: "layer-2",
              scale: 1,
              visible: true,
              x: 400,
              y: 100,
              z_index: 1
            },
            {
              id: "layer-1",
              scale: 2.5,
              visible: false,
              x: 100,
              y: 50,
              z_index: 2
            }
          ]
        }
      );
    });
    expect(onLayerSetChange).toHaveBeenCalledWith(updated);
    expect(screen.getAllByText(/Revision 4/)).toHaveLength(2);
  });

  it("409 时保留草稿并可重新加载服务端状态", async () => {
    apiMocks.updateImageLayerSet.mockRejectedValue(
      new ApiError({
        code: "task_conflict",
        message: "image layer set revision conflict",
        responseBody: null,
        status: 409
      })
    );
    const serverState = {
      ...layerSet,
      layers: layers.map((layer) =>
        layer.id === "layer-2" ? { ...layer, x: 450 } : layer
      ),
      revision: 4
    };
    apiMocks.getImageLayerSet.mockResolvedValue(serverState);
    renderEditor();

    fireEvent.change(screen.getByLabelText("图层缩放数值"), {
      target: { value: "1.5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存图层" }));
    expect(
      await screen.findByText(/保存冲突：服务端已有更新/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText("图层缩放数值")).toHaveValue(1.5);

    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    await waitFor(() => {
      expect(apiMocks.getImageLayerSet).toHaveBeenCalledWith(
        "project-1",
        "set-1",
        { cache: "no-store" }
      );
    });
    expect(screen.getByText(/已重新加载 Revision 4/)).toBeInTheDocument();
  });

  it("关闭未保存编辑时要求确认", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    const { onOpenChange } = renderEditor();
    fireEvent.change(screen.getByLabelText("图层缩放数值"), {
      target: { value: "1.5" }
    });

    fireEvent.click(screen.getByRole("button", { name: "关闭图层编辑器" }));
    expect(confirm).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "关闭图层编辑器" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    confirm.mockRestore();
  });

  it("仅导出已保存 revision，并在成功后显示成品", async () => {
    const resultAsset = asset(
      "result-1",
      "public",
      "/api/assets/result-1/content"
    );
    apiMocks.composeImageLayers.mockResolvedValue({
      error: null,
      frozen_input: {},
      id: "task-compose",
      input_hash: "hash",
      output_asset_ids: ["result-1"],
      output_text_artifact_id: null,
      progress: 1,
      progress_message: null,
      project_id: "project-1",
      retry_of_task_id: null,
      stage: "image",
      status: "succeeded"
    });
    apiMocks.getAsset.mockResolvedValue(resultAsset);
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "导出成品" }));
    await waitFor(() =>
      expect(apiMocks.composeImageLayers).toHaveBeenCalledWith("project-1", {
        expected_revision: 3,
        layer_set_id: "set-1",
        set_current: true
      })
    );
    expect(await screen.findByText("成品已导出并设为当前图片。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看成品" })).toHaveAttribute(
      "href",
      "http://localhost:8000/api/assets/result-1/content"
    );
  });

  it("dirty 时禁用导出，失败后可按冻结输入重试", async () => {
    const failedTask = {
      error: { code: "generation_failed", detail: null, message: "合成失败" },
      frozen_input: {},
      id: "task-failed",
      input_hash: "hash",
      output_asset_ids: [],
      output_text_artifact_id: null,
      progress: 1,
      progress_message: null,
      project_id: "project-1",
      retry_of_task_id: null,
      stage: "image",
      status: "failed"
    };
    const succeededTask = {
      ...failedTask,
      error: null,
      id: "task-retry",
      output_asset_ids: ["result-2"],
      retry_of_task_id: "task-failed",
      status: "succeeded"
    };
    apiMocks.composeImageLayers.mockResolvedValue(failedTask);
    apiMocks.retryTask.mockResolvedValue(succeededTask);
    apiMocks.getAsset.mockResolvedValue(
      asset("result-2", "public", "/api/assets/result-2/content")
    );
    renderEditor();

    fireEvent.change(screen.getByLabelText("图层缩放数值"), {
      target: { value: "1.5" }
    });
    const exportButton = screen.getByRole("button", { name: "导出成品" });
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAttribute("title", "请先保存图层修改再导出");
    fireEvent.change(screen.getByLabelText("图层缩放数值"), {
      target: { value: "1" }
    });
    fireEvent.click(exportButton);

    expect(await screen.findByText("合成失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试导出" }));
    await waitFor(() =>
      expect(apiMocks.retryTask).toHaveBeenCalledWith("task-failed")
    );
    expect(await screen.findByText("成品已导出并设为当前图片。")).toBeInTheDocument();
  });
});
