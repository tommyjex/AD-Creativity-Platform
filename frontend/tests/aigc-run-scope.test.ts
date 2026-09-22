import { describe, expect, it } from "vitest";
import {
  createAigcRunProjection,
  getAigcProjectionNodeIds,
  getAigcRunConflictNodeIds,
  getAigcRunProjectionNodeIds,
  getAigcRunScopeNodeIds,
  getConnectedAigcNodeIds,
  getDownstreamAigcNodeIds,
  selectAigcProjectionRunIds
} from "@/lib/aigc/run-scope";
import type {
  AigcPipelineDefinition,
  AigcPipelineDefinitionV2,
  AigcPipelineRun,
  AigcPipelineRunDetail,
  AigcPipelineRunMode,
  AigcPipelineRunStatus
} from "@/lib/aigc/types";

const definitionV2: AigcPipelineDefinitionV2 = {
  schemaVersion: 2,
  nodes: [
    textNode("flow-a-input"),
    textNode("flow-a-branch"),
    textNode("flow-a-output"),
    textNode("flow-b-input"),
    textNode("flow-b-output"),
    textNode("isolated")
  ],
  edges: [
    edge("a-input-output", "flow-a-input", "flow-a-output"),
    edge("a-input-branch", "flow-a-input", "flow-a-branch"),
    edge("b-input-output", "flow-b-input", "flow-b-output")
  ],
  viewport: { x: 0, y: 0, zoom: 1 }
};

const definitionV1: AigcPipelineDefinition = {
  schemaVersion: 1,
  nodes: [
    {
      id: "legacy-input",
      type: "text_input",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { text: "input" }
    },
    {
      id: "legacy-output",
      type: "text_output",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: { title: "output" }
    }
  ],
  edges: [edge("legacy-edge", "legacy-input", "legacy-output")],
  viewport: { x: 0, y: 0, zoom: 1 }
};

const sharedBranchDefinition: AigcPipelineDefinitionV2 = {
  schemaVersion: 2,
  nodes: [
    textNode("root"),
    textNode("shared"),
    textNode("branch-a"),
    textNode("output-a"),
    textNode("branch-b"),
    textNode("output-b"),
    textNode("branch-c"),
    textNode("output-c")
  ],
  edges: [
    edge("root-shared", "root", "shared"),
    edge("shared-a", "shared", "branch-a"),
    edge("a-output", "branch-a", "output-a"),
    edge("shared-b", "shared", "branch-b"),
    edge("b-output", "branch-b", "output-b"),
    edge("shared-c", "shared", "branch-c"),
    edge("c-output", "branch-c", "output-c")
  ],
  viewport: { x: 0, y: 0, zoom: 1 }
};

function textNode(id: string): AigcPipelineDefinitionV2["nodes"][number] {
  return {
    id,
    type: "text",
    position: { x: 0, y: 0 },
    size: { width: 240, height: 160 },
    config: { text: id, bbox_references: [], title: null }
  };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string) {
  return {
    id,
    sourceNodeId,
    sourceHandle: "text",
    targetNodeId,
    targetHandle: "text"
  };
}

function run(
  id: string,
  {
    definition = definitionV2,
    mode = "from_node",
    runNumber,
    startNodeId,
    status
  }: {
    definition?: AigcPipelineDefinition | AigcPipelineDefinitionV2;
    mode?: AigcPipelineRunMode;
    runNumber: number;
    startNodeId: string | null;
    status: AigcPipelineRunStatus;
  }
): AigcPipelineRun {
  const active = status === "queued" || status === "running";
  return {
    id,
    pipeline_id: "pipeline",
    run_number: runNumber,
    pipeline_revision: 1,
    mode,
    start_node_id: startNodeId,
    source_run_id: null,
    source_node_id: null,
    status,
    definition_snapshot: definition,
    input_snapshot: {},
    error: null,
    cancellation_requested: false,
    created_at: `2026-09-05T00:00:${String(runNumber).padStart(2, "0")}Z`,
    updated_at: `2026-09-05T00:00:${String(runNumber).padStart(2, "0")}Z`,
    started_at: `2026-09-05T00:00:${String(runNumber).padStart(2, "0")}Z`,
    finished_at: active
      ? null
      : `2026-09-05T00:01:${String(runNumber).padStart(2, "0")}Z`
  };
}

