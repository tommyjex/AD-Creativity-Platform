import { describe, expect, it } from "vitest";

import type { StoryboardShotVideoConfig } from "@/lib/api-types";
import {
  getStoryboardVideoInputConflict,
  hasStoryboardFirstFrame,
  hasStoryboardReferenceMedia,
  STORYBOARD_VIDEO_INPUT_CONFLICT_MESSAGE
} from "@/lib/storyboard-video-validation";

const baseConfig: StoryboardShotVideoConfig = {
  effective_video_prompt: "生成视频",
  first_frame_asset_id: null,
  first_frame_source_video_asset_id: null,
  reference_audio_asset_ids: [],
  reference_image_asset_ids: [],
  reference_video_asset_ids: [],
  shot_id: "shot-1",
  shot_index: 1,
  video_asset_id: null,
  video_prompt: null
};

describe("storyboard video input validation", () => {
  it("accepts empty, first-frame-only, and reference-only modes", () => {
    expect(getStoryboardVideoInputConflict(baseConfig)).toBeNull();
    expect(
      getStoryboardVideoInputConflict({
        ...baseConfig,
        first_frame_source_video_asset_id: "video-previous"
      })
    ).toBeNull();
    expect(
      getStoryboardVideoInputConflict({
        ...baseConfig,
        reference_audio_asset_ids: ["audio-1"],
        reference_image_asset_ids: ["image-1"],
        reference_video_asset_ids: ["video-1"]
      })
    ).toBeNull();
  });

  it("detects first frame combined with any reference media", () => {
    for (const references of [
      { reference_image_asset_ids: ["image-1"] },
      { reference_video_asset_ids: ["video-1"] },
      { reference_audio_asset_ids: ["audio-1"] }
    ]) {
      const config = {
        ...baseConfig,
        first_frame_asset_id: "first-frame",
        ...references
      };
      expect(hasStoryboardFirstFrame(config)).toBe(true);
      expect(hasStoryboardReferenceMedia(config)).toBe(true);
      expect(getStoryboardVideoInputConflict(config)).toBe(
        STORYBOARD_VIDEO_INPUT_CONFLICT_MESSAGE
      );
    }
  });
});
