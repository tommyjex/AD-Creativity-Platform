import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AigcVideoPlayer } from "@/components/workspace/aigc/aigc-video-player";

describe("AigcVideoPlayer", () => {
  it("keeps native controls available while marking React Flow gesture boundaries", () => {
    let clickCount = 0;
    let pointerDownCount = 0;
    let wheelCount = 0;

    render(
      <div
        onClick={() => {
          clickCount += 1;
        }}
        onPointerDown={() => {
          pointerDownCount += 1;
        }}
        onWheel={() => {
          wheelCount += 1;
        }}
      >
        <AigcVideoPlayer
          initialMetadata={{ duration: 20, height: 1280, width: 720 }}
          mimeType="video/mp4"
          name="测试视频.mp4"
          url="http://localhost:8000/api/assets/video-1/content"
        />
      </div>
    );

    const video = screen.getByLabelText("播放视频：测试视频.mp4");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveClass("nodrag", "nopan", "nowheel");
    expect(video.parentElement).not.toHaveClass("nodrag", "nopan", "nowheel");
    expect(
      screen.queryByRole("button", { name: /^(全屏播放|放大预览)：/ })
    ).toBeNull();

    fireEvent.pointerDown(video);
    fireEvent.wheel(video);
    fireEvent.click(video);

    expect(pointerDownCount).toBe(1);
    expect(wheelCount).toBe(1);
    expect(clickCount).toBe(1);
  });

  it("keeps panel players free of node-only gesture restrictions", () => {
    render(
      <AigcVideoPlayer
        initialMetadata={{ duration: 20, height: 1280, width: 720 }}
        mimeType="video/mp4"
        name="面板视频.mp4"
        url="http://localhost:8000/api/assets/video-2/content"
        variant="panel"
      />
    );

    const video = screen.getByLabelText("播放视频：面板视频.mp4");
    expect(video).toHaveAttribute("controls");
    expect(video.parentElement).toHaveClass("h-44");
    expect(video.parentElement).not.toHaveClass("nodrag", "nopan", "nowheel");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
