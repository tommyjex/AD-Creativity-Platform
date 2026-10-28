import type { Asset, SubtitleSegment, SubtitleWorkspace, ToolTask } from "@/lib/api-types";

export const subtitleSegment: SubtitleSegment = {
  segment_id: "line-a", text: "Power 20 W", translated_text: "Leistung 20 W",
  translation_status: "succeeded", start_ms: 1000, end_ms: 3000,
  bbox_normalized: [100, 200, 600, 300], bbox_pixels: [192, 216, 1152, 324],
  visual_role: "headline", font_height_ratio: 0.1, alignment: "left",
  block_id: "title", line_index: 0, background_color: "#eeeeee",
  estimated_font_size_px: 42, recommended_text_color: "#000000",
  effective_font_size_px: 32, warnings: ["font_size_reduced"], excluded: false, style: {}
};
export const subtitleWorkspace: SubtitleWorkspace = {
  id: "workspace-a", name: "Translation A", revision: 2, stage: "review_ready",
  reference_video_asset_id: "reference-a", clean_video_asset_id: "clean-a",
  source_language: "auto", target_language: "de",
  reference_video: { width: 1920, height: 1080, duration_ms: 5000, rotation: 0, fps: 30, has_audio: true },
  clean_video: { width: 1280, height: 720, duration_ms: 4500, rotation: 0, fps: 30, has_audio: true },
  segments: [subtitleSegment], active_task_id: null, stage_task_ids: {}, output_asset_id: null,
  warnings: [], created_at: "2026-10-26T00:00:00Z", updated_at: "2026-10-26T00:00:00Z"
};
export const subtitleTask: ToolTask = {
  id: "task-a", type: "video_subtitle_translation", status: "queued",
  input_snapshot: { workspace_id: "workspace-a", operation: "render", revision: 3 },
  provider_task_id: null, created_at: subtitleWorkspace.created_at, updated_at: subtitleWorkspace.updated_at,
  started_at: null, finished_at: null
};
export const subtitleAsset: Asset = {
  id: "reference-a", project_id: null, tool_asset_role: "input", type: "uploaded_video",
  category: null, status: "succeeded", stage: null, url: "/api/assets/reference-a/content",
  object_key: "tools/reference-a.mp4", mime_type: "video/mp4", size_bytes: 2048,
  source_task_id: null, metadata: { name: "Reference.mp4", tool_asset_kind: "video" },
  created_at: subtitleWorkspace.created_at, updated_at: subtitleWorkspace.updated_at
};
