from collections.abc import Generator
from contextlib import contextmanager
import logging

from fastapi.testclient import TestClient
import pytest

from backend.app.api.dependencies import (
    get_asset_storage_service,
    get_modelark_generation_service,
    get_repository,
    get_workflow_service,
)
from backend.app.main import create_app
from backend.app.repositories import InMemoryRepository
from backend.app.schemas import (
    AssetCategory,
    AssetCreate,
    AssetType,
    Brief,
    ReferenceAssetKind,
    Stage,
    Status,
    StoryboardShotCreate,
    StoryboardShotVideoConfigUpdate,
    TextArtifactCreate,
)
from backend.app.services.generation import (
    ModelArkGenerationService,
    StoryboardVideoGenerationResult,
)
from backend.app.services.assets import (
    AssetStorageService,
    DownloadedAsset,
)
from backend.app.services.modelark import ModelArkProviderError
from backend.app.services.workflow import WorkflowService


def test_storyboard_shot_video_config_can_be_saved(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id, shot_id = _create_project_with_shot(client, repository, project_payload)

    initial = client.get(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/video-config"
    )
    assert initial.status_code == 200
    assert initial.json()["video_prompt"] is None
    assert "[0s-3s]" in initial.json()["effective_video_prompt"]
    assert (
        "剧情：Opening shot with product and user context"
        in initial.json()["effective_video_prompt"]
    )
    assert "【语音】" in initial.json()["effective_video_prompt"]
    assert "生成自然、清晰的普通话语音" in initial.json()["effective_video_prompt"]
    assert "字幕使用简体中文" not in initial.json()["effective_video_prompt"]

    response = client.patch(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/video-config",
        json={"video_prompt": "  camera slowly pushes in with product reveal  "},
    )

    assert response.status_code == 200
    config = response.json()
    assert config["video_prompt"] == "camera slowly pushes in with product reveal"
    assert "[0s-3s]" in config["effective_video_prompt"]
    assert (
        "创作意图：camera slowly pushes in with product reveal"
        in config["effective_video_prompt"]
    )
    assert repository.get_storyboard_shot(project_id, shot_id).video_prompt == (
        "camera slowly pushes in with product reveal"
    )


def test_english_config_merge_split_and_generation_share_resolved_prompt(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    payload = {
        **project_payload,
        "brief": {
            **project_payload["brief"],
            "target_language": "en",
        },
    }
    generation = RecordingSingleShotVideoGenerationService()
    with _client_with_generation(repository, generation, test_asset_storage) as client:
        project_id = client.post("/api/projects", json=payload).json()["id"]
        shots = repository.replace_project_storyboard(
            project_id,
            [
                _shot(project_id, 1, duration_seconds=3),
                _shot(project_id, 2, duration_seconds=4),
            ],
        )

        initial = client.get(
            f"/api/projects/{project_id}/storyboard/shots/{shots[0].id}/video-config"
        )
        patched = client.patch(
            f"/api/projects/{project_id}/storyboard/shots/{shots[0].id}/video-config",
            json={"video_prompt": "Use a restrained low-angle product reveal."},
        )
        merged_response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/merge",
            json={"shot_ids": [shot.id for shot in shots]},
        )
        merged = merged_response.json()["storyboard"][0]
        merged_config = client.get(
            f"/api/projects/{project_id}/storyboard/shots/{merged['id']}/video-config"
        )
        split_response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{merged['id']}/split"
        )
        restored = sorted(
            split_response.json()["storyboard"],
            key=lambda item: item["index"],
        )
        restored_config = client.get(
            f"/api/projects/{project_id}/storyboard/shots/{restored[0]['id']}/video-config"
        )
        generated = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{restored[0]['id']}/generate-video"
        )

    assert initial.status_code == 200
    assert "[Overall Requirements]" in initial.json()["effective_video_prompt"]
    assert "natural, clear English speech" in initial.json()["effective_video_prompt"]
    assert patched.status_code == 200
    assert (
        "Creative intent: Use a restrained low-angle product reveal."
        in patched.json()["effective_video_prompt"]
    )
    assert merged_response.status_code == 200
    assert merged["title"] == "Shot 1-2"
    assert "[Continuous Timeline]" in merged["video_prompt"]
    assert "[0s-3s]" in merged["video_prompt"]
    assert "[3s-7s]" in merged["video_prompt"]
    assert "【整体要求】" not in merged["video_prompt"]
    assert merged_config.json()["effective_video_prompt"] == merged["video_prompt"]
    assert split_response.status_code == 200
    assert "[Overall Requirements]" in restored_config.json()["effective_video_prompt"]
    assert generated.status_code == 200

    generated_asset = repository.get_asset(generated.json()["output_asset_ids"][0])
    sent_prompt = generation.requests[0][3]["video_prompt"]
    assert sent_prompt == restored_config.json()["effective_video_prompt"]
    assert generated_asset.metadata["video_prompt"] == sent_prompt


def test_legacy_subtitle_video_prompt_is_hidden_from_config_editor(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id, shot_id = _create_project_with_shot(client, repository, project_payload)
    legacy_prompt = "\n".join(
        [
            "【整体要求】",
            "旧版结构。",
            "【连续时间轴】",
            "[0s-3s] Opening shot with product and user context",
            "【语音与字幕】",
            "字幕使用简体中文，位于画面底部安全区，白字、黑色描边。",
            "【负向约束】",
            "避免字幕乱码或字幕遮挡主体。",
        ]
    )
    repository.save_storyboard_shot_video_config(
        project_id,
        shot_id,
        StoryboardShotVideoConfigUpdate(video_prompt=legacy_prompt),
    )

    response = client.get(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/video-config"
    )

    assert response.status_code == 200
    config = response.json()
    assert config["video_prompt"] is None
    assert "【语音与字幕】" not in config["effective_video_prompt"]
    assert "字幕使用简体中文" not in config["effective_video_prompt"]
    assert "【语音】" in config["effective_video_prompt"]


def test_subtitle_blocks_are_hidden_even_with_current_prompt_headers(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id, shot_id = _create_project_with_shot(client, repository, project_payload)
    dirty_prompt = "\n".join(
        [
            "【整体要求】",
            "保留剧情。",
            "【连续时间轴】",
            "[0s-3s] Opening shot with product and user context",
            "【主字幕】完成任务。",
            "字幕：与语音同步显示。",
            "【语音】",
            "生成普通话语音。",
            "【语音与字幕】",
            "语音和字幕逐字一致。",
            "【负向约束】",
            "避免主体变形。",
        ]
    )
    repository.save_storyboard_shot_video_config(
        project_id,
        shot_id,
        StoryboardShotVideoConfigUpdate(video_prompt=dirty_prompt),
    )

    response = client.get(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/video-config"
    )

    assert response.status_code == 200
    config = response.json()
    assert config["video_prompt"] is None
    assert "【语音】" in config["effective_video_prompt"]


def test_storyboard_shot_video_config_allows_subtitle_instructions(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id, shot_id = _create_project_with_shot(client, repository, project_payload)

    response = client.patch(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/video-config",
        json={"video_prompt": "字幕使用简体中文，位于画面底部安全区。"},
    )

    assert response.status_code == 200
    assert response.json()["video_prompt"] == "字幕使用简体中文，位于画面底部安全区。"


def test_storyboard_reference_upload_supports_image_video_and_audio(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id, shot_id = _create_project_with_shot(client, repository, project_payload)

    uploads = [
        ("image", "reference.png", "image/png", b"image-bytes"),
        ("video", "reference.mp4", "video/mp4", b"video-bytes"),
        ("audio", "reference.mp3", "audio/mpeg", b"audio-bytes"),
    ]

    for kind, filename, mime_type, content in uploads:
        response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shot_id}/references/upload",
            params={"kind": kind, "filename": filename, "mime_type": mime_type},
            content=content,
            headers={"Content-Type": "application/octet-stream"},
        )

        assert response.status_code == 201
        asset = repository.get_asset(response.json()["asset_id"])
        assert asset.status == Status.SUCCEEDED
        assert asset.category.value == "reference"
        assert asset.mime_type == mime_type
        assert asset.metadata["reference_kind"] == kind
        assert asset.metadata["usage"] == "storyboard_video_reference"

    shot = repository.get_storyboard_shot(project_id, shot_id)
    assert len(shot.reference_image_asset_ids) == 1
    assert len(shot.reference_video_asset_ids) == 1
    assert len(shot.reference_audio_asset_ids) == 1


def test_storyboard_reference_can_be_attached_from_asset_library_and_removed(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id, shot_id = _create_project_with_shot(client, repository, project_payload)
    image = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
            url="mock://image.png",
            mime_type="image/png",
        )
    )
    video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://video.mp4",
            mime_type="video/mp4",
        )
    )
    audio = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.UPLOADED_AUDIO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://audio.mp3",
            mime_type="audio/mpeg",
        )
    )

    for kind, asset in [
        ("image", image),
        ("video", video),
        ("audio", audio),
    ]:
        response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shot_id}/references",
            json={"kind": kind, "asset_id": asset.id},
        )
        assert response.status_code == 200

    attached = repository.get_storyboard_shot(project_id, shot_id)
    assert attached.reference_image_asset_ids == [image.id]
    assert attached.reference_video_asset_ids == [video.id]
    assert attached.reference_audio_asset_ids == [audio.id]

    response = client.request(
        "DELETE",
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/references",
        json={"kind": "image", "asset_id": image.id},
    )

    assert response.status_code == 200
    removed = repository.get_storyboard_shot(project_id, shot_id)
    assert removed.reference_image_asset_ids == []
    assert repository.get_asset(image.id).id == image.id


