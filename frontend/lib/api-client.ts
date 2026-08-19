import type {
  ApiErrorPayload,
  Asset,
  AssetCategory,
  CharacterAssetIterationRequest,
  CharacterAssetIterationResponse,
  CharacterCard,
  CharacterCardImageGenerationResponse,
  CharacterCardUpdate,
  ErrorCode,
  GenerationStreamEvent,
  GenerationStage,
  GenerationTask,
  ImageGenerationRequest,
  ImageLayerCompositionRequest,
  ImageLayerDecompositionRequest,
  ImageLayerSetDetail,
  ImageLayerSetUpdate,
  ImageToImageGenerationRequest,
  ImagePromptSuggestion,
  ImagePromptSuggestionRequest,
  ImagePromptVersion,
  ImagePromptVersionSave,
  PromptOptimizationStreamEvent,
  Project,
  ProjectCreate,
  ProjectListItem,
  ProjectUpdate,
  ReferenceAssetKind,
  SetCurrentImageRequest,
  Status,
  StoryboardShotGenerateVideoRequest,
  StoryboardShotFirstFrameRequest,
  StoryboardShotMergeRequest,
  StoryboardShotReferenceRequest,
  StoryboardShotReferenceUploadResponse,
  StoryboardShotVideoConfig,
  StoryboardShotVideoConfigUpdate,
  StoryboardShotVideoEditRequest,
  StoryboardShotVideoPromptOptimizeRequest,
  StoryboardShotVideoPromptOptimizeResponse,
  StoryboardShotVideoSelectionRequest,
  StoryboardTailFrameReferenceApplyResponse,
  TextStreamStage,
  TextArtifactUpdate,
  TextArtifactUpdateStage
} from "@/lib/api-types";
import { ERROR_CODES } from "@/lib/api-types";

const DEFAULT_BACKEND_BASE_URL = "http://localhost:8000";

const STAGE_ENDPOINTS: Record<GenerationStage, string> = {
  story: "story",
  character: "characters",
  script: "script",
  storyboard: "storyboard",
  image: "images",
  video: "videos",
  compose: "compose"
};

const TEXT_ARTIFACT_ENDPOINTS: Record<TextArtifactUpdateStage, string> = {
  script: "script",
  story: "story",
  storyboard: "storyboard"
};

export interface ApiClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
  headers?: HeadersInit;
}

export interface RequestOptions extends Omit<RequestInit, "body" | "method"> {
  headers?: HeadersInit;
}

export interface AssetFilters {
  category?: AssetCategory;
  projectId?: string;
  status?: Status;
}

interface RequestConfig extends RequestOptions {
  body?: BodyInit | unknown;
  json?: boolean;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
}

interface FastApiValidationError {
  detail: Array<{
    loc?: Array<string | number>;
    msg?: string;
    type?: string;
  }>;
}

interface FastApiErrorEnvelope {
  detail?: ApiErrorPayload | string | FastApiValidationError["detail"];
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly detail?: string;
  readonly responseBody: unknown;
  readonly status: number;

  constructor({
    code,
    detail,
    message,
    responseBody,
    status
  }: ApiErrorPayload & { responseBody: unknown; status: number }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.detail = detail;
    this.responseBody = responseBody;
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getSafeProviderErrorSummary(
  detail: string | null | undefined
): string | null {
  if (!detail) {
    return null;
  }
  const fields = new Map<string, string>();
  for (const part of detail.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (
      ["provider_code", "request_id", "provider_task_id", "phase"].includes(key) &&
      /^[A-Za-z0-9._:/-]{1,200}$/.test(value)
    ) {
      fields.set(key, value);
    }
  }
  const providerCode = fields.get("provider_code");
  if (!providerCode) {
    return null;
  }
  return [
    `方舟错误码：${providerCode}`,
    fields.get("request_id")
      ? `Request ID：${fields.get("request_id")}`
      : null,
    fields.get("provider_task_id")
      ? `任务 ID：${fields.get("provider_task_id")}`
      : null
  ]
    .filter(Boolean)
    .join(" · ");
}

function getSafeExternalServiceMessage(message: string | null | undefined): string | null {
  if (!message || message === "external provider error was redacted") {
    return null;
  }
  if (!/^[\w\s.,:/()_-]{1,160}$/.test(message)) {
    return null;
  }
  return message;
}

function getSafeExternalServiceErrorSummary(
  detail: string | null | undefined
): string | null {
  if (!detail) {
    return null;
  }
  const labels: Record<string, string> = {
    asset_id: "资产",
    phase: "阶段",
    provider: "服务",
    reason: "原因",
    returncode: "返回码",
    shot_id: "镜头"
  };
  const fields = new Map<string, string>();
  for (const part of detail.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (
      key in labels &&
      /^[A-Za-z0-9._:/-]{1,200}$/.test(value)
    ) {
      fields.set(key, value);
    }
  }
  return ["provider", "phase", "reason", "returncode", "shot_id", "asset_id"]
    .map((key) => {
      const value = fields.get(key);
      return value ? `${labels[key]}：${value}` : null;
    })
    .filter(Boolean)
    .join(" · ") || null;
}

export function getUserFacingErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === "validation_error" && error.detail) {
      return error.detail;
    }

