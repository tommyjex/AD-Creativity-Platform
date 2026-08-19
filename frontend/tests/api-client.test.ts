import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createApiClient,
  getBackendBaseUrl,
  getSafeProviderErrorSummary,
  getUserFacingErrorMessage,
  isApiError
} from "@/lib/api-client";
import type {
  Asset,
  CharacterCard,
  GenerationTask,
  Project,
  ProjectListItem
} from "@/lib/api-types";

const projectFixture: Project = {
  assets: [],
  brief: {
    aspect_ratio: "9:16",
    audience: null,
    duration_seconds: 30,
    image_purpose: null,
    product_name: "AeroPress Go",
    prompt: "生成一条 30 秒短视频广告",
    selling_points: [],
    style: null,
    summary: null,
    target_language: "zh",
    target_platform: "douyin"
  },
  character_cards: [],
  created_at: "2026-08-09T10:00:00Z",
  current_stage: "brief",
  current_image_asset_id: null,
  current_image_prompt_version_id: null,
  id: "project-1",
  name: "AeroPress Go 创意项目",
  image_prompt_status: "draft",
  image_revision: 0,
  project_type: "video_ad",
  status: "draft",
  storyboard: [],
  tasks: [],
  text_artifacts: [],
  updated_at: "2026-08-09T10:00:00Z"
};

const taskFixture: GenerationTask = {
  created_at: "2026-08-09T10:00:00Z",
  error: null,
  finished_at: null,
  id: "task-1",
  input_hash: null,
  output_asset_ids: [],
  output_text_artifact_id: null,
  progress: 0,
  progress_message: null,
  project_id: "project-1",
  stage: "video",
  started_at: null,
  status: "queued",
  updated_at: "2026-08-09T10:00:00Z"
};

const projectListFixture: ProjectListItem[] = [
  {
    brief: projectFixture.brief,
    created_at: projectFixture.created_at,
    current_stage: projectFixture.current_stage,
    current_image_asset_id: projectFixture.current_image_asset_id,
    current_image_prompt_version_id:
      projectFixture.current_image_prompt_version_id,
    id: projectFixture.id,
    name: projectFixture.name,
    image_prompt_status: projectFixture.image_prompt_status,
    image_revision: projectFixture.image_revision,
    project_type: projectFixture.project_type,
    status: projectFixture.status,
    updated_at: projectFixture.updated_at
  }
];

const assetFixture: Asset = {
  category: "character",
  created_at: "2026-08-09T10:00:00Z",
  id: "asset-1",
  metadata: { description: "城市通勤主角" },
  mime_type: "image/png",
  object_key: "projects/project-1/character.png",
  project_id: "project-1",
  size_bytes: 1024,
  source_task_id: "task-1",
  stage: "character",
  status: "succeeded",
  type: "generated_image",
  updated_at: "2026-08-09T10:00:00Z",
  url: "https://cdn.example.test/character.png"
};

const characterCardFixture: CharacterCard = {
  asset_id: assetFixture.id,
  created_at: "2026-08-09T10:00:00Z",
  description: "城市通勤主角",
  id: "card-1",
  name: "通勤主角",
  project_id: "project-1",
  sort_order: 0,
  status: "succeeded",
  updated_at: "2026-08-09T10:00:00Z"
};

const storyboardVideoConfigFixture = {
  effective_video_prompt: "镜头运动提示词",
  reference_audio_asset_ids: [],
  reference_image_asset_ids: ["asset-image"],
  reference_video_asset_ids: [],
  shot_id: "shot-1",
  shot_index: 1,
  video_asset_id: null,
  video_prompt: "镜头运动提示词"
};

