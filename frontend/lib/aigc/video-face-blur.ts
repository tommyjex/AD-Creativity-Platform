import type {
  AigcPipelineDefinition,
  AigcPipelineDefinitionV2,
  AigcVideoFaceBlurMaskMode,
  AigcVideoFaceBlurMaskStrength,
  VideoFaceBlurConfig
} from "@/lib/aigc/types";

export const VIDEO_FACE_BLUR_MASK_MODES = [
  "mosaic",
  "blur"
] as const satisfies readonly AigcVideoFaceBlurMaskMode[];

export const VIDEO_FACE_BLUR_MASK_STRENGTHS = [
  "low",
  "medium",
  "high"
] as const satisfies readonly AigcVideoFaceBlurMaskStrength[];

export const AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG: VideoFaceBlurConfig = {
  mask_mode: "mosaic",
  mask_strength: "medium"
};

export function videoFaceBlurModeLabel(
  value: AigcVideoFaceBlurMaskMode
): string {
  return value === "mosaic" ? "马赛克" : "高斯模糊";
}

export function videoFaceBlurStrengthLabel(
  value: AigcVideoFaceBlurMaskStrength
): string {
  return {
    low: "低强度",
    medium: "中等强度",
    high: "高强度"
  }[value];
}

export interface VideoFaceBlurValidationIssue {
  code: "invalid_mask_mode" | "invalid_mask_strength";
  message: string;
  nodeId: string;
}

export function validateVideoFaceBlurConfig(
  config: unknown
): VideoFaceBlurValidationIssue["code"][] {
  if (!config || typeof config !== "object") {
    return ["invalid_mask_mode", "invalid_mask_strength"];
  }
  const candidate = config as Record<string, unknown>;
  const issues: VideoFaceBlurValidationIssue["code"][] = [];
  if (
    !VIDEO_FACE_BLUR_MASK_MODES.includes(
      candidate.mask_mode as AigcVideoFaceBlurMaskMode
    )
  ) {
    issues.push("invalid_mask_mode");
  }
  if (
    !VIDEO_FACE_BLUR_MASK_STRENGTHS.includes(
      candidate.mask_strength as AigcVideoFaceBlurMaskStrength
    )
  ) {
    issues.push("invalid_mask_strength");
  }
  return issues;
}

export function validateVideoFaceBlurDefinition(
  definition: AigcPipelineDefinition | AigcPipelineDefinitionV2
): VideoFaceBlurValidationIssue[] {
  return definition.nodes.flatMap((node) => {
    if (node.type !== "video_face_blur") return [];
    return validateVideoFaceBlurConfig(node.config).map((code) => ({
      code,
      message:
        code === "invalid_mask_mode"
          ? "打码方式无效"
          : "打码强度无效",
      nodeId: node.id
    }));
  });
}
