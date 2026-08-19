import asyncio
import json

import pytest
import httpx
from fastapi.testclient import TestClient

from backend.app.api.dependencies import get_modelark_generation_service
from backend.app.repositories import InMemoryRepository, MySQLRepository
from backend.app.schemas import (
    AssetCategory,
    AssetCreate,
    AssetType,
    CharacterCardCreate,
    ErrorCode,
    ProjectCreate,
    Stage,
    Status,
)
from backend.app.services.assets import AssetStorageService
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.modelark import (
    CharacterImageEditRequest,
    CharacterImageRegenerateRequest,
    CharacterGenerationRequest,
    ModelArkProviderError,
    ModelArkTextParseError,
    MockModelArkAdapter,
)
from backend.app.services.workflow import WorkflowError, WorkflowService


class RecordingIterationAdapter(MockModelArkAdapter):
    def __init__(self) -> None:
        super().__init__()
        self.edit_requests: list[CharacterImageEditRequest] = []
        self.regenerate_requests: list[CharacterImageRegenerateRequest] = []

    async def edit_character_image(self, request: CharacterImageEditRequest):
        self.edit_requests.append(request)
        return await super().edit_character_image(request)

    async def regenerate_character_image(
        self,
        request: CharacterImageRegenerateRequest,
    ):
        self.regenerate_requests.append(request)
        return await super().regenerate_character_image(request)


class FailingIterationAdapter(MockModelArkAdapter):
    async def edit_character_image(self, request: CharacterImageEditRequest):
        raise ModelArkProviderError(
            "provider secret ak=raw-secret X-Tos-Signature=leaked"
        )

    async def regenerate_character_image(
        self,
        request: CharacterImageRegenerateRequest,
    ):
        raise ModelArkProviderError(
            "provider secret ak=raw-secret X-Tos-Signature=leaked"
        )


class EmptyCharacterAdapter(MockModelArkAdapter):
    async def generate_characters(self, request: CharacterGenerationRequest):
        del request
        raise ModelArkTextParseError("character extraction returned no characters")


class ReadTimeoutDownloader:
    async def fetch(self, url: str, *, expected_mime_type: str | None = None):
        del url, expected_mime_type
        raise httpx.ReadTimeout("generated asset download timed out")


def _sse_complete_task(response) -> dict[str, object]:
    complete = []
    for block in response.text.strip().split("\n\n"):
        lines = block.splitlines()
        event = next(line[7:] for line in lines if line.startswith("event: "))
        if event != "complete":
            continue
        data = "\n".join(
            line[6:] for line in lines if line.startswith("data: ")
        )
        complete.append(json.loads(data))
    assert len(complete) == 1
    task = complete[0]["task"]
    assert isinstance(task, dict)
    return task


def _create_project_and_story(
    client: TestClient,
    project_payload: dict[str, object],
) -> str:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]
    story_response = client.post(f"/api/projects/{project_id}/story")
    assert story_response.status_code == 200
    return project_id


def _create_source_character_asset(
    repository: InMemoryRepository,
    project_id: str,
):
    return repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            category=AssetCategory.CHARACTER,
            status=Status.SUCCEEDED,
            stage=Stage.CHARACTER,
            url=f"https://local-assets.tos.local/projects/{project_id}/character/source.png",
            object_key=f"projects/{project_id}/character/source.png",
            mime_type="image/png",
            size_bytes=1024,
            metadata={
                "model": "mock-model",
                "current_prompt": "原始角色提示词",
                "source_host": "modelark",
            },
        )
    )