def test_storyboard_first_frame_can_be_set_uploaded_and_cleared(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id, shot_id = _create_project_with_shot(client, repository, project_payload)
    image = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
            url="mock://first-frame.png",
            mime_type="image/png",
        )
    )

    selected = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/first-frame",
        json={"asset_id": image.id},
    )
    assert selected.status_code == 200
    assert selected.json()["first_frame_asset_id"] == image.id

    uploaded = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/first-frame/upload",
        params={"filename": "start.png", "mime_type": "image/png"},
        content=b"first-frame-bytes",
        headers={"Content-Type": "application/octet-stream"},
    )
    assert uploaded.status_code == 201
    uploaded_asset = repository.get_asset(uploaded.json()["asset_id"])
    assert uploaded_asset.metadata["usage"] == "storyboard_video_first_frame"
    assert uploaded.json()["config"]["first_frame_asset_id"] == uploaded_asset.id
    assert repository.get_asset(image.id).id == image.id

    cleared = client.delete(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/first-frame"
    )
    assert cleared.status_code == 200
    assert cleared.json()["first_frame_asset_id"] is None


@pytest.mark.parametrize(
    ("kind", "filename", "mime_type"),
    [
        ("image", "reference.png", "image/png"),
        ("video", "reference.mp4", "video/mp4"),
        ("audio", "reference.mp3", "audio/mpeg"),
    ],
)
def test_first_frame_rejects_existing_reference_media(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    kind: str,
    filename: str,
    mime_type: str,
) -> None:
    project_id, shot_id = _create_project_with_shot(
        client, repository, project_payload
    )
    uploaded = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/references/upload",
        params={"kind": kind, "filename": filename, "mime_type": mime_type},
        content=b"reference-bytes",
        headers={"Content-Type": "application/octet-stream"},
    )
    assert uploaded.status_code == 201
    first_frame = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
            url="mock://first-frame.png",
            mime_type="image/png",
        )
    )

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/first-frame",
        json={"asset_id": first_frame.id},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"
    assert "首帧控制不能与参考图" in response.json()["detail"]["message"]


@pytest.mark.parametrize(
    ("kind", "asset_type", "mime_type"),
    [
        ("image", AssetType.GENERATED_IMAGE, "image/png"),
        ("video", AssetType.UPLOADED_VIDEO, "video/mp4"),
        ("audio", AssetType.UPLOADED_AUDIO, "audio/mpeg"),
    ],
)
def test_reference_attachment_rejects_existing_first_frame(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    kind: str,
    asset_type: AssetType,
    mime_type: str,
) -> None:
    project_id, shot_id = _create_project_with_shot(
        client, repository, project_payload
    )
    first_frame = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
            url="mock://first-frame.png",
            mime_type="image/png",
        )
    )
    selected = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/first-frame",
        json={"asset_id": first_frame.id},
    )
    assert selected.status_code == 200
    reference = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=asset_type,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url=f"mock://reference.{mime_type.split('/')[-1]}",
            mime_type=mime_type,
        )
    )

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/references",
        json={"kind": kind, "asset_id": reference.id},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"


@pytest.mark.parametrize(
    ("kind", "filename", "mime_type"),
    [
        ("image", "reference.png", "image/png"),
        ("video", "reference.mp4", "video/mp4"),
        ("audio", "reference.mp3", "audio/mpeg"),
    ],
)
def test_reference_upload_rejects_first_frame_before_asset_upload(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
    kind: str,
    filename: str,
    mime_type: str,
) -> None:
    project_id, shot_id = _create_project_with_shot(
        client, repository, project_payload
    )
    first_frame = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
            url="mock://first-frame.png",
            mime_type="image/png",
        )
    )
    repository.set_storyboard_shot_first_frame(
        project_id,
        shot_id,
        asset_id=first_frame.id,
        source_video_asset_id=None,
    )
    assets_before = len(repository.list_project_assets(project_id))
    puts_before = len(test_asset_storage.client.puts)

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/references/upload",
        params={"kind": kind, "filename": filename, "mime_type": mime_type},
        content=b"reference-bytes",
        headers={"Content-Type": "application/octet-stream"},
    )

    assert response.status_code == 422
    assert len(repository.list_project_assets(project_id)) == assets_before
    assert len(test_asset_storage.client.puts) == puts_before


def test_first_frame_upload_rejects_reference_before_asset_upload(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    project_id, shot_id = _create_project_with_shot(
        client, repository, project_payload
    )
    repository.attach_storyboard_shot_reference(
        project_id,
        shot_id,
        kind=ReferenceAssetKind.IMAGE,
        asset_id="legacy-reference",
    )
    assets_before = len(repository.list_project_assets(project_id))
    puts_before = len(test_asset_storage.client.puts)

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/first-frame/upload",
        params={"filename": "start.png", "mime_type": "image/png"},
        content=b"first-frame-bytes",
        headers={"Content-Type": "application/octet-stream"},
    )

    assert response.status_code == 422
    assert len(repository.list_project_assets(project_id)) == assets_before
    assert len(test_asset_storage.client.puts) == puts_before


def test_previous_shot_last_frame_can_be_selected_as_first_frame(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    generation = RecordingSingleShotVideoGenerationService()
    with _client_with_generation(repository, generation, test_asset_storage) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        shots = repository.replace_project_storyboard(
            project_id,
            [
                _shot(project_id, 1, title="Opening"),
                _shot(project_id, 2, title="CTA"),
            ],
        )
        previous_video = repository.create_asset(
            AssetCreate(
                project_id=project_id,
                type=AssetType.STORYBOARD_VIDEO,
                status=Status.SUCCEEDED,
                stage=Stage.VIDEO,
                url="mock://previous.mp4",
                object_key=f"projects/{project_id}/video/previous.mp4",
                mime_type="video/mp4",
                metadata={
                    "last_frame_status": "available",
                    "last_frame_object_key": (
                        f"projects/{project_id}/video/previous-last-frame.png"
                    ),
                },
            )
        )
        repository.set_storyboard_shot_video_asset(
            project_id, shots[0].id, previous_video.id
        )

        selected = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shots[1].id}/first-frame",
            json={"source_video_asset_id": previous_video.id},
        )
        assert selected.status_code == 200
        assert selected.json()["first_frame_asset_id"] is None
        assert (
            selected.json()["first_frame_source_video_asset_id"]
            == previous_video.id
        )

        generated = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shots[1].id}/generate-video"
        )

    assert generated.status_code == 200
    assert len(generation.requests) == 1
    first_frame_url = generation.requests[0][3]["first_frame_url"]
    assert "previous-last-frame.png" in first_frame_url
    assert "X-Tos-Signature=test" in first_frame_url


