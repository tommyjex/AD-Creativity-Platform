from __future__ import annotations

from dataclasses import replace

import pytest

from backend.app.schemas.video_subtitle_grounding import (
    VideoSubtitleGroundingErrorCode,
    VideoSubtitleGroundingErrorPhase,
    VideoSubtitleGroundingUsage,
)
from backend.app.services.media_inspector import VideoDisplayMetadata
from backend.app.services.modelark_video_subtitle_grounding import (
    ModelArkSubtitleGroundingSegment,
    ModelArkVideoSubtitleGroundingResult,
)
from backend.app.services.video_subtitle_grounding_validation import (
    VideoSubtitleGroundingValidationError,
    validate_and_convert_subtitles,
)


def _segment(
    *,
    text: object = "Example subtitle",
    start_ms: object = 1200,
    end_ms: object = 2600,
    bbox: object = "<bbox>120 820 880 920</bbox>",
    visual_role: object = "body",
    font_height_ratio: object = 0.05,
    alignment: object = "center",
    block_id: object = "block_0",
    line_index: object = 0,
    background_color: object = "#123456",
) -> ModelArkSubtitleGroundingSegment:
    return ModelArkSubtitleGroundingSegment(
        text=text,  # type: ignore[arg-type]
        start_ms=start_ms,  # type: ignore[arg-type]
        end_ms=end_ms,  # type: ignore[arg-type]
        bbox=bbox,  # type: ignore[arg-type]
        visual_role=visual_role,
        font_height_ratio=font_height_ratio,
        alignment=alignment,
        block_id=block_id,
        line_index=line_index,
        background_color=background_color,
    )


def _result(
    *segments: ModelArkSubtitleGroundingSegment,
) -> ModelArkVideoSubtitleGroundingResult:
    return ModelArkVideoSubtitleGroundingResult(
        model="doubao-seed-evolving",
        subtitles=tuple(segments),
        usage=VideoSubtitleGroundingUsage(),
        request_id=None,
    )


def _video(
    *,
    encoded_width: int = 1920,
    encoded_height: int = 1080,
    display_width: int = 1920,
    display_height: int = 1080,
    duration_seconds: float = 30.0,
    rotation: int = 0,
) -> VideoDisplayMetadata:
    return VideoDisplayMetadata(
        encoded_width=encoded_width,
        encoded_height=encoded_height,
        display_width=display_width,
        display_height=display_height,
        duration_seconds=duration_seconds,
        rotation=rotation,  # type: ignore[arg-type]
        container="mov,mp4",
        codec="h264",
    )


def _assert_invalid(
    result: ModelArkVideoSubtitleGroundingResult,
    video: VideoDisplayMetadata | None = None,
) -> None:
    with pytest.raises(VideoSubtitleGroundingValidationError) as exc_info:
        validate_and_convert_subtitles(result, video or _video())
    assert exc_info.value.code == VideoSubtitleGroundingErrorCode.INVALID_MODEL_OUTPUT
    assert (
        exc_info.value.phase
        == VideoSubtitleGroundingErrorPhase.RESPONSE_VALIDATION
    )


def test_official_bbox_is_parsed_and_converted_for_landscape_video() -> None:
    subtitles = validate_and_convert_subtitles(
        _result(_segment(bbox="<bbox>100 200 900 800</bbox>")),
        _video(),
    )

    assert len(subtitles) == 1
    assert subtitles[0].bbox_normalized == (100, 200, 900, 800)
    assert subtitles[0].bbox_pixels == (192, 216, 1728, 864)


def test_rotated_portrait_uses_display_dimensions() -> None:
    subtitles = validate_and_convert_subtitles(
        _result(_segment(bbox="<bbox>100 200 900 800</bbox>")),
        _video(
            display_width=1080,
            display_height=1920,
            rotation=90,
        ),
    )

    assert subtitles[0].bbox_pixels == (108, 384, 972, 1536)


def test_all_four_coordinates_use_truncation_for_non_divisible_values() -> None:
    subtitles = validate_and_convert_subtitles(
        _result(_segment(bbox="<bbox>1 2 998 999</bbox>")),
        _video(display_width=1919, display_height=1079),
    )

    assert subtitles[0].bbox_pixels == (1, 2, 1915, 1077)


def test_zero_and_999_boundaries_are_accepted() -> None:
    subtitles = validate_and_convert_subtitles(
        _result(_segment(bbox="<bbox>0 0 999 999</bbox>")),
        _video(),
    )

    assert subtitles[0].bbox_normalized == (0, 0, 999, 999)
    assert subtitles[0].bbox_pixels == (0, 0, 1918, 1078)


