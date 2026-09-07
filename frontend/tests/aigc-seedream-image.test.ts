import { describe, expect, it } from "vitest";
import { AIGC_NODE_REGISTRY_BY_TYPE } from "@/lib/aigc/node-registry";
import {
  isSeedreamImageEdgeIncompatible,
  isSeedreamImageInputActive,
  isSeedreamImageOutputActive,
  seedreamImageInputLimit,
  seedreamImageTitle,
  validateLayerDecompositionAssets,
  validateSeedreamImageDefinition
} from "@/lib/aigc/seedream-image";
import type {
  AigcEdge,
  AigcImageOperation,
  AigcNode,
  AigcPipelineDefinition,
  AigcPipelineDefinitionV2,
  AigcV2Node
} from "@/lib/aigc/types";
import type { Asset } from "@/lib/api-types";

function seedream(operation?: AigcImageOperation): Extract<
  AigcNode,
  { type: "image_to_image" }
> {
  return {
    id: "seedream",
    type: "image_to_image",
    position: { x: 320, y: 0 },
    size: { width: 240, height: 160 },
    config: {
      model: "doubao-seedream-5-0-pro-260628",
      aspect_ratio: "1:1",
      size: "2K",
      format: "png",
      ...(operation ? { operation } : {})
    }
  };
}

function edge(
  id: string,
  targetHandle: string,
  sourceNodeId = `${targetHandle}-source`,
  sourceHandle = targetHandle === "prompt" ? "text" : "image"
): AigcEdge {
  return {
    id,
    sourceNodeId,
    sourceHandle,
    targetNodeId: "seedream",
    targetHandle
  };
}

function definition(
  node: AigcNode,
  edges: AigcEdge[]
): AigcPipelineDefinition {
  return {
    schemaVersion: 1,
    nodes: [node],
    edges,
    viewport: { x: 0, y: 0, zoom: 1 }
  };
}

