import { describe, expect, it } from "vitest";

import {
  getAigcImageDownload,
  getAigcVideoDownload
} from "@/lib/aigc/download";

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
