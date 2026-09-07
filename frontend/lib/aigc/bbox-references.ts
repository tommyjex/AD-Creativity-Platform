import type {
  AigcBboxPromptReference,
  AigcEdge,
  AigcPipelineDefinitionV2,
  AigcV2Node
} from "@/lib/aigc/types";

export const AIGC_MAX_BBOX_REFERENCES = 10;
export const AIGC_COORDINATE_TAG_PATTERN = /<\/?\s*(?:bbox|point)\b/iu;

type BboxDefinition = Pick<
  AigcPipelineDefinitionV2,
  "edges" | "nodes" | "schemaVersion"
>;
type BboxTextNode = Extract<AigcV2Node, { type: "text" }>;
type BboxImageNode = Extract<AigcV2Node, { type: "image" }>;

export function bboxReferences(
  node: BboxTextNode
): AigcBboxPromptReference[] {
  return node.config.bbox_references ?? [];
}

function isBboxTextNode(node: AigcV2Node): node is BboxTextNode {
  return node.type === "text";
}

function isBboxImageNode(node: AigcV2Node): node is BboxImageNode {
  return node.type === "image";
}

function hasUpstream(definition: BboxDefinition, nodeId: string): boolean {
  return definition.edges.some((edge) => edge.targetNodeId === nodeId);
}

function hasStrictBboxRelationship(
  definition: BboxDefinition,
  imageNodeId: string,
  textNodeId: string
): boolean {
  const downstream = definition.edges.filter(
    (edge) =>
      edge.sourceNodeId === textNodeId &&
      edge.sourceHandle === "text"
  );
  if (downstream.length === 0) return false;

  return downstream.every((promptEdge) => {
    const target = definition.nodes.find(
      (node) => node.id === promptEdge.targetNodeId
    );
    if (
      target?.type !== "image_to_image" ||
      promptEdge.targetHandle !== "prompt"
    ) {
      return false;
    }
    return definition.edges.some(
      (edge) =>
        edge.sourceNodeId === imageNodeId &&
        edge.sourceHandle === "image" &&
        edge.targetNodeId === target.id &&
        edge.targetHandle === "image"
    );
  });
}

export function isEligibleBboxTextTarget(
  definition: BboxDefinition,
  imageNodeId: string,
  textNodeId: string,
  effectiveImageAssetId?: string | null
): boolean {
  const textNode = definition.nodes.find((node) => node.id === textNodeId);
  const imageNode = definition.nodes.find((node) => node.id === imageNodeId);
  if (!textNode || !imageNode) {
    return false;
  }
  if (
    definition.schemaVersion === 2 &&
    (textNode.type !== "text" || imageNode.type !== "image")
  ) {
    return false;
  }
  if (!isBboxTextNode(textNode) || !isBboxImageNode(imageNode)) {
    return false;
  }
  const imageHasUpstream = hasUpstream(definition, imageNodeId);
  return (
    !hasUpstream(definition, textNodeId) &&
    (!imageHasUpstream || Boolean(effectiveImageAssetId)) &&
    hasStrictBboxRelationship(definition, imageNodeId, textNodeId)
  );
}

export function eligibleBboxTextTargets(
  definition: BboxDefinition,
  imageNodeId: string,
  effectiveImageAssetId?: string | null
) {
  return definition.nodes.filter(
    (node): node is BboxTextNode =>
      isBboxTextNode(node) &&
      isEligibleBboxTextTarget(
        definition,
        imageNodeId,
        node.id,
        effectiveImageAssetId
      )
  );
}

export function isBboxReferencePaused(
  definition: BboxDefinition,
  imageNodeId: string,
  textNodeId: string
): boolean {
  const textNode = definition.nodes.find((node) => node.id === textNodeId);
  const imageNode = definition.nodes.find((node) => node.id === imageNodeId);
  return Boolean(
    textNode &&
      imageNode &&
      isBboxTextNode(textNode) &&
      isBboxImageNode(imageNode) &&
      hasStrictBboxRelationship(definition, imageNodeId, textNodeId) &&
      hasUpstream(definition, textNodeId)
  );
}

export function sanitizeBboxReferences(
  definition: AigcPipelineDefinitionV2
): AigcPipelineDefinitionV2 {
  const nodes = definition.nodes.map((node) => {
    if (!isBboxTextNode(node)) return node;
    const references = bboxReferences(node);
    const nextReferences = references.filter((reference) => {
      const image = definition.nodes.find(
        (candidate) => candidate.id === reference.source_node_id
      );
      return (
        image != null &&
        isBboxImageNode(image) &&
        (hasUpstream(definition, image.id)
          ? (image.config.upstream_bbox != null &&
              image.config.upstream_bbox_asset_id != null) ||
            (image.config.bbox != null &&
              image.config.bbox_asset_id === image.config.asset_id)
          : image.config.bbox != null &&
            image.config.bbox_asset_id === image.config.asset_id) &&
        hasStrictBboxRelationship(definition, reference.source_node_id, node.id)
      );
    });
    return nextReferences.length === references.length
      ? node
      : {
          ...node,
          config: { ...node.config, bbox_references: nextReferences }
        };
  });
  return nodes.every((node, index) => node === definition.nodes[index])
    ? definition
    : { ...definition, nodes };
}

export function connectionBreaksBboxReferences(
  connection: Pick<
    AigcEdge,
    "sourceNodeId" | "sourceHandle" | "targetNodeId" | "targetHandle"
  >,
  nodes: AigcV2Node[],
  edges: AigcEdge[]
): boolean {
  const source = nodes.find((node) => node.id === connection.sourceNodeId);
  if (!source || !isBboxTextNode(source) || bboxReferences(source).length === 0) {
    return false;
  }
  const target = nodes.find((node) => node.id === connection.targetNodeId);
  if (
    target?.type !== "image_to_image" ||
    connection.sourceHandle !== "text" ||
    connection.targetHandle !== "prompt"
  ) {
    return true;
  }
  return bboxReferences(source).some(
    (reference) =>
      !edges.some(
        (edge) =>
          edge.sourceNodeId === reference.source_node_id &&
          edge.sourceHandle === "image" &&
          edge.targetNodeId === connection.targetNodeId &&
          edge.targetHandle === "image"
      )
  );
}
