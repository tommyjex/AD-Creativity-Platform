from __future__ import annotations

import json
import logging
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from io import StringIO
from typing import Any

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from backend.app.api.auth_routes import router as auth_router
from backend.app.api.dependencies import get_auth_service
from backend.app.core.config import Settings
from backend.app.core.logging import (
    JsonStdoutFormatter,
    bind_log_context,
    reset_log_context,
)
from backend.app.core.tls_logging import TlsLogHandler
from backend.app.repositories import InMemoryRepository
from backend.app.services.auth import AuthService

ADMIN_PASSWORD = "audit-admin-password-123"
CHANGED_PASSWORD = "audit-admin-password-456"
TEMPORARY_PASSWORD = "audit-user-password-123"
RESET_PASSWORD = "audit-user-password-456"


@dataclass
class _CapturingSink:
    events: list[dict[str, Any]] = field(default_factory=list)

    def emit(self, event: dict[str, Any]) -> None:
        self.events.append(event)


@dataclass
class _AuditCapture:
    output: StringIO
    records: list[logging.LogRecord]
    sink: _CapturingSink

    @property
    def events(self) -> list[dict[str, Any]]:
        return [
            json.loads(line)
            for line in self.output.getvalue().splitlines()
            if line
        ]


class _RecordHandler(logging.Handler):
    def __init__(self, records: list[logging.LogRecord]) -> None:
        super().__init__()
        self._records = records

    def emit(self, record: logging.LogRecord) -> None:
        self._records.append(record)


def _capture_auth_audit(monkeypatch) -> _AuditCapture:
    output = StringIO()
    records: list[logging.LogRecord] = []
    sink = _CapturingSink()
    formatter = JsonStdoutFormatter(
        service="ad-creativity-test",
        environment="test",
    )
    stdout_handler = logging.StreamHandler(output)
    stdout_handler.setFormatter(formatter)
    tls_handler = TlsLogHandler(sink, formatter)  # type: ignore[arg-type]
    logger = logging.getLogger("backend.app.api.auth_routes")

    monkeypatch.setattr(logger, "handlers", [
        stdout_handler,
        _RecordHandler(records),
        tls_handler,
    ])
    monkeypatch.setattr(logger, "level", logging.INFO)
    monkeypatch.setattr(logger, "propagate", False)
    return _AuditCapture(output=output, records=records, sink=sink)


def _request_headers(request_id: str) -> dict[str, str]:
    return {"X-Request-ID": request_id}


@contextmanager
def _auth_client() -> Iterator[tuple[TestClient, InMemoryRepository]]:
    app = FastAPI()
    app.include_router(auth_router, prefix="/api")
    repository = InMemoryRepository()
    service = AuthService(repository, Settings())
    app.dependency_overrides[get_auth_service] = lambda: service

    @app.middleware("http")
    async def bind_request_id(request: Request, call_next):
        token = bind_log_context(
            request_id=request.headers.get("X-Request-ID", "test-request")
        )
        try:
            return await call_next(request)
        finally:
            reset_log_context(token)

    with TestClient(app) as client:
        yield client, repository


