export type SeedreamOperation =
  | "text_to_image"
  | "image_to_image"
  | "image_edit"
  | "layer_decomposition";

export const SEEDREAM_PRO_MODEL =
  "doubao-seedream-5-0-pro-260628" as const;
export const SEEDREAM_FLASH_MODEL =
  "doubao-seedream-5-0-flash-260915" as const;

export const SEEDREAM_MODELS = [
  {
    id: SEEDREAM_PRO_MODEL,
    label: "Seedream 5.0 Pro",
    operations: [
      "text_to_image",
      "image_to_image",
      "image_edit",
      "layer_decomposition"
    ]
  },
  {
    id: SEEDREAM_FLASH_MODEL,
    label: "Seedream 5.0 Flash",
    operations: ["text_to_image", "image_to_image", "image_edit"]
  }
] as const satisfies readonly {
  id: string;
  label: string;
  operations: readonly SeedreamOperation[];
}[];

export type SeedreamModel = (typeof SEEDREAM_MODELS)[number]["id"];

export const SEEDREAM_DEFAULT_MODEL: SeedreamModel = SEEDREAM_PRO_MODEL;

export function seedreamModelSupportsOperation(
  model: SeedreamModel,
  operation: SeedreamOperation
): boolean {
  return SEEDREAM_MODELS.some(
    (item) =>
      item.id === model &&
      (item.operations as readonly SeedreamOperation[]).includes(operation)
  );
}

export function seedreamModelOptions(operation: SeedreamOperation) {
  return SEEDREAM_MODELS.filter((model) =>
    (model.operations as readonly SeedreamOperation[]).includes(operation)
  ).map((model) => ({ label: model.label, value: model.id }));
}
