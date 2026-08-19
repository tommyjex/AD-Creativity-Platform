from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from backend.app.db.models import (
    AssetORM,
    BriefORM,
    CharacterCardORM,
    GenerationTaskORM,
    ProjectORM,
    StoryboardShotORM,
    TextArtifactORM,
)
from backend.app.repositories import (
    InMemoryRepository,
    MySQLRepository,
    NotFoundError,
    Repository,
)
from backend.app.schemas import (
    AssetCategory,
    AssetCreate,
    AssetType,
    CharacterCardCreate,
    GenerationTaskCreate,
    ProjectCreate,
    ProjectUpdate,
    Stage,
    Status,
    StoryboardShotCreate,
    StoryboardShotVideoConfigUpdate,
    TargetLanguage,
    TextArtifactCreate,
)


def _project_data(name: str, product_name: str = "AdPilot") -> ProjectCreate:
    return ProjectCreate.model_validate(
        {
            "name": name,
            "brief": {
                "prompt": f"Create an ad for {product_name}.",
                "product_name": product_name,
            },
        }
    )


def _assert_project_list_and_update(
    client: TestClient,
    project_payload: dict[str, object],
) -> None:
    first = client.post("/api/projects", json=project_payload).json()
    second_payload = {
        **project_payload,
        "name": "Second Campaign",
    }
    second = client.post("/api/projects", json=second_payload).json()

    listed = client.get("/api/projects")

    assert listed.status_code == 200
    assert [project["id"] for project in listed.json()] == [first["id"], second["id"]]
    assert "assets" not in listed.json()[0]
    assert listed.json()[0]["brief"]["product_name"] == "AdPilot"
    assert listed.json()[0]["brief"]["target_language"] == "zh"

    updated = client.patch(
        f"/api/projects/{first['id']}",
        json={
            "name": "Updated Campaign",
            "brief": {
                "prompt": "Create a concise product launch ad.",
                "target_language": "en",
                "target_platform": "youtube",
                "duration_seconds": 45,
                "style": None,
            },
        },
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["name"] == "Updated Campaign"
    assert body["brief"]["prompt"] == "Create a concise product launch ad."
    assert body["brief"]["target_language"] == "en"
    assert body["brief"]["target_platform"] == "youtube"
    assert body["brief"]["duration_seconds"] == 45
    assert body["brief"]["style"] is None
    assert body["brief"]["aspect_ratio"] == "9:16"

    fetched = client.get(f"/api/projects/{first['id']}").json()
    assert fetched["name"] == body["name"]
    assert fetched["brief"] == body["brief"]


@pytest.mark.parametrize("client_fixture", ["client", "mysql_client"])
def test_project_list_and_atomic_update_api(
    client_fixture: str,
    request: pytest.FixtureRequest,
    project_payload: dict[str, object],
) -> None:
    _assert_project_list_and_update(
        request.getfixturevalue(client_fixture),
        project_payload,
    )


def _seed_language_dependent_history(
    repository: Repository,
    target_language: str,
) -> dict[str, object]:
    project = repository.create_project(
        ProjectCreate.model_validate(
            {
                "name": "Language Campaign",
                "brief": {
                    "prompt": "Create a launch ad.",
                    "target_language": target_language,
                },
            }
        )
    )
    story = repository.create_text_artifact(
        TextArtifactCreate(
            project_id=project.id,
            stage=Stage.STORY,
            content="Retained story",
            status=Status.SUCCEEDED,
        )
    )
    script = repository.create_text_artifact(
        TextArtifactCreate(
            project_id=project.id,
            stage=Stage.SCRIPT,
            content="Language-dependent script",
            status=Status.SUCCEEDED,
        )
    )
    storyboard_text = repository.create_text_artifact(
        TextArtifactCreate(
            project_id=project.id,
            stage=Stage.STORYBOARD,
            content="Language-dependent storyboard",
            status=Status.SUCCEEDED,
        )
    )
    character_asset = repository.create_asset(
        AssetCreate(
            project_id=project.id,
            type=AssetType.GENERATED_IMAGE,
            category=AssetCategory.CHARACTER,
            stage=Stage.CHARACTER,
            status=Status.SUCCEEDED,
            object_key=f"projects/{project.id}/character/retained.png",
        )
    )
    card = repository.create_character_card(
        CharacterCardCreate(
            project_id=project.id,
            name="Retained character",
            description="Must remain linked to its asset",
            asset_id=character_asset.id,
            status=Status.SUCCEEDED,
        )
    )
    image_asset = repository.create_asset(
        AssetCreate(
            project_id=project.id,
            type=AssetType.GENERATED_IMAGE,
            stage=Stage.IMAGE,
            status=Status.SUCCEEDED,
            object_key=f"projects/{project.id}/storyboard/retained.png",
        )
    )
    shot = repository.replace_project_storyboard(
        project.id,
        [
            StoryboardShotCreate(
                project_id=project.id,
                index=1,
                description="Retained shot",
                visual_prompt="Retained visual",
                image_asset_id=image_asset.id,
                status=Status.SUCCEEDED,
            )
        ],
    )[0]
    repository.update_project(
        project.id,
        current_stage=Stage.COMPOSE,
        status=Status.SUCCEEDED,
    )
    return {
        "project_id": project.id,
        "story_id": story.id,
        "script_id": script.id,
        "storyboard_text_id": storyboard_text.id,
        "card_id": card.id,
        "shot_id": shot.id,
        "character_asset_id": character_asset.id,
        "image_asset_id": image_asset.id,
        "artifact_ids": [
            item.id for item in repository.list_project_text_artifacts(project.id)
        ],
        "card_ids": [
            item.id for item in repository.list_project_character_cards(project.id)
        ],
        "shot_ids": [
            item.id for item in repository.list_project_storyboard(project.id)
        ],
        "asset_ids": [
            item.id for item in repository.list_project_assets(project.id)
        ],
    }


@pytest.mark.parametrize(
    ("repository_fixture", "client_fixture"),
    [("repository", "client"), ("mysql_repository", "mysql_client")],
)
@pytest.mark.parametrize(("old_language", "new_language"), [("zh", "en"), ("en", "zh")])
def test_project_language_change_api_returns_final_stale_state_and_retains_history(
    repository_fixture: str,
    client_fixture: str,
    old_language: str,
    new_language: str,
    request: pytest.FixtureRequest,
) -> None:
    repository: Repository = request.getfixturevalue(repository_fixture)
    client: TestClient = request.getfixturevalue(client_fixture)
    seeded = _seed_language_dependent_history(repository, old_language)
    project_id = str(seeded["project_id"])

    response = client.patch(
        f"/api/projects/{project_id}",
        json={"brief": {"target_language": new_language}},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["brief"]["target_language"] == new_language
    assert body["current_stage"] == "character"
    assert body["status"] == "stale"
    assert next(
        item for item in body["text_artifacts"] if item["id"] == seeded["story_id"]
    )["status"] == "succeeded"
    assert next(
        item for item in body["text_artifacts"] if item["id"] == seeded["script_id"]
    )["status"] == "stale"
    assert next(
        item
        for item in body["text_artifacts"]
        if item["id"] == seeded["storyboard_text_id"]
    )["status"] == "stale"
    assert body["character_cards"][0]["status"] == "stale"
    assert body["storyboard"][0]["status"] == "stale"
    assert {item["id"] for item in body["assets"]} == set(seeded["asset_ids"])
    assert all(item["status"] == "stale" for item in body["assets"])

    persisted = repository.get_project(project_id)
    assert [item.id for item in persisted.text_artifacts] == seeded["artifact_ids"]
    assert [item.id for item in persisted.character_cards] == seeded["card_ids"]
    assert [item.id for item in persisted.storyboard] == seeded["shot_ids"]
    assert [item.id for item in persisted.assets] == seeded["asset_ids"]
    assert persisted.character_cards[0].asset_id == seeded["character_asset_id"]
    assert persisted.storyboard[0].image_asset_id == seeded["image_asset_id"]


@pytest.mark.parametrize(
    ("repository_fixture", "client_fixture"),
    [("repository", "client"), ("mysql_repository", "mysql_client")],
)
def test_project_update_same_or_omitted_language_does_not_invalidate_outputs(
    repository_fixture: str,
    client_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    repository: Repository = request.getfixturevalue(repository_fixture)
    client: TestClient = request.getfixturevalue(client_fixture)
    seeded = _seed_language_dependent_history(repository, "zh")
    project_id = str(seeded["project_id"])

    same_language = client.patch(
        f"/api/projects/{project_id}",
        json={"brief": {"target_language": "zh"}},
    )
    omitted_language = client.patch(
        f"/api/projects/{project_id}",
        json={"brief": {"style": "documentary"}},
    )

    assert same_language.status_code == 200
    assert omitted_language.status_code == 200
    for body in (same_language.json(), omitted_language.json()):
        assert body["current_stage"] == "compose"
        assert body["status"] == "succeeded"
        assert all(
            item["status"] == "succeeded" for item in body["text_artifacts"]
        )
        assert body["character_cards"][0]["status"] == "succeeded"
        assert body["storyboard"][0]["status"] == "succeeded"
        assert all(item["status"] == "succeeded" for item in body["assets"])


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_repository_persists_target_language_across_project_contract(
    repository_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    repository: Repository = request.getfixturevalue(repository_fixture)
    created = repository.create_project(
        ProjectCreate.model_validate(
            {
                "name": "English Campaign",
                "brief": {
                    "prompt": "Create an English launch ad.",
                    "target_language": "en",
                },
            }
        )
    )

    assert created.brief.target_language == TargetLanguage.EN
    assert repository.get_project(created.id).brief.target_language == TargetLanguage.EN
    assert repository.list_project_summaries()[0].brief.target_language == (
        TargetLanguage.EN
    )

    updated = repository.update_project_details(
        created.id,
        ProjectUpdate.model_validate(
            {"brief": {"target_language": "zh"}}
        ),
    )

    assert updated.brief.target_language == TargetLanguage.ZH
    assert repository.get_project(created.id).brief.target_language == TargetLanguage.ZH
    assert repository.list_project_summaries()[0].brief.target_language == (
        TargetLanguage.ZH
    )


def test_project_update_rejects_empty_and_null_required_values() -> None:
    with pytest.raises(ValidationError):
        ProjectUpdate.model_validate({})
    with pytest.raises(ValidationError):
        ProjectUpdate.model_validate({"brief": {}})
    with pytest.raises(ValidationError):
        ProjectUpdate.model_validate({"name": None})
    with pytest.raises(ValidationError):
        ProjectUpdate.model_validate({"brief": {"prompt": None}})
    with pytest.raises(ValidationError):
        ProjectUpdate.model_validate({"brief": {"target_language": None}})


def test_mysql_project_and_brief_update_persist_together(
    mysql_session_factory: sessionmaker[Session],
) -> None:
    repository = MySQLRepository(mysql_session_factory)
    project = repository.create_project(_project_data("Original Campaign"))

    repository.update_project_details(
        project.id,
        ProjectUpdate.model_validate(
            {
                "name": "Persisted Campaign",
                "brief": {
                    "prompt": "Persist this updated brief.",
                    "selling_points": ["consistent", "atomic"],
                },
            }
        ),
    )

    persisted = MySQLRepository(mysql_session_factory).get_project(project.id)
    assert persisted.name == "Persisted Campaign"
    assert persisted.brief.prompt == "Persist this updated brief."
    assert persisted.brief.selling_points == ["consistent", "atomic"]


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_repository_filters_assets_by_project_category_and_status(
    repository_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    repository: Repository = request.getfixturevalue(repository_fixture)
    first_project = repository.create_project(_project_data("First Campaign"))
    second_project = repository.create_project(_project_data("Second Campaign", "Other"))

    character = repository.create_asset(
        AssetCreate(
            project_id=first_project.id,
            type=AssetType.GENERATED_IMAGE,
            category=AssetCategory.CHARACTER,
            stage=Stage.IMAGE,
            status=Status.SUCCEEDED,
        )
    )
    repository.create_asset(
        AssetCreate(
            project_id=first_project.id,
            type=AssetType.GENERATED_IMAGE,
            category=AssetCategory.SCENE,
            stage=Stage.IMAGE,
            status=Status.FAILED,
        )
    )
    repository.create_asset(
        AssetCreate(
            project_id=second_project.id,
            type=AssetType.GENERATED_IMAGE,
            category=AssetCategory.CHARACTER,
            stage=Stage.IMAGE,
            status=Status.SUCCEEDED,
        )
    )
    repository.create_asset(
        AssetCreate(
            project_id=first_project.id,
            type=AssetType.FINAL_VIDEO,
            stage=Stage.COMPOSE,
            status=Status.SUCCEEDED,
        )
    )

    filtered = repository.list_assets(
        project_id=first_project.id,
        category=AssetCategory.CHARACTER,
        status=Status.SUCCEEDED,
    )

    assert [asset.id for asset in filtered] == [character.id]
    assert filtered[0].category == AssetCategory.CHARACTER
    assert len(repository.list_assets(category=AssetCategory.CHARACTER)) == 2
    assert len(repository.list_assets(project_id=first_project.id)) == 3


def test_asset_api_supports_combined_filters_and_preserves_project_route(
    client: TestClient,
    repository: InMemoryRepository,
) -> None:
    first_project = repository.create_project(_project_data("First Campaign"))
    second_project = repository.create_project(_project_data("Second Campaign", "Other"))
    character = repository.create_asset(
        AssetCreate(
            project_id=first_project.id,
            type=AssetType.GENERATED_IMAGE,
            category=AssetCategory.CHARACTER,
            status=Status.SUCCEEDED,
        )
    )
    repository.create_asset(
        AssetCreate(
            project_id=first_project.id,
            type=AssetType.GENERATED_IMAGE,
            category=AssetCategory.SCENE,
            status=Status.FAILED,
        )
    )
    repository.create_asset(
        AssetCreate(
            project_id=second_project.id,
            type=AssetType.GENERATED_IMAGE,
            category=AssetCategory.CHARACTER,
            status=Status.SUCCEEDED,
        )
    )

    global_response = client.get(
        "/api/assets",
        params={
            "project_id": first_project.id,
            "category": "character",
            "status": "succeeded",
        },
    )
    project_response = client.get(
        f"/api/projects/{first_project.id}/assets",
        params={"category": "character", "status": "succeeded"},
    )

    assert global_response.status_code == 200
    assert project_response.status_code == 200
    assert [asset["id"] for asset in global_response.json()] == [character.id]
    assert project_response.json() == global_response.json()
    assert global_response.json()[0]["category"] == "character"


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_repository_searches_active_projects_across_summary_fields(
    repository_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    repository: Repository = request.getfixturevalue(repository_fixture)
    by_name = repository.create_project(
        ProjectCreate(
            name="Summer Launch",
            brief={"prompt": "A general campaign", "product_name": "Alpha"},
        )
    )
    by_product = repository.create_project(
        ProjectCreate(
            name="Second Campaign",
            brief={"prompt": "A general campaign", "product_name": "NeedlePro"},
        )
    )
    by_prompt = repository.create_project(
        ProjectCreate(
            name="Third Campaign",
            brief={"prompt": "Show a dramatic skyline reveal", "product_name": "Beta"},
        )
    )
    percent = repository.create_project(
        ProjectCreate(
            name="Save 50% Campaign",
            brief={"prompt": "Literal percentage", "product_name": "Gamma"},
        )
    )
    underscore = repository.create_project(
        ProjectCreate(
            name="Code_name Campaign",
            brief={"prompt": "Literal underscore", "product_name": "Delta"},
        )
    )

    assert [item.id for item in repository.list_project_summaries("  launch  ")] == [
        by_name.id
    ]
    assert [item.id for item in repository.list_project_summaries("NEEDLE")] == [
        by_product.id
    ]
    assert [item.id for item in repository.list_project_summaries("SKYLINE")] == [
        by_prompt.id
    ]
    assert [item.id for item in repository.list_project_summaries("%")] == [
        percent.id
    ]
    assert [item.id for item in repository.list_project_summaries("_")] == [
        underscore.id
    ]
    assert [item.id for item in repository.list_project_summaries("   ")] == [
        by_name.id,
        by_product.id,
        by_prompt.id,
        percent.id,
        underscore.id,
    ]


@pytest.mark.parametrize("client_fixture", ["client", "mysql_client"])
def test_project_list_api_accepts_search_query(
    client_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    client: TestClient = request.getfixturevalue(client_fixture)
    first = client.post(
        "/api/projects",
        json={
            "name": "Launch One",
            "brief": {"prompt": "A quiet opening", "product_name": "Alpha"},
        },
    ).json()
    second = client.post(
        "/api/projects",
        json={
            "name": "Campaign Two",
            "brief": {"prompt": "A bold finale", "product_name": "NeedlePro"},
        },
    ).json()

    assert [item["id"] for item in client.get(
        "/api/projects", params={"q": "  needle  "}
    ).json()] == [second["id"]]
    assert [item["id"] for item in client.get(
        "/api/projects", params={"q": " "}
    ).json()] == [first["id"], second["id"]]


@pytest.mark.parametrize(
    ("repository_fixture", "client_fixture"),
    [("repository", "client"), ("mysql_repository", "mysql_client")],
)
def test_project_soft_delete_hides_data_and_preserves_associations(
    repository_fixture: str,
    client_fixture: str,
    request: pytest.FixtureRequest,
    mysql_session_factory: sessionmaker[Session],
    test_asset_storage,
) -> None:
    repository: Repository = request.getfixturevalue(repository_fixture)
    client: TestClient = request.getfixturevalue(client_fixture)
    project = repository.create_project(_project_data("Delete Me"))
    retained = repository.create_project(_project_data("Keep Me", "Other"))
    task = repository.create_task(
        GenerationTaskCreate(project_id=project.id, stage=Stage.STORY)
    )
    artifact = repository.create_text_artifact(
        TextArtifactCreate(
            project_id=project.id,
            stage=Stage.STORY,
            content="Retained story",
        )
    )
    asset = repository.create_asset(
        AssetCreate(
            project_id=project.id,
            type=AssetType.GENERATED_IMAGE,
            category=AssetCategory.CHARACTER,
            stage=Stage.IMAGE,
            status=Status.SUCCEEDED,
            object_key=f"projects/{project.id}/image/retained.png",
        )
    )
    card = repository.create_character_card(
        CharacterCardCreate(
            project_id=project.id,
            name="Retained character",
            description="Must remain stored",
            asset_id=asset.id,
            status=Status.SUCCEEDED,
        )
    )
    shot = repository.replace_project_storyboard(
        project.id,
        [
            StoryboardShotCreate(
                project_id=project.id,
                index=1,
                description="Retained shot",
                visual_prompt="Retained visual",
            )
        ],
    )[0]

    deleted = client.delete(f"/api/projects/{project.id}")

    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.delete(f"/api/projects/{project.id}").status_code == 404
    assert client.delete("/api/projects/missing").status_code == 404
    assert [item["id"] for item in client.get("/api/projects").json()] == [
        retained.id
    ]
    assert client.get(f"/api/projects/{project.id}").status_code == 404
    assert client.patch(
        f"/api/projects/{project.id}", json={"name": "Still hidden"}
    ).status_code == 404
    assert client.get(f"/api/projects/{project.id}/assets").status_code == 404
    assert client.get(f"/api/tasks/{task.id}").status_code == 404
    assert client.get(f"/api/assets/{asset.id}/content").status_code == 404
    assert [item["id"] for item in client.get("/api/assets").json()] == []
    assert test_asset_storage.client.deletes == []

    with pytest.raises(NotFoundError):
        repository.get_task(task.id)
    with pytest.raises(NotFoundError):
        repository.get_asset(asset.id)
    with pytest.raises(NotFoundError):
        repository.get_text_artifact(artifact.id)
    with pytest.raises(NotFoundError):
        repository.update_task(task.id, progress=50)
    with pytest.raises(NotFoundError):
        repository.update_asset(asset.id, status=Status.STALE)
    with pytest.raises(NotFoundError):
        repository.update_text_artifact(artifact.id, status=Status.STALE)
    with pytest.raises(NotFoundError):
        repository.save_storyboard_shot_video_config(
            project.id,
            shot.id,
            StoryboardShotVideoConfigUpdate(video_prompt="Must stay hidden"),
        )

    if isinstance(repository, InMemoryRepository):
        assert project.id in repository._projects
        assert task.id in repository._tasks
        assert artifact.id in repository._text_artifacts
        assert asset.id in repository._assets
        assert card.id in repository._character_cards
        assert shot.id in repository._storyboard_shots
    else:
        with mysql_session_factory() as session:
            orm_project = session.get(ProjectORM, project.id)
            assert orm_project is not None
            assert orm_project.deleted_at is not None
            assert session.scalar(
                select(BriefORM).where(BriefORM.project_id == project.id)
            ) is not None
            assert session.get(GenerationTaskORM, task.id) is not None
            assert session.get(TextArtifactORM, artifact.id) is not None
            assert session.get(AssetORM, asset.id) is not None
            assert session.get(CharacterCardORM, card.id) is not None
            assert session.get(StoryboardShotORM, shot.id) is not None
