import pytest
from sqlalchemy import inspect, select, text
from sqlalchemy.dialects import mysql, sqlite
from sqlalchemy.exc import IntegrityError

from backend.app.db import (
    AigcPipelineTaskORM,
    Base,
    BriefORM,
    ProjectORM,
    create_database_engine,
    init_database,
    make_session_factory,
)
from backend.app.db.session import _rebuild_sqlite_table_with_type_override
from backend.app.repositories import InMemoryRepository, MySQLRepository
from backend.app.schemas import (
    AssetCategory,
    AssetCreate,
    AssetType,
    CharacterCardCreate,
    ProjectCreate,
    StoryboardShotCreate,
)
from backend.app.schemas.enums import Stage, Status
from backend.app.services.workflow import WorkflowService


def test_database_initialization_creates_expected_tables(tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'ad_creativity.sqlite'}"
    engine = create_database_engine(database_url)

    init_database(engine)

    table_names = set(inspect(engine).get_table_names())
    assert table_names == {
        "assets",
        "canvas_layouts",
        "character_cards",
        "generation_tasks",
        "image_layers",
        "image_layer_sets",
        "image_prompt_versions",
        "pipeline_assets",
        "pipeline_run_nodes",
        "pipeline_runs",
        "pipeline_task_assets",
        "pipeline_tasks",
        "pipeline_templates",
        "pipeline_worker_lease",
        "pipelines",
        "project_briefs",
        "projects",
        "storyboard_shots",
        "text_artifacts",
        "tool_task_input_assets",
        "tool_tasks",
    }
    assert table_names == set(Base.metadata.tables)
    inspector = inspect(engine)
    assert "deleted_at" in {
        column["name"] for column in inspector.get_columns("projects")
    }
    assert "ix_projects_deleted_at" in {
        index["name"] for index in inspector.get_indexes("projects")
    }
    assert "deleted_at" in {
        column["name"] for column in inspector.get_columns("pipelines")
    }
    assert "ix_pipelines_deleted_at" in {
        index["name"] for index in inspector.get_indexes("pipelines")
    }
    brief_columns = {
        column["name"]: column
        for column in inspector.get_columns("project_briefs")
    }
    target_language = brief_columns["target_language"]
    assert target_language["nullable"] is False
    assert str(target_language["default"]).strip("'\"()") == "zh"
    assert str(
        next(
            column
            for column in inspector.get_columns("pipeline_templates")
            if column["name"] == "definition_json"
        )["type"]
    ).upper() == "JSON"
    assert {
        constraint["name"]
        for constraint in inspector.get_unique_constraints("pipeline_tasks")
    } == {
        "uq_pipeline_tasks_attempt",
        "uq_pipeline_tasks_idempotency",
    }
    pipeline_task_type = next(
        column["type"]
        for column in inspector.get_columns("pipeline_tasks")
        if column["name"] == "type"
    )
    assert pipeline_task_type.length == 32
    assert all(
        foreign_key["constrained_columns"] != ["source_template_id"]
        for foreign_key in inspector.get_foreign_keys("pipelines")
    )


def test_pipeline_task_type_is_varchar_32_for_mysql_and_sqlite() -> None:
    task_type = AigcPipelineTaskORM.__table__.c.type.type

    assert task_type.compile(dialect=mysql.dialect()) == "VARCHAR(32)"
    assert task_type.compile(dialect=sqlite.dialect()) == "VARCHAR(32)"


def test_pipeline_task_type_migration_preserves_constraints_and_is_idempotent(
    tmp_path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'legacy-task-type.sqlite'}"
    engine = create_database_engine(database_url)
    init_database(engine)
    _rebuild_sqlite_table_with_type_override(
        engine,
        table_name="pipeline_tasks",
        column_name="type",
        column_type="VARCHAR(16)",
    )
    assert next(
        column["type"].length
        for column in inspect(engine).get_columns("pipeline_tasks")
        if column["name"] == "type"
    ) == 16

    init_database(engine)
    init_database(engine)

    inspector = inspect(engine)
    assert next(
        column["type"].length
        for column in inspector.get_columns("pipeline_tasks")
        if column["name"] == "type"
    ) == 32
    assert {
        constraint["name"]
        for constraint in inspector.get_unique_constraints("pipeline_tasks")
    } == {
        "uq_pipeline_tasks_attempt",
        "uq_pipeline_tasks_idempotency",
    }
    assert any(
        foreign_key["constrained_columns"] == ["run_id", "node_id"]
        and foreign_key["referred_table"] == "pipeline_run_nodes"
        and foreign_key["referred_columns"] == ["run_id", "node_id"]
        for foreign_key in inspector.get_foreign_keys("pipeline_tasks")
    )


