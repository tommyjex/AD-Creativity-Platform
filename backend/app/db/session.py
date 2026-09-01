from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager
from functools import lru_cache
from importlib import import_module

from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.app.core.config import Settings, get_settings


class Base(DeclarativeBase):
    pass


def build_database_url(settings: Settings | None = None) -> URL:
    resolved_settings = settings or get_settings()
    resolved_settings.require_database_config()

    assert resolved_settings.db_host is not None
    assert resolved_settings.db_user is not None
    assert resolved_settings.db_password is not None
    assert resolved_settings.db_name is not None

    return URL.create(
        "mysql+pymysql",
        username=resolved_settings.db_user,
        password=resolved_settings.db_password.get_secret_value(),
        host=resolved_settings.db_host,
        port=resolved_settings.db_port,
        database=resolved_settings.db_name,
        query={"charset": "utf8mb4"},
    )


def create_database_engine(
    database_url: str | URL | None = None,
    *,
    echo: bool = False,
) -> Engine:
    url = database_url or build_database_url()
    connect_args: dict[str, object] = {}
    if str(url).startswith("sqlite"):
        connect_args["check_same_thread"] = False

    return create_engine(
        url,
        echo=echo,
        future=True,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


@lru_cache
def get_engine() -> Engine:
    return create_database_engine()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False)


def init_database(bind: Engine | None = None) -> None:
    # Import models here so all ORM metadata is registered before create_all().
    import_module("backend.app.db.models")

    target_engine = bind or get_engine()
    Base.metadata.create_all(bind=target_engine)
    _drop_pipeline_source_template_foreign_key(target_engine)
    _apply_additive_migrations(target_engine)


def _drop_pipeline_source_template_foreign_key(bind: Engine) -> None:
    foreign_keys = inspect(bind).get_foreign_keys("pipelines")
    source_template_fk = next(
        (
            foreign_key
            for foreign_key in foreign_keys
            if foreign_key["constrained_columns"] == ["source_template_id"]
            and foreign_key["referred_table"] == "pipeline_templates"
        ),
        None,
    )
    if source_template_fk is None:
        return
    if bind.dialect.name == "sqlite":
        _rebuild_sqlite_pipelines_without_template_foreign_key(bind)
        return

    constraint_name = source_template_fk.get("name")
    if not constraint_name:
        raise RuntimeError("pipeline source template foreign key has no name")
    quoted_name = bind.dialect.identifier_preparer.quote(constraint_name)
    with bind.begin() as connection:
        connection.execute(
            text(f"ALTER TABLE pipelines DROP FOREIGN KEY {quoted_name}")
        )


