import pytest

from backend.app.repositories import InMemoryRepository, MySQLRepository
from backend.app.repositories.base import NotFoundError
from backend.app.schemas import (
    AssetCategory,
    AssetCreate,
    AssetType,
    CharacterCardCreate,
    ProjectCreate,
    Stage,
    Status,
)


def _create_project(repository: InMemoryRepository | MySQLRepository) -> str:
    project = repository.create_project(
        ProjectCreate.model_validate(
            {
                "name": "Character Cards",
                "brief": {"prompt": "Create a short ad with two characters."},
            }
        )
    )
    return project.id


def _create_character_asset(
    repository: InMemoryRepository | MySQLRepository,
    project_id: str,
) -> str:
    asset = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            category=AssetCategory.CHARACTER,
            stage=Stage.CHARACTER,
            status=Status.SUCCEEDED,
            url="mock://character.png",
        )
    )
    return asset.id


def test_in_memory_repository_manages_character_cards() -> None:
    repository = InMemoryRepository()
    project_id = _create_project(repository)
    asset_id = _create_character_asset(repository, project_id)

    second = repository.create_character_card(
        CharacterCardCreate(
            project_id=project_id,
            name="Assistant",
            description="A warm assistant, realistic commercial still.",
            sort_order=2,
        )
    )
    first = repository.create_character_card(
        CharacterCardCreate(
            project_id=project_id,
            name="Presenter",
            description="A confident presenter, realistic commercial still.",
            sort_order=1,
            asset_id=asset_id,
            status=Status.SUCCEEDED,
        )
    )

    assert [card.id for card in repository.list_project_character_cards(project_id)] == [
        first.id,
        second.id,
    ]
    assert [card.id for card in repository.get_project(project_id).character_cards] == [
        first.id,
        second.id,
    ]

    updated = repository.update_character_card(
        project_id,
        first.id,
        name="Lead Presenter",
        description="Updated prompt",
        asset_id=None,
    )
    assert updated.name == "Lead Presenter"
    assert updated.description == "Updated prompt"
    assert updated.asset_id is None

    deleted = repository.delete_character_card(project_id, second.id)
    assert deleted.id == second.id
    with pytest.raises(NotFoundError):
        repository.get_character_card(project_id, second.id)


def test_mysql_repository_persists_character_cards_and_clears_deleted_asset(
    mysql_repository: MySQLRepository,
) -> None:
    project_id = _create_project(mysql_repository)
    asset_id = _create_character_asset(mysql_repository, project_id)
    card = mysql_repository.create_character_card(
        CharacterCardCreate(
            project_id=project_id,
            name="Presenter",
            description="A confident presenter, realistic commercial still.",
            sort_order=1,
            asset_id=asset_id,
            status=Status.SUCCEEDED,
        )
    )

    fetched = mysql_repository.get_character_card(project_id, card.id)
    assert fetched.asset_id == asset_id
    assert mysql_repository.get_project(project_id).character_cards == [fetched]

    mysql_repository.delete_asset(project_id, asset_id)

    cleared = mysql_repository.get_character_card(project_id, card.id)
    assert cleared.asset_id is None
    assert cleared.status == Status.SUCCEEDED


def test_project_detail_api_returns_character_cards(
    client,
    repository: InMemoryRepository,
) -> None:
    project_id = _create_project(repository)
    asset_id = _create_character_asset(repository, project_id)
    card = repository.create_character_card(
        CharacterCardCreate(
            project_id=project_id,
            name="Presenter",
            description="A confident presenter, realistic commercial still.",
            sort_order=1,
            asset_id=asset_id,
            status=Status.SUCCEEDED,
        )
    )

    response = client.get(f"/api/projects/{project_id}")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["character_cards"]) == 1
    returned = payload["character_cards"][0]
    assert returned["id"] == card.id
    assert returned["project_id"] == project_id
    assert returned["name"] == "Presenter"
    assert returned["description"] == "A confident presenter, realistic commercial still."
    assert returned["sort_order"] == 1
    assert returned["asset_id"] == asset_id
    assert returned["status"] == "succeeded"
    assert returned["created_at"]
    assert returned["updated_at"]
