import { describe, expect, it } from "vitest";

import { resolvePromptOptimizationSourceImage } from "@/lib/aigc/prompt-optimization-context";
import type {
  AigcPipelineDefinitionV2,
  AigcPipelineRunDetail
} from "@/lib/aigc/types";

function definition(
  operation: "image_edit" | "image_to_image" | "layer_decomposition",
  sourceNodeId = "local-image",
  targetHandle = operation === "image_edit" ? "edit_image" : "image"
): AigcPipelineDefinitionV2 {
  return {
    schemaVersion: 2,
    nodes: [
      {
        id: "local-image",
        type: "image",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          asset_id: "asset-local",
          bbox: null,
          bbox_asset_id: null,
          title: null
        }
      },
      {
        id: "generated-image",
        type: "text_to_image",
        position: { x: 0, y: 200 },
        size: { width: 240, height: 160 },
        config: {
          aspect_ratio: "1:1",
          format: "png",
          model: "doubao-seedream-5-0-pro-260628",
          size: "2K"
        }
      },
      {
        id: "target",
        type: "image_to_image",
        position: { x: 320, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          aspect_ratio: "1:1",
          format: "png",
          model: "doubao-seedream-5-0-pro-260628",
          operation,
          size: "2K"
        }
      }
    ],
    edges: [
      {
        id: "source-target",
        sourceNodeId,
        sourceHandle: "image",
        targetNodeId: "target",
        targetHandle
      }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
  };
}

function runDetail(
  status: "failed" | "reused" | "succeeded",
  available = true,
  mimeType = "image/png"
): AigcPipelineRunDetail {
  const snapshot = definition("image_to_image", "generated-image");
  return {
    run: {
      id: "run-42",
      pipeline_id: "pipeline-1",
      run_number: 42,
      pipeline_revision: 7,
      mode: "full",
      start_node_id: null,
      source_run_id: null,
      source_node_id: null,
      status: "succeeded",
      definition_snapshot: snapshot,
      input_snapshot: {},
      error: null,
      cancellation_requested: false,
      created_at: "2026-09-07T00:00:00Z",
      updated_at: "2026-09-07T00:00:01Z",
      started_at: "2026-09-07T00:00:00Z",
      finished_at: "2026-09-07T00:00:01Z"
    },
    nodes: [
      {
        node_id: "generated-image",
        included_in_plan: true,
        status,
        current_task_id: null,
        reused_from_task_id: null,
        input_hash: null,
        result: {
          kind: "assets",
          text: null,
          text_digest: null,
          assets: [
            {
              asset_id: "asset-upstream",
              ordinal: 0,
              mime_type: mimeType,
              download_url:
                "https://signed.example.com/private.png?signature=secret",
              available
            }
          ]
        },
        attempts: []
      }
    ]
  };
}

describe("AIGC prompt optimization source image context", () => {
  it("resolves the sole local image for ordinary image-to-image", () => {
    expect(
      resolvePromptOptimizationSourceImage(
        definition("image_to_image"),
        "target",
        null
      )
    ).toEqual({
      asset_id: "asset-local",
      run_id: null,
      source_handle: "image",
      source_node_id: "local-image",
      target_handle: "image"
    });
  });

  it("uses the sole edit_image edge for image_edit", () => {
    expect(
      resolvePromptOptimizationSourceImage(
        definition("image_edit"),
        "target",
        null
      )
    ).toMatchObject({
      asset_id: "asset-local",
      run_id: null,
      target_handle: "edit_image"
    });
  });

  it("uses an available image from a successful upstream Run without leaking its URL", () => {
    const source = resolvePromptOptimizationSourceImage(
      definition("image_to_image", "generated-image"),
      "target",
      runDetail("succeeded")
    );

    expect(source).toEqual({
      asset_id: "asset-upstream",
      run_id: "run-42",
      source_handle: "image",
      source_node_id: "generated-image",
      target_handle: "image"
    });
    expect(JSON.stringify(source)).not.toContain("signed.example.com");
    expect(JSON.stringify(source)).not.toContain("signature");
  });

  it("uses an available image from a reused upstream RunNode", () => {
    expect(
      resolvePromptOptimizationSourceImage(
        definition("image_to_image", "generated-image"),
        "target",
        runDetail("reused")
      )
    ).toEqual({
      asset_id: "asset-upstream",
      run_id: "run-42",
      source_handle: "image",
      source_node_id: "generated-image",
      target_handle: "image"
    });
  });

  it.each([
    ["multiple image edges", "multiple"],
    ["a conflicting image input", "conflicting"],
    ["layer decomposition", "layers"],
    ["failed projection", "failed"],
    ["unavailable projection", "unavailable"],
    ["non-image projection", "non-image"]
  ])("omits the source for %s", (_label, scenario) => {
    const value =
      scenario === "layers"
        ? definition("layer_decomposition")
        : definition("image_to_image", "generated-image");
    if (scenario === "multiple") {
      value.edges.push({
        id: "second-source",
        sourceNodeId: "local-image",
        sourceHandle: "image",
        targetNodeId: "target",
        targetHandle: "image"
      });
    }
    if (scenario === "conflicting") {
      value.edges.push({
        id: "conflicting-edit-source",
        sourceNodeId: "local-image",
        sourceHandle: "image",
        targetNodeId: "target",
        targetHandle: "edit_image"
      });
    }
    const detail =
      scenario === "failed"
        ? runDetail("failed")
        : scenario === "unavailable"
          ? runDetail("succeeded", false)
          : scenario === "non-image"
            ? runDetail("succeeded", true, "video/mp4")
            : runDetail("succeeded");

    expect(
      resolvePromptOptimizationSourceImage(value, "target", detail)
    ).toBeNull();
  });
});
