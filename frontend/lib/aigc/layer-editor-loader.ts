import type { createApiClient } from "@/lib/api-client";
import { findUpstreamLayerSet } from "@/lib/aigc/layers";
import type { AigcLayerSet, AigcPipeline } from "@/lib/aigc/types";

type AigcApiClient = ReturnType<typeof createApiClient>;

export interface AigcLayerEditorData {
  layerSet: AigcLayerSet;
  pipeline: AigcPipeline;
  runId: string;
}

const RUN_PAGE_SIZE = 20;
export const RUN_DETAIL_TIMEOUT_MS = 5_000;

export async function loadAigcLayerEditorData(
  api: Pick<AigcApiClient, "getAigcPipeline" | "getAigcRun" | "listAigcRuns">,
  pipelineId: string,
  nodeId: string
): Promise<AigcLayerEditorData> {
  const pipeline = await api.getAigcPipeline(pipelineId, {
    cache: "no-store"
  });
  const node = pipeline.definition.nodes.find(
    (candidate) => candidate.id === nodeId
  );
  if (node?.type !== "layer_canvas") {
    throw new Error("目标节点不是图层画布节点。");
  }

  for (let page = 1; ; page += 1) {
    const runs = await api.listAigcRuns(
      pipelineId,
      { page, pageSize: RUN_PAGE_SIZE },
      { cache: "no-store" }
    );
    const orderedRuns = runs.items.toSorted(
      (left, right) => right.run_number - left.run_number
    );
    for (const run of orderedRuns) {
      try {
        const detail = await getRunDetailWithTimeout(api, run.id);
        const layerSet = findUpstreamLayerSet(
          pipeline.definition.edges,
          nodeId,
          [detail]
        );
        if (layerSet) return { layerSet, pipeline, runId: run.id };
      } catch {
        // A missing or stalled historical run must not block older candidates.
      }
    }
    if (
      runs.items.length === 0 ||
      page * runs.page_size >= runs.total
    ) {
      break;
    }
  }
  throw new Error("尚未找到成功的上游图层集，请先运行图层拆分节点。");
}

async function getRunDetailWithTimeout(
  api: Pick<AigcApiClient, "getAigcRun">,
  runId: string
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      api.getAigcRun(runId, {
        cache: "no-store",
        signal: controller.signal
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error(`AIGC run detail timed out: ${runId}`));
        }, RUN_DETAIL_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
