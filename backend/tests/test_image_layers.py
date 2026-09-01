from __future__ import annotations

import asyncio
from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError
from sqlalchemy import select

from backend.app.api.dependencies import get_modelark_generation_service
from backend.app.core.config import Settings
from backend.app.db.models import AssetORM, ImageLayerSetORM
from backend.app.repositories import Repository, RevisionConflictError
from backend.app.schemas import (
    AssetCreate,
    AssetRole,
    AssetType,
    ImageLayerCreate,
    ImageLayerSet,
    ImageLayerSetCreate,
    ImageLayerUpdate,
    ProjectCreate,
    Stage,
    Status,
)
from backend.app.services.assets import DownloadedAsset
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.image_layers import (
    ImageLayerCompositionService,
    inspect_layer_image_content,
    normalize_layer_image_content,
)
from backend.app.services.modelark import (
    BytePlusModelArkAdapter,
    LayerDecompositionRequest,
    ModelArkProviderError,
)


def _image_project() -> ProjectCreate:
    return ProjectCreate.model_validate(
        {
            "name": "Layer project",
            "project_type": "image_asset",
            "brief": {
                "prompt": "Create a product image",
                "product_name": "Layer product",
                "audience": "designers",
                "selling_points": ["editable"],
                "target_platform": "tmall",
                "aspect_ratio": "1:1",
                "target_language": "zh",
                "image_purpose": "ecommerce_main",
            },
        }
    )


def _source_asset(repository: Repository, project_id: str):
    source = AssetCreate(
        project_id=project_id,
        type=AssetType.GENERATED_IMAGE,
        asset_role=AssetRole.PUBLIC,
        status=Status.SUCCEEDED,
        stage=Stage.IMAGE,
        object_key=f"projects/{project_id}/image/source.png",
        mime_type="image/png",
    )
    return repository.create_asset(source)


