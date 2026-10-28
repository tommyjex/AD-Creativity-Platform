from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import backend.app.services.video_subtitle_grounding as service_module
from backend.app.api.dependencies import (
    get_repository,
    get_video_subtitle_grounding_service,
)
from backend.app.core.config import Settings, get_settings
from backend.app.main import create_app
from backend.app.repositories import InMemoryRepository
from backend.app.schemas.auth import UserRole
from backend.app.schemas.video_subtitle_grounding import (
    VideoSubtitleGroundingErrorCode,
    VideoSubtitleGroundingErrorPhase,
    VideoSubtitleGroundingRequest,
    VideoSubtitleGroundingResponse,
    VideoSubtitleGroundingUsage,
    VideoSubtitleGroundingVideoMetadata,
)
from backend.app.services.media_inspector import VideoDisplayMetadata
from backend.app.services.modelark_video_subtitle_grounding import (
    ModelArkSubtitleGroundingSegment,
    ModelArkVideoSubtitleGroundingResult,
    VideoSubtitleGroundingProviderError,
)
from backend.app.services.video_subtitle_grounding import (
    VideoSubtitleGroundingService,
)
from backend.app.services.video_subtitle_grounding_media import (
    PreparedRemoteVideo,
    RemoteVideoError,
)
from backend.tests.auth_helpers import authenticate_test_client

SECRET_URL = "https://media.example.test/input.mp4?token=url-secret"
RAW_OUTPUT = '{"subtitles":[{"text":"private subtitle"}]}'


def _metadata() -> VideoDisplayMetadata:
    return VideoDisplayMetadata(
        encoded_width=1920,
        encoded_height=1080,
        display_width=1920,
        display_height=1080,
        duration_seconds=30,
        rotation=0,
        container="mp4",
        codec="h264",
    )


def _provider_result(
    *,
    subtitles: tuple[ModelArkSubtitleGroundingSegment, ...] | None = None,
    raw_output: str = RAW_OUTPUT,
) -> ModelArkVideoSubtitleGroundingResult:
    return ModelArkVideoSubtitleGroundingResult(
        model="doubao-seed-evolving",
        subtitles=(
            subtitles
            if subtitles is not None
            else (
                ModelArkSubtitleGroundingSegment(
                    text="private subtitle",
                    start_ms=1200,
                    end_ms=2600,
                    bbox="<bbox>120 820 880 920</bbox>",
                    visual_role="body",
                    font_height_ratio=0.05,
                    alignment="center",
                    block_id="block_0",
                    line_index=0,
                ),
            )
        ),
        usage=VideoSubtitleGroundingUsage(
            input_tokens=10,
            output_tokens=20,
            total_tokens=30,
        ),
        request_id="request-safe-1",
        raw_output=raw_output,
    )


class FakePreparer:
    def __init__(
        self,
        *,
        error: BaseException | None = None,
        wait_forever: bool = False,
    ) -> None:
        self.error = error
        self.wait_forever = wait_forever
        self.open_calls: list[str] = []
        self.entered = asyncio.Event()
        self.cleaned = False

    @asynccontextmanager
    async def open(self, url: str) -> AsyncIterator[PreparedRemoteVideo]:
        self.open_calls.append(url)
        self.entered.set()
        try:
            if self.error is not None:
                raise self.error
            if self.wait_forever:
                await asyncio.Event().wait()
            yield PreparedRemoteVideo(
                path=Path("/tmp/fake-video.mp4"),
                mime_type="video/mp4",
                size_bytes=1234,
                metadata=_metadata(),
            )
        finally:
            self.cleaned = True


