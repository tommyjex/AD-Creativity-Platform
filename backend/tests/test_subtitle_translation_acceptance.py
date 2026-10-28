"""Independent system-acceptance checks; all providers remain offline."""

import pytest
from pydantic import ValidationError

from backend.app.repositories.base import NotFoundError
from backend.app.api.dependencies import get_subtitle_translation_service
from backend.app.schemas.auth import UserRole
from backend.app.schemas.enums import ToolTaskType
from backend.app.schemas.subtitle_translation import (
    SubtitleStyleOverride,
    SubtitleTranslationSegment,
    SubtitleWorkspace,
    SubtitleWorkspaceUpdate,
)
from backend.app.schemas.tool_task import ToolTaskCreate
from backend.app.services.subtitle_translation import SubtitleTranslationService
from backend.tests.auth_helpers import authenticate_test_client


@pytest.fixture(params=["repository", "mysql_repository"])
def workspace_repository(request):
    return request.getfixturevalue(request.param)


def segment(**updates):
    return SubtitleTranslationSegment(
        text="Reference text",
        start_ms=100,
        end_ms=1000,
        bbox_normalized=(100, 100, 900, 200),
        bbox_pixels=(128, 72, 1152, 144),
        segment_id="stable-id",
        **updates,
    )


def test_workspace_reads_and_history_are_detached(workspace_repository):
    repo = workspace_repository
    workspace = SubtitleWorkspace(segments=[segment(translated_text="Translation")])
    created = repo.create_subtitle_workspace(workspace)
    workspace.segments[0].translated_text = "Caller mutation"
    created.segments[0].text = "Return mutation"
    saved = repo.get_subtitle_workspace(created.id)
    assert saved.segments[0].text == "Reference text"
    assert saved.segments[0].translated_text == "Translation"
    saved.segments.clear()
    history = repo.list_subtitle_workspace_history(created.id)
    history[0]["segments"].clear()
    assert len(repo.get_subtitle_workspace(created.id).segments) == 1
    assert len(repo.list_subtitle_workspace_history(created.id)[0]["segments"]) == 1


def test_sql_workspace_list_excludes_large_history_and_keeps_update_order(
    mysql_repository,
):
    from datetime import timedelta

    from sqlalchemy import event

    from backend.app.db.models import SubtitleWorkspaceORM

    repo = mysql_repository
    first = repo.create_subtitle_workspace(SubtitleWorkspace(segments=[segment()]))
    second = repo.create_subtitle_workspace(SubtitleWorkspace())
    with repo._session_factory.begin() as session:
        row = session.get(SubtitleWorkspaceORM, first.id)
        row.history = [first.model_dump(mode="json")] * 1000
        row.updated_at = second.updated_at + timedelta(seconds=1)

    statements = []
    engine = repo._session_factory.kw["bind"]

    def capture(_connection, _cursor, statement, _parameters, _context, _many):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", capture)
    try:
        listed = repo.list_subtitle_workspaces()
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    assert [workspace.id for workspace in listed] == [first.id, second.id]
    assert listed[0].segments[0].text == "Reference text"
    assert all("subtitle_translation_workspaces.history" not in sql for sql in statements)


def test_mutation_failure_preserves_both_aggregates(workspace_repository):
    repo = workspace_repository
    workspace = repo.create_subtitle_workspace(SubtitleWorkspace())
    before = workspace.model_dump(mode="json")
    history = repo.list_subtitle_workspace_history(workspace.id)

    def invalid_input(current, tasks):
        current.revision += 1
        current.active_task_id = "invalid-task"
        return current, ToolTaskCreate(
            id="invalid-task",
            type=ToolTaskType.VIDEO_SUBTITLE_TRANSLATION,
            input_snapshot={
                "workspace_id": current.id,
                "operation": "extract",
                "reference_video_asset_id": "nonexistent-asset",
            },
        )

    with pytest.raises(NotFoundError):
        repo.mutate_subtitle_workspace(workspace.id, invalid_input)
    assert repo.get_subtitle_workspace(workspace.id).model_dump(mode="json") == before
    assert repo.list_subtitle_workspace_history(workspace.id) == history
    with pytest.raises(NotFoundError):
        repo.get_tool_task("invalid-task")


