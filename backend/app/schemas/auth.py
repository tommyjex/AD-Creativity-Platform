from __future__ import annotations

import re
from datetime import datetime
from enum import Enum
from uuid import uuid4

from pydantic import Field, SecretStr, field_validator, model_validator

from .common import SchemaModel, utc_now

USERNAME_PATTERN = re.compile(r"^[a-z0-9._-]{3,64}$")
PASSWORD_MIN_LENGTH = 12
PASSWORD_MAX_LENGTH = 128


class UserRole(str, Enum):
    ADMIN = "admin"
    CREATOR = "creator"
    VIEWER = "viewer"


def normalize_username(value: str) -> str:
    normalized = value.strip().lower()
    if not USERNAME_PATTERN.fullmatch(normalized):
        raise ValueError(
            "username must be 3-64 characters using letters, numbers, dots, "
            "underscores, or hyphens"
        )
    return normalized


def validate_password(password: str, username: str) -> str:
    if not PASSWORD_MIN_LENGTH <= len(password) <= PASSWORD_MAX_LENGTH:
        raise ValueError("password must be between 12 and 128 characters")
    if password.casefold() == normalize_username(username).casefold():
        raise ValueError("password must not match username")
    return password


class UsernameRequest(SchemaModel):
    username: str

    @field_validator("username")
    @classmethod
    def normalize_username_field(cls, value: str) -> str:
        return normalize_username(value)


class SetupRequest(UsernameRequest):
    display_name: str = Field(min_length=1, max_length=80)
    password: SecretStr

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("display_name must not be blank")
        return normalized

    @model_validator(mode="after")
    def validate_password_policy(self) -> SetupRequest:
        validate_password(self.password.get_secret_value(), self.username)
        return self


class LoginRequest(UsernameRequest):
    password: SecretStr = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class ChangePasswordRequest(SchemaModel):
    current_password: SecretStr = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: SecretStr = Field(
        min_length=PASSWORD_MIN_LENGTH,
        max_length=PASSWORD_MAX_LENGTH,
    )


class CreateUserRequest(SetupRequest):
    role: UserRole


class UpdateUserRoleRequest(SchemaModel):
    role: UserRole


class UpdateUserStatusRequest(SchemaModel):
    is_enabled: bool


class ResetPasswordRequest(SchemaModel):
    password: SecretStr = Field(
        min_length=PASSWORD_MIN_LENGTH,
        max_length=PASSWORD_MAX_LENGTH,
    )


class UserRecord(SchemaModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    username: str
    display_name: str
    password_hash: str = Field(exclude=True)
    role: UserRole
    is_enabled: bool = True
    must_change_password: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    last_login_at: datetime | None = None

    @field_validator("username")
    @classmethod
    def normalize_username_field(cls, value: str) -> str:
        return normalize_username(value)

    def to_public(self) -> UserPublic:
        return UserPublic.model_validate(self, from_attributes=True)


class UserPublic(SchemaModel):
    id: str
    username: str
    display_name: str
    role: UserRole
    is_enabled: bool
    must_change_password: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None


class AuthSession(SchemaModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    token_digest: str
    created_at: datetime = Field(default_factory=utc_now)
    last_activity_at: datetime = Field(default_factory=utc_now)
    idle_expires_at: datetime
    absolute_expires_at: datetime
    revoked_at: datetime | None = None


class SetupStatusResponse(SchemaModel):
    initialized: bool


class AuthResponse(SchemaModel):
    user: UserPublic
