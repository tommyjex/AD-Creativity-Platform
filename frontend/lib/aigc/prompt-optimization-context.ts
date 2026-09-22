import { AIGC_NODE_REGISTRY_BY_TYPE } from "@/lib/aigc/node-registry";
import type {
  AigcPipelineDefinitionV2,
  AigcPipelineRunDetail,
  AigcPromptPipelineSourceImage
} from "@/lib/aigc/types";

export function resolvePromptOptimizationSourceImage(
  definition: AigcPipelineDefinitionV2,
  targetNodeId: string,
  runDetail: AigcPipelineRunDetail | null
): AigcPromptPipelineSourceImage | null {
  const target = definition.nodes.find(
    (node) => node.id === targetNodeId && node.type === "image_to_image"
  );
  if (target?.type !== "image_to_image") return null;

  const operation = target.config.operation ?? "image_to_image";
  if (operation === "layer_decomposition") return null;
  const targetHandle = operation === "image_edit" ? "edit_image" : "image";
  const imageInputEdges = definition.edges.filter(
    (edge) =>
      edge.targetNodeId === target.id &&
      ["edit_image", "edit_layer", "image"].includes(edge.targetHandle)
  );
  if (
    imageInputEdges.some((edge) => edge.targetHandle !== targetHandle)
  ) {
    return null;
  }
  const incoming = definition.edges.filter(
    (edge) =>
      edge.targetNodeId === target.id && edge.targetHandle === targetHandle
  );
  if (incoming.length !== 1) return null;

  const edge = incoming[0];
  const source = definition.nodes.find(
    (node) => node.id === edge.sourceNodeId
  );
  const sourcePort = source
    ? AIGC_NODE_REGISTRY_BY_TYPE.get(source.type)?.outputs.find(
        (port) => port.id === edge.sourceHandle
      )
    : null;
  if (
    !source ||
    edge.sourceHandle !== "image" ||
    sourcePort?.type !== "image_asset"
  ) {
    return null;
  }

  const descriptor = {
    source_handle: "image",
    source_node_id: edge.sourceNodeId,
    target_handle: targetHandle
  } as const;
  const sourceHasUpstreamImage = definition.edges.some(
    (candidate) =>
      candidate.targetNodeId === source.id &&
      candidate.targetHandle === "image"
  );
  if (source.type === "image" && !sourceHasUpstreamImage) {
    const assetId = source.config.asset_id?.trim();
    return assetId
      ? {
          ...descriptor,
          asset_id: assetId,
          run_id: null
        }
      : null;
  }

  if (
    !runDetail ||
    !runDetail.run.definition_snapshot.nodes.some(
      (node) => node.id === source.id
    )
  ) {
    return null;
  }
  const runNode = runDetail.nodes.find(
    (candidate) => candidate.node_id === source.id
  );
  const asset = runNode?.result.assets[0];
  if (
    !runNode ||
    !["reused", "succeeded"].includes(runNode.status) ||
    !asset?.available ||
    !asset.asset_id.trim() ||
    !asset.mime_type?.toLowerCase().startsWith("image/")
  ) {
    return null;
  }
  return {
    ...descriptor,
    asset_id: asset.asset_id,
    run_id: runDetail.run.id
  };
}
