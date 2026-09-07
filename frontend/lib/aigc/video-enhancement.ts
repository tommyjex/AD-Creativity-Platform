import type {
  AigcVideoEnhancementBitDepth,
  AigcVideoEnhancementBitrateLevel,
  AigcVideoEnhancementResolution,
  AigcVideoEnhancementScene,
  AigcVideoEnhancementStyle,
  AigcVideoEnhancementToolVersion,
  VideoEnhancementConfig
} from "@/lib/aigc/types";

export const VIDEO_ENHANCEMENT_TOOL_VERSIONS = [
  "standard",
  "professional"
] as const satisfies readonly AigcVideoEnhancementToolVersion[];
export const VIDEO_ENHANCEMENT_SCENES = [
  "common",
  "ugc",
  "short_series",
  "aigc",
  "old_film"
] as const satisfies readonly AigcVideoEnhancementScene[];
export const VIDEO_ENHANCEMENT_STYLES = [
  "hd",
  "natural"
] as const satisfies readonly AigcVideoEnhancementStyle[];
export const VIDEO_ENHANCEMENT_RESOLUTIONS = [
  "240p",
  "360p",
  "480p",
  "540p",
  "720p",
  "1080p",
  "2k",
  "4k",
  "8k"
] as const satisfies readonly AigcVideoEnhancementResolution[];
export const VIDEO_ENHANCEMENT_BITRATE_LEVELS = [
  "low",
  "medium",
  "high"
] as const satisfies readonly AigcVideoEnhancementBitrateLevel[];
export const VIDEO_ENHANCEMENT_BIT_DEPTHS = [
  8,
  10,
  12,
  16
] as const satisfies readonly AigcVideoEnhancementBitDepth[];

export const VIDEO_ENHANCEMENT_RESOLUTION_LIMIT_RANGE = {
  minimum: 128,
  maximum: 4320
} as const;
export const VIDEO_ENHANCEMENT_FPS_RANGE = {
  minimum: 15,
  maximum: 120
} as const;
export const VIDEO_ENHANCEMENT_BITRATE_RANGE = {
  minimum: 10,
  maximum: 150000
} as const;
export const VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS = 40;
export const VIDEO_ENHANCEMENT_16_BIT_OUTPUT_FORMAT = "mov";

export const AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG = {
  tool_version: "standard",
  scene: "aigc",
  enhance_style: "hd",
  resolution_mode: "preset",
  resolution: "1080p",
  resolution_limit: null,
  fps: null,
  bitrate_mode: "level",
  bitrate_level: "medium",
  bitrate: null,
  bit_depth: 8
} as const satisfies VideoEnhancementConfig;

export type VideoEnhancementConfigCandidate = {
  tool_version: AigcVideoEnhancementToolVersion;
  scene: AigcVideoEnhancementScene | null;
  enhance_style: AigcVideoEnhancementStyle;
  resolution_mode: "preset" | "short_edge";
  resolution: AigcVideoEnhancementResolution | null;
  resolution_limit: number | null;
  fps: number | null;
  bitrate_mode: "level" | "custom" | null;
  bitrate_level: AigcVideoEnhancementBitrateLevel | null;
  bitrate: number | null;
  bit_depth: AigcVideoEnhancementBitDepth;
};

export function validateVideoEnhancementConfig(
  config: VideoEnhancementConfigCandidate,
  inputDurationSeconds?: number
): string[] {
  const errors: string[] = [];

  if (config.resolution_mode === "preset") {
    if (
      config.resolution === null ||
      !VIDEO_ENHANCEMENT_RESOLUTIONS.includes(config.resolution) ||
      config.resolution_limit !== null
    ) {
      errors.push("invalid_resolution");
    }
  } else if (
    !isIntegerInRange(
      config.resolution_limit,
      VIDEO_ENHANCEMENT_RESOLUTION_LIMIT_RANGE
    ) ||
    config.resolution !== null
  ) {
    errors.push("invalid_resolution_limit");
  }

  if (
    config.fps !== null &&
    !isIntegerInRange(config.fps, VIDEO_ENHANCEMENT_FPS_RANGE)
  ) {
    errors.push("invalid_fps");
  }

  if (config.tool_version === "standard") {
    if (
      config.scene === null ||
      !VIDEO_ENHANCEMENT_SCENES.includes(config.scene)
    ) {
      errors.push("scene_required");
    }
    if (config.bit_depth !== 8) {
      errors.push("professional_bit_depth_required");
    }
  } else if (config.scene !== null) {
    errors.push("professional_scene_forbidden");
  }

  if (config.bit_depth === 16) {
    if (config.tool_version !== "professional") {
      errors.push("professional_16_bit_required");
    }
    if (
      config.bitrate_mode !== null ||
      config.bitrate_level !== null ||
      config.bitrate !== null
    ) {
      errors.push("bitrate_forbidden_for_16_bit");
    }
    if (
      inputDurationSeconds !== undefined &&
      inputDurationSeconds > VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS
    ) {
      errors.push("input_duration_exceeds_16_bit_limit");
    }
  } else if (config.bitrate_mode === "level") {
    if (
      config.bitrate_level === null ||
      !VIDEO_ENHANCEMENT_BITRATE_LEVELS.includes(config.bitrate_level) ||
      config.bitrate !== null
    ) {
      errors.push("invalid_bitrate_level");
    }
  } else if (
    config.bitrate_mode !== "custom" ||
    config.bitrate_level !== null ||
    !isIntegerInRange(config.bitrate, VIDEO_ENHANCEMENT_BITRATE_RANGE)
  ) {
    errors.push("invalid_bitrate");
  }

  return errors;
}

