from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import inspect, text

from backend.app.core.config import Settings
from backend.app.api.dependencies import get_modelark_generation_service
from backend.app.db import create_database_engine, init_database
from backend.app.repositories import Repository
from backend.app.schemas import (
    AssetCreate,
    AssetCategory,
    AssetRole,
    AssetType,
    ImageBboxAnnotation,
    ImageGenerationOperation,
    ImageGenerationSize,
    ImageOutputFormat,
    ImagePointAnnotation,
    ImageToImageGenerationRequest,
    ProjectCreate,
    Stage,
    Status,
    TargetLanguage,
)
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.modelark import (
    BytePlusModelArkAdapter,
    MockModelArkAdapter,
    ProjectImageGenerationRequest,
)


def _image_project_payload() -> dict[str, object]:
    return {
        "name": "Product Hero",
        "project_type": "image_asset",
        "brief": {
            "prompt": "Create a premium product hero image.",
            "product_name": "AdPilot",
            "audience": "small business owners",
            "selling_points": ["fast iteration"],
            "target_platform": "tmall",
            "aspect_ratio": "1:1",
            "target_language": "zh",
            "image_purpose": "ecommerce_main",
        },
    }


def _create_project_and_prompt(
    client: TestClient,
    *,
    prompt: str = 'A clean centered product hero shot with "Fast iteration".',
) -> tuple[dict[str, object], dict[str, object]]:
    project_response = client.post("/api/projects", json=_image_project_payload())
    assert project_response.status_code == 201
    project = project_response.json()
    prompt_response = client.post(
        f"/api/projects/{project['id']}/image-prompt-versions",
        json={"prompt": prompt},
    )
    assert prompt_response.status_code == 201
    return project, prompt_response.json()


class _ImagesClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            data=[SimpleNamespace(url="https://model.example/generated.png")]
        )


class _ArkClient:
    def __init__(self) -> None:
        self.images = _ImagesClient()


def _settings() -> Settings:
    return Settings(
        ark_api_key="test-key",
        ark_image_model="doubao-seedream-5-0-pro-260628",
    )


@pytest.mark.parametrize(
    ("operation", "source_url", "reference_url"),
    [
        (ImageGenerationOperation.TEXT_TO_IMAGE, None, None),
        (
            ImageGenerationOperation.TEXT_TO_IMAGE,
            None,
            "https://assets.example.com/reference.png",
        ),
        (
            ImageGenerationOperation.IMAGE_TO_IMAGE,
            "https://assets.example.com/source.png",
            None,
        ),
    ],
)
def test_byteplus_project_image_request_uses_fixed_single_image_parameters(
    operation: ImageGenerationOperation,
    source_url: str | None,
    reference_url: str | None,
) -> None:
    client = _ArkClient()
    adapter = BytePlusModelArkAdapter(_settings(), client=client)
    request = ProjectImageGenerationRequest(
        project_id="project-1",
        model=_settings().ark_image_model,
        operation=operation,
        prompt="Generate a centered product image.",
        size=ImageGenerationSize.ONE_POINT_FIVE_K,
        output_format=ImageOutputFormat.JPEG,
        source_image_url=source_url,
        reference_image_url=reference_url,
    )

    result = asyncio.run(adapter.generate_project_image(request))

    call = client.images.calls[0]
    assert call == {
        "model": "doubao-seedream-5-0-pro-260628",
        "prompt": "Generate a centered product image.",
        "size": "1.5K",
        "output_format": "jpeg",
        "response_format": "url",
        "watermark": False,
        "stream": False,
        **(
            {"image": source_url or reference_url}
            if source_url or reference_url
            else {}
        ),
    }
    assert "sequential_image_generation" not in call
    assert result.mime_type == "image/jpeg"
    assert result.metadata["operation"] == operation.value


def test_mock_project_image_generation_is_deterministic() -> None:
    adapter = MockModelArkAdapter(_settings())
    request = ProjectImageGenerationRequest(
        project_id="project-1",
        model=_settings().ark_image_model,
        operation=ImageGenerationOperation.TEXT_TO_IMAGE,
        prompt="A normalized image prompt.",
    )

    first = asyncio.run(adapter.generate_project_image(request))
    second = asyncio.run(adapter.generate_project_image(request))

    assert first == second
    assert first.url.startswith("mock://modelark/project-1/project-images/")


