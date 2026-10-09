import { beforeEach, describe, expect, it, vi } from "vitest";

import AigcPipelineEditorPage from "@/app/workspace/aigc/pipelines/[pipelineId]/page";
import { ApiError } from "@/lib/api-client";

const apiMocks = vi.hoisted(() => ({
  getAigcPipeline: vi.fn()
}));
const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn()
}));

vi.mock("@/lib/auth/server-api-client", () => ({
  createServerApiClient: async () => apiMocks
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    navigationMocks.redirect(path);
    throw new Error("NEXT_REDIRECT");
  }
}));

describe("AIGC pipeline page", () => {
  beforeEach(() => {
    apiMocks.getAigcPipeline.mockReset();
    navigationMocks.redirect.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response()));
  });

  it("redirects a missing pipeline to the pipeline list", async () => {
    apiMocks.getAigcPipeline.mockRejectedValue(
      new ApiError({
        code: "not_found",
        message: "AIGC pipeline not found",
        responseBody: null,
        status: 404
      })
    );

    await expect(
      AigcPipelineEditorPage({
        params: Promise.resolve({ pipelineId: "missing-pipeline" })
      })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(navigationMocks.redirect).toHaveBeenCalledWith(
      "/workspace/aigc?view=pipelines"
    );
  });
});
