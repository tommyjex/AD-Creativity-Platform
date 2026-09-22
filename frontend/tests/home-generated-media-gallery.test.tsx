import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeGeneratedMediaGallery } from "@/components/home-generated-media-gallery";
import type { Asset } from "@/lib/api-types";

function createAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    asset_role: "public",
    category: null,
    created_at: "2026-09-17T10:00:00Z",
    id: "image-1",
    metadata: { name: "晨光海报", name_scheme: "user_defined_v1" },
    mime_type: "image/png",
    object_key: "assets/image.png",
    project_id: "project-1",
    size_bytes: 1024,
    source_task_id: "task-1",
    stage: "image",
    status: "succeeded",
    tool_asset_role: null,
    tool_task_id: null,
    type: "generated_image",
    updated_at: "2026-09-17T10:00:00Z",
    url: "/api/assets/image-1/content",
    ...overrides
  };
}

const assets = [
  createAsset(),
  createAsset({
    id: "image-2",
    metadata: { name: "夜色海报", name_scheme: "user_defined_v1" },
    updated_at: "2026-09-17T11:00:00Z",
    url: "/api/assets/image-2/content"
  }),
  createAsset({
    id: "video-1",
    metadata: {
      duration_seconds: 5,
      name: "城市穿梭",
      name_scheme: "user_defined_v1"
    },
    mime_type: "video/mp4",
    stage: "video",
    type: "storyboard_video",
    updated_at: "2026-09-17T12:00:00Z",
    url: "/api/assets/video-1/content"
  }),
  createAsset({
    category: "reference",
    id: "reference-1",
    metadata: { name: "上传参考图" },
    type: "uploaded_image",
    url: "/api/assets/reference-1/content"
  })
];

describe("HomeGeneratedMediaGallery", () => {
  it("defaults to generated images and excludes uploaded references", () => {
    render(<HomeGeneratedMediaGallery assets={assets} />);

    expect(screen.getByRole("tab", { name: "图片 2" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "视频 1" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByText("晨光海报")).toBeInTheDocument();
    expect(screen.getByText("夜色海报")).toBeInTheDocument();
    expect(screen.queryByText("城市穿梭")).not.toBeInTheDocument();
    expect(screen.queryByText("上传参考图")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-media-masonry")).toHaveAttribute(
      "data-column-count",
      "4"
    );
  });

  it("switches to videos and filters the active category by name", () => {
    render(<HomeGeneratedMediaGallery assets={assets} />);

    fireEvent.click(screen.getByRole("tab", { name: "视频 1" }));
    expect(screen.getByText("城市穿梭")).toBeInTheDocument();
    expect(screen.queryByText("晨光海报")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索产物" }), {
      target: { value: "不存在" }
    });
    expect(screen.getByText("没有匹配的视频")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清空搜索" }));
    expect(screen.getByText("城市穿梭")).toBeInTheDocument();
  });

  it("opens an uncropped image preview with a download action", () => {
    render(<HomeGeneratedMediaGallery assets={assets} />);

    fireEvent.click(screen.getByRole("button", { name: "放大查看 晨光海报" }));
    const dialog = screen.getByRole("dialog");
    const image = within(dialog).getByRole("img", { name: "晨光海报大图" });

    expect(
      within(dialog).getByTestId("home-media-preview-stage")
    ).toHaveClass("min-h-0");
    expect(image).toHaveClass("absolute");
    expect(image).toHaveClass("inset-0");
    expect(image).toHaveClass("object-contain");
    expect(within(dialog).getByRole("link", { name: "下载资产" })).toHaveAttribute(
      "href",
      "http://localhost:8000/api/assets/image-1/content?download=1&filename=%E6%99%A8%E5%85%89%E6%B5%B7%E6%8A%A5"
    );
  });

  it("opens videos without autoplay and unmounts playback on close", () => {
    render(<HomeGeneratedMediaGallery assets={assets} />);

    fireEvent.click(screen.getByRole("tab", { name: "视频 1" }));
    fireEvent.click(screen.getByRole("button", { name: "放大查看 城市穿梭" }));

    const player = screen.getByLabelText("城市穿梭播放");
    expect(player).toHaveAttribute("controls");
    expect(player).not.toHaveAttribute("autoplay");

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByLabelText("城市穿梭播放")).not.toBeInTheDocument();
  });

  it("shows distinct load-error and empty-library states", () => {
    const { rerender } = render(
      <HomeGeneratedMediaGallery assets={[]} error="服务暂时不可用" />
    );
    expect(screen.getByText("产物加载失败")).toBeInTheDocument();
    expect(screen.getByText("服务暂时不可用")).toBeInTheDocument();

    rerender(<HomeGeneratedMediaGallery assets={[]} />);
    expect(screen.getByText("还没有图片产物")).toBeInTheDocument();
  });
});
