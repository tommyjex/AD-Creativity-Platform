import type { DateTimeString } from "@/lib/api-types";
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
  "layer_canvas",
  "layer_composite",
  "text_output",
  "image_output",
  "video_output"
] as const;

export type AigcNodeType = (typeof AIGC_NODE_TYPES)[number];
export type AigcNodeCategory = "input" | "model" | "control" | "output";
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
  | "video_generation";
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
  | "assets"
  | "layer_set"
  | "image_layer"
  | "edited_layer"
  | "layer_canvas"
  | "layer_composite"
  | "unavailable";
export type AigcAssetDirection = "input" | "output";
export type AigcImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type AigcImageSize = "1K" | "1.5K" | "2K";
export type AigcImageToImageSize = "auto" | AigcImageSize;
export type AigcImageFormat = "png" | "jpeg";
export type AigcImageOperation =
  | "image_to_image"
  | "image_edit"
  | "layer_decomposition";
export type AigcPromptOptimizationMode =
  | "text_to_image"
  | "image_to_image";
export type AigcVideoGenerationMode =
  | "text_to_video"
  | "first_frame"
  | "first_last_frame"
  | "multimodal_reference";

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

export interface AigcPromptOptimizeRequest {
  text: string;
  reference_instructions: string[];
  generation_modes: AigcPromptOptimizationMode[];
  reference_image_count: number;
}

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

export interface LlmConfig {
  model: string;
  system_prompt: string;
  temperature: number;
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

export interface TextOutputConfig {
  title: string;
}

export interface ImageOutputConfig {
  title: string;
}

export interface VideoOutputConfig {
  title: string;
}

interface AigcNodeBase<TType extends AigcNodeType, TConfig> {
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
  | AigcNodeBase<"layer_canvas", LayerCanvasConfig>
  | AigcNodeBase<"layer_composite", LayerCompositeConfig>
  | AigcNodeBase<"text_output", TextOutputConfig>
  | AigcNodeBase<"image_output", ImageOutputConfig>
  | AigcNodeBase<"video_output", VideoOutputConfig>;

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

export interface AigcPortDefinition {
  id: string;
  label: string;
  type: AigcPortType;
  required: boolean;
  multiple: boolean;
  max_connections: number;
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

export interface AigcNodeRegistryResponse {
  schema_version: 1;
  nodes: AigcNodeRegistryItem[];
}

export interface AigcNamedEntity {
  name: string;
  description: string;
}

export interface AigcPipelineTemplateCreate extends AigcNamedEntity {
  definition: AigcPipelineDefinition;
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
  definition: AigcPipelineDefinition;
  source_template_id: string | null;
  source_template_revision: number | null;
}

export interface AigcPipelineUpdate extends AigcNamedEntity {
  expected_revision: number;
  definition: AigcPipelineDefinition;
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
}

export interface AigcTaskResult {
  kind: AigcResultKind;
  text: string | null;
  text_digest: string | null;
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
  definition_snapshot: AigcPipelineDefinition;
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
