import pytest

from backend.app.core.config import (
    ConfigurationError,
    Settings,
    normalize_http_origin,
)


def test_video_face_blur_limits_have_isolated_defaults() -> None:
    settings = Settings()

    assert settings.aigc_video_face_blur_concurrency == 1
    assert settings.mediakit_face_blur_poll_interval_seconds == 3
    assert settings.mediakit_face_blur_timeout_seconds == 1800
    assert settings.mediakit_face_blur_transfer_timeout_seconds == 600
    assert settings.mediakit_face_blur_transfer_max_bytes == 2 * 1024 * 1024 * 1024


def test_multitrack_limits_have_isolated_defaults() -> None:
    settings = Settings()

    assert settings.aigc_multitrack_concurrency == 1
    assert settings.mediakit_multitrack_poll_interval_seconds == 3
    assert settings.mediakit_multitrack_timeout_seconds == 1800
    assert settings.mediakit_multitrack_transfer_timeout_seconds == 600
    assert settings.mediakit_multitrack_transfer_max_bytes == 2 * 1024 * 1024 * 1024


def test_tls_logging_defaults_are_disabled_and_safe() -> None:
    settings = Settings()

    assert settings.tls_enabled is False
    assert settings.tls_endpoint == "https://tls-cn-beijing.volces.com"
    assert settings.tls_project_id == "da00add8-5793-44ad-af84-a9de004161d5"
    assert settings.tls_topic_id == "4a3842fc-1201-46b7-994c-1368564e5e77"
    assert settings.tls_access_key_id is None
    assert settings.tls_secret_access_key is None
    assert settings.tls_batch_size == 100
    assert settings.tls_queue_capacity == 1000
    assert settings.tls_flush_interval_seconds == 5
    assert settings.tls_max_retries == 3
    assert settings.tls_retry_initial_seconds == 1
    assert settings.tls_timeout_seconds == 5


def test_auth_security_defaults() -> None:
    settings = Settings()

    assert settings.site_origin == "http://localhost:3000"
    assert settings.allow_insecure_auth_cookie is False
    assert settings.auth_cookie_secure is False
    assert settings.auth_session_idle_seconds == 12 * 60 * 60
    assert settings.auth_session_absolute_seconds == 7 * 24 * 60 * 60
    assert settings.auth_login_window_seconds == 15 * 60
    assert settings.auth_login_max_failures == 5


def test_production_rejects_wildcard_cors_without_explicit_opt_in() -> None:
    with pytest.raises(ValueError, match="ALLOW_INSECURE_CORS"):
        Settings(
            environment="production",
            cors_origins=["*"],
            site_origin="https://app.example.com",
            auth_cookie_secure=True,
        )


def test_production_allows_wildcard_cors_with_explicit_opt_in() -> None:
    settings = Settings(
        environment="production",
        cors_origins=["*"],
        site_origin="https://app.example.com",
        auth_cookie_secure=True,
        allow_insecure_cors=True,
    )

    assert settings.cors_origins == ["*"]
    assert settings.allow_insecure_cors is True


def test_production_rejects_insecure_cookie() -> None:
    with pytest.raises(ValueError, match="ALLOW_INSECURE_AUTH_COOKIE"):
        Settings(
            environment="production",
            cors_origins=["https://app.example.com"],
            site_origin="https://app.example.com",
            auth_cookie_secure=False,
        )


def test_production_allows_insecure_cookie_with_explicit_opt_in() -> None:
    settings = Settings(
        environment="production",
        cors_origins=["https://app.example.com"],
        site_origin="https://app.example.com",
        allow_insecure_auth_cookie=True,
        auth_cookie_secure=False,
    )

    assert settings.allow_insecure_auth_cookie is True
    assert settings.auth_cookie_secure is False


def test_production_allows_unused_insecure_cookie_opt_in() -> None:
    settings = Settings(
        environment="production",
        cors_origins=["https://app.example.com"],
        site_origin="https://app.example.com",
        allow_insecure_auth_cookie=True,
        auth_cookie_secure=True,
    )

    assert settings.auth_cookie_secure is True


def test_auth_origins_are_validated_and_normalized() -> None:
    settings = Settings(
        site_origin="HTTPS://APP.EXAMPLE.COM:443/",
        cors_origins=[
            "https://app.example.com",
            "https://app.example.com:443/",
        ],
    )

    assert settings.site_origin == "https://app.example.com"
    assert settings.cors_origins == ["https://app.example.com"]

    with pytest.raises(ValueError, match="SITE_ORIGIN"):
        Settings(site_origin="https://app.example.com/path")
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        Settings(cors_origins=["https://app.example.com/path"])


