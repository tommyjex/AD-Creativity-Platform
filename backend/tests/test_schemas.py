import pytest
from pydantic import ValidationError

from backend.app.schemas import (
    AssetCreate,
    AssetType,
    BriefCreate,
    BriefUpdate,
    CharacterAssetIterationRequest,
    CharacterCardCreate,
    CharacterCardUpdate,
    GenerationTaskCreate,
    ProjectCreate,
    Stage,
    Status,
    TargetLanguage,
    TextArtifactCreate,
)


def test_project_create_accepts_valid_nested_brief(project_payload: dict[str, object]) -> None:
    project = ProjectCreate.model_validate(project_payload)

    assert project.name == "Launch Campaign"
    assert project.brief.product_name == "AdPilot"
    assert project.brief.aspect_ratio == "9:16"
    assert project.brief.target_language == TargetLanguage.ZH


def test_brief_target_language_accepts_english_and_defaults_to_chinese() -> None:
    default_brief = BriefCreate.model_validate({"prompt": "make an ad"})
    english_brief = BriefCreate.model_validate(
        {"prompt": "make an ad", "target_language": "en"}
    )

    assert default_brief.target_language == TargetLanguage.ZH
    assert english_brief.target_language == TargetLanguage.EN


@pytest.mark.parametrize("value", [None, "", "fr", "ZH"])
def test_brief_target_language_rejects_null_and_invalid_values(
    value: object,
) -> None:
    with pytest.raises(ValidationError):
        BriefCreate.model_validate(
            {"prompt": "make an ad", "target_language": value}
        )

    with pytest.raises(ValidationError):
        BriefUpdate.model_validate({"target_language": value})


def test_brief_update_allows_omitted_target_language() -> None:
    update = BriefUpdate.model_validate({"style": "documentary"})

    assert "target_language" not in update.model_fields_set


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"prompt": "", "aspect_ratio": "9:16"}, "prompt"),
        ({"prompt": "make an ad", "aspect_ratio": "21:9"}, "aspect_ratio"),
        ({"prompt": "make an ad", "duration_seconds": 0}, "duration_seconds"),
        ({"prompt": "make an ad", "unexpected": "value"}, "unexpected"),
    ],
)
def test_brief_create_rejects_invalid_payloads(
    payload: dict[str, object],
    field: str,
) -> None:
    with pytest.raises(ValidationError) as exc_info:
        BriefCreate.model_validate(payload)

    assert field in str(exc_info.value)


def test_generation_task_create_enforces_progress_bounds() -> None:
    with pytest.raises(ValidationError):
        GenerationTaskCreate(
            project_id="project-1",
            stage=Stage.STORY,
            progress=1.1,
        )


def test_text_artifact_create_requires_positive_version() -> None:
    with pytest.raises(ValidationError):
        TextArtifactCreate(
            project_id="project-1",
            stage=Stage.STORY,
            content="story",
            version=0,
        )


def test_asset_create_defaults_to_queued_status() -> None:
    asset = AssetCreate(
        project_id="project-1",
        type=AssetType.GENERATED_IMAGE,
        stage=Stage.IMAGE,
    )

    assert asset.status == Status.QUEUED


def test_character_card_create_strips_text_and_defaults_to_draft() -> None:
    card = CharacterCardCreate(
        project_id=" project-1 ",
        name=" 主播 ",
        description=" 年轻通勤女性，真实广告片质感 ",
        sort_order=1,
    )

    assert card.project_id == "project-1"
    assert card.name == "主播"
    assert card.description == "年轻通勤女性，真实广告片质感"
    assert card.status == Status.DRAFT


def test_character_card_update_requires_at_least_one_field() -> None:
    with pytest.raises(ValidationError):
        CharacterCardUpdate()


def test_character_asset_iteration_request_strips_prompt() -> None:
    payload = CharacterAssetIterationRequest(
        asset_id=" asset-1 ",
        prompt=" make the outfit warmer ",
        operation_type="edit",
    )

    assert payload.asset_id == "asset-1"
    assert payload.prompt == "make the outfit warmer"
