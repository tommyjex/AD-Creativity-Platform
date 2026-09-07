import { describe, expect, it } from "vitest";
import {
  getAigcConnectionValidationError,
  isValidAigcConnection
} from "@/components/workspace/aigc/aigc-editor";
import { createAigcEditorStore } from "@/lib/aigc/editor-store";
import {
  AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG,
  AIGC_NODE_REGISTRY,
  isAigcExecutionNodeType
} from "@/lib/aigc/node-registry";
import type {
  AigcPipelineDefinition,
  AigcPipelineDefinitionV2,
  AigcV2Node,
  VideoFaceBlurConfig
} from "@/lib/aigc/types";
import {
  VIDEO_FACE_BLUR_MASK_MODES,
  VIDEO_FACE_BLUR_MASK_STRENGTHS,
  validateVideoFaceBlurConfig,
  validateVideoFaceBlurDefinition
} from "@/lib/aigc/video-face-blur";

function mediaNode(
  id: string,
  type: "image" | "video",
  assetId: string
): AigcV2Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    size: { width: 240, height: 160 },
    config:
      type === "image"
        ? {
            asset_id: assetId,
            bbox: null,
            bbox_asset_id: null,
            title: null
          }
        : { asset_id: assetId, title: null }
  } as AigcV2Node;
}

function faceBlurNode(id = "face-blur"): AigcV2Node {
  return {
    id,
    type: "video_face_blur",
    position: { x: 300, y: 0 },
    size: { width: 240, height: 160 },
    config: structuredClone(AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG)
  };
}

describe("AIGC video face blur contract", () => {
  it("defines supported enums and conservative defaults", () => {
    const typedDefault: VideoFaceBlurConfig =
      AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG;

    expect(VIDEO_FACE_BLUR_MASK_MODES).toEqual(["mosaic", "blur"]);
    expect(VIDEO_FACE_BLUR_MASK_STRENGTHS).toEqual([
      "low",
      "medium",
      "high"
    ]);
    expect(typedDefault).toEqual({
      mask_mode: "mosaic",
      mask_strength: "medium"
    });
    expect(validateVideoFaceBlurConfig(typedDefault)).toEqual([]);
  });

  it("rejects invalid enum values at the frontend contract boundary", () => {
    expect(
      validateVideoFaceBlurConfig({
        mask_mode: "pixelate",
        mask_strength: "extreme"
      })
    ).toEqual(["invalid_mask_mode", "invalid_mask_strength"]);

    const invalidDefinition = {
      schemaVersion: 2,
      nodes: [
        {
          ...faceBlurNode(),
          config: { mask_mode: "pixelate", mask_strength: "medium" }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    } as unknown as AigcPipelineDefinitionV2;
    expect(validateVideoFaceBlurDefinition(invalidDefinition)).toMatchObject([
      {
        code: "invalid_mask_mode",
        nodeId: "face-blur"
      }
    ]);
  });

  it("registers one video input/output and enables execution", () => {
    const registration = AIGC_NODE_REGISTRY.find(
      (item) => item.type === "video_face_blur"
    );

    expect(registration).toMatchObject({
      label: "视频人脸打码",
      category: "model",
      executable: true,
      inputs: [
        {
          id: "video",
          type: "video_asset",
          required: true,
          multiple: false,
          max_connections: 1
        }
      ],
      outputs: [{ id: "video", type: "video_asset" }]
    });
    expect(isAigcExecutionNodeType("video_face_blur")).toBe(true);
  });

  it("creates schema-version-two nodes with defaults", () => {
    const store = createAigcEditorStore();
    store.getState().addNode("video_face_blur");

    expect(store.getState().definition).toMatchObject({
      schemaVersion: 2,
      nodes: [
        {
          type: "video_face_blur",
          config: {
            mask_mode: "mosaic",
            mask_strength: "medium"
          }
        }
      ]
    });
  });

  it("enforces video port type and a single input connection", () => {
    const video = mediaNode("video", "video", "video-asset");
    const secondVideo = mediaNode(
      "second-video",
      "video",
      "video-asset-2"
    );
    const image = mediaNode("image", "image", "image-asset");
    const target = faceBlurNode();
    const firstConnection = {
      source: video.id,
      sourceHandle: "video",
      target: target.id,
      targetHandle: "video"
    };

    expect(
      isValidAigcConnection(firstConnection, [video, target], [])
    ).toBe(true);
    expect(
      getAigcConnectionValidationError(
        {
          source: image.id,
          sourceHandle: "image",
          target: target.id,
          targetHandle: "video"
        },
        [image, target],
        []
      )
    ).toBe("port_type_mismatch");
    expect(
      getAigcConnectionValidationError(
        {
          source: secondVideo.id,
          sourceHandle: "video",
          target: target.id,
          targetHandle: "video"
        },
        [video, secondVideo, target],
        [
          {
            id: "edge-1",
            sourceNodeId: video.id,
            sourceHandle: "video",
            targetNodeId: target.id,
            targetHandle: "video"
          }
        ]
      )
    ).toBe("target_connection_limit");
  });

  it("upgrades an existing schema-version-one canvas on load", () => {
    const legacy: AigcPipelineDefinition = {
      schemaVersion: 1,
      nodes: [
        {
          id: "prompt",
          type: "text_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { text: "旧画布" }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const store = createAigcEditorStore({
      definition: legacy,
      description: "",
      entityId: "legacy",
      mode: "pipeline",
      name: "旧画布",
      revision: 1
    });

    expect(store.getState().definition).toMatchObject({
      schemaVersion: 2,
      nodes: [{ id: "prompt", type: "text" }]
    });
  });
});
