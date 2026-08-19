import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExportPreview } from "@/components/export-preview";
import {
  BackToWorkflowButton,
  ProjectEmptyState
} from "@/components/project-empty-state";
import type { Asset, Project } from "@/lib/api-types";

const baseProject: Project = {
  assets: [],
  brief: {
    aspect_ratio: "9:16",
    audience: "通勤白领",
    duration_seconds: 30,
    image_purpose: null,
    product_name: "AeroPress Go",
    prompt: "为便携咖啡机生成一条 30 秒短视频广告",
    selling_points: ["便携", "快速萃取"],
    style: "真实生活流",
    summary: null,
    target_language: "zh",
    target_platform: "douyin"
  },
  created_at: "2026-08-09T10:00:00Z",
  current_stage: "compose",
  current_image_asset_id: null,
  current_image_prompt_version_id: null,
  id: "project-1",
  image_prompt_status: "draft",
  image_revision: 0,
  name: "AeroPress Go 创意项目",
  project_type: "video_ad",
  status: "succeeded",
  storyboard: [],
  tasks: [],
  text_artifacts: [],
  updated_at: "2026-08-09T10:00:00Z"
};

const finalVideoAsset: Asset = {
  category: null,
  created_at: "2026-08-09T10:00:00Z",
  id: "asset-final-1",
  metadata: {
    duration_seconds: 30,
    model: "compose-engine",
    provider: "local",
    source_video_count: 3
  },
  mime_type: "video/mp4",
  object_key: "projects/project-1/final.mp4",
  project_id: "project-1",
  size_bytes: 1048576,
  source_task_id: "task-compose-1",
  stage: "compose",
  status: "succeeded",
  type: "final_video",
  updated_at: "2026-08-09T10:05:00Z",
  url: "https://cdn.example.test/final.mp4"
};

describe("ProjectEmptyState", () => {
  it("renders the provided title, description, and workflow action", () => {
    render(
      <ProjectEmptyState
        action={<BackToWorkflowButton href="/projects/project-1" />}
        description="当前项目还没有生成或上传任何资产。"
        title="资产库暂时为空"
      />
    );

    expect(screen.getByRole("heading", { name: "资产库暂时为空" })).toBeInTheDocument();
    expect(screen.getByText("当前项目还没有生成或上传任何资产。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回创作流程" })).toHaveAttribute(
      "href",
      "/projects/project-1"
    );
  });
});

describe("ExportPreview", () => {
  it("shows an actionable empty state when no final video exists", () => {
    render(<ExportPreview assets={[]} project={baseProject} />);

    expect(screen.getByRole("heading", { name: "尚未生成最终成片" })).toBeInTheDocument();
    const workflowLinks = screen.getAllByRole("link", { name: "返回创作流程" });
    expect(workflowLinks).toHaveLength(2);
    workflowLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/projects/project-1");
    });
    expect(screen.getByText("最终成片记录 0 条", { exact: false })).toBeInTheDocument();
  });

  it("renders final video metadata and download actions", () => {
    render(<ExportPreview assets={[finalVideoAsset]} project={baseProject} />);

    expect(screen.getByRole("heading", { name: "Final Video Preview" })).toBeInTheDocument();
    expect(screen.getByText("video/mp4 · 1.00 MB")).toBeInTheDocument();
    expect(screen.getByText("Source Clips")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /下载最终视频/ })).toHaveAttribute(
      "href",
      finalVideoAsset.url
    );
    expect(screen.getByRole("link", { name: "新窗口打开" })).toHaveAttribute(
      "href",
      finalVideoAsset.url
    );
    expect(screen.getByTestId("export-video-preview-frame")).toHaveStyle({
      aspectRatio: "9 / 16",
      width: "min(100%, 27dvh, 18rem)"
    });
    expect(document.querySelector("video")).toHaveClass(
      "h-full",
      "w-full",
      "object-contain"
    );
  });
});
