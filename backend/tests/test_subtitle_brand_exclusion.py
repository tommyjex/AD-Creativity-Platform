import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from backend.app.schemas.subtitle_translation import SubtitleStageRequest, SubtitleWorkspaceUpdate
from backend.tests.test_subtitle_translation_workspace import (
    extracted, segment, subtitle_repo, subtitle_service,
)
from video_subtitle_grounding.brand_rules import BRAND_RULE_VERSION
from backend.tests.test_subtitle_translation_layout import font_http

__all__ = ["subtitle_repo", "subtitle_service", "font_http"]


def seed(service, category="unboxing", brand_only=False):
    workspace, task = extracted(service, video_category=category)
    records = [segment("logo").model_copy(update={"text": "Tineco"}),
               segment("slogan").model_copy(update={"text": "Live Easy. Enjoy Life.",
                                                   "translated_text": None})]
    if not brand_only:
        records.append(segment("normal").model_copy(update={"text": "Tineco FLOOR ONE S7",
                                                           "translated_text": None}))

    def mutate(current, tasks):
        current.segments = records
        current.output_asset_id = "historical-output"
        return current, None

    service.repository.mutate_subtitle_workspace(workspace.id, mutate)
    return service.repository.get_subtitle_workspace(workspace.id), task


@pytest.mark.parametrize("category", ["product", "unboxing"])
def test_translation_filters_selection_context_and_preserves_historical_brand(subtitle_service, category):
    service = subtitle_service
    workspace, _ = seed(service, category)
    source = workspace.segments[0].model_dump()
    service.translator.translate = AsyncMock(return_value={
        "translations": {"normal": "Produkt"}, "failed_ids": []})
    task = service.submit(workspace.id, "translate", SubtitleStageRequest(expected_revision=workspace.revision))
    assert task.input_snapshot["brand_rule_version"] == BRAND_RULE_VERSION
    assert task.input_snapshot["segment_ids"] == ["normal"]
    asyncio.run(service.run(task.id))
    call = service.translator.translate.call_args
    assert [r["segment_id"] for r in call.args[0]] == ["normal"]
    current = service.repository.get_subtitle_workspace(workspace.id)
    assert current.segments[0].translated_text == source["translated_text"]
    assert current.segments[0].style.model_dump() == source["style"]
    assert "brand_content_skipped" in current.warnings
    assert current.segments[1].translation_status != "failed"
    assert current.segments[2].translated_text == "Produkt"


def test_brand_only_avoids_stages_and_recognition_and_preserves_reads(subtitle_service):
    service = subtitle_service
    workspace, _ = seed(service, brand_only=True)
    before = service.repository.list_subtitle_workspace_history(workspace.id)
    for operation, message in [("translate", "no pending translations"),
                               ("render", "no renderable subtitle segments")]:
        with pytest.raises(ValueError, match=message):
            service.submit(workspace.id, operation, SubtitleStageRequest(expected_revision=workspace.revision))
    service.compiler = lambda *args: pytest.fail("brand-only preview must not compile")
    preview = asyncio.run(service.preview(workspace))
    assert all("brand_content_skipped" in s.warnings for s in preview.segments)
    assert all(s.render_layer_url is None for s in preview.segments)
    assert not any("missing_translation" in w for s in preview.segments for w in s.warnings)
    request = SubtitleWorkspaceUpdate(expected_revision=workspace.revision, segments=workspace.segments)
    asyncio.run(service.prepare_product_update(workspace.id, request))
    asyncio.run(service.recognize_products(workspace.id, request))
    service.translator.recognize_products.assert_not_awaited()
    assert service.repository.list_subtitle_workspace_history(workspace.id) == before
    assert service.repository.get_subtitle_workspace(workspace.id).output_asset_id == "historical-output"


@pytest.mark.parametrize("category", ["product", "unboxing"])
def test_preview_and_render_compilers_receive_only_effective_records(subtitle_service, category):
    service = subtitle_service
    workspace, _ = seed(service, category)
    workspace.segments[-1].translated_text = "Produkt"
    workspace = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, segments=workspace.segments))
    seen = []

    def compiler(records, video):
        seen.append([r["segment_id"] for r in records])
        return {"project": {"fixture": True}, "layouts": {}, "warnings": []}

    service.compiler = compiler
    asyncio.run(service.preview(workspace))
    task = service.submit(workspace.id, "render", SubtitleStageRequest(expected_revision=workspace.revision))
    client = SimpleNamespace(submit=AsyncMock(return_value=SimpleNamespace(task_id="p")),
                             poll=AsyncMock(return_value=SimpleNamespace(output_video_url="https://fixture.test/video")))
    service.mediakit_factory = lambda: client
    service.media = SimpleNamespace(store_output=AsyncMock(return_value=SimpleNamespace(id="output")))
    asyncio.run(service.run(task.id))
    assert seen == [["normal"], ["normal"]]


