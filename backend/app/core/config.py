from functools import lru_cache
from os import getenv

from pydantic import BaseModel, Field, SecretStr


class ConfigurationError(ValueError):
    """Raised when environment configuration is invalid without exposing values."""


def _parse_positive_int_env(name: str, default: int) -> int:
    raw_value = getenv(name)
    if raw_value is None:
        return default

    try:
        value = int(raw_value)
    except ValueError as exc:
        raise ConfigurationError(f"{name} must be a positive integer.") from exc

    if value <= 0:
        raise ConfigurationError(f"{name} must be a positive integer.")
    return value


def _parse_nonnegative_int_env(name: str, default: int) -> int:
    raw_value = getenv(name)
    if raw_value is None:
        return default

    try:
        value = int(raw_value)
    except ValueError as exc:
        raise ConfigurationError(f"{name} must be a non-negative integer.") from exc

    if value < 0:
        raise ConfigurationError(f"{name} must be a non-negative integer.")
    return value


def _parse_bool_env(name: str, default: bool) -> bool:
    raw_value = getenv(name)
    if raw_value is None:
        return default
    normalized = raw_value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ConfigurationError(f"{name} must be a boolean.")


def _get_env_first(*names: str) -> str | None:
    for name in names:
        value = getenv(name)
        if value:
            return value
    return None


def _get_secret_env_first(*names: str) -> SecretStr | None:
    value = _get_env_first(*names)
    return SecretStr(value) if value is not None else None


def _missing_env_names(values: dict[str, object | None]) -> list[str]:
    return [name for name, value in values.items() if value is None]


