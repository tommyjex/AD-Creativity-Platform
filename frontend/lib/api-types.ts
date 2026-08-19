export type DateTimeString = string;

export const STATUSES = [
  "draft",
  "queued",
  "running",
  "succeeded",
  "skipped",
  "failed",
  "cancelled",
  "expired",
  "stale"
] as const;

export type Status = (typeof STATUSES)[number];

export const STAGES = [
  "brief",
  "story",
  "character",
  "script",
  "storyboard",
  "image",
  "video",
  "compose"
] as const;

export type Stage = (typeof STAGES)[number];

export type GenerationStage = Exclude<Stage, "brief">;
export type TextStreamStage = Extract<
  GenerationStage,
  "script" | "story" | "storyboard"
>;

export const ASSET_TYPES = [
  "uploaded_image",
  "uploaded_video",
  "uploaded_audio",
  "generated_image",
  "storyboard_video",
  "final_video",
  "subtitle"
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];
export type AssetRole = "public" | "internal_base" | "internal_layer";

export const ASSET_CATEGORIES = ["character", "scene", "reference"] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const REFERENCE_ASSET_KINDS = ["image", "video", "audio"] as const;

export type ReferenceAssetKind = (typeof REFERENCE_ASSET_KINDS)[number];

export const CHARACTER_ASSET_ITERATION_OPERATIONS = [
  "edit",
  "regenerate"
] as const;

export type CharacterAssetIterationOperation =
  (typeof CHARACTER_ASSET_ITERATION_OPERATIONS)[number];

