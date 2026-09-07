from __future__ import annotations

from copy import deepcopy

import pytest

from backend.app.schemas.aigc import (
    AIGC_V2_NODE_REGISTRY,
    AigcNodeType,
    AigcPipelineDefinitionV2,
    AigcPortType,
    AigcTaskType,
    MultiTrackEditConfig,
    normalize_multi_track_edit_config,
    validate_multi_track_edit_config,
)


def source(node_id: str, handle: str) -> dict[str, str]:
    return {"source_node_id": node_id, "source_handle": handle}


def transform(**overrides: object) -> dict[str, object]:
    return {
        "x": 0,
        "y": 0,
        "width": 1920,
        "height": 1080,
        "rotation": 0,
        **overrides,
    }


def video_element(element_id: str = "video-1", **overrides: object) -> dict[str, object]:
    return {
        "id": element_id,
        "type": "video",
        "source": source("video-source", "video"),
        "target_time": {"start_ms": 0, "end_ms": 2000},
        "source_trim": {"start_ms": 0, "end_ms": 2000},
        "loop": False,
        "transform": transform(),
        "speed": 1,
        "volume": 1,
        "fade_in_ms": 0,
        "fade_out_ms": 0,
        "transition": None,
        **overrides,
    }


def track(
    elements: list[dict[str, object]],
    *,
    track_id: str = "track-1",
    track_type: str = "video",
    hidden: bool = False,
) -> dict[str, object]:
    return {
        "id": track_id,
        "name": track_id,
        "type": track_type,
        "order": 0,
        "hidden": hidden,
        "muted": False,
        "elements": elements,
    }


def config_with(
    tracks: list[dict[str, object]],
    *,
    canvas: dict[str, object] | None = None,
) -> dict[str, object]:
    return {
        "canvas": canvas
        or {
            "mode": "custom",
            "width": 1920,
            "height": 1080,
            "background_color": "#000000FF",
        },
        "output": {"format": "mp4", "fps": 30},
        "tracks": tracks,
    }


def error_codes(payload: dict[str, object]) -> set[str]:
    config = MultiTrackEditConfig.model_validate(payload)
    return {issue.code for issue in validate_multi_track_edit_config(config)}


def test_multi_track_node_contract_and_draft_default() -> None:
    registration = next(
        item
        for item in AIGC_V2_NODE_REGISTRY
        if item.type == AigcNodeType.MULTI_TRACK_EDIT
    )
    assert AigcTaskType.MULTI_TRACK_EDIT.value == "multi_track_edit"
    assert registration.executable is True
    assert [
        (port.id, port.type, port.multiple, port.max_connections)
        for port in registration.inputs
    ] == [
        ("videos", AigcPortType.VIDEO_ASSET, True, 30),
        ("images", AigcPortType.IMAGE_ASSET, True, 50),
        ("audios", AigcPortType.AUDIO_ASSET, True, 30),
        ("texts", AigcPortType.TEXT, True, 30),
    ]
    assert [(port.id, port.type) for port in registration.outputs] == [
        ("video", AigcPortType.VIDEO_ASSET)
    ]

    definition = AigcPipelineDefinitionV2.model_validate(
        {
            "nodes": [
                {
                    "id": "edit",
                    "type": "multi_track_edit",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 280, "height": 200},
                    "config": {},
                }
            ]
        }
    )
    node_config = definition.nodes[0].config
    assert node_config.model_dump(mode="json") == {
        "canvas": {
            "mode": "auto",
            "width": None,
            "height": None,
            "background_color": "#000000FF",
        },
        "output": {"format": "mp4", "fps": 30},
        "tracks": [],
    }
    assert {issue.code for issue in validate_multi_track_edit_config(node_config)} == {
        "visible_track_required",
        "valid_element_required",
    }


def test_normalization_is_pure_and_canonicalizes_milliseconds_and_track_order() -> None:
    payload = config_with(
        [
            track(
                [
                    video_element(
                        target_time={"start_ms": 10.4, "end_ms": 2010.6},
                        source_trim={"start_ms": 0.2, "end_ms": 2000.2},
                        fade_in_ms=10.2,
                    )
                ],
                track_id="  video-track  ",
            )
        ]
    )
    original = deepcopy(payload)

    normalized = normalize_multi_track_edit_config(payload)

    assert payload == original
    assert normalized.tracks[0].id == "video-track"
    assert normalized.tracks[0].order == 0
    element = normalized.tracks[0].elements[0]
    assert element.target_time.start_ms == 10
    assert element.target_time.end_ms == 2011
    assert element.source_trim is not None
    assert element.source_trim.end_ms == 2000
    assert element.fade_in_ms == 10


