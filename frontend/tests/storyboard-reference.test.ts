import { describe, expect, it } from "vitest";

import {
  getReferenceLabel,
  getReferencePromptToken,
  insertReferenceAtSelection,
  reindexReferencesAfterRemoval
} from "@/lib/storyboard-reference";

describe("storyboard reference helpers", () => {
  it("builds labels independently for each media kind", () => {
    expect(getReferenceLabel("image", 0)).toBe("参考图1");
    expect(getReferenceLabel("video", 1)).toBe("参考视频2");
    expect(getReferenceLabel("audio", 2)).toBe("参考音频3");
  });

  it("builds parenthesized prompt tokens independently for each media kind", () => {
    expect(getReferencePromptToken("image", 0)).toBe("(参考@图1)");
    expect(getReferencePromptToken("video", 1)).toBe("(参考@视频2)");
    expect(getReferencePromptToken("audio", 2)).toBe("(参考@音频3)");
  });

  it("inserts a reference at the cursor with readable spacing", () => {
    expect(insertReferenceAtSelection("镜头呈现产品", "(参考@图1)", 2, 2)).toEqual({
      selectionEnd: 11,
      selectionStart: 11,
      text: "镜头 (参考@图1) 呈现产品"
    });
    expect(insertReferenceAtSelection("画面：细节", "(参考@图1)", 3, 3).text).toBe(
      "画面：(参考@图1) 细节"
    );
    expect(insertReferenceAtSelection("结尾。", "(参考@图1)", 2, 2).text).toBe(
      "结尾 (参考@图1)。"
    );
  });

  it("replaces a selection and appends when selection is unavailable", () => {
    expect(insertReferenceAtSelection("使用旧素材构图", "(参考@视频1)", 2, 5)).toEqual({
      selectionEnd: 12,
      selectionStart: 12,
      text: "使用 (参考@视频1) 构图"
    });
    expect(
      insertReferenceAtSelection("保持稳定", "(参考@音频1)", null, undefined)
    ).toEqual({
      selectionEnd: 13,
      selectionStart: 13,
      text: "保持稳定 (参考@音频1)"
    });
  });

  it("removes the deleted reference and shifts later labels once", () => {
    expect(
      reindexReferencesAfterRemoval(
        "参考图1 开场，参考图2 转场，参考图3 收尾，重复参考图3。",
        "image",
        1,
        3
      )
    ).toBe("参考图1 开场，转场，参考图2 收尾，重复参考图2。");
  });

  it("removes and reindexes new tokens while preserving mixed legacy labels", () => {
    expect(
      reindexReferencesAfterRemoval(
        "(参考@图1) 开场，参考图2 转场，(参考@图3) 收尾。",
        "image",
        1,
        3
      )
    ).toBe("(参考@图1) 开场，转场，(参考@图2) 收尾。");
    expect(
      reindexReferencesAfterRemoval(
        "(参考@视频1) (参考@视频2) (参考@视频3)",
        "video",
        0,
        3
      )
    ).toBe("(参考@视频1) (参考@视频2)");
    expect(
      reindexReferencesAfterRemoval(
        "(参考@音频1) (参考@音频2)",
        "audio",
        1,
        2
      )
    ).toBe("(参考@音频1)");
  });

  it("does not rewrite other kinds, out-of-range labels, or similar text", () => {
    expect(
      reindexReferencesAfterRemoval(
        "参考图1，参考图2，参考图10，参考视频2，第一张参考图。",
        "image",
        0,
        2
      )
    ).toBe("参考图1，参考图10，参考视频2，第一张参考图。");
  });

  it("handles first, middle, last, and invalid removals", () => {
    expect(
      reindexReferencesAfterRemoval("参考音频1 参考音频2", "audio", 0, 2)
    ).toBe("参考音频1");
    expect(
      reindexReferencesAfterRemoval(
        "参考视频1 参考视频2 参考视频3",
        "video",
        2,
        3
      )
    ).toBe("参考视频1 参考视频2");
    expect(
      reindexReferencesAfterRemoval("参考图1", "image", 2, 1)
    ).toBe("参考图1");
  });
});
