from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from backend.app.api.dependencies import (
    get_background_task_runner,
    get_asset_storage_service,
    get_composer_service,
    get_media_inspector_service,
    get_modelark_generation_service,
    get_repository,
    get_video_normalizer_service,
    get_workflow_service,
)
from backend.app.db import create_database_engine, init_database, make_session_factory
from backend.app.main import create_app
from backend.app.repositories import InMemoryRepository, MySQLRepository
from backend.app.services.assets import AssetStorageService, DownloadedAsset
from backend.app.services.background import BackgroundTaskRunner
from backend.app.services.composer import CompositionResult, CompositionSource
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.media_inspector import MediaInspection
from backend.app.services.workflow import WorkflowService
from backend.app.services.video_normalizer import NormalizedVideo


class FakeObjectStorageClient:
    def __init__(self) -> None:
        self.deletes: list[str] = []
        self.fail_uploads = False
        self.objects: dict[str, bytes] = {}
        self.puts: list[dict[str, object]] = []

    def put_object(
        self,
        *,
        key: str,
        content: bytes,
        content_type: str | None = None,
    ) -> None:
        if self.fail_uploads:
            raise RuntimeError("simulated TOS failure")
        self.puts.append(
            {
                "key": key,
                "content": content,
                "content_type": content_type,
            }
        )
        self.objects[key] = content

    def delete_object(self, *, key: str) -> None:
        self.deletes.append(key)
        self.objects.pop(key, None)

    def get_object(self, *, key: str) -> bytes:
        if key not in self.objects:
            raise FileNotFoundError(key)
        return self.objects[key]

    def signed_url(self, *, key: str, expires: int = 3600) -> str:
        return (
            f"https://local-assets.tos.local/{key}"
            f"?X-Tos-Expires={expires}&X-Tos-Signature=test"
        )


class FakeRemoteAssetDownloader:
    async def fetch(
        self,
        url: str,
        *,
        expected_mime_type: str | None = None,
    ) -> DownloadedAsset:
        mime_type = (
            expected_mime_type[:-1] + "png"
            if expected_mime_type and expected_mime_type.endswith("/*")
            else expected_mime_type
        )
        resolved_mime_type = mime_type or "image/png"
        signature = (
            b"\xff\xd8\xff\xe0"
            if resolved_mime_type == "image/jpeg"
            else b"\x89PNG\r\n\x1a\n"
        )
        return DownloadedAsset(
            content=signature + f"image-bytes:{url}".encode(),
            mime_type=resolved_mime_type,
        )


class CapturingBackgroundTaskRunner(BackgroundTaskRunner):
    def __init__(self) -> None:
        self.coroutines = []

    def schedule(self, coroutine) -> None:
        self.coroutines.append(coroutine)

    async def run_pending(self) -> None:
        while self.coroutines:
            coroutine = self.coroutines.pop(0)
            await coroutine


class FakeVideoComposer:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    async def compose(
        self,
        *,
        project_id: str,
        brief,
        sources: list[CompositionSource],
    ) -> CompositionResult:
        self.calls.append(
            {
                "project_id": project_id,
                "aspect_ratio": brief.aspect_ratio,
                "source_asset_ids": [source.asset_id for source in sources],
                "source_indexes": [source.index for source in sources],
            }
        )
        return CompositionResult(
            content=b"composed-final-video",
            mime_type="video/mp4",
            duration_seconds=None,
            metadata={
                "provider": "ffmpeg-composer",
                "compose_mode": "concat",
                "aspect_ratio": brief.aspect_ratio,
                "source_video_count": len(sources),
                "source_asset_ids": ",".join(source.asset_id for source in sources),
            },
        )

    async def burn_subtitles(
        self,
        *,
        base_video: bytes,
        srt_text: str,
        brief,
    ) -> CompositionResult:
        self.calls.append(
            {
                "subtitle_mode": "burned" if srt_text else "skipped",
                "srt_text": srt_text,
            }
        )
        return CompositionResult(
            content=(
                base_video + b"\nwith-subtitles"
                if srt_text
                else base_video
            ),
            mime_type="video/mp4",
            duration_seconds=None,
            metadata={
                "provider": "ffmpeg-composer",
                "subtitle_mode": "burned" if srt_text else "skipped",
                "aspect_ratio": brief.aspect_ratio,
            },
        )


class FakeVideoNormalizer:
    async def normalize_if_needed(self, content: bytes) -> NormalizedVideo:
        return NormalizedVideo(
            content=content,
            normalized=False,
            source_format="mov,mp4,m4a,3gp,3g2,mj2",
        )


