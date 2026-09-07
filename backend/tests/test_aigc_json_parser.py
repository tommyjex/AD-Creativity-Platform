from __future__ import annotations

import hashlib

import pytest

from backend.app.services.aigc_json_parser import (
    AigcJsonParserError,
    compile_json_path,
    parse_json_items,
)


def test_parse_json_items_accepts_plain_json_and_single_json_fence() -> None:
    plain = parse_json_items('{"items":["中文",{"b":2,"a":1}]}', "$.items")
    fenced = parse_json_items(
        '  ```json\n{"payload":{"items":[true,null]}}\n```  ',
        "$.payload.items",
    )

    assert [item.model_dump() for item in plain.items] == [
        {
            "index": 0,
            "text": "中文",
            "summary": hashlib.sha256("中文".encode()).hexdigest(),
        },
        {
            "index": 1,
            "text": '{"a":1,"b":2}',
            "summary": hashlib.sha256(b'{"a":1,"b":2}').hexdigest(),
        },
    ]
    assert [item.text for item in fenced.items] == ["true", "null"]


@pytest.mark.parametrize(
    "source",
    [
        "",
        "not json",
        "before\n```json\n{\"items\": []}\n```",
        "```json\n{\"items\": []}\n```\nafter",
        "```JSON\n{\"items\": []}\n```",
        "```json\n{\"items\": []}\n```\n```json\n{}\n```",
        '{"items":[NaN]}',
    ],
)
def test_parse_json_items_rejects_invalid_or_mixed_json(source: str) -> None:
    with pytest.raises(AigcJsonParserError) as error:
        parse_json_items(source, "$.items")

    assert error.value.code == "json_parser_invalid_json"
    if source:
        assert source not in str(error.value)


@pytest.mark.parametrize(
    ("source", "path", "code"),
    [
        ('{"other":[]}', "$.items", "json_parser_path_not_found"),
        ('{"items":[[],[]]}', "$.items[*]", "json_parser_path_ambiguous"),
        ('{"items":"no"}', "$.items", "json_parser_result_not_array"),
    ],
)
def test_parse_json_items_reports_stable_json_path_errors(
    source: str,
    path: str,
    code: str,
) -> None:
    with pytest.raises(AigcJsonParserError) as error:
        parse_json_items(source, path)

    assert error.value.code == code


def test_compile_json_path_reports_stable_error_without_expression_echo() -> None:
    with pytest.raises(AigcJsonParserError) as error:
        compile_json_path("$[")

    assert error.value.code == "json_parser_invalid_path"
    assert "$[" not in str(error.value)


def test_parse_json_items_accepts_empty_and_twenty_items_but_rejects_twenty_one() -> None:
    empty = parse_json_items('{"items":[]}', "$.items")
    twenty = parse_json_items(
        '{"items":[' + ",".join(str(index) for index in range(20)) + "]}",
        "$.items",
    )

    assert empty.items == []
    assert len(twenty.items) == 20
    assert twenty.items[-1].text == "19"

    with pytest.raises(AigcJsonParserError) as error:
        parse_json_items(
            '{"items":[' + ",".join(str(index) for index in range(21)) + "]}",
            "$.items",
        )
    assert error.value.code == "json_parser_item_limit_exceeded"
    assert error.value.details == {"actual": 21, "limit": 20}


def test_parse_json_items_canonicalizes_all_json_types_deterministically() -> None:
    result = parse_json_items(
        '{"items":["raw",{"é":"值","z":0},[2,1],1.5,false,null]}',
        "$.items",
    )

    assert [item.text for item in result.items] == [
        "raw",
        '{"z":0,"é":"值"}',
        "[2,1]",
        "1.5",
        "false",
        "null",
    ]
    assert [item.index for item in result.items] == list(range(6))
    assert all(len(item.summary) == 64 for item in result.items)
    assert result.model_dump() == parse_json_items(
        '{"items":["raw",{"z":0,"é":"值"},[2,1],1.5,false,null]}',
        "$.items",
    ).model_dump()
