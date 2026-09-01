import asyncio

import httpx
import pytest

from backend.app.api.dependencies import (
    get_face_blur_video_client_factory,
    get_modelark_generation_service,
)
from backend.app.schemas import (
    AssetCreate,
    AssetRole,
    AssetType,
    ReferenceAssetKind,
    Status,
    ToolAssetRole,
    ToolTaskCreate,
    ToolTaskInputAsset,
    ToolTaskType,
)
from backend.app.services.assets import StoredAssetInput
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.mediakit_face_blur import (
    FaceBlurTaskStatus,
    FaceBlurVideoTask,
)
from backend.app.services.modelark import (
    MockModelArkAdapter,
    ModelArkProviderError,
    VideoPromptOptimizationResult,
)


def _upload_tool_asset(client, repository, *, kind: str, filename: str, mime_type: str):
    response = client.post(
        "/api/tools/assets/upload",
        params={
            "kind": kind,
            "filename": filename,
            "mime_type": mime_type,
        },
        content=b"tool-media",
        headers={"content-type": "application/octet-stream"},
    )
    assert response.status_code == 201
    return response.json()


def _create_public_asset(
    repository,
    *,
    project_id: str,
    asset_type: AssetType,
    mime_type: str,
    object_key: str | None,
):
    return repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=asset_type,
            asset_role=AssetRole.PUBLIC,
            status=Status.SUCCEEDED,
            mime_type=mime_type,
            object_key=object_key,
        )
    )


class _FaceBlurClient:
    def __init__(self) -> None:
        self.submissions: list[dict[str, str]] = []
        self.states = [
            FaceBlurVideoTask("provider-face-1", FaceBlurTaskStatus.RUNNING),
            FaceBlurVideoTask(
                "provider-face-1",
                FaceBlurTaskStatus.SUCCEEDED,
                output_video_url="https://provider.example/face-blurred.mp4?secret=hidden",
                duration_seconds=8,
            ),
        ]

    async def submit(self, **kwargs) -> FaceBlurVideoTask:
        self.submissions.append(kwargs)
        return FaceBlurVideoTask(
            "provider-face-1", FaceBlurTaskStatus.QUEUED, request_id="request-face-1"
        )

    async def get_task(self, *, task_id: str) -> FaceBlurVideoTask:
        assert task_id == "provider-face-1"
        return self.states.pop(0)


@pytest.mark.parametrize(
    ("repository_fixture", "client_fixture"),
    [("repository", "client"), ("mysql_repository", "mysql_client")],
)
def test_delete_tool_task_preserves_assets_and_content(
    request,
    monkeypatch: pytest.MonkeyPatch,
    test_asset_storage,
    repository_fixture: str,
    client_fixture: str,
) -> None:
    repository = request.getfixturevalue(repository_fixture)
    client = request.getfixturevalue(client_fixture)
    input_asset = _upload_tool_asset(
        client,
        repository,
        kind="image",
        filename="reference.png",
        mime_type="image/png",
    )
    task_data = ToolTaskCreate(
        type=ToolTaskType.MULTIMODAL_VIDEO_GENERATION,
        input_snapshot={"prompt": "Keep this task's assets."},
    )
    task = repository.create_tool_task_with_input_assets(
        task_data,
        [
            ToolTaskInputAsset(
                task_id=task_data.id,
                asset_id=input_asset["id"],
                kind=ReferenceAssetKind.IMAGE,
            )
        ],
    )
    output = test_asset_storage.upload_asset(
        repository,
        StoredAssetInput(
            tool_task_id=task.id,
            tool_asset_role=ToolAssetRole.OUTPUT,
            type=AssetType.FINAL_VIDEO,
            status=Status.SUCCEEDED,
            mime_type="video/mp4",
            filename="generated.mp4",
            metadata={"operation": "multimodal_video_generation"},
        ),
        content=b"generated-video",
    )
    output_before_delete = repository.get_asset(output.id)
    retry = repository.create_tool_task(
        ToolTaskCreate(
            type=ToolTaskType.MULTIMODAL_VIDEO_GENERATION,
            retry_of_task_id=task.id,
        )
    )

    deleted = client.delete(f"/api/tools/tasks/{task.id}")

    assert deleted.status_code == 204
    assert client.get(f"/api/tools/tasks/{task.id}").status_code == 404
    assert task.id not in {item["id"] for item in client.get("/api/tools/tasks").json()}
    assert repository.get_asset(input_asset["id"]).id == input_asset["id"]
    preserved_output = repository.get_asset(output.id)
    assert preserved_output.tool_task_id is None
    assert preserved_output.tool_asset_role == ToolAssetRole.OUTPUT
    assert preserved_output.metadata == output_before_delete.metadata
    assert preserved_output.url == output_before_delete.url
    assert preserved_output.object_key == output_before_delete.object_key
    storage_client = test_asset_storage.client
    assert storage_client is not None
    assert getattr(storage_client, "deletes") == []
    assert getattr(storage_client, "get_object")(
        key=preserved_output.object_key
    ) == b"generated-video"
    assert client.get(f"/api/assets/{output.id}").status_code == 200

    original_async_client = httpx.AsyncClient
    monkeypatch.setattr(
        "backend.app.api.routes.httpx.AsyncClient",
        lambda **kwargs: original_async_client(
            transport=httpx.MockTransport(
                lambda _: httpx.Response(
                    status_code=200,
                    headers={"Content-Length": str(len(b"generated-video"))},
                    content=b"generated-video",
                )
            ),
            follow_redirects=kwargs.get("follow_redirects", False),
            timeout=kwargs.get("timeout"),
        ),
    )
    content = client.get(f"/api/assets/{output.id}/content")
    assert content.status_code == 200
    assert content.content == b"generated-video"
    assert repository.get_tool_task(retry.id).retry_of_task_id is None
    assert client.delete(f"/api/tools/tasks/{task.id}").status_code == 404


