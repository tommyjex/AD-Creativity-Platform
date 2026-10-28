from __future__ import annotations

import asyncio
import json
import os
import shutil
from collections import Counter
from dataclasses import dataclass

import pytest

from backend.app.core.config import Settings
from backend.app.schemas.video_subtitle_grounding import (
    VIDEO_SUBTITLE_GROUNDING_DEFAULT_MODEL,
    VIDEO_SUBTITLE_GROUNDING_MAX_VIDEO_DURATION_MS,
    VideoSubtitleAlignment,
    VideoSubtitleGroundingRequest,
    VideoSubtitleGroundingResponse,
    VideoSubtitleGroundingSubtitle,
    VideoSubtitleGroundingUsage,
    VideoSubtitleGroundingVideoMetadata,
    VideoSubtitleVisualRole,
)
from backend.app.services.modelark_video_subtitle_grounding import (
    ModelArkVideoSubtitleGroundingAdapter,
)
from backend.app.services.video_subtitle_grounding import (
    VideoSubtitleGroundingService,
)
from backend.app.services.video_subtitle_grounding_media import (
    FFprobeVideoPathInspector,
    SecureRemoteVideoDownloader,
    SecureRemoteVideoPreparer,
)

_PAID_SMOKE_FLAG = "RUN_PAID_MODELARK_SMOKE"
_VIDEO_URL_ENV = "MODELARK_SMOKE_VIDEO_URL"


@dataclass(frozen=True)
class _PaidSmokeConfiguration:
    settings: Settings
    video_url: str


def _require_paid_smoke_configuration() -> _PaidSmokeConfiguration:
    if os.getenv(_PAID_SMOKE_FLAG) != "true":
        pytest.skip(f"paid ModelArk smoke requires {_PAID_SMOKE_FLAG}=true")

    video_url = os.getenv(_VIDEO_URL_ENV)
    settings = Settings.from_env()
    missing = []
    if not video_url:
        missing.append(_VIDEO_URL_ENV)
    if settings.ark_api_key is None:
        missing.append("ARK_API_KEY or BYTEPLUS_ARK_API_KEY")
    if shutil.which("ffprobe") is None:
        missing.append("ffprobe")
    if settings.video_subtitle_grounding_model != VIDEO_SUBTITLE_GROUNDING_DEFAULT_MODEL:
        missing.append(
            f"VIDEO_SUBTITLE_GROUNDING_MODEL={VIDEO_SUBTITLE_GROUNDING_DEFAULT_MODEL}"
        )
    if missing:
        pytest.skip("paid ModelArk smoke configuration incomplete: " + ", ".join(missing))

    assert video_url is not None
    return _PaidSmokeConfiguration(
        settings=settings.model_copy(
            update={
                "enable_experimental_video_subtitle_grounding_debug": False,
            }
        ),
        video_url=video_url,
    )


def _assert_smoke_response(response: VideoSubtitleGroundingResponse) -> None:
    assert response.model == VIDEO_SUBTITLE_GROUNDING_DEFAULT_MODEL
    assert 0 < response.video.duration_ms <= VIDEO_SUBTITLE_GROUNDING_MAX_VIDEO_DURATION_MS
    assert response.video.width > 0
    assert response.video.height > 0
    assert response.latency_ms >= 0
    assert response.usage.total_tokens >= 0

    for subtitle in response.subtitles:
        assert 0 <= subtitle.start_ms < subtitle.end_ms
        assert subtitle.end_ms <= response.video.duration_ms + 250
        normalized_x1, normalized_y1, normalized_x2, normalized_y2 = (
            subtitle.bbox_normalized
        )
        assert 0 <= normalized_x1 < normalized_x2 <= 999
        assert 0 <= normalized_y1 < normalized_y2 <= 999
        pixel_x1, pixel_y1, pixel_x2, pixel_y2 = subtitle.bbox_pixels
        assert 0 <= pixel_x1 < pixel_x2 <= response.video.width
        assert 0 <= pixel_y1 < pixel_y2 <= response.video.height
        assert subtitle.visual_role in set(VideoSubtitleVisualRole)
        assert 0 < subtitle.font_height_ratio <= 1
        assert subtitle.alignment in set(VideoSubtitleAlignment)
        assert 1 <= len(subtitle.block_id) <= 64
        assert subtitle.line_index >= 0