def test_database_initialization_is_idempotent(tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'ad_creativity.sqlite'}"
    engine = create_database_engine(database_url)
    session_factory = make_session_factory(engine)

    init_database(engine)
    with session_factory.begin() as session:
        project = ProjectORM(
            id="project-1",
            name="Launch Campaign",
            status=Status.DRAFT,
            current_stage=Stage.BRIEF,
        )
        project.brief = BriefORM(
            prompt="Create a conversion-focused short video ad.",
            target_platform="douyin",
            aspect_ratio="9:16",
            duration_seconds=30,
            style="documentary",
            audience="small business owners",
            product_name="AdPilot",
            selling_points=["fast iteration"],
        )
        session.add(project)

    init_database(engine)

    with session_factory() as session:
        saved_project = session.scalar(
            select(ProjectORM).where(ProjectORM.id == "project-1")
        )
        assert saved_project is not None
        assert saved_project.brief.prompt == "Create a conversion-focused short video ad."
        assert saved_project.brief.selling_points == ["fast iteration"]


def test_database_initialization_removes_legacy_template_foreign_key(
    tmp_path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'legacy-template-fk.sqlite'}"
    engine = create_database_engine(database_url)
    init_database(engine)
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()
        with connection.begin():
            connection.execute(
                text(
                    """
                    INSERT INTO pipeline_templates (
                        id, name, description, definition_json, schema_version,
                        revision, created_at, updated_at
                    ) VALUES (
                        'template-legacy', 'Legacy', '', '{}', 1, 3,
                        '2026-08-01 00:00:00', '2026-08-01 00:00:00'
                    )
                    """
                )
            )
            connection.execute(text("DROP TABLE pipelines"))
            connection.execute(
                text(
                    """
                    CREATE TABLE pipelines (
                        id VARCHAR(36) NOT NULL PRIMARY KEY,
                        name VARCHAR(120) NOT NULL,
                        description VARCHAR(500) NOT NULL,
                        source_template_id VARCHAR(36) NULL,
                        source_template_revision INTEGER NULL,
                        definition_json JSON NOT NULL,
                        schema_version INTEGER NOT NULL,
                        revision INTEGER NOT NULL,
                        latest_run_status VARCHAR(9) NULL,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        FOREIGN KEY(source_template_id)
                            REFERENCES pipeline_templates(id) ON DELETE SET NULL,
                        CHECK (revision >= 0)
                    )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    INSERT INTO pipelines (
                        id, name, description, source_template_id,
                        source_template_revision, definition_json,
                        schema_version, revision, latest_run_status,
                        created_at, updated_at
                    ) VALUES (
                        'pipeline-legacy', 'Legacy Pipeline', '',
                        'template-legacy', 3, '{}', 1, 0, NULL,
                        '2026-08-01 00:00:00', '2026-08-01 00:00:00'
                    )
                    """
                )
            )
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        connection.commit()

    init_database(engine)
    init_database(engine)

    assert all(
        foreign_key["constrained_columns"] != ["source_template_id"]
        for foreign_key in inspect(engine).get_foreign_keys("pipelines")
    )
    repository = MySQLRepository(make_session_factory(engine))
    repository.delete_aigc_template("template-legacy")
    saved_pipeline = repository.get_aigc_pipeline("pipeline-legacy")
    assert saved_pipeline.source_template_id == "template-legacy"
    assert saved_pipeline.source_template_revision == 3


def test_database_initialization_adds_asset_category_to_existing_table(tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'legacy.sqlite'}"
    engine = create_database_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE assets (id VARCHAR(36) PRIMARY KEY)")
        )

    init_database(engine)
    init_database(engine)

    inspector = inspect(engine)
    assert "category" in {
        column["name"] for column in inspector.get_columns("assets")
    }
    assert "ix_assets_category" in {
        index["name"] for index in inspector.get_indexes("assets")
    }