def _rebuild_sqlite_pipelines_without_template_foreign_key(bind: Engine) -> None:
    inspector = inspect(bind)
    columns = inspector.get_columns("pipelines")
    primary_key = inspector.get_pk_constraint("pipelines")["constrained_columns"]
    unique_constraints = inspector.get_unique_constraints("pipelines")
    check_constraints = inspector.get_check_constraints("pipelines")
    foreign_keys = [
        foreign_key
        for foreign_key in inspector.get_foreign_keys("pipelines")
        if not (
            foreign_key["constrained_columns"] == ["source_template_id"]
            and foreign_key["referred_table"] == "pipeline_templates"
        )
    ]
    with bind.connect() as connection:
        indexes = connection.execute(
            text(
                "SELECT sql FROM sqlite_master "
                "WHERE type = 'index' AND tbl_name = 'pipelines' "
                "AND sql IS NOT NULL ORDER BY name"
            )
        ).scalars().all()
        connection.commit()
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()
        try:
            with connection.begin():
                definitions: list[str] = []
                column_names: list[str] = []
                for column in columns:
                    name = str(column["name"])
                    quoted_name = _quote_sqlite_identifier(name)
                    column_names.append(quoted_name)
                    definition = f"{quoted_name} {column['type'] or ''}".rstrip()
                    if len(primary_key) == 1 and name in primary_key:
                        definition += " PRIMARY KEY"
                    if not column["nullable"]:
                        definition += " NOT NULL"
                    if column["default"] is not None:
                        definition += f" DEFAULT {column['default']}"
                    definitions.append(definition)
                if len(primary_key) > 1:
                    definitions.append(
                        "PRIMARY KEY ("
                        + ", ".join(
                            _quote_sqlite_identifier(name) for name in primary_key
                        )
                        + ")"
                    )
                for constraint in unique_constraints:
                    definitions.append(
                        "UNIQUE ("
                        + ", ".join(
                            _quote_sqlite_identifier(name)
                            for name in constraint["column_names"]
                        )
                        + ")"
                    )
                for constraint in check_constraints:
                    sqltext = constraint.get("sqltext")
                    if sqltext:
                        definitions.append(f"CHECK ({sqltext})")
                for foreign_key in foreign_keys:
                    local_columns = ", ".join(
                        _quote_sqlite_identifier(name)
                        for name in foreign_key["constrained_columns"]
                    )
                    remote_columns = ", ".join(
                        _quote_sqlite_identifier(name)
                        for name in foreign_key["referred_columns"]
                    )
                    definition = (
                        f"FOREIGN KEY ({local_columns}) REFERENCES "
                        f"{_quote_sqlite_identifier(foreign_key['referred_table'])} "
                        f"({remote_columns})"
                    )
                    options = foreign_key.get("options") or {}
                    if options.get("onupdate"):
                        definition += f" ON UPDATE {options['onupdate']}"
                    if options.get("ondelete"):
                        definition += f" ON DELETE {options['ondelete']}"
                    definitions.append(definition)
                connection.execute(
                    text(
                        "CREATE TABLE pipelines_without_template_fk ("
                        + ", ".join(definitions)
                        + ")"
                    )
                )
                column_list = ", ".join(column_names)
                connection.execute(
                    text(
                        f"INSERT INTO pipelines_without_template_fk ({column_list}) "
                        f"SELECT {column_list} FROM pipelines"
                    )
                )
                connection.execute(text("DROP TABLE pipelines"))
                connection.execute(
                    text(
                        "ALTER TABLE pipelines_without_template_fk "
                        "RENAME TO pipelines"
                    )
                )
                for index_sql in indexes:
                    connection.execute(text(index_sql))
        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.commit()
        violations = connection.execute(text("PRAGMA foreign_key_check")).all()
        if violations:
            raise RuntimeError("pipeline template foreign key migration violated constraints")


