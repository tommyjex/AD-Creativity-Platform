import type {
  AigcEditedLayer,
  AigcLayer,
  AigcLayerSet,
  AigcNode,
  AigcPipelineDefinition,
  AigcPipelineRunNode,
  AigcResultAsset
} from "@/lib/aigc/types";

export interface AigcVideoResultProjection {
  asset: AigcResultAsset | undefined;
  audioState: boolean | null;
  duration: number | null;
  resolution: string | null;
  title: string;
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

export function projectAigcLayerCompositeResult(
  definition: AigcPipelineDefinition | undefined,
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
  definition: AigcPipelineDefinition | undefined,
  nodeId: string,
  assets: readonly AigcResultAsset[]
): AigcVideoResultProjection {
  const node = definition?.nodes.find((candidate) => candidate.id === nodeId);
  const generationNode = findVideoGenerationNode(definition, node);
  return {
    asset: assets.find(
      (asset) =>
        asset.mime_type?.toLowerCase().startsWith("video/") ||
        asset.mime_type === null
    ),
    audioState: generationNode?.config.generate_audio ?? null,
    duration:
      generationNode && generationNode.config.duration_seconds >= 0
        ? generationNode.config.duration_seconds
        : null,
    resolution: generationNode?.config.resolution ?? null,
    title:
      node?.type === "video_output"
        ? node.config.title
        : node?.type === "video_generation"
          ? "视频结果"
          : "视频结果"
  };
}

export function isAigcVideoResult(
  definition: AigcPipelineDefinition | undefined,
  nodeId: string,
  asset: AigcResultAsset
): boolean {
  const node = definition?.nodes.find((candidate) => candidate.id === nodeId);
  return (
    node?.type === "video_output" ||
    node?.type === "video_generation" ||
    Boolean(asset.mime_type?.toLowerCase().startsWith("video/"))
  );
}

function findVideoGenerationNode(
  definition: AigcPipelineDefinition | undefined,
  node: AigcNode | undefined
): Extract<AigcNode, { type: "video_generation" }> | undefined {
  if (node?.type === "video_generation") return node;
  if (!definition || node?.type !== "video_output") return undefined;
  const sourceId = definition.edges.find(
    (edge) => edge.targetNodeId === node.id && edge.targetHandle === "video"
  )?.sourceNodeId;
  const source = definition.nodes.find((candidate) => candidate.id === sourceId);
  return source?.type === "video_generation" ? source : undefined;
}

function sourceNodeIdForInput(
  definition: AigcPipelineDefinition | undefined,
  nodeId: string,
  targetHandle: string
): string | null {
  return definition?.edges.find(
    (edge) =>
      edge.targetNodeId === nodeId && edge.targetHandle === targetHandle
  )?.sourceNodeId ?? null;
}
