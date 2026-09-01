from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from backend.app.repositories import InMemoryRepository, MySQLRepository
from backend.app.schemas import (
    AigcAssetDirection,
    AigcLayer,
    AigcLayerSet,
    AigcPipelineRun,
    AigcPipelineRunNode,
    AigcPipelineRunStatus,
    AigcPipelineTaskAssetReference,
    AigcPipelineTaskAttempt,
    AigcResultAsset,
    AigcResultKind,
    AigcRunNodeStatus,
    AigcTaskResult,
    AigcTaskStatus,
    AigcTaskType,
    AssetCreate,
    AssetRole,
    AssetType,
    Status,
    ToolAssetRole,
)
from backend.app.services.video_normalizer import NormalizedVideo


@pytest.fixture(params=["client", "mysql_client"])
def aigc_client(
    request: pytest.FixtureRequest,
) -> TestClient:
    return request.getfixturevalue(request.param)


@pytest.fixture(params=[("client", "repository"), ("mysql_client", "mysql_repository")])
def aigc_client_and_repository(
    request: pytest.FixtureRequest,
) -> tuple[TestClient, InMemoryRepository | MySQLRepository]:
    client_fixture, repository_fixture = request.param
    return (
        request.getfixturevalue(client_fixture),
        request.getfixturevalue(repository_fixture),
    )


def definition(
    *,
    image_asset_id: str | None = None,
    video_asset_id: str | None = None,
    audio_asset_id: str | None = None,
    text: str = "初始提示词",
):
    nodes = [
        {
            "id": "prompt",
            "type": "text_input",
            "position": {"x": 0, "y": 0},
            "size": {"width": 240, "height": 160},
            "config": {"text": text},
        },
        {
            "id": "model",
            "type": "text_to_image",
            "position": {"x": 320, "y": 0},
            "size": {"width": 280, "height": 200},
            "config": {},
        },
    ]
    edges = [
        {
            "id": "edge-1",
            "sourceNodeId": "prompt",
            "sourceHandle": "text",
            "targetNodeId": "model",
            "targetHandle": "prompt",
        }
    ]
    if image_asset_id is not None:
        nodes.append(
            {
                "id": "reference",
                "type": "image_input",
                "position": {"x": 0, "y": 240},
                "size": {"width": 240, "height": 200},
                "config": {"asset_id": image_asset_id},
            }
        )
    for node_type, asset_id in (
        ("video_input", video_asset_id),
        ("audio_input", audio_asset_id),
    ):
        if asset_id is not None:
            nodes.append(
                {
                    "id": node_type,
                    "type": node_type,
                    "position": {"x": 0, "y": 480},
                    "size": {"width": 240, "height": 200},
                    "config": {"asset_id": asset_id},
                }
            )
    return {
        "schemaVersion": 1,
        "nodes": nodes,
        "edges": edges,
        "viewport": {"x": 0, "y": 0, "zoom": 1},
    }


def video_save_definition(
    *,
    source_type: str,
    target_handle: str,
    mode: str,
    count: int = 1,
    model: str = "doubao-seedance-2-5-260628",
):
    source_handle = {
        "text_input": "text",
        "image_input": "image",
        "video_input": "video",
        "audio_input": "audio",
    }[source_type]
    nodes = [
        {
            "id": "video-model",
            "type": "video_generation",
            "position": {"x": 320, "y": 0},
            "size": {"width": 280, "height": 200},
            "config": {
                "model": model,
                "generation_mode": mode,
            },
        }
    ]
    edges = []
    for index in range(count):
        source_id = f"source-{index}"
        config = (
            {"text": "生成视频"}
            if source_type == "text_input"
            else {"asset_id": None}
        )
        nodes.append(
            {
                "id": source_id,
                "type": source_type,
                "position": {"x": 0, "y": index * 220},
                "size": {"width": 240, "height": 180},
                "config": config,
            }
        )
        edges.append(
            {
                "id": f"edge-{index}",
                "sourceNodeId": source_id,
                "sourceHandle": source_handle,
                "targetNodeId": "video-model",
                "targetHandle": target_handle,
            }
        )
    return {
        "schemaVersion": 1,
        "nodes": nodes,
        "edges": edges,
        "viewport": {"x": 0, "y": 0, "zoom": 1},
    }


def upload_image(client: TestClient) -> dict:
    response = client.post(
        "/api/aigc/assets/images",
        params={"filename": "reference.png", "mime_type": "image/png"},
        content=b"\x89PNG\r\n\x1a\nimage-content",
        headers={"content-type": "application/octet-stream"},
    )
    assert response.status_code == 201
    return response.json()