def test_storyboard_tail_frame_can_be_applied_to_subsequent_reference_images(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = repository.replace_project_storyboard(
        project_id,
        [
            _shot(project_id, 1, title="Opening"),
            _shot(project_id, 2, title="Middle"),
            _shot(project_id, 3, title="CTA"),
        ],
    )
    last_frame_key = f"projects/{project_id}/video/opening-last-frame.png"
    test_asset_storage.client.objects[last_frame_key] = b"last-frame-bytes"
    source_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://opening.mp4",
            object_key=f"projects/{project_id}/video/opening.mp4",
            mime_type="video/mp4",
            metadata={
                "last_frame_status": "available",
                "last_frame_object_key": last_frame_key,
                "last_frame_mime_type": "image/png",
            },
        )
    )
    repository.set_storyboard_shot_video_asset(
        project_id, shots[0].id, source_video.id
    )
    repository.set_storyboard_shot_first_frame(
        project_id,
        shots[2].id,
        asset_id="existing-first-frame",
        source_video_asset_id=None,
    )

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shots[0].id}/last-frame-reference"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source_shot_id"] == shots[0].id
    assert body["source_video_asset_id"] == source_video.id
    assert body["applied_shot_ids"] == [shots[1].id]
    assert body["skipped"] == [
        {
            "shot_id": shots[2].id,
            "shot_index": 3,
            "reason": "has_first_frame",
        }
    ]
    reference_asset_id = body["reference_asset_id"]
    reference_asset = repository.get_asset(reference_asset_id)
    assert reference_asset.type == AssetType.GENERATED_IMAGE
    assert reference_asset.metadata["usage"] == (
        "storyboard_video_tail_frame_reference"
    )
    assert reference_asset.metadata["source_video_asset_id"] == source_video.id
    assert test_asset_storage.client.objects[reference_asset.object_key] == (
        b"last-frame-bytes"
    )
    assert repository.get_storyboard_shot(
        project_id, shots[1].id
    ).reference_image_asset_ids == [reference_asset_id]
    assert repository.get_storyboard_shot(
        project_id, shots[2].id
    ).reference_image_asset_ids == []

    repeated = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shots[0].id}/last-frame-reference"
    )

    assert repeated.status_code == 200
    assert repeated.json()["reference_asset_id"] == reference_asset_id
    assert repeated.json()["applied_shot_ids"] == []
    assert repeated.json()["skipped"] == [
        {
            "shot_id": shots[1].id,
            "shot_index": 2,
            "reason": "already_attached",
        },
        {
            "shot_id": shots[2].id,
            "shot_index": 3,
            "reason": "has_first_frame",
        },
    ]
    reference_assets = [
        asset
        for asset in repository.list_project_assets(project_id)
        if asset.metadata.get("usage") == "storyboard_video_tail_frame_reference"
    ]
    assert len(reference_assets) == 1


def test_storyboard_tail_frame_can_be_copied_to_reference_asset_library(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shot = repository.replace_project_storyboard(
        project_id,
        [_shot(project_id, 1, title="Opening")],
    )[0]
    last_frame_key = f"projects/{project_id}/video/opening-last-frame.png"
    test_asset_storage.client.objects[last_frame_key] = b"last-frame-bytes"
    source_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://opening.mp4",
            object_key=f"projects/{project_id}/video/opening.mp4",
            mime_type="video/mp4",
            metadata={
                "last_frame_status": "available",
                "last_frame_object_key": last_frame_key,
                "last_frame_mime_type": "image/png",
            },
        )
    )
    repository.set_storyboard_shot_video_asset(project_id, shot.id, source_video.id)

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot.id}/last-frame-reference-asset"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "generated_image"
    assert body["category"] == "reference"
    assert body["metadata"]["usage"] == "storyboard_video_tail_frame_reference"
    assert body["metadata"]["source_video_asset_id"] == source_video.id
    assert body["url"] == f"/api/assets/{body['id']}/content"
    assert test_asset_storage.client.objects[body["object_key"]] == (
        b"last-frame-bytes"
    )

    repeated = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot.id}/last-frame-reference-asset"
    )

    assert repeated.status_code == 200
    assert repeated.json()["id"] == body["id"]
    reference_assets = [
        asset
        for asset in repository.list_project_assets(project_id)
        if asset.metadata.get("usage") == "storyboard_video_tail_frame_reference"
    ]
    assert len(reference_assets) == 1


def test_storyboard_tail_frame_reference_asset_allows_stale_source_video(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shot = repository.replace_project_storyboard(project_id, [_shot(project_id, 1)])[0]
    last_frame_key = f"projects/{project_id}/video/stale-last-frame.png"
    test_asset_storage.client.objects[last_frame_key] = b"stale-last-frame"
    source_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.STALE,
            stage=Stage.VIDEO,
            url="mock://stale.mp4",
            object_key=f"projects/{project_id}/video/stale.mp4",
            mime_type="video/mp4",
            metadata={
                "last_frame_status": "available",
                "last_frame_object_key": last_frame_key,
                "last_frame_mime_type": "image/png",
            },
        )
    )
    repository.set_storyboard_shot_video_asset(project_id, shot.id, source_video.id)

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot.id}/last-frame-reference-asset"
    )

    assert response.status_code == 200
    assert response.json()["metadata"]["source_video_asset_id"] == source_video.id


def test_storyboard_tail_frame_reference_rejects_missing_source_video(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = repository.replace_project_storyboard(
        project_id,
        [_shot(project_id, 1), _shot(project_id, 2)],
    )

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shots[0].id}/last-frame-reference"
    )

    assert response.status_code == 422
    assert response.json()["detail"]["message"] == (
        "source shot video is not available"
    )


def test_storyboard_tail_frame_reference_rejects_last_shot(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = repository.replace_project_storyboard(
        project_id,
        [_shot(project_id, 1), _shot(project_id, 2)],
    )
    last_frame_key = f"projects/{project_id}/video/final-last-frame.png"
    test_asset_storage.client.objects[last_frame_key] = b"last-frame-bytes"
    source_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://final.mp4",
            object_key=f"projects/{project_id}/video/final.mp4",
            mime_type="video/mp4",
            metadata={
                "last_frame_status": "available",
                "last_frame_object_key": last_frame_key,
            },
        )
    )
    repository.set_storyboard_shot_video_asset(
        project_id, shots[1].id, source_video.id
    )

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shots[1].id}/last-frame-reference"
    )

    assert response.status_code == 422
    assert response.json()["detail"]["message"] == (
        "the storyboard shot has no subsequent shots"
    )
    assert len(repository.list_project_assets(project_id)) == 1


def test_previous_shot_last_frame_rejects_existing_reference_media(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = repository.replace_project_storyboard(
        project_id,
        [_shot(project_id, 1), _shot(project_id, 2)],
    )
    previous_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://previous.mp4",
            mime_type="video/mp4",
            metadata={
                "last_frame_status": "available",
                "last_frame_object_key": "previous-last-frame.jpg",
            },
        )
    )
    repository.set_storyboard_shot_video_asset(
        project_id, shots[0].id, previous_video.id
    )
    repository.attach_storyboard_shot_reference(
        project_id,
        shots[1].id,
        kind=ReferenceAssetKind.IMAGE,
        asset_id="legacy-reference",
    )

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shots[1].id}/first-frame",
        json={"source_video_asset_id": previous_video.id},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"


