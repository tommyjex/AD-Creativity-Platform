from __future__ import annotations

import os
from functools import lru_cache

from pydantic import BaseModel, ConfigDict, Field, SecretStr, model_validator


class ConfigurationError(ValueError):
    pass


class Settings(BaseModel):
    """Subtitle backend settings. Environment loading is explicit, never reads .env."""

    model_config = ConfigDict(extra="ignore")

    app_name: str = "video-subtitle-grounding"
    environment: str = "development"
    ark_api_key: SecretStr | None = None
    ark_base_url: str = "https://ark.cn-beijing.volces.com/api/v3"
    video_subtitle_grounding_model: str = Field(default="doubao-seed-evolving", min_length=1)
    video_subtitle_grounding_sampling_fps: float = Field(default=2, ge=0.5, le=5, allow_inf_nan=False)
    video_subtitle_grounding_max_output_tokens: int = Field(default=16384, gt=0)
    video_subtitle_grounding_download_max_bytes: int = Field(default=512 * 1024 * 1024, gt=0)
    video_subtitle_grounding_download_connect_timeout_seconds: int = Field(default=10, gt=0)
    video_subtitle_grounding_download_read_timeout_seconds: int = Field(default=60, gt=0)
    video_subtitle_grounding_download_total_timeout_seconds: int = Field(default=600, gt=0)
    video_subtitle_grounding_max_redirects: int = Field(default=3, ge=0)
    video_subtitle_grounding_file_processing_timeout_seconds: int = Field(default=600, gt=0)
    video_subtitle_grounding_model_timeout_seconds: int = Field(default=600, gt=0)
    enable_experimental_video_subtitle_grounding_debug: bool = False
    composer_ffmpeg_path: str | None = None
    composer_timeout_seconds: int = Field(default=900, gt=0)
    service_api_key: SecretStr | None = None
    max_concurrent_extractions: int = Field(default=1, gt=0)
    max_concurrent_translations: int = Field(default=1, gt=0)
    max_concurrent_render_requests: int = Field(default=1, gt=0)
    mediakit_api_key: SecretStr | None = None
    mediakit_base_url: str = "https://mediakit.cn-beijing.volces.com"
    mediakit_multitrack_poll_interval_seconds: int = Field(default=3, gt=0)
    mediakit_multitrack_timeout_seconds: int = Field(default=1800, gt=0)
    tls_enabled: bool = False
    tls_endpoint: str = "https://tls-cn-beijing.volces.com"
    tls_project_id: str = ""
    tls_topic_id: str = ""
    tls_access_key_id: SecretStr | None = None
    tls_secret_access_key: SecretStr | None = None
    tls_batch_size: int = Field(default=100, gt=0)
    tls_queue_capacity: int = Field(default=1000, gt=0)
    tls_flush_interval_seconds: int = Field(default=5, gt=0)
    tls_max_retries: int = Field(default=3, ge=0)
    tls_retry_initial_seconds: int = Field(default=1, gt=0)
    tls_timeout_seconds: int = Field(default=5, gt=0)
    tls_shutdown_timeout_seconds: int = Field(default=5, gt=0)

    @model_validator(mode="after")
    def validate_nonempty_secrets(self) -> Settings:
        for name in ("ark_api_key", "service_api_key", "mediakit_api_key", "tls_access_key_id", "tls_secret_access_key"):
            value = getattr(self, name)
            if value is not None and not value.get_secret_value().strip():
                raise ValueError(f"{name} must not be blank")
        return self

    @classmethod
    def from_environment(cls) -> Settings:
        values = {
            name: os.environ[name.upper()]
            for name in cls.model_fields
            if name.upper() in os.environ
        }
        # Unconfigured optional secrets in .env.example are represented as None.
        for name in ("ark_api_key", "service_api_key", "mediakit_api_key", "tls_access_key_id", "tls_secret_access_key"):
            if name in values and not values[name].strip():
                del values[name]
        if "APP_ENV" in os.environ:
            values["environment"] = os.environ["APP_ENV"]
        return cls.model_validate(values)

    def require_modelark_config(self) -> None:
        if self.ark_api_key is None:
            raise ConfigurationError("ARK_API_KEY is required.")

    def require_mediakit_config(self) -> None:
        if self.mediakit_api_key is None:
            raise ConfigurationError("MEDIAKIT_API_KEY is required.")

    def require_server_config(self) -> None:
        self.require_modelark_config()
        if self.service_api_key is None:
            raise ConfigurationError("SERVICE_API_KEY is required.")
        if self.tls_enabled and (
            not self.tls_project_id or not self.tls_topic_id
            or self.tls_access_key_id is None or self.tls_secret_access_key is None
        ):
            raise ConfigurationError("TLS is enabled but its configuration is incomplete.")
        if self.enable_experimental_video_subtitle_grounding_debug and not self.tls_enabled:
            raise ConfigurationError("Raw-output debugging requires TLS.")


@lru_cache
def get_settings() -> Settings:
    return Settings.from_environment()
