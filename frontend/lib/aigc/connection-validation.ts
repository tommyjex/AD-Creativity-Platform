import { connectionBreaksBboxReferences } from "@/lib/aigc/bbox-references";
import { AIGC_NODE_REGISTRY_BY_TYPE } from "@/lib/aigc/node-registry";
import {
  isSeedreamImageInputActive,
  isSeedreamImageOutputActive,
  seedreamImageInputLimit,
  seedreamImageTitle
} from "@/lib/aigc/seedream-image";
import {
  isVideoPortActive,
  videoInputLimit
} from "@/lib/aigc/video-generation";
import type {
  AigcEdge,
  AigcV2Node
} from "@/lib/aigc/types";

export type AigcConnectionNode = AigcV2Node;

export interface AigcConnectionCandidate {
  source: string | null | undefined;
  sourceHandle?: string | null;
  target: string | null | undefined;
  targetHandle?: string | null;
}

export type AigcConnectionValidationError =
  | "bbox_reference_conflict"
  | "cycle"
  | "duplicate_edge"
  | "input_not_allowed_for_mode"
  | "invalid_connection"
  | "output_not_allowed_for_mode"
  | "port_type_mismatch"
  | "system_only_output"
  | "target_connection_limit";

export function isValidAigcConnection(
  connection: AigcConnectionCandidate,
  nodes: readonly AigcConnectionNode[],
  edges: readonly AigcEdge[]
): boolean {
  return getAigcConnectionValidationError(connection, nodes, edges) === null;
}

export function getAigcConnectionValidationError(
  connection: AigcConnectionCandidate,
  nodes: readonly AigcConnectionNode[],
  edges: readonly AigcEdge[]
): AigcConnectionValidationError | null {
  const { source, sourceHandle, target, targetHandle } = connection;
  if (!source || !target || !sourceHandle || !targetHandle || source === target) {
    return "invalid_connection";
  }
  if (
    edges.some(
      (edge) =>
        edge.sourceNodeId === source &&
        edge.sourceHandle === sourceHandle &&
        edge.targetNodeId === target &&
        edge.targetHandle === targetHandle
    )
  ) {
    return "duplicate_edge";
  }

  const sourceNode = nodes.find((node) => node.id === source);
  const targetNode = nodes.find((node) => node.id === target);
  if (!sourceNode || !targetNode) return "invalid_connection";

  const sourcePort = AIGC_NODE_REGISTRY_BY_TYPE.get(sourceNode.type)?.outputs.find(
    (port) => port.id === sourceHandle
  );
  const targetPort = AIGC_NODE_REGISTRY_BY_TYPE.get(targetNode.type)?.inputs.find(
    (port) => port.id === targetHandle
  );
  if (!sourcePort || !targetPort || sourcePort.type !== targetPort.type) {
    return "port_type_mismatch";
  }
  if (sourcePort.system_only) {
    return "system_only_output";
  }
  if (
    targetNode.type === "video_generation" &&
    !isVideoPortActive(targetPort, targetNode.config.generation_mode)
  ) {
    return "input_not_allowed_for_mode";
  }
  if (
    targetNode.type === "image_to_image" &&
    !isSeedreamImageInputActive(targetNode, targetPort.id, edges)
  ) {
    return "input_not_allowed_for_mode";
  }
  if (
    sourceNode.type === "image_to_image" &&
    !isSeedreamImageOutputActive(sourceNode, sourcePort.id, edges)
  ) {
    return "output_not_allowed_for_mode";
  }
  if (wouldCreateCycle(source, target, edges)) {
    return "cycle";
  }
  if (
    connectionBreaksBboxReferences(
      {
        sourceNodeId: source,
        sourceHandle,
        targetNodeId: target,
        targetHandle
      },
      [...nodes],
      [...edges]
    )
  ) {
    return "bbox_reference_conflict";
  }

  const connectionCount = edges.filter(
    (edge) =>
      edge.targetNodeId === target && edge.targetHandle === targetHandle
  ).length;
  const maxConnections =
    targetNode.type === "video_generation"
      ? videoInputLimit(targetNode, targetPort)
      : targetNode.type === "image_to_image"
        ? seedreamImageInputLimit(targetNode, targetPort)
        : targetPort.max_connections;
  return connectionCount >= maxConnections
    ? "target_connection_limit"
    : null;
}

export function connectionValidationFeedback(
  validationError: AigcConnectionValidationError,
  connection: Pick<AigcConnectionCandidate, "target" | "targetHandle">,
  nodes: readonly AigcConnectionNode[]
): string {
  const target = nodes.find((node) => node.id === connection.target);
  if (
    validationError === "target_connection_limit" &&
    target?.type === "image_to_image" &&
    connection.targetHandle === "image"
  ) {
    const registration = AIGC_NODE_REGISTRY_BY_TYPE.get(target.type);
    const port = registration?.inputs.find(
      (candidate) => candidate.id === connection.targetHandle
    );
    const limit = port ? seedreamImageInputLimit(target, port) : 1;
    return (target.config.operation ?? "image_to_image") === "image_to_image"
      ? `图生图节点最多支持 ${limit} 张参考图`
      : `${seedreamImageTitle(target)}节点最多支持 ${limit} 张图片`;
  }
  if (
    validationError === "target_connection_limit" &&
    target?.type === "video_generation"
  ) {
    const port = AIGC_NODE_REGISTRY_BY_TYPE.get(target.type)?.inputs.find(
      (candidate) => candidate.id === connection.targetHandle
    );
    if (port) {
      return `${port.label}最多支持 ${videoInputLimit(target, port)} 个连接`;
    }
  }
  if (
    validationError === "input_not_allowed_for_mode" &&
    target?.type === "video_generation"
  ) {
    const port = AIGC_NODE_REGISTRY_BY_TYPE.get(target.type)?.inputs.find(
      (candidate) => candidate.id === connection.targetHandle
    );
    return `${port?.label ?? "该输入"}不适用于当前生成模式`;
  }
  if (
    validationError === "input_not_allowed_for_mode" &&
    target?.type === "image_to_image"
  ) {
    const port = AIGC_NODE_REGISTRY_BY_TYPE.get(target.type)?.inputs.find(
      (candidate) => candidate.id === connection.targetHandle
    );
    return `${port?.label ?? "该输入"}不适用于${seedreamImageTitle(target)}模式`;
  }
  if (validationError === "output_not_allowed_for_mode") {
    return "该输出不适用于当前 Seedream 模式或编辑目标";
  }
  if (validationError === "system_only_output") {
    return "JSON 解析器的 items 输出由系统自动管理，不能手工连接。";
  }
  if (validationError === "duplicate_edge") return "该连线已存在。";
  if (validationError === "cycle") return "连线会形成环路。";
  if (validationError === "bbox_reference_conflict") {
    return "该文本节点含框选引用，只能连接到同时接收对应图片的图生图节点。";
  }
  return "端口类型不匹配，或目标端口已有输入。";
}

function wouldCreateCycle(
  sourceNodeId: string,
  targetNodeId: string,
  edges: readonly AigcEdge[]
): boolean {
  const downstream = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = downstream.get(edge.sourceNodeId) ?? [];
    targets.push(edge.targetNodeId);
    downstream.set(edge.sourceNodeId, targets);
  }

  const pending = [targetNodeId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const nodeId = pending.pop()!;
    if (nodeId === sourceNodeId) return true;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    pending.push(...(downstream.get(nodeId) ?? []));
  }
  return false;
}
