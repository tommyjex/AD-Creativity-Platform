from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from backend.app.api.dependencies import (
    get_aigc_pipeline_runtime,
    get_asset_storage_service,
    get_media_inspector_service,
    get_repository,
    get_video_normalizer_service,
)
from backend.app.main import create_app
from backend.app.schemas import (
    AigcPipelineDefinition,
    AigcPipelineRun,
    AigcPipelineRunNode,
    AigcPipelineRunStatus,
    AigcResultAsset,
    AigcResultKind,
    AigcRunNodeStatus,
    AigcTaskMetrics,
    AigcTaskResult,
    AigcTaskType,
)
from backend.app.services.aigc_executor import AigcPipelineRuntime
from backend.app.services.aigc_gateway import (
    AIGC_VIDEO_EXECUTOR_VERSION,
    AigcGatewayExecution,
)


class ControlledGateway:
    """Deterministic acceptance gateway that never reaches a paid provider."""

    def __init__(self, asset_storage) -> None:
        self.calls: list[dict[str, str]] = []
        self.asset_storage = asset_storage

    async def execute(self, task) -> AigcGatewayExecution:
        self.calls.append(
            {
                "node_id": task.node_id,
                "task_id": task.task_id,
                "type": task.type.value,
                "provider": "controlled-mock",
            }
        )
        if task.type == AigcTaskType.LLM:
            result = AigcTaskResult(
                kind=AigcResultKind.TEXT,
                text=f"controlled:{task.node_id}",
                text_digest="c" * 64,
            )
            executor_version = "controlled-aigc-llm-v1"
        elif task.type == AigcTaskType.VIDEO_GENERATION:
            asset_id = task.params["reference_video_asset_ids"][0]
            result = AigcTaskResult(
                kind=AigcResultKind.ASSETS,
                assets=[
                    AigcResultAsset(
                        asset_id=asset_id,
                        ordinal=0,
                        mime_type="video/mp4",
                        download_url=f"/api/assets/{asset_id}/content",
                    )
                ],
            )
            executor_version = AIGC_VIDEO_EXECUTOR_VERSION
        else:
            raise AssertionError(f"unexpected paid-capable task: {task.type.value}")
        return AigcGatewayExecution(
            result=result,
            metrics=AigcTaskMetrics(duration_ms=1, cost_tokens=0),
            executor_version=executor_version,
        )


@pytest.fixture
def controlled_api(
    repository,
    test_asset_storage,
    media_inspector,
    video_normalizer,
):
    gateway = ControlledGateway(test_asset_storage)
    runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_asset_storage_service] = lambda: test_asset_storage
    app.dependency_overrides[get_media_inspector_service] = lambda: media_inspector
    app.dependency_overrides[get_video_normalizer_service] = lambda: video_normalizer
    app.dependency_overrides[get_aigc_pipeline_runtime] = lambda: runtime
    with TestClient(app) as client:
        yield client, repository, gateway
    app.dependency_overrides.clear()


def _node(
    node_id: str,
    node_type: str,
    x: int,
    y: int,
    *,
    config: dict[str, object] | None = None,
) -> dict[str, object]:
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": x, "y": y},
        "size": {"width": 260, "height": 180},
        "config": config or {},
    }


def _edge(
    edge_id: str,
    source: str,
    source_handle: str,
    target: str,
    target_handle: str,
) -> dict[str, str]:
    return {
        "id": edge_id,
        "sourceNodeId": source,
        "sourceHandle": source_handle,
        "targetNodeId": target,
        "targetHandle": target_handle,
    }