function detail(value: AigcPipelineRun): AigcPipelineRunDetail {
  return { run: value, nodes: [] };
}

describe("AIGC connected flow scopes", () => {
  it("finds an undirected connected subgraph including branches", () => {
    expect(
      [...getConnectedAigcNodeIds(definitionV2, "flow-a-output")].sort()
    ).toEqual(["flow-a-branch", "flow-a-input", "flow-a-output"]);
  });

  it("treats an isolated node as its own flow", () => {
    expect([...getConnectedAigcNodeIds(definitionV2, "isolated")]).toEqual([
      "isolated"
    ]);
  });

  it("supports v1 definitions and returns an empty scope for unknown nodes", () => {
    expect(
      [...getConnectedAigcNodeIds(definitionV1, "legacy-output")].sort()
    ).toEqual(["legacy-input", "legacy-output"]);
    expect(getConnectedAigcNodeIds(definitionV1, "missing").size).toBe(0);
  });

  it("derives full, from-node, and retry-node scopes from snapshots", () => {
    const full = run("full", {
      mode: "full",
      runNumber: 1,
      startNodeId: null,
      status: "succeeded"
    });
    const fromNode = run("from-node", {
      runNumber: 2,
      startNodeId: "flow-a-output",
      status: "succeeded"
    });
    const retryNode = run("retry-node", {
      mode: "retry_node",
      runNumber: 3,
      startNodeId: "flow-b-output",
      status: "failed"
    });

    expect(getAigcRunScopeNodeIds(full).size).toBe(definitionV2.nodes.length);
    expect([...getAigcRunScopeNodeIds(fromNode)].sort()).toEqual([
      "flow-a-input",
      "flow-a-output"
    ]);
    expect([...getAigcRunScopeNodeIds(retryNode)].sort()).toEqual([
      "flow-b-input",
      "flow-b-output"
    ]);
  });

  it("separates downstream conflict scopes from dependency projections", () => {
    expect(
      [...getDownstreamAigcNodeIds(sharedBranchDefinition, "branch-a")].sort()
    ).toEqual(["branch-a", "output-a"]);
    expect(
      [...getAigcProjectionNodeIds(sharedBranchDefinition, "branch-a")].sort()
    ).toEqual(["branch-a", "output-a", "root", "shared"]);

    const branchA = run("branch-a-run", {
      definition: sharedBranchDefinition,
      runNumber: 1,
      startNodeId: "branch-a",
      status: "running"
    });
    expect([...getAigcRunConflictNodeIds(branchA)].sort()).toEqual([
      "branch-a",
      "output-a"
    ]);
    expect([...getAigcRunProjectionNodeIds(branchA)].sort()).toEqual([
      "branch-a",
      "output-a",
      "root",
      "shared"
    ]);
  });
});

