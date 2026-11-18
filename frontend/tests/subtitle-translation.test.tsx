import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubtitleTranslationPanel } from "@/components/workspace/subtitle-translation/panel";
import { SubtitleReviewDialog } from "@/components/workspace/subtitle-translation/review-dialog";
import { SubtitleVideoPreview } from "@/components/workspace/subtitle-translation/video-preview";
import { useSubtitleWorkspace } from "@/components/workspace/subtitle-translation/use-subtitle-workspace";
import { containedVideoRect, segmentDraftIssue, segmentIssue, subtitleColors, subtitlePreviewBox, subtitlePreviewFont, SUBTITLE_CAPACITY_NOTICE, SUBTITLE_FONTS, subtitleWarningMessage } from "@/lib/subtitle-translation";
import { ApiError } from "@/lib/api-client";
import { subtitleAsset, subtitleSegment, subtitleTask, subtitleWorkspace } from "./subtitle-translation-fixtures";

const mocks = vi.hoisted(() => ({
  listSubtitleWorkspaces: vi.fn(), getSubtitleWorkspace: vi.fn(), createSubtitleWorkspace: vi.fn(),
  patchSubtitleWorkspace: vi.fn(), runSubtitleOperation: vi.fn(), getToolTask: vi.fn(),
  retryToolTask: vi.fn(), importSubtitleVideo: vi.fn(), uploadSubtitleVideo: vi.fn(), previewSubtitleWorkspace: vi.fn()
}));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api-client")>(),
  apiClient: mocks
}));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listSubtitleWorkspaces.mockResolvedValue([subtitleWorkspace]);
  mocks.getSubtitleWorkspace.mockResolvedValue(subtitleWorkspace);
  mocks.createSubtitleWorkspace.mockResolvedValue({ ...subtitleWorkspace, id: "new-workspace", segments: [], stage: "draft" });
  mocks.patchSubtitleWorkspace.mockImplementation(async (_id, payload) => ({
    ...subtitleWorkspace, ...payload, revision: payload.expected_revision + 1, output_asset_id: null
  }));
  mocks.runSubtitleOperation.mockResolvedValue(subtitleTask);
  mocks.getToolTask.mockResolvedValue({ ...subtitleTask, status: "succeeded" });
  mocks.previewSubtitleWorkspace.mockResolvedValue(subtitleWorkspace);
});

function panel(canWrite = true) {
  return render(<SubtitleTranslationPanel assets={[subtitleAsset]} canWrite={canWrite} onAssetsChange={vi.fn()} onDirtyChange={vi.fn()} />);
}

it("maps missing source bitrate to a safe encoding warning", () => {
  expect(subtitleWarningMessage("source_video_bit_rate_unavailable"))
    .toBe("未能读取底片视频码率，本次使用默认编码码率，请检查成片清晰度与体积。");
});
function review(overrides: Partial<React.ComponentProps<typeof SubtitleReviewDialog>> = {}) {
  const props = {
    workspace: subtitleWorkspace, open: true, readOnly: false, busy: false, error: null, conflict: false,
    onClose: vi.fn(), onSave: vi.fn().mockResolvedValue(true), onRender: vi.fn().mockResolvedValue(true),
    onRetry: vi.fn().mockResolvedValue(true), onReload: vi.fn().mockResolvedValue(undefined), onPreview: vi.fn().mockResolvedValue(subtitleWorkspace), onDirtyChange: vi.fn(), ...overrides
  };
  render(<SubtitleReviewDialog {...props} />);
  return props;
}

