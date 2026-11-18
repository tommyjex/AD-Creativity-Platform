import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubtitleWorkspaceEditor } from "@/components/workspace/subtitle-translation/workspace-editor";
import { SubtitleReviewDialog } from "@/components/workspace/subtitle-translation/review-dialog";
import { SubtitleVideoPreview } from "@/components/workspace/subtitle-translation/video-preview";
import { useSubtitleWorkspace } from "@/components/workspace/subtitle-translation/use-subtitle-workspace";
import type { SubtitleWorkspace } from "@/lib/api-types";
import { ApiError } from "@/lib/api-client";
import { subtitleCrf, subtitleRenderMode, subtitleRenderSummaryLabel, subtitleTaskRenderSummaryLabel, subtitleWarningMessage } from "@/lib/subtitle-translation";
import { subtitleAsset, subtitleSegment, subtitleTask, subtitleWorkspace } from "./subtitle-translation-fixtures";

const mocks = vi.hoisted(() => ({
  patchSubtitleWorkspace: vi.fn(), getSubtitleWorkspace: vi.fn(), getToolTask: vi.fn(),
  runSubtitleOperation: vi.fn(), previewSubtitleWorkspace: vi.fn(), recognizeSubtitleProducts: vi.fn()
}));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api-client")>(), apiClient: mocks
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getToolTask.mockResolvedValue({ ...subtitleTask, status: "succeeded" });
  mocks.getSubtitleWorkspace.mockResolvedValue(subtitleWorkspace);
});
afterEach(() => { vi.unstubAllGlobals(); });