@pytest.mark.parametrize(
    ("origin", "expected"),
    [
        (" \tHTTP://APP.EXAMPLE.COM:80/\n", "http://app.example.com"),
        ("\nHttps://APP.EXAMPLE.COM:443/ ", "https://app.example.com"),
    ],
)
def test_normalize_http_origin_trims_and_normalizes_valid_origins(
    origin: str,
    expected: str,
) -> None:
    assert normalize_http_origin(origin, name="TEST_ORIGIN") == expected


@pytest.mark.parametrize(
    "origin",
    [
        pytest.param("https://app example.com", id="internal-space"),
        pytest.param("https://app.\texample.com", id="internal-tab"),
        pytest.param("https://app.\nexample.com", id="internal-newline"),
        pytest.param("https://app.example.com/path", id="path"),
        pytest.param("https://app.example.com?next=/", id="query"),
        pytest.param("https://user@app.example.com", id="userinfo"),
        pytest.param("https://app.example.com:70000", id="invalid-port"),
        pytest.param("https:///", id="empty-host"),
    ],
)
def test_normalize_http_origin_rejects_invalid_origins(origin: str) -> None:
    with pytest.raises(ConfigurationError, match="TEST_ORIGIN"):
        normalize_http_origin(origin, name="TEST_ORIGIN")


def test_production_requires_https_site_origin_in_cors() -> None:
    with pytest.raises(ValueError, match="HTTPS"):
        Settings(
            environment="production",
            cors_origins=["http://app.example.com"],
            site_origin="http://app.example.com",
            auth_cookie_secure=True,
        )
    with pytest.raises(ValueError, match="include SITE_ORIGIN"):
        Settings(
            environment="production",
            cors_origins=["https://api.example.com"],
            site_origin="https://app.example.com",
            auth_cookie_secure=True,
        )


def test_production_auth_settings_are_loaded_from_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com")
    monkeypatch.setenv("SITE_ORIGIN", "https://app.example.com/")
    monkeypatch.delenv("AUTH_COOKIE_SECURE", raising=False)

    settings = Settings.from_env()

    assert settings.cors_origins == ["https://app.example.com"]
    assert settings.site_origin == "https://app.example.com"
    assert settings.auth_cookie_secure is True


def test_production_wildcard_cors_opt_in_is_loaded_from_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    monkeypatch.setenv("SITE_ORIGIN", "https://app.example.com")
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "true")
    monkeypatch.setenv("ALLOW_INSECURE_CORS", "  true  ")

    settings = Settings.from_env()

    assert settings.cors_origins == ["*"]
    assert settings.allow_insecure_cors is True


def test_production_wildcard_cors_opt_in_allows_missing_site_origin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    monkeypatch.setenv("ALLOW_INSECURE_CORS", "true")
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "true")
    monkeypatch.delenv("SITE_ORIGIN", raising=False)

    settings = Settings.from_env()

    assert settings.site_origin == "http://localhost:3000"
    assert settings.cors_origins == ["*"]
    assert settings.allow_insecure_cors is True


def test_production_insecure_auth_cookie_opt_in_is_loaded_from_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    monkeypatch.setenv("ALLOW_INSECURE_CORS", "true")
    monkeypatch.setenv("ALLOW_INSECURE_AUTH_COOKIE", "  true  ")
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "false")
    monkeypatch.delenv("SITE_ORIGIN", raising=False)

    settings = Settings.from_env()

    assert settings.allow_insecure_auth_cookie is True
    assert settings.auth_cookie_secure is False


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("ALLOW_INSECURE_AUTH_COOKIE", "1"),
        ("ALLOW_INSECURE_AUTH_COOKIE", "yes"),
        ("ALLOW_INSECURE_AUTH_COOKIE", "TRUE"),
        ("AUTH_COOKIE_SECURE", "1"),
        ("AUTH_COOKIE_SECURE", "on"),
        ("AUTH_COOKIE_SECURE", "FALSE"),
    ],
)
def test_cookie_security_environment_rejects_boolean_aliases(
    monkeypatch: pytest.MonkeyPatch,
    name: str,
    value: str,
) -> None:
    monkeypatch.setenv(name, value)

    with pytest.raises(
        ConfigurationError,
        match=rf"{name}.*exactly 'true' or 'false'",
    ):
        Settings.from_env()


