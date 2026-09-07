import { describe, expect, it } from "vitest";
import { createAigcEditorStore } from "@/lib/aigc/editor-store";
import {
  AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG,
  AIGC_NODE_REGISTRY
} from "@/lib/aigc/node-registry";
import type { VideoEnhancementConfig } from "@/lib/aigc/types";
import {
  VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS,
  VIDEO_ENHANCEMENT_16_BIT_OUTPUT_FORMAT,
  VIDEO_ENHANCEMENT_BIT_DEPTHS,
  VIDEO_ENHANCEMENT_BITRATE_LEVELS,
  VIDEO_ENHANCEMENT_RESOLUTIONS,
  VIDEO_ENHANCEMENT_SCENES,
  VIDEO_ENHANCEMENT_STYLES,
  VIDEO_ENHANCEMENT_TOOL_VERSIONS,
  normalizeVideoEnhancementConfig,
  validateVideoEnhancementConfig
} from "@/lib/aigc/video-enhancement";

type ConfigCandidate = Parameters<typeof validateVideoEnhancementConfig>[0];

describe("AIGC video enhancement contract", () => {
  it("defines the supported values and conservative defaults", () => {
    const typedDefault: VideoEnhancementConfig =
      AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG;

    expect(VIDEO_ENHANCEMENT_TOOL_VERSIONS).toEqual([
      "standard",
      "professional"
    ]);
    expect(VIDEO_ENHANCEMENT_SCENES).toEqual([
      "common",
      "ugc",
      "short_series",
      "aigc",
      "old_film"
    ]);
    expect(VIDEO_ENHANCEMENT_STYLES).toEqual(["hd", "natural"]);
    expect(VIDEO_ENHANCEMENT_RESOLUTIONS).toEqual([
      "240p",
      "360p",
      "480p",
      "540p",
      "720p",
      "1080p",
      "2k",
      "4k",
      "8k"
    ]);
    expect(VIDEO_ENHANCEMENT_BITRATE_LEVELS).toEqual([
      "low",
      "medium",
      "high"
    ]);
    expect(VIDEO_ENHANCEMENT_BIT_DEPTHS).toEqual([8, 10, 12, 16]);
    expect(typedDefault).toEqual({
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
    });
    expect(validateVideoEnhancementConfig(typedDefault)).toEqual([]);
  });

  it("registers one video input and output and creates the default node", () => {
    const registration = AIGC_NODE_REGISTRY.find(
      (item) => item.type === "video_enhancement"
    );
    expect(registration).toMatchObject({
      label: "视频画质增强",
      category: "model",
      executable: true,
      inputs: [
        {
          id: "video",
          type: "video_asset",
          required: true,
          multiple: false,
          max_connections: 1
        }
      ],
      outputs: [{ id: "video", type: "video_asset" }]
    });

    const store = createAigcEditorStore();
    store.getState().addNode("video_enhancement");
    expect(store.getState().definition).toMatchObject({
      schemaVersion: 2,
      nodes: [
        {
          type: "video_enhancement",
          config: AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG
        }
      ]
    });
  });

  it("accepts resolution, frame-rate, bitrate, and bit-depth boundaries", () => {
    const shortEdgeCustom = {
      ...AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG,
      resolution_mode: "short_edge",
      resolution: null,
      resolution_limit: 4320,
      fps: 120,
      bitrate_mode: "custom",
      bitrate_level: null,
      bitrate: 150000
    } as const satisfies VideoEnhancementConfig;
    const professional16Bit = {
      ...AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG,
      tool_version: "professional",
      scene: null,
      bit_depth: 16,
      bitrate_mode: null,
      bitrate_level: null,
      bitrate: null
    } as const satisfies VideoEnhancementConfig;

    expect(validateVideoEnhancementConfig(shortEdgeCustom)).toEqual([]);
    expect(
      validateVideoEnhancementConfig(
        professional16Bit,
        VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS
      )
    ).toEqual([]);
    expect(VIDEO_ENHANCEMENT_16_BIT_OUTPUT_FORMAT).toBe("mov");
  });

  it("rejects mutually exclusive fields, ranges, and invalid 16-bit use", () => {
    expect(
      validateVideoEnhancementConfig({
        ...AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG,
        resolution_limit: 1080
      })
    ).toContain("invalid_resolution");
    expect(
      validateVideoEnhancementConfig({
        ...AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG,
        fps: 121
      })
    ).toContain("invalid_fps");
    expect(
      validateVideoEnhancementConfig({
        ...AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG,
        bitrate_mode: "custom",
        bitrate_level: null,
        bitrate: 9
      })
    ).toContain("invalid_bitrate");

    const invalid16Bit = {
      ...AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG,
      tool_version: "standard",
      bit_depth: 16
    } as ConfigCandidate;
    expect(
      validateVideoEnhancementConfig(
        invalid16Bit,
        VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS + 1
      )
    ).toEqual(
      expect.arrayContaining([
        "professional_bit_depth_required",
        "professional_16_bit_required",
        "bitrate_forbidden_for_16_bit",
        "input_duration_exceeds_16_bit_limit"
      ])
    );
  });

  it("normalizes persisted and edited mutually exclusive values", () => {
    expect(
      normalizeVideoEnhancementConfig({
        ...AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG,
        tool_version: "professional",
        scene: "ugc",
        resolution_mode: "short_edge",
        resolution: "8k",
        resolution_limit: 5000,
        fps: 10,
        bitrate_mode: "custom",
        bitrate_level: "high",
        bitrate: 200000,
        bit_depth: 16
      })
    ).toEqual({
      tool_version: "professional",
      scene: null,
      enhance_style: "hd",
      resolution_mode: "short_edge",
      resolution: null,
      resolution_limit: 4320,
      fps: 15,
      bitrate_mode: null,
      bitrate_level: null,
      bitrate: null,
      bit_depth: 16
    });

    const store = createAigcEditorStore();
    store.getState().addNode("video_enhancement");
    const node = store.getState().definition.nodes[0];
    store.getState().updateNodeConfig(node.id, {
      ...AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG,
      resolution_mode: "short_edge",
      resolution: null,
      resolution_limit: 127,
      bitrate_mode: "custom",
      bitrate_level: null,
      bitrate: 9
    });
    expect(store.getState().definition.nodes[0]).toMatchObject({
      config: {
        resolution: null,
        resolution_limit: 128,
        bitrate_level: null,
        bitrate: 10
      }
    });
  });
});
