export const SEEDANCE_ASPECT_RATIOS = [
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
  "21:9",
  "adaptive"
] as const;

export type SeedanceAspectRatio = (typeof SEEDANCE_ASPECT_RATIOS)[number];
export type SeedanceResolution = "480p" | "720p" | "1080p" | "4k";
export type SeedanceTaskType = "generate" | "edit" | "extend";

export const SEEDANCE_CAPABILITIES = {
  "doubao-seedance-2-5-260628": {
    displayName: "Seedance 2.5",
    maxReferenceImages: 30,
    maxReferenceVideos: 10,
    maxReferenceAudios: 10,
    maxInputDurationSeconds: 30,
    promptLanguages: ["中", "英", "西", "印尼", "葡", "日", "马来", "泰", "阿", "越", "韩"],
    resolutions: ["480p", "720p", "1080p"],
    duration: { minimum: 4, maximum: 30 }
  },
  "doubao-seedance-2-0-260128": {
    displayName: "Seedance 2.0",
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
    maxInputDurationSeconds: 15,
    promptLanguages: ["中", "英", "西", "印尼", "葡", "日"],
    resolutions: ["480p", "720p", "1080p", "4k"],
    duration: { minimum: 4, maximum: 15 }
  },
  "doubao-seedance-2-0-fast-260128": {
    displayName: "Seedance 2.0 Fast",
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
    maxInputDurationSeconds: 15,
    promptLanguages: ["中", "英", "西", "印尼", "葡", "日"],
    resolutions: ["480p", "720p"],
    duration: { minimum: 4, maximum: 15 }
  },
  "doubao-seedance-2-0-mini-260615": {
    displayName: "Seedance 2.0 Mini",
    maxReferenceImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudios: 3,
    maxInputDurationSeconds: 15,
    promptLanguages: ["中", "英", "西", "印尼", "葡", "日"],
    resolutions: ["480p", "720p"],
    duration: { minimum: 4, maximum: 15 }
  }
} as const satisfies Record<
  string,
  {
    displayName: string;
    maxReferenceImages: number;
    maxReferenceVideos: number;
    maxReferenceAudios: number;
    maxInputDurationSeconds: number;
    promptLanguages: readonly string[];
    resolutions: readonly SeedanceResolution[];
    duration: { minimum: number; maximum: number };
  }
>;

export type SeedanceModel = keyof typeof SEEDANCE_CAPABILITIES;

export const SEEDANCE_MODELS = Object.keys(
  SEEDANCE_CAPABILITIES
) as SeedanceModel[];
export const SEEDANCE_DEFAULT_MODEL: SeedanceModel =
  "doubao-seedance-2-5-260628";
export const SEEDANCE_DEFAULT_RESOLUTION: SeedanceResolution = "720p";
export const SEEDANCE_DEFAULT_ASPECT_RATIO: SeedanceAspectRatio = "adaptive";
export const SEEDANCE_DEFAULT_DURATION_SECONDS = -1;
export const SEEDANCE_DEFAULT_GENERATE_AUDIO = true;
export const SEEDANCE_DEFAULT_TASK_TYPE: SeedanceTaskType = "generate";

export function seedanceInputDurationLimit(model: SeedanceModel): number {
  return model === SEEDANCE_DEFAULT_MODEL ? 30 : 15;
}

export function seedanceVideoInputMinimum(
  model: SeedanceModel,
  taskType: SeedanceTaskType
): number {
  return model === SEEDANCE_DEFAULT_MODEL &&
    (taskType === "edit" || taskType === "extend")
    ? 4
    : 2;
}

export function isSeedanceDurationValid(
  model: SeedanceModel,
  durationSeconds: number
): boolean {
  if (durationSeconds === SEEDANCE_DEFAULT_DURATION_SECONDS) return true;
  const { minimum, maximum } = SEEDANCE_CAPABILITIES[model].duration;
  return (
    Number.isInteger(durationSeconds) &&
    durationSeconds >= minimum &&
    durationSeconds <= maximum
  );
}

export function normalizeSeedanceVideoParameters(
  model: SeedanceModel,
  parameters: {
    duration_seconds: number;
    resolution: SeedanceResolution;
  }
): {
  duration_seconds: number;
  resolution: SeedanceResolution;
} {
  const capabilities = SEEDANCE_CAPABILITIES[model];
  const resolutions: readonly SeedanceResolution[] = capabilities.resolutions;
  return {
    duration_seconds: isSeedanceDurationValid(model, parameters.duration_seconds)
      ? parameters.duration_seconds
      : SEEDANCE_DEFAULT_DURATION_SECONDS,
    resolution: resolutions.includes(parameters.resolution)
      ? parameters.resolution
      : SEEDANCE_DEFAULT_RESOLUTION
  };
}

export function validateSeedanceReferenceCounts(
  model: SeedanceModel,
  counts: { images: number; videos: number; audios: number }
): boolean {
  const capabilities = SEEDANCE_CAPABILITIES[model];
  return (
    counts.images <= capabilities.maxReferenceImages &&
    counts.videos <= capabilities.maxReferenceVideos &&
    counts.audios <= capabilities.maxReferenceAudios
  );
}
