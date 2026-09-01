import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AigcAcceptancePage from "@/app/workspace/aigc/acceptance/page";

describe("AIGC acceptance fixture", () => {
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
        "download=1&filename=%E9%AA%8C%E6%94%B6+Mock+%E6%88%90%E7%89%87-1.mp4"
    );
    expect(
      screen.getByRole("link", { name: "下载 Mock 视频" })
    ).toHaveAttribute("download", "验收 Mock 成片-1.mp4");
    expect(screen.getByText("Mock 结果已失效")).toBeInTheDocument();
    expect(screen.getByText("播放和下载已禁用")).toBeInTheDocument();
  });
});
