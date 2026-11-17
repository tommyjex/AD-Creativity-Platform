import asyncio
from unittest.mock import AsyncMock

import pytest

from video_subtitle_grounding.product_names import text_fingerprint
from backend.app.api.dependencies import get_subtitle_translation_service
from backend.app.repositories.base import RevisionConflictError
from backend.app.schemas.subtitle_translation import SubtitleWorkspaceUpdate
from backend.tests.test_subtitle_translation_layout import font_http
from backend.tests.test_subtitle_translation_workspace import extracted, subtitle_repo, subtitle_service

__all__ = ["font_http", "subtitle_repo", "subtitle_service"]


def product(workspace):
    item = workspace.segments[0].model_copy(deep=True)
    item.translated_text = "FLOOR ONE i5 Lite"
    item.product_mentions = [{
        "start": 0, "end": len(item.translated_text), "model": "FLOOR ONE i5",
        "spec": "Lite", "origin": "model_pattern", "status": "confirmed", "catalog_id": None,
    }]
    item.product_text_sha256 = text_fingerprint(item.translated_text)
    return item


def test_preview_private_png_cache_and_draft_invalidation(client, subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    item = product(workspace)
    saved = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, segments=[item]))
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    root = f"/api/tools/subtitle-translation/workspaces/{workspace.id}"
    first = client.get(root)
    assert first.status_code == 200
    segment = first.json()["segments"][0]
    assert segment["product_mentions"][0]["spec"] == "Lite"
    assert {r["kind"] for r in segment["text_runs"]} == {"product_model", "product_spec"}
    layer_url = segment["render_layer_url"]
    assert layer_url.startswith(root + "/layers/")
    layer = client.get(layer_url)
    assert layer.status_code == 200
    assert layer.headers["content-type"] == "image/png"
    assert layer.content.startswith(b"\x89PNG")
    count = len(service.asset_storage.client.puts)
    assert client.get(root).status_code == 200
    assert len(service.asset_storage.client.puts) == count
    assert "X-Tos-Signature" not in first.text
    edited = item.model_copy(update={"translated_text": "No product here"})
    result = client.patch(root, json={
        "expected_revision": saved.revision, "segments": [edited.model_dump(mode="json")]})
    assert result.status_code == 200
    current = result.json()["segments"][0]
    assert current["product_mentions"] == []
    assert current["render_layer_url"] is None
    # Previous immutable layers are retained for in-flight and historical tasks.
    assert client.get(layer_url).status_code == 200


