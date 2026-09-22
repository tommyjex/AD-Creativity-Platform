import { describe, expect, it } from "vitest";

import {
  getAigcImageDownload,
  getAigcVideoDownload
} from "@/lib/aigc/download";
import type { AigcPipelineDefinitionV2 } from "@/lib/aigc/types";

describe("AIGC image downloads", () => {
  it("builds a controlled URL and sanitized MIME-aware filename", () => {
    const download = getAigcImageDownload(
      {
        asset_id: "asset/one",
        ordinal: 1,
        mime_type: "image/jpeg",
        download_url: "/api/assets/asset%2Fone/content",
        available: true
      },
      "商品/主图"
    );

    expect(download).toEqual({
      filename: "商品-主图-2.jpg",
      url:
        "http://localhost:8000/api/assets/asset%2Fone/content?" +
        "download=1&filename=%E5%95%86%E5%93%81-%E4%B8%BB%E5%9B%BE-2.jpg"
    });
  });

  it("rejects unavailable or unsafe result URLs", () => {
    expect(
      getAigcImageDownload(
        {
          asset_id: "asset-1",
          ordinal: 0,
          mime_type: "image/png",
          download_url: "javascript:alert(1)",
          available: true
        },
        "结果"
      )
    ).toBeNull();
    expect(
      getAigcImageDownload(
        {
          asset_id: "asset-1",
          ordinal: 0,
          mime_type: "image/png",
          download_url: "/api/assets/asset-1/content",
          available: false
        },
        "结果"
      )
    ).toBeNull();
  });

  it("uses the current generated node name without a first-output suffix", () => {
    const definition = {
      schemaVersion: 2,
      nodes: [
        {
          id: "image-model",
          type: "text_to_image",
          custom_name: "城市汽车广告",
          position: { x: 0, y: 0 },
          size: { width: 280, height: 200 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            aspect_ratio: "1:1",
            size: "2K",
            format: "png"
          }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    } satisfies AigcPipelineDefinitionV2;

    expect(
      getAigcImageDownload(
        {
          asset_id: "image-current",
          ordinal: 0,
          mime_type: "image/png",
          download_url: "/api/assets/image-current/content",
          available: true,
          metadata: {
            generated_name: "雨夜跑车",
            name: "雨夜跑车.png",
            name_scheme: "aigc_generated_node_v2",
            node_id: "image-model"
          }
        },
        "旧节点名",
        definition
      )
    ).toEqual({
      filename: "城市汽车广告.png",
      url:
        "http://localhost:8000/api/assets/image-current/content?" +
        "download=1&filename=%E5%9F%8E%E5%B8%82%E6%B1%BD%E8%BD%A6%E5%B9%BF%E5%91%8A.png"
    });
  });

  it("keeps explicit asset names above current nodes and frozen names", () => {
    const definition = {
      schemaVersion: 2,
      nodes: [
        {
          id: "image-model",
          type: "image_to_image",
          custom_name: "节点新名称",
          position: { x: 0, y: 0 },
          size: { width: 280, height: 200 },
          config: {
            model: "doubao-seedream-5-0-pro-260628",
            operation: "image_edit",
            aspect_ratio: "1:1",
            size: "2K",
            format: "png"
          }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    } satisfies AigcPipelineDefinitionV2;

    expect(
      getAigcImageDownload(
        {
          asset_id: "image-renamed",
          ordinal: 1,
          mime_type: "image/png",
          download_url: "/api/assets/image-renamed/content",
          available: true,
          metadata: {
            generated_name: "冻结名称",
            name: "用户最终名称.jpg",
            name_scheme: "user_defined_v1",
            node_id: "image-model"
          }
        },
        "面板建议名称",
        definition
      )?.filename
    ).toBe("用户最终名称.png");
  });

  it("falls back to the frozen generated name when the node is deleted", () => {
    const emptyDefinition = {
      schemaVersion: 2,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    } satisfies AigcPipelineDefinitionV2;

    expect(
      getAigcImageDownload(
        {
          asset_id: "image-deleted-node",
          ordinal: 1,
          mime_type: "image/webp",
          download_url: "/api/assets/image-deleted-node/content",
          available: true,
          metadata: {
            generated_name: "冻结/名称",
            name: "历史名称.png",
            name_scheme: "aigc_generated_node_v2",
            node_id: "deleted-node"
          }
        },
        "旧面板名称",
        emptyDefinition
      )?.filename
    ).toBe("冻结-名称-2.webp");
  });

  it("sanitizes illegal characters and caps Unicode names at 180 bytes", () => {
    const download = getAigcImageDownload(
      {
        asset_id: "image-long-name",
        ordinal: 0,
        mime_type: "image/jpeg",
        download_url: "/api/assets/image-long-name/content",
        available: true,
        metadata: {
          generated_name: `${"中文名称".repeat(40)}/非法:*?"<>|`
        }
      },
      "fallback"
    );

    expect(download?.filename.endsWith(".jpg")).toBe(true);
    expect(
      new TextEncoder().encode(download?.filename ?? "").byteLength
    ).toBeLessThanOrEqual(180);
    expect(download?.filename).not.toMatch(/[/:*?"<>|]/);
  });
});

describe("AIGC video downloads", () => {
  it("uses the output title, ordinal, and video MIME extension", () => {
    expect(
      getAigcVideoDownload(
        {
          asset_id: "video/one",
          ordinal: 2,
          mime_type: "video/webm",
          download_url: "/api/assets/video%2Fone/content",
          available: true
        },
        "成片/预览"
      )
    ).toEqual({
      filename: "成片-预览-3.webm",
      url:
        "http://localhost:8000/api/assets/video%2Fone/content?" +
        "download=1&filename=%E6%88%90%E7%89%87-%E9%A2%84%E8%A7%88-3.webm"
    });
  });

  it("does not expose a download for an unavailable video", () => {
    expect(
      getAigcVideoDownload(
        {
          asset_id: "video-1",
          ordinal: 0,
          mime_type: "video/mp4",
          download_url: "/api/assets/video-1/content",
          available: false
        },
        "结果"
      )
    ).toBeNull();
  });
});
