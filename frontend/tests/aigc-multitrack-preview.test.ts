import { describe, expect, it } from "vitest";

import {
  getPreviewVisualLayers,
  getVideoPreviewTimeSeconds,
  movePreviewTransform,
  resizePreviewTransform
} from "@/lib/aigc/multitrack-preview";
import type {
  MultiTrackEditConfig,
  MultiTrackVideoElement
} from "@/lib/aigc/types";

const transform = {
  height: 200,
  rotation: 0,
  width: 400,
  x: 100,
  y: 100
};

describe("multi-track preview geometry", () => {
  it("returns only active visual elements and keeps upper tracks above lower tracks", () => {
    const config = previewConfig();
    config.tracks.push({
      elements: [
        {
          id: "hidden-image",
          loop: true,
          source: {
            source_handle: "image",
            source_node_id: "image-source"
          },
          target_time: { end_ms: 5000, start_ms: 0 },
          transform,
          type: "image"
        }
      ],
      hidden: true,
      id: "hidden-track",
      muted: false,
      name: "隐藏",
      order: 2,
      type: "image"
    });

    const layers = getPreviewVisualLayers(config, 2500);

    expect(layers.map((layer) => layer.element.id)).toEqual([
      "text-1",
      "video-1"
    ]);
    expect(layers[0]!.zIndex).toBeGreaterThan(layers[1]!.zIndex);
  });

  it("maps the playhead through trim and speed without starting playback", () => {
    const video = previewConfig().tracks[1]!
      .elements[0] as MultiTrackVideoElement;
    video.source_trim = { end_ms: 9000, start_ms: 1000 };
    video.speed = 2;

    expect(getVideoPreviewTimeSeconds(video, 2500)).toBe(6);
  });

  it("snaps moved elements to the canvas center", () => {
    const result = movePreviewTransform(
      transform,
      660,
      340,
      1920,
      1080,
      12
    );

    expect(result.transform).toMatchObject({ x: 760, y: 440 });
    expect(result.guides).toEqual({ horizontal: 540, vertical: 960 });
  });

  it("resizes from a corner with a stable aspect ratio", () => {
    const result = resizePreviewTransform(
      transform,
      "se",
      200,
      10,
      1920,
      1080,
      0
    );

    expect(result.transform).toMatchObject({
      height: 300,
      width: 600,
      x: 100,
      y: 100
    });
  });
});

function previewConfig(): MultiTrackEditConfig {
  return {
    canvas: {
      background_color: "#000000FF",
      height: 1080,
      mode: "custom",
      width: 1920
    },
    output: { format: "mp4", fps: 30 },
    tracks: [
      {
        elements: [
          {
            id: "text-1",
            inline_text: "标题",
            loop: false,
            source: null,
            style: {
              background_color: "#00000000",
              bold: false,
              color: "#FFFFFFFF",
              font_size: 64,
              italic: false,
              underline: false
            },
            target_time: { end_ms: 5000, start_ms: 1000 },
            transform,
            type: "text"
          }
        ],
        hidden: false,
        id: "text-track",
        muted: false,
        name: "文字",
        order: 0,
        type: "text"
      },
      {
        elements: [
          {
            fade_in_ms: 0,
            fade_out_ms: 0,
            id: "video-1",
            loop: false,
            source: {
              source_handle: "video",
              source_node_id: "video-source"
            },
            source_trim: { end_ms: 5000, start_ms: 0 },
            speed: 1,
            target_time: { end_ms: 5000, start_ms: 0 },
            transform: {
              height: 1080,
              rotation: 0,
              width: 1920,
              x: 0,
              y: 0
            },
            transition: null,
            type: "video",
            volume: 1
          }
        ],
        hidden: false,
        id: "video-track",
        muted: false,
        name: "视频",
        order: 1,
        type: "video"
      }
    ]
  };
}