describe("subtitle review", () => {
  it("keeps skipped brand records editable without requiring translation or enabling brand-only render", () => {
    const brand = { ...subtitleSegment, text: "Tineco", translated_text: null,
      translation_status: "pending" as const, warnings: ["brand_content_skipped"] };
    review({ workspace: { ...subtitleWorkspace, segments: [brand] } });
    expect(segmentIssue(brand)).toBeNull();
    expect(subtitleWarningMessage("brand_content_skipped")).toBe("品牌片尾已跳过。");
    expect(screen.getByLabelText("字幕 1译文")).toHaveValue("");
    expect(screen.getByRole("button", { name: "保存并压制视频" })).toBeDisabled();
    expect(screen.queryByText("待补齐译文或明确排除。")).not.toBeInTheDocument();
  });

  it.each(["product", "unboxing"] as const)("omits skipped brand text and PNG in %s preview", (videoCategory) => {
    class Observer {
      constructor(private callback: (entries: unknown[]) => void) {}
      observe() { this.callback([{ contentRect: { width: 400, height: 400 } }]); }
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", Observer);
    const logo = { ...subtitleSegment, segment_id: "brand-logo", translated_text: "Brand translation",
      warnings: ["brand_content_skipped"] };
    const png = { ...logo, segment_id: "brand-png",
      render_layer_url: `/api/tools/subtitle-translation/workspaces/w/layers/${"a".repeat(64)}.png` };
    const { container } = render(<SubtitleVideoPreview url="/video.mp4" seekMs={1000}
      videoCategory={videoCategory} segments={[logo, png, subtitleSegment]} label="Brand preview" />);
    const video = screen.getByLabelText("Brand preview");
    Object.defineProperties(video, { videoWidth: { value: 1280 }, videoHeight: { value: 720 }, readyState: { value: 1 } });
    fireEvent.loadedMetadata(video);
    expect(container.querySelector("[data-subtitle-layer]")).not.toBeInTheDocument();
    expect(screen.queryByText("Brand translation")).not.toBeInTheDocument();
    expect(screen.getByText(subtitleSegment.translated_text!)).toBeInTheDocument();
  });
  it.each(["headline", "body", "footnote"])("saves manual font selection and restores automatic %s on clear", async (visual_role) => {
    const automatic = visual_role === "headline" ? "CenturyGothicBold" : "CenturyGothic";
    const manual = visual_role === "headline" ? "CenturyGothic" : "CenturyGothicBold";
    const original = {
      ...subtitleSegment, visual_role, font_type: SUBTITLE_FONTS[3].url,
      font_sha256: "a".repeat(64), style: { text_color: "#FF0000" }
    };
    const onSave = vi.fn<React.ComponentProps<typeof SubtitleReviewDialog>["onSave"]>().mockResolvedValue(true);
    const props = review({ workspace: { ...subtitleWorkspace, segments: [original] }, onSave });
    const select = screen.getByLabelText("字幕 1字体");
    expect(select).toHaveValue("");
    expect(screen.getByRole("option", { name: "自动 · 标题粗体，正文/脚注常规体" })).toHaveValue("");
    expect(screen.getByRole("option", { name: "世纪哥特体 · 粗体" })).toHaveValue("CenturyGothicBold");
    fireEvent.change(select, { target: { value: manual } });
    fireEvent.click(screen.getByRole("button", { name: "保存校对" }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
    const selected = onSave.mock.calls[0][0][0];
    expect(selected).toMatchObject({
      segment_id: original.segment_id, visual_role, text: original.text,
      translated_text: original.translated_text, start_ms: original.start_ms, end_ms: original.end_ms,
      bbox_normalized: original.bbox_normalized, block_id: original.block_id, line_index: original.line_index,
      style: { font: manual, text_color: "#FF0000" },
      font_type: null, font_sha256: null, effective_font_size_px: null, render_bbox_pixels: null
    });
    expect(subtitlePreviewFont(selected).id).toBe(manual);
    fireEvent.change(select, { target: { value: "" } });
    expect(select).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "保存校对" }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(2));
    const cleared = onSave.mock.calls[1][0][0];
    expect(cleared.style).toEqual({ font: null, text_color: "#FF0000" });
    expect(subtitlePreviewFont(cleared).id).toBe(automatic);
    expect(original.font_type).toBe(SUBTITLE_FONTS[3].url);
    expect(props.onRender).not.toHaveBeenCalled();
  });

  it.each([
    ["#FFFFFF", "#000000", "#00000000"],
    ["#F5F5F5", "#000000", "#00000000"],
    ["#F4F5F5", "#FFFFFF", "#33333359"],
    ["#000000", "#FFFFFF", "#00000000"],
    ["#101010", "#FFFFFF", "#00000000"],
    ["#111010", "#FFFFFF", "#33333359"],
    ["#777777", "#FFFFFF", "#33333359"],
    [null, "#FFFFFF", "#33333359"]
  ])("matches automatic render colors for %s", (background_color, text, panel) => {
    expect(subtitleColors({ ...subtitleSegment, background_color, style: {} })).toMatchObject({ text, panel });
  });

  it("saves panel mode, RGB and opacity together and restores automatic mode", async () => {
    const props = review();
    expect(screen.getByLabelText("字幕 1底板颜色")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("字幕 1底板模式"), { target: { value: "custom" } });
    expect(screen.getByLabelText("字幕 1底板不透明度")).toHaveValue("35");
    fireEvent.change(screen.getByLabelText("字幕 1底板颜色"), { target: { value: "#222222" } });
    fireEvent.change(screen.getByLabelText("字幕 1底板不透明度"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "保存校对" }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith([
      expect.objectContaining({ style: { background_color: "#22222280" } })
    ]));
    fireEvent.change(screen.getByLabelText("字幕 1底板模式"), { target: { value: "none" } });
    expect(screen.getByLabelText("字幕 1background_color")).toHaveValue("#00000000");
    fireEvent.change(screen.getByLabelText("字幕 1底板模式"), { target: { value: "auto" } });
    expect(screen.getByLabelText("字幕 1background_color")).toHaveValue("");
  });

  it("preserves explicit text color when a custom panel is enabled", () => {
    expect(subtitleColors({ ...subtitleSegment, style: { background_color: "#333333B3" } }).text).toBe("#FFFFFF");
    expect(subtitleColors({ ...subtitleSegment, style: { background_color: "#333333B3", text_color: "#FF0000" } }).text).toBe("#FF0000");
  });

  it.each([
    ["#FFFFFF", "#000000"], ["#F5F5F5", "#000000"], ["#F4F5F5", "#FFFFFF"],
    ["#000000", "#FFFFFF"], ["#101010", "#FFFFFF"], ["#111010", "#FFFFFF"],
    ["#777777", "#FFFFFF"], [null, "#FFFFFF"]
  ])("keeps product text automatic for %s despite an ignored custom panel", (background_color, text) => {
    for (const background of [null, "#00000000", "#FF000080", "#33333359"]) {
      const segment = { ...subtitleSegment, background_color, style: { background_color: background } };
      expect(subtitleColors(segment, "product")).toEqual({ text, panel: "#00000000", recommended: text });
      expect(subtitleColors({ ...segment, style: { ...segment.style, text_color: "#FF0000" } }, "product").text).toBe("#FF0000");
      expect(segment.style.background_color).toBe(background);
    }
  });

  it("hides every product panel control while preserving styles and automatic product names", async () => {
    const segment = {
      ...subtitleSegment, background_color: null,
      style: { background_color: "#FF000080", text_color: "#123456", font: "CenturyGothicBold", font_size_px: 30 },
      product_mentions: [{ start: 0, end: 9, model: "Power", spec: "20 W", catalog_id: null, origin: "model_pattern" as const, status: "confirmed" as const }]
    };
    const props = review({ workspace: { ...subtitleWorkspace, video_category: "product", segments: [segment] }, error: "line-a:background_unknown" });
    for (const field of ["底板模式", "底板颜色", "底板不透明度", "background_color"]) {
      expect(screen.queryByLabelText(`字幕 1${field}`)).not.toBeInTheDocument();
    }
    expect(screen.getByText("产品视频：字幕无底板")).toBeInTheDocument();
    expect(screen.queryByText(/半透明深灰底/)).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("字幕无底板");
    expect(screen.getByLabelText("字幕 1字号")).toBeEnabled();
    expect(screen.getByLabelText("字幕 1字体")).toBeEnabled();
    expect(screen.getByLabelText("字幕 1text_color")).toBeEnabled();
    expect(screen.getByText("型号：Power")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /识别产品名称/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("字幕 1text_color"), { target: { value: "#654321" } });
    fireEvent.click(screen.getByRole("button", { name: "保存校对" }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith([
      expect.objectContaining({ style: { ...segment.style, text_color: "#654321" }, product_mentions: segment.product_mentions })
    ]));
  });

  it.each(["background_unknown", "background_color_unavailable", "expanded_background_unverified", "low_contrast"])(
    "does not suggest panels or claim a gray panel in product warning %s", (warning) => {
      const product = subtitleWarningMessage(`line-a:${warning}`, "product");
      expect(product).not.toMatch(/灰|底板色|文字色和底板|启用/);
      expect(subtitleWarningMessage(warning)).not.toBe(product);
      expect(subtitleWarningMessage(warning, "unboxing")).toBe(subtitleWarningMessage(warning));
    }
  );

  it("edits stable IDs while preserving original, style and bbox; asks before dirty close", async () => {
    const props = review();
    expect(screen.getByText("Power 20 W")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("字幕 1译文"), { target: { value: "Neue Leistung 20 W" } });
    fireEvent.change(screen.getByLabelText("字幕 1BBox0"), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText("字幕 1text_color"), { target: { value: "#FF0000" } });
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByText("有未保存修改，如何关闭？")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存并关闭" }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(props.onSave).toHaveBeenCalledWith([expect.objectContaining({
      segment_id: "line-a", text: "Power 20 W", translated_text: "Neue Leistung 20 W",
      bbox_normalized: [150, 200, 600, 300], style: { text_color: "#FF0000" }, effective_font_size_px: null
    })]);
  });

  it("does not render missing translations, supports explicit exclusion and partial retry", async () => {
    const props = review({ workspace: { ...subtitleWorkspace, segments: [subtitleSegment, { ...subtitleSegment, segment_id: "line-b", translated_text: null, translation_status: "failed" }] } });
    expect(screen.getByRole("button", { name: "保存并压制视频" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "仅重试缺失译文 (1)" }));
    await waitFor(() => expect(props.onRetry).toHaveBeenCalledWith(expect.any(Array), ["line-b"]));
  });

  it("blocks writes in read-only and revision conflict views", () => {
    review({ readOnly: true, conflict: true });
    expect(screen.getByLabelText("字幕 1译文")).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存校对" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存并压制视频" })).toBeDisabled();
    expect(screen.getByText(/远端 revision 已变更/)).toBeInTheDocument();
  });

  it("blocks invalid draft values but allows saving missing translation", () => {
    expect(segmentDraftIssue({ ...subtitleSegment, translated_text: null })).toBeNull();
    expect(segmentIssue({ ...subtitleSegment, translated_text: null })).toContain("待补齐");
    expect(segmentDraftIssue({ ...subtitleSegment, style: { text_color: "#bad" } })).toContain("颜色");
    expect(segmentDraftIssue({ ...subtitleSegment, bbox_normalized: [600, 200, 100, 300] })).toContain("BBox");
    expect(segmentDraftIssue({ ...subtitleSegment, translated_text: "a\nb" })).toContain("单行");
  });

  it("shows actual font measurements and unverified provider boundaries before rendering", () => {
    const warnings = [SUBTITLE_CAPACITY_NOTICE, "provider_text_capacity_unverified", "provider_vertical_anchor_unverified", "provider_literal_escaping_unverified", "real_render_unverified"];
    review({ workspace: { ...subtitleWorkspace, warnings } });
    expect(screen.getByText("估算字号 42 · 输出字号 32")).toBeInTheDocument();
    expect(screen.getByText(/工具最多 500 条字幕/)).toHaveTextContent("工具上限不代表供应商容量保证");
    expect(screen.getByText(/最终字形的垂直锚点及特殊文本解释/)).toBeInTheDocument();
    expect(screen.queryByText(SUBTITLE_CAPACITY_NOTICE)).not.toBeInTheDocument();
    expect(screen.queryByText(/provider_.*unverified/)).not.toBeInTheDocument();
    expect(screen.queryByText(subtitleWarningMessage("font_size_reduced"))).not.toBeInTheDocument();
    expect(warnings).toContain(SUBTITLE_CAPACITY_NOTICE);
  });

  it("remeasures an unsaved draft without saving or changing its revision", async () => {
    const onPreview = vi.fn().mockResolvedValue({
      ...subtitleWorkspace, segments: [{ ...subtitleSegment, effective_font_size_px: 18, warnings: ["font_size_small"] }]
    });
    const props = review({ onPreview });
    fireEvent.click(screen.getByRole("button", { name: "计算排版 · 不保存" }));
    await screen.findByText("估算字号 42 · 输出字号 18");
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onRender).not.toHaveBeenCalled();
    expect(props.onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText(subtitleWarningMessage("font_size_small"))).not.toBeInTheDocument();
    expect(screen.getByText(/revision 2 · 已保存/)).toBeInTheDocument();
  });

  it("retains a readable capacity error without discarding draft", () => {
    const error = `segment_capacity_exceeded: ${SUBTITLE_CAPACITY_NOTICE}`;
    review({ error });
    expect(screen.getByRole("alert")).toHaveTextContent("字幕超过工具 500 条上限，请减少条目");
    expect(screen.getByRole("alert")).not.toHaveTextContent(SUBTITLE_CAPACITY_NOTICE);
    expect(screen.getByLabelText("字幕 1译文")).toHaveValue("Leistung 20 W");
  });

  it("hides diagnostic warning lists while retaining actionable task errors", () => {
    const warnings = ["fps_support_local_contract_only", "line-a:font_url_version_unverified", "line-b:font_url_version_unverified", "low_contrast", "bbox_expanded"];
    review({ workspace: { ...subtitleWorkspace, warnings }, error: "font_resource_unavailable" });
    for (const warning of warnings) {
      expect(screen.queryByText(subtitleWarningMessage(warning))).not.toBeInTheDocument();
    }
    expect(screen.getByRole("alert")).toHaveTextContent("字体暂不可用，请更换字体");
    expect(warnings).toHaveLength(5);
  });

  it("shows measured font URL and SHA, then clears stale font metadata on edit", () => {
    const font = SUBTITLE_FONTS[1];
    review({ workspace: { ...subtitleWorkspace, segments: [{
      ...subtitleSegment, font_type: font.url, font_sha256: "a".repeat(64)
    }] } });
    expect(screen.getByText(`字体 URL：${font.url}`)).toBeInTheDocument();
    expect(screen.getByText(`SHA-256：${"a".repeat(64)}`)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("字幕 1字体"), { target: { value: "SY_Black" } });
    expect(screen.getByText("字体 URL：待计算")).toBeInTheDocument();
    expect(screen.getByText("SHA-256：待计算")).toBeInTheDocument();
  });

  it("invalidates neighboring output boxes when geometry or time is edited", async () => {
    const props = review({ workspace: { ...subtitleWorkspace, segments: [
      { ...subtitleSegment, render_bbox_pixels: [64, 100, 800, 180] },
      { ...subtitleSegment, segment_id: "line-b", render_bbox_pixels: [810, 100, 1200, 180] }
    ] } });
    fireEvent.change(screen.getByLabelText("字幕 1BBox2"), { target: { value: "650" } });
    fireEvent.click(screen.getByRole("button", { name: "计算排版 · 不保存" }));
    await waitFor(() => expect(props.onPreview).toHaveBeenCalledWith([
      expect.objectContaining({ bbox_normalized: [100, 200, 650, 300], render_bbox_pixels: null, effective_font_size_px: null }),
      expect.objectContaining({ segment_id: "line-b", render_bbox_pixels: null, effective_font_size_px: null })
    ]));
  });
});

