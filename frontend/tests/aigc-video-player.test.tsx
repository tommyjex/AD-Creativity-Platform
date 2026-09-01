import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AigcVideoPlayer } from "@/components/workspace/aigc/aigc-video-player";

const requestFullscreenDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "requestFullscreen"
);
const webkitEnterFullscreenDescriptor = Object.getOwnPropertyDescriptor(
  HTMLVideoElement.prototype,
  "webkitEnterFullscreen"
);

afterEach(() => {
  restoreVideoMethod("requestFullscreen", requestFullscreenDescriptor);
  restoreVideoMethod("webkitEnterFullscreen", webkitEnterFullscreenDescriptor);
});

describe("AigcVideoPlayer", () => {
  it("keeps native controls available while marking React Flow gesture boundaries", () => {
    const parentClick = vi.fn();
    const parentDoubleClick = vi.fn();
    const parentKeyDown = vi.fn();
    const parentMouseDown = vi.fn();
    const parentPointerDown = vi.fn();
    const parentTouchStart = vi.fn();
    const parentWheel = vi.fn();

    render(
      <div
        onClick={parentClick}
        onDoubleClick={parentDoubleClick}
        onKeyDown={parentKeyDown}
        onMouseDown={parentMouseDown}
        onPointerDown={parentPointerDown}
        onTouchStart={parentTouchStart}
        onWheel={parentWheel}
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
    expect(video.parentElement).toHaveClass("nodrag", "nopan", "nowheel");

    expect(fireEvent.pointerDown(video)).toBe(true);
    expect(fireEvent.mouseDown(video)).toBe(true);
    expect(fireEvent.touchStart(video)).toBe(true);
    expect(fireEvent.wheel(video)).toBe(true);
    expect(fireEvent.click(video)).toBe(true);
    expect(fireEvent.doubleClick(video)).toBe(true);
    expect(fireEvent.keyDown(video, { key: "Enter" })).toBe(true);

    expect(parentPointerDown).toHaveBeenCalledTimes(1);
    expect(parentMouseDown).toHaveBeenCalledTimes(1);
    expect(parentTouchStart).toHaveBeenCalledTimes(1);
    expect(parentWheel).toHaveBeenCalledTimes(1);
    expect(parentClick).toHaveBeenCalledTimes(1);
    expect(parentDoubleClick).toHaveBeenCalledTimes(1);
    expect(parentKeyDown).toHaveBeenCalledTimes(1);
  });

  it("offers a separate Fullscreen API control without replacing native controls", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    mockVideoMethod("requestFullscreen", requestFullscreen);

    render(
      <AigcVideoPlayer
        initialMetadata={{ duration: 20, height: 1280, width: 720 }}
        mimeType="video/mp4"
        name="标准全屏.mp4"
        url="http://localhost:8000/api/assets/video-fullscreen/content"
      />
    );

    const video = screen.getByLabelText("播放视频：标准全屏.mp4");
    const button = screen.getByRole("button", {
      name: "全屏播放：标准全屏.mp4"
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledTimes(1));
    expect(requestFullscreen.mock.instances[0]).toBe(video.parentElement);
    expect(video).toHaveAttribute("controls");
  });

  it("uses the native WebKit media fullscreen API when standard fullscreen is absent", async () => {
    const webkitEnterFullscreen = vi.fn();
    mockVideoMethod("requestFullscreen", undefined);
    mockVideoMethod("webkitEnterFullscreen", webkitEnterFullscreen);

    render(
      <AigcVideoPlayer
        initialMetadata={{ duration: 20, height: 1280, width: 720 }}
        mimeType="video/mp4"
        name="WebKit 全屏.mp4"
        url="http://localhost:8000/api/assets/video-webkit/content"
      />
    );

    const button = screen.getByRole("button", {
      name: "全屏播放：WebKit 全屏.mp4"
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    expect(webkitEnterFullscreen).toHaveBeenCalledTimes(1);
  });

  it("disables the fallback control when no fullscreen API is available", () => {
    mockVideoMethod("requestFullscreen", undefined);
    mockVideoMethod("webkitEnterFullscreen", undefined);

    render(
      <AigcVideoPlayer
        initialMetadata={{ duration: 20, height: 1280, width: 720 }}
        mimeType="video/mp4"
        name="不支持全屏.mp4"
        url="http://localhost:8000/api/assets/video-unsupported/content"
      />
    );

    const button = screen.getByRole("button", {
      name: "全屏播放：不支持全屏.mp4"
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      /当前浏览器不支持页面全屏/
    );
  });

  it("reports a rejected fullscreen request without an unhandled exception", async () => {
    mockVideoMethod(
      "requestFullscreen",
      vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError"))
    );

    render(
      <AigcVideoPlayer
        initialMetadata={{ duration: 20, height: 1280, width: 720 }}
        mimeType="video/mp4"
        name="拒绝全屏.mp4"
        url="http://localhost:8000/api/assets/video-denied/content"
      />
    );

    const button = screen.getByRole("button", {
      name: "全屏播放：拒绝全屏.mp4"
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() =>
      expect(button).toHaveAccessibleDescription(/无法进入全屏/)
    );
  });

  it("does not attach node-only restrictions to panel and enlarged players", () => {
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
    expect(video).toHaveAttribute("playsinline");
    expect(video.parentElement).toHaveClass("h-44");
    expect(video.parentElement).not.toHaveClass("nodrag", "nopan", "nowheel");

    fireEvent.click(
      screen.getByRole("button", { name: "放大预览：面板视频.mp4" })
    );

    const preview = screen.getByLabelText("面板视频.mp4 放大预览");
    expect(preview).toHaveAttribute("controls");
    expect(preview).toHaveAttribute("playsinline");
    expect(preview).toHaveAttribute("autoplay");
    expect(preview).toHaveClass("object-contain");
    expect(preview.parentElement).not.toHaveClass("nodrag", "nopan", "nowheel");
  });
});

function mockVideoMethod(
  name: "requestFullscreen" | "webkitEnterFullscreen",
  value: (() => Promise<void>) | (() => void) | undefined
) {
  const prototype =
    name === "requestFullscreen"
      ? Element.prototype
      : HTMLVideoElement.prototype;
  Object.defineProperty(prototype, name, {
    configurable: true,
    value
  });
}

function restoreVideoMethod(
  name: "requestFullscreen" | "webkitEnterFullscreen",
  descriptor: PropertyDescriptor | undefined
) {
  const prototype =
    name === "requestFullscreen"
      ? Element.prototype
      : HTMLVideoElement.prototype;
  if (descriptor) {
    Object.defineProperty(prototype, name, descriptor);
  } else {
    delete (prototype as unknown as Record<string, unknown>)[name];
  }
}
