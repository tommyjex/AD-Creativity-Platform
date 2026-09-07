from backend.app.api.dependencies import (
    discard_aigc_pipeline_runtime,
    get_aigc_pipeline_runtime,
    get_face_blur_video_client_factory,
    get_multitrack_client_factory,
    get_video_enhancement_client_factory,
)
from backend.app.core.config import Settings
from backend.app.repositories import InMemoryRepository
from backend.app.services.assets import AssetStorageService


def test_video_enhancement_client_factory_is_lazy() -> None:
    factory = get_video_enhancement_client_factory()

    assert callable(factory)


def test_face_blur_client_factory_is_lazy() -> None:
    factory = get_face_blur_video_client_factory()

    assert callable(factory)


def test_multitrack_client_factory_is_lazy() -> None:
    factory = get_multitrack_client_factory()

    assert callable(factory)


def test_runtime_dependency_wires_video_enhancement_settings() -> None:
    repository = InMemoryRepository()
    storage = AssetStorageService(bucket="test")
    client = object()
    settings = Settings(
        aigc_video_concurrency=2,
        aigc_video_enhancement_concurrency=3,
        aigc_video_face_blur_concurrency=4,
        aigc_multitrack_concurrency=5,
        mediakit_video_enhancement_poll_interval_seconds=7,
        mediakit_video_enhancement_timeout_seconds=2400,
        mediakit_video_enhancement_transfer_timeout_seconds=800,
        mediakit_video_enhancement_transfer_max_bytes=2_147_483_648,
        mediakit_face_blur_poll_interval_seconds=8,
        mediakit_face_blur_timeout_seconds=2500,
        mediakit_face_blur_transfer_timeout_seconds=900,
        mediakit_face_blur_transfer_max_bytes=2_147_483_647,
        mediakit_multitrack_poll_interval_seconds=9,
        mediakit_multitrack_timeout_seconds=2600,
    )
    configured_storage = AssetStorageService.from_settings(settings)
    face_blur_client = object()
    multitrack_client = object()

    runtime = get_aigc_pipeline_runtime(
        repository=repository,
        asset_storage=storage,
        generation=object(),  # type: ignore[arg-type]
        media_inspector=object(),  # type: ignore[arg-type]
        video_enhancement_client_factory=lambda: client,  # type: ignore[arg-type]
        face_blur_client_factory=lambda: face_blur_client,  # type: ignore[arg-type]
        multitrack_client_factory=lambda: multitrack_client,  # type: ignore[arg-type]
        settings=settings,
    )
    try:
        assert runtime._video_semaphore._value == 2
        assert runtime._video_enhancement_semaphore._value == 3
        assert runtime._video_face_blur_semaphore._value == 4
        assert runtime._multitrack_semaphore._value == 5
        assert runtime.gateway.video_enhancement_client_factory() is client
        assert runtime.gateway.face_blur_client_factory() is face_blur_client
        assert runtime.gateway.multitrack_client_factory() is multitrack_client
        assert runtime.gateway.video_enhancement_poll_interval_seconds == 7
        assert runtime.gateway.video_enhancement_timeout_seconds == 2400
        assert runtime.gateway.face_blur_poll_interval_seconds == 8
        assert runtime.gateway.face_blur_timeout_seconds == 2500
        assert runtime.gateway.multitrack_poll_interval_seconds == 9
        assert runtime.gateway.multitrack_timeout_seconds == 2600
        assert (
            configured_storage.video_enhancement_transfer_timeout_seconds
            == 800
        )
        assert (
            configured_storage.video_enhancement_transfer_max_bytes
            == 2_147_483_648
        )
        assert configured_storage.face_blur_transfer_timeout_seconds == 900
        assert (
            configured_storage.face_blur_transfer_max_bytes
            == 2_147_483_647
        )
    finally:
        discard_aigc_pipeline_runtime(repository)
