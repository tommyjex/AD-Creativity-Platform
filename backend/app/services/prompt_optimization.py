from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import re
from typing import Callable

from backend.app.schemas import (
    AigcImagePromptLocalEditResult,
    AigcPromptOptimizeRequest,
    AigcPromptOptimizeResponse,
    AigcSeedreamPromptOptimizationResult,
)
from backend.app.services.modelark import (
    AigcImagePromptSectionsResult,
    ModelArkTextParseError,
)
from backend.app.services.prompt_anchors import (
    SourceConstraint,
    extract_source_constraints,
    positive_anchor_section_index,
    source_values,
)


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
_VIDEO_DURATION_REWRITE = re.compile(
    r"(?:扩展|延长|调整|修改|改(?:成|为)?|extend|lengthen|change)"
    r".{0,24}?\d+(?:\.\d+)?\s*(?:s|秒|seconds?)",
    re.IGNORECASE,
)
_VIDEO_TIMELINE_RANGE = re.compile(
    r"(?<![\d.])\d+(?:\.\d+)?\s*(?:s|秒)?\s*[-–—~～至到]\s*"
    r"\d+(?:\.\d+)?\s*(?:s|秒)(?!\w)",
    re.IGNORECASE,
)
_SOURCE_MEASUREMENT = re.compile(
    r"(?<![\w.])(?P<number>[+-]?(?:\d+(?:\.\d+)?|\.\d+))(?:\s*|-)"
    r"(?P<unit>%|px|pixels?|K|s|seconds?|秒|min|minutes?|分钟|h|hours?|小时|"
    r"frames?|帧|fps|degrees?|度|°)(?!\w)",
    re.IGNORECASE,
)
_BARE_NUMBER = re.compile(r"(?<![\w.])\d+(?:\.\d+)?(?![\w.])")
_COUNT_VALUE = (
    r"(?:\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|"
    r"ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|"
    r"eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|"
    r"ninety|hundred|thousand)"
)
_OUTPUT_OBJECT_QUANTITY = re.compile(
    rf"(?<![\w.]){_COUNT_VALUE}\s+"
    r"(?:bottles?|cups?|glasses?|boxes?|cartons?|cans?|jars?|bags?|pouches?|"
    r"tubes?|sticks?|sets?|units?|devices?|vehicles?|cars?|books?|copies|"
    r"sheets?|pieces?|animals?|people|persons?|servings?|portions?|groups?|"
    r"items?|products?|packages?)\b"
    r"|(?<![\w.])\d+(?:\.\d+)?\s*"
    r"(?:个|件|瓶|杯|盒|罐|袋|支|套|台|辆|本|张|只|位|名|颗|份|组)",
    re.IGNORECASE,
)
_ENGLISH_NUMBER_WORD = re.compile(
    r"\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|"
    r"twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|"
    r"twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\b",
    re.IGNORECASE,
)
_REFERENCE_IDENTIFIER = re.compile(r"(?:Image\s*|图)\d+", re.IGNORECASE)
_ASCII_IDENTIFIER = re.compile(
    r"\b(?:[A-Z]{2,}[A-Za-z0-9-]*|[A-Za-z]+-?\d[A-Za-z0-9-]*|"
    r"[a-z]+[A-Z][A-Za-z0-9-]*)\b"
)
_LABELED_LITERAL = re.compile(
    r"(?:品牌|型号|brand|model)\s*[:：]?\s*"
    r"([A-Za-z0-9\u3400-\u9fff][A-Za-z0-9\u3400-\u9fff._+/-]*"
    r"(?:\s+[A-Za-z0-9][A-Za-z0-9._+/-]*){0,3})",
    re.IGNORECASE,
)
_PATTERNS = (
    _BBOX_TOKEN,
    _QUOTED,
    _BACKTICK,
    _URL,
    _ASPECT_RATIO,
    _NUMBER_WITH_UNIT,
    _BARE_NUMBER,
    _ASCII_IDENTIFIER,
)
_CJK = re.compile(
    r"[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]"
)
_ASCII_LETTER = re.compile(r"[A-Za-z]")
_COLOR_TERMS = {
    "红色": "red",
    "red": "red",
    "蓝色": "blue",
    "blue": "blue",
    "绿色": "green",
    "green": "green",
    "黑色": "black",
    "black": "black",
    "白色": "white",
    "white": "white",
    "黄色": "yellow",
    "yellow": "yellow",
    "紫色": "purple",
    "purple": "purple",
    "橙色": "orange",
    "orange": "orange",
}
_REQUIRED_SUBJECT_TERMS = {
    "product": ("product", "商品", "产品", "包装"),
    "people": ("person", "people", "人物", "模特", "人像"),
    "animal": ("animal", "animals", "动物", "猫", "狗"),
    "furniture": ("furniture", "家具"),
    "logo": ("logo", "商标", "标志"),
    "text": ("text", "文字", "文案"),
    "background": ("background", "背景"),
}
_OUTPUT_TERM_ALIASES = {
    "product": ("product", "package"),
    "people": ("people", "person"),
    "animal": ("animal", "cat", "dog"),
    "furniture": ("furniture",),
    "logo": ("logo",),
    "text": ("text", "copy", "lettering"),
    "background": ("background",),
}
_NEGATION_QUALIFIERS = re.compile(
    r"\b(?:no|without|remove|exclude|omit|avoid)\s+"
    r"(?:extra|additional|unrequested|altered|distorted|incorrect|duplicate)\s+",
    re.IGNORECASE,
)
_REFERENCE_ACTION_TERMS = {
    "reduce": ("缩小", "reduce", "smaller"),
    "enlarge": ("放大", "enlarge", "larger"),
    "replace": ("替换", "更换", "replace"),
    "preserve": ("保持", "保留", "preserve", "keep"),
    "remove": ("移除", "删除", "remove", "delete"),
}
_MEASUREMENT_UNIT_ALIASES = {
    "%": ("%", "percent", "percentage"),
    "px": ("px", "pixel", "pixels"),
    "pixel": ("px", "pixel", "pixels"),
    "pixels": ("px", "pixel", "pixels"),
    "k": ("k",),
    "s": ("s", "second", "seconds"),
    "second": ("s", "second", "seconds"),
    "seconds": ("s", "second", "seconds"),
    "秒": ("秒", "second", "seconds", "s"),
    "min": ("min", "minute", "minutes"),
    "minute": ("min", "minute", "minutes"),
    "minutes": ("min", "minute", "minutes"),
    "分钟": ("分钟", "minute", "minutes", "min"),
    "h": ("h", "hour", "hours"),
    "hour": ("h", "hour", "hours"),
    "hours": ("h", "hour", "hours"),
    "小时": ("小时", "hour", "hours", "h"),
    "帧": ("帧", "frame", "frames"),
    "frame": ("帧", "frame", "frames"),
    "frames": ("帧", "frame", "frames"),
    "fps": ("fps",),
    "度": ("度", "degree", "degrees", "°"),
    "degree": ("度", "degree", "degrees", "°"),
    "degrees": ("度", "degree", "degrees", "°"),
    "°": ("°", "degree", "degrees", "度"),
}
_MARKDOWN_BLOCK = re.compile(
    r"```|(?:^|\n)\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s)",
    re.MULTILINE,
)
_CANONICAL_ANCHOR_MARKER = re.compile(
    r"(?:Preserve exact identity|Honor exclusion exactly|"
    r"Preserve exact quantity-object constraint)\s*:",
    re.IGNORECASE,
)
_LOCAL_SECTION_LABEL = re.compile(
    r"(?:^|\s)(?:Edit Instructions|Preserve|Composition|Negative Prompt)\s*:",
    re.IGNORECASE,
)
_LOCAL_EDIT_ACTION = re.compile(
    r"\b(?:add|insert|place|change|replace|remove|delete|erase|adjust|modify|"
    r"recolor|resize|move|retouch)\b",
    re.IGNORECASE,
)
_LOCAL_IMAGE_ANCHOR = re.compile(
    r"\b(?:input|source|original|provided|existing)\s+image\b",
    re.IGNORECASE,
)
_LOCAL_PRESERVATION = re.compile(
    r"\b(?:preserve|keep|retain|leave)\b.{0,100}"
    r"\b(?:unspecified|unmodified|unchanged|remaining|other|everything else)\b"
    r"|\b(?:unspecified|unmodified|remaining|other)\b.{0,100}"
    r"\b(?:preserve|keep|retain|unchanged)\b",
    re.IGNORECASE,
)
_LOCAL_SCOPE_EXPANSION = {
    "composition": (
        "recompose",
        "new composition",
        "change the composition",
        "alter the composition",
    ),
    "pose": ("change the pose", "new pose", "alter the pose"),
    "identity": (
        "change the subject",
        "replace the subject",
        "new subject",
        "change identity",
    ),
    "style": (
        "restyle the whole",
        "overall style",
        "entire image style",
    ),
    "lighting": (
        "change the lighting",
        "new lighting",
        "relight the entire",
    ),
}
_DIRECT_POSITIVE_ACTION = re.compile(
    r"(?:\b(?:add|include|show|place|insert|retain|keep)\b|"
    r"添加|增加|加入|展示|呈现|放置|插入|保留|出现|带有|生成)",
    re.IGNORECASE,
)
_DIRECT_NEGATION = re.compile(
    r"(?:\b(?:no|not|never|without|avoid|exclude|remove|omit)\b|"
    r"不要|不得|禁止|避免|不应|不可|不能|不含|没有|去除|移除|删除)",
    re.IGNORECASE,
)


