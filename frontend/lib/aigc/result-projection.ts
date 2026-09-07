import { migrateAigcRunSnapshotV2 } from "@/lib/aigc/definition-migration";
import type {
  AigcEditedLayer,
  AigcLayer,
  AigcLayerSet,
  AigcPipelineDefinition,
  AigcPipelineDefinitionV2,
  AigcPipelineRunDetail,
  AigcPipelineRunNode,
  AigcResultAsset,
  AigcRunNodeStatus,
  AigcV2Node,
  AigcVideoFaceBlurMaskMode,
  AigcVideoFaceBlurMaskStrength
} from "@/lib/aigc/types";

type AigcModality = "audio" | "image" | "text" | "video";

export interface AigcModalityRunResultProjection {
  asset: AigcResultAsset | undefined;
  available: boolean;
  downloadUrl: string | null;
  modality: AigcModality;
  mode: "local" | "upstream";
  status: AigcRunNodeStatus;
  text: string | null;
  title: string;
}

export interface AigcImageBboxBindingProjection {
  assetId: string | null;
  bbox: Extract<AigcV2Node, { type: "image" }>["config"]["bbox"];
  state: "none" | "stale" | "valid";
}

export function projectAigcImageBboxBinding(
  definition: AigcPipelineDefinitionV2,
  nodeId: string,
  effectiveAssetId: string | null
): AigcImageBboxBindingProjection | null {
  const node = definition.nodes.find(
    (
      candidate
    ): candidate is Extract<AigcV2Node, { type: "image" }> =>
      candidate.id === nodeId && candidate.type === "image"
  );
  if (!node) return null;
  const upstream = definition.edges.some(
    (edge) => edge.targetNodeId === nodeId && edge.targetHandle === "image"
  );
  const bbox = upstream
    ? node.config.upstream_bbox ?? null
    : node.config.bbox;
  const assetId = upstream
    ? node.config.upstream_bbox_asset_id ?? null
    : node.config.bbox_asset_id;
  return {
    assetId,
    bbox,
    state:
      !bbox || !assetId
        ? "none"
        : effectiveAssetId === assetId
          ? "valid"
          : "stale"
  };
}

export interface AigcVideoResultProjection {
  asset: AigcResultAsset | undefined;
  audioState: boolean | null;
  bitDepth: number | null;
  duration: number | null;
  elementCount: number | null;
  fps: number | null;
  maskMode: AigcVideoFaceBlurMaskMode | null;
  maskStrength: AigcVideoFaceBlurMaskStrength | null;
  provider: string | null;
  providerRequestId: string | null;
  providerTaskId: string | null;
  resolution: string | null;
  title: string;
  toolVersion: "professional" | "standard" | null;
  trackCount: number | null;
}

export interface AigcLayerCompositeResultProjection {
  imageAsset: AigcResultAsset | undefined;
  inputLayerSet: AigcLayerSet | null;
  layerSet: AigcLayerSet | null;
  layersConnected: boolean;
  replacement: AigcEditedLayer | null;
  replacementConnected: boolean;
  targetLayer: AigcLayer | null;
}

export function projectAigcModalityRunResult(
  runDetail: AigcPipelineRunDetail,
  nodeId: string
): AigcModalityRunResultProjection | null {
  const definition = migrateAigcRunSnapshotV2(
    runDetail.run.definition_snapshot
  );
  const node = definition.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || !isModalityNode(node)) return null;

  const runNode = runDetail.nodes.find(
    (candidate) => candidate.node_id === nodeId
  );
  if (!runNode) return null;

  const asset = runNode.result.assets[0];
  const available = Boolean(asset?.available);
  return {
    asset,
    available,
    downloadUrl: available ? asset?.download_url ?? null : null,
    modality: node.type,
    mode: definition.edges.some((edge) => edge.targetNodeId === node.id)
      ? "upstream"
      : "local",
    status: runNode.status,
    text:
      node.type === "text" && runNode.result.kind === "text"
        ? runNode.result.text
        : null,
    title: modalityResultTitle(node, definition.nodes)
  };
}