def test_task_and_workspace_commit_together(workspace_repository):
    repo = workspace_repository
    workspace = repo.create_subtitle_workspace(SubtitleWorkspace())

    def begin(current, tasks):
        assert tasks == []
        current.revision += 1
        current.active_task_id = "atomic-task"
        return current, ToolTaskCreate(
            id="atomic-task",
            type=ToolTaskType.VIDEO_SUBTITLE_TRANSLATION,
            input_snapshot={"workspace_id": current.id, "operation": "translate"},
        )

    saved = repo.mutate_subtitle_workspace(workspace.id, begin)
    assert saved.revision == 2
    assert saved.active_task_id == repo.get_tool_task("atomic-task").id
    assert len(repo.list_subtitle_workspace_history(workspace.id)) == 2


def test_background_estimate_and_user_style_are_independent():
    item = segment(
        background_color="#eeeeee",
        translated_text="Translation",
        style=SubtitleStyleOverride(
            text_color="#112233",
            background_color="#00000080",
            font_size_px=22,
        ),
    )
    assert item.text == "Reference text"
    assert item.background_color == "#eeeeee"
    assert item.style.background_color == "#00000080"
    assert item.style.text_color == "#112233"
    assert segment().background_color is None


@pytest.mark.parametrize("value", ["line\nbreak", "line\rbreak", "text\tdata", "\x00"])
def test_translated_text_cannot_introduce_control_characters(value):
    with pytest.raises(ValidationError):
        segment(translated_text=value)


def test_patch_rejects_duplicate_segment_ids():
    with pytest.raises(ValidationError):
        SubtitleWorkspaceUpdate(expected_revision=1, segments=[segment(), segment()])


@pytest.mark.parametrize("language", ["en", "de", "fr", "es", "it", "pt", "zh", "ja"])
def test_all_required_target_languages_are_supported(language):
    workspace = SubtitleWorkspace(target_language=language)
    assert workspace.target_language == language


@pytest.mark.parametrize("background", [None, "#eeeeee", "#000000"])
def test_translation_segment_inherits_grounding_fallback_validator(background):
    item = segment(background_color=background)
    if background is None:
        assert item.warnings == ["background_color_unavailable"]
    else:
        assert item.background_color == background
        assert item.warnings == []
    restored = SubtitleTranslationSegment.model_validate(item.model_dump(mode="json"))
    assert restored.warnings == item.warnings


@pytest.mark.parametrize("background", ["invalid", "#FFF", "#00000080", 123, False])
def test_translation_segment_inherits_background_format_validator(background):
    with pytest.raises(ValidationError):
        segment(background_color=background)


def test_patch_preserves_original_text_and_history(workspace_repository):
    repo = workspace_repository
    workspace = repo.create_subtitle_workspace(SubtitleWorkspace(segments=[segment()]))
    service = SubtitleTranslationService(repo, None)
    edited = segment().model_copy(update={"text": "User replacement"})
    before = repo.list_subtitle_workspace_history(workspace.id)
    with pytest.raises(ValueError, match="original subtitle text"):
        service.patch(
            workspace.id,
            SubtitleWorkspaceUpdate(expected_revision=1, segments=[edited]),
        )
    assert repo.get_subtitle_workspace(workspace.id).segments[0].text == "Reference text"
    assert repo.get_subtitle_workspace(workspace.id).revision == 1
    assert repo.list_subtitle_workspace_history(workspace.id) == before
    saved = service.patch(
        workspace.id,
        SubtitleWorkspaceUpdate(
            expected_revision=1, segments=[segment(translated_text="Reviewed translation")]
        ),
    )
    assert saved.segments[0].text == "Reference text"
    assert saved.segments[0].translated_text == "Reviewed translation"
    assert repo.list_subtitle_workspace_history(workspace.id)[0]["segments"][0]["text"] == "Reference text"


