import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSubtitleWorkspace } from "@/components/workspace/subtitle-translation/use-subtitle-workspace";
import type { SubtitleRenderMode, SubtitleWorkspace, ToolTask } from "@/lib/api-types";
import {
  clearSubtitleLayout, clearSubtitleLayoutWarnings, subtitleTaskRenderSummaryLabel
} from "@/lib/subtitle-translation";
import { subtitleAsset, subtitleSegment, subtitleTask, subtitleWorkspace } from "./subtitle-translation-fixtures";

const mocks = vi.hoisted(() => ({
  patchSubtitleWorkspace: vi.fn(), getSubtitleWorkspace: vi.fn(), getToolTask: vi.fn(),
  runSubtitleOperation: vi.fn(), recognizeSubtitleProducts: vi.fn()
}));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api-client")>(), apiClient: mocks
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getToolTask.mockResolvedValue({ ...subtitleTask, status: "succeeded" });
});

describe("frozen submitted render summary", () => {
  it.each([
    ["running", "text", "实际 Text · 原生文字", "已回退 Text"],
    ["running", "mixed", "实际 PNG / Text · 混合", "部分字幕回退 Text"],
    ["failed", "text", "实际 Text · 原生文字", "已回退 Text"],
    ["failed", "mixed", "实际 PNG / Text · 混合", "部分字幕回退 Text"]
  ] as const)("shows %s task's recorded %s fallback before completion", (status, mode, actual, fallback) => {
    const task: ToolTask = {
      ...subtitleTask, status, provider_task_id: "submitted-a",
      input_snapshot: {
        ...subtitleTask.input_snapshot, render_mode: "png", effective_render_mode: mode,
        encoding_policy_version: "crf16-h264-v2",
        input_payload: { render_mode: "text" }
      }
    };
    const original = structuredClone(task);
    expect(subtitleTaskRenderSummaryLabel(task)).toBe(
      `请求 PNG · 图片绘制 · ${actual} · ${fallback} · H.264 · CRF 16`
    );
    expect(task).toEqual(original);
  });

  it.each([
    ["png", "实际 PNG · 图片绘制", null],
    ["text", "实际 Text · 原生文字", "已回退 Text"],
    ["mixed", "实际 PNG / Text · 混合", "部分字幕回退 Text"]
  ] as const)("prefers completed result %s over a conflicting snapshot", (mode, actual, fallback) => {
    const label = subtitleTaskRenderSummaryLabel({
      ...subtitleTask, status: "succeeded",
      input_snapshot: {
        render_mode: "png", effective_render_mode: mode === "text" ? "mixed" : "text",
        result: { effective_render_mode: mode }
      }
    });
    expect(label).toBe(
      ["请求 PNG · 图片绘制", actual, fallback, "历史参数"].filter(Boolean).join(" · ")
    );
  });

  it.each([undefined, null, "invalid", { mode: "png" }])(
    "uses a valid frozen mode when result mode is %j", (effective) => {
      const label = subtitleTaskRenderSummaryLabel({
        ...subtitleTask, status: "failed",
        input_snapshot: {
          render_mode: "png", effective_render_mode: "text",
          result: { effective_render_mode: effective }
        }
      });
      expect(label).toBe("请求 PNG · 图片绘制 · 实际 Text · 原生文字 · 已回退 Text · 历史参数");
    }
  );

  it.each([undefined, null, "invalid", ["text"]])(
    "does not infer actual mode or encoding from requests when snapshot mode is %j", (effective) => {
      const label = subtitleTaskRenderSummaryLabel({
        ...subtitleTask, status: "running",
        input_snapshot: {
          render_mode: "png", effective_render_mode: effective,
          input_payload: { render_mode: "text", effective_render_mode: "text" }
        }
      });
      expect(label).toBe("请求 PNG · 图片绘制 · 实际方式未记录 · 历史参数");
      expect(label).not.toMatch(/回退|CRF 16/);
    }
  );

  it("keeps historical tasks unknown even when a current workspace selects Text", () => {
    const current = { ...subtitleWorkspace, render_mode: "text" as const, stage_task_ids: { render: subtitleTask.id } };
    expect(current.render_mode).toBe("text");
    expect(subtitleTaskRenderSummaryLabel(subtitleTask)).toBe("请求方式未知 · 实际方式未记录 · 历史参数");
  });
});

const derivedWarnings = [
  "png_text_fallback", "png_mixed_fallback", "subtitle_raster_unavailable",
  "background_unknown", "background_color_unavailable", "low_contrast", "contrast_unverified",
  "expanded_background_unverified"
];
const retainedWarnings = [
  "product_recognition_unavailable", "product_recognition_invalid_split",
  "product_name_marker_invalid", "product_name_missing_after_translation",
  "missing_translation", "brand_content_skipped", "source_video_bit_rate_unavailable",
  "video_duration_mismatch", "custom_history_notice",
  "not_png_text_fallback", "png_mixed_fallback_extra"
];

