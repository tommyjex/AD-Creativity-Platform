import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ImageCanvasEditor } from "@/components/workspace/image-canvas-editor";
import type { Asset } from "@/lib/api-types";

const target: Asset = {
  asset_role: "public",
  category: null,
  created_at: "2026-08-24T08:00:00Z",
  id: "target-1",
  metadata: {},
  mime_type: "image/png",
  object_key: "projects/target.png",
  project_id: "project-1",
  size_bytes: 100,
  source_task_id: "task-1",
  stage: "image",
  status: "succeeded",
  type: "generated_image",
  updated_at: "2026-08-24T08:00:00Z",
  url: "https://assets.example.com/target.png"
};

const reference: Asset = {
  ...target,
  category: "reference",
  id: "reference-1",
  metadata: { name: "参考主体.png" },
  source_task_id: null,
  type: "uploaded_image",
  url: "https://assets.example.com/reference.png"
};

const secondReference: Asset = {
  ...reference,
  id: "reference-2",
  metadata: { name: "第二参考.png" },
  url: "https://assets.example.com/reference-2.png"
};

const editedTarget: Asset = {
  ...target,
  created_at: "2026-08-24T09:00:00Z",
  id: "target-2",
  metadata: { name: "编辑结果.png" },
  source_task_id: "task-2",
  updated_at: "2026-08-24T09:00:00Z",
  url: "https://assets.example.com/target-2.png"
};

const thirdTarget: Asset = {
  ...editedTarget,
  id: "target-3",
  metadata: { name: "历史版本 3.png" },
  url: "https://assets.example.com/target-3.png"
};

const fourthTarget: Asset = {
  ...editedTarget,
  id: "target-4",
  metadata: { name: "历史版本 4.png" },
  url: "https://assets.example.com/target-4.png"
};

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

