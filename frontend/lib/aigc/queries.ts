"use client";

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { useMemo } from "react";
import { apiClient } from "@/lib/api-client";
import type {
  AigcPage,
  AigcPipelineRun,
  AigcPipelineRunCreate,
  AigcPipelineRunDetail
} from "@/lib/aigc/types";

const ACTIVE_RUN_STATUSES = new Set(["queued", "running"]);
const RUN_PAGE_SIZE = 100;

export type AigcRunDetailQueryState = "error" | "loading" | "success";

export interface AigcRunDetailsResult {
  details: ReadonlyMap<string, AigcPipelineRunDetail>;
  states: ReadonlyMap<string, AigcRunDetailQueryState>;
}

interface CombinedAigcRunDetails {
  details: ReadonlyMap<string, AigcPipelineRunDetail>;
  states: readonly AigcRunDetailQueryState[];
}

export const aigcQueryKeys = {
  all: ["aigc"] as const,
  pipeline: (pipelineId: string) =>
    ["aigc", "pipeline", pipelineId] as const,
  runs: (pipelineId: string) =>
    ["aigc", "pipeline", pipelineId, "runs"] as const,
  run: (runId: string) => ["aigc", "run", runId] as const
};

export function useAigcRuns(
  pipelineId: string,
  initialData?: AigcPage<AigcPipelineRun>,
  enabled = true
) {
  const completeInitialData =
    initialData && initialData.items.length >= initialData.total
      ? initialData
      : undefined;
  return useQuery({
    enabled,
    initialData: completeInitialData,
    queryFn: () => fetchAllAigcRuns(pipelineId),
    queryKey: aigcQueryKeys.runs(pipelineId),
    refetchInterval: (query) =>
      query.state.data?.items.some((run) =>
        ACTIVE_RUN_STATUSES.has(run.status)
      )
        ? 2_000
        : false
  });
}

export async function fetchAllAigcRuns(
  pipelineId: string
): Promise<AigcPage<AigcPipelineRun>> {
  const items: AigcPipelineRun[] = [];
  let total = 0;
  for (let page = 1; ; page += 1) {
    const response = await apiClient.listAigcRuns(pipelineId, {
      page,
      pageSize: RUN_PAGE_SIZE
    });
    items.push(...response.items);
    total = response.total;
    if (
      response.items.length === 0 ||
      items.length >= response.total
    ) {
      break;
    }
  }
  return {
    items,
    page: 1,
    page_size: RUN_PAGE_SIZE,
    total
  };
}

export function useAigcRunDetails(
  runs: readonly AigcPipelineRun[]
): AigcRunDetailsResult {
  const queries = useMemo(
    () =>
      runs.map((run) => ({
        queryFn: () => apiClient.getAigcRun(run.id),
        queryKey: aigcQueryKeys.run(run.id),
        refetchInterval: (query: {
          state: { data?: AigcPipelineRunDetail };
        }) => aigcRunDetailPollingInterval(run, query.state.data),
        retry: false
      })),
    [runs]
  );
  const combined = useQueries({
    queries,
    combine: combineAigcRunDetails
  });
  return useMemo(
    () => ({
      details: combined.details,
      states: new Map(
        runs.map(
          (run, index) =>
            [run.id, combined.states[index] ?? "loading"] as const
        )
      )
    }),
    [combined, runs]
  );
}

function combineAigcRunDetails(
  results: readonly {
    data?: AigcPipelineRunDetail;
    isError: boolean;
  }[]
): CombinedAigcRunDetails {
  const details = new Map<string, AigcPipelineRunDetail>();
  const states: AigcRunDetailQueryState[] = [];
  results.forEach((result) => {
    const detail = result.data;
    if (detail) {
      details.set(detail.run.id, detail);
      states.push(result.isError ? "error" : "success");
      return;
    }
    states.push(result.isError ? "error" : "loading");
  });
  return { details, states };
}

export function useAigcRun(runId: string | null) {
  return useQuery({
    enabled: runId !== null,
    queryFn: () => apiClient.getAigcRun(runId as string),
    queryKey: aigcQueryKeys.run(runId ?? "none"),
    refetchInterval: (query) => aigcRunPollingInterval(query.state.data)
  });
}

export function useCreateAigcRun(pipelineId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AigcPipelineRunCreate) =>
      apiClient.createAigcRun(
        pipelineId,
        payload,
        globalThis.crypto.randomUUID()
      ),
    onSuccess: (detail) => {
      queryClient.setQueryData(aigcQueryKeys.run(detail.run.id), detail);
      void queryClient.invalidateQueries({
        queryKey: aigcQueryKeys.runs(pipelineId)
      });
    }
  });
}

export function useRetryAigcNode(pipelineId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, runId }: { nodeId: string; runId: string }) =>
      apiClient.retryAigcRunNode(
        runId,
        nodeId,
        globalThis.crypto.randomUUID()
      ),
    onSuccess: (detail) => {
      queryClient.setQueryData(aigcQueryKeys.run(detail.run.id), detail);
      void queryClient.invalidateQueries({
        queryKey: aigcQueryKeys.runs(pipelineId)
      });
    }
  });
}

export function useCancelAigcRun(pipelineId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => apiClient.cancelAigcRun(runId),
    onSuccess: (detail) => {
      queryClient.setQueryData(aigcQueryKeys.run(detail.run.id), detail);
      void queryClient.invalidateQueries({
        queryKey: aigcQueryKeys.runs(pipelineId)
      });
    }
  });
}

export function newestActiveOrRecentRun(
  runs: AigcPipelineRun[]
): AigcPipelineRun | null {
  return (
    runs.find((run) => ACTIVE_RUN_STATUSES.has(run.status)) ??
    runs[0] ??
    null
  );
}

export function layerPreviewFallbackRunId(
  runs: AigcPipelineRun[],
  current: AigcPipelineRunDetail | undefined
): string | null {
  if (!current || !ACTIVE_RUN_STATUSES.has(current.run.status)) return null;
  const latestSuccessfulRun = runs.find(
    (run) => run.id !== current.run.id && run.status === "succeeded"
  );
  if (latestSuccessfulRun) return latestSuccessfulRun.id;
  if (
    current.run.source_run_id &&
    current.run.source_run_id !== current.run.id
  ) {
    return current.run.source_run_id;
  }
  return null;
}

export function isAigcRunActive(detail: AigcPipelineRunDetail | undefined) {
  return detail ? ACTIVE_RUN_STATUSES.has(detail.run.status) : false;
}

export function aigcRunPollingInterval(
  detail: AigcPipelineRunDetail | undefined
): 2000 | false {
  return detail && ACTIVE_RUN_STATUSES.has(detail.run.status) ? 2_000 : false;
}

export function aigcRunDetailPollingInterval(
  summary: AigcPipelineRun,
  detail: AigcPipelineRunDetail | undefined
): 2000 | false {
  if (detail) return aigcRunPollingInterval(detail);
  return ACTIVE_RUN_STATUSES.has(summary.status) ? 2_000 : false;
}
