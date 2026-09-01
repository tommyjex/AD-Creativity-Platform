import { AIGC_NODE_REGISTRY_BY_TYPE } from "@/lib/aigc/node-registry";
import type {
  AigcEdge,
  AigcImageOperation,
  AigcNode,
  AigcPipelineDefinition,
  AigcPortDefinition
} from "@/lib/aigc/types";
import { layerDecompositionAssetError } from "@/lib/aigc/media-validation";
import type { Asset } from "@/lib/api-types";

type SeedreamImageNode = Extract<AigcNode, { type: "image_to_image" }>;
type SeedreamEditTarget = "image" | "layer" | null;

export interface AigcSeedreamValidationIssue {
  code:
    | "input_connection_limit_exceeded"
    | "input_not_allowed_for_mode"
    | "invalid_media_input"
    | "output_not_allowed_for_mode"
    | "required_input_missing"
    | "edit_target_conflict";
  message: string;
  nodeId: string;
}

const OPERATION_LABELS: Record<AigcImageOperation, string> = {
  image_to_image: "图生图",
  image_edit: "图片编辑",
  layer_decomposition: "图层拆分"
};

export function seedreamImageOperation(
  node: SeedreamImageNode
): AigcImageOperation {
  return node.config.operation ?? "image_to_image";
}

export function seedreamImageTitle(node: SeedreamImageNode): string {
  return OPERATION_LABELS[seedreamImageOperation(node)];
}

export function seedreamImageInputCount(
  edges: readonly AigcEdge[],
  nodeId: string,
  handleId: string
): number {
  return edges.filter(
    (edge) =>
      edge.targetNodeId === nodeId && edge.targetHandle === handleId
  ).length;
}

export function seedreamImageEditTarget(
  node: SeedreamImageNode,
  edges: readonly AigcEdge[]
): SeedreamEditTarget {
  if (seedreamImageOperation(node) !== "image_edit") return null;
  const imageCount = seedreamImageInputCount(edges, node.id, "edit_image");
  const layerCount = seedreamImageInputCount(edges, node.id, "edit_layer");
  if (imageCount > 0 && layerCount === 0) return "image";
  if (layerCount > 0 && imageCount === 0) return "layer";
  return null;
}

export function isSeedreamImageInputActive(
  node: SeedreamImageNode,
  portId: string,
  edges: readonly AigcEdge[]
): boolean {
  const operation = seedreamImageOperation(node);
  if (operation === "image_to_image") {
    return portId === "image" || portId === "prompt";
  }
  if (operation === "layer_decomposition") {
    return portId === "image" || portId === "prompt";
  }
  if (portId === "prompt") return true;
  if (portId !== "edit_image" && portId !== "edit_layer") return false;
  const imageCount = seedreamImageInputCount(edges, node.id, "edit_image");
  const layerCount = seedreamImageInputCount(edges, node.id, "edit_layer");
  if (imageCount > 0 && layerCount > 0) return false;
  const target = seedreamImageEditTarget(node, edges);
  return (
    target === null ||
    (target === "image" && portId === "edit_image") ||
    (target === "layer" && portId === "edit_layer")
  );
}

export function isSeedreamImageOutputActive(
  node: SeedreamImageNode,
  portId: string,
  edges: readonly AigcEdge[]
): boolean {
  const operation = seedreamImageOperation(node);
  if (operation === "image_to_image") return portId === "image";
  if (operation === "layer_decomposition") return portId === "layers";
  const target = seedreamImageEditTarget(node, edges);
  return (
    (target === "image" && portId === "image") ||
    (target === "layer" && portId === "edited_layer")
  );
}

export function seedreamImageInputLimit(
  node: SeedreamImageNode,
  port: AigcPortDefinition
): number {
  if (
    port.id === "image" &&
    seedreamImageOperation(node) === "layer_decomposition"
  ) {
    return 1;
  }
  return port.max_connections;
}

export function isSeedreamImageEdgeIncompatible(
  edge: AigcEdge,
  nodes: readonly AigcNode[],
  edges: readonly AigcEdge[]
): boolean {
  const source = nodes.find((node) => node.id === edge.sourceNodeId);
  if (
    source?.type === "image_to_image" &&
    !isSeedreamImageOutputActive(source, edge.sourceHandle, edges)
  ) {
    return true;
  }
  const target = nodes.find((node) => node.id === edge.targetNodeId);
  return Boolean(
    target?.type === "image_to_image" &&
      !isSeedreamImageInputActive(target, edge.targetHandle, edges)
  );
}