def test_previous_shot_last_frame_rejects_non_previous_video_and_is_mutually_exclusive(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = repository.replace_project_storyboard(
        project_id,
        [_shot(project_id, 1), _shot(project_id, 2)],
    )
    previous_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://previous.mp4",
            mime_type="video/mp4",
            metadata={
                "last_frame_status": "available",
                "last_frame_object_key": "previous-last-frame.png",
            },
        )
    )
    unrelated_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://unrelated.mp4",
            mime_type="video/mp4",
            metadata={
                "last_frame_status": "available",
                "last_frame_object_key": "unrelated-last-frame.png",
            },
        )
    )
    repository.set_storyboard_shot_video_asset(
        project_id, shots[0].id, previous_video.id
    )

    rejected = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shots[1].id}/first-frame",
        json={"source_video_asset_id": unrelated_video.id},
    )
    assert rejected.status_code == 422

    selected = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shots[1].id}/first-frame",
        json={"source_video_asset_id": previous_video.id},
    )
    assert selected.status_code == 200

    image = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
            url="mock://first-frame.png",
            mime_type="image/png",
        )
    )
    image_selected = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shots[1].id}/first-frame",
        json={"asset_id": image.id},
    )
    assert image_selected.status_code == 200
    assert image_selected.json()["first_frame_asset_id"] == image.id
    assert image_selected.json()["first_frame_source_video_asset_id"] is None


def test_conflicting_legacy_video_inputs_are_rejected_before_task_creation(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    generation = RecordingSingleShotVideoGenerationService()
    with _client_with_generation(repository, generation, test_asset_storage) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        shot = repository.replace_project_storyboard(
            project_id,
            [
                _shot(project_id, 1).model_copy(
                    update={
                        "first_frame_asset_id": "legacy-first-frame",
                        "reference_image_asset_ids": ["legacy-reference"],
                    }
                )
            ],
        )[0]

        response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shot.id}/generate-video"
        )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"
    assert repository.list_project_tasks(project_id) == []
    assert repository.list_project_assets(project_id) == []
    assert generation.requests == []


def test_conflicting_legacy_inputs_can_be_cleared_or_removed(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = repository.replace_project_storyboard(
        project_id,
        [
            _shot(project_id, 1).model_copy(
                update={
                    "first_frame_asset_id": "legacy-first-frame-1",
                    "reference_image_asset_ids": ["legacy-reference-1"],
                }
            ),
            _shot(project_id, 2).model_copy(
                update={
                    "first_frame_asset_id": "legacy-first-frame-2",
                    "reference_image_asset_ids": ["legacy-reference-2"],
                }
            ),
        ],
    )

    cleared = client.delete(
        f"/api/projects/{project_id}/storyboard/shots/{shots[0].id}/first-frame"
    )
    removed = client.request(
        "DELETE",
        f"/api/projects/{project_id}/storyboard/shots/{shots[1].id}/references",
        json={"kind": "image", "asset_id": "legacy-reference-2"},
    )

    assert cleared.status_code == 200
    assert cleared.json()["first_frame_asset_id"] is None
    assert cleared.json()["reference_image_asset_ids"] == ["legacy-reference-1"]
    assert removed.status_code == 200
    assert removed.json()["first_frame_asset_id"] == "legacy-first-frame-2"
    assert removed.json()["reference_image_asset_ids"] == []


def test_single_storyboard_shot_video_generation_updates_only_that_shot(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    generation = RecordingSingleShotVideoGenerationService(
        last_frame_url="https://model.example/last-frame.png"
    )
    with _client_with_generation(repository, generation, test_asset_storage) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        shots = repository.replace_project_storyboard(
            project_id,
            [
                _shot(project_id, 1, title="Opening"),
                _shot(project_id, 2, title="CTA"),
            ],
        )
        prompt_response = client.patch(
            f"/api/projects/{project_id}/storyboard/shots/{shots[0].id}/video-config",
            json={"video_prompt": "custom single shot prompt"},
        )
        assert prompt_response.status_code == 200

        image_response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shots[0].id}/references/upload",
            params={
                "kind": "image",
                "filename": "ref.png",
                "mime_type": "image/png",
            },
            content=b"image-bytes",
            headers={"Content-Type": "application/octet-stream"},
        )
        assert image_response.status_code == 201

        response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shots[0].id}/generate-video"
        )

    assert response.status_code == 200
    task = response.json()
    assert task["stage"] == "video"
    assert task["status"] == "succeeded"
    assert task["frozen_input"] == {
        "kind": "storyboard_shot_video_generation",
        "shot_id": shots[0].id,
    }
    assert len(task["output_asset_ids"]) == 1

    generated_asset = repository.get_asset(task["output_asset_ids"][0])
    first_shot = repository.get_storyboard_shot(project_id, shots[0].id)
    second_shot = repository.get_storyboard_shot(project_id, shots[1].id)
    assert generated_asset.type == AssetType.STORYBOARD_VIDEO
    assert generated_asset.object_key is not None
    assert generated_asset.metadata["storage_provider"] == "tos"
    assert generated_asset.metadata["shot_id"] == shots[0].id
    assert "[0s-3s]" in generated_asset.metadata["video_prompt"]
    assert (
        "创作意图：custom single shot prompt"
        in generated_asset.metadata["video_prompt"]
    )
    assert generated_asset.metadata["last_frame_status"] == "available"
    assert generated_asset.metadata["last_frame_mime_type"] == "image/png"
    assert generated_asset.metadata["last_frame_object_key"].endswith(
        "-last-frame.png"
    )
    project_assets = repository.list_project_assets(project_id)
    assert len(project_assets) == 3
    assert [
        asset.type
        for asset in project_assets
        if asset.type == AssetType.STORYBOARD_VIDEO
    ] == [AssetType.STORYBOARD_VIDEO]
    tail_frame_reference = next(
        asset
        for asset in project_assets
        if asset.metadata.get("usage") == "storyboard_video_tail_frame_reference"
    )
    assert tail_frame_reference.type == AssetType.GENERATED_IMAGE
    assert tail_frame_reference.category == AssetCategory.REFERENCE
    assert tail_frame_reference.status == Status.SUCCEEDED
    assert tail_frame_reference.metadata["source_shot_id"] == shots[0].id
    assert (
        tail_frame_reference.metadata["source_video_asset_id"]
        == generated_asset.id
    )
    assert first_shot.video_asset_id == generated_asset.id
    assert second_shot.video_asset_id is None

    assert len(generation.requests) == 1
    _, brief, shot, kwargs = generation.requests[0]
    assert brief.aspect_ratio == "9:16"
    assert shot.duration_seconds == 3.0
    assert "[0s-3s]" in kwargs["video_prompt"]
    assert "创作意图：custom single shot prompt" in kwargs["video_prompt"]
    assert kwargs["reference_image_urls"]
    assert kwargs["first_frame_url"] is None


