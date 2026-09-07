import { describe, expect, it } from "vitest";

import {
  SEEDREAM_COMMON_IMAGE_DIMENSIONS,
  SEEDREAM_MAX_IMAGE_PIXELS,
  SEEDREAM_MIN_IMAGE_PIXELS,
  SeedreamImageDimensionError,
  isSeedreamCustomImageSize,
  isSeedreamImagePresetSize,
  normalizeSeedreamCustomImageSize,
  normalizeSeedreamImageSize,
  parseSeedreamCustomImageSize
} from "@/lib/aigc/image-dimensions";

function expectDimensionError(
  value: unknown,
  code:
    | "invalid_format"
    | "non_positive"
    | "pixel_count_out_of_range"
    | "aspect_ratio_out_of_range"
) {
  try {
    parseSeedreamCustomImageSize(value);
    throw new Error(`Expected ${String(value)} to be rejected`);
  } catch (error) {
    expect(error).toBeInstanceOf(SeedreamImageDimensionError);
    expect((error as SeedreamImageDimensionError).code).toBe(code);
  }
}

describe("Seedream image dimensions", () => {
  it.each([
    ["960x960", 960, 960, SEEDREAM_MIN_IMAGE_PIXELS],
    ["1634x2830", 1634, 2830, SEEDREAM_MAX_IMAGE_PIXELS],
    ["3840x240", 3840, 240, SEEDREAM_MIN_IMAGE_PIXELS],
    ["240x3840", 240, 3840, SEEDREAM_MIN_IMAGE_PIXELS],
    ["2048x1024", 2048, 1024, 2_097_152],
    ["000960x00960", 960, 960, SEEDREAM_MIN_IMAGE_PIXELS]
  ])(
    "parses and normalizes valid size %s",
    (value, width, height, pixels) => {
      expect(parseSeedreamCustomImageSize(value)).toEqual({
        width,
        height,
        pixels,
        size: `${width}x${height}`
      });
      expect(normalizeSeedreamCustomImageSize(value)).toBe(
        `${width}x${height}`
      );
      expect(isSeedreamCustomImageSize(value)).toBe(true);
    }
  );

  it.each([
    "",
    "2048",
    "2048X1024",
    "2048 x1024",
    "2048x 1024",
    "+2048x1024",
    "-2048x1024",
    "2048.0x1024",
    "2048x1024.5",
    "widthxheight",
    2048,
    null
  ])("rejects invalid custom size format %j", (value) => {
    expectDimensionError(value, "invalid_format");
    expect(isSeedreamCustomImageSize(value)).toBe(false);
  });

  it.each(["0x960", "960x0", "000x960"])(
    "rejects non-positive dimension %s",
    (value) => {
      expectDimensionError(value, "non_positive");
    }
  );

  it.each(["959x960", "1635x2830", "999999999999999999999x1"])(
    "rejects pixel count outside the closed interval for %s",
    (value) => {
      expectDimensionError(value, "pixel_count_out_of_range");
    }
  );

  it.each(["3841x240", "240x3841"])(
    "rejects aspect ratio outside the closed interval for %s",
    (value) => {
      expectDimensionError(value, "aspect_ratio_out_of_range");
    }
  );

  it("recognizes presets and normalizes the preset/custom union", () => {
    expect(isSeedreamImagePresetSize("1K")).toBe(true);
    expect(isSeedreamImagePresetSize("1.5K")).toBe(true);
    expect(isSeedreamImagePresetSize("2K")).toBe(true);
    expect(isSeedreamImagePresetSize("auto")).toBe(false);
    expect(isSeedreamImagePresetSize("2048x1024")).toBe(false);
    expect(normalizeSeedreamImageSize("1.5K")).toBe("1.5K");
    expect(normalizeSeedreamImageSize("02048x01024")).toBe("2048x1024");
  });

  it("maps every preset and aspect ratio to the official common pixels", () => {
    const normalizedMapping = Object.fromEntries(
      Object.entries(SEEDREAM_COMMON_IMAGE_DIMENSIONS).map(
        ([preset, ratios]) => [
          preset,
          Object.fromEntries(
            Object.entries(ratios).map(([ratio, value]) => [
              ratio,
              value.size
            ])
          )
        ]
      )
    );

    expect(normalizedMapping).toEqual({
      "1K": {
        "1:1": "1024x1024",
        "4:3": "1152x864",
        "3:4": "864x1152",
        "16:9": "1424x800",
        "9:16": "800x1424"
      },
      "1.5K": {
        "1:1": "1536x1536",
        "4:3": "1792x1344",
        "3:4": "1344x1792",
        "16:9": "2048x1152",
        "9:16": "1152x2048"
      },
      "2K": {
        "1:1": "2048x2048",
        "4:3": "2368x1776",
        "3:4": "1776x2368",
        "16:9": "2816x1584",
        "9:16": "1584x2816"
      }
    });
  });
});
