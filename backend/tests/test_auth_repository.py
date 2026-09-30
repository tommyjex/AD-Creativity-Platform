from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

import pytest

from backend.app.repositories import (
    InMemoryRepository,
    LastAdminError,
    MySQLRepository,
    NotFoundError,
    SetupCompletedError,
    UserConflictError,
)
from backend.app.schemas.auth import AuthSession, UserRecord, UserRole
from backend.app.schemas.common import utc_now


@pytest.fixture(params=["memory", "mysql"])
def auth_repository(
    request: pytest.FixtureRequest,
    repository: InMemoryRepository,
    mysql_repository: MySQLRepository,
) -> InMemoryRepository | MySQLRepository:
    return repository if request.param == "memory" else mysql_repository


def _user(
    username: str,
    *,
    role: UserRole = UserRole.CREATOR,
    enabled: bool = True,
) -> UserRecord:
    return UserRecord(
        username=username,
        display_name=username.title(),
        password_hash="$argon2id$test",
        role=role,
        is_enabled=enabled,
    )


def test_initial_admin_is_atomic_and_permanently_closes_setup(
    auth_repository: InMemoryRepository | MySQLRepository,
) -> None:
    admin = auth_repository.create_initial_admin(_user("admin", role=UserRole.ADMIN))

    assert admin.role == UserRole.ADMIN
    assert auth_repository.count_users() == 1
    with pytest.raises(SetupCompletedError):
        auth_repository.create_initial_admin(_user("second-admin", role=UserRole.ADMIN))


def test_concurrent_initialization_creates_only_one_admin(
    auth_repository: InMemoryRepository | MySQLRepository,
) -> None:
    barrier = Barrier(2)

    def initialize(username: str):
        barrier.wait()
        try:
            return auth_repository.create_initial_admin(
                _user(username, role=UserRole.ADMIN)
            )
        except SetupCompletedError as exc:
            return exc

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(initialize, ["first-admin", "second-admin"]))

    assert sum(isinstance(item, UserRecord) for item in outcomes) == 1
    assert sum(isinstance(item, SetupCompletedError) for item in outcomes) == 1
    assert auth_repository.count_users() == 1


def test_username_is_unique_after_normalization(
    auth_repository: InMemoryRepository | MySQLRepository,
) -> None:
    saved = auth_repository.create_user(_user(" Case.User "))

    with pytest.raises(UserConflictError):
        auth_repository.create_user(_user("case.user"))
    assert saved.username == "case.user"


def test_session_lifecycle_and_user_session_revocation(
    auth_repository: InMemoryRepository | MySQLRepository,
) -> None:
    user = auth_repository.create_user(_user("creator"))
    now = utc_now()
    first = AuthSession(
        user_id=user.id,
        token_digest="a" * 64,
        idle_expires_at=now + timedelta(hours=12),
        absolute_expires_at=now + timedelta(days=7),
    )
    second = AuthSession(
        user_id=user.id,
        token_digest="b" * 64,
        idle_expires_at=now + timedelta(hours=12),
        absolute_expires_at=now + timedelta(days=7),
    )
    auth_repository.create_auth_session(first)
    auth_repository.create_auth_session(second)

    touched = auth_repository.touch_auth_session(
        first.id,
        last_activity_at=now + timedelta(minutes=1),
        idle_expires_at=now + timedelta(hours=12, minutes=1),
    )
    auth_repository.revoke_user_sessions(
        user.id,
        revoked_at=now + timedelta(minutes=2),
        exclude_session_id=first.id,
    )

    assert touched.last_activity_at == now + timedelta(minutes=1)
    assert auth_repository.get_auth_session_by_digest("a" * 64).revoked_at is None
    assert auth_repository.get_auth_session_by_digest("b" * 64).revoked_at is not None


def test_session_touch_rejects_revoked_sessions_and_never_moves_activity_backward(
    auth_repository: InMemoryRepository | MySQLRepository,
) -> None:
    user = auth_repository.create_user(_user("session-owner"))
    now = utc_now()
    auth_session = AuthSession(
        user_id=user.id,
        token_digest="d" * 64,
        last_activity_at=now,
        idle_expires_at=now + timedelta(hours=12),
        absolute_expires_at=now + timedelta(days=7),
    )
    auth_repository.create_auth_session(auth_session)

    latest = auth_repository.touch_auth_session(
        auth_session.id,
        last_activity_at=now + timedelta(minutes=2),
        idle_expires_at=now + timedelta(hours=12, minutes=2),
    )
    stale = auth_repository.touch_auth_session(
        auth_session.id,
        last_activity_at=now + timedelta(minutes=1),
        idle_expires_at=now + timedelta(hours=12, minutes=1),
    )

    assert stale.last_activity_at == latest.last_activity_at
    assert stale.idle_expires_at == latest.idle_expires_at

    auth_repository.revoke_auth_session(
        auth_session.id,
        revoked_at=now + timedelta(minutes=3),
    )
    with pytest.raises(NotFoundError, match="auth session not found"):
        auth_repository.touch_auth_session(
            auth_session.id,
            last_activity_at=now + timedelta(minutes=4),
            idle_expires_at=now + timedelta(hours=12, minutes=4),
        )


def test_role_and_status_changes_protect_last_enabled_admin(
    auth_repository: InMemoryRepository | MySQLRepository,
) -> None:
    first = auth_repository.create_initial_admin(
        _user("first-admin", role=UserRole.ADMIN)
    )

    with pytest.raises(LastAdminError):
        auth_repository.update_user_role(
            first.id,
            role=UserRole.CREATOR,
            updated_at=utc_now(),
        )
    with pytest.raises(LastAdminError):
        auth_repository.update_user_status(
            first.id,
            is_enabled=False,
            updated_at=utc_now(),
        )

    second = auth_repository.create_user(_user("second-admin", role=UserRole.ADMIN))
    demoted = auth_repository.update_user_role(
        first.id,
        role=UserRole.VIEWER,
        updated_at=utc_now(),
    )

    assert demoted.role == UserRole.VIEWER
    with pytest.raises(LastAdminError):
        auth_repository.update_user_status(
            second.id,
            is_enabled=False,
            updated_at=utc_now(),
        )


def test_login_failure_window_can_be_counted_and_cleared(
    auth_repository: InMemoryRepository | MySQLRepository,
) -> None:
    now = utc_now()
    cutoff = now - timedelta(minutes=15)

    assert (
        auth_repository.get_login_failure_count(
            "viewer",
            "c" * 64,
            window_started_after=cutoff,
        )
        == 0
    )
    assert (
        auth_repository.record_login_failure(
            "viewer",
            "c" * 64,
            failed_at=now,
            window_started_after=cutoff,
        )
        == 1
    )
    assert (
        auth_repository.record_login_failure(
            "viewer",
            "c" * 64,
            failed_at=now + timedelta(seconds=1),
            window_started_after=cutoff,
        )
        == 2
    )

    auth_repository.clear_login_failures("viewer", "c" * 64)

    assert (
        auth_repository.get_login_failure_count(
            "viewer",
            "c" * 64,
            window_started_after=cutoff,
        )
        == 0
    )
