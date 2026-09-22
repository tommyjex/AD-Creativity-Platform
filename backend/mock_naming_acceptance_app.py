import base64
import os
from pathlib import Path
from typing import Any

from fastapi import HTTPException, Response

from backend.app.api.dependencies import (
    get_aigc_pipeline_runtime,
    get_asset_storage_service,
    get_repository,
)
from backend.app.main import create_app
from backend.app.repositories import InMemoryRepository
from backend.app.schemas import (
    AigcAssetDirection,
    AigcGeneratedMediaNamingResult,
    AigcGeneratedMediaNamingStatus,
    AigcPipelineCreate,
    AigcPipelineDefinitionV2,
    AigcPipelineRun,
    AigcPipelineRunNode,
    AigcPipelineRunStatus,
    AigcPipelineTaskAssetReference,
    AigcPipelineTaskAttempt,
    AigcResultAsset,
    AigcResultKind,
    AigcRunNodeStatus,
    AigcTaskMetrics,
    AigcTaskResult,
    AigcTaskType,
    AssetCreate,
    AssetRole,
    AssetType,
    Status,
    ToolAssetRole,
)
from backend.app.schemas.common import utc_now
from backend.app.services.assets import AssetStorageService


BACKEND_PORT = int(os.getenv("NAMING_ACCEPTANCE_BACKEND_PORT", "8010"))
BACKEND_URL = f"http://127.0.0.1:{BACKEND_PORT}"
IMAGE_ID = "naming-acceptance-image"
IMAGE_SECOND_ID = "naming-acceptance-image-2"
VIDEO_ID = "naming-acceptance-video"
HISTORICAL_ID = "naming-acceptance-historical"
IMAGE_NAME = "雨夜霓虹跑车"
VIDEO_NAME = "海岸日落短片"
HISTORICAL_NAME = "历史森林海报"
IMAGE_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DA"
    "wMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg=="
)
VIDEO_BYTES = (
    Path(__file__).parents[1]
    / "frontend"
    / "public"
    / "acceptance"
    / "aigc-video-fullscreen.mp4"
).read_bytes()


class AcceptanceObjectStorage:
    def get_object(self, *, key: str) -> bytes:
        if key in {
            f"acceptance/{IMAGE_ID}.png",
            f"acceptance/{IMAGE_SECOND_ID}.png",
            f"acceptance/{HISTORICAL_ID}.png",
        }:
            return IMAGE_BYTES
        if key == f"acceptance/{VIDEO_ID}.mp4":
            return VIDEO_BYTES
        raise KeyError(key)

    def signed_url(self, *, key: str, expires: int = 3600) -> str:
        del expires
        asset_id = Path(key).stem
        return f"{BACKEND_URL}/api/_acceptance/naming/raw/{asset_id}"

    def delete_object(self, *, key: str) -> None:
        del key


class NoopRuntime:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository

    async def start(self) -> bool:
        return True

    async def stop(self) -> None:
        return None


repository = InMemoryRepository()
asset_storage = AssetStorageService(
    bucket="acceptance",
    client=AcceptanceObjectStorage(),
)

definition = AigcPipelineDefinitionV2.model_validate(
    {
        "schemaVersion": 2,
        "nodes": [
            {
                "id": "image-prompt",
                "type": "text",
                "position": {"x": 0, "y": 40},
                "size": {"width": 240, "height": 160},
                "config": {
                    "text": "雨夜霓虹街道中的红色跑车",
                    "bbox_references": [],
                    "title": None,
                },
            },
            {
                "id": "image-model",
                "type": "text_to_image",
                "custom_name": "运行中人工图片名",
                "position": {"x": 320, "y": 40},
                "size": {"width": 280, "height": 220},
                "config": {
                    "model": "doubao-seedream-5-0-pro-260628",
                    "aspect_ratio": "1:1",
                    "size": "2K",
                    "format": "png",
                },
            },
            {
                "id": "video-prompt",
                "type": "text",
                "position": {"x": 0, "y": 340},
                "size": {"width": 240, "height": 160},
                "config": {
                    "text": "海岸日落时的品牌短片",
                    "bbox_references": [],
                    "title": None,
                },
            },
            {
                "id": "video-model",
                "type": "video_generation",
                "custom_name": "运行中人工视频名",
                "position": {"x": 320, "y": 340},
                "size": {"width": 280, "height": 240},
                "config": {
                    "model": "doubao-seedance-2-5-260628",
                    "generation_mode": "text_to_video",
                    "resolution": "1080p",
                    "aspect_ratio": "16:9",
                    "duration_seconds": 12,
                    "generate_audio": True,
                },
            },
        ],
        "edges": [
            {
                "id": "image-prompt-model",
                "sourceNodeId": "image-prompt",
                "sourceHandle": "text",
                "targetNodeId": "image-model",
                "targetHandle": "prompt",
            },
            {
                "id": "video-prompt-model",
                "sourceNodeId": "video-prompt",
                "sourceHandle": "text",
                "targetNodeId": "video-model",
                "targetHandle": "prompt",
            },
        ],
        "viewport": {"x": 80, "y": 40, "zoom": 0.8},
    }
)
pipeline = repository.create_aigc_pipeline(
    AigcPipelineCreate(
        name="AIGC 智能命名 Mock 验收",
        description="仅使用内存数据和预制媒体，不调用生成或命名 Provider。",
        definition=definition,
    )
)
run_detail = repository.create_aigc_run(
    AigcPipelineRun(
        pipeline_id=pipeline.id,
        run_number=1,
        pipeline_revision=pipeline.revision,
        mode="full",
        status=AigcPipelineRunStatus.RUNNING,
        definition_snapshot=pipeline.definition,
        started_at=utc_now(),
    ),
    idempotency_key="naming-acceptance-run",
    nodes=[
        AigcPipelineRunNode(
            node_id=node.id,
            included_in_plan=True,
            status=(
                AigcRunNodeStatus.RUNNING
                if node.id in {"image-model", "video-model"}
                else AigcRunNodeStatus.SUCCEEDED
            ),
        )
        for node in pipeline.definition.nodes
    ],
)
lease = repository.acquire_aigc_worker_lease(
    "naming-acceptance",
    now=utc_now(),
    lease_seconds=3600,
)
assert lease is not None