describe("ImageCanvasEditor", () => {
  it("shows a recoverable validation message until the target region is selected", () => {
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={target}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "请在目标图上框选编辑区域。"
    );
    expect(screen.getByRole("button", { name: "生成编辑版本" })).toBeDisabled();
  });

  it("renders the target image with intrinsic aspect-fit sizing", () => {
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={target}
      />
    );

    const image = screen.getByAltText("目标图");
    Object.defineProperty(image, "naturalHeight", {
      configurable: true,
      value: 1600
    });
    Object.defineProperty(image, "naturalWidth", {
      configurable: true,
      value: 900
    });
    fireEvent.load(image);

    expect(image).toHaveClass(
      "h-auto",
      "w-auto",
      "max-h-full",
      "max-w-full",
      "object-contain"
    );
    expect(image).not.toHaveClass("h-full", "w-full");
    expect(image.parentElement?.parentElement).toHaveStyle({
      aspectRatio: "900 / 1600"
    });
    expect(image.parentElement?.parentElement).toHaveClass(
      "inline-grid",
      "w-auto"
    );
    expect(image.parentElement?.parentElement).not.toHaveClass(
      "w-[min(68vw,760px)]"
    );
  });

  it("shows a safe download link for the target image", () => {
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={target}
      />
    );

    const download = screen.getByRole("link", { name: "下载目标图" });
    expect(download).toHaveAttribute(
      "href",
      "http://localhost:8000/api/assets/target-1/content?download=1"
    );
    expect(download).toHaveAttribute("download", "目标图");
  });

  it("shows target candidates and selects a non-current version", () => {
    const onSelectTargetAsset = vi.fn();
    render(
      <ImageCanvasEditor
        candidateTargetAssets={[target, editedTarget, thirdTarget, fourthTarget]}
        currentTargetAssetId={target.id}
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSelectTargetAsset={onSelectTargetAsset}
        onSubmit={vi.fn()}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={target}
      />
    );

    expect(screen.getByText("目标候选")).toBeInTheDocument();
    expect(screen.getByText("4 张")).toBeInTheDocument();
    expect(
      screen.getByText("目标候选").parentElement?.nextElementSibling
    ).toHaveClass("grid-flow-col", "grid-rows-2");
    expect(screen.getAllByText("当前目标").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(
      screen.getByRole("button", { name: "设为目标图：编辑结果.png" })
    );

    expect(onSelectTargetAsset).toHaveBeenCalledWith(editedTarget);
  });

  it("opens a target candidate preview on double click", () => {
    render(
      <ImageCanvasEditor
        candidateTargetAssets={[target, editedTarget]}
        currentTargetAssetId={target.id}
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSelectTargetAsset={vi.fn()}
        onSubmit={vi.fn()}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={target}
      />
    );

    fireEvent.doubleClick(
      screen.getByRole("button", { name: "放大预览：编辑结果.png" })
    );

    expect(
      screen.getByRole("heading", { name: "查看原图" })
    ).toBeInTheDocument();
    const preview = screen.getByAltText("编辑结果.png 原图预览");
    expect(preview).toHaveAttribute(
      "src",
      editedTarget.url
    );
    Object.defineProperty(preview, "naturalHeight", {
      configurable: true,
      value: 1600
    });
    Object.defineProperty(preview, "naturalWidth", {
      configurable: true,
      value: 900
    });
    fireEvent.load(preview);
    expect(
      screen.getByRole("dialog", { name: "查看原图" })
    ).toHaveClass("h-[92dvh]", "w-[96vw]", "overflow-hidden");
    expect(preview).toHaveClass(
      "h-auto",
      "w-auto",
      "max-h-[calc(92dvh-7rem)]",
      "max-w-[calc(96vw-2rem)]",
      "object-contain"
    );
    expect(preview.parentElement).toHaveClass(
      "h-full",
      "w-full",
      "overflow-hidden"
    );
  });

  it("fits landscape enlarged previews within the viewport", () => {
    render(
      <ImageCanvasEditor
        candidateTargetAssets={[target, editedTarget]}
        currentTargetAssetId={target.id}
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSelectTargetAsset={vi.fn()}
        onSubmit={vi.fn()}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={target}
      />
    );

    fireEvent.doubleClick(
      screen.getByRole("button", { name: "放大预览：编辑结果.png" })
    );
    const preview = screen.getByAltText("编辑结果.png 原图预览");
    Object.defineProperty(preview, "naturalHeight", {
      configurable: true,
      value: 900
    });
    Object.defineProperty(preview, "naturalWidth", {
      configurable: true,
      value: 1600
    });
    fireEvent.load(preview);

    expect(preview).toHaveClass(
      "h-auto",
      "w-auto",
      "max-h-[calc(92dvh-7rem)]",
      "max-w-[calc(96vw-2rem)]",
      "object-contain"
    );
  });

  it("fits target candidate previews to their intrinsic aspect ratio", () => {
    render(
      <ImageCanvasEditor
        candidateTargetAssets={[target, editedTarget]}
        currentTargetAssetId={target.id}
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSelectTargetAsset={vi.fn()}
        onSubmit={vi.fn()}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={target}
      />
    );

    const image = screen.getByAltText("目标候选：编辑结果.png");
    Object.defineProperty(image, "naturalHeight", {
      configurable: true,
      value: 1600
    });
    Object.defineProperty(image, "naturalWidth", {
      configurable: true,
      value: 900
    });
    fireEvent.load(image);

    expect(image.parentElement).toHaveStyle({
      aspectRatio: "900 / 1600"
    });
    expect(image.parentElement).not.toHaveClass("aspect-[4/3]");
  });

  it("clears the target bbox when the target asset changes", async () => {
    const { rerender } = render(
      <ImageCanvasEditor
        candidateTargetAssets={[target, editedTarget]}
        currentTargetAssetId={target.id}
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={target}
      />
    );

    drawBbox(screen.getByAltText("目标图"));
    expect(screen.getByText("图1 框选 #1")).toBeInTheDocument();

    rerender(
      <ImageCanvasEditor
        candidateTargetAssets={[editedTarget, target]}
        currentTargetAssetId={editedTarget.id}
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={editedTarget}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText("图1 框选 #1")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "请在目标图上框选编辑区域。"
    );
  });

  it("submits target edits as single-image edits even when references are selected", () => {
    const onSubmit = vi.fn();
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        open
        referenceAssets={[reference]}
        size="2K"
        targetAsset={target}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "参考主体.png 图1" }));
    drawBbox(screen.getByAltText("目标图"));
    drawBbox(screen.getByAltText("参考图：参考主体.png"));
    fireEvent.change(screen.getByLabelText("编辑指令"), {
      target: { value: "将参考主体替换到目标区域" }
    });

    expect(
      screen.getAllByText(/图1<bbox>100 200 800 900<\/bbox>/).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByText(/目标图<bbox>100 200 800 900<\/bbox>/)
    ).not.toBeInTheDocument();
    expect(screen.getByText("图1 框选 #1")).toBeInTheDocument();
    expect(
      screen.queryByText("图1 框选 #2")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/图2<bbox>100 200 800 900<\/bbox>/)
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "生成编辑版本" }));

    expect(onSubmit).toHaveBeenCalledWith({
      annotation: { type: "bbox", x1: 100, x2: 800, y1: 200, y2: 900 },
      editMode: "single_region",
      prompt: "将参考主体替换到目标区域",
      referenceAssetIds: [],
      referenceRegions: [],
      targetBbox: { type: "bbox", x1: 100, x2: 800, y1: 200, y2: 900 }
    });
  });

  it("submits ordered reference regions for first image generation", () => {
    const onSubmit = vi.fn();
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        open
        referenceAssets={[reference]}
        size="2K"
        targetAsset={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "参考主体.png 图1" }));
    drawBbox(screen.getByAltText("参考图：参考主体.png"));
    fireEvent.change(screen.getByLabelText("图片提示词"), {
      target: { value: "使用参考主体生成海报" }
    });

    expect(
      screen.getAllByText(/图1<bbox>100 200 800 900<\/bbox>/).length
    ).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole("button", { name: "生成首张图片" }));

    expect(onSubmit).toHaveBeenCalledWith({
      annotation: null,
      editMode: "single_region",
      prompt: "使用参考主体生成海报 图1<bbox>100 200 800 900</bbox>",
      referenceAssetIds: [reference.id],
      referenceRegions: [
        {
          asset_id: reference.id,
          bbox: { type: "bbox", x1: 100, x2: 800, y1: 200, y2: 900 },
          image_index: 2
        }
      ],
      targetBbox: null
    });
  });

  it("shows bbox reference cards in drawing order instead of image number order", () => {
    const onSubmit = vi.fn();
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        open
        referenceAssets={[reference, secondReference]}
        size="2K"
        targetAsset={null}
      />
    );

    drawBbox(screen.getByAltText("参考图：第二参考.png"));
    drawBbox(screen.getByAltText("参考图：参考主体.png"));

    const firstCard = screen.getByText("图2 框选 #1");
    const secondCard = screen.getByText("图1 框选 #2");

    expect(
      firstCard.compareDocumentPosition(secondCard) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("图片提示词"), {
      target: { value: "先使用" }
    });
    fireEvent.change(screen.getByLabelText("图2 框选 #1 后文字"), {
      target: { value: "作为主体，再参考" }
    });
    fireEvent.change(screen.getByLabelText("图1 框选 #2 后文字"), {
      target: { value: "的材质" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成首张图片" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt:
          "先使用 图2<bbox>100 200 800 900</bbox> 作为主体，再参考 图1<bbox>100 200 800 900</bbox> 的材质",
        referenceAssetIds: [secondReference.id, reference.id]
      })
    );
  });

  it("resizes an existing target bbox with a corner handle", () => {
    const onSubmit = vi.fn();
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={target}
      />
    );

    const image = screen.getByAltText("目标图");
    drawBbox(image);
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "调整框选区域：bottom-right" }),
      { pointerId: 2 }
    );
    fireEvent.pointerMove(image.parentElement!, {
      clientX: 90,
      clientY: 95,
      pointerId: 2
    });
    fireEvent.pointerUp(image.parentElement!, {
      clientX: 90,
      clientY: 95,
      pointerId: 2
    });
    fireEvent.change(screen.getByLabelText("编辑指令"), {
      target: { value: "调整选区" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成编辑版本" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        annotation: { type: "bbox", x1: 100, x2: 900, y1: 200, y2: 950 }
      })
    );
  });

  it("normalizes target bbox coordinates against a portrait contained image rect", () => {
    const onSubmit = vi.fn();
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={target}
      />
    );

    const image = screen.getByAltText("目标图");
    Object.defineProperty(image, "naturalHeight", {
      configurable: true,
      value: 1600
    });
    Object.defineProperty(image, "naturalWidth", {
      configurable: true,
      value: 900
    });
    Object.defineProperty(image, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 200,
        height: 200,
        left: 43.75,
        right: 156.25,
        top: 0,
        width: 112.5
      })
    });
    fireEvent.load(image);
    fireEvent.pointerDown(image, { clientX: 50, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(image, { clientX: 150, clientY: 180, pointerId: 1 });
    fireEvent.pointerUp(image, { clientX: 150, clientY: 180, pointerId: 1 });
    fireEvent.change(screen.getByLabelText("编辑指令"), {
      target: { value: "按竖图真实区域框选" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成编辑版本" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        annotation: { type: "bbox", x1: 56, x2: 944, y1: 100, y2: 900 }
      })
    );
  });

  it("clears a drawn target region from its overlay close button", () => {
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={target}
      />
    );

    drawBbox(screen.getByAltText("目标图"));
    expect(
      screen.getByRole("button", { name: "删除框选区域" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除框选区域" }));

    expect(
      screen.queryByRole("button", { name: "删除框选区域" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "请在目标图上框选编辑区域。"
    );
  });

  it("keeps output controls and reference upload in the canvas workspace", () => {
    const onAspectRatioChange = vi.fn();
    const onFormatChange = vi.fn();
    const onReferenceFiles = vi.fn();
    const onSizeChange = vi.fn();
    render(
      <ImageCanvasEditor
        aspectRatio="1:1"
        format="png"
        isSubmitting={false}
        onAspectRatioChange={onAspectRatioChange}
        onFormatChange={onFormatChange}
        onOpenChange={vi.fn()}
        onReferenceFiles={onReferenceFiles}
        onSizeChange={onSizeChange}
        onSubmit={vi.fn()}
        open
        referenceAssets={[reference]}
        size="2K"
        targetAsset={target}
      />
    );

    fireEvent.change(screen.getByLabelText("画幅"), {
      target: { value: "16:9" }
    });
    fireEvent.change(screen.getByLabelText("画布分辨率"), {
      target: { value: "1K" }
    });
    fireEvent.change(screen.getByLabelText("画布输出格式"), {
      target: { value: "jpeg" }
    });
    fireEvent.click(screen.getByRole("button", { name: "添加参考图" }));
    fireEvent.change(screen.getByLabelText("上传参考图"), {
      target: {
        files: [new File(["image"], "new-reference.png", { type: "image/png" })]
      }
    });

    expect(onAspectRatioChange).toHaveBeenCalledWith("16:9");
    expect(onSizeChange).toHaveBeenCalledWith("1K");
    expect(onFormatChange).toHaveBeenCalledWith("jpeg");
    expect(onReferenceFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: "new-reference.png" })
    ]);
    expect(
      screen.queryByRole("button", { name: "参考图替换" })
    ).not.toBeInTheDocument();
  });

  it("removes a reference image through the canvas card action", () => {
    const onRemoveReference = vi.fn();
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onRemoveReference={onRemoveReference}
        onSubmit={vi.fn()}
        open
        referenceAssets={[reference]}
        size="2K"
        targetAsset={target}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "移除参考图：参考主体.png" })
    );

    expect(onRemoveReference).toHaveBeenCalledWith(reference);
  });

  it("disables reference removal while the canvas is busy", () => {
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting
        onOpenChange={vi.fn()}
        onRemoveReference={vi.fn()}
        onSubmit={vi.fn()}
        open
        referenceAssets={[reference]}
        size="2K"
        targetAsset={target}
      />
    );

    expect(
      screen.getByRole("button", { name: "移除参考图：参考主体.png" })
    ).toBeDisabled();
  });

  it("prunes removed reference selections and bbox cards", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        open
        referenceAssets={[reference, secondReference]}
        size="2K"
        targetAsset={null}
      />
    );

    drawBbox(screen.getByAltText("参考图：第二参考.png"));
    drawBbox(screen.getByAltText("参考图：参考主体.png"));
    expect(screen.getByText("图2 框选 #1")).toBeInTheDocument();

    rerender(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        open
        referenceAssets={[reference]}
        size="2K"
        targetAsset={null}
      />
    );

    expect(screen.queryByText("图2 框选 #1")).not.toBeInTheDocument();
    expect(screen.getByText("图1 框选 #1")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("图片提示词"), {
      target: { value: "保留剩余参考" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成首张图片" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceAssetIds: [reference.id],
        referenceRegions: [
          {
            asset_id: reference.id,
            bbox: { type: "bbox", x1: 100, x2: 800, y1: 200, y2: 900 },
            image_index: 2
          }
        ]
      })
    );
  });

  it("opens the original target image preview on double click", () => {
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={target}
      />
    );

    const image = screen.getByAltText("目标图");
    fireEvent.click(image);
    expect(
      screen.queryByRole("heading", { name: "查看原图" })
    ).not.toBeInTheDocument();
    fireEvent.doubleClick(image);

    expect(
      screen.getByRole("heading", { name: "查看原图" })
    ).toBeInTheDocument();
    const preview = screen.getByAltText("目标图 原图预览");
    expect(preview).toHaveAttribute(
      "src",
      target.url
    );
    Object.defineProperty(preview, "naturalHeight", {
      configurable: true,
      value: 1600
    });
    Object.defineProperty(preview, "naturalWidth", {
      configurable: true,
      value: 900
    });
    fireEvent.load(preview);
    expect(
      screen.getByRole("dialog", { name: "查看原图" })
    ).toHaveClass("h-[92dvh]", "w-[96vw]", "overflow-hidden");
    expect(preview).toHaveClass(
      "h-auto",
      "w-auto",
      "max-h-[calc(92dvh-7rem)]",
      "max-w-[calc(96vw-2rem)]",
      "object-contain"
    );
    expect(preview.parentElement).toHaveClass(
      "h-full",
      "w-full",
      "overflow-hidden"
    );
  });

  it("keeps drag selection on the target image from opening the preview", () => {
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={target}
      />
    );

    drawBbox(screen.getByAltText("目标图"));

    expect(
      screen.queryByRole("heading", { name: "查看原图" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "删除框选区域" })
    ).toBeInTheDocument();
  });

  it("allows creating the first image without a target asset", () => {
    const onSubmit = vi.fn();
    render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        open
        referenceAssets={[]}
        size="2K"
        targetAsset={null}
      />
    );

    expect(screen.getByText("新建图片")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成首张图片" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("图片提示词"), {
      target: { value: "晨光中的便携咖啡机商品主图" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成首张图片" }));

    expect(onSubmit).toHaveBeenCalledWith({
      annotation: null,
      editMode: "single_region",
      prompt: "晨光中的便携咖啡机商品主图",
      referenceAssetIds: [],
      referenceRegions: [],
      targetBbox: null
    });
  });

  it("exposes layer decomposition and reference-to-target actions", () => {
    const onLayerDecompose = vi.fn();
    const onSetReferenceAsTarget = vi.fn();
    const { rerender } = render(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onLayerDecompose={onLayerDecompose}
        onOpenChange={vi.fn()}
        onSetReferenceAsTarget={onSetReferenceAsTarget}
        onSubmit={vi.fn()}
        open
        referenceAssets={[reference]}
        size="2K"
        targetAsset={null}
      />
    );

    expect(screen.getByRole("button", { name: "图层拆分" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "设为目标图" }));
    expect(onSetReferenceAsTarget).toHaveBeenCalledWith(reference);

    rerender(
      <ImageCanvasEditor
        format="png"
        isSubmitting={false}
        onLayerDecompose={onLayerDecompose}
        onOpenChange={vi.fn()}
        onSetReferenceAsTarget={onSetReferenceAsTarget}
        onSubmit={vi.fn()}
        open
        referenceAssets={[reference]}
        size="2K"
        targetAsset={target}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "图层拆分" }));
    expect(onLayerDecompose).toHaveBeenCalledTimes(1);
  });
});
