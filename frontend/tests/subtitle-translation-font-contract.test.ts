import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SUBTITLE_FONT_ID, SUBTITLE_FONTS, subtitlePreviewFont } from "@/lib/subtitle-translation";
import { subtitleSegment } from "./subtitle-translation-fixtures";

describe("subtitle font cross-module contract", () => {
  it("uses the standalone measurement and submission font files in review previews", () => {
    const source = readFileSync(
      resolve(process.cwd(), "../standalone/video-subtitle-grounding/src/video_subtitle_grounding/layout.py"),
      "utf8"
    );
    const revision = source.match(/SOURCE_HAN_REVISION = "([^"]+)"/)?.[1];
    expect(revision).toBeTruthy();
    for (const id of ["SY_Black", "SY_Black_JP"]) {
      const suffix = source.match(
        new RegExp(`"${id}": f"\\{_SOURCE_HAN_ROOT\\}/([^"]+)"`)
      )?.[1];
      expect(suffix).toBeTruthy();
      expect(SUBTITLE_FONTS.find((font) => font.id === id)?.url).toBe(
        `https://raw.githubusercontent.com/adobe-fonts/source-han-sans/${revision}/SubsetOTF/${suffix}`
      );
    }
    const century = source.match(/CENTURY_GOTHIC_URL = (?:\(\s*)?"([^"]+)"/)?.[1];
    expect(SUBTITLE_FONTS.find((font) => font.id === "CenturyGothic")?.url).toBe(century);
    const bold = source.match(/CENTURY_GOTHIC_BOLD_URL = (?:\(\s*)?"([^"]+)"/)?.[1];
    expect(bold).toBe("https://xujianhua-utils.tos-cn-beijing.volces.com/CenturyGothic/centurygothic_bold.ttf");
    expect(century).toBeTruthy();
    expect(SUBTITLE_FONTS.find((font) => font.id === DEFAULT_SUBTITLE_FONT_ID)?.url).toBe(century);
    expect(subtitlePreviewFont({ ...subtitleSegment, visual_role: "headline", style: {}, font_type: null }).url).toBe(bold);
    expect(subtitlePreviewFont({ ...subtitleSegment, visual_role: "body", style: {}, font_type: bold }).url).toBe(century);
  });

  it.each(["headline", "body", "footnote", null, undefined, "", "legacy"])(
    "chooses the automatic font for role %s regardless of stale summaries",
    (role) => {
      for (const font of SUBTITLE_FONTS) {
        for (const override of [undefined, null, ""]) {
          const segment = {
            ...subtitleSegment, visual_role: role as string,
            style: { font: override }, font_type: font.url
          };
          expect(subtitlePreviewFont(segment).id).toBe(role === "headline" ? "CenturyGothicBold" : "CenturyGothic");
          expect(segment.style.font).toBe(override);
          expect(segment.font_type).toBe(font.url);
        }
      }
    }
  );

  it.each(SUBTITLE_FONTS)("prioritizes manual $id IDs and URLs over conflicting summaries", (font) => {
    for (const role of ["headline", "body", "footnote"]) {
      for (const selected of [font.id, font.url]) {
        expect(subtitlePreviewFont({
          ...subtitleSegment, visual_role: role, style: { font: selected },
          font_type: SUBTITLE_FONTS.find((other) => other.id !== font.id)!.url
        })).toBe(font);
      }
    }
  });

  it("retains a recognized summary fallback for an unknown manual font", () => {
    expect(subtitlePreviewFont({
      ...subtitleSegment, style: { font: "legacy-font" }, font_type: SUBTITLE_FONTS[0].url
    })).toBe(SUBTITLE_FONTS[0]);
  });

  it("estimates preset fallback previews with the selected file and retains unverified warnings", () => {
    for (const role of ["headline", "body", "footnote"]) {
      const segment = {
        ...subtitleSegment, visual_role: role, font_type: "ALi_PuHui",
        warnings: ["missing_glyphs", "font_fallback", "font_metrics_unverified", "preset_glyph_coverage_unverified"]
      };
      expect(subtitlePreviewFont(segment).id).toBe(role === "headline" ? "CenturyGothicBold" : "CenturyGothic");
      expect(subtitlePreviewFont({ ...segment, style: { font: "SY_Black_JP" } }).id).toBe("SY_Black_JP");
      expect(segment.warnings).toHaveLength(4);
    }
  });
});