@pytest.mark.parametrize(
    ("mime_type", "filename", "content"),
    [
        ("image/png", "reference.png", b"\x89PNG\r\n\x1a\nimage"),
        ("image/jpeg", "reference.jpg", b"\xff\xd8\xff\xe0image"),
        (
            "image/webp",
            "reference.webp",
            b"RIFF\x04\x00\x00\x00WEBPimage",
        ),
    ],
)
def test_image_reference_upload_accepts_supported_content_and_persists_tos_asset(
    client: TestClient,
    repository: Repository,
    test_asset_storage,
    mime_type: str,
    filename: str,
    content: bytes,
) -> None:
    project = client.post("/api/projects", json=_image_project_payload()).json()

    response = client.post(
        f"/api/projects/{project['id']}/image-references/upload",
        params={"filename": filename, "mime_type": mime_type},
        content=content,
        headers={"content-type": "application/octet-stream"},
    )

    assert response.status_code == 201
    asset = repository.get_asset(response.json()["id"])
    assert asset.project_id == project["id"]
    assert asset.type == AssetType.UPLOADED_IMAGE
    assert asset.category == AssetCategory.REFERENCE
    assert asset.asset_role == AssetRole.PUBLIC
    assert asset.status == Status.SUCCEEDED
    assert asset.mime_type == mime_type
    assert test_asset_storage.client.objects[asset.object_key] == content


@pytest.mark.parametrize(
    ("mime_type", "filename", "content"),
    [
        ("image/gif", "reference.gif", b"GIF89a"),
        ("image/png", "reference.png", b"not-a-png"),
        ("image/webp", "reference.webp", b"RIFFbad-data"),
        ("text/plain", "reference.txt", b"plain text"),
    ],
)
def test_image_reference_upload_rejects_invalid_type_or_content(
    client: TestClient,
    test_asset_storage,
    mime_type: str,
    filename: str,
    content: bytes,
) -> None:
    project = client.post("/api/projects", json=_image_project_payload()).json()

    response = client.post(
        f"/api/projects/{project['id']}/image-references/upload",
        params={"filename": filename, "mime_type": mime_type},
        content=content,
        headers={"content-type": "application/octet-stream"},
    )

    assert response.status_code == 422
    assert test_asset_storage.client.puts == []


def test_reference_guided_generation_freezes_snapshot_deduplicates_and_sets_metadata(
    client: TestClient,
    repository: Repository,
    background_task_runner,
) -> None:
    class CapturingAdapter(MockModelArkAdapter):
        def __init__(self) -> None:
            super().__init__(_settings())
            self.project_image_requests = []

        async def generate_project_image(self, request):
            self.project_image_requests.append(request)
            return await super().generate_project_image(request)

    adapter = CapturingAdapter()
    service = ModelArkGenerationService(adapter)
    client.app.dependency_overrides[get_modelark_generation_service] = lambda: service
    project, prompt_version = _create_project_and_prompt(client)
    uploaded = client.post(
        f"/api/projects/{project['id']}/image-references/upload",
        params={"filename": "reference.png", "mime_type": "image/png"},
        content=b"\x89PNG\r\n\x1a\nreference",
        headers={"content-type": "application/octet-stream"},
    ).json()
    url = f"/api/projects/{project['id']}/image-generations"
    payload = {
        "operation": "text_to_image",
        "reference_asset_id": uploaded["id"],
    }

    first = client.post(url, json=payload)
    duplicate = client.post(url, json=payload)

    assert first.status_code == 202
    assert duplicate.json()["id"] == first.json()["id"]
    frozen = first.json()["frozen_input"]
    stored_reference = repository.get_asset(uploaded["id"])
    assert frozen["reference_asset_id"] == stored_reference.id
    assert frozen["reference_object_key"] == stored_reference.object_key
    assert (
        frozen["reference_asset_created_at"]
        == stored_reference.created_at.isoformat()
    )
    assert frozen["prompt_version_id"] == prompt_version["id"]
    asyncio.run(background_task_runner.run_pending())

    request = adapter.project_image_requests[0]
    assert request.operation == ImageGenerationOperation.TEXT_TO_IMAGE
    assert request.source_image_url is None
    assert request.reference_image_url is not None
    assert "X-Tos-Signature=test" in request.reference_image_url
    asset = repository.get_asset(
        repository.get_task(first.json()["id"]).output_asset_ids[0]
    )
    assert asset.metadata["generation_mode"] == "reference_guided"
    assert asset.metadata["reference_asset_id"] == stored_reference.id
    assert asset.metadata["reference_image_count"] == 1


