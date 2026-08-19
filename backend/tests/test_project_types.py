from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from backend.app.db import create_database_engine, init_database, make_session_factory
from backend.app.repositories import MySQLRepository, Repository
from backend.app.schemas import (
    ImagePurpose,
    ProjectCreate,
    ProjectType,
    ProjectUpdate,
)


def _image_project_payload(**brief_overrides: object) -> dict[str, object]:
    brief: dict[str, object] = {
        "prompt": "Create a clean product hero image.",
        "product_name": "AdPilot",
        "audience": "small business owners",
        "selling_points": ["fast iteration"],
        "target_platform": "legacy_custom_marketplace",
        "aspect_ratio": "1:1",
        "target_language": "zh",
        "image_purpose": "ecommerce_main",
    }
    brief.update(brief_overrides)
    return {
        "name": "Product Hero",
        "project_type": "image_asset",
        "brief": brief,
    }


def test_legacy_project_create_defaults_to_video_ad_and_duration_30() -> None:
    project = ProjectCreate.model_validate(
        {"name": "Legacy Video", "brief": {"prompt": "Create an ad"}}
    )

    assert project.project_type == ProjectType.VIDEO_AD
    assert project.brief.duration_seconds == 30
    assert project.brief.image_purpose is None


def test_image_project_create_accepts_complete_brief_and_normalizes_duration() -> None:
    project = ProjectCreate.model_validate(_image_project_payload())

    assert project.project_type == ProjectType.IMAGE_ASSET
    assert project.brief.image_purpose == ImagePurpose.ECOMMERCE_MAIN
    assert project.brief.duration_seconds is None
    assert project.brief.target_platform == "legacy_custom_marketplace"


@pytest.mark.parametrize(
    "missing_field",
    [
        "prompt",
        "product_name",
        "audience",
        "selling_points",
        "target_platform",
        "aspect_ratio",
        "target_language",
        "image_purpose",
    ],
)
def test_image_project_create_requires_complete_brief(missing_field: str) -> None:
    payload = _image_project_payload()
    brief = payload["brief"]
    assert isinstance(brief, dict)
    brief.pop(missing_field)

    with pytest.raises(ValidationError) as exc_info:
        ProjectCreate.model_validate(payload)

    assert missing_field in str(exc_info.value)


