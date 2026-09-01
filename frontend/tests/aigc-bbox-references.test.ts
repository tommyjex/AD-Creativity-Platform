import { describe, expect, it } from "vitest";

import {
  connectionBreaksBboxReferences,
  eligibleBboxTextTargets,
  isEligibleBboxTextTarget,
  sanitizeBboxReferences
} from "@/lib/aigc/bbox-references";
import type { AigcPipelineDefinition } from "@/lib/aigc/types";

function definition(): AigcPipelineDefinition {
  return {
    schemaVersion: 1,
    nodes: [
      {
        id: "image",
        type: "image_input",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          asset_id: "asset-1",
          bbox_asset_id: "asset-1",
          bbox: { type: "bbox", x1: 100, y1: 200, x2: 700, y2: 800 }
        }
      },
      {
        id: "prompt",
        type: "text_input",
        position: { x: 0, y: 200 },
        size: { width: 240, height: 160 },
        config: {
          text: "编辑",
          bbox_references: [
            { source_node_id: "image", instruction: "替换主体" }
          ]
        }
      },
      {
        id: "model",
        type: "image_to_image",
        position: { x: 320, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          model: "doubao-seedream-5-0-pro-260628",
          aspect_ratio: "1:1",
          size: "2K",
          format: "png"
        }
      },
      {
        id: "llm",
        type: "llm",
        position: { x: 320, y: 240 },
        size: { width: 240, height: 160 },
        config: {
          model: "doubao-seed-evolving",
          system_prompt: "",
          temperature: 0.7
        }
      }
    ],
    edges: [
      {
        id: "image-edge",
        sourceNodeId: "image",
        sourceHandle: "image",
        targetNodeId: "model",
        targetHandle: "image"
      },
      {
        id: "prompt-edge",
        sourceNodeId: "prompt",
        sourceHandle: "text",
        targetNodeId: "model",
        targetHandle: "prompt"
      }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
}

describe("AIGC bbox reference relationships", () => {
  it("only returns text nodes whose every downstream shares the image", () => {
    const value = definition();

    expect(isEligibleBboxTextTarget(value, "image", "prompt")).toBe(true);
    expect(eligibleBboxTextTargets(value, "image").map((node) => node.id)).toEqual([
      "prompt"
    ]);

    value.edges.push({
      id: "llm-edge",
      sourceNodeId: "prompt",
      sourceHandle: "text",
      targetNodeId: "llm",
      targetHandle: "prompt"
    });

    expect(isEligibleBboxTextTarget(value, "image", "prompt")).toBe(false);
  });

  it("detects a new incompatible downstream connection", () => {
    const value = definition();

    expect(
      connectionBreaksBboxReferences(
        {
          sourceNodeId: "prompt",
          sourceHandle: "text",
          targetNodeId: "llm",
          targetHandle: "prompt"
        },
        value.nodes,
        value.edges
      )
    ).toBe(true);
  });

  it("removes references after their shared image edge disappears", () => {
    const value = definition();
    value.edges = value.edges.filter((edge) => edge.id !== "image-edge");

    const sanitized = sanitizeBboxReferences(value);
    const prompt = sanitized.nodes.find((node) => node.id === "prompt");

    expect(prompt?.type).toBe("text_input");
    if (prompt?.type === "text_input") {
      expect(prompt.config.bbox_references).toEqual([]);
    }
  });
});