def _apply_additive_migrations(bind: Engine) -> None:
    _expand_pipeline_task_type(bind)
    _add_aigc_error_columns(bind)

    inspector = inspect(bind)
    pipeline_columns = {
        column["name"] for column in inspector.get_columns("pipelines")
    }
    if "deleted_at" not in pipeline_columns:
        with bind.begin() as connection:
            connection.execute(
                text("ALTER TABLE pipelines ADD COLUMN deleted_at DATETIME NULL")
            )
    inspector = inspect(bind)
    pipeline_indexes = {
        index["name"] for index in inspector.get_indexes("pipelines")
    }
    if "ix_pipelines_deleted_at" not in pipeline_indexes:
        with bind.begin() as connection:
            connection.execute(
                text(
                    "CREATE INDEX ix_pipelines_deleted_at "
                    "ON pipelines (deleted_at)"
                )
            )

    inspector = inspect(bind)
    project_columns = {
        column["name"] for column in inspector.get_columns("projects")
    }
    if "deleted_at" not in project_columns:
        with bind.begin() as connection:
            connection.execute(
                text("ALTER TABLE projects ADD COLUMN deleted_at DATETIME NULL")
            )
    if "project_type" not in project_columns:
        with bind.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE projects "
                    "ADD COLUMN project_type VARCHAR(11) "
                    "NULL DEFAULT 'video_ad'"
                )
            )
    _enforce_project_type_not_null(bind)
    project_column_definitions = {
        "current_image_prompt_version_id": "VARCHAR(36) NULL",
        "image_prompt_status": "VARCHAR(16) NOT NULL DEFAULT 'draft'",
        "current_image_asset_id": "VARCHAR(36) NULL",
        "image_revision": "INTEGER NOT NULL DEFAULT 0",
        "image_reference_asset_ids": "JSON NOT NULL DEFAULT ('[]')",
    }
    for column_name, column_definition in project_column_definitions.items():
        if column_name not in project_columns:
            with bind.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE projects "
                        f"ADD COLUMN {column_name} {column_definition}"
                    )
                )

    inspector = inspect(bind)
    project_indexes = {
        index["name"] for index in inspector.get_indexes("projects")
    }
    if "ix_projects_deleted_at" not in project_indexes:
        with bind.begin() as connection:
            connection.execute(
                text(
                    "CREATE INDEX ix_projects_deleted_at "
                    "ON projects (deleted_at)"
                )
            )

    inspector = inspect(bind)
    brief_columns = {
        column["name"] for column in inspector.get_columns("project_briefs")
    }
    if "target_language" not in brief_columns:
        with bind.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE project_briefs "
                    "ADD COLUMN target_language VARCHAR(2) "
                    "NOT NULL DEFAULT 'zh'"
                )
            )
    if "image_purpose" not in brief_columns:
        with bind.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE project_briefs "
                    "ADD COLUMN image_purpose VARCHAR(14) NULL"
                )
            )

    inspector = inspect(bind)
    brief_columns_by_name = {
        column["name"]: column
        for column in inspector.get_columns("project_briefs")
    }
    if not brief_columns_by_name["duration_seconds"]["nullable"]:
        _make_brief_duration_nullable(bind)

    inspector = inspect(bind)
    asset_columns = {column["name"] for column in inspector.get_columns("assets")}
    if "category" not in asset_columns:
        with bind.begin() as connection:
            connection.execute(
                text("ALTER TABLE assets ADD COLUMN category VARCHAR(9) NULL")
            )
    if "asset_role" not in asset_columns:
        with bind.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE assets "
                    "ADD COLUMN asset_role VARCHAR(14) "
                    "NOT NULL DEFAULT 'public'"
                )
            )
    with bind.begin() as connection:
        connection.execute(
            text("UPDATE assets SET asset_role = 'public' WHERE asset_role IS NULL")
        )

    inspector = inspect(bind)
    asset_indexes = {index["name"] for index in inspector.get_indexes("assets")}
    if "ix_assets_category" not in asset_indexes:
        with bind.begin() as connection:
            connection.execute(
                text("CREATE INDEX ix_assets_category ON assets (category)")
            )
    if "ix_assets_asset_role" not in asset_indexes:
        with bind.begin() as connection:
            connection.execute(
                text("CREATE INDEX ix_assets_asset_role ON assets (asset_role)")
            )
    asset_column_definitions = {
        "tool_task_id": "VARCHAR(36) NULL",
        "tool_asset_role": "VARCHAR(16) NULL",
    }
    for column_name, column_definition in asset_column_definitions.items():
        if column_name not in asset_columns:
            with bind.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE assets "
                        f"ADD COLUMN {column_name} {column_definition}"
                    )
                )
    inspector = inspect(bind)
    asset_indexes = {index["name"] for index in inspector.get_indexes("assets")}
    if "ix_assets_tool_task_id" not in asset_indexes:
        with bind.begin() as connection:
            connection.execute(
                text("CREATE INDEX ix_assets_tool_task_id ON assets (tool_task_id)")
            )
    if "project_id" in asset_columns:
        _make_asset_project_id_nullable(bind)
    _relax_asset_owner_constraint(bind)

    inspector = inspect(bind)
    storyboard_columns = {
        column["name"] for column in inspector.get_columns("storyboard_shots")
    }
    storyboard_column_definitions = {
        "first_frame_asset_id": "VARCHAR(36) NULL",
        "first_frame_source_video_asset_id": "VARCHAR(36) NULL",
        "video_prompt": "TEXT NULL",
        "reference_image_asset_ids": "JSON NULL",
        "reference_video_asset_ids": "JSON NULL",
        "reference_audio_asset_ids": "JSON NULL",
        "merge_source_shots": "JSON NULL",
    }
    if bind.dialect.name == "sqlite":
        storyboard_column_definitions = {
            "first_frame_asset_id": "VARCHAR(36) NULL",
            "first_frame_source_video_asset_id": "VARCHAR(36) NULL",
            "video_prompt": "TEXT NULL",
            "reference_image_asset_ids": "JSON NOT NULL DEFAULT '[]'",
            "reference_video_asset_ids": "JSON NOT NULL DEFAULT '[]'",
            "reference_audio_asset_ids": "JSON NOT NULL DEFAULT '[]'",
            "merge_source_shots": "JSON NOT NULL DEFAULT '[]'",
        }
    for column_name, column_definition in storyboard_column_definitions.items():
        if column_name not in storyboard_columns:
            with bind.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE storyboard_shots "
                        f"ADD COLUMN {column_name} {column_definition}"
                    )
                )

    inspector = inspect(bind)
    task_columns = {
        column["name"] for column in inspector.get_columns("generation_tasks")
    }
    if "progress_message" not in task_columns:
        with bind.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE generation_tasks ADD COLUMN progress_message TEXT NULL"
                )
            )
    task_column_definitions = {
        "frozen_input": "JSON NULL",
        "retry_of_task_id": "VARCHAR(36) NULL",
    }
    for column_name, column_definition in task_column_definitions.items():
        if column_name not in task_columns:
            with bind.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE generation_tasks "
                        f"ADD COLUMN {column_name} {column_definition}"
                    )
                )
    inspector = inspect(bind)
    task_indexes = {
        index["name"] for index in inspector.get_indexes("generation_tasks")
    }
    if "ix_generation_tasks_retry_of_task_id" not in task_indexes:
        with bind.begin() as connection:
            connection.execute(
                text(
                    "CREATE INDEX ix_generation_tasks_retry_of_task_id "
                    "ON generation_tasks (retry_of_task_id)"
                )
            )


