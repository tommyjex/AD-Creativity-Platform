from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from backend.app.api.dependencies import (
    get_asset_storage_service,
    get_background_task_runner,
    get_face_blur_video_client_factory,
    get_modelark_generation_service,
    require_admin,
    require_authenticated,
    require_business_access,
)
from backend.app.main import create_app
from backend.app.repositories import InMemoryRepository
from backend.app.schemas import Status, ToolTaskCreate, ToolTaskType
from backend.app.schemas.auth import UserRole
from backend.tests.auth_helpers import authenticate_test_client


@pytest.fixture(params=list(UserRole))
def role_client(
    request: pytest.FixtureRequest,
    anonymous_client: TestClient,
    repository: InMemoryRepository,
) -> Iterator[tuple[UserRole, TestClient]]:
    role = UserRole(request.param)
    authenticate_test_client(anonymous_client, repository, role=role)
    yield role, anonymous_client


def test_business_api_requires_authentication(
    anonymous_client: TestClient,
) -> None:
    response = anonymous_client.get("/api/projects")

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "authentication_required"


def test_forced_password_change_blocks_business_reads(
    anonymous_client: TestClient,
) -> None:
    setup = anonymous_client.post(
        "/api/auth/setup",
        json={
            "username": "admin",
            "display_name": "Admin",
            "password": "administrator password",
        },
    )
    assert setup.status_code == 201
    created = anonymous_client.post(
        "/api/admin/users",
        json={
            "username": "temporary-viewer",
            "display_name": "Temporary Viewer",
            "password": "temporary viewer password",
            "role": "viewer",
        },
    )
    assert created.status_code == 201
    anonymous_client.post("/api/auth/logout")
    login = anonymous_client.post(
        "/api/auth/login",
        json={
            "username": "temporary-viewer",
            "password": "temporary viewer password",
        },
    )
    assert login.status_code == 200

    response = anonymous_client.get("/api/projects")

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "password_change_required"


@pytest.mark.parametrize(
    ("method", "path", "json"),
    [
        ("post", "/api/projects", {"name": "Permission Matrix"}),
        ("patch", "/api/projects/missing", {"name": "Updated"}),
        ("delete", "/api/projects/missing", None),
        ("post", "/api/projects/missing/images", None),
        ("post", "/api/tasks/missing/retry", None),
        ("post", "/api/aigc/runs/missing/cancel", None),
    ],
)
def test_business_write_role_matrix(
    role_client: tuple[UserRole, TestClient],
    method: str,
    path: str,
    json: dict[str, object] | None,
) -> None:
    role, client = role_client

    response = client.request(method, path, json=json)

    if role == UserRole.VIEWER:
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "permission_denied"
    else:
        assert response.status_code not in {401, 403}


def test_viewer_is_rejected_before_write_side_effect_dependencies(
    anonymous_client: TestClient,
    repository: InMemoryRepository,
) -> None:
    authenticate_test_client(anonymous_client, repository, role=UserRole.VIEWER)
    dependency_calls: list[str] = []

    def unexpected_dependency(name: str):
        def fail():
            dependency_calls.append(name)
            raise AssertionError(f"viewer request resolved {name}")

        return fail

    anonymous_client.app.dependency_overrides[get_asset_storage_service] = (
        unexpected_dependency("object storage")
    )
    anonymous_client.app.dependency_overrides[get_modelark_generation_service] = (
        unexpected_dependency("model service")
    )
    anonymous_client.app.dependency_overrides[get_background_task_runner] = (
        unexpected_dependency("background task runner")
    )

    create = anonymous_client.post(
        "/api/projects",
        json={"name": "Viewer must not create"},
    )
    generate = anonymous_client.post(
        "/api/aigc/prompts/optimize",
        json={"prompt": "Viewer must not invoke a model"},
    )

    assert create.status_code == generate.status_code == 403
    assert repository.list_projects() == []
    assert dependency_calls == []


@pytest.mark.parametrize(
    "path",
    [
        "/api/projects",
        "/api/assets/missing/content",
        "/api/aigc/node-registry",
    ],
)
def test_business_read_and_download_role_matrix(
    role_client: tuple[UserRole, TestClient],
    path: str,
) -> None:
    _, client = role_client

    response = client.get(path)

    assert response.status_code not in {401, 403}


def test_viewer_tool_task_lookup_returns_repository_snapshot_without_refresh(
    anonymous_client: TestClient,
    repository: InMemoryRepository,
) -> None:
    task = repository.create_tool_task(
        ToolTaskCreate(
            type=ToolTaskType.FACE_BLUR_VIDEO,
            status=Status.RUNNING,
            provider_task_id="provider-task",
        )
    )
    authenticate_test_client(anonymous_client, repository, role=UserRole.VIEWER)

    class UnexpectedClient:
        async def get_task(self, *, task_id: str):
            raise AssertionError(
                f"viewer task lookup must not refresh provider task {task_id}"
            )

    client_factory_calls = 0

    def client_factory() -> UnexpectedClient:
        nonlocal client_factory_calls
        client_factory_calls += 1
        return UnexpectedClient()

    anonymous_client.app.dependency_overrides[get_face_blur_video_client_factory] = (
        lambda: client_factory
    )

    response = anonymous_client.get(f"/api/tools/tasks/{task.id}")

    assert response.status_code == 200
    assert response.json()["id"] == task.id
    assert response.json()["status"] == "running"
    assert repository.get_tool_task(task.id) == task
    assert client_factory_calls == 0


def test_every_api_route_declares_an_authentication_policy() -> None:
    app = create_app()
    anonymous = {
        ("GET", "/api/auth/setup-status"),
        ("POST", "/api/auth/setup"),
        ("POST", "/api/auth/login"),
    }
    authenticated_auth = {
        ("POST", "/api/auth/logout"),
        ("GET", "/api/auth/me"),
        ("POST", "/api/auth/change-password"),
    }

    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith("/api"):
            continue
        calls = {dependency.call for dependency in route.dependant.dependencies}
        for method in route.methods:
            key = (method, route.path)
            if key in anonymous:
                continue
            if key in authenticated_auth:
                assert require_authenticated in calls, key
            elif route.path.startswith("/api/admin/"):
                assert require_admin in calls, key
            else:
                assert require_business_access in calls, key
