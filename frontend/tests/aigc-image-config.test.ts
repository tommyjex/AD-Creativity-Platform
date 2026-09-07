import { describe, expect, it } from "vitest";

import { createAigcEditorStore } from "@/lib/aigc/editor-store";
import type {
  AigcNode,
  AigcPipelineDefinition
} from "@/lib/aigc/types";

function definitionWithImageSize(
  size: string,
  operation?: string
): AigcPipelineDefinition {
  return {
    schemaVersion: 1,
    nodes: [
      {
        id: "seedream",
        type: "image_to_image",
        position: { x: 0, y: 0 },
        size: { width: 280, height: 200 },
        config: {
          model: "doubao-seedream-5-0-pro-260628",
          aspect_ratio: "1:1",
          size,
          format: "png",
          ...(operation ? { operation } : {})
        }
      } as unknown as AigcNode
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
}

function storeFor(definition: AigcPipelineDefinition) {
  return createAigcEditorStore({
    definition,
    description: "",
    entityId: "pipeline-1",
    mode: "pipeline",
    name: "尺寸契约",
    revision: 1
  });
}

function seedreamConfig(
  store: ReturnType<typeof storeFor>
): Extract<AigcNode, { type: "image_to_image" }>["config"] {
  const node = store
    .getState()
    .definition.nodes.find((candidate) => candidate.id === "seedream");
  if (node?.type !== "image_to_image") {
    throw new Error("Seedream node is missing");
  }
  return node.config;
}

describe("AIGC image config serialization", () => {
  it("migrates legacy definitions to schemaVersion 2 and normalizes custom sizes", () => {
    const legacy = storeFor(definitionWithImageSize("2K"));
    const custom = storeFor(
      definitionWithImageSize("02048x01024", "image_to_image")
    );
    const textToImageDefinition = definitionWithImageSize("2K");
    textToImageDefinition.nodes = [
      {
        ...textToImageDefinition.nodes[0],
        id: "text-to-image",
        type: "text_to_image",
        config: {
          model: "doubao-seedream-5-0-pro-260628",
          aspect_ratio: "1:1",
          size: "01920x01080",
          format: "png"
        }
      } as unknown as AigcNode
    ];
    const textToImage = storeFor(textToImageDefinition);

    expect(legacy.getState().definition.schemaVersion).toBe(2);
    expect(seedreamConfig(legacy)).toMatchObject({
      operation: "image_to_image",
      size: "2K"
    });
    expect(custom.getState().definition.schemaVersion).toBe(2);
    expect(seedreamConfig(custom).size).toBe("2048x1024");
    expect(
      JSON.parse(JSON.stringify(custom.getState().definition)).nodes[0].config
        .size
    ).toBe("2048x1024");
    expect(
      JSON.parse(JSON.stringify(textToImage.getState().definition)).nodes[0]
        .config.size
    ).toBe("1920x1080");
  });

  it.each([
    ["image_edit", "2K"],
    ["layer_decomposition", "auto"]
  ] as const)(
    "converges a custom image-to-image size when switching to %s",
    (operation, expectedSize) => {
      const store = storeFor(
        definitionWithImageSize("2048x1024", "image_to_image")
      );

      store.getState().updateNodeConfig("seedream", {
        ...seedreamConfig(store),
        operation
      });

      expect(seedreamConfig(store)).toMatchObject({
        operation,
        size: expectedSize
      });
    }
  );
});