function editor(initial = subtitleWorkspace, canWrite = true, assets = [subtitleAsset]) {
  return render(<SubtitleWorkspaceEditor initial={initial} canWrite={canWrite} assets={assets}
    onUpdate={vi.fn()} onAsset={vi.fn()} onDirtyChange={vi.fn()} />);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("subtitle render mode selection", () => {
  it.each([0, 12, 30])("saves and reloads CRF %s without clearing layout or upstream data", async (crf) => {
    let remote = { ...subtitleWorkspace };
    mocks.patchSubtitleWorkspace.mockImplementation(async (_id, payload) => {
      remote = { ...remote, ...payload, revision: payload.expected_revision + 1 };
      return remote;
    });
    mocks.getSubtitleWorkspace.mockImplementation(async () => remote);
    const view = editor();
    expect(subtitleCrf(remote)).toBe(16);
    fireEvent.change(screen.getByLabelText("压制 CRF"), { target: { value: String(crf) } });
    await waitFor(() => expect(screen.getByLabelText("压制 CRF")).toHaveValue(String(crf)));
    expect(mocks.patchSubtitleWorkspace).toHaveBeenCalledWith("workspace-a", { expected_revision: 2, crf });
    expect(remote.segments).toEqual(subtitleWorkspace.segments);
    fireEvent.click(screen.getByRole("button", { name: "刷新工作区" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "刷新工作区" })).toBeEnabled());
    view.unmount();
    editor(remote);
    expect(screen.getByLabelText("压制 CRF")).toHaveValue(String(crf));
    expect(screen.getByText(new RegExp(`新任务 H.264 / CRF ${crf}`))).toBeInTheDocument();
    expect(mocks.runSubtitleOperation).not.toHaveBeenCalled();
  });

  it("CRF hook detaches only current render and preserves returned layout, inference and warnings", async () => {
    const initial = { ...subtitleWorkspace, crf: 16, output_asset_id: "old-output",
      stage_task_ids: { extract: "extract", translate: "translate", render: "render" },
      segments: [{ ...subtitleSegment, render_layer_asset_id: "png", render_layer_url: "/png",
        effective_font_size_px: 24, text_runs: [], warnings: ["layout_preview:notice"] }] };
    mocks.patchSubtitleWorkspace.mockResolvedValue({ ...initial, crf: 0, revision: 3 });
    const { result } = renderHook(() => useSubtitleWorkspace(initial, vi.fn()));
    await act(async () => { await result.current.update({ crf: 0 }); });
    expect(result.current.workspace.output_asset_id).toBeNull();
    expect(result.current.workspace.stage_task_ids).toEqual({ extract: "extract", translate: "translate" });
    expect(result.current.workspace.segments).toEqual(initial.segments);
    expect(result.current.workspace.warnings).toEqual(initial.warnings);
  });

  it.each([0, 12, 30])("shows frozen CRF %s in historical summaries", (crf) => {
    const task = { ...subtitleTask, input_snapshot: { ...subtitleTask.input_snapshot,
      render_mode: "text", encoding_policy_version: "configurable-crf-h264-v3",
      encoding_result: { video_codec: "h264", crf } } };
    expect(subtitleTaskRenderSummaryLabel(task)).toContain(`H.264 · CRF ${crf}`);
    expect(subtitleRenderSummaryLabel({ video_codec: "h264", crf })).toContain(`H.264 · CRF ${crf}`);
    expect(subtitleTaskRenderSummaryLabel({ ...task, input_snapshot: {
      ...task.input_snapshot, result: { video_codec: "h264", crf: 16 } } })).toContain("CRF 16");
  });
  it("defaults missing workspace fields to PNG with exactly one selector", () => {
    expect(subtitleRenderMode(subtitleWorkspace)).toBe("png");
    editor();
    expect(screen.getAllByLabelText("字幕压制方式")).toHaveLength(1);
    expect(screen.getByLabelText("字幕压制方式")).toHaveValue("png");
    expect(screen.getByRole("option", { name: "PNG · 图片绘制" })).toHaveValue("png");
    expect(screen.getByRole("option", { name: "Text · 原生文字" })).toHaveValue("text");
    expect(screen.getByLabelText("压制 CRF")).toHaveValue("16");
    expect(within(screen.getByLabelText("压制 CRF")).getAllByRole("option")).toHaveLength(31);
  });

  it("persists Text, survives refresh/remount and switches back to PNG", async () => {
    let remote = { ...subtitleWorkspace };
    mocks.patchSubtitleWorkspace.mockImplementation(async (_id, payload) => {
      remote = { ...remote, ...payload, revision: payload.expected_revision + 1 };
      return remote;
    });
    mocks.getSubtitleWorkspace.mockImplementation(async () => remote);
    const view = editor();
    fireEvent.change(screen.getByLabelText("字幕压制方式"), { target: { value: "text" } });
    await waitFor(() => expect(screen.getByLabelText("字幕压制方式")).toHaveValue("text"));
    expect(mocks.patchSubtitleWorkspace).toHaveBeenCalledWith("workspace-a", { expected_revision: 2, render_mode: "text" });
    fireEvent.click(screen.getByRole("button", { name: "刷新工作区" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "刷新工作区" })).toBeEnabled());
    view.unmount();
    editor(remote);
    expect(screen.getByLabelText("字幕压制方式")).toHaveValue("text");
    fireEvent.change(screen.getByLabelText("字幕压制方式"), { target: { value: "png" } });
    await waitFor(() => expect(screen.getByLabelText("字幕压制方式")).toHaveValue("png"));
    expect(mocks.patchSubtitleWorkspace).toHaveBeenLastCalledWith("workspace-a", { expected_revision: 3, render_mode: "png" });
    expect(mocks.runSubtitleOperation).not.toHaveBeenCalled();
    expect(mocks.recognizeSubtitleProducts).not.toHaveBeenCalled();
  });

  it.each(["extracting", "translating", "rendering", "active", "viewer"])(
    "matches category selector disabling while %s", async (condition) => {
      const initial: SubtitleWorkspace = {
        ...subtitleWorkspace,
        stage: condition === "active" || condition === "viewer" ? "review_ready" :
          condition as SubtitleWorkspace["stage"],
        active_task_id: condition === "active" ? subtitleTask.id : null
      };
      mocks.getSubtitleWorkspace.mockResolvedValue(initial);
      editor(initial, condition !== "viewer");
      await act(async () => {});
      expect(screen.getByLabelText("字幕压制方式")).toBeDisabled();
      expect(screen.getByLabelText("视频类型")).toBeDisabled();
      expect(screen.getByLabelText("压制 CRF")).toBeDisabled();
      fireEvent.change(screen.getByLabelText("字幕压制方式"), { target: { value: "text" } });
      expect(mocks.patchSubtitleWorkspace).not.toHaveBeenCalled();
    }
  );

  it("serializes in-flight updates and keeps the saved selection until PATCH succeeds", async () => {
    const pending = deferred<SubtitleWorkspace>();
    mocks.patchSubtitleWorkspace.mockReturnValue(pending.promise);
    editor();
    fireEvent.change(screen.getByLabelText("字幕压制方式"), { target: { value: "text" } });
    expect(screen.getByLabelText("字幕压制方式")).toBeDisabled();
    expect(screen.getByLabelText("字幕压制方式")).toHaveValue("png");
    fireEvent.change(screen.getByLabelText("字幕压制方式"), { target: { value: "text" } });
    expect(mocks.patchSubtitleWorkspace).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ ...subtitleWorkspace, render_mode: "text", revision: 3 }));
    expect(screen.getByLabelText("字幕压制方式")).toHaveValue("text");
    expect(screen.getByLabelText("字幕压制方式")).toBeEnabled();
  });

  it("retains current output on conflict, blocks another switch, then reloads saved remote mode", async () => {
    const original: SubtitleWorkspace = { ...subtitleWorkspace, stage: "succeeded", output_asset_id: "old-output" };
    mocks.patchSubtitleWorkspace.mockRejectedValue(new ApiError({
      code: "task_conflict", message: "Revision changed", status: 409, responseBody: {}
    }));
    mocks.getSubtitleWorkspace.mockResolvedValue({ ...subtitleWorkspace, revision: 3, render_mode: "text" });
    editor(original);
    fireEvent.change(screen.getByLabelText("字幕压制方式"), { target: { value: "text" } });
    await screen.findByText("revision 冲突，未覆盖远端修改。");
    expect(screen.getByText("当前成片")).toBeInTheDocument();
    expect(screen.getByLabelText("字幕压制方式")).toHaveValue("png");
    expect(screen.getByLabelText("字幕压制方式")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("字幕压制方式"), { target: { value: "text" } });
    expect(mocks.patchSubtitleWorkspace).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "重新加载远端" }));
    await waitFor(() => expect(screen.getByLabelText("字幕压制方式")).toHaveValue("text"));
    expect(screen.queryByText("当前成片")).not.toBeInTheDocument();
  });

  it.each(["main", "review"])("uses the same saved Text mode for the %s render entry", async (entry) => {
    let remote: SubtitleWorkspace = { ...subtitleWorkspace, crf: 0 };
    mocks.patchSubtitleWorkspace.mockImplementation(async (_id, payload) => {
      remote = { ...remote, ...payload, revision: payload.expected_revision + 1 };
      return remote;
    });
    mocks.getSubtitleWorkspace.mockImplementation(async () => remote);
    mocks.runSubtitleOperation.mockImplementation(async (_id, operation, payload) => {
      expect(operation).toBe("render");
      expect(remote.render_mode).toBe("text");
      expect(remote.crf).toBe(0);
      expect(payload).toEqual({ expected_revision: remote.revision });
      return { ...subtitleTask, status: "succeeded", input_snapshot: {
        ...subtitleTask.input_snapshot,
        input_payload: { render_mode: remote.render_mode, crf: remote.crf, encoding_policy_version: "configurable-crf-h264-v3" }
      } };
    });
    editor(remote);
    fireEvent.change(screen.getByLabelText("字幕压制方式"), { target: { value: "text" } });
    await waitFor(() => expect(screen.getByLabelText("字幕压制方式")).toHaveValue("text"));
    if (entry === "review") {
      fireEvent.click(screen.getByRole("button", { name: "3 · 原文 / 译文校对 (1)" }));
      await screen.findByLabelText("字幕 1译文");
      expect(within(screen.getByRole("dialog")).getByText(/已保存压制方式：Text/)).toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).getByText(/CRF 0/)).toBeInTheDocument();
      expect(screen.queryByLabelText("字幕 1底板模式")).not.toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).queryByLabelText("字幕压制方式")).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: entry === "main" ? "4 · 压制已保存字幕" : "保存并压制视频" }));
    await waitFor(() => expect(mocks.runSubtitleOperation).toHaveBeenCalledTimes(1));
    expect(mocks.patchSubtitleWorkspace).toHaveBeenLastCalledWith("workspace-a", {
      expected_revision: 3, segments: expect.any(Array)
    });
    expect(mocks.recognizeSubtitleProducts).not.toHaveBeenCalled();
  });
});

