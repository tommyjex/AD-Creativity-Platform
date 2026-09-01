import { AIGC_NODE_REGISTRY_BY_TYPE } from "@/lib/aigc/node-registry";
import type {
  AigcEdge,
  AigcNode,
  AigcPipelineDefinition,
  AigcPortDefinition,
  AigcVideoGenerationMode
} from "@/lib/aigc/types";
import type { Asset } from "@/lib/api-types";
import {
  SEEDANCE_ASPECT_RATIOS,
  SEEDANCE_CAPABILITIES,
  SEEDANCE_DEFAULT_MODEL,
  isSeedanceDurationValid,
  seedanceInputDurationLimit,
  seedanceVideoInputMinimum
} from "@/lib/seedance";

type VideoGenerationNode = Extract<AigcNode, { type: "video_generation" }>;

export interface AigcVideoValidationIssue {
  code:
    | "audio_only_not_supported"
    | "input_connection_limit_exceeded"
    | "input_not_allowed_for_mode"
    | "invalid_aspect_ratio"
    | "invalid_duration"
    | "invalid_resolution"
    | "invalid_media_input"
    | "reference_input_required"
    | "required_input_missing"
    | "reference_video_required";
  message: string;
  nodeId: string;
}

export function isVideoPortActive(
  port: AigcPortDefinition,
  mode: AigcVideoGenerationMode
): boolean {
  return port.modes.length === 0 || port.modes.includes(mode);
}

export function videoInputLimit(
  node: VideoGenerationNode,
  port: AigcPortDefinition
): number {
  const capabilities = SEEDANCE_CAPABILITIES[node.config.model];
  if (port.id === "reference_images") {
    return capabilities.maxReferenceImages;
  }
  if (port.id === "reference_videos") {
    return capabilities.maxReferenceVideos;
  }
  if (port.id === "reference_audios") {
    return capabilities.maxReferenceAudios;
  }
  return port.max_connections;
}

export function videoInputCount(
  edges: readonly AigcEdge[],
  nodeId: string,
  handleId: string
): number {
  return edges.filter(
    (edge) =>
      edge.targetNodeId === nodeId && edge.targetHandle === handleId
  ).length;
}

export function isVideoEdgeIncompatible(
  edge: AigcEdge,
  nodes: readonly AigcNode[]
): boolean {
  const target = nodes.find((node) => node.id === edge.targetNodeId);
  if (target?.type !== "video_generation") return false;
  const port = AIGC_NODE_REGISTRY_BY_TYPE.get(target.type)?.inputs.find(
    (candidate) => candidate.id === edge.targetHandle
  );
  return Boolean(
    port && !isVideoPortActive(port, target.config.generation_mode)
  );
}

export function validateVideoGenerationDefinition(
  definition: Pick<AigcPipelineDefinition, "nodes" | "edges">
): AigcVideoValidationIssue[] {
  return definition.nodes.flatMap((node) =>
    node.type === "video_generation"
      ? validateVideoGenerationNode(node, definition.edges)
      : []
  );
}

export function validateVideoGenerationAssets(
  definition: Pick<AigcPipelineDefinition, "nodes" | "edges">,
  nodeId: string,
  assets: readonly Asset[]
): AigcVideoValidationIssue[] {
  const node = definition.nodes.find((candidate) => candidate.id === nodeId);
  if (node?.type !== "video_generation") return [];
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const connected = (handle: string) =>
    definition.edges
      .filter(
        (edge) =>
          edge.targetNodeId === nodeId && edge.targetHandle === handle
      )
      .map((edge) =>
        definition.nodes.find(
          (candidate) => candidate.id === edge.sourceNodeId
        )
      )
      .flatMap((source) =>
        source &&
        (source.type === "video_input" ||
          source.type === "audio_input" ||
          source.type === "image_input") &&
        source.config.asset_id
          ? [assetById.get(source.config.asset_id)]
          : []
      )
      .filter((asset): asset is Asset => Boolean(asset));
  const maximum = seedanceInputDurationLimit(node.config.model);
  const videoMinimum = seedanceVideoInputMinimum(
    node.config.model,
    node.config.task_type ?? "generate"
  );
  const videos = connected("reference_videos");
  const audios = connected("reference_audios");
  for (const [label, items, minimum] of [
    ["参考视频", videos, videoMinimum],
    ["参考音频", audios, 2]
  ] as const) {
    const inspected = items.filter(
      (asset) => asset.metadata.inspection_version === 1
    );
    for (const asset of inspected) {
      const duration = metadataNumber(asset, "duration_seconds");
      if (duration === null || duration < minimum || duration > maximum) {
        return [{
          code: "invalid_media_input",
          message: `${label}时长需为 ${minimum}-${maximum} 秒`,
          nodeId
        }];
      }
    }
    const total = inspected.reduce(
      (sum, asset) => sum + (metadataNumber(asset, "duration_seconds") ?? 0),
      0
    );
    if (total > maximum) {
      return [{
        code: "invalid_media_input",
        message: `${label}总时长 ${formatSeconds(total)}，不能超过 ${maximum} 秒`,
        nodeId
      }];
    }
  }
  return [];
}

