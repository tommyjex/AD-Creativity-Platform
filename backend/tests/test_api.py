import asyncio
import json
from collections.abc import Generator, Iterable
from contextlib import contextmanager

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from backend.app.api.dependencies import (
    get_asset_storage_service,
    get_composer_service,
    get_modelark_generation_service,
    get_repository,
    get_workflow_service,
)
from backend.app.api.routes import _http_error
from backend.app.main import create_app
from backend.app.repositories import InMemoryRepository, MySQLRepository
from backend.app.schemas import (
    AssetCreate,
    AssetCategory,
    AssetType,
    Brief,
    ErrorCode,
    Stage,
    Status,
    StoryboardShotCreate,
    TextArtifactCreate,
)
from backend.app.services.generation import (
    ModelArkGenerationService,
    StoryboardGenerationResult,
)
from backend.app.services.assets import AssetStorageService
from backend.app.services.composer import VideoCompositionError
from backend.app.services.workflow import WorkflowService


def _sse_events(response) -> list[tuple[str, dict[str, object]]]:
    events = []
    for block in response.text.strip().split("\n\n"):
        lines = block.splitlines()
        event = next(line[7:] for line in lines if line.startswith("event: "))
        data = "\n".join(line[6:] for line in lines if line.startswith("data: "))
        events.append((event, json.loads(data)))
    return events


def _sse_complete_task(response) -> dict[str, object]:
    complete = [
        data for event, data in _sse_events(response) if event == "complete"
    ]
    assert len(complete) == 1
    task = complete[0]["task"]
    assert isinstance(task, dict)
    return task


def _sse_error(response) -> dict[str, object]:
    errors = [data for event, data in _sse_events(response) if event == "error"]
    assert len(errors) == 1
    return errors[0]


def test_health_check_returns_app_metadata(client: TestClient) -> None:
    response = client.get("/health", headers={"X-Request-ID": "request-1"})

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "name": "AD Creativity Backend",
        "version": "0.1.0",
    }
    assert response.headers["X-Request-ID"] == "request-1"
    assert "X-Process-Time" in response.headers


