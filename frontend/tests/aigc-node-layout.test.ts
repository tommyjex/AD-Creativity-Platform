import { describe, expect, it } from "vitest";
import { createAigcEditorStore } from "@/lib/aigc/editor-store";
import {
  aigcNodeDefaultSize,
  aigcNodeInitialPosition,
  aigcNodeMinimumSize,
  normalizeAigcNodeSize
} from "@/lib/aigc/node-layout";
import type { AigcNode, AigcPipelineDefinition } from "@/lib/aigc/types";

function layerNode(
  type: "layer_canvas" | "layer_composite",
  size: { height: number; width: number }
): AigcNode {
  const common = {
    id: type,
    position: { x: 0, y: 0 },
    size
  };
  return type === "layer_canvas"
    ? {
        ...common,
        type,
        config: {
          selected_layer_id: null,
          source_layer_set: null,
          transform_patches: []
        }
      }
    : { ...common, type, config: {} };
}

function createStoreWithNodes(nodes: AigcNode[]) {
  const definition: AigcPipelineDefinition = {
    schemaVersion: 1,
    nodes,
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
  return createAigcEditorStore({
    definition,
    description: "",
    entityId: "pipeline-1",
    mode: "pipeline",
    name: "图层节点尺寸",
    revision: 1
  });
}

describe("AIGC layer node layout", () => {
  it("uses dedicated defaults and minimums for layer nodes", () => {
    expect(aigcNodeDefaultSize("layer_canvas")).toEqual({
      height: 460,
      width: 420
    });
    expect(aigcNodeMinimumSize("layer_canvas")).toEqual({
      height: 420,
      width: 380
    });
    expect(aigcNodeDefaultSize("layer_composite")).toEqual({
      height: 380,
      width: 400
    });
    expect(aigcNodeMinimumSize("layer_composite")).toEqual({
      height: 340,
      width: 360
    });
    expect(aigcNodeDefaultSize("llm")).toEqual({
      height: 160,
      width: 240
    });
  });

  it("normalizes undersized legacy layer nodes without marking the store dirty", () => {
    const store = createStoreWithNodes([
      layerNode("layer_canvas", { height: 160, width: 240 }),
      layerNode("layer_composite", { height: 180, width: 240 })
    ]);

    expect(store.getState().definition.nodes.map((node) => node.size)).toEqual([
      { height: 420, width: 380 },
      { height: 340, width: 360 }
    ]);
    expect(store.getState().dirty).toBe(false);
  });

  it("creates spacious layer nodes and clamps later resize attempts", () => {
    const store = createStoreWithNodes([]);

    store.getState().addNode("layer_canvas");
    store.getState().addNode("layer_composite");
    expect(store.getState().definition.nodes.map((node) => node.size)).toEqual([
      { height: 460, width: 420 },
      { height: 380, width: 400 }
    ]);

    const [canvas, composite] = store.getState().definition.nodes;
    store
      .getState()
      .resizeNode(canvas.id, { height: 120, width: 190 });
    store
      .getState()
      .resizeNode(composite.id, { height: 120, width: 190 });
    expect(store.getState().definition.nodes.map((node) => node.size)).toEqual([
      { height: 420, width: 380 },
      { height: 340, width: 360 }
    ]);
  });

  it("normalizes dimensions independently", () => {
    expect(
      normalizeAigcNodeSize("layer_canvas", { height: 500, width: 240 })
    ).toEqual({ height: 500, width: 380 });
  });

  it("uses wider placement gaps for layer nodes", () => {
    expect(aigcNodeInitialPosition("layer_canvas", 4)).toEqual({
      x: 540,
      y: 580
    });
    expect(aigcNodeInitialPosition("llm", 4)).toEqual({
      x: 80,
      y: 310
    });
  });
});
