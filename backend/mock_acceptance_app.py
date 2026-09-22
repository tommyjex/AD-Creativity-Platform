import base64
import logging
import os
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from fastapi import HTTPException, Response

from backend.app.api.dependencies import (
    get_asset_storage_service,
    get_modelark_generation_service,
    get_repository,
)
from backend.app.main import create_app
from backend.app.repositories import InMemoryRepository
from backend.app.schemas import (
    AssetCreate,
    AssetRole,
    AssetType,
    Status,
    ToolAssetRole,
)
from backend.app.services.assets import AssetStorageService
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.modelark import (
    AigcPromptOptimizationProviderResult,
    MockModelArkAdapter,
)


repository = InMemoryRepository()
ACCEPTANCE_BASE_URL = os.environ.get(
    "ACCEPTANCE_BASE_URL", "http://127.0.0.1:8003"
).rstrip("/")
TEST_IMAGE_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DA"
    "wMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg=="
)
TEST_IMAGE_ASSETS = {
    "task6-bbox-image-asset": "Task 6 BBox fixture",
    "prompt-optimization-image-a": "Prompt optimization image A",
    "prompt-optimization-image-b": "Prompt optimization image B",
}
GALLERY_ASSETS = {
    "home-gallery-landscape": {
        "bytes": b'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#123047"/><circle cx="1160" cy="310" r="180" fill="#35c6cb"/><path d="M0 680L440 350l270 210 260-170 630 290v220H0z" fill="#e69b3c"/></svg>',
        "height": 900,
        "mime_type": "image/svg+xml",
        "name": "海岸创意横幅",
        "type": AssetType.GENERATED_IMAGE,
        "width": 1600,
    },
    "home-gallery-square": {
        "bytes": b'<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><rect width="1080" height="1080" fill="#251b45"/><rect x="180" y="180" width="720" height="720" rx="28" fill="#dd4c73"/><circle cx="540" cy="540" r="220" fill="#f4cf57"/></svg>',
        "height": 1080,
        "mime_type": "image/svg+xml",
        "name": "夏日色彩方图",
        "type": AssetType.GENERATED_IMAGE,
        "width": 1080,
    },
    "home-gallery-wide": {
        "bytes": b'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="800"><rect width="1920" height="800" fill="#0c1825"/><path d="M0 640C430 290 930 950 1280 430s490-90 640-360v730H0z" fill="#67ba79"/><path d="M0 710C500 500 1100 1020 1920 520v280H0z" fill="#27b8c5"/></svg>',
        "height": 800,
        "mime_type": "image/svg+xml",
        "name": "山谷风景宽图",
        "type": AssetType.GENERATED_IMAGE,
        "width": 1920,
    },
    "home-gallery-poster": {
        "bytes": b'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500"><rect width="1200" height="1500" fill="#321721"/><path d="M80 1250L540 330l580 920z" fill="#b84468"/><circle cx="620" cy="560" r="230" fill="#ecb158"/></svg>',
        "height": 1500,
        "mime_type": "image/svg+xml",
        "name": "几何海报",
        "type": AssetType.GENERATED_IMAGE,
        "width": 1200,
    },
    "home-gallery-portrait": {
        "bytes": b'<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="#071921"/><rect x="135" y="160" width="810" height="1600" rx="36" fill="#0f4b62"/><circle cx="540" cy="590" r="300" fill="#e15986"/><path d="M150 1500l390-450 390 450v180H150z" fill="#f1be5c"/></svg>',
        "height": 1920,
        "mime_type": "image/svg+xml",
        "name": "夜色人物竖图",
        "type": AssetType.GENERATED_IMAGE,
        "width": 1080,
    },
    "home-gallery-video": {
        "bytes": (Path(__file__).resolve().parent.parent / "frontend/public/acceptance/aigc-video-fullscreen.mp4").read_bytes(),
        "height": 720,
        "mime_type": "video/mp4",
        "name": "城市光影视频",
        "type": AssetType.STORYBOARD_VIDEO,
        "width": 1280,
    },
}
for asset_id, name in TEST_IMAGE_ASSETS.items():
    repository.create_asset(
        AssetCreate(
            id=asset_id,
            type=AssetType.UPLOADED_IMAGE,
            asset_role=AssetRole.PUBLIC,
            tool_asset_role=ToolAssetRole.INPUT,
            status=Status.SUCCEEDED,
            object_key=f"acceptance/{asset_id}.png",
            mime_type="image/png",
            size_bytes=len(TEST_IMAGE_BYTES),
            metadata={
                "name": name,
                "origin": "aigc",
            },
        )
    )
for asset_id, fixture in GALLERY_ASSETS.items():
    repository.create_asset(
        AssetCreate(
            id=asset_id,
            type=fixture["type"],
            asset_role=AssetRole.PUBLIC,
            tool_asset_role=ToolAssetRole.OUTPUT,
            status=Status.SUCCEEDED,
            object_key=f"acceptance/{asset_id}",
            mime_type=fixture["mime_type"],
            size_bytes=len(fixture["bytes"]),
            metadata={
                "height": fixture["height"],
                "name": fixture["name"],
                "origin": "aigc",
                "width": fixture["width"],
            },
        )
    )