class Settings(BaseModel):
    app_name: str = "AD Creativity Backend"
    app_version: str = "0.1.0"
    environment: str = "local"
    api_prefix: str = "/api"
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])

    ark_text_model: str = "doubao-seed-evolving"
    ark_image_model: str = "doubao-seedream-5-0-pro-260628"
    ark_video_model: str = "doubao-seedance-2-5-260628"
    ark_api_key: SecretStr | None = None
    ark_base_url: str = "https://ark.cn-beijing.volces.com/api/v3"
    ark_timeout_seconds: int = Field(default=60, gt=0)
    ark_image_timeout_seconds: int = Field(default=600, gt=0)
    ark_video_timeout_seconds: int = Field(default=1800, gt=0)
    ark_video_poll_interval_seconds: int = Field(default=3, gt=0)
    aigc_video_concurrency: int = Field(default=1, gt=0)
    aigc_video_timeout_seconds: int = Field(default=1800, gt=0)
    mediakit_api_key: SecretStr | None = None
    mediakit_base_url: str = "https://mediakit.cn-beijing.volces.com"
    mediakit_asr_poll_interval_seconds: int = Field(default=3, gt=0)
    mediakit_asr_timeout_seconds: int = Field(default=1800, gt=0)
    mediakit_asr_language: str | None = None
    aigc_video_subtitle_extraction_concurrency: int = Field(default=1, gt=0)
    mediakit_video_ocr_poll_interval_seconds: int = Field(default=3, gt=0)
    mediakit_video_ocr_timeout_seconds: int = Field(default=1800, gt=0)
    aigc_video_enhancement_concurrency: int = Field(default=1, gt=0)
    mediakit_video_enhancement_poll_interval_seconds: int = Field(default=3, gt=0)
    mediakit_video_enhancement_timeout_seconds: int = Field(default=1800, gt=0)
    mediakit_video_enhancement_transfer_timeout_seconds: int = Field(
        default=600,
        gt=0,
    )
    mediakit_video_enhancement_transfer_max_bytes: int = Field(
        default=2 * 1024 * 1024 * 1024,
        gt=0,
    )
    aigc_video_face_blur_concurrency: int = Field(default=1, gt=0)
    mediakit_face_blur_poll_interval_seconds: int = Field(default=3, gt=0)
    mediakit_face_blur_timeout_seconds: int = Field(default=1800, gt=0)
    mediakit_face_blur_transfer_timeout_seconds: int = Field(default=600, gt=0)
    mediakit_face_blur_transfer_max_bytes: int = Field(
        default=2 * 1024 * 1024 * 1024,
        gt=0,
    )
    aigc_multitrack_concurrency: int = Field(default=1, gt=0)
    mediakit_multitrack_poll_interval_seconds: int = Field(default=3, gt=0)
    mediakit_multitrack_timeout_seconds: int = Field(default=1800, gt=0)
    mediakit_multitrack_transfer_timeout_seconds: int = Field(default=600, gt=0)
    mediakit_multitrack_transfer_max_bytes: int = Field(
        default=2 * 1024 * 1024 * 1024,
        gt=0,
    )
    asset_download_timeout_seconds: int = Field(default=600, gt=0)
    asset_download_max_bytes: int = Field(default=30 * 1024 * 1024, gt=0)
    composer_ffmpeg_path: str | None = None
    composer_timeout_seconds: int = Field(default=900, gt=0)

    db_host: str | None = None
    db_port: int = Field(default=3306, gt=0)
    db_user: str | None = None
    db_password: SecretStr | None = None
    db_name: str | None = None

    tos_access_key: SecretStr | None = None
    tos_secret_key: SecretStr | None = None
    tos_endpoint: str | None = None
    tos_public_endpoint: str | None = None
    tos_region: str | None = None
    tos_bucket: str | None = None

    tls_enabled: bool = False
    tls_endpoint: str = "https://tls-cn-beijing.volces.com"
    tls_project_id: str = "da00add8-5793-44ad-af84-a9de004161d5"
    tls_topic_id: str = "4a3842fc-1201-46b7-994c-1368564e5e77"
    tls_access_key_id: SecretStr | None = None
    tls_secret_access_key: SecretStr | None = None
    tls_batch_size: int = Field(default=100, gt=0)
    tls_queue_capacity: int = Field(default=1000, gt=0)
    tls_flush_interval_seconds: int = Field(default=5, gt=0)
    tls_max_retries: int = Field(default=3, ge=0)
    tls_retry_initial_seconds: int = Field(default=1, gt=0)
    tls_timeout_seconds: int = Field(default=5, gt=0)

    @classmethod
    def from_env(cls) -> "Settings":
        cors_origins = getenv("CORS_ORIGINS")
        ark_image_timeout_seconds = _parse_positive_int_env(
            "ARK_IMAGE_TIMEOUT_SECONDS",
            cls.model_fields["ark_image_timeout_seconds"].default,
        )
        return cls(
            app_name=getenv("APP_NAME", cls.model_fields["app_name"].default),
            app_version=getenv("APP_VERSION", cls.model_fields["app_version"].default),
            environment=getenv("APP_ENV", cls.model_fields["environment"].default),
            api_prefix=getenv("API_PREFIX", cls.model_fields["api_prefix"].default),
            cors_origins=(
                [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
                if cors_origins
                else ["*"]
            ),
            ark_text_model=getenv(
                "ARK_TEXT_MODEL",
                cls.model_fields["ark_text_model"].default,
            ),
            ark_image_model=getenv(
                "ARK_IMAGE_MODEL",
                cls.model_fields["ark_image_model"].default,
            ),
            ark_video_model=getenv(
                "ARK_VIDEO_MODEL",
                cls.model_fields["ark_video_model"].default,
            ),
            ark_api_key=_get_secret_env_first(
                "ARK_API_KEY",
                "BYTEPLUS_ARK_API_KEY",
            ),
            ark_base_url=getenv(
                "ARK_BASE_URL",
                cls.model_fields["ark_base_url"].default,
            ),
            ark_timeout_seconds=_parse_positive_int_env(
                "ARK_TIMEOUT_SECONDS",
                cls.model_fields["ark_timeout_seconds"].default,
            ),
            ark_image_timeout_seconds=ark_image_timeout_seconds,
            ark_video_timeout_seconds=_parse_positive_int_env(
                "ARK_VIDEO_TIMEOUT_SECONDS",
                cls.model_fields["ark_video_timeout_seconds"].default,
            ),
            ark_video_poll_interval_seconds=_parse_positive_int_env(
                "ARK_VIDEO_POLL_INTERVAL_SECONDS",
                cls.model_fields["ark_video_poll_interval_seconds"].default,
            ),
            aigc_video_concurrency=_parse_positive_int_env(
                "AIGC_VIDEO_CONCURRENCY",
                cls.model_fields["aigc_video_concurrency"].default,
            ),
            aigc_video_timeout_seconds=_parse_positive_int_env(
                "AIGC_VIDEO_TIMEOUT_SECONDS",
                cls.model_fields["aigc_video_timeout_seconds"].default,
            ),
            mediakit_api_key=_get_secret_env_first("MEDIAKIT_API_KEY"),
            mediakit_base_url=getenv(
                "MEDIAKIT_BASE_URL",
                cls.model_fields["mediakit_base_url"].default,
            ),
            mediakit_asr_poll_interval_seconds=_parse_positive_int_env(
                "MEDIAKIT_ASR_POLL_INTERVAL_SECONDS",
                cls.model_fields["mediakit_asr_poll_interval_seconds"].default,
            ),
            mediakit_asr_timeout_seconds=_parse_positive_int_env(
                "MEDIAKIT_ASR_TIMEOUT_SECONDS",
                cls.model_fields["mediakit_asr_timeout_seconds"].default,
            ),
            mediakit_asr_language=_get_env_first("MEDIAKIT_ASR_LANGUAGE"),
            aigc_video_subtitle_extraction_concurrency=_parse_positive_int_env(
                "AIGC_VIDEO_SUBTITLE_EXTRACTION_CONCURRENCY",
                cls.model_fields[
                    "aigc_video_subtitle_extraction_concurrency"
                ].default,
            ),
            mediakit_video_ocr_poll_interval_seconds=_parse_positive_int_env(
                "MEDIAKIT_VIDEO_OCR_POLL_INTERVAL_SECONDS",
                cls.model_fields[
                    "mediakit_video_ocr_poll_interval_seconds"
                ].default,
            ),
            mediakit_video_ocr_timeout_seconds=_parse_positive_int_env(
                "MEDIAKIT_VIDEO_OCR_TIMEOUT_SECONDS",
                cls.model_fields["mediakit_video_ocr_timeout_seconds"].default,
            ),
            aigc_video_enhancement_concurrency=_parse_positive_int_env(
                "AIGC_VIDEO_ENHANCEMENT_CONCURRENCY",
                cls.model_fields["aigc_video_enhancement_concurrency"].default,
            ),
            mediakit_video_enhancement_poll_interval_seconds=_parse_positive_int_env(
                "MEDIAKIT_VIDEO_ENHANCEMENT_POLL_INTERVAL_SECONDS",
                cls.model_fields[
                    "mediakit_video_enhancement_poll_interval_seconds"
                ].default,
            ),
            mediakit_video_enhancement_timeout_seconds=_parse_positive_int_env(
                "MEDIAKIT_VIDEO_ENHANCEMENT_TIMEOUT_SECONDS",
                cls.model_fields[
                    "mediakit_video_enhancement_timeout_seconds"
                ].default,
            ),
            mediakit_video_enhancement_transfer_timeout_seconds=(
                _parse_positive_int_env(
                    "MEDIAKIT_VIDEO_ENHANCEMENT_TRANSFER_TIMEOUT_SECONDS",
                    cls.model_fields[
                        "mediakit_video_enhancement_transfer_timeout_seconds"
                    ].default,
                )
            ),
            mediakit_video_enhancement_transfer_max_bytes=_parse_positive_int_env(
                "MEDIAKIT_VIDEO_ENHANCEMENT_TRANSFER_MAX_BYTES",
                cls.model_fields[
                    "mediakit_video_enhancement_transfer_max_bytes"
                ].default,
            ),
            aigc_video_face_blur_concurrency=_parse_positive_int_env(
                "AIGC_VIDEO_FACE_BLUR_CONCURRENCY",
                cls.model_fields["aigc_video_face_blur_concurrency"].default,
            ),
            mediakit_face_blur_poll_interval_seconds=_parse_positive_int_env(
                "MEDIAKIT_FACE_BLUR_POLL_INTERVAL_SECONDS",
                cls.model_fields[
                    "mediakit_face_blur_poll_interval_seconds"
                ].default,
            ),
            mediakit_face_blur_timeout_seconds=_parse_positive_int_env(
                "MEDIAKIT_FACE_BLUR_TIMEOUT_SECONDS",
                cls.model_fields["mediakit_face_blur_timeout_seconds"].default,
            ),
            mediakit_face_blur_transfer_timeout_seconds=_parse_positive_int_env(
                "MEDIAKIT_FACE_BLUR_TRANSFER_TIMEOUT_SECONDS",
                cls.model_fields[
                    "mediakit_face_blur_transfer_timeout_seconds"
                ].default,
            ),
            mediakit_face_blur_transfer_max_bytes=_parse_positive_int_env(
                "MEDIAKIT_FACE_BLUR_TRANSFER_MAX_BYTES",
                cls.model_fields[
                    "mediakit_face_blur_transfer_max_bytes"
                ].default,
            ),
            aigc_multitrack_concurrency=_parse_positive_int_env(
                "AIGC_MULTITRACK_CONCURRENCY",
                cls.model_fields["aigc_multitrack_concurrency"].default,
            ),
            mediakit_multitrack_poll_interval_seconds=_parse_positive_int_env(
                "MEDIAKIT_MULTITRACK_POLL_INTERVAL_SECONDS",
                cls.model_fields[
                    "mediakit_multitrack_poll_interval_seconds"
                ].default,
            ),
            mediakit_multitrack_timeout_seconds=_parse_positive_int_env(
                "MEDIAKIT_MULTITRACK_TIMEOUT_SECONDS",
                cls.model_fields["mediakit_multitrack_timeout_seconds"].default,
            ),
            mediakit_multitrack_transfer_timeout_seconds=_parse_positive_int_env(
                "MEDIAKIT_MULTITRACK_TRANSFER_TIMEOUT_SECONDS",
                cls.model_fields[
                    "mediakit_multitrack_transfer_timeout_seconds"
                ].default,
            ),
            mediakit_multitrack_transfer_max_bytes=_parse_positive_int_env(
                "MEDIAKIT_MULTITRACK_TRANSFER_MAX_BYTES",
                cls.model_fields[
                    "mediakit_multitrack_transfer_max_bytes"
                ].default,
            ),
            asset_download_timeout_seconds=_parse_positive_int_env(
                "ASSET_DOWNLOAD_TIMEOUT_SECONDS",
                ark_image_timeout_seconds,
            ),
            asset_download_max_bytes=_parse_positive_int_env(
                "ASSET_DOWNLOAD_MAX_BYTES",
                cls.model_fields["asset_download_max_bytes"].default,
            ),
            composer_ffmpeg_path=_get_env_first("COMPOSER_FFMPEG_PATH"),
            composer_timeout_seconds=_parse_positive_int_env(
                "COMPOSER_TIMEOUT_SECONDS",
                cls.model_fields["composer_timeout_seconds"].default,
            ),
            db_host=_get_env_first("DB_HOST"),
            db_port=_parse_positive_int_env(
                "DB_PORT",
                cls.model_fields["db_port"].default,
            ),
            db_user=_get_env_first("DB_USER"),
            db_password=_get_secret_env_first("DB_PASSWORD"),
            db_name=_get_env_first("DB_NAME"),
            tos_access_key=_get_secret_env_first("TOS_ACCESS_KEY", "TOS_AK"),
            tos_secret_key=_get_secret_env_first("TOS_SECRET_KEY", "TOS_SK"),
            tos_endpoint=_get_env_first("TOS_ENDPOINT"),
            tos_public_endpoint=_get_env_first("TOS_PUBLIC_ENDPOINT"),
            tos_region=_get_env_first("TOS_REGION"),
            tos_bucket=_get_env_first("TOS_BUCKET"),
            tls_enabled=_parse_bool_env("TLS_ENABLED", False),
            tls_endpoint=getenv(
                "TLS_ENDPOINT",
                cls.model_fields["tls_endpoint"].default,
            ),
            tls_project_id=getenv(
                "TLS_PROJECT_ID",
                cls.model_fields["tls_project_id"].default,
            ),
            tls_topic_id=getenv(
                "TLS_TOPIC_ID",
                cls.model_fields["tls_topic_id"].default,
            ),
            tls_access_key_id=_get_secret_env_first("TLS_ACCESS_KEY_ID"),
            tls_secret_access_key=_get_secret_env_first("TLS_SECRET_ACCESS_KEY"),
            tls_batch_size=_parse_positive_int_env(
                "TLS_BATCH_SIZE",
                cls.model_fields["tls_batch_size"].default,
            ),
            tls_queue_capacity=_parse_positive_int_env(
                "TLS_QUEUE_CAPACITY",
                cls.model_fields["tls_queue_capacity"].default,
            ),
            tls_flush_interval_seconds=_parse_positive_int_env(
                "TLS_FLUSH_INTERVAL_SECONDS",
                cls.model_fields["tls_flush_interval_seconds"].default,
            ),
            tls_max_retries=_parse_nonnegative_int_env(
                "TLS_MAX_RETRIES",
                cls.model_fields["tls_max_retries"].default,
            ),
            tls_retry_initial_seconds=_parse_positive_int_env(
                "TLS_RETRY_INITIAL_SECONDS",
                cls.model_fields["tls_retry_initial_seconds"].default,
            ),
            tls_timeout_seconds=_parse_positive_int_env(
                "TLS_TIMEOUT_SECONDS",
                cls.model_fields["tls_timeout_seconds"].default,
            ),
        )

    def require_database_config(self) -> None:
        missing = _missing_env_names(
            {
                "DB_HOST": self.db_host,
                "DB_USER": self.db_user,
                "DB_PASSWORD": self.db_password,
                "DB_NAME": self.db_name,
            }
        )
        if missing:
            raise ConfigurationError(
                f"Missing required database configuration: {', '.join(missing)}."
            )

    def require_tos_config(self) -> None:
        missing = _missing_env_names(
            {
                "TOS_ACCESS_KEY or TOS_AK": self.tos_access_key,
                "TOS_SECRET_KEY or TOS_SK": self.tos_secret_key,
                "TOS_ENDPOINT": self.tos_endpoint,
                "TOS_REGION": self.tos_region,
                "TOS_BUCKET": self.tos_bucket,
            }
        )
        if missing:
            raise ConfigurationError(
                f"Missing required TOS configuration: {', '.join(missing)}."
            )

    def require_modelark_config(self) -> None:
        if self.ark_api_key is None:
            raise ConfigurationError(
                "Missing required ModelArk configuration: "
                "ARK_API_KEY or BYTEPLUS_ARK_API_KEY."
            )

    def require_mediakit_config(self) -> None:
        if self.mediakit_api_key is None:
            raise ConfigurationError(
                "Missing required MediaKit configuration: MEDIAKIT_API_KEY."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()