def test_script_requires_character_generation_or_skip(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project_and_story(client, project_payload)

    response = client.post(f"/api/projects/{project_id}/script")

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "dependency_missing"
    assert "character" in response.json()["detail"]["message"]


def test_character_generation_creates_story_derived_character_cards(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project_and_story(client, project_payload)

    response = client.post(f"/api/projects/{project_id}/characters")

    assert response.status_code == 200
    task = response.json()
    assert task["stage"] == "character"
    assert task["status"] == "succeeded"
    assert task["output_asset_ids"] == []

    assets_response = client.get(
        f"/api/projects/{project_id}/assets",
        params={"category": "character"},
    )
    assert assets_response.status_code == 200
    assert assets_response.json() == []
    project = client.get(f"/api/projects/{project_id}").json()
    cards = project["character_cards"]
    assert len(cards) == 1
    assert cards[0]["name"] == "小微店主"
    assert "AdPilot" in cards[0]["description"]
    assert cards[0]["asset_id"] is None
    assert cards[0]["status"] == "draft"
    assert cards[0]["sort_order"] == 1

    script_response = client.post(f"/api/projects/{project_id}/script")
    assert script_response.status_code == 200
    assert _sse_complete_task(script_response)["status"] == "succeeded"


def test_character_card_update_edits_current_name_and_description(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project_and_story(client, project_payload)
    client.post(f"/api/projects/{project_id}/characters")
    card = client.get(f"/api/projects/{project_id}").json()["character_cards"][0]

    response = client.patch(
        f"/api/projects/{project_id}/character-cards/{card['id']}",
        json={
            "name": "改名后的店主",
            "description": "真实门店里忙碌但自信的年轻店主，蓝色围裙。",
        },
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["id"] == card["id"]
    assert updated["name"] == "改名后的店主"
    assert updated["description"] == "真实门店里忙碌但自信的年轻店主，蓝色围裙。"
    project = client.get(f"/api/projects/{project_id}").json()
    assert project["character_cards"][0]["name"] == "改名后的店主"


def test_character_card_delete_removes_card_from_project_detail_only(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project_and_story(client, project_payload)
    client.post(f"/api/projects/{project_id}/characters")
    card = client.get(f"/api/projects/{project_id}").json()["character_cards"][0]

    response = client.delete(
        f"/api/projects/{project_id}/character-cards/{card['id']}"
    )

    assert response.status_code == 200
    assert response.json()["character_cards"] == []
    project = client.get(f"/api/projects/{project_id}").json()
    assert project["character_cards"] == []
    assert project["brief"]["prompt"] == project_payload["brief"]["prompt"]


def test_character_card_image_generation_creates_asset_and_links_card(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    adapter = RecordingIterationAdapter()
    client.app.dependency_overrides[get_modelark_generation_service] = (
        lambda: ModelArkGenerationService(adapter)
    )
    project_id = _create_project_and_story(client, project_payload)
    client.post(f"/api/projects/{project_id}/characters")
    card = client.get(f"/api/projects/{project_id}").json()["character_cards"][0]
    client.patch(
        f"/api/projects/{project_id}/character-cards/{card['id']}",
        json={
            "name": "蓝围裙店主",
            "description": "蓝色围裙，站在明亮小店收银台前，纪录片质感。",
        },
    )

    response = client.post(
        f"/api/projects/{project_id}/character-cards/{card['id']}/generate-image"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["task"]["stage"] == "character"
    assert payload["task"]["status"] == "succeeded"
    assert len(payload["task"]["output_asset_ids"]) == 1
    assert payload["character_card"]["id"] == card["id"]
    assert payload["character_card"]["asset_id"] == payload["asset"]["id"]
    assert payload["character_card"]["status"] == "succeeded"
    assert payload["asset"]["category"] == "character"
    assert payload["asset"]["stage"] == "character"
    assert payload["asset"]["status"] == "succeeded"
    assert payload["asset"]["metadata"]["character_card_id"] == card["id"]
    assert payload["asset"]["metadata"]["character_name"] == "蓝围裙店主"
    assert "蓝色围裙" in payload["asset"]["metadata"]["current_prompt"]
    assert adapter.regenerate_requests
    assert "蓝围裙店主" in adapter.regenerate_requests[-1].prompt
    assert "蓝色围裙" in adapter.regenerate_requests[-1].prompt
    assert "人物或动物三视图" in adapter.regenerate_requests[-1].prompt
    assert "白底背景" in adapter.regenerate_requests[-1].prompt
    assert "画面比例：9:16" in adapter.regenerate_requests[-1].prompt
    project = client.get(f"/api/projects/{project_id}").json()
    saved_card = project["character_cards"][0]
    assert saved_card["asset_id"] == payload["asset"]["id"]
    assert any(
        asset.id == payload["asset"]["id"]
        for asset in repository.list_project_assets(project_id)
    )


def test_english_project_passes_target_language_to_character_image_prompt(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    adapter = RecordingIterationAdapter()
    client.app.dependency_overrides[get_modelark_generation_service] = (
        lambda: ModelArkGenerationService(adapter)
    )
    english_payload = json.loads(json.dumps(project_payload))
    english_payload["brief"]["target_language"] = "en"
    project_id = _create_project_and_story(client, english_payload)
    client.post(f"/api/projects/{project_id}/characters")
    card = client.get(f"/api/projects/{project_id}").json()["character_cards"][0]
    client.patch(
        f"/api/projects/{project_id}/character-cards/{card['id']}",
        json={
            "name": "Avery Chen",
            "description": "A confident BluePeak presenter in a light jacket.",
        },
    )

    response = client.post(
        f"/api/projects/{project_id}/character-cards/{card['id']}/generate-image"
    )

    assert response.status_code == 200
    prompt = adapter.regenerate_requests[-1].prompt
    assert "Character name: Avery Chen" in prompt
    assert "BluePeak" in prompt
    assert "front, side, and back turnaround views" in prompt
    assert "pure white background" in prompt
    assert "Do not add a specific scene" in prompt
    assert "Aspect ratio: 9:16" in prompt
    assert "三视图" not in prompt
    assert response.json()["asset"]["metadata"]["current_prompt"] == prompt


def test_character_card_image_generation_allows_parallel_different_cards(
    repository: InMemoryRepository,
    workflow: WorkflowService,
    project_payload: dict[str, object],
) -> None:
    project_id = repository.create_project(
        ProjectCreate.model_validate(project_payload)
    ).id
    workflow.write_text_artifact(project_id, Stage.STORY, content="story")
    first_card = repository.create_character_card(
        CharacterCardCreate(
            project_id=project_id,
            name="角色一",
            description="角色一形象提示词",
            sort_order=1,
        )
    )
    second_card = repository.create_character_card(
        CharacterCardCreate(
            project_id=project_id,
            name="角色二",
            description="角色二形象提示词",
            sort_order=2,
        )
    )

    first_task, _ = workflow.begin_character_card_image_generation(
        project_id,
        first_card.id,
    )
    second_task, _ = workflow.begin_character_card_image_generation(
        project_id,
        second_card.id,
    )

    assert first_task.id != second_task.id
    assert first_task.status == Status.RUNNING
    assert second_task.status == Status.RUNNING
    assert first_task.input_hash != second_task.input_hash
    with pytest.raises(WorkflowError) as exc_info:
        workflow.begin_character_card_image_generation(project_id, first_card.id)
    assert exc_info.value.code == ErrorCode.TASK_CONFLICT
    assert exc_info.value.message == (
        "character image generation task is already active"
    )


def test_character_card_image_generation_failure_keeps_card_without_new_asset(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project_and_story(client, project_payload)
    client.post(f"/api/projects/{project_id}/characters")
    card = client.get(f"/api/projects/{project_id}").json()["character_cards"][0]
    client.app.dependency_overrides[get_modelark_generation_service] = (
        lambda: ModelArkGenerationService(FailingIterationAdapter())
    )

    response = client.post(
        f"/api/projects/{project_id}/character-cards/{card['id']}/generate-image"
    )

    assert response.status_code == 500
    body = str(response.json())
    assert "raw-secret" not in body
    assert "X-Tos-Signature" not in body
    assert repository.list_project_assets(project_id) == []
    saved_card = repository.get_character_card(project_id, card["id"])
    assert saved_card.asset_id is None
    failed_task = repository.list_project_tasks(project_id)[-1]
    assert failed_task.stage == Stage.CHARACTER
    assert failed_task.status == Status.FAILED
    assert failed_task.output_asset_ids == []
    assert failed_task.error is not None
    assert failed_task.error.message == "character image generation failed"
    assert failed_task.error.detail == "ModelArkProviderError"
    assert "raw-secret" not in failed_task.error.model_dump_json()


def test_failed_character_card_image_generation_does_not_block_script(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project_and_story(client, project_payload)
    client.post(f"/api/projects/{project_id}/characters")
    card = client.get(f"/api/projects/{project_id}").json()["character_cards"][0]
    client.app.dependency_overrides[get_modelark_generation_service] = (
        lambda: ModelArkGenerationService(FailingIterationAdapter())
    )
    failed = client.post(
        f"/api/projects/{project_id}/character-cards/{card['id']}/generate-image"
    )
    assert failed.status_code == 500
    client.app.dependency_overrides[get_modelark_generation_service] = (
        lambda: ModelArkGenerationService()
    )

    script_response = client.post(f"/api/projects/{project_id}/script")

    assert script_response.status_code == 200
    assert _sse_complete_task(script_response)["status"] == "succeeded"


def test_character_card_image_generation_after_story_refresh_unlocks_script(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project_and_story(client, project_payload)
    characters = client.post(f"/api/projects/{project_id}/characters")
    assert characters.status_code == 200
    card = client.get(f"/api/projects/{project_id}").json()["character_cards"][0]

    refreshed_story = client.post(f"/api/projects/{project_id}/story")
    assert refreshed_story.status_code == 200
    regenerated = client.post(
        f"/api/projects/{project_id}/character-cards/{card['id']}/generate-image"
    )
    assert regenerated.status_code == 200

    expected_hash = WorkflowService(repository).compute_input_hash(
        project_id,
        Stage.CHARACTER,
    )
    refreshed_character_task = repository.get_task(regenerated.json()["task"]["id"])
    assert refreshed_character_task.input_hash == expected_hash
    assert refreshed_character_task.status == Status.SUCCEEDED

    script_response = client.post(f"/api/projects/{project_id}/script")

    assert script_response.status_code == 200
    assert _sse_complete_task(script_response)["status"] == "succeeded"


def test_existing_resolved_character_cards_unlock_script_after_story_refresh(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project_and_story(client, project_payload)
    characters = client.post(f"/api/projects/{project_id}/characters")
    assert characters.status_code == 200
    card = client.get(f"/api/projects/{project_id}").json()["character_cards"][0]
    generated_image = client.post(
        f"/api/projects/{project_id}/character-cards/{card['id']}/generate-image"
    )
    assert generated_image.status_code == 200

    refreshed_story = client.post(f"/api/projects/{project_id}/story")
    assert refreshed_story.status_code == 200

    script_response = client.post(f"/api/projects/{project_id}/script")

    assert script_response.status_code == 200
    assert _sse_complete_task(script_response)["status"] == "succeeded"


def test_character_skip_is_explicit_idempotent_and_unlocks_script(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project_and_story(client, project_payload)

    first_skip = client.post(f"/api/projects/{project_id}/characters/skip")
    second_skip = client.post(f"/api/projects/{project_id}/characters/skip")

    assert first_skip.status_code == 200
    skipped_task = first_skip.json()
    assert skipped_task["stage"] == "character"
    assert skipped_task["status"] == "skipped"
    assert skipped_task["progress"] == 1.0
    assert skipped_task["finished_at"] is not None
    assert second_skip.status_code == 200
    assert second_skip.json()["id"] == skipped_task["id"]

    assets = client.get(
        f"/api/projects/{project_id}/assets",
        params={"category": "character"},
    ).json()
    assert assets == []

    script_response = client.post(f"/api/projects/{project_id}/script")
    assert script_response.status_code == 200
    assert _sse_complete_task(script_response)["status"] == "succeeded"


def test_character_skip_requires_story_and_cannot_replace_success(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    project_id = client.post("/api/projects", json=project_payload).json()["id"]

    missing_story = client.post(f"/api/projects/{project_id}/characters/skip")
    assert missing_story.status_code == 409
    assert missing_story.json()["detail"]["code"] == "dependency_missing"

    client.post(f"/api/projects/{project_id}/story")
    generated = client.post(f"/api/projects/{project_id}/characters")
    assert generated.status_code == 200

    skip_after_success = client.post(f"/api/projects/{project_id}/characters/skip")
    assert skip_after_success.status_code == 409
    assert skip_after_success.json()["detail"]["code"] == "invalid_state"


@pytest.mark.parametrize("operation_type", ["edit", "regenerate"])
def test_character_asset_iteration_api_returns_running_task_then_completes(
    client: TestClient,
    repository: InMemoryRepository,
    background_task_runner,
    project_payload: dict[str, object],
    operation_type: str,
) -> None:
    project_id = _create_project_and_story(client, project_payload)
    source_asset = _create_source_character_asset(repository, project_id)

    response = client.post(
        f"/api/projects/{project_id}/character-assets/iterations",
        json={
            "asset_id": source_asset.id,
            "prompt": "让角色穿浅蓝色通勤外套，表情更自然",
            "operation_type": operation_type,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    task = payload["task"]
    asset = payload["asset"]
    assert payload["source_asset_id"] == source_asset.id
    assert payload["prompt"] == "让角色穿浅蓝色通勤外套，表情更自然"
    assert payload["operation_type"] == operation_type
    assert task["stage"] == "character"
    assert task["status"] == "running"
    assert task["output_asset_ids"] == []
    assert asset["type"] == "generated_image"
    assert asset["category"] == "character"
    assert asset["stage"] == "character"
    assert asset["status"] == "running"
    assert asset["url"] is None
    assert asset["object_key"] is None
    assert asset["source_task_id"] == task["id"]
    assert asset["metadata"]["source_asset_id"] == source_asset.id
    assert asset["metadata"]["operation_type"] == operation_type
    assert asset["metadata"]["current_prompt"] == "让角色穿浅蓝色通勤外套，表情更自然"
    assert asset["metadata"]["prompt_history"] == source_asset.metadata["current_prompt"]
    assert asset["metadata"]["model"] == source_asset.metadata["model"]
    assert "source_url" not in asset["metadata"]
    assert "source_image_url" not in asset["metadata"]
    assert len(background_task_runner.coroutines) == 1

    asyncio.run(background_task_runner.run_pending())
    saved_task = repository.get_task(task["id"])
    assert saved_task.status == Status.SUCCEEDED
    assert len(saved_task.output_asset_ids) == 1
    saved_asset = repository.get_asset(saved_task.output_asset_ids[0])
    assert saved_asset.status == Status.SUCCEEDED
    assert saved_asset.url is not None
    assert saved_asset.url.startswith(
        f"https://local-assets.tos.local/projects/{project_id}/character/"
    )
    assert saved_asset.object_key is not None
    assert saved_asset.object_key.startswith(f"projects/{project_id}/character/")
    assert saved_asset.metadata["source_host"] == "modelark"


def test_character_asset_edit_passes_signed_source_url_to_generation(
    client: TestClient,
    repository: InMemoryRepository,
    background_task_runner,
    project_payload: dict[str, object],
) -> None:
    adapter = RecordingIterationAdapter()
    client.app.dependency_overrides[get_modelark_generation_service] = (
        lambda: ModelArkGenerationService(adapter)
    )
    project_id = _create_project_and_story(client, project_payload)
    source_asset = _create_source_character_asset(repository, project_id)

    response = client.post(
        f"/api/projects/{project_id}/character-assets/iterations",
        json={
            "asset_id": source_asset.id,
            "prompt": "让角色穿浅蓝色通勤外套",
            "operation_type": "edit",
        },
    )

    assert response.status_code == 200
    assert response.json()["task"]["status"] == "running"
    assert len(adapter.edit_requests) == 0
    asyncio.run(background_task_runner.run_pending())
    assert len(adapter.edit_requests) == 1
    source_url = adapter.edit_requests[0].source_image_url
    assert source_url.startswith(
        f"https://local-assets.tos.local/projects/{project_id}/character/"
    )
    assert "X-Tos-Signature=" in source_url
    saved_task = repository.get_task(response.json()["task"]["id"])
    assert saved_task.status == Status.SUCCEEDED


def test_character_cards_and_skip_status_persist_in_database(
    mysql_client: TestClient,
    mysql_session_factory,
    project_payload: dict[str, object],
) -> None:
    generated_project_id = _create_project_and_story(mysql_client, project_payload)
    generated_task = mysql_client.post(
        f"/api/projects/{generated_project_id}/characters"
    ).json()

    skipped_project_id = _create_project_and_story(mysql_client, project_payload)
    skipped_task = mysql_client.post(
        f"/api/projects/{skipped_project_id}/characters/skip"
    ).json()

    repository = MySQLRepository(mysql_session_factory)
    generated_cards = repository.list_project_character_cards(generated_project_id)
    persisted_skipped_task = repository.get_task(skipped_task["id"])

    assert generated_task["output_asset_ids"] == []
    assert len(generated_cards) == 1
    assert generated_cards[0].asset_id is None
    assert generated_cards[0].status == Status.DRAFT
    assert persisted_skipped_task.status.value == "skipped"
    assert repository.get_project(skipped_project_id).status.value == "skipped"


def test_story_edit_invalidates_previous_character_skip(
    repository: InMemoryRepository,
    workflow: WorkflowService,
    project_payload: dict[str, object],
) -> None:
    project_id = repository.create_project(
        ProjectCreate.model_validate(project_payload)
    ).id
    workflow.write_text_artifact(project_id, Stage.STORY, content="story v1")
    workflow.skip_stage(project_id, Stage.CHARACTER)
    workflow.create_task(project_id, Stage.SCRIPT)

    workflow.edit_text_artifact(project_id, Stage.STORY, content="story v2")

    with pytest.raises(WorkflowError) as exc_info:
        workflow.create_task(project_id, Stage.SCRIPT)
    assert exc_info.value.code == ErrorCode.DEPENDENCY_MISSING
    assert "character" in exc_info.value.message


def test_character_extraction_failure_creates_no_cards_and_can_retry(
    client: TestClient,
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project_and_story(client, project_payload)
    client.app.dependency_overrides[get_modelark_generation_service] = (
        lambda: ModelArkGenerationService(EmptyCharacterAdapter())
    )

    failed_response = client.post(f"/api/projects/{project_id}/characters")

    assert failed_response.status_code == 409
    response_body = failed_response.json()
    assert response_body["detail"]["message"] == (
        "当前故事未识别到角色，请先在故事内容中补充具体人物后再生成角色。"
    )
    assert "returned no characters" not in str(response_body)
    assert repository.list_project_assets(project_id) == []
    cards = repository.list_project_character_cards(project_id)
    assert cards == []
    assert "品牌体验官" not in str(response_body)
    assert "目标用户" not in str(response_body)
    failed_task = repository.list_project_tasks(project_id)[-1]
    assert failed_task.stage == Stage.CHARACTER
    assert failed_task.status.value == "failed"
    assert failed_task.error is not None
    assert failed_task.error.detail == "ModelArkTextParseError"

    client.app.dependency_overrides[get_modelark_generation_service] = (
        lambda: ModelArkGenerationService()
    )
    retry_response = client.post(f"/api/tasks/{failed_task.id}/retry")

    assert retry_response.status_code == 200
    assert retry_response.json()["status"] == "succeeded"
    assert len(repository.list_project_character_cards(project_id)) == 1


def test_character_asset_iteration_tos_failure_keeps_only_source_assets(
    client: TestClient,
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    background_task_runner,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project_and_story(client, project_payload)
    source_asset = _create_source_character_asset(repository, project_id)
    source_assets = [source_asset]
    storage_client = test_asset_storage.client
    assert storage_client is not None
    setattr(storage_client, "fail_uploads", True)

    failed_response = client.post(
        f"/api/projects/{project_id}/character-assets/iterations",
        json={
            "asset_id": source_asset.id,
            "prompt": "让角色穿浅蓝色通勤外套",
            "operation_type": "edit",
        },
    )

    assert failed_response.status_code == 200
    assert failed_response.json()["task"]["status"] == "running"
    assert "simulated TOS failure" not in str(failed_response.json())
    assert "X-Tos-Signature" not in str(failed_response.json())
    asyncio.run(background_task_runner.run_pending())
    assert repository.list_assets(
        project_id=project_id,
        category=AssetCategory.CHARACTER,
        status=Status.SUCCEEDED,
    ) == source_assets
    assert all(asset.status == Status.SUCCEEDED for asset in repository.list_project_assets(project_id))
    failed_task = repository.list_project_tasks(project_id)[-1]
    assert failed_task.stage == Stage.CHARACTER
    assert failed_task.status == Status.FAILED
    assert failed_task.output_asset_ids == []


@pytest.mark.parametrize("operation_type", ["edit", "regenerate"])
def test_character_asset_iteration_download_timeout_fails_without_new_asset(
    client: TestClient,
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    background_task_runner,
    project_payload: dict[str, object],
    operation_type: str,
) -> None:
    project_id = _create_project_and_story(client, project_payload)
    source_asset = _create_source_character_asset(repository, project_id)
    source_assets = [source_asset]
    test_asset_storage.downloader = ReadTimeoutDownloader()

    failed_response = client.post(
        f"/api/projects/{project_id}/character-assets/iterations",
        json={
            "asset_id": source_asset.id,
            "prompt": "让角色穿浅蓝色通勤外套",
            "operation_type": operation_type,
        },
    )

    assert failed_response.status_code == 200
    assert failed_response.json()["task"]["status"] == "running"
    assert "X-Tos-Signature" not in str(failed_response.json())
    asyncio.run(background_task_runner.run_pending())
    assert repository.list_assets(
        project_id=project_id,
        category=AssetCategory.CHARACTER,
        status=Status.SUCCEEDED,
    ) == source_assets
    assert all(
        asset.status == Status.SUCCEEDED
        for asset in repository.list_project_assets(project_id)
    )
    failed_task = repository.list_project_tasks(project_id)[-1]
    assert failed_task.stage == Stage.CHARACTER
    assert failed_task.status == Status.FAILED
    assert failed_task.output_asset_ids == []
    assert failed_task.error is not None
    assert failed_task.error.message == "character asset iteration failed"
    assert failed_task.error.detail == "ReadTimeout"


@pytest.mark.parametrize("operation_type", ["edit", "regenerate"])
def test_character_asset_iteration_model_failure_rolls_back_and_sanitizes_error(
    client: TestClient,
    repository: InMemoryRepository,
    background_task_runner,
    project_payload: dict[str, object],
    operation_type: str,
) -> None:
    project_id = _create_project_and_story(client, project_payload)
    source_asset = _create_source_character_asset(repository, project_id)
    source_assets = [source_asset]

    client.app.dependency_overrides[get_modelark_generation_service] = (
        lambda: ModelArkGenerationService(FailingIterationAdapter())
    )

    failed_response = client.post(
        f"/api/projects/{project_id}/character-assets/iterations",
        json={
            "asset_id": source_asset.id,
            "prompt": "让角色穿浅蓝色通勤外套",
            "operation_type": operation_type,
        },
    )

    assert failed_response.status_code == 200
    assert failed_response.json()["task"]["status"] == "running"
    response_body = str(failed_response.json())
    assert "raw-secret" not in response_body
    assert "X-Tos-Signature" not in response_body
    assert "provider secret" not in response_body
    asyncio.run(background_task_runner.run_pending())
    assert repository.list_assets(
        project_id=project_id,
        category=AssetCategory.CHARACTER,
        status=Status.SUCCEEDED,
    ) == source_assets
    assert all(
        asset.status == Status.SUCCEEDED
        for asset in repository.list_project_assets(project_id)
    )
    failed_task = repository.list_project_tasks(project_id)[-1]
    assert failed_task.stage == Stage.CHARACTER
    assert failed_task.status == Status.FAILED
    assert failed_task.output_asset_ids == []
    assert failed_task.error is not None
    assert failed_task.error.message == "character asset iteration failed"
    assert "raw-secret" not in str(failed_task.error)
    assert "X-Tos-Signature" not in str(failed_task.error)