def test_node_registry_exposes_all_schema_version_one_nodes(
    aigc_client: TestClient,
) -> None:
    response = aigc_client.get("/api/aigc/node-registry")

    assert response.status_code == 200
    assert [item["type"] for item in response.json()["nodes"]] == [
        "text_input",
        "image_input",
        "video_input",
        "audio_input",
        "llm",
        "text_to_image",
        "image_to_image",
        "video_generation",
        "layer_canvas",
        "layer_composite",
        "text_output",
        "image_output",
        "video_output",
    ]


@pytest.mark.parametrize(
    ("source_type", "target_handle"),
    [
        ("text_input", "first_frame"),
        ("video_input", "reference_audios"),
        ("audio_input", "reference_videos"),
    ],
)
def test_pipeline_create_rejects_cross_type_connections_with_location(
    aigc_client: TestClient,
    source_type: str,
    target_handle: str,
) -> None:
    response = aigc_client.post(
        "/api/aigc/pipelines",
        json={
            "name": "非法类型连线",
            "definition": video_save_definition(
                source_type=source_type,
                target_handle=target_handle,
                mode=(
                    "first_frame"
                    if target_handle == "first_frame"
                    else "multimodal_reference"
                ),
            ),
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == {
        "code": "validation_error",
        "message": "edge port types are incompatible",
        "validation_code": "port_type_mismatch",
        "node_id": "video-model",
        "edge_id": "edge-0",
    }


@pytest.mark.parametrize(
    ("mutation", "validation_code", "edge_id"),
    [
        ("unknown_port", "target_port_missing", "edge-0"),
        ("duplicate_edge", "duplicate_edge", "duplicate-edge"),
    ],
)
def test_pipeline_create_rejects_unknown_ports_and_duplicate_edges(
    aigc_client: TestClient,
    mutation: str,
    validation_code: str,
    edge_id: str,
) -> None:
    invalid = video_save_definition(
        source_type="text_input",
        target_handle="prompt",
        mode="text_to_video",
    )
    if mutation == "unknown_port":
        invalid["edges"][0]["targetHandle"] = "unknown"
    else:
        invalid["edges"].append(
            {
                **invalid["edges"][0],
                "id": "duplicate-edge",
            }
        )

    response = aigc_client.post(
        "/api/aigc/pipelines",
        json={"name": "非法结构", "definition": invalid},
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["validation_code"] == validation_code
    assert detail["node_id"] == "video-model"
    assert detail["edge_id"] == edge_id


def test_pipeline_update_rejects_dynamic_model_limit(
    aigc_client: TestClient,
) -> None:
    pipeline = aigc_client.post(
        "/api/aigc/pipelines",
        json={"name": "草稿", "definition": {}},
    ).json()
    response = aigc_client.put(
        f"/api/aigc/pipelines/{pipeline['id']}",
        json={
            "name": "超限草稿",
            "definition": video_save_definition(
                source_type="image_input",
                target_handle="reference_images",
                mode="multimodal_reference",
                count=10,
                model="doubao-seedance-2-0-fast-260128",
            ),
            "expected_revision": 0,
        },
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["validation_code"] == "input_connection_limit_exceeded"
    assert detail["node_id"] == "video-model"
    assert detail["edge_id"] == "edge-9"
    assert aigc_client.get(
        f"/api/aigc/pipelines/{pipeline['id']}"
    ).json()["revision"] == 0


def test_template_update_rejects_port_disabled_by_mode(
    aigc_client: TestClient,
) -> None:
    template = aigc_client.post(
        "/api/aigc/templates",
        json={"name": "草稿模板", "definition": {}},
    ).json()
    response = aigc_client.put(
        f"/api/aigc/templates/{template['id']}",
        json={
            "name": "非法模板",
            "definition": video_save_definition(
                source_type="image_input",
                target_handle="first_frame",
                mode="text_to_video",
            ),
            "expected_revision": 0,
        },
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["validation_code"] == "input_not_allowed_for_mode"
    assert detail["node_id"] == "video-model"
    assert detail["edge_id"] == "edge-0"
    assert aigc_client.get(
        f"/api/aigc/templates/{template['id']}"
    ).json()["revision"] == 0


@pytest.mark.parametrize("resource", ["pipelines", "templates"])
def test_pipeline_and_template_save_allow_incomplete_drafts(
    aigc_client: TestClient,
    resource: str,
) -> None:
    empty = aigc_client.post(
        f"/api/aigc/{resource}",
        json={"name": "空白画布", "definition": {}},
    )
    incomplete = aigc_client.post(
        f"/api/aigc/{resource}",
        json={
            "name": "待连接草稿",
            "definition": {
                "nodes": [
                    {
                        "id": "model",
                        "type": "video_generation",
                        "position": {"x": 0, "y": 0},
                        "size": {"width": 280, "height": 200},
                        "config": {"generation_mode": "first_last_frame"},
                    }
                ],
                "edges": [],
            },
        },
    )

    assert empty.status_code == 201
    assert empty.json()["definition"]["nodes"] == []
    assert incomplete.status_code == 201
    assert incomplete.json()["definition"]["nodes"][0]["id"] == "model"


def test_pipeline_save_allows_unconfigured_asset_input(
    aigc_client: TestClient,
) -> None:
    response = aigc_client.post(
        "/api/aigc/pipelines",
        json={
            "name": "待修复素材",
            "definition": video_save_definition(
                source_type="image_input",
                target_handle="first_frame",
                mode="first_frame",
            ),
        },
    )

    assert response.status_code == 201
    assert response.json()["definition"]["nodes"][1]["config"]["asset_id"] is None


def test_prompt_optimization_preserves_reference_cardinality(
    aigc_client: TestClient,
) -> None:
    response = aigc_client.post(
        "/api/aigc/prompts/optimize",
        json={
            "text": "红色包装产品主图",
            "reference_instructions": ["保留商标位置", "使用背景色调"],
            "generation_modes": ["image_to_image"],
            "reference_image_count": 2,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert "主体明确" in payload["optimized_text"]
    assert len(payload["optimized_reference_instructions"]) == 2
    assert all(
        "<bbox>" not in value
        for value in [
            payload["optimized_text"],
            *payload["optimized_reference_instructions"],
        ]
    )


def test_prompt_optimization_rejects_empty_content(
    aigc_client: TestClient,
) -> None:
    response = aigc_client.post(
        "/api/aigc/prompts/optimize",
        json={
            "text": " ",
            "reference_instructions": [""],
            "generation_modes": ["text_to_image"],
            "reference_image_count": 0,
        },
    )

    assert response.status_code == 422


def test_template_instance_is_isolated_and_template_assets_are_scrubbed(
    aigc_client: TestClient,
) -> None:
    asset = upload_image(aigc_client)
    template_definition = definition(image_asset_id=asset["id"])
    prompt_config = template_definition["nodes"][0]["config"]
    prompt_config["bbox_references"] = [
        {"source_node_id": "reference", "instruction": "替换主体"}
    ]
    image_config = template_definition["nodes"][2]["config"]
    image_config["bbox_asset_id"] = asset["id"]
    image_config["bbox"] = {
        "type": "bbox",
        "x1": 100,
        "y1": 200,
        "x2": 700,
        "y2": 800,
    }
    create_response = aigc_client.post(
        "/api/aigc/templates",
        json={
            "name": " 商品海报模板 ",
            "description": "首期",
            "definition": template_definition,
        },
    )
    assert create_response.status_code == 201
    template = create_response.json()
    image_node = next(
        node for node in template["definition"]["nodes"] if node["type"] == "image_input"
    )
    assert image_node["config"]["asset_id"] is None
    assert image_node["config"]["bbox"] is None
    assert image_node["config"]["bbox_asset_id"] is None
    prompt_node = next(
        node for node in template["definition"]["nodes"] if node["type"] == "text_input"
    )
    assert prompt_node["config"]["bbox_references"] == []

    instantiate_response = aigc_client.post(
        f"/api/aigc/templates/{template['id']}/instantiate",
        json={"name": "我的商品海报"},
    )
    assert instantiate_response.status_code == 201
    pipeline = instantiate_response.json()
    assert pipeline["source_template_id"] == template["id"]
    assert pipeline["source_template_revision"] == 0

    updated_definition = definition(text="模板已更新")
    update_response = aigc_client.put(
        f"/api/aigc/templates/{template['id']}",
        json={
            "name": "商品海报模板 v2",
            "description": "更新",
            "definition": updated_definition,
            "expected_revision": 0,
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["revision"] == 1

    saved_pipeline = aigc_client.get(f"/api/aigc/pipelines/{pipeline['id']}").json()
    prompt_node = next(
        node
        for node in saved_pipeline["definition"]["nodes"]
        if node["type"] == "text_input"
    )
    assert prompt_node["config"]["text"] == "初始提示词"


def test_lists_filter_and_paginate_templates_and_pipelines(
    aigc_client: TestClient,
) -> None:
    for name in ("商品海报", "人物写真", "产品短片"):
        assert (
            aigc_client.post(
                "/api/aigc/templates",
                json={"name": name, "definition": definition()},
            ).status_code
            == 201
        )
        assert (
            aigc_client.post(
                "/api/aigc/pipelines",
                json={"name": f"我的{name}", "definition": definition()},
            ).status_code
            == 201
        )

    templates = aigc_client.get(
        "/api/aigc/templates",
        params={"q": "商品", "page": 1, "page_size": 1},
    )
    pipelines = aigc_client.get(
        "/api/aigc/pipelines",
        params={"q": "写真", "page": 1, "page_size": 20},
    )

    assert templates.status_code == 200
    assert templates.json()["total"] == 1
    assert len(templates.json()["items"]) == 1
    assert pipelines.status_code == 200
    assert pipelines.json()["total"] == 1
    assert pipelines.json()["items"][0]["name"] == "我的人物写真"


def test_delete_template_preserves_pipeline_and_returns_not_found(
    aigc_client: TestClient,
) -> None:
    template = aigc_client.post(
        "/api/aigc/templates",
        json={"name": "待删除模板", "definition": definition()},
    ).json()
    pipeline = aigc_client.post(
        f"/api/aigc/templates/{template['id']}/instantiate",
        json={"name": "保留的工作流"},
    ).json()

    deleted = aigc_client.delete(f"/api/aigc/templates/{template['id']}")

    assert deleted.status_code == 204
    assert deleted.content == b""
    assert aigc_client.get(
        f"/api/aigc/templates/{template['id']}"
    ).status_code == 404
    persisted = aigc_client.get(
        f"/api/aigc/pipelines/{pipeline['id']}"
    )
    assert persisted.status_code == 200
    assert persisted.json() == pipeline

    updated = aigc_client.put(
        f"/api/aigc/pipelines/{pipeline['id']}",
        json={
            "name": "模板删除后仍可编辑",
            "description": "来源字段保持不变",
            "definition": definition(text="删除后更新"),
            "expected_revision": pipeline["revision"],
        },
    )
    assert updated.status_code == 200
    assert updated.json()["source_template_id"] == template["id"]
    assert updated.json()["source_template_revision"] == template["revision"]
    run = aigc_client.post(
        f"/api/aigc/pipelines/{pipeline['id']}/runs",
        json={"expected_revision": updated.json()["revision"], "mode": "full"},
        headers={"Idempotency-Key": "run-after-template-delete"},
    )
    assert run.status_code == 202
    missing = aigc_client.delete(f"/api/aigc/templates/{template['id']}")
    assert missing.status_code == 404
    assert missing.json()["detail"]["code"] == "not_found"


def test_delete_pipeline_removes_draft_and_archives_completed_run(
    aigc_client_and_repository: tuple[
        TestClient,
        InMemoryRepository | MySQLRepository,
    ],
) -> None:
    aigc_client, repository = aigc_client_and_repository
    draft = aigc_client.post(
        "/api/aigc/pipelines",
        json={"name": "待删除工作流", "definition": definition()},
    ).json()

    deleted = aigc_client.delete(f"/api/aigc/pipelines/{draft['id']}")

    assert deleted.status_code == 204
    assert deleted.content == b""
    assert aigc_client.get(
        f"/api/aigc/pipelines/{draft['id']}"
    ).status_code == 404
    missing = aigc_client.delete(f"/api/aigc/pipelines/{draft['id']}")
    assert missing.status_code == 404
    assert missing.json()["detail"]["code"] == "not_found"

    result_asset = repository.create_asset(
        AssetCreate(
            id="api-protected-output",
            tool_asset_role=ToolAssetRole.OUTPUT,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            object_key="aigc/api-protected-output.png",
            mime_type="image/png",
        )
    )
    executed_response = aigc_client.post(
        "/api/aigc/pipelines",
        json={"name": "有历史运行", "definition": definition()},
    )
    assert executed_response.status_code == 201
    executed = executed_response.json()
    pipeline = repository.get_aigc_pipeline(executed["id"])
    run = AigcPipelineRun(
        pipeline_id=pipeline.id,
        run_number=1,
        pipeline_revision=pipeline.revision,
        mode="full",
        definition_snapshot=pipeline.definition,
    )
    run_detail = repository.create_aigc_run(
        run,
        idempotency_key="delete-conflict-run",
        nodes=[
            AigcPipelineRunNode(
                node_id=node.id,
                included_in_plan=node.id == "model",
                status=(
                    AigcRunNodeStatus.READY
                    if node.id == "model"
                    else AigcRunNodeStatus.SUCCEEDED
                ),
            )
            for node in pipeline.definition.nodes
        ],
    )
    task = repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=pipeline.id,
            run_id=run_detail.run.id,
            node_id="model",
            type=AigcTaskType.TEXT_TO_IMAGE,
        ),
        idempotency_key="api-protected-attempt",
    )
    result = AigcTaskResult(
        kind=AigcResultKind.ASSETS,
        assets=[
            AigcResultAsset(
                asset_id=result_asset.id,
                ordinal=0,
                mime_type=result_asset.mime_type,
            )
        ],
    )
    repository.update_aigc_task_attempt(
        task.task_id,
        status=AigcTaskStatus.SUCCEEDED,
        progress=100,
        result=result,
    )
    repository.add_aigc_task_assets(
        [
            AigcPipelineTaskAssetReference(
                task_id=task.task_id,
                direction=AigcAssetDirection.OUTPUT,
                slot="image",
                ordinal=0,
                asset_id=result_asset.id,
            )
        ]
    )
    repository.update_aigc_run(
        run_detail.run.id,
        status=AigcPipelineRunStatus.SUCCEEDED,
    )
    run_before = repository.get_aigc_run(run_detail.run.id)
    task_before = repository.get_aigc_task_attempt(task.task_id)
    associations_before = repository.list_aigc_task_assets(task.task_id)
    result_asset_before = repository.get_asset(result_asset.id)

    archived = aigc_client.delete(
        f"/api/aigc/pipelines/{executed['id']}"
    )
    assert archived.status_code == 204
    assert archived.content == b""
    assert aigc_client.get(
        f"/api/aigc/pipelines/{executed['id']}"
    ).status_code == 404
    listed = aigc_client.get("/api/aigc/pipelines").json()
    assert executed["id"] not in {item["id"] for item in listed["items"]}
    run_after = repository.get_aigc_run(run_detail.run.id)
    assert run_after.run == run_before.run
    assert run_after.nodes == run_before.nodes
    assert repository.get_aigc_task_attempt(task.task_id) == task_before
    assert repository.list_aigc_task_assets(task.task_id) == associations_before
    assert repository.get_asset(result_asset.id) == result_asset_before

    active_response = aigc_client.post(
        "/api/aigc/pipelines",
        json={"name": "活动运行画布", "definition": definition()},
    )
    active_pipeline = repository.get_aigc_pipeline(active_response.json()["id"])
    repository.create_aigc_run(
        AigcPipelineRun(
            pipeline_id=active_pipeline.id,
            run_number=1,
            pipeline_revision=active_pipeline.revision,
            mode="full",
            definition_snapshot=active_pipeline.definition,
        ),
        idempotency_key="active-delete-conflict",
        nodes=[
            AigcPipelineRunNode(
                node_id=node.id,
                included_in_plan=node.id == "model",
                status=AigcRunNodeStatus.READY,
            )
            for node in active_pipeline.definition.nodes
        ],
    )

    conflict = aigc_client.delete(
        f"/api/aigc/pipelines/{active_pipeline.id}"
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"] == {
        "code": "invalid_state",
        "message": "AIGC pipeline has an active run",
    }


def test_internal_layer_assets_require_exact_pipeline_run_reference_and_sign_url(
    aigc_client_and_repository: tuple[
        TestClient,
        InMemoryRepository | MySQLRepository,
    ],
) -> None:
    aigc_client, repository = aigc_client_and_repository
    pipeline = aigc_client.post(
        "/api/aigc/pipelines",
        json={"name": "17 层工作流", "definition": definition()},
    ).json()
    other_pipeline = aigc_client.post(
        "/api/aigc/pipelines",
        json={"name": "其他工作流", "definition": definition()},
    ).json()
    persisted = repository.get_aigc_pipeline(pipeline["id"])
    run_detail = repository.create_aigc_run(
        AigcPipelineRun(
            pipeline_id=persisted.id,
            run_number=1,
            pipeline_revision=persisted.revision,
            mode="full",
            definition_snapshot=persisted.definition,
        ),
        idempotency_key="internal-layer-access",
        nodes=[
            AigcPipelineRunNode(
                node_id=node.id,
                included_in_plan=node.id == "model",
            )
            for node in persisted.definition.nodes
        ],
    )
    task = repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=persisted.id,
            run_id=run_detail.run.id,
            node_id="model",
            type=AigcTaskType.TEXT_TO_IMAGE,
        ),
        idempotency_key="internal-layer-assets",
    )
    assets = repository.create_assets(
        [
            AssetCreate(
                tool_asset_role=ToolAssetRole.OUTPUT,
                type=AssetType.GENERATED_IMAGE,
                asset_role=AssetRole.INTERNAL_LAYER,
                status=Status.SUCCEEDED,
                object_key=f"aigc/layer-{index}.png",
                mime_type="image/png",
                metadata={"aigc_role": "layer_base" if index == 0 else "layer"},
            )
            for index in range(17)
        ]
    )
    layer_set = AigcLayerSet(
        id="layer-set-17",
        source_asset_id="source-asset",
        base_asset_id=assets[0].id,
        canvas_width=2048,
        canvas_height=2048,
        version=0,
        digest="a" * 64,
        layers=[
            AigcLayer(
                id=f"layer-{index}",
                asset_id=asset.id,
                z_index=index,
                name=f"图层 {index}",
                bbox_absolute=(0, 0, 512, 512),
                bbox_normalized=(0, 0, 250, 250),
                x=0,
                y=0,
            )
            for index, asset in enumerate(assets[1:], start=1)
        ],
    )
    result = AigcTaskResult(
        kind=AigcResultKind.LAYER_SET,
        layer_set=layer_set,
    )
    repository.update_aigc_task_attempt(
        task.task_id,
        status=AigcTaskStatus.SUCCEEDED,
        progress=100,
        result=result,
    )
    repository.update_aigc_run_node(
        run_detail.run.id,
        "model",
        status=AigcRunNodeStatus.SUCCEEDED,
        result=result,
    )
    repository.add_aigc_task_assets(
        [
            AigcPipelineTaskAssetReference(
                task_id=task.task_id,
                direction=AigcAssetDirection.OUTPUT,
                slot="base" if index == 0 else "layers",
                ordinal=max(0, index - 1),
                asset_id=asset.id,
            )
            for index, asset in enumerate(assets)
        ]
    )
    unreferenced = repository.create_asset(
        AssetCreate(
            tool_asset_role=ToolAssetRole.OUTPUT,
            type=AssetType.GENERATED_IMAGE,
            asset_role=AssetRole.INTERNAL_LAYER,
            status=Status.SUCCEEDED,
            object_key="aigc/unreferenced.png",
            mime_type="image/png",
        )
    )

    run_response = aigc_client.get(f"/api/aigc/runs/{run_detail.run.id}")
    model_node = next(
        node for node in run_response.json()["nodes"] if node["node_id"] == "model"
    )
    assert len(model_node["result"]["layer_set"]["layers"]) == 16

    authorized = aigc_client.get(
        f"/api/aigc/pipelines/{persisted.id}/runs/{run_detail.run.id}"
        f"/assets/{assets[0].id}"
    )
    assert authorized.status_code == 200
    assert authorized.json()["url"].startswith(
        "https://local-assets.tos.local/aigc/layer-0.png?"
    )
    assert "X-Tos-Signature=test" in authorized.json()["url"]

    for path in (
        f"/api/aigc/pipelines/{other_pipeline['id']}/runs/{run_detail.run.id}"
        f"/assets/{assets[0].id}",
        f"/api/aigc/pipelines/{persisted.id}/runs/missing-run"
        f"/assets/{assets[0].id}",
        f"/api/aigc/pipelines/{persisted.id}/runs/{run_detail.run.id}"
        f"/assets/{unreferenced.id}",
    ):
        response = aigc_client.get(path)
        assert response.status_code == 404
        assert response.json()["detail"]["code"] == "not_found"

    assert aigc_client.get(f"/api/assets/{assets[0].id}").status_code == 404
    assert assets[0].id not in {
        item["id"] for item in aigc_client.get("/api/assets").json()
    }


def test_pipeline_update_conflict_and_save_as_template(
    aigc_client: TestClient,
) -> None:
    pipeline = aigc_client.post(
        "/api/aigc/pipelines",
        json={"name": "我的画布", "definition": definition()},
    ).json()
    update_payload = {
        "name": "我的画布 v2",
        "description": "",
        "definition": definition(text="新提示词"),
        "expected_revision": 0,
    }
    update_response = aigc_client.put(
        f"/api/aigc/pipelines/{pipeline['id']}",
        json=update_payload,
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["revision"] == 1

    persisted = aigc_client.get(f"/api/aigc/pipelines/{pipeline['id']}")
    assert persisted.status_code == 200
    assert persisted.json()["revision"] == 1
    assert persisted.json()["definition"] == updated["definition"]
    assert persisted.json()["definition"]["nodes"][0]["config"]["text"] == "新提示词"

    conflict = aigc_client.put(
        f"/api/aigc/pipelines/{pipeline['id']}",
        json=update_payload,
    )
    assert conflict.status_code == 409

    template_response = aigc_client.post(
        f"/api/aigc/pipelines/{pipeline['id']}/templates",
        json={"name": "我的模板", "description": "来自画布"},
    )
    assert template_response.status_code == 201
    assert template_response.json()["name"] == "我的模板"


def test_aigc_image_upload_validates_content_and_marks_origin(
    aigc_client: TestClient,
) -> None:
    asset = upload_image(aigc_client)

    assert asset["tool_asset_role"] == "input"
    assert asset["metadata"]["origin"] == "aigc"
    assert asset["metadata"]["aigc_role"] == "input"
    assert asset["metadata"]["inspection_version"] == 1
    assert asset["metadata"]["width"] == 1024
    assert asset["metadata"]["height"] == 1024
    assert asset["url"].startswith("/api/assets/")

    invalid = aigc_client.post(
        "/api/aigc/assets/images",
        params={"filename": "fake.png", "mime_type": "image/png"},
        content=b"not-a-png",
        headers={"content-type": "application/octet-stream"},
    )
    assert invalid.status_code == 422


def test_aigc_video_and_audio_upload_validate_type_and_mark_origin(
    aigc_client: TestClient,
    video_normalizer,
) -> None:
    async def normalize(content: bytes) -> NormalizedVideo:
        assert content == b"quicktime-video"
        return NormalizedVideo(
            content=b"normalized-mp4",
            normalized=True,
            source_format="mov",
        )

    video_normalizer.normalize_if_needed = normalize
    video = aigc_client.post(
        "/api/aigc/assets/videos",
        params={"filename": "source.mov", "mime_type": "video/quicktime"},
        content=b"quicktime-video",
        headers={"content-type": "application/octet-stream"},
    )
    audio = aigc_client.post(
        "/api/aigc/assets/audios",
        params={"filename": "voice.mp3", "mime_type": "audio/mpeg"},
        content=b"audio-content",
        headers={"content-type": "application/octet-stream"},
    )

    assert video.status_code == 201
    assert video.json()["type"] == "uploaded_video"
    assert video.json()["mime_type"] == "video/mp4"
    assert video.json()["metadata"]["origin"] == "aigc"
    assert video.json()["metadata"]["aigc_role"] == "input"
    assert video.json()["metadata"]["original_filename"] == "source.mov"
    assert video.json()["metadata"]["duration_seconds"] == 10
    assert video.json()["metadata"]["fps"] == 30
    assert video.json()["metadata"]["video_codec"] == "h264"
    assert audio.status_code == 201
    assert audio.json()["type"] == "uploaded_audio"
    assert audio.json()["mime_type"] == "audio/mpeg"
    assert audio.json()["metadata"]["origin"] == "aigc"
    assert audio.json()["metadata"]["aigc_role"] == "input"
    assert audio.json()["metadata"]["duration_seconds"] == 10
    assert audio.json()["metadata"]["audio_codec"] == "mp3"

    mismatch = aigc_client.post(
        "/api/aigc/assets/audios",
        params={"filename": "fake.mp4", "mime_type": "video/mp4"},
        content=b"video",
        headers={"content-type": "application/octet-stream"},
    )
    assert mismatch.status_code == 422


def test_template_canonicalization_scrubs_all_media_input_assets(
    aigc_client: TestClient,
) -> None:
    response = aigc_client.post(
        "/api/aigc/templates",
        json={
            "name": "多媒体模板",
            "definition": definition(
                image_asset_id="image-asset",
                video_asset_id="video-asset",
                audio_asset_id="audio-asset",
            ),
        },
    )

    assert response.status_code == 201
    template = response.json()
    media_nodes = {
        node["type"]: node
        for node in template["definition"]["nodes"]
        if node["type"] in {"image_input", "video_input", "audio_input"}
    }
    assert {
        node_type: node["config"]["asset_id"]
        for node_type, node in media_nodes.items()
    } == {
        "image_input": None,
        "video_input": None,
        "audio_input": None,
    }

    updated = aigc_client.put(
        f"/api/aigc/templates/{template['id']}",
        json={
            "name": "多媒体模板 v2",
            "definition": definition(
                video_asset_id="replacement-video",
                audio_asset_id="replacement-audio",
            ),
            "expected_revision": 0,
        },
    )
    assert updated.status_code == 200
    assert all(
        node["config"]["asset_id"] is None
        for node in updated.json()["definition"]["nodes"]
        if node["type"] in {"video_input", "audio_input"}
    )

    instantiated = aigc_client.post(
        f"/api/aigc/templates/{template['id']}/instantiate",
        json={},
    )
    assert instantiated.status_code == 201
    assert all(
        node["config"]["asset_id"] is None
        for node in instantiated.json()["definition"]["nodes"]
        if node["type"] in {"video_input", "audio_input"}
    )


def test_aigc_pipeline_asset_reference_returns_delete_conflict(
    aigc_client: TestClient,
) -> None:
    asset = upload_image(aigc_client)
    pipeline = aigc_client.post(
        "/api/aigc/pipelines",
        json={
            "name": "引用保护",
            "description": "",
            "definition": definition(image_asset_id=asset["id"]),
            "source_template_id": None,
            "source_template_revision": None,
        },
    ).json()

    conflict = aigc_client.delete(f"/api/tools/assets/{asset['id']}")

    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "invalid_state"
    assert pipeline["id"] in conflict.json()["detail"]["message"]


def test_run_api_requires_idempotency_and_exposes_run_detail(
    aigc_client: TestClient,
) -> None:
    pipeline = aigc_client.post(
        "/api/aigc/pipelines",
        json={
            "name": "LLM 运行",
            "definition": {
                "schemaVersion": 1,
                "nodes": [
                    {
                        "id": "input",
                        "type": "text_input",
                        "position": {"x": 0, "y": 0},
                        "size": {"width": 240, "height": 160},
                        "config": {"text": "优化卖点"},
                    },
                    {
                        "id": "llm",
                        "type": "llm",
                        "position": {"x": 320, "y": 0},
                        "size": {"width": 280, "height": 200},
                        "config": {},
                    },
                ],
                "edges": [
                    {
                        "id": "edge-1",
                        "sourceNodeId": "input",
                        "sourceHandle": "text",
                        "targetNodeId": "llm",
                        "targetHandle": "prompt",
                    }
                ],
                "viewport": {"x": 0, "y": 0, "zoom": 1},
            },
        },
    ).json()

    missing_header = aigc_client.post(
        f"/api/aigc/pipelines/{pipeline['id']}/runs",
        json={"expected_revision": 0, "mode": "full"},
    )
    assert missing_header.status_code == 422

    created = aigc_client.post(
        f"/api/aigc/pipelines/{pipeline['id']}/runs",
        json={"expected_revision": 0, "mode": "full"},
        headers={"Idempotency-Key": "api-run-1"},
    )
    assert created.status_code == 202
    run_id = created.json()["run"]["id"]

    detail = None
    for _ in range(30):
        response = aigc_client.get(f"/api/aigc/runs/{run_id}")
        assert response.status_code == 200
        detail = response.json()
        if detail["run"]["status"] not in {"queued", "running"}:
            break
        time.sleep(0.02)

    assert detail is not None
    assert detail["run"]["status"] == "succeeded"
    assert detail["nodes"][1]["attempts"][0]["attempt"] == 1

    duplicate = aigc_client.post(
        f"/api/aigc/pipelines/{pipeline['id']}/runs",
        json={"expected_revision": 0, "mode": "full"},
        headers={"Idempotency-Key": "api-run-1"},
    )
    assert duplicate.status_code == 202
    assert duplicate.json()["run"]["id"] == run_id

    history = aigc_client.get(f"/api/aigc/pipelines/{pipeline['id']}/runs")
    assert history.status_code == 200
    assert history.json()["total"] == 1


def test_run_api_rejects_non_executable_graph(
    aigc_client: TestClient,
) -> None:
    pipeline = aigc_client.post(
        "/api/aigc/pipelines",
        json={
            "name": "无模型画布",
            "definition": {
                "schemaVersion": 1,
                "nodes": [
                    {
                        "id": "input",
                        "type": "text_input",
                        "position": {"x": 0, "y": 0},
                        "size": {"width": 240, "height": 160},
                        "config": {"text": "only input"},
                    }
                ],
                "edges": [],
                "viewport": {"x": 0, "y": 0, "zoom": 1},
            },
        },
    ).json()

    response = aigc_client.post(
        f"/api/aigc/pipelines/{pipeline['id']}/runs",
        json={"expected_revision": 0, "mode": "full"},
        headers={"Idempotency-Key": "invalid-run"},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"
