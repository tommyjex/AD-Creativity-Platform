import pytest

from backend.app.repositories import InMemoryRepository, MySQLRepository
from backend.app.schemas import (
    AssetCreate,
    AssetCategory,
    AssetType,
    CharacterCardCreate,
    ErrorCode,
    ProjectCreate,
    ProjectUpdate,
    Stage,
    Status,
    StoryboardShotCreate,
    TargetLanguage,
)
from backend.app.services.assets import AssetStorageService
from backend.app.services.workflow import WorkflowError, WorkflowService


def _create_project(
    repository: InMemoryRepository,
    project_payload: dict[str, object],
) -> str:
    return repository.create_project(ProjectCreate.model_validate(project_payload)).id


def test_workflow_rejects_missing_stage_dependency(
    repository: InMemoryRepository,
    workflow: WorkflowService,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project(repository, project_payload)

    with pytest.raises(WorkflowError) as exc_info:
        workflow.create_task(project_id, Stage.SCRIPT)

    assert exc_info.value.code == ErrorCode.DEPENDENCY_MISSING
    assert "story" in exc_info.value.message


def test_tail_frame_reference_assets_are_not_marked_stale(
    repository: InMemoryRepository,
    workflow: WorkflowService,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project(repository, project_payload)
    video = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://shot.mp4",
            mime_type="video/mp4",
        )
    )
    tail_frame_reference = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            category=AssetCategory.REFERENCE,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            url="mock://tail-frame.png",
            mime_type="image/png",
            metadata={"usage": "storyboard_video_tail_frame_reference"},
        )
    )

    workflow.mark_downstream_stale(project_id, Stage.STORYBOARD)

    assert repository.get_asset(video.id).status == Status.STALE
    assert repository.get_asset(tail_frame_reference.id).status == Status.SUCCEEDED