function validateVideoGenerationNode(
  node: VideoGenerationNode,
  edges: readonly AigcEdge[]
): AigcVideoValidationIssue[] {
  const registration = AIGC_NODE_REGISTRY_BY_TYPE.get("video_generation");
  if (!registration) return [];
  const counts = Object.fromEntries(
    registration.inputs.map((port) => [
      port.id,
      videoInputCount(edges, node.id, port.id)
    ])
  );
  const issue = (
    code: AigcVideoValidationIssue["code"],
    message: string
  ): AigcVideoValidationIssue => ({ code, message, nodeId: node.id });

  for (const port of registration.inputs) {
    if (
      counts[port.id] > 0 &&
      !isVideoPortActive(port, node.config.generation_mode)
    ) {
      return [
        issue(
          "input_not_allowed_for_mode",
          `${port.label}不适用于当前生成模式，请断开对应连线`
        )
      ];
    }
    const limit = videoInputLimit(node, port);
    if (counts[port.id] > limit) {
      return [
        issue(
          "input_connection_limit_exceeded",
          `${port.label}最多连接 ${limit} 个素材，当前为 ${counts[port.id]} 个`
        )
      ];
    }
  }

  const capabilities = SEEDANCE_CAPABILITIES[node.config.model];
  if (
    !(capabilities.resolutions as readonly string[]).includes(
      node.config.resolution
    )
  ) {
    return [issue("invalid_resolution", "当前模型不支持所选分辨率")];
  }
  if (!isSeedanceDurationValid(node.config.model, node.config.duration_seconds)) {
    return [issue("invalid_duration", "当前模型不支持所选视频时长")];
  }
  if (
    !(SEEDANCE_ASPECT_RATIOS as readonly string[]).includes(
      node.config.aspect_ratio
    )
  ) {
    return [issue("invalid_aspect_ratio", "宽高比配置无效")];
  }

  if (
    node.config.generation_mode === "text_to_video" &&
    counts.prompt === 0
  ) {
    return [issue("required_input_missing", "文生视频模式必须连接提示词")];
  }
  if (
    (node.config.generation_mode === "first_frame" ||
      node.config.generation_mode === "first_last_frame") &&
    counts.first_frame === 0
  ) {
    return [issue("required_input_missing", "当前模式必须连接首帧图片")];
  }
  if (
    node.config.generation_mode === "first_last_frame" &&
    counts.last_frame === 0
  ) {
    return [issue("required_input_missing", "首尾帧模式必须连接尾帧图片")];
  }
  if (node.config.generation_mode === "multimodal_reference") {
    const referenceCount =
      counts.reference_images +
      counts.reference_videos +
      counts.reference_audios;
    if (counts.prompt + referenceCount === 0) {
      return [
        issue(
          "reference_input_required",
          "全模态参考模式至少需要提示词或一种参考素材"
        )
      ];
    }
    if (
      node.config.model !== SEEDANCE_DEFAULT_MODEL &&
      counts.reference_audios > 0 &&
      counts.reference_images + counts.reference_videos === 0
    ) {
      return [
        issue(
          "audio_only_not_supported",
          "Seedance 2.0 系列仅有音频时，还需连接参考图片或参考视频"
        )
      ];
    }
    if (
      ((node.config.task_type ?? "generate") === "edit" ||
        (node.config.task_type ?? "generate") === "extend") &&
      counts.reference_videos === 0
    ) {
      return [
        issue(
          "reference_video_required",
          `${node.config.task_type === "edit" ? "编辑" : "延长"}任务必须连接参考视频`
        )
      ];
    }
  }
  return [];
}

export function seedancePromptLengthWarning(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const chineseCharacters = [...trimmed].filter((character) =>
    /[\u3400-\u9fff]/u.test(character)
  ).length;
  if (chineseCharacters > 500) {
    return `中文提示词约 ${chineseCharacters} 字，建议不超过 500 字`;
  }
  const englishWords = trimmed
    .replace(/[\u3400-\u9fff]/gu, " ")
    .match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0;
  return englishWords > 1000
    ? `英文提示词约 ${englishWords} 词，建议不超过 1000 词`
    : null;
}

function metadataNumber(asset: Asset, key: string): number | null {
  const value = asset.metadata[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function formatSeconds(value: number): string {
  return `${Math.round(value * 10) / 10} 秒`;
}
