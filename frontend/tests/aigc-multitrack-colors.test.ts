import { describe, expect, it } from "vitest";

import {
  alphaHexToPercent,
  isRgbaHex,
  normalizeRgbaHex,
  percentToAlphaHex
} from "@/lib/aigc/multitrack-colors";

describe("AIGC multi-track colors", () => {
  it("validates exactly eight hexadecimal digits", () => {
    expect(isRgbaHex("#12ab34cd")).toBe(true);
    expect(isRgbaHex("#12AB34CD")).toBe(true);
    expect(isRgbaHex("#12AB34")).toBe(false);
    expect(isRgbaHex("12AB34CD")).toBe(false);
    expect(isRgbaHex("#12AB34CG")).toBe(false);
  });

  it("normalizes valid values to uppercase and rejects invalid values", () => {
    expect(normalizeRgbaHex("#12ab34cd")).toBe("#12AB34CD");
    expect(normalizeRgbaHex("#12AB34")).toBeNull();
  });

  it("converts alpha between hexadecimal and percentage", () => {
    expect(alphaHexToPercent("00")).toBe(0);
    expect(alphaHexToPercent("80")).toBe(50);
    expect(alphaHexToPercent("FF")).toBe(100);
    expect(percentToAlphaHex(0)).toBe("00");
    expect(percentToAlphaHex(50)).toBe("80");
    expect(percentToAlphaHex(100)).toBe("FF");
  });
});