describe("subtitle workspace", () => {
  it.each(["product", "unboxing"] as const)("creates an explicitly selected %s workspace", async (video_category) => {
    mocks.createSubtitleWorkspace.mockImplementation(async (payload) => ({
      ...subtitleWorkspace, ...payload, id: "created", segments: [], stage: "draft"
    }));
    panel();
    const button = await screen.findByRole("button", { name: video_category === "product" ? "新建产品视频任务" : "新建开箱视频任务" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(mocks.createSubtitleWorkspace).toHaveBeenCalledWith({
      name: "视频字幕翻译", target_language: "de", source_language: "auto", video_category
    }));
    await waitFor(() => expect(screen.getByLabelText("视频类型")).toHaveValue(video_category));
    expect(mocks.runSubtitleOperation).not.toHaveBeenCalled();
  });

  it("labels historical categories and defaults missing categories to unboxing", async () => {
    const legacy = { ...subtitleWorkspace };
    Reflect.deleteProperty(legacy, "video_category");
    mocks.listSubtitleWorkspaces.mockResolvedValue([
      legacy, { ...subtitleWorkspace, id: "product-history", name: "Product history", video_category: "product" }
    ]);
    panel();
    await screen.findByText("Translation A");
    expect(screen.getByLabelText("视频类型")).toHaveValue("unboxing");
    expect(screen.getByRole("option", { name: /Translation A · 开箱视频/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Product history · 产品视频/ })).toBeInTheDocument();
  });

  it.each(["extracting", "translating", "rendering", "active"])("disables the category selector during %s", async (mode) => {
    const running = {
      ...subtitleWorkspace,
      stage: mode === "active" ? subtitleWorkspace.stage : mode as typeof subtitleWorkspace.stage,
      active_task_id: mode === "active" ? subtitleTask.id : null
    };
    mocks.listSubtitleWorkspaces.mockResolvedValue([running]);
    mocks.getSubtitleWorkspace.mockResolvedValue(running);
    panel();
    await screen.findByText("Translation A");
    expect(screen.getByLabelText("视频类型")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("视频类型"), { target: { value: "product" } });
    expect(mocks.patchSubtitleWorkspace).not.toHaveBeenCalled();
  });

  it("saves category, clears current output and old PNGs, then restores stored unboxing styles", async () => {
    let remote = {
      ...subtitleWorkspace, stage: "succeeded" as typeof subtitleWorkspace.stage,
      output_asset_id: "output-a",
      segments: [{ ...subtitleSegment, style: { background_color: "#12345680" },
        render_layer_asset_id: "a".repeat(64),
        render_layer_url: `/api/tools/subtitle-translation/workspaces/workspace-a/layers/${"a".repeat(64)}.png`
      }]
    };
    mocks.listSubtitleWorkspaces.mockResolvedValue([remote]);
    mocks.patchSubtitleWorkspace.mockImplementation(async (_id, payload) => {
      remote = { ...remote, ...payload, revision: payload.expected_revision + 1 };
      return remote;
    });
    // GET returns the accepted current category with no cached layout.
    mocks.getSubtitleWorkspace.mockImplementation(async () => ({
      ...remote, output_asset_id: null, segments: remote.segments.map((segment) => ({
        ...segment, render_layer_url: null, render_layer_asset_id: null,
        estimated_font_size_px: null, effective_font_size_px: null
      }))
    }));
    panel();
    await screen.findByText("当前成片");
    fireEvent.change(screen.getByLabelText("视频类型"), { target: { value: "product" } });
    await waitFor(() => expect(screen.getByLabelText("视频类型")).toHaveValue("product"));
    expect(screen.queryByText("当前成片")).not.toBeInTheDocument();
    expect(mocks.patchSubtitleWorkspace).toHaveBeenCalledWith("workspace-a", { expected_revision: 2, video_category: "product" });
    fireEvent.change(screen.getByLabelText("视频类型"), { target: { value: "unboxing" } });
    await waitFor(() => expect(screen.getByLabelText("视频类型")).toHaveValue("unboxing"));
    expect(mocks.patchSubtitleWorkspace).toHaveBeenLastCalledWith("workspace-a", { expected_revision: 3, video_category: "unboxing" });
    fireEvent.click(screen.getByRole("button", { name: "3 · 原文 / 译文校对 (1)" }));
    expect(await screen.findByLabelText("字幕 1background_color")).toHaveValue("#12345680");
    expect(mocks.runSubtitleOperation).not.toHaveBeenCalled();
  });

  it("retains category and output after a switch conflict until reloading remote", async () => {
    mocks.listSubtitleWorkspaces.mockResolvedValue([{ ...subtitleWorkspace, stage: "succeeded", output_asset_id: "output-a" }]);
    mocks.patchSubtitleWorkspace.mockRejectedValue(new ApiError({
      code: "task_conflict", message: "Revision changed", status: 409, responseBody: {}
    }));
    mocks.getSubtitleWorkspace.mockResolvedValue({ ...subtitleWorkspace, video_category: "product", revision: 3 });
    panel();
    await screen.findByText("当前成片");
    fireEvent.change(screen.getByLabelText("视频类型"), { target: { value: "product" } });
    await screen.findByText("revision 冲突，未覆盖远端修改。");
    expect(screen.getByLabelText("视频类型")).toHaveValue("unboxing");
    expect(screen.getByLabelText("视频类型")).toBeDisabled();
    expect(screen.getByText("当前成片")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新加载远端" }));
    await waitFor(() => expect(screen.getByLabelText("视频类型")).toHaveValue("product"));
    expect(screen.getByLabelText("视频类型")).toBeEnabled();
    expect(screen.queryByText("当前成片")).not.toBeInTheDocument();
    expect(mocks.runSubtitleOperation).not.toHaveBeenCalled();
  });

  it("loads measured GET data when opening review, and previews unsaved edits without a PATCH", async () => {
    mocks.getSubtitleWorkspace.mockResolvedValue({ ...subtitleWorkspace, segments: [{ ...subtitleSegment, estimated_font_size_px: 48, effective_font_size_px: 30 }] });
    mocks.previewSubtitleWorkspace.mockImplementation(async (_id, payload) => ({
      ...subtitleWorkspace, segments: payload.segments.map((segment: typeof subtitleSegment) => ({ ...segment, estimated_font_size_px: 48, effective_font_size_px: 20 }))
    }));
    panel();
    fireEvent.click(await screen.findByRole("button", { name: "3 · 原文 / 译文校对 (1)" }));
    await screen.findByText("估算字号 48 · 输出字号 30");
    fireEvent.change(screen.getByLabelText("字幕 1译文"), { target: { value: "A longer German line" } });
    fireEvent.click(screen.getByRole("button", { name: "计算排版 · 不保存" }));
    await screen.findByText("估算字号 48 · 输出字号 20");
    expect(mocks.previewSubtitleWorkspace).toHaveBeenCalledWith("workspace-a", expect.objectContaining({ expected_revision: 2, segments: [expect.objectContaining({ translated_text: "A longer German line" })] }), { cache: "no-store" });
    expect(mocks.patchSubtitleWorkspace).not.toHaveBeenCalled();
    expect(mocks.runSubtitleOperation).not.toHaveBeenCalled();
    expect(screen.getByText(/revision 2 · 未保存修改/)).toBeInTheDocument();
  });

  it("restores persistent history, independent videos, eight languages and output", async () => {
    mocks.listSubtitleWorkspaces.mockResolvedValue([{ ...subtitleWorkspace, stage: "succeeded", output_asset_id: "output-a" }]);
    panel();
    await screen.findByText("Translation A");
    expect(screen.getByLabelText("带字幕参考视频资产")).toHaveValue("reference-a");
    expect(screen.getByLabelText("无字幕成片视频资产")).toHaveValue("clean-a");
    expect(screen.getByLabelText("目标语言").querySelectorAll("option")).toHaveLength(8);
    expect(screen.getByLabelText("原语言")).toHaveValue("auto");
    expect(screen.getByRole("link", { name: "下载 MP4" })).toHaveAttribute("href", expect.stringContaining("output-a/content?download=1"));
    expect(screen.getByText(/两份视频时长相差 500 ms/)).toBeInTheDocument();
  });

  it("saves before render using the returned revision", async () => {
    panel();
    fireEvent.click(await screen.findByRole("button", { name: "3 · 原文 / 译文校对 (1)" }));
    await screen.findByLabelText("字幕 1译文");
    fireEvent.change(screen.getByLabelText("字幕 1译文"), { target: { value: "Geprüft" } });
    fireEvent.click(screen.getByRole("button", { name: "保存并压制视频" }));
    await waitFor(() => expect(mocks.runSubtitleOperation).toHaveBeenCalledWith("workspace-a", "render", { expected_revision: 3 }));
    expect(mocks.patchSubtitleWorkspace).toHaveBeenCalledWith("workspace-a", expect.objectContaining({ expected_revision: 2 }));
    expect(mocks.patchSubtitleWorkspace.mock.invocationCallOrder[0]).toBeLessThan(mocks.runSubtitleOperation.mock.invocationCallOrder[0]);
  });

  it("shows the successful PATCH response's actual font and measured sizes in review", async () => {
    mocks.patchSubtitleWorkspace.mockImplementation(async (_id, payload) => ({
      ...subtitleWorkspace, revision: payload.expected_revision + 1,
      segments: payload.segments.map((segment: typeof subtitleSegment) => ({
        ...segment, estimated_font_size_px: 36, effective_font_size_px: 22,
        font_type: SUBTITLE_FONTS[0].url, font_sha256: "b".repeat(64)
      }))
    }));
    panel();
    fireEvent.click(await screen.findByRole("button", { name: "3 · 原文 / 译文校对 (1)" }));
    fireEvent.change(await screen.findByLabelText("字幕 1译文"), { target: { value: "Saved draft" } });
    fireEvent.click(screen.getByRole("button", { name: "保存校对" }));
    await screen.findByText("估算字号 36 · 输出字号 22");
    expect(screen.getByText(`字体 URL：${SUBTITLE_FONTS[0].url}`)).toBeInTheDocument();
    expect(screen.getByText(`SHA-256：${"b".repeat(64)}`)).toBeInTheDocument();
    expect(screen.getByText(/revision 3 · 已保存/)).toBeInTheDocument();
  });

  it("isolates late selection responses and clears previous previews while loading", async () => {
    const b = { ...subtitleWorkspace, id: "workspace-b", name: "Translation B", reference_video_asset_id: "reference-b", segments: [] };
    const c = { ...b, id: "workspace-c", name: "Translation C" };
    mocks.listSubtitleWorkspaces.mockResolvedValue([subtitleWorkspace, b, c]);
    let resolveB!: (value: typeof b) => void;
    mocks.getSubtitleWorkspace.mockImplementation((id) => id === b.id ? new Promise((resolve) => { resolveB = resolve; }) : Promise.resolve(c));
    panel();
    await screen.findByText("Translation A");
    fireEvent.change(screen.getByLabelText("字幕工作区历史"), { target: { value: b.id } });
    expect(screen.queryByText("Translation A")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("字幕工作区历史"), { target: { value: c.id } });
    await screen.findByText("Translation C");
    await act(async () => resolveB(b));
    expect(screen.queryByText("Translation B")).not.toBeInTheDocument();
  });

  it("invalidates current output on target language change without swapping reference", async () => {
    mocks.listSubtitleWorkspaces.mockResolvedValue([{ ...subtitleWorkspace, stage: "succeeded", output_asset_id: "output-a" }]);
    panel();
    await screen.findByText("当前成片");
    fireEvent.change(screen.getByLabelText("目标语言"), { target: { value: "ja" } });
    await waitFor(() => expect(screen.queryByText("当前成片")).not.toBeInTheDocument());
    expect(mocks.patchSubtitleWorkspace).toHaveBeenCalledWith("workspace-a", { expected_revision: 2, target_language: "ja" });
    expect(screen.getByLabelText("带字幕参考视频资产")).toHaveValue("reference-a");
  });

  it("keeps Viewer controls read-only", async () => {
    panel(false);
    await screen.findByText("Translation A");
    expect(screen.getByRole("button", { name: "新建产品视频任务" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "新建开箱视频任务" })).toBeDisabled();
    expect(screen.getByLabelText("视频类型")).toBeDisabled();
    expect(screen.getByLabelText("目标语言")).toBeDisabled();
    expect(screen.getByLabelText("带字幕参考视频上传")).toBeDisabled();
    expect(screen.getByRole("button", { name: "1 · 提取字幕" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "3 · 原文 / 译文校对 (1)" }));
    await screen.findByLabelText("字幕 1译文");
    expect(screen.getByLabelText("字幕 1译文")).toBeDisabled();
  });

  it("retains local draft after a real 409 and never renders on failed save", async () => {
    mocks.patchSubtitleWorkspace.mockRejectedValue(new ApiError({
      code: "task_conflict", message: "Revision changed", status: 409, responseBody: {}
    }));
    panel();
    fireEvent.click(await screen.findByRole("button", { name: "3 · 原文 / 译文校对 (1)" }));
    await screen.findByLabelText("字幕 1译文");
    fireEvent.change(screen.getByLabelText("字幕 1译文"), { target: { value: "My local review" } });
    fireEvent.click(screen.getByRole("button", { name: "保存并压制视频" }));
    await screen.findByText(/远端 revision 已变更/);
    expect(screen.getByLabelText("字幕 1译文")).toHaveValue("My local review");
    expect(mocks.runSubtitleOperation).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "保存校对" })).toBeDisabled();
  });

  it("restores and retries a failed render without repeating extract/translate", async () => {
    mocks.listSubtitleWorkspaces.mockResolvedValue([{ ...subtitleWorkspace, stage: "failed", stage_task_ids: { render: subtitleTask.id } }]);
    mocks.getToolTask.mockResolvedValue({ ...subtitleTask, status: "failed", error: { code: "external_service_error", message: "Render failed", detail: null } });
    mocks.retryToolTask.mockResolvedValue({ ...subtitleTask, id: "retry-a", retry_of_task_id: subtitleTask.id });
    panel();
    fireEvent.click(await screen.findByRole("button", { name: "重试失败阶段" }));
    await waitFor(() => expect(mocks.retryToolTask).toHaveBeenCalledWith(subtitleTask.id));
    expect(mocks.runSubtitleOperation).not.toHaveBeenCalled();
    expect(mocks.patchSubtitleWorkspace).not.toHaveBeenCalled();
  });

  it("imports each video by its independent role and accepts local upload", async () => {
    mocks.importSubtitleVideo.mockResolvedValue({ ...subtitleAsset, id: "clean-import" });
    mocks.uploadSubtitleVideo.mockResolvedValue({ ...subtitleAsset, id: "reference-upload" });
    panel();
    await screen.findByText("Translation A");
    fireEvent.change(screen.getByLabelText("无字幕成片视频地址"), { target: { value: "https://bucket.tos-cn-beijing.volces.com/clean.mp4?signature=secret" } });
    fireEvent.click(screen.getAllByRole("button", { name: "导入地址" })[1]);
    await waitFor(() => expect(mocks.importSubtitleVideo).toHaveBeenCalledWith("https://bucket.tos-cn-beijing.volces.com/clean.mp4?signature=secret", "clean"));
    await waitFor(() => expect(mocks.patchSubtitleWorkspace).toHaveBeenCalledWith("workspace-a", { expected_revision: 2, clean_video_asset_id: "clean-import" }));
    const file = new File(["video"], "reference.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByLabelText("带字幕参考视频上传"), { target: { files: [file] } });
    await waitFor(() => expect(mocks.uploadSubtitleVideo).toHaveBeenCalledWith(file, "reference", { filename: "reference.mp4", mimeType: "video/mp4" }));
    await waitFor(() => expect(mocks.patchSubtitleWorkspace).toHaveBeenLastCalledWith("workspace-a", { expected_revision: 3, reference_video_asset_id: "reference-upload" }));
  });

  it("does not patch another workspace after a late import", async () => {
    const b = { ...subtitleWorkspace, id: "workspace-b", name: "Translation B" };
    mocks.listSubtitleWorkspaces.mockResolvedValue([subtitleWorkspace, b]);
    mocks.getSubtitleWorkspace.mockResolvedValue(b);
    let finish!: (value: typeof subtitleAsset) => void;
    mocks.importSubtitleVideo.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    panel();
    await screen.findByText("Translation A");
    fireEvent.change(screen.getByLabelText("无字幕成片视频地址"), { target: { value: "https://bucket.tos-cn-beijing.volces.com/video.mp4" } });
    fireEvent.click(screen.getAllByRole("button", { name: "导入地址" })[1]);
    fireEvent.change(screen.getByLabelText("字幕工作区历史"), { target: { value: b.id } });
    await screen.findByText("Translation B");
    await act(async () => finish({ ...subtitleAsset, id: "late-import" }));
    expect(mocks.patchSubtitleWorkspace).not.toHaveBeenCalled();
  });

  it("guards dirty history switches and discards only with confirmation", async () => {
    const b = { ...subtitleWorkspace, id: "workspace-b", name: "Translation B" };
    mocks.listSubtitleWorkspaces.mockResolvedValue([subtitleWorkspace, b]);
    mocks.getSubtitleWorkspace.mockResolvedValue(b);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    panel();
    fireEvent.click(await screen.findByRole("button", { name: "3 · 原文 / 译文校对 (1)" }));
    await screen.findByLabelText("字幕 1译文");
    mocks.getSubtitleWorkspace.mockClear();
    fireEvent.change(screen.getByLabelText("字幕 1译文"), { target: { value: "Unsaved" } });
    fireEvent.change(screen.getByLabelText("字幕工作区历史"), { target: { value: b.id } });
    expect(confirm).toHaveBeenCalled();
    expect(mocks.getSubtitleWorkspace).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.change(screen.getByLabelText("字幕工作区历史"), { target: { value: b.id } });
    await screen.findByText("Translation B");
    confirm.mockRestore();
  });
});