class AcceptanceObjectStorage:
    def put_object(
        self,
        *,
        key: str,
        content: bytes,
        content_type: str | None = None,
    ) -> None:
        raise RuntimeError("acceptance object storage is read-only")

    def delete_object(self, *, key: str) -> None:
        raise RuntimeError("acceptance object storage is read-only")

    def get_object(self, *, key: str) -> bytes:
        asset_id = key.removeprefix("acceptance/").removesuffix(".png")
        if asset_id in TEST_IMAGE_ASSETS:
            return TEST_IMAGE_BYTES
        if asset_id in GALLERY_ASSETS:
            return GALLERY_ASSETS[asset_id]["bytes"]
        raise KeyError(key)

    def signed_url(self, *, key: str, expires: int = 3600) -> str:
        asset_id = key.removeprefix("acceptance/").removesuffix(".png")
        return (
            f"{ACCEPTANCE_BASE_URL}/api/_acceptance/assets/{asset_id}/content"
        )


class AcceptanceAssetStorage(AssetStorageService):
    def with_access_url(self, asset):
        if asset.id in TEST_IMAGE_ASSETS or asset.id in GALLERY_ASSETS:
            return asset.model_copy(
                update={
                    "url": f"/api/assets/{asset.id}/content",
                },
                deep=True,
            )
        return super().with_access_url(asset)


class AcceptanceAuditHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__(logging.INFO)
        self.records: list[dict[str, object]] = []

    def emit(self, record: logging.LogRecord) -> None:
        if not record.getMessage().startswith("AIGC prompt optimization"):
            return
        allowed = (
            "target_type",
            "operation",
            "reference_image_count",
            "optimization_mode",
            "has_source_image",
            "warning_code",
        )
        self.records.append(
            {
                "message": record.getMessage(),
                **{
                    field: getattr(record, field)
                    for field in allowed
                    if hasattr(record, field)
                },
            }
        )


class AuditedMockModelArkAdapter(MockModelArkAdapter):
    def __init__(self) -> None:
        super().__init__()
        self.optimization_calls: list[dict[str, object]] = []
        self.image_generation_calls = 0

    async def optimize_aigc_prompt(
        self,
        request,
        *,
        source_image_url: str | None = None,
    ) -> AigcPromptOptimizationProviderResult:
        self.optimization_calls.append(
            {
                "target_type": request.target_type,
                "operation": getattr(request.target_config, "operation", None),
                "reference_image_count": getattr(
                    request.target_config,
                    "reference_image_count",
                    0,
                ),
                "input_image_count": int(source_image_url is not None),
            }
        )
        return await super().optimize_aigc_prompt(
            request,
            source_image_url=source_image_url,
        )

    async def generate_image(self, *args: Any, **kwargs: Any):
        self.image_generation_calls += 1
        return await super().generate_image(*args, **kwargs)

    async def generate_project_image(self, *args: Any, **kwargs: Any):
        self.image_generation_calls += 1
        return await super().generate_project_image(*args, **kwargs)


asset_storage = AcceptanceAssetStorage(
    bucket="acceptance",
    client=AcceptanceObjectStorage(),
)
adapter = AuditedMockModelArkAdapter()
generation_service = ModelArkGenerationService(adapter=adapter)
audit_handler = AcceptanceAuditHandler()
generation_logger = logging.getLogger("backend.app.services.generation")
generation_logger.addHandler(audit_handler)
generation_logger.setLevel(logging.INFO)

app = create_app()
app.dependency_overrides[get_repository] = lambda: repository
app.dependency_overrides[get_asset_storage_service] = lambda: asset_storage
app.dependency_overrides[get_modelark_generation_service] = lambda: generation_service


@app.get("/api/_acceptance/assets/{asset_id}/content", include_in_schema=False)
def get_acceptance_asset_content(asset_id: str) -> Response:
    if asset_id in TEST_IMAGE_ASSETS:
        return Response(
            TEST_IMAGE_BYTES,
            media_type="image/png",
            headers={"Cache-Control": "no-store"},
        )
    fixture = GALLERY_ASSETS.get(asset_id)
    if fixture is None:
        raise HTTPException(status_code=404, detail="acceptance asset not found")
    return Response(
        fixture["bytes"],
        media_type=fixture["mime_type"],
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/_acceptance/audit", include_in_schema=False)
def get_acceptance_audit() -> Mapping[str, object]:
    return {
        "provider": {
            "optimization_calls": adapter.optimization_calls,
            "image_generation_calls": adapter.image_generation_calls,
        },
        "logs": audit_handler.records,
        "persistence": {
            "assets": len(repository._assets),
            "pipelines": len(repository._aigc_pipelines),
            "runs": len(repository._aigc_runs),
            "tasks": len(repository._aigc_tasks),
            "tool_tasks": len(repository._tool_tasks),
        },
    }