def _expand_pipeline_task_type(bind: Engine) -> None:
    columns = {
        column["name"]: column
        for column in inspect(bind).get_columns("pipeline_tasks")
    }
    task_type = columns.get("type")
    if task_type is None:
        return
    current_length = getattr(task_type["type"], "length", None)
    if current_length is not None and current_length >= 32:
        return
    if bind.dialect.name == "mysql":
        with bind.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE pipeline_tasks "
                    "MODIFY COLUMN type VARCHAR(32) NOT NULL"
                )
            )
        return
    if bind.dialect.name == "sqlite":
        _rebuild_sqlite_table_with_type_override(
            bind,
            table_name="pipeline_tasks",
            column_name="type",
            column_type="VARCHAR(32)",
        )
        return
    raise RuntimeError(
        f"unsupported pipeline task type migration dialect: {bind.dialect.name}"
    )


def _add_aigc_error_columns(bind: Engine) -> None:
    for table_name in ("pipeline_runs", "pipeline_run_nodes"):
        columns = {
            column["name"] for column in inspect(bind).get_columns(table_name)
        }
        if "error_json" not in columns:
            with bind.begin() as connection:
                connection.execute(
                    text(
                        f"ALTER TABLE {table_name} "
                        "ADD COLUMN error_json JSON NULL"
                    )
                )


