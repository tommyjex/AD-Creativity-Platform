from fastapi.testclient import TestClient

from backend.app.core.config import Settings
from backend.app.repositories import Repository
from backend.app.schemas.auth import LoginRequest, SetupRequest, UserRecord, UserRole
from backend.app.schemas.common import utc_now
from backend.app.services.auth import AuthService

TEST_ADMIN_PASSWORD = "test administrator password"
TEST_USER_PASSWORD = "test authenticated user password"


def authenticate_test_client(
    client: TestClient,
    repository: Repository,
    *,
    role: UserRole = UserRole.ADMIN,
) -> None:
    client.headers.setdefault("Origin", "http://localhost:3000")
    auth_service = AuthService(repository, Settings())
    if role == UserRole.ADMIN:
        if repository.count_users() == 0:
            authenticated = auth_service.setup(
                SetupRequest(
                    username="test-admin",
                    display_name="Test Admin",
                    password=TEST_ADMIN_PASSWORD,
                )
            )
        else:
            authenticated = auth_service.login(
                LoginRequest(
                    username="test-admin",
                    password=TEST_ADMIN_PASSWORD,
                ),
                source_ip="testclient",
            )
    else:
        now = utc_now()
        auth_service.setup(
            SetupRequest(
                username="test-admin",
                display_name="Test Admin",
                password=TEST_ADMIN_PASSWORD,
            )
        )
        username = f"test-{role.value}"
        repository.create_user(
            UserRecord(
                username=username,
                display_name=f"Test {role.value.title()}",
                password_hash=auth_service.hash_password(
                    TEST_USER_PASSWORD,
                    username,
                ),
                role=role,
                is_enabled=True,
                must_change_password=False,
                created_at=now,
                updated_at=now,
            )
        )
        authenticated = auth_service.login(
            LoginRequest(
                username=username,
                password=TEST_USER_PASSWORD,
            ),
            source_ip="testclient",
        )
    client.cookies.set("ad_session", authenticated.token)
