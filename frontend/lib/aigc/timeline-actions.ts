import type { createApiClient } from "@/lib/api-client";
import { migrateAigcDefinitionV2 } from "@/lib/aigc/definition-migration";
import { normalizeMultiTrackEditConfig } from "@/lib/aigc/multitrack";
import type {
  AigcPipeline,
  AigcPipelineRunDetail,
  MultiTrackEditConfig
} from "@/lib/aigc/types";

type AigcApiClient = ReturnType<typeof createApiClient>;
type TimelineSaveApi = Pick<AigcApiClient, "updateAigcPipeline">;
type TimelineExecuteApi = Pick<
  AigcApiClient,
  "createAigcRun" | "updateAigcPipeline"
>;

export async function saveAigcTimelineDraft(
  api: TimelineSaveApi,
  pipeline: AigcPipeline,
  nodeId: string,
  draft: MultiTrackEditConfig
): Promise<AigcPipeline> {
  const definition = migrateAigcDefinitionV2(pipeline.definition);
  const target = definition.nodes.find((node) => node.id === nodeId);
  if (target?.type !== "multi_track_edit") {
    throw new Error("目标节点不是多轨剪辑节点。");
  }
  const normalizedDraft = normalizeMultiTrackEditConfig(draft);

  return api.updateAigcPipeline(pipeline.id, {
    definition: {
      ...definition,
      nodes: definition.nodes.map((node) =>
        node.id === nodeId && node.type === "multi_track_edit"
          ? { ...node, config: normalizedDraft }
          : node
      )
    },
    description: pipeline.description,
    expected_revision: pipeline.revision,
    name: pipeline.name
  });
}

export async function executeAigcTimelineDraft(
  api: TimelineExecuteApi,
  pipeline: AigcPipeline,
  nodeId: string,
  draft: MultiTrackEditConfig,
  idempotencyKey = globalThis.crypto.randomUUID()
): Promise<{ pipeline: AigcPipeline; run: AigcPipelineRunDetail }> {
  const savedPipeline = await saveAigcTimelineDraft(
    api,
    pipeline,
    nodeId,
    draft
  );
  const run = await api.createAigcRun(
    pipeline.id,
    {
      expected_revision: savedPipeline.revision,
      mode: "from_node",
      start_node_id: nodeId
    },
    idempotencyKey
  );
  return { pipeline: savedPipeline, run };
}
