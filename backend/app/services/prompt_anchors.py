from __future__ import annotations

from dataclasses import dataclass
import re

from backend.app.schemas import AigcPromptOptimizeRequest


_LABELED_LITERAL = re.compile(
    r"(?:品牌|型号|brand|model)\s*[:：]?\s*"
    r"([A-Za-z0-9\u3400-\u9fff][A-Za-z0-9\u3400-\u9fff._+/-]*"
    r"(?:\s+[A-Za-z0-9][A-Za-z0-9._+/-]*){0,3})",
    re.IGNORECASE,
)
_CHINESE_QUANTITY = re.compile(
    r"(?P<text>(?P<value>\d+(?:\.\d+)?)\s*"
    r"(?P<classifier>个|件|瓶|杯|盒|罐|袋|支|套|台|辆|本|张|只|位|名|颗|份|组)"
    r"\s*(?P<object>[\u3400-\u9fffA-Za-z][\u3400-\u9fffA-Za-z0-9._+/-]{0,23}?)?)"
    r"(?=放在|置于|摆在|位于|用于|作为|并|与|和|但|且|的(?:主图|海报)|"
    r"[，。；;,\n]|$)"
)
_ENGLISH_QUANTITY_PHRASE = re.compile(
    r"(?P<text>\b(?P<value>\d+(?:\.\d+)?)\s+"
    r"(?P<classifier>bottles?|cups?|glasses?|boxes?|cartons?|cans?|jars?|"
    r"bags?|pouches?|tubes?|sticks?|sets?|units?|devices?|vehicles?|cars?|"
    r"books?|copies|sheets?|pieces?|animals?|people|persons?|servings?|"
    r"portions?|groups?|items?|products?|packages?)"
    r"(?:\s+of)?(?:\s+(?P<object>[A-Za-z][A-Za-z0-9._+/-]*))?)\b",
    re.IGNORECASE,
)
_CHINESE_EXCLUSION = re.compile(
    r"(?P<text>(?P<marker>不要|不得|禁止|避免|严禁|切勿|不允许|不应|不可|"
    r"不能|无需|不含|没有|无|不改变|不修改|不添加|不出现|别|去除|"
    r"移除|删除|排除)"
    r"(?P<body>[^，。；;,\n”」』]+))"
)
_ENGLISH_EXCLUSION = re.compile(
    r"(?P<text>\b(?:no|without)\s+(?P<body>[^,.;\n]+)"
    r"|\b(?:do\s+not|don't|must\s+not|never)\s+"
    r"(?P<body_action>[^,.;\n]+))",
    re.IGNORECASE,
)
_CONTEXTUAL_IDENTITY = re.compile(
    r"(?:为|围绕)\s*"
    r"(?P<value>[\u3400-\u9fffA-Za-z0-9][\u3400-\u9fffA-Za-z0-9._+/-]{1,39}?)"
    r"(?=\s*(?:制作|打造|设计|创作))"
    r"|(?:展示|呈现|突出|保留)\s*"
    r"(?P<display_value>"
    r"[\u3400-\u9fffA-Za-z0-9][\u3400-\u9fffA-Za-z0-9._+/-]{1,39}?)"
    r"(?=\s*(?:产品|商品)?(?:主图|海报|包装))"
)
_ARTIFACT_IDENTITY = re.compile(
    r"(?:^|[，。；;,\n])\s*(?:请\s*)?"
    r"(?:(?:生成|制作|打造|设计|创作|展示|呈现|突出|保留)\s*)?"
    r"(?P<value>[\u3400-\u9fffA-Za-z0-9][\u3400-\u9fffA-Za-z0-9._+/-]{1,39}?)"
    r"(?=(?:产品|商品)?(?:主图|海报|包装)(?:$|[，。；;,\s]))"
)
_GENERIC_IDENTITY_CANDIDATES = {
    "产品",
    "商品",
    "包装",
    "海报",
    "图片",
    "画面",
    "场景",
    "背景",
    "红色",
    "蓝色",
    "绿色",
    "黑色",
    "白色",
    "黄色",
    "紫色",
    "橙色",
}
_EXCLUSION_ACTION_PREFIX = re.compile(
    r"^(?:再|出现|包含|添加|增加|加入|展示|生成|放置|带有|有|改变|修改|改动)+"
)
_ANCHOR_PREFIXES = {
    "identity": "Preserve exact identity",
    "exclusion": "Honor exclusion exactly",
    "quantity": "Preserve exact quantity-object constraint",
}


