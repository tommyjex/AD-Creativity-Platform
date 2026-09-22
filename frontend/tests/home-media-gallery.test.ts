import { describe, expect, it } from "vitest";

import { buildHomeMediaItems } from "@/lib/home-media-gallery";
import type { Asset } from "@/lib/api-types";

function createAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    asset_role: "public",
    category: null,
    created_at: "2026-09-17T10:00:00Z",
    id: "asset-1",
    metadata: { name: "生成产物" },
    mime_type: "image/png",
    object_key: "assets/result.png",
    project_id: "project-1",
    size_bytes: 1024,
    source_task_id: "task-1",
    stage: "image",
    status: "succeeded",
    tool_asset_role: null,
    tool_task_id: null,
    type: "generated_image",
    updated_at: "2026-09-17T10:00:00Z",
    url: "/api/assets/asset-1/content",
    ...overrides
  };
}

describe("buildHomeMediaItems", () => {
  it("keeps public generated media from projects, tools and AIGC", () => {
    const items = buildHomeMediaItems([
      createAsset({
        id: "project-image",
        metadata: { name: "项目图片" },
        updated_at: "2026-09-17T10:00:00Z"
      }),
      createAsset({
        id: "tool-image",
        metadata: { name: "工具图片" },
        project_id: null,
        tool_asset_role: "output",
        tool_task_id: "tool-task-1",
        type: "uploaded_image",
        updated_at: "2026-09-17T11:00:00Z",
        url: "/api/assets/tool-image/content"
      }),
      createAsset({
        id: "aigc-video",
        metadata: { name: "AIGC 视频", origin: "aigc" },
        mime_type: "video/mp4",
        project_id: null,
        stage: null,
        tool_asset_role: "output",
        tool_task_id: null,
        type: "uploaded_video",
        updated_at: "2026-09-17T12:00:00Z",
        url: "/api/assets/aigc-video/content"
      })
    ]);

    expect(
      items.map(({ id, kind, name }) => ({ id, kind, name }))
    ).toEqual([
      { id: "aigc-video", kind: "video", name: "AIGC 视频" },
      { id: "tool-image", kind: "image", name: "工具图片" },
      { id: "project-image", kind: "image", name: "项目图片" }
    ]);
  });

  it("excludes project uploads, tool inputs, internal assets and non-media", () => {
    const items = buildHomeMediaItems([
      createAsset({
        category: "reference",
        id: "project-reference",
        type: "uploaded_image",
        url: "/api/assets/project-reference/content"
      }),
      createAsset({
        id: "tool-input",
        project_id: null,
        tool_asset_role: "input",
        tool_task_id: "tool-task-1",
        type: "uploaded_video",
        url: "/api/assets/tool-input/content"
      }),
      createAsset({
        asset_role: "internal_layer",
        id: "internal-layer",
        url: "/api/assets/internal-layer/content"
      }),
      createAsset({
        id: "subtitle",
        mime_type: "text/plain",
        type: "subtitle",
        url: "/api/assets/subtitle/content"
      }),
      createAsset({
        id: "missing-preview",
        url: null
      })
    ]);

    expect(items).toEqual([]);
  });

  it("deduplicates IDs and sorts invalid dates behind valid timestamps", () => {
    const items = buildHomeMediaItems([
      createAsset({
        id: "duplicate",
        metadata: { name: "首个版本" },
        updated_at: "invalid-date",
        url: "/api/assets/duplicate/content"
      }),
      createAsset({
        id: "newest",
        updated_at: "2026-09-17T13:00:00Z",
        url: "/api/assets/newest/content"
      }),
      createAsset({
        id: "duplicate",
        metadata: { name: "重复版本" },
        updated_at: "2026-09-17T14:00:00Z",
        url: "/api/assets/duplicate/content"
      })
    ]);

    expect(items.map((item) => item.id)).toEqual(["newest", "duplicate"]);
    expect(items[1]?.name).toBe("首个版本");
  });
});
