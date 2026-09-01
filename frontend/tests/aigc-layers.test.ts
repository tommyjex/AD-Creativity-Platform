import { describe, expect, it, vi } from "vitest";
import {
  loadAigcLayerEditorData,
  RUN_DETAIL_TIMEOUT_MS
} from "@/lib/aigc/layer-editor-loader";
import {
  applyLayerCanvasConfig,
  createLayerTransformPatches,
  findUpstreamLayerSet,
  layerCanvasSourceIsCurrent
} from "@/lib/aigc/layers";
import type {
  AigcLayerSet,
  AigcPipeline,
  AigcPipelineRunDetail
} from "@/lib/aigc/types";

const layerSet: AigcLayerSet = {
  id: "set-1",
  parent_layer_set_id: null,
  source_asset_id: "source",
  base_asset_id: "base",
  canvas_width: 1000,
  canvas_height: 500,
  version: 0,
  digest: "a".repeat(64),
  layers: [
    {
      id: "layer-1",
      asset_id: "asset-1",
      z_index: 1,
      name: "商品",
      description: "",
      bbox_absolute: [100, 50, 300, 250],
      bbox_normalized: [100, 100, 300, 500],
      visible: true,
      x: 100,
      y: 50,
      scale: 1
    },
    {
      id: "layer-2",
      asset_id: "asset-2",
      z_index: 2,
      name: "文字",
      description: "",
      bbox_absolute: [400, 100, 700, 200],
      bbox_normalized: [400, 200, 700, 400],
      visible: true,
      x: 400,
      y: 100,
      scale: 1
    }
  ]
};

