from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app.repositories import Repository, RevisionConflictError
from backend.app.schemas import CanvasLayout, CanvasNode, ProjectCreate


def _image_project() -> ProjectCreate:
    return ProjectCreate.model_validate(
        {
            "name": "Canvas project",
            "project_type": "image_asset",
            "brief": {
                "prompt": "Create a product image",
                "product_name": "Canvas product",
                "audience": "designers",
                "selling_points": ["editable"],
                "target_platform": "tmall",
                "aspect_ratio": "1:1",
                "target_language": "zh",
                "image_purpose": "ecommerce_main",
            },
        }
    )


def _create_image_project(client: TestClient) -> str:
    response = client.post(
        "/api/projects",
        json=_image_project().model_dump(mode="json"),
    )
    assert response.status_code == 201
    return response.json()["id"]


def _reference_node(node_id: str = "ref-1", order_index: int = 1) -> dict[str, object]:
    return {
        "id": node_id,
        "kind": "reference",
        "x": -10.5,
        "y": 20.0,
        "width": 320.0,
        "height": 240.0,
        "z": 0,
        "asset_id": "asset-1",
        "order_index": order_index,
        "bbox": {"type": "bbox", "x1": 0, "y1": 0, "x2": 100, "y2": 100},
    }


def _output_node(node_id: str = "out-1") -> dict[str, object]:
    return {
        "id": node_id,
        "kind": "output",
        "x": 400.0,
        "y": 0.0,
        "width": 512.0,
        "height": 512.0,
        "z": 1,
        "task_id": "task-1",
        "source": "text_to_image",
    }


def test_get_default_empty_canvas_layout(client: TestClient) -> None:
    project_id = _create_image_project(client)

    response = client.get(f"/api/projects/{project_id}/canvas-layout")

    assert response.status_code == 200
    body = response.json()
    assert body["project_id"] == project_id
    assert body["nodes"] == []
    assert body["revision"] == 0


def test_save_then_read_canvas_layout(client: TestClient) -> None:
    project_id = _create_image_project(client)
    nodes = [_reference_node(), _output_node()]

    saved = client.put(
        f"/api/projects/{project_id}/canvas-layout",
        json={"expected_revision": 0, "nodes": nodes},
    )

    assert saved.status_code == 200
    saved_body = saved.json()
    assert saved_body["revision"] == 1
    assert [node["id"] for node in saved_body["nodes"]] == ["ref-1", "out-1"]

    read = client.get(f"/api/projects/{project_id}/canvas-layout")
    assert read.status_code == 200
    read_body = read.json()
    assert read_body["revision"] == 1
    assert read_body["nodes"] == saved_body["nodes"]


def test_canvas_layout_revision_increments(client: TestClient) -> None:
    project_id = _create_image_project(client)

    first = client.put(
        f"/api/projects/{project_id}/canvas-layout",
        json={"expected_revision": 0, "nodes": [_reference_node()]},
    )
    assert first.status_code == 200
    assert first.json()["revision"] == 1

    second = client.put(
        f"/api/projects/{project_id}/canvas-layout",
        json={"expected_revision": 1, "nodes": [_reference_node(), _output_node()]},
    )
    assert second.status_code == 200
    assert second.json()["revision"] == 2


def test_canvas_layout_conflict_does_not_overwrite(client: TestClient) -> None:
    project_id = _create_image_project(client)
    client.put(
        f"/api/projects/{project_id}/canvas-layout",
        json={"expected_revision": 0, "nodes": [_reference_node()]},
    )

    conflict = client.put(
        f"/api/projects/{project_id}/canvas-layout",
        json={"expected_revision": 0, "nodes": [_output_node()]},
    )
    assert conflict.status_code == 409

    read = client.get(f"/api/projects/{project_id}/canvas-layout")
    body = read.json()
    assert body["revision"] == 1
    assert [node["id"] for node in body["nodes"]] == ["ref-1"]


def test_canvas_layout_rejects_reference_node_missing_fields(client: TestClient) -> None:
    project_id = _create_image_project(client)
    invalid_node = _reference_node()
    del invalid_node["asset_id"]

    response = client.put(
        f"/api/projects/{project_id}/canvas-layout",
        json={"expected_revision": 0, "nodes": [invalid_node]},
    )
    assert response.status_code == 422


def test_canvas_layout_rejects_duplicate_node_ids(client: TestClient) -> None:
    project_id = _create_image_project(client)

    response = client.put(
        f"/api/projects/{project_id}/canvas-layout",
        json={
            "expected_revision": 0,
            "nodes": [_reference_node("dup"), _output_node("dup")],
        },
    )
    assert response.status_code == 422


def test_canvas_node_schema_requires_output_reference() -> None:
    with pytest.raises(ValidationError):
        CanvasNode.model_validate(
            {
                "id": "out",
                "kind": "output",
                "x": 0,
                "y": 0,
                "width": 10,
                "height": 10,
                "z": 0,
            }
        )


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_canvas_layout_repository_default_save_and_conflict(
    repository_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    repository: Repository = request.getfixturevalue(repository_fixture)
    project = repository.create_project(_image_project())

    default = repository.get_canvas_layout(project.id)
    assert isinstance(default, CanvasLayout)
    assert default.nodes == []
    assert default.revision == 0

    nodes = [
        CanvasNode.model_validate(_reference_node()),
        CanvasNode.model_validate(_output_node()),
    ]
    saved = repository.save_canvas_layout(
        project.id,
        expected_revision=0,
        nodes=nodes,
    )
    assert saved.revision == 1
    assert [node.id for node in saved.nodes] == ["ref-1", "out-1"]

    reread = repository.get_canvas_layout(project.id)
    assert reread.revision == 1
    assert reread.nodes == saved.nodes

    with pytest.raises(RevisionConflictError):
        repository.save_canvas_layout(
            project.id,
            expected_revision=0,
            nodes=[],
        )

    unchanged = repository.get_canvas_layout(project.id)
    assert unchanged.revision == 1
    assert [node.id for node in unchanged.nodes] == ["ref-1", "out-1"]