def test_face_blur_submission_polling_transfer_and_retry(client, repository) -> None:
    asset = _upload_tool_asset(
        client,
        repository,
        kind="video",
        filename="input.mp4",
        mime_type="video/mp4",
    )
    face_client = _FaceBlurClient()
    client.app.dependency_overrides[get_face_blur_video_client_factory] = lambda: (
        lambda: face_client
    )

    submitted = client.post(
        "/api/tools/face-blur-video",
        json={
            "video_asset_id": asset["id"],
            "mask_mode": "blur",
            "mask_strength": "high",
        },
    )

    assert submitted.status_code == 201
    task = submitted.json()
    assert task["status"] == "queued"
    assert task["provider_task_id"] == "provider-face-1"
    assert task["input_assets"] == [
        {
            "task_id": task["id"],
            "asset_id": asset["id"],
            "kind": "video",
            "created_at": task["input_assets"][0]["created_at"],
        }
    ]
    assert face_client.submissions[0]["mask_mode"] == "blur"
    assert face_client.submissions[0]["mask_strength"] == "high"
    assert "X-Tos-Signature" in face_client.submissions[0]["video_url"]

    running = client.get(f"/api/tools/tasks/{task['id']}")
    assert running.json()["status"] == "running"

    completed = client.get(f"/api/tools/tasks/{task['id']}")
    assert completed.json()["status"] == "succeeded"
    output = [
        item
        for item in repository.list_assets()
        if item.tool_task_id == task["id"] and item.tool_asset_role.value == "output"
    ]
    assert len(output) == 1
    assert output[0].metadata["operation"] == "face_blur_video"
    assert output[0].metadata["duration_seconds"] == 8

    failed = repository.update_tool_task(
        task["id"],
        status="failed",
    )
    retried = client.post(f"/api/tools/tasks/{failed.id}/retry")
    assert retried.status_code == 200
    assert retried.json()["retry_of_task_id"] == failed.id