def _safe_summary(response: VideoSubtitleGroundingResponse) -> dict[str, object]:
    return {
        "model": response.model,
        "video": {
            "width": response.video.width,
            "height": response.video.height,
            "duration_ms": response.video.duration_ms,
        },
        "subtitle_count": len(response.subtitles),
        "role_counts": {
            role.value: sum(
                subtitle.visual_role == role
                for subtitle in response.subtitles
            )
            for role in VideoSubtitleVisualRole
        },
        "multiline_block_count": sum(
            count > 1
            for count in Counter(
                subtitle.block_id for subtitle in response.subtitles
            ).values()
        ),
        "usage": response.usage.model_dump(mode="json"),
        "latency_ms": response.latency_ms,
        "time_bounds_valid": True,
        "normalized_bounds_valid": True,
        "pixel_bounds_valid": True,
    }


def _sample_response() -> VideoSubtitleGroundingResponse:
    return VideoSubtitleGroundingResponse(
        model=VIDEO_SUBTITLE_GROUNDING_DEFAULT_MODEL,
        video=VideoSubtitleGroundingVideoMetadata(
            width=1920,
            height=1080,
            duration_ms=30_000,
            rotation=0,
        ),
        subtitles=[
            VideoSubtitleGroundingSubtitle(
                text="must-not-be-printed",
                start_ms=1200,
                end_ms=2600,
                bbox_normalized=(120, 820, 880, 920),
                bbox_pixels=(230, 885, 1689, 993),
                visual_role=VideoSubtitleVisualRole.FOOTNOTE,
                font_height_ratio=0.03,
                alignment=VideoSubtitleAlignment.CENTER,
                block_id="block_0",
                line_index=0,
            )
        ],
        usage=VideoSubtitleGroundingUsage(
            input_tokens=100,
            output_tokens=20,
            total_tokens=120,
        ),
        latency_ms=1234,
    )


def test_paid_smoke_gate_skips_before_loading_configuration(monkeypatch) -> None:
    monkeypatch.delenv(_PAID_SMOKE_FLAG, raising=False)

    def fail_if_loaded() -> Settings:
        raise AssertionError("settings must not load while paid smoke is disabled")

    monkeypatch.setattr(Settings, "from_env", fail_if_loaded)

    with pytest.raises(pytest.skip.Exception):
        _require_paid_smoke_configuration()


def test_paid_smoke_gate_skips_when_configuration_is_incomplete(monkeypatch) -> None:
    monkeypatch.setenv(_PAID_SMOKE_FLAG, "true")
    monkeypatch.delenv(_VIDEO_URL_ENV, raising=False)
    monkeypatch.setattr(Settings, "from_env", lambda: Settings(ark_api_key=None))
    monkeypatch.setattr(shutil, "which", lambda _executable: "/usr/bin/ffprobe")

    with pytest.raises(pytest.skip.Exception, match="configuration incomplete"):
        _require_paid_smoke_configuration()


def test_paid_smoke_summary_is_safe_and_boundary_checks_pass() -> None:
    response = _sample_response()

    _assert_smoke_response(response)
    rendered = json.dumps(_safe_summary(response), sort_keys=True)

    assert "must-not-be-printed" not in rendered
    assert "video_url" not in rendered
    assert "api_key" not in rendered
    assert "subtitle_count" in rendered
    assert "pixel_bounds_valid" in rendered
    assert '"footnote": 1' in rendered
    assert '"multiline_block_count": 0' in rendered


def test_paid_modelark_video_subtitle_grounding_smoke() -> None:
    """Run manually only; this performs paid Files and Responses API calls."""
    configuration = _require_paid_smoke_configuration()
    settings = configuration.settings
    preparer = SecureRemoteVideoPreparer(
        downloader=SecureRemoteVideoDownloader(settings),
        inspector=FFprobeVideoPathInspector(settings),
    )
    provider = ModelArkVideoSubtitleGroundingAdapter(settings)
    service = VideoSubtitleGroundingService(
        preparer=preparer,
        provider=provider,
        settings=settings,
    )

    response = asyncio.run(
        service.run(
            VideoSubtitleGroundingRequest(
                video_url=configuration.video_url,
                sampling_fps=settings.video_subtitle_grounding_sampling_fps,
            )
        )
    )

    _assert_smoke_response(response)
    print(json.dumps(_safe_summary(response), sort_keys=True))