class PromptOptimizationSafetyError(ModelArkTextParseError):
    """The optimized result violated a non-negotiable user constraint."""


@dataclass(frozen=True)
class PromptOptimizationRenderResult:
    response: AigcPromptOptimizeResponse
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class RecoverablePromptFact:
    kind: str
    value: str
    rendered_value: str


def extract_protected_literals(value: str) -> tuple[str, ...]:
    candidates: list[tuple[int, int, int, str]] = []
    for priority, pattern in enumerate(_PATTERNS):
        for match in pattern.finditer(value):
            candidates.append(
                (match.start(), -(match.end() - match.start()), priority, match.group(0))
            )
    for match in _LABELED_LITERAL.finditer(value):
        literal = match.group(1)
        start = match.start(1)
        candidates.append((start, -len(literal), len(_PATTERNS), literal))
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


def _without_protected_literals(value: str) -> str:
    masked = value
    for index, literal in sorted(
        enumerate(extract_protected_literals(value)),
        key=lambda item: len(item[1]),
        reverse=True,
    ):
        masked = masked.replace(literal, f" __PROTECTED_{index}__ ", 1)
    return re.sub(r"__PROTECTED_\d+__", " ", masked)


def _normalize_preserving_literals(
    value: str,
    *,
    protected_literals: tuple[str, ...] = (),
) -> str:
    literals = tuple(
        dict.fromkeys((*protected_literals, *extract_protected_literals(value)))
    )
    normalized = value
    placeholders: list[tuple[str, str]] = []
    for index, literal in enumerate(literals):
        placeholder = f"\x00{'!' * (index + 1)}\x00"
        normalized = normalized.replace(literal, placeholder, 1)
        placeholders.append((placeholder, literal))
    normalized = re.sub(r"\s+", " ", normalized).strip()
    for placeholder, literal in placeholders:
        normalized = normalized.replace(placeholder, literal)
    return normalized


