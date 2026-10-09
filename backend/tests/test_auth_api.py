from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi import Response
from fastapi.testclient import TestClient

import backend.app.main as main_module
from backend.app.api.auth_routes import _set_session_cookie
from backend.app.api.dependencies import get_aigc_pipeline_runtime, get_repository
from backend.app.core.config import Settings, get_settings
from backend.app.main import create_app
from backend.app.repositories import InMemoryRepository
from backend.app.schemas.auth import AuthSession, UserPublic, UserRole
from backend.app.schemas.common import utc_now
from backend.app.services.auth import AuthenticatedSession

ADMIN_PASSWORD = "correct horse battery staple"


class _NoopRuntime:
    async def start(self) -> bool:
        return True

    async def stop(self) -> None:
        return None


def _setup(client: TestClient, username: str = "admin") -> dict[str, object]:
    response = client.post(
        "/api/auth/setup",
        json={
            "username": username,
            "display_name": "System Admin",
            "password": ADMIN_PASSWORD,
        },
    )
    assert response.status_code == 201
    return response.json()


@pytest.mark.parametrize(
    "client_fixture",
    ["anonymous_client", "mysql_anonymous_client"],
)
def test_setup_login_logout_and_cookie_contract(
    request: pytest.FixtureRequest,
    client_fixture: str,
) -> None:
    client: TestClient = request.getfixturevalue(client_fixture)

    assert client.get("/api/auth/setup-status").json() == {"initialized": False}
    admin = _setup(client)
    cookie = client.cookies.get("ad_session")
    set_cookie = (
        client.post(
            "/api/auth/login",
            json={"username": "ADMIN", "password": ADMIN_PASSWORD},
        )
        .headers["set-cookie"]
        .lower()
    )

    assert admin["username"] == "admin"
    assert cookie is not None
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/" in set_cookie
    assert client.get("/api/auth/setup-status").json() == {"initialized": True}
    assert (
        client.post(
            "/api/auth/setup",
            json={
                "username": "other-admin",
                "display_name": "Other",
                "password": "another secure password",
            },
        ).status_code
        == 409
    )
    assert client.get("/api/auth/me").status_code == 200

    logout = client.post("/api/auth/logout")

    assert logout.status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_login_failure_is_generic_and_rate_limited(
    anonymous_client: TestClient,
) -> None:
    client = anonymous_client
    _setup(client)
    client.post("/api/auth/logout")

    unknown = client.post(
        "/api/auth/login",
        json={"username": "unknown", "password": "wrong password"},
    )
    wrong = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong password"},
    )
    for _ in range(4):
        client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "wrong password"},
        )
    limited = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": ADMIN_PASSWORD},
    )

    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["detail"]["message"] == wrong.json()["detail"]["message"]
    assert limited.status_code == 429
    assert limited.json()["detail"]["message"] == wrong.json()["detail"]["message"]


def test_admin_user_management_and_forced_password_change(
    anonymous_client: TestClient,
) -> None:
    client = anonymous_client
    admin = _setup(client)
    created = client.post(
        "/api/admin/users",
        json={
            "username": "Creator.One",
            "display_name": "Creator One",
            "password": "temporary password 123",
            "role": "creator",
        },
    )

    assert created.status_code == 201
    creator = created.json()
    assert creator["username"] == "creator.one"
    assert creator["must_change_password"] is True
    assert "password_hash" not in creator
    assert len(client.get("/api/admin/users").json()) == 2

    client.post("/api/auth/logout")
    login = client.post(
        "/api/auth/login",
        json={
            "username": "creator.one",
            "password": "temporary password 123",
        },
    )
    old_cookie = client.cookies.get("ad_session")

    assert login.status_code == 200
    assert client.get("/api/auth/me").status_code == 200
    assert client.get("/api/admin/users").status_code == 403

    changed = client.post(
        "/api/auth/change-password",
        json={
            "current_password": "temporary password 123",
            "new_password": "creator permanent password",
        },
    )

    assert changed.status_code == 200
    assert changed.json()["must_change_password"] is False
    assert client.cookies.get("ad_session") != old_cookie

    client.post("/api/auth/logout")
    client.post(
        "/api/auth/login",
        json={"username": "admin", "password": ADMIN_PASSWORD},
    )
    role_update = client.patch(
        f"/api/admin/users/{creator['id']}/role",
        json={"role": "viewer"},
    )
    status_update = client.patch(
        f"/api/admin/users/{creator['id']}/status",
        json={"is_enabled": False},
    )
    reset = client.post(
        f"/api/admin/users/{creator['id']}/reset-password",
        json={"password": "replacement password 123"},
    )
    last_admin = client.patch(
        f"/api/admin/users/{admin['id']}/status",
        json={"is_enabled": False},
    )

    assert role_update.json()["role"] == "viewer"
    assert status_update.json()["is_enabled"] is False
    assert reset.json()["must_change_password"] is True
    assert last_admin.status_code == 409