@pytest.mark.parametrize("site_origin", ["", " \t "])
def test_production_wildcard_cors_opt_in_defaults_blank_site_origin(
    monkeypatch: pytest.MonkeyPatch,
    site_origin: str,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    monkeypatch.setenv("ALLOW_INSECURE_CORS", "true")
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "true")
    monkeypatch.setenv("SITE_ORIGIN", site_origin)

    settings = Settings.from_env()

    assert settings.site_origin == "http://localhost:3000"


@pytest.mark.parametrize("site_origin", ["not-a-url", "/"])
def test_production_wildcard_cors_opt_in_rejects_invalid_nonempty_site_origin(
    monkeypatch: pytest.MonkeyPatch,
    site_origin: str,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    monkeypatch.setenv("ALLOW_INSECURE_CORS", "true")
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "true")
    monkeypatch.setenv("SITE_ORIGIN", site_origin)

    with pytest.raises(ValueError, match="SITE_ORIGIN"):
        Settings.from_env()


def test_production_explicit_cors_still_rejects_missing_site_origin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com")
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "true")
    monkeypatch.delenv("SITE_ORIGIN", raising=False)

    with pytest.raises(ValueError, match="SITE_ORIGIN.*HTTPS"):
        Settings.from_env()


@pytest.mark.parametrize("alias", ["1", "yes", "on", "TRUE"])
def test_insecure_cors_environment_rejects_boolean_aliases(
    monkeypatch: pytest.MonkeyPatch,
    alias: str,
) -> None:
    monkeypatch.setenv("ALLOW_INSECURE_CORS", alias)

    with pytest.raises(
        ConfigurationError,
        match=r"ALLOW_INSECURE_CORS.*exactly 'true' or 'false'",
    ):
        Settings.from_env()


def test_tls_logging_settings_read_secret_environment_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TLS_ENABLED", "true")
    monkeypatch.setenv("TLS_ENDPOINT", "https://tls.example.test")
    monkeypatch.setenv("TLS_PROJECT_ID", "project-1")
    monkeypatch.setenv("TLS_TOPIC_ID", "topic-1")
    monkeypatch.setenv("TLS_ACCESS_KEY_ID", "tls-access-secret")
    monkeypatch.setenv("TLS_SECRET_ACCESS_KEY", "tls-secret-secret")
    monkeypatch.setenv("TLS_BATCH_SIZE", "50")
    monkeypatch.setenv("TLS_QUEUE_CAPACITY", "500")
    monkeypatch.setenv("TLS_FLUSH_INTERVAL_SECONDS", "10")
    monkeypatch.setenv("TLS_MAX_RETRIES", "0")
    monkeypatch.setenv("TLS_RETRY_INITIAL_SECONDS", "2")
    monkeypatch.setenv("TLS_TIMEOUT_SECONDS", "15")

    settings = Settings.from_env()

    assert settings.tls_enabled is True
    assert settings.tls_endpoint == "https://tls.example.test"
    assert settings.tls_project_id == "project-1"
    assert settings.tls_topic_id == "topic-1"
    assert settings.tls_access_key_id is not None
    assert settings.tls_access_key_id.get_secret_value() == "tls-access-secret"
    assert settings.tls_secret_access_key is not None
    assert settings.tls_secret_access_key.get_secret_value() == "tls-secret-secret"
    assert settings.tls_batch_size == 50
    assert settings.tls_queue_capacity == 500
    assert settings.tls_flush_interval_seconds == 10
    assert settings.tls_max_retries == 0
    assert settings.tls_retry_initial_seconds == 2
    assert settings.tls_timeout_seconds == 15
    assert "tls-access-secret" not in str(settings)
    assert "tls-secret-secret" not in str(settings)


def test_settings_reads_database_and_tos_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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