def test_tool_video_generation_persists_output_and_rejects_non_whitelisted_model(
    client, repository, background_task_runner
) -> None:
    image = _upload_tool_asset(
        client,
        repository,
        kind="image",
        filename="reference.png",
        mime_type="image/png",
    )
    submitted = client.post(
        "/api/tools/videos",
        json={
            "model": "doubao-seedance-2-5-260628",
            "prompt": "A product rotates in warm studio light.",
            "duration_seconds": -1,
            "resolution": "720p",
            "aspect_ratio": "16:9",
            "reference_image_asset_ids": [image["id"]],
            "reference_video_asset_ids": [],
            "reference_audio_asset_ids": [],
        },
    )

    assert submitted.status_code == 201
    task = submitted.json()
    asyncio.run(background_task_runner.run_pending())
    completed = client.get(f"/api/tools/tasks/{task['id']}")
    assert completed.json()["status"] == "succeeded"
    output = next(
        item
        for item in repository.list_assets()
        if item.tool_task_id == task["id"] and item.tool_asset_role.value == "output"
    )
    assert output.metadata["model"] == "doubao-seedance-2-5-260628"
    assert output.metadata["duration_seconds"] == -1
    assert output.metadata["resolution"] == "720p"
    assert output.metadata["generate_audio"] is True
    assert output.metadata["reference_image_count"] == 1
    assert task["input_assets"][0]["asset_id"] == image["id"]
    assert task["input_snapshot"]["duration_seconds"] == -1
    assert task["input_snapshot"]["resolution"] == "720p"

    rejected = client.post(
        "/api/tools/videos",
        json={
            "model": "unapproved-model",
            "prompt": "Invalid request",
            "duration_seconds": 4,
            "resolution": "720p",
            "aspect_ratio": "16:9",
            "reference_image_asset_ids": [],
            "reference_video_asset_ids": [],
            "reference_audio_asset_ids": [],
        },
    )
    assert rejected.status_code == 422


def test_tool_video_generation_rejects_invalid_duration_values(
    client, repository
) -> None:
    base_payload = {
        "prompt": "A product rotates in warm studio light.",
        "resolution": "720p",
        "aspect_ratio": "16:9",
        "reference_image_asset_ids": [],
        "reference_video_asset_ids": [],
        "reference_audio_asset_ids": [],
    }

    for model, duration_seconds in (
        ("doubao-seedance-2-0-260128", 16),
        ("doubao-seedance-2-5-260628", 31),
        ("doubao-seedance-2-5-260628", -2),
        ("doubao-seedance-2-5-260628", 0),
        ("doubao-seedance-2-5-260628", 4.5),
    ):
        rejected = client.post(
            "/api/tools/videos",
            json={
                **base_payload,
                "model": model,
                "duration_seconds": duration_seconds,
            },
        )
        assert rejected.status_code == 422

    assert repository.list_tool_tasks() == []