const pipeline: AigcPipeline = {
  id: "pipeline-1",
  name: "图层流程",
  description: "",
  definition: {
    schemaVersion: 1,
    nodes: [
      {
        id: "source-node",
        type: "image_to_image",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: {
          model: "doubao-seedream-5-0-pro-260628",
          operation: "layer_decomposition",
          aspect_ratio: "1:1",
          size: "2K",
          format: "png"
        }
      },
      {
        id: "canvas-node",
        type: "layer_canvas",
        position: { x: 300, y: 0 },
        size: { width: 240, height: 180 },
        config: {
          selected_layer_id: null,
          source_layer_set: null,
          transform_patches: []
        }
      }
    ],
    edges: [
      {
        id: "edge-layers",
        sourceNodeId: "source-node",
        sourceHandle: "layers",
        targetNodeId: "canvas-node",
        targetHandle: "layers"
      }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
  },
  source_template_id: null,
  source_template_revision: null,
  revision: 4,
  latest_run_status: "succeeded",
  created_at: "2026-08-30T10:00:00Z",
  updated_at: "2026-08-30T10:00:00Z"
};

function runDetail(
  id: string,
  resultLayerSet: AigcLayerSet | null
): AigcPipelineRunDetail {
  return {
    run: {
      id,
      pipeline_id: pipeline.id,
      run_number: Number(id.split("-").at(-1)),
      pipeline_revision: pipeline.revision,
      mode: "full",
      start_node_id: null,
      source_run_id: null,
      source_node_id: null,
      status: "succeeded",
      definition_snapshot: pipeline.definition,
      input_snapshot: {},
      error: null,
      cancellation_requested: false,
      created_at: "2026-08-30T10:00:00Z",
      updated_at: "2026-08-30T10:00:00Z",
      started_at: "2026-08-30T10:00:00Z",
      finished_at: "2026-08-30T10:01:00Z"
    },
    nodes: [
      {
        node_id: "source-node",
        included_in_plan: true,
        status: resultLayerSet ? "succeeded" : "failed",
        current_task_id: null,
        reused_from_task_id: null,
        input_hash: null,
        result: {
          kind: resultLayerSet ? "layer_set" : "none",
          text: null,
          text_digest: null,
          assets: [],
          layer_set: resultLayerSet
        },
        attempts: []
      }
    ]
  };
}

describe("AIGC layer canvas helpers", () => {
  it("restores matching saved patches and rejects stale source digests", () => {
    const config = {
      selected_layer_id: "layer-1",
      source_layer_set: {
        id: layerSet.id,
        version: layerSet.version,
        digest: layerSet.digest
      },
      transform_patches: [
        { layer_id: "layer-1", x: 220, scale: 1.5 },
        { layer_id: "layer-2", deleted: true }
      ]
    };

    expect(layerCanvasSourceIsCurrent(config, layerSet)).toBe(true);
    expect(applyLayerCanvasConfig(layerSet, config)).toEqual([
      expect.objectContaining({ id: "layer-1", x: 220, scale: 1.5 })
    ]);

    const changed = { ...layerSet, digest: "b".repeat(64) };
    expect(layerCanvasSourceIsCurrent(config, changed)).toBe(false);
    expect(applyLayerCanvasConfig(changed, config)).toHaveLength(2);
  });

  it("creates minimal transform and deletion patches", () => {
    const patches = createLayerTransformPatches(layerSet.layers, [
      { ...layerSet.layers[1], z_index: 1, visible: false }
    ]);

    expect(patches).toEqual([
      { deleted: true, layer_id: "layer-1" },
      { layer_id: "layer-2", visible: false, z_index: 1 }
    ]);
  });

  it("loads the latest successful direct upstream layer set", async () => {
    const older = runDetail("run-1", layerSet);
    const newer = runDetail("run-2", null);
    const api = {
      getAigcPipeline: vi.fn().mockResolvedValue(pipeline),
      listAigcRuns: vi.fn().mockResolvedValue({
        items: [older.run, newer.run],
        page: 1,
        page_size: 20,
        total: 2
      }),
      getAigcRun: vi.fn((id: string) =>
        Promise.resolve(id === newer.run.id ? newer : older)
      )
    };

    await expect(
      loadAigcLayerEditorData(api, pipeline.id, "canvas-node")
    ).resolves.toEqual({ layerSet, pipeline, runId: older.run.id });
    expect(findUpstreamLayerSet(pipeline.definition.edges, "canvas-node", [
      newer,
      older
    ])).toBe(layerSet);
  });

  it("continues pagination past 20 failed runs to find the latest layer set", async () => {
    const successful = runDetail("run-1", layerSet);
    const failed = Array.from({ length: 20 }, (_, index) =>
      runDetail(`run-${index + 2}`, null)
    ).reverse();
    const api = {
      getAigcPipeline: vi.fn().mockResolvedValue(pipeline),
      listAigcRuns: vi.fn(
        (_pipelineId: string, filters: { page?: number }) =>
          Promise.resolve({
            items: filters.page === 1
              ? failed.map((detail) => detail.run)
              : [successful.run],
            page: filters.page ?? 1,
            page_size: 20,
            total: 21
          })
      ),
      getAigcRun: vi.fn((id: string) =>
        Promise.resolve(
          id === successful.run.id
            ? successful
            : failed.find((detail) => detail.run.id === id)!
        )
      )
    };

    await expect(
      loadAigcLayerEditorData(api, pipeline.id, "canvas-node")
    ).resolves.toEqual({ layerSet, pipeline, runId: successful.run.id });
    expect(api.listAigcRuns).toHaveBeenNthCalledWith(
      2,
      pipeline.id,
      { page: 2, pageSize: 20 },
      { cache: "no-store" }
    );
    expect(api.getAigcRun).toHaveBeenCalledTimes(21);
  });

  it("supports the real 17-asset layer-set shape", async () => {
    const realLayerSet = {
      ...layerSet,
      layers: Array.from({ length: 16 }, (_, index) => ({
        ...layerSet.layers[0],
        id: `layer-${index + 1}`,
        asset_id: `asset-${index + 1}`,
        name: `图层 ${index + 1}`,
        z_index: index + 1
      }))
    };
    const detail = runDetail("run-17", realLayerSet);
    const api = {
      getAigcPipeline: vi.fn().mockResolvedValue(pipeline),
      listAigcRuns: vi.fn().mockResolvedValue({
        items: [detail.run],
        page: 1,
        page_size: 20,
        total: 1
      }),
      getAigcRun: vi.fn().mockResolvedValue(detail)
    };

    const loaded = await loadAigcLayerEditorData(
      api,
      pipeline.id,
      "canvas-node"
    );

    expect([
      loaded.layerSet.base_asset_id,
      ...loaded.layerSet.layers.map((layer) => layer.asset_id)
    ]).toHaveLength(17);
    expect(loaded.runId).toBe("run-17");
  });

  it("stops reading run details as soon as the latest successful layer set is found", async () => {
    const newest = runDetail("run-3", layerSet);
    const older = runDetail("run-2", layerSet);
    const api = {
      getAigcPipeline: vi.fn().mockResolvedValue(pipeline),
      listAigcRuns: vi.fn().mockResolvedValue({
        items: [older.run, newest.run],
        page: 1,
        page_size: 20,
        total: 2
      }),
      getAigcRun: vi.fn().mockResolvedValue(newest)
    };

    await expect(
      loadAigcLayerEditorData(api, pipeline.id, "canvas-node")
    ).resolves.toEqual({ layerSet, pipeline, runId: newest.run.id });
    expect(api.getAigcRun).toHaveBeenCalledTimes(1);
    expect(api.getAigcRun).toHaveBeenCalledWith(
      newest.run.id,
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal)
      })
    );
  });

  it("aborts a never-settling run detail and continues with the next run", async () => {
    vi.useFakeTimers();
    try {
      const newest = runDetail("run-3", null);
      const older = runDetail("run-2", layerSet);
      let newestSignal: AbortSignal | undefined;
      const api = {
        getAigcPipeline: vi.fn().mockResolvedValue(pipeline),
        listAigcRuns: vi.fn().mockResolvedValue({
          items: [newest.run, older.run],
          page: 1,
          page_size: 20,
          total: 2
        }),
        getAigcRun: vi.fn(
          (id: string, options?: { signal?: AbortSignal }) => {
            if (id === newest.run.id) {
              newestSignal = options?.signal;
              return new Promise<AigcPipelineRunDetail>(() => undefined);
            }
            return Promise.resolve(older);
          }
        )
      };

      const loading = loadAigcLayerEditorData(
        api,
        pipeline.id,
        "canvas-node"
      );
      await vi.advanceTimersByTimeAsync(RUN_DETAIL_TIMEOUT_MS);

      await expect(loading).resolves.toEqual({
        layerSet,
        pipeline,
        runId: older.run.id
      });
      expect(newestSignal?.aborted).toBe(true);
      expect(api.getAigcRun).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