export function projectAigcEffectiveText(
  runDetail: AigcPipelineRunDetail,
  currentDefinition: AigcPipelineDefinitionV2,
  nodeId: string
): AigcModalityRunResultProjection | null {
  const node = currentDefinition.nodes.find(
    (
      candidate
    ): candidate is Extract<AigcV2Node, { type: "text" }> =>
      candidate.id === nodeId && candidate.type === "text"
  );
  if (!node) return null;

  const incoming = currentDefinition.edges.find(
    (edge) =>
      edge.targetNodeId === nodeId &&
      edge.targetHandle === "text"
  );
  const title = modalityResultTitle(node, currentDefinition.nodes);
  if (!incoming) {
    return {
      asset: undefined,
      available: true,
      downloadUrl: null,
      modality: "text",
      mode: "local",
      status: "succeeded",
      text: node.config.text,
      title
    };
  }

  const source = runDetail.nodes.find(
    (candidate) => candidate.node_id === incoming.sourceNodeId
  );
  const status = source?.status ?? "idle";
  const dependencySucceeded = status === "succeeded" || status === "reused";
  const managedIndex = node.config.generated_item_index;
  if (
    node.config.generated_by_parser_node_id === incoming.sourceNodeId &&
    managedIndex != null &&
    incoming.sourceHandle === "items"
  ) {
    const item =
      source?.result.kind === "text_items"
        ? source.result.items?.find(
            (candidate) => candidate.index === managedIndex
          )
        : undefined;
    const runNode = runDetail.nodes.find(
      (candidate) => candidate.node_id === nodeId
    );
    return {
      asset: undefined,
      available: dependencySucceeded && item !== undefined,
      downloadUrl: null,
      modality: "text",
      mode: "upstream",
      status: runNode?.status ?? status,
      text: dependencySucceeded ? item?.text ?? null : null,
      title
    };
  }
  const upstreamText =
    source?.result.kind === "text" ? source.result.text : null;
  const text =
    dependencySucceeded && node.config.upstream_text_override != null
      ? node.config.upstream_text_override
      : dependencySucceeded
        ? upstreamText
        : null;
  return {
    asset: undefined,
    available: dependencySucceeded && text !== null,
    downloadUrl: null,
    modality: "text",
    mode: "upstream",
    status,
    text,
    title
  };
}

export function projectAigcLayerCompositeResult(
  definition:
    | AigcPipelineDefinition
    | AigcPipelineDefinitionV2
    | undefined,
  nodeId: string,
  runNodes: readonly AigcPipelineRunNode[]
): AigcLayerCompositeResultProjection {
  const compositeResult = runNodes.find(
    (candidate) => candidate.node_id === nodeId
  )?.result;
  const layersSourceId = sourceNodeIdForInput(
    definition,
    nodeId,
    "layers"
  );
  const replacementSourceId = sourceNodeIdForInput(
    definition,
    nodeId,
    "replacement"
  );
  const inputLayerSet =
    runNodes.find((candidate) => candidate.node_id === layersSourceId)?.result
      .layer_set ?? null;
  const replacement =
    runNodes.find((candidate) => candidate.node_id === replacementSourceId)
      ?.result.edited_layer ?? null;
  const layerSet = compositeResult?.layer_set ?? null;
  const targetLayer =
    replacement
      ? (layerSet ?? inputLayerSet)?.layers.find(
          (layer) => layer.id === replacement.layer_id
        ) ?? null
      : null;

  return {
    imageAsset: compositeResult?.assets.find(
      (asset) =>
        asset.available &&
        (asset.mime_type?.toLowerCase().startsWith("image/") ||
          asset.mime_type === null)
    ),
    inputLayerSet,
    layerSet,
    layersConnected: layersSourceId !== null,
    replacement,
    replacementConnected: replacementSourceId !== null,
    targetLayer
  };
}

