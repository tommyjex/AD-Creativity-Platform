import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubtitleReviewDialog } from "@/components/workspace/subtitle-translation/review-dialog";
import { subtitleDraftSignature, subtitleProductText, subtitleWarningMessage } from "@/lib/subtitle-translation";
import { subtitleSegment, subtitleWorkspace } from "./subtitle-translation-fixtures";
import type { SubtitleSegment } from "@/lib/api-types";

const product: SubtitleSegment = {
  ...subtitleSegment, translated_text: "😀 FLOOR ONE i5 Lite",
  product_text_sha256: "b".repeat(64), render_layer_asset_id: "a".repeat(64),
  render_layer_url: `/api/tools/subtitle-translation/workspaces/workspace-a/layers/${"a".repeat(64)}.png`,
  product_mentions: [{ start: 2, end: 19, model: "FLOOR ONE i5", spec: "Lite",
    catalog_id: null, origin: "model_pattern", status: "confirmed" }]
};

function review(readOnly = false) {
  const onSave = vi.fn().mockResolvedValue(true);
  const onPreview = vi.fn().mockResolvedValue({ ...subtitleWorkspace, segments: [product] });
  render(<SubtitleReviewDialog workspace={{ ...subtitleWorkspace, segments: [product] }}
    open readOnly={readOnly} busy={false} error={null} conflict={false}
    onSave={onSave} onRender={vi.fn()} onRetry={vi.fn()} onReload={vi.fn()}
    onPreview={onPreview} onClose={vi.fn()} onDirtyChange={vi.fn()} />);
  return { onSave, onPreview };
}

describe("automatic product names", () => {
  it("uses code points and keeps inferred metadata out of dirty identity", () => {
    expect(subtitleProductText(product, 2, 19)).toBe("FLOOR ONE i5 Lite");
    expect(subtitleDraftSignature([product])).toBe(subtitleDraftSignature([
      { ...product, product_mentions: [], product_recognition_sha256: "c".repeat(64) }
    ]));
  });
  it("shows automatic results without split inputs or a manual recognition action", () => {
    review();
    expect(screen.getByText("型号：FLOOR ONE i5")).toBeInTheDocument();
    expect(screen.getByText("规格：Lite")).toBeInTheDocument();
    expect(screen.queryByLabelText("字幕 1产品1model")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /识别产品名称/ })).not.toBeInTheDocument();
  });
  it("invalidates inference and images when the text changes, then uses normal save", async () => {
    const { onSave } = review();
    fireEvent.change(screen.getByLabelText("字幕 1译文"), { target: { value: "FLOOR ONE S10 Stretch Steam" } });
    fireEvent.click(screen.getByRole("button", { name: "保存校对" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0][0]).toMatchObject({
      product_mentions: [], product_text_sha256: null, product_recognition_sha256: null,
      render_layer_url: null
    });
  });
  it("does not request human validation for recognition failures", () => {
    for (const code of ["product_recognition_invalid_split", "product_name_marker_invalid",
      "product_name_missing_after_translation", "product_recognition_unavailable"]) {
      expect(subtitleWarningMessage(code)).not.toMatch(/请|人工|手动|校对|核对/);
    }
  });
  it("protects the normal save and calculation actions for viewers", () => {
    review(true);
    expect(screen.getByRole("button", { name: "保存校对" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "计算排版 · 不保存" })).toBeDisabled();
  });
});
