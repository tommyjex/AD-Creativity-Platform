import pytest

from backend.app.core.config import ConfigurationError, Settings


def test_settings_reads_database_and_tos_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    env_values = {
        "DB_HOST": "db.internal",
        "DB_PORT": "3307",
        "DB_USER": "ad_user",
        "DB_PASSWORD": "db-secret-value",
        "DB_NAME": "ad_creativity",
        "TOS_AK": "tos-access-value",
        "TOS_SK": "tos-secret-value",
        "TOS_ENDPOINT": "tos-cn-beijing.volces.com",
        "TOS_PUBLIC_ENDPOINT": "https://assets.example.com",
        "TOS_REGION": "cn-beijing",
        "TOS_BUCKET": "ad-assets",
    }
    for name, value in env_values.items():
        monkeypatch.setenv(name, value)

    settings = Settings.from_env()

    assert settings.db_host == "db.internal"
    assert settings.db_port == 3307
    assert settings.db_user == "ad_user"
    assert settings.db_password is not None
    assert settings.db_password.get_secret_value() == "db-secret-value"
    assert settings.db_name == "ad_creativity"
    assert settings.tos_access_key is not None
    assert settings.tos_access_key.get_secret_value() == "tos-access-value"
    assert settings.tos_secret_key is not None
    assert settings.tos_secret_key.get_secret_value() == "tos-secret-value"
    assert settings.tos_endpoint == "tos-cn-beijing.volces.com"
    assert settings.tos_public_endpoint == "https://assets.example.com"
    assert settings.tos_region == "cn-beijing"
    assert settings.tos_bucket == "ad-assets"


def test_settings_prefers_primary_tos_key_names(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TOS_ACCESS_KEY", "primary-access-value")
    monkeypatch.setenv("TOS_AK", "alias-access-value")
    monkeypatch.setenv("TOS_SECRET_KEY", "primary-secret-value")
    monkeypatch.setenv("TOS_SK", "alias-secret-value")

    settings = Settings.from_env()

    assert settings.tos_access_key is not None
    assert settings.tos_access_key.get_secret_value() == "primary-access-value"
    assert settings.tos_secret_key is not None
    assert settings.tos_secret_key.get_secret_value() == "primary-secret-value"


def test_settings_reads_modelark_alias_and_download_limits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("ARK_API_KEY", raising=False)
    monkeypatch.setenv("BYTEPLUS_ARK_API_KEY", "byteplus-key-value")
    monkeypatch.setenv("ASSET_DOWNLOAD_TIMEOUT_SECONDS", "45")
    monkeypatch.setenv("ASSET_DOWNLOAD_MAX_BYTES", "1048576")
    monkeypatch.setenv("ARK_VIDEO_TIMEOUT_SECONDS", "900")
    monkeypatch.setenv("ARK_VIDEO_POLL_INTERVAL_SECONDS", "5")

    settings = Settings.from_env()

    assert settings.ark_api_key is not None
    assert settings.ark_api_key.get_secret_value() == "byteplus-key-value"
    assert settings.ark_base_url == "https://ark.cn-beijing.volces.com/api/v3"
    assert settings.ark_text_model == "doubao-seed-evolving"
    assert settings.ark_image_model == "doubao-seedream-5-0-pro-260628"
    assert settings.ark_video_model == "doubao-seedance-2-5-260628"
    assert settings.ark_image_timeout_seconds == 600
    assert settings.ark_video_timeout_seconds == 900
    assert settings.ark_video_poll_interval_seconds == 5
    assert settings.asset_download_timeout_seconds == 45
    assert settings.asset_download_max_bytes == 1048576


def test_asset_download_timeout_defaults_to_image_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ARK_IMAGE_TIMEOUT_SECONDS", "720")
    monkeypatch.delenv("ASSET_DOWNLOAD_TIMEOUT_SECONDS", raising=False)

    settings = Settings.from_env()

    assert settings.ark_image_timeout_seconds == 720
    assert settings.asset_download_timeout_seconds == 720


def test_settings_prefers_primary_modelark_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ARK_API_KEY", "primary-key-value")
    monkeypatch.setenv("BYTEPLUS_ARK_API_KEY", "alias-key-value")

    settings = Settings.from_env()

    assert settings.ark_api_key is not None
    assert settings.ark_api_key.get_secret_value() == "primary-key-value"


def test_settings_allows_modelark_endpoint_and_model_overrides(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ARK_BASE_URL", "https://ark.example.test/api/v3")
    monkeypatch.setenv("ARK_TEXT_MODEL", "custom-text-model")
    monkeypatch.setenv("ARK_IMAGE_MODEL", "custom-image-model")
    monkeypatch.setenv("ARK_VIDEO_MODEL", "custom-video-model")

    settings = Settings.from_env()

    assert settings.ark_base_url == "https://ark.example.test/api/v3"
    assert settings.ark_text_model == "custom-text-model"
    assert settings.ark_image_model == "custom-image-model"
    assert settings.ark_video_model == "custom-video-model"


def test_required_config_errors_do_not_expose_secret_values() -> None:
    settings = Settings(
        db_host="db.internal",
        db_user="ad_user",
        db_password="db-secret-value",
        tos_access_key="tos-access-value",
        tos_secret_key="tos-secret-value",
    )

    with pytest.raises(ConfigurationError) as db_exc:
        settings.require_database_config()
    with pytest.raises(ConfigurationError) as tos_exc:
        settings.require_tos_config()
    with pytest.raises(ConfigurationError) as modelark_exc:
        settings.require_modelark_config()

    errors = f"{db_exc.value}\n{tos_exc.value}\n{modelark_exc.value}\n{settings}"
    assert "DB_NAME" in str(db_exc.value)
    assert "TOS_ENDPOINT" in str(tos_exc.value)
    assert "ARK_API_KEY" in str(modelark_exc.value)
    assert "db-secret-value" not in errors
    assert "tos-access-value" not in errors
    assert "tos-secret-value" not in errors


def test_invalid_port_errors_do_not_expose_environment_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DB_PORT", "not-a-port")

    with pytest.raises(ConfigurationError) as exc_info:
        Settings.from_env()

    error = str(exc_info.value)
    assert "DB_PORT" in error
    assert "not-a-port" not in error


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("ASSET_DOWNLOAD_TIMEOUT_SECONDS", "0"),
        ("ASSET_DOWNLOAD_MAX_BYTES", "not-a-size"),
    ],
)
def test_invalid_download_limits_are_rejected_without_echoing_values(
    monkeypatch: pytest.MonkeyPatch,
    name: str,
    value: str,
) -> None:
    monkeypatch.setenv(name, value)

    with pytest.raises(ConfigurationError) as exc_info:
        Settings.from_env()

    assert name in str(exc_info.value)
    assert value not in str(exc_info.value)