def test_workflow_create_task_is_idempotent_for_active_stage(
    repository: InMemoryRepository,
    workflow: WorkflowService,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project(repository, project_payload)

    queued = workflow.create_task(project_id, Stage.STORY)
    same_queued = workflow.create_task(project_id, Stage.STORY)
    running = workflow.start_task(queued.id)
    same_running = workflow.create_task(project_id, Stage.STORY)

    assert same_queued.id == queued.id
    assert running.status == Status.RUNNING
    assert same_running.id == queued.id
    assert len(repository.list_project_tasks(project_id)) == 1


def test_workflow_allows_new_task_after_failure_for_retry(
    repository: InMemoryRepository,
    workflow: WorkflowService,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project(repository, project_payload)
    task = workflow.create_task(project_id, Stage.STORY)
    workflow.start_task(task.id)

    failed = workflow.fail_task(
        task.id,
        message="provider failed",
        detail="timeout",
    )
    retry_task = workflow.create_task(project_id, Stage.STORY)

    assert failed.status == Status.FAILED
    assert failed.error is not None
    assert failed.error.code == ErrorCode.GENERATION_FAILED
    assert retry_task.id != task.id
    assert retry_task.status == Status.QUEUED
    assert len(repository.list_project_tasks(project_id)) == 2


def test_workflow_marks_downstream_outputs_stale_after_upstream_edit(
    repository: InMemoryRepository,
    workflow: WorkflowService,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project(repository, project_payload)
    story = workflow.write_text_artifact(
        project_id,
        Stage.STORY,
        content="story v1",
    )
    script = workflow.write_text_artifact(
        project_id,
        Stage.SCRIPT,
        content="script v1",
    )
    storyboard = workflow.write_text_artifact(
        project_id,
        Stage.STORYBOARD,
        content="storyboard v1",
    )
    image = workflow.create_asset(
        project_id,
        AssetType.GENERATED_IMAGE,
        stage=Stage.IMAGE,
        status=Status.SUCCEEDED,
        url="mock://image.png",
    )
    video = workflow.create_asset(
        project_id,
        AssetType.STORYBOARD_VIDEO,
        stage=Stage.VIDEO,
        status=Status.SUCCEEDED,
        url="mock://video.mp4",
    )
    final = workflow.create_asset(
        project_id,
        AssetType.FINAL_VIDEO,
        stage=Stage.COMPOSE,
        status=Status.SUCCEEDED,
        url="mock://final.mp4",
    )

    edited = workflow.edit_text_artifact(
        project_id,
        Stage.STORY,
        content="story v2",
    )

    assert edited.id == story.id
    assert edited.version == 2
    assert repository.get_text_artifact(story.id).status == Status.SUCCEEDED
    assert repository.get_text_artifact(script.id).status == Status.STALE
    assert repository.get_text_artifact(storyboard.id).status == Status.STALE
    assert repository.get_asset(image.id).status == Status.STALE
    assert repository.get_asset(video.id).status == Status.STALE
    assert repository.get_asset(final.id).status == Status.STALE
    assert repository.get_project(project_id).status == Status.STALE


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_language_change_marks_character_dependents_stale_without_deleting_history(
    repository_fixture: str,
    request: pytest.FixtureRequest,
    test_asset_storage: AssetStorageService,
    project_payload: dict[str, object],
) -> None:
    repository = request.getfixturevalue(repository_fixture)
    workflow = WorkflowService(repository, test_asset_storage)
    project_id = _create_project(repository, project_payload)
    story = workflow.write_text_artifact(
        project_id,
        Stage.STORY,
        content="retained story",
    )
    script = workflow.write_text_artifact(
        project_id,
        Stage.SCRIPT,
        content="stale script",
    )
    storyboard_text = workflow.write_text_artifact(
        project_id,
        Stage.STORYBOARD,
        content="stale storyboard",
    )
    character_asset = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            category=AssetCategory.CHARACTER,
            stage=Stage.CHARACTER,
            status=Status.SUCCEEDED,
            url="mock://character.png",
        )
    )
    card = repository.create_character_card(
        CharacterCardCreate(
            project_id=project_id,
            name="店主",
            description="真实门店里的年轻店主",
            asset_id=character_asset.id,
            status=Status.SUCCEEDED,
        )
    )
    image = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            stage=Stage.IMAGE,
            status=Status.SUCCEEDED,
            url="mock://shot.png",
        )
    )
    shot = repository.replace_project_storyboard(
        project_id,
        [
            StoryboardShotCreate(
                project_id=project_id,
                index=1,
                description="Retained shot",
                visual_prompt="Retained visual",
                image_asset_id=image.id,
                status=Status.SUCCEEDED,
            )
        ],
    )[0]
    original_ids = {
        "artifacts": [
            artifact.id
            for artifact in repository.list_project_text_artifacts(project_id)
        ],
        "cards": [
            item.id for item in repository.list_project_character_cards(project_id)
        ],
        "shots": [item.id for item in repository.list_project_storyboard(project_id)],
        "assets": [asset.id for asset in repository.list_project_assets(project_id)],
    }

    workflow.mark_language_dependents_stale(project_id)

    project = repository.get_project(project_id)
    assert project.current_stage == Stage.CHARACTER
    assert project.status == Status.STALE
    assert repository.get_text_artifact(story.id).status == Status.SUCCEEDED
    assert repository.get_text_artifact(script.id).status == Status.STALE
    assert repository.get_text_artifact(storyboard_text.id).status == Status.STALE
    assert repository.get_character_card(project_id, card.id).status == Status.STALE
    assert repository.get_storyboard_shot(project_id, shot.id).status == Status.STALE
    assert repository.get_asset(character_asset.id).status == Status.STALE
    assert repository.get_asset(image.id).status == Status.STALE
    assert {
        "artifacts": [
            artifact.id
            for artifact in repository.list_project_text_artifacts(project_id)
        ],
        "cards": [
            item.id for item in repository.list_project_character_cards(project_id)
        ],
        "shots": [item.id for item in repository.list_project_storyboard(project_id)],
        "assets": [asset.id for asset in repository.list_project_assets(project_id)],
    } == original_ids
    assert (
        repository.get_character_card(project_id, card.id).asset_id
        == character_asset.id
    )
    assert repository.get_storyboard_shot(project_id, shot.id).image_asset_id == image.id


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_character_input_hash_includes_target_language(
    repository_fixture: str,
    request: pytest.FixtureRequest,
    test_asset_storage: AssetStorageService,
    project_payload: dict[str, object],
) -> None:
    repository = request.getfixturevalue(repository_fixture)
    workflow = WorkflowService(repository, test_asset_storage)
    project_id = _create_project(repository, project_payload)
    workflow.write_text_artifact(project_id, Stage.STORY, content="same story")
    task = workflow.create_task(project_id, Stage.CHARACTER)
    workflow.start_task(task.id)
    workflow.complete_task(task.id)
    repository.create_character_card(
        CharacterCardCreate(
            project_id=project_id,
            name="店主",
            description="中文角色",
            status=Status.SUCCEEDED,
        )
    )

    chinese_hash = workflow.compute_input_hash(project_id, Stage.CHARACTER)
    assert task.input_hash == chinese_hash
    repository.update_project_details(
        project_id,
        ProjectUpdate.model_validate({"brief": {"target_language": "en"}}),
    )
    english_hash = workflow.compute_input_hash(project_id, Stage.CHARACTER)

    assert repository.get_project(project_id).brief.target_language == TargetLanguage.EN
    assert english_hash != chinese_hash
    with pytest.raises(WorkflowError) as exc_info:
        workflow.validate_stage_dependencies(project_id, Stage.SCRIPT)
    assert exc_info.value.code == ErrorCode.DEPENDENCY_MISSING