def test_auth_operations_emit_structured_audit_events(monkeypatch) -> None:
    capture = _capture_auth_audit(monkeypatch)

    with _auth_client() as (client, _):
        setup = client.post(
            "/api/auth/setup",
            headers=_request_headers("audit-setup"),
            json={
                "username": "Audit.Admin",
                "display_name": "Audit Admin",
                "password": ADMIN_PASSWORD,
            },
        )
        admin = setup.json()
        client.post(
            "/api/auth/change-password",
            headers=_request_headers("audit-change-password"),
            json={
                "current_password": ADMIN_PASSWORD,
                "new_password": CHANGED_PASSWORD,
            },
        )
        created_response = client.post(
            "/api/admin/users",
            headers=_request_headers("audit-create-user"),
            json={
                "username": "Audit.User",
                "display_name": "Audit User",
                "password": TEMPORARY_PASSWORD,
                "role": "creator",
            },
        )
        created = created_response.json()
        client.patch(
            f"/api/admin/users/{created['id']}/role",
            headers=_request_headers("audit-role"),
            json={"role": "viewer"},
        )
        client.patch(
            f"/api/admin/users/{created['id']}/status",
            headers=_request_headers("audit-disable"),
            json={"is_enabled": False},
        )
        client.patch(
            f"/api/admin/users/{created['id']}/status",
            headers=_request_headers("audit-enable"),
            json={"is_enabled": True},
        )
        client.post(
            f"/api/admin/users/{created['id']}/reset-password",
            headers=_request_headers("audit-reset"),
            json={"password": RESET_PASSWORD},
        )
        client.post(
            "/api/auth/logout",
            headers=_request_headers("audit-logout"),
        )
        client.post(
            "/api/auth/login",
            headers=_request_headers("audit-login"),
            json={"username": "audit.admin", "password": CHANGED_PASSWORD},
        )

    events = capture.events
    assert [event["operation"] for event in events] == [
        "setup",
        "change_password",
        "create_user",
        "update_role",
        "disable_user",
        "enable_user",
        "reset_password",
        "logout",
        "login",
    ]
    assert all(event["event"] == "security.auth.audit" for event in events)
    assert all(event["outcome"] == "succeeded" for event in events)
    assert all(event["source_digest"] for event in events)
    assert {event["request_id"] for event in events} == {
        "audit-setup",
        "audit-change-password",
        "audit-create-user",
        "audit-role",
        "audit-disable",
        "audit-enable",
        "audit-reset",
        "audit-logout",
        "audit-login",
    }
    assert events[0]["actor_user_id"] == admin["id"]
    assert events[0]["target_user_id"] == admin["id"]
    assert events[0]["username_digest"] != "audit.admin"
    management_events = events[2:7]
    assert all(event["actor_user_id"] == admin["id"] for event in management_events)
    assert all(event["target_user_id"] == created["id"] for event in management_events)
    assert [
        {key: value for key, value in event.items() if key != "timestamp"}
        for event in capture.sink.events
    ] == [
        {key: value for key, value in event.items() if key != "timestamp"}
        for event in events
    ]


def test_failed_and_rate_limited_login_are_audited_without_credentials(
    monkeypatch,
) -> None:
    capture = _capture_auth_audit(monkeypatch)
    with _auth_client() as (client, repository):
        client.post(
            "/api/auth/setup",
            json={
                "username": "Audit.Admin",
                "display_name": "Audit Admin",
                "password": ADMIN_PASSWORD,
            },
        )
        raw_session_token = client.cookies.get("ad_session")
        stored_password_hash = repository.list_users()[0].password_hash
        client.post("/api/auth/logout")

        request_body = {
            "username": "Audit.Admin",
            "password": "credential-sentinel-wrong-password",
        }
        for attempt in range(6):
            response = client.post(
                "/api/auth/login",
                headers=_request_headers(f"audit-failure-{attempt}"),
                json=request_body,
            )
        assert response.status_code == 429

    failure_events = [
        event
        for event in capture.events
        if event["operation"] in {"login", "login_rate_limit"}
    ]
    assert [event["operation"] for event in failure_events] == [
        "login",
        "login",
        "login",
        "login",
        "login",
        "login_rate_limit",
    ]
    assert all(event["outcome"] == "failed" for event in failure_events)
    assert all("actor_user_id" not in event for event in failure_events)
    assert len({event["username_digest"] for event in failure_events}) == 1
    assert len({event["source_digest"] for event in failure_events}) == 1

    serialized_records = json.dumps(
        [record.__dict__ for record in capture.records],
        default=str,
    )
    serialized_tls = json.dumps(capture.sink.events)
    all_outputs = f"{capture.output.getvalue()}\n{serialized_records}\n{serialized_tls}"
    forbidden_values = (
        ADMIN_PASSWORD,
        request_body["password"],
        stored_password_hash,
        raw_session_token,
        json.dumps(request_body),
    )
    assert all(value not in all_outputs for value in forbidden_values if value)
    assert "cookie" not in all_outputs.casefold()
    assert "request_body" not in all_outputs.casefold()
