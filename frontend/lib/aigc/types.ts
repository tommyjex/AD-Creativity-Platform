import type { DateTimeString } from "@/lib/api-types";
import type {
  SeedreamImagePresetSize,
  SeedreamImageSize
} from "@/lib/aigc/image-dimensions";
import type {
  SeedanceAspectRatio,
  SeedanceModel,
  SeedanceResolution,
  SeedanceTaskType
} from "@/lib/seedance";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const AIGC_NODE_TYPES = [
  "text_input",
  "image_input",
  "video_input",
  "audio_input",
  "llm",
  "text_to_image",
  "image_to_image",
  "video_generation",
  "video_enhancement",
  "video_face_blur",
  "layer_canvas",
  "layer_composite",
  "text_output",
  "image_output",
  "video_output"
] as const;

export const AIGC_V2_NODE_TYPES = [
  "text",
  "image",
  "video",
  "audio",
  "llm",
  "text_to_image",
  "image_to_image",
  "video_generation",
  "video_enhancement",
  "video_face_blur",
  "multi_track_edit",
  "json_parser",
  "layer_canvas",
  "layer_composite"
] as const;

export type AigcNodeType = (typeof AIGC_NODE_TYPES)[number];
export type AigcV2NodeType = (typeof AIGC_V2_NODE_TYPES)[number];
export type AigcNodeCategory = "input" | "model" | "control" | "output";
export type AigcV2NodeCategory = "modality" | "model" | "control";
export type AigcPortType =
  | "text"
  | "image_asset"
  | "video_asset"
  | "audio_asset"
  | "layer_set"
  | "image_layer"
  | "edited_layer";
export type AigcTaskType =
  | "llm"
  | "text_to_image"
  | "image_to_image"
  | "image_edit"
  | "layer_decomposition"
  | "layer_canvas"
  | "layer_composite"
  | "video_generation"
  | "video_enhancement"
  | "video_face_blur"
  | "multi_track_edit"
  | "json_parser";
export type AigcPipelineRunMode = "full" | "from_node" | "retry_node";
export type AigcPipelineRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";
export type AigcRunNodeStatus =
  | "idle"
  | "ready"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out"
  | "canceled"
  | "blocked"
  | "reused";
export type AigcTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out"
  | "canceled";
export type AigcResultKind =
  | "none"
  | "text"
  | "text_items"
  | "assets"
  | "layer_set"
  | "image_layer"
  | "edited_layer"
  | "layer_canvas"
  | "layer_composite"
  | "unavailable";
export type AigcAssetDirection = "input" | "output";
export type AigcImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type AigcImagePresetSize = SeedreamImagePresetSize;
export type AigcImageSize = SeedreamImageSize;
export type AigcImageToImageSize = "auto" | AigcImageSize;
export type AigcImageFormat = "png" | "jpeg";
export type AigcImageOperation =
  | "image_to_image"
  | "image_edit"
  | "layer_decomposition";
export type AigcPromptOptimizationMode =
  | "llm"
  | "text_to_image"
  | "image_to_image"
  | "video_generation";
export type AigcVideoGenerationMode =
  | "text_to_video"
  | "first_frame"
  | "first_last_frame"
  | "multimodal_reference";
export type AigcVideoEnhancementToolVersion =
  | "standard"
  | "professional";
export type AigcVideoEnhancementScene =
  | "common"
  | "ugc"
  | "short_series"
  | "aigc"
  | "old_film";
export type AigcVideoEnhancementStyle = "hd" | "natural";
export type AigcVideoEnhancementResolutionMode = "preset" | "short_edge";
export type AigcVideoEnhancementResolution =
  | "240p"
  | "360p"
  | "480p"
  | "540p"
  | "720p"
  | "1080p"
  | "2k"
  | "4k"
  | "8k";
export type AigcVideoEnhancementBitrateMode = "level" | "custom";
export type AigcVideoEnhancementBitrateLevel = "low" | "medium" | "high";
export type AigcVideoEnhancementBitDepth = 8 | 10 | 12 | 16;
export type AigcVideoFaceBlurMaskMode = "mosaic" | "blur";
export type AigcVideoFaceBlurMaskStrength = "low" | "medium" | "high";

export interface AigcPoint {
  x: number;
  y: number;
}

export interface AigcSize {
  width: number;
  height: number;
}