@pytest.mark.parametrize(
    "bbox",
    [
        [120, 820, 880, 920],
        "<bbox>120,820,880,920</bbox>",
        "prefix <bbox>120 820 880 920</bbox>",
        "<bbox>120 820 880 920</bbox> suffix",
        "<bbox>120 820 880 920</bbox><bbox>120 820 880 920</bbox>",
        "<bbox>120  820 880 920</bbox>",
        "<bbox> 120 820 880 920</bbox>",
        "<bbox>120 820 880 920 </bbox>",
        "<BBOX>120 820 880 920</BBOX>",
        "<bbox>120 820 880 920",
        "120 820 880 920",
        "<bbox>120.0 820 880 920</bbox>",
        "<bbox>+120 820 880 920</bbox>",
        "<bbox>-1 820 880 920</bbox>",
        "<bbox>１２0 820 880 920</bbox>",
    ],
)
def test_rejects_non_official_bbox_full_string_formats(bbox: object) -> None:
    _assert_invalid(_result(_segment(bbox=bbox)))


@pytest.mark.parametrize(
    "bbox",
    [
        "<bbox>0 0 1000 999</bbox>",
        "<bbox>0 0 999 1000</bbox>",
        "<bbox>500 0 500 999</bbox>",
        "<bbox>501 0 500 999</bbox>",
        "<bbox>0 500 999 500</bbox>",
        "<bbox>0 501 999 500</bbox>",
    ],
)
def test_rejects_out_of_range_or_non_positive_normalized_bbox(bbox: str) -> None:
    _assert_invalid(_result(_segment(bbox=bbox)))


def test_rejects_bbox_that_collapses_to_zero_pixel_area() -> None:
    _assert_invalid(
        _result(_segment(bbox="<bbox>1 1 2 2</bbox>")),
        _video(display_width=100, display_height=100),
    )


@pytest.mark.parametrize(
    "text",
    [
        "",
        " \t ",
        "a" * 501,
        "visible\nhidden",
        "visible\x00hidden",
        123,
    ],
)
def test_rejects_invalid_text(text: object) -> None:
    _assert_invalid(_result(_segment(text=text)))


def test_trims_text_before_length_validation() -> None:
    subtitles = validate_and_convert_subtitles(
        _result(_segment(text=f" {'a' * 500} ")),
        _video(),
    )

    assert subtitles[0].text == "a" * 500


@pytest.mark.parametrize(
    ("start_ms", "end_ms"),
    [
        (-1, 100),
        (100, 100),
        (101, 100),
        (0.0, 100),
        (0, 100.0),
        (False, 100),
        (0, True),
    ],
)
def test_rejects_invalid_or_non_integer_times(
    start_ms: object,
    end_ms: object,
) -> None:
    _assert_invalid(_result(_segment(start_ms=start_ms, end_ms=end_ms)))


def test_duration_allows_exactly_250ms_tolerance() -> None:
    accepted = validate_and_convert_subtitles(
        _result(_segment(start_ms=29_999, end_ms=30_250)),
        _video(),
    )

    assert accepted[0].end_ms == 30_250
    _assert_invalid(_result(_segment(start_ms=29_999, end_ms=30_251)))


def test_exact_duplicates_are_removed_and_sort_is_stable() -> None:
    first_equal_time = _segment(
        text="first",
        start_ms=200,
        end_ms=400,
        bbox="<bbox>10 10 100 100</bbox>",
    )
    second_equal_time = _segment(
        text="second",
        start_ms=200,
        end_ms=400,
        bbox="<bbox>20 20 200 200</bbox>",
    )
    earlier_end = _segment(
        text="earlier end",
        start_ms=200,
        end_ms=300,
        bbox="<bbox>30 30 300 300</bbox>",
    )
    earliest = _segment(
        text="earliest",
        start_ms=100,
        end_ms=900,
        bbox="<bbox>40 40 400 400</bbox>",
    )

    subtitles = validate_and_convert_subtitles(
        _result(
            first_equal_time,
            second_equal_time,
            replace(first_equal_time),
            earlier_end,
            earliest,
        ),
        _video(),
    )

    assert [subtitle.text for subtitle in subtitles] == [
        "earliest",
        "earlier end",
        "first",
        "second",
    ]


def test_nearby_but_non_identical_segments_are_not_merged() -> None:
    subtitles = validate_and_convert_subtitles(
        _result(
            _segment(text="same", start_ms=100, end_ms=200),
            _segment(text="same", start_ms=101, end_ms=200),
            _segment(
                text="same",
                start_ms=100,
                end_ms=200,
                bbox="<bbox>121 820 880 920</bbox>",
            ),
        ),
        _video(),
    )

    assert len(subtitles) == 3


def test_preserves_valid_style_and_multiline_grouping() -> None:
    result = validate_and_convert_subtitles(
        _result(
            _segment(
                text="line one",
                visual_role="headline",
                font_height_ratio=0.062,
                alignment="left",
                block_id="block_07",
                line_index=0,
            ),
            _segment(
                text="line two",
                bbox="<bbox>120 920 880 980</bbox>",
                visual_role="footnote",
                font_height_ratio=0.03,
                alignment="left",
                block_id="block_07",
                line_index=1,
            ),
        ),
        _video(),
    )

    assert [subtitle.block_id for subtitle in result.subtitles] == [
        "block_07",
        "block_07",
    ]
    assert [subtitle.line_index for subtitle in result.subtitles] == [0, 1]
    assert result.subtitles[0].visual_role.value == "headline"
    assert result.subtitles[1].visual_role.value == "footnote"