def _rebuild_sqlite_table_with_type_override(
    bind: Engine,
    *,
    table_name: str,
    column_name: str,
    column_type: str,
) -> None:
    inspector = inspect(bind)
    columns = inspector.get_columns(table_name)
    primary_key = inspector.get_pk_constraint(table_name)
    unique_constraints = inspector.get_unique_constraints(table_name)
    check_constraints = inspector.get_check_constraints(table_name)
    foreign_keys = inspector.get_foreign_keys(table_name)
    temporary_table = f"{table_name}_type_migration"
    with bind.connect() as connection:
        indexes = connection.execute(
            text(
                "SELECT sql FROM sqlite_master "
                "WHERE type = 'index' AND tbl_name = :table_name "
                "AND sql IS NOT NULL ORDER BY name"
            ),
            {"table_name": table_name},
        ).scalars().all()
        connection.commit()
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()
        try:
            with connection.begin():
                connection.execute(
                    text(
                        f"DROP TABLE IF EXISTS "
                        f"{_quote_sqlite_identifier(temporary_table)}"
                    )
                )
                definitions: list[str] = []
                column_names: list[str] = []
                primary_key_columns = primary_key.get("constrained_columns") or []
                for column in columns:
                    name = str(column["name"])
                    quoted_name = _quote_sqlite_identifier(name)
                    column_names.append(quoted_name)
                    resolved_type = (
                        column_type if name == column_name else str(column["type"] or "")
                    )
                    definition = f"{quoted_name} {resolved_type}".rstrip()
                    if len(primary_key_columns) == 1 and name in primary_key_columns:
                        definition += " PRIMARY KEY"
                    if not column["nullable"]:
                        definition += " NOT NULL"
                    if column["default"] is not None:
                        definition += f" DEFAULT {column['default']}"
                    definitions.append(definition)
                if len(primary_key_columns) > 1:
                    definitions.append(
                        "PRIMARY KEY ("
                        + ", ".join(
                            _quote_sqlite_identifier(name)
                            for name in primary_key_columns
                        )
                        + ")"
                    )
                for constraint in unique_constraints:
                    prefix = (
                        f"CONSTRAINT "
                        f"{_quote_sqlite_identifier(str(constraint['name']))} "
                        if constraint.get("name")
                        else ""
                    )
                    definitions.append(
                        prefix
                        + "UNIQUE ("
                        + ", ".join(
                            _quote_sqlite_identifier(name)
                            for name in constraint["column_names"]
                        )
                        + ")"
                    )
                for constraint in check_constraints:
                    sqltext = constraint.get("sqltext")
                    if not sqltext:
                        continue
                    prefix = (
                        f"CONSTRAINT "
                        f"{_quote_sqlite_identifier(str(constraint['name']))} "
                        if constraint.get("name")
                        else ""
                    )
                    definitions.append(f"{prefix}CHECK ({sqltext})")
                for foreign_key in foreign_keys:
                    prefix = (
                        f"CONSTRAINT "
                        f"{_quote_sqlite_identifier(str(foreign_key['name']))} "
                        if foreign_key.get("name")
                        else ""
                    )
                    local_columns = ", ".join(
                        _quote_sqlite_identifier(name)
                        for name in foreign_key["constrained_columns"]
                    )
                    remote_columns = ", ".join(
                        _quote_sqlite_identifier(name)
                        for name in foreign_key["referred_columns"]
                    )
                    definition = (
                        f"{prefix}FOREIGN KEY ({local_columns}) REFERENCES "
                        f"{_quote_sqlite_identifier(foreign_key['referred_table'])} "
                        f"({remote_columns})"
                    )
                    options = foreign_key.get("options") or {}
                    if options.get("onupdate"):
                        definition += f" ON UPDATE {options['onupdate']}"
                    if options.get("ondelete"):
                        definition += f" ON DELETE {options['ondelete']}"
                    definitions.append(definition)
                connection.execute(
                    text(
                        f"CREATE TABLE {_quote_sqlite_identifier(temporary_table)} ("
                        + ", ".join(definitions)
                        + ")"
                    )
                )
                quoted_table = _quote_sqlite_identifier(table_name)
                column_list = ", ".join(column_names)
                connection.execute(
                    text(
                        f"INSERT INTO {_quote_sqlite_identifier(temporary_table)} "
                        f"({column_list}) SELECT {column_list} FROM {quoted_table}"
                    )
                )
                connection.execute(text(f"DROP TABLE {quoted_table}"))
                connection.execute(
                    text(
                        f"ALTER TABLE {_quote_sqlite_identifier(temporary_table)} "
                        f"RENAME TO {quoted_table}"
                    )
                )
                for index_sql in indexes:
                    connection.execute(text(index_sql))
        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.commit()
        violations = connection.execute(text("PRAGMA foreign_key_check")).all()
        if violations:
            raise RuntimeError("pipeline task type migration violated foreign keys")


def _make_asset_project_id_nullable(bind: Engine) -> None:
    project_id = next(
        column
        for column in inspect(bind).get_columns("assets")
        if column["name"] == "project_id"
    )
    if project_id["nullable"] or bind.dialect.name == "sqlite":
        return
    with bind.begin() as connection:
        connection.execute(
            text("ALTER TABLE assets MODIFY COLUMN project_id VARCHAR(36) NULL")
        )


