import { describe, expect, it } from "vitest";
import {
  AIGC_DEFAULT_MULTI_TRACK_EDIT_CONFIG,
  normalizeMultiTrackEditConfig,
  validateMultiTrackEditConfig
} from "@/lib/aigc/multitrack";
import { AIGC_NODE_REGISTRY } from "@/lib/aigc/node-registry";
import type {
  MultiTrackEditConfig,
  MultiTrackElement,
  MultiTrackVideoElement
} from "@/lib/aigc/types";

function source(nodeId: string, handle: string) {
  return { source_node_id: nodeId, source_handle: handle };
}

function transform(overrides: Record<string, number> = {}) {
  return {
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    rotation: 0,
    ...overrides
  };
}

function videoElement(
  overrides: Partial<MultiTrackVideoElement> = {}
): MultiTrackVideoElement {
  return {
    id: "video-1",
    type: "video",
    source: source("video-source", "video"),
    target_time: { start_ms: 0, end_ms: 2000 },
    source_trim: { start_ms: 0, end_ms: 2000 },
    loop: false,
    transform: transform(),
    speed: 1,
    volume: 1,
    fade_in_ms: 0,
    fade_out_ms: 0,
    transition: null,
    ...overrides
  };
}

function config(
  elements: MultiTrackElement[] = [videoElement()]
): MultiTrackEditConfig {
  return {
    canvas: {
      mode: "custom",
      width: 1920,
      height: 1080,
      background_color: "#000000FF"
    },
    output: { format: "mp4", fps: 30 },
    tracks: [
      {
        id: "track-1",
        name: "视频轨道",
        type: "video",
        order: 0,
        hidden: false,
        muted: false,
        elements
      }
    ]
  };
}

function codes(candidate: MultiTrackEditConfig): string[] {
  return validateMultiTrackEditConfig(candidate).map((issue) => issue.code);
}

