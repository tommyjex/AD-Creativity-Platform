import { describe, expect, it } from "vitest";
import { resolveAigcLlmImageInput } from "@/lib/aigc/llm-image-input";
import type {
  AigcPipelineDefinitionV2,
  AigcPipelineRunDetail
} from "@/lib/aigc/types";

const definition: AigcPipelineDefinitionV2 = {
  schemaVersion: 2,
  nodes: [
    {
      id: "image",
      type: "image",
      custom_name: "产品主图",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        asset_id: "asset-image",
        bbox: null,
        bbox_asset_id: null,
        title: null
      }
    },
    {
      id: "llm",
      type: "llm",
      position: { x: 320, y: 0 },
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
      id: "image-to-llm",
      sourceNodeId: "image",
      sourceHandle: "image",
      targetNodeId: "llm",
      targetHandle: "image"
    }
  ],
  viewport: { x: 0, y: 0, zoom: 1 }
};

function imageRun(
  status: "succeeded" | "failed",
  available = true
): AigcPipelineRunDetail {
  return {
    run: {
      id: "run-1",
      pipeline_id: "pipeline-1",
      run_number: 1,
      pipeline_revision: 1,
      mode: "full",
      start_node_id: null,
      source_run_id: null,
      source_node_id: null,
      status: status === "succeeded" ? "succeeded" : "failed",
      definition_snapshot: definition,
      input_snapshot: {},
      error: null,
      cancellation_requested: false,
      created_at: "2026-09-20T00:00:00Z",
      updated_at: "2026-09-20T00:00:00Z",
      started_at: null,
      finished_at: null
    },
    nodes: [
      {
        node_id: "image",
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
              asset_id: "asset-image",
              ordinal: 0,
              mime_type: "image/png",
              download_url: null,
              available
            }
          ]
        },
        attempts: []
      }
    ]
  };
}

describe("LLM image input projection", () => {
  it("reports a connected source as ready only when its run image is available", () => {
    expect(resolveAigcLlmImageInput(definition, "llm", imageRun("succeeded"))).toEqual({
      sourceLabel: "产品主图",
      state: "ready",
      statusLabel: "图片已就绪"
    });
    expect(
      resolveAigcLlmImageInput(definition, "llm", imageRun("succeeded", false))
    ).toMatchObject({
      state: "unavailable",
      statusLabel: "图片来源不可用"
    });
  });

  it("keeps text-only fallback after the image edge is removed", () => {
    expect(
      resolveAigcLlmImageInput({ ...definition, edges: [] }, "llm")
    ).toEqual({
      sourceLabel: null,
      state: "disconnected",
      statusLabel: "未连接，按纯文本执行"
    });
  });

  it("surfaces upstream image failure without substituting a local image", () => {
    expect(resolveAigcLlmImageInput(definition, "llm", imageRun("failed"))).toMatchObject({
      sourceLabel: "产品主图",
      state: "unavailable",
      statusLabel: "图片来源运行失败"
    });
  });
});