class FakeProvider:
    def __init__(
        self,
        result: ModelArkVideoSubtitleGroundingResult | None = None,
        *,
        error: BaseException | None = None,
    ) -> None:
        self.result = result or _provider_result()
        self.error = error
        self.calls: list[tuple[Path, float]] = []

    async def ground_subtitles(
        self,
        video_path: Path,
        *,
        sampling_fps: float,
    ) -> ModelArkVideoSubtitleGroundingResult:
        self.calls.append((video_path, sampling_fps))
        if self.error is not None:
            raise self.error
        return self.result


def test_service_orchestrates_success_and_empty_results(monkeypatch) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(
        service_module,
        "log_event",
        lambda _logger, event, **context: events.append((event, context)),
    )

    for result, expected_count in ((_provider_result(), 1), (_provider_result(subtitles=()), 0)):
        preparer = FakePreparer()
        provider = FakeProvider(result)
        service = VideoSubtitleGroundingService(
            preparer=preparer,
            provider=provider,
            settings=Settings(enable_experimental_video_subtitle_grounding=True),
            clock=lambda: 10.0,
        )

        response = asyncio.run(
            service.run(
                VideoSubtitleGroundingRequest(
                    video_url=SECRET_URL,
                    sampling_fps=2.5,
                )
            )
        )

        assert len(response.subtitles) == expected_count
        assert response.video.model_dump() == {
            "width": 1920,
            "height": 1080,
            "duration_ms": 30000,
            "rotation": 0,
        }
        assert response.usage.total_tokens == 30
        assert response.latency_ms == 0
        assert provider.calls == [(Path("/tmp/fake-video.mp4"), 2.5)]
        assert preparer.cleaned is True

    success = [context for event, context in events if event.endswith(".completed")]
    assert [event["subtitle_count"] for event in success] == [1, 0]
    serialized = str(events)
    assert SECRET_URL not in serialized
    assert "url-secret" not in serialized
    assert "private subtitle" not in serialized
    assert RAW_OUTPUT not in serialized


def test_service_returns_style_and_logs_only_aggregate_validation_stats(
    monkeypatch,
) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(
        service_module,
        "log_event",
        lambda _logger, event, **context: events.append((event, context)),
    )
    result = _provider_result(
        subtitles=(
            ModelArkSubtitleGroundingSegment(
                text="private subtitle",
                start_ms=1200,
                end_ms=2600,
                bbox="<bbox>120 820 880 920</bbox>",
            ),
            ModelArkSubtitleGroundingSegment(
                text="invalid\nprivate",
                start_ms=1200,
                end_ms=2600,
                bbox="<bbox>120 820 880 920</bbox>",
            ),
        )
    )
    service = VideoSubtitleGroundingService(
        preparer=FakePreparer(),
        provider=FakeProvider(result),
        settings=Settings(enable_experimental_video_subtitle_grounding=True),
        clock=lambda: 10.0,
    )

    response = asyncio.run(
        service.run(VideoSubtitleGroundingRequest(video_url=SECRET_URL))
    )

    assert len(response.subtitles) == 1
    assert response.subtitles[0].font_height_ratio == pytest.approx(0.1)
    completed = next(
        context for event, context in events if event.endswith(".completed")
    )
    assert completed["invalid_segment_count"] == 1
    assert completed["style_fallback_counts"] == {
        "alignment": 1,
        "background_color": 1,
        "block_id": 1,
        "font_height_ratio": 1,
        "line_index": 1,
        "visual_role": 1,
    }
    assert "private subtitle" not in str(events)
    assert RAW_OUTPUT not in str(events)


