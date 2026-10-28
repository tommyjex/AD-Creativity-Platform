import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SUBTITLE_FONT_ID, SUBTITLE_FONTS, subtitlePreviewFont } from "@/lib/subtitle-translation";
import { subtitleSegment } from "./subtitle-translation-fixtures";

describe("subtitle font cross-module contract", () => {
  it("uses the backend measurement and submission font file in review previews", () => {
    const source = readFileSync(
      resolve(process.cwd(), "../backend/app/services/subtitle_translation_layout.py"),
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
    expect(source).toContain(`DEFAULT_FONT = "${DEFAULT_SUBTITLE_FONT_ID}"`);
    expect(subtitlePreviewFont({ ...subtitleSegment, style: {}, font_type: null }).url).toBe(bold);
  });
});