@pytest.mark.parametrize(
    ("mutate", "expected"),
    [
        (lambda payload: payload.update(tracks=[]), {"visible_track_required", "valid_element_required"}),
        (
            lambda payload: payload["tracks"].extend(
                track([], track_id=f"track-{index}") for index in range(2, 22)
            ),
            {"track_limit_exceeded"},
        ),
        (
            lambda payload: payload["tracks"][0]["elements"].extend(
                video_element(f"video-{index}") for index in range(2, 202)
            ),
            {"element_limit_exceeded"},
        ),
        (
            lambda payload: payload["tracks"].append(
                track([video_element("video-2")], track_id="track-1")
            ),
            {"duplicate_track_id"},
        ),
        (
            lambda payload: payload["tracks"][0]["elements"].append(
                video_element("video-1", target_time={"start_ms": 2000, "end_ms": 4000})
            ),
            {"duplicate_element_id"},
        ),
    ],
)
def test_validate_quantity_and_identity_boundaries(
    mutate: object,
    expected: set[str],
) -> None:
    payload = config_with([track([video_element()])])
    mutate(payload)  # type: ignore[operator]
    assert expected <= error_codes(payload)


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({"target_time": {"start_ms": -1, "end_ms": 2000}}, "invalid_target_time"),
        ({"target_time": {"start_ms": 1000, "end_ms": 1000}}, "invalid_target_time"),
        ({"source_trim": {"start_ms": -1, "end_ms": 2000}}, "invalid_source_trim"),
        ({"source_trim": {"start_ms": 0, "end_ms": 1000}}, "duration_mismatch"),
        ({"speed": 0.09}, "invalid_speed"),
        ({"speed": 4.01}, "invalid_speed"),
        ({"volume": -0.01}, "invalid_volume"),
        ({"fade_in_ms": 2001}, "invalid_fade"),
        ({"fade_out_ms": 2001}, "invalid_fade"),
    ],
)
def test_validate_time_trim_speed_volume_and_fade_boundaries(
    overrides: dict[str, object],
    expected: str,
) -> None:
    assert expected in error_codes(config_with([track([video_element(**overrides)])]))


@pytest.mark.parametrize("speed", [0, -1, 0.000001])
def test_invalid_speed_short_circuits_duration_validation(speed: float) -> None:
    codes = error_codes(
        config_with([track([video_element(speed=speed)])])
    )

    assert "invalid_speed" in codes
    assert "duration_mismatch" not in codes


@pytest.mark.parametrize(
    ("speed", "source_end_ms"),
    [(0.1, 200), (4, 8000)],
)
def test_speed_boundaries_are_valid(
    speed: float,
    source_end_ms: int,
) -> None:
    assert error_codes(
        config_with(
            [
                track(
                    [
                        video_element(
                            speed=speed,
                            source_trim={
                                "start_ms": 0,
                                "end_ms": source_end_ms,
                            },
                        )
                    ]
                )
            ]
        )
    ) == set()


def test_validate_overlap_and_legal_video_transition() -> None:
    overlapping = config_with(
        [
            track(
                [
                    video_element("first"),
                    video_element(
                        "second",
                        target_time={"start_ms": 1800, "end_ms": 3800},
                    ),
                ]
            )
        ]
    )
    assert "track_overlap" in error_codes(overlapping)

    overlapping["tracks"][0]["elements"][0]["transition"] = {
        "type": "fade",
        "duration_ms": 200,
    }
    assert "track_overlap" not in error_codes(overlapping)
    overlapping["tracks"][0]["elements"][0]["transition"]["duration_ms"] = 2001
    assert {"invalid_transition", "track_overlap"} <= error_codes(overlapping)


def test_validate_transform_canvas_and_custom_canvas_boundaries() -> None:
    valid = config_with([track([video_element()])])
    assert error_codes(valid) == set()

    outside = deepcopy(valid)
    outside["tracks"][0]["elements"][0]["transform"]["x"] = 1
    assert "transform_out_of_canvas" in error_codes(outside)

    invalid_canvas = deepcopy(valid)
    invalid_canvas["canvas"]["width"] = 159
    assert "invalid_canvas_size" in error_codes(invalid_canvas)

    invalid_color = deepcopy(valid)
    invalid_color["canvas"]["background_color"] = "#000000"
    assert "invalid_background_color" in error_codes(invalid_color)


def test_validate_text_and_subtitle_contracts() -> None:
    text_element = {
        "id": "text-1",
        "type": "text",
        "source": None,
        "inline_text": "标题",
        "target_time": {"start_ms": 0, "end_ms": 2000},
        "loop": False,
        "transform": transform(width=800, height=200),
        "style": {
            "font_size": 48,
            "color": "#FFFFFFFF",
            "bold": False,
            "italic": False,
            "underline": False,
            "background_color": "#00000000",
        },
    }
    subtitle_element = {
        "id": "subtitle-1",
        "type": "subtitle",
        "asset_id": "subtitle-asset",
        "target_time": {"start_ms": 0, "end_ms": 2000},
        "loop": False,
        "transform": transform(y=800, width=1200, height=200),
        "style": text_element["style"],
    }
    payload = config_with(
        [
            track([text_element], track_id="text-track", track_type="text"),
            track(
                [subtitle_element],
                track_id="subtitle-track",
                track_type="subtitle",
            ),
        ]
    )
    assert error_codes(payload) == set()

    payload["tracks"][0]["elements"][0]["inline_text"] = " "
    assert "text_source_required" in error_codes(payload)
    payload["tracks"][1]["elements"].append(
        {**subtitle_element, "id": "subtitle-2"}
    )
    assert "subtitle_track_element_limit" in error_codes(payload)

    for index in range(2, 12):
        payload["tracks"].append(
            track(
                [{**subtitle_element, "id": f"subtitle-{index}"}],
                track_id=f"subtitle-track-{index}",
                track_type="subtitle",
            )
        )
    assert "subtitle_track_limit_exceeded" in error_codes(payload)
