import type {
  AigcBbox,
  AigcBboxPromptReference,
  AigcPipelineDefinitionV2
} from "@/lib/aigc/types";

const LEGACY_MODALITY_TYPES = new Set([
  "text_input",
  "text_output",
  "image_input",
  "image_output",
  "video_input",
  "video_output",
  "audio_input"
]);
const V2_MODALITY_TYPES = new Set(["text", "image", "video", "audio"]);
const COORDINATE_TAG_PATTERN = /<\/?\s*(?:point|bbox)\b/i;

export class AigcDefinitionMigrationError extends Error {}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AigcDefinitionMigrationError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
): void {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length > 0) {
    throw new AigcDefinitionMigrationError(
      `node config has unknown fields: ${extra.join(", ")}`
    );
  }
}

function nullableString(
  value: unknown,
  field: string,
  maxLength?: number
): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    (maxLength !== undefined && value.length > maxLength)
  ) {
    throw new AigcDefinitionMigrationError(`${field} is invalid`);
  }
  return value;
}

function normalizeReferences(value: unknown): AigcBboxPromptReference[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10) {
    throw new AigcDefinitionMigrationError("bbox_references is invalid");
  }
  const references = value.map((candidate) => {
    const reference = record(candidate, "bbox reference");
    exactKeys(reference, ["source_node_id", "instruction"]);
    const sourceNodeId = reference.source_node_id;
    const instruction = reference.instruction ?? "";
    if (
      typeof sourceNodeId !== "string" ||
      sourceNodeId.trim().length === 0 ||
      sourceNodeId.length > 120 ||
      typeof instruction !== "string" ||
      instruction.length > 4000 ||
      COORDINATE_TAG_PATTERN.test(instruction)
    ) {
      throw new AigcDefinitionMigrationError("bbox reference is invalid");
    }
    return {
      source_node_id: sourceNodeId.trim(),
      instruction
    };
  });
  if (
    new Set(references.map((reference) => reference.source_node_id)).size !==
    references.length
  ) {
    throw new AigcDefinitionMigrationError(
      "bbox reference source_node_id values must be unique"
    );
  }
  return references;
}

function normalizeTextConfig(
  value: unknown,
  title: string | null | undefined,
  allowStoredTitle = true
): Record<string, unknown> {
  const config = record(value, "node config");
  exactKeys(
    config,
    allowStoredTitle
      ? [
          "text",
          "bbox_references",
          "title",
          "upstream_text_override",
          "generated_by_parser_node_id",
          "generated_item_index",
          "generated_from_run_id"
        ]
      : ["text", "bbox_references", "upstream_text_override"]
  );
  const text = config.text ?? "";
  if (
    typeof text !== "string" ||
    text.length > 20000 ||
    COORDINATE_TAG_PATTERN.test(text)
  ) {
    throw new AigcDefinitionMigrationError("text is invalid");
  }
  const normalized: Record<string, unknown> = {
    text,
    bbox_references: normalizeReferences(config.bbox_references),
    title: nullableString(
      title === undefined ? config.title : title,
      "title",
      120
    ),
    upstream_text_override: nullableText(
      config.upstream_text_override,
      "upstream_text_override",
      20000
    )
  };
  const hasParser = config.generated_by_parser_node_id !== undefined;
  const hasIndex = config.generated_item_index !== undefined;
  const hasRun = config.generated_from_run_id !== undefined;
  if (hasParser !== hasIndex || (hasRun && !hasParser)) {
    throw new AigcDefinitionMigrationError("managed text fields are invalid");
  }
  if (hasParser) {
    const parserId = nullableString(
      config.generated_by_parser_node_id,
      "generated_by_parser_node_id",
      120
    );
    const itemIndex = config.generated_item_index;
    const runId = nullableString(
      config.generated_from_run_id,
      "generated_from_run_id",
      120
    );
    if (
      parserId === null ||
      parserId.trim().length === 0 ||
      !Number.isInteger(itemIndex) ||
      (itemIndex as number) < 0 ||
      (itemIndex as number) >= 20
    ) {
      throw new AigcDefinitionMigrationError("managed text fields are invalid");
    }
    normalized.generated_by_parser_node_id = parserId.trim();
    normalized.generated_item_index = itemIndex;
    if (runId !== null) {
      if (runId.trim().length === 0) {
        throw new AigcDefinitionMigrationError(
          "managed text fields are invalid"
        );
      }
      normalized.generated_from_run_id = runId.trim();
    }
  }
  return normalized;
}

