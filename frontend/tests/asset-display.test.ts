import { describe, expect, it } from "vitest";

import {
  getAssetDownloadUrl,
  getSafeAssetContentUrl
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
      "http://localhost:8000/api/assets/asset%2Fwith%20space/content?download=1"
    );
  });

  it("resolves a relative result URL against the backend origin", () => {
    expect(
      getSafeAssetContentUrl("/api/assets/result-1/content")
    ).toBe("http://localhost:8000/api/assets/result-1/content");
  });
});
