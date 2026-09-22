import { describe, expect, it, vi } from "vitest";
import {
  executeAigcTimelineDraft,
  saveAigcTimelineDraft
} from "@/lib/aigc/timeline-actions";
import { loadAigcTimelineEditorData } from "@/lib/aigc/timeline-loader";
import type {
  AigcPipeline,
  AigcPipelineRun,
  AigcPipelineRunDetail,
  AigcV2Node,
  MultiTrackEditConfig
} from "@/lib/aigc/types";

const draft: MultiTrackEditConfig = {
  canvas: {
    mode: "custom",
    width: 1920,
    height: 1080,
    background_color: "#000000FF"
  },
  output: { format: "mp4", fps: 30 },
  tracks: [
    {
      id: "track-1",
      name: " 主轨 ",
      type: "video",
      order: 7,
      hidden: false,
      muted: false,
      elements: []
    }
  ]
};

const pipeline: AigcPipeline = {
  id: "pipeline-1",
  name: "广告成片",
  description: "多轨草稿",
  definition: {
    schemaVersion: 2,
    nodes: [
      {
        id: "edit-node",
        type: "multi_track_edit",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: draft
      }
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  },
  source_template_id: null,
  source_template_revision: null,
  revision: 4,
  latest_run_status: null,
  thumbnail_asset_id: null,
  thumbnail: null,
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z"
};

describe("AIGC timeline loader", () => {
  it("loads a no-store pipeline snapshot and normalizes the target draft", async () => {
    const getAigcPipeline = vi.fn().mockResolvedValue(pipeline);
    const getAsset = vi.fn();

    const loaded = await loadAigcTimelineEditorData(
      { getAigcPipeline, getAsset },
      pipeline.id,
      "edit-node"
    );

    expect(getAigcPipeline).toHaveBeenCalledWith(pipeline.id, {
      cache: "no-store"
    });
    expect(loaded.pipeline).toBe(pipeline);
    expect(loaded.node.config.tracks[0]).toMatchObject({
      id: "track-1",
      name: "主轨",
      order: 0
    });
    expect(loaded.node.config).not.toBe(draft);
    expect(loaded.sources).toEqual([]);
    expect(getAsset).not.toHaveBeenCalled();
  });

  it("loads media metadata and safe preview URLs for timeline sources", async () => {
    const mediaPipeline: AigcPipeline = {
      ...pipeline,
      definition: {
        schemaVersion: 2,
        nodes: [
          {
            id: "video-source",
            type: "video",
            position: { x: 0, y: 0 },
            size: { width: 240, height: 160 },
            config: { asset_id: "video-asset", title: null }
          },
          {
            id: "audio-source",
            type: "audio",
            position: { x: 0, y: 200 },
            size: { width: 240, height: 160 },
            config: { asset_id: "audio-asset", title: null }
          },
          {
            id: "image-source",
            type: "image",
            position: { x: 0, y: 400 },
            size: { width: 240, height: 160 },
            config: {
              asset_id: "image-asset",
              bbox: null,
              bbox_asset_id: null,
              title: null
            }
          },
          pipeline.definition.nodes[0]! as AigcV2Node
        ],
        edges: [
          {
            id: "video-edge",
            sourceNodeId: "video-source",
            sourceHandle: "video",
            targetNodeId: "edit-node",
            targetHandle: "videos"
          },
          {
            id: "audio-edge",
            sourceNodeId: "audio-source",
            sourceHandle: "audio",
            targetNodeId: "edit-node",
            targetHandle: "audios"
          },
          {
            id: "image-edge",
            sourceNodeId: "image-source",
            sourceHandle: "image",
            targetNodeId: "edit-node",
            targetHandle: "images"
          }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    };
    const getAsset = vi.fn().mockImplementation(async (assetId: string) => ({
      id: assetId,
      metadata:
        assetId === "video-asset"
          ? { duration_seconds: 2.5 }
          : assetId === "audio-asset"
            ? { duration_ms: 1800 }
            : {},
      mime_type:
        assetId === "image-asset" ? "image/png" : `${assetId.split("-")[0]}/mp4`,
      url:
        assetId === "audio-asset"
          ? null
          : `/api/assets/${assetId}/content`
    }));

    const loaded = await loadAigcTimelineEditorData(
      {
        getAigcPipeline: vi.fn().mockResolvedValue(mediaPipeline),
        getAsset
      },
      pipeline.id,
      "edit-node"
    );

    expect(loaded.sources).toEqual([
      expect.objectContaining({
        source_node_id: "video-source",
        duration_ms: 2500,
        mime_type: "video/mp4",
        preview_url: expect.stringContaining(
          "/api/assets/video-asset/content"
        )
      }),
      expect.objectContaining({
        source_node_id: "audio-source",
        duration_ms: 1800,
        preview_url: null
      }),
      expect.objectContaining({
        source_node_id: "image-source",
        mime_type: "image/png",
        preview_url: expect.stringContaining(
          "/api/assets/image-asset/content"
        )
      })
    ]);
    expect(getAsset).toHaveBeenCalledTimes(3);
  });

  it("loads text from the newest successful Run that projects the source", async () => {
    const textPipeline = pipelineWithTextSource({
      id: "copy-node",
      type: "llm",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seed-1-6-251015",
        system_prompt: "",
        temperature: 0.2
      }
    });
    const olderRun = successfulRun(textPipeline, "run-older", 4);
    const newestRun = successfulRun(textPipeline, "run-newest", 5);
    const disjointRun = {
      ...successfulRun(textPipeline, "run-disjoint", 6),
      mode: "from_node" as const,
      start_node_id: "other-node"
    };
    const getAigcRun = vi.fn().mockResolvedValue({
      run: newestRun,
      nodes: [
        {
          node_id: "copy-node",
          included_in_plan: true,
          status: "succeeded",
          current_task_id: null,
          reused_from_task_id: null,
          input_hash: null,
          result: {
            kind: "text",
            text: "最新真实文案",
            text_digest: null
          },
          attempts: []
        }
      ]
    } as unknown as AigcPipelineRunDetail);

    const loaded = await loadAigcTimelineEditorData(
      {
        getAigcPipeline: vi.fn().mockResolvedValue(textPipeline),
        getAsset: vi.fn(),
        getAigcRun,
        listAigcRuns: vi.fn().mockResolvedValue({
          items: [olderRun, disjointRun, newestRun],
          page: 1,
          page_size: 20,
          total: 3
        })
      },
      pipeline.id,
      "edit-node"
    );

    expect(loaded.sources).toContainEqual(
      expect.objectContaining({
        preview_text: "最新真实文案",
        source_node_id: "copy-node",
        text_preview_status: "resolved"
      })
    );
    expect(getAigcRun).toHaveBeenCalledTimes(1);
    expect(getAigcRun).toHaveBeenCalledWith(
      "run-newest",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("falls back to configured static text when no Run result exists", async () => {
    const textPipeline = pipelineWithTextSource({
      id: "copy-node",
      type: "text",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        text: "当前静态文案",
        bbox_references: [],
        title: null
      }
    });

    const loaded = await loadAigcTimelineEditorData(
      {
        getAigcPipeline: vi.fn().mockResolvedValue(textPipeline),
        getAsset: vi.fn(),
        getAigcRun: vi.fn(),
        listAigcRuns: vi.fn().mockRejectedValue(new Error("run api down"))
      },
      pipeline.id,
      "edit-node"
    );

    expect(loaded.sources).toContainEqual(
      expect.objectContaining({
        preview_text: "当前静态文案",
        source_node_id: "copy-node",
        text_preview_status: "configured"
      })
    );
  });

  it("keeps dynamic text unavailable when Run lookup fails", async () => {
    const textPipeline = pipelineWithTextSource({
      id: "copy-node",
      type: "llm",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seed-1-6-251015",
        system_prompt: "",
        temperature: 0.2
      }
    });

    const loaded = await loadAigcTimelineEditorData(
      {
        getAigcPipeline: vi.fn().mockResolvedValue(textPipeline),
        getAsset: vi.fn(),
        getAigcRun: vi.fn(),
        listAigcRuns: vi.fn().mockRejectedValue(new Error("run api down"))
      },
      pipeline.id,
      "edit-node"
    );

    expect(loaded.sources).toContainEqual(
      expect.objectContaining({
        preview_text: null,
        source_node_id: "copy-node",
        text_preview_status: "unavailable"
      })
    );
  });

  it("rejects missing or non-multi-track nodes", async () => {
    const wrongPipeline: AigcPipeline = {
      ...pipeline,
      definition: {
        schemaVersion: 2,
        nodes: [
          {
            id: "text-node",
            type: "text",
            position: { x: 0, y: 0 },
            size: { width: 240, height: 160 },
            config: { text: "", bbox_references: [], title: null }
          }
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    };

    await expect(
      loadAigcTimelineEditorData(
        {
          getAigcPipeline: vi.fn().mockResolvedValue(wrongPipeline),
          getAsset: vi.fn()
        },
        pipeline.id,
        "text-node"
      )
    ).rejects.toThrow("目标节点不是多轨剪辑节点");
  });
});

function pipelineWithTextSource(sourceNode: AigcV2Node): AigcPipeline {
  return {
    ...pipeline,
    definition: {
      schemaVersion: 2,
      nodes: [
        sourceNode,
        {
          id: "other-node",
          type: "text",
          position: { x: 0, y: 200 },
          size: { width: 240, height: 160 },
          config: {
            text: "独立分支",
            bbox_references: [],
            title: null
          }
        },
        pipeline.definition.nodes[0] as AigcV2Node
      ],
      edges: [
        {
          id: "text-edge",
          sourceNodeId: sourceNode.id,
          sourceHandle: "text",
          targetNodeId: "edit-node",
          targetHandle: "texts"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  };
}

function successfulRun(
  sourcePipeline: AigcPipeline,
  id: string,
  runNumber: number
): AigcPipelineRun {
  return {
    id,
    pipeline_id: sourcePipeline.id,
    run_number: runNumber,
    pipeline_revision: sourcePipeline.revision,
    mode: "full",
    start_node_id: null,
    source_run_id: null,
    source_node_id: null,
    status: "succeeded",
    definition_snapshot: sourcePipeline.definition,
    input_snapshot: {},
    error: null,
    cancellation_requested: false,
    created_at: "2026-09-13T00:00:00Z",
    updated_at: "2026-09-13T00:00:01Z",
    started_at: "2026-09-13T00:00:00Z",
    finished_at: "2026-09-13T00:00:01Z"
  };
}

describe("AIGC timeline revision actions", () => {
  it("saves only the target config against the loaded revision", async () => {
    const updateAigcPipeline = vi.fn().mockResolvedValue({
      ...pipeline,
      revision: 5
    });

    const saved = await saveAigcTimelineDraft(
      { updateAigcPipeline },
      pipeline,
      "edit-node",
      draft
    );

    expect(saved.revision).toBe(5);
    expect(updateAigcPipeline).toHaveBeenCalledWith("pipeline-1", {
      definition: expect.objectContaining({
        nodes: [
          expect.objectContaining({
            id: "edit-node",
            config: expect.objectContaining({
              tracks: [expect.objectContaining({ name: "主轨", order: 0 })]
            })
          })
        ]
      }),
      description: "多轨草稿",
      expected_revision: 4,
      name: "广告成片"
    });
  });

  it("saves first and starts a run from the node using the saved revision", async () => {
    const calls: string[] = [];
    const savedPipeline = { ...pipeline, revision: 5 };
    const runDetail = {
      run: { id: "run-1" },
      nodes: []
    } as unknown as AigcPipelineRunDetail;
    const updateAigcPipeline = vi.fn().mockImplementation(async () => {
      calls.push("save");
      return savedPipeline;
    });
    const createAigcRun = vi.fn().mockImplementation(async () => {
      calls.push("run");
      return runDetail;
    });

    const result = await executeAigcTimelineDraft(
      { createAigcRun, updateAigcPipeline },
      pipeline,
      "edit-node",
      draft,
      "timeline-run-key"
    );

    expect(calls).toEqual(["save", "run"]);
    expect(createAigcRun).toHaveBeenCalledWith(
      "pipeline-1",
      {
        expected_revision: 5,
        mode: "from_node",
        start_node_id: "edit-node"
      },
      "timeline-run-key"
    );
    expect(result).toEqual({ pipeline: savedPipeline, run: runDetail });
  });

  it("does not start a run when the revision-safe save fails", async () => {
    const conflict = Object.assign(new Error("revision conflict"), {
      status: 409
    });
    const createAigcRun = vi.fn();

    await expect(
      executeAigcTimelineDraft(
        {
          createAigcRun,
          updateAigcPipeline: vi.fn().mockRejectedValue(conflict)
        },
        pipeline,
        "edit-node",
        draft,
        "timeline-run-key"
      )
    ).rejects.toBe(conflict);
    expect(createAigcRun).not.toHaveBeenCalled();
  });
});