describe("subtitle render mode invalidation", () => {
  it("clears layout/current render only, retaining product cache, input, styles, warnings and historical objects", async () => {
    const original: SubtitleWorkspace = {
      ...subtitleWorkspace, stage: "succeeded", output_asset_id: "old-output",
      stage_task_ids: { extract: "extract-a", translate: "translate-a", render: "render-a" },
      warnings: ["line-a:text_product_font_fallback", "product_recognition_unavailable", "brand_content_skipped"],
      segments: [{
        ...subtitleSegment, style: { font: "CenturyGothicBold", font_size_px: 24, background_color: "#12345680" },
        product_names_enabled: true, product_mentions: [{ start: 0, end: 8, model: "Leistung",
          spec: "20 W", origin: "manual", status: "confirmed", catalog_id: null }],
        product_text_sha256: "text-sha", product_recognition_sha256: "recognition-sha",
        render_layer_asset_id: "old-layer", render_layer_url: "/old.png",
        effective_render_mode: "png", text_runs: [],
        warnings: ["line-a:font_size_reduced", "text_product_font_fallback", "brand_content_skipped", "product_recognition_unavailable"]
      }]
    };
    const history = structuredClone(original);
    const pendingTask = deferred<typeof subtitleTask>();
    mocks.getToolTask.mockImplementation((id) => id === "render-a" ? pendingTask.promise :
      Promise.resolve({ ...subtitleTask, id, input_snapshot: { operation: "translate" } }));
    mocks.patchSubtitleWorkspace.mockResolvedValue({ ...original, revision: 3, render_mode: "text", stage: "review_ready" });
    const { result } = renderHook(() => useSubtitleWorkspace(original, vi.fn()));
    await act(async () => { expect(await result.current.update({ render_mode: "text" })).toBe(true); });
    expect(result.current.workspace).toMatchObject({
      render_mode: "text", revision: 3, output_asset_id: null,
      stage_task_ids: { extract: "extract-a", translate: "translate-a" },
      warnings: ["product_recognition_unavailable", "brand_content_skipped"]
    });
    expect(result.current.workspace.stage_task_ids).not.toHaveProperty("render");
    expect(result.current.workspace.segments[0]).toEqual({
      ...original.segments[0], estimated_font_size_px: null, effective_font_size_px: null,
      recommended_text_color: null, render_bbox_pixels: null, font_type: null, font_sha256: null,
      render_layer_asset_id: null, render_layer_url: null, text_runs: null, effective_render_mode: null,
      warnings: ["brand_content_skipped", "product_recognition_unavailable"]
    });
    await act(async () => pendingTask.resolve({ ...subtitleTask, id: "render-a" }));
    expect(result.current.task?.id).not.toBe("render-a");
    expect(original).toEqual(history);
    expect(mocks.runSubtitleOperation).not.toHaveBeenCalled();
    expect(mocks.recognizeSubtitleProducts).not.toHaveBeenCalled();
  });

  it("remeasures Text drafts without saving and rejects a response for the other mode", async () => {
    const initial: SubtitleWorkspace = { ...subtitleWorkspace, render_mode: "text" };
    mocks.previewSubtitleWorkspace.mockResolvedValue({
      ...initial, segments: [{ ...subtitleSegment, effective_font_size_px: 24 }]
    });
    const { result } = renderHook(() => useSubtitleWorkspace(initial, vi.fn()));
    await act(async () => {
      expect(await result.current.preview(initial.segments)).toMatchObject({ render_mode: "text", revision: 2 });
    });
    expect(result.current.workspace).toBe(initial);
    expect(mocks.previewSubtitleWorkspace).toHaveBeenCalledWith(initial.id,
      { expected_revision: 2, segments: initial.segments }, { cache: "no-store" });
    mocks.previewSubtitleWorkspace.mockResolvedValue({ ...initial, render_mode: "png" });
    await act(async () => { expect(await result.current.preview(initial.segments)).toBeNull(); });
    expect(mocks.patchSubtitleWorkspace).not.toHaveBeenCalled();
  });

  it("does not return a late preview after unmount", async () => {
    const pending = deferred<SubtitleWorkspace>();
    mocks.previewSubtitleWorkspace.mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useSubtitleWorkspace(subtitleWorkspace, vi.fn()));
    let preview!: Promise<SubtitleWorkspace | null>;
    act(() => { preview = result.current.preview(subtitleWorkspace.segments); });
    unmount();
    await act(async () => pending.resolve(subtitleWorkspace));
    expect(await preview).toBeNull();
  });
});

