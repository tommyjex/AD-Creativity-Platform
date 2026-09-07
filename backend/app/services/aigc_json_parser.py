from __future__ import annotations

from functools import lru_cache
import hashlib
import json
from typing import Any

from jsonpath_ng.ext import parse
from jsonpath_ng.exceptions import JsonPathLexerError, JsonPathParserError
from jsonpath_ng.jsonpath import JSONPath

from backend.app.schemas.aigc import (
    AIGC_JSON_PARSER_MAX_ITEMS,
    AigcJsonParserItem,
    AigcResultKind,
    AigcTaskResult,
)


class AigcJsonParserError(ValueError):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        details: dict[str, int] | None = None,
    ) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message
        self.details = details or {}


@lru_cache(maxsize=256)
def compile_json_path(expression: str) -> JSONPath:
    try:
        return parse(expression)
    except (JsonPathLexerError, JsonPathParserError, TypeError) as error:
        raise AigcJsonParserError(
            "json_parser_invalid_path",
            "JSONPath 表达式无效",
        ) from error


def parse_json_items(source: str, json_path: str) -> AigcTaskResult:
    document = _parse_json_document(source)
    expression = compile_json_path(json_path)
    matches = expression.find(document)
    if not matches:
        raise AigcJsonParserError(
            "json_parser_path_not_found",
            "JSONPath 未匹配到结果",
        )
    if len(matches) != 1:
        raise AigcJsonParserError(
            "json_parser_path_ambiguous",
            "JSONPath 必须且只能匹配一个结果",
            details={"matches": len(matches)},
        )

    selected = matches[0].value
    if not isinstance(selected, list):
        raise AigcJsonParserError(
            "json_parser_result_not_array",
            "JSONPath 匹配结果必须是数组",
        )
    if len(selected) > AIGC_JSON_PARSER_MAX_ITEMS:
        raise AigcJsonParserError(
            "json_parser_item_limit_exceeded",
            "JSON 数组项目数量超过限制",
            details={
                "actual": len(selected),
                "limit": AIGC_JSON_PARSER_MAX_ITEMS,
            },
        )

    items = [
        _serialize_item(index, value)
        for index, value in enumerate(selected)
    ]
    return AigcTaskResult(kind=AigcResultKind.TEXT_ITEMS, items=items)


def _parse_json_document(source: str) -> Any:
    normalized = source.strip()
    if not normalized:
        raise _invalid_json()
    if normalized.startswith("```"):
        normalized = _unwrap_json_fence(normalized)
    try:
        return json.loads(
            normalized,
            parse_constant=lambda _value: _raise_non_standard_constant(),
        )
    except (json.JSONDecodeError, TypeError, ValueError):
        raise _invalid_json() from None


def _unwrap_json_fence(source: str) -> str:
    opening, newline, remainder = source.partition("\n")
    if not newline or opening.rstrip("\r") != "```json":
        raise _invalid_json()
    body, closing_newline, closing = remainder.rpartition("\n")
    if not closing_newline or closing.rstrip("\r") != "```":
        raise _invalid_json()
    if not body.strip():
        raise _invalid_json()
    return body


def _serialize_item(index: int, value: Any) -> AigcJsonParserItem:
    text = (
        value
        if isinstance(value, str)
        else json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        )
    )
    return AigcJsonParserItem(
        index=index,
        text=text,
        summary=hashlib.sha256(text.encode("utf-8")).hexdigest(),
    )


def _raise_non_standard_constant() -> None:
    raise ValueError("non-standard JSON constant")


def _invalid_json() -> AigcJsonParserError:
    return AigcJsonParserError(
        "json_parser_invalid_json",
        "输入不是有效的 JSON 或单一 JSON 代码块",
    )
