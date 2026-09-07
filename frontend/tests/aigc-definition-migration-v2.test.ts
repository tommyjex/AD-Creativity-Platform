import { describe, expect, it } from "vitest";
import golden from "../../fixtures/aigc-definition-v2-migration.json";
import {
  AigcDefinitionMigrationError,
  migrateAigcDefinitionV2,
  migrateAigcRunSnapshotV2
} from "@/lib/aigc/definition-migration";
import { AIGC_V2_NODE_REGISTRY } from "@/lib/aigc/node-registry";
import { AIGC_V2_NODE_TYPES } from "@/lib/aigc/types";

describe("AIGC definition v2 contract", () => {
  it("registers the four unified modality nodes with optional single inputs", () => {
    expect(AIGC_V2_NODE_REGISTRY.map((item) => item.type)).toEqual(
      AIGC_V2_NODE_TYPES
    );

    const modalities = AIGC_V2_NODE_REGISTRY.filter(
      (item) => item.category === "modality"
    );
    expect(modalities.map((item) => item.type)).toEqual([
      "text",
      "image",
      "video",
      "audio"
    ]);
    for (const item of modalities) {
      expect(item.executable).toBe(false);
      expect(item.inputs).toHaveLength(1);
      expect(item.outputs).toHaveLength(1);
      expect(item.inputs[0]).toMatchObject({
        id: item.outputs[0]?.id,
        type: item.outputs[0]?.type,
        required: false,
        multiple: false,
        max_connections: 1
      });
    }
  });
});

describe("AIGC definition v1 to v2 migration", () => {
  it.each(golden.cases)("$name matches the shared golden fixture", (testCase) => {
    const source = structuredClone(testCase.input);

    const migrated = migrateAigcDefinitionV2(source);

    expect(migrated).toEqual(testCase.expected);
    expect(source).toEqual(testCase.input);
    expect(migrateAigcDefinitionV2(migrated)).toEqual(migrated);
  });

  it.each([0, 3, "2", true])(
    "rejects unsupported schemaVersion %j",
    (schemaVersion) => {
      expect(() =>
        migrateAigcDefinitionV2({ schemaVersion, nodes: [], edges: [] })
      ).toThrow(/unsupported AIGC definition schemaVersion/);
    }
  );

  it.each([
    { schemaVersion: 1, nodeTypes: ["text_input", "image"] },
    { schemaVersion: 2, nodeTypes: ["text", "image_output"] }
  ])(
    "rejects mixed modality types for schemaVersion $schemaVersion",
    ({ schemaVersion, nodeTypes }) => {
      const nodes = nodeTypes.map((type, index) => ({
        id: `node-${index}`,
        type,
        position: { x: index * 300, y: 0 },
        size: { width: 240, height: 160 },
        config: {}
      }));

      expect(() =>
        migrateAigcDefinitionV2({ schemaVersion, nodes, edges: [] })
      ).toThrow("mixed_v1_v2_modality_types");
    }
  );

  it.each([
    {
      schemaVersion: 1,
      nodes: [
        {
          id: "legacy",
          type: "text_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { text: "prompt", unexpected: true }
        }
      ]
    },
    {
      schemaVersion: 2,
      nodes: [
        {
          id: "current",
          type: "video",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { asset_id: null, unexpected: true }
        }
      ]
    }
  ])("rejects unknown modality config fields", (definition) => {
    expect(() => migrateAigcDefinitionV2(definition)).toThrow(
      /unknown fields/
    );
  });

  it("preserves duplicate-input and cycle evidence for DAG validation", () => {
    const definition = {
      schemaVersion: 1,
      nodes: [
        {
          id: "source-a",
          type: "text_input",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 160 },
          config: { text: "A" }
        },
        {
          id: "source-b",
          type: "text_input",
          position: { x: 0, y: 200 },
          size: { width: 240, height: 160 },
          config: { text: "B" }
        },
        {
          id: "result",
          type: "text_output",
          position: { x: 400, y: 0 },
          size: { width: 240, height: 160 },
          config: {}
        }
      ],
      edges: [
        {
          id: "duplicate-input-a",
          sourceNodeId: "source-a",
          sourceHandle: "text",
          targetNodeId: "result",
          targetHandle: "text"
        },
        {
          id: "duplicate-input-b",
          sourceNodeId: "source-b",
          sourceHandle: "text",
          targetNodeId: "result",
          targetHandle: "text"
        },
        {
          id: "cycle",
          sourceNodeId: "result",
          sourceHandle: "text",
          targetNodeId: "source-a",
          targetHandle: "text"
        }
      ]
    };

    const migrated = migrateAigcDefinitionV2(definition);

    expect(migrated.edges).toEqual(definition.edges);
    expect(migrated.edges.map((edge) => edge.id)).toEqual([
      "duplicate-input-a",
      "duplicate-input-b",
      "cycle"
    ]);
  });

  it("adapts historical snapshots without mutating them", () => {
    const snapshot = structuredClone(golden.cases[0]!.input);
    const original = structuredClone(snapshot);

    const migrated = migrateAigcRunSnapshotV2(snapshot);

    expect(snapshot).toEqual(original);
    expect(migrated).toEqual(golden.cases[0]!.expected);
    expect(migrated).not.toBe(snapshot);
  });

  it("preserves JSON parsers and normalizes managed text metadata", () => {
    const migrated = migrateAigcDefinitionV2({
      schemaVersion: 2,
      nodes: [
        {
          id: "parser",
          type: "json_parser",
          position: { x: 0, y: 0 },
          size: { width: 280, height: 180 },
          config: {}
        },
        {
          id: "item",
          type: "text",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 180 },
          config: {
            text: "value",
            generated_by_parser_node_id: " parser ",
            generated_item_index: 0,
            generated_from_run_id: " run-1 "
          }
        }
      ],
      edges: []
    });

    expect(migrated.nodes).toMatchObject([
      { type: "json_parser", config: { json_path: "$.items" } },
      {
        type: "text",
        config: {
          generated_by_parser_node_id: "parser",
          generated_item_index: 0,
          generated_from_run_id: "run-1"
        }
      }
    ]);
    expect(migrateAigcRunSnapshotV2(migrated)).toEqual(migrated);
  });

  it("uses a dedicated migration error for malformed roots", () => {
    expect(() => migrateAigcDefinitionV2(null)).toThrow(
      AigcDefinitionMigrationError
    );
  });
});
