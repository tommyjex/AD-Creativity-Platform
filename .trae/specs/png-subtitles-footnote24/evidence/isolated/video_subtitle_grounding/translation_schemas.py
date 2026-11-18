"""HTTP input contracts; SDK callers can retain their existing draft dictionaries."""

from pydantic import BaseModel, Field, model_validator


class TranslationRecord(BaseModel):
    segment_id: str = Field(min_length=1, max_length=128)
    text: str = Field(min_length=1, max_length=4000)
    block_id: str = Field(min_length=1, max_length=128)
    line_index: int = Field(ge=0)


class SubtitleProductRecognitionRequest(BaseModel):
    segments: list[TranslationRecord] = Field(min_length=1, max_length=500)
    segment_ids: list[str] | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def check_ids(self):
        ids = [record.segment_id for record in self.segments]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate segment_id")
        if self.segment_ids is not None and (
            len(self.segment_ids) != len(set(self.segment_ids))
            or not set(self.segment_ids).issubset(ids)
        ):
            raise ValueError("segment_ids must be unique and present in segments")
        return self


class SubtitleTranslateRequest(SubtitleProductRecognitionRequest):
    source_language: str = Field(default="auto", min_length=1, max_length=64)
    target_language: str = Field(min_length=1, max_length=64)


class SubtitleRenderRequest(BaseModel):
    segments: list[dict] = Field(min_length=1, max_length=500)
    video: dict
    idempotency_key: str = Field(min_length=1, max_length=256)