@pytest.mark.parametrize(
    ("case", "expected_status"),
    [
        ("cross_project", 404),
        ("internal", 409),
        ("stale", 409),
        ("non_image", 422),
    ],
)
def test_reference_guided_generation_rejects_invalid_assets(
    client: TestClient,
    repository: Repository,
    case: str,
    expected_status: int,
) -> None:
    project, _ = _create_project_and_prompt(client)
    other_project_id = str(project["id"])
    role = AssetRole.PUBLIC
    status_value = Status.SUCCEEDED
    asset_type = AssetType.UPLOADED_IMAGE
    mime_type = "image/png"
    if case == "cross_project":
        other = client.post("/api/projects", json=_image_project_payload()).json()
        other_project_id = str(other["id"])
    elif case == "internal":
        role = AssetRole.INTERNAL_BASE
    elif case == "stale":
        status_value = Status.STALE
    else:
        asset_type = AssetType.UPLOADED_VIDEO
        mime_type = "video/mp4"
    reference = repository.create_asset(
        AssetCreate(
            project_id=other_project_id,
            type=asset_type,
            category=AssetCategory.REFERENCE,
            asset_role=role,
            stage=Stage.IMAGE,
            status=status_value,
            object_key="projects/reference/input.bin",
            mime_type=mime_type,
        )
    )

    response = client.post(
        f"/api/projects/{project['id']}/image-generations",
        json={
            "operation": "text_to_image",
            "reference_asset_id": reference.id,
        },
    )

    assert response.status_code == expected_status


@pytest.mark.parametrize("client_fixture", ["client", "mysql_client"])
def test_image_generation_freezes_prompt_deduplicates_and_persists_asset(
    client_fixture: str,
    request: pytest.FixtureRequest,
    background_task_runner,
) -> None:
    client: TestClient = request.getfixturevalue(client_fixture)
    project, prompt_version = _create_project_and_prompt(client)
    url = f"/api/projects/{project['id']}/image-generations"

    first = client.post(url, json={"operation": "text_to_image"})
    duplicate = client.post(url, json={"operation": "text_to_image"})

    assert first.status_code == 202
    assert duplicate.status_code == 202
    assert duplicate.json()["id"] == first.json()["id"]
    frozen = first.json()["frozen_input"]
    assert frozen["prompt_version_id"] == prompt_version["id"]
    assert frozen["prompt"] == (
        'A clean centered product hero shot with "Fast iteration".'
    )
    assert '"Fast iteration"' in frozen["normalized_prompt"]
    assert frozen["size"] == "2K"
    assert frozen["format"] == "png"
    assert "画面比例严格使用 1:1" in frozen["normalized_prompt"]
    assert len(background_task_runner.coroutines) == 1

    newer = client.post(
        f"/api/projects/{project['id']}/image-prompt-versions",
        json={
            "prompt": (
                'A newer prompt with "Portable design" that must not affect '
                "the queued task."
            )
        },
    )
    assert newer.status_code == 201
    asyncio.run(background_task_runner.run_pending())

    task = client.get(f"/api/tasks/{first.json()['id']}").json()
    assert task["status"] == "succeeded"
    assets = client.get(f"/api/projects/{project['id']}/assets").json()
    assert len(assets) == 1
    asset = assets[0]
    assert asset["asset_role"] == "public"
    assert asset["type"] == "generated_image"
    assert asset["metadata"]["operation"] == "text_to_image"
    assert asset["metadata"]["generation_mode"] == "text_only"
    assert asset["metadata"]["reference_image_count"] == 0
    assert asset["metadata"]["prompt_version_id"] == prompt_version["id"]
    assert asset["metadata"]["prompt_summary"] == (
        'A clean centered product hero shot with "Fast iteration".'
    )
    assert asset["metadata"]["size"] == "2K"
    assert asset["metadata"]["format"] == "png"