export function normalizeVideoEnhancementConfig(
  config: Partial<VideoEnhancementConfigCandidate>
): VideoEnhancementConfig {
  const toolVersion = VIDEO_ENHANCEMENT_TOOL_VERSIONS.includes(
    config.tool_version as AigcVideoEnhancementToolVersion
  )
    ? (config.tool_version as AigcVideoEnhancementToolVersion)
    : AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG.tool_version;
  const resolutionMode =
    config.resolution_mode === "short_edge" ? "short_edge" : "preset";
  const resolution = VIDEO_ENHANCEMENT_RESOLUTIONS.includes(
    config.resolution as AigcVideoEnhancementResolution
  )
    ? (config.resolution as AigcVideoEnhancementResolution)
    : AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG.resolution;
  const fps =
    config.fps === null || config.fps === undefined
      ? null
      : normalizeInteger(
          config.fps,
          VIDEO_ENHANCEMENT_FPS_RANGE,
          VIDEO_ENHANCEMENT_FPS_RANGE.minimum
        );
  const bitDepth =
    toolVersion === "professional" &&
    VIDEO_ENHANCEMENT_BIT_DEPTHS.includes(
      config.bit_depth as AigcVideoEnhancementBitDepth
    )
      ? (config.bit_depth as AigcVideoEnhancementBitDepth)
      : 8;
  const common = {
    tool_version: toolVersion,
    scene:
      toolVersion === "standard" &&
      VIDEO_ENHANCEMENT_SCENES.includes(
        config.scene as AigcVideoEnhancementScene
      )
        ? (config.scene as AigcVideoEnhancementScene)
        : toolVersion === "standard"
          ? AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG.scene
          : null,
    enhance_style: VIDEO_ENHANCEMENT_STYLES.includes(
      config.enhance_style as AigcVideoEnhancementStyle
    )
      ? (config.enhance_style as AigcVideoEnhancementStyle)
      : AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG.enhance_style,
    fps,
    bit_depth: bitDepth
  };
  const dimensions =
    resolutionMode === "short_edge"
      ? {
          resolution_mode: "short_edge" as const,
          resolution: null,
          resolution_limit: normalizeInteger(
            config.resolution_limit,
            VIDEO_ENHANCEMENT_RESOLUTION_LIMIT_RANGE,
            1080
          )
        }
      : {
          resolution_mode: "preset" as const,
          resolution,
          resolution_limit: null
        };

  if (bitDepth === 16) {
    return {
      ...common,
      ...dimensions,
      tool_version: "professional",
      scene: null,
      bit_depth: 16,
      bitrate_mode: null,
      bitrate_level: null,
      bitrate: null
    };
  }

  const bitrate =
    config.bitrate_mode === "custom"
      ? {
          bitrate_mode: "custom" as const,
          bitrate_level: null,
          bitrate: normalizeInteger(
            config.bitrate,
            VIDEO_ENHANCEMENT_BITRATE_RANGE,
            8000
          )
        }
      : {
          bitrate_mode: "level" as const,
          bitrate_level: VIDEO_ENHANCEMENT_BITRATE_LEVELS.includes(
            config.bitrate_level as AigcVideoEnhancementBitrateLevel
          )
            ? (config.bitrate_level as AigcVideoEnhancementBitrateLevel)
            : AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG.bitrate_level,
          bitrate: null
        };

  return {
    ...common,
    ...dimensions,
    ...bitrate,
    bit_depth: bitDepth
  } as VideoEnhancementConfig;
}

function isIntegerInRange(
  value: number | null,
  range: { minimum: number; maximum: number }
): value is number {
  return (
    value !== null &&
    Number.isInteger(value) &&
    value >= range.minimum &&
    value <= range.maximum
  );
}

function normalizeInteger(
  value: number | null | undefined,
  range: { minimum: number; maximum: number },
  fallback: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(range.maximum, Math.max(range.minimum, Math.round(value)));
}
