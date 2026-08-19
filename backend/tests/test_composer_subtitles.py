import asyncio
from pathlib import Path

from backend.app.core.config import Settings
from backend.app.schemas import Brief
from backend.app.services.composer import FfmpegVideoComposer


def test_burn_subtitles_uses_explicit_filename_filter(monkeypatch) -> None:
    composer = FfmpegVideoComposer(
        Settings(composer_ffmpeg_path="/fake/ffmpeg")
    )
    commands: list[list[str]] = []

    async def fake_run_ffmpeg(
        command: list[str],
        *,
        phase: str,
        asset_id: str | None = None,
    ) -> None:
        assert phase == "subtitles"
        assert asset_id is None
        commands.append(command)
        Path(command[-1]).write_bytes(b"rendered-video")

    monkeypatch.setattr(composer, "_run_ffmpeg", fake_run_ffmpeg)

    result = asyncio.run(
        composer.burn_subtitles(
            base_video=b"base-video",
            srt_text="1\n00:00:00,000 --> 00:00:01,000\n测试字幕\n",
            brief=Brief(prompt="test"),
        )
    )

    video_filter = commands[0][commands[0].index("-vf") + 1]
    assert video_filter.startswith("subtitles=filename='")
    assert ":force_style='Alignment=2,FontSize=18," in video_filter
    assert result.content == b"rendered-video"
