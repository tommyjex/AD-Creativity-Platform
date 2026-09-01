import type {
  AigcBboxPromptReference,
  AigcEdge,
  AigcNode,
  AigcPipelineDefinition
} from "@/lib/aigc/types";

export const AIGC_MAX_BBOX_REFERENCES = 10;
export const AIGC_COORDINATE_TAG_PATTERN = /<\/?\s*(?:bbox|point)\b/iu;

export function bboxReferences(
  node: Extract<AigcNode, { type: "text_input" }>
): AigcBboxPromptReference[] {
  return node.config.bbox_references ?? [];
}

export function isEligibleBboxTextTarget(
  definition: Pick<AigcPipelineDefinition, "edges" | "nodes">,
  imageNodeId: string,
  textNodeId: string
): boolean {
  const textNode = definition.nodes.find((node) => node.id === textNodeId);
  const imageNode = definition.nodes.find((node) => node.id === imageNodeId);
  if (textNode?.type !== "text_input" || imageNode?.type !== "image_input") {
    return false;
  }

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

export function eligibleBboxTextTargets(
  definition: Pick<AigcPipelineDefinition, "edges" | "nodes">,
  imageNodeId: string
) {
  return definition.nodes.filter(
    (node): node is Extract<AigcNode, { type: "text_input" }> =>
      node.type === "text_input" &&
      isEligibleBboxTextTarget(definition, imageNodeId, node.id)
  );
}

export function sanitizeBboxReferences(
  definition: AigcPipelineDefinition
): AigcPipelineDefinition {
  const nodes = definition.nodes.map((node) => {
    if (node.type !== "text_input") return node;
    const references = bboxReferences(node);
    const nextReferences = references.filter((reference) => {
      const image = definition.nodes.find(
        (candidate) => candidate.id === reference.source_node_id
      );
      return (
        image?.type === "image_input" &&
        image.config.bbox != null &&
        image.config.bbox_asset_id === image.config.asset_id &&
        isEligibleBboxTextTarget(
          definition,
          reference.source_node_id,
          node.id
        )
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
  nodes: AigcNode[],
  edges: AigcEdge[]
): boolean {
  const source = nodes.find((node) => node.id === connection.sourceNodeId);
  if (
    source?.type !== "text_input" ||
    bboxReferences(source).length === 0
  ) {
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