export const ERROR_CODES = [
  "validation_error",
  "not_found",
  "dependency_missing",
  "task_conflict",
  "invalid_state",
  "generation_failed",
  "external_service_error",
  "unknown"
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type AssetMetadataValue =
  | string
  | number
  | boolean
  | null
  | AssetMetadataValue[]
  | { [key: string]: AssetMetadataValue };
export type AssetMetadata = Record<string, AssetMetadataValue>;

export type TargetLanguage = "zh" | "en";
export type ProjectType = "video_ad" | "image_asset";
export type ImagePurpose = "ecommerce_main" | "poster";

export interface BriefCreate {
  prompt: string;
  target_language?: TargetLanguage;
  target_platform?: string;
  aspect_ratio?: "9:16" | "16:9" | "1:1" | "4:3" | "3:4";
  duration_seconds?: number | null;
  image_purpose?: ImagePurpose | null;
  style?: string | null;
  audience?: string | null;
  product_name?: string | null;
  selling_points?: string[];
}

export interface Brief extends Required<Pick<BriefCreate, "prompt">> {
  target_language: TargetLanguage;
  target_platform: string;
  aspect_ratio: "9:16" | "16:9" | "1:1" | "4:3" | "3:4";
  duration_seconds: number | null;
  image_purpose: ImagePurpose | null;
  style: string | null;
  audience: string | null;
  product_name: string | null;
  summary: string | null;
  selling_points: string[];
}

export interface BriefUpdate {
  prompt?: string;
  target_language?: TargetLanguage;
  target_platform?: string;
  aspect_ratio?: Brief["aspect_ratio"];
  duration_seconds?: number | null;
  image_purpose?: ImagePurpose | null;
  style?: string | null;
  audience?: string | null;
  product_name?: string | null;
  selling_points?: string[];
}

export interface ProjectCreate {
  name?: string | null;
  project_type?: ProjectType;
  brief: BriefCreate;
}

export interface ProjectUpdate {
  name?: string;
  brief?: BriefUpdate;
}

export interface ProjectListItem {
  id: string;
  name: string;
  project_type: ProjectType;
  brief: Brief;
  status: Status;
  current_stage: Stage;
  current_image_prompt_version_id: string | null;
  image_prompt_status: Status;
  current_image_asset_id: string | null;
  image_revision: number;
  created_at: DateTimeString;
  updated_at: DateTimeString;
}

export interface Project {
  id: string;
  name: string;
  project_type: ProjectType;
  brief: Brief;
  status: Status;
  current_stage: Stage;
  current_image_prompt_version_id: string | null;
  image_prompt_status: Status;
  current_image_asset_id: string | null;
  image_revision: number;
  character_cards?: CharacterCard[];
  text_artifacts: TextArtifact[];
  storyboard: StoryboardShot[];
  tasks: GenerationTask[];
  assets: Asset[];
  created_at: DateTimeString;
  updated_at: DateTimeString;
}

export interface ImagePromptVersion {
  id: string;
  project_id: string;
  version: number;
  prompt: string;
  aspect_ratio: Brief["aspect_ratio"];
  target_language: TargetLanguage;
  image_purpose: ImagePurpose;
  created_at: DateTimeString;
}

export interface ImagePromptVersionSave {
  prompt: string;
}

export interface ImagePromptSuggestionRequest {
  current_prompt?: string | null;
}

export interface ImagePromptSuggestion {
  prompt: string;
  model: string;
}

export type ImageGenerationSize = "1K" | "1.5K" | "2K";
export type ImageOutputFormat = "png" | "jpeg";
export type ImageEditAnnotation =
  | { type: "point"; x: number; y: number }
  | {
      type: "bbox";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };

export interface TextToImageGenerationRequest {
  operation: "text_to_image";
  prompt_version_id: string;
  reference_asset_id?: string;
  size: ImageGenerationSize;
  format: ImageOutputFormat;
}

export interface ImageToImageGenerationRequest {
  operation: "image_to_image";
  source_asset_id: string;
  prompt: string;
  prompt_version_id?: string;
  annotation?: ImageEditAnnotation | null;
  size: ImageGenerationSize;
  format: ImageOutputFormat;
}

export type ImageGenerationRequest =
  | TextToImageGenerationRequest
  | ImageToImageGenerationRequest;

export type ImageLayerDecompositionSize = "auto" | ImageGenerationSize;

export interface ImageLayerDecompositionRequest {
  source_asset_id: string;
  prompt?: string | null;
  bbox?: Extract<ImageEditAnnotation, { type: "bbox" }> | null;
  size: ImageLayerDecompositionSize;
  format: ImageOutputFormat;
}

export interface ImageLayer {
  id: string;
  set_id: string;
  asset_id: string;
  z_index: number;
  name: string;
  description: string;
  bbox_absolute: [number, number, number, number];
  bbox_normalized: [number, number, number, number];
  visible: boolean;
  x: number;
  y: number;
  scale: number;
}

export interface ImageLayerSet {
  id: string;
  project_id: string;
  source_asset_id: string;
  base_asset_id: string;
  canvas_width: number;
  canvas_height: number;
  status: Status;
  revision: number;
  layers: ImageLayer[];
  created_at: DateTimeString;
  updated_at: DateTimeString;
}

export interface ImageLayerSetDetail extends ImageLayerSet {
  base_asset: Asset;
  layers_assets: Asset[];
}

export interface ImageLayerUpdate {
  id: string;
  z_index: number;
  visible: boolean;
  x: number;
  y: number;
  scale: number;
}

export interface ImageLayerSetUpdate {
  expected_revision: number;
  layers: ImageLayerUpdate[];
}

export interface ImageLayerCompositionRequest {
  layer_set_id: string;
  expected_revision: number;
  set_current?: boolean;
}

export interface SetCurrentImageRequest {
  asset_id: string;
  expected_image_revision: number;
}

export interface TextArtifact {
  id: string;
  project_id: string;
  stage: Stage;
  title: string | null;
  content: string;
  version: number;
  status: Status;
  created_at: DateTimeString;
  updated_at: DateTimeString;
}

export type TextArtifactUpdateStage = Extract<
  Stage,
  "story" | "script" | "storyboard"
>;

export interface TextArtifactUpdate {
  content: string;
  title?: string | null;
}

export interface StoryboardShot {
  id: string;
  project_id: string;
  index: number;
  title: string | null;
  description: string;
  visual_prompt: string;
  narration: string | null;
  duration_seconds: number;
  status: Status;
  image_asset_id: string | null;
  first_frame_asset_id: string | null;
  first_frame_source_video_asset_id: string | null;
  video_asset_id: string | null;
  video_prompt: string | null;
  reference_image_asset_ids: string[];
  reference_video_asset_ids: string[];
  reference_audio_asset_ids: string[];
  is_merged: boolean;
  merge_source_count: number;
  created_at: DateTimeString;
  updated_at: DateTimeString;
}

export interface StoryboardShotVideoConfig {
  shot_id: string;
  shot_index: number;
  video_prompt: string | null;
  effective_video_prompt: string;
  first_frame_asset_id: string | null;
  first_frame_source_video_asset_id: string | null;
  reference_image_asset_ids: string[];
  reference_video_asset_ids: string[];
  reference_audio_asset_ids: string[];
  video_asset_id: string | null;
}

export type StoryboardShotFirstFrameRequest =
  | {
      asset_id: string;
      source_video_asset_id?: never;
    }
  | {
      asset_id?: never;
      source_video_asset_id: string;
    };

export interface StoryboardShotVideoConfigUpdate {
  video_prompt?: string | null;
}

export interface StoryboardShotVideoPromptOptimizeRequest {
  video_prompt: string | null;
}

export interface StoryboardShotVideoPromptOptimizeResponse {
  optimized_prompt: string;
}

export interface StoryboardShotVideoEditRequest {
  prompt: string;
}

export interface StoryboardShotVideoSelectionRequest {
  asset_id: string;
}

export interface StoryboardShotReferenceRequest {
  asset_id: string;
  kind: ReferenceAssetKind;
}

export interface StoryboardShotMergeRequest {
  shot_ids: string[];
}

export interface StoryboardShotReferenceUploadResponse {
  asset_id: string;
  config: StoryboardShotVideoConfig;
}

export type StoryboardTailFrameReferenceSkipReason =
  | "has_first_frame"
  | "already_attached";

export interface StoryboardTailFrameReferenceSkip {
  shot_id: string;
  shot_index: number;
  reason: StoryboardTailFrameReferenceSkipReason;
}

export interface StoryboardTailFrameReferenceApplyResponse {
  source_shot_id: string;
  source_video_asset_id: string;
  reference_asset_id: string;
  applied_shot_ids: string[];
  skipped: StoryboardTailFrameReferenceSkip[];
}

export interface StoryboardShotGenerateVideoRequest {
  shot_id?: string;
  shot_index?: number;
}

export interface TaskError {
  code: ErrorCode;
  message: string;
  detail: string | null;
}

export interface GenerationTask {
  id: string;
  project_id: string;
  stage: Stage;
  status: Status;
  progress: number;
  progress_message: string | null;
  error: TaskError | null;
  input_hash: string | null;
  frozen_input?: Record<string, unknown> | null;
  retry_of_task_id?: string | null;
  output_asset_ids: string[];
  output_text_artifact_id: string | null;
  created_at: DateTimeString;
  updated_at: DateTimeString;
  started_at: DateTimeString | null;
  finished_at: DateTimeString | null;
}

export type GenerationStreamEvent =
  | { type: "task"; task: GenerationTask }
  | { type: "delta"; text: string }
  | { type: "complete"; task: GenerationTask }
  | { type: "error"; error: ApiErrorPayload };

export type PromptOptimizationStreamEvent =
  | { type: "delta"; text: string }
  | { type: "complete"; optimized_prompt: string }
  | { type: "error"; error: ApiErrorPayload };

export interface TextGenerationStreamState {
  stage: TextStreamStage | null;
  status: "completed" | "failed" | "idle" | "streaming";
  text: string;
  task: GenerationTask | null;
  error: string | null;
}

export interface Asset {
  id: string;
  project_id: string;
  type: AssetType;
  category: AssetCategory | null;
  asset_role?: AssetRole;
  status: Status;
  stage: Stage | null;
  url: string | null;
  object_key: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  source_task_id: string | null;
  metadata: AssetMetadata;
  created_at: DateTimeString;
  updated_at: DateTimeString;
}

export interface CharacterCard {
  id: string;
  project_id: string;
  name: string;
  description: string;
  sort_order: number;
  asset_id: string | null;
  status: Status;
  created_at: DateTimeString;
  updated_at: DateTimeString;
}

export interface CharacterCardUpdate {
  name?: string;
  description?: string;
  sort_order?: number;
  asset_id?: string | null;
  status?: Status;
}

export interface CharacterCardImageGenerationResponse {
  character_card: CharacterCard;
  task: GenerationTask;
  asset: Asset;
}

export interface CharacterAssetIterationRequest {
  asset_id: string;
  prompt: string;
  operation_type: CharacterAssetIterationOperation;
}

export interface CharacterAssetIterationResponse {
  source_asset_id: string;
  prompt: string;
  operation_type: CharacterAssetIterationOperation;
  task: GenerationTask;
  asset: Asset;
}

export interface ApiErrorPayload {
  code: ErrorCode;
  message: string;
  detail?: string;
}