describe("createApiClient", () => {
  it("lists project summaries", async () => {
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse(projectListFixture)
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(api.listProjects({ cache: "no-store" })).resolves.toEqual(
      projectListFixture
    );

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("http://backend.local/api/projects");
    expect(init?.method).toBe("GET");
    expect(init?.cache).toBe("no-store");
  });

  it("lists projects with an encoded keyword", async () => {
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse(projectListFixture)
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.listProjects("咖啡 & tea/壶", { cache: "no-store" })
    ).resolves.toEqual(projectListFixture);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://backend.local/api/projects?q=%E5%92%96%E5%95%A1+%26+tea%2F%E5%A3%B6"
    );
    expect(init?.method).toBe("GET");
    expect(init?.cache).toBe("no-store");
  });

  it("deletes an encoded project id and handles a 204 response", async () => {
    const fetcher = vi.fn<FetchFunction>(
      async () => new Response(null, { status: 204 })
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.deleteProject("project/with space")
    ).resolves.toBeUndefined();

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://backend.local/api/projects/project%2Fwith%20space"
    );
    expect(init?.method).toBe("DELETE");
  });

  it("posts project payloads with JSON headers and normalized base URL", async () => {
    const fetcher = vi.fn<FetchFunction>(async () => jsonResponse(projectFixture));
    const api = createApiClient({
      baseUrl: "http://backend.local///",
      fetcher,
      headers: { "x-request-id": "test-request" }
    });

    const payload = {
      brief: {
        duration_seconds: 30,
        prompt: "生成一条 30 秒短视频广告"
      },
      name: "AeroPress Go 创意项目"
    };

    await expect(api.createProject(payload)).resolves.toEqual(projectFixture);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    const headers = init?.headers;

    expect(url).toBe("http://backend.local/api/projects");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(payload);
    expect(headers).toBeInstanceOf(Headers);
    expect((headers as Headers).get("content-type")).toBe("application/json");
    expect((headers as Headers).get("x-request-id")).toBe("test-request");
  });

  it("patches project and Brief fields using an encoded project id", async () => {
    const fetcher = vi.fn<FetchFunction>(async () => jsonResponse(projectFixture));
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });
    const payload = {
      brief: {
        duration_seconds: 45,
        prompt: "更新后的广告需求"
      },
      name: "更新后的项目"
    };

    await expect(
      api.updateProject("project/with slash", payload)
    ).resolves.toEqual(projectFixture);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://backend.local/api/projects/project%2Fwith%20slash"
    );
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual(payload);
  });

  it("lists, reads, and saves image prompt versions", async () => {
    const version = {
      aspect_ratio: "1:1",
      created_at: "2026-08-16T08:00:00Z",
      id: "prompt-version-1",
      image_purpose: "ecommerce_main",
      project_id: "project/with slash",
      prompt: "Product hero prompt",
      target_language: "en",
      version: 1
    } as const;
    const fetcher = vi
      .fn<FetchFunction>()
      .mockResolvedValueOnce(jsonResponse([version]))
      .mockResolvedValueOnce(jsonResponse(version))
      .mockResolvedValueOnce(jsonResponse(version));
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await api.listImagePromptVersions("project/with slash");
    await api.getImagePromptVersion("project/with slash", version.id);
    await api.saveImagePromptVersion("project/with slash", {
      prompt: version.prompt
    });

    expect(fetcher.mock.calls[0][0]).toBe(
      "http://backend.local/api/projects/project%2Fwith%20slash/image-prompt-versions"
    );
    expect(fetcher.mock.calls[1][0]).toBe(
      "http://backend.local/api/projects/project%2Fwith%20slash/image-prompt-versions/prompt-version-1"
    );
    expect(fetcher.mock.calls[2][1]?.method).toBe("POST");
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toEqual({
      prompt: version.prompt
    });
  });

  it("generates an AI image prompt without saving and uploads a project reference", async () => {
    const suggestion = {
      model: "doubao-seed-evolving",
      prompt: "AI generated product prompt"
    };
    const reference = {
      ...assetFixture,
      category: "reference" as const,
      id: "reference-1",
      metadata: {
        name: "参考 图.webp",
        reference_kind: "image",
        usage: "image_generation_reference"
      },
      type: "uploaded_image" as const,
      url: "https://assets.example.test/reference.webp"
    };
    const fetcher = vi
      .fn<FetchFunction>()
      .mockResolvedValueOnce(jsonResponse(suggestion))
      .mockResolvedValueOnce(jsonResponse(reference, { status: 201 }));
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });
    const file = new File(["webp-content"], "参考 图.webp", {
      type: "image/webp"
    });

    await expect(
      api.generateImagePrompt("project/1", {
        current_prompt: "Keep the product centered."
      })
    ).resolves.toEqual(suggestion);
    await expect(
      api.uploadImageProjectReference("project/1", file, {
        filename: file.name,
        mimeType: file.type
      })
    ).resolves.toEqual(reference);

    expect(fetcher.mock.calls[0][0]).toBe(
      "http://backend.local/api/projects/project%2F1/image-prompts/generate"
    );
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      current_prompt: "Keep the product centered."
    });
    expect(fetcher.mock.calls[1][0]).toBe(
      "http://backend.local/api/projects/project%2F1/image-references/upload?filename=%E5%8F%82%E8%80%83+%E5%9B%BE.webp&mime_type=image%2Fwebp"
    );
    expect(fetcher.mock.calls[1][1]?.body).toBe(file);
    expect(
      (fetcher.mock.calls[1][1]?.headers as Headers).get("content-type")
    ).toBe("application/octet-stream");
  });

  it("submits image generation/edit, selects current, and retries frozen tasks", async () => {
    const fetcher = vi
      .fn<FetchFunction>()
      .mockResolvedValueOnce(jsonResponse(taskFixture, { status: 202 }))
      .mockResolvedValueOnce(jsonResponse(taskFixture, { status: 202 }))
      .mockResolvedValueOnce(jsonResponse(projectFixture))
      .mockResolvedValueOnce(jsonResponse(taskFixture));
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await api.generateProjectImage("project/1", {
      format: "png",
      operation: "text_to_image",
      prompt_version_id: "prompt/1",
      reference_asset_id: "reference/1",
      size: "2K"
    });
    await api.editProjectImage("project/1", {
      annotation: { type: "point", x: 321, y: 654 },
      format: "jpeg",
      operation: "image_to_image",
      prompt: "Replace the selected object.",
      size: "1K",
      source_asset_id: "asset/1"
    });
    await api.selectCurrentImage("project/1", {
      asset_id: "asset/1",
      expected_image_revision: 4
    });
    await api.retryTask("task/1");

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "http://backend.local/api/projects/project%2F1/image-generations",
      "http://backend.local/api/projects/project%2F1/image-generations",
      "http://backend.local/api/projects/project%2F1/current-image",
      "http://backend.local/api/tasks/task%2F1/retry"
    ]);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      format: "png",
      operation: "text_to_image",
      prompt_version_id: "prompt/1",
      reference_asset_id: "reference/1",
      size: "2K"
    });
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual(
      expect.objectContaining({
        annotation: { type: "point", x: 321, y: 654 },
        operation: "image_to_image"
      })
    );
    expect(fetcher.mock.calls[2][1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toEqual({
      asset_id: "asset/1",
      expected_image_revision: 4
    });
  });

  it("submits and reads image layer decompositions with encoded ids", async () => {
    const fetcher = vi
      .fn<FetchFunction>()
      .mockResolvedValueOnce(jsonResponse(taskFixture, { status: 202 }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}));
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await api.decomposeImageLayers("project/1", {
      bbox: { type: "bbox", x1: 1, y1: 2, x2: 998, y2: 999 },
      format: "png",
      prompt: "Split the selected product.",
      size: "auto",
      source_asset_id: "asset/1"
    });
    await api.listImageLayerSets("project/1");
    await api.getImageLayerSet("project/1", "set/1");
    await api.updateImageLayerSet("project/1", "set/1", {
      expected_revision: 2,
      layers: [
        {
          id: "layer/1",
          scale: 1.5,
          visible: true,
          x: 12,
          y: 24,
          z_index: 1
        }
      ]
    });

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "http://backend.local/api/projects/project%2F1/image-layer-sets",
      "http://backend.local/api/projects/project%2F1/image-layer-sets",
      "http://backend.local/api/projects/project%2F1/image-layer-sets/set%2F1",
      "http://backend.local/api/projects/project%2F1/image-layer-sets/set%2F1"
    ]);
    expect(fetcher.mock.calls[0][1]?.method).toBe("POST");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual(
      expect.objectContaining({
        bbox: { type: "bbox", x1: 1, y1: 2, x2: 998, y2: 999 },
        size: "auto",
        source_asset_id: "asset/1"
      })
    );
    expect(fetcher.mock.calls[3][1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetcher.mock.calls[3][1]?.body))).toEqual({
      expected_revision: 2,
      layers: [
        {
          id: "layer/1",
          scale: 1.5,
          visible: true,
          x: 12,
          y: 24,
          z_index: 1
        }
      ]
    });
  });

  it("patches story, script, and storyboard text artifacts using encoded project ids", async () => {
    const fetcher = vi.fn<FetchFunction>(async () => jsonResponse(projectFixture));
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.updateTextArtifact("project/with slash", "story", {
        content: "编辑后的故事"
      })
    ).resolves.toEqual(projectFixture);
    await expect(
      api.updateTextArtifact("project/with slash", "script", {
        content: "编辑后的剧本"
      })
    ).resolves.toEqual(projectFixture);
    await expect(
      api.updateTextArtifact("project/with slash", "storyboard", {
        content: "编辑后的分镜脚本"
      })
    ).resolves.toEqual(projectFixture);

    expect(fetcher.mock.calls[0][0]).toBe(
      "http://backend.local/api/projects/project%2Fwith%20slash/story"
    );
    expect(fetcher.mock.calls[0][1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      content: "编辑后的故事"
    });
    expect(fetcher.mock.calls[1][0]).toBe(
      "http://backend.local/api/projects/project%2Fwith%20slash/script"
    );
    expect(fetcher.mock.calls[1][1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      content: "编辑后的剧本"
    });
    expect(fetcher.mock.calls[2][0]).toBe(
      "http://backend.local/api/projects/project%2Fwith%20slash/storyboard"
    );
    expect(fetcher.mock.calls[2][1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toEqual({
      content: "编辑后的分镜脚本"
    });
  });

  it("lists assets with encoded project, category, and status filters", async () => {
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse([assetFixture])
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.listAssets(
        {
          category: "character",
          projectId: "project/with space",
          status: "succeeded"
        },
        { cache: "no-store" }
      )
    ).resolves.toEqual([assetFixture]);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://backend.local/api/assets?project_id=project%2Fwith+space&category=character&status=succeeded"
    );
    expect(init?.method).toBe("GET");
    expect(init?.cache).toBe("no-store");
  });

  it("lists all assets without adding an empty query string", async () => {
    const fetcher = vi.fn<FetchFunction>(async () => jsonResponse([]));
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await api.listAssets();

    expect(fetcher.mock.calls[0][0]).toBe("http://backend.local/api/assets");
  });

  it("maps generation stages to the expected encoded API endpoints", async () => {
    const fetcher = vi.fn<FetchFunction>(async () => jsonResponse(taskFixture));
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(api.generateStage("project/with slash", "video")).resolves.toEqual(
      taskFixture
    );

    const [url, init] = fetcher.mock.calls[0];

    expect(url).toBe("http://backend.local/api/projects/project%2Fwith%20slash/videos");
    expect(init?.method).toBe("POST");
  });

  it("parses generation SSE events across arbitrary response chunks", async () => {
    const storyTask = { ...taskFixture, stage: "story" as const };
    const body = [
      `event: task\ndata: ${JSON.stringify({ task: storyTask })}\n\n`,
      `event: delta\ndata: ${JSON.stringify({ text: "中文流式内容" })}\n\n`,
      `event: complete\ndata: ${JSON.stringify({
        task: { ...storyTask, status: "succeeded" }
      })}\n\n`
    ].join("");
    const encoded = new TextEncoder().encode(body);
    const fetcher = vi.fn<FetchFunction>(async () =>
      chunkedSseResponse(encoded, [7, 31, 93, encoded.length - 5])
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });
    const events: unknown[] = [];

    await api.streamGenerationStage(
      "project/1",
      "story",
      (event) => events.push(event)
    );

    expect(events).toEqual([
      { type: "task", task: storyTask },
      { type: "delta", text: "中文流式内容" },
      {
        type: "complete",
        task: { ...storyTask, status: "succeeded" }
      }
    ]);
    expect(fetcher.mock.calls[0][0]).toBe(
      "http://backend.local/api/projects/project%2F1/story"
    );
    expect((fetcher.mock.calls[0][1]?.headers as Headers).get("accept")).toBe(
      "text/event-stream"
    );
  });

  it("turns SSE error events into ApiError", async () => {
    const fetcher = vi.fn<FetchFunction>(async () =>
      sseResponse([
        [
          "error",
          {
            code: "generation_failed",
            message: "generation failed"
          }
        ]
      ])
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });
    const events: unknown[] = [];

    await expect(
      api.streamGenerationStage(
        "project-1",
        "script",
        (event) => events.push(event)
      )
    ).rejects.toMatchObject({
      code: "generation_failed",
      message: "generation failed",
      status: 500
    });
    expect(events).toEqual([
      {
        type: "error",
        error: {
          code: "generation_failed",
          message: "generation failed"
        }
      }
    ]);
  });

  it("passes AbortSignal through to streaming requests", async () => {
    const fetcher = vi.fn<FetchFunction>(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true }
          );
        })
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });
    const controller = new AbortController();

    const request = api.streamGenerationStage(
      "project-1",
      "storyboard",
      vi.fn(),
      { signal: controller.signal }
    );
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("maps the character stage to the characters generation endpoint", async () => {
    const characterTask = { ...taskFixture, stage: "character" as const };
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse(characterTask)
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.generateStage("project-1", "character")
    ).resolves.toEqual(characterTask);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://backend.local/api/projects/project-1/characters"
    );
    expect(init?.method).toBe("POST");
  });

  it("posts an explicit character skip request", async () => {
    const skippedTask = {
      ...taskFixture,
      stage: "character" as const,
      status: "skipped" as const
    };
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse(skippedTask)
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(api.skipCharacters("project/1")).resolves.toEqual(skippedTask);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://backend.local/api/projects/project%2F1/characters/skip"
    );
    expect(init?.method).toBe("POST");
  });

  it("posts character asset iteration requests", async () => {
    const responsePayload = {
      asset: assetFixture,
      operation_type: "regenerate",
      prompt: "调整为更自然的通勤姿态",
      source_asset_id: "asset/source"
    };
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse({
        ...responsePayload,
        task: {
          ...taskFixture,
          output_asset_ids: [assetFixture.id],
          stage: "character"
        }
      })
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.iterateCharacterAsset("project/1", {
        asset_id: "asset/source",
        operation_type: "regenerate",
        prompt: "调整为更自然的通勤姿态"
      })
    ).resolves.toMatchObject(responsePayload);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://backend.local/api/projects/project%2F1/character-assets/iterations"
    );
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      asset_id: "asset/source",
      operation_type: "regenerate",
      prompt: "调整为更自然的通勤姿态"
    });
  });

  it("updates character cards", async () => {
    const updatedCard = {
      ...characterCardFixture,
      name: "更新后的主角"
    };
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse(updatedCard)
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.updateCharacterCard("project/1", "card/1", {
        name: "更新后的主角"
      })
    ).resolves.toEqual(updatedCard);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://backend.local/api/projects/project%2F1/character-cards/card%2F1"
    );
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "更新后的主角"
    });
  });

  it("deletes character cards", async () => {
    const updatedProject = {
      ...projectFixture,
      character_cards: []
    };
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse(updatedProject)
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.deleteCharacterCard("project/1", "card/1")
    ).resolves.toEqual(updatedProject);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://backend.local/api/projects/project%2F1/character-cards/card%2F1"
    );
    expect(init?.method).toBe("DELETE");
  });

  it("generates character card images", async () => {
    const responsePayload = {
      asset: assetFixture,
      character_card: characterCardFixture,
      task: {
        ...taskFixture,
        output_asset_ids: [assetFixture.id],
        stage: "character"
      }
    };
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse(responsePayload)
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.generateCharacterCardImage("project/1", "card/1")
    ).resolves.toEqual(responsePayload);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://backend.local/api/projects/project%2F1/character-cards/card%2F1/generate-image"
    );
    expect(init?.method).toBe("POST");
  });

  it("calls storyboard shot video config and reference endpoints", async () => {
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse(storyboardVideoConfigFixture)
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.getStoryboardShotVideoConfig("project/1", "shot/1")
    ).resolves.toEqual(storyboardVideoConfigFixture);
    await expect(
      api.updateStoryboardShotVideoConfig("project/1", "shot/1", {
        video_prompt: "更新提示词"
      })
    ).resolves.toEqual(storyboardVideoConfigFixture);
    await expect(
      api.attachStoryboardShotReference("project/1", "shot/1", {
        asset_id: "asset/image",
        kind: "image"
      })
    ).resolves.toEqual(storyboardVideoConfigFixture);
    await expect(
      api.removeStoryboardShotReference("project/1", "shot/1", {
        asset_id: "asset/image",
        kind: "image"
      })
    ).resolves.toEqual(storyboardVideoConfigFixture);

    expect(fetcher.mock.calls[0][0]).toBe(
      "http://backend.local/api/projects/project%2F1/storyboard/shots/shot%2F1/video-config"
    );
    expect(fetcher.mock.calls[0][1]?.method).toBe("GET");
    expect(fetcher.mock.calls[1][1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      video_prompt: "更新提示词"
    });
    expect(fetcher.mock.calls[2][0]).toBe(
      "http://backend.local/api/projects/project%2F1/storyboard/shots/shot%2F1/references"
    );
    expect(fetcher.mock.calls[2][1]?.method).toBe("POST");
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toEqual({
      asset_id: "asset/image",
      kind: "image"
    });
    expect(fetcher.mock.calls[3][1]?.method).toBe("DELETE");
  });

  it("applies storyboard shot last frame as subsequent references", async () => {
    const responsePayload = {
      applied_shot_ids: ["shot-2"],
      reference_asset_id: "tail-frame-reference",
      skipped: [
        {
          reason: "has_first_frame",
          shot_id: "shot-3",
          shot_index: 3
        }
      ],
      source_shot_id: "shot-1",
      source_video_asset_id: "video-1"
    };
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse(responsePayload)
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.applyStoryboardShotLastFrameReference("project/1", "shot/1")
    ).resolves.toEqual(responsePayload);

    expect(fetcher.mock.calls[0][0]).toBe(
      "http://backend.local/api/projects/project%2F1/storyboard/shots/shot%2F1/last-frame-reference"
    );
    expect(fetcher.mock.calls[0][1]?.method).toBe("POST");
  });

  it("ensures storyboard shot last frame reference asset", async () => {
    const responsePayload: Asset = {
      ...assetFixture,
      category: "reference",
      id: "tail-frame-reference",
      metadata: {
        source_shot_id: "shot-1",
        source_video_asset_id: "video-1",
        usage: "storyboard_video_tail_frame_reference"
      },
      mime_type: "image/png",
      type: "generated_image",
      url: "/api/assets/tail-frame-reference/content"
    };
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse(responsePayload)
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.ensureStoryboardShotLastFrameReferenceAsset("project/1", "shot/1")
    ).resolves.toEqual(responsePayload);

    expect(fetcher.mock.calls[0][0]).toBe(
      "http://backend.local/api/projects/project%2F1/storyboard/shots/shot%2F1/last-frame-reference-asset"
    );
    expect(fetcher.mock.calls[0][1]?.method).toBe("POST");
  });

  it("posts storyboard prompt optimization requests with draft and empty inputs", async () => {
    const response = { optimized_prompt: "优化后的完整提示词" };
    const fetcher = vi.fn<FetchFunction>(async () =>
      sseResponse([
        ["delta", { text: "优化后的" }],
        ["delta", { text: "完整提示词" }],
        ["complete", response]
      ])
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });
    const events: unknown[] = [];

    await expect(
      api.optimizeStoryboardShotVideoPrompt(
        "project/1",
        "shot/1",
        "当前编辑草稿",
        (event) => events.push(event)
      )
    ).resolves.toEqual(response);
    await expect(
      api.optimizeStoryboardShotVideoPrompt("project/1", "shot/1", null)
    ).resolves.toEqual(response);

    expect(fetcher.mock.calls[0][0]).toBe(
      "http://backend.local/api/projects/project%2F1/storyboard/shots/shot%2F1/optimize-video-prompt"
    );
    expect(fetcher.mock.calls[0][1]?.method).toBe("POST");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      video_prompt: "当前编辑草稿"
    });
    expect(fetcher.mock.calls[1][1]?.method).toBe("POST");
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      video_prompt: null
    });
    expect(events).toEqual([
      { type: "delta", text: "优化后的" },
      { type: "delta", text: "完整提示词" },
      { type: "complete", optimized_prompt: "优化后的完整提示词" }
    ]);
  });

  it("uploads storyboard shot references as octet-stream without JSON encoding", async () => {
    const uploadResponse = {
      asset_id: "asset-uploaded",
      config: storyboardVideoConfigFixture
    };
    const fetcher = vi.fn<FetchFunction>(async () => jsonResponse(uploadResponse));
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });
    const file = new Blob(["image-bytes"], { type: "image/png" });

    await expect(
      api.uploadStoryboardShotReference("project/1", "shot/1", "image", file, {
        filename: "参考图.png",
        mimeType: "image/png"
      })
    ).resolves.toEqual(uploadResponse);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://backend.local/api/projects/project%2F1/storyboard/shots/shot%2F1/references/upload?kind=image&filename=%E5%8F%82%E8%80%83%E5%9B%BE.png&mime_type=image%2Fpng"
    );
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(file);
    expect((init?.headers as Headers).get("content-type")).toBe("image/png");
  });

  it("calls storyboard shot video generation endpoints", async () => {
    const fetcher = vi.fn<FetchFunction>(async () => jsonResponse(taskFixture));
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.generateStoryboardShotVideo("project/1", "shot/1")
    ).resolves.toEqual(taskFixture);
    await expect(
      api.generateStoryboardShotVideoByLocator("project/1", { shot_index: 2 })
    ).resolves.toEqual(taskFixture);

    expect(fetcher.mock.calls[0][0]).toBe(
      "http://backend.local/api/projects/project%2F1/storyboard/shots/shot%2F1/generate-video"
    );
    expect(fetcher.mock.calls[0][1]?.method).toBe("POST");
    expect(fetcher.mock.calls[1][0]).toBe(
      "http://backend.local/api/projects/project%2F1/storyboard/generate-video"
    );
    expect(fetcher.mock.calls[1][1]?.method).toBe("POST");
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      shot_index: 2
    });
  });

  it("creates storyboard video edit candidates and selects a candidate", async () => {
    const fetcher = vi
      .fn<FetchFunction>()
      .mockImplementationOnce(async () => jsonResponse(taskFixture))
      .mockImplementationOnce(async () =>
        jsonResponse(storyboardVideoConfigFixture)
      );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.editStoryboardShotVideo("project/1", "shot/1", {
        prompt: "增强产品特写"
      })
    ).resolves.toEqual(taskFixture);
    await expect(
      api.selectStoryboardShotVideo("project/1", "shot/1", {
        asset_id: "candidate/1"
      })
    ).resolves.toEqual(storyboardVideoConfigFixture);

    expect(fetcher.mock.calls[0][0]).toBe(
      "http://backend.local/api/projects/project%2F1/storyboard/shots/shot%2F1/edit-video"
    );
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      prompt: "增强产品特写"
    });
    expect(fetcher.mock.calls[1][0]).toBe(
      "http://backend.local/api/projects/project%2F1/storyboard/shots/shot%2F1/select-video"
    );
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      asset_id: "candidate/1"
    });
  });

  it("posts storyboard shot merge requests with ordered shot ids", async () => {
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse(projectFixture)
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.mergeStoryboardShots("project/1", ["shot/2", "shot/3"])
    ).resolves.toEqual(projectFixture);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://backend.local/api/projects/project%2F1/storyboard/shots/merge"
    );
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      shot_ids: ["shot/2", "shot/3"]
    });
  });

  it("posts storyboard shot split requests without a request body", async () => {
    const fetcher = vi.fn<FetchFunction>(async () =>
      jsonResponse(projectFixture)
    );
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(
      api.splitStoryboardShot("project/1", "shot/2")
    ).resolves.toEqual(projectFixture);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://backend.local/api/projects/project%2F1/storyboard/shots/shot%2F2/split"
    );
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
  });

  it("parses FastAPI validation errors into ApiError detail text", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        {
          detail: [
            {
              loc: ["body", "brief", "prompt"],
              msg: "Field required",
              type: "missing"
            }
          ]
        },
        { status: 422 }
      )
    );
    const api = createApiClient({ baseUrl: "http://backend.local", fetcher });

    await expect(
      api.createProject({ brief: { prompt: "" }, name: null })
    ).rejects.toMatchObject({
      code: "validation_error",
      detail: "body.brief.prompt: Field required",
      message: "request validation failed",
      status: 422
    });
  });

  it("preserves structured backend API error payloads", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        {
          detail: {
            code: "not_found",
            detail: "project missing",
            message: "project not found"
          }
        },
        { status: 404 }
      )
    );
    const api = createApiClient({ baseUrl: "http://backend.local", fetcher });

    try {
      await api.getProject("missing-project");
      throw new Error("expected getProject to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(isApiError(error)).toBe(true);
      expect(error).toMatchObject({
        code: "not_found",
        detail: "project missing",
        message: "project not found",
        status: 404
      });
    }
  });

  it("redacts sensitive backend error payloads before exposing ApiError", async () => {
    const signedUrl =
      "https://local-assets.tos.local/projects/p/asset.png?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Signature=secret-signature";
    const fetcher = vi.fn(async () =>
      jsonResponse(
        {
          detail: {
            code: "external_service_error",
            detail:
              "vendor upstream sensitive failure sk-live-secret-value password=db-password token=raw-token",
            message:
              `provider raw sensitive error Ark Key=ark-secret-value TOS_AK=tos-access-value TOS_SK=tos-secret-value mysql://ad_user:db-password@db.internal/ad ${signedUrl}`
          }
        },
        { status: 502 }
      )
    );
    const api = createApiClient({ baseUrl: "http://backend.local", fetcher });

    await expect(api.getProject("project-1")).rejects.toMatchObject({
      code: "external_service_error",
      detail: "external provider error was redacted",
      message: "external provider error was redacted"
    });

    try {
      await api.getProject("project-1");
      throw new Error("expected getProject to reject");
    } catch (error) {
      const body = JSON.stringify(error);
      expect(body).not.toContain("ark-secret-value");
      expect(body).not.toContain("tos-access-value");
      expect(body).not.toContain("tos-secret-value");
      expect(body).not.toContain("db-password");
      expect(body).not.toContain("secret-signature");
      expect(body).not.toContain("X-Tos-");
      expect(body).not.toContain("raw-token");
      expect(getUserFacingErrorMessage(error)).toBe(
        "服务暂时不可用，请稍后重试。"
      );
    }
  });
});

