import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AigcAcceptancePage from "@/app/workspace/aigc/acceptance/page";
import {
  installAcceptanceNetworkGuard,
  isForbiddenAcceptanceRequest
} from "@/lib/aigc/acceptance-network-guard";

describe("AIGC acceptance fixture", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders a controlled Mock video download and preserves the unavailable state", async () => {
    render(
      await AigcAcceptancePage({
        searchParams: Promise.resolve({ scenario: "mock-results" })
      })
    );

    expect(
      screen.getByLabelText("播放视频：验收 Mock 成片.mp4")
    ).toHaveAttribute(
      "src",
      "http://localhost:8000/api/assets/acceptance-video/content"
    );
    expect(
      screen.getByRole("link", { name: "下载 Mock 视频" })
    ).toHaveAttribute(
      "href",
      "http://localhost:8000/api/assets/acceptance-video/content?" +
        "download=1&filename=%E9%AA%8C%E6%94%B6-Mock-%E6%88%90%E7%89%87.mp4"
    );
    expect(
      screen.getByRole("link", { name: "下载 Mock 视频" })
    ).toHaveAttribute("download", "验收-Mock-成片.mp4");
    expect(screen.getByText("Mock 结果已失效")).toBeInTheDocument();
    expect(screen.getByText("播放和下载已禁用")).toBeInTheDocument();
  });

  it("runs the browser-only video enhancement failure and retry flow", async () => {
    const { unmount } = render(
      await AigcAcceptancePage({
        searchParams: Promise.resolve({ scenario: "video-enhancement" })
      })
    );

    expect(screen.getByText("视频节点（本地）")).toBeInTheDocument();
    expect(screen.queryByText("视频画质增强")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "添加视频画质增强" }));
    fireEvent.click(
      screen.getByRole("button", { name: "添加视频节点（上游）" })
    );
    fireEvent.click(screen.getByRole("button", { name: "连接完整流程" }));

    fireEvent.change(screen.getByLabelText("工具版本"), {
      target: { value: "professional" }
    });
    expect(screen.queryByLabelText("场景")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("色深"), {
      target: { value: "16" }
    });
    expect(screen.getByLabelText("码率模式")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(window.localStorage.length).toBe(1);
    unmount();

    render(
      await AigcAcceptancePage({
        searchParams: Promise.resolve({ scenario: "video-enhancement" })
      })
    );
    expect(screen.getByLabelText("工具版本")).toHaveValue("professional");
    expect(screen.getByLabelText("色深")).toHaveValue("16");

    fireEvent.click(screen.getByRole("button", { name: "执行" }));
    expect(screen.getByTestId("run-status")).toHaveTextContent(
      "状态：失败 · Attempt 1"
    );
    expect(screen.getByText("Mock 失败已保留，可重试")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试失败节点" }));
    expect(screen.getByTestId("run-status")).toHaveTextContent(
      "状态：成功 · Attempt 2"
    );
    expect(
      screen.getByLabelText("播放视频：画质增强 Mock 输出.mp4")
    ).toHaveAttribute("src", "/acceptance/aigc-video-fullscreen.mp4");
    expect(
      screen.getByRole("link", { name: "下载增强视频" })
    ).toHaveAttribute("download", "画质增强-Mock-输出.mp4");
    expect(
      screen.queryByRole("button", {
        name: "放大预览：画质增强 Mock 输出.mp4"
      })
    ).toBeNull();
  });

  it("blocks MediaKit video processing requests while allowing local media", async () => {
    const originalFetch = window.fetch;
    const allowedFetch = vi.fn().mockResolvedValue(new Response());
    window.fetch = allowedFetch;
    const release = installAcceptanceNetworkGuard();

    expect(
      isForbiddenAcceptanceRequest(
        "https://mediakit.cn-beijing.volces.com/api/v1/tasks/task-1"
      )
    ).toBe(true);
    expect(isForbiddenAcceptanceRequest("/api/v1/tools/enhance-video")).toBe(
      true
    );
    expect(
      isForbiddenAcceptanceRequest("/api/v1/tools/face-blur-video")
    ).toBe(true);
    expect(
      isForbiddenAcceptanceRequest("/api/v1/tools/multi-track-edit")
    ).toBe(true);
    expect(
      isForbiddenAcceptanceRequest("/acceptance/aigc-video-fullscreen.mp4")
    ).toBe(false);

    expect(() =>
      window.fetch(
        "https://mediakit.cn-beijing.volces.com/api/v1/tools/enhance-video"
      )
    ).toThrow("Acceptance safety guard blocked");
    expect(() => window.fetch("/api/v1/tools/enhance-video")).toThrow(
      "Acceptance safety guard blocked"
    );
    expect(() => window.fetch("/api/v1/tools/face-blur-video")).toThrow(
      "Acceptance safety guard blocked"
    );
    expect(() => window.fetch("/api/v1/tools/multi-track-edit")).toThrow(
      "Acceptance safety guard blocked"
    );
    await window.fetch("/acceptance/aigc-video-fullscreen.mp4");
    expect(allowedFetch).toHaveBeenCalledTimes(1);

    release();
    expect(window.fetch).toBe(allowedFetch);
    window.fetch = originalFetch;
  });
});
