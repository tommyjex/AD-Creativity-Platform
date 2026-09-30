from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from argon2 import PasswordHasher

from backend.app.core.config import Settings
from backend.app.repositories import InMemoryRepository
from backend.app.schemas.auth import (
    ChangePasswordRequest,
    CreateUserRequest,
    LoginRequest,
    SetupRequest,
    UserRole,
)
from backend.app.services.auth import (
    AUTHENTICATION_FAILED_MESSAGE,
    AuthenticationError,
    AuthService,
    LoginRateLimitedError,
)


class MutableClock:
    def __init__(self) -> None:
        self.now = datetime(2026, 9, 29, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def auth_context() -> tuple[InMemoryRepository, AuthService, MutableClock]:
    repository = InMemoryRepository()
    clock = MutableClock()
    service = AuthService(
        repository,
        Settings(),
        password_hasher=PasswordHasher(
            time_cost=1,
            memory_cost=1024,
            parallelism=1,
        ),
        clock=clock,
    )
    return repository, service, clock


def _setup(service: AuthService):
    return service.setup(
        SetupRequest(
            username="Admin.User",
            display_name="Admin User",
            password="correct horse battery staple",
        )
    )


def test_setup_hashes_password_and_only_persists_token_digest(
    auth_context,
) -> None:
    repository, service, _ = auth_context

    authenticated = _setup(service)
    stored_user = repository.get_user(authenticated.user.id)
    stored_session = repository.get_auth_session_by_digest(
        service.token_digest(authenticated.token)
    )

    assert stored_user.username == "admin.user"
    assert stored_user.password_hash.startswith("$argon2")
    assert "correct horse battery staple" not in stored_user.password_hash
    assert stored_session is not None
    assert stored_session.token_digest != authenticated.token


def test_login_uses_same_error_for_unknown_wrong_password_and_disabled_user(
    auth_context,
) -> None:
    _, service, _ = auth_context
    _setup(service)
    viewer = service.create_user(
        CreateUserRequest(
            username="viewer",
            display_name="Viewer",
            password="temporary password 123",
            role=UserRole.VIEWER,
        )
    )
    service.update_status(viewer.id, False)

    attempts = [
        LoginRequest(username="missing", password="not the right password"),
        LoginRequest(username="admin.user", password="not the right password"),
        LoginRequest(username="viewer", password="temporary password 123"),
    ]
    messages = []
    for attempt in attempts:
        with pytest.raises(AuthenticationError) as exc_info:
            service.login(attempt, source_ip="192.0.2.1")
        messages.append(str(exc_info.value))

    assert messages == [AUTHENTICATION_FAILED_MESSAGE] * 3


def test_login_rate_limit_blocks_attempt_after_five_failures(
    auth_context,
) -> None:
    _, service, _ = auth_context
    _setup(service)
    attempt = LoginRequest(username="admin.user", password="wrong password")

    for _ in range(5):
        with pytest.raises(AuthenticationError):
            service.login(attempt, source_ip="192.0.2.2")

    with pytest.raises(LoginRateLimitedError) as exc_info:
        service.login(attempt, source_ip="192.0.2.2")
    assert str(exc_info.value) == AUTHENTICATION_FAILED_MESSAGE


def test_successful_login_clears_failure_window(auth_context) -> None:
    repository, service, clock = auth_context
    _setup(service)
    source_ip = "192.0.2.3"
    for _ in range(2):
        with pytest.raises(AuthenticationError):
            service.login(
                LoginRequest(username="admin.user", password="wrong password"),
                source_ip=source_ip,
            )

    service.login(
        LoginRequest(
            username="admin.user",
            password="correct horse battery staple",
        ),
        source_ip=source_ip,
    )

    assert (
        repository.get_login_failure_count(
            "admin.user",
            service.source_digest(source_ip),
            window_started_after=clock.now - timedelta(minutes=15),
        )
        == 0
    )


def test_session_honors_idle_and_absolute_expiration(auth_context) -> None:
    _, service, clock = auth_context
    authenticated = _setup(service)

    clock.now += timedelta(hours=11)
    principal = service.authenticate(authenticated.token)
    assert principal is not None
    assert principal.session.idle_expires_at == clock.now + timedelta(hours=12)

    clock.now = authenticated.session.absolute_expires_at
    assert service.authenticate(authenticated.token) is None


def test_authentication_fails_if_session_is_revoked_during_activity_update(
    auth_context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository, service, clock = auth_context
    authenticated = _setup(service)
    original_touch = repository.touch_auth_session

    def revoke_then_touch(session_id: str, **kwargs):
        repository.revoke_auth_session(session_id, revoked_at=clock.now)
        return original_touch(session_id, **kwargs)

    monkeypatch.setattr(repository, "touch_auth_session", revoke_then_touch)

    assert service.authenticate(authenticated.token) is None


def test_password_change_revokes_old_session_and_rotates_current_session(
    auth_context,
) -> None:
    _, service, _ = auth_context
    authenticated = _setup(service)
    principal = service.authenticate(authenticated.token)
    assert principal is not None

    rotated = service.change_password(
        principal,
        ChangePasswordRequest(
            current_password="correct horse battery staple",
            new_password="a different secure password",
        ),
    )

    assert rotated.token != authenticated.token
    assert rotated.user.must_change_password is False
    assert service.authenticate(authenticated.token) is None
    assert service.authenticate(rotated.token) is not None


def test_role_change_and_disable_revoke_existing_sessions(auth_context) -> None:
    _, service, _ = auth_context
    _setup(service)
    user = service.create_user(
        CreateUserRequest(
            username="creator",
            display_name="Creator",
            password="temporary password 123",
            role=UserRole.CREATOR,
        )
    )
    login = service.login(
        LoginRequest(username="creator", password="temporary password 123"),
        source_ip="192.0.2.4",
    )

    service.update_role(user.id, UserRole.VIEWER)

    assert service.authenticate(login.token) is None
    second_login = service.login(
        LoginRequest(username="creator", password="temporary password 123"),
        source_ip="192.0.2.4",
    )
    service.update_status(user.id, False)
    assert service.authenticate(second_login.token) is None
