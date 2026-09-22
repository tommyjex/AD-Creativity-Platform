import { AIGC_NODE_REGISTRY_BY_TYPE } from "@/lib/aigc/node-registry";
import type { AigcPortType, AigcV2Node } from "@/lib/aigc/types";

export type WorkspacePreviewTone =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "neutral";

export type WorkspacePreviewPoint = {
  id: string;
  node: AigcV2Node;
  x: number;
  y: number;
};

const TONE_BY_PORT_TYPE: Partial<Record<AigcPortType, WorkspacePreviewTone>> = {
  audio_asset: "audio",
  edited_layer: "image",
  image_asset: "image",
  image_layer: "image",
  layer_set: "image",
  subtitle_asset: "video",
  text: "text",
  video_asset: "video"
};

export function getWorkspacePreviewNodeTone(
  node: AigcV2Node
): WorkspacePreviewTone {
  const outputType = AIGC_NODE_REGISTRY_BY_TYPE.get(node.type)?.outputs[0]?.type;
  return outputType ? (TONE_BY_PORT_TYPE[outputType] ?? "neutral") : "neutral";
}

export function countWorkspacePreviewModels(nodes: AigcV2Node[]): number {
  return nodes.filter(
    (node) => AIGC_NODE_REGISTRY_BY_TYPE.get(node.type)?.category === "model"
  ).length;
}

export function normalizeWorkspaceTopology(
  nodes: AigcV2Node[]
): WorkspacePreviewPoint[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) {
    return [{ id: nodes[0].id, node: nodes[0], x: 50, y: 50 }];
  }

  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(Math.max(...xs) - minX, 1);
  const height = Math.max(Math.max(...ys) - minY, 1);

  return nodes.map((node) => ({
    id: node.id,
    node,
    x: 12 + ((node.position.x - minX) / width) * 76,
    y: 16 + ((node.position.y - minY) / height) * 68
  }));
}