describe("subtitle render summary and Text preview", () => {
  it.each([["png", null], ["text", "已回退 Text"], ["mixed", "部分字幕回退 Text"]] as const)(
    "labels requested PNG and actual %s using the frozen snapshot", (effective, fallback) => {
      const task = { ...subtitleTask, input_snapshot: {
        ...subtitleTask.input_snapshot, render_mode: "png", encoding_policy_version: "crf16-h264-v2",
        input_payload: { render_mode: "text", encoding_policy_version: "legacy" },
        result: { render_mode: "png", effective_render_mode: effective }
      } };
      const label = subtitleTaskRenderSummaryLabel(task);
      expect(label).toContain("请求 PNG · 图片绘制");
      expect(label).toContain("H.264 · CRF 16");
      if (fallback) expect(label).toContain(fallback);
      else expect(label).not.toContain("回退");
    }
  );

  it("never invents PNG, actual mode or CRF for old tasks and assets", () => {
    const label = subtitleTaskRenderSummaryLabel(subtitleTask);
    expect(label).toContain("历史参数");
    expect(label).not.toMatch(/PNG|CRF 16/);
    expect(subtitleRenderSummaryLabel({ render_mode: "text" })).toContain("实际方式未记录");
    expect(subtitleRenderSummaryLabel({ render_mode: "text" })).not.toContain("CRF 16");
  });

  it("shows task fallback and output metadata independently of selected mode", async () => {
    const initial: SubtitleWorkspace = { ...subtitleWorkspace, render_mode: "text",
      stage: "succeeded", output_asset_id: "output-a", stage_task_ids: { render: "task-a" } };
    mocks.getToolTask.mockResolvedValue({ ...subtitleTask, status: "succeeded", input_snapshot: {
      ...subtitleTask.input_snapshot,
      input_payload: { render_mode: "png", encoding_policy_version: "crf16-h264-v2" },
      result: { render_mode: "png", effective_render_mode: "mixed" }
    } });
    editor(initial, true, [{ ...subtitleAsset, id: "output-a", metadata: {
      render_mode: "png", effective_render_mode: "text", video_codec: "h264", crf: 16
    } }]);
    await screen.findByText(/部分字幕回退 Text/);
    expect(screen.getByText(/已回退 Text/)).toHaveTextContent("实际 Text");
    expect(screen.getByLabelText("字幕压制方式")).toHaveValue("text");
  });

  it("keeps old current outputs marked as historical parameters", () => {
    editor({ ...subtitleWorkspace, render_mode: "text", stage: "succeeded", output_asset_id: "output-a" },
      true, [{ ...subtitleAsset, id: "output-a" }]);
    const section = screen.getByText("当前成片").closest("section")!;
    expect(within(section).getByText(/历史参数/)).not.toHaveTextContent(/CRF 16|PNG|实际 Text/);
  });

  it("shows the safe product warning only when reported, and ignores stale PNG in Text", async () => {
    class Observer {
      constructor(private callback: (entries: unknown[]) => void) {}
      observe() { this.callback([{ contentRect: { width: 400, height: 400 } }]); }
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", Observer);
    const initial: SubtitleWorkspace = { ...subtitleWorkspace, render_mode: "text", segments: [{
      ...subtitleSegment, warnings: ["line-a:text_product_font_fallback"],
      render_layer_asset_id: "a".repeat(64),
      render_layer_url: `/api/tools/subtitle-translation/workspaces/w/layers/${"a".repeat(64)}.png`
    }] };
    const props = { workspace: initial, open: true, readOnly: false, busy: false, conflict: false, error: null,
      onClose: vi.fn(), onSave: vi.fn(), onRender: vi.fn(), onRetry: vi.fn(),
      onReload: vi.fn(), onPreview: vi.fn(), onDirtyChange: vi.fn() };
    const { rerender } = render(<SubtitleReviewDialog {...props} />);
    const container = screen.getByRole("dialog");
    expect(subtitleWarningMessage("line-a:text_product_font_fallback")).toBe("Text 模式：产品名按整行字体压制");
    expect(screen.getByText("Text 模式：产品名按整行字体压制")).toBeInTheDocument();
    const video = screen.getByLabelText("无字幕视频 · 译文排版示意");
    Object.defineProperties(video, { videoWidth: { value: 1280 }, videoHeight: { value: 720 } });
    fireEvent.loadedMetadata(video);
    expect(container.querySelector("[data-subtitle-layer]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-subtitle-panel]")).toHaveTextContent("Leistung 20 W");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveClass("object-contain");
    expect(container.querySelector("[data-subtitle-box]")).toHaveStyle({
      fontFamily: "subtitle-CenturyGothicBold, sans-serif", fontWeight: "400", fontSynthesis: "none"
    });
    rerender(<SubtitleReviewDialog {...props} workspace={{ ...initial, render_mode: "png" }} />);
    expect(screen.queryByText("Text 模式：产品名按整行字体压制")).not.toBeInTheDocument();
  });

  it("restores PNG layer after a Text preview without mutating the source segment", () => {
    class Observer {
      constructor(private callback: (entries: unknown[]) => void) {}
      observe() { this.callback([{ contentRect: { width: 400, height: 400 } }]); }
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", Observer);
    const segment = { ...subtitleSegment, render_layer_asset_id: "a".repeat(64),
      render_layer_url: `/api/tools/subtitle-translation/workspaces/w/layers/${"a".repeat(64)}.png` };
    const props = { url: "/video.mp4", segments: [segment], seekMs: 1000, label: "Mode preview" };
    const { container, rerender } = render(<SubtitleVideoPreview {...props} renderMode="png" />);
    const video = screen.getByLabelText("Mode preview");
    Object.defineProperties(video, { videoWidth: { value: 1280 }, videoHeight: { value: 720 } });
    fireEvent.loadedMetadata(video);
    expect(container.querySelector("[data-subtitle-layer]")).toBeInTheDocument();
    rerender(<SubtitleVideoPreview {...props} renderMode="text" />);
    expect(container.querySelector("[data-subtitle-layer]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-subtitle-panel]")).toHaveTextContent(segment.translated_text!);
    expect(screen.getByText(/Text · 底板使用接口默认值；排版示意，最终以 MediaKit 成片为准/)).toBeInTheDocument();
    rerender(<SubtitleVideoPreview {...props} renderMode="png" />);
    expect(container.querySelector("[data-subtitle-layer]")).toBeInTheDocument();
    expect(segment.render_layer_url).toContain(".png");
  });
});