def test_extract_prepared_video_is_route_independent_and_borrows_path(
    tmp_path: Path, monkeypatch,
) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(
        service_module, "log_event",
        lambda _logger, event, **context: events.append((event, context)),
    )
    path = tmp_path / "prepared.mp4"
    path.write_bytes(b"video")
    prepared = PreparedRemoteVideo(
        path=path, mime_type="video/mp4", size_bytes=5, metadata=_metadata(),
    )
    preparer = FakePreparer(error=AssertionError("must not download"))
    provider = FakeProvider()
    service = VideoSubtitleGroundingService(
        preparer=preparer, provider=provider,
        settings=Settings(enable_experimental_video_subtitle_grounding=False),
    )

    response = asyncio.run(service.extract(prepared))

    assert provider.calls == [(path, 2.0)]
    assert preparer.open_calls == []
    assert path.exists()
    assert response.model == "doubao-seed-evolving"
    assert response.usage.total_tokens == 30
    assert response.subtitles[0].background_color is None
    assert response.subtitles[0].warnings == ["background_color_unavailable"]
    completed = next(context for event, context in events if event.endswith(".completed"))
    assert completed["style_fallback_counts"] == {"background_color": 1}
    assert RAW_OUTPUT not in str(events)
    assert "private subtitle" not in str(events)


@pytest.mark.parametrize("failure_kind", ["provider", "validation", "cancellation"])
def test_extract_prepared_video_preserves_safe_failures_and_file_ownership(
    tmp_path: Path, failure_kind: str,
) -> None:
    path = tmp_path / "prepared.mp4"
    path.write_bytes(b"video")
    prepared = PreparedRemoteVideo(
        path=path, mime_type="video/mp4", size_bytes=5, metadata=_metadata(),
    )
    if failure_kind == "provider":
        provider = FakeProvider(error=VideoSubtitleGroundingProviderError(
            "Provider request failed.",
            code=VideoSubtitleGroundingErrorCode.MODEL_REQUEST_FAILED,
            phase=VideoSubtitleGroundingErrorPhase.RESPONSES,
        ))
        expected = VideoSubtitleGroundingProviderError
    elif failure_kind == "cancellation":
        provider = FakeProvider(error=asyncio.CancelledError())
        expected = asyncio.CancelledError
    else:
        provider = FakeProvider(_provider_result(subtitles=(
            ModelArkSubtitleGroundingSegment(
                text="bad\nline", start_ms=0, end_ms=1,
                bbox="<bbox>100 800 900 840</bbox>",
            ),
        )))
        expected = service_module.VideoSubtitleGroundingValidationError
    service = VideoSubtitleGroundingService(
        preparer=FakePreparer(), provider=provider, settings=Settings(),
    )

    with pytest.raises(expected):
        asyncio.run(service.extract(prepared, sampling_fps=2.5))

    assert provider.calls == [(path, 2.5)]
    assert path.exists()


@pytest.mark.parametrize(
    "error",
    [
        RemoteVideoError(
            code=VideoSubtitleGroundingErrorCode.INVALID_VIDEO_URL,
            phase=VideoSubtitleGroundingErrorPhase.URL_VALIDATION,
            message="The video URL is invalid.",
        ),
        RemoteVideoError(
            code=VideoSubtitleGroundingErrorCode.VIDEO_DOWNLOAD_FAILED,
            phase=VideoSubtitleGroundingErrorPhase.DOWNLOAD,
            message="The video could not be downloaded.",
        ),
        RemoteVideoError(
            code=VideoSubtitleGroundingErrorCode.MEDIA_PROBE_FAILED,
            phase=VideoSubtitleGroundingErrorPhase.MEDIA_PROBE,
            message="The video metadata could not be inspected.",
        ),
        VideoSubtitleGroundingProviderError(
            "Provider upload failed.",
            code=VideoSubtitleGroundingErrorCode.MODEL_FILE_UPLOAD_FAILED,
            phase=VideoSubtitleGroundingErrorPhase.FILES_UPLOAD,
        ),
        VideoSubtitleGroundingProviderError(
            "Provider processing failed.",
            code=VideoSubtitleGroundingErrorCode.MODEL_FILE_PROCESSING_FAILED,
            phase=VideoSubtitleGroundingErrorPhase.FILES_PROCESSING,
        ),
        VideoSubtitleGroundingProviderError(
            "Provider request failed.",
            code=VideoSubtitleGroundingErrorCode.MODEL_REQUEST_FAILED,
            phase=VideoSubtitleGroundingErrorPhase.RESPONSES,
        ),
    ],
)
def test_service_preserves_stable_stage_failures_and_logs_safely(
    monkeypatch,
    error: RemoteVideoError | VideoSubtitleGroundingProviderError,
) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(
        service_module,
        "log_event",
        lambda _logger, event, **context: events.append((event, context)),
    )
    is_media_error = isinstance(error, RemoteVideoError)
    preparer = FakePreparer(error=error if is_media_error else None)
    provider = FakeProvider(error=error if not is_media_error else None)
    service = VideoSubtitleGroundingService(
        preparer=preparer,
        provider=provider,
        settings=Settings(enable_experimental_video_subtitle_grounding=True),
    )

    with pytest.raises(type(error)) as captured:
        asyncio.run(
            service.run(VideoSubtitleGroundingRequest(video_url=SECRET_URL))
        )

    assert captured.value.code == error.code
    assert captured.value.phase == error.phase
    failed = [context for event, context in events if event.endswith(".failed")]
    assert len(failed) == 1
    assert failed[0]["error_code"] == error.code.value
    assert failed[0]["error_stage"] == error.phase.value
    assert SECRET_URL not in str(events)
    assert "url-secret" not in str(events)
    assert preparer.cleaned is True


