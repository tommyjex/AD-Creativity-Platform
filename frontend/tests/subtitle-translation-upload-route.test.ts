import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { POST } from "@/app/api/tools/subtitle-translation/upload-video/route";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("dedicated subtitle upload proxy", () => {
  it("keeps ordinary backend reference limits separate from the subtitle 512 MiB path", () => {
    const routes = readFileSync(resolve(process.cwd(), "../backend/app/api/routes.py"), "utf8");
    const limits = routes.match(/def _validate_uploaded_reference[\s\S]*?limits = \{([^}]+)\}/)?.[1];
    expect(limits).toBeTruthy();
    expect(limits).toMatch(/ReferenceAssetKind\.IMAGE:\s*20 \* 1024 \* 1024/);
    expect(limits).toMatch(/ReferenceAssetKind\.VIDEO:\s*200 \* 1024 \* 1024/);
    expect(limits).toMatch(/ReferenceAssetKind\.AUDIO:\s*50 \* 1024 \* 1024/);
    const subtitle = readFileSync(resolve(process.cwd(), "../backend/app/services/subtitle_translation_media.py"), "utf8");
    expect(subtitle).toContain("MAX_BYTES = 512 * 1024 * 1024");
  });

  it("streams bytes and forwards cookie/origin, role and filename without buffering", async () => {
    vi.stubEnv("BACKEND_INTERNAL_BASE_URL", "http://backend.test:8000/");
    const fetcher = vi.fn(async (_url: string, options: RequestInit & { duplex: string }) => {
      const reader = (options.body as ReadableStream<Uint8Array>).getReader();
      const chunk = await reader.read();
      expect(new TextDecoder().decode(chunk.value)).toBe("video");
      await reader.read();
      return Response.json({ id: "uploaded" }, { status: 201 });
    });
vi.stubGlobal("fetch", fetcher);
    const result = await POST(new Request("http://localhost/api/tools/subtitle-translation/upload-video?role=clean&filename=clip.mp4", {
      method: "POST", body: new TextEncoder().encode("video"), headers: {
        cookie: "session=test", origin: "http://localhost", "content-type": "video/mp4", authorization: "not-forwarded"
      }
    }));
    expect(result.status).toBe(201);
    expect(await result.json()).toEqual({ id: "uploaded" });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("http://backend.test:8000/api/tools/subtitle-translation/upload-video?role=clean&filename=clip.mp4");
    expect(options.duplex).toBe("half");
    expect(new Headers(options.headers).get("cookie")).toBe("session=test");
    expect(new Headers(options.headers).get("origin")).toBe("http://localhost");
    expect(new Headers(options.headers).has("authorization")).toBe(false);
    expect(result.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects excessive declared lengths before any upstream call", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const result = await POST(new Request("http://localhost/api/tools/subtitle-translation/upload-video", {
      method: "POST", body: "video", headers: { "content-length": String(512 * 1024 * 1024 + 1) }
    }));
    expect(result.status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("enforces the limit on chunked streams without trusting content-length", async () => {
    const fetcher = vi.fn(async (_url, options) => {
      const reader = options.body.getReader();
      await reader.read();
      return Response.json({});
    });
    vi.stubGlobal("fetch", fetcher);
    const request = {
      url: "http://localhost/api/tools/subtitle-translation/upload-video",
      headers: new Headers(), signal: new AbortController().signal,
      body: new ReadableStream({ start(controller) {
        controller.enqueue({ byteLength: 512 * 1024 * 1024 + 1 });
        controller.close();
      } })
    } as unknown as Request;
    const result = await POST(request);
    expect(result.status).toBe(413);
    expect(await result.json()).toMatchObject({ detail: { message: "Video exceeds 512 MiB." } });
  });

  it("passes through RBAC failures and returns sanitized backend connection errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ detail: "Forbidden" }, { status: 403 })).mockRejectedValueOnce(new Error("private backend detail")));
    const request = () => new Request("http://localhost/api/tools/subtitle-translation/upload-video", { method: "POST", body: "video" });
    expect((await POST(request())).status).toBe(403);
    const failed = await POST(request());
    expect(failed.status).toBe(502);
    expect(JSON.stringify(await failed.json())).not.toContain("private backend detail");
  });
});
