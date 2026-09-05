import type {
  AigcPipelineDefinition,
  AigcPipelineDefinitionV2,
  AigcPipelineRun,
  AigcPipelineRunDetail,
  AigcPipelineRunStatus
} from "@/lib/aigc/types";

type AigcDefinition =
  | AigcPipelineDefinition
  | AigcPipelineDefinitionV2;

export const ACTIVE_AIGC_RUN_STATUSES: ReadonlySet<AigcPipelineRunStatus> =
  new Set(["queued", "running"]);

export interface AigcRunProjection {
  isNodeActive(nodeId: string): boolean;
  activeRunForNode(nodeId: string): AigcPipelineRunDetail | null;
  displayRunForNode(nodeId: string): AigcPipelineRunDetail | null;
  latestSuccessfulRunForNode(
    nodeId: string
  ): AigcPipelineRunDetail | null;
  hasAnyActiveRun: boolean;
}

export function getConnectedAigcNodeIds(
  definition: AigcDefinition,
  startNodeId: string
): ReadonlySet<string> {
  const nodeIds = new Set(definition.nodes.map((node) => node.id));
  if (!nodeIds.has(startNodeId)) return new Set();

  const adjacency = new Map(
    [...nodeIds].map((nodeId) => [nodeId, new Set<string>()] as const)
  );
  for (const edge of definition.edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      continue;
    }
    adjacency.get(edge.sourceNodeId)?.add(edge.targetNodeId);
    adjacency.get(edge.targetNodeId)?.add(edge.sourceNodeId);
  }

  const connected = new Set([startNodeId]);
  const pending = [startNodeId];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (connected.has(neighbor)) continue;
      connected.add(neighbor);
      pending.push(neighbor);
    }
  }
  return connected;
}

export function getAigcRunScopeNodeIds(
  run: AigcPipelineRun
): ReadonlySet<string> {
  if (run.mode === "full") {
    return new Set(run.definition_snapshot.nodes.map((node) => node.id));
  }
  if (run.start_node_id === null) return new Set();
  return getConnectedAigcNodeIds(
    run.definition_snapshot,
    run.start_node_id
  );
}

export function selectAigcProjectionRunIds(
  definition: AigcDefinition,
  runs: readonly AigcPipelineRun[],
  selectedRunId: string | null
): string[] {
  const selectedIds = new Set<string>();
  const newestFirst = newestRunsFirst(runs);

  for (const run of newestFirst) {
    if (ACTIVE_AIGC_RUN_STATUSES.has(run.status)) {
      selectedIds.add(run.id);
    }
  }
  if (selectedRunId !== null) selectedIds.add(selectedRunId);

  for (const flowScope of getDefinitionFlowScopes(definition)) {
    const latestTerminal = newestFirst.find(
      (run) =>
        !ACTIVE_AIGC_RUN_STATUSES.has(run.status) &&
        setsIntersect(flowScope, getAigcRunScopeNodeIds(run))
    );
    if (latestTerminal) selectedIds.add(latestTerminal.id);
  }

  return [...selectedIds];
}

export function createAigcRunProjection(
  definition: AigcDefinition,
  runs: readonly AigcPipelineRun[],
  details: ReadonlyMap<string, AigcPipelineRunDetail>,
  selectedRunId: string | null
): AigcRunProjection {
  const currentNodeIds = new Set(definition.nodes.map((node) => node.id));
  const newestFirst = newestRunsFirst(runs);
  const activeRuns = newestFirst.filter((run) =>
    ACTIVE_AIGC_RUN_STATUSES.has(run.status)
  );
  const activeNodeIds = new Set(
    activeRuns.flatMap((run) => [...getAigcRunScopeNodeIds(run)])
  );
  const terminalRuns = newestFirst.filter(
    (run) => !ACTIVE_AIGC_RUN_STATUSES.has(run.status)
  );
  const successfulRuns = terminalRuns.filter(
    (run) => run.status === "succeeded"
  );
  const selectedDetail =
    selectedRunId === null ? undefined : details.get(selectedRunId);

  function detailForNode(
    candidates: readonly AigcPipelineRun[],
    nodeId: string
  ): AigcPipelineRunDetail | null {
    const run = candidates.find((candidate) =>
      getAigcRunScopeNodeIds(candidate).has(nodeId)
    );
    return run ? details.get(run.id) ?? null : null;
  }

  function selectedRunForNode(
    nodeId: string
  ): AigcPipelineRunDetail | null {
    if (
      selectedDetail &&
      getAigcRunScopeNodeIds(selectedDetail.run).has(nodeId)
    ) {
      return selectedDetail;
    }
    return null;
  }

  return {
    isNodeActive(nodeId) {
      return currentNodeIds.has(nodeId) && activeNodeIds.has(nodeId);
    },
    activeRunForNode(nodeId) {
      if (!currentNodeIds.has(nodeId)) return null;
      return detailForNode(activeRuns, nodeId);
    },
    displayRunForNode(nodeId) {
      if (!currentNodeIds.has(nodeId)) return null;
      return (
        selectedRunForNode(nodeId) ??
        detailForNode(activeRuns, nodeId) ??
        detailForNode(terminalRuns, nodeId)
      );
    },
    latestSuccessfulRunForNode(nodeId) {
      if (!currentNodeIds.has(nodeId)) return null;
      return detailForNode(successfulRuns, nodeId);
    },
    hasAnyActiveRun: activeRuns.length > 0
  };
}

function getDefinitionFlowScopes(
  definition: AigcDefinition
): ReadonlySet<string>[] {
  const remaining = new Set(definition.nodes.map((node) => node.id));
  const scopes: ReadonlySet<string>[] = [];
  while (remaining.size > 0) {
    const startNodeId = remaining.values().next().value as string;
    const scope = getConnectedAigcNodeIds(definition, startNodeId);
    scopes.push(scope);
    for (const nodeId of scope) remaining.delete(nodeId);
  }
  return scopes;
}

function newestRunsFirst(
  runs: readonly AigcPipelineRun[]
): AigcPipelineRun[] {
  return [...runs].sort((left, right) => right.run_number - left.run_number);
}

function setsIntersect(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>
): boolean {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}
