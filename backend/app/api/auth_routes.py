from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from backend.app.core.config import Settings, get_settings
from backend.app.core.logging import Outcome, log_event
from backend.app.repositories import (
    LastAdminError,
    NotFoundError,
    SetupCompletedError,
    UserConflictError,
)
from backend.app.schemas.auth import (
    ChangePasswordRequest,
    CreateUserRequest,
    LoginRequest,
    ResetPasswordRequest,
    SetupRequest,
    SetupStatusResponse,
    UpdateUserRoleRequest,
    UpdateUserStatusRequest,
    UserPublic,
)
from backend.app.services.auth import (
    AUTHENTICATION_FAILED_MESSAGE,
    AuthenticatedSession,
    AuthenticationError,
    AuthService,
    InvalidCurrentPasswordError,
    LoginRateLimitedError,
    SessionPrincipal,
)

from .dependencies import (
    get_auth_service,
    require_admin,
    require_authenticated,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get(
    "/auth/setup-status",
    response_model=SetupStatusResponse,
    tags=["authentication"],
)
def setup_status(
    auth_service: AuthService = Depends(get_auth_service),
) -> SetupStatusResponse:
    return SetupStatusResponse(initialized=auth_service.is_initialized())


@router.post(
    "/auth/setup",
    response_model=UserPublic,
    status_code=status.HTTP_201_CREATED,
    tags=["authentication"],
)
def setup(
    data: SetupRequest,
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> UserPublic:
    try:
        authenticated = auth_service.setup(data)
    except SetupCompletedError as exc:
        _audit_auth_event(
            request,
            auth_service,
            operation="setup",
            outcome="failed",
            username=data.username,
        )
        raise _http_error(
            status.HTTP_409_CONFLICT,
            "setup_completed",
            "System initialization is already complete.",
        ) from exc
    except Exception:
        _audit_auth_event(
            request,
            auth_service,
            operation="setup",
            outcome="failed",
            username=data.username,
        )
        raise
    _audit_auth_event(
        request,
        auth_service,
        operation="setup",
        outcome="succeeded",
        actor_user_id=authenticated.user.id,
        target_user_id=authenticated.user.id,
        username=authenticated.user.username,
    )
    _set_session_cookie(response, authenticated, settings)
    return authenticated.user


@router.post(
    "/auth/login",
    response_model=UserPublic,
    tags=["authentication"],
)
def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> UserPublic:
    source_ip = request.client.host if request.client is not None else "unknown"
    try:
        authenticated = auth_service.login(data, source_ip=source_ip)
    except LoginRateLimitedError as exc:
        _audit_auth_event(
            request,
            auth_service,
            operation="login_rate_limit",
            outcome="failed",
            username=data.username,
        )
        raise _http_error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "login_rate_limited",
            AUTHENTICATION_FAILED_MESSAGE,
        ) from exc
    except AuthenticationError as exc:
        _audit_auth_event(
            request,
            auth_service,
            operation="login",
            outcome="failed",
            username=data.username,
        )
        raise _http_error(
            status.HTTP_401_UNAUTHORIZED,
            "authentication_failed",
            AUTHENTICATION_FAILED_MESSAGE,
        ) from exc
    except Exception:
        _audit_auth_event(
            request,
            auth_service,
            operation="login",
            outcome="failed",
            username=data.username,
        )
        raise
    _audit_auth_event(
        request,
        auth_service,
        operation="login",
        outcome="succeeded",
        actor_user_id=authenticated.user.id,
        target_user_id=authenticated.user.id,
        username=authenticated.user.username,
    )
    _set_session_cookie(response, authenticated, settings)
    return authenticated.user


@router.post(
    "/auth/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["authentication"],
)
def logout(
    request: Request,
    response: Response,
    principal: SessionPrincipal = Depends(require_authenticated),
    auth_service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> None:
    try:
        auth_service.logout(request.cookies.get("ad_session"))
    except Exception:
        _audit_auth_event(
            request,
            auth_service,
            operation="logout",
            outcome="failed",
            actor_user_id=principal.user.id,
            target_user_id=principal.user.id,
            username=principal.user.username,
        )
        raise
    _audit_auth_event(
        request,
        auth_service,
        operation="logout",
        outcome="succeeded",
        actor_user_id=principal.user.id,
        target_user_id=principal.user.id,
        username=principal.user.username,
    )
    _clear_session_cookie(response, settings)


@router.get(
    "/auth/me",
    response_model=UserPublic,
    tags=["authentication"],
)
def me(
    principal: SessionPrincipal = Depends(require_authenticated),
) -> UserPublic:
    return principal.user


@router.post(
    "/auth/change-password",
    response_model=UserPublic,
    tags=["authentication"],
)
def change_password(
    data: ChangePasswordRequest,
    request: Request,
    response: Response,
    principal: SessionPrincipal = Depends(require_authenticated),
    auth_service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> UserPublic:
    try:
        authenticated = auth_service.change_password(principal, data)
    except InvalidCurrentPasswordError as exc:
        _audit_auth_event(
            request,
            auth_service,
            operation="change_password",
            outcome="failed",
            actor_user_id=principal.user.id,
            target_user_id=principal.user.id,
            username=principal.user.username,
        )
        raise _http_error(
            status.HTTP_401_UNAUTHORIZED,
            "current_password_invalid",
            str(exc),
        ) from exc
    except ValueError as exc:
        _audit_auth_event(
            request,
            auth_service,
            operation="change_password",
            outcome="failed",
            actor_user_id=principal.user.id,
            target_user_id=principal.user.id,
            username=principal.user.username,
        )
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "password_policy_failed",
            str(exc),
        ) from exc
    except Exception:
        _audit_auth_event(
            request,
            auth_service,
            operation="change_password",
            outcome="failed",
            actor_user_id=principal.user.id,
            target_user_id=principal.user.id,
            username=principal.user.username,
        )
        raise
    _audit_auth_event(
        request,
        auth_service,
        operation="change_password",
        outcome="succeeded",
        actor_user_id=principal.user.id,
        target_user_id=principal.user.id,
        username=principal.user.username,
    )
    _set_session_cookie(response, authenticated, settings)
    return authenticated.user


@router.get(
    "/admin/users",
    response_model=list[UserPublic],
    tags=["admin"],
)
def list_users(
    _: SessionPrincipal = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service),
) -> list[UserPublic]:
    return auth_service.list_users()


@router.post(
    "/admin/users",
    response_model=UserPublic,
    status_code=status.HTTP_201_CREATED,
    tags=["admin"],
)
def create_user(
    data: CreateUserRequest,
    request: Request,
    principal: SessionPrincipal = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserPublic:
    try:
        created = auth_service.create_user(data)
    except UserConflictError as exc:
        _audit_auth_event(
            request,
            auth_service,
            operation="create_user",
            outcome="failed",
            actor_user_id=principal.user.id,
            username=data.username,
        )
        raise _http_error(
            status.HTTP_409_CONFLICT,
            "username_conflict",
            "Username already exists.",
        ) from exc
    except Exception:
        _audit_auth_event(
            request,
            auth_service,
            operation="create_user",
            outcome="failed",
            actor_user_id=principal.user.id,
            username=data.username,
        )
        raise
    _audit_auth_event(
        request,
        auth_service,
        operation="create_user",
        outcome="succeeded",
        actor_user_id=principal.user.id,
        target_user_id=created.id,
        username=created.username,
    )
    return created


@router.patch(
    "/admin/users/{user_id}/role",
    response_model=UserPublic,
    tags=["admin"],
)
def update_user_role(
    user_id: str,
    data: UpdateUserRoleRequest,
    request: Request,
    principal: SessionPrincipal = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserPublic:
    try:
        updated = auth_service.update_role(user_id, data.role)
    except (LastAdminError, NotFoundError) as exc:
        _audit_auth_event(
            request,
            auth_service,
            operation="update_role",
            outcome="failed",
            actor_user_id=principal.user.id,
            target_user_id=user_id,
        )
        raise _management_error(exc)
    except Exception:
        _audit_auth_event(
            request,
            auth_service,
            operation="update_role",
            outcome="failed",
            actor_user_id=principal.user.id,
            target_user_id=user_id,
        )
        raise
    _audit_auth_event(
        request,
        auth_service,
        operation="update_role",
        outcome="succeeded",
        actor_user_id=principal.user.id,
        target_user_id=user_id,
        username=updated.username,
    )
    return updated


@router.patch(
    "/admin/users/{user_id}/status",
    response_model=UserPublic,
    tags=["admin"],
)
def update_user_status(
    user_id: str,
    data: UpdateUserStatusRequest,
    request: Request,
    principal: SessionPrincipal = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserPublic:
    operation = "enable_user" if data.is_enabled else "disable_user"
    try:
        updated = auth_service.update_status(user_id, data.is_enabled)
    except (LastAdminError, NotFoundError) as exc:
        _audit_auth_event(
            request,
            auth_service,
            operation=operation,
            outcome="failed",
            actor_user_id=principal.user.id,
            target_user_id=user_id,
        )
        raise _management_error(exc)
    except Exception:
        _audit_auth_event(
            request,
            auth_service,
            operation=operation,
            outcome="failed",
            actor_user_id=principal.user.id,
            target_user_id=user_id,
        )
        raise
    _audit_auth_event(
        request,
        auth_service,
        operation=operation,
        outcome="succeeded",
        actor_user_id=principal.user.id,
        target_user_id=user_id,
        username=updated.username,
    )
    return updated


@router.post(
    "/admin/users/{user_id}/reset-password",
    response_model=UserPublic,
    tags=["admin"],
)
def reset_user_password(
    user_id: str,
    data: ResetPasswordRequest,
    request: Request,
    principal: SessionPrincipal = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserPublic:
    try:
        updated = auth_service.reset_password(
            user_id,
            data.password.get_secret_value(),
        )
    except NotFoundError as exc:
        _audit_auth_event(
            request,
            auth_service,
            operation="reset_password",
            outcome="failed",
            actor_user_id=principal.user.id,
            target_user_id=user_id,
        )
        raise _management_error(exc)
    except ValueError as exc:
        _audit_auth_event(
            request,
            auth_service,
            operation="reset_password",
            outcome="failed",
            actor_user_id=principal.user.id,
            target_user_id=user_id,
        )
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "password_policy_failed",
            str(exc),
        ) from exc
    except Exception:
        _audit_auth_event(
            request,
            auth_service,
            operation="reset_password",
            outcome="failed",
            actor_user_id=principal.user.id,
            target_user_id=user_id,
        )
        raise
    _audit_auth_event(
        request,
        auth_service,
        operation="reset_password",
        outcome="succeeded",
        actor_user_id=principal.user.id,
        target_user_id=user_id,
        username=updated.username,
    )
    return updated


def _audit_auth_event(
    request: Request,
    auth_service: AuthService,
    *,
    operation: str,
    outcome: Outcome,
    actor_user_id: str | None = None,
    target_user_id: str | None = None,
    username: str | None = None,
) -> None:
    source_ip = request.client.host if request.client is not None else "unknown"
    log_event(
        logger,
        "security.auth.audit",
        outcome=outcome,
        level=logging.WARNING if outcome == "failed" else logging.INFO,
        operation=operation,
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        username_digest=(
            auth_service.username_digest(username)
            if username is not None
            else None
        ),
        source_digest=auth_service.source_digest(source_ip),
    )


def _set_session_cookie(
    response: Response,
    authenticated: AuthenticatedSession,
    settings: Settings,
) -> None:
    response.set_cookie(
        key="ad_session",
        value=authenticated.token,
        max_age=settings.auth_session_absolute_seconds,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )


def _clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key="ad_session",
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )


def _management_error(exc: LastAdminError | NotFoundError) -> HTTPException:
    if isinstance(exc, LastAdminError):
        return _http_error(
            status.HTTP_409_CONFLICT,
            "last_admin_required",
            str(exc),
        )
    return _http_error(
        status.HTTP_404_NOT_FOUND,
        "user_not_found",
        "User not found.",
    )


def _http_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )
