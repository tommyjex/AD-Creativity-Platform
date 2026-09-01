"use client";

import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  AigcPage,
  AigcPipelineRun,
  AigcPipelineRunCreate,
  AigcPipelineRunDetail
} from "@/lib/aigc/types";

const ACTIVE_RUN_STATUSES = new Set(["queued", "running"]);

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
  return useQuery({
    enabled,
    initialData,
    queryFn: () =>
      apiClient.listAigcRuns(pipelineId, { page: 1, pageSize: 20 }),
    queryKey: aigcQueryKeys.runs(pipelineId),
    refetchInterval: (query) =>
      query.state.data?.items.some((run) =>
        ACTIVE_RUN_STATUSES.has(run.status)
      )
        ? 2_000
        : false
  });
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
