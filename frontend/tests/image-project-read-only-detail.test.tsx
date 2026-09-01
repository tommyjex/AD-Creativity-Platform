import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImageProjectReadOnlyDetail } from "@/components/workspace/image-project-read-only-detail";
import type { Asset, ImagePromptVersion, Project } from "@/lib/api-types";

const apiMocks = vi.hoisted(() => ({
  listImagePromptVersions: vi.fn()
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...original,
    apiClient: apiMocks,
    getUserFacingErrorMessage: () => "请求失败"
  };
});

const generatedAsset: Asset = {
  asset_role: "public",
  category: null,
  created_at: "2026-08-24T08:05:00Z",
  id: "generated-1",
  metadata: {},
  mime_type: "image/png",
  object_key: "projects/image-project-1/generated-1.png",
  project_id: "image-project-1",
  size_bytes: 1024,
  source_task_id: "task-1",
  stage: "image",
  status: "succeeded",
  type: "generated_image",
  updated_at: "2026-08-24T08:05:00Z",
  url: "https://assets.example.com/generated-1.png"
};

const referenceAsset: Asset = {
  ...generatedAsset,
  category: "reference",
  id: "reference-1",
  metadata: { name: "参考产品图.png" },
  source_task_id: null,
  type: "uploaded_image",
  url: "https://assets.example.com/reference-1.png"
};

const project: Project = {
  assets: [generatedAsset, referenceAsset],
  brief: {
    aspect_ratio: "1:1",
    audience: "城市通勤人群",
    duration_seconds: null,
    image_purpose: "ecommerce_main",
    product_name: "便携咖啡机",
    prompt: "制作简洁的商品主图",
    selling_points: ["轻巧便携"],
    style: "自然晨光",
    summary: "突出轻巧便携与通勤场景。",
    target_language: "zh",
    target_platform: "tmall"
  },
  character_cards: [],
  created_at: "2026-08-24T08:00:00Z",
  current_image_asset_id: generatedAsset.id,
  current_image_prompt_version_id: "prompt-v2",
  current_stage: "image",
  id: "image-project-1",
  image_prompt_status: "succeeded",
  image_reference_asset_ids: [referenceAsset.id],
  image_revision: 1,
  name: "咖啡机主图",
  project_type: "image_asset",
  status: "draft",
  storyboard: [],
  tasks: [],
  text_artifacts: [],
  updated_at: "2026-08-24T08:05:00Z"
};

const versions: ImagePromptVersion[] = [
  {
    aspect_ratio: "1:1",
    created_at: "2026-08-24T08:04:00Z",
    id: "prompt-v2",
    image_purpose: "ecommerce_main",
    project_id: project.id,
    prompt: "当前商品主图提示词",
    target_language: "zh",
    version: 2
  },
  {
    aspect_ratio: "1:1",
    created_at: "2026-08-24T08:02:00Z",
    id: "prompt-v1",
    image_purpose: "ecommerce_main",
    project_id: project.id,
    prompt: "第一版商品主图提示词",
    target_language: "zh",
    version: 1
  }
];

describe("ImageProjectReadOnlyDetail", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    apiMocks.listImagePromptVersions.mockResolvedValue(versions);
  });

  it("renders read-only brief, prompt, references, and versions", async () => {
    render(
      <ImageProjectReadOnlyDetail
        onProjectUpdated={vi.fn()}
        project={project}
      />
    );

    expect(screen.getByRole("heading", { name: project.name })).toBeInTheDocument();
    expect(screen.getByText(project.brief.summary!)).toBeInTheDocument();
    expect(screen.getByText("电商主图")).toBeInTheDocument();
    expect(screen.getByText("参考产品图.png")).toBeInTheDocument();
    expect(screen.getByAltText("参考产品图.png")).toHaveAttribute(
      "src",
      referenceAsset.url
    );

    expect(
      await screen.findAllByText("当前商品主图提示词")
    ).toHaveLength(2);
    expect(screen.getByText("第一版商品主图提示词")).toBeInTheDocument();
    expect(screen.getByText("V2")).toBeInTheDocument();
    expect(screen.getByText("V1")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "编辑 Brief" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "生成图片" })
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(apiMocks.listImagePromptVersions).toHaveBeenCalledWith(project.id, {
        cache: "no-store"
      });
    });
  });

  it("links the canvas entry to the project canvas route instead of opening a dialog", () => {
    render(
      <ImageProjectReadOnlyDetail
        onProjectUpdated={vi.fn()}
        project={project}
      />
    );

    const canvasLink = screen.getByRole("link", { name: "进入画布" });
    expect(canvasLink).toHaveAttribute(
      "href",
      `/projects/${project.id}/canvas`
    );
    // The detail page no longer inlines the canvas or layer editor controls.
    expect(
      screen.queryByRole("button", { name: "生成编辑版本" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "图层拆分" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("编辑指令")).not.toBeInTheDocument();
  });
});
