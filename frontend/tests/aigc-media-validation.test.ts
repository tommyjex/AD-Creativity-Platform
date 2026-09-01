import { describe, expect, it } from "vitest";
import {
  aigcMediaCompatibility,
  layerDecompositionAssetError,
  layerDecompositionCompatibility,
  validateLayerDecompositionFile,
  validateAigcMediaFile
} from "@/lib/aigc/media-validation";
import {
  seedancePromptLengthWarning,
  validateVideoGenerationAssets,
  validateVideoGenerationDefinition
} from "@/lib/aigc/video-generation";
import type { AigcPipelineDefinition } from "@/lib/aigc/types";
import type { Asset } from "@/lib/api-types";

function file(name: string, type: string, size: number) {
  return { name, size, type };
}

function asset(
  id: string,
  type: Asset["type"],
  mimeType: string,
  metadata: Asset["metadata"],
  sizeBytes = 1024
): Asset {
  return {
    id,
    project_id: null,
    tool_asset_role: "input",
    type,
    category: null,
    status: "succeeded",
    stage: null,
    url: `/api/assets/${id}/content`,
    object_key: `${id}.bin`,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    source_task_id: null,
    metadata,
    created_at: "2026-08-30T00:00:00Z",
    updated_at: "2026-08-30T00:00:00Z"
  };
}

describe("AIGC media validation", () => {
  it("preflights formats and exact size boundaries", () => {
    expect(validateAigcMediaFile("image", file("still.heic", "image/heic", 1)))
      .toBeNull();
    expect(validateAigcMediaFile("video", file("clip.mov", "video/quicktime", 1)))
      .toBeNull();
    expect(validateAigcMediaFile("audio", file("voice.wav", "audio/wav", 1)))
      .toBeNull();
    expect(validateAigcMediaFile("video", file("clip.webm", "video/webm", 1)))
      .toBe("视频格式不支持");
    expect(
      validateAigcMediaFile(
        "image",
        file("still.png", "image/png", 30 * 1024 * 1024)
      )
    ).toBe("图片大小必须小于 30 MB");
    expect(
      validateAigcMediaFile(
        "audio",
        file("voice.mp3", "audio/mpeg", 15 * 1024 * 1024)
      )
    ).toBeNull();
  });

  it("labels inspected, pending and incompatible library assets", () => {
    expect(
      aigcMediaCompatibility(
        asset("image", "uploaded_image", "image/png", {
          inspection_version: 1,
          width: 1024,
          height: 1024
        }),
        "image"
      )
    ).toEqual({ state: "available", message: "规格可用" });
    expect(
      aigcMediaCompatibility(
        asset("legacy", "uploaded_video", "video/mp4", {}),
        "video"
      )
    ).toEqual({ state: "pending", message: "执行前检测" });
    expect(
      aigcMediaCompatibility(
        asset("bad", "uploaded_video", "video/mp4", {
          inspection_version: 1,
          width: 1280,
          height: 720,
          fps: 12
        }),
        "video"
      )
    ).toEqual({ state: "incompatible", message: "视频帧率需为 24-60 FPS" });
  });

  it("uses dedicated layer decomposition format, size, ratio, and pixel limits", () => {
    expect(
      validateLayerDecompositionFile(
        file("layer.webp", "image/webp", 1024)
      )
    ).toBe("图层拆分仅支持 PNG/JPEG 图片");
    expect(
      validateLayerDecompositionFile(
        file("layer.png", "image/png", 30 * 1024 * 1024)
      )
    ).toBe("图层拆分图片大小必须小于 30 MB");
    expect(
      layerDecompositionAssetError(
        asset("minimum", "uploaded_image", "image/png", {
          inspection_version: 1,
          width: 512,
          height: 512
        })
      )
    ).toBeNull();
    expect(
      layerDecompositionAssetError(
        asset("maximum", "uploaded_image", "image/jpeg", {
          inspection_version: 1,
          width: 6000,
          height: 6000
        })
      )
    ).toBeNull();
    expect(
      layerDecompositionAssetError(
        asset("ratio", "uploaded_image", "image/png", {
          inspection_version: 1,
          width: 8200,
          height: 512
        })
      )
    ).toBe("图层拆分图片宽高比需为 1:16-16:1");
    expect(
      layerDecompositionAssetError(
        asset("pixels", "uploaded_image", "image/png", {
          inspection_version: 1,
          width: 511,
          height: 511
        })
      )
    ).toBe("图层拆分图片总像素需为 262,144-36,000,000");
    expect(
      layerDecompositionCompatibility(
        asset("legacy", "uploaded_image", "image/png", {})
      )
    ).toEqual({ state: "pending", message: "执行前检测" });
  });

  it("warns rather than rejects long Chinese or English prompts", () => {
    expect(seedancePromptLengthWarning("中".repeat(501))).toContain("500");
    expect(
      seedancePromptLengthWarning(Array.from({ length: 1001 }, () => "word").join(" "))
    ).toContain("1000");
    expect(seedancePromptLengthWarning("产品特写 with concise motion")).toBeNull();
  });

  it("requires video for edit and validates inspected aggregate duration", () => {
    const definition: AigcPipelineDefinition = {
      schemaVersion: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: "video-input",
          type: "video_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 180 },
          config: { asset_id: "video-asset" }
        },
        {
          id: "video-model",
          type: "video_generation",
          position: { x: 300, y: 0 },
          size: { width: 280, height: 200 },
          config: {
            model: "doubao-seedance-2-5-260628",
            generation_mode: "multimodal_reference",
            task_type: "edit",
            resolution: "720p",
            aspect_ratio: "adaptive",
            duration_seconds: -1,
            generate_audio: true
          }
        }
      ],
      edges: []
    };

    expect(validateVideoGenerationDefinition(definition)[0]?.code)
      .toBe("reference_input_required");
    definition.edges.push({
      id: "video-edge",
      sourceNodeId: "video-input",
      sourceHandle: "video",
      targetNodeId: "video-model",
      targetHandle: "reference_videos"
    });
    expect(validateVideoGenerationDefinition(definition)).toEqual([]);
    expect(
      validateVideoGenerationAssets(definition, "video-model", [
        asset("video-asset", "uploaded_video", "video/mp4", {
          inspection_version: 1,
          duration_seconds: 3,
          width: 1280,
          height: 720,
          fps: 30
        })
      ])[0]
    ).toMatchObject({
      code: "invalid_media_input",
      message: "参考视频时长需为 4-30 秒"
    });
  });
});