def _recoverable_facts(source: str) -> tuple[RecoverablePromptFact, ...]:
    facts: list[RecoverablePromptFact] = []
    for literal in extract_protected_literals(source):
        if _BBOX_TOKEN.fullmatch(literal) or _BARE_NUMBER.fullmatch(literal):
            continue
        facts.append(
            RecoverablePromptFact(
                kind="literal",
                value=literal,
                rendered_value=literal,
            )
        )

    source_folded = source.casefold()
    for token, english in _COLOR_TERMS.items():
        present = (
            re.search(rf"\b{re.escape(token.casefold())}\b", source_folded)
            if token.isascii()
            else token.casefold() in source_folded
        )
        if present:
            facts.append(
                RecoverablePromptFact(
                    kind="color",
                    value=english,
                    rendered_value=english,
                )
            )

    unique: list[RecoverablePromptFact] = []
    seen: set[tuple[str, str]] = set()
    for fact in facts:
        key = (fact.kind, fact.value)
        if key not in seen:
            seen.add(key)
            unique.append(fact)
    return tuple(unique)


def _repair_recoverable_facts(
    source: str,
    output: str,
) -> tuple[str, tuple[str, ...]]:
    repairs: list[str] = []
    warnings: list[str] = []
    output_folded = output.casefold()
    for fact in _recoverable_facts(source):
        if fact.kind == "literal":
            if fact.value in output:
                continue
            repairs.append(f"Preserve exact literal: {fact.rendered_value}.")
            warnings.append("protected_literal_repaired")
            continue
        if re.search(
            rf"\b{re.escape(fact.rendered_value.casefold())}\b",
            output_folded,
        ):
            continue
        repairs.append(f"Preserve required color: {fact.rendered_value}.")
        warnings.append("required_color_repaired")

    if repairs:
        output = f"{output.rstrip()} {' '.join(repairs)}".strip()
    return output, tuple(dict.fromkeys(warnings))


def _repair_seedream_recoverable_facts(
    source: str,
    output: str,
) -> tuple[str, tuple[str, ...]]:
    repairs: list[str] = []
    warnings: list[str] = []
    for literal in extract_protected_literals(source):
        if (
            _BBOX_TOKEN.fullmatch(literal)
            or _BARE_NUMBER.fullmatch(literal)
            or literal in output
        ):
            continue
        repairs.append(f"必须保留指定内容：{literal}。")
        warnings.append("protected_literal_repaired")

    source_folded = source.casefold()
    output_folded = output.casefold()
    seen_colors: set[str] = set()
    for token, english in _COLOR_TERMS.items():
        present = (
            re.search(rf"\b{re.escape(token.casefold())}\b", source_folded)
            if token.isascii()
            else token.casefold() in source_folded
        )
        if not present or english in seen_colors:
            continue
        seen_colors.add(english)
        output_has_color = (
            re.search(rf"\b{re.escape(english)}\b", output_folded) is not None
            or token.casefold() in output_folded
        )
        if output_has_color:
            continue
        rendered = token if not token.isascii() else english
        repairs.append(f"必须使用指定颜色：{rendered}。")
        warnings.append("required_color_repaired")

    if repairs:
        output = f"{output.rstrip()} {' '.join(repairs)}".strip()
    return output, tuple(dict.fromkeys(warnings))


def _validate_bbox_literals(
    source: str,
    output: str,
    *,
    field_name: str,
) -> None:
    required = tuple(match.group(0) for match in _BBOX_TOKEN.finditer(source))
    cursor = 0
    for literal in required:
        position = output.find(literal, cursor)
        if position < 0:
            raise ModelArkTextParseError(
                f"AIGC prompt optimization changed BBox literal in {field_name}"
            )
        cursor = position + len(literal)


