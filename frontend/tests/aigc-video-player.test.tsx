import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AigcVideoPlayer } from "@/components/workspace/aigc/aigc-video-player";

describe("AigcVideoPlayer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
    const surface = screen.getByTestId("aigc-video-surface");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveClass("nodrag", "nopan", "nowheel");
    expect(video.parentElement).not.toHaveClass("nodrag", "nopan", "nowheel");
    expect(surface).not.toHaveClass("nodrag", "nopan", "nowheel");
    expect(surface).toHaveClass(
      "pointer-events-none",
      "bottom-1/2",
      "[@media(pointer:fine)]:pointer-events-auto"
    );
    expect(surface).not.toHaveClass("bottom-12");
    expect(
      screen.queryByRole("button", { name: /^(全屏播放|放大预览)：/ })
    ).toBeNull();

    fireEvent.pointerDown(surface);
    fireEvent.wheel(surface);
    fireEvent.click(surface);

    expect(pointerDownCount).toBe(1);
    expect(wheelCount).toBe(1);
    expect(clickCount).toBe(1);
  });

  it("isolates native controls from node and canvas gesture handlers", () => {
    const events = {
      click: vi.fn(),
      doubleClick: vi.fn(),
      mouseDown: vi.fn(),
      pointerDown: vi.fn(),
      touchStart: vi.fn(),
      wheel: vi.fn()
    };

    render(
      <div
        onClick={events.click}
        onDoubleClick={events.doubleClick}
        onMouseDown={events.mouseDown}
        onPointerDown={events.pointerDown}
        onTouchStart={events.touchStart}
        onWheel={events.wheel}
      >
        <AigcVideoPlayer
          initialMetadata={{ duration: 20, height: 1280, width: 720 }}
          mimeType="video/mp4"
          name="原生控件.mp4"
          url="http://localhost:8000/api/assets/video-controls/content"
        />
      </div>
    );

    const video = screen.getByLabelText("播放视频：原生控件.mp4");
    fireEvent.pointerDown(video, { pointerId: 1 });
    fireEvent.mouseDown(video);
    fireEvent.touchStart(video);
    fireEvent.click(video);
    fireEvent.doubleClick(video);
    fireEvent.wheel(video);

    Object.values(events).forEach((handler) => {
      expect(handler).not.toHaveBeenCalled();
    });
  });

  it("plays from the current position on surface double click without toggling pause", () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
    let doubleClickCount = 0;

    render(
      <div
        onDoubleClick={() => {
          doubleClickCount += 1;
        }}
      >
        <AigcVideoPlayer
          initialMetadata={{ duration: 20, height: 1280, width: 720 }}
          mimeType="video/mp4"
          name="连续播放.mp4"
          url="http://localhost:8000/api/assets/video-continuous/content"
        />
      </div>
    );

    const video = screen.getByLabelText(
      "播放视频：连续播放.mp4"
    ) as HTMLVideoElement;
    video.currentTime = 7.5;

    fireEvent.click(screen.getByTestId("aigc-video-surface"));
    expect(play).not.toHaveBeenCalled();

    fireEvent.doubleClick(screen.getByTestId("aigc-video-surface"));
    fireEvent.doubleClick(screen.getByTestId("aigc-video-surface"));

    expect(play).toHaveBeenCalledTimes(2);
    expect(pause).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(7.5);
    expect(doubleClickCount).toBe(0);
  });

  it("does not play when the second pointer sequence exceeds the drag threshold", () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);

    render(
      <AigcVideoPlayer
        initialMetadata={{ duration: 20, height: 1280, width: 720 }}
        mimeType="video/mp4"
        name="拖拽视频.mp4"
        url="http://localhost:8000/api/assets/video-drag/content"
      />
    );

    const surface = screen.getByTestId("aigc-video-surface");
    fireEvent.pointerDown(surface, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse"
    });
    fireEvent.pointerMove(surface, {
      clientX: 20,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse"
    });
    fireEvent.pointerUp(surface, {
      clientX: 20,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse"
    });
    fireEvent.doubleClick(surface);

    expect(play).not.toHaveBeenCalled();

    fireEvent.touchStart(surface);
    fireEvent.touchEnd(surface);
    fireEvent.doubleClick(surface);

    expect(play).not.toHaveBeenCalled();
  });

  it("consumes rejected play promises", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValue(new DOMException("Autoplay blocked", "NotAllowedError"));

    render(
      <AigcVideoPlayer
        initialMetadata={{ duration: 20, height: 1280, width: 720 }}
        mimeType="video/mp4"
        name="受限视频.mp4"
        url="http://localhost:8000/api/assets/video-blocked/content"
      />
    );

    fireEvent.doubleClick(screen.getByTestId("aigc-video-surface"));
    await Promise.resolve();

    expect(play).toHaveBeenCalledOnce();
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
    expect(screen.queryByTestId("aigc-video-surface")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
