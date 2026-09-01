import { describe, expect, it } from "vitest";
import {
  aigcRunPollingInterval,
  layerPreviewFallbackRunId,
  newestActiveOrRecentRun
} from "@/lib/aigc/queries";
import type {
  AigcPipelineRun,
  AigcPipelineRunDetail,
  AigcPipelineRunStatus
} from "@/lib/aigc/types";

function run(id: string, status: AigcPipelineRunStatus): AigcPipelineRun {
  return {
    id,
    status
  } as AigcPipelineRun;
}

describe("AIGC run queries", () => {
  it("prefers an active run over a newer terminal run", () => {
    expect(
      newestActiveOrRecentRun([
        run("recent", "succeeded"),
        run("active", "running")
      ])?.id
    ).toBe("active");
  });

  it("polls active runs every two seconds and stops at terminal state", () => {
    expect(
      aigcRunPollingInterval({
        run: run("run-1", "queued"),
        nodes: []
      } as AigcPipelineRunDetail)
    ).toBe(2_000);
    expect(
      aigcRunPollingInterval({
        run: run("run-1", "succeeded"),
        nodes: []
      } as AigcPipelineRunDetail)
    ).toBe(false);
  });

  it("uses the latest successful run while an incremental run is active", () => {
    const current = {
      run: {
        ...run("active", "running"),
        source_run_id: "source"
      },
      nodes: []
    } as AigcPipelineRunDetail;

    expect(
      layerPreviewFallbackRunId(
        [run("active", "running"), run("successful", "succeeded")],
        current
      )
    ).toBe("successful");
    expect(
      layerPreviewFallbackRunId([run("active", "running")], current)
    ).toBe("source");
  });

  it("falls back to the newest successful run without a source run", () => {
    const current = {
      run: {
        ...run("active", "queued"),
        source_run_id: null
      },
      nodes: []
    } as AigcPipelineRunDetail;

    expect(
      layerPreviewFallbackRunId(
        [
          run("active", "queued"),
          run("failed", "failed"),
          run("successful", "succeeded")
        ],
        current
      )
    ).toBe("successful");
    expect(
      layerPreviewFallbackRunId(
        [run("successful", "succeeded")],
        {
          run: run("successful", "succeeded"),
          nodes: []
        } as AigcPipelineRunDetail
      )
    ).toBeNull();
  });
});