def test_single_storyboard_shot_video_can_be_generated_by_index(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    generation = RecordingSingleShotVideoGenerationService()
    with _client_with_generation(repository, generation, test_asset_storage) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        repository.replace_project_storyboard(
            project_id,
            [_shot(project_id, 1), _shot(project_id, 2)],
        )

        response = client.post(
            f"/api/projects/{project_id}/storyboard/generate-video",
            json={"shot_index": 2},
        )

    assert response.status_code == 200
    assert generation.requests[0][2].index == 2


def test_storyboard_video_edit_creates_candidate_before_explicit_selection(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    generation = RecordingSingleShotVideoGenerationService()
    with _client_with_generation(repository, generation, test_asset_storage) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        shot = repository.replace_project_storyboard(
            project_id,
            [_shot(project_id, 1, duration_seconds=8)],
        )[0]
        original = repository.create_asset(
            AssetCreate(
                project_id=project_id,
                type=AssetType.STORYBOARD_VIDEO,
                status=Status.SUCCEEDED,
                stage=Stage.VIDEO,
                object_key=f"projects/{project_id}/video/original.mp4",
                mime_type="video/mp4",
            )
        )
        repository.set_storyboard_shot_video_asset(project_id, shot.id, original.id)

        response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shot.id}/edit-video",
            json={"prompt": "  增强产品特写，保持人物动作连续  "},
        )

        assert response.status_code == 200
        task = response.json()
        assert task["status"] == "succeeded"
        assert task["frozen_input"] == {
            "kind": "storyboard_shot_video_edit",
            "shot_id": shot.id,
        }
        assert len(task["output_asset_ids"]) == 1
        candidate_id = task["output_asset_ids"][0]
        candidate = repository.get_asset(candidate_id)
        assert candidate.metadata["operation"] == "video_edit"
        assert candidate.metadata["source_asset_id"] == original.id
        assert candidate.metadata["source_shot_id"] == shot.id
        assert candidate.metadata["edit_prompt"] == "增强产品特写，保持人物动作连续"
        assert (
            repository.get_storyboard_shot(project_id, shot.id).video_asset_id
            == original.id
        )
        _, brief, edited_shot, kwargs = generation.requests[0]
        assert brief.aspect_ratio == "9:16"
        assert edited_shot.index == shot.index
        assert kwargs["source_video_url"]
        assert kwargs["prompt"] == "增强产品特写，保持人物动作连续"

        selected = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shot.id}/select-video",
            json={"asset_id": candidate_id},
        )

    assert selected.status_code == 200
    assert selected.json()["video_asset_id"] == candidate_id
    assert repository.get_asset(original.id).status == Status.SUCCEEDED
    assert repository.get_storyboard_shot(project_id, shot.id).video_asset_id == (
        candidate_id
    )


def test_storyboard_video_selection_rejects_candidate_from_another_shot(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = repository.replace_project_storyboard(
        project_id,
        [_shot(project_id, 1), _shot(project_id, 2)],
    )
    candidate = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://candidate.mp4",
            mime_type="video/mp4",
            metadata={
                "operation": "video_edit",
                "source_shot_id": shots[0].id,
            },
        )
    )

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shots[1].id}/select-video",
        json={"asset_id": candidate.id},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"
    assert repository.get_storyboard_shot(project_id, shots[1].id).video_asset_id is None


def test_select_video_allows_reverting_to_shot_original(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shot = repository.replace_project_storyboard(
        project_id,
        [_shot(project_id, 1)],
    )[0]
    original = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://original.mp4",
            mime_type="video/mp4",
            metadata={"shot_id": shot.id, "shot_index": shot.index},
        )
    )
    candidate = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://candidate.mp4",
            mime_type="video/mp4",
            metadata={
                "operation": "video_edit",
                "source_shot_id": shot.id,
                "shot_id": shot.id,
            },
        )
    )
    repository.set_storyboard_shot_video_asset(project_id, shot.id, original.id)

    selected_candidate = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot.id}/select-video",
        json={"asset_id": candidate.id},
    )
    assert selected_candidate.status_code == 200
    assert selected_candidate.json()["video_asset_id"] == candidate.id

    reverted = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot.id}/select-video",
        json={"asset_id": original.id},
    )
    assert reverted.status_code == 200
    assert reverted.json()["video_asset_id"] == original.id
    assert (
        repository.get_storyboard_shot(project_id, shot.id).video_asset_id
        == original.id
    )


def test_last_frame_upload_failure_does_not_fail_generated_video(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    class FailLastFrameDownloader:
        async def fetch(self, _url: str, *, expected_mime_type: str | None = None):
            if expected_mime_type == "image/*":
                raise RuntimeError("last frame download failed")
            return DownloadedAsset(content=b"video", mime_type="video/mp4")

    test_asset_storage.downloader = FailLastFrameDownloader()
    generation = RecordingSingleShotVideoGenerationService(
        last_frame_url="https://model.example/last-frame.png"
    )
    with _client_with_generation(repository, generation, test_asset_storage) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        shot = repository.replace_project_storyboard(
            project_id,
            [_shot(project_id, 1)],
        )[0]
        response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shot.id}/generate-video"
        )

    assert response.status_code == 200
    assert response.json()["status"] == "succeeded"
    assert len(response.json()["output_asset_ids"]) == 1
    asset = repository.get_asset(response.json()["output_asset_ids"][0])
    assert asset.metadata["last_frame_status"] == "unavailable"
    assert asset.metadata["last_frame_error_type"] == "RuntimeError"
    assert repository.get_storyboard_shot(project_id, shot.id).video_asset_id == (
        asset.id
    )


def test_last_frame_content_endpoint_redirects_and_returns_not_found(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    storage = AssetStorageService(
        bucket="local-assets",
        public_endpoint="https://assets.example.com",
    )
    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_asset_storage_service] = lambda: storage
    with TestClient(app) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        with_last_frame = repository.create_asset(
            AssetCreate(
                project_id=project_id,
                type=AssetType.STORYBOARD_VIDEO,
                status=Status.SUCCEEDED,
                stage=Stage.VIDEO,
                object_key="projects/project/video/video.mp4",
                metadata={
                    "last_frame_object_key": (
                        "projects/project/video/video-last-frame.png"
                    )
                },
            )
        )
        without_last_frame = repository.create_asset(
            AssetCreate(
                project_id=project_id,
                type=AssetType.STORYBOARD_VIDEO,
                status=Status.SUCCEEDED,
                stage=Stage.VIDEO,
                object_key="projects/project/video/legacy.mp4",
            )
        )

        response = client.get(
            f"/api/assets/{with_last_frame.id}/last-frame",
            follow_redirects=False,
        )
        missing = client.get(
            f"/api/assets/{without_last_frame.id}/last-frame",
        )

    assert response.status_code == 307
    assert response.headers["location"].endswith(
        "/projects/project/video/video-last-frame.png"
    )
    assert missing.status_code == 404


def test_storyboard_video_endpoints_return_not_found_for_missing_shot(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/missing/generate-video"
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "not_found"


def test_storyboard_reference_rejects_invalid_material_type(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id, shot_id = _create_project_with_shot(client, repository, project_payload)
    image = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
            url="mock://image.png",
            mime_type="image/png",
        )
    )

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/references",
        json={"kind": "video", "asset_id": image.id},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"


def test_storyboard_reference_upload_failure_is_sanitized(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    project_id, shot_id = _create_project_with_shot(client, repository, project_payload)
    test_asset_storage.client.fail_uploads = True

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot_id}/references/upload",
        params={"kind": "image", "filename": "ref.png", "mime_type": "image/png"},
        content=b"image-bytes",
        headers={"Content-Type": "application/octet-stream"},
    )

    assert response.status_code == 502
    payload_text = str(response.json())
    assert response.json()["detail"]["message"] == "reference asset upload failed"
    assert "simulated TOS failure" not in payload_text
    assert repository.list_project_assets(project_id) == []