def _relax_asset_owner_constraint(bind: Engine) -> None:
    """Allow standalone tool-library assets while retaining project exclusivity."""
    if bind.dialect.name != "mysql":
        return
    inspector = inspect(bind)
    owner_check = next(
        (
            item
            for item in inspector.get_check_constraints("assets")
            if item.get("name") == "ck_assets_one_owner"
        ),
        None,
    )
    if owner_check is None or "tool_task_id IS NOT NULL" not in str(
        owner_check.get("sqltext", "")
    ):
        return
    with bind.begin() as connection:
        connection.execute(text("ALTER TABLE assets DROP CHECK ck_assets_one_owner"))
        connection.execute(
            text(
                "ALTER TABLE assets ADD CONSTRAINT ck_assets_one_owner CHECK "
                "((project_id IS NOT NULL AND tool_task_id IS NULL "
                "AND tool_asset_role IS NULL) OR "
                "(project_id IS NULL AND tool_asset_role IS NOT NULL))"
            )
        )


def _make_brief_duration_nullable(bind: Engine) -> None:
    if bind.dialect.name != "sqlite":
        with bind.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE project_briefs "
                    "MODIFY COLUMN duration_seconds INTEGER NULL DEFAULT NULL"
                )
            )
        return

    with bind.begin() as connection:
        connection.execute(text("DROP INDEX IF EXISTS ix_project_briefs_project_id"))
        connection.execute(
            text(
                "ALTER TABLE project_briefs "
                "RENAME TO project_briefs_legacy_duration"
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE project_briefs (
                    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    project_id VARCHAR(36) NOT NULL UNIQUE,
                    prompt TEXT NOT NULL,
                    target_language VARCHAR(2) NOT NULL DEFAULT 'zh',
                    target_platform VARCHAR(64) NOT NULL,
                    aspect_ratio VARCHAR(16) NOT NULL,
                    duration_seconds INTEGER NULL,
                    image_purpose VARCHAR(14) NULL,
                    style VARCHAR(120) NULL,
                    audience VARCHAR(255) NULL,
                    product_name VARCHAR(120) NULL,
                    summary TEXT NULL,
                    selling_points JSON NOT NULL,
                    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO project_briefs (
                    id,
                    project_id,
                    prompt,
                    target_language,
                    target_platform,
                    aspect_ratio,
                    duration_seconds,
                    image_purpose,
                    style,
                    audience,
                    product_name,
                    summary,
                    selling_points
                )
                SELECT
                    id,
                    project_id,
                    prompt,
                    target_language,
                    target_platform,
                    aspect_ratio,
                    duration_seconds,
                    image_purpose,
                    style,
                    audience,
                    product_name,
                    summary,
                    selling_points
                FROM project_briefs_legacy_duration
                """
            )
        )
        connection.execute(text("DROP TABLE project_briefs_legacy_duration"))
        connection.execute(
            text(
                "CREATE INDEX ix_project_briefs_project_id "
                "ON project_briefs (project_id)"
            )
        )


def _enforce_project_type_not_null(bind: Engine) -> None:
    project_type = next(
        column
        for column in inspect(bind).get_columns("projects")
        if column["name"] == "project_type"
    )
    with bind.begin() as connection:
        connection.execute(
            text(
                "UPDATE projects "
                "SET project_type = 'video_ad' "
                "WHERE project_type IS NULL"
            )
        )
    if not project_type["nullable"]:
        return
    if bind.dialect.name != "sqlite":
        with bind.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE projects "
                    "MODIFY COLUMN project_type VARCHAR(11) "
                    "NOT NULL DEFAULT 'video_ad'"
                )
            )
        return
    _rebuild_sqlite_projects_with_required_type(bind)


def _rebuild_sqlite_projects_with_required_type(bind: Engine) -> None:
    with bind.connect() as connection:
        columns = connection.execute(text("PRAGMA table_info(projects)")).mappings().all()
        index_rows = connection.execute(
            text("PRAGMA index_list(projects)")
        ).mappings().all()
        unique_columns: list[list[str]] = []
        for index in index_rows:
            if index["unique"] and index["origin"] == "u":
                index_name = _quote_sqlite_identifier(str(index["name"]))
                unique_columns.append(
                    [
                        str(row["name"])
                        for row in connection.execute(
                            text(f"PRAGMA index_info({index_name})")
                        ).mappings()
                    ]
                )
        foreign_key_rows = connection.execute(
            text("PRAGMA foreign_key_list(projects)")
        ).mappings().all()
        indexes = connection.execute(
            text(
                "SELECT sql FROM sqlite_master "
                "WHERE type = 'index' AND tbl_name = 'projects' "
                "AND sql IS NOT NULL ORDER BY name"
            )
        ).scalars().all()
        connection.commit()
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()
        try:
            with connection.begin():
                definitions: list[str] = []
                names: list[str] = []
                primary_key = [
                    str(column["name"])
                    for column in sorted(columns, key=lambda item: item["pk"])
                    if column["pk"]
                ]
                for column in columns:
                    name = str(column["name"])
                    quoted_name = _quote_sqlite_identifier(name)
                    names.append(quoted_name)
                    definition = f"{quoted_name} {column['type'] or ''}".rstrip()
                    if len(primary_key) == 1 and column["pk"]:
                        definition += " PRIMARY KEY"
                    if name == "project_type" or column["notnull"]:
                        definition += " NOT NULL"
                    default = (
                        "'video_ad'"
                        if name == "project_type"
                        else column["dflt_value"]
                    )
                    if default is not None:
                        definition += f" DEFAULT {default}"
                    definitions.append(definition)
                if len(primary_key) > 1:
                    definitions.append(
                        "PRIMARY KEY ("
                        + ", ".join(
                            _quote_sqlite_identifier(name) for name in primary_key
                        )
                        + ")"
                    )
                for columns_in_constraint in unique_columns:
                    definitions.append(
                        "UNIQUE ("
                        + ", ".join(
                            _quote_sqlite_identifier(name)
                            for name in columns_in_constraint
                        )
                        + ")"
                    )
                foreign_keys: dict[int, list[object]] = {}
                for row in foreign_key_rows:
                    foreign_keys.setdefault(int(row["id"]), []).append(row)
                for rows in foreign_keys.values():
                    ordered = sorted(rows, key=lambda item: item["seq"])  # type: ignore[index]
                    first = ordered[0]
                    local_columns = ", ".join(
                        _quote_sqlite_identifier(str(row["from"]))
                        for row in ordered
                    )
                    remote_columns = ", ".join(
                        _quote_sqlite_identifier(str(row["to"]))
                        for row in ordered
                    )
                    constraint = (
                        f"FOREIGN KEY ({local_columns}) REFERENCES "
                        f"{_quote_sqlite_identifier(str(first['table']))} "
                        f"({remote_columns})"
                    )
                    if first["on_update"] != "NO ACTION":
                        constraint += f" ON UPDATE {first['on_update']}"
                    if first["on_delete"] != "NO ACTION":
                        constraint += f" ON DELETE {first['on_delete']}"
                    definitions.append(constraint)
                connection.execute(
                    text(
                        "CREATE TABLE projects_task11 ("
                        + ", ".join(definitions)
                        + ")"
                    )
                )
                column_list = ", ".join(names)
                connection.execute(
                    text(
                        f"INSERT INTO projects_task11 ({column_list}) "
                        f"SELECT {column_list} FROM projects"
                    )
                )
                connection.execute(text("DROP TABLE projects"))
                connection.execute(
                    text("ALTER TABLE projects_task11 RENAME TO projects")
                )
                for index_sql in indexes:
                    connection.execute(text(index_sql))
        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.commit()
        violations = connection.execute(text("PRAGMA foreign_key_check")).all()
        if violations:
            raise RuntimeError("project_type migration violated foreign keys")


def _quote_sqlite_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def make_session_factory(bind: Engine) -> sessionmaker[Session]:
    return sessionmaker(
        bind=bind,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )


def get_session(bind: Engine | None = None) -> Generator[Session, None, None]:
    target_engine = bind or get_engine()
    session_factory = make_session_factory(target_engine)
    session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def session_scope(bind: Engine | None = None) -> Generator[Session, None, None]:
    yield from get_session(bind)