def _normalize_section_content(
    value: str,
    *,
    protected_literals: tuple[str, ...],
) -> tuple[str, bool]:
    normalized = value.strip()
    repaired = False
    fence_match = re.fullmatch(
        r"```(?:text|markdown)?\s*(.*?)```",
        normalized,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if fence_match:
        normalized = fence_match.group(1).strip()
        repaired = True
    lines: list[str] = []
    for line in normalized.splitlines() or [normalized]:
        cleaned = re.sub(
            r"^\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)",
            "",
            line,
        )
        repaired = repaired or cleaned != line
        lines.append(cleaned)
    return (
        _normalize_preserving_literals(
            " ".join(lines),
            protected_literals=protected_literals,
        ),
        repaired,
    )


def _normalize_section_label(value: str) -> tuple[str, bool]:
    normalized = re.sub(r"\s+", " ", value).strip()
    repaired = normalized != value
    cleaned = re.sub(r"^#{1,6}\s*", "", normalized).rstrip(":").strip()
    return cleaned, repaired or cleaned != normalized


def _collect_warning(
    warnings: list[str],
    code: str,
    check: Callable[[], None],
) -> None:
    try:
        check()
    except ModelArkTextParseError:
        if code not in warnings:
            warnings.append(code)


def _enforce_safety(check: Callable[[], None]) -> None:
    try:
        check()
    except PromptOptimizationSafetyError:
        raise
    except ModelArkTextParseError as exc:
        raise PromptOptimizationSafetyError(str(exc)) from exc


def _validate_english(
    value: str,
    *,
    field_name: str,
    source_literals: tuple[str, ...] = (),
) -> None:
    translatable = value
    for literal in sorted(set(source_literals), key=len, reverse=True):
        translatable = translatable.replace(literal, " ")
    translatable = _without_protected_literals(translatable)
    if _CJK.search(translatable) or not _ASCII_LETTER.search(translatable):
        raise ModelArkTextParseError(
            f"AIGC prompt optimization returned non-English {field_name}"
        )


def _validate_literal_counts(
    source: str,
    output: str,
    *,
    field_name: str,
    preserve_order: bool = False,
    include_bare_numbers: bool = True,
) -> None:
    literals = tuple(
        literal
        for literal in extract_protected_literals(source)
        if include_bare_numbers or not _BARE_NUMBER.fullmatch(literal)
    )
    required = Counter(literals)
    for literal, count in required.items():
        if output.count(literal) < count:
            raise ModelArkTextParseError(
                f"AIGC prompt optimization changed protected literal in {field_name}"
            )
    if preserve_order:
        cursor = 0
        for literal in literals:
            position = output.find(literal, cursor)
            if position < 0:
                raise ModelArkTextParseError(
                    f"AIGC prompt optimization reordered protected literal in {field_name}"
                )
            cursor = position + len(literal)


def _validate_colors(source: str, output: str, *, field_name: str) -> None:
    source_folded = source.casefold()
    output_folded = output.casefold()
    required = {
        english
        for term, english in _COLOR_TERMS.items()
        if (
            re.search(rf"\b{re.escape(term.casefold())}\b", source_folded)
            if term.isascii()
            else term.casefold() in source_folded
        )
    }
    for color in required:
        if color not in output_folded:
            raise ModelArkTextParseError(
                f"AIGC prompt optimization changed color constraint in {field_name}"
            )


def _validate_required_terms(source: str, output: str, *, field_name: str) -> None:
    source_folded = source.casefold()
    output_folded = output.casefold()
    for required, source_tokens in _REQUIRED_SUBJECT_TERMS.items():
        if any(token in source_folded for token in source_tokens):
            if not any(
                re.search(rf"\b{re.escape(alias)}s?\b", output_folded)
                for alias in _OUTPUT_TERM_ALIASES[required]
            ):
                raise ModelArkTextParseError(
                    f"AIGC prompt optimization omitted required content in {field_name}"
                )


def _validate_reference_actions(source: str, output: str) -> None:
    source_folded = source.casefold()
    output_folded = output.casefold()
    for expected, source_tokens in _REFERENCE_ACTION_TERMS.items():
        if any(token in source_folded for token in source_tokens):
            if expected not in output_folded and not (
                expected == "preserve" and "keep" in output_folded
            ):
                raise ModelArkTextParseError(
                    "AIGC prompt optimization changed reference order or action"
                )


def _validate_negative_prompt(
    request: AigcPromptOptimizeRequest,
    negative_prompt: str,
) -> None:
    raw_source_values = [request.text, *request.reference_instructions]
    positive_sources = " ".join(raw_source_values)
    constraints = extract_source_constraints(request)
    for source_field, source_index, source in source_values(request):
        for constraint in constraints:
            if (
                constraint.kind != "exclusion"
                or constraint.source_field != source_field
                or constraint.source_index != source_index
            ):
                continue
            positive_sources = positive_sources.replace(constraint.source_text, " ")
    sources = positive_sources.casefold()
    negative_folded = negative_prompt.casefold()
    normalized_negative = _NEGATION_QUALIFIERS.sub("", negative_folded)
    for term, source_tokens in _REQUIRED_SUBJECT_TERMS.items():
        if not any(token in sources for token in source_tokens):
            continue
        conflict = re.search(
            rf"\b(?:no|without|remove|exclude|omit|avoid)\b"
            rf"(?:\W+\w+){{0,3}}\W+{re.escape(term)}s?\b",
            normalized_negative,
        )
        if conflict:
            raise ModelArkTextParseError(
                "AIGC image prompt Negative Prompt conflicts with required content"
            )
    for color in {
        english
        for token, english in _COLOR_TERMS.items()
        if (
            re.search(rf"\b{re.escape(token.casefold())}\b", sources)
            if token.isascii()
            else token.casefold() in sources
        )
    }:
        if re.search(
            rf"\b(?:no|without|remove|exclude|omit|avoid)\W+{color}\b",
            normalized_negative,
        ):
            raise ModelArkTextParseError(
                "AIGC image prompt Negative Prompt conflicts with required color"
            )


def _validate_no_direct_exclusion_reversal(
    request: AigcPromptOptimizeRequest,
    output: str,
) -> None:
    for constraint in extract_source_constraints(request):
        if constraint.kind != "exclusion":
            continue
        searchable = output.replace(constraint.anchor, " ")
        for match in re.finditer(re.escape(constraint.source_value), searchable):
            prefix = searchable[max(0, match.start() - 80) : match.start()]
            action_matches = list(_DIRECT_POSITIVE_ACTION.finditer(prefix))
            if not action_matches:
                continue
            action = action_matches[-1]
            action_prefix = prefix[max(0, action.start() - 24) : action.start()]
            action_suffix = prefix[action.end() :]
            if _DIRECT_NEGATION.search(action_prefix) or _DIRECT_NEGATION.search(
                action_suffix
            ):
                continue
            raise ModelArkTextParseError(
                "AIGC image prompt reversed an explicit exclusion"
            )


def _validate_no_unrequested_quantities(
    request: AigcPromptOptimizeRequest,
    contents: list[str],
    references: list[str],
    source_constraints: tuple[SourceConstraint, ...],
) -> None:
    searchable = "\n".join([*contents, *references])
    source_text = " ".join([request.text, *request.reference_instructions])
    for match in _SOURCE_MEASUREMENT.finditer(source_text):
        number = re.escape(match.group("number"))
        aliases = _MEASUREMENT_UNIT_ALIASES.get(
            match.group("unit").casefold(),
            (match.group("unit"),),
        )
        unit_pattern = "|".join(re.escape(alias) for alias in aliases)
        searchable = re.sub(
            rf"(?<![\w.]){number}(?:\s*|-)(?:{unit_pattern})(?!\w)",
            " ",
            searchable,
            flags=re.IGNORECASE,
        )
    allowed_fragments = list(
        literal
        for literal in extract_protected_literals(
            source_text
        )
        if not _BARE_NUMBER.fullmatch(literal)
    )
    allowed_fragments.extend(
        match.group(0)
        for match in _REFERENCE_IDENTIFIER.finditer(
            " ".join(request.reference_instructions)
        )
    )
    config = request.target_config
    allowed_fragments.extend(
        [
            str(config.aspect_ratio),
            str(config.size),
            f"Use {config.reference_image_count} reference image(s)",
            *(constraint.anchor for constraint in source_constraints),
        ]
    )
    for fragment in sorted(set(allowed_fragments), key=len, reverse=True):
        searchable = searchable.replace(fragment, " ")
    if _BARE_NUMBER.search(searchable) or _ENGLISH_NUMBER_WORD.search(searchable):
        raise ModelArkTextParseError(
            "AIGC image prompt introduced an unrequested quantity"
        )


def _validate_no_unrequested_object_quantities(
    request: AigcPromptOptimizeRequest,
    contents: list[str],
    references: list[str],
    source_constraints: tuple[SourceConstraint, ...],
) -> None:
    searchable = "\n".join([*contents, *references])
    source_text = " ".join([request.text, *request.reference_instructions])
    allowed_fragments = [
        *(
            literal
            for literal in extract_protected_literals(source_text)
            if not _BARE_NUMBER.fullmatch(literal)
        ),
        *(constraint.anchor for constraint in source_constraints),
    ]
    config = request.target_config
    allowed_fragments.extend(
        [
            str(config.aspect_ratio),
            str(config.size),
            f"Use {config.reference_image_count} reference image(s)",
        ]
    )
    for fragment in sorted(set(allowed_fragments), key=len, reverse=True):
        searchable = searchable.replace(fragment, " ")
    if _OUTPUT_OBJECT_QUANTITY.search(searchable):
        raise ModelArkTextParseError(
            "AIGC image prompt introduced an unrequested quantity"
        )


def _validate_canonical_anchors(
    labels: list[str],
    contents: list[str],
    source_constraints: tuple[SourceConstraint, ...],
) -> None:
    if not source_constraints:
        combined = "\n".join(contents)
        if _CANONICAL_ANCHOR_MARKER.search(combined):
            raise ModelArkTextParseError(
                "AIGC image prompt returned an unexpected canonical anchor"
            )
        return
    positive_index: int | None = None
    if any(constraint.kind != "exclusion" for constraint in source_constraints):
        try:
            positive_index = positive_anchor_section_index(labels)
        except StopIteration as exc:
            raise ModelArkTextParseError(
                "AIGC image prompt omitted or misplaced canonical anchor"
            ) from exc
    expected_anchors = [constraint.anchor for constraint in source_constraints]
    combined = "\n".join(contents)
    for constraint in source_constraints:
        target_index = -1 if constraint.kind == "exclusion" else positive_index
        assert target_index is not None
        if (
            combined.count(constraint.anchor) != 1
            or contents[target_index].count(constraint.anchor) != 1
        ):
            raise ModelArkTextParseError(
                "AIGC image prompt omitted or misplaced canonical anchor"
            )

    remainder = combined
    for anchor in expected_anchors:
        remainder = remainder.replace(anchor, "", 1)
    if _CANONICAL_ANCHOR_MARKER.search(remainder):
        raise ModelArkTextParseError(
            "AIGC image prompt returned an unexpected canonical anchor"
        )


def _repair_canonical_anchors(
    labels: list[str],
    contents: list[str],
    source_constraints: tuple[SourceConstraint, ...],
) -> tuple[list[str], bool]:
    if not source_constraints:
        return contents, False
    try:
        _validate_canonical_anchors(labels, contents, source_constraints)
        return contents, False
    except ModelArkTextParseError:
        pass

    repaired = list(contents)
    expected_anchors = tuple(
        dict.fromkeys(constraint.anchor for constraint in source_constraints)
    )
    for index, content in enumerate(repaired):
        for anchor in expected_anchors:
            content = content.replace(anchor, " ")
        content = _CANONICAL_ANCHOR_MARKER.sub("", content)
        repaired[index] = _normalize_preserving_literals(content)

    positive_anchors = tuple(
        dict.fromkeys(
            constraint.anchor
            for constraint in source_constraints
            if constraint.kind != "exclusion"
        )
    )
    if positive_anchors:
        try:
            positive_index = positive_anchor_section_index(labels)
        except StopIteration:
            return contents, False
        repaired[positive_index] = " ".join(
            [repaired[positive_index], *positive_anchors]
        ).strip()

    exclusion_anchors = tuple(
        dict.fromkeys(
            constraint.anchor
            for constraint in source_constraints
            if constraint.kind == "exclusion"
        )
    )
    if exclusion_anchors:
        repaired[-1] = " ".join(
            [repaired[-1], *exclusion_anchors]
        ).strip()
    return repaired, True


def render_image_prompt_sections(
    request: AigcPromptOptimizeRequest,
    result: AigcImagePromptSectionsResult,
) -> AigcPromptOptimizeResponse:
    return render_image_prompt_sections_with_warnings(request, result).response


def render_seedream_prompt_with_warnings(
    request: AigcPromptOptimizeRequest,
    result: AigcSeedreamPromptOptimizationResult,
) -> PromptOptimizationRenderResult:
    warnings: list[str] = []
    optimized_text = _normalize_preserving_literals(
        result.optimized_text or request.text
    )
    if not optimized_text:
        optimized_text = "请根据当前创作意图生成画面。"
        warnings.append("empty_optimized_text_fallback")
    _collect_warning(
        warnings,
        "bbox_constraint_changed",
        lambda: _validate_bbox_literals(
            request.text,
            optimized_text,
            field_name="text",
        )
    )
    optimized_text, fact_warnings = _repair_seedream_recoverable_facts(
        request.text,
        optimized_text,
    )
    warnings.extend(fact_warnings)
    source_constraints = extract_source_constraints(request)
    references = list(request.reference_instructions)
    _collect_warning(
        warnings,
        "required_subject_term_missing",
        lambda: _validate_required_terms(
            request.text,
            optimized_text,
            field_name="text",
        ),
    )
    _collect_warning(
        warnings,
        "unrequested_object_quantity",
        lambda: _validate_no_unrequested_object_quantities(
            request,
            [optimized_text],
            references,
            source_constraints,
        ),
    )
    _collect_warning(
        warnings,
        "explicit_exclusion_changed",
        lambda: _validate_no_direct_exclusion_reversal(
            request,
            optimized_text,
        )
    )
    if len(optimized_text) > 20000:
        optimized_text = optimized_text[:20000]
        warnings.append("optimized_text_truncated")
    return PromptOptimizationRenderResult(
        response=AigcPromptOptimizeResponse(
            optimized_text=optimized_text,
            optimized_reference_instructions=references,
            generation_type=result.generation_type,
            optimization_explanation=result.optimization_explanation.strip(),
        ),
        warnings=tuple(dict.fromkeys(warnings)),
    )


def render_local_edit_prompt_with_warnings(
    request: AigcPromptOptimizeRequest,
    result: AigcImagePromptLocalEditResult,
) -> PromptOptimizationRenderResult:
    warnings: list[str] = []
    raw = result.optimized_text.strip()
    if (
        not raw
        or "\n" in raw
        or "\r" in raw
        or _MARKDOWN_BLOCK.search(raw)
        or _LOCAL_SECTION_LABEL.search(raw)
        or raw.startswith(("{", "["))
    ):
        raise PromptOptimizationSafetyError(
            "AIGC local edit prompt must be one unlabeled paragraph"
        )
    optimized_text = _normalize_preserving_literals(raw)
    source_constraints = extract_source_constraints(request)
    source_literals = extract_protected_literals(
        " ".join([request.text, *request.reference_instructions])
    )
    _enforce_safety(
        lambda: _validate_english(
            optimized_text,
            field_name="local edit prompt",
            source_literals=source_literals
            + tuple(item.source_text for item in source_constraints),
        )
    )
    if not _LOCAL_EDIT_ACTION.search(optimized_text):
        raise PromptOptimizationSafetyError(
            "AIGC local edit prompt omitted an explicit edit action"
        )
    if not _LOCAL_IMAGE_ANCHOR.search(optimized_text):
        raise PromptOptimizationSafetyError(
            "AIGC local edit prompt is not anchored to the input image"
        )
    if not _LOCAL_PRESERVATION.search(optimized_text):
        raise PromptOptimizationSafetyError(
            "AIGC local edit prompt omitted preservation semantics"
        )
    source_folded = f"{request.text} {request.optimization_direction}".casefold()
    output_folded = optimized_text.casefold()
    for source_tokens in _LOCAL_SCOPE_EXPANSION.values():
        if any(token in output_folded for token in source_tokens) and not any(
            token in source_folded for token in source_tokens
        ):
            raise PromptOptimizationSafetyError(
                "AIGC local edit prompt expanded the requested edit scope"
            )
    _enforce_safety(
        lambda: _validate_bbox_literals(
            request.text,
            optimized_text,
            field_name="text",
        )
    )
    repaired_contents, canonical_anchors_repaired = _repair_canonical_anchors(
        ["Edit Instructions"],
        [optimized_text],
        source_constraints,
    )
    optimized_text = repaired_contents[0]
    if canonical_anchors_repaired:
        warnings.append("canonical_anchor_repaired")
    _enforce_safety(
        lambda: _validate_canonical_anchors(
            ["Edit Instructions"],
            [optimized_text],
            source_constraints,
        )
    )
    optimized_text, fact_warnings = _repair_recoverable_facts(
        request.text,
        optimized_text,
    )
    warnings.extend(fact_warnings)

    references = [
        _normalize_preserving_literals(value)
        for value in result.optimized_reference_instructions
    ]
    if len(references) != len(request.reference_instructions):
        raise PromptOptimizationSafetyError(
            "AIGC prompt optimization changed reference count"
        )
    for index, (source, output) in enumerate(
        zip(request.reference_instructions, references, strict=True)
    ):
        if not output or "\n" in output or "\r" in output:
            raise PromptOptimizationSafetyError(
                "AIGC image prompt optimization returned invalid reference instruction"
            )
        _enforce_safety(
            lambda index=index, source=source, output=output: _validate_bbox_literals(
                source,
                output,
                field_name=f"reference_instructions[{index}]",
            )
        )
        output, reference_warnings = _repair_recoverable_facts(source, output)
        references[index] = output
        if reference_warnings:
            warnings.append("reference_constraint_repaired")
            warnings.extend(reference_warnings)
        _enforce_safety(
            lambda index=index, source=source, output=output: _validate_english(
                output,
                field_name=f"reference_instructions[{index}]",
                source_literals=extract_protected_literals(source)
                + tuple(
                    constraint.source_text
                    for constraint in source_constraints
                    if constraint.source_field == "reference_instruction"
                    and constraint.source_index == index
                ),
            )
        )
        _enforce_safety(
            lambda index=index, source=source, output=output: _validate_literal_counts(
                source,
                output,
                field_name=f"reference_instructions[{index}]",
                include_bare_numbers=False,
            )
        )
        _enforce_safety(
            lambda index=index, source=source, output=output: _validate_colors(
                source,
                output,
                field_name=f"reference_instructions[{index}]",
            )
        )

    _enforce_safety(
        lambda: _validate_literal_counts(
            request.text,
            optimized_text,
            field_name="text",
            include_bare_numbers=False,
        )
    )
    _enforce_safety(
        lambda: _validate_colors(
            request.text,
            optimized_text,
            field_name="text",
        )
    )
    _collect_warning(
        warnings,
        "required_subject_term_missing",
        lambda: _validate_required_terms(
            request.text,
            optimized_text,
            field_name="text",
        ),
    )
    _collect_warning(
        warnings,
        "unrequested_object_quantity",
        lambda: _validate_no_unrequested_object_quantities(
            request,
            [optimized_text],
            references,
            source_constraints,
        ),
    )
    _enforce_safety(
        lambda: _validate_no_direct_exclusion_reversal(
            request,
            optimized_text,
        )
    )
    if len(optimized_text) > 20000:
        raise PromptOptimizationSafetyError(
            "AIGC local edit prompt is too long"
        )
    return PromptOptimizationRenderResult(
        response=AigcPromptOptimizeResponse(
            optimized_text=optimized_text,
            optimized_reference_instructions=references,
        ),
        warnings=tuple(dict.fromkeys(warnings)),
    )


def render_local_edit_prompt(
    request: AigcPromptOptimizeRequest,
    result: AigcImagePromptLocalEditResult,
) -> AigcPromptOptimizeResponse:
    return render_local_edit_prompt_with_warnings(request, result).response


def render_image_prompt_sections_with_warnings(
    request: AigcPromptOptimizeRequest,
    result: AigcImagePromptSectionsResult,
) -> PromptOptimizationRenderResult:
    warnings: list[str] = []
    source_constraints = extract_source_constraints(request)
    source_literals = extract_protected_literals(
        " ".join([request.text, *request.reference_instructions])
    )
    anchored_literals = source_literals + tuple(
        constraint.source_text for constraint in source_constraints
    )
    canonical_anchors = tuple(
        constraint.anchor for constraint in source_constraints
    )
    labels: list[str] = []
    contents: list[str] = []
    for section in result.sections:
        label, label_repaired = _normalize_section_label(section.label)
        content, content_repaired = _normalize_section_content(
            section.content,
            protected_literals=canonical_anchors,
        )
        labels.append(label)
        contents.append(content)
        if label_repaired:
            warnings.append("section_label_repaired")
        if (
            content_repaired
            or _MARKDOWN_BLOCK.search(section.content)
            or section.content.lstrip().startswith(("{", "["))
        ):
            warnings.append("section_markup_repaired")
        _collect_warning(
            warnings,
            "non_english_content",
            lambda label=label: _validate_english(
                label,
                field_name=f"section label {label!r}",
            ),
        )
        _collect_warning(
            warnings,
            "non_english_content",
            lambda label=label, content=content: _validate_english(
                content,
                field_name=f"section {label!r}",
                source_literals=anchored_literals,
            ),
        )

    folded_labels = [label.casefold() for label in labels]
    if not 4 <= len(labels) <= 10:
        warnings.append("section_count_outside_recommendation")
    if len(folded_labels) != len(set(folded_labels)):
        warnings.append("duplicate_section_label")
    if "composition" not in folded_labels:
        warnings.append("missing_composition_section")
    if "negative prompt" not in folded_labels:
        warnings.append("missing_negative_prompt_section")
    contents, canonical_anchors_repaired = _repair_canonical_anchors(
        labels,
        contents,
        source_constraints,
    )
    if canonical_anchors_repaired:
        warnings.append("canonical_anchor_repaired")
    _enforce_safety(
        lambda: _validate_canonical_anchors(
            labels,
            contents,
            source_constraints,
        )
    )
    _enforce_safety(
        lambda: _validate_bbox_literals(
            request.text,
            "\n".join(contents),
            field_name="text",
        )
    )
    combined_contents = "\n".join(contents)
    repaired_combined, fact_warnings = _repair_recoverable_facts(
        request.text,
        combined_contents,
    )
    if fact_warnings:
        try:
            positive_index = positive_anchor_section_index(labels)
        except StopIteration as exc:
            raise PromptOptimizationSafetyError(
                "AIGC image prompt has no positive section for fact repair"
            ) from exc
        repair_suffix = repaired_combined[len(combined_contents) :].strip()
        contents[positive_index] = " ".join(
            [contents[positive_index], repair_suffix]
        ).strip()
        warnings.extend(fact_warnings)

    references = [
        _normalize_preserving_literals(value)
        for value in result.optimized_reference_instructions
    ]
    if not request.reference_instructions and references:
        references = []
        warnings.append("discarded_unrequested_reference_instructions")
    elif len(references) != len(request.reference_instructions):
        raise PromptOptimizationSafetyError(
            "AIGC prompt optimization changed reference count"
        )
    for index, (source, output) in enumerate(
        zip(request.reference_instructions, references, strict=True)
    ):
        if not output:
            raise PromptOptimizationSafetyError(
                "AIGC image prompt optimization returned invalid reference instruction"
            )
        _enforce_safety(
            lambda index=index, source=source, output=output: _validate_bbox_literals(
                source,
                output,
                field_name=f"reference_instructions[{index}]",
            )
        )
        output, reference_warnings = _repair_recoverable_facts(source, output)
        references[index] = output
        if reference_warnings:
            warnings.append("reference_constraint_repaired")
            warnings.extend(reference_warnings)
        _collect_warning(
            warnings,
            "non_english_reference_instruction",
            lambda index=index, source=source, output=output: _validate_english(
                output,
                field_name=f"reference_instructions[{index}]",
                source_literals=extract_protected_literals(source)
                + tuple(
                    constraint.source_text
                    for constraint in source_constraints
                    if constraint.source_field == "reference_instruction"
                    and constraint.source_index == index
                ),
            ),
        )
        _enforce_safety(
            lambda index=index, source=source, output=output: _validate_colors(
                source,
                output,
                field_name=f"reference_instructions[{index}]",
            )
        )
        _collect_warning(
            warnings,
            "required_subject_term_missing",
            lambda index=index, source=source, output=output: _validate_required_terms(
                source,
                output,
                field_name=f"reference_instructions[{index}]",
            ),
        )
        _collect_warning(
            warnings,
            "reference_action_wording_changed",
            lambda source=source, output=output: _validate_reference_actions(
                source,
                output,
            ),
        )

    _collect_warning(
        warnings,
        "unrequested_object_quantity",
        lambda: _validate_no_unrequested_object_quantities(
            request,
            contents,
            references,
            source_constraints,
        ),
    )
    _collect_warning(
        warnings,
        "unrequested_non_object_number",
        lambda: _validate_no_unrequested_quantities(
            request,
            contents,
            references,
            source_constraints,
        ),
    )

    rendered_lines = [
        f"{label}: {content}"
        for label, content in zip(labels, contents, strict=True)
    ]
    optimized_text = "\n".join(rendered_lines)
    if len(optimized_text) > 20000:
        raise PromptOptimizationSafetyError(
            "AIGC image prompt optimization rendered text is too long"
        )
    _enforce_safety(
        lambda: _validate_no_direct_exclusion_reversal(
            request,
            optimized_text,
        )
    )

    for index, (source, output) in enumerate(
        zip(request.reference_instructions, references, strict=True)
    ):
        _enforce_safety(
            lambda index=index, source=source, output=output: _validate_literal_counts(
                source,
                output,
                field_name=f"reference_instructions[{index}]",
                include_bare_numbers=False,
            )
        )
    _enforce_safety(
        lambda: _validate_literal_counts(
            request.text,
            optimized_text,
            field_name="text",
            include_bare_numbers=False,
        )
    )
    _enforce_safety(
        lambda: _validate_colors(
            request.text,
            optimized_text,
            field_name="text",
        )
    )
    _collect_warning(
        warnings,
        "required_subject_term_missing",
        lambda: _validate_required_terms(
            request.text,
            optimized_text,
            field_name="text",
        ),
    )
    if "negative prompt" in folded_labels:
        negative_index = folded_labels.index("negative prompt")
        _collect_warning(
            warnings,
            "negative_prompt_possible_conflict",
            lambda: _validate_negative_prompt(
                request,
                contents[negative_index],
            ),
        )
    return PromptOptimizationRenderResult(
        response=AigcPromptOptimizeResponse(
            optimized_text=optimized_text,
            optimized_reference_instructions=references,
        ),
        warnings=tuple(dict.fromkeys(warnings)),
    )


def validate_prompt_optimization_result(
    request: AigcPromptOptimizeRequest,
    result: AigcPromptOptimizeResponse,
) -> None:
    if request.target_type in {"text_to_image", "image_to_image"}:
        # Image prompt optimization treats requested constraints as guidance.
        # The renderer records deviations as warnings rather than rejecting a
        # usable provider result.
        return
    else:
        source_text = request.text
        if (
            request.target_type == "video_generation"
            and _VIDEO_DURATION_REWRITE.search(
                f"{request.optimization_direction}\n{request.text}"
            )
        ):
            source_text = _VIDEO_TIMELINE_RANGE.sub(" ", source_text)
        _validate_literal_counts(
            source_text,
            result.optimized_text,
            field_name="text",
        )
    if request.target_type in {"text_to_image", "image_to_image"}:
        if len(result.optimized_reference_instructions) != len(
            request.reference_instructions
        ):
            raise PromptOptimizationSafetyError(
                "AIGC prompt optimization changed reference count"
            )
        for index, (source, output) in enumerate(
            zip(
                request.reference_instructions,
                result.optimized_reference_instructions,
                strict=True,
            )
        ):
            _enforce_safety(
                lambda index=index, source=source, output=output: _validate_literal_counts(
                    source,
                    output,
                    field_name=f"reference_instructions[{index}]",
                    include_bare_numbers=False,
                )
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