function normalizeJsonParserConfig(value: unknown): Record<string, unknown> {
  const config = record(value, "node config");
  exactKeys(config, ["json_path"]);
  const jsonPath = config.json_path ?? "$.items";
  if (
    typeof jsonPath !== "string" ||
    jsonPath.trim().length === 0 ||
    jsonPath.trim().length > 500
  ) {
    throw new AigcDefinitionMigrationError("json_parser_invalid_path");
  }
  return { json_path: jsonPath.trim() };
}

function nullableText(
  value: unknown,
  label: string,
  maxLength: number
): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    COORDINATE_TAG_PATTERN.test(value)
  ) {
    throw new AigcDefinitionMigrationError(`${label} is invalid`);
  }
  return value;
}

function normalizeBbox(value: unknown): AigcBbox | null {
  if (value === null || value === undefined) return null;
  const bbox = record(value, "bbox");
  exactKeys(bbox, ["type", "x1", "y1", "x2", "y2"]);
  const coordinates = [bbox.x1, bbox.y1, bbox.x2, bbox.y2];
  if (
    bbox.type !== "bbox" ||
    coordinates.some(
      (coordinate) =>
        !Number.isInteger(coordinate) ||
        (coordinate as number) < 0 ||
        (coordinate as number) > 999
    ) ||
    (bbox.x1 as number) >= (bbox.x2 as number) ||
    (bbox.y1 as number) >= (bbox.y2 as number)
  ) {
    throw new AigcDefinitionMigrationError("bbox is invalid");
  }
  return {
    type: "bbox",
    x1: bbox.x1 as number,
    y1: bbox.y1 as number,
    x2: bbox.x2 as number,
    y2: bbox.y2 as number
  };
}

function normalizeImageConfig(
  value: unknown,
  title: string | null | undefined,
  allowStoredTitle = true
): Record<string, unknown> {
  const config = record(value, "node config");
  exactKeys(
    config,
    allowStoredTitle
      ? [
          "asset_id",
          "bbox",
          "bbox_asset_id",
          "title",
          "upstream_bbox",
          "upstream_bbox_asset_id"
        ]
      : ["asset_id", "bbox", "bbox_asset_id"]
  );
  const assetId = nullableString(config.asset_id, "asset_id");
  const bbox = normalizeBbox(config.bbox);
  const bboxAssetId = nullableString(config.bbox_asset_id, "bbox_asset_id");
  const upstreamBbox = normalizeBbox(config.upstream_bbox);
  const upstreamBboxAssetId = nullableString(
    config.upstream_bbox_asset_id,
    "upstream_bbox_asset_id"
  );
  if ((bbox === null) !== (bboxAssetId === null) || (bbox && bboxAssetId !== assetId)) {
    throw new AigcDefinitionMigrationError("bbox_asset_mismatch");
  }
  if ((upstreamBbox === null) !== (upstreamBboxAssetId === null)) {
    throw new AigcDefinitionMigrationError("upstream_bbox_asset_mismatch");
  }
  return {
    asset_id: assetId,
    bbox,
    bbox_asset_id: bboxAssetId,
    title: nullableString(
      title === undefined ? config.title : title,
      "title",
      120
    ),
    upstream_bbox: upstreamBbox,
    upstream_bbox_asset_id: upstreamBboxAssetId
  };
}

function normalizeMediaConfig(
  value: unknown,
  title: string | null | undefined,
  allowStoredTitle = true
): Record<string, unknown> {
  const config = record(value, "node config");
  exactKeys(
    config,
    allowStoredTitle ? ["asset_id", "title"] : ["asset_id"]
  );
  return {
    asset_id: nullableString(config.asset_id, "asset_id"),
    title: nullableString(
      title === undefined ? config.title : title,
      "title",
      120
    )
  };
}

function legacyOutputTitle(
  value: unknown,
  defaultTitle: string
): string {
  const config = record(value, "node config");
  exactKeys(config, ["title"]);
  return nullableString(config.title ?? defaultTitle, "title", 120) as string;
}

