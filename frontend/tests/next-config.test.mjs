import { afterEach, describe, expect, it } from "vitest";
import nextConfig from "../next.config.mjs";

const originalInternalBaseUrl = process.env.BACKEND_INTERNAL_BASE_URL;

afterEach(() => {
  if (originalInternalBaseUrl === undefined) {
    delete process.env.BACKEND_INTERNAL_BASE_URL;
  } else {
    process.env.BACKEND_INTERNAL_BASE_URL = originalInternalBaseUrl;
  }
});

describe("Next.js API rewrites", () => {
  it("allows large uploads to outlive the default 30-second proxy timeout", () => {
    expect(nextConfig.experimental.proxyClientMaxBodySize).toBe("200mb");
    expect(nextConfig.experimental.proxyTimeout).toBe(900_000);
  });

  it("proxies local same-origin API requests to FastAPI by default", async () => {
    delete process.env.BACKEND_INTERNAL_BASE_URL;

    await expect(nextConfig.rewrites()).resolves.toEqual([
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*"
      }
    ]);
  });

  it("uses the internal backend override without a trailing slash", async () => {
    process.env.BACKEND_INTERNAL_BASE_URL = " http://backend.internal:8100/ ";

    await expect(nextConfig.rewrites()).resolves.toEqual([
      {
        source: "/api/:path*",
        destination: "http://backend.internal:8100/api/:path*"
      }
    ]);
  });
});
