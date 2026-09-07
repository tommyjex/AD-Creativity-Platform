from __future__ import annotations

import pytest

from backend.app.services.aigc_asset_naming import (
    AIGC_ASSET_NAME_MAX_BYTES,
    build_aigc_output_asset_name,
)


def _definition(nodes: list[dict[str, object]], *, version: int = 2) -> dict[str, object]:
    return {
        "schemaVersion": version,
        "nodes": nodes,
        "edges": [],
        "viewport": {"x": 0, "y": 0, "zoom": 1},
    }


def _node(
    node_id: str,
    node_type: str,
    config: dict[str, object] | None = None,
) -> dict[str, object]:
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": 0, "y": 0},
        "size": {"width": 240, "height": 180},
        "config": config or {},
    }


def test_build_name_uses_chinese_canvas_and_duplicate_node_order() -> None:
    definition = _definition(
        [
            _node("first", "image_to_image"),
            _node("text", "text"),
            _node("second", "image_to_image"),
        ]
    )

    assert build_aigc_output_asset_name(
        pipeline_name="商品主图",
        definition_snapshot=definition,
        node_id="second",
        mime_type="image/png",
        output_ordinal=0,
    ) == "商品主图-图生图2-图片1.png"


def test_build_name_migrates_v1_and_prefers_config_title() -> None:
    definition = _definition(
        [
            _node("first", "image_output", {"title": " 精修结果 "}),
            _node("second", "image_output", {"title": "精修结果"}),
        ],
        version=1,
    )

    assert build_aigc_output_asset_name(
        pipeline_name="画布",
        definition_snapshot=definition,
        node_id="second",
        mime_type="image/jpeg",
        output_ordinal=2,
    ) == "画布-精修结果2-图片3.jpg"


@pytest.mark.parametrize(
    ("operation", "expected"),
    [
        ("image_to_image", "图生图"),
        ("image_edit", "图片编辑"),
        ("layer_decomposition", "图层拆分"),
    ],
)
def test_build_name_maps_image_operations(operation: str, expected: str) -> None:
    assert build_aigc_output_asset_name(
        pipeline_name="画布",
        definition_snapshot=_definition(
            [_node("model", "image_to_image", {"operation": operation})]
        ),
        node_id="model",
        mime_type="image/webp",
        output_ordinal=0,
    ) == f"画布-{expected}-图片1.webp"


@pytest.mark.parametrize(
    ("mime_type", "expected"),
    [
        ("image/png", "画布-文生图-图片1.png"),
        ("image/jpeg", "画布-文生图-图片1.jpg"),
        ("image/webp", "画布-文生图-图片1.webp"),
        ("video/mp4", "画布-文生图-视频1.mp4"),
        ("video/quicktime", "画布-文生图-视频1.mov"),
        ("video/mov", "画布-文生图-视频1.mov"),
    ],
)
def test_build_name_uses_fixed_mime_mapping(
    mime_type: str,
    expected: str,
) -> None:
    assert build_aigc_output_asset_name(
        pipeline_name="画布",
        definition_snapshot=_definition([_node("model", "text_to_image")]),
        node_id="model",
        mime_type=mime_type,
        output_ordinal=0,
    ) == expected


def test_build_name_sanitizes_parts_and_uses_fixed_fallbacks() -> None:
    definition = _definition(
        [_node("model", "image", {"title": ' \t./\\:*?"<>|\x7f '})]
    )

    assert build_aigc_output_asset_name(
        pipeline_name=' . / 商品 \n -- " 画布 .. ',
        definition_snapshot=definition,
        node_id="model",
        mime_type="image/png",
        output_ordinal=0,
    ) == "商品-画布-AIGC节点-图片1.png"
    assert build_aigc_output_asset_name(
        pipeline_name=" .--\t ",
        definition_snapshot=definition,
        node_id="missing",
        mime_type="video/mp4",
        output_ordinal=1,
    ) == "AIGC画布-AIGC节点-视频2.mp4"


def test_build_name_truncates_canvas_first_on_utf8_boundary() -> None:
    definition = _definition(
        [_node("model", "image", {"title": "节点"})]
    )
    name = build_aigc_output_asset_name(
        pipeline_name="画" * 100,
        definition_snapshot=definition,
        node_id="model",
        mime_type="image/png",
        output_ordinal=0,
    )

    assert len(name.encode("utf-8")) <= AIGC_ASSET_NAME_MAX_BYTES
    assert name.endswith("-节点-图片1.png")
    assert "\ufffd" not in name


def test_build_name_truncates_node_only_after_canvas_reaches_one_character() -> None:
    definition = _definition(
        [_node("model", "image", {"title": "节点" * 60})]
    )
    name = build_aigc_output_asset_name(
        pipeline_name="画布" * 100,
        definition_snapshot=definition,
        node_id="model",
        mime_type="video/quicktime",
        output_ordinal=9,
    )

    assert len(name.encode("utf-8")) <= AIGC_ASSET_NAME_MAX_BYTES
    assert name.startswith("画-")
    assert name.endswith("-视频10.mov")


def test_build_name_rejects_unmapped_mime_type() -> None:
    with pytest.raises(ValueError, match="unsupported AIGC output MIME type"):
        build_aigc_output_asset_name(
            pipeline_name="画布",
            definition_snapshot=_definition([_node("model", "text_to_image")]),
            node_id="model",
            mime_type="image/gif",
            output_ordinal=0,
        )
