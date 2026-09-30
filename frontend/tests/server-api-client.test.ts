import { beforeEach, describe, expect, it, vi } from "vitest";

const serverState = vi.hoisted(() => ({
  cookie: "ad_session=session-token; theme=dark"
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    toString: () => serverState.cookie
  })
}));

import { createServerApiClient } from "@/lib/auth/server-api-client";

describe("server API client", () => {
  beforeEach(() => {
    serverState.cookie = "ad_session=session-token; theme=dark";
    vi.stubGlobal("window", undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () =>
        new Response(JSON.stringify([]), {
          headers: { "content-type": "application/json" },
          status: 200
        })
      )
    );
  });

  it("forwards the incoming Cookie header to internal SSR requests", async () => {
    const api = await createServerApiClient();
    await api.listProjects({ cache: "no-store" });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/projects",
      expect.objectContaining({
        credentials: "same-origin",
        headers: expect.any(Headers)
      })
    );
    const init = vi.mocked(fetch).mock.calls[0][1];
    expect((init?.headers as Headers).get("cookie")).toBe(
      "ad_session=session-token; theme=dark"
    );
  });
});
