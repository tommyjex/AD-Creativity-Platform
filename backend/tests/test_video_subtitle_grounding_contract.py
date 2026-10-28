import pytest
from pydantic import ValidationError

from backend.app.schemas.video_subtitle_grounding import (
    VideoSubtitleAlignment,
    VideoSubtitleGroundingError,
    VideoSubtitleGroundingErrorCode,
    VideoSubtitleGroundingErrorPhase,
    VideoSubtitleGroundingRequest,
    VideoSubtitleGroundingResponse,
    VideoSubtitleVisualRole,
)


def _response_payload() -> dict[str, object]:
    return {
        "model": "doubao-seed-evolving",
        "video": {
            "width": 1920,
            "height": 1080,
            "duration_ms": 30_000,
            "rotation": 0,
        },
        "subtitles": [
            {
                "text": "Example subtitle",
                "start_ms": 1200,
                "end_ms": 2600,
                "bbox_normalized": [120, 820, 880, 920],
                "bbox_pixels": [230, 885, 1689, 993],
                "visual_role": "headline",
                "font_height_ratio": 0.062,
                "alignment": "center",
                "block_id": "block_07",
                "line_index": 0,
            }
        ],
        "usage": {
            "input_tokens": 10,
            "output_tokens": 20,
            "total_tokens": 30,
        },
        "latency_ms": 1250,
    }


def test_request_defaults_sampling_fps_and_accepts_boundaries() -> None:
    request = VideoSubtitleGroundingRequest(
        video_url="https://example.com/input.mp4"
    )

    assert request.video_url == "https://example.com/input.mp4"
    assert request.sampling_fps == 2.0
    assert (
        VideoSubtitleGroundingRequest(
            video_url="https://example.com/input.mp4",
            sampling_fps=0.5,
        ).sampling_fps
        == 0.5
    )
    assert (
        VideoSubtitleGroundingRequest(
            video_url="https://example.com/input.mp4",
            sampling_fps=5.0,
        ).sampling_fps
        == 5.0
    )


@pytest.mark.parametrize("sampling_fps", [0.49, 5.01, float("inf"), float("nan")])
def test_request_rejects_invalid_sampling_fps(sampling_fps: float) -> None:
    with pytest.raises(ValidationError):
        VideoSubtitleGroundingRequest(
            video_url="https://example.com/input.mp4",
            sampling_fps=sampling_fps,
        )


def test_request_and_nested_response_reject_extra_fields() -> None:
    with pytest.raises(ValidationError, match="extra_forbidden"):
        VideoSubtitleGroundingRequest.model_validate(
            {
                "video_url": "https://example.com/input.mp4",
                "unexpected": True,
            }
        )

    payload = _response_payload()
    video = payload["video"]
    assert isinstance(video, dict)
    video["codec"] = "h264"
    with pytest.raises(ValidationError, match="extra_forbidden"):
        VideoSubtitleGroundingResponse.model_validate(payload)


def test_response_contract_preserves_bbox_and_usage_shapes() -> None:
    response = VideoSubtitleGroundingResponse.model_validate(_response_payload())

    assert response.model == "doubao-seed-evolving"
    assert response.video.width == 1920
    assert response.video.rotation == 0
    assert response.subtitles[0].bbox_normalized == (120, 820, 880, 920)
    assert response.subtitles[0].bbox_pixels == (230, 885, 1689, 993)
    assert response.usage.total_tokens == 30
    assert response.latency_ms == 1250


def test_response_contract_preserves_normalized_style_metadata() -> None:
    response = VideoSubtitleGroundingResponse.model_validate(_response_payload())
    subtitle = response.subtitles[0]

    assert subtitle.visual_role == VideoSubtitleVisualRole.HEADLINE
    assert subtitle.font_height_ratio == 0.062
    assert subtitle.alignment == VideoSubtitleAlignment.CENTER
    assert subtitle.block_id == "block_07"
    assert subtitle.line_index == 0


def test_response_contract_backfills_legacy_style_metadata() -> None:
    payload = _response_payload()
    subtitles = payload["subtitles"]
    assert isinstance(subtitles, list)
    subtitle = subtitles[0]
    assert isinstance(subtitle, dict)
    for field in (
        "visual_role",
        "font_height_ratio",
        "alignment",
        "block_id",
        "line_index",
    ):
        subtitle.pop(field)

    response = VideoSubtitleGroundingResponse.model_validate(payload)

    assert response.subtitles[0].visual_role == VideoSubtitleVisualRole.BODY
    assert response.subtitles[0].font_height_ratio == 0.1
    assert response.subtitles[0].alignment == VideoSubtitleAlignment.CENTER
    assert response.subtitles[0].block_id == "legacy"
    assert response.subtitles[0].line_index == 0


@pytest.mark.parametrize("color", ["#FAFAFA", "#123abc", "#000000", None])
def test_response_contract_accepts_nullable_scene_background(color) -> None:
    payload = _response_payload()
    payload["subtitles"][0]["background_color"] = color

    subtitle = VideoSubtitleGroundingResponse.model_validate(payload).subtitles[0]

    assert subtitle.background_color == color
    assert subtitle.warnings == (
        ["background_color_unavailable"] if color is None else []
    )


def test_response_contract_backfills_historical_background_with_warning() -> None:
    response = VideoSubtitleGroundingResponse.model_validate(_response_payload())

    assert response.subtitles[0].background_color is None
    assert response.subtitles[0].warnings == ["background_color_unavailable"]
    assert VideoSubtitleGroundingResponse.model_validate(
        response.model_dump(mode="json")
    ) == response


@pytest.mark.parametrize("color", ["#FFF", "white", "#123456\n", 123, False])
def test_domain_response_rejects_unnormalized_invalid_color(color) -> None:
    payload = _response_payload()
    payload["subtitles"][0]["background_color"] = color

    with pytest.raises(ValidationError):
        VideoSubtitleGroundingResponse.model_validate(payload)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("start_ms", 1200.0),
        ("end_ms", 2600.0),
        ("bbox_normalized", [120, 820, 120, 920]),
        ("bbox_pixels", [230, 885, 230, 993]),
    ],
)
def test_response_rejects_non_strict_times_and_empty_bboxes(
    field: str,
    value: object,
) -> None:
    payload = _response_payload()
    subtitles = payload["subtitles"]
    assert isinstance(subtitles, list)
    subtitle = subtitles[0]
    assert isinstance(subtitle, dict)
    subtitle[field] = value

    with pytest.raises(ValidationError):
        VideoSubtitleGroundingResponse.model_validate(payload)


def test_stable_error_codes_and_phases_cover_pipeline_boundaries() -> None:
    assert {code.value for code in VideoSubtitleGroundingErrorCode} == {
        "invalid_video_url",
        "invalid_video_input",
        "video_download_failed",
        "media_probe_failed",
        "model_file_upload_failed",
        "model_file_processing_failed",
        "model_request_failed",
        "invalid_model_output",
        "cleanup_failed",
    }
    assert {phase.value for phase in VideoSubtitleGroundingErrorPhase} == {
        "url_validation",
        "download",
        "media_probe",
        "files_upload",
        "files_processing",
        "responses",
        "response_validation",
        "cleanup",
    }

    error = VideoSubtitleGroundingError(
        code=VideoSubtitleGroundingErrorCode.INVALID_MODEL_OUTPUT,
        phase=VideoSubtitleGroundingErrorPhase.RESPONSE_VALIDATION,
        message="The model response was invalid.",
    )
    assert error.model_dump(mode="json") == {
        "code": "invalid_model_output",
        "phase": "response_validation",
        "message": "The model response was invalid.",
    }