describe("Seedream image modes", () => {
  it("treats legacy nodes as image-to-image and applies its ports", () => {
    const node = seedream();

    expect(seedreamImageTitle(node)).toBe("图生图");
    expect(isSeedreamImageInputActive(node, "image", [])).toBe(true);
    expect(isSeedreamImageInputActive(node, "edit_image", [])).toBe(false);
    expect(isSeedreamImageOutputActive(node, "image", [])).toBe(true);
    expect(isSeedreamImageOutputActive(node, "layers", [])).toBe(false);
  });

  it.each([
    ["text_to_image", undefined, "02048x01024", undefined],
    ["image_to_image", "image_to_image", "01920x01080", undefined],
    ["text_to_image", undefined, "512x512", "invalid_image_size"],
    ["image_to_image", "image_to_image", "2048X1024", "invalid_image_size"],
    ["image_to_image", "image_edit", "2048x1024", "size_not_allowed_for_mode"],
    [
      "image_to_image",
      "layer_decomposition",
      "2048x1024",
      "size_not_allowed_for_mode"
    ],
    ["image_to_image", "image_edit", "auto", "size_not_allowed_for_mode"],
    ["image_to_image", "image_to_image", "auto", "size_not_allowed_for_mode"]
  ] as const)(
    "validates %s operation %s size %s consistently",
    (type, operation, size, expectedCode) => {
      const node = {
        id: `${type}-${operation ?? "default"}`,
        type,
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          model: "doubao-seedream-5-0-pro-260628",
          aspect_ratio: "1:1",
          size,
          format: "png",
          ...(operation ? { operation } : {})
        }
      } as unknown as AigcNode;

      const issues = validateSeedreamImageDefinition(definition(node, []));

      if (expectedCode) {
        expect(issues[0]).toMatchObject({
          code: expectedCode,
          nodeId: node.id
        });
      } else {
        expect(
          issues.filter((issue) =>
            ["invalid_image_size", "size_not_allowed_for_mode"].includes(
              issue.code
            )
          )
        ).toEqual([]);
      }
    }
  );

  it("selects the image-edit output from the unique edit target", () => {
    const node = seedream("image_edit");
    const imageEdges = [edge("edit-image", "edit_image")];
    const layerEdges = [
      edge("edit-layer", "edit_layer", "layer-canvas", "selected_layer")
    ];

    expect(isSeedreamImageInputActive(node, "edit_layer", imageEdges)).toBe(false);
    expect(isSeedreamImageOutputActive(node, "image", imageEdges)).toBe(true);
    expect(isSeedreamImageOutputActive(node, "edited_layer", imageEdges)).toBe(false);
    expect(isSeedreamImageInputActive(node, "edit_image", layerEdges)).toBe(false);
    expect(isSeedreamImageOutputActive(node, "image", layerEdges)).toBe(false);
    expect(isSeedreamImageOutputActive(node, "edited_layer", layerEdges)).toBe(true);
  });

  it("uses one image for decomposition and accepts an optional prompt", () => {
    const node = seedream("layer_decomposition");
    const imagePort = AIGC_NODE_REGISTRY_BY_TYPE.get(
      "image_to_image"
    )?.inputs.find((port) => port.id === "image");

    expect(imagePort && seedreamImageInputLimit(node, imagePort)).toBe(1);
    expect(
      validateSeedreamImageDefinition(definition(node, [edge("image", "image")]))
    ).toEqual([]);
    expect(isSeedreamImageOutputActive(node, "layers", [])).toBe(true);
  });

  it("aggregates dedicated decomposition asset preflight errors", () => {
    const node = seedream("layer_decomposition");
    const imageNode: AigcV2Node = {
      id: "image-source",
      type: "image",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        asset_id: "asset-webp",
        bbox: null,
        bbox_asset_id: null,
        title: null
      }
    };
    const current: AigcPipelineDefinitionV2 = {
      schemaVersion: 2,
      nodes: [imageNode, node],
      edges: [edge("image", "image", imageNode.id)],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    const invalidAsset = {
      id: "asset-webp",
      project_id: null,
      type: "uploaded_image",
      category: null,
      status: "succeeded",
      stage: null,
      url: "/asset.webp",
      object_key: "asset.webp",
      mime_type: "image/webp",
      size_bytes: 1024,
      source_task_id: null,
      metadata: {
        inspection_version: 1,
        width: 1024,
        height: 1024
      },
      created_at: "2026-08-30T00:00:00Z",
      updated_at: "2026-08-30T00:00:00Z"
    } satisfies Asset;

    expect(
      validateLayerDecompositionAssets(current, node.id, [invalidAsset])
    ).toEqual([
      {
        code: "invalid_media_input",
        message: "图层拆分仅支持 PNG/JPEG 图片",
        nodeId: node.id
      }
    ]);
  });

  it("keeps stale mode edges but reports and locates them", () => {
    const node = seedream("layer_decomposition");
    const stale = edge("stale-edit", "edit_image");
    const current = definition(node, [stale]);

    expect(current.edges).toEqual([stale]);
    expect(isSeedreamImageEdgeIncompatible(stale, current.nodes, current.edges))
      .toBe(true);
    expect(validateSeedreamImageDefinition(current)[0]).toMatchObject({
      code: "input_not_allowed_for_mode",
      nodeId: "seedream",
      message: "编辑图片输入不适用于图层拆分模式，请断开对应连线"
    });
  });

  it("rejects simultaneous image and layer edit targets", () => {
    const node = seedream("image_edit");
    const edges = [
      edge("edit-image", "edit_image"),
      edge("edit-layer", "edit_layer", "layer-canvas", "selected_layer")
    ];
    const current = definition(node, edges);

    expect(validateSeedreamImageDefinition(current)[0]).toMatchObject({
      code: "edit_target_conflict",
      nodeId: "seedream"
    });
    expect(
      edges.every((item) =>
        isSeedreamImageEdgeIncompatible(item, current.nodes, current.edges)
      )
    ).toBe(true);
  });
});