def _atomic_layer_input(project_id: str, source_id: str):
    layer_set = ImageLayerSetCreate(
        project_id=project_id,
        source_asset_id=source_id,
        base_asset_id="base",
        canvas_width=1024,
        canvas_height=1024,
    )
    base = AssetCreate(
        id="base",
        project_id=project_id,
        type=AssetType.GENERATED_IMAGE,
        asset_role=AssetRole.INTERNAL_BASE,
        status=Status.SUCCEEDED,
        stage=Stage.IMAGE,
        object_key="private/base.png",
        mime_type="image/png",
    )
    layer_assets = [
        AssetCreate(
            id=f"layer-asset-{index}",
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            asset_role=AssetRole.INTERNAL_LAYER,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
            object_key=f"private/layer-{index}.png",
            mime_type="image/png",
        )
        for index in (1, 2)
    ]
    layers = [
        ImageLayerCreate(
            id=f"layer-{index}",
            set_id=layer_set.id,
            asset_id=f"layer-asset-{index}",
            z_index=index,
            name=f"Layer {index}",
            description=f"Layer {index} description",
            bbox_absolute=(0, 0, 512, 512),
            bbox_normalized=(0, 0, 500, 500),
            x=0,
            y=0,
        )
        for index in (1, 2)
    ]
    return layer_set, [base, *layer_assets], layers


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_image_layer_repository_atomic_create_read_and_update(
    repository_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    repository: Repository = request.getfixturevalue(repository_fixture)
    project = repository.create_project(_image_project())
    source = _source_asset(repository, project.id)
    layer_set_data, assets, layers = _atomic_layer_input(project.id, source.id)

    created = repository.create_image_layer_set(
        layer_set_data,
        assets=assets,
        layers=layers,
    )

    assert repository.get_image_layer_set(project.id, created.id) == created
    assert repository.list_image_layer_sets(project.id) == [created]
    assert repository.list_assets(project_id=project.id) == [source]
    assert len(repository.list_assets(project_id=project.id, asset_role=None)) == 4

    updated = repository.update_image_layer_set(
        project.id,
        created.id,
        expected_revision=0,
        layers=[
            ImageLayerUpdate(
                id=created.layers[0].id,
                z_index=2,
                visible=False,
                x=12,
                y=34,
                scale=1.5,
            ),
            ImageLayerUpdate(
                id=created.layers[1].id,
                z_index=1,
                visible=True,
                x=56,
                y=78,
                scale=0.5,
            ),
        ],
    )
    assert updated.revision == 1
    assert [layer.z_index for layer in updated.layers] == [1, 2]
    assert next(layer for layer in updated.layers if not layer.visible).scale == 1.5
    with pytest.raises(RevisionConflictError):
        repository.update_image_layer_set(
            project.id,
            created.id,
            expected_revision=0,
            layers=[],
        )


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_image_layer_asset_replacement_preserves_old_asset_and_uses_revision(
    repository_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    repository: Repository = request.getfixturevalue(repository_fixture)
    project = repository.create_project(_image_project())
    source = _source_asset(repository, project.id)
    layer_set_data, assets, layers = _atomic_layer_input(project.id, source.id)
    created = repository.create_image_layer_set(
        layer_set_data, assets=assets, layers=layers
    )
    old_asset_id = created.layers[0].asset_id
    replacement = AssetCreate(
        project_id=project.id,
        type=AssetType.GENERATED_IMAGE,
        asset_role=AssetRole.INTERNAL_LAYER,
        status=Status.SUCCEEDED,
        stage=Stage.IMAGE,
        object_key="private/replacement.png",
        mime_type="image/png",
        metadata={"replaced_layer_asset_id": old_asset_id},
    )

    updated = repository.replace_image_layer_asset(
        project.id,
        created.id,
        expected_revision=created.revision,
        layer_id=created.layers[0].id,
        asset=replacement,
    )

    assert updated.revision == created.revision + 1
    assert updated.layers[0].asset_id == replacement.id
    assert repository.get_asset(old_asset_id).id == old_asset_id
    assert repository.get_asset(replacement.id).metadata["replaced_layer_asset_id"] == old_asset_id
    with pytest.raises(RevisionConflictError):
        repository.replace_image_layer_asset(
            project.id,
            created.id,
            expected_revision=created.revision,
            layer_id=created.layers[0].id,
            asset=replacement.model_copy(update={"id": "replacement-2"}),
        )


class _ImagesClient:
    def __init__(self, response: object) -> None:
        self.response = response
        self.calls: list[dict[str, object]] = []

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        return self.response


class _ArkClient:
    def __init__(self, response: object) -> None:
        self.images = _ImagesClient(response)


def _layer_response(*layers: dict[str, object]) -> SimpleNamespace:
    return SimpleNamespace(
        data=[
            SimpleNamespace(z_index=0, url="https://model.example/base.png"),
            *[SimpleNamespace(**layer) for layer in layers],
        ]
    )


def _valid_layer(index: int = 1) -> dict[str, object]:
    return {
        "z_index": index,
        "url": f"https://model.example/layer-{index}.png",
        "name": f"Layer {index}",
        "description": f"Layer {index} description",
        "bounding_box": {
            "absolute": [0, 0, 512, 512],
            "normalized": [0, 0, 500, 500],
        },
    }


def _adapter(response: object) -> tuple[BytePlusModelArkAdapter, _ArkClient]:
    client = _ArkClient(response)
    adapter = BytePlusModelArkAdapter(
        Settings(
            ark_api_key="test",
            ark_image_model="doubao-seedream-5-0-pro-260628",
        ),
        client=client,
    )
    return adapter, client


def _adapter_request(**changes: object) -> LayerDecompositionRequest:
    return LayerDecompositionRequest(
        project_id="project-1",
        model="doubao-seedream-5-0-pro-260628",
        image_url="https://assets.example/source.png",
        canvas_width=1024,
        canvas_height=1024,
        **changes,
    )


def test_modelark_layer_request_has_only_supported_parameters() -> None:
    adapter, client = _adapter(_layer_response(_valid_layer()))

    result = asyncio.run(
        adapter.decompose_image_layers(
            _adapter_request(
                prompt="拆分框选商品",
                size="1.5K",
                output_format="jpeg",
            )
        )
    )

    assert result.layers[0].z_index == 1
    assert client.images.calls == [
        {
            "model": "doubao-seedream-5-0-pro-260628",
            "image": "https://assets.example/source.png",
            "prompt": "拆分框选商品",
            "size": "1.5K",
            "output_format": "jpeg",
            "response_format": "url",
            "watermark": False,
            "extra_body": {"layer_decomposition": True},
        }
    ]
    call = client.images.calls[0]
    assert not {
        "stream",
        "tools",
        "sequential_image_generation",
        "sequential_image_generation_options",
    } & call.keys()


def test_modelark_layer_request_omits_optional_prompt_and_accepts_16_layers() -> None:
    adapter, client = _adapter(
        _layer_response(*[_valid_layer(index) for index in range(1, 17)])
    )
    result = asyncio.run(adapter.decompose_image_layers(_adapter_request()))
    assert len(result.layers) == 16
    assert client.images.calls[0]["prompt"] is None


@pytest.mark.parametrize(
    "response",
    [
        SimpleNamespace(data=[]),
        SimpleNamespace(
            data=[
                SimpleNamespace(z_index=0, url="base-1"),
                SimpleNamespace(z_index=0, url="base-2"),
                SimpleNamespace(**_valid_layer()),
            ]
        ),
        _layer_response(),
        _layer_response(_valid_layer(1), _valid_layer(1)),
        _layer_response(_valid_layer(2)),
        _layer_response(_valid_layer(2), _valid_layer(1)),
        SimpleNamespace(
            data=[
                SimpleNamespace(**_valid_layer()),
                SimpleNamespace(
                    z_index=0,
                    url="https://model.example/base.png",
                ),
            ]
        ),
        _layer_response(
            *[_valid_layer(index) for index in range(1, 18)]
        ),
        _layer_response({**_valid_layer(), "name": None}),
        _layer_response({**_valid_layer(), "description": None}),
        _layer_response({**_valid_layer(), "url": None}),
        _layer_response(
            {
                **_valid_layer(),
                "bounding_box": {
                    "absolute": [0, 0, 512],
                    "normalized": [0, 0, 500, 500],
                },
            }
        ),
        _layer_response(
            {
                **_valid_layer(),
                "bounding_box": {
                    "absolute": [512, 0, 1, 512],
                    "normalized": [0, 0, 500, 500],
                },
            }
        ),
        _layer_response(
            {
                **_valid_layer(),
                "bounding_box": {
                    "absolute": [0, 0, 1025, 512],
                    "normalized": [0, 0, 500, 500],
                },
            }
        ),
        _layer_response(
            {
                **_valid_layer(),
                "bounding_box": {
                    "absolute": [0, 0, 512, 512],
                    "normalized": [0, 0, 1001, 500],
                },
            }
        ),
        _layer_response(
            {
                **_valid_layer(),
                "bounding_box": {
                    "absolute": [0, 0, 512.0, 512],
                    "normalized": [0, 0, 500, 500],
                },
            }
        ),
    ],
)
def test_modelark_rejects_malformed_layer_responses(response: object) -> None:
    adapter, _ = _adapter(response)
    with pytest.raises(ModelArkProviderError):
        asyncio.run(adapter.decompose_image_layers(_adapter_request()))


def _png(width: int, height: int, *, transparent: bool = False) -> bytes:
    color_type = 6 if transparent else 2
    ihdr = (
        width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
        + bytes([8, color_type, 0, 0, 0])
    )
    return (
        b"\x89PNG\r\n\x1a\n"
        + (13).to_bytes(4, "big")
        + b"IHDR"
        + ihdr
        + b"\x00\x00\x00\x00"
        + b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.parametrize(
    "downloaded",
    [
        DownloadedAsset(_png(511, 512), "image/png"),
        DownloadedAsset(_png(6001, 6000), "image/png"),
        DownloadedAsset(_png(8192, 256), "image/png"),
        DownloadedAsset(b"not-an-image", "image/png"),
        DownloadedAsset(_png(512, 512), "image/gif"),
        DownloadedAsset(_png(512, 512) + b"x" * (30 * 1024 * 1024), "image/png"),
    ],
)
def test_layer_input_content_limits(downloaded: DownloadedAsset) -> None:
    with pytest.raises(ValueError):
        inspect_layer_image_content(downloaded, enforce_input_limits=True)


@pytest.mark.parametrize(
    ("absolute", "normalized"),
    [
        ((0, 0, 0, 10), (0, 0, 10, 10)),
        ((-1, 0, 10, 10), (0, 0, 10, 10)),
        ((0, 0, 1025, 10), (0, 0, 10, 10)),
        ((0, 0, 10, 10), (0, 0, 1001, 10)),
        ((0, 0, 10.0, 10), (0, 0, 10, 10)),
    ],
)
def test_image_layer_schema_rejects_invalid_bboxes(
    absolute: tuple[object, object, object, object],
    normalized: tuple[object, object, object, object],
) -> None:
    with pytest.raises(ValidationError):
        ImageLayerSetCreate(
            project_id="project",
            source_asset_id="source",
            base_asset_id="base",
            canvas_width=1024,
            canvas_height=1024,
        )
        layer = ImageLayerCreate(
            set_id="set",
            asset_id="asset",
            z_index=1,
            name="Layer",
            description="Description",
            bbox_absolute=absolute,
            bbox_normalized=normalized,
            x=0,
            y=0,
        )
        # Aggregate validation catches absolute right/bottom overflow.
        from backend.app.schemas import ImageLayerSet

        ImageLayerSet(
            id="set",
            project_id="project",
            source_asset_id="source",
            base_asset_id="base",
            canvas_width=1024,
            canvas_height=1024,
            layers=[layer],
        )


class _LayerDownloader:
    def __init__(self) -> None:
        self.fail_source = False

    async def fetch(
        self,
        url: str,
        *,
        expected_mime_type: str | None = None,
    ) -> DownloadedAsset:
        if "source.png" in url:
            if self.fail_source:
                return DownloadedAsset(_png(256, 256), "image/png")
            return DownloadedAsset(_png(1024, 1024), "image/png")
        if "/base." in url:
            return DownloadedAsset(_png(1024, 1024), "image/png")
        return DownloadedAsset(_png(1024, 1024, transparent=True), "image/png")


def _create_api_source(
    client: TestClient,
    repository: Repository,
    *,
    asset_type: AssetType = AssetType.GENERATED_IMAGE,
) -> tuple[str, str]:
    project = client.post(
        "/api/projects",
        json=_image_project().model_dump(mode="json"),
    ).json()
    source = repository.create_asset(
        AssetCreate(
            project_id=project["id"],
            type=asset_type,
            asset_role=AssetRole.PUBLIC,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
            object_key=f"projects/{project['id']}/image/source.png",
            mime_type="image/png",
        )
    )
    return project["id"], source.id


@pytest.mark.parametrize("client_fixture", ["client", "mysql_client"])
def test_layer_task_deduplicates_persists_and_isolates_internal_assets(
    client_fixture: str,
    request: pytest.FixtureRequest,
    repository: Repository,
    mysql_repository,
    test_asset_storage,
    background_task_runner,
) -> None:
    client: TestClient = request.getfixturevalue(client_fixture)
    active_repository = (
        mysql_repository if client_fixture == "mysql_client" else repository
    )
    test_asset_storage.downloader = _LayerDownloader()
    project_id, source_id = _create_api_source(client, active_repository)
    url = f"/api/projects/{project_id}/image-layer-sets"
    payload = {
        "source_asset_id": source_id,
        "prompt": "拆分商品",
        "bbox": {"type": "bbox", "x1": 0, "y1": 0, "x2": 999, "y2": 999},
        "size": "auto",
        "format": "png",
    }

    first = client.post(url, json=payload)
    duplicate = client.post(url, json=payload)
    assert first.status_code == 202
    assert duplicate.json()["id"] == first.json()["id"]
    assert first.json()["frozen_input"]["final_prompt"].endswith(
        "图1<bbox>0 0 999 999</bbox>"
    )
    assert len(background_task_runner.coroutines) == 1

    asyncio.run(background_task_runner.run_pending())
    task = client.get(f"/api/tasks/{first.json()['id']}").json()
    assert task["status"] == "succeeded"
    detail = client.get(url).json()[0]
    assert detail["canvas_width"] == 1024
    assert detail["base_asset"]["asset_role"] == "internal_base"
    assert "X-Tos-Signature=test" in detail["base_asset"]["url"]
    assert detail["layers_assets"][0]["asset_role"] == "internal_layer"

    layer = detail["layers"][0]
    update_payload = {
        "expected_revision": detail["revision"],
        "layers": [
            {
                "id": layer["id"],
                "z_index": 1,
                "visible": False,
                "x": 24.5,
                "y": 48.25,
                "scale": 1.75,
            }
        ],
    }
    updated = client.patch(f"{url}/{detail['id']}", json=update_payload)
    assert updated.status_code == 200
    assert updated.json()["revision"] == detail["revision"] + 1
    assert updated.json()["layers"][0] == {
        **layer,
        "visible": False,
        "x": 24.5,
        "y": 48.25,
        "scale": 1.75,
    }
    assert client.patch(f"{url}/{detail['id']}", json=update_payload).status_code == 409

    public_assets = client.get(f"/api/projects/{project_id}/assets").json()
    assert [asset["id"] for asset in public_assets] == [source_id]
    for internal_id in task["output_asset_ids"]:
        assert client.get(f"/api/assets/{internal_id}").status_code == 404
        assert client.get(f"/api/assets/{internal_id}/content").status_code == 404


def test_layer_task_rolls_back_tos_when_database_write_fails(
    client: TestClient,
    repository: Repository,
    test_asset_storage,
    background_task_runner,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    test_asset_storage.downloader = _LayerDownloader()
    project_id, source_id = _create_api_source(client, repository)
    submitted = client.post(
        f"/api/projects/{project_id}/image-layer-sets",
        json={"source_asset_id": source_id},
    ).json()

    monkeypatch.setattr(
        repository,
        "create_image_layer_set",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            RuntimeError("database failure")
        ),
    )
    asyncio.run(background_task_runner.run_pending())

    assert repository.get_task(submitted["id"]).status == Status.FAILED
    assert test_asset_storage.client.deletes == [
        item["key"] for item in reversed(test_asset_storage.client.puts)
    ]
    assert repository.list_image_layer_sets(project_id) == []


def test_layer_task_rolls_back_partial_tos_upload(
    client: TestClient,
    repository: Repository,
    test_asset_storage,
    background_task_runner,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    test_asset_storage.downloader = _LayerDownloader()
    project_id, source_id = _create_api_source(client, repository)
    submitted = client.post(
        f"/api/projects/{project_id}/image-layer-sets",
        json={"source_asset_id": source_id},
    ).json()
    original_put = test_asset_storage.client.put_object
    upload_count = 0

    def fail_second_upload(**kwargs):
        nonlocal upload_count
        upload_count += 1
        if upload_count == 2:
            raise RuntimeError("simulated partial TOS failure")
        original_put(**kwargs)

    monkeypatch.setattr(test_asset_storage.client, "put_object", fail_second_upload)
    asyncio.run(background_task_runner.run_pending())

    assert repository.get_task(submitted["id"]).status == Status.FAILED
    assert test_asset_storage.client.deletes == [
        test_asset_storage.client.puts[0]["key"]
    ]
    assert repository.list_image_layer_sets(project_id) == []


def test_layer_task_retry_reuses_frozen_input(
    client: TestClient,
    repository: Repository,
    test_asset_storage,
    background_task_runner,
) -> None:
    downloader = _LayerDownloader()
    downloader.fail_source = True
    test_asset_storage.downloader = downloader
    project_id, source_id = _create_api_source(client, repository)
    submitted = client.post(
        f"/api/projects/{project_id}/image-layer-sets",
        json={"source_asset_id": source_id, "prompt": "拆分商品"},
    ).json()
    asyncio.run(background_task_runner.run_pending())
    assert repository.get_task(submitted["id"]).status == Status.FAILED

    downloader.fail_source = False
    retried = client.post(f"/api/tasks/{submitted['id']}/retry")
    assert retried.status_code == 200
    retry = retried.json()
    assert retry["retry_of_task_id"] == submitted["id"]
    assert retry["input_hash"] == submitted["input_hash"]
    assert retry["frozen_input"] == submitted["frozen_input"]
    asyncio.run(background_task_runner.run_pending())
    assert repository.get_task(retry["id"]).status == Status.SUCCEEDED


@pytest.mark.parametrize(
    ("role", "asset_type", "asset_status"),
    [
        (AssetRole.INTERNAL_LAYER, AssetType.GENERATED_IMAGE, Status.SUCCEEDED),
        (AssetRole.PUBLIC, AssetType.GENERATED_IMAGE, Status.STALE),
        (AssetRole.PUBLIC, AssetType.GENERATED_IMAGE, Status.FAILED),
    ],
)
def test_layer_api_rejects_ineligible_sources(
    client: TestClient,
    repository: Repository,
    role: AssetRole,
    asset_type: AssetType,
    asset_status: Status,
) -> None:
    project = client.post(
        "/api/projects",
        json=_image_project().model_dump(mode="json"),
    ).json()
    source = repository.create_asset(
        AssetCreate(
            project_id=project["id"],
            type=asset_type,
            asset_role=role,
            status=asset_status,
            stage=Stage.IMAGE,
            object_key="projects/source.png",
            mime_type="image/png",
        )
    )
    response = client.post(
        f"/api/projects/{project['id']}/image-layer-sets",
        json={"source_asset_id": source.id},
    )
    assert response.status_code == 409


def test_layer_api_accepts_uploaded_public_image_source(
    client: TestClient,
    repository: Repository,
    test_asset_storage,
    background_task_runner,
) -> None:
    test_asset_storage.downloader = _LayerDownloader()
    project_id, source_id = _create_api_source(
        client,
        repository,
        asset_type=AssetType.UPLOADED_IMAGE,
    )

    submitted = client.post(
        f"/api/projects/{project_id}/image-layer-sets",
        json={"source_asset_id": source_id},
    )

    assert submitted.status_code == 202
    asyncio.run(background_task_runner.run_pending())
    task = repository.get_task(submitted.json()["id"])
    assert task.status == Status.SUCCEEDED
    sets = repository.list_image_layer_sets(project_id)
    assert sets[0].source_asset_id == source_id


def _real_png(
    size: tuple[int, int],
    color: tuple[int, int, int, int],
) -> bytes:
    output = BytesIO()
    Image.new("RGBA", size, color).save(output, format="PNG")
    return output.getvalue()


def test_layer_image_normalization_resizes_transparent_png_to_bbox() -> None:
    normalized = normalize_layer_image_content(
        DownloadedAsset(
            _real_png((12, 8), (255, 0, 0, 128)),
            "image/png",
        ),
        target_width=6,
        target_height=4,
    )

    info = inspect_layer_image_content(normalized, require_transparency=True)
    assert (info.width, info.height) == (6, 4)


def _composition_set(*layers: ImageLayerCreate) -> ImageLayerSet:
    return ImageLayerSet(
        id="composition-set",
        project_id="project-1",
        source_asset_id="source-1",
        base_asset_id="base-1",
        canvas_width=4,
        canvas_height=4,
        layers=[layer.model_dump() for layer in layers],
    )


def test_image_layer_composition_pixels_cover_alpha_visibility_scale_z_and_clip() -> None:
    layer_set = _composition_set(
        ImageLayerCreate(
            id="green",
            set_id="composition-set",
            asset_id="green-asset",
            z_index=1,
            name="Green",
            description="Green square",
            bbox_absolute=(0, 0, 2, 2),
            bbox_normalized=(0, 0, 500, 500),
            x=0,
            y=0,
            scale=1,
        ),
        ImageLayerCreate(
            id="red",
            set_id="composition-set",
            asset_id="red-asset",
            z_index=2,
            name="Red",
            description="Red overlay",
            bbox_absolute=(0, 0, 2, 2),
            bbox_normalized=(0, 0, 500, 500),
            x=1,
            y=0,
            scale=1,
        ),
        ImageLayerCreate(
            id="blue",
            set_id="composition-set",
            asset_id="blue-asset",
            z_index=3,
            name="Blue",
            description="Scaled clipped square",
            bbox_absolute=(0, 0, 2, 2),
            bbox_normalized=(0, 0, 500, 500),
            x=-2,
            y=2,
            scale=2,
        ),
    )
    result = ImageLayerCompositionService().compose(
        layer_set=layer_set,
        base_content=_real_png((4, 4), (0, 0, 0, 0)),
        layer_contents={
            "green-asset": _real_png((2, 2), (0, 255, 0, 255)),
            "red-asset": _real_png((2, 2), (255, 0, 0, 128)),
            "blue-asset": _real_png((2, 2), (0, 0, 255, 255)),
        },
    )

    image = Image.open(BytesIO(result.content)).convert("RGBA")
    assert image.getpixel((0, 0)) == (0, 255, 0, 255)
    assert image.getpixel((1, 0)) == (128, 127, 0, 255)
    assert image.getpixel((3, 0)) == (0, 0, 0, 0)
    assert image.getpixel((0, 2)) == (0, 0, 255, 255)
    assert image.getpixel((2, 2)) == (0, 0, 0, 0)
    assert result.mime_type == "image/png"


def test_image_layer_composition_validates_hidden_layer_decode() -> None:
    layer_set = _composition_set(
        ImageLayerCreate(
            id="hidden",
            set_id="composition-set",
            asset_id="hidden-asset",
            z_index=1,
            name="Hidden",
            description="Hidden but still validated",
            bbox_absolute=(0, 0, 2, 2),
            bbox_normalized=(0, 0, 500, 500),
            visible=False,
            x=0,
            y=0,
            scale=1,
        )
    )

    with pytest.raises(ValueError, match="cannot be decoded"):
        ImageLayerCompositionService().compose(
            layer_set=layer_set,
            base_content=_real_png((4, 4), (255, 255, 255, 255)),
            layer_contents={"hidden-asset": b"broken"},
        )


def _create_composable_api_set(
    client: TestClient,
    repository: Repository,
    test_asset_storage,
) -> tuple[str, str, str]:
    project_id, source_id = _create_api_source(client, repository)
    layer_set = ImageLayerSetCreate(
        project_id=project_id,
        source_asset_id=source_id,
        base_asset_id="compose-base",
        canvas_width=4,
        canvas_height=4,
    )
    base = AssetCreate(
        id="compose-base",
        project_id=project_id,
        type=AssetType.GENERATED_IMAGE,
        asset_role=AssetRole.INTERNAL_BASE,
        status=Status.SUCCEEDED,
        stage=Stage.IMAGE,
        object_key="private/compose-base.png",
        mime_type="image/png",
    )
    layer_asset = AssetCreate(
        id="compose-layer-asset",
        project_id=project_id,
        type=AssetType.GENERATED_IMAGE,
        asset_role=AssetRole.INTERNAL_LAYER,
        status=Status.SUCCEEDED,
        stage=Stage.IMAGE,
        object_key="private/compose-layer.png",
        mime_type="image/png",
    )
    layer = ImageLayerCreate(
        id="compose-layer",
        set_id=layer_set.id,
        asset_id=layer_asset.id,
        z_index=1,
        name="Foreground",
        description="Foreground layer",
        bbox_absolute=(0, 0, 2, 2),
        bbox_normalized=(0, 0, 500, 500),
        x=1,
        y=1,
    )
    created = repository.create_image_layer_set(
        layer_set,
        assets=[base, layer_asset],
        layers=[layer],
    )
    test_asset_storage.client.put_object(
        key=base.object_key,
        content=_real_png((4, 4), (255, 255, 255, 255)),
        content_type="image/png",
    )
    test_asset_storage.client.put_object(
        key=layer_asset.object_key,
        content=_real_png((2, 2), (255, 0, 0, 255)),
        content_type="image/png",
    )
    current = client.patch(
        f"/api/projects/{project_id}/current-image",
        json={"asset_id": source_id, "expected_image_revision": 0},
    )
    assert current.status_code == 200
    return project_id, source_id, created.id


@pytest.mark.parametrize("client_fixture", ["client", "mysql_client"])
def test_layer_composition_api_rejects_stale_deduplicates_and_archives_metadata(
    client_fixture: str,
    request: pytest.FixtureRequest,
    repository: Repository,
    mysql_repository,
    test_asset_storage,
    background_task_runner,
) -> None:
    client: TestClient = request.getfixturevalue(client_fixture)
    active_repository = (
        mysql_repository if client_fixture == "mysql_client" else repository
    )
    project_id, source_id, set_id = _create_composable_api_set(
        client,
        active_repository,
        test_asset_storage,
    )
    url = f"/api/projects/{project_id}/image-layer-compositions"
    before = len(active_repository.list_project_tasks(project_id))
    stale = client.post(
        url,
        json={"layer_set_id": set_id, "expected_revision": 1},
    )
    assert stale.status_code == 409
    assert len(active_repository.list_project_tasks(project_id)) == before

    payload = {"layer_set_id": set_id, "expected_revision": 0}
    submitted = client.post(url, json=payload)
    duplicate = client.post(url, json=payload)
    assert submitted.status_code == 202
    assert duplicate.json()["id"] == submitted.json()["id"]
    assert submitted.json()["frozen_input"]["layer_revision"] == 0
    assert len(background_task_runner.coroutines) == 1

    asyncio.run(background_task_runner.run_pending())
    task = active_repository.get_task(submitted.json()["id"])
    assert task.status == Status.SUCCEEDED
    assert len(task.output_asset_ids) == 1
    asset = active_repository.get_asset(task.output_asset_ids[0])
    assert asset.asset_role == AssetRole.PUBLIC
    assert asset.metadata == {
        "operation": "layer_composite",
        "source_asset_id": source_id,
        "layer_set_id": set_id,
        "layer_revision": 0,
        "width": 4,
        "height": 4,
        "size": "4x4",
        "format": "png",
        "model": f"Pillow {Image.__version__}",
        "image_purpose": "ecommerce_main",
        "prompt_summary": None,
        "storage_provider": "tos",
    }
    project = active_repository.get_project(project_id)
    assert project.current_image_asset_id == asset.id
    assert project.image_revision == 2
    assert client.get(f"/api/assets/{asset.id}").status_code == 200


@pytest.mark.parametrize("client_fixture", ["client", "mysql_client"])
def test_layer_composition_revision_conflict_is_atomic_and_deletes_tos_object(
    client_fixture: str,
    request: pytest.FixtureRequest,
    repository: Repository,
    mysql_repository,
    test_asset_storage,
    background_task_runner,
) -> None:
    client: TestClient = request.getfixturevalue(client_fixture)
    active_repository = (
        mysql_repository if client_fixture == "mysql_client" else repository
    )
    project_id, source_id, set_id = _create_composable_api_set(
        client,
        active_repository,
        test_asset_storage,
    )
    before_asset_ids = {
        asset.id
        for asset in active_repository.list_assets(
            project_id=project_id,
            asset_role=None,
        )
    }
    submitted = client.post(
        f"/api/projects/{project_id}/image-layer-compositions",
        json={"layer_set_id": set_id, "expected_revision": 0},
    ).json()
    active_repository.set_current_image_asset(
        project_id,
        source_id,
        expected_revision=1,
    )

    asyncio.run(background_task_runner.run_pending())

    assert active_repository.get_task(submitted["id"]).status == Status.FAILED
    project = active_repository.get_project(project_id)
    assert project.current_image_asset_id == source_id
    assert project.image_revision == 2
    assert {
        asset.id
        for asset in active_repository.list_assets(
            project_id=project_id,
            asset_role=None,
        )
    } == before_asset_ids
    assert any(
        key.startswith(f"projects/{project_id}/image/")
        for key in test_asset_storage.client.deletes
    )


@pytest.mark.parametrize("failure", ["decode", "tos", "db"])
def test_layer_composition_failure_does_not_replace_current(
    failure: str,
    client: TestClient,
    repository: Repository,
    test_asset_storage,
    background_task_runner,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project_id, source_id, set_id = _create_composable_api_set(
        client,
        repository,
        test_asset_storage,
    )
    if failure == "decode":
        test_asset_storage.client.objects["private/compose-layer.png"] = b"broken"
    elif failure == "tos":
        original_put = test_asset_storage.client.put_object

        def fail_generated_upload(**kwargs):
            if kwargs["key"].startswith(f"projects/{project_id}/image/"):
                raise RuntimeError("simulated TOS failure")
            original_put(**kwargs)

        monkeypatch.setattr(
            test_asset_storage.client,
            "put_object",
            fail_generated_upload,
        )
    else:
        original_create = repository.create_asset_and_set_current_image

        def fail_generated_db(data, *, expected_revision):
            if data.metadata.get("operation") == "layer_composite":
                raise RuntimeError("simulated DB failure")
            return original_create(data, expected_revision=expected_revision)

        monkeypatch.setattr(
            repository,
            "create_asset_and_set_current_image",
            fail_generated_db,
        )

    submitted = client.post(
        f"/api/projects/{project_id}/image-layer-compositions",
        json={"layer_set_id": set_id, "expected_revision": 0},
    ).json()
    asyncio.run(background_task_runner.run_pending())

    assert repository.get_task(submitted["id"]).status == Status.FAILED
    assert repository.get_project(project_id).current_image_asset_id == source_id
    assert [
        item
        for item in repository.list_assets(project_id=project_id)
        if item.metadata.get("operation") == "layer_composite"
    ] == []
    if failure == "db":
        assert any(
            key.startswith(f"projects/{project_id}/image/")
            for key in test_asset_storage.client.deletes
        )


def test_layer_composition_retry_reuses_frozen_revision_and_hash(
    client: TestClient,
    repository: Repository,
    test_asset_storage,
    background_task_runner,
) -> None:
    project_id, _, set_id = _create_composable_api_set(
        client,
        repository,
        test_asset_storage,
    )
    test_asset_storage.client.objects["private/compose-layer.png"] = b"broken"
    submitted = client.post(
        f"/api/projects/{project_id}/image-layer-compositions",
        json={"layer_set_id": set_id, "expected_revision": 0},
    ).json()
    asyncio.run(background_task_runner.run_pending())
    assert repository.get_task(submitted["id"]).status == Status.FAILED

    test_asset_storage.client.objects["private/compose-layer.png"] = _real_png(
        (2, 2),
        (255, 0, 0, 255),
    )
    response = client.post(f"/api/tasks/{submitted['id']}/retry")
    assert response.status_code == 200
    retry = response.json()
    assert retry["retry_of_task_id"] == submitted["id"]
    assert retry["input_hash"] == submitted["input_hash"]
    assert retry["frozen_input"] == submitted["frozen_input"]
    asyncio.run(background_task_runner.run_pending())
    assert repository.get_task(retry["id"]).status == Status.SUCCEEDED


@pytest.mark.parametrize("client_fixture", ["client", "mysql_client"])
def test_deleted_image_project_retains_layers_assets_and_tos_but_hides_apis(
    client_fixture: str,
    request: pytest.FixtureRequest,
    repository: Repository,
    mysql_repository,
    mysql_session_factory,
    test_asset_storage,
) -> None:
    client: TestClient = request.getfixturevalue(client_fixture)
    active_repository = (
        mysql_repository if client_fixture == "mysql_client" else repository
    )
    project_id, source_id, set_id = _create_composable_api_set(
        client,
        active_repository,
        test_asset_storage,
    )
    object_keys = set(test_asset_storage.client.objects)

    assert client.delete(f"/api/projects/{project_id}").status_code == 204
    assert client.get(f"/api/projects/{project_id}/assets").status_code == 404
    assert client.get(f"/api/assets/{source_id}").status_code == 404
    assert client.get(
        f"/api/projects/{project_id}/image-layer-sets/{set_id}"
    ).status_code == 404
    assert client.get("/api/assets").json() == []
    assert set(test_asset_storage.client.objects) == object_keys
    assert test_asset_storage.client.deletes == []

    if client_fixture == "client":
        assert set_id in repository._image_layer_sets
        assert {"compose-base", "compose-layer-asset"} <= set(repository._assets)
    else:
        with mysql_session_factory() as session:
            assert session.get(ImageLayerSetORM, set_id) is not None
            retained_ids = set(
                session.scalars(
                    select(AssetORM.id).where(AssetORM.project_id == project_id)
                ).all()
            )
            assert {source_id, "compose-base", "compose-layer-asset"} <= retained_ids