describe("AIGC Run projection selection", () => {
  const activeFlowA = run("active-a", {
    runNumber: 8,
    startNodeId: "flow-a-input",
    status: "running"
  });
  const activeFlowB = run("active-b", {
    runNumber: 9,
    startNodeId: "flow-b-output",
    status: "queued"
  });
  const latestFlowA = run("latest-a", {
    runNumber: 6,
    startNodeId: "flow-a-output",
    status: "succeeded"
  });
  const olderFlowA = run("older-a", {
    runNumber: 3,
    startNodeId: "flow-a-input",
    status: "succeeded"
  });
  const latestFlowB = run("latest-b", {
    runNumber: 7,
    startNodeId: "flow-b-input",
    status: "failed"
  });
  const successfulFlowB = run("successful-b", {
    runNumber: 5,
    startNodeId: "flow-b-input",
    status: "succeeded"
  });
  const isolatedCanceled = run("isolated-canceled", {
    runNumber: 4,
    startNodeId: "isolated",
    status: "canceled"
  });

  const allRuns = [
    olderFlowA,
    activeFlowA,
    successfulFlowB,
    latestFlowB,
    isolatedCanceled,
    latestFlowA,
    activeFlowB
  ];
  const details = new Map(
    allRuns.map((value) => [value.id, detail(value)] as const)
  );

  it("loads every active Run and the latest terminal Run for each flow", () => {
    expect(
      new Set(selectAigcProjectionRunIds(definitionV2, allRuns, null))
    ).toEqual(
      new Set([
        activeFlowA.id,
        activeFlowB.id,
        latestFlowA.id,
        olderFlowA.id,
        latestFlowB.id,
        successfulFlowB.id,
        isolatedCanceled.id
      ])
    );
  });

  it("also loads explicitly selected history without replacing flow choices", () => {
    expect(
      new Set(
        selectAigcProjectionRunIds(definitionV2, allRuns, olderFlowA.id)
      )
    ).toEqual(
      new Set([
        activeFlowA.id,
        activeFlowB.id,
        latestFlowA.id,
        latestFlowB.id,
        successfulFlowB.id,
        isolatedCanceled.id,
        olderFlowA.id
      ])
    );
  });

  it("maps each node to its own active Run", () => {
    const projection = createAigcRunProjection(
      definitionV2,
      allRuns,
      details,
      null
    );

    expect(projection.activeRunForNode("flow-a-model")).toBeNull();
    expect(projection.isNodeActive("flow-a-branch")).toBe(true);
    expect(projection.activeRunForNode("flow-a-branch")?.run.id).toBe(
      activeFlowA.id
    );
    expect(projection.isNodeActive("flow-b-input")).toBe(true);
    expect(projection.activeRunForNode("flow-b-input")?.run.id).toBe(
      activeFlowB.id
    );
    expect(projection.isNodeActive("isolated")).toBe(false);
    expect(projection.activeRunForNode("isolated")).toBeNull();
    expect(projection.hasAnyActiveRun).toBe(true);
  });

  it("keeps nodes active when the active Run detail is missing", () => {
    const detailsWithoutActiveFlowA = new Map(details);
    detailsWithoutActiveFlowA.delete(activeFlowA.id);
    const projection = createAigcRunProjection(
      definitionV2,
      allRuns,
      detailsWithoutActiveFlowA,
      null
    );

    expect(projection.isNodeActive("flow-a-output")).toBe(true);
    expect(projection.activeRunForNode("flow-a-output")).toBeNull();
    expect(projection.isNodeActive("isolated")).toBe(false);
  });

  it("does not fall through to a terminal Run while active detail is unavailable", () => {
    const detailsWithoutActiveFlowA = new Map(details);
    detailsWithoutActiveFlowA.delete(activeFlowA.id);
    const projection = createAigcRunProjection(
      definitionV2,
      allRuns,
      detailsWithoutActiveFlowA,
      null
    );

    expect(projection.displayRunForNode("flow-a-output")).toBeNull();
  });

  it("does not expand an active snapshot scope after the current graph changes", () => {
    const mergedDefinition = {
      ...definitionV2,
      edges: [
        ...definitionV2.edges,
        edge("merge-flows", "flow-a-output", "flow-b-input")
      ]
    };
    const projection = createAigcRunProjection(
      mergedDefinition,
      [activeFlowA],
      details,
      null
    );

    expect(projection.isNodeActive("flow-b-output")).toBe(false);
    expect(projection.activeRunForNode("flow-b-output")).toBeNull();
  });

  it("uses each flow's latest terminal and latest successful Run", () => {
    const projection = createAigcRunProjection(
      definitionV2,
      allRuns.filter(
        (value) => value.id !== activeFlowA.id && value.id !== activeFlowB.id
      ),
      details,
      null
    );

    expect(projection.displayRunForNode("flow-a-input")?.run.id).toBe(
      latestFlowA.id
    );
    expect(projection.displayRunForNode("flow-b-output")?.run.id).toBe(
      latestFlowB.id
    );
    expect(
      projection.latestSuccessfulRunForNode("flow-b-output")?.run.id
    ).toBe(successfulFlowB.id);
    expect(projection.displayRunForNode("isolated")?.run.id).toBe(
      isolatedCanceled.id
    );
  });

  it("does not fall back when the latest terminal Run detail is missing", () => {
    const detailsWithoutLatestFlowA = new Map(details);
    detailsWithoutLatestFlowA.delete(latestFlowA.id);
    const projection = createAigcRunProjection(
      definitionV2,
      allRuns.filter(
        (value) => value.id !== activeFlowA.id && value.id !== activeFlowB.id
      ),
      detailsWithoutLatestFlowA,
      null
    );

    expect(detailsWithoutLatestFlowA.has(olderFlowA.id)).toBe(true);
    expect(projection.displayRunForNode("flow-a-input")).toBeNull();
  });

  it("applies selected history only to its connected flow", () => {
    const projection = createAigcRunProjection(
      definitionV2,
      allRuns.filter(
        (value) => value.id !== activeFlowA.id && value.id !== activeFlowB.id
      ),
      details,
      olderFlowA.id
    );

    expect(projection.displayRunForNode("flow-a-output")?.run.id).toBe(
      olderFlowA.id
    );
    expect(projection.displayRunForNode("flow-b-output")?.run.id).toBe(
      latestFlowB.id
    );
    expect(projection.displayRunForNode("isolated")?.run.id).toBe(
      isolatedCanceled.id
    );
  });

  it("preserves sibling results while another shared-upstream branch runs", () => {
    const branchASuccess = run("branch-a-success", {
      definition: sharedBranchDefinition,
      runNumber: 4,
      startNodeId: "branch-a",
      status: "succeeded"
    });
    const branchBActive = run("branch-b-active", {
      definition: sharedBranchDefinition,
      runNumber: 5,
      startNodeId: "branch-b",
      status: "running"
    });
    const branchCFailed = run("branch-c-failed", {
      definition: sharedBranchDefinition,
      runNumber: 6,
      startNodeId: "branch-c",
      status: "failed"
    });
    const branchDetails = new Map(
      [branchASuccess, branchBActive, branchCFailed].map((value) => [
        value.id,
        detail(value)
      ])
    );
    const projection = createAigcRunProjection(
      sharedBranchDefinition,
      [branchCFailed, branchBActive, branchASuccess],
      branchDetails,
      null
    );

    expect(projection.displayRunForNode("output-a")?.run.id).toBe(
      branchASuccess.id
    );
    expect(projection.activeRunForNode("branch-b")?.run.id).toBe(
      branchBActive.id
    );
    expect(projection.isNodeActive("output-a")).toBe(false);
    expect(projection.displayRunForNode("output-c")?.run.id).toBe(
      branchCFailed.id
    );
    expect(
      new Set(
        selectAigcProjectionRunIds(
          sharedBranchDefinition,
          [branchCFailed, branchBActive, branchASuccess],
          null
        )
      )
    ).toEqual(
      new Set([
        branchASuccess.id,
        branchBActive.id,
        branchCFailed.id
      ])
    );

    const branchBSuccess = run("branch-b-success", {
      definition: sharedBranchDefinition,
      runNumber: 7,
      startNodeId: "branch-b",
      status: "succeeded"
    });
    const completedProjection = createAigcRunProjection(
      sharedBranchDefinition,
      [branchBSuccess, branchASuccess],
      new Map([
        [branchASuccess.id, detail(branchASuccess)],
        [branchBSuccess.id, detail(branchBSuccess)]
      ]),
      null
    );
    expect(completedProjection.displayRunForNode("output-a")?.run.id).toBe(
      branchASuccess.id
    );
    expect(completedProjection.displayRunForNode("output-b")?.run.id).toBe(
      branchBSuccess.id
    );
  });
});