def test_single_storyboard_video_generation_failure_is_sanitized_and_retryable(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
) -> None:
    with _client_with_generation(
        repository,
        FailingSingleShotVideoGenerationService(),
        test_asset_storage,
    ) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        shot = repository.replace_project_storyboard(project_id, [_shot(project_id, 1)])[0]

        failed_response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shot.id}/generate-video"
        )

    assert failed_response.status_code == 500
    response_text = str(failed_response.json())
    assert failed_response.json()["detail"]["message"] == (
        "storyboard shot video generation failed"
    )
    assert "sk-test-secret" not in response_text
    assert "raw provider payload" not in response_text

    failed_task = repository.list_project_tasks(project_id)[0]
    assert failed_task.status == Status.FAILED
    assert failed_task.error is not None
    task_error_text = failed_task.error.model_dump_json()
    assert failed_task.error.detail == "RuntimeError"
    assert "sk-test-secret" not in task_error_text
    assert "raw provider payload" not in task_error_text
    assert repository.get_storyboard_shot(project_id, shot.id).video_asset_id is None

    generation = RecordingSingleShotVideoGenerationService()
    with _client_with_generation(repository, generation, test_asset_storage) as client:
        retry_response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shot.id}/generate-video"
        )

    assert retry_response.status_code == 200
    retried_task = retry_response.json()
    assert retried_task["id"] != failed_task.id
    assert retried_task["status"] == "succeeded"
    assert repository.get_storyboard_shot(project_id, shot.id).video_asset_id is not None


def test_single_storyboard_video_provider_error_is_logged_and_persisted_safely(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
    test_asset_storage,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.ERROR, logger="backend.app.api.routes")
    with _client_with_generation(
        repository,
        StructuredFailingVideoGenerationService(),
        test_asset_storage,
    ) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        shot = repository.replace_project_storyboard(project_id, [_shot(project_id, 1)])[0]
        response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shot.id}/generate-video"
        )

    expected_detail = (
        "provider_code=RateLimitExceeded; request_id=request-safe-456; "
        "provider_task_id=cgt-safe-789; phase=poll"
    )
    assert response.status_code == 500
    assert response.json()["detail"]["detail"] == expected_detail
    task = repository.list_project_tasks(project_id)[0]
    assert task.error is not None
    assert task.error.detail == expected_detail
    log_text = caplog.text
    assert "modelark_video_generation_failed" in log_text
    assert task.id in log_text
    assert "RateLimitExceeded" in log_text
    assert "request-safe-456" in log_text
    assert "sk-provider-secret" not in log_text
    assert "raw provider response" not in log_text


def _seed_four_shots(
    repository: InMemoryRepository,
    project_id: str,
) -> list:
    return repository.replace_project_storyboard(
        project_id,
        [
            _shot(
                project_id,
                1,
                title="Opening",
                duration_seconds=8.0,
                description="Hook the viewer",
                visual_prompt="wide establishing shot",
                narration="Meet the product.",
            ),
            _shot(
                project_id,
                2,
                title="Feature",
                duration_seconds=10.0,
                description="Show the key feature",
                visual_prompt="close-up on UI",
                narration="It just works.",
            ),
            _shot(
                project_id,
                3,
                title="Proof",
                duration_seconds=12.0,
                description="Customer testimonial",
                visual_prompt="talking head",
                narration=None,
            ),
            _shot(
                project_id,
                4,
                title="CTA",
                duration_seconds=6.0,
                description="Call to action",
                visual_prompt="logo lockup",
                narration="Download today.",
            ),
        ],
    )


def test_merge_adjacent_shots_concatenates_script_and_clears_media(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = _seed_four_shots(repository, project_id)

    # Attach references / first frame / generated video to the shots that will merge.
    image = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
            url="mock://ref.png",
            mime_type="image/png",
        )
    )
    video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://clip.mp4",
            mime_type="video/mp4",
        )
    )
    repository.attach_storyboard_shot_reference(
        project_id,
        shots[0].id,
        kind=ReferenceAssetKind.IMAGE,
        asset_id=image.id,
    )
    repository.save_storyboard_shot_video_config(
        project_id,
        shots[0].id,
        StoryboardShotVideoConfigUpdate(
            video_prompt="keep this prompt away after merge"
        ),
    )
    repository.set_storyboard_shot_video_asset(project_id, shots[1].id, video.id)

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [shots[0].id, shots[1].id]},
    )

    assert response.status_code == 200
    body = response.json()
    board = sorted(body["storyboard"], key=lambda item: item["index"])
    # Two shots collapse into one → three shots remain, contiguous indices.
    assert [shot["index"] for shot in board] == [1, 2, 3]

    merged = board[0]
    assert merged["title"] == "镜头 1-2"
    assert merged["duration_seconds"] == 18.0
    assert merged["description"] == "Hook the viewer\nShow the key feature"
    assert merged["visual_prompt"] == "wide establishing shot\nclose-up on UI"
    assert merged["narration"] == "Meet the product.\nIt just works."
    assert "[0s-8s]" in merged["video_prompt"]
    assert "[8s-18s]" in merged["video_prompt"]
    assert "创作意图：keep this prompt away after merge" in merged["video_prompt"]
    assert "【语音】" in merged["video_prompt"]
    assert "生成自然、清晰的普通话语音" in merged["video_prompt"]
    assert "字幕使用简体中文" not in merged["video_prompt"]
    assert merged["reference_image_asset_ids"] == []
    assert merged["reference_video_asset_ids"] == []
    assert merged["reference_audio_asset_ids"] == []
    assert merged["first_frame_asset_id"] is None
    assert merged["video_asset_id"] is None
    assert merged["status"] == Status.DRAFT.value

    # The trailing shots keep their content but shift down by one.
    assert board[1]["title"] == "Proof"
    assert board[2]["title"] == "CTA"

    # Detaching references does not delete the underlying asset files.
    assert repository.get_asset(image.id).id == image.id
    assert repository.get_asset(video.id).id == video.id


def test_merge_rejects_non_adjacent_shots(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = _seed_four_shots(repository, project_id)

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [shots[0].id, shots[2].id]},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "validation_error"
    assert "adjacent" in response.json()["detail"]["message"]
    # Storyboard is untouched.
    assert len(repository.list_project_storyboard(project_id)) == 4


def test_merge_rejects_when_duration_exceeds_limit(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = _seed_four_shots(repository, project_id)

    # Shots 2 (10s) + 3 (12s) + 4 (6s) = 28s is fine, but add shot 1 (8s) → 36s.
    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [shot.id for shot in shots]},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "validation_error"
    assert "30" in response.json()["detail"]["message"]
    assert "36" in response.json()["detail"]["message"]
    assert len(repository.list_project_storyboard(project_id)) == 4


def test_merge_allows_total_equal_to_limit(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = repository.replace_project_storyboard(
        project_id,
        [
            _shot(project_id, 1, duration_seconds=15.0),
            _shot(project_id, 2, duration_seconds=15.0),
        ],
    )

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [shots[0].id, shots[1].id]},
    )

    assert response.status_code == 200
    board = response.json()["storyboard"]
    assert len(board) == 1
    assert board[0]["duration_seconds"] == 30.0


def test_merge_rejects_unknown_shot_ids(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = _seed_four_shots(repository, project_id)

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [shots[0].id, "missing-shot"]},
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "not_found"


def test_merge_updates_storyboard_text_and_marks_only_affected_videos_stale(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = _seed_four_shots(repository, project_id)

    storyboard_artifact = repository.create_text_artifact(
        TextArtifactCreate(
            project_id=project_id,
            stage=Stage.STORYBOARD,
            title="Storyboard",
            content="original storyboard content",
            status=Status.SUCCEEDED,
        )
    )
    affected_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://affected.mp4",
            mime_type="video/mp4",
            metadata={"shot_id": shots[0].id, "shot_index": 1},
        )
    )
    unaffected_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://unaffected.mp4",
            mime_type="video/mp4",
            metadata={"shot_id": shots[2].id, "shot_index": 3},
        )
    )
    final_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.FINAL_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.COMPOSE,
            url="mock://final.mp4",
            mime_type="video/mp4",
        )
    )
    repository.set_storyboard_shot_video_asset(
        project_id,
        shots[0].id,
        affected_video.id,
    )
    repository.set_storyboard_shot_video_asset(
        project_id,
        shots[2].id,
        unaffected_video.id,
    )

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [shots[0].id, shots[1].id]},
    )
    assert response.status_code == 200

    refreshed = repository.get_text_artifact(storyboard_artifact.id)
    assert refreshed.version == storyboard_artifact.version + 1
    assert "镜头 1：镜头 1-2" in refreshed.content
    assert "画面描述：Hook the viewer" in refreshed.content

    assert repository.get_asset(affected_video.id).status == Status.STALE
    assert repository.get_asset(unaffected_video.id).status == Status.SUCCEEDED
    assert repository.get_asset(final_video.id).status == Status.STALE