def create_attempt(
    *,
    asset_id: str,
    asset_type: AssetType,
    mime_type: str,
    node_id: str,
    object_key: str,
    operation: str,
    task_type: AigcTaskType,
) -> AigcPipelineTaskAttempt:
    task = repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=pipeline.id,
            run_id=run_detail.run.id,
            node_id=node_id,
            type=task_type,
        ),
        idempotency_key=f"naming-acceptance-{node_id}",
    )
    assert repository.claim_aigc_task_attempt(
        task.task_id,
        fencing_token=lease.fencing_token,
    )
    repository.create_asset(
        AssetCreate(
            id=asset_id,
            type=asset_type,
            asset_role=AssetRole.PUBLIC,
            tool_asset_role=ToolAssetRole.OUTPUT,
            status=Status.DRAFT,
            object_key=object_key,
            mime_type=mime_type,
            metadata={
                "origin": "aigc",
                "operation": operation,
                "pipeline_id": pipeline.id,
                "run_id": run_detail.run.id,
                "node_id": node_id,
                "task_id": task.task_id,
            },
        )
    )
    repository.add_aigc_task_assets(
        [
            AigcPipelineTaskAssetReference(
                task_id=task.task_id,
                direction=AigcAssetDirection.OUTPUT,
                slot="image" if mime_type.startswith("image/") else "video",
                ordinal=0,
                asset_id=asset_id,
            )
        ]
    )
    return task


image_task = create_attempt(
    asset_id=IMAGE_ID,
    asset_type=AssetType.GENERATED_IMAGE,
    mime_type="image/png",
    node_id="image-model",
    object_key=f"acceptance/{IMAGE_ID}.png",
    operation="text_to_image",
    task_type=AigcTaskType.TEXT_TO_IMAGE,
)
repository.create_asset(
    AssetCreate(
        id=IMAGE_SECOND_ID,
        type=AssetType.GENERATED_IMAGE,
        asset_role=AssetRole.PUBLIC,
        tool_asset_role=ToolAssetRole.OUTPUT,
        status=Status.DRAFT,
        object_key=f"acceptance/{IMAGE_SECOND_ID}.png",
        mime_type="image/png",
        metadata={
            "origin": "aigc",
            "operation": "text_to_image",
            "pipeline_id": pipeline.id,
            "run_id": run_detail.run.id,
            "node_id": "image-model",
            "task_id": image_task.task_id,
        },
    )
)
repository.add_aigc_task_assets(
    [
        AigcPipelineTaskAssetReference(
            task_id=image_task.task_id,
            direction=AigcAssetDirection.OUTPUT,
            slot="image",
            ordinal=1,
            asset_id=IMAGE_SECOND_ID,
        )
    ]
)
video_task = create_attempt(
    asset_id=VIDEO_ID,
    asset_type=AssetType.STORYBOARD_VIDEO,
    mime_type="video/mp4",
    node_id="video-model",
    object_key=f"acceptance/{VIDEO_ID}.mp4",
    operation="video_generation",
    task_type=AigcTaskType.VIDEO_GENERATION,
)
repository.create_asset(
    AssetCreate(
        id=HISTORICAL_ID,
        type=AssetType.GENERATED_IMAGE,
        asset_role=AssetRole.PUBLIC,
        tool_asset_role=ToolAssetRole.OUTPUT,
        status=Status.SUCCEEDED,
        object_key=f"acceptance/{HISTORICAL_ID}.png",
        mime_type="image/png",
        metadata={
            "origin": "aigc",
            "operation": "text_to_image",
            "pipeline_id": "deleted-pipeline",
            "node_id": "deleted-node",
            "generated_name": HISTORICAL_NAME,
            "name": f"{HISTORICAL_NAME}.png",
            "name_scheme": "aigc_generated_node_v2",
            "name_source": "ai",
            "naming_model": "doubao-seed-2-0-mini-260428",
            "naming_status": "succeeded",
            "output_ordinal": 0,
        },
    )
)

