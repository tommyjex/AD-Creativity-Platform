import type { createApiClient } from "@/lib/api-client";
import { migrateAigcDefinitionV2 } from "@/lib/aigc/definition-migration";
import { normalizeMultiTrackEditConfig } from "@/lib/aigc/multitrack";
import type { AigcTimelineSource } from "@/lib/aigc/multitrack-editor-store";
import type {
  AigcPipeline,
  AigcV2Node,
  MultiTrackKind
} from "@/lib/aigc/types";

type AigcApiClient = ReturnType<typeof createApiClient>;
type MultiTrackEditNode = Extract<
  AigcV2Node,
  { type: "multi_track_edit" }
>;

export interface AigcTimelineEditorData {
  node: MultiTrackEditNode;
  pipeline: AigcPipeline;
  sources: AigcTimelineSource[];
}

export async function loadAigcTimelineEditorData(
  api: Pick<AigcApiClient, "getAigcPipeline" | "getAsset">,
  pipelineId: string,
  nodeId: string
): Promise<AigcTimelineEditorData> {
  const pipeline = await api.getAigcPipeline(pipelineId, {
    cache: "no-store"
  });
  const definition = migrateAigcDefinitionV2(pipeline.definition);
  const node = definition.nodes.find(
    (candidate) => candidate.id === nodeId
  );
  if (node?.type !== "multi_track_edit") {
    throw new Error("目标节点不是多轨剪辑节点。");
  }
  const sources = await loadTimelineSources(api, pipeline, nodeId);

  return {
    node: {
      ...structuredClone(node),
      config: normalizeMultiTrackEditConfig(node.config)
    },
    pipeline,
    sources
  };
}

const INPUT_KIND: Record<string, Exclude<MultiTrackKind, "subtitle">> = {
  audios: "audio",
  images: "image",
  texts: "text",
  videos: "video"
};

export function timelineSources(
  pipeline: AigcPipeline,
  nodeId: string
): AigcTimelineSource[] {
  const seen = new Set<string>();
  return pipeline.definition.edges.flatMap((edge) => {
    if (edge.targetNodeId !== nodeId) return [];
    const kind = INPUT_KIND[edge.targetHandle];
    const key = `${edge.sourceNodeId}\u0000${edge.sourceHandle}`;
    if (!kind || seen.has(key)) return [];
    seen.add(key);
    return [
      {
        available: true,
        kind,
        source_handle: edge.sourceHandle,
        source_node_id: edge.sourceNodeId
      }
    ];
  });
}

async function loadTimelineSources(
  api: Pick<AigcApiClient, "getAsset">,
  pipeline: AigcPipeline,
  nodeId: string
): Promise<AigcTimelineSource[]> {
  const sources = timelineSources(pipeline, nodeId);
  return Promise.all(
    sources.map(async (source) => {
      if (source.kind !== "video" && source.kind !== "audio") return source;
      const sourceNode = pipeline.definition.nodes.find(
        (candidate) => candidate.id === source.source_node_id
      );
      if (
        !sourceNode ||
        sourceNode.type !== source.kind ||
        !sourceNode.config.asset_id
      ) {
        return source;
      }
      try {
        const asset = await api.getAsset(sourceNode.config.asset_id, {
          cache: "no-store"
        });
        return {
          ...source,
          duration_ms: assetDurationMs(asset.metadata)
        };
      } catch {
        return source;
      }
    })
  );
}

function assetDurationMs(metadata: Record<string, unknown>): number | null {
  const milliseconds = finiteNonNegativeNumber(metadata.duration_ms);
  if (milliseconds !== null) return Math.round(milliseconds);
  const seconds =
    finiteNonNegativeNumber(metadata.duration_seconds) ??
    finiteNonNegativeNumber(metadata.duration);
  return seconds === null ? null : Math.round(seconds * 1000);
}

function finiteNonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