def test_database_initialization_adds_project_soft_delete_to_legacy_database(
    tmp_path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'legacy-project.sqlite'}"
    engine = create_database_engine(database_url)
    init_database(engine)
    with engine.begin() as connection:
        connection.execute(text("DROP INDEX ix_projects_deleted_at"))
        connection.execute(text("ALTER TABLE projects DROP COLUMN deleted_at"))
        connection.execute(
            text(
                """
                INSERT INTO projects (
                    id,
                    name,
                    status,
                    current_stage,
                    created_at,
                    updated_at
                )
                VALUES (
                    'legacy-project',
                    'Legacy Campaign',
                    'draft',
                    'brief',
                    '2026-08-01 00:00:00',
                    '2026-08-01 00:00:00'
                )
                """
            )
        )

    init_database(engine)
    init_database(engine)

    inspector = inspect(engine)
    assert "deleted_at" in {
        column["name"] for column in inspector.get_columns("projects")
    }
    assert "ix_projects_deleted_at" in {
        index["name"] for index in inspector.get_indexes("projects")
    }
    with engine.connect() as connection:
        saved_project = connection.execute(
            text(
                "SELECT id, deleted_at FROM projects "
                "WHERE id = 'legacy-project'"
            )
        ).one()
    assert saved_project.id == "legacy-project"
    assert saved_project.deleted_at is None


def test_database_initialization_adds_pipeline_soft_delete_to_legacy_database(
    tmp_path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'legacy-pipeline.sqlite'}"
    engine = create_database_engine(database_url)
    init_database(engine)
    with engine.begin() as connection:
        connection.execute(text("DROP INDEX ix_pipelines_deleted_at"))
        connection.execute(text("ALTER TABLE pipelines DROP COLUMN deleted_at"))

    init_database(engine)
    init_database(engine)

    inspector = inspect(engine)
    assert "deleted_at" in {
        column["name"] for column in inspector.get_columns("pipelines")
    }
    assert "ix_pipelines_deleted_at" in {
        index["name"] for index in inspector.get_indexes("pipelines")
    }