def test_image_generation_accepts_legacy_prompt_without_visible_copy(
    client: TestClient,
    repository: Repository,
    monkeypatch: pytest.MonkeyPatch,
    background_task_runner,
) -> None:
    project, prompt_version = _create_project_and_prompt(client)
    original_get_prompt_version = repository.get_image_prompt_version

    def get_legacy_prompt_version(project_id: str, version_id: str):
        version = original_get_prompt_version(project_id, version_id)
        return version.model_copy(
            update={"prompt": "Legacy prompt without visible selling copy."}
        )

    monkeypatch.setattr(
        repository,
        "get_image_prompt_version",
        get_legacy_prompt_version,
    )

    response = client.post(
        f"/api/projects/{project['id']}/image-generations",
        json={
            "operation": "text_to_image",
            "prompt_version_id": prompt_version["id"],
        },
    )

    assert response.status_code == 202
    assert response.json()["frozen_input"]["prompt"] == (
        "Legacy prompt without visible selling copy."
    )
    assert len(repository.list_project_tasks(str(project["id"]))) == 1
    assert len(background_task_runner.coroutines) == 1


def test_image_to_image_freezes_source_and_uses_whole_image(
    client: TestClient,
    repository: Repository,
    background_task_runner,
) -> None:
    project, prompt_version = _create_project_and_prompt(client)
    source = repository.create_asset(
        AssetCreate(
            project_id=str(project["id"]),
            type=AssetType.UPLOADED_IMAGE,
            asset_role=AssetRole.PUBLIC,
            stage=Stage.IMAGE,
            status=Status.SUCCEEDED,
            object_key="projects/source/reference.png",
            url="https://assets.example.com/reference.png",
            mime_type="image/png",
        )
    )

    response = client.post(
        f"/api/projects/{project['id']}/image-generations",
        json={
            "operation": "image_to_image",
            "source_asset_id": source.id,
            "prompt": "Replace the background with a clean studio backdrop.",
            "size": "1K",
            "format": "jpeg",
        },
    )

    assert response.status_code == 202
    frozen = response.json()["frozen_input"]
    assert frozen["source_asset_id"] == source.id
    assert frozen["source_object_key"] == source.object_key
    assert frozen["prompt_version_id"] == prompt_version["id"]
    assert "<point>" not in frozen["normalized_prompt"]
    assert "<bbox>" not in frozen["normalized_prompt"]
    asyncio.run(background_task_runner.run_pending())
    asset = repository.get_asset(
        repository.get_task(response.json()["id"]).output_asset_ids[0]
    )
    assert asset.mime_type == "image/jpeg"
    assert asset.metadata["source_asset_id"] == source.id