def test_invalid_style_fields_fall_back_independently() -> None:
    result = validate_and_convert_subtitles(
        _result(
            _segment(
                bbox="<bbox>800 700 900 740</bbox>",
                visual_role="unknown",
                font_height_ratio=float("nan"),
                alignment="diagonal",
                block_id="contains space",
                line_index=-1,
            )
        ),
        _video(),
    )
    subtitle = result.subtitles[0]

    assert subtitle.visual_role.value == "body"
    assert subtitle.font_height_ratio == pytest.approx(0.04)
    assert subtitle.alignment.value == "right"
    assert subtitle.block_id == "segment_0"
    assert subtitle.line_index == 0
    assert result.stats.style_fallback_counts == {
        "alignment": 1,
        "block_id": 1,
        "font_height_ratio": 1,
        "line_index": 1,
        "visual_role": 1,
    }


def test_drops_invalid_core_segment_but_keeps_valid_sibling() -> None:
    result = validate_and_convert_subtitles(
        _result(
            _segment(text="valid"),
            _segment(text="invalid\nline"),
        ),
        _video(),
    )

    assert [subtitle.text for subtitle in result.subtitles] == ["valid"]
    assert result.stats.invalid_segment_count == 1


def test_rejects_nonempty_provider_result_when_every_segment_is_invalid() -> None:
    _assert_invalid(
        _result(
            _segment(text="invalid\nline"),
            _segment(bbox="<bbox>900 820 100 920</bbox>"),
        )
    )


def test_accepts_500_segments_and_rejects_501_before_deduplication() -> None:
    segment = _segment(start_ms=0, end_ms=1)

    accepted = validate_and_convert_subtitles(
        _result(*(replace(segment) for _ in range(500))),
        _video(),
    )
    assert len(accepted) == 1

    _assert_invalid(_result(*(replace(segment) for _ in range(501))))


def test_accepts_empty_provider_result() -> None:
    result = validate_and_convert_subtitles(_result(), _video())
    assert result.subtitles == ()
    assert result.stats.invalid_segment_count == 0


@pytest.mark.parametrize("color", ["#FAFAFA", "#aBcDeF", "#000000"])
def test_preserves_scene_background_color_without_style_fallback(color) -> None:
    result = validate_and_convert_subtitles(
        _result(_segment(background_color=color)), _video()
    )

    assert result[0].background_color == color.upper()
    assert result[0].warnings == []
    assert result.stats.style_fallback_counts == {}


@pytest.mark.parametrize(
    "color",
    [None, "", "#FFF", "#12345678", "white", "#GG0000", "#123456\n",
     " #123456", 123, False, [], {"color": "#123456"}],
)
def test_untrusted_background_downgrades_without_dropping_subtitle(color) -> None:
    result = validate_and_convert_subtitles(
        _result(_segment(background_color=color)), _video()
    )

    assert len(result) == 1
    assert result[0].background_color is None
    assert result[0].warnings == ["background_color_unavailable"]
    assert result[0].block_id == "block_0"
    assert result[0].line_index == 0
    assert result.stats.invalid_segment_count == 0
    assert result.stats.style_fallback_counts == {"background_color": 1}


def test_background_fallback_retains_full_frame_roles_and_single_row_blocks() -> None:
    result = validate_and_convert_subtitles(
        _result(
            _segment(
                text="headline", bbox="<bbox>100 10 900 80</bbox>",
                visual_role="headline", block_id="title", background_color="#EFEFEF",
            ),
            _segment(
                text="second row", bbox="<bbox>100 90 900 140</bbox>",
                block_id="title", line_index=1, background_color=None,
            ),
            _segment(
                text="part label", bbox="<bbox>10 300 200 340</bbox>",
                alignment="left", block_id="label", background_color="invalid",
            ),
            _segment(
                text="footnote", bbox="<bbox>100 940 900 970</bbox>",
                visual_role="footnote", block_id="note", background_color="#101010",
            ),
        ),
        _video(),
    )

    assert [subtitle.text for subtitle in result] == [
        "headline", "second row", "part label", "footnote",
    ]
    assert [subtitle.block_id for subtitle in result] == ["title", "title", "label", "note"]
    assert [subtitle.line_index for subtitle in result] == [0, 1, 0, 0]
    assert [subtitle.background_color for subtitle in result] == [
        "#EFEFEF", None, None, "#101010",
    ]
    assert result[0].visual_role.value == "headline"
    assert result[2].alignment.value == "left"
    assert result[3].visual_role.value == "footnote"
    assert result.stats.style_fallback_counts == {"background_color": 2}
