import { describe, expect, it } from "vitest";
import {
  aigcNodeBaseDisplayName,
  deriveAigcNodeDisplayNames
} from "@/lib/aigc/node-display-name";
import type {
  AigcImageOperation,
  AigcV2Node
} from "@/lib/aigc/types";

function inputNode(
  id: string,
  type: "text" | "image" | "video" | "audio"
): AigcV2Node {
  const common = {
    id,
    position: { x: 0, y: 0 },
    size: { width: 240, height: 160 }
  };
  if (type === "text") {
    return {
      ...common,
      type,
      config: { text: "", bbox_references: [], title: null }
    };
  }
  if (type === "image") {
    return {
      ...common,
      type,
      config: {
        asset_id: null,
        bbox: null,
        bbox_asset_id: null,
        title: null
      }
    };
  }
  return { ...common, type, config: { asset_id: null, title: null } };
}

function seedreamNode(
  id: string,
  operation: AigcImageOperation
): Extract<AigcV2Node, { type: "image_to_image" }> {
  return {
    id,
    type: "image_to_image",
    position: { x: 0, y: 0 },
    size: { width: 240, height: 160 },
    config: {
      model: "doubao-seedream-5-0-pro-260628",
      operation,
      aspect_ratio: "1:1",
      size: "2K",
      format: "png"
    }
  };
}

describe("AIGC node display names", () => {
  it("uses modality names and registry or Seedream titles elsewhere", () => {
    const nodes = [
      inputNode("text", "text"),
      inputNode("image", "image"),
      inputNode("video", "video"),
      inputNode("audio", "audio"),
      seedreamNode("generate", "image_to_image"),
      seedreamNode("edit", "image_edit"),
      seedreamNode("decompose", "layer_decomposition"),
      inputNode("output", "image")
    ] satisfies AigcV2Node[];

    expect(nodes.map(aigcNodeBaseDisplayName)).toEqual([
      "文本节点",
      "图片节点",
      "视频节点",
      "音频节点",
      "图生图",
      "图片编辑",
      "图层拆分",
      "图片节点"
    ]);
  });

  it("does not number a single base display name", () => {
    const node = inputNode("video", "video");

    expect(deriveAigcNodeDisplayNames([node]).get(node.id)).toEqual({
      baseName: "视频节点",
      duplicateCount: 1,
      index: 1,
      displayName: "视频节点"
    });
  });

  it("numbers duplicate names by definition order and appends new nodes", () => {
    const nodes = [
      inputNode("image-a", "image"),
      inputNode("text", "text"),
      inputNode("image-b", "image"),
      inputNode("image-c", "image")
    ];
    const names = deriveAigcNodeDisplayNames(nodes);

    expect(nodes.map((node) => names.get(node.id)?.displayName)).toEqual([
      "图片节点1",
      "文本节点",
      "图片节点2",
      "图片节点3"
    ]);
    expect(names.get("image-b")).toMatchObject({
      baseName: "图片节点",
      duplicateCount: 3,
      index: 2
    });
  });

  it("renumbers remaining nodes after deletion without changing stable data", () => {
    const nodes = [
      inputNode("image-a", "image"),
      inputNode("image-b", "image"),
      inputNode("image-c", "image")
    ];
    const remaining = nodes.filter((node) => node.id !== "image-b");
    const before = structuredClone(remaining);
    const names = deriveAigcNodeDisplayNames(remaining);

    expect(remaining.map((node) => names.get(node.id)?.displayName)).toEqual([
      "图片节点1",
      "图片节点2"
    ]);
    expect(remaining.map((node) => node.id)).toEqual(["image-a", "image-c"]);
    expect(remaining).toEqual(before);
  });

  it("ignores position changes and groups Seedream nodes by current title", () => {
    const nodes = [
      seedreamNode("generate-a", "image_to_image"),
      seedreamNode("edit", "image_edit"),
      seedreamNode("generate-b", "image_to_image")
    ];
    const beforeDrag = deriveAigcNodeDisplayNames(nodes);
    const dragged = nodes.map((node, index) => ({
      ...node,
      position: { x: 900 - index * 300, y: index * 200 }
    }));
    const afterDrag = deriveAigcNodeDisplayNames(dragged);

    expect(
      nodes.map((node) => beforeDrag.get(node.id)?.displayName)
    ).toEqual(["图生图1", "图片编辑", "图生图2"]);
    expect(
      dragged.map((node) => afterDrag.get(node.id)?.displayName)
    ).toEqual(["图生图1", "图片编辑", "图生图2"]);

    const changedMode = structuredClone(dragged);
    changedMode[2] = seedreamNode("generate-b", "image_edit");
    const changedNames = deriveAigcNodeDisplayNames(changedMode);
    expect(
      changedMode.map((node) => changedNames.get(node.id)?.displayName)
    ).toEqual(["图生图", "图片编辑1", "图片编辑2"]);
  });
});