export function validateSeedreamImageDefinition(
  definition: Pick<AigcPipelineDefinition, "nodes" | "edges">
): AigcSeedreamValidationIssue[] {
  return definition.nodes.flatMap((node) =>
    node.type === "image_to_image"
      ? validateSeedreamImageNode(node, definition.edges)
      : []
  );
}

export function validateLayerDecompositionAssets(
  definition: Pick<AigcPipelineDefinition, "nodes" | "edges">,
  nodeId: string,
  assets: readonly Asset[]
): AigcSeedreamValidationIssue[] {
  const node = definition.nodes.find((candidate) => candidate.id === nodeId);
  if (
    node?.type !== "image_to_image" ||
    seedreamImageOperation(node) !== "layer_decomposition"
  ) {
    return [];
  }
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const connectedAssets = definition.edges
    .filter(
      (edge) =>
        edge.targetNodeId === nodeId &&
        edge.targetHandle === "image" &&
        edge.sourceHandle === "image"
    )
    .flatMap((edge) => {
      const source = definition.nodes.find(
        (candidate) => candidate.id === edge.sourceNodeId
      );
      if (source?.type !== "image_input" || !source.config.asset_id) return [];
      const asset = assetById.get(source.config.asset_id);
      return asset ? [asset] : [];
    });

  for (const asset of connectedAssets) {
    const message = layerDecompositionAssetError(asset);
    if (message) {
      return [{ code: "invalid_media_input", message, nodeId }];
    }
  }
  return [];
}

function validateSeedreamImageNode(
  node: SeedreamImageNode,
  edges: readonly AigcEdge[]
): AigcSeedreamValidationIssue[] {
  const registration = AIGC_NODE_REGISTRY_BY_TYPE.get("image_to_image");
  if (!registration) return [];
  const issue = (
    code: AigcSeedreamValidationIssue["code"],
    message: string
  ): AigcSeedreamValidationIssue => ({ code, message, nodeId: node.id });
  const counts = Object.fromEntries(
    registration.inputs.map((port) => [
      port.id,
      seedreamImageInputCount(edges, node.id, port.id)
    ])
  );

  if (counts.edit_image > 0 && counts.edit_layer > 0) {
    return [
      issue(
        "edit_target_conflict",
        "图片编辑只能连接编辑图片或编辑图层中的一个，请断开多余连线"
      )
    ];
  }

  for (const port of registration.inputs) {
    if (
      counts[port.id] > 0 &&
      !isSeedreamImageInputActive(node, port.id, edges)
    ) {
      return [
        issue(
          "input_not_allowed_for_mode",
          `${port.label}输入不适用于${seedreamImageTitle(node)}模式，请断开对应连线`
        )
      ];
    }
    const limit = seedreamImageInputLimit(node, port);
    if (counts[port.id] > limit) {
      return [
        issue(
          "input_connection_limit_exceeded",
          `${port.label}输入最多连接 ${limit} 个，当前为 ${counts[port.id]} 个`
        )
      ];
    }
  }

  const incompatibleOutput = edges.find(
    (edge) =>
      edge.sourceNodeId === node.id &&
      !isSeedreamImageOutputActive(node, edge.sourceHandle, edges)
  );
  if (incompatibleOutput) {
    const port = registration.outputs.find(
      (candidate) => candidate.id === incompatibleOutput.sourceHandle
    );
    return [
      issue(
        "output_not_allowed_for_mode",
        `${port?.label ?? incompatibleOutput.sourceHandle}输出不适用于当前编辑目标或模式，请断开对应连线`
      )
    ];
  }

  const operation = seedreamImageOperation(node);
  if (operation === "image_to_image") {
    if (counts.image === 0) {
      return [issue("required_input_missing", "图生图模式必须连接至少一张图片")];
    }
    if (counts.prompt === 0) {
      return [issue("required_input_missing", "图生图模式必须连接提示词")];
    }
    return [];
  }
  if (operation === "layer_decomposition") {
    return counts.image === 0
      ? [issue("required_input_missing", "图层拆分模式必须连接一张图片")]
      : [];
  }
  if (counts.edit_image + counts.edit_layer === 0) {
    return [
      issue(
        "required_input_missing",
        "图片编辑模式必须连接一张编辑图片或一个编辑图层"
      )
    ];
  }
  if (counts.prompt === 0) {
    return [issue("required_input_missing", "图片编辑模式必须连接提示词")];
  }

  return [];
}
