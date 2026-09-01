import type {
  AigcLayer,
  AigcLayerSet,
  AigcLayerTransformPatch,
  AigcEdge,
  AigcPipelineRunDetail,
  LayerCanvasConfig
} from "@/lib/aigc/types";

export function layerSetSummary(layerSet: AigcLayerSet) {
  return {
    digest: layerSet.digest,
    id: layerSet.id,
    version: layerSet.version
  };
}

export function layerCanvasSourceIsCurrent(
  config: LayerCanvasConfig,
  layerSet: AigcLayerSet
) {
  const source = config.source_layer_set;
  return Boolean(
    source &&
      source.id === layerSet.id &&
      source.version === layerSet.version &&
      source.digest === layerSet.digest
  );
}

export function applyLayerCanvasConfig(
  layerSet: AigcLayerSet,
  config: LayerCanvasConfig
): AigcLayer[] {
  if (!layerCanvasSourceIsCurrent(config, layerSet)) {
    return normalizeLayerOrder(layerSet.layers);
  }
  const patches = new Map(
    config.transform_patches.map((patch) => [patch.layer_id, patch])
  );
  return normalizeLayerOrder(
    layerSet.layers.flatMap((layer) => {
      const patch = patches.get(layer.id);
      if (patch?.deleted) return [];
      return [
        {
          ...layer,
          scale: patch?.scale ?? layer.scale,
          visible: patch?.visible ?? layer.visible,
          x: patch?.x ?? layer.x,
          y: patch?.y ?? layer.y,
          z_index: patch?.z_index ?? layer.z_index
        }
      ];
    })
  );
}

export function createLayerTransformPatches(
  sourceLayers: readonly AigcLayer[],
  draftLayers: readonly AigcLayer[]
): AigcLayerTransformPatch[] {
  const draftById = new Map(draftLayers.map((layer) => [layer.id, layer]));
  return sourceLayers.flatMap((source) => {
    const draft = draftById.get(source.id);
    if (!draft) return [{ deleted: true, layer_id: source.id }];
    const patch: {
      layer_id: string;
      scale?: number;
      visible?: boolean;
      x?: number;
      y?: number;
      z_index?: number;
    } = { layer_id: source.id };
    if (draft.x !== source.x) patch.x = draft.x;
    if (draft.y !== source.y) patch.y = draft.y;
    if (draft.scale !== source.scale) patch.scale = draft.scale;
    if (draft.z_index !== source.z_index) patch.z_index = draft.z_index;
    if (draft.visible !== source.visible) patch.visible = draft.visible;
    return Object.keys(patch).length > 1 ? [patch] : [];
  });
}

export function layerCanvasModificationCount(
  sourceLayers: readonly AigcLayer[],
  draftLayers: readonly AigcLayer[]
) {
  return createLayerTransformPatches(sourceLayers, draftLayers).length;
}

export function findUpstreamLayerSet(
  edges: readonly AigcEdge[],
  nodeId: string,
  runDetails: readonly AigcPipelineRunDetail[]
): AigcLayerSet | null {
  const sourceNodeIds = new Set(
    edges
      .filter(
        (edge) =>
          edge.targetNodeId === nodeId &&
          edge.targetHandle === "layers" &&
          edge.sourceHandle === "layers"
      )
      .map((edge) => edge.sourceNodeId)
  );
  if (sourceNodeIds.size === 0) return null;
  for (const detail of runDetails) {
    const source = detail.nodes.find(
      (node) =>
        sourceNodeIds.has(node.node_id) &&
        (node.status === "succeeded" || node.status === "reused") &&
        node.result.layer_set
    );
    if (source?.result.layer_set) return source.result.layer_set;
  }
  return null;
}

function normalizeLayerOrder(layers: readonly AigcLayer[]): AigcLayer[] {
  return layers
    .toSorted((a, b) => a.z_index - b.z_index)
    .map((layer, index) => ({ ...layer, z_index: index + 1 }));
}
