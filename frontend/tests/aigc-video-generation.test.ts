import { describe, expect, it } from "vitest";
import {
  isVideoEdgeIncompatible,
  validateVideoGenerationDefinition
} from "@/lib/aigc/video-generation";
import type {
  AigcEdge,
  AigcNode,
  AigcPipelineDefinition,
  AigcVideoGenerationMode
} from "@/lib/aigc/types";
import type { SeedanceModel } from "@/lib/seedance";

function videoNode(
  mode: AigcVideoGenerationMode,
  model: SeedanceModel = "doubao-seedance-2-5-260628"
): Extract<AigcNode, { type: "video_generation" }> {
  return {
    id: "video-model",
    type: "video_generation",
    position: { x: 320, y: 0 },
    size: { width: 240, height: 180 },
    config: {
      aspect_ratio: "adaptive",
      duration_seconds: -1,
      generate_audio: true,
      generation_mode: mode,
      model,
      resolution: "720p"
    }
  };
}

function sourceNode(
  id: string,
  type: "text_input" | "image_input" | "video_input" | "audio_input"
): AigcNode {
  const common = {
    id,
    position: { x: 0, y: 0 },
    size: { width: 240, height: 160 }
  };
  if (type === "text_input") {
    return { ...common, type, config: { text: "生成一段广告视频" } };
  }
  return { ...common, type, config: { asset_id: `${id}-asset` } };
}

function definition(
  mode: AigcVideoGenerationMode,
  handles: string[],
  model?: SeedanceModel
): AigcPipelineDefinition {
  const target = videoNode(mode, model);
  const nodes: AigcNode[] = [target];
  const edges: AigcEdge[] = handles.map((handle, index) => {
    const type = handle === "prompt"
      ? "text_input"
      : handle === "reference_videos"
        ? "video_input"
        : handle === "reference_audios"
          ? "audio_input"
          : "image_input";
    const source = sourceNode(`${handle}-${index}`, type);
    nodes.push(source);
    return {
      id: `edge-${index}`,
      sourceNodeId: source.id,
      sourceHandle:
        type === "text_input"
          ? "text"
          : type === "image_input"
            ? "image"
            : type === "video_input"
              ? "video"
              : "audio",
      targetNodeId: target.id,
      targetHandle: handle
    };
  });
  return {
    schemaVersion: 1,
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 }
  };
}

describe("AIGC video generation validation", () => {
  it.each([
    ["text_to_video", ["prompt"]],
    ["first_frame", ["first_frame"]],
    ["first_last_frame", ["first_frame", "last_frame"]],
    [
      "multimodal_reference",
      ["reference_images", "reference_videos", "reference_audios"]
    ]
  ] as const)("accepts %s mode inputs", (mode, handles) => {
    expect(
      validateVideoGenerationDefinition(definition(mode, [...handles]))
    ).toEqual([]);
  });

  it("keeps switched-mode edges and reports them as incompatible", () => {
    const current = definition("first_frame", ["first_frame"]);
    const switchedNode = videoNode("text_to_video");
    current.nodes = [
      switchedNode,
      ...current.nodes.filter((node) => node.id !== switchedNode.id)
    ];

    expect(isVideoEdgeIncompatible(current.edges[0], current.nodes)).toBe(true);
    expect(validateVideoGenerationDefinition(current)[0]).toMatchObject({
      code: "input_not_allowed_for_mode",
      nodeId: "video-model"
    });
    expect(current.edges).toHaveLength(1);
  });

  it("uses model-specific reference limits", () => {
    const seedance25 = definition(
      "multimodal_reference",
      Array.from({ length: 30 }, () => "reference_images")
    );
    expect(validateVideoGenerationDefinition(seedance25)).toEqual([]);

    const seedance20 = definition(
      "multimodal_reference",
      Array.from({ length: 10 }, () => "reference_images"),
      "doubao-seedance-2-0-260128"
    );
    expect(validateVideoGenerationDefinition(seedance20)[0]).toMatchObject({
      code: "input_connection_limit_exceeded",
      message: expect.stringContaining("最多连接 9 个素材")
    });
  });

  it("allows audio-only input for 2.5 and rejects it for 2.0 models", () => {
    expect(
      validateVideoGenerationDefinition(
        definition("multimodal_reference", ["reference_audios"])
      )
    ).toEqual([]);
    expect(
      validateVideoGenerationDefinition(
        definition(
          "multimodal_reference",
          ["reference_audios"],
          "doubao-seedance-2-0-fast-260128"
        )
      )[0]
    ).toMatchObject({ code: "audio_only_not_supported" });
  });
});