describe("derived render warning cleanup", () => {
  it.each([false, true])("clears plain/prefixed layout warnings with modeChanged=%s without losing content/history notices", (changed) => {
    const warnings = [
      ...derivedWarnings, ...derivedWarnings.map((code) => `line-a: ${code} :detail`),
      ...retainedWarnings, ...retainedWarnings.map((code) => `line-a:${code}`)
    ];
    const original = [...warnings];
    const expected = [...retainedWarnings, ...retainedWarnings.map((code) => `line-a:${code}`)];
    expect(clearSubtitleLayoutWarnings(warnings, changed)).toEqual(expected);
    expect(clearSubtitleLayoutWarnings(expected, changed)).toEqual(expected);
    expect(warnings).toEqual(original);
  });

  it("clears a segment's derived rendering while retaining text, product cache, manual style and input", () => {
    const segment = {
      ...subtitleSegment, effective_render_mode: "png" as const,
      render_layer_asset_id: "layer-a", render_layer_url: "/old.png",
      product_text_sha256: "text-sha", product_recognition_sha256: "recognition-sha",
      product_mentions: [{ start: 0, end: 8, model: "Leistung", spec: "20 W",
        origin: "manual" as const, status: "confirmed" as const, catalog_id: null }],
      style: { font: "CenturyGothicBold", text_color: "#FFFFFF", background_color: "#12345680" },
      warnings: [...derivedWarnings, ...retainedWarnings]
    };
    const original = structuredClone(segment);
    expect(clearSubtitleLayout(segment, true)).toEqual({
      ...segment, estimated_font_size_px: null, effective_font_size_px: null,
      render_bbox_pixels: null, recommended_text_color: null, font_type: null, font_sha256: null,
      render_layer_asset_id: null, render_layer_url: null, text_runs: null,
      effective_render_mode: null, warnings: retainedWarnings
    });
    expect(segment).toEqual(original);
  });

  it.each(["png", "text"] as const)("cleans workspace and segment diagnostics when switching from %s and refreshing", async (from) => {
    const to: SubtitleRenderMode = from === "png" ? "text" : "png";
    const initial: SubtitleWorkspace = {
      ...subtitleWorkspace, render_mode: from, stage: "succeeded", output_asset_id: "old-output",
      stage_task_ids: { extract: "extract-a", translate: "translate-a", render: "render-a" },
      warnings: [...derivedWarnings.map((code) => `line-a:${code}`), ...retainedWarnings],
      segments: [{ ...subtitleSegment, warnings: [...derivedWarnings, ...retainedWarnings],
        product_text_sha256: "text-sha", product_recognition_sha256: "recognition-sha" }]
    };
    const historicalTask = {
      ...subtitleTask, id: "render-a",
      input_snapshot: { result: { effective_render_mode: "mixed", warnings: [...derivedWarnings] } }
    };
    const historicalAsset = { ...subtitleAsset, id: "old-output", metadata: { warnings: [...derivedWarnings] } };
    const history = structuredClone({ initial, historicalTask, historicalAsset });
    mocks.getToolTask.mockImplementation(async (id) => id === "render-a" ? historicalTask : {
      ...subtitleTask, id, input_snapshot: { operation: "translate" }
    });
    mocks.patchSubtitleWorkspace.mockResolvedValue({
      ...initial, render_mode: to, revision: 3, stage: "review_ready"
    });
    const onUpdate = vi.fn();
    const { result, unmount } = renderHook(() => useSubtitleWorkspace(initial, onUpdate));
    await act(async () => { expect(await result.current.update({ render_mode: to })).toBe(true); });
    const cleaned = result.current.workspace;
    expect(cleaned).toEqual({
      ...initial, render_mode: to, revision: 3, stage: "review_ready", output_asset_id: null,
      stage_task_ids: { extract: "extract-a", translate: "translate-a" }, warnings: retainedWarnings,
      segments: [clearSubtitleLayout(initial.segments[0], true)]
    });
    expect(onUpdate).toHaveBeenLastCalledWith(cleaned);
    mocks.getSubtitleWorkspace.mockResolvedValue(structuredClone(cleaned));
    await act(async () => { expect(await result.current.reload()).toBe(true); });
    expect(result.current.workspace).toEqual(cleaned);
    expect(mocks.getSubtitleWorkspace).toHaveBeenCalledWith(initial.id, { cache: "no-store" });
    expect(mocks.patchSubtitleWorkspace).toHaveBeenCalledWith(initial.id, { expected_revision: 2, render_mode: to });
    expect(mocks.runSubtitleOperation).not.toHaveBeenCalled();
    expect(mocks.recognizeSubtitleProducts).not.toHaveBeenCalled();
    expect({ initial, historicalTask, historicalAsset }).toEqual(history);
    unmount();
    const remounted = renderHook(() => useSubtitleWorkspace(structuredClone(cleaned), vi.fn()));
    expect(remounted.result.current.workspace).toEqual(cleaned);
    remounted.unmount();
  });
});
