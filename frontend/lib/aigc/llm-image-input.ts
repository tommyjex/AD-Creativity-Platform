import {
  aigcNodeBaseDisplayName,
  deriveAigcNodeDisplayNames
} from "@/lib/aigc/node-display-name";
import type {
  AigcPipelineDefinitionV2,
  AigcPipelineRunDetail
} from "@/lib/aigc/types";

export type AigcLlmImageInputState =
  | "disconnected"
  | "waiting"
  | "ready"
  | "unavailable";

export interface AigcLlmImageInput {
  sourceLabel: string | null;
  state: AigcLlmImageInputState;
  statusLabel: string;
}

export function resolveAigcLlmImageInput(
  definition: AigcPipelineDefinitionV2,
  llmNodeId: string,
  runDetail?: AigcPipelineRunDetail | null
): AigcLlmImageInput {
  const edge = definition.edges.find(
    (candidate) =>
      candidate.targetNodeId === llmNodeId &&
      candidate.targetHandle === "image"
  );
  if (!edge) {
    return {
      sourceLabel: null,
      state: "disconnected",
      statusLabel: "未连接，按纯文本执行"
    };
  }

  const source = definition.nodes.find((node) => node.id === edge.sourceNodeId);
  if (!source) {
    return {
      sourceLabel: "图片来源",
      state: "unavailable",
      statusLabel: "图片来源不可用"
    };
  }

  const sourceLabel =
    source.custom_name?.trim() ??
    deriveAigcNodeDisplayNames(definition.nodes).get(source.id)?.displayName ??
    aigcNodeBaseDisplayName(source);
  const sourceRunNode = runDetail?.nodes.find(
    (node) => node.node_id === source.id
  );
  if (!sourceRunNode) {
    return {
      sourceLabel,
      state: "waiting",
      statusLabel: "已连接，等待图片来源"
    };
  }
  if (
    ["blocked", "canceled", "failed", "timed_out"].includes(
      sourceRunNode.status
    )
  ) {
    return {
      sourceLabel,
      state: "unavailable",
      statusLabel: "图片来源运行失败"
    };
  }
  if (["idle", "ready", "queued", "running"].includes(sourceRunNode.status)) {
    return {
      sourceLabel,
      state: "waiting",
      statusLabel: "已连接，等待图片来源"
    };
  }

  const imageAsset = sourceRunNode.result.assets.find((asset) =>
    asset.mime_type?.startsWith("image/")
  );
  if (!imageAsset?.available) {
    return {
      sourceLabel,
      state: "unavailable",
      statusLabel: "图片来源不可用"
    };
  }
  return {
    sourceLabel,
    state: "ready",
    statusLabel: "图片已就绪"
  };
}