def _upload(client: TestClient, kind: str, filename: str, mime_type: str) -> dict:
    response = client.post(
        f"/api/aigc/assets/{kind}",
        params={"filename": filename, "mime_type": mime_type},
        content=f"controlled-{kind}".encode(),
        headers={"content-type": "application/octet-stream"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _wait_for_run(client: TestClient, run_id: str) -> dict:
    detail: dict[str, Any] | None = None
    for _ in range(100):
        response = client.get(f"/api/aigc/runs/{run_id}")
        assert response.status_code == 200, response.text
        detail = response.json()
        if detail["run"]["status"] not in {"queued", "running"}:
            return detail
        time.sleep(0.01)
    raise AssertionError(f"run did not reach a terminal state: {run_id}: {detail}")


def _v2_definition(asset_ids: dict[str, str]) -> dict[str, object]:
    nodes = [
        _node(
            "v2-text-local",
            "text",
            0,
            0,
            config={"text": "受控四模态验收", "title": "本地文本"},
        ),
        _node("v2-text-relay", "text", 300, 0, config={"text": "备用文本"}),
        _node("v2-text-terminal", "text", 600, 0, config={"title": "文本终端"}),
        _node(
            "v2-image-local",
            "image",
            0,
            220,
            config={"asset_id": asset_ids["image"], "title": "本地图片"},
        ),
        _node("v2-image-relay", "image", 300, 220),
        _node("v2-image-terminal", "image", 600, 220, config={"title": "图片终端"}),
        _node(
            "v2-video-local",
            "video",
            0,
            440,
            config={"asset_id": asset_ids["video"], "title": "本地视频"},
        ),
        _node("v2-video-relay", "video", 300, 440),
        _node("v2-video-terminal", "video", 600, 440, config={"title": "视频终端"}),
        _node(
            "v2-audio-local",
            "audio",
            0,
            660,
            config={"asset_id": asset_ids["audio"], "title": "本地音频"},
        ),
        _node("v2-audio-relay", "audio", 300, 660),
        _node("v2-audio-terminal", "audio", 600, 660, config={"title": "音频终端"}),
        _node("v2-llm-mock", "llm", 900, 0),
        _node(
            "v2-video-model-mock",
            "video_generation",
            900,
            400,
            config={
                "model": "doubao-seedance-2-5-260628",
                "generation_mode": "multimodal_reference",
                "task_type": "generate",
                "resolution": "1080p",
                "aspect_ratio": "16:9",
                "duration_seconds": 12,
                "generate_audio": True,
            },
        ),
        _node("v2-model-video-relay", "video", 1200, 400),
        _node(
            "v2-model-video-terminal",
            "video",
            1500,
            400,
            config={"title": "Mock 模型终端"},
        ),
    ]
    edges = [
        _edge("e-text-local-relay", "v2-text-local", "text", "v2-text-relay", "text"),
        _edge(
            "e-text-relay-terminal",
            "v2-text-relay",
            "text",
            "v2-text-terminal",
            "text",
        ),
        _edge("e-text-relay-llm", "v2-text-relay", "text", "v2-llm-mock", "prompt"),
        _edge(
            "e-image-local-relay",
            "v2-image-local",
            "image",
            "v2-image-relay",
            "image",
        ),
        _edge(
            "e-image-relay-terminal",
            "v2-image-relay",
            "image",
            "v2-image-terminal",
            "image",
        ),
        _edge(
            "e-image-relay-model",
            "v2-image-relay",
            "image",
            "v2-video-model-mock",
            "reference_images",
        ),
        _edge(
            "e-video-local-relay",
            "v2-video-local",
            "video",
            "v2-video-relay",
            "video",
        ),
        _edge(
            "e-video-relay-terminal",
            "v2-video-relay",
            "video",
            "v2-video-terminal",
            "video",
        ),
        _edge(
            "e-video-relay-model",
            "v2-video-relay",
            "video",
            "v2-video-model-mock",
            "reference_videos",
        ),
        _edge(
            "e-audio-local-relay",
            "v2-audio-local",
            "audio",
            "v2-audio-relay",
            "audio",
        ),
        _edge(
            "e-audio-relay-terminal",
            "v2-audio-relay",
            "audio",
            "v2-audio-terminal",
            "audio",
        ),
        _edge(
            "e-audio-relay-model",
            "v2-audio-relay",
            "audio",
            "v2-video-model-mock",
            "reference_audios",
        ),
        _edge(
            "e-text-relay-model",
            "v2-text-relay",
            "text",
            "v2-video-model-mock",
            "prompt",
        ),
        _edge(
            "e-model-video-relay",
            "v2-video-model-mock",
            "video",
            "v2-model-video-relay",
            "video",
        ),
        _edge(
            "e-model-video-terminal",
            "v2-model-video-relay",
            "video",
            "v2-model-video-terminal",
            "video",
        ),
    ]
    return {
        "schemaVersion": 2,
        "nodes": nodes,
        "edges": edges,
        "viewport": {"x": 12, "y": 24, "zoom": 0.72},
    }


def _v1_definition(*, prompt: str) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "nodes": [
            _node(
                "legacy-text-source",
                "text_input",
                10,
                20,
                config={"text": prompt},
            ),
            _node("legacy-llm", "llm", 340, 20),
            _node(
                "legacy-text-output",
                "text_output",
                680,
                20,
                config={"title": "历史广告标题"},
            ),
        ],
        "edges": [
            _edge(
                "legacy-source-model",
                "legacy-text-source",
                "text",
                "legacy-llm",
                "prompt",
            ),
            _edge(
                "legacy-model-output",
                "legacy-llm",
                "text",
                "legacy-text-output",
                "text",
            ),
        ],
        "viewport": {"x": 7, "y": 9, "zoom": 0.9},
    }


def test_task_8_3_and_8_4_controlled_api_acceptance(
    controlled_api,
) -> None:
    client, repository, gateway = controlled_api
    request_log: list[tuple[str, str]] = []

    def api(method: str, path: str, **kwargs):
        request_log.append((method, path))
        return client.request(method, path, **kwargs)

    image = _upload(client, "images", "task-8-image.png", "image/png")
    video = _upload(client, "videos", "task-8-video.mp4", "video/mp4")
    audio = _upload(client, "audios", "task-8-audio.mp3", "audio/mpeg")
    local_asset_ids = {
        "image": image["id"],
        "video": video["id"],
        "audio": audio["id"],
    }
    initial_repository_asset_ids = {
        asset.id for asset in repository.list_assets(status=None)
    }

    v2_response = api(
        "POST",
        "/api/aigc/pipelines",
        json={
            "name": "[验收 Task 8.3] 隔离四模态 v2",
            "description": "受控 mock，不调用付费模型；不删除。",
            "definition": _v2_definition(local_asset_ids),
        },
    )
    assert v2_response.status_code == 201, v2_response.text
    v2_pipeline = v2_response.json()
    v2_run_response = api(
        "POST",
        f"/api/aigc/pipelines/{v2_pipeline['id']}/runs",
        json={"expected_revision": v2_pipeline["revision"], "mode": "full"},
        headers={"Idempotency-Key": f"task-8-3-{v2_pipeline['id']}"},
    )
    assert v2_run_response.status_code == 202, v2_run_response.text
    v2_run_id = v2_run_response.json()["run"]["id"]
    v2_detail = _wait_for_run(client, v2_run_id)
    assert v2_detail["run"]["status"] == "succeeded"

    definition_nodes = {
        node["id"]: node for node in v2_pipeline["definition"]["nodes"]
    }
    modality_node_ids = {
        node_id
        for node_id, node in definition_nodes.items()
        if node["type"] in {"text", "image", "video", "audio"}
    }
    planned_modalities = {
        node["node_id"]: node
        for node in v2_detail["nodes"]
        if node["node_id"] in modality_node_ids and node["included_in_plan"]
    }
    assert set(planned_modalities) == modality_node_ids
    assert all(node["current_task_id"] is None for node in planned_modalities.values())
    assert all(node["attempts"] == [] for node in planned_modalities.values())

    expected_asset_by_node = {
        "v2-image-local": image["id"],
        "v2-image-relay": image["id"],
        "v2-image-terminal": image["id"],
        "v2-video-local": video["id"],
        "v2-video-relay": video["id"],
        "v2-video-terminal": video["id"],
        "v2-audio-local": audio["id"],
        "v2-audio-relay": audio["id"],
        "v2-audio-terminal": audio["id"],
        "v2-model-video-relay": video["id"],
        "v2-model-video-terminal": video["id"],
    }
    observed_asset_by_node = {
        node_id: planned_modalities[node_id]["result"]["assets"][0]["asset_id"]
        for node_id in expected_asset_by_node
    }
    assert observed_asset_by_node == expected_asset_by_node
    assert {
        asset.id for asset in repository.list_assets(status=None)
    } == initial_repository_asset_ids

    legacy_source = _v1_definition(prompt="历史提示词")
    legacy_create = api(
        "POST",
        "/api/aigc/pipelines",
        json={
            "name": "[验收 Task 8.4] v1 自动迁移",
            "description": "v1 保存升级和历史快照隔离。",
            "definition": legacy_source,
        },
    )
    assert legacy_create.status_code == 201, legacy_create.text
    legacy_pipeline = legacy_create.json()
    saved_definition = legacy_pipeline["definition"]
    assert saved_definition["schemaVersion"] == 2
    assert [node["id"] for node in saved_definition["nodes"]] == [
        node["id"] for node in legacy_source["nodes"]
    ]
    assert [edge["id"] for edge in saved_definition["edges"]] == [
        edge["id"] for edge in legacy_source["edges"]
    ]
    saved_output = next(
        node
        for node in saved_definition["nodes"]
        if node["id"] == "legacy-text-output"
    )
    assert saved_output["config"]["title"] == "历史广告标题"

    historical_snapshot = AigcPipelineDefinition.model_validate(legacy_source)
    historical_created = repository.create_aigc_run(
        AigcPipelineRun(
            pipeline_id=legacy_pipeline["id"],
            run_number=1,
            pipeline_revision=0,
            mode="full",
            status=AigcPipelineRunStatus.SUCCEEDED,
            definition_snapshot=historical_snapshot,
        ),
        idempotency_key=f"task-8-4-history-{legacy_pipeline['id']}",
        nodes=[
            AigcPipelineRunNode(
                node_id=node.id,
                included_in_plan=True,
                status=AigcRunNodeStatus.SUCCEEDED,
                result=(
                    AigcTaskResult(
                        kind=AigcResultKind.TEXT,
                        text="历史 Run 结果",
                        text_digest="h" * 64,
                    )
                    if node.id == "legacy-text-output"
                    else AigcTaskResult()
                ),
            )
            for node in historical_snapshot.nodes
        ],
    )
    historical_run_id = historical_created.run.id
    historical_before = api(
        "GET",
        f"/api/aigc/runs/{historical_run_id}",
    ).json()

    update_response = api(
        "PUT",
        f"/api/aigc/pipelines/{legacy_pipeline['id']}",
        json={
            "expected_revision": legacy_pipeline["revision"],
            "name": legacy_pipeline["name"],
            "description": legacy_pipeline["description"],
            "definition": _v1_definition(prompt="当前提示词"),
        },
    )
    assert update_response.status_code == 200, update_response.text
    updated_pipeline = update_response.json()
    assert updated_pipeline["definition"]["schemaVersion"] == 2
    updated_output = next(
        node
        for node in updated_pipeline["definition"]["nodes"]
        if node["id"] == "legacy-text-output"
    )
    assert updated_output["config"]["title"] == "历史广告标题"

    current_run_response = api(
        "POST",
        f"/api/aigc/pipelines/{legacy_pipeline['id']}/runs",
        json={"expected_revision": updated_pipeline["revision"], "mode": "full"},
        headers={"Idempotency-Key": f"task-8-4-current-{legacy_pipeline['id']}"},
    )
    assert current_run_response.status_code == 202, current_run_response.text
    current_run_id = current_run_response.json()["run"]["id"]
    current_detail = _wait_for_run(client, current_run_id)
    historical_after = api(
        "GET",
        f"/api/aigc/runs/{historical_run_id}",
    ).json()
    switched_current = api("GET", f"/api/aigc/runs/{current_run_id}").json()
    switched_history = api("GET", f"/api/aigc/runs/{historical_run_id}").json()

    assert historical_after == historical_before
    assert historical_after["run"]["definition_snapshot"]["schemaVersion"] == 1
    assert current_detail["run"]["definition_snapshot"]["schemaVersion"] == 2
    assert switched_current["run"]["id"] == current_run_id
    assert switched_history["run"]["id"] == historical_run_id
    historical_output = next(
        node
        for node in switched_history["nodes"]
        if node["node_id"] == "legacy-text-output"
    )
    current_output = next(
        node
        for node in switched_current["nodes"]
        if node["node_id"] == "legacy-text-output"
    )
    assert historical_output["result"]["text"] == "历史 Run 结果"
    assert current_output["result"]["text"] == "controlled:legacy-llm"
    assert not any(method == "DELETE" for method, _ in request_log)
    assert all(call["provider"] == "controlled-mock" for call in gateway.calls)

    report = {
        "task": "8.3/8.4",
        "execution_mode": "isolated FastAPI TestClient + InMemoryRepository",
        "paid_model_calls": 0,
        "delete_requests": 0,
        "v2": {
            "pipeline_id": v2_pipeline["id"],
            "pipeline_url": (
                "http://testserver/api/aigc/pipelines/"
                f"{v2_pipeline['id']}"
            ),
            "run_id": v2_run_id,
            "run_url": f"http://testserver/api/aigc/runs/{v2_run_id}",
            "status": v2_detail["run"]["status"],
            "planned_modality_node_ids": sorted(planned_modalities),
            "modality_attempt_counts": {
                node_id: len(node["attempts"])
                for node_id, node in sorted(planned_modalities.items())
            },
            "asset_ids": local_asset_ids,
            "asset_id_by_modality_node": observed_asset_by_node,
            "repository_asset_ids_before_and_after": sorted(
                initial_repository_asset_ids
            ),
        },
        "v1_migration": {
            "pipeline_id": legacy_pipeline["id"],
            "pipeline_url": (
                "http://testserver/api/aigc/pipelines/"
                f"{legacy_pipeline['id']}"
            ),
            "saved_schema_version": updated_pipeline["definition"]["schemaVersion"],
            "preserved_node_ids": [
                node["id"] for node in updated_pipeline["definition"]["nodes"]
            ],
            "preserved_edge_ids": [
                edge["id"] for edge in updated_pipeline["definition"]["edges"]
            ],
            "preserved_output_title": updated_output["config"]["title"],
            "historical_run_id": historical_run_id,
            "historical_run_url": (
                f"http://testserver/api/aigc/runs/{historical_run_id}"
            ),
            "historical_snapshot_schema_version": 1,
            "current_run_id": current_run_id,
            "current_run_url": (
                f"http://testserver/api/aigc/runs/{current_run_id}"
            ),
            "current_snapshot_schema_version": 2,
            "historical_result": historical_output["result"]["text"],
            "current_result": current_output["result"]["text"],
        },
        "controlled_gateway_calls": gateway.calls,
    }
    report_path = os.environ.get("TASK_8_ACCEPTANCE_REPORT")
    if report_path:
        Path(report_path).write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