def test_old_translation_task_keeps_frozen_records_and_policy(subtitle_service):
    service = subtitle_service
    workspace, _ = seed(service)
    task = service.submit(workspace.id, "translate", SubtitleStageRequest(expected_revision=workspace.revision))
    frozen = {**task.input_snapshot, "segment_ids": ["slogan"]}
    frozen.pop("brand_rule_version")
    service.repository.update_tool_task(task.id, input_snapshot=frozen)
    service.translator.translate = AsyncMock(return_value={
        "translations": {"slogan": "Historical slogan"}, "failed_ids": []})
    asyncio.run(service.run(task.id))
    assert len(service.translator.translate.call_args.args[0]) == 3
    current = service.repository.get_subtitle_workspace(workspace.id)
    assert current.segments[1].translated_text == "Historical slogan"
    assert "brand_rule_version" not in service.repository.get_tool_task(task.id).input_snapshot


def test_new_extract_completion_filters_brands_and_legacy_completion_keeps_them(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    for legacy in (False, True):
        task = service.submit(workspace.id, "extract", SubtitleStageRequest(expected_revision=workspace.revision))
        if legacy:
            frozen = dict(task.input_snapshot)
            frozen.pop("brand_rule_version")
            service.repository.update_tool_task(task.id, input_snapshot=frozen)
        service._complete(task.id, result={"segments": [
            segment("logo").model_copy(update={"text": "Tineco"}).model_dump(mode="json")]})
        workspace = service.repository.get_subtitle_workspace(workspace.id)
        assert len(workspace.segments) == int(legacy)


def test_render_png_failure_fallback_never_reintroduces_brand_records(
    subtitle_service, monkeypatch, font_http,
):
    from backend.app.services import subtitle_translation

    service = subtitle_service
    workspace, _ = seed(service)
    workspace.segments[-1].translated_text = "Produkt"
    workspace = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, segments=workspace.segments))
    calls = []

    def compiler(records, video):
        calls.append(records)
        return {"project": {"fixture": True}, "layouts": {}, "warnings": [],
                "layers": {"fixture": {}} if len(calls) == 1 else {}}

    service.compiler = compiler
    native = subtitle_translation.compile_text_subtitle_project

    def fallback(records, video):
        calls.append(records)
        return native(records, video)

    monkeypatch.setattr(subtitle_translation, "compile_text_subtitle_project", fallback)
    service.layers.prepare = AsyncMock(side_effect=RuntimeError("fixture failure"))
    client = SimpleNamespace(submit=AsyncMock(return_value=SimpleNamespace(task_id="p")),
                             poll=AsyncMock(return_value=SimpleNamespace(output_video_url="https://fixture.test/video")))
    service.mediakit_factory = lambda: client
    service.media = SimpleNamespace(store_output=AsyncMock(return_value=SimpleNamespace(id="output")))
    task = service.submit(workspace.id, "render", SubtitleStageRequest(expected_revision=workspace.revision))
    asyncio.run(service.run(task.id))
    assert len(calls) == 2
    assert all([r["segment_id"] for r in records] == ["normal"] for records in calls)
    assert calls[1][0]["product_names_enabled"] == calls[0][0]["product_names_enabled"]
    assert calls[1][0]["product_mentions"] == calls[0][0]["product_mentions"]
    assert service.repository.get_tool_task(task.id).status.value == "succeeded"
    project = client.submit.call_args.kwargs["project"]
    assert [e["text"] for track in project["track"][1:] for e in track] == ["Produkt"]


def test_retry_old_brand_only_submitted_render_keeps_frozen_provider_task(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    task = service.submit(workspace.id, "render", SubtitleStageRequest(expected_revision=workspace.revision))
    frozen = {**task.input_snapshot, "segments": [
        segment("logo").model_copy(update={"text": "Tineco"}).model_dump(mode="json")]}
    frozen.pop("brand_rule_version")
    service.repository.update_tool_task(task.id, input_snapshot=frozen, provider_task_id="historical-provider")

    def mutate(current, tasks):
        current.segments = [segment("logo").model_copy(update={"text": "Tineco"})]
        return current, None

    service.repository.mutate_subtitle_workspace(workspace.id, mutate)
    service._complete(task.id, error="poll interrupted")
    retried = service.retry(task.id)
    assert retried.provider_task_id == "historical-provider"
    assert "brand_rule_version" not in retried.input_snapshot
    service.compiler = lambda *args: pytest.fail("submitted historical project must not recompile")
    client = SimpleNamespace(submit=AsyncMock(), poll=AsyncMock(
        return_value=SimpleNamespace(output_video_url="https://fixture.test/video")))
    service.mediakit_factory = lambda: client
    service.media = SimpleNamespace(store_output=AsyncMock(return_value=SimpleNamespace(id="output")))
    asyncio.run(service.run(retried.id))
    client.submit.assert_not_awaited()
    assert client.poll.call_args.kwargs["task_id"] == "historical-provider"
