import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LayerEditorPage } from "@/components/workspace/layer-editor-page";
import type { Asset, ImageLayer, ImageLayerSetDetail } from "@/lib/api-types";

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks
}));

const apiMocks = vi.hoisted(() => ({
  composeImageLayers: vi.fn(),
  editImageLayerContent: vi.fn(),
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
    asset("asset-layer-1", "internal_layer", "https://assets/layer-1.png")
  ],
  project_id: "project-1",
  revision: 3,
  source_asset_id: "source-1",
  status: "succeeded",
  updated_at: "2026-08-16T08:00:00Z"
};

describe("LayerEditorPage", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    Object.values(routerMocks).forEach((mock) => mock.mockReset());
  });

  it("renders the layer editor for the provided layer set", () => {
    render(<LayerEditorPage initialLayerSet={layerSet} projectId="project-1" />);

    expect(screen.getByAltText("锁定底图")).toHaveAttribute(
      "src",
      "https://assets/base.png"
    );
    expect(screen.getByAltText("商品")).toBeInTheDocument();
    expect(screen.getAllByText(/Revision 3/).length).toBeGreaterThan(0);
  });

  it("navigates back to the canvas route when closed without unsaved changes", () => {
    render(<LayerEditorPage initialLayerSet={layerSet} projectId="project-1" />);

    fireEvent.click(screen.getByRole("button", { name: "关闭图层编辑器" }));

    expect(routerMocks.push).toHaveBeenCalledWith("/projects/project-1/canvas");
  });

  it("keeps the editor open when the unsaved-change confirmation is declined", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<LayerEditorPage initialLayerSet={layerSet} projectId="project-1" />);

    fireEvent.change(screen.getByLabelText("图层缩放数值"), {
      target: { value: "1.5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "关闭图层编辑器" }));

    expect(confirm).toHaveBeenCalled();
    expect(routerMocks.push).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("updates the local layer set after a successful save", async () => {
    const saved: ImageLayerSetDetail = {
      ...layerSet,
      layers: [{ ...layers[0], scale: 1.5 }],
      revision: 4
    };
    apiMocks.updateImageLayerSet.mockResolvedValue(saved);

    render(<LayerEditorPage initialLayerSet={layerSet} projectId="project-1" />);

    fireEvent.change(screen.getByLabelText("图层缩放数值"), {
      target: { value: "1.5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存图层" }));

    await waitFor(() => {
      expect(apiMocks.updateImageLayerSet).toHaveBeenCalledWith(
        "project-1",
        "set-1",
        expect.objectContaining({ expected_revision: 3 })
      );
    });
    expect(screen.getAllByText(/Revision 4/).length).toBeGreaterThan(0);
  });
});
