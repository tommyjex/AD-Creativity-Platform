from datetime import datetime, timedelta, timezone

from backend.app.schemas.common import SchemaModel


class TimestampSchema(SchemaModel):
    timestamp: datetime


def test_schema_model_restores_utc_timezone_for_naive_database_values() -> None:
    model = TimestampSchema(timestamp=datetime(2026, 8, 15, 3, 0, 25))

    assert model.timestamp.tzinfo is timezone.utc
    assert model.model_dump(mode="json")["timestamp"] == "2026-08-15T03:00:25Z"


def test_schema_model_preserves_explicit_timezone() -> None:
    china_timezone = timezone(timedelta(hours=8))
    value = datetime(2026, 8, 15, 3, 0, 25, tzinfo=china_timezone)

    model = TimestampSchema(timestamp=value)

    assert model.timestamp is value