def test_service_cancellation_cleans_and_emits_canceled_event(monkeypatch) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(
        service_module,
        "log_event",
        lambda _logger, event, **context: events.append((event, context)),
    )
    preparer = FakePreparer(wait_forever=True)
    service = VideoSubtitleGroundingService(
        preparer=preparer,
        provider=FakeProvider(),
        settings=Settings(enable_experimental_video_subtitle_grounding=True),
    )

    async def run() -> None:
        task = asyncio.create_task(
            service.run(VideoSubtitleGroundingRequest(video_url=SECRET_URL))
        )
        await preparer.entered.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(run())

    assert preparer.cleaned is True
    assert any(
        event.endswith(".canceled") and context["outcome"] == "canceled"
        for event, context in events
    )
    assert SECRET_URL not in str(events)


def test_service_logs_cleanup_failure_without_failing_success(monkeypatch) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(
        service_module,
        "log_event",
        lambda _logger, event, **context: events.append((event, context)),
    )
    cleanup_error = VideoSubtitleGroundingProviderError(
        "Provider file cleanup failed.",
        code=VideoSubtitleGroundingErrorCode.CLEANUP_FAILED,
        phase=VideoSubtitleGroundingErrorPhase.CLEANUP,
        provider_code="DeleteSecretMustNotAppear",
    )
    result = _provider_result()
    object.__setattr__(result, "cleanup_error", cleanup_error)
    service = VideoSubtitleGroundingService(
        preparer=FakePreparer(),
        provider=FakeProvider(result),
        settings=Settings(enable_experimental_video_subtitle_grounding=True),
    )

    response = asyncio.run(
        service.run(VideoSubtitleGroundingRequest(video_url=SECRET_URL))
    )

    assert response.model == "doubao-seed-evolving"
    cleanup_events = [
        context for event, context in events if event.endswith(".cleanup_failed")
    ]
    assert len(cleanup_events) == 1
    assert cleanup_events[0]["error_code"] == "cleanup_failed"
    assert "Provider file cleanup failed" not in str(events)
    assert SECRET_URL not in str(events)


