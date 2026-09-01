import { describe, expect, it } from "vitest";
import { projectAigcLayerCompositeResult } from "@/lib/aigc/result-projection";
import type {
  AigcEditedLayer,
  AigcLayerSet,
  AigcPipelineDefinition,
  AigcPipelineRunNode,
  AigcTaskResult
} from "@/lib/aigc/types";

const digest = "a".repeat(64);
const inputLayerSet: AigcLayerSet = {
  id: "set-1",
  parent_layer_set_id: null,
  source_asset_id: "source",
  base_asset_id: "base",
  canvas_width: 1000,
  canvas_height: 1000,
  version: 1,
  digest,
  layers: [
    {
      id: "product",
      asset_id: "product-original",
      z_index: 1,
      name: "商品",
      description: "",
      bbox_absolute: [100, 100, 500, 500],
      bbox_normalized: [100, 100, 500, 500],
      visible: true,
      x: 100,
      y: 100,
      scale: 1
    }
  ]
};
const replacement: AigcEditedLayer = {
  asset_id: "product-edited",
  layer_set_id: inputLayerSet.id,
  layer_set_version: inputLayerSet.version,
  layer_set_digest: inputLayerSet.digest,
  layer_id: "product",
  bbox_absolute: [100, 100, 500, 500],
  bbox_normalized: [100, 100, 500, 500],
  x: 100,
  y: 100,
  scale: 1,
  z_index: 1
};
const outputLayerSet: AigcLayerSet = {
  ...inputLayerSet,
  id: "set-2",
  parent_layer_set_id: inputLayerSet.id,
  version: 2,
  digest: "b".repeat(64),
  layers: [
    {
      ...inputLayerSet.layers[0],
      asset_id: replacement.asset_id
    }
  ]
};

const definition: AigcPipelineDefinition = {
  schemaVersion: 1,
  nodes: [
    {
      id: "canvas",
      type: "layer_canvas",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        selected_layer_id: "product",
        source_layer_set: { id: "set-0", version: 0, digest },
        transform_patches: []
      }
    },
    {
      id: "edit",
      type: "image_to_image",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        operation: "image_edit",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    },
    {
      id: "composite",
      type: "layer_composite",
      position: { x: 640, y: 0 },
      size: { width: 240, height: 180 },
      config: {}
    }
  ],
  edges: [
    {
      id: "layers",
      sourceNodeId: "canvas",
      sourceHandle: "layers",
      targetNodeId: "composite",
      targetHandle: "layers"
    },
    {
      id: "replacement",
      sourceNodeId: "edit",
      sourceHandle: "edited_layer",
      targetNodeId: "composite",
      targetHandle: "replacement"
    }
  ],
  viewport: { x: 0, y: 0, zoom: 1 }
};

function runNode(
  nodeId: string,
  result: AigcTaskResult
): AigcPipelineRunNode {
  return {
    node_id: nodeId,
    included_in_plan: true,
    status: "succeeded",
    current_task_id: null,
    reused_from_task_id: null,
    input_hash: null,
    result,
    attempts: []
  };
}

describe("AIGC layer composite result projection", () => {
  it("projects the final image, derived layer set, and replacement target", () => {
    const projection = projectAigcLayerCompositeResult(
      definition,
      "composite",
      [
        runNode("canvas", {
          kind: "layer_canvas",
          text: null,
          text_digest: null,
          assets: [],
          layer_set: inputLayerSet
        }),
        runNode("edit", {
          kind: "edited_layer",
          text: null,
          text_digest: null,
          assets: [],
          edited_layer: replacement
        }),
        runNode("composite", {
          kind: "layer_composite",
          text: null,
          text_digest: null,
          assets: [
            {
              asset_id: "flattened",
              ordinal: 0,
              mime_type: "image/png",
              download_url: "/api/assets/flattened/content",
              available: true
            }
          ],
          layer_set: outputLayerSet
        })
      ]
    );

    expect(projection).toMatchObject({
      imageAsset: { asset_id: "flattened" },
      inputLayerSet: { id: "set-1", version: 1 },
      layerSet: { id: "set-2", version: 2 },
      layersConnected: true,
      replacement: { asset_id: "product-edited", layer_id: "product" },
      replacementConnected: true,
      targetLayer: { id: "product", name: "商品" }
    });
  });
});
