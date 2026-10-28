import asyncio
import threading

import pytest

from backend.app.api.dependencies import get_subtitle_translation_service
from backend.app.schemas.subtitle_translation import SubtitleWorkspaceUpdate
from backend.app.services import subtitle_translation_layout as layout
from backend.tests.test_subtitle_translation_layout import font_http
from backend.tests.test_subtitle_translation_workspace import (
    extracted,
    subtitle_repo,
    subtitle_service,
)

__all__ = ["font_http", "subtitle_repo", "subtitle_service"]


def test_actual_font_preview_is_worker_thread_and_never_changes_history(
    subtitle_service,
):
    service = subtitle_service
    workspace, _ = extracted(service)
    before = service.repository.list_subtitle_workspace_history(workspace.id)
    caller = threading.get_ident()
    workers = []

    def compiler(segments, video):
        workers.append(threading.get_ident())
        return layout.compile_subtitle_project(segments, video)

    service.compiler = compiler
    service.mediakit_factory = lambda: pytest.fail("preview cannot use paid rendering")
    preview = asyncio.run(service.preview(workspace))
    item = preview.segments[0]
    assert item.estimated_font_size_px > 0
    assert 0 < item.effective_font_size_px <= item.estimated_font_size_px
    assert item.render_bbox_pixels is not None
    assert item.recommended_text_color in {"#000000", "#FFFFFF"}
    assert item.font_type == layout.CENTURY_GOTHIC_BOLD_URL
    assert len(item.font_sha256) == 64
    assert workers and caller not in workers
    assert service.repository.list_subtitle_workspace_history(workspace.id) == before
    assert (
        service.repository.get_subtitle_workspace(workspace.id)
        .segments[0]
        .effective_font_size_px
        is None
    )
    assert layout.CAPACITY_NOTICE in preview.warnings
    assert "provider_vertical_anchor_unverified" in preview.warnings


def test_missing_translation_does_not_block_measuring_other_segments(subtitle_service):
    from backend.tests.test_subtitle_translation_workspace import segment

    service = subtitle_service
    workspace, _ = extracted(service)
    workspace.segments.append(
        segment("missing").model_copy(update={"translated_text": None})
    )
    preview = asyncio.run(service.preview(workspace))
    assert preview.segments[0].effective_font_size_px > 0
    assert preview.segments[1].effective_font_size_px is None
    assert "layout_preview:missing_translation" in preview.segments[1].warnings


def test_recalculation_discards_stale_adaptive_warnings_but_preserves_business_notes(
    subtitle_service,
):
    workspace, _ = extracted(subtitle_service)
    workspace.segments[0].translated_text = "Hi"
    workspace.segments[0].warnings = [
        "font_size_reduced",
        "bbox_expanded",
        "business_note",
    ]
    workspace.warnings = ["s1:font_size_reduced", "s1:bbox_expanded", "business_note"]
    preview = asyncio.run(subtitle_service.preview(workspace))
    assert "font_size_reduced" not in preview.segments[0].warnings
    assert "bbox_expanded" not in preview.segments[0].warnings
    assert "s1:font_size_reduced" not in preview.warnings
    assert "s1:bbox_expanded" not in preview.warnings
    assert "business_note" in preview.segments[0].warnings
    assert "business_note" in preview.warnings


@pytest.mark.parametrize(
    "failure",
    [
        layout.SubtitleLayoutError("font_resource_unavailable", "s1"),
        RuntimeError("https://private.example/?signature=secret"),
    ],
)
def test_font_and_unexpected_failure_are_editable_and_redacted(
    subtitle_service, failure
):
    service = subtitle_service
    workspace, _ = extracted(service)
    workspace.segments[0].effective_font_size_px = 99

    def compiler(*args):
        raise failure

    service.compiler = compiler
    preview = asyncio.run(service.preview(workspace))
    assert preview.segments[0].effective_font_size_px is None
    assert preview.segments[0].translated_text == "Ursprung"
    assert any(w.startswith("layout_preview:") for w in preview.warnings)
    assert "secret" not in preview.model_dump_json()
    assert preview.revision == workspace.revision


def test_one_layout_failure_leaves_other_measurements_available(subtitle_service):
    from backend.tests.test_subtitle_translation_workspace import segment

    service = subtitle_service
    workspace, _ = extracted(service)
    workspace.segments.append(segment("good"))
    calls = []

    def compiler(segments, video):
        calls.append([s["segment_id"] for s in segments])
        if "s1" in calls[-1]:
            raise layout.SubtitleLayoutError("text_cannot_fit_at_minimum_font", "s1")
        return layout.compile_subtitle_project(segments, video)

    service.compiler = compiler
    preview = asyncio.run(service.preview(workspace))
    assert calls == [["s1", "good"], ["good"]]
    assert preview.segments[0].effective_font_size_px is None
    assert preview.segments[1].effective_font_size_px > 0


def test_http_detail_patch_and_unsaved_preview_measure_actual_font(
    client, subtitle_service
):
    service = subtitle_service
    workspace, _ = extracted(service)
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    root = "/api/tools/subtitle-translation/workspaces/" + workspace.id
    details = client.get(root)
    assert details.status_code == 200
    assert details.json()["segments"][0]["effective_font_size_px"] > 0
    original_revision = workspace.revision
    draft = workspace.segments[0].model_dump(mode="json")
    draft["translated_text"] = ("A much longer German translation " * 8).strip()
    response = client.post(
        root + "/preview",
        json={
            "expected_revision": original_revision,
            "segments": [draft],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["revision"] == original_revision
    assert data["segments"][0]["translated_text"] == draft["translated_text"]
    assert (
        data["segments"][0]["effective_font_size_px"]
        < data["segments"][0]["estimated_font_size_px"]
    )
    persisted = service.repository.get_subtitle_workspace(workspace.id)
    assert persisted.segments[0].translated_text == "Ursprung"
    saved = client.patch(
        root,
        json={
            "expected_revision": original_revision,
            "segments": [draft],
        },
    )
    assert saved.status_code == 200
    assert saved.json()["revision"] == original_revision + 1
    assert saved.json()["segments"][0]["effective_font_size_px"] > 0
    assert (
        client.post(
            root + "/preview", json={"expected_revision": original_revision}
        ).status_code
        == 409
    )


def test_http_preview_failure_and_capacity_notice_do_not_block_save(
    client, subtitle_service
):
    service = subtitle_service
    workspace, _ = extracted(service)

    def unavailable(*args):
        raise layout.SubtitleLayoutError("font_resource_unavailable")

    service.compiler = unavailable
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    root = "/api/tools/subtitle-translation/workspaces/" + workspace.id
    response = client.patch(
        root, json={"expected_revision": workspace.revision, "name": "Editable"}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Editable"
    assert response.json()["segments"][0]["effective_font_size_px"] is None
    assert layout.CAPACITY_NOTICE in response.json()["warnings"]


def test_unsaved_preview_rejects_changed_original_or_missing_ids(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    draft = workspace.segments[0].model_copy(update={"text": "Overwrite"})
    with pytest.raises(ValueError, match="original text"):
        asyncio.run(
            service.preview(
                workspace,
                SubtitleWorkspaceUpdate(
                    expected_revision=workspace.revision, segments=[draft]
                ),
            )
        )
    with pytest.raises(ValueError, match="segment IDs"):
        asyncio.run(
            service.preview(
                workspace,
                SubtitleWorkspaceUpdate(
                    expected_revision=workspace.revision, segments=[]
                ),
            )
        )
