import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubtitleTranslationPanel } from "@/components/workspace/subtitle-translation/panel";
import { SubtitleReviewDialog } from "@/components/workspace/subtitle-translation/review-dialog";
import { SubtitleVideoPreview } from "@/components/workspace/subtitle-translation/video-preview";
import { containedVideoRect, segmentDraftIssue, segmentIssue, subtitleColors, subtitlePreviewBox, SUBTITLE_CAPACITY_NOTICE, SUBTITLE_FONTS, subtitleWarningMessage } from "@/lib/subtitle-translation";
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
    expect(screen.getByRole("button", { name: "新建字幕工作区" })).toBeDisabled();
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

describe("video projection", () => {
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
      fontFamily: "subtitle-SY_Black_JP, sans-serif", fontSize: `${32 * 400 / 1920}px`
    });
    expect(text.style.backgroundColor).toBe("rgba(51, 51, 51, 0.35)");
    video.currentTime = 4;
    rerender(<SubtitleVideoPreview url="/video.mp4" segments={[subtitleSegment]} selectedId="line-a" seekMs={1000} seekRequest={1} label="Preview" />);
    expect(video.currentTime).toBe(1);
    vi.stubGlobal("ResizeObserver", OriginalObserver);
  });
});