def _seed_downstream_outputs(
    workflow: WorkflowService,
    project_id: str,
) -> dict[str, str]:
    workflow.write_text_artifact(project_id, Stage.STORY, content="story v1")
    script = workflow.write_text_artifact(project_id, Stage.SCRIPT, content="script v1")
    storyboard = workflow.write_text_artifact(
        project_id, Stage.STORYBOARD, content="storyboard v1"
    )
    image = workflow.create_asset(
        project_id,
        AssetType.GENERATED_IMAGE,
        stage=Stage.IMAGE,
        status=Status.SUCCEEDED,
        url="mock://image.png",
    )
    video = workflow.create_asset(
        project_id,
        AssetType.STORYBOARD_VIDEO,
        stage=Stage.VIDEO,
        status=Status.SUCCEEDED,
        url="mock://video.mp4",
    )
    return {"script": script.id, "storyboard": storyboard.id, "image": image.id, "video": video.id}


def test_character_card_metadata_edit_keeps_downstream_fresh(
    repository: InMemoryRepository,
    workflow: WorkflowService,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project(repository, project_payload)
    character_asset = workflow.create_asset(
        project_id,
        AssetType.GENERATED_IMAGE,
        stage=Stage.CHARACTER,
        category=AssetCategory.CHARACTER,
        status=Status.SUCCEEDED,
        url="mock://character.png",
    )
    card = repository.create_character_card(
        CharacterCardCreate(
            project_id=project_id,
            name="店主",
            description="真实门店里的年轻店主",
            asset_id=character_asset.id,
            status=Status.SUCCEEDED,
        )
    )
    outputs = _seed_downstream_outputs(workflow, project_id)

    # Editing metadata only (name/description) must NOT invalidate downstream,
    # because the already-generated character image is unchanged.
    workflow.update_character_card(
        project_id,
        card.id,
        name="资深店主",
        description="真实门店里忙碌但自信的年轻店主，蓝色围裙。",
    )

    assert repository.get_text_artifact(outputs["script"]).status == Status.SUCCEEDED
    assert repository.get_text_artifact(outputs["storyboard"]).status == Status.SUCCEEDED
    assert repository.get_asset(outputs["image"]).status == Status.SUCCEEDED
    assert repository.get_asset(outputs["video"]).status == Status.SUCCEEDED


def test_character_card_image_change_marks_downstream_stale(
    repository: InMemoryRepository,
    workflow: WorkflowService,
    project_payload: dict[str, object],
) -> None:
    project_id = _create_project(repository, project_payload)
    card = repository.create_character_card(
        CharacterCardCreate(
            project_id=project_id,
            name="店主",
            description="真实门店里的年轻店主",
            status=Status.DRAFT,
        )
    )
    outputs = _seed_downstream_outputs(workflow, project_id)
    new_image = workflow.create_asset(
        project_id,
        AssetType.GENERATED_IMAGE,
        stage=Stage.CHARACTER,
        category=AssetCategory.CHARACTER,
        status=Status.SUCCEEDED,
        url="mock://character-new.png",
    )

    # Linking a (new) character image changes the visual input -> downstream
    # generated assets must be invalidated.
    workflow.update_character_card(project_id, card.id, asset_id=new_image.id)

    assert repository.get_text_artifact(outputs["script"]).status == Status.STALE
    assert repository.get_text_artifact(outputs["storyboard"]).status == Status.STALE
    assert repository.get_asset(outputs["image"]).status == Status.STALE
    assert repository.get_asset(outputs["video"]).status == Status.STALE
    assert repository.get_project(project_id).status == Status.STALE


def test_workflow_behaviors_work_with_mysql_repository(
    mysql_repository: MySQLRepository,
    test_asset_storage: AssetStorageService,
    project_payload: dict[str, object],
) -> None:
    workflow = WorkflowService(mysql_repository, test_asset_storage)
    dependency_project_id = _create_project(mysql_repository, project_payload)

    with pytest.raises(WorkflowError) as exc_info:
        workflow.create_task(dependency_project_id, Stage.SCRIPT)
    assert exc_info.value.code == ErrorCode.DEPENDENCY_MISSING

    idempotent_project_id = _create_project(mysql_repository, project_payload)
    queued = workflow.create_task(idempotent_project_id, Stage.STORY)
    same_queued = workflow.create_task(idempotent_project_id, Stage.STORY)
    workflow.start_task(queued.id)
    same_running = workflow.create_task(idempotent_project_id, Stage.STORY)

    assert same_queued.id == queued.id
    assert same_running.id == queued.id
    assert len(mysql_repository.list_project_tasks(idempotent_project_id)) == 1

    retry_project_id = _create_project(mysql_repository, project_payload)
    failed_task = workflow.create_task(retry_project_id, Stage.STORY)
    workflow.start_task(failed_task.id)
    failed = workflow.fail_task(
        failed_task.id,
        message="provider failed",
        detail="timeout",
    )
    retry_task = workflow.create_task(retry_project_id, Stage.STORY)

    assert failed.status == Status.FAILED
    assert failed.error is not None
    assert failed.error.code == ErrorCode.GENERATION_FAILED
    assert retry_task.id != failed_task.id
    assert retry_task.status == Status.QUEUED
    assert len(mysql_repository.list_project_tasks(retry_project_id)) == 2

    stale_project_id = _create_project(mysql_repository, project_payload)
    story = workflow.write_text_artifact(
        stale_project_id,
        Stage.STORY,
        content="story v1",
    )
    script = workflow.write_text_artifact(
        stale_project_id,
        Stage.SCRIPT,
        content="script v1",
    )
    storyboard = workflow.write_text_artifact(
        stale_project_id,
        Stage.STORYBOARD,
        content="storyboard v1",
    )
    image = workflow.create_asset(
        stale_project_id,
        AssetType.GENERATED_IMAGE,
        stage=Stage.IMAGE,
        status=Status.SUCCEEDED,
        url="mock://image.png",
    )
    video = workflow.create_asset(
        stale_project_id,
        AssetType.STORYBOARD_VIDEO,
        stage=Stage.VIDEO,
        status=Status.SUCCEEDED,
        url="mock://video.mp4",
    )
    final = workflow.create_asset(
        stale_project_id,
        AssetType.FINAL_VIDEO,
        stage=Stage.COMPOSE,
        status=Status.SUCCEEDED,
        url="mock://final.mp4",
    )

    edited = workflow.edit_text_artifact(
        stale_project_id,
        Stage.STORY,
        content="story v2",
    )

    assert edited.id == story.id
    assert edited.version == 2
    assert mysql_repository.get_text_artifact(story.id).status == Status.SUCCEEDED
    assert mysql_repository.get_text_artifact(script.id).status == Status.STALE
    assert mysql_repository.get_text_artifact(storyboard.id).status == Status.STALE
    assert mysql_repository.get_asset(image.id).status == Status.STALE
    assert mysql_repository.get_asset(video.id).status == Status.STALE
    assert mysql_repository.get_asset(final.id).status == Status.STALE
    assert mysql_repository.get_project(stale_project_id).status == Status.STALE