app = create_app()
app.dependency_overrides[get_repository] = lambda: repository
app.dependency_overrides[get_asset_storage_service] = lambda: asset_storage
app.dependency_overrides[get_aigc_pipeline_runtime] = lambda: NoopRuntime(
    repository
)
committed = False


def result_for(
    asset_id: str,
    mime_type: str,
    node_id: str,
    name: str,
    *,
    additional_asset_ids: tuple[str, ...] = (),
) -> AigcTaskResult:
    return AigcTaskResult(
        kind=AigcResultKind.ASSETS,
        naming=AigcGeneratedMediaNamingResult(
            status=AigcGeneratedMediaNamingStatus.SUCCEEDED,
            name=name,
        ),
        assets=[
            AigcResultAsset(
                asset_id=current_asset_id,
                ordinal=ordinal,
                mime_type=mime_type,
                download_url=f"/api/assets/{current_asset_id}/content",
                available=True,
                metadata={"node_id": node_id},
            )
            for ordinal, current_asset_id in enumerate(
                (asset_id, *additional_asset_ids)
            )
        ],
    )


def prepare_run_snapshot() -> dict[str, Any]:
    current_pipeline = repository.get_aigc_pipeline(pipeline.id)
    repository.update_aigc_run(
        run_detail.run.id,
        pipeline_revision=current_pipeline.revision,
        definition_snapshot=current_pipeline.definition,
    )
    return manifest()


@app.post("/api/_acceptance/naming/prepare", include_in_schema=False)
def prepare_generated_names() -> dict[str, Any]:
    return prepare_run_snapshot()


@app.post("/api/_acceptance/naming/commit", include_in_schema=False)
def commit_generated_names() -> dict[str, Any]:
    global committed
    if not committed:
        prepare_run_snapshot()
        for task, result in (
            (
                image_task,
                result_for(
                    IMAGE_ID,
                    "image/png",
                    "image-model",
                    IMAGE_NAME,
                    additional_asset_ids=(IMAGE_SECOND_ID,),
                ),
            ),
            (
                video_task,
                result_for(VIDEO_ID, "video/mp4", "video-model", VIDEO_NAME),
            ),
        ):
            _, accepted = repository.commit_aigc_generated_media_task_attempt(
                task.task_id,
                fencing_token=lease.fencing_token,
                result=result,
                metrics=AigcTaskMetrics(duration_ms=120),
            )
            if not accepted:
                raise HTTPException(status_code=409, detail="commit rejected")
            repository.update_aigc_run_node(
                run_detail.run.id,
                task.node_id,
                status=AigcRunNodeStatus.SUCCEEDED,
                result=result,
            )
        repository.update_aigc_run(
            run_detail.run.id,
            status=AigcPipelineRunStatus.SUCCEEDED,
            finished_at=utc_now(),
        )
        committed = True
    return manifest()


@app.get("/api/_acceptance/naming/manifest", include_in_schema=False)
def manifest() -> dict[str, Any]:
    current = repository.get_aigc_pipeline(pipeline.id)
    return {
        "committed": committed,
        "pipeline_id": pipeline.id,
        "run_id": run_detail.run.id,
        "revision": current.revision,
        "image": {
            "asset_id": IMAGE_ID,
            "asset_ids": [IMAGE_ID, IMAGE_SECOND_ID],
            "name": IMAGE_NAME,
        },
        "video": {"asset_id": VIDEO_ID, "name": VIDEO_NAME},
        "historical": {
            "asset_id": HISTORICAL_ID,
            "name": HISTORICAL_NAME,
        },
        "provider_calls": 0,
    }


@app.get("/api/_acceptance/naming/asset/{asset_id}", include_in_schema=False)
def inspect_asset(asset_id: str) -> dict[str, Any]:
    asset = repository.get_asset(asset_id)
    return {
        "id": asset.id,
        "status": asset.status.value,
        "metadata": asset.metadata,
    }


@app.get("/api/_acceptance/naming/raw/{asset_id}", include_in_schema=False)
def raw_asset(asset_id: str) -> Response:
    asset = repository.get_asset(asset_id)
    if not asset.object_key:
        raise HTTPException(status_code=404, detail="asset content unavailable")
    try:
        content = asset_storage.client.get_object(key=asset.object_key)
    except KeyError as exc:
        raise HTTPException(
            status_code=404,
            detail="asset content unavailable",
        ) from exc
    return Response(content=content, media_type=asset.mime_type)