def test_project_api_creates_reads_and_lists_assets(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    created = client.post("/api/projects", json=project_payload)

    assert created.status_code == 201
    project = created.json()
    assert project["name"] == "Launch Campaign"
    assert project["brief"]["product_name"] == "AdPilot"
    assert project["status"] == "draft"
    assert project["current_stage"] == "brief"

    fetched = client.get(f"/api/projects/{project['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == project["id"]

    assets = client.get(f"/api/projects/{project['id']}/assets")
    assert assets.status_code == 200
    assert assets.json() == []


def test_project_api_returns_not_found_for_missing_project(client: TestClient) -> None:
    response = client.get("/api/projects/missing-project")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "not_found"


def test_api_errors_redact_sensitive_credentials_and_signed_urls() -> None:
    signed_url = (
        "https://local-assets.tos.local/projects/p/asset.png"
        "?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=tos-ak"
        "&X-Tos-Signature=secret-signature"
    )
    error = _http_error(
        500,
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        (
            "provider raw sensitive error Ark Key=ark-secret-value "
            "TOS_AK=tos-access-value TOS_SK=tos-secret-value "
            "mysql://ad_user:db-password@db.internal/ad "
            f"{signed_url}"
        ),
        detail=(
            "vendor upstream sensitive failure sk-live-secret-value "
            "password=db-password token=raw-token"
        ),
    )

    body = str(error.detail)

    assert "ark-secret-value" not in body
    assert "tos-access-value" not in body
    assert "tos-secret-value" not in body
    assert "db-password" not in body
    assert "secret-signature" not in body
    assert "X-Tos-" not in body
    assert "raw-token" not in body
    assert "provider raw sensitive error" not in body
    assert "external provider error was redacted" in body


def test_generation_endpoint_rejects_missing_stage_dependency(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project = client.post("/api/projects", json=project_payload).json()

    response = client.post(f"/api/projects/{project['id']}/script")

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "dependency_missing"


def test_generation_api_runs_full_workflow_and_task_lookup(
    client: TestClient,
    background_task_runner,
    project_payload: dict[str, object],
    video_composer,
) -> None:
    project = client.post("/api/projects", json=project_payload).json()
    project_id = project["id"]

    task_ids: list[str] = []
    for endpoint, stage in [
        ("story", "story"),
        ("characters", "character"),
        ("script", "script"),
        ("storyboard", "storyboard"),
        ("images", "image"),
        ("videos", "video"),
        ("compose", "compose"),
    ]:
        response = client.post(f"/api/projects/{project_id}/{endpoint}")
        assert response.status_code == 200
        task = (
            _sse_complete_task(response)
            if endpoint in {"story", "script", "storyboard"}
            else response.json()
        )
        if endpoint == "compose":
            assert task["status"] == "running"
            assert task["progress_message"] == "正在合成基础视频"
            asyncio.run(background_task_runner.run_pending())
            task = client.get(f"/api/tasks/{task['id']}").json()
        task_ids.append(task["id"])
        assert task["stage"] == stage
        assert task["status"] == "succeeded"
        assert task["progress"] == 1.0

    fetched_task = client.get(f"/api/tasks/{task_ids[-1]}")
    assert fetched_task.status_code == 200
    assert fetched_task.json()["id"] == task_ids[-1]

    fetched_project = client.get(f"/api/projects/{project_id}").json()
    assert fetched_project["current_stage"] == "compose"
    assert fetched_project["status"] == "succeeded"
    assert len(fetched_project["text_artifacts"]) == 3
    assert len(fetched_project["storyboard"]) == 4
    assert len(fetched_project["character_cards"]) == 1
    assert fetched_project["character_cards"][0]["asset_id"] is None
    assert len(fetched_project["assets"]) == 10
    assert all(
        asset["url"].startswith("/api/assets/")
        and asset["url"].endswith("/content")
        and "X-Tos-Signature" not in asset["url"]
        for asset in fetched_project["assets"]
    )

    assets = client.get(f"/api/projects/{project_id}/assets").json()
    assert {asset["stage"] for asset in assets} == {
        "image",
        "video",
        "compose",
    }
    assert all(asset["url"].startswith("/api/assets/") for asset in assets)
    assert all(asset["url"].endswith("/content") for asset in assets)
    assert all("X-Tos-Signature" not in asset["url"] for asset in assets)
    assert all(asset["object_key"].startswith(f"projects/{project_id}/") for asset in assets)
    assert all(asset["source_task_id"] in task_ids for asset in assets)
    assert all(asset["metadata"]["storage_provider"] == "tos" for asset in assets)
    for asset in assets:
        if asset["category"] == "character":
            assert asset["metadata"].get("source_host") == "modelark"
            assert "source_url" not in asset["metadata"]
        elif asset["stage"] == "compose":
            if asset["type"] == "final_video":
                assert asset["metadata"]["provider"] == "ffmpeg-composer"
                assert asset["metadata"]["compose_mode"] == "concat"
                assert asset["metadata"]["subtitle_mode"] == "burned"
            else:
                assert asset["type"] == "subtitle"
                assert asset["metadata"]["provider"] == "mediakit-asr"
                assert asset["metadata"]["subtitle_status"] == "available"
            assert "source_url" not in asset["metadata"]
            assert not asset["url"].startswith("mock://")
        else:
            assert asset["metadata"]["source_url"].startswith("mock://")
    assert len(video_composer.calls) == 2
    assert video_composer.calls[0]["source_indexes"] == [1, 2, 3, 4]
    assert video_composer.calls[1]["subtitle_mode"] == "burned"

    updated_project = client.patch(
        f"/api/projects/{project_id}",
        json={"name": "Signed Asset Campaign"},
    ).json()
    assert all(
        "X-Tos-Signature" not in asset["url"]
        for asset in updated_project["assets"]
    )

    global_assets = client.get(
        "/api/assets",
        params={"project_id": project_id},
    ).json()
    assert all("X-Tos-Signature" not in asset["url"] for asset in global_assets)
    assert all(asset["url"].startswith("/api/assets/") for asset in global_assets)


def test_generation_api_runs_full_workflow_with_mysql_repository(
    mysql_client: TestClient,
    background_task_runner,
    mysql_session_factory: sessionmaker[Session],
    project_payload: dict[str, object],
) -> None:
    project = mysql_client.post("/api/projects", json=project_payload).json()
    project_id = project["id"]

    task_ids: list[str] = []
    for endpoint in [
        "story",
        "characters",
        "script",
        "storyboard",
        "images",
        "videos",
        "compose",
    ]:
        response = mysql_client.post(f"/api/projects/{project_id}/{endpoint}")
        assert response.status_code == 200
        task = (
            _sse_complete_task(response)
            if endpoint in {"story", "script", "storyboard"}
            else response.json()
        )
        if endpoint == "compose":
            assert task["status"] == "running"
            asyncio.run(background_task_runner.run_pending())
            task = mysql_client.get(f"/api/tasks/{task['id']}").json()
        task_ids.append(task["id"])
        assert task["status"] == "succeeded"

    fetched_task = mysql_client.get(f"/api/tasks/{task_ids[-1]}")
    assert fetched_task.status_code == 200
    assert fetched_task.json()["output_asset_ids"]

    assets_response = mysql_client.get(f"/api/projects/{project_id}/assets")
    assert assets_response.status_code == 200
    assets = assets_response.json()
    assert len(assets) == 10
    assert all(asset["url"].startswith("/api/assets/") for asset in assets)
    assert all(asset["url"].endswith("/content") for asset in assets)
    assert all("X-Tos-Signature" not in asset["url"] for asset in assets)
    assert all(asset["object_key"].startswith(f"projects/{project_id}/") for asset in assets)
    assert all(asset["metadata"]["storage_provider"] == "tos" for asset in assets)

    persisted = MySQLRepository(mysql_session_factory)
    saved_project = persisted.get_project(project_id)

    assert saved_project.current_stage.value == "compose"
    assert saved_project.status.value == "succeeded"
    assert [task.id for task in saved_project.tasks] == task_ids
    assert len(saved_project.text_artifacts) == 3
    assert len(saved_project.character_cards) == 1
    assert saved_project.character_cards[0].asset_id is None
    assert len(saved_project.storyboard) == 4
    assert len(saved_project.assets) == 10
    assert {asset.source_task_id for asset in saved_project.assets} <= set(task_ids)


def test_compose_failure_marks_task_failed_without_creating_asset(
    client: TestClient,
    background_task_runner,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    class FailingComposer:
        async def compose(self, **kwargs):
            raise VideoCompositionError(
                "FFmpeg composition failed",
                detail="phase=concat; returncode=1",
            )

    project = client.post("/api/projects", json=project_payload).json()
    project_id = project["id"]

    for endpoint in ["story", "characters", "script", "storyboard", "images", "videos"]:
        response = client.post(f"/api/projects/{project_id}/{endpoint}")
        assert response.status_code == 200

    asset_count_before = len(repository.list_project_assets(project_id))
    client.app.dependency_overrides[get_composer_service] = lambda: FailingComposer()

    response = client.post(f"/api/projects/{project_id}/compose")

    assert response.status_code == 200
    assert response.json()["status"] == "running"
    asyncio.run(background_task_runner.run_pending())
    assert len(repository.list_project_assets(project_id)) == asset_count_before
    compose_tasks = [
        task
        for task in repository.list_project_tasks(project_id)
        if task.stage == Stage.COMPOSE
    ]
    assert compose_tasks[-1].status == Status.FAILED
    assert compose_tasks[-1].error is not None
    assert compose_tasks[-1].error.message == "FFmpeg composition failed"
    assert compose_tasks[-1].error.detail == "phase=concat; returncode=1"


def test_generated_storyboard_images_persist_as_queryable_scene_assets(
    mysql_client: TestClient,
    mysql_session_factory: sessionmaker[Session],
    project_payload: dict[str, object],
) -> None:
    project_id = mysql_client.post("/api/projects", json=project_payload).json()["id"]

    for endpoint in ["story", "characters", "script", "storyboard"]:
        response = mysql_client.post(f"/api/projects/{project_id}/{endpoint}")
        assert response.status_code == 200

    image_response = mysql_client.post(f"/api/projects/{project_id}/images")
    assert image_response.status_code == 200
    image_task = image_response.json()

    persisted = MySQLRepository(mysql_session_factory)
    scene_assets = persisted.list_assets(
        project_id=project_id,
        category=AssetCategory.SCENE,
        status=Status.SUCCEEDED,
    )
    character_assets = persisted.list_assets(
        project_id=project_id,
        category=AssetCategory.CHARACTER,
        status=Status.SUCCEEDED,
    )

    assert [asset.id for asset in scene_assets] == image_task["output_asset_ids"]
    assert len(scene_assets) == 4
    assert all(asset.category == AssetCategory.SCENE for asset in scene_assets)
    assert character_assets == []
    assert all(
        asset.category == AssetCategory.CHARACTER for asset in character_assets
    )

    filtered_response = mysql_client.get(
        "/api/assets",
        params={
            "project_id": project_id,
            "category": "scene",
            "status": "succeeded",
        },
    )
    project_assets_response = mysql_client.get(
        f"/api/projects/{project_id}/assets"
    )

    assert filtered_response.status_code == 200
    assert [
        asset["id"] for asset in filtered_response.json()
    ] == image_task["output_asset_ids"]
    assert project_assets_response.status_code == 200
    assert len(project_assets_response.json()) == 4


def test_patch_story_updates_artifact_and_marks_downstream_stale(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]

    for endpoint in ["story", "characters", "script", "storyboard"]:
        response = client.post(f"/api/projects/{project_id}/{endpoint}")
        assert response.status_code == 200

    response = client.patch(
        f"/api/projects/{project_id}/story",
        json={"content": "编辑后的故事正文"},
    )

    assert response.status_code == 200
    project = response.json()
    story = _latest_artifact(project["text_artifacts"], "story")
    script = _latest_artifact(project["text_artifacts"], "script")
    storyboard = _latest_artifact(project["text_artifacts"], "storyboard")

    assert story["content"] == "编辑后的故事正文"
    assert story["version"] == 2
    assert story["status"] == "succeeded"
    assert script["status"] == "stale"
    assert storyboard["status"] == "stale"
    assert project["current_stage"] == "story"
    assert project["status"] == "stale"


def test_patch_script_updates_artifact_and_marks_storyboard_stale(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]

    for endpoint in ["story", "characters", "script", "storyboard"]:
        response = client.post(f"/api/projects/{project_id}/{endpoint}")
        assert response.status_code == 200

    response = client.patch(
        f"/api/projects/{project_id}/script",
        json={"content": "编辑后的剧本正文"},
    )

    assert response.status_code == 200
    project = response.json()
    story = _latest_artifact(project["text_artifacts"], "story")
    script = _latest_artifact(project["text_artifacts"], "script")
    storyboard = _latest_artifact(project["text_artifacts"], "storyboard")

    assert story["status"] == "succeeded"
    assert script["content"] == "编辑后的剧本正文"
    assert script["version"] == 2
    assert script["status"] == "succeeded"
    assert storyboard["status"] == "stale"
    assert project["current_stage"] == "script"
    assert project["status"] == "stale"


def test_patch_storyboard_updates_artifact_and_marks_images_stale(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]

    for endpoint in ["story", "characters", "script", "storyboard", "images"]:
        response = client.post(f"/api/projects/{project_id}/{endpoint}")
        assert response.status_code == 200

    response = client.patch(
        f"/api/projects/{project_id}/storyboard",
        json={"content": "编辑后的分镜脚本正文"},
    )

    assert response.status_code == 200
    project = response.json()
    storyboard = _latest_artifact(project["text_artifacts"], "storyboard")

    assert storyboard["content"] == "编辑后的分镜脚本正文"
    assert storyboard["version"] == 2
    assert storyboard["status"] == "succeeded"
    assert len(project["storyboard"]) == 4
    image_assets = [
        asset for asset in project["assets"] if asset["stage"] == "image"
    ]
    assert image_assets
    assert {asset["status"] for asset in image_assets} == {"stale"}
    assert project["current_stage"] == "storyboard"
    assert project["status"] == "stale"


def test_patch_text_artifact_returns_not_found_when_artifact_missing(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]

    response = client.patch(
        f"/api/projects/{project_id}/story",
        json={"content": "尚未生成故事时不能保存"},
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "not_found"


def test_patch_text_artifact_rejects_empty_content(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    client.post(f"/api/projects/{project_id}/story")

    response = client.patch(
        f"/api/projects/{project_id}/story",
        json={"content": ""},
    )

    assert response.status_code == 422


def _latest_artifact(
    artifacts: list[dict[str, object]],
    stage: str,
) -> dict[str, object]:
    return max(
        (artifact for artifact in artifacts if artifact["stage"] == stage),
        key=lambda artifact: int(artifact["version"]),
    )


class FailingStoryGenerationService:
    async def generate_story(
        self,
        project_id: str,
        brief: Brief,
        image_urls: list[str] | None = None,
    ) -> TextArtifactCreate:
        _ = (project_id, brief, image_urls)
        raise RuntimeError("story provider unavailable")


class FailingScriptGenerationService:
    async def generate_script(
        self,
        project_id: str,
        brief: Brief,
        story_content: str,
        image_urls: list[str] | None = None,
    ) -> TextArtifactCreate:
        _ = (project_id, brief, story_content, image_urls)
        raise RuntimeError("script provider unavailable")


class FailingStoryboardGenerationService:
    async def generate_storyboard(
        self,
        project_id: str,
        brief: Brief,
        script_content: str,
        image_urls: list[str] | None = None,
    ) -> StoryboardGenerationResult:
        _ = (project_id, brief, script_content, image_urls)
        raise RuntimeError("storyboard provider unavailable with sk-test-secret")


class UnsafeFailingTextAdapter:
    async def generate_text(self, request):
        _ = request
        raise RuntimeError(
            "provider failed with sk-test-secret and raw prompt payload"
        )


class RecordingStoryGenerationService:
    def __init__(self) -> None:
        self.story_requests: list[tuple[str, Brief, list[str]]] = []

    async def generate_story(
        self,
        project_id: str,
        brief: Brief,
        image_urls: list[str] | None = None,
    ) -> TextArtifactCreate:
        self.story_requests.append((project_id, brief, image_urls or []))
        return TextArtifactCreate(
            project_id=project_id,
            stage=Stage.STORY,
            title=f"{brief.product_name} story",
            content=f"故事基于产品 {brief.product_name}",
            status=Status.SUCCEEDED,
        )


class RecordingScriptGenerationService:
    def __init__(self) -> None:
        self.script_requests: list[tuple[str, Brief, str, list[str]]] = []

    async def generate_script(
        self,
        project_id: str,
        brief: Brief,
        story_content: str,
        image_urls: list[str] | None = None,
    ) -> TextArtifactCreate:
        self.script_requests.append((project_id, brief, story_content, image_urls or []))
        return TextArtifactCreate(
            project_id=project_id,
            stage=Stage.SCRIPT,
            title=f"{brief.product_name} scripted from story",
            content=(
                f"剧本基于产品 {brief.product_name}、平台 {brief.target_platform} "
                f"和故事：{story_content}"
            ),
            status=Status.SUCCEEDED,
        )


class RecordingStoryboardGenerationService:
    def __init__(self) -> None:
        self.storyboard_requests: list[tuple[str, Brief, str, list[str]]] = []

    async def generate_storyboard(
        self,
        project_id: str,
        brief: Brief,
        script_content: str,
        image_urls: list[str] | None = None,
    ) -> StoryboardGenerationResult:
        self.storyboard_requests.append(
            (project_id, brief, script_content, image_urls or [])
        )
        duration = round(brief.duration_seconds / 2, 2)
        shots = [
            StoryboardShotCreate(
                project_id=project_id,
                index=1,
                title="剧本开场",
                description=(
                    f"主体/场景：{brief.audience}看到{brief.product_name}前的痛点。"
                    f"剧本：{script_content}。运镜：推近；音效/转场：环境声切入。"
                ),
                visual_prompt=f"{brief.style} {brief.aspect_ratio} {brief.product_name}",
                narration="旁白/字幕：先建立问题。",
                duration_seconds=duration,
                status=Status.DRAFT,
            ),
            StoryboardShotCreate(
                project_id=project_id,
                index=2,
                title="产品转化",
                description=(
                    f"主体/场景：{brief.product_name}解决问题并给出 CTA。"
                    "运镜：定格品牌；音效/转场：收束淡出。"
                ),
                visual_prompt=f"{brief.target_platform} CTA frame",
                narration=f"旁白/字幕：现在就试试{brief.product_name}。",
                duration_seconds=round(brief.duration_seconds - duration, 2),
                status=Status.DRAFT,
            ),
        ]
        return StoryboardGenerationResult(
            artifact=TextArtifactCreate(
                project_id=project_id,
                stage=Stage.STORYBOARD,
                title=f"{brief.product_name} storyboard",
                content=(
                    f"分镜基于 {script_content}，商品 {brief.product_name}，"
                    f"平台 {brief.target_platform}，比例 {brief.aspect_ratio}，"
                    f"总时长 {brief.duration_seconds}s。"
                ),
                status=Status.SUCCEEDED,
            ),
            shots=shots,
        )


class FailingStoryboardWriteRepository(InMemoryRepository):
    def replace_project_storyboard(
        self,
        project_id: str,
        shots: Iterable[StoryboardShotCreate],
    ):
        _ = (project_id, list(shots))
        raise RuntimeError("storyboard write failed with sk-test-secret")


@contextmanager
def _client_with_generation(
    repository: InMemoryRepository,
    generation_service: object,
) -> Generator[TestClient, None, None]:
    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_asset_storage_service] = lambda: AssetStorageService(
        bucket="local-assets"
    )
    app.dependency_overrides[get_workflow_service] = lambda: WorkflowService(repository)
    app.dependency_overrides[get_modelark_generation_service] = lambda: generation_service

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_story_generation_accepts_reference_image_assets(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    generation = RecordingStoryGenerationService()

    with _client_with_generation(repository, generation) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        image_asset = repository.create_asset(
            AssetCreate(
                project_id=project_id,
                type=AssetType.UPLOADED_IMAGE,
                category=AssetCategory.REFERENCE,
                stage=Stage.BRIEF,
                status=Status.SUCCEEDED,
                url="https://assets.example.com/reference.png?signature=x",
                mime_type="image/png",
            )
        )

        response = client.post(
            f"/api/projects/{project_id}/story",
            json={"reference_asset_ids": [image_asset.id]},
        )

    assert response.status_code == 200
    assert _sse_complete_task(response)["status"] == "succeeded"
    assert len(generation.story_requests) == 1
    request_project_id, brief, image_urls = generation.story_requests[0]
    assert request_project_id == project_id
    assert brief.product_name == "AdPilot"
    assert image_urls == ["https://assets.example.com/reference.png?signature=x"]


def test_text_generation_rejects_non_image_reference_assets(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    generation = RecordingStoryGenerationService()

    with _client_with_generation(repository, generation) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        video_asset = repository.create_asset(
            AssetCreate(
                project_id=project_id,
                type=AssetType.UPLOADED_VIDEO,
                category=AssetCategory.REFERENCE,
                stage=Stage.BRIEF,
                status=Status.SUCCEEDED,
                url="https://assets.example.com/reference.mp4",
                mime_type="video/mp4",
            )
        )

        response = client.post(
            f"/api/projects/{project_id}/story",
            json={"reference_asset_ids": [video_asset.id]},
        )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"
    assert generation.story_requests == []


def test_script_generation_uses_latest_story_and_persists_success(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    generation = RecordingScriptGenerationService()

    with _client_with_generation(repository, generation) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        workflow = WorkflowService(repository)
        story = workflow.write_text_artifact(
            project_id,
            Stage.STORY,
            content="story v1",
            title="Story v1",
        )
        workflow.edit_text_artifact(
            project_id,
            Stage.STORY,
            content="story v2 with sharper conflict",
            title="Story v2",
        )

        skip_response = client.post(f"/api/projects/{project_id}/characters/skip")
        assert skip_response.status_code == 200

        response = client.post(f"/api/projects/{project_id}/script")

    assert response.status_code == 200
    task = _sse_complete_task(response)
    assert task["stage"] == "script"
    assert task["status"] == "succeeded"
    assert task["output_text_artifact_id"] is not None

    assert len(generation.script_requests) == 1
    request_project_id, brief, story_content, image_urls = generation.script_requests[0]
    assert request_project_id == project_id
    assert brief.product_name == "AdPilot"
    assert brief.target_platform == "douyin"
    assert story_content == "story v2 with sharper conflict"
    assert image_urls == []

    saved_story = repository.get_text_artifact(story.id)
    assert saved_story.version == 2
    assert saved_story.status == Status.SUCCEEDED

    script = repository.get_text_artifact(task["output_text_artifact_id"])
    assert script.stage == Stage.SCRIPT
    assert script.status == Status.SUCCEEDED
    assert script.version == 1
    assert "AdPilot" in script.content
    assert "story v2 with sharper conflict" in script.content

    saved_task = repository.get_task(task["id"])
    assert saved_task.status == Status.SUCCEEDED
    assert saved_task.output_text_artifact_id == script.id

    project = repository.get_project(project_id)
    assert project.current_stage == Stage.SCRIPT
    assert project.status == Status.SUCCEEDED


def test_script_generation_failure_sanitizes_api_and_task_error(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    generation = ModelArkGenerationService(adapter=UnsafeFailingTextAdapter())

    with _client_with_generation(repository, generation) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        workflow = WorkflowService(repository)
        workflow.write_text_artifact(
            project_id,
            Stage.STORY,
            content="story with sensitive business context",
            title="Story",
        )
        skip_response = client.post(f"/api/projects/{project_id}/characters/skip")
        assert skip_response.status_code == 200

        response = client.post(f"/api/projects/{project_id}/script")

    assert response.status_code == 200
    response_payload = _sse_error(response)
    response_text = str(response_payload)
    assert response_payload["code"] == "generation_failed"
    assert response_payload["message"] == "generation failed"
    assert "sk-test-secret" not in response_text
    assert "raw prompt payload" not in response_text

    failed_task = next(
        task
        for task in repository.list_project_tasks(project_id)
        if task.stage == Stage.SCRIPT
    )
    assert failed_task.status == Status.FAILED
    assert failed_task.error is not None
    task_error_text = failed_task.error.model_dump_json()
    assert failed_task.error.message == "generation failed"
    assert "provider_code=UnknownProviderError" in (failed_task.error.detail or "")
    assert "sk-test-secret" not in task_error_text
    assert "raw prompt payload" not in task_error_text


def test_failed_script_task_can_be_retried_with_successful_generation(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    with _client_with_generation(repository, FailingScriptGenerationService()) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        workflow = WorkflowService(repository)
        workflow.write_text_artifact(
            project_id,
            Stage.STORY,
            content="story ready for script retry",
            title="Story",
        )
        skip_response = client.post(f"/api/projects/{project_id}/characters/skip")
        assert skip_response.status_code == 200

        failed_response = client.post(f"/api/projects/{project_id}/script")

    assert failed_response.status_code == 200
    assert _sse_error(failed_response)["code"] == "generation_failed"
    failed_task = next(
        task
        for task in repository.list_project_tasks(project_id)
        if task.stage == Stage.SCRIPT
    )
    assert failed_task.status == Status.FAILED

    generation = RecordingScriptGenerationService()
    with _client_with_generation(repository, generation) as client:
        retry_response = client.post(f"/api/tasks/{failed_task.id}/retry")

    assert retry_response.status_code == 200
    retried_task = _sse_complete_task(retry_response)
    assert retried_task["id"] != failed_task.id
    assert retried_task["stage"] == "script"
    assert retried_task["status"] == "succeeded"
    assert retried_task["output_text_artifact_id"] is not None

    retried_script = repository.get_text_artifact(
        retried_task["output_text_artifact_id"]
    )
    assert retried_script.stage == Stage.SCRIPT
    assert retried_script.status == Status.SUCCEEDED
    assert "AdPilot" in retried_script.content
    assert "story ready for script retry" in retried_script.content
    assert len(generation.script_requests) == 1


def test_storyboard_generation_rejects_missing_successful_script_without_writes(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    generation = RecordingStoryboardGenerationService()

    with _client_with_generation(repository, generation) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        workflow = WorkflowService(repository)
        repository.create_text_artifact(
            TextArtifactCreate(
                project_id=project_id,
                stage=Stage.SCRIPT,
                title="Failed Script",
                content="script failed and must not be used",
                status=Status.FAILED,
            )
        )
        existing_storyboard = workflow.write_text_artifact(
            project_id,
            Stage.STORYBOARD,
            content="existing storyboard should remain",
            title="Existing Storyboard",
        )
        repository.replace_project_storyboard(
            project_id,
            [
                StoryboardShotCreate(
                    project_id=project_id,
                    index=1,
                    title="Existing Shot",
                    description="existing structured shot",
                    visual_prompt="existing prompt",
                    narration="existing narration",
                    duration_seconds=project_payload["brief"]["duration_seconds"],
                    status=Status.DRAFT,
                )
            ],
        )

        response = client.post(f"/api/projects/{project_id}/storyboard")

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "dependency_missing"
    assert generation.storyboard_requests == []

    artifacts = repository.list_project_text_artifacts(project_id)
    storyboard_artifacts = [
        artifact for artifact in artifacts if artifact.stage == Stage.STORYBOARD
    ]
    assert [artifact.id for artifact in storyboard_artifacts] == [existing_storyboard.id]

    shots = repository.list_project_storyboard(project_id)
    assert len(shots) == 1
    assert shots[0].title == "Existing Shot"
    assert repository.list_project_tasks(project_id) == []


def test_storyboard_generation_uses_latest_script_and_persists_outputs(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    generation = RecordingStoryboardGenerationService()

    with _client_with_generation(repository, generation) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        workflow = WorkflowService(repository)
        script = workflow.write_text_artifact(
            project_id,
            Stage.SCRIPT,
            content="script v1 should be replaced",
            title="Script v1",
        )
        workflow.edit_text_artifact(
            project_id,
            Stage.SCRIPT,
            content="script v2 with product reveal and CTA",
            title="Script v2",
        )

        response = client.post(f"/api/projects/{project_id}/storyboard")

    assert response.status_code == 200
    task = _sse_complete_task(response)
    assert task["stage"] == "storyboard"
    assert task["status"] == "succeeded"
    assert task["output_text_artifact_id"] is not None

    assert len(generation.storyboard_requests) == 1
    request_project_id, brief, script_content, image_urls = generation.storyboard_requests[0]
    assert request_project_id == project_id
    assert brief.product_name == "AdPilot"
    assert brief.target_platform == "douyin"
    assert script_content == "script v2 with product reveal and CTA"
    assert image_urls == []

    saved_script = repository.get_text_artifact(script.id)
    assert saved_script.version == 2
    assert saved_script.status == Status.SUCCEEDED

    storyboard = repository.get_text_artifact(task["output_text_artifact_id"])
    assert storyboard.stage == Stage.STORYBOARD
    assert storyboard.status == Status.SUCCEEDED
    assert "script v2 with product reveal and CTA" in storyboard.content
    assert "AdPilot" in storyboard.content

    shots = repository.list_project_storyboard(project_id)
    assert [shot.index for shot in shots] == [1, 2]
    assert all(shot.duration_seconds > 0 for shot in shots)
    assert abs(sum(shot.duration_seconds for shot in shots) - 30) <= 0.5
    assert "script v2 with product reveal and CTA" in shots[0].description

    saved_task = repository.get_task(task["id"])
    assert saved_task.output_text_artifact_id == storyboard.id
    project = repository.get_project(project_id)
    assert project.current_stage == Stage.STORYBOARD
    assert project.status == Status.SUCCEEDED


def test_storyboard_generation_failure_sanitizes_api_and_task_error(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    with _client_with_generation(
        repository,
        FailingStoryboardGenerationService(),
    ) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        workflow = WorkflowService(repository)
        workflow.write_text_artifact(
            project_id,
            Stage.SCRIPT,
            content="script ready for storyboard",
            title="Script",
        )

        response = client.post(f"/api/projects/{project_id}/storyboard")

    assert response.status_code == 200
    response_payload = _sse_error(response)
    response_text = str(response_payload)
    assert response_payload["code"] == "generation_failed"
    assert response_payload["message"] == "generation failed"
    assert "sk-test-secret" not in response_text
    assert "storyboard provider unavailable" not in response_text

    failed_task = next(
        task
        for task in repository.list_project_tasks(project_id)
        if task.stage == Stage.STORYBOARD
    )
    assert failed_task.status == Status.FAILED
    assert failed_task.error is not None
    task_error_text = failed_task.error.model_dump_json()
    assert failed_task.error.message == "generation failed"
    assert failed_task.error.detail == "RuntimeError"
    assert "sk-test-secret" not in task_error_text
    assert "storyboard provider unavailable" not in task_error_text


def test_storyboard_shot_write_failure_marks_task_failed_and_sanitizes_error(
    project_payload: dict[str, object],
) -> None:
    repository = FailingStoryboardWriteRepository()

    with _client_with_generation(
        repository,
        RecordingStoryboardGenerationService(),
    ) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        workflow = WorkflowService(repository)
        workflow.write_text_artifact(
            project_id,
            Stage.SCRIPT,
            content="script ready for storyboard write failure",
            title="Script",
        )

        response = client.post(f"/api/projects/{project_id}/storyboard")

    assert response.status_code == 200
    response_payload = _sse_error(response)
    response_text = str(response_payload)
    assert response_payload["code"] == "generation_failed"
    assert response_payload["message"] == "generation failed"
    assert "sk-test-secret" not in response_text
    assert "storyboard write failed" not in response_text

    failed_task = next(
        task
        for task in repository.list_project_tasks(project_id)
        if task.stage == Stage.STORYBOARD
    )
    assert failed_task.status == Status.FAILED
    assert failed_task.error is not None
    task_error_text = failed_task.error.model_dump_json()
    assert failed_task.error.message == "generation failed"
    assert failed_task.error.detail == "RuntimeError"
    assert "sk-test-secret" not in task_error_text
    assert "storyboard write failed" not in task_error_text


def test_failed_storyboard_task_can_be_retried_with_successful_generation(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    with _client_with_generation(
        repository,
        FailingStoryboardGenerationService(),
    ) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        workflow = WorkflowService(repository)
        workflow.write_text_artifact(
            project_id,
            Stage.SCRIPT,
            content="script ready for storyboard retry",
            title="Script",
        )

        failed_response = client.post(f"/api/projects/{project_id}/storyboard")

    assert failed_response.status_code == 200
    assert _sse_error(failed_response)["code"] == "generation_failed"
    failed_task = next(
        task
        for task in repository.list_project_tasks(project_id)
        if task.stage == Stage.STORYBOARD
    )
    assert failed_task.status == Status.FAILED

    generation = RecordingStoryboardGenerationService()
    with _client_with_generation(repository, generation) as client:
        retry_response = client.post(f"/api/tasks/{failed_task.id}/retry")

    assert retry_response.status_code == 200
    retried_task = _sse_complete_task(retry_response)
    assert retried_task["id"] != failed_task.id
    assert retried_task["stage"] == "storyboard"
    assert retried_task["status"] == "succeeded"
    assert retried_task["output_text_artifact_id"] is not None

    retried_storyboard = repository.get_text_artifact(
        retried_task["output_text_artifact_id"]
    )
    assert retried_storyboard.stage == Stage.STORYBOARD
    assert "script ready for storyboard retry" in retried_storyboard.content
    assert len(repository.list_project_storyboard(project_id)) == 2
    assert len(generation.storyboard_requests) == 1


def test_failed_task_can_be_retried_with_successful_generation(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    with _client_with_generation(repository, FailingStoryGenerationService()) as client:
        project_id = client.post("/api/projects", json=project_payload).json()["id"]
        failed_response = client.post(f"/api/projects/{project_id}/story")

    assert failed_response.status_code == 200
    assert _sse_error(failed_response)["code"] == "generation_failed"
    failed_task = repository.list_project_tasks(project_id)[0]
    assert failed_task.status.value == "failed"
    assert failed_task.error is not None
    assert failed_task.error.code.value == "generation_failed"

    with _client_with_generation(repository, ModelArkGenerationService()) as client:
        retry_response = client.post(f"/api/tasks/{failed_task.id}/retry")

        assert retry_response.status_code == 200
        retried_task = _sse_complete_task(retry_response)
        assert retried_task["id"] != failed_task.id
        assert retried_task["stage"] == "story"
        assert retried_task["status"] == "succeeded"

        non_failed_retry = client.post(f"/api/tasks/{retried_task['id']}/retry")
        assert non_failed_retry.status_code == 409
        assert non_failed_retry.json()["detail"]["code"] == "invalid_state"