export interface AigcViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface AigcBbox {
  type: "bbox";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AigcBboxPromptReference {
  source_node_id: string;
  instruction: string;
}

export interface TextInputConfig {
  text: string;
  bbox_references?: AigcBboxPromptReference[];
}

export interface AigcPromptVideoReferenceSummary {
  source_node_id: string;
  source_handle: "image" | "video" | "audio";
  target_handle:
    | "first_frame"
    | "last_frame"
    | "reference_images"
    | "reference_videos"
    | "reference_audios";
  media_type: "image" | "video" | "audio";
  role:
    | "first_frame"
    | "last_frame"
    | "reference_image"
    | "reference_video"
    | "reference_audio";
  ordinal: number;
}

export type AigcPromptOptimizeRequest =
  | {
      target_node_id: string;
      target_type: "llm";
      target_config: {
        model: string;
        system_prompt: string;
      };
      optimization_direction: string;
      text: string;
      reference_instructions: [];
    }
  | {
      target_node_id: string;
      target_type: "text_to_image";
      target_config: {
        model: string;
        aspect_ratio: AigcImageAspectRatio;
        size: AigcImageSize;
        reference_image_count: 0;
      };
      optimization_direction: string;
      text: string;
      reference_instructions: string[];
    }
  | {
      target_node_id: string;
      target_type: "image_to_image";
      target_config: {
        model: string;
        operation: AigcImageOperation;
        aspect_ratio: AigcImageAspectRatio;
        size: AigcImageToImageSize;
        reference_image_count: number;
      };
      optimization_direction: string;
      text: string;
      reference_instructions: string[];
    }
  | {
      target_node_id: string;
      target_type: "video_generation";
      target_config: {
        model: SeedanceModel;
        generation_mode: AigcVideoGenerationMode;
        task_type: SeedanceTaskType;
        duration_seconds: number;
        aspect_ratio: SeedanceAspectRatio;
        generate_audio: boolean;
        references: AigcPromptVideoReferenceSummary[];
      };
      optimization_direction: string;
      text: string;
      reference_instructions: [];
    };

export interface AigcPromptOptimizeResponse {
  optimized_text: string;
  optimized_reference_instructions: string[];
}

export interface ImageInputConfig {
  asset_id: string | null;
  bbox?: AigcBbox | null;
  bbox_asset_id?: string | null;
}

export interface VideoInputConfig {
  asset_id: string | null;
}

export interface AudioInputConfig {
  asset_id: string | null;
}

export interface TextConfig extends TextInputConfig {
  title: string | null;
  upstream_text_override?: string | null;
  generated_by_parser_node_id?: string | null;
  generated_item_index?: number | null;
  generated_from_run_id?: string | null;
}

export interface ImageConfig extends ImageInputConfig {
  bbox: AigcBbox | null;
  bbox_asset_id: string | null;
  title: string | null;
  upstream_bbox?: AigcBbox | null;
  upstream_bbox_asset_id?: string | null;
}

export interface VideoConfig extends VideoInputConfig {
  title: string | null;
}

export interface AudioConfig extends AudioInputConfig {
  title: string | null;
}

export interface LlmConfig {
  model: string;
  system_prompt: string;
  temperature: number;
}

export interface JsonParserConfig {
  json_path: string;
}

export interface ImageModelConfig {
  model: string;
  aspect_ratio: AigcImageAspectRatio;
  size: AigcImageSize;
  format: AigcImageFormat;
}

export interface ImageToImageConfig extends Omit<ImageModelConfig, "size"> {
  operation?: AigcImageOperation;
  size: AigcImageToImageSize;
}

export type AigcBoundingBox = readonly [number, number, number, number];

export interface AigcLayerSetSummary {
  readonly id: string;
  readonly version: number;
  readonly digest: string;
}

export interface AigcLayer {
  readonly id: string;
  readonly asset_id: string;
  readonly z_index: number;
  readonly name: string;
  readonly description: string;
  readonly bbox_absolute: AigcBoundingBox;
  readonly bbox_normalized: AigcBoundingBox;
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export interface AigcLayerSet {
  readonly id: string;
  readonly parent_layer_set_id: string | null;
  readonly source_asset_id: string;
  readonly base_asset_id: string;
  readonly canvas_width: number;
  readonly canvas_height: number;
  readonly version: number;
  readonly digest: string;
  readonly layers: readonly AigcLayer[];
}

export interface AigcImageLayer {
  readonly asset_id: string;
  readonly layer_set_id: string;
  readonly layer_set_version: number;
  readonly layer_set_digest: string;
  readonly layer_id: string;
  readonly bbox_absolute: AigcBoundingBox;
  readonly bbox_normalized: AigcBoundingBox;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly z_index: number;
}

export type AigcEditedLayer = AigcImageLayer;

export interface AigcLayerTransformPatch {
  readonly layer_id: string;
  readonly x?: number | null;
  readonly y?: number | null;
  readonly scale?: number | null;
  readonly z_index?: number | null;
  readonly visible?: boolean | null;
  readonly deleted?: boolean | null;
}

export interface LayerCanvasConfig {
  selected_layer_id: string | null;
  source_layer_set: AigcLayerSetSummary | null;
  transform_patches: readonly AigcLayerTransformPatch[];
}

export type LayerCompositeConfig = Record<string, never>;

export interface VideoGenerationConfig {
  model: SeedanceModel;
  generation_mode: AigcVideoGenerationMode;
  task_type?: SeedanceTaskType;
  resolution: SeedanceResolution;
  aspect_ratio: SeedanceAspectRatio;
  duration_seconds: number;
  generate_audio: boolean;
}

type VideoEnhancementResolutionConfig =
  | {
      resolution_mode: "preset";
      resolution: AigcVideoEnhancementResolution;
      resolution_limit: null;
    }
  | {
      resolution_mode: "short_edge";
      resolution: null;
      resolution_limit: number;
    };

type VideoEnhancementBitrateConfig =
  | {
      bitrate_mode: "level";
      bitrate_level: AigcVideoEnhancementBitrateLevel;
      bitrate: null;
    }
  | {
      bitrate_mode: "custom";
      bitrate_level: null;
      bitrate: number;
    };

type VideoEnhancementVersionConfig =
  | ({
      tool_version: "standard";
      scene: AigcVideoEnhancementScene;
      bit_depth: 8;
    } & VideoEnhancementBitrateConfig)
  | ({
      tool_version: "professional";
      scene: null;
      bit_depth: 8 | 10 | 12;
    } & VideoEnhancementBitrateConfig)
  | {
      tool_version: "professional";
      scene: null;
      bit_depth: 16;
      bitrate_mode: null;
      bitrate_level: null;
      bitrate: null;
    };

export type VideoEnhancementConfig = {
  enhance_style: AigcVideoEnhancementStyle;
  fps: number | null;
} & VideoEnhancementResolutionConfig &
  VideoEnhancementVersionConfig;

export interface VideoFaceBlurConfig {
  mask_mode: AigcVideoFaceBlurMaskMode;
  mask_strength: AigcVideoFaceBlurMaskStrength;
}

export type MultiTrackKind =
  | "video"
  | "audio"
  | "image"
  | "text"
  | "subtitle";
export type MultiTrackFrameRate = 24 | 25 | 30 | 50 | 60;

export interface MultiTrackCanvas {
  mode: "auto" | "custom";
  width: number | null;
  height: number | null;
  background_color: string;
}

export interface MultiTrackOutput {
  format: "mp4";
  fps: MultiTrackFrameRate;
}

export interface MultiTrackSource {
  source_node_id: string;
  source_handle: string;
}

export interface MultiTrackTimeRange {
  start_ms: number;
  end_ms: number;
}

export interface MultiTrackTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface MultiTrackTextStyle {
  font_size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  background_color: string;
}

export interface MultiTrackTransition {
  type: "fade";
  duration_ms: number;
}

interface MultiTrackElementBase<TType extends MultiTrackKind> {
  id: string;
  type: TType;
  target_time: MultiTrackTimeRange;
  loop: boolean;
}

interface MultiTrackMediaElementBase<TType extends "video" | "audio">
  extends MultiTrackElementBase<TType> {
  source: MultiTrackSource;
  source_trim: MultiTrackTimeRange | null;
  speed: number;
  volume: number;
  fade_in_ms: number;
  fade_out_ms: number;
}

export interface MultiTrackVideoElement
  extends MultiTrackMediaElementBase<"video"> {
  transform: MultiTrackTransform;
  transition: MultiTrackTransition | null;
}

export type MultiTrackAudioElement =
  MultiTrackMediaElementBase<"audio">;

export interface MultiTrackImageElement
  extends MultiTrackElementBase<"image"> {
  source: MultiTrackSource;
  transform: MultiTrackTransform;
}

export interface MultiTrackTextElement
  extends MultiTrackElementBase<"text"> {
  source: MultiTrackSource | null;
  inline_text: string | null;
  transform: MultiTrackTransform;
  style: MultiTrackTextStyle;
}

export interface MultiTrackSubtitleElement
  extends MultiTrackElementBase<"subtitle"> {
  asset_id: string | null;
  transform: MultiTrackTransform;
  style: MultiTrackTextStyle;
}

export type MultiTrackElement =
  | MultiTrackVideoElement
  | MultiTrackAudioElement
  | MultiTrackImageElement
  | MultiTrackTextElement
  | MultiTrackSubtitleElement;

export interface MultiTrackTrack {
  id: string;
  name: string;
  type: MultiTrackKind;
  order: number;
  hidden: boolean;
  muted: boolean;
  elements: MultiTrackElement[];
}

export interface MultiTrackEditConfig {
  canvas: MultiTrackCanvas;
  output: MultiTrackOutput;
  tracks: MultiTrackTrack[];
}

export interface TextOutputConfig {
  title: string;
}

export interface ImageOutputConfig {
  title: string;
}

export interface VideoOutputConfig {
  title: string;
}

interface AigcNodeBase<TType extends string, TConfig> {
  id: string;
  type: TType;
  position: AigcPoint;
  size: AigcSize;
  config: TConfig;
}

export type AigcNode =
  | AigcNodeBase<"text_input", TextInputConfig>
  | AigcNodeBase<"image_input", ImageInputConfig>
  | AigcNodeBase<"video_input", VideoInputConfig>
  | AigcNodeBase<"audio_input", AudioInputConfig>
  | AigcNodeBase<"llm", LlmConfig>
  | AigcNodeBase<"text_to_image", ImageModelConfig>
  | AigcNodeBase<"image_to_image", ImageToImageConfig>
  | AigcNodeBase<"video_generation", VideoGenerationConfig>
  | AigcNodeBase<"video_enhancement", VideoEnhancementConfig>
  | AigcNodeBase<"video_face_blur", VideoFaceBlurConfig>
  | AigcNodeBase<"layer_canvas", LayerCanvasConfig>
  | AigcNodeBase<"layer_composite", LayerCompositeConfig>
  | AigcNodeBase<"text_output", TextOutputConfig>
  | AigcNodeBase<"image_output", ImageOutputConfig>
  | AigcNodeBase<"video_output", VideoOutputConfig>;

type AigcModelOrControlNode = Exclude<
  AigcNode,
  {
    type:
      | "text_input"
      | "image_input"
      | "video_input"
      | "audio_input"
      | "text_output"
      | "image_output"
      | "video_output";
  }
>;

export type AigcV2Node =
  | AigcNodeBase<"text", TextConfig>
  | AigcNodeBase<"image", ImageConfig>
  | AigcNodeBase<"video", VideoConfig>
  | AigcNodeBase<"audio", AudioConfig>
  | AigcNodeBase<"multi_track_edit", MultiTrackEditConfig>
  | AigcNodeBase<"json_parser", JsonParserConfig>
  | AigcModelOrControlNode;

export interface AigcEdge {
  id: string;
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
  targetHandle: string;
}

export interface AigcPipelineDefinition {
  schemaVersion: 1;
  nodes: AigcNode[];
  edges: AigcEdge[];
  viewport: AigcViewport;
}

export interface AigcPipelineDefinitionV2 {
  schemaVersion: 2;
  nodes: AigcV2Node[];
  edges: AigcEdge[];
  viewport: AigcViewport;
}

export interface AigcPortDefinition {
  id: string;
  label: string;
  type: AigcPortType;
  required: boolean;
  multiple: boolean;
  max_connections: number;
  system_only: boolean;
  modes: AigcVideoGenerationMode[];
}

export interface AigcNodeRegistryItem {
  type: AigcNodeType;
  label: string;
  category: AigcNodeCategory;
  executable: boolean;
  inputs: readonly AigcPortDefinition[];
  outputs: readonly AigcPortDefinition[];
  models: readonly string[];
}

export interface AigcV2NodeRegistryItem
  extends Omit<AigcNodeRegistryItem, "type" | "category"> {
  type: AigcV2NodeType;
  category: AigcV2NodeCategory;
}

export interface AigcNodeRegistryResponse {
  schema_version: 2;
  nodes: AigcV2NodeRegistryItem[];
}

export interface AigcNamedEntity {
  name: string;
  description: string;
}

export interface AigcPipelineTemplateCreate extends AigcNamedEntity {
  definition: AigcPipelineDefinition | AigcPipelineDefinitionV2;
}

export interface AigcPipelineTemplateUpdate
  extends AigcPipelineTemplateCreate {
  expected_revision: number;
}

export interface AigcPipelineTemplate extends AigcPipelineTemplateCreate {
  id: string;
  revision: number;
  created_at: DateTimeString;
  updated_at: DateTimeString;
}

export interface AigcTemplateInstantiateRequest {
  name?: string | null;
}

export type AigcSaveAsTemplateRequest = AigcNamedEntity;

export interface AigcPipelineCreate extends AigcNamedEntity {
  definition: AigcPipelineDefinition | AigcPipelineDefinitionV2;
  source_template_id: string | null;
  source_template_revision: number | null;
}

export interface AigcPipelineUpdate extends AigcNamedEntity {
  expected_revision: number;
  definition: AigcPipelineDefinition | AigcPipelineDefinitionV2;
}

export interface AigcPipeline extends AigcPipelineCreate {
  id: string;
  revision: number;
  latest_run_status: AigcPipelineRunStatus | null;
  created_at: DateTimeString;
  updated_at: DateTimeString;
}

export interface AigcPipelineRunCreate {
  expected_revision: number;
  mode: Exclude<AigcPipelineRunMode, "retry_node">;
  start_node_id?: string | null;
}

export interface AigcTaskError {
  code: string;
  message: string;
  request_id: string | null;
  stage: string | null;
}

export interface AigcTaskMetrics {
  cost_tokens: number;
  duration_ms: number;
}

export interface AigcResultAsset {
  asset_id: string;
  ordinal: number;
  mime_type: string | null;
  download_url: string | null;
  available: boolean;
  metadata?: Record<string, JsonValue>;
}

export interface AigcJsonParserItem {
  index: number;
  text: string;
  summary: string;
}

export interface AigcTaskResult {
  kind: AigcResultKind;
  text: string | null;
  text_digest: string | null;
  items?: AigcJsonParserItem[];
  assets: AigcResultAsset[];
  layer_set?: AigcLayerSet | null;
  image_layer?: AigcImageLayer | null;
  edited_layer?: AigcEditedLayer | null;
}

export interface AigcPipelineTaskSnapshot {
  params: Record<string, JsonValue>;
  upstream: string[];
}

export interface AigcPipelineTaskAttempt extends AigcPipelineTaskSnapshot {
  task_id: string;
  pipeline_id: string;
  run_id: string;
  node_id: string;
  attempt: number;
  type: AigcTaskType;
  status: AigcTaskStatus;
  progress: number;
  result: AigcTaskResult;
  error: AigcTaskError | null;
  metrics: AigcTaskMetrics;
  created_at: DateTimeString;
  started_at: DateTimeString | null;
  finished_at: DateTimeString | null;
}

export interface AigcPipelineRunNode {
  node_id: string;
  included_in_plan: boolean;
  status: AigcRunNodeStatus;
  current_task_id: string | null;
  reused_from_task_id: string | null;
  input_hash: string | null;
  result: AigcTaskResult;
  error?: AigcTaskError | null;
  attempts: AigcPipelineTaskAttempt[];
}

export interface AigcPipelineRun {
  id: string;
  pipeline_id: string;
  run_number: number;
  pipeline_revision: number;
  mode: AigcPipelineRunMode;
  start_node_id: string | null;
  source_run_id: string | null;
  source_node_id: string | null;
  status: AigcPipelineRunStatus;
  definition_snapshot: AigcPipelineDefinition | AigcPipelineDefinitionV2;
  input_snapshot: Record<string, JsonValue>;
  error: AigcTaskError | null;
  cancellation_requested: boolean;
  created_at: DateTimeString;
  updated_at: DateTimeString;
  started_at: DateTimeString | null;
  finished_at: DateTimeString | null;
}

export interface AigcPipelineRunDetail {
  run: AigcPipelineRun;
  nodes: AigcPipelineRunNode[];
}

export interface AigcPage<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface AigcNodeRunIdentity {
  runId: string;
  nodeId: string;
}

export function aigcNodeRunKey({
  runId,
  nodeId
}: AigcNodeRunIdentity): string {
  return `${runId}:${nodeId}`;
}

export function cloneAigcTaskSnapshot(
  snapshot: AigcPipelineTaskSnapshot
): AigcPipelineTaskSnapshot {
  return structuredClone(snapshot);
}