@pytest.mark.parametrize(
    "prompt",
    [
        "Edit 图1<point>100 100</point>",
        "Edit </bbox>",
        "Edit < BBOX>100 100 200 200</BBOX>",
        "Edit <PoInT>100 100</pOiNt>",
    ],
)
def test_image_to_image_rejects_raw_coordinate_tags(
    client: TestClient,
    repository: Repository,
    prompt: str,
) -> None:
    project, _ = _create_project_and_prompt(client)
    source = repository.create_asset(
        AssetCreate(
            project_id=str(project["id"]),
            type=AssetType.UPLOADED_IMAGE,
            stage=Stage.IMAGE,
            status=Status.SUCCEEDED,
            object_key="projects/source/reference.png",
            mime_type="image/png",
        )
    )

    response = client.post(
        f"/api/projects/{project['id']}/image-generations",
        json={
            "operation": "image_to_image",
            "source_asset_id": source.id,
            "prompt": prompt,
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "annotation",
    [
        {"type": "point", "x": -1, "y": 0},
        {"type": "point", "x": 0, "y": 1000},
        {"type": "bbox", "x1": 10, "y1": 10, "x2": 10, "y2": 20},
        {"type": "bbox", "x1": 20, "y1": 10, "x2": 10, "y2": 20},
        {"type": "circle", "x": 10, "y": 20},
    ],
)
def test_image_edit_annotation_schema_rejects_invalid_coordinates(
    annotation: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        ImageToImageGenerationRequest.model_validate(
            {
                "annotation": annotation,
                "operation": "image_to_image",
                "prompt": "Edit the selected area.",
                "source_asset_id": "asset-1",
            }
        )


def test_image_edit_prompt_uses_language_specific_structured_labels() -> None:
    assert (
        ModelArkGenerationService.build_image_edit_prompt(
            "调整选中商品",
            annotation=ImagePointAnnotation(type="point", x=123, y=456),
            target_language=TargetLanguage.ZH,
        )
        == "调整选中商品\n\n图1<point>123 456</point>"
    )
    assert (
        ModelArkGenerationService.build_image_edit_prompt(
            "Replace the selected package.",
            annotation=ImageBboxAnnotation(
                type="bbox",
                x1=100,
                y1=200,
                x2=800,
                y2=900,
            ),
            target_language=TargetLanguage.EN,
        )
        == (
            "Replace the selected package.\n\n"
            "Image 1<bbox>100 200 800 900</bbox>"
        )
    )


def test_image_edit_freezes_annotation_final_prompt_and_asset_metadata(
    client: TestClient,
    repository: Repository,
    background_task_runner,
) -> None:
    project, _ = _create_project_and_prompt(client)
    source = repository.create_asset(
        AssetCreate(
            project_id=str(project["id"]),
            type=AssetType.UPLOADED_IMAGE,
            asset_role=AssetRole.PUBLIC,
            stage=Stage.IMAGE,
            status=Status.SUCCEEDED,
            object_key="projects/source/annotated.png",
            mime_type="image/png",
        )
    )
    annotation = {"type": "bbox", "x1": 100, "y1": 200, "x2": 800, "y2": 900}

    response = client.post(
        f"/api/projects/{project['id']}/image-generations",
        json={
            "annotation": annotation,
            "operation": "image_to_image",
            "prompt": "Replace the selected package.",
            "source_asset_id": source.id,
        },
    )

    assert response.status_code == 202
    frozen = response.json()["frozen_input"]
    assert frozen["annotation"] == annotation
    assert "图1<bbox>100 200 800 900</bbox>" in frozen["final_prompt"]
    assert frozen["final_prompt"] == frozen["normalized_prompt"]
    asyncio.run(background_task_runner.run_pending())
    task = repository.get_task(response.json()["id"])
    asset = repository.get_asset(task.output_asset_ids[0])
    assert asset.metadata["annotation"] == annotation
    assert asset.metadata["final_prompt"] == frozen["final_prompt"]


def test_failed_image_task_retry_copies_frozen_input_and_hash(
    client: TestClient,
    test_asset_storage,
    background_task_runner,
) -> None:
    project, original_prompt = _create_project_and_prompt(client)
    reference = client.post(
        f"/api/projects/{project['id']}/image-references/upload",
        params={"filename": "retry.png", "mime_type": "image/png"},
        content=b"\x89PNG\r\n\x1a\nretry-reference",
        headers={"content-type": "application/octet-stream"},
    ).json()
    test_asset_storage.client.fail_uploads = True
    submitted = client.post(
        f"/api/projects/{project['id']}/image-generations",
        json={
            "operation": "text_to_image",
            "reference_asset_id": reference["id"],
        },
    ).json()
    asyncio.run(background_task_runner.run_pending())
    failed = client.get(f"/api/tasks/{submitted['id']}").json()
    assert failed["status"] == "failed"

    client.post(
        f"/api/projects/{project['id']}/image-prompt-versions",
        json={"prompt": 'A new current prompt with "Work faster".'},
    )
    test_asset_storage.client.fail_uploads = False
    retried = client.post(f"/api/tasks/{submitted['id']}/retry")
    assert retried.status_code == 200
    retry = retried.json()
    assert retry["id"] != submitted["id"]
    assert retry["retry_of_task_id"] == submitted["id"]
    assert retry["input_hash"] == submitted["input_hash"]
    assert retry["frozen_input"] == submitted["frozen_input"]
    asyncio.run(background_task_runner.run_pending())

    completed = client.get(f"/api/tasks/{retry['id']}").json()
    asset = next(
        item
        for item in client.get(
            f"/api/projects/{project['id']}/assets"
        ).json()
        if item["type"] == "generated_image"
    )
    assert completed["status"] == "succeeded"
    assert asset["metadata"]["prompt_version_id"] == original_prompt["id"]
    assert asset["metadata"]["reference_asset_id"] == reference["id"]


def test_image_storage_rolls_back_object_when_database_write_fails(
    client: TestClient,
    repository,
    test_asset_storage,
    background_task_runner,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project, _ = _create_project_and_prompt(client)
    submitted = client.post(
        f"/api/projects/{project['id']}/image-generations",
        json={"operation": "text_to_image"},
    ).json()

    def fail_create_assets(_items):
        raise RuntimeError("database write failed")

    monkeypatch.setattr(repository, "create_assets", fail_create_assets)
    asyncio.run(background_task_runner.run_pending())

    task = repository.get_task(submitted["id"])
    assert task.status == Status.FAILED
    assert test_asset_storage.client.deletes == [
        test_asset_storage.client.puts[0]["key"]
    ]


def test_reference_upload_rolls_back_tos_when_database_write_fails(
    client: TestClient,
    repository: Repository,
    test_asset_storage,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = client.post("/api/projects", json=_image_project_payload()).json()

    def fail_create_asset(_item):
        raise RuntimeError("database write failed")

    monkeypatch.setattr(repository, "create_asset", fail_create_asset)
    response = client.post(
        f"/api/projects/{project['id']}/image-references/upload",
        params={"filename": "reference.png", "mime_type": "image/png"},
        content=b"\x89PNG\r\n\x1a\nreference",
        headers={"content-type": "application/octet-stream"},
    )

    assert response.status_code == 502
    assert len(test_asset_storage.client.puts) == 1
    assert test_asset_storage.client.deletes == [
        test_asset_storage.client.puts[0]["key"]
    ]


def test_reference_snapshot_change_after_submission_fails_frozen_task(
    client: TestClient,
    repository: Repository,
    background_task_runner,
) -> None:
    project, _ = _create_project_and_prompt(client)
    reference = repository.create_asset(
        AssetCreate(
            project_id=str(project["id"]),
            type=AssetType.UPLOADED_IMAGE,
            category=AssetCategory.REFERENCE,
            asset_role=AssetRole.PUBLIC,
            stage=Stage.IMAGE,
            status=Status.SUCCEEDED,
            object_key="projects/reference/original.png",
            mime_type="image/png",
        )
    )
    submitted = client.post(
        f"/api/projects/{project['id']}/image-generations",
        json={
            "operation": "text_to_image",
            "reference_asset_id": reference.id,
        },
    ).json()

    repository.update_asset(
        reference.id,
        object_key="projects/reference/replaced.png",
    )
    asyncio.run(background_task_runner.run_pending())

    task = repository.get_task(submitted["id"])
    assert task.status == Status.FAILED
    assert task.output_asset_ids == []


def test_brief_change_stales_only_prompt_derived_public_images_and_blocks_current(
    client: TestClient,
    repository: Repository,
    background_task_runner,
) -> None:
    project, _ = _create_project_and_prompt(client)
    submitted = client.post(
        f"/api/projects/{project['id']}/image-generations",
        json={"operation": "text_to_image"},
    ).json()
    asyncio.run(background_task_runner.run_pending())
    generated = repository.get_asset(
        repository.get_task(submitted["id"]).output_asset_ids[0]
    )
    reference = repository.create_asset(
        AssetCreate(
            project_id=str(project["id"]),
            type=AssetType.UPLOADED_IMAGE,
            asset_role=AssetRole.PUBLIC,
            stage=Stage.IMAGE,
            status=Status.SUCCEEDED,
            object_key="projects/reference.png",
            mime_type="image/png",
        )
    )
    selected = client.patch(
        f"/api/projects/{project['id']}/current-image",
        json={"asset_id": generated.id, "expected_image_revision": 0},
    )
    assert selected.status_code == 200
    assert selected.json()["image_revision"] == 1

    changed = client.patch(
        f"/api/projects/{project['id']}",
        json={"brief": {"style": "high contrast editorial"}},
    )
    assert changed.status_code == 200
    assert repository.get_asset(generated.id).status == Status.STALE
    assert repository.get_asset(reference.id).status == Status.SUCCEEDED

    rejected = client.patch(
        f"/api/projects/{project['id']}/current-image",
        json={"asset_id": generated.id, "expected_image_revision": 1},
    )
    assert rejected.status_code == 409


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_brief_stale_recurses_public_generated_descendants_only_and_handles_cycles(
    repository_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    repository: Repository = request.getfixturevalue(repository_fixture)
    project = repository.create_project(
        ProjectCreate.model_validate(_image_project_payload())
    )

    def create(
        asset_id: str,
        *,
        asset_type: AssetType = AssetType.GENERATED_IMAGE,
        role: AssetRole = AssetRole.PUBLIC,
        metadata: dict[str, object] | None = None,
    ):
        return repository.create_asset(
            AssetCreate(
                id=asset_id,
                project_id=project.id,
                type=asset_type,
                asset_role=role,
                stage=Stage.IMAGE,
                status=Status.SUCCEEDED,
                object_key=f"projects/{asset_id}.png",
                mime_type="image/png",
                metadata=metadata or {},
            )
        )

    root = create(
        "root",
        metadata={
            "prompt_version_id": "prompt-1",
            "source_asset_id": "composite",
        },
    )
    edited = create("edited", metadata={"source_asset_id": root.id})
    composite = create(
        "composite",
        metadata={"operation": "layer_composite", "source_asset_id": edited.id},
    )
    uploaded = create(
        "uploaded",
        asset_type=AssetType.UPLOADED_IMAGE,
        metadata={"source_asset_id": composite.id},
    )
    internal = create(
        "internal",
        role=AssetRole.INTERNAL_LAYER,
        metadata={"source_asset_id": composite.id},
    )
    unrelated = create("unrelated")
    cycle_a = create("cycle-a", metadata={"source_asset_id": "cycle-b"})
    cycle_b = create("cycle-b", metadata={"source_asset_id": cycle_a.id})

    repository.mark_image_prompt_stale(project.id)

    assert {
        repository.get_asset(asset_id).status
        for asset_id in (root.id, edited.id, composite.id)
    } == {Status.STALE}
    assert {
        repository.get_asset(asset_id).status
        for asset_id in (
            uploaded.id,
            internal.id,
            unrelated.id,
            cycle_a.id,
            cycle_b.id,
        )
    } == {Status.SUCCEEDED}


def test_set_current_image_uses_optimistic_revision(
    client: TestClient,
    repository: Repository,
) -> None:
    project, _ = _create_project_and_prompt(client)
    assets = [
        repository.create_asset(
            AssetCreate(
                project_id=str(project["id"]),
                type=AssetType.GENERATED_IMAGE,
                asset_role=AssetRole.PUBLIC,
                stage=Stage.IMAGE,
                status=Status.SUCCEEDED,
                object_key=f"projects/generated-{index}.png",
                mime_type="image/png",
                metadata={"prompt_version_id": f"prompt-{index}"},
            )
        )
        for index in range(2)
    ]

    first = client.patch(
        f"/api/projects/{project['id']}/current-image",
        json={"asset_id": assets[0].id, "expected_image_revision": 0},
    )
    stale_write = client.patch(
        f"/api/projects/{project['id']}/current-image",
        json={"asset_id": assets[1].id, "expected_image_revision": 0},
    )

    assert first.status_code == 200
    assert first.json()["current_image_asset_id"] == assets[0].id
    assert first.json()["image_revision"] == 1
    assert stale_write.status_code == 409


def test_asset_role_migration_backfills_public_and_is_idempotent(tmp_path) -> None:
    engine = create_database_engine(f"sqlite:///{tmp_path / 'legacy-assets.sqlite'}")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE projects (
                    id VARCHAR(36) PRIMARY KEY,
                    name VARCHAR(120) NOT NULL,
                    status VARCHAR(16) NOT NULL,
                    current_stage VARCHAR(16) NOT NULL,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE assets (
                    id VARCHAR(36) PRIMARY KEY,
                    project_id VARCHAR(36) NOT NULL,
                    type VARCHAR(32) NOT NULL,
                    status VARCHAR(16) NOT NULL,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO projects
                    (id, name, status, current_stage, created_at, updated_at)
                VALUES
                    ('legacy-project', 'Legacy', 'draft', 'brief',
                     '2026-08-01 00:00:00', '2026-08-01 00:00:00')
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO assets
                    (id, project_id, type, status, created_at, updated_at)
                VALUES
                    ('legacy-asset', 'legacy-project', 'uploaded_image',
                     'succeeded', '2026-08-01 00:00:00',
                     '2026-08-01 00:00:00')
                """
            )
        )

    init_database(engine)
    init_database(engine)

    asset_role = {
        column["name"]: column
        for column in inspect(engine).get_columns("assets")
    }["asset_role"]
    assert asset_role["nullable"] is False
    with engine.connect() as connection:
        assert connection.execute(
            text("SELECT asset_role FROM assets WHERE id = 'legacy-asset'")
        ).scalar_one() == "public"
    inspector = inspect(engine)
    assert {"image_layer_sets", "image_layers"} <= set(
        inspector.get_table_names()
    )
    assert {
        "id",
        "project_id",
        "source_asset_id",
        "base_asset_id",
        "canvas_width",
        "canvas_height",
        "status",
        "revision",
        "created_at",
        "updated_at",
    } <= {
        column["name"]
        for column in inspector.get_columns("image_layer_sets")
    }
