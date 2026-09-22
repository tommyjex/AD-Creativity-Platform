import type { createApiClient } from "@/lib/api-client";
import { getSafePreviewUrl } from "@/lib/asset-display";
import { migrateAigcDefinitionV2 } from "@/lib/aigc/definition-migration";
import { normalizeMultiTrackEditConfig } from "@/lib/aigc/multitrack";
import type { AigcTimelineSource } from "@/lib/aigc/multitrack-editor-store";
import { getAigcRunProjectionNodeIds } from "@/lib/aigc/run-scope";
import type {
  AigcPipeline,
  AigcPipelineRunDetail,
  AigcV2Node,
  MultiTrackKind
} from "@/lib/aigc/types";

type AigcApiClient = ReturnType<typeof createApiClient>;
type TimelineLoaderApi = Pick<
  AigcApiClient,
  "getAigcPipeline" | "getAsset"
> &
  Partial<Pick<AigcApiClient, "getAigcRun" | "listAigcRuns">>;
type MultiTrackEditNode = Extract<
  AigcV2Node,
  { type: "multi_track_edit" }
>;
const RUN_PAGE_SIZE = 20;
const RUN_DETAIL_TIMEOUT_MS = 5_000;

export interface AigcTimelineEditorData {
  node: MultiTrackEditNode;
  pipeline: AigcPipeline;
  sources: AigcTimelineSource[];
}

export async function loadAigcTimelineEditorData(
  api: TimelineLoaderApi,
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
  api: TimelineLoaderApi,
  pipeline: AigcPipeline,
  nodeId: string
): Promise<AigcTimelineSource[]> {
  const sources = timelineSources(pipeline, nodeId);
  const sourcesWithMedia = await Promise.all(
    sources.map(async (source) => {
      if (
        source.kind !== "video" &&
        source.kind !== "audio" &&
        source.kind !== "image"
      ) {
        return source;
      }
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
          duration_ms:
            source.kind === "video" || source.kind === "audio"
              ? assetDurationMs(asset.metadata)
              : null,
          mime_type: asset.mime_type,
          preview_url:
            source.kind === "video" || source.kind === "image"
              ? getSafePreviewUrl(asset)
              : null
        };
      } catch {
        return source;
      }
    })
  );
  return loadTextPreviews(api, pipeline, sourcesWithMedia);
}

async function loadTextPreviews(
  api: TimelineLoaderApi,
  pipeline: AigcPipeline,
  sources: AigcTimelineSource[]
): Promise<AigcTimelineSource[]> {
  const unresolved = new Map(
    sources
      .filter((source) => source.kind === "text")
      .map((source) => [sourceKey(source), source])
  );
  const resolved = new Map<string, string>();

  if (api.listAigcRuns && api.getAigcRun && unresolved.size > 0) {
    try {
      for (let page = 1; unresolved.size > 0; page += 1) {
        const runs = await api.listAigcRuns(
          pipeline.id,
          { page, pageSize: RUN_PAGE_SIZE },
          { cache: "no-store" }
        );
        const successfulRuns = runs.items
          .filter((run) => run.status === "succeeded")
          .toSorted((left, right) => right.run_number - left.run_number);
        for (const run of successfulRuns) {
          const scope = getAigcRunProjectionNodeIds(run);
          const candidateSources = [...unresolved.entries()].filter(
            ([, source]) => scope.has(source.source_node_id)
          );
          if (candidateSources.length === 0) continue;
          let detail: AigcPipelineRunDetail;
          try {
            detail = await getRunDetailWithTimeout(api.getAigcRun, run.id);
          } catch {
            continue;
          }
          for (const [key, source] of candidateSources) {
            const runNode = detail.nodes.find(
              (candidate) => candidate.node_id === source.source_node_id
            );
            const text =
              runNode &&
              (runNode.status === "succeeded" ||
                runNode.status === "reused") &&
              runNode.result.kind === "text"
                ? runNode.result.text?.trim()
                : null;
            if (!text) continue;
            resolved.set(key, text);
            unresolved.delete(key);
          }
        }
        if (
          runs.items.length === 0 ||
          page * runs.page_size >= runs.total
        ) {
          break;
        }
      }
    } catch {
      // Run history is optional preview context and must not block the editor.
    }
  }

  return sources.map((source) => {
    if (source.kind !== "text") return source;
    const runText = resolved.get(sourceKey(source));
    if (runText) {
      return {
        ...source,
        preview_text: runText,
        text_preview_status: "resolved"
      };
    }
    const configuredText = configuredStaticText(pipeline, source);
    return configuredText
      ? {
          ...source,
          preview_text: configuredText,
          text_preview_status: "configured"
        }
      : {
          ...source,
          preview_text: null,
          text_preview_status: "unavailable"
        };
  });
}

async function getRunDetailWithTimeout(
  getAigcRun: NonNullable<TimelineLoaderApi["getAigcRun"]>,
  runId: string
): Promise<AigcPipelineRunDetail> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getAigcRun(runId, {
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

function configuredStaticText(
  pipeline: AigcPipeline,
  source: AigcTimelineSource
): string | null {
  const node = pipeline.definition.nodes.find(
    (candidate) => candidate.id === source.source_node_id
  );
  if (
    node?.type !== "text" ||
    node.config.generated_by_parser_node_id != null ||
    pipeline.definition.edges.some(
      (edge) =>
        edge.targetNodeId === node.id && edge.targetHandle === "text"
    )
  ) {
    return null;
  }
  return node.config.text.trim() || null;
}

function sourceKey(source: {
  source_handle: string;
  source_node_id: string;
}): string {
  return `${source.source_node_id}\u0000${source.source_handle}`;
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
