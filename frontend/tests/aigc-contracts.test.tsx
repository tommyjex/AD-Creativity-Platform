import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AigcQueryProvider } from "@/components/workspace/aigc/providers/aigc-query-provider";
import {
  AIGC_DEFAULT_IMAGE_MODEL,
  AIGC_DEFAULT_IMAGE_OPERATION,
  AIGC_DEFAULT_TEXT_MODEL,
  AIGC_DEFAULT_VIDEO_CONFIG,
  AIGC_NODE_REGISTRY
} from "@/lib/aigc/node-registry";
import { createAigcEditorStore } from "@/lib/aigc/editor-store";
import {
  AIGC_NODE_TYPES,
  type AigcPipelineDefinition,
  aigcNodeRunKey,
  cloneAigcTaskSnapshot
} from "@/lib/aigc/types";
import {
  SEEDANCE_CAPABILITIES,
  SEEDANCE_MODELS,
  normalizeSeedanceVideoParameters,
  validateSeedanceReferenceCounts
} from "@/lib/seedance";

function QueryClientProbe() {
  const queryClient = useQueryClient();
  return (
    <span data-testid="query-client">
      {queryClient.getDefaultOptions().queries?.staleTime?.toString()}
    </span>
  );
}

describe("AIGC contracts", () => {
  it("registers all schema-version-one node types", () => {
    expect(AIGC_NODE_REGISTRY.map((item) => item.type)).toEqual(
      AIGC_NODE_TYPES
    );
    expect(AIGC_NODE_REGISTRY.find((item) => item.type === "llm")).toMatchObject(
      {
        executable: true,
        models: [AIGC_DEFAULT_TEXT_MODEL],
        inputs: [
          {
            id: "prompt",
            type: "text",
            multiple: false,
            max_connections: 1
          }
        ]
      }
    );
    expect(
      AIGC_NODE_REGISTRY.find((item) => item.type === "image_to_image")
    ).toMatchObject({
      executable: true,
      models: [AIGC_DEFAULT_IMAGE_MODEL],
      inputs: [
        {
          id: "image",
          type: "image_asset",
          multiple: true,
          max_connections: 10
        },
        {
          id: "edit_image",
          type: "image_asset",
          required: false
        },
        {
          id: "edit_layer",
          type: "image_layer",
          required: false
        },
        {
          id: "prompt",
          type: "text",
          multiple: false,
          max_connections: 1
        }
      ],
      outputs: [
        { id: "image", type: "image_asset" },
        { id: "edited_layer", type: "edited_layer" },
        { id: "layers", type: "layer_set" }
      ]
    });
    expect(
      AIGC_NODE_REGISTRY.find((item) => item.type === "layer_canvas")
    ).toMatchObject({
      category: "control",
      inputs: [{ id: "layers", type: "layer_set" }],
      outputs: [
        { id: "selected_layer", type: "image_layer" },
        { id: "layers", type: "layer_set" }
      ]
    });
    expect(
      AIGC_NODE_REGISTRY.find((item) => item.type === "layer_composite")
    ).toMatchObject({
      category: "control",
      inputs: [
        { id: "layers", type: "layer_set" },
        { id: "replacement", type: "edited_layer" }
      ],
      outputs: [
        { id: "image", type: "image_asset" },
        { id: "layers", type: "layer_set" }
      ]
    });
    expect(
      AIGC_NODE_REGISTRY.flatMap((item) => [
        ...item.inputs,
        ...item.outputs
      ]).filter(
        (port) => port.multiple === false && port.max_connections !== 1
      )
    ).toEqual([]);
  });

  it("normalizes legacy image nodes and creates layer node defaults", () => {
    const legacyDefinition: AigcPipelineDefinition = {
      schemaVersion: 1,
      nodes: [
        {
          id: "seedream",
          type: "image_to_image",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: {
            model: AIGC_DEFAULT_IMAGE_MODEL,
            aspect_ratio: "1:1",
            size: "2K",
            format: "png"
          }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const store = createAigcEditorStore({
      definition: legacyDefinition,
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "Legacy",
      revision: 0
    });

    expect(store.getState().definition.nodes[0]).toMatchObject({
      config: { operation: AIGC_DEFAULT_IMAGE_OPERATION }
    });

    store.getState().addNode("layer_canvas");
    store.getState().addNode("layer_composite");
    expect(store.getState().definition.nodes.slice(-2)).toMatchObject([
      {
        type: "layer_canvas",
        config: {
          selected_layer_id: null,
          source_layer_set: null,
          transform_patches: []
        }
      },
      { type: "layer_composite", config: {} }
    ]);
  });

  it("shares Seedance capabilities with video node contracts", () => {
    expect(SEEDANCE_MODELS).toEqual([
      "doubao-seedance-2-5-260628",
      "doubao-seedance-2-0-260128",
      "doubao-seedance-2-0-fast-260128",
      "doubao-seedance-2-0-mini-260615"
    ]);
    expect(SEEDANCE_CAPABILITIES["doubao-seedance-2-5-260628"]).toMatchObject({
      displayName: "Seedance 2.5",
      maxReferenceImages: 30,
      maxReferenceVideos: 10,
      maxReferenceAudios: 10,
      resolutions: ["480p", "720p", "1080p"],
      duration: { minimum: 4, maximum: 30 }
    });
    expect(
      SEEDANCE_CAPABILITIES["doubao-seedance-2-0-260128"]
    ).toMatchObject({
      maxReferenceImages: 9,
      maxReferenceVideos: 3,
      maxReferenceAudios: 3,
      resolutions: ["480p", "720p", "1080p", "4k"],
      duration: { minimum: 4, maximum: 15 }
    });
    expect(
      normalizeSeedanceVideoParameters("doubao-seedance-2-0-fast-260128", {
        duration_seconds: 30,
        resolution: "1080p"
      })
    ).toEqual({ duration_seconds: -1, resolution: "720p" });
    expect(
      validateSeedanceReferenceCounts("doubao-seedance-2-0-mini-260615", {
        images: 10,
        videos: 0,
        audios: 0
      })
    ).toBe(false);
  });

  it("defines video defaults and generation-mode ports", () => {
    expect(AIGC_DEFAULT_VIDEO_CONFIG).toEqual({
      model: "doubao-seedance-2-5-260628",
      generation_mode: "text_to_video",
      task_type: "generate",
      resolution: "720p",
      aspect_ratio: "adaptive",
      duration_seconds: -1,
      generate_audio: true
    });

    const videoGeneration = AIGC_NODE_REGISTRY.find(
      (item) => item.type === "video_generation"
    );
    expect(videoGeneration).toMatchObject({
      executable: true,
      models: SEEDANCE_MODELS,
      inputs: [
        {
          id: "prompt",
          type: "text",
          required: false,
          modes: [
            "text_to_video",
            "first_frame",
            "first_last_frame",
            "multimodal_reference"
          ]
        },
        {
          id: "first_frame",
          type: "image_asset",
          modes: ["first_frame", "first_last_frame"]
        },
        {
          id: "last_frame",
          type: "image_asset",
          modes: ["first_last_frame"]
        },
        {
          id: "reference_images",
          type: "image_asset",
          max_connections: 30,
          modes: ["multimodal_reference"]
        },
        {
          id: "reference_videos",
          type: "video_asset",
          max_connections: 10,
          modes: ["multimodal_reference"]
        },
        {
          id: "reference_audios",
          type: "audio_asset",
          max_connections: 10,
          modes: ["multimodal_reference"]
        }
      ],
      outputs: [{ id: "video", type: "video_asset" }]
    });
  });

  it("creates stable node-run keys and deep task snapshots", () => {
    const source = {
      params: {
        nested: {
          prompt: "first"
        }
      },
      upstream: ["input-1"]
    };

    const snapshot = cloneAigcTaskSnapshot(source);
    source.params.nested.prompt = "changed";
    source.upstream.push("input-2");

    expect(aigcNodeRunKey({ runId: "run-1", nodeId: "node-2" })).toBe(
      "run-1:node-2"
    );
    expect(snapshot).toEqual({
      params: { nested: { prompt: "first" } },
      upstream: ["input-1"]
    });
  });

  it("provides a route-scoped React Query client", () => {
    render(
      <AigcQueryProvider>
        <QueryClientProbe />
      </AigcQueryProvider>
    );

    expect(screen.getByTestId("query-client")).toHaveTextContent("30000");
  });
});
