export const SEEDREAM_IMAGE_PRESET_SIZES = ["1K", "1.5K", "2K"] as const;
export const SEEDREAM_IMAGE_ASPECT_RATIOS = [
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16"
] as const;

export const SEEDREAM_MIN_IMAGE_PIXELS = 921_600;
export const SEEDREAM_MAX_IMAGE_PIXELS = 4_624_220;
export const SEEDREAM_MAX_ASPECT_RATIO = 16;

export type SeedreamImagePresetSize =
  (typeof SEEDREAM_IMAGE_PRESET_SIZES)[number];
export type SeedreamImageAspectRatio =
  (typeof SEEDREAM_IMAGE_ASPECT_RATIOS)[number];

declare const customImageSizeBrand: unique symbol;
export type SeedreamCustomImageSize = string & {
  readonly [customImageSizeBrand]: true;
};
export type SeedreamImageSize =
  | SeedreamImagePresetSize
  | SeedreamCustomImageSize;

export type SeedreamImageDimensionErrorCode =
  | "invalid_format"
  | "non_positive"
  | "pixel_count_out_of_range"
  | "aspect_ratio_out_of_range";

export class SeedreamImageDimensionError extends Error {
  constructor(
    readonly code: SeedreamImageDimensionErrorCode,
    message: string
  ) {
    super(message);
    this.name = "SeedreamImageDimensionError";
  }
}

export interface SeedreamImageDimensions {
  readonly width: number;
  readonly height: number;
  readonly pixels: number;
  readonly size: SeedreamCustomImageSize;
}

const CUSTOM_IMAGE_SIZE_PATTERN = /^([0-9]+)x([0-9]+)$/;
const MIN_IMAGE_PIXELS_BIGINT = BigInt(SEEDREAM_MIN_IMAGE_PIXELS);
const MAX_IMAGE_PIXELS_BIGINT = BigInt(SEEDREAM_MAX_IMAGE_PIXELS);
const MAX_ASPECT_RATIO_BIGINT = BigInt(SEEDREAM_MAX_ASPECT_RATIO);

export function isSeedreamImagePresetSize(
  value: unknown
): value is SeedreamImagePresetSize {
  return (
    typeof value === "string" &&
    SEEDREAM_IMAGE_PRESET_SIZES.some((preset) => preset === value)
  );
}

export function parseSeedreamCustomImageSize(
  value: unknown
): SeedreamImageDimensions {
  if (typeof value !== "string") {
    throw new SeedreamImageDimensionError(
      "invalid_format",
      "Image size must use WIDTHxHEIGHT decimal notation"
    );
  }
  const match = CUSTOM_IMAGE_SIZE_PATTERN.exec(value);
  if (!match) {
    throw new SeedreamImageDimensionError(
      "invalid_format",
      "Image size must use WIDTHxHEIGHT decimal notation"
    );
  }

  const width = BigInt(match[1]);
  const height = BigInt(match[2]);
  if (width === BigInt(0) || height === BigInt(0)) {
    throw new SeedreamImageDimensionError(
      "non_positive",
      "Image width and height must be positive integers"
    );
  }

  const pixels = width * height;
  if (
    pixels < MIN_IMAGE_PIXELS_BIGINT ||
    pixels > MAX_IMAGE_PIXELS_BIGINT
  ) {
    throw new SeedreamImageDimensionError(
      "pixel_count_out_of_range",
      `Image pixel count must be between ${SEEDREAM_MIN_IMAGE_PIXELS} and ${SEEDREAM_MAX_IMAGE_PIXELS}`
    );
  }
  if (
    width > MAX_ASPECT_RATIO_BIGINT * height ||
    height > MAX_ASPECT_RATIO_BIGINT * width
  ) {
    throw new SeedreamImageDimensionError(
      "aspect_ratio_out_of_range",
      "Image aspect ratio must be between 1:16 and 16:1"
    );
  }

  const normalized = `${width}x${height}` as SeedreamCustomImageSize;
  return {
    width: Number(width),
    height: Number(height),
    pixels: Number(pixels),
    size: normalized
  };
}

export function normalizeSeedreamCustomImageSize(
  value: unknown
): SeedreamCustomImageSize {
  return parseSeedreamCustomImageSize(value).size;
}

export function isSeedreamCustomImageSize(
  value: unknown
): value is SeedreamCustomImageSize {
  try {
    parseSeedreamCustomImageSize(value);
    return true;
  } catch {
    return false;
  }
}

export function normalizeSeedreamImageSize(
  value: unknown
): SeedreamImageSize {
  if (isSeedreamImagePresetSize(value)) return value;
  return normalizeSeedreamCustomImageSize(value);
}

function dimensions(value: string): SeedreamImageDimensions {
  return parseSeedreamCustomImageSize(value);
}

export const SEEDREAM_COMMON_IMAGE_DIMENSIONS = {
  "1K": {
    "1:1": dimensions("1024x1024"),
    "4:3": dimensions("1152x864"),
    "3:4": dimensions("864x1152"),
    "16:9": dimensions("1424x800"),
    "9:16": dimensions("800x1424")
  },
  "1.5K": {
    "1:1": dimensions("1536x1536"),
    "4:3": dimensions("1792x1344"),
    "3:4": dimensions("1344x1792"),
    "16:9": dimensions("2048x1152"),
    "9:16": dimensions("1152x2048")
  },
  "2K": {
    "1:1": dimensions("2048x2048"),
    "4:3": dimensions("2368x1776"),
    "3:4": dimensions("1776x2368"),
    "16:9": dimensions("2816x1584"),
    "9:16": dimensions("1584x2816")
  }
} as const satisfies Readonly<
  Record<
    SeedreamImagePresetSize,
    Readonly<Record<SeedreamImageAspectRatio, SeedreamImageDimensions>>
  >
>;
