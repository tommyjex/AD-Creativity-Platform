from __future__ import annotations

from collections import Counter
import re

from backend.app.schemas import (
    AigcPromptOptimizeRequest,
    AigcPromptOptimizeResponse,
)
from backend.app.services.modelark import ModelArkTextParseError


_BBOX_TOKEN = re.compile(
    r"(?:图|Image\s*)?\d*\s*<bbox>\s*-?\d+(?:\.\d+)?(?:\s+-?\d+(?:\.\d+)?){3}\s*</bbox>",
    re.IGNORECASE,
)
_QUOTED = re.compile(r'"[^"\r\n]+"|“[^”\r\n]+”|「[^」\r\n]+」|『[^』\r\n]+』')
_BACKTICK = re.compile(r"`[^`\r\n]+`")
_URL = re.compile(r"https?://[^\s\"'`”」』)）\]】}>，。；、,;]+")
_ASPECT_RATIO = re.compile(r"(?<![\d.])\d+(?:\.\d+)?:\d+(?:\.\d+)?(?![\d.])")
_NUMBER_WITH_UNIT = re.compile(
    r"(?<![\w.])[+-]?(?:\d+(?:\.\d+)?|\.\d+)"
    r"(?:%|px|K|s|秒|min|分钟|h|小时|帧|fps|度|°)(?!\w)",
    re.IGNORECASE,
)
_PATTERNS = (
    _BBOX_TOKEN,
    _QUOTED,
    _BACKTICK,
    _URL,
    _ASPECT_RATIO,
    _NUMBER_WITH_UNIT,
)


def extract_protected_literals(value: str) -> tuple[str, ...]:
    candidates: list[tuple[int, int, int, str]] = []
    for priority, pattern in enumerate(_PATTERNS):
        for match in pattern.finditer(value):
            candidates.append(
                (match.start(), -(match.end() - match.start()), priority, match.group(0))
            )
    candidates.sort()
    selected: list[str] = []
    cursor = -1
    for start, negative_length, _priority, literal in candidates:
        end = start - negative_length
        if start < cursor:
            continue
        selected.append(literal)
        cursor = end
    return tuple(selected)


def _validate_literal_counts(source: str, output: str, *, field_name: str) -> None:
    required = Counter(extract_protected_literals(source))
    for literal, count in required.items():
        if output.count(literal) < count:
            raise ModelArkTextParseError(
                f"AIGC prompt optimization changed protected literal in {field_name}"
            )


def validate_prompt_optimization_result(
    request: AigcPromptOptimizeRequest,
    result: AigcPromptOptimizeResponse,
) -> None:
    _validate_literal_counts(request.text, result.optimized_text, field_name="text")
    if request.target_type in {"text_to_image", "image_to_image"}:
        if len(result.optimized_reference_instructions) != len(
            request.reference_instructions
        ):
            raise ModelArkTextParseError(
                "AIGC prompt optimization changed reference count"
            )
        for index, (source, output) in enumerate(
            zip(
                request.reference_instructions,
                result.optimized_reference_instructions,
                strict=True,
            )
        ):
            _validate_literal_counts(
                source,
                output,
                field_name=f"reference_instructions[{index}]",
            )
    elif result.optimized_reference_instructions:
        raise ModelArkTextParseError(
            "non-image prompt optimization returned reference instructions"
        )

    if not result.optimized_text and not any(
        result.optimized_reference_instructions
    ):
        raise ModelArkTextParseError(
            "AIGC prompt optimization returned empty content"
        )