def test_merge_marks_only_affected_videos_stale_without_storyboard_text(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = _seed_four_shots(repository, project_id)
    affected_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://affected.mp4",
            mime_type="video/mp4",
            metadata={"shot_id": shots[0].id, "shot_index": 1},
        )
    )
    unaffected_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://unaffected.mp4",
            mime_type="video/mp4",
            metadata={"shot_id": shots[2].id, "shot_index": 3},
        )
    )
    repository.set_storyboard_shot_video_asset(
        project_id,
        shots[0].id,
        affected_video.id,
    )
    repository.set_storyboard_shot_video_asset(
        project_id,
        shots[2].id,
        unaffected_video.id,
    )

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [shots[0].id, shots[1].id]},
    )

    assert response.status_code == 200
    assert repository.get_asset(affected_video.id).status == Status.STALE
    assert repository.get_asset(unaffected_video.id).status == Status.SUCCEEDED


def test_merge_requires_at_least_two_shots(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = _seed_four_shots(repository, project_id)

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [shots[0].id]},
    )

    assert response.status_code == 422


def test_merge_adjacent_shots_persists_in_mysql_repository(
    mysql_client: TestClient,
    mysql_repository,
    project_payload: dict[str, object],
) -> None:
    project_id = mysql_client.post("/api/projects", json=project_payload).json()["id"]
    shots = mysql_repository.replace_project_storyboard(
        project_id,
        [
            _shot(
                project_id,
                1,
                title="Opening",
                duration_seconds=8.0,
                description="Hook the viewer",
                visual_prompt="wide establishing shot",
                narration="Meet the product.",
            ),
            _shot(
                project_id,
                2,
                title="Feature",
                duration_seconds=10.0,
                description="Show the key feature",
                visual_prompt="close-up on UI",
                narration="It just works.",
            ),
            _shot(
                project_id,
                3,
                title="CTA",
                duration_seconds=6.0,
                description="Call to action",
                visual_prompt="logo lockup",
                narration="Download today.",
            ),
        ],
    )

    response = mysql_client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [shots[0].id, shots[1].id]},
    )

    assert response.status_code == 200
    persisted = sorted(
        mysql_repository.list_project_storyboard(project_id),
        key=lambda item: item.index,
    )
    assert [shot.index for shot in persisted] == [1, 2]
    merged = persisted[0]
    assert merged.title == "镜头 1-2"
    assert merged.duration_seconds == 18.0
    assert merged.description == "Hook the viewer\nShow the key feature"
    assert "[0s-8s]" in merged.video_prompt
    assert "[8s-18s]" in merged.video_prompt
    assert "【语音】" in merged.video_prompt
    assert "生成自然、清晰的普通话语音" in merged.video_prompt
    assert "字幕使用简体中文" not in merged.video_prompt
    assert merged.video_asset_id is None
    assert merged.reference_image_asset_ids == []
    assert merged.status == Status.DRAFT
    assert persisted[1].title == "CTA"


def test_merge_rejects_non_adjacent_shots_in_mysql_repository(
    mysql_client: TestClient,
    mysql_repository,
    project_payload: dict[str, object],
) -> None:
    project_id = mysql_client.post("/api/projects", json=project_payload).json()["id"]
    shots = mysql_repository.replace_project_storyboard(
        project_id,
        [
            _shot(project_id, 1, duration_seconds=5.0),
            _shot(project_id, 2, duration_seconds=5.0),
            _shot(project_id, 3, duration_seconds=5.0),
        ],
    )

    response = mysql_client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [shots[0].id, shots[2].id]},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "validation_error"
    assert len(mysql_repository.list_project_storyboard(project_id)) == 3


def test_mysql_merge_uses_project_brief_language(
    mysql_client: TestClient,
    mysql_repository,
    project_payload: dict[str, object],
) -> None:
    payload = {
        **project_payload,
        "brief": {
            **project_payload["brief"],
            "target_language": "en",
        },
    }
    project_id = mysql_client.post("/api/projects", json=payload).json()["id"]
    shots = mysql_repository.replace_project_storyboard(
        project_id,
        [
            _shot(project_id, 1, duration_seconds=3),
            _shot(project_id, 2, duration_seconds=4),
        ],
    )

    response = mysql_client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [shot.id for shot in shots]},
    )

    assert response.status_code == 200
    merged = mysql_repository.list_project_storyboard(project_id)[0]
    assert merged.title == "Shot 1-2"
    assert "[Overall Requirements]" in merged.video_prompt
    assert "[Continuous Timeline]" in merged.video_prompt
    assert "Generate natural, clear English speech" in merged.video_prompt
    assert "【整体要求】" not in merged.video_prompt


def test_merged_shot_can_split_back_to_atomic_script_state(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = _seed_four_shots(repository, project_id)
    original_ids = [shots[0].id, shots[1].id]

    merged_response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": original_ids},
    )
    assert merged_response.status_code == 200
    merged = sorted(
        merged_response.json()["storyboard"],
        key=lambda item: item["index"],
    )[0]
    assert merged["is_merged"] is True
    assert merged["merge_source_count"] == 2
    assert "[0s-8s]" in merged["video_prompt"]
    assert "[8s-18s]" in merged["video_prompt"]

    split_response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{merged['id']}/split"
    )
    assert split_response.status_code == 200
    board = sorted(
        split_response.json()["storyboard"],
        key=lambda item: item["index"],
    )
    restored = board[:2]
    assert [shot["id"] for shot in restored] == original_ids
    assert [shot["title"] for shot in restored] == ["Opening", "Feature"]
    assert [shot["duration_seconds"] for shot in restored] == [8.0, 10.0]
    assert [shot["index"] for shot in board] == [1, 2, 3, 4]
    for shot in restored:
        assert shot["is_merged"] is False
        assert shot["merge_source_count"] == 0
        assert shot["status"] == Status.DRAFT.value
        assert shot["image_asset_id"] is None
        assert shot["first_frame_asset_id"] is None
        assert shot["first_frame_source_video_asset_id"] is None
        assert shot["video_asset_id"] is None
        assert shot["reference_image_asset_ids"] == []
        assert shot["reference_video_asset_ids"] == []
        assert shot["reference_audio_asset_ids"] == []


def test_split_marks_only_affected_merged_video_stale(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = _seed_four_shots(repository, project_id)
    merged_response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [shots[0].id, shots[1].id]},
    )
    assert merged_response.status_code == 200
    board = sorted(
        merged_response.json()["storyboard"],
        key=lambda item: item["index"],
    )
    merged = board[0]
    unaffected = board[1]
    merged_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://merged.mp4",
            mime_type="video/mp4",
            metadata={"shot_id": merged["id"], "shot_index": 1},
        )
    )
    unaffected_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://unaffected.mp4",
            mime_type="video/mp4",
            metadata={"shot_id": unaffected["id"], "shot_index": 2},
        )
    )
    final_video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.FINAL_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.COMPOSE,
            url="mock://final.mp4",
            mime_type="video/mp4",
        )
    )
    repository.set_storyboard_shot_video_asset(
        project_id,
        merged["id"],
        merged_video.id,
    )
    repository.set_storyboard_shot_video_asset(
        project_id,
        unaffected["id"],
        unaffected_video.id,
    )

    split_response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{merged['id']}/split"
    )

    assert split_response.status_code == 200
    assert repository.get_asset(merged_video.id).status == Status.STALE
    assert repository.get_asset(unaffected_video.id).status == Status.SUCCEEDED
    assert repository.get_asset(final_video.id).status == Status.STALE


