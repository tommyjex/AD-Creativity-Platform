import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "@/lib/api-client";
import { SUBTITLE_FONTS } from "@/lib/subtitle-translation";
import { subtitleAsset, subtitleTask, subtitleWorkspace } from "./subtitle-translation-fixtures";
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("subtitle API contracts", () => {
  it("uses actual workspace CRUD and stage contracts with revision and stable IDs", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json([subtitleWorkspace]))
      .mockResolvedValueOnce(Response.json(subtitleWorkspace))
      .mockResolvedValueOnce(Response.json(subtitleWorkspace))
      .mockResolvedValueOnce(Response.json(subtitleWorkspace))
      .mockResolvedValueOnce(Response.json(subtitleTask))
      .mockResolvedValueOnce(Response.json(subtitleTask))
      .mockResolvedValueOnce(Response.json(subtitleTask));
    const client = createApiClient({ baseUrl: "http://api.test", fetcher });
    await client.listSubtitleWorkspaces();
    await client.getSubtitleWorkspace("a/b");
    await client.createSubtitleWorkspace({ reference_video_asset_id: "reference-a", target_language: "de" });
    await client.patchSubtitleWorkspace("a/b", { expected_revision: 2, clean_video_asset_id: "clean-a" });
    await client.runSubtitleOperation("a/b", "extract", { expected_revision: 3 });
    await client.runSubtitleOperation("a/b", "translate", { expected_revision: 3, segment_ids: ["line-b"] });
    await client.runSubtitleOperation("a/b", "render", { expected_revision: 3 });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "http://api.test/api/tools/subtitle-translation/workspaces",
      "http://api.test/api/tools/subtitle-translation/workspaces/a%2Fb",
      "http://api.test/api/tools/subtitle-translation/workspaces",
      "http://api.test/api/tools/subtitle-translation/workspaces/a%2Fb",
      "http://api.test/api/tools/subtitle-translation/workspaces/a%2Fb/extract",
      "http://api.test/api/tools/subtitle-translation/workspaces/a%2Fb/translate",
      "http://api.test/api/tools/subtitle-translation/workspaces/a%2Fb/render"
    ]);
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ reference_video_asset_id: "reference-a", target_language: "de" });
    expect(fetcher.mock.calls[3][1].method).toBe("PATCH");
    expect(JSON.parse(fetcher.mock.calls[5][1].body)).toEqual({ expected_revision: 3, segment_ids: ["line-b"] });
  });

  it("imports signed URLs by role and uses dedicated raw-byte upload", async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json(subtitleAsset));
    const client = createApiClient({ baseUrl: "http://api.test", fetcher });
    const url = "https://bucket.tos-cn-beijing.volces.com/video.mp4?signature=private";
    await client.importSubtitleVideo(url, "clean");
    const blob = new Blob(["video"], { type: "video/mp4" });
    await client.uploadSubtitleVideo(blob, "reference", { filename: "clip.mp4", mimeType: "video/mp4" });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ video_url: url, role: "clean" });
    expect(fetcher.mock.calls[1][0]).toBe("http://api.test/api/tools/subtitle-translation/upload-video?role=reference&filename=clip.mp4&mime_type=video%2Fmp4");
    expect(fetcher.mock.calls[1][1].body).toBe(blob);
    expect(fetcher.mock.calls[1][1].credentials).toBe("same-origin");
  });

  it("retains conflict status without exposing provider responses", async () => {
    const client = createApiClient({ baseUrl: "http://api.test", fetcher: vi.fn().mockImplementation(async () => Response.json({
      detail: { code: "revision_conflict", message: "workspace revision changed; reload before saving" }
    }, { status: 409 })) });
    await expect(client.patchSubtitleWorkspace("a", { expected_revision: 2 })).rejects.toMatchObject({ status: 409 });
    await expect(client.patchSubtitleWorkspace("a", { expected_revision: 2 })).rejects.toBeInstanceOf(ApiError);
  });

  it("uses the non-persisting layout preview endpoint with expected revision", async () => {
    const measured = { ...subtitleWorkspace, segments: [{
      ...subtitleWorkspace.segments[0], font_type: SUBTITLE_FONTS[0].url, font_sha256: "a".repeat(64)
    }] };
    const fetcher = vi.fn().mockResolvedValue(Response.json(measured));
    const client = createApiClient({ baseUrl: "http://api.test", fetcher });
    const result = await client.previewSubtitleWorkspace("a/b", { expected_revision: 2, segments: subtitleWorkspace.segments });
    expect(fetcher.mock.calls[0][0]).toBe("http://api.test/api/tools/subtitle-translation/workspaces/a%2Fb/preview");
    expect(fetcher.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ expected_revision: 2, segments: [{ segment_id: "line-a" }] });
    expect(result.segments[0]).toMatchObject({
      estimated_font_size_px: 42, effective_font_size_px: 32,
      font_type: SUBTITLE_FONTS[0].url, font_sha256: "a".repeat(64)
    });
  });

  it("never sends auth response URLs or signed video addresses to debug telemetry", async () => {
    const telemetry = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", telemetry);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const response = () => {
      const result = Response.json(subtitleAsset);
      Object.defineProperty(result, "url", { value: "https://bucket.volces.com/video.mp4?signature=private" });
      return result;
    };
    const fetcher = vi.fn().mockImplementation(async () => response());
    const client = createApiClient({ baseUrl: "http://api.test", fetcher });
    await client.getCurrentUser();
    await client.login({ username: "creator", password: "private" });
    await client.importSubtitleVideo("https://bucket.volces.com/video.mp4?signature=private", "clean");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(telemetry).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
