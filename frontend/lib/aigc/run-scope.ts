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

export function getDownstreamAigcNodeIds(
  definition: AigcDefinition,
  startNodeId: string
): ReadonlySet<string> {
  const nodeIds = new Set(definition.nodes.map((node) => node.id));
  if (!nodeIds.has(startNodeId)) return new Set();
  const children = adjacencyFor(definition, nodeIds, "downstream");
  return walkAigcNodeIds(startNodeId, children);
}

export function getAigcProjectionNodeIds(
  definition: AigcDefinition,
  startNodeId: string
): ReadonlySet<string> {
  const nodeIds = new Set(definition.nodes.map((node) => node.id));
  if (!nodeIds.has(startNodeId)) return new Set();
  const children = adjacencyFor(definition, nodeIds, "downstream");
  const parents = adjacencyFor(definition, nodeIds, "upstream");
  const projected = new Set(walkAigcNodeIds(startNodeId, children));
  const pending = [...projected];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    for (const parent of parents.get(current) ?? []) {
      if (projected.has(parent)) continue;
      projected.add(parent);
      pending.push(parent);
    }
  }
  return projected;
}

export function getAigcRunConflictNodeIds(
  run: AigcPipelineRun
): ReadonlySet<string> {
  if (run.mode === "full") {
    return new Set(run.definition_snapshot.nodes.map((node) => node.id));
  }
  if (run.start_node_id === null) return new Set();
  return getDownstreamAigcNodeIds(
    run.definition_snapshot,
    run.start_node_id
  );
}

export function getAigcRunProjectionNodeIds(
  run: AigcPipelineRun
): ReadonlySet<string> {
  if (run.mode === "full") {
    return new Set(run.definition_snapshot.nodes.map((node) => node.id));
  }
  if (run.start_node_id === null) return new Set();
  return getAigcProjectionNodeIds(
    run.definition_snapshot,
    run.start_node_id
  );
}

export const getAigcRunScopeNodeIds = getAigcRunProjectionNodeIds;

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

  for (const node of definition.nodes) {
    const latestTerminal = newestFirst.find(
      (run) =>
        !ACTIVE_AIGC_RUN_STATUSES.has(run.status) &&
        getAigcRunProjectionNodeIds(run).has(node.id)
    );
    if (latestTerminal) selectedIds.add(latestTerminal.id);
    const latestSuccessful = newestFirst.find(
      (run) =>
        run.status === "succeeded" &&
        getAigcRunProjectionNodeIds(run).has(node.id)
    );
    if (latestSuccessful) selectedIds.add(latestSuccessful.id);
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
  const activeScopes = activeRuns.map((run) => ({
    run,
    scope: getAigcRunProjectionNodeIds(run)
  }));
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
      getAigcRunProjectionNodeIds(candidate).has(nodeId)
    );
    return run ? details.get(run.id) ?? null : null;
  }

  function activeRunForNodeId(nodeId: string): AigcPipelineRun | null {
    return activeScopes.find(({ scope }) => scope.has(nodeId))?.run ?? null;
  }

  function selectedRunForNode(
    nodeId: string
  ): AigcPipelineRunDetail | null {
    if (
      selectedDetail &&
      getAigcRunProjectionNodeIds(selectedDetail.run).has(nodeId)
    ) {
      return selectedDetail;
    }
    return null;
  }

  return {
    isNodeActive(nodeId) {
      return (
        currentNodeIds.has(nodeId) &&
        activeRunForNodeId(nodeId) !== null
      );
    },
    activeRunForNode(nodeId) {
      if (!currentNodeIds.has(nodeId)) return null;
      const run = activeRunForNodeId(nodeId);
      return run ? details.get(run.id) ?? null : null;
    },
    displayRunForNode(nodeId) {
      if (!currentNodeIds.has(nodeId)) return null;
      const selectedRun = selectedRunForNode(nodeId);
      if (selectedRun) return selectedRun;
      const activeRun = activeRunForNodeId(nodeId);
      if (activeRun) return details.get(activeRun.id) ?? null;
      return (
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

function newestRunsFirst(
  runs: readonly AigcPipelineRun[]
): AigcPipelineRun[] {
  return [...runs].sort((left, right) => right.run_number - left.run_number);
}

function adjacencyFor(
  definition: AigcDefinition,
  nodeIds: ReadonlySet<string>,
  direction: "downstream" | "upstream"
): Map<string, Set<string>> {
  const adjacency = new Map(
    [...nodeIds].map((nodeId) => [nodeId, new Set<string>()] as const)
  );
  for (const edge of definition.edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      continue;
    }
    const source =
      direction === "downstream" ? edge.sourceNodeId : edge.targetNodeId;
    const target =
      direction === "downstream" ? edge.targetNodeId : edge.sourceNodeId;
    adjacency.get(source)?.add(target);
  }
  return adjacency;
}

function walkAigcNodeIds(
  startNodeId: string,
  adjacency: ReadonlyMap<string, ReadonlySet<string>>
): ReadonlySet<string> {
  const visited = new Set([startNodeId]);
  const pending = [startNodeId];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      pending.push(neighbor);
    }
  }
  return visited;
}