def test_private_layer_isolation_and_invalid_hash(client, subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    workspace.segments = [product(workspace)]
    preview = asyncio.run(service.preview(workspace))
    layer_id = preview.segments[0].render_layer_asset_id
    other, _ = extracted(service)
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    root = "/api/tools/subtitle-translation/workspaces/"
    assert client.get(f"{root}{other.id}/layers/{layer_id}.png").status_code == 404
    assert client.get(f"{root}{workspace.id}/layers/not-a-hash.png").status_code == 404


def test_explicit_model_recognition_saves_unknown_name_without_retranslation(client, subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    item = product(workspace)
    item.product_mentions = []
    item.product_text_sha256 = None
    service.translator = AsyncMock()
    service.translator.recognize_products.return_value = {
        "product_mentions": {"s1": product(workspace).product_mentions},
        "product_text_sha256": {"s1": text_fingerprint(item.translated_text)},
        "warnings": {}, "usage": {},
    }
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    response = client.post(
        f"/api/tools/subtitle-translation/workspaces/{workspace.id}/recognize-products",
        json={"expected_revision": workspace.revision, "segments": [item.model_dump(mode="json")]})
    assert response.status_code == 200
    assert response.json()["revision"] == workspace.revision + 1
    assert response.json()["segments"][0]["product_mentions"][0]["origin"] == "model_pattern"
    service.translator.translate.assert_not_called()
    service.translator.recognize_products.assert_awaited_once()
    assert service.repository.get_subtitle_workspace(workspace.id).segments[0].translated_text == item.translated_text


def test_recognition_cannot_overwrite_concurrent_edit(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    request = SubtitleWorkspaceUpdate(expected_revision=workspace.revision, segments=[product(workspace)])

    async def recognize(*args, **kwargs):
        service.patch(workspace.id, SubtitleWorkspaceUpdate(
            expected_revision=workspace.revision, name="Concurrent edit"))
        return {"product_mentions": {}, "product_text_sha256": {}, "warnings": {}}

    service.translator = AsyncMock()
    service.translator.recognize_products.side_effect = recognize
    with pytest.raises(RevisionConflictError):
        asyncio.run(service.recognize_products(workspace.id, request))
    assert service.repository.get_subtitle_workspace(workspace.id).name == "Concurrent edit"


def test_layer_upload_failure_keeps_text_editable(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    workspace.segments = [product(workspace)]
    service.asset_storage.client.fail_uploads = True
    preview = asyncio.run(service.preview(workspace))
    item = preview.segments[0]
    assert item.render_layer_url is None
    assert item.translated_text == "FLOOR ONE i5 Lite"
    assert "product_layer_storage_unavailable" in item.warnings


def test_layer_auth_and_viewer_cannot_recognize(anonymous_client, repository, subtitle_service):
    from backend.app.schemas.auth import UserRole
    from backend.tests.auth_helpers import authenticate_test_client

    service = subtitle_service
    workspace, _ = extracted(service)
    workspace.segments = [product(workspace)]
    preview = asyncio.run(service.preview(workspace))
    url = preview.segments[0].render_layer_url
    client = anonymous_client
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    assert client.get(url).status_code == 401
    authenticate_test_client(client, repository, role=UserRole.VIEWER)
    assert client.get(url).status_code == 200
    service.translator = AsyncMock()
    response = client.post(
        f"/api/tools/subtitle-translation/workspaces/{workspace.id}/recognize-products",
        json={"expected_revision": workspace.revision})
    assert response.status_code == 403
    service.translator.recognize_products.assert_not_called()


def test_recognition_invalid_split_warning_survives_writeback(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    item = product(workspace)
    item.warnings = ["product_recognition_invalid_split"]
    saved = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, segments=[item]))
    assert "product_recognition_invalid_split" in saved.segments[0].warnings


@pytest.mark.parametrize("upload_fails", [False, True])
def test_render_uses_private_png_or_readable_fallback(subtitle_service, upload_fails):
    from types import SimpleNamespace
    from backend.app.schemas.subtitle_translation import SubtitleStageRequest

    service = subtitle_service
    workspace, _ = extracted(service)
    workspace = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, segments=[product(workspace)]))
    task = service.submit(workspace.id, "render", SubtitleStageRequest(
        expected_revision=workspace.revision))
    service.asset_storage.client.fail_uploads = upload_fails
    client = SimpleNamespace(
        submit=AsyncMock(return_value=SimpleNamespace(task_id="fixture-render")),
        poll=AsyncMock(return_value=SimpleNamespace(output_video_url="https://fixture.example/output.mp4")),
    )
    service.mediakit_factory = lambda: client
    service.media = SimpleNamespace(store_output=AsyncMock(return_value=SimpleNamespace(id="output")))
    asyncio.run(service.run(task.id))
    finished = service.repository.get_tool_task(task.id)
    assert finished.status.value == "succeeded"
    element = client.submit.call_args.kwargs["project"]["track"][1][0]
    assert element["type"] == ("text" if upload_fails else "image")
    assert "subtitle-layer:" not in str(client.submit.call_args)
    assert "product_layer_storage_unavailable" in finished.input_snapshot["layout_warnings"] if upload_fails else True
    assert "signature" not in str(finished.input_snapshot.get("layouts", {})).lower()


def test_save_automatically_infers_unknown_names_and_reuses_current_result(client, subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    item = product(workspace)
    item.product_mentions = []
    item.product_text_sha256 = None
    service.translator.recognize_products.return_value = {
        "product_mentions": {"s1": product(workspace).product_mentions}, "warnings": {}}
    service.translator.recognize_products.side_effect = None
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    url = f"/api/tools/subtitle-translation/workspaces/{workspace.id}"
    saved = client.patch(url, json={"expected_revision": workspace.revision,
                                   "segments": [item.model_dump(mode="json")]})
    assert saved.status_code == 200
    record = saved.json()["segments"][0]
    assert record["product_mentions"][0]["spec"] == "Lite"
    assert record["product_recognition_sha256"]
    again = client.patch(url, json={"expected_revision": saved.json()["revision"], "segments": [record]})
    assert again.status_code == 200
    service.translator.recognize_products.assert_awaited_once()


def test_post_preview_caches_inference_without_saving_then_text_edit_reinfers(client, subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    item = product(workspace)
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    url = f"/api/tools/subtitle-translation/workspaces/{workspace.id}/preview"
    payload = {"expected_revision": workspace.revision, "segments": [item.model_dump(mode="json")]}
    assert client.post(url, json=payload).status_code == 200
    assert client.post(url, json=payload).status_code == 200
    assert service.repository.get_subtitle_workspace(workspace.id).revision == workspace.revision
    assert service.translator.recognize_products.await_count == 1
    payload["segments"][0]["translated_text"] = "FLOOR ONE S10 Ultra"
    assert client.post(url, json=payload).status_code == 200
    assert service.translator.recognize_products.await_count == 2


def test_automatic_failure_retries_then_saves_readable_text(client, subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    service.translator.recognize_products.side_effect = RuntimeError("private failure")
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    item = product(workspace)
    response = client.patch(f"/api/tools/subtitle-translation/workspaces/{workspace.id}", json={
        "expected_revision": workspace.revision, "segments": [item.model_dump(mode="json")]})
    assert response.status_code == 200
    assert response.json()["segments"][0]["translated_text"] == item.translated_text
    assert service.translator.recognize_products.await_count == 2
    assert "private failure" not in response.text


def test_automatic_inference_preserves_concurrent_edit(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)

    async def recognize(*args, **kwargs):
        service.patch(workspace.id, SubtitleWorkspaceUpdate(
            expected_revision=workspace.revision, name="Concurrent automatic edit"))
        return {"product_mentions": {}, "warnings": {}}

    service.translator.recognize_products.side_effect = recognize
    with pytest.raises(RevisionConflictError):
        asyncio.run(service.prepare_product_update(workspace.id, SubtitleWorkspaceUpdate(
            expected_revision=workspace.revision, segments=[product(workspace)])))
    assert service.repository.get_subtitle_workspace(workspace.id).name == "Concurrent automatic edit"
