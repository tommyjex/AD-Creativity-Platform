import { describe, expect, it } from "vitest";

import {
  connectionBreaksBboxReferences,
  eligibleBboxTextTargets,
  isBboxReferencePaused,
  isEligibleBboxTextTarget,
  sanitizeBboxReferences
} from "@/lib/aigc/bbox-references";
import type { AigcPipelineDefinitionV2 } from "@/lib/aigc/types";

function definition(): AigcPipelineDefinitionV2 {
  return {
    schemaVersion: 2,
    nodes: [
      {
        id: "image",
        type: "image",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          asset_id: "asset-1",
          bbox_asset_id: "asset-1",
          bbox: { type: "bbox", x1: 100, y1: 200, x2: 700, y2: 800 },
          title: null
        }
      },
      {
        id: "prompt",
        type: "text",
        position: { x: 0, y: 200 },
        size: { width: 240, height: 160 },
        config: {
          text: "编辑",
          bbox_references: [
            { source_node_id: "image", instruction: "替换主体" }
          ],
          title: null
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

    expect(prompt?.type).toBe("text");
    if (prompt?.type === "text") {
      expect(prompt.config.bbox_references).toEqual([]);
    }
  });

  it("pauses references while either endpoint uses upstream mode and restores them", () => {
    const value = definition();
    value.nodes.push(
      {
        id: "image-producer",
        type: "text_to_image",
        position: { x: -320, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          model: "doubao-seedream-5-0-pro-260628",
          aspect_ratio: "1:1",
          size: "2K",
          format: "png"
        }
      },
      {
        id: "text-producer",
        type: "llm",
        position: { x: -320, y: 200 },
        size: { width: 240, height: 160 },
        config: {
          model: "doubao-seed-evolving",
          system_prompt: "",
          temperature: 0.7
        }
      }
    );
    value.edges.push(
      {
        id: "image-upstream",
        sourceNodeId: "image-producer",
        sourceHandle: "image",
        targetNodeId: "image",
        targetHandle: "image"
      },
      {
        id: "text-upstream",
        sourceNodeId: "text-producer",
        sourceHandle: "text",
        targetNodeId: "prompt",
        targetHandle: "text"
      }
    );

    expect(isEligibleBboxTextTarget(value, "image", "prompt")).toBe(false);
    expect(isBboxReferencePaused(value, "image", "prompt")).toBe(true);
    expect(sanitizeBboxReferences(value)).toEqual(value);

    value.edges = value.edges.filter(
      (edge) => !edge.id.endsWith("-upstream")
    );
    expect(isEligibleBboxTextTarget(value, "image", "prompt")).toBe(true);
    expect(isBboxReferencePaused(value, "image", "prompt")).toBe(false);
  });

  it("allows an upstream image when its current result asset is available", () => {
    const value = definition();
    value.nodes.push({
      id: "image-producer",
      type: "text_to_image",
      position: { x: -320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    });
    value.edges.push({
      id: "image-upstream",
      sourceNodeId: "image-producer",
      sourceHandle: "image",
      targetNodeId: "image",
      targetHandle: "image"
    });

    expect(isEligibleBboxTextTarget(value, "image", "prompt")).toBe(false);
    expect(
      isEligibleBboxTextTarget(
        value,
        "image",
        "prompt",
        "upstream-image"
      )
    ).toBe(true);
  });
});
