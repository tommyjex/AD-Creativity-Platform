import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  aigcRunDetailPollingInterval,
  fetchAllAigcRuns
} from "@/lib/aigc/queries";
import type {
  AigcPage,
  AigcPipelineRun,
  AigcPipelineRunDetail
} from "@/lib/aigc/types";

const apiMocks = vi.hoisted(() => ({
  listAigcRuns: vi.fn()
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: apiMocks
}));

function run(
  id: string,
  runNumber: number,
  status: AigcPipelineRun["status"] = "succeeded"
): AigcPipelineRun {
  return {
    id,
    pipeline_id: "pipeline",
    run_number: runNumber,
    pipeline_revision: 1,
    mode: "from_node",
    start_node_id: "node",
    source_run_id: null,
    source_node_id: null,
    status,
    definition_snapshot: {
      schemaVersion: 2,
      nodes: [
        {
          id: "node",
          type: "text",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { text: "", bbox_references: [], title: null }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    },
    input_snapshot: {},
    error: null,
    cancellation_requested: false,
    created_at: "2026-09-05T00:00:00Z",
    updated_at: "2026-09-05T00:00:00Z",
    started_at: "2026-09-05T00:00:00Z",
    finished_at:
      status === "queued" || status === "running"
        ? null
        : "2026-09-05T00:01:00Z"
  };
}

describe("AIGC Run queries", () => {
  beforeEach(() => {
    apiMocks.listAigcRuns.mockReset();
  });

  it("loads every Run page instead of stopping at the first 100", async () => {
    const pages: AigcPage<AigcPipelineRun>[] = [
      {
        items: Array.from({ length: 100 }, (_, index) =>
          run(`run-${index + 1}`, 205 - index)
        ),
        page: 1,
        page_size: 100,
        total: 205
      },
      {
        items: Array.from({ length: 100 }, (_, index) =>
          run(`run-${index + 101}`, 105 - index)
        ),
        page: 2,
        page_size: 100,
        total: 205
      },
      {
        items: Array.from({ length: 5 }, (_, index) =>
          run(`run-${index + 201}`, 5 - index, index === 4 ? "running" : "succeeded")
        ),
        page: 3,
        page_size: 100,
        total: 205
      }
    ];
    apiMocks.listAigcRuns.mockImplementation(
      async (_pipelineId: string, filters: { page: number }) =>
        pages[filters.page - 1]
    );

    const result = await fetchAllAigcRuns("pipeline");

    expect(result.items).toHaveLength(205);
    expect(result.items.at(-1)?.status).toBe("running");
    expect(apiMocks.listAigcRuns).toHaveBeenNthCalledWith(3, "pipeline", {
      page: 3,
      pageSize: 100
    });
  });

  it("keeps polling an active summary when its detail is loading or failed", () => {
    const active = run("active", 2, "running");
    const failedDetail: AigcPipelineRunDetail = {
      run: { ...active, status: "failed", finished_at: "2026-09-05T00:02:00Z" },
      nodes: []
    };

    expect(aigcRunDetailPollingInterval(active, undefined)).toBe(2_000);
    expect(aigcRunDetailPollingInterval(active, failedDetail)).toBe(false);
    expect(
      aigcRunDetailPollingInterval(run("terminal", 1), undefined)
    ).toBe(false);
  });
});