def test_nested_merge_flattens_and_splits_all_atomic_shots(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = _seed_four_shots(repository, project_id)
    original_ids = [shot.id for shot in shots[:3]]

    first_merge = client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": original_ids[:2]},
    )
    first_board = sorted(
        first_merge.json()["storyboard"],
        key=lambda item: item["index"],
    )
    second_merge = client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [first_board[0]["id"], first_board[1]["id"]]},
    )
    assert second_merge.status_code == 200
    merged = sorted(
        second_merge.json()["storyboard"],
        key=lambda item: item["index"],
    )[0]
    assert merged["merge_source_count"] == 3
    assert "[0s-8s]" in merged["video_prompt"]
    assert "[8s-18s]" in merged["video_prompt"]
    assert "[18s-30s]" in merged["video_prompt"]

    split = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{merged['id']}/split"
    )
    assert split.status_code == 200
    restored = sorted(
        split.json()["storyboard"],
        key=lambda item: item["index"],
    )
    assert [shot["id"] for shot in restored[:3]] == original_ids
    assert [shot["title"] for shot in restored[:3]] == [
        "Opening",
        "Feature",
        "Proof",
    ]


def test_split_rejects_shot_without_atomic_snapshot(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shot = _seed_four_shots(repository, project_id)[0]

    response = client.post(
        f"/api/projects/{project_id}/storyboard/shots/{shot.id}/split"
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "invalid_state"


def test_merged_prompt_update_requires_original_atomic_timeline(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shots = _seed_four_shots(repository, project_id)
    merged = client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": [shots[0].id, shots[1].id]},
    ).json()["storyboard"][0]

    invalid_prompt = merged["video_prompt"].replace("[8s-18s]", "[9s-18s]")
    invalid = client.patch(
        f"/api/projects/{project_id}/storyboard/shots/{merged['id']}/video-config",
        json={"video_prompt": invalid_prompt},
    )
    assert invalid.status_code == 400
    assert invalid.json()["detail"]["code"] == "validation_error"
    assert "时间轴空洞" in invalid.json()["detail"]["message"]

    cleared = client.patch(
        f"/api/projects/{project_id}/storyboard/shots/{merged['id']}/video-config",
        json={"video_prompt": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["video_prompt"] is None
    assert "[0s-8s]" in cleared.json()["effective_video_prompt"]
    assert "[8s-18s]" in cleared.json()["effective_video_prompt"]


def test_mysql_merged_shot_can_split_back_to_atomic_state(
    mysql_client: TestClient,
    mysql_repository,
    project_payload: dict[str, object],
) -> None:
    project_id = mysql_client.post("/api/projects", json=project_payload).json()["id"]
    shots = mysql_repository.replace_project_storyboard(
        project_id,
        [
            _shot(project_id, 1, title="Opening", duration_seconds=8.0),
            _shot(project_id, 2, title="Feature", duration_seconds=10.0),
            _shot(project_id, 3, title="CTA", duration_seconds=6.0),
        ],
    )
    original_ids = [shots[0].id, shots[1].id]
    merged = mysql_client.post(
        f"/api/projects/{project_id}/storyboard/shots/merge",
        json={"shot_ids": original_ids},
    ).json()["storyboard"][0]

    response = mysql_client.post(
        f"/api/projects/{project_id}/storyboard/shots/{merged['id']}/split"
    )

    assert response.status_code == 200
    persisted = sorted(
        mysql_repository.list_project_storyboard(project_id),
        key=lambda item: item.index,
    )
    assert [shot.id for shot in persisted[:2]] == original_ids
    assert [shot.index for shot in persisted] == [1, 2, 3]
    assert all(not shot.merge_source_shots for shot in persisted)


class RecordingSingleShotVideoGenerationService(ModelArkGenerationService):
    def __init__(self, *, last_frame_url: str | None = None) -> None:
        self.requests = []
        self.last_frame_url = last_frame_url

    async def generate_storyboard_shot_video_asset(
        self,
        project_id: str,
        brief: Brief,
        shot: StoryboardShotCreate,
        **kwargs,
    ) -> StoryboardVideoGenerationResult:
        self.requests.append((project_id, brief, shot, kwargs))
        return StoryboardVideoGenerationResult(
            asset=AssetCreate(
                project_id=project_id,
                type=AssetType.STORYBOARD_VIDEO,
                status=Status.SUCCEEDED,
                stage=Stage.VIDEO,
                url=(
                    f"mock://modelark/{project_id}/videos/"
                    f"shot-{shot.index:02d}.mp4"
                ),
                mime_type="video/mp4",
                metadata={
                    "provider": "test",
                    "shot_index": shot.index,
                    "duration_seconds": shot.duration_seconds,
                },
            ),
            last_frame_url=self.last_frame_url,
        )

    async def edit_storyboard_shot_video_asset(
        self,
        project_id: str,
        brief: Brief,
        shot: StoryboardShotCreate,
        **kwargs,
    ) -> StoryboardVideoGenerationResult:
        self.requests.append((project_id, brief, shot, kwargs))
        return StoryboardVideoGenerationResult(
            asset=AssetCreate(
                project_id=project_id,
                type=AssetType.STORYBOARD_VIDEO,
                status=Status.SUCCEEDED,
                stage=Stage.VIDEO,
                url=(
                    f"mock://modelark/{project_id}/videos/"
                    f"shot-{shot.index:02d}-edited.mp4"
                ),
                mime_type="video/mp4",
                metadata={
                    "provider": "test",
                    "operation": "video_edit",
                    "duration_seconds": shot.duration_seconds,
                },
            ),
            last_frame_url=self.last_frame_url,
        )


class FailingSingleShotVideoGenerationService(ModelArkGenerationService):
    async def generate_storyboard_shot_video_asset(
        self,
        *args,
        **kwargs,
    ) -> StoryboardVideoGenerationResult:
        _ = (args, kwargs)
        raise RuntimeError("video provider failed with sk-test-secret raw provider payload")


class StructuredFailingVideoGenerationService(ModelArkGenerationService):
    async def generate_storyboard_shot_video_asset(
        self,
        *args,
        **kwargs,
    ) -> StoryboardVideoGenerationResult:
        _ = (args, kwargs)
        error = ModelArkProviderError(
            "raw provider response with sk-provider-secret",
            phase="poll",
            provider_code="RateLimitExceeded",
            request_id="request-safe-456",
            provider_task_id="cgt-safe-789",
        )
        raise error


@contextmanager
def _client_with_generation(
    repository: InMemoryRepository,
    generation_service: object,
    asset_storage,
) -> Generator[TestClient, None, None]:
    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_asset_storage_service] = lambda: asset_storage
    app.dependency_overrides[get_workflow_service] = lambda: WorkflowService(
        repository,
        asset_storage,
    )
    app.dependency_overrides[get_modelark_generation_service] = lambda: generation_service

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def _create_project_with_shot(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> tuple[str, str]:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    shot = repository.replace_project_storyboard(project_id, [_shot(project_id, 1)])[0]
    return project_id, shot.id


def _shot(
    project_id: str,
    index: int,
    *,
    title: str = "Opening",
    duration_seconds: float = 3.0,
    description: str | None = None,
    visual_prompt: str | None = None,
    narration: str | None = None,
) -> StoryboardShotCreate:
    return StoryboardShotCreate(
        project_id=project_id,
        index=index,
        title=title,
        description=description or "Opening shot with product and user context",
        visual_prompt=visual_prompt or "documentary product close-up",
        narration=narration if narration is not None else "Meet the product.",
        duration_seconds=duration_seconds,
        status=Status.DRAFT,
    )
