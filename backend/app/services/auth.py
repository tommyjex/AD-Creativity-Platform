from __future__ import annotations

import hashlib
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from backend.app.core.config import Settings
from backend.app.repositories import NotFoundError, Repository
from backend.app.schemas.auth import (
    AuthSession,
    ChangePasswordRequest,
    CreateUserRequest,
    LoginRequest,
    SetupRequest,
    UserPublic,
    UserRecord,
    UserRole,
    normalize_username,
    validate_password,
)
from backend.app.schemas.common import utc_now

AUTHENTICATION_FAILED_MESSAGE = "Invalid username or password."


class AuthenticationError(RuntimeError):
    pass


class LoginRateLimitedError(AuthenticationError):
    pass


class InvalidCurrentPasswordError(AuthenticationError):
    pass


@dataclass(frozen=True)
class AuthenticatedSession:
    user: UserPublic
    token: str
    session: AuthSession


@dataclass(frozen=True)
class SessionPrincipal:
    user: UserPublic
    session: AuthSession


class AuthService:
    def __init__(
        self,
        repository: Repository,
        settings: Settings,
        *,
        password_hasher: PasswordHasher | None = None,
        clock: Callable[[], datetime] = utc_now,
    ) -> None:
        self._repository = repository
        self._settings = settings
        self._password_hasher = password_hasher or PasswordHasher()
        self._clock = clock
        self._dummy_password_hash = self._password_hasher.hash(
            "authentication-dummy-password"
        )

    def is_initialized(self) -> bool:
        return self._repository.count_users() > 0

    def setup(self, data: SetupRequest) -> AuthenticatedSession:
        now = self._clock()
        password_hash = self.hash_password(
            data.password.get_secret_value(),
            data.username,
        )
        user = UserRecord(
            username=data.username,
            display_name=data.display_name,
            password_hash=password_hash,
            role=UserRole.ADMIN,
            is_enabled=True,
            must_change_password=False,
            created_at=now,
            updated_at=now,
            last_login_at=now,
        )
        token, auth_session = self._new_session(user.id, now=now)
        saved = self._repository.create_initial_admin(user, auth_session)
        return AuthenticatedSession(
            user=saved.to_public(),
            token=token,
            session=auth_session,
        )

    def login(
        self,
        data: LoginRequest,
        *,
        source_ip: str,
    ) -> AuthenticatedSession:
        now = self._clock()
        username = normalize_username(data.username)
        source_digest = self.source_digest(source_ip)
        window_start = now - timedelta(seconds=self._settings.auth_login_window_seconds)
        failures = self._repository.get_login_failure_count(
            username,
            source_digest,
            window_started_after=window_start,
        )
        if failures >= self._settings.auth_login_max_failures:
            raise LoginRateLimitedError(AUTHENTICATION_FAILED_MESSAGE)

        user = self._repository.get_user_by_username(username)
        candidate_hash = (
            user.password_hash if user is not None else self._dummy_password_hash
        )
        password_matches = self.verify_password(
            candidate_hash,
            data.password.get_secret_value(),
        )
        if user is None or not password_matches or not user.is_enabled:
            self._repository.record_login_failure(
                username,
                source_digest,
                failed_at=now,
                window_started_after=window_start,
            )
            raise AuthenticationError(AUTHENTICATION_FAILED_MESSAGE)

        self._repository.clear_login_failures(username, source_digest)
        user = self._repository.update_user_login(user.id, logged_in_at=now)
        token, auth_session = self._new_session(user.id, now=now)
        self._repository.create_auth_session(auth_session)
        return AuthenticatedSession(
            user=user.to_public(),
            token=token,
            session=auth_session,
        )

    def authenticate(self, token: str | None) -> SessionPrincipal | None:
        if not token:
            return None
        now = self._clock()
        auth_session = self._repository.get_auth_session_by_digest(
            self.token_digest(token)
        )
        if auth_session is None or auth_session.revoked_at is not None:
            return None
        if (
            now >= auth_session.idle_expires_at
            or now >= auth_session.absolute_expires_at
        ):
            self._repository.revoke_auth_session(
                auth_session.id,
                revoked_at=now,
            )
            return None
        user = self._repository.get_user(auth_session.user_id)
        if not user.is_enabled:
            self._repository.revoke_user_sessions(user.id, revoked_at=now)
            return None

        idle_expires_at = min(
            now + timedelta(seconds=self._settings.auth_session_idle_seconds),
            auth_session.absolute_expires_at,
        )
        try:
            auth_session = self._repository.touch_auth_session(
                auth_session.id,
                last_activity_at=now,
                idle_expires_at=idle_expires_at,
            )
        except NotFoundError:
            # The session may have been revoked after the initial lookup.
            return None
        return SessionPrincipal(
            user=user.to_public(),
            session=auth_session,
        )

    def logout(self, token: str | None) -> None:
        if not token:
            return
        auth_session = self._repository.get_auth_session_by_digest(
            self.token_digest(token)
        )
        if auth_session is not None:
            self._repository.revoke_auth_session(
                auth_session.id,
                revoked_at=self._clock(),
            )

    def change_password(
        self,
        principal: SessionPrincipal,
        data: ChangePasswordRequest,
    ) -> AuthenticatedSession:
        current = self._repository.get_user(principal.user.id)
        if not self.verify_password(
            current.password_hash,
            data.current_password.get_secret_value(),
        ):
            raise InvalidCurrentPasswordError("Current password is incorrect.")
        new_password = data.new_password.get_secret_value()
        validate_password(new_password, current.username)
        now = self._clock()
        updated = self._repository.update_user_password(
            current.id,
            password_hash=self.hash_password(new_password, current.username),
            must_change_password=False,
            updated_at=now,
        )
        self._repository.revoke_user_sessions(current.id, revoked_at=now)
        token, auth_session = self._new_session(current.id, now=now)
        self._repository.create_auth_session(auth_session)
        return AuthenticatedSession(
            user=updated.to_public(),
            token=token,
            session=auth_session,
        )

    def create_user(self, data: CreateUserRequest) -> UserPublic:
        now = self._clock()
        user = UserRecord(
            username=data.username,
            display_name=data.display_name,
            password_hash=self.hash_password(
                data.password.get_secret_value(),
                data.username,
            ),
            role=data.role,
            is_enabled=True,
            must_change_password=True,
            created_at=now,
            updated_at=now,
        )
        return self._repository.create_user(user).to_public()

    def list_users(self) -> list[UserPublic]:
        return [user.to_public() for user in self._repository.list_users()]

    def update_role(self, user_id: str, role: UserRole) -> UserPublic:
        now = self._clock()
        user = self._repository.update_user_role(
            user_id,
            role=role,
            updated_at=now,
        )
        self._repository.revoke_user_sessions(user_id, revoked_at=now)
        return user.to_public()

    def update_status(self, user_id: str, is_enabled: bool) -> UserPublic:
        now = self._clock()
        user = self._repository.update_user_status(
            user_id,
            is_enabled=is_enabled,
            updated_at=now,
        )
        self._repository.revoke_user_sessions(user_id, revoked_at=now)
        return user.to_public()

    def reset_password(self, user_id: str, password: str) -> UserPublic:
        current = self._repository.get_user(user_id)
        validate_password(password, current.username)
        now = self._clock()
        user = self._repository.update_user_password(
            user_id,
            password_hash=self.hash_password(password, current.username),
            must_change_password=True,
            updated_at=now,
        )
        self._repository.revoke_user_sessions(user_id, revoked_at=now)
        return user.to_public()

    def hash_password(self, password: str, username: str) -> str:
        validate_password(password, username)
        return self._password_hasher.hash(password)

    def verify_password(self, password_hash: str, password: str) -> bool:
        try:
            return self._password_hasher.verify(password_hash, password)
        except (InvalidHashError, VerificationError, VerifyMismatchError):
            return False

    @staticmethod
    def token_digest(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def source_digest(source_ip: str) -> str:
        return hashlib.sha256(source_ip.strip().encode("utf-8")).hexdigest()

    @staticmethod
    def username_digest(username: str) -> str:
        normalized = normalize_username(username)
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def _new_session(
        self,
        user_id: str,
        *,
        now: datetime,
    ) -> tuple[str, AuthSession]:
        token = secrets.token_urlsafe(48)
        auth_session = AuthSession(
            user_id=user_id,
            token_digest=self.token_digest(token),
            created_at=now,
            last_activity_at=now,
            idle_expires_at=now
            + timedelta(seconds=self._settings.auth_session_idle_seconds),
            absolute_expires_at=now
            + timedelta(seconds=self._settings.auth_session_absolute_seconds),
        )
        return token, auth_session