def test_state_changing_request_rejects_cross_origin(
    anonymous_client: TestClient,
) -> None:
    response = anonymous_client.post(
        "/api/auth/setup",
        headers={"Origin": "https://attacker.example"},
        json={
            "username": "admin",
            "display_name": "Admin",
            "password": ADMIN_PASSWORD,
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "origin_forbidden"
    assert anonymous_client.get("/api/auth/setup-status").json() == {
        "initialized": False
    }


def test_production_wildcard_cors_allows_cross_origin_write_when_enabled(
    anonymous_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = anonymous_client.app.state.settings
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "cors_origins", ["*"])
    monkeypatch.setattr(settings, "allow_insecure_cors", True)
    monkeypatch.setattr(settings, "site_origin", "https://app.example.com")
    monkeypatch.setattr(settings, "auth_cookie_secure", True)

    response = anonymous_client.post(
        "/api/auth/setup",
        headers={"Origin": "https://attacker.example"},
        json={
            "username": "admin",
            "display_name": "Admin",
            "password": ADMIN_PASSWORD,
        },
    )

    assert response.status_code == 201
    assert response.headers["access-control-allow-origin"] == "*"
    assert "access-control-allow-credentials" not in response.headers


def test_explicit_cors_origins_still_reject_cross_origin_write(
    anonymous_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = anonymous_client.app.state.settings
    monkeypatch.setattr(settings, "cors_origins", ["http://localhost:3000"])
    monkeypatch.setattr(settings, "allow_insecure_cors", True)

    response = anonymous_client.post(
        "/api/auth/setup",
        headers={"Origin": "https://attacker.example"},
        json={
            "username": "admin",
            "display_name": "Admin",
            "password": ADMIN_PASSWORD,
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "origin_forbidden"
    assert anonymous_client.get("/api/auth/setup-status").json() == {
        "initialized": False
    }


def test_state_changing_request_requires_origin_or_referer(
    anonymous_client: TestClient,
) -> None:
    anonymous_client.headers.pop("Origin")

    response = anonymous_client.post(
        "/api/auth/setup",
        json={
            "username": "admin",
            "display_name": "Admin",
            "password": ADMIN_PASSWORD,
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "origin_forbidden"


def test_same_origin_referer_is_allowed(anonymous_client: TestClient) -> None:
    anonymous_client.headers.pop("Origin")

    response = anonymous_client.post(
        "/api/auth/setup",
        headers={"Referer": "http://localhost:3000/setup?next=%2Fworkspace"},
        json={
            "username": "admin",
            "display_name": "Admin",
            "password": ADMIN_PASSWORD,
        },
    )

    assert response.status_code == 201


def test_same_origin_is_allowed(anonymous_client: TestClient) -> None:
    response = anonymous_client.post(
        "/api/auth/setup",
        headers={"Origin": "http://localhost:3000"},
        json={
            "username": "admin",
            "display_name": "Admin",
            "password": ADMIN_PASSWORD,
        },
    )

    assert response.status_code == 201


def test_invalid_session_cookie_is_cleared(anonymous_client: TestClient) -> None:
    client = anonymous_client
    client.cookies.set("ad_session", "invalid-token")

    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert 'ad_session=""' in response.headers["set-cookie"]
    assert "max-age=0" in response.headers["set-cookie"].lower()


def test_wrong_current_password_does_not_clear_valid_session(
    anonymous_client: TestClient,
) -> None:
    client = anonymous_client
    _setup(client)
    session_cookie = client.cookies.get("ad_session")

    response = client.post(
        "/api/auth/change-password",
        json={
            "current_password": "wrong current password",
            "new_password": "a different secure password",
        },
    )

    assert response.status_code == 401
    assert client.cookies.get("ad_session") == session_cookie
    assert client.get("/api/auth/me").status_code == 200


def test_production_session_cookie_is_secure() -> None:
    now = utc_now()
    response = Response()
    _set_session_cookie(
        response,
        AuthenticatedSession(
            user=UserPublic(
                id="user-1",
                username="admin",
                display_name="Admin",
                role=UserRole.ADMIN,
                is_enabled=True,
                must_change_password=False,
                created_at=now,
                updated_at=now,
                last_login_at=now,
            ),
            token="session-token",
            session=AuthSession(
                user_id="user-1",
                token_digest="d" * 64,
                idle_expires_at=now + timedelta(hours=12),
                absolute_expires_at=now + timedelta(days=7),
            ),
        ),
        Settings(
            environment="production",
            cors_origins=["https://app.example.com"],
            site_origin="https://app.example.com",
            auth_cookie_secure=True,
        ),
    )

    set_cookie = response.headers["set-cookie"].lower()
    assert "secure" in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie


def test_explicit_insecure_production_session_cookie_keeps_safe_attributes() -> None:
    now = utc_now()
    response = Response()
    authenticated = AuthenticatedSession(
        user=UserPublic(
            id="user-1",
            username="admin",
            display_name="Admin",
            role=UserRole.ADMIN,
            is_enabled=True,
            must_change_password=False,
            created_at=now,
            updated_at=now,
            last_login_at=now,
        ),
        token="session-token",
        session=AuthSession(
            user_id="user-1",
            token_digest="d" * 64,
            idle_expires_at=now + timedelta(hours=12),
            absolute_expires_at=now + timedelta(days=7),
        ),
    )
    _set_session_cookie(
        response,
        authenticated,
        Settings(
            environment="production",
            cors_origins=["*"],
            allow_insecure_cors=True,
            allow_insecure_auth_cookie=True,
            auth_cookie_secure=False,
        ),
    )

    set_cookie = response.headers["set-cookie"].lower()
    assert "secure" not in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/" in set_cookie


def test_explicit_insecure_mode_clears_invalid_cookie_without_secure_attribute(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(
        environment="production",
        cors_origins=["*"],
        allow_insecure_cors=True,
        allow_insecure_auth_cookie=True,
        auth_cookie_secure=False,
    )
    monkeypatch.setattr(main_module, "get_settings", lambda: settings)
    app = create_app()
    app.dependency_overrides[get_aigc_pipeline_runtime] = _NoopRuntime
    app.dependency_overrides[get_repository] = InMemoryRepository
    app.dependency_overrides[get_settings] = lambda: settings

    with TestClient(app) as client:
        client.cookies.set("ad_session", "invalid-token")
        response = client.get("/api/auth/me")

    assert response.status_code == 401
    set_cookie = response.headers["set-cookie"].lower()
    assert 'ad_session=""' in set_cookie
    assert "secure" not in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/" in set_cookie
