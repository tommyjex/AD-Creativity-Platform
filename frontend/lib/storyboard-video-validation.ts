import type { StoryboardShotVideoConfig } from "@/lib/api-types";

export const STORYBOARD_VIDEO_INPUT_CONFLICT_MESSAGE =
  "首帧控制不能与参考图、参考视频或参考音频同时使用，请移除其中一类素材后重试。";

export const FIRST_FRAME_BLOCKS_REFERENCES_MESSAGE =
  "已启用首帧控制，如需添加参考素材，请先移除首帧。";

export const REFERENCES_BLOCK_FIRST_FRAME_MESSAGE =
  "当前分镜已有参考素材，如需使用首帧控制，请先移除全部参考素材。";

export function hasStoryboardFirstFrame(
  config: StoryboardShotVideoConfig
): boolean {
  return Boolean(
    config.first_frame_asset_id ||
      config.first_frame_source_video_asset_id
  );
}

export function hasStoryboardReferenceMedia(
  config: StoryboardShotVideoConfig
): boolean {
  return Boolean(
    config.reference_image_asset_ids.length ||
      config.reference_video_asset_ids.length ||
      config.reference_audio_asset_ids.length
  );
}

export function getStoryboardVideoInputConflict(
  config: StoryboardShotVideoConfig
): string | null {
  return hasStoryboardFirstFrame(config) &&
    hasStoryboardReferenceMedia(config)
    ? STORYBOARD_VIDEO_INPUT_CONFLICT_MESSAGE
    : null;
}