describe("category switching hook", () => {
  it("clears all derived layout and render references while retaining inference, input and styles", async () => {
    const original = {
      ...subtitleWorkspace, stage: "succeeded" as const, output_asset_id: "old-output",
      stage_task_ids: { extract: "extract-a", translate: "translate-a", render: "render-a" },
      segments: [{
        ...subtitleSegment, style: { background_color: "#33333359", font_size_px: 32 },
        product_names_enabled: true, product_mentions: [],
        product_text_sha256: "t".repeat(64), product_recognition_sha256: "r".repeat(64),
        render_layer_asset_id: "a".repeat(64), render_layer_url: "/old.png",
        render_bbox_pixels: [1, 2, 3, 4] as [number, number, number, number],
        font_type: "font", font_sha256: "f".repeat(64), text_runs: [],
        warnings: ["background_unknown", "bbox_expanded", "product_recognition_unavailable"]
      }]
    };
    mocks.patchSubtitleWorkspace.mockImplementation(async (_id, change) => ({
      ...original, video_category: change.video_category, revision: 3, stage: "review_ready"
    }));
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useSubtitleWorkspace(original, onUpdate));
    await act(async () => { expect(await result.current.update({ video_category: "product" })).toBe(true); });
    expect(result.current.workspace).toMatchObject({
      video_category: "product", revision: 3, output_asset_id: null,
      reference_video_asset_id: original.reference_video_asset_id, clean_video_asset_id: original.clean_video_asset_id,
      stage_task_ids: { extract: "extract-a", translate: "translate-a" }
    });
    expect(result.current.workspace.stage_task_ids).not.toHaveProperty("render");
    expect(result.current.workspace.segments[0]).toEqual({
      ...original.segments[0], estimated_font_size_px: null, effective_font_size_px: null,
      recommended_text_color: null, render_bbox_pixels: null,
      render_layer_asset_id: null, render_layer_url: null, font_type: null, font_sha256: null, text_runs: null,
      warnings: ["product_recognition_unavailable"]
    });
    expect(onUpdate).toHaveBeenLastCalledWith(result.current.workspace);
    expect(mocks.runSubtitleOperation).not.toHaveBeenCalled();
  });

  it.each(["extracting", "translating", "rendering", "active", "viewer"])("does not switch category while %s", async (mode) => {
    const initial = {
      ...subtitleWorkspace,
      stage: mode === "active" || mode === "viewer" ? subtitleWorkspace.stage : mode as typeof subtitleWorkspace.stage,
      active_task_id: mode === "active" ? subtitleTask.id : null
    };
    const { result } = renderHook(() => useSubtitleWorkspace(initial, vi.fn(), mode !== "viewer"));
    await act(async () => { expect(await result.current.update({ video_category: "product" })).toBe(false); });
    expect(mocks.patchSubtitleWorkspace).not.toHaveBeenCalled();
  });

  it("serializes category updates and keeps the switch disabled during an in-flight save", async () => {
    let finish!: (value: typeof subtitleWorkspace) => void;
    mocks.patchSubtitleWorkspace.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    panel();
    await screen.findByText("Translation A");
    fireEvent.change(screen.getByLabelText("视频类型"), { target: { value: "product" } });
    expect(screen.getByLabelText("视频类型")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("视频类型"), { target: { value: "unboxing" } });
    expect(mocks.patchSubtitleWorkspace).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ...subtitleWorkspace, video_category: "product", revision: 3 }));
    expect(screen.getByLabelText("视频类型")).toHaveValue("product");
    expect(screen.getByLabelText("视频类型")).toBeEnabled();
  });
});

