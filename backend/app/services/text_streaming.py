from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any


SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def encode_sse(event: str, data: Any) -> str:
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {payload}\n\n"


@dataclass(frozen=True)
class ExtractedText:
    delta: str
    complete: bool


class IncrementalJsonStringExtractor:
    """Extract one top-level JSON string field as provider chunks arrive."""

    def __init__(self, field_name: str) -> None:
        if not field_name:
            raise ValueError("field_name must not be empty")
        self.field_name = field_name
        self._buffer = ""
        self._value_start: int | None = None
        self._emitted_length = 0

    @property
    def raw_json(self) -> str:
        return self._buffer

    def feed(self, chunk: str) -> ExtractedText:
        if not chunk:
            return ExtractedText(delta="", complete=False)
        self._buffer += chunk
        if self._value_start is None:
            self._value_start = _find_top_level_string_value(
                self._buffer,
                self.field_name,
            )
        if self._value_start is None:
            return ExtractedText(delta="", complete=False)

        decoded, complete = _decode_partial_json_string(
            self._buffer,
            self._value_start,
        )
        delta = decoded[self._emitted_length :]
        self._emitted_length = len(decoded)
        return ExtractedText(delta=delta, complete=complete)


def _find_top_level_string_value(raw: str, field_name: str) -> int | None:
    depth = 0
    index = 0
    length = len(raw)
    while index < length:
        char = raw[index]
        if char == "{":
            depth += 1
            index += 1
            continue
        if char == "}":
            depth = max(0, depth - 1)
            index += 1
            continue
        if char != '"':
            index += 1
            continue

        closing = _find_json_string_end(raw, index + 1)
        if closing is None:
            return None
        if depth != 1:
            index = closing + 1
            continue

        try:
            token = json.loads(raw[index : closing + 1])
        except json.JSONDecodeError:
            index = closing + 1
            continue
        cursor = closing + 1
        while cursor < length and raw[cursor].isspace():
            cursor += 1
        if token != field_name or cursor >= length or raw[cursor] != ":":
            index = closing + 1
            continue
        cursor += 1
        while cursor < length and raw[cursor].isspace():
            cursor += 1
        if cursor >= length:
            return None
        if raw[cursor] != '"':
            raise ValueError(f"JSON field {field_name!r} must be a string")
        return cursor + 1
    return None


def _find_json_string_end(raw: str, start: int) -> int | None:
    escaped = False
    for index in range(start, len(raw)):
        char = raw[index]
        if escaped:
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char == '"':
            return index
    return None


def _decode_partial_json_string(raw: str, start: int) -> tuple[str, bool]:
    decoded: list[str] = []
    index = start
    while index < len(raw):
        char = raw[index]
        if char == '"':
            return "".join(decoded), True
        if char != "\\":
            decoded.append(char)
            index += 1
            continue

        if index + 1 >= len(raw):
            break
        escape = raw[index + 1]
        simple_escapes = {
            '"': '"',
            "\\": "\\",
            "/": "/",
            "b": "\b",
            "f": "\f",
            "n": "\n",
            "r": "\r",
            "t": "\t",
        }
        if escape in simple_escapes:
            decoded.append(simple_escapes[escape])
            index += 2
            continue
        if escape != "u":
            raise ValueError("invalid JSON string escape")
        if index + 6 > len(raw):
            break
        hex_value = raw[index + 2 : index + 6]
        try:
            codepoint = int(hex_value, 16)
        except ValueError as exc:
            raise ValueError("invalid JSON unicode escape") from exc

        if 0xD800 <= codepoint <= 0xDBFF:
            if index + 12 > len(raw):
                break
            if raw[index + 6 : index + 8] != "\\u":
                raise ValueError("invalid JSON surrogate pair")
            low_hex = raw[index + 8 : index + 12]
            try:
                low = int(low_hex, 16)
            except ValueError as exc:
                raise ValueError("invalid JSON unicode escape") from exc
            if not 0xDC00 <= low <= 0xDFFF:
                raise ValueError("invalid JSON surrogate pair")
            codepoint = 0x10000 + ((codepoint - 0xD800) << 10) + (low - 0xDC00)
            index += 12
        else:
            index += 6
        decoded.append(chr(codepoint))
    return "".join(decoded), False