@pytest.mark.parametrize(
    "payload",
    [
        _image_project_payload(duration_seconds=30),
        _image_project_payload(selling_points=[]),
        _image_project_payload(selling_points=[""]),
        {
            "project_type": "video_ad",
            "brief": {
                "prompt": "Create an ad",
                "duration_seconds": None,
            },
        },
        {
            "project_type": "video_ad",
            "brief": {
                "prompt": "Create an ad",
                "image_purpose": "poster",
            },
        },
    ],
)
def test_project_create_rejects_invalid_type_brief_combinations(
    payload: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        ProjectCreate.model_validate(payload)


def test_project_update_does_not_expose_project_type() -> None:
    with pytest.raises(ValidationError):
        ProjectUpdate.model_validate({"project_type": "image_asset"})


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_repository_generic_updates_reject_project_type_directly(
    repository_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    repository: Repository = request.getfixturevalue(repository_fixture)
    project = repository.create_project(
        ProjectCreate.model_validate(_image_project_payload())
    )

    with pytest.raises(ValueError, match="project_type cannot be updated"):
        repository.update_project(
            project.id,
            project_type=ProjectType.VIDEO_AD,
        )
    bypassed_schema = ProjectUpdate.model_construct(
        _fields_set={"project_type"},
    )
    with pytest.raises(ValueError, match="project_type cannot be updated"):
        repository.update_project_details(project.id, bypassed_schema)

    assert repository.get_project(project.id).project_type == ProjectType.IMAGE_ASSET


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_repositories_map_image_project_across_create_get_list_search_and_update(
    repository_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    repository: Repository = request.getfixturevalue(repository_fixture)
    created = repository.create_project(
        ProjectCreate.model_validate(_image_project_payload())
    )

    fetched = repository.get_project(created.id)
    listed = repository.list_project_summaries()
    searched = repository.list_project_summaries("Product Hero")
    updated = repository.update_project_details(
        created.id,
        ProjectUpdate.model_validate(
            {"brief": {"image_purpose": "poster", "target_platform": "archived-shop"}}
        ),
    )

    assert created.project_type == ProjectType.IMAGE_ASSET
    assert fetched.project_type == ProjectType.IMAGE_ASSET
    assert listed[0].project_type == ProjectType.IMAGE_ASSET
    assert searched[0].project_type == ProjectType.IMAGE_ASSET
    assert created.brief.duration_seconds is None
    assert updated.brief.image_purpose == ImagePurpose.POSTER
    assert updated.brief.target_platform == "archived-shop"

    with pytest.raises(ValidationError):
        repository.update_project_details(
            created.id,
            ProjectUpdate.model_validate({"brief": {"duration_seconds": 30}}),
        )


@pytest.mark.parametrize("client_fixture", ["client", "mysql_client"])
def test_project_type_is_returned_and_cannot_be_updated(
    client_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    client: TestClient = request.getfixturevalue(client_fixture)
    created = client.post("/api/projects", json=_image_project_payload())

    assert created.status_code == 201
    assert created.json()["project_type"] == "image_asset"
    assert client.get("/api/projects").json()[0]["project_type"] == "image_asset"

    updated = client.patch(
        f"/api/projects/{created.json()['id']}",
        json={"project_type": "video_ad"},
    )
    assert updated.status_code == 422


@pytest.mark.parametrize("client_fixture", ["client", "mysql_client"])
def test_image_project_update_rejects_video_duration(
    client_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    client: TestClient = request.getfixturevalue(client_fixture)
    created = client.post("/api/projects", json=_image_project_payload()).json()

    response = client.patch(
        f"/api/projects/{created['id']}",
        json={"brief": {"duration_seconds": 30}},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"


def test_project_type_migration_backfills_legacy_rows_and_is_idempotent(
    tmp_path,
) -> None:
    engine = create_database_engine(f"sqlite:///{tmp_path / 'legacy.sqlite'}")
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE project_owners ("
                "id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL)"
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE projects (
                    id VARCHAR(36) PRIMARY KEY,
                    owner_id VARCHAR(36),
                    name VARCHAR(120) NOT NULL,
                    status VARCHAR(16) NOT NULL,
                    current_stage VARCHAR(16) NOT NULL,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL,
                    FOREIGN KEY(owner_id) REFERENCES project_owners(id)
                )
                """
            )
        )
        connection.execute(
            text("CREATE INDEX ix_projects_legacy_name ON projects (name)")
        )
        connection.execute(
            text(
                """
                CREATE TABLE project_briefs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id VARCHAR(36) NOT NULL UNIQUE,
                    prompt TEXT NOT NULL,
                    target_language VARCHAR(2) NOT NULL DEFAULT 'zh',
                    target_platform VARCHAR(64) NOT NULL,
                    aspect_ratio VARCHAR(16) NOT NULL,
                    duration_seconds INTEGER NOT NULL DEFAULT 30,
                    style VARCHAR(120),
                    audience VARCHAR(255),
                    product_name VARCHAR(120),
                    summary TEXT,
                    selling_points JSON NOT NULL,
                    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
                )
                """
            )
        )
        connection.execute(
            text(
                "INSERT INTO project_owners (id, name) "
                "VALUES ('owner-1', 'Legacy Owner')"
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO projects
                    (id, owner_id, name, status, current_stage,
                     created_at, updated_at)
                VALUES
                    ('legacy-project', 'owner-1', 'Legacy', 'draft', 'brief',
                     '2026-08-01 00:00:00', '2026-08-01 00:00:00')
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO project_briefs
                    (project_id, prompt, target_platform, aspect_ratio,
                     duration_seconds, selling_points)
                VALUES
                    ('legacy-project', 'Legacy prompt', 'old-platform',
                     '9:16', 30, '["retained"]')
                """
            )
        )

    init_database(engine)
    init_database(engine)

    project_columns = {
        column["name"]: column for column in inspect(engine).get_columns("projects")
    }
    brief_columns = {
        column["name"]: column
        for column in inspect(engine).get_columns("project_briefs")
    }
    assert project_columns["project_type"]["nullable"] is False
    assert project_columns["current_image_prompt_version_id"]["nullable"] is True
    assert project_columns["image_prompt_status"]["nullable"] is False
    assert project_columns["current_image_asset_id"]["nullable"] is True
    assert project_columns["image_revision"]["nullable"] is False
    assert brief_columns["duration_seconds"]["nullable"] is True
    assert brief_columns["image_purpose"]["nullable"] is True
    assert "ix_projects_legacy_name" in {
        index["name"] for index in inspect(engine).get_indexes("projects")
    }
    assert inspect(engine).get_foreign_keys("project_briefs")[0][
        "referred_table"
    ] == "projects"
    assert inspect(engine).get_foreign_keys("projects")[0][
        "referred_table"
    ] == "project_owners"

    with engine.connect() as connection:
        row = connection.execute(
            text(
                """
                SELECT p.project_type, b.prompt, b.target_platform,
                       b.duration_seconds, b.image_purpose, b.selling_points
                FROM projects p
                JOIN project_briefs b ON b.project_id = p.id
                WHERE p.id = 'legacy-project'
                """
            )
        ).one()
    assert row.project_type == "video_ad"
    assert row.prompt == "Legacy prompt"
    assert row.target_platform == "old-platform"
    assert row.duration_seconds == 30
    assert row.image_purpose is None
    assert row.selling_points == '["retained"]'
    with pytest.raises(IntegrityError):
        with engine.begin() as connection:
            connection.execute(
                text(
                    "UPDATE projects SET project_type = NULL "
                    "WHERE id = 'legacy-project'"
                )
            )

    repository = MySQLRepository(make_session_factory(engine))
    assert repository.get_project("legacy-project").project_type == ProjectType.VIDEO_AD
