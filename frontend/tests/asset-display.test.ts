import { describe, expect, it, vi } from "vitest";

import {
  getAssetContentUrlById,
  getAssetDownloadUrl,
  getSafeAssetContentUrl,
  getWorkspaceAssetDescription,
  validateAssetDisplayName
} from "@/lib/asset-display";
import type { Asset } from "@/lib/api-types";

const asset = {
  asset_role: "public",
  category: null,
  created_at: "2026-08-24T10:00:00Z",
  id: "asset/with space",
  metadata: {},
  mime_type: "image/png",
  object_key: "projects/project/image/result.png",
  project_id: "project-1",
  size_bytes: 1024,
  source_task_id: null,
  stage: "image",
  status: "succeeded",
  type: "generated_image",
  updated_at: "2026-08-24T10:00:00Z",
  url: "/api/assets/asset%2Fwith%20space/content"
} satisfies Asset;

describe("asset display helpers", () => {
  it("builds a backend attachment download URL for asset content", () => {
    expect(getAssetDownloadUrl(asset)).toBe(
      "/api/assets/asset%2Fwith%20space/content?download=1"
    );
  });

  it("resolves a relative result URL against the backend origin", () => {
    expect(
      getSafeAssetContentUrl("/api/assets/result-1/content")
    ).toBe("/api/assets/result-1/content");
  });

  it("keeps browser-facing media URLs public during server rendering", () => {
    vi.stubGlobal("window", undefined);

    try {
      expect(
        getSafeAssetContentUrl("/api/assets/result-1/content")
      ).toBe("/api/assets/result-1/content");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("builds a backend content URL from a result asset ID", () => {
    expect(getAssetContentUrlById("asset/with space")).toBe(
      "/api/assets/asset%2Fwith%20space/content"
    );
  });

  it("uses an explicit public backend base for split-origin assets", () => {
    const originalBaseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
    process.env.NEXT_PUBLIC_BACKEND_BASE_URL = "https://media.example.com/";

    try {
      expect(
        getSafeAssetContentUrl("/api/assets/result-1/content")
      ).toBe("https://media.example.com/api/assets/result-1/content");
    } finally {
      if (originalBaseUrl === undefined) {
        delete process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      } else {
        process.env.NEXT_PUBLIC_BACKEND_BASE_URL = originalBaseUrl;
      }
    }
  });

  it("shows the historical AIGC name while letting the backend resolve downloads", () => {
    const namedAsset: Asset = {
      ...asset,
      id: "aigc-output",
      metadata: {
        description: "Provider description",
        name: "商品主图-图生图1-图片1.png",
        name_scheme: "aigc_canvas_node_v1",
        origin: "aigc"
      },
      project_id: null,
      tool_asset_role: "output"
    };

    expect(getWorkspaceAssetDescription(namedAsset)).toBe(
      "商品主图-图生图1-图片1.png"
    );
    expect(getAssetDownloadUrl(namedAsset)).toBe(
      "/api/assets/aigc-output/content?download=1"
    );
  });

  it("keeps the historical description-first fallback without the scheme marker", () => {
    const historicalAsset: Asset = {
      ...asset,
      metadata: {
        description: "历史 Provider 描述",
        name: "历史资产名称.png",
        origin: "aigc"
      },
      project_id: null,
      tool_asset_role: "output"
    };

    expect(getWorkspaceAssetDescription(historicalAsset)).toBe(
      "历史 Provider 描述"
    );
    expect(getAssetDownloadUrl(historicalAsset)).toBe(
      "/api/assets/asset%2Fwith%20space/content?download=1"
    );
  });

  it("gives a user-defined name priority over descriptions and automatic names", () => {
    const renamedAsset: Asset = {
      ...asset,
      metadata: {
        description: "旧描述",
        name: " 用户设置的名称.png ",
        name_scheme: "user_defined_v1",
        origin: "aigc",
        prompt: "旧提示词"
      }
    };

    expect(getWorkspaceAssetDescription(renamedAsset)).toBe(
      "用户设置的名称.png"
    );
    expect(getAssetDownloadUrl(renamedAsset)).toContain(
      "filename=%E7%94%A8%E6%88%B7%E8%AE%BE%E7%BD%AE%E7%9A%84%E5%90%8D%E7%A7%B0.png"
    );
  });

  it("validates trimmed asset names by Unicode code points", () => {
    expect(validateAssetDisplayName("  新名称  ")).toEqual({
      name: "新名称"
    });
    expect(validateAssetDisplayName("😀".repeat(120))).toEqual({
      name: "😀".repeat(120)
    });
    expect(validateAssetDisplayName("😀".repeat(121))).toEqual({
      error: "名称不能超过 120 个字符。"
    });
    expect(validateAssetDisplayName("   ")).toEqual({
      error: "请输入资产名称。"
    });
  });

  it.each([
    ["U+0000", "\u0000"],
    ["U+001F", "\u001f"],
    ["U+007F", "\u007f"]
  ])("rejects ASCII control character %s", (_codePoint, controlCharacter) => {
    expect(validateAssetDisplayName(`名称${controlCharacter}`)).toEqual({
      error: "名称不能包含控制字符。"
    });
  });

  it.each([
    ["U+0080", "\u0080"],
    ["U+009F", "\u009f"]
  ])("accepts C1 control character %s", (_codePoint, controlCharacter) => {
    expect(validateAssetDisplayName(`名称${controlCharacter}`)).toEqual({
      name: `名称${controlCharacter}`
    });
  });
});
