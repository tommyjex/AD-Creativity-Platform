from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SchemaModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
    )

    @field_validator("*", mode="before", check_fields=False)
    @classmethod
    def restore_utc_timezone(cls, value: object) -> object:
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