function normalizeNode(
  candidate: unknown,
  version: 1 | 2
): Record<string, unknown> {
  const node = record(candidate, "node");
  const type = node.type;
  const config = node.config ?? {};
  const migrated = structuredClone(node);

  if (version === 2) {
    if (type === "text") migrated.config = normalizeTextConfig(config, undefined);
    if (type === "image") migrated.config = normalizeImageConfig(config, undefined);
    if (type === "video" || type === "audio") {
      migrated.config = normalizeMediaConfig(config, undefined);
    }
    if (type === "json_parser") {
      migrated.config = normalizeJsonParserConfig(config);
    }
    return migrated;
  }

  if (type === "text_input") {
    migrated.type = "text";
    migrated.config = normalizeTextConfig(config, null, false);
  } else if (type === "text_output") {
    migrated.type = "text";
    migrated.config = {
      text: "",
      bbox_references: [],
      title: legacyOutputTitle(config, "文本结果"),
      upstream_text_override: null
    };
  } else if (type === "image_input") {
    migrated.type = "image";
    migrated.config = normalizeImageConfig(config, null, false);
  } else if (type === "image_output") {
    migrated.type = "image";
    migrated.config = {
      asset_id: null,
      bbox: null,
      bbox_asset_id: null,
      title: legacyOutputTitle(config, "图片结果"),
      upstream_bbox: null,
      upstream_bbox_asset_id: null
    };
  } else if (type === "video_input") {
    migrated.type = "video";
    migrated.config = normalizeMediaConfig(config, null, false);
  } else if (type === "video_output") {
    migrated.type = "video";
    migrated.config = {
      asset_id: null,
      title: legacyOutputTitle(config, "视频结果")
    };
  } else if (type === "audio_input") {
    migrated.type = "audio";
    migrated.config = normalizeMediaConfig(config, null, false);
  }
  return migrated;
}

export function migrateAigcDefinitionV2(
  definition: unknown
): AigcPipelineDefinitionV2 {
  const source = record(definition, "definition");
  const rawVersion = source.schemaVersion ?? 1;
  if (rawVersion !== 1 && rawVersion !== 2) {
    throw new AigcDefinitionMigrationError(
      `unsupported AIGC definition schemaVersion: ${String(rawVersion)}`
    );
  }
  const nodes = source.nodes ?? [];
  if (!Array.isArray(nodes)) {
    throw new AigcDefinitionMigrationError("definition nodes must be an array");
  }
  const nodeTypes = new Set(
    nodes.map((node) => record(node, "node").type)
  );
  if (
    (rawVersion === 1 &&
      [...nodeTypes].some((type) => V2_MODALITY_TYPES.has(String(type)))) ||
    (rawVersion === 2 &&
      [...nodeTypes].some((type) => LEGACY_MODALITY_TYPES.has(String(type))))
  ) {
    throw new AigcDefinitionMigrationError("mixed_v1_v2_modality_types");
  }

  const normalizedNodes = nodes.map((node) => normalizeNode(node, rawVersion));
  const managedKeys = normalizedNodes.flatMap((node) => {
    if (node.type !== "text") return [];
    const config = record(node.config, "node config");
    if (
      typeof config.generated_by_parser_node_id !== "string" ||
      typeof config.generated_item_index !== "number"
    ) {
      return [];
    }
    return [
      `${config.generated_by_parser_node_id}\u0000${config.generated_item_index}`
    ];
  });
  if (new Set(managedKeys).size !== managedKeys.length) {
    throw new AigcDefinitionMigrationError(
      "managed text keys must be unique"
    );
  }

  const migrated = structuredClone(source);
  migrated.schemaVersion = 2;
  migrated.nodes = normalizedNodes;
  migrated.edges ??= [];
  migrated.viewport ??= { x: 0, y: 0, zoom: 1 };
  return migrated as unknown as AigcPipelineDefinitionV2;
}

export function migrateAigcRunSnapshotV2(
  definitionSnapshot: unknown
): AigcPipelineDefinitionV2 {
  return migrateAigcDefinitionV2(definitionSnapshot);
}
