from __future__ import annotations

import json

import pytest

from backend.app.services.text_streaming import (
    IncrementalJsonStringExtractor,
    encode_sse,
)


@pytest.mark.parametrize("chunk_size", [1, 2, 3, 7, 64])
def test_incremental_json_string_extractor_handles_arbitrary_boundaries(
    chunk_size: int,
) -> None:
    expected = '第一行\n含引号："测试"、反斜杠 \\ 和 emoji 😀'
    raw = json.dumps(
        {
            "title": "标题",
            "content": expected,
            "storyboard_shots": [],
        },
        ensure_ascii=True,
    )
    extractor = IncrementalJsonStringExtractor("content")
    deltas = []

    for start in range(0, len(raw), chunk_size):
        deltas.append(extractor.feed(raw[start : start + chunk_size]).delta)

    assert "".join(deltas) == expected
    assert extractor.raw_json == raw


def test_incremental_json_string_extractor_ignores_same_key_inside_text() -> None:
    raw = json.dumps(
        {
            "title": '正文提到 "content": "错误值"',
            "content": "正确正文",
        },
        ensure_ascii=False,
    )
    extractor = IncrementalJsonStringExtractor("content")

    result = extractor.feed(raw)

    assert result.delta == "正确正文"
    assert result.complete is True


def test_incremental_json_string_extractor_rejects_non_string_target() -> None:
    extractor = IncrementalJsonStringExtractor("content")

    with pytest.raises(ValueError, match="must be a string"):
        extractor.feed('{"content":123}')


def test_encode_sse_uses_json_and_preserves_chinese() -> None:
    encoded = encode_sse("delta", {"text": "中文\n正文"})

    assert encoded.startswith("event: delta\ndata: ")
    assert "\\n" in encoded
    assert "中文" in encoded
    assert encoded.endswith("\n\n")