export function projectAigcVideoResult(
  definition:
    | AigcPipelineDefinition
    | AigcPipelineDefinitionV2
    | undefined,
  nodeId: string,
  assets: readonly AigcResultAsset[]
): AigcVideoResultProjection {
  const normalized = definition
    ? migrateAigcRunSnapshotV2(definition)
    : undefined;
  const node = normalized?.nodes.find((candidate) => candidate.id === nodeId);
  const sourceNode = findVideoSourceNode(normalized, node);
  const generationNode =
    sourceNode?.type === "video_generation" ? sourceNode : undefined;
  const enhancementNode =
    sourceNode?.type === "video_enhancement" ? sourceNode : undefined;
  const faceBlurNode =
    sourceNode?.type === "video_face_blur" ? sourceNode : undefined;
  const multiTrackNode =
    sourceNode?.type === "multi_track_edit" ? sourceNode : undefined;
  const asset = assets.find(
    (candidate) =>
      candidate.mime_type?.toLowerCase().startsWith("video/") ||
      candidate.mime_type === null
  );
  const metadata = asset?.metadata;
  return {
    asset,
    audioState: generationNode?.config.generate_audio ?? null,
    bitDepth:
      metadataNumber(metadata, "bit_depth") ??
      enhancementNode?.config.bit_depth ??
      null,
    duration:
      metadataNumber(metadata, "duration_seconds") ??
      metadataNumber(metadata, "duration") ??
      millisecondsToSeconds(metadataNumber(metadata, "duration_ms")) ??
      (generationNode && generationNode.config.duration_seconds >= 0
        ? generationNode.config.duration_seconds
        : null),
    elementCount: metadataNumber(metadata, "element_count"),
    fps:
      metadataNumber(metadata, "fps") ??
      enhancementNode?.config.fps ??
      multiTrackNode?.config.output.fps ??
      null,
    maskMode:
      metadataMaskMode(metadata) ??
      faceBlurNode?.config.mask_mode ??
      null,
    maskStrength:
      metadataMaskStrength(metadata) ??
      faceBlurNode?.config.mask_strength ??
      null,
    provider: metadataString(metadata, "provider"),
    providerRequestId: metadataString(metadata, "provider_request_id"),
    providerTaskId: metadataString(metadata, "provider_task_id"),
    resolution:
      metadataString(metadata, "resolution") ??
      dimensionsFromMetadata(metadata) ??
      enhancementResolution(enhancementNode) ??
      multiTrackResolution(multiTrackNode) ??
      generationNode?.config.resolution ??
      null,
    title:
      node?.type === "video" && node.config.title
        ? node.config.title
        : node?.type === "video_enhancement"
          ? "画质增强结果"
          : node?.type === "video_face_blur"
            ? "人脸打码结果"
            : node?.type === "multi_track_edit"
              ? "多轨剪辑成片"
            : "视频结果",
    toolVersion:
      metadataToolVersion(metadata) ??
      enhancementNode?.config.tool_version ??
      null,
    trackCount: metadataNumber(metadata, "track_count")
  };
}

export function isAigcVideoResult(
  definition:
    | AigcPipelineDefinition
    | AigcPipelineDefinitionV2
    | undefined,
  nodeId: string,
  asset: AigcResultAsset
): boolean {
  const node = definition
    ? migrateAigcRunSnapshotV2(definition).nodes.find(
        (candidate) => candidate.id === nodeId
      )
    : undefined;
  return (
    node?.type === "video" ||
    node?.type === "video_generation" ||
    node?.type === "video_enhancement" ||
    node?.type === "video_face_blur" ||
    node?.type === "multi_track_edit" ||
    Boolean(asset.mime_type?.toLowerCase().startsWith("video/"))
  );
}