@dataclass(frozen=True)
class SourceConstraint:
    kind: str
    source_field: str
    source_index: int | None
    source_text: str
    source_value: str

    @property
    def anchor(self) -> str:
        return f"{_ANCHOR_PREFIXES[self.kind]}: {self.source_text}"


def source_values(
    request: AigcPromptOptimizeRequest,
) -> list[tuple[str, int | None, str]]:
    return [
        ("text", None, request.text),
        *(
            ("reference_instruction", index, value)
            for index, value in enumerate(request.reference_instructions)
        ),
    ]


def _quantity_constraints(
    source_field: str,
    source_index: int | None,
    source: str,
) -> list[SourceConstraint]:
    return [
        SourceConstraint(
            kind="quantity",
            source_field=source_field,
            source_index=source_index,
            source_text=match.group("text").strip(),
            source_value=match.group("value"),
        )
        for pattern in (_CHINESE_QUANTITY, _ENGLISH_QUANTITY_PHRASE)
        for match in pattern.finditer(source)
    ]


def _identity_constraints(
    source_field: str,
    source_index: int | None,
    source: str,
    quantities: list[SourceConstraint],
) -> list[SourceConstraint]:
    values = [match.group(1).strip() for match in _LABELED_LITERAL.finditer(source)]
    for match in _CONTEXTUAL_IDENTITY.finditer(source):
        value = (match.group("value") or match.group("display_value")).strip()
        if value not in _GENERIC_IDENTITY_CANDIDATES:
            values.append(value)
    for match in _ARTIFACT_IDENTITY.finditer(source):
        value = re.sub(
            r"^(?:一张|一幅|一个)", "", match.group("value").strip()
        ).strip()
        if value not in _GENERIC_IDENTITY_CANDIDATES:
            values.append(value)
    for quantity in quantities:
        match = _CHINESE_QUANTITY.fullmatch(quantity.source_text)
        if match is None:
            continue
        source_object = (match.group("object") or "").strip()
        if (
            source_object
            and source_object not in _GENERIC_IDENTITY_CANDIDATES
            and len(source_object) >= 2
        ):
            values.append(source_object)

    return [
        SourceConstraint(
            kind="identity",
            source_field=source_field,
            source_index=source_index,
            source_text=value,
            source_value=value,
        )
        for value in dict.fromkeys(values)
    ]


def _exclusion_constraints(
    source_field: str,
    source_index: int | None,
    source: str,
) -> list[SourceConstraint]:
    constraints: list[SourceConstraint] = []
    for pattern in (_CHINESE_EXCLUSION, _ENGLISH_EXCLUSION):
        for match in pattern.finditer(source):
            body = match.groupdict().get("body") or match.groupdict().get(
                "body_action"
            )
            assert body is not None
            value = _EXCLUSION_ACTION_PREFIX.sub("", body.strip()).strip()
            if value:
                constraints.append(
                    SourceConstraint(
                        kind="exclusion",
                        source_field=source_field,
                        source_index=source_index,
                        source_text=match.group("text").strip(),
                        source_value=value,
                    )
                )
    return constraints


def extract_source_constraints(
    request: AigcPromptOptimizeRequest,
) -> tuple[SourceConstraint, ...]:
    constraints: list[SourceConstraint] = []
    for source_field, source_index, source in source_values(request):
        quantities = _quantity_constraints(source_field, source_index, source)
        constraints.extend(quantities)
        constraints.extend(
            _identity_constraints(source_field, source_index, source, quantities)
        )
        constraints.extend(_exclusion_constraints(source_field, source_index, source))

    quantity_locations = {
        (constraint.source_field, constraint.source_index, constraint.source_text)
        for constraint in constraints
        if constraint.kind == "quantity"
    }
    result: list[SourceConstraint] = []
    seen: set[tuple[str, int | None, str, str]] = set()
    for constraint in constraints:
        if constraint.kind == "identity" and any(
            constraint.source_field == field
            and constraint.source_index == index
            and constraint.source_text in quantity_text
            for field, index, quantity_text in quantity_locations
        ):
            continue
        key = (
            constraint.source_field,
            constraint.source_index,
            constraint.kind,
            constraint.source_text,
        )
        if key not in seen:
            seen.add(key)
            result.append(constraint)
    return tuple(result)


def positive_anchor_section_index(labels: list[str]) -> int:
    normalized = [label.casefold() for label in labels]
    for preferred in (
        "product",
        "subject",
        "target changes",
        "edit instructions",
        "preserve",
        "reference usage",
    ):
        if preferred in normalized:
            return normalized.index(preferred)
    return next(
        index
        for index, label in enumerate(normalized)
        if label not in {"composition", "negative prompt"}
    )