@pytest.mark.parametrize("debug_enabled", [False, True])
def test_invalid_output_raw_text_is_tls_only_and_explicit(
    monkeypatch,
    debug_enabled: bool,
) -> None:
    normal_events: list[tuple[str, dict[str, object]]] = []
    tls_events: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(
        service_module,
        "log_event",
        lambda _logger, event, **context: normal_events.append((event, context)),
    )
    monkeypatch.setattr(
        service_module,
        "emit_tls_only_event",
        lambda event, **context: tls_events.append((event, context)),
    )
    invalid = _provider_result(
        subtitles=(
            ModelArkSubtitleGroundingSegment(
                text="private subtitle",
                start_ms=1200,
                end_ms=2600,
                bbox="<bbox>900 820 100 920</bbox>",
            ),
        ),
    )
    service = VideoSubtitleGroundingService(
        preparer=FakePreparer(),
        provider=FakeProvider(invalid),
        settings=Settings(
            enable_experimental_video_subtitle_grounding=True,
            enable_experimental_video_subtitle_grounding_debug=debug_enabled,
        ),
    )

    with pytest.raises(Exception) as captured:
        asyncio.run(
            service.run(VideoSubtitleGroundingRequest(video_url=SECRET_URL))
        )

    assert captured.value.code == VideoSubtitleGroundingErrorCode.INVALID_MODEL_OUTPUT
    assert captured.value.phase == VideoSubtitleGroundingErrorPhase.RESPONSE_VALIDATION
    assert RAW_OUTPUT not in str(normal_events)
    assert "private subtitle" not in str(normal_events)
    if debug_enabled:
        assert tls_events[0][1]["output_text"] == RAW_OUTPUT
    else:
        assert tls_events == []


def _route_client(
    *,
    settings: Settings,
    service: object,
    role: UserRole | None,
) -> tuple[TestClient, InMemoryRepository]:
    repository = InMemoryRepository()
    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_video_subtitle_grounding_service] = lambda: service
    client = TestClient(app, headers={"Origin": "http://localhost:3000"})
    if role is not None:
        authenticate_test_client(client, repository, role=role)
    return client, repository


@pytest.mark.parametrize(
    ("role", "expected_status"),
    [
        (None, 401),
        (UserRole.VIEWER, 403),
        (UserRole.CREATOR, 403),
    ],
)
def test_route_requires_admin(role: UserRole | None, expected_status: int) -> None:
    service = SimpleNamespace(run=lambda _payload: None)
    client, _ = _route_client(
        settings=Settings(enable_experimental_video_subtitle_grounding=True),
        service=service,
        role=role,
    )

    response = client.post(
        "/api/experiments/video-subtitle-grounding",
        json={"video_url": SECRET_URL},
    )

    assert response.status_code == expected_status


def test_route_feature_switch_returns_404_without_calling_service() -> None:
    service = SimpleNamespace(run=lambda _payload: pytest.fail("service called"))
    client, _ = _route_client(
        settings=Settings(
            environment="production",
            cors_origins=["https://app.example.test"],
            site_origin="https://app.example.test",
            auth_cookie_secure=True,
            enable_experimental_video_subtitle_grounding=False,
        ),
        service=service,
        role=None,
    )

    response = client.post(
        "/api/experiments/video-subtitle-grounding",
        json={"video_url": SECRET_URL},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}
    assert SECRET_URL not in response.text


