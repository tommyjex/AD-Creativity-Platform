import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import AigcAcceptancePage from "@/app/workspace/aigc/acceptance/page";

const STORAGE_KEY = "aigc.acceptance.video-face-blur.v2";

describe("AIGC video face blur acceptance fixture", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists the browser-only face blur failure and retry flow", async () => {
    const { unmount } = render(
      await AigcAcceptancePage({
        searchParams: Promise.resolve({ scenario: "video-face-blur" })
      })
    );

    expect(screen.getByText("视频节点（本地）")).toBeInTheDocument();
    expect(screen.queryByText("视频人脸打码")).not.toBeInTheDocument();
    expect(screen.getByLabelText("打码方式")).toHaveValue("mosaic");
    expect(screen.getByLabelText("打码强度")).toHaveValue("medium");

    fireEvent.click(screen.getByRole("button", { name: "添加视频人脸打码" }));
    fireEvent.click(
      screen.getByRole("button", { name: "添加视频节点（上游）" })
    );
    fireEvent.click(screen.getByRole("button", { name: "连接完整流程" }));

    fireEvent.change(screen.getByLabelText("打码方式"), {
      target: { value: "blur" }
    });
    fireEvent.change(screen.getByLabelText("打码强度"), {
      target: { value: "high" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain(
      '"mask_mode":"blur"'
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain(
      '"mask_strength":"high"'
    );
    unmount();

    render(
      await AigcAcceptancePage({
        searchParams: Promise.resolve({ scenario: "video-face-blur" })
      })
    );
    expect(screen.getByLabelText("打码方式")).toHaveValue("blur");
    expect(screen.getByLabelText("打码强度")).toHaveValue("high");

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
      screen.getByLabelText("播放视频：人脸打码 Mock 输出.mp4")
    ).toHaveAttribute("src", "/acceptance/aigc-video-fullscreen.mp4");
    expect(
      screen.getByRole("link", { name: "下载打码视频" })
    ).toHaveAttribute("download", "人脸打码-Mock-输出.mp4");

    fireEvent.click(
      screen.getByRole("button", {
        name: "放大预览：人脸打码 Mock 输出.mp4"
      })
    );
    expect(
      screen.getByRole("dialog", { name: "视频预览" })
    ).toBeInTheDocument();
  });
});