def test_database_initialization_adds_target_language_to_legacy_briefs(
    tmp_path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'legacy-brief.sqlite'}"
    engine = create_database_engine(database_url)
    init_database(engine)
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO projects (
                    id,
                    name,
                    status,
                    current_stage,
                    created_at,
                    updated_at
                )
                VALUES (
                    'legacy-project',
                    'Legacy Campaign',
                    'draft',
                    'brief',
                    '2026-08-01 00:00:00',
                    '2026-08-01 00:00:00'
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO project_briefs (
                    project_id,
                    prompt,
                    target_language,
                    target_platform,
                    aspect_ratio,
                    duration_seconds,
                    selling_points
                )
                VALUES (
                    'legacy-project',
                    'Legacy prompt',
                    'en',
                    'douyin',
                    '9:16',
                    30,
                    '[]'
                )
                """
            )
        )
        connection.execute(
            text("ALTER TABLE project_briefs DROP COLUMN target_language")
        )

    init_database(engine)
    init_database(engine)

    target_language_column = next(
        column
        for column in inspect(engine).get_columns("project_briefs")
        if column["name"] == "target_language"
    )
    assert target_language_column["nullable"] is False
    assert str(target_language_column["default"]).strip("'\"()") == "zh"
    with engine.connect() as connection:
        saved_brief = connection.execute(
            text(
                "SELECT project_id, prompt, target_language "
                "FROM project_briefs WHERE project_id = 'legacy-project'"
            )
        ).one()
    assert saved_brief.project_id == "legacy-project"
    assert saved_brief.prompt == "Legacy prompt"
    assert saved_brief.target_language == "zh"


def test_database_initialization_adds_merge_snapshot_to_existing_storyboard_table(
    tmp_path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'legacy-storyboard.sqlite'}"
    engine = create_database_engine(database_url)
    init_database(engine)
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE storyboard_shots DROP COLUMN merge_source_shots")
        )

    init_database(engine)
    init_database(engine)

    assert "merge_source_shots" in {
        column["name"]
        for column in inspect(engine).get_columns("storyboard_shots")
    }


def test_repositories_create_projects_with_active_soft_delete_state(
    mysql_repository: MySQLRepository,
    mysql_session_factory,
) -> None:
    data = ProjectCreate.model_validate(
        {
            "name": "Active Campaign",
            "brief": {"prompt": "Create an active project"},
        }
    )
    memory_repository = InMemoryRepository()

    memory_project = memory_repository.create_project(data)
    mysql_project = mysql_repository.create_project(data)

    assert memory_repository._project_deleted_at[memory_project.id] is None
    with mysql_session_factory() as session:
        orm_project = session.get(ProjectORM, mysql_project.id)
        assert orm_project is not None
        assert orm_project.deleted_at is None


def test_mysql_repository_persists_project_workflow_entities(tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'repository.sqlite'}"
    engine = create_database_engine(database_url)
    init_database(engine)
    session_factory = make_session_factory(engine)

    repository = MySQLRepository(session_factory)
    workflow = WorkflowService(repository)
    project = repository.create_project(
        ProjectCreate.model_validate(
            {
                "name": "Launch Campaign",
                "brief": {
                    "prompt": "Create a conversion-focused short video ad.",
                    "target_platform": "douyin",
                    "aspect_ratio": "9:16",
                    "duration_seconds": 30,
                    "style": "documentary",
                    "audience": "small business owners",
                    "product_name": "AdPilot",
                },
            }
        )
    )

    task = workflow.create_task(project.id, Stage.STORY)
    workflow.start_task(task.id)
    story = workflow.write_text_artifact(
        project.id,
        Stage.STORY,
        content="Story content",
        title="Story",
        task_id=task.id,
    )
    shots = repository.replace_project_storyboard(
        project.id,
        [
            StoryboardShotCreate(
                project_id=project.id,
                index=1,
                title="Opening",
                description="Introduce product",
                visual_prompt="A real office desk",
                narration="Meet AdPilot",
                status=Status.SUCCEEDED,
            ),
            StoryboardShotCreate(
                project_id=project.id,
                index=2,
                title="Outcome",
                description="Show result",
                visual_prompt="A campaign report",
                narration="Ship faster",
                status=Status.SUCCEEDED,
            ),
        ],
    )
    asset = workflow.create_asset(
        project.id,
        AssetType.GENERATED_IMAGE,
        category=AssetCategory.CHARACTER,
        stage=Stage.IMAGE,
        status=Status.SUCCEEDED,
        url="mock://image.png",
        mime_type="image/png",
        metadata={"shot": 1},
    )
    character_card = repository.create_character_card(
        CharacterCardCreate(
            project_id=project.id,
            name="Presenter",
            description="A confident presenter in a bright office.",
            sort_order=1,
            asset_id=asset.id,
            status=Status.SUCCEEDED,
        )
    )

    persisted = MySQLRepository(session_factory)

    saved_project = persisted.get_project(project.id)
    saved_task = persisted.get_task(task.id)
    saved_story = persisted.get_text_artifact(story.id)
    saved_shots = persisted.list_project_storyboard(project.id)
    saved_asset = persisted.get_asset(asset.id)
    saved_cards = persisted.list_project_character_cards(project.id)

    assert saved_project.id == project.id
    assert saved_project.brief.product_name == "AdPilot"
    assert saved_project.current_stage == Stage.IMAGE
    assert saved_project.status == Status.SUCCEEDED
    assert [task.id for task in saved_project.tasks] == [saved_task.id]
    assert [artifact.id for artifact in saved_project.text_artifacts] == [story.id]
    assert [card.id for card in saved_project.character_cards] == [character_card.id]
    assert [shot.id for shot in saved_project.storyboard] == [shot.id for shot in shots]
    assert [asset.id for asset in saved_project.assets] == [saved_asset.id]

    assert saved_task.status == Status.SUCCEEDED
    assert saved_task.output_text_artifact_id == story.id
    assert saved_story.content == "Story content"
    assert [shot.index for shot in saved_shots] == [1, 2]
    assert [card.id for card in saved_cards] == [character_card.id]
    assert saved_cards[0].asset_id == saved_asset.id
    assert saved_cards[0].description == "A confident presenter in a bright office."
    assert saved_asset.url is not None
    assert saved_asset.url.startswith("https://local-assets.tos.local/projects/")
    assert saved_asset.object_key is not None
    assert saved_asset.object_key.endswith(".png")
    assert saved_asset.metadata == {
        "shot": 1,
        "storage_provider": "tos",
        "source_url": "mock://image.png",
    }


def test_mysql_repository_create_assets_is_atomic(
    mysql_repository: MySQLRepository,
) -> None:
    project = mysql_repository.create_project(
        ProjectCreate.model_validate(
            {
                "name": "Character Batch",
                "brief": {"prompt": "Create character references"},
            }
        )
    )
    duplicate_id = "asset-duplicate"
    items = [
        AssetCreate(
            id=duplicate_id,
            project_id=project.id,
            type=AssetType.GENERATED_IMAGE,
            stage=Stage.CHARACTER,
            status=Status.SUCCEEDED,
            object_key=f"characters/{index}.png",
        )
        for index in range(2)
    ]

    with pytest.raises(IntegrityError):
        mysql_repository.create_assets(items)

    assert mysql_repository.list_project_assets(project.id) == []