    if (error.status >= 500) {
      if (error.code === "external_service_error") {
        const externalMessage = getSafeExternalServiceMessage(error.message);
        const externalSummary = getSafeExternalServiceErrorSummary(error.detail);
        const parts = [externalMessage, externalSummary].filter(Boolean);
        if (parts.length > 0) {
          return `服务暂时不可用。${parts.join(" · ")}`;
        }
      }
      const providerSummary = getSafeProviderErrorSummary(error.detail);
      return providerSummary
        ? `服务暂时不可用。${providerSummary}`
        : "服务暂时不可用，请稍后重试。";
    }

    return error.message || "请求未完成，请检查输入后重试。";
  }

  return "请求未完成，请检查网络连接后重试。";
}

export function getBackendBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_BASE_URL?.trim() || DEFAULT_BACKEND_BASE_URL
  );
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? getBackendBaseUrl());
  const fetcher = options.fetcher ?? fetch;
  const defaultHeaders = options.headers;

  return {
    listProjects(
      keywordOrOptions?: string | RequestOptions,
      options?: RequestOptions
    ) {
      const keyword =
        typeof keywordOrOptions === "string" ? keywordOrOptions : undefined;
      const requestOptions =
        typeof keywordOrOptions === "string" ? options : keywordOrOptions;
      const searchParams = new URLSearchParams();

      if (keyword) {
        searchParams.set("q", keyword);
      }

      const query = searchParams.toString();

      return request<ProjectListItem[]>(
        fetcher,
        baseUrl,
        `/api/projects${query ? `?${query}` : ""}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
        }
      );
    },

    createProject(payload: ProjectCreate, requestOptions?: RequestOptions) {
      return request<Project>(fetcher, baseUrl, "/api/projects", {
        ...requestOptions,
        body: payload,
        headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
        method: "POST"
      });
    },

    getProject(projectId: string, requestOptions?: RequestOptions) {
      return request<Project>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
        }
      );
    },

    deleteProject(projectId: string, requestOptions?: RequestOptions) {
      return request<void>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "DELETE"
        }
      );
    },

    updateProject(
      projectId: string,
      payload: ProjectUpdate,
      requestOptions?: RequestOptions
    ) {
      return request<Project>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "PATCH"
        }
      );
    },

    listImagePromptVersions(
      projectId: string,
      requestOptions?: RequestOptions
    ) {
      return request<ImagePromptVersion[]>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/image-prompt-versions`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
        }
      );
    },

    getImagePromptVersion(
      projectId: string,
      versionId: string,
      requestOptions?: RequestOptions
    ) {
      return request<ImagePromptVersion>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/image-prompt-versions/${encodeURIComponent(versionId)}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
        }
      );
    },

    saveImagePromptVersion(
      projectId: string,
      payload: ImagePromptVersionSave,
      requestOptions?: RequestOptions
    ) {
      return request<ImagePromptVersion>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/image-prompt-versions`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    generateImagePrompt(
      projectId: string,
      payload: ImagePromptSuggestionRequest,
      requestOptions?: RequestOptions
    ) {
      return request<ImagePromptSuggestion>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/image-prompts/generate`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    uploadImageProjectReference(
      projectId: string,
      file: Blob,
      options: { filename?: string; mimeType?: string } & RequestOptions = {}
    ) {
      const searchParams = new URLSearchParams();
      if (options.filename) searchParams.set("filename", options.filename);
      if (options.mimeType) searchParams.set("mime_type", options.mimeType);
      const query = searchParams.toString();
      return request<Asset>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/image-references/upload${query ? `?${query}` : ""}`,
        {
          ...options,
          body: file,
          headers: mergeHeaders(
            defaultHeaders,
            { "Content-Type": "application/octet-stream" },
            options.headers
          ),
          json: false,
          method: "POST"
        }
      );
    },

    generateProjectImage(
      projectId: string,
      payload: ImageGenerationRequest,
      requestOptions?: RequestOptions
    ) {
      return request<GenerationTask>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/image-generations`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    editProjectImage(
      projectId: string,
      payload: ImageToImageGenerationRequest,
      requestOptions?: RequestOptions
    ) {
      return request<GenerationTask>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/image-generations`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    decomposeImageLayers(
      projectId: string,
      payload: ImageLayerDecompositionRequest,
      requestOptions?: RequestOptions
    ) {
      return request<GenerationTask>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/image-layer-sets`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    listImageLayerSets(
      projectId: string,
      requestOptions?: RequestOptions
    ) {
      return request<ImageLayerSetDetail[]>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/image-layer-sets`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
        }
      );
    },

    getImageLayerSet(
      projectId: string,
      setId: string,
      requestOptions?: RequestOptions
    ) {
      return request<ImageLayerSetDetail>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/image-layer-sets/${encodeURIComponent(setId)}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
        }
      );
    },

    updateImageLayerSet(
      projectId: string,
      setId: string,
      payload: ImageLayerSetUpdate,
      requestOptions?: RequestOptions
    ) {
      return request<ImageLayerSetDetail>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/image-layer-sets/${encodeURIComponent(setId)}`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "PATCH"
        }
      );
    },

    composeImageLayers(
      projectId: string,
      payload: ImageLayerCompositionRequest,
      requestOptions?: RequestOptions
    ) {
      return request<GenerationTask>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/image-layer-compositions`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    selectCurrentImage(
      projectId: string,
      payload: SetCurrentImageRequest,
      requestOptions?: RequestOptions
    ) {
      return request<Project>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/current-image`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "PATCH"
        }
      );
    },

    updateTextArtifact(
      projectId: string,
      stage: TextArtifactUpdateStage,
      payload: TextArtifactUpdate,
      requestOptions?: RequestOptions
    ) {
      const endpoint = TEXT_ARTIFACT_ENDPOINTS[stage];

      return request<Project>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/${endpoint}`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "PATCH"
        }
      );
    },

    deleteTextArtifact(
      projectId: string,
      artifactId: string,
      requestOptions?: RequestOptions
    ) {
      return request<Project>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/text-artifacts/${encodeURIComponent(artifactId)}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "DELETE"
        }
      );
    },

    listProjectAssets(projectId: string, requestOptions?: RequestOptions) {
      return request<Asset[]>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/assets`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
        }
      );
    },

    listAssets(filters: AssetFilters = {}, requestOptions?: RequestOptions) {
      const searchParams = new URLSearchParams();

      if (filters.projectId) {
        searchParams.set("project_id", filters.projectId);
      }

      if (filters.category) {
        searchParams.set("category", filters.category);
      }

      if (filters.status) {
        searchParams.set("status", filters.status);
      }

      const query = searchParams.toString();

      return request<Asset[]>(
        fetcher,
        baseUrl,
        `/api/assets${query ? `?${query}` : ""}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
        }
      );
    },

    getAsset(assetId: string, requestOptions?: RequestOptions) {
      return request<Asset>(
        fetcher,
        baseUrl,
        `/api/assets/${encodeURIComponent(assetId)}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
        }
      );
    },

    deleteAsset(
      projectId: string,
      assetId: string,
      requestOptions?: RequestOptions
    ) {
      return request<Project>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "DELETE"
        }
      );
    },

    generateStage(
      projectId: string,
      stage: GenerationStage,
      requestOptions?: RequestOptions
    ) {
      const endpoint = STAGE_ENDPOINTS[stage];

      return request<GenerationTask>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/${endpoint}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    streamGenerationStage(
      projectId: string,
      stage: TextStreamStage,
      onEvent: (event: GenerationStreamEvent) => void,
      requestOptions?: RequestOptions
    ) {
      const endpoint = STAGE_ENDPOINTS[stage];
      return requestEventStream(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/${endpoint}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        },
        parseGenerationStreamEvent,
        onEvent
      );
    },

    skipCharacters(projectId: string, requestOptions?: RequestOptions) {
      return request<GenerationTask>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/characters/skip`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    iterateCharacterAsset(
      projectId: string,
      payload: CharacterAssetIterationRequest,
      requestOptions?: RequestOptions
    ) {
      return request<CharacterAssetIterationResponse>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/character-assets/iterations`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    updateCharacterCard(
      projectId: string,
      cardId: string,
      payload: CharacterCardUpdate,
      requestOptions?: RequestOptions
    ) {
      return request<CharacterCard>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/character-cards/${encodeURIComponent(cardId)}`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "PATCH"
        }
      );
    },

    deleteCharacterCard(
      projectId: string,
      cardId: string,
      requestOptions?: RequestOptions
    ) {
      return request<Project>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/character-cards/${encodeURIComponent(cardId)}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "DELETE"
        }
      );
    },

    generateCharacterCardImage(
      projectId: string,
      cardId: string,
      requestOptions?: RequestOptions
    ) {
      return request<CharacterCardImageGenerationResponse>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/character-cards/${encodeURIComponent(cardId)}/generate-image`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    getStoryboardShotVideoConfig(
      projectId: string,
      shotId: string,
      requestOptions?: RequestOptions
    ) {
      return request<StoryboardShotVideoConfig>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/video-config`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
        }
      );
    },

    updateStoryboardShotVideoConfig(
      projectId: string,
      shotId: string,
      payload: StoryboardShotVideoConfigUpdate,
      requestOptions?: RequestOptions
    ) {
      return request<StoryboardShotVideoConfig>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/video-config`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "PATCH"
        }
      );
    },

    optimizeStoryboardShotVideoPrompt(
      projectId: string,
      shotId: string,
      videoPrompt: string | null,
      onEvent: (event: PromptOptimizationStreamEvent) => void = () => {},
      requestOptions?: RequestOptions
    ) {
      let completed: StoryboardShotVideoPromptOptimizeResponse | null = null;
      return requestEventStream(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/optimize-video-prompt`,
        {
          ...requestOptions,
          body: {
            video_prompt: videoPrompt
          } satisfies StoryboardShotVideoPromptOptimizeRequest,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        },
        parsePromptOptimizationStreamEvent,
        (event) => {
          onEvent(event);
          if (event.type === "complete") {
            completed = { optimized_prompt: event.optimized_prompt };
          }
        }
      ).then(() => {
        if (completed === null) {
          throw new ApiError({
            code: "generation_failed",
            message: "optimization stream ended without a result",
            responseBody: null,
            status: 500
          });
        }
        return completed;
      });
    },

    setStoryboardShotFirstFrame(
      projectId: string,
      shotId: string,
      payload: StoryboardShotFirstFrameRequest,
      requestOptions?: RequestOptions
    ) {
      return request<StoryboardShotVideoConfig>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/first-frame`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    clearStoryboardShotFirstFrame(
      projectId: string,
      shotId: string,
      requestOptions?: RequestOptions
    ) {
      return request<StoryboardShotVideoConfig>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/first-frame`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "DELETE"
        }
      );
    },

    uploadStoryboardShotFirstFrame(
      projectId: string,
      shotId: string,
      file: Blob,
      options: { filename?: string; mimeType?: string } & RequestOptions = {}
    ) {
      const searchParams = new URLSearchParams();
      if (options.filename) searchParams.set("filename", options.filename);
      if (options.mimeType) searchParams.set("mime_type", options.mimeType);
      return request<StoryboardShotReferenceUploadResponse>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/first-frame/upload?${searchParams.toString()}`,
        {
          ...options,
          body: file,
          headers: mergeHeaders(
            defaultHeaders,
            { "Content-Type": options.mimeType || file.type || "application/octet-stream" },
            options.headers
          ),
          json: false,
          method: "POST"
        }
      );
    },

    attachStoryboardShotReference(
      projectId: string,
      shotId: string,
      payload: StoryboardShotReferenceRequest,
      requestOptions?: RequestOptions
    ) {
      return request<StoryboardShotVideoConfig>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/references`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    removeStoryboardShotReference(
      projectId: string,
      shotId: string,
      payload: StoryboardShotReferenceRequest,
      requestOptions?: RequestOptions
    ) {
      return request<StoryboardShotVideoConfig>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/references`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "DELETE"
        }
      );
    },

    applyStoryboardShotLastFrameReference(
      projectId: string,
      shotId: string,
      requestOptions?: RequestOptions
    ) {
      return request<StoryboardTailFrameReferenceApplyResponse>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/last-frame-reference`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    ensureStoryboardShotLastFrameReferenceAsset(
      projectId: string,
      shotId: string,
      requestOptions?: RequestOptions
    ) {
      return request<Asset>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/last-frame-reference-asset`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    deleteStoryboardShot(
      projectId: string,
      shotId: string,
      requestOptions?: RequestOptions
    ) {
      return request<Project>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "DELETE"
        }
      );
    },

    mergeStoryboardShots(
      projectId: string,
      shotIds: string[],
      requestOptions?: RequestOptions
    ) {
      return request<Project>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/merge`,
        {
          ...requestOptions,
          body: { shot_ids: shotIds } satisfies StoryboardShotMergeRequest,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    splitStoryboardShot(
      projectId: string,
      shotId: string,
      requestOptions?: RequestOptions
    ) {
      return request<Project>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/split`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    uploadStoryboardShotReference(
      projectId: string,
      shotId: string,
      kind: ReferenceAssetKind,
      file: Blob,
      options: { filename?: string; mimeType?: string } & RequestOptions = {}
    ) {
      const searchParams = new URLSearchParams({ kind });
      if (options.filename) {
        searchParams.set("filename", options.filename);
      }
      if (options.mimeType) {
        searchParams.set("mime_type", options.mimeType);
      }
      return request<StoryboardShotReferenceUploadResponse>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/references/upload?${searchParams.toString()}`,
        {
          ...options,
          body: file,
          headers: mergeHeaders(
            defaultHeaders,
            { "Content-Type": options.mimeType || file.type || "application/octet-stream" },
            options.headers
          ),
          json: false,
          method: "POST"
        }
      );
    },

    generateStoryboardShotVideo(
      projectId: string,
      shotId: string,
      requestOptions?: RequestOptions
    ) {
      return request<GenerationTask>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/generate-video`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    editStoryboardShotVideo(
      projectId: string,
      shotId: string,
      payload: StoryboardShotVideoEditRequest,
      requestOptions?: RequestOptions
    ) {
      return request<GenerationTask>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/edit-video`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    selectStoryboardShotVideo(
      projectId: string,
      shotId: string,
      payload: StoryboardShotVideoSelectionRequest,
      requestOptions?: RequestOptions
    ) {
      return request<StoryboardShotVideoConfig>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/select-video`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    generateStoryboardShotVideoByLocator(
      projectId: string,
      payload: StoryboardShotGenerateVideoRequest,
      requestOptions?: RequestOptions
    ) {
      return request<GenerationTask>(
        fetcher,
        baseUrl,
        `/api/projects/${encodeURIComponent(projectId)}/storyboard/generate-video`,
        {
          ...requestOptions,
          body: payload,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    getTask(taskId: string, requestOptions?: RequestOptions) {
      return request<GenerationTask>(
        fetcher,
        baseUrl,
        `/api/tasks/${encodeURIComponent(taskId)}`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
        }
      );
    },

    retryTask(taskId: string, requestOptions?: RequestOptions) {
      return request<GenerationTask>(
        fetcher,
        baseUrl,
        `/api/tasks/${encodeURIComponent(taskId)}/retry`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        }
      );
    },

    retryTextTask(
      taskId: string,
      onEvent: (event: GenerationStreamEvent) => void,
      requestOptions?: RequestOptions
    ) {
      return requestEventStream(
        fetcher,
        baseUrl,
        `/api/tasks/${encodeURIComponent(taskId)}/retry`,
        {
          ...requestOptions,
          headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
          method: "POST"
        },
        parseGenerationStreamEvent,
        onEvent
      );
    }
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const apiClient = createApiClient();

async function requestEventStream<T>(
  fetcher: typeof fetch,
  baseUrl: string,
  path: string,
  config: RequestConfig,
  parseEvent: (eventName: string, data: unknown) => T,
  onEvent: (event: T) => void
): Promise<void> {
  const { body, headers, json = true, method = "POST", ...requestOptions } = config;
  const response = await fetcher(buildUrl(baseUrl, path), {
    ...requestOptions,
    body: body === undefined ? undefined : json ? JSON.stringify(body) : body as BodyInit,
    headers: mergeHeaders(
      { Accept: "text/event-stream" },
      body === undefined || !json ? undefined : { "Content-Type": "application/json" },
      headers
    ),
    method
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }
  if (!response.body) {
    throw streamProtocolError("stream response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  async function dispatch(block: string) {
    const parsed = parseSseBlock(block);
    if (!parsed) return;
    const data = parsed.data.length > 0 ? JSON.parse(parsed.data) : null;
    const event = parseEvent(parsed.event, data);
    onEvent(event);
    if (parsed.event === "error" && isApiErrorPayload(data)) {
      const payload = sanitizeApiErrorPayload(data);
      throw new ApiError({
        ...payload,
        responseBody: data,
        status: 500
      });
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let match = /\r?\n\r?\n/.exec(buffer);
    while (match) {
      const block = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      await dispatch(block);
      match = /\r?\n\r?\n/.exec(buffer);
    }
    if (done) break;
  }
  if (buffer.trim().length > 0) {
    await dispatch(buffer);
  }
}

function parseSseBlock(
  block: string
): { event: string; data: string } | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data.push(line.slice(5).trimStart());
    }
  }
  return data.length > 0 ? { event, data: data.join("\n") } : null;
}

function parseGenerationStreamEvent(
  eventName: string,
  data: unknown
): GenerationStreamEvent {
  if (!isObject(data)) throw streamProtocolError("invalid generation stream event");
  if (eventName === "delta" && typeof data.text === "string") {
    return { type: "delta", text: data.text };
  }
  if (
    (eventName === "task" || eventName === "complete") &&
    isObject(data.task)
  ) {
    return {
      type: eventName,
      task: data.task as unknown as GenerationTask
    };
  }
  if (eventName === "error" && isApiErrorPayload(data)) {
    return { type: "error", error: sanitizeApiErrorPayload(data) };
  }
  throw streamProtocolError(`unsupported generation stream event: ${eventName}`);
}

function parsePromptOptimizationStreamEvent(
  eventName: string,
  data: unknown
): PromptOptimizationStreamEvent {
  if (!isObject(data)) throw streamProtocolError("invalid optimization stream event");
  if (eventName === "delta" && typeof data.text === "string") {
    return { type: "delta", text: data.text };
  }
  if (
    eventName === "complete" &&
    typeof data.optimized_prompt === "string"
  ) {
    return {
      type: "complete",
      optimized_prompt: data.optimized_prompt
    };
  }
  if (eventName === "error" && isApiErrorPayload(data)) {
    return { type: "error", error: sanitizeApiErrorPayload(data) };
  }
  throw streamProtocolError(`unsupported optimization stream event: ${eventName}`);
}

function streamProtocolError(message: string): ApiError {
  return new ApiError({
    code: "generation_failed",
    message,
    responseBody: null,
    status: 500
  });
}

async function request<T>(
  fetcher: typeof fetch,
  baseUrl: string,
  path: string,
  config: RequestConfig = {}
): Promise<T> {
  const { body, headers, json = true, method = "GET", ...requestOptions } = config;
  const response = await fetcher(buildUrl(baseUrl, path), {
    ...requestOptions,
    body: body === undefined ? undefined : json ? JSON.stringify(body) : body as BodyInit,
    headers: mergeHeaders(
      body === undefined || !json ? undefined : { "Content-Type": "application/json" },
      headers
    ),
    method
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function parseApiError(response: Response): Promise<ApiError> {
  const responseBody = sanitizeErrorBody(await readResponseBody(response));
  const payload = sanitizeApiErrorPayload(
    toApiErrorPayload(response.status, responseBody)
  );

  return new ApiError({
    ...payload,
    responseBody,
    status: response.status
  });
}

function toApiErrorPayload(status: number, body: unknown): ApiErrorPayload {
  if (isObject(body)) {
    const detail = (body as FastApiErrorEnvelope).detail;

    if (isApiErrorPayload(detail)) {
      return detail;
    }

    if (Array.isArray(detail)) {
      return {
        code: "validation_error",
        detail: formatValidationDetail(detail),
        message: "request validation failed"
      };
    }

    if (typeof detail === "string" && detail.length > 0) {
      return {
        code: "unknown",
        detail,
        message: detail
      };
    }

    if (isApiErrorPayload(body)) {
      return body;
    }
  }

  return {
    code: "unknown",
    detail: typeof body === "string" && body.length > 0 ? body : undefined,
    message: `request failed with status ${status}`
  };
}

function sanitizeApiErrorPayload(payload: ApiErrorPayload): ApiErrorPayload {
  return {
    ...payload,
    detail: payload.detail ? sanitizeErrorText(payload.detail) : undefined,
    message: sanitizeErrorText(payload.message)
  };
}

function sanitizeErrorBody(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeErrorText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeErrorBody(item));
  }

  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeErrorBody(item)])
    );
  }

  return value;
}

function sanitizeErrorText(value: string): string {
  let sanitized = value.replace(
    /https?:\/\/[^\s"'<>]+/gi,
    (url) => {
      try {
        const parsed = new URL(url);
        if (
          /(^|&)(x-tos-|signature|x-amz-|expires|token)/i.test(parsed.search.slice(1))
        ) {
          parsed.search = "";
        }
        return parsed.toString();
      } catch {
        return url;
      }
    }
  );

  sanitized = sanitized.replace(
    /\b(ark[_-]?(?:api[_-]?)?key|tos[_-]?(?:ak|sk|access[_-]?key|secret[_-]?key)|password|passwd|pwd|secret|token|signature)\b\s*[:=]\s*[^,\s;]+/gi,
    "$1=[redacted]"
  );
  sanitized = sanitized.replace(
    /\b(sk-[a-z0-9][a-z0-9._-]{8,}|ak-[a-z0-9][a-z0-9._-]{8,}|ark-[a-z0-9][a-z0-9._-]{8,})\b/gi,
    "[redacted-key]"
  );
  sanitized = sanitized.replace(
    /\b((?:mysql|postgres(?:ql)?):\/\/[^:\s/@]+):([^@\s]+)@/gi,
    "$1:[redacted]@"
  );

  if (
    /\b(provider|vendor|upstream)\b/i.test(sanitized) &&
    /\b(sensitive|secret|signature|token|password|sk-|ark[_-]?key|tos[_-]?(?:ak|sk))\b/i.test(sanitized)
  ) {
    return "external provider error was redacted";
  }

  return sanitized;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function mergeHeaders(...headersList: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const headersInit of headersList) {
    if (headersInit === undefined) {
      continue;
    }

    new Headers(headersInit).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return (
    isObject(value) &&
    isErrorCode(value.code) &&
    typeof value.message === "string"
  );
}

function isErrorCode(value: unknown): value is ErrorCode {
  return (
    typeof value === "string" && ERROR_CODES.includes(value as ErrorCode)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatValidationDetail(detail: FastApiValidationError["detail"]): string {
  return detail
    .map((item) => {
      const path = item.loc?.join(".");
      return path ? `${path}: ${item.msg ?? item.type ?? "invalid"}` : item.msg;
    })
    .filter(Boolean)
    .join("; ");
}