def test_tool_video_uses_compatible_public_assets_for_all_reference_modalities(
    client,
    repository,
    background_task_runner,
    project_payload,
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    image = _create_public_asset(
        repository,
        project_id=project_id,
        asset_type=AssetType.UPLOADED_IMAGE,
        mime_type="image/png",
        object_key="projects/reference.png",
    )
    video = _create_public_asset(
        repository,
        project_id=project_id,
        asset_type=AssetType.UPLOADED_VIDEO,
        mime_type="video/mp4",
        object_key="projects/reference.mp4",
    )
    audio = _create_public_asset(
        repository,
        project_id=project_id,
        asset_type=AssetType.UPLOADED_AUDIO,
        mime_type="audio/mpeg",
        object_key="projects/reference.mp3",
    )
    inaccessible = _create_public_asset(
        repository,
        project_id=project_id,
        asset_type=AssetType.UPLOADED_IMAGE,
        mime_type="image/png",
        object_key=None,
    )
    tool_image = _upload_tool_asset(
        client,
        repository,
        kind="image",
        filename="tool-reference.png",
        mime_type="image/png",
    )
    tool_video = _upload_tool_asset(
        client,
        repository,
        kind="video",
        filename="tool-reference.mp4",
        mime_type="video/mp4",
    )
    tool_audio = _upload_tool_asset(
        client,
        repository,
        kind="audio",
        filename="tool-reference.mp3",
        mime_type="audio/mpeg",
    )

    assert [item["id"] for item in client.get("/api/tools/assets", params={"kind": "image"}).json()] == [tool_image["id"]]
    assert [item["id"] for item in client.get("/api/tools/assets", params={"kind": "video"}).json()] == [tool_video["id"]]
    assert [item["id"] for item in client.get("/api/tools/assets", params={"kind": "audio"}).json()] == [tool_audio["id"]]
    listed_asset_ids = {item["id"] for item in client.get("/api/tools/assets").json()}
    assert image.id not in listed_asset_ids
    assert video.id not in listed_asset_ids
    assert audio.id not in listed_asset_ids
    assert inaccessible.id not in listed_asset_ids

    submitted = client.post(
        "/api/tools/videos",
        json={
            "model": "doubao-seedance-2-5-260628",
            "prompt": "A product rotates in warm studio light.",
            "duration_seconds": 4,
            "resolution": "720p",
            "aspect_ratio": "16:9",
            "reference_image_asset_ids": [image.id],
            "reference_video_asset_ids": [video.id],
            "reference_audio_asset_ids": [audio.id],
        },
    )

    assert submitted.status_code == 201
    task = submitted.json()
    assert {(item["asset_id"], item["kind"]) for item in task["input_assets"]} == {
        (image.id, "image"),
        (video.id, "video"),
        (audio.id, "audio"),
    }
    asyncio.run(background_task_runner.run_pending())
    output = next(
        item
        for item in repository.list_assets()
        if item.tool_task_id == task["id"] and item.tool_asset_role.value == "output"
    )
    assert output.metadata["reference_image_count"] == 1
    assert output.metadata["reference_video_count"] == 1
    assert output.metadata["reference_audio_count"] == 1


def test_tool_video_rejects_reference_with_incompatible_mime_type(
    client,
    repository,
    project_payload,
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    invalid_image = _create_public_asset(
        repository,
        project_id=project_id,
        asset_type=AssetType.UPLOADED_IMAGE,
        mime_type="application/octet-stream",
        object_key="projects/not-an-image.bin",
    )

    listed = client.get("/api/tools/assets", params={"kind": "image"})
    assert invalid_image.id not in {item["id"] for item in listed.json()}

    rejected = client.post(
        "/api/tools/videos",
        json={
            "model": "doubao-seedance-2-5-260628",
            "prompt": "A product rotates in warm studio light.",
            "duration_seconds": 4,
            "resolution": "720p",
            "aspect_ratio": "16:9",
            "reference_image_asset_ids": [invalid_image.id],
            "reference_video_asset_ids": [],
            "reference_audio_asset_ids": [],
        },
    )

    assert rejected.status_code == 422


def test_failed_tool_video_is_retryable_without_leaking_provider_detail(
    client, repository, background_task_runner
) -> None:
    class _FailingAdapter(MockModelArkAdapter):
        async def generate_tool_video(self, request):
            raise ModelArkProviderError(
                "private provider error",
                phase="poll",
                provider_code="ProviderFailed",
                request_id="request-video-1",
                provider_task_id="provider-video-1",
            )

    client.app.dependency_overrides[get_modelark_generation_service] = lambda: (
        ModelArkGenerationService(_FailingAdapter())
    )
    submitted = client.post(
        "/api/tools/videos",
        json={
            "model": "doubao-seedance-2-0-mini-260615",
            "prompt": "A quiet product shot.",
            "duration_seconds": 4,
            "resolution": "720p",
            "aspect_ratio": "1:1",
            "reference_image_asset_ids": [],
            "reference_video_asset_ids": [],
            "reference_audio_asset_ids": [],
        },
    )
    task = submitted.json()
    asyncio.run(background_task_runner.run_pending())

    failed = client.get(f"/api/tools/tasks/{task['id']}").json()
    assert failed["status"] == "failed"
    assert failed["error"] == {
        "code": "external_service_error",
        "message": "视频生成失败",
        "provider_request_id": "request-video-1",
        "provider_task_id": "provider-video-1",
        "stage": "poll",
    }
    assert "private provider error" not in str(failed)

    retried = client.post(f"/api/tools/tasks/{task['id']}/retry")
    assert retried.status_code == 200
    assert retried.json()["retry_of_task_id"] == task["id"]


def test_tool_video_retry_reuses_public_reference_assets(
    client,
    repository,
    background_task_runner,
    project_payload,
) -> None:
    class _FailingAdapter(MockModelArkAdapter):
        async def generate_tool_video(self, request):
            raise ModelArkProviderError("provider failure", phase="poll")

    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    image = _create_public_asset(
        repository,
        project_id=project_id,
        asset_type=AssetType.UPLOADED_IMAGE,
        mime_type="image/png",
        object_key="projects/retry-image.png",
    )
    video = _create_public_asset(
        repository,
        project_id=project_id,
        asset_type=AssetType.UPLOADED_VIDEO,
        mime_type="video/mp4",
        object_key="projects/retry-video.mp4",
    )
    audio = _create_public_asset(
        repository,
        project_id=project_id,
        asset_type=AssetType.UPLOADED_AUDIO,
        mime_type="audio/mpeg",
        object_key="projects/retry-audio.mp3",
    )
    client.app.dependency_overrides[get_modelark_generation_service] = lambda: (
        ModelArkGenerationService(_FailingAdapter())
    )
    submitted = client.post(
        "/api/tools/videos",
        json={
            "model": "doubao-seedance-2-5-260628",
            "prompt": "A product rotates in warm studio light.",
            "duration_seconds": 4,
            "resolution": "720p",
            "aspect_ratio": "16:9",
            "reference_image_asset_ids": [image.id],
            "reference_video_asset_ids": [video.id],
            "reference_audio_asset_ids": [audio.id],
        },
    )
    assert submitted.status_code == 201
    task = submitted.json()
    asyncio.run(background_task_runner.run_pending())
    assert client.get(f"/api/tools/tasks/{task['id']}").json()["status"] == "failed"

    client.app.dependency_overrides[get_modelark_generation_service] = (
        lambda: ModelArkGenerationService()
    )
    retried = client.post(f"/api/tools/tasks/{task['id']}/retry")

    assert retried.status_code == 200
    retry = retried.json()
    assert retry["retry_of_task_id"] == task["id"]
    assert retry["input_snapshot"] == task["input_snapshot"]
    assert {(item["asset_id"], item["kind"]) for item in retry["input_assets"]} == {
        (image.id, "image"),
        (video.id, "video"),
        (audio.id, "audio"),
    }
    asyncio.run(background_task_runner.run_pending())
    assert client.get(f"/api/tools/tasks/{retry['id']}").json()["status"] == "succeeded"


def test_tool_video_retry_revalidates_duration_snapshot_before_creating_task(
    client, repository, background_task_runner
) -> None:
    submitted = client.post(
        "/api/tools/videos",
        json={
            "model": "doubao-seedance-2-0-mini-260615",
            "prompt": "A quiet product shot.",
            "duration_seconds": 15,
            "resolution": "720p",
            "aspect_ratio": "1:1",
            "reference_image_asset_ids": [],
            "reference_video_asset_ids": [],
            "reference_audio_asset_ids": [],
        },
    )
    assert submitted.status_code == 201
    task = submitted.json()
    asyncio.run(background_task_runner.run_pending())

    repository.update_tool_task(
        task["id"],
        status="failed",
        input_snapshot={**task["input_snapshot"], "duration_seconds": 16},
    )

    retried = client.post(f"/api/tools/tasks/{task['id']}/retry")

    assert retried.status_code == 409
    assert repository.list_tool_tasks() == [
        repository.get_tool_task(task["id"])
    ]


class _CapturingAdapter(MockModelArkAdapter):
    def __init__(self) -> None:
        super().__init__()
        self.tool_video_requests: list[object] = []

    async def generate_tool_video(self, request):
        self.tool_video_requests.append(request)
        return await super().generate_tool_video(request)


def _video_payload(**overrides):
    payload = {
        "model": "doubao-seedance-2-5-260628",
        "prompt": "A product rotates in warm studio light.",
        "duration_seconds": 4,
        "resolution": "720p",
        "aspect_ratio": "16:9",
        "reference_image_asset_ids": [],
        "reference_video_asset_ids": [],
        "reference_audio_asset_ids": [],
    }
    payload.update(overrides)
    return payload


@pytest.mark.parametrize(
    ("model", "resolution"),
    [
        ("doubao-seedance-2-5-260628", "480p"),
        ("doubao-seedance-2-5-260628", "1080p"),
        ("doubao-seedance-2-0-260128", "4k"),
        ("doubao-seedance-2-0-fast-260128", "480p"),
        ("doubao-seedance-2-0-fast-260128", "720p"),
        ("doubao-seedance-2-0-mini-260615", "480p"),
        ("doubao-seedance-2-0-mini-260615", "720p"),
    ],
)
def test_tool_video_route_accepts_model_resolutions(
    client, repository, background_task_runner, model, resolution
) -> None:
    submitted = client.post(
        "/api/tools/videos",
        json=_video_payload(model=model, resolution=resolution),
    )

    assert submitted.status_code == 201
    task = submitted.json()
    assert task["input_snapshot"]["resolution"] == resolution
    asyncio.run(background_task_runner.run_pending())
    output = next(
        item
        for item in repository.list_assets()
        if item.tool_task_id == task["id"] and item.tool_asset_role.value == "output"
    )
    assert output.metadata["resolution"] == resolution


@pytest.mark.parametrize(
    ("model", "resolution"),
    [
        ("doubao-seedance-2-5-260628", "4k"),
        ("doubao-seedance-2-0-fast-260128", "1080p"),
        ("doubao-seedance-2-0-fast-260128", "4k"),
        ("doubao-seedance-2-0-mini-260615", "1080p"),
        ("doubao-seedance-2-0-mini-260615", "4k"),
    ],
)
def test_tool_video_route_rejects_disallowed_resolutions(
    client, repository, model, resolution
) -> None:
    rejected = client.post(
        "/api/tools/videos",
        json=_video_payload(model=model, resolution=resolution),
    )

    assert rejected.status_code == 422
    assert repository.list_tool_tasks() == []


@pytest.mark.parametrize(
    "aspect_ratio",
    ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"],
)
def test_tool_video_route_accepts_supported_aspect_ratios(
    client, repository, background_task_runner, aspect_ratio
) -> None:
    submitted = client.post(
        "/api/tools/videos",
        json=_video_payload(aspect_ratio=aspect_ratio),
    )

    assert submitted.status_code == 201
    task = submitted.json()
    assert task["input_snapshot"]["aspect_ratio"] == aspect_ratio
    asyncio.run(background_task_runner.run_pending())
    output = next(
        item
        for item in repository.list_assets()
        if item.tool_task_id == task["id"] and item.tool_asset_role.value == "output"
    )
    assert output.metadata["aspect_ratio"] == aspect_ratio


@pytest.mark.parametrize("aspect_ratio", ["2:1", "foo", "1:2"])
def test_tool_video_route_rejects_unsupported_aspect_ratios(
    client, repository, aspect_ratio
) -> None:
    rejected = client.post(
        "/api/tools/videos",
        json=_video_payload(aspect_ratio=aspect_ratio),
    )

    assert rejected.status_code == 422
    assert repository.list_tool_tasks() == []


def test_tool_video_route_forwards_resolution_and_ratio_to_provider(
    client, repository, background_task_runner
) -> None:
    capturing = _CapturingAdapter()
    client.app.dependency_overrides[get_modelark_generation_service] = lambda: (
        ModelArkGenerationService(capturing)
    )

    submitted = client.post(
        "/api/tools/videos",
        json=_video_payload(
            model="doubao-seedance-2-0-260128",
            duration_seconds=10,
            resolution="4k",
            aspect_ratio="adaptive",
        ),
    )

    assert submitted.status_code == 201
    task = submitted.json()
    assert task["input_snapshot"]["resolution"] == "4k"
    assert task["input_snapshot"]["aspect_ratio"] == "adaptive"
    asyncio.run(background_task_runner.run_pending())

    assert len(capturing.tool_video_requests) == 1
    provider_request = capturing.tool_video_requests[0]
    assert provider_request.resolution == "4k"
    assert provider_request.aspect_ratio == "adaptive"

    output = next(
        item
        for item in repository.list_assets()
        if item.tool_task_id == task["id"] and item.tool_asset_role.value == "output"
    )
    assert output.metadata["resolution"] == "4k"
    assert output.metadata["aspect_ratio"] == "adaptive"


def test_tool_video_retry_reuses_snapshot_resolution_and_aspect_ratio(
    client, repository, background_task_runner
) -> None:
    class _FailingAdapter(MockModelArkAdapter):
        async def generate_tool_video(self, request):
            raise ModelArkProviderError("provider failure", phase="poll")

    client.app.dependency_overrides[get_modelark_generation_service] = lambda: (
        ModelArkGenerationService(_FailingAdapter())
    )
    submitted = client.post(
        "/api/tools/videos",
        json=_video_payload(
            model="doubao-seedance-2-5-260628",
            duration_seconds=-1,
            resolution="1080p",
            aspect_ratio="21:9",
        ),
    )
    assert submitted.status_code == 201
    task = submitted.json()
    asyncio.run(background_task_runner.run_pending())
    assert client.get(f"/api/tools/tasks/{task['id']}").json()["status"] == "failed"

    capturing = _CapturingAdapter()
    client.app.dependency_overrides[get_modelark_generation_service] = lambda: (
        ModelArkGenerationService(capturing)
    )
    retried = client.post(f"/api/tools/tasks/{task['id']}/retry")

    assert retried.status_code == 200
    retry = retried.json()
    assert retry["retry_of_task_id"] == task["id"]
    assert retry["input_snapshot"]["duration_seconds"] == -1
    assert retry["input_snapshot"]["resolution"] == "1080p"
    assert retry["input_snapshot"]["aspect_ratio"] == "21:9"
    assert retry["input_snapshot"] == task["input_snapshot"]

    asyncio.run(background_task_runner.run_pending())
    assert len(capturing.tool_video_requests) == 1
    provider_request = capturing.tool_video_requests[0]
    assert provider_request.duration_seconds == -1
    assert provider_request.resolution == "1080p"
    assert provider_request.aspect_ratio == "21:9"
    assert (
        client.get(f"/api/tools/tasks/{retry['id']}").json()["status"] == "succeeded"
    )


class _CapturingPromptOptimizeAdapter(MockModelArkAdapter):
    def __init__(self) -> None:
        super().__init__()
        self.optimize_requests: list[object] = []

    async def optimize_tool_video_prompt(self, request):
        self.optimize_requests.append(request)
        return await super().optimize_tool_video_prompt(request)


class _RejectingPromptOptimizeAdapter(MockModelArkAdapter):
    def __init__(self) -> None:
        super().__init__()
        self.called = False

    async def optimize_tool_video_prompt(self, request):
        self.called = True
        raise AssertionError("optimize_tool_video_prompt should not be called")


class _EmptyPromptOptimizeAdapter(MockModelArkAdapter):
    async def optimize_tool_video_prompt(self, request):
        return VideoPromptOptimizationResult(optimized_prompt="   ")


class _FailingPromptOptimizeAdapter(MockModelArkAdapter):
    async def optimize_tool_video_prompt(self, request):
        raise ModelArkProviderError(
            "private provider error",
            phase="text_generate",
            provider_code="ProviderFailure",
            request_id="request-optimize-1",
        )


def test_tool_video_optimize_prompt_returns_optimized_text_without_creating_task(
    client, repository
) -> None:
    capturing = _CapturingPromptOptimizeAdapter()
    client.app.dependency_overrides[get_modelark_generation_service] = lambda: (
        ModelArkGenerationService(capturing)
    )
    before = client.get("/api/tools/tasks").json()

    response = client.post(
        "/api/tools/videos/optimize-prompt",
        json={
            "prompt": "  让产品在暖光中缓慢旋转  ",
            "reference_image_count": 2,
            "reference_video_count": 1,
            "reference_audio_count": 0,
        },
    )

    assert response.status_code == 200
    optimized = response.json()["optimized_prompt"]
    assert isinstance(optimized, str)
    assert optimized.strip() != ""

    assert len(capturing.optimize_requests) == 1
    optimize_request = capturing.optimize_requests[0]
    assert optimize_request.prompt == "让产品在暖光中缓慢旋转"
    assert optimize_request.reference_image_count == 2
    assert optimize_request.reference_video_count == 1
    assert optimize_request.reference_audio_count == 0

    assert client.get("/api/tools/tasks").json() == before
    assert repository.list_tool_tasks() == []


def test_tool_video_optimize_prompt_rejects_blank_draft_without_calling_model(
    client, repository
) -> None:
    rejecting = _RejectingPromptOptimizeAdapter()
    client.app.dependency_overrides[get_modelark_generation_service] = lambda: (
        ModelArkGenerationService(rejecting)
    )

    response = client.post(
        "/api/tools/videos/optimize-prompt",
        json={"prompt": "   "},
    )

    assert response.status_code == 422
    assert rejecting.called is False
    assert repository.list_tool_tasks() == []


def test_tool_video_optimize_prompt_sanitizes_invalid_model_output(
    client, repository
) -> None:
    client.app.dependency_overrides[get_modelark_generation_service] = lambda: (
        ModelArkGenerationService(_EmptyPromptOptimizeAdapter())
    )

    response = client.post(
        "/api/tools/videos/optimize-prompt",
        json={"prompt": "让产品在暖光中缓慢旋转"},
    )

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "external_service_error"
    assert "tool video prompt optimization output failed validation" not in str(
        response.json()
    )
    assert repository.list_tool_tasks() == []


def test_tool_video_optimize_prompt_sanitizes_provider_failure(
    client, repository
) -> None:
    client.app.dependency_overrides[get_modelark_generation_service] = lambda: (
        ModelArkGenerationService(_FailingPromptOptimizeAdapter())
    )

    response = client.post(
        "/api/tools/videos/optimize-prompt",
        json={"prompt": "让产品在暖光中缓慢旋转"},
    )

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "external_service_error"
    assert "private provider error" not in str(response.json())
    assert repository.list_tool_tasks() == []