describe("getBackendBaseUrl", () => {
  it("falls back to localhost when NEXT_PUBLIC_BACKEND_BASE_URL is blank", () => {
    const originalBaseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
    process.env.NEXT_PUBLIC_BACKEND_BASE_URL = "   ";

    try {
      expect(getBackendBaseUrl()).toBe("http://localhost:8000");
    } finally {
      if (originalBaseUrl === undefined) {
        delete process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      } else {
        process.env.NEXT_PUBLIC_BACKEND_BASE_URL = originalBaseUrl;
      }
    }
  });
});

describe("getUserFacingErrorMessage", () => {
  it("does not expose internal details from server errors", () => {
    const error = new ApiError({
      code: "generation_failed",
      detail: "Traceback: secret backend path",
      message: "generation failed",
      responseBody: null,
      status: 500
    });

    expect(getUserFacingErrorMessage(error)).toBe(
      "服务暂时不可用，请稍后重试。"
    );
    expect(getUserFacingErrorMessage(error)).not.toContain("Traceback");
  });

  it("shows only whitelisted provider diagnostics", () => {
    const detail =
      "provider_code=RateLimitExceeded; request_id=request-safe-456; " +
      "provider_task_id=cgt-safe-789; phase=poll";
    const error = new ApiError({
      code: "generation_failed",
      detail,
      message: "generation failed",
      responseBody: null,
      status: 500
    });

    expect(getSafeProviderErrorSummary(detail)).toBe(
      "方舟错误码：RateLimitExceeded · Request ID：request-safe-456 · " +
        "任务 ID：cgt-safe-789"
    );
    expect(getUserFacingErrorMessage(error)).toContain("RateLimitExceeded");
    expect(
      getSafeProviderErrorSummary(
        "provider_code=Bad Code; request_id=../../secret; Traceback=/tmp/key"
      )
    ).toBeNull();
  });

  it("shows whitelisted external service diagnostics", () => {
    const error = new ApiError({
      code: "external_service_error",
      detail: "provider=ffmpeg-composer; phase=configure",
      message:
        "FFmpeg is not installed or COMPOSER_FFMPEG_PATH is not configured.",
      responseBody: null,
      status: 502
    });

    expect(getUserFacingErrorMessage(error)).toBe(
      "服务暂时不可用。FFmpeg is not installed or COMPOSER_FFMPEG_PATH is not configured. · " +
        "服务：ffmpeg-composer · 阶段：configure"
    );
  });

  it("does not expose raw external service stderr", () => {
    const error = new ApiError({
      code: "external_service_error",
      detail:
        "phase=concat; returncode=1; stderr=/tmp/private token=raw-token",
      message: "FFmpeg composition failed",
      responseBody: null,
      status: 502
    });

    const message = getUserFacingErrorMessage(error);
    expect(message).toBe(
      "服务暂时不可用。FFmpeg composition failed · 阶段：concat · 返回码：1"
    );
    expect(message).not.toContain("stderr");
    expect(message).not.toContain("raw-token");
    expect(message).not.toContain("/tmp/private");
  });
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
    ...init
  });
}

function sseResponse(events: Array<[string, unknown]>, init: ResponseInit = {}) {
  const body = events
    .map(
      ([event, data]) =>
        `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    )
    .join("");
  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
    status: 200,
    ...init
  });
}

function chunkedSseResponse(encoded: Uint8Array, cutPoints: number[]) {
  const boundaries = [0, ...cutPoints, encoded.length];
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 0; index < boundaries.length - 1; index += 1) {
        controller.enqueue(
          encoded.slice(boundaries[index], boundaries[index + 1])
        );
      }
      controller.close();
    }
  });
  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
    status: 200
  });
}

type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;