function findVideoSourceNode(
  definition: AigcPipelineDefinitionV2 | undefined,
  node: AigcV2Node | undefined
):
  | Extract<
      AigcV2Node,
      {
        type:
          | "multi_track_edit"
          | "video_enhancement"
          | "video_face_blur"
          | "video_generation";
      }
    >
  | undefined {
  if (
    node?.type === "video_generation" ||
    node?.type === "video_enhancement" ||
    node?.type === "video_face_blur" ||
    node?.type === "multi_track_edit"
  ) {
    return node;
  }
  if (!definition || node?.type !== "video") return undefined;
  const sourceId = definition.edges.find(
    (edge) => edge.targetNodeId === node.id && edge.targetHandle === "video"
  )?.sourceNodeId;
  const source = definition.nodes.find((candidate) => candidate.id === sourceId);
  return source?.type === "video_generation" ||
    source?.type === "video_enhancement" ||
    source?.type === "video_face_blur" ||
    source?.type === "multi_track_edit"
    ? source
    : undefined;
}

function multiTrackResolution(
  node: Extract<AigcV2Node, { type: "multi_track_edit" }> | undefined
): string | null {
  if (
    !node ||
    node.config.canvas.width === null ||
    node.config.canvas.height === null
  ) {
    return null;
  }
  return `${node.config.canvas.width}x${node.config.canvas.height}`;
}

function enhancementResolution(
  node: Extract<AigcV2Node, { type: "video_enhancement" }> | undefined
): string | null {
  if (!node) return null;
  return node.config.resolution_mode === "preset"
    ? node.config.resolution
    : node.config.resolution_limit === null
      ? null
      : `${node.config.resolution_limit}px 短边`;
}

function isModalityNode(
  node: AigcV2Node
): node is Extract<AigcV2Node, { type: AigcModality }> {
  return (
    node.type === "text" ||
    node.type === "image" ||
    node.type === "video" ||
    node.type === "audio"
  );
}

function modalityResultTitle(
  node: Extract<AigcV2Node, { type: AigcModality }>,
  nodes: readonly AigcV2Node[]
): string {
  if (node.config.title?.trim()) return node.config.title.trim();
  const baseName = {
    audio: "音频节点",
    image: "图片节点",
    text: "文本节点",
    video: "视频节点"
  }[node.type];
  const peers = nodes.filter((candidate) => candidate.type === node.type);
  return peers.length <= 1
    ? baseName
    : `${baseName}${peers.findIndex((candidate) => candidate.id === node.id) + 1}`;
}

function metadataNumber(
  metadata: AigcResultAsset["metadata"],
  key: string
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function metadataString(
  metadata: AigcResultAsset["metadata"],
  key: string
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function dimensionsFromMetadata(
  metadata: AigcResultAsset["metadata"]
): string | null {
  const width = metadataNumber(metadata, "width");
  const height = metadataNumber(metadata, "height");
  return width !== null && height !== null ? `${width}x${height}` : null;
}

function millisecondsToSeconds(value: number | null): number | null {
  return value === null ? null : value / 1_000;
}

function metadataToolVersion(
  metadata: AigcResultAsset["metadata"]
): "professional" | "standard" | null {
  const value = metadata?.tool_version;
  return value === "professional" || value === "standard" ? value : null;
}

function metadataMaskMode(
  metadata: AigcResultAsset["metadata"]
): AigcVideoFaceBlurMaskMode | null {
  const value = metadata?.mask_mode;
  return value === "mosaic" || value === "blur" ? value : null;
}

function metadataMaskStrength(
  metadata: AigcResultAsset["metadata"]
): AigcVideoFaceBlurMaskStrength | null {
  const value = metadata?.mask_strength;
  return value === "low" || value === "medium" || value === "high"
    ? value
    : null;
}

function sourceNodeIdForInput(
  definition:
    | AigcPipelineDefinition
    | AigcPipelineDefinitionV2
    | undefined,
  nodeId: string,
  targetHandle: string
): string | null {
  return definition?.edges.find(
    (edge) =>
      edge.targetNodeId === nodeId && edge.targetHandle === targetHandle
  )?.sourceNodeId ?? null;
}