def test_settings_prefers_primary_tos_key_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
    monkeypatch.setenv("AIGC_VIDEO_CONCURRENCY", "2")
    monkeypatch.setenv("AIGC_VIDEO_TIMEOUT_SECONDS", "1200")
    monkeypatch.setenv("AIGC_VIDEO_ENHANCEMENT_CONCURRENCY", "3")
    monkeypatch.setenv(
        "MEDIAKIT_VIDEO_ENHANCEMENT_POLL_INTERVAL_SECONDS",
        "7",
    )
    monkeypatch.setenv("MEDIAKIT_VIDEO_ENHANCEMENT_TIMEOUT_SECONDS", "2400")
    monkeypatch.setenv(
        "MEDIAKIT_VIDEO_ENHANCEMENT_TRANSFER_TIMEOUT_SECONDS",
        "800",
    )
    monkeypatch.setenv(
        "MEDIAKIT_VIDEO_ENHANCEMENT_TRANSFER_MAX_BYTES",
        "2147483648",
    )
    monkeypatch.setenv("AIGC_VIDEO_FACE_BLUR_CONCURRENCY", "4")
    monkeypatch.setenv("MEDIAKIT_FACE_BLUR_POLL_INTERVAL_SECONDS", "8")
    monkeypatch.setenv("MEDIAKIT_FACE_BLUR_TIMEOUT_SECONDS", "2500")
    monkeypatch.setenv("MEDIAKIT_FACE_BLUR_TRANSFER_TIMEOUT_SECONDS", "900")
    monkeypatch.setenv(
        "MEDIAKIT_FACE_BLUR_TRANSFER_MAX_BYTES",
        "2147483647",
    )
    monkeypatch.setenv("AIGC_MULTITRACK_CONCURRENCY", "5")
    monkeypatch.setenv("MEDIAKIT_MULTITRACK_POLL_INTERVAL_SECONDS", "9")
    monkeypatch.setenv("MEDIAKIT_MULTITRACK_TIMEOUT_SECONDS", "2600")
    monkeypatch.setenv("MEDIAKIT_MULTITRACK_TRANSFER_TIMEOUT_SECONDS", "1000")
    monkeypatch.setenv("MEDIAKIT_MULTITRACK_TRANSFER_MAX_BYTES", "2147483646")

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
    assert settings.aigc_video_concurrency == 2
    assert settings.aigc_video_timeout_seconds == 1200
    assert settings.aigc_video_enhancement_concurrency == 3
    assert settings.mediakit_video_enhancement_poll_interval_seconds == 7
    assert settings.mediakit_video_enhancement_timeout_seconds == 2400
    assert settings.mediakit_video_enhancement_transfer_timeout_seconds == 800
    assert settings.mediakit_video_enhancement_transfer_max_bytes == 2147483648
    assert settings.aigc_video_face_blur_concurrency == 4
    assert settings.mediakit_face_blur_poll_interval_seconds == 8
    assert settings.mediakit_face_blur_timeout_seconds == 2500
    assert settings.mediakit_face_blur_transfer_timeout_seconds == 900
    assert settings.mediakit_face_blur_transfer_max_bytes == 2147483647
    assert settings.aigc_multitrack_concurrency == 5
    assert settings.mediakit_multitrack_poll_interval_seconds == 9
    assert settings.mediakit_multitrack_timeout_seconds == 2600
    assert settings.mediakit_multitrack_transfer_timeout_seconds == 1000
    assert settings.mediakit_multitrack_transfer_max_bytes == 2147483646
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
        ("AIGC_VIDEO_ENHANCEMENT_CONCURRENCY", "0"),
        ("MEDIAKIT_VIDEO_ENHANCEMENT_POLL_INTERVAL_SECONDS", "0"),
        ("MEDIAKIT_VIDEO_ENHANCEMENT_TIMEOUT_SECONDS", "invalid"),
        ("MEDIAKIT_VIDEO_ENHANCEMENT_TRANSFER_TIMEOUT_SECONDS", "-1"),
        ("MEDIAKIT_VIDEO_ENHANCEMENT_TRANSFER_MAX_BYTES", "0"),
        ("AIGC_VIDEO_FACE_BLUR_CONCURRENCY", "0"),
        ("MEDIAKIT_FACE_BLUR_POLL_INTERVAL_SECONDS", "0"),
        ("MEDIAKIT_FACE_BLUR_TIMEOUT_SECONDS", "invalid"),
        ("MEDIAKIT_FACE_BLUR_TRANSFER_TIMEOUT_SECONDS", "-1"),
        ("MEDIAKIT_FACE_BLUR_TRANSFER_MAX_BYTES", "0"),
        ("AIGC_MULTITRACK_CONCURRENCY", "0"),
        ("MEDIAKIT_MULTITRACK_POLL_INTERVAL_SECONDS", "0"),
        ("MEDIAKIT_MULTITRACK_TIMEOUT_SECONDS", "invalid"),
        ("MEDIAKIT_MULTITRACK_TRANSFER_TIMEOUT_SECONDS", "-1"),
        ("MEDIAKIT_MULTITRACK_TRANSFER_MAX_BYTES", "0"),
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