describe("AIGC multi-track edit contract", () => {
  it("registers the execution node and four multi-value inputs", () => {
    const registration = AIGC_NODE_REGISTRY.find(
      (item) => item.type === "multi_track_edit"
    );
    expect(registration).toMatchObject({
      label: "多轨剪辑",
      category: "control",
      executable: true,
      inputs: [
        {
          id: "videos",
          type: "video_asset",
          multiple: true,
          max_connections: 30
        },
        {
          id: "images",
          type: "image_asset",
          multiple: true,
          max_connections: 50
        },
        {
          id: "audios",
          type: "audio_asset",
          multiple: true,
          max_connections: 30
        },
        {
          id: "texts",
          type: "text",
          multiple: true,
          max_connections: 30
        }
      ],
      outputs: [{ id: "video", type: "video_asset" }]
    });
  });

  it("keeps an empty project as a saveable draft with execution issues", () => {
    const typedDefault: MultiTrackEditConfig =
      AIGC_DEFAULT_MULTI_TRACK_EDIT_CONFIG;
    expect(typedDefault).toEqual({
      canvas: {
        mode: "auto",
        width: null,
        height: null,
        background_color: "#000000FF"
      },
      output: { format: "mp4", fps: 30 },
      tracks: []
    });
    expect(codes(typedDefault)).toEqual([
      "visible_track_required",
      "valid_element_required"
    ]);
  });

  it("normalizes without mutating and canonicalizes milliseconds and order", () => {
    const candidate = config([
      videoElement({
        target_time: { start_ms: 10.4, end_ms: 2010.6 },
        source_trim: { start_ms: 0.2, end_ms: 2000.2 },
        fade_in_ms: 10.2
      })
    ]);
    candidate.tracks[0].id = "  video-track  ";
    candidate.tracks[0].order = 9;
    const original = structuredClone(candidate);

    const normalized = normalizeMultiTrackEditConfig(candidate);

    expect(candidate).toEqual(original);
    expect(normalized.tracks[0].id).toBe("video-track");
    expect(normalized.tracks[0].order).toBe(0);
    expect(normalized.tracks[0].elements[0].target_time).toEqual({
      start_ms: 10,
      end_ms: 2011
    });
    expect(normalized.tracks[0].elements[0]).toMatchObject({
      source_trim: { start_ms: 0, end_ms: 2000 },
      fade_in_ms: 10
    });
  });

  it("validates quantity, identity, time, and media filter boundaries", () => {
    const candidate = config([
      videoElement({
        target_time: { start_ms: -1, end_ms: 2000 },
        source_trim: { start_ms: -1, end_ms: 1000 },
        speed: 4.01,
        volume: -0.01,
        fade_in_ms: 2002,
        fade_out_ms: 2002
      }),
      videoElement({
        target_time: { start_ms: 1000, end_ms: 1000 }
      })
    ]);
    candidate.tracks.push({
      ...structuredClone(candidate.tracks[0]),
      elements: []
    });
    expect(codes(candidate)).toEqual(
      expect.arrayContaining([
        "duplicate_track_id",
        "duplicate_element_id",
        "invalid_target_time",
        "invalid_source_trim",
        "invalid_speed",
        "invalid_volume",
        "invalid_fade"
      ])
    );
  });

  it.each([0, -1, 0.000001])(
    "rejects speed %s without continuing duration validation",
    (speed) => {
      expect(codes(config([videoElement({ speed })]))).toEqual(
        expect.arrayContaining(["invalid_speed"])
      );
      expect(codes(config([videoElement({ speed })]))).not.toContain(
        "duration_mismatch"
      );
    }
  );

  it.each([
    { speed: 0.1, sourceEndMs: 200 },
    { speed: 4, sourceEndMs: 8000 }
  ])("accepts legal speed boundary $speed", ({ speed, sourceEndMs }) => {
    expect(
      codes(
        config([
          videoElement({
            speed,
            source_trim: { start_ms: 0, end_ms: sourceEndMs }
          })
        ])
      )
    ).toEqual([]);
  });

  it("rejects overlap unless the preceding videos have a legal transition", () => {
    const candidate = config([
      videoElement({ id: "first" }),
      videoElement({
        id: "second",
        target_time: { start_ms: 1800, end_ms: 3800 }
      })
    ]);
    expect(codes(candidate)).toContain("track_overlap");

    candidate.tracks[0].elements[0] = videoElement({
      id: "first",
      transition: { type: "fade", duration_ms: 200 }
    });
    expect(codes(candidate)).not.toContain("track_overlap");

    (candidate.tracks[0].elements[0] as MultiTrackVideoElement).transition = {
      type: "fade",
      duration_ms: 2001
    };
    expect(codes(candidate)).toEqual(
      expect.arrayContaining(["invalid_transition", "track_overlap"])
    );
  });

  it("validates canvas, transform, text, and subtitle boundaries", () => {
    const text: MultiTrackElement = {
      id: "text-1",
      type: "text",
      source: null,
      inline_text: "标题",
      target_time: { start_ms: 0, end_ms: 2000 },
      loop: false,
      transform: transform({ width: 800, height: 200 }),
      style: {
        font_size: 48,
        color: "#FFFFFFFF",
        bold: false,
        italic: false,
        underline: false,
        background_color: "#00000000"
      }
    };
    const subtitle: MultiTrackElement = {
      id: "subtitle-1",
      type: "subtitle",
      asset_id: "subtitle-asset",
      target_time: { start_ms: 0, end_ms: 2000 },
      loop: false,
      transform: transform({ y: 800, width: 1200, height: 200 }),
      style: text.style
    };
    const candidate = config([]);
    candidate.tracks = [
      {
        id: "text-track",
        name: "文字",
        type: "text",
        order: 0,
        hidden: false,
        muted: false,
        elements: [text]
      },
      {
        id: "subtitle-track",
        name: "字幕",
        type: "subtitle",
        order: 1,
        hidden: false,
        muted: false,
        elements: [subtitle, { ...subtitle, id: "subtitle-2" }]
      }
    ];
    candidate.canvas.width = 159;
    candidate.canvas.background_color = "#000000";
    text.inline_text = " ";
    subtitle.transform.x = 1000;

    expect(codes(candidate)).toEqual(
      expect.arrayContaining([
        "invalid_canvas_size",
        "invalid_background_color",
        "text_source_required",
        "subtitle_track_element_limit",
        "transform_out_of_canvas"
      ])
    );
  });
});