describe("video projection", () => {
  it.each(["product", "unboxing"] as const)("uses %s panel policy after a PNG fails to load", (videoCategory) => {
    class Observer {
      constructor(private callback: (entries: unknown[]) => void) {}
      observe() { this.callback([{ contentRect: { width: 400, height: 400 } }]); }
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", Observer);
    const segment = {
      ...subtitleSegment, background_color: "#FFFFFF", style: { background_color: "#33333359" },
      render_layer_asset_id: "a".repeat(64),
      render_layer_url: `/api/tools/subtitle-translation/workspaces/workspace-a/layers/${"a".repeat(64)}.png`
    };
    const { container } = render(<SubtitleVideoPreview url="/video.mp4" videoCategory={videoCategory} segments={[segment]} seekMs={1000} label="PNG preview" />);
    const video = screen.getByLabelText("PNG preview");
    Object.defineProperties(video, { videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
    fireEvent.loadedMetadata(video);
    const image = container.querySelector("[data-subtitle-layer]")!;
    expect(image).toBeInTheDocument();
    expect(container.querySelector("[data-subtitle-panel]")).not.toBeInTheDocument();
    fireEvent.error(image);
    const text = container.querySelector("[data-subtitle-panel]")!;
    expect(text).toHaveTextContent(segment.translated_text!);
    expect((text as HTMLElement).style.backgroundColor).toBe("");
    expect(text.parentElement).toHaveStyle({ color: videoCategory === "product" ? "#000000" : "#FFFFFF" });
    expect(screen.getByText("图层加载失败；文字回退底板使用接口默认值")).toBeInTheDocument();
    expect(video).toHaveAttribute("controls");
  });

  it("maps output pixel boxes using display dimensions and falls back to original coordinates", () => {
    const measured = { ...subtitleSegment, render_bbox_pixels: [96, 216, 1728, 324] as [number, number, number, number] };
    expect(subtitlePreviewBox(measured, 1920, 1080)).toEqual({ left: 5, top: 20, width: 85, height: 10 });
    expect(subtitlePreviewBox({ ...measured, render_bbox_pixels: null }, 1920, 1080)).toEqual({
      left: 100 / 999 * 100, top: 200 / 999 * 100, width: 500 / 999 * 100, height: 100 / 999 * 100
    });
  });

  it("excludes letterboxing for landscape, portrait and rotated display sizes", () => {
    expect(containedVideoRect(400, 400, 1920, 1080)).toEqual({ left: 0, top: 87.5, width: 400, height: 225, scale: 400 / 1920 });
    expect(containedVideoRect(400, 400, 1080, 1920)).toEqual({ left: 87.5, top: 0, width: 225, height: 400, scale: 400 / 1920 });
    expect(containedVideoRect(0, 400, 1080, 1920)).toBeNull();
  });

  it("uses object-contain and preserves native controls", () => {
    render(<SubtitleVideoPreview url="/video.mp4" segments={[subtitleSegment]} label="Preview" />);
    const video = screen.getByLabelText("Preview");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveClass("object-contain");
  });

  it("shows concurrent subtitles in the actual picture rect without CSS rescaling", () => {
    const OriginalObserver = globalThis.ResizeObserver;
    class Observer {
      constructor(private callback: (entries: unknown[]) => void) {}
      observe() { this.callback([{ contentRect: { width: 400, height: 400 } }]); }
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", Observer);
    const measured = { ...subtitleSegment, render_bbox_pixels: [96, 216, 1728, 324] as [number, number, number, number], style: { font: "CenturyGothic" }, font_type: SUBTITLE_FONTS[1].url, font_sha256: "a".repeat(64) };
    const { container, rerender } = render(<SubtitleVideoPreview url="/video.mp4" layoutSize={{ width: 1920, height: 1080 }} segments={[measured, { ...subtitleSegment, segment_id: "line-b", translated_text: "Footnote" }]} selectedId="line-a" seekMs={1000} label="Preview" />);
    const video = screen.getByLabelText("Preview") as HTMLVideoElement;
    Object.defineProperties(video, { videoWidth: { value: 960 }, videoHeight: { value: 540 }, readyState: { value: 1 } });
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(1);
    expect(screen.getByText("Leistung 20 W")).toBeInTheDocument();
    expect(screen.getByText("Footnote")).toBeInTheDocument();
    const overlay = container.querySelector(".pointer-events-none") as HTMLElement;
    expect(overlay).toHaveStyle({ top: "87.5px", height: "225px", width: "400px" });
    expect(overlay.style.scale).toBe("");
    const text = screen.getByText("Leistung 20 W");
    expect(text.parentElement).toHaveStyle({ left: "5%", width: "85%", top: "20%", height: "10%" });
    expect(text.parentElement).toHaveClass("whitespace-nowrap");
    expect(text.parentElement).toHaveStyle({
      fontFamily: "subtitle-CenturyGothic, sans-serif", fontSize: `${32 * 400 / 1920}px`,
      fontWeight: "400", fontSynthesis: "none"
    });
    expect(text.style.backgroundColor).toBe("");
    video.currentTime = 4;
    rerender(<SubtitleVideoPreview url="/video.mp4" segments={[subtitleSegment]} selectedId="line-a" seekMs={1000} seekRequest={1} label="Preview" />);
    expect(video.currentTime).toBe(1);
    vi.stubGlobal("ResizeObserver", OriginalObserver);
  });

  it("renders same-block roles with real font files despite stale Bold summaries and restores auto after manual overrides", () => {
    class Observer {
      constructor(private callback: (entries: unknown[]) => void) {}
      observe() { this.callback([{ contentRect: { width: 400, height: 400 } }]); }
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", Observer);
    const segments = ["headline", "body", "footnote", null, undefined, "legacy"].map((role, index) => ({
      ...subtitleSegment, segment_id: `role-${index}`, visual_role: role as string,
      translated_text: `Role ${index}`, line_index: index, font_type: SUBTITLE_FONTS[3].url
    }));
    const props = { url: "/video.mp4", seekMs: 1000, label: "Role preview" };
    const { container, rerender } = render(<SubtitleVideoPreview {...props} segments={segments} />);
    const video = screen.getByLabelText("Role preview");
    Object.defineProperties(video, { videoWidth: { value: 1920 }, videoHeight: { value: 1080 }, readyState: { value: 1 } });
    fireEvent.loadedMetadata(video);
    const expectFonts = (ids: string[]) => ids.forEach((id, index) => {
      expect(container.querySelector(`[data-subtitle-box="role-${index}"]`)).toHaveStyle({
        fontFamily: `subtitle-${id}, sans-serif`, fontWeight: "400", fontSynthesis: "none"
      });
    });
    const automatic = ["CenturyGothicBold", ...Array<string>(5).fill("CenturyGothic")];
    expectFonts(automatic);
    for (const font of SUBTITLE_FONTS) {
      expect(container.querySelector("style")?.textContent).toContain(
        `font-family:subtitle-${font.id};src:url("${font.url}");font-weight:400;font-style:normal;`
      );
    }
    rerender(<SubtitleVideoPreview {...props} segments={segments.map((segment, index) => ({
      ...segment, style: { font: index === 0 ? "CenturyGothic" : "CenturyGothicBold" }
    }))} />);
    expectFonts(["CenturyGothic", ...Array<string>(5).fill("CenturyGothicBold")]);
    rerender(<SubtitleVideoPreview {...props} segments={segments.map((segment) => ({
      ...segment, style: { font: null }
    }))} />);
    expectFonts(automatic);
    expect(segments.every((segment) => segment.block_id === "title" && segment.font_type === SUBTITLE_FONTS[3].url)).toBe(true);
  });
});