@pytest.mark.parametrize(
    ("code", "phase", "expected_status"),
    [
        (
            VideoSubtitleGroundingErrorCode.INVALID_VIDEO_URL,
            VideoSubtitleGroundingErrorPhase.URL_VALIDATION,
            422,
        ),
        (
            VideoSubtitleGroundingErrorCode.INVALID_VIDEO_INPUT,
            VideoSubtitleGroundingErrorPhase.DOWNLOAD,
            422,
        ),
        (
            VideoSubtitleGroundingErrorCode.VIDEO_DOWNLOAD_FAILED,
            VideoSubtitleGroundingErrorPhase.DOWNLOAD,
            502,
        ),
        (
            VideoSubtitleGroundingErrorCode.MEDIA_PROBE_FAILED,
            VideoSubtitleGroundingErrorPhase.MEDIA_PROBE,
            422,
        ),
        (
            VideoSubtitleGroundingErrorCode.MODEL_FILE_UPLOAD_FAILED,
            VideoSubtitleGroundingErrorPhase.FILES_UPLOAD,
            502,
        ),
        (
            VideoSubtitleGroundingErrorCode.MODEL_FILE_PROCESSING_FAILED,
            VideoSubtitleGroundingErrorPhase.FILES_PROCESSING,
            502,
        ),
        (
            VideoSubtitleGroundingErrorCode.MODEL_REQUEST_FAILED,
            VideoSubtitleGroundingErrorPhase.RESPONSES,
            502,
        ),
        (
            VideoSubtitleGroundingErrorCode.INVALID_MODEL_OUTPUT,
            VideoSubtitleGroundingErrorPhase.RESPONSE_VALIDATION,
            502,
        ),
    ],
)
def test_route_maps_stable_sanitized_errors(
    code: VideoSubtitleGroundingErrorCode,
    phase: VideoSubtitleGroundingErrorPhase,
    expected_status: int,
) -> None:
    class FailingService:
        async def run(self, _payload) -> None:
            raise VideoSubtitleGroundingProviderError(
                f"safe {code.value}",
                code=code,
                phase=phase,
            )

    client, repository = _route_client(
        settings=Settings(enable_experimental_video_subtitle_grounding=True),
        service=FailingService(),
        role=None,
    )
    authenticate_test_client(client, repository)

    response = client.post(
        "/api/experiments/video-subtitle-grounding",
        json={"video_url": SECRET_URL},
    )

    assert response.status_code == expected_status
    assert response.json()["detail"] == {
        "code": code.value,
        "phase": phase.value,
        "message": f"safe {code.value}",
    }
    assert SECRET_URL not in response.text
    assert "url-secret" not in response.text


def test_route_returns_success_without_real_provider_calls() -> None:
    class SuccessfulService:
        async def run(self, _payload):
            return VideoSubtitleGroundingResponse(
                model="doubao-seed-evolving",
                video=VideoSubtitleGroundingVideoMetadata(
                    width=1920,
                    height=1080,
                    duration_ms=30000,
                    rotation=0,
                ),
                subtitles=[],
                usage=VideoSubtitleGroundingUsage(
                    input_tokens=1,
                    output_tokens=2,
                    total_tokens=3,
                ),
                latency_ms=4,
            )

    client, repository = _route_client(
        settings=Settings(enable_experimental_video_subtitle_grounding=True),
        service=SuccessfulService(),
        role=None,
    )
    authenticate_test_client(client, repository)

    response = client.post(
        "/api/experiments/video-subtitle-grounding",
        json={"video_url": SECRET_URL},
    )

    assert response.status_code == 200
    assert response.json()["subtitles"] == []


@pytest.mark.parametrize(
    ("color", "expected_color"),
    [("#fAfAfA", "#FAFAFA"), (None, None), ({"invalid": True}, None)],
)
def test_route_serializes_color_fallback_without_failing_usable_subtitles(
    color: object, expected_color: str | None,
) -> None:
    result = _provider_result()
    result = replace(
        result,
        subtitles=(replace(result.subtitles[0], background_color=color),),
    )
    service = VideoSubtitleGroundingService(
        preparer=FakePreparer(), provider=FakeProvider(result), settings=Settings(),
    )
    client, _ = _route_client(
        settings=Settings(enable_experimental_video_subtitle_grounding=True),
        service=service, role=UserRole.ADMIN,
    )

    response = client.post(
        "/api/experiments/video-subtitle-grounding",
        json={"video_url": SECRET_URL},
    )

    assert response.status_code == 200
    subtitle = response.json()["subtitles"][0]
    assert subtitle["background_color"] == expected_color
    assert subtitle["warnings"] == (
        ["background_color_unavailable"] if expected_color is None else []
    )
    assert subtitle["block_id"] == "block_0"
    assert "url-secret" not in response.text