def test_patch_500_segments_boundary_is_supported(workspace_repository):
    repo = workspace_repository
    items = [segment().model_copy(update={"segment_id": f"segment-{i}"}) for i in range(500)]
    workspace = repo.create_subtitle_workspace(SubtitleWorkspace(segments=items))
    service = SubtitleTranslationService(repo, None)
    request = SubtitleWorkspaceUpdate(
        expected_revision=1,
        segments=[item.model_copy(update={"translated_text": "Reviewed"}) for item in items],
    )
    saved = service.patch(workspace.id, request)
    assert len(saved.segments) == 500
    assert saved.segments[-1].segment_id == "segment-499"
    assert all(item.text == "Reference text" for item in saved.segments)
    with pytest.raises(ValidationError):
        SubtitleWorkspaceUpdate(
            expected_revision=saved.revision,
            segments=items + [segment().model_copy(update={"segment_id": "segment-500"})],
        )


@pytest.mark.parametrize("authenticated", [False, True])
@pytest.mark.parametrize(
    "method,path,payload",
    [
        ("POST", "/workspaces", {}),
        ("PATCH", "/workspaces/missing", {"expected_revision": 1}),
        ("POST", "/workspaces/missing/extract", {"expected_revision": 1}),
        ("POST", "/workspaces/missing/translate", {"expected_revision": 1}),
        ("POST", "/workspaces/missing/render", {"expected_revision": 1}),
        ("POST", "/import-video", {"video_url": "https://fixture.example/video.mp4"}),
        ("POST", "/upload-video", None),
    ],
)
def test_new_mutations_deny_before_execution_dependencies(
    anonymous_client, repository, authenticated, method, path, payload
):
    if authenticated:
        authenticate_test_client(anonymous_client, repository, role=UserRole.VIEWER)
    calls = []

    def forbidden_dependency():
        calls.append("subtitle service")
        raise AssertionError("unauthorized request reached execution dependency")

    anonymous_client.app.dependency_overrides[get_subtitle_translation_service] = forbidden_dependency
    response = anonymous_client.request(
        method, "/api/tools/subtitle-translation" + path, json=payload
    )
    assert response.status_code == (403 if authenticated else 401)
    assert calls == []
    assert repository.list_subtitle_workspaces() == []
    assert repository.list_tool_tasks() == []


def test_http_patch_cannot_overwrite_original_text(client, repository):
    workspace = repository.create_subtitle_workspace(SubtitleWorkspace(segments=[segment()]))
    changed = segment().model_dump(mode="json")
    changed["text"] = "Replacement from API caller"
    response = client.patch(
        f"/api/tools/subtitle-translation/workspaces/{workspace.id}",
        json={"expected_revision": 1, "segments": [changed]},
    )
    assert response.status_code == 422
    saved = repository.get_subtitle_workspace(workspace.id)
    assert saved.revision == 1
    assert saved.segments[0].text == "Reference text"
    assert len(repository.list_subtitle_workspace_history(workspace.id)) == 1


def test_subtitle_initialization_failure_closes_started_runtime_and_tls(
    monkeypatch, repository, test_asset_storage, background_task_runner
):
    from fastapi.testclient import TestClient

    import backend.app.main as main
    from backend.app.api.dependencies import (
        get_aigc_pipeline_runtime,
        get_asset_storage_service,
        get_background_task_runner,
        get_repository,
    )

    class Runtime:
        stops = 0

        async def start(self):
            return True

        async def stop(self):
            self.stops += 1

    class Sink:
        closes = 0

        def start(self):
            pass

        async def aclose(self):
            self.closes += 1

    runtime, sink = Runtime(), Sink()
    detached = []
    monkeypatch.setattr(main, "configure_structured_logging", lambda _: sink)
    monkeypatch.setattr(main, "detach_tls_sink", detached.append)

    def fail_initialization(*_):
        raise RuntimeError("subtitle initialization unavailable")

    monkeypatch.setattr(main, "initialize_subtitle_translation_service", fail_initialization)
    app = main.create_app()
    app.dependency_overrides[get_aigc_pipeline_runtime] = lambda: runtime
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_asset_storage_service] = lambda: test_asset_storage
    app.dependency_overrides[get_background_task_runner] = lambda: background_task_runner
    with pytest.raises(RuntimeError, match="subtitle initialization unavailable"), TestClient(app):
        pass
    assert runtime.stops == 1
    assert sink.closes == 1
    assert detached == [sink]