class FakeMediaInspector:
    async def inspect(self, kind, content, *, filename, mime_type):
        if content.startswith(b"not-a-") or (
            kind.value == "audio" and (mime_type or "").startswith("video/")
        ):
            raise ValueError(f"unsupported {kind.value} content")
        if kind.value == "image":
            return MediaInspection(
                kind=kind,
                mime_type="image/png",
                container="png",
                width=1024,
                height=1024,
            )
        if kind.value == "video":
            return MediaInspection(
                kind=kind,
                mime_type=(
                    "video/quicktime"
                    if (filename or "").lower().endswith(".mov")
                    else "video/mp4"
                ),
                container=(
                    "mov"
                    if (filename or "").lower().endswith(".mov")
                    else "mp4"
                ),
                width=1280,
                height=720,
                duration_seconds=10,
                fps=30,
                video_codec="h264",
                audio_codec="aac",
            )
        return MediaInspection(
            kind=kind,
            mime_type="audio/mpeg",
            container="mp3",
            duration_seconds=10,
            audio_codec="mp3",
        )


@pytest.fixture
def repository() -> InMemoryRepository:
    return InMemoryRepository()


@pytest.fixture
def workflow(repository: InMemoryRepository) -> WorkflowService:
    return WorkflowService(repository)


@pytest.fixture
def mysql_session_factory(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'test-ad-creativity.sqlite'}"
    engine = create_database_engine(database_url)
    init_database(engine)
    return make_session_factory(engine)


@pytest.fixture
def mysql_repository(mysql_session_factory) -> MySQLRepository:
    return MySQLRepository(mysql_session_factory)


@pytest.fixture
def test_asset_storage() -> AssetStorageService:
    return AssetStorageService(
        bucket="local-assets",
        public_endpoint="https://local-assets.tos.local",
        client=FakeObjectStorageClient(),
        downloader=FakeRemoteAssetDownloader(),
    )


@pytest.fixture
def background_task_runner() -> CapturingBackgroundTaskRunner:
    return CapturingBackgroundTaskRunner()


@pytest.fixture
def video_composer() -> FakeVideoComposer:
    return FakeVideoComposer()


@pytest.fixture
def video_normalizer() -> FakeVideoNormalizer:
    return FakeVideoNormalizer()


@pytest.fixture
def media_inspector() -> FakeMediaInspector:
    return FakeMediaInspector()


@pytest.fixture
def client(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    background_task_runner: CapturingBackgroundTaskRunner,
    video_composer: FakeVideoComposer,
    video_normalizer: FakeVideoNormalizer,
    media_inspector: FakeMediaInspector,
) -> Iterator[TestClient]:
    app = create_app()

    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_asset_storage_service] = lambda: test_asset_storage
    app.dependency_overrides[get_workflow_service] = lambda: WorkflowService(
        repository,
        test_asset_storage,
    )
    app.dependency_overrides[get_modelark_generation_service] = (
        lambda: ModelArkGenerationService()
    )
    app.dependency_overrides[get_composer_service] = lambda: video_composer
    app.dependency_overrides[get_video_normalizer_service] = lambda: video_normalizer
    app.dependency_overrides[get_media_inspector_service] = lambda: media_inspector
    app.dependency_overrides[get_background_task_runner] = lambda: background_task_runner

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def mysql_client(
    mysql_repository: MySQLRepository,
    test_asset_storage: AssetStorageService,
    background_task_runner: CapturingBackgroundTaskRunner,
    video_composer: FakeVideoComposer,
    video_normalizer: FakeVideoNormalizer,
    media_inspector: FakeMediaInspector,
) -> Iterator[TestClient]:
    app = create_app()

    app.dependency_overrides[get_repository] = lambda: mysql_repository
    app.dependency_overrides[get_asset_storage_service] = lambda: test_asset_storage
    app.dependency_overrides[get_workflow_service] = lambda: WorkflowService(
        mysql_repository,
        test_asset_storage,
    )
    app.dependency_overrides[get_modelark_generation_service] = (
        lambda: ModelArkGenerationService()
    )
    app.dependency_overrides[get_composer_service] = lambda: video_composer
    app.dependency_overrides[get_video_normalizer_service] = lambda: video_normalizer
    app.dependency_overrides[get_media_inspector_service] = lambda: media_inspector
    app.dependency_overrides[get_background_task_runner] = lambda: background_task_runner

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def project_payload() -> dict[str, object]:
    return {
        "name": "Launch Campaign",
        "brief": {
            "prompt": "Create a conversion-focused short video ad.",
            "target_platform": "douyin",
            "aspect_ratio": "9:16",
            "duration_seconds": 30,
            "style": "documentary",
            "audience": "small business owners",
            "product_name": "AdPilot",
        },
    }
