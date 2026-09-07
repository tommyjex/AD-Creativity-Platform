import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AigcAudioPlayer } from "@/components/workspace/aigc/aigc-audio-player";

describe("AigcAudioPlayer", () => {
  it("shows accessible playback, duration, and MIME metadata", () => {
    render(
      <AigcAudioPlayer
        duration={65.2}
        mimeType="audio/mpeg"
        name="旁白"
        url="https://assets.local/narration.mp3"
        variant="panel"
      />
    );

    expect(screen.getByLabelText("播放音频：旁白")).toHaveAttribute(
      "src",
      "https://assets.local/narration.mp3"
    );
    expect(screen.getByLabelText("音频信息：旁白")).toHaveTextContent(
      "1:05.2 · audio/mpeg"
    );
  });

  it("prefers loaded duration and disables unavailable playback", () => {
    const view = render(
      <AigcAudioPlayer
        duration={3}
        mimeType="audio/wav"
        name="音效"
        url="https://assets.local/effect.wav"
      />
    );
    const audio = screen.getByLabelText("播放音频：音效");
    Object.defineProperty(audio, "duration", {
      configurable: true,
      value: 8.5
    });
    fireEvent.loadedMetadata(audio);
    expect(screen.getByLabelText("音频信息：音效")).toHaveTextContent(
      "8.5s · audio/wav"
    );

    view.rerender(
      <AigcAudioPlayer
        mimeType="audio/wav"
        name="音效"
        unavailableText="上游音频结果不可用"
        url={null}
      />
    );
    expect(screen.getByText("上游音频结果不可用")).toBeInTheDocument();
    expect(screen.queryByLabelText("播放音频：音效")).toBeNull();
  });
});
