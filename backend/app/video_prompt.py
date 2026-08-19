from __future__ import annotations

import re
from collections import Counter
from collections.abc import Sequence
from typing import Protocol


MAX_VIDEO_PROMPT_LENGTH = 12_000

_PROMPT_CONTRACTS = {
    "zh": {
        "headers": (
            "【整体要求】",
            "【连续时间轴】",
            "【语音】",
            "【负向约束】",
        ),
        "total": "生成总时长 {duration} 秒的连贯广告视频。",
        "continuity": (
            "保持主体、服装、场景、光影和空间关系连续，剧情按时间轴顺序发展。"
        ),
        "overall_intent": "整体创作意图：{intent}",
        "plot": "剧情：{value}",
        "default_plot": "保持当前剧情自然推进。",
        "camera": "镜头：{value}",
        "default_camera": "使用清晰、稳定且符合剧情的镜头语言。",
        "intent": "创作意图：{intent}",
        "narration": "语音：自然、清晰的普通话旁白或对白“{value}”。",
        "ambient": "声音：无对白，仅生成环境音与动作音。",
        "voice": "生成自然、清晰的普通话语音，语音与画面动作自然匹配。",
        "no_voice": "不生成旁白或对白，仅保留与剧情匹配的环境音和动作音。",
        "negative": (
            "时间轴必须连续，不要遗漏、调换或重复剧情顺序；避免过度切镜、"
            "主体变形、人物身份漂移、口型明显错位。"
        ),
        "total_label": "总时长 {duration} 秒",
        "speech_rule": "普通话",
        "no_dialogue_rule": "不生成旁白或对白",
    },
    "en": {
        "headers": (
            "[Overall Requirements]",
            "[Continuous Timeline]",
            "[Voice]",
            "[Negative Constraints]",
        ),
        "total": "Generate a coherent {duration}-second advertising video.",
        "continuity": (
            "Keep subjects, wardrobe, setting, lighting, and spatial relationships "
            "continuous, with the story progressing in timeline order."
        ),
        "overall_intent": "Overall creative intent: {intent}",
        "plot": "Plot: {value}",
        "default_plot": "Let the current plot progress naturally.",
        "camera": "Camera: {value}",
        "default_camera": "Use clear, stable camera language appropriate to the plot.",
        "intent": "Creative intent: {intent}",
        "narration": 'Voice: natural, clear English narration or dialogue: "{value}"',
        "ambient": "Sound: no dialogue; generate only ambient and action sounds.",
        "voice": (
            "Generate natural, clear English speech synchronized naturally with "
            "the on-screen action."
        ),
        "no_voice": (
            "Do not generate narration or dialogue; retain only ambient and action "
            "sounds matching the plot."
        ),
        "negative": (
            "Keep the timeline continuous without omitting, reordering, or repeating "
            "plot events. Avoid excessive cuts, subject deformation, identity drift, "
            "and visibly mismatched lip movement."
        ),
        "total_label": "{duration}-second",
        "speech_rule": "natural, clear English speech",
        "no_dialogue_rule": "Do not generate narration or dialogue",
    },
}
_LEGACY_PROMPT_HEADERS = (
    "【整体要求】",
    "【连续时间轴】",
    "【语音与字幕】",
    "【负向约束】",
)
_FORBIDDEN_SUBTITLE_FORMAT_TERMS = (
    "简体中文",
    "底部安全区",
    "白字",
    "黑色描边",
    "逐字一致",
    "burned-in text",
    "burnt-in text",
    "closed captions",
)
_FORBIDDEN_SUBTITLE_INSTRUCTION_PATTERNS = (
    re.compile(
        r"(?:添加|加入|显示|展示|呈现|叠加|覆盖|放置|插入|生成|写上|打上|"
        r"使用|采用|出现).{0,12}?(?:字幕|画面文字|屏幕文字|文字|文案)"
    ),
    re.compile(
        r"(?:字幕|画面文字|屏幕文字|文字|文案).{0,8}?"
        r"(?:叠加|覆盖|显示|展示|呈现|出现|写入|置于|放在|同步)"
    ),
    re.compile(r"(?:字幕|画面文字|屏幕文字|文字叠加|文案叠加)\s*[：:]"),
    re.compile(
        r"\b(?:add|insert|include|show|display|render|overlay|place|put|use|"
        r"create|generate|burn(?:ed)?(?:-|\s)?in)\b.{0,30}?"
        r"\b(?:text overlays?|on-?screen text|onscreen text|captions?|subtitles?)\b",
        flags=re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:text overlays?|on-?screen text|onscreen text|captions?|subtitles?)\b"
        r".{0,20}?\b(?:overlay|display|show|appear|place|render|burn)\b",
        flags=re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:text overlays?|on-?screen text|onscreen text|captions?|subtitles?)\s*:",
        flags=re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:captions?\s*/\s*subtitles?|subtitles?\s*/\s*captions?)\s*:",
        flags=re.IGNORECASE,
    ),
)
_STANDARD_REFERENCE_TOKEN_PATTERN = re.compile(
    r"\((?:参考@(?:图|视频|音频)|reference@(?:image|video|audio))\d+\)",
    flags=re.IGNORECASE,
)
_NARRATION_LABEL = re.compile(
    r"^\s*(?:旁白\s*/\s*字幕|旁白|字幕|对白|"
    r"narration(?:\s*/\s*subtitles?)?|voice[\s-]?over|"
    r"subtitles?|captions?|dialogue)\s*[：:]\s*",
    flags=re.IGNORECASE,
)


class VideoPromptShot(Protocol):
    id: str
    title: str | None
    description: str
    duration_seconds: float
    merge_source_shots: Sequence["VideoPromptShot"]
    narration: str | None
    video_prompt: str | None
    visual_prompt: str


def format_prompt_seconds(value: float) -> str:
    rounded = round(value, 3)
    if rounded.is_integer():
        return str(int(rounded))
    return f"{rounded:.3f}".rstrip("0").rstrip(".")


def _contract(target_language: str) -> dict[str, object]:
    language = str(getattr(target_language, "value", target_language)).lower()
    if language not in _PROMPT_CONTRACTS:
        raise ValueError("target_language must be 'zh' or 'en'")
    return _PROMPT_CONTRACTS[language]


def strip_narration_label(
    value: str | None,
    *,
    target_language: str = "zh",
) -> str | None:
    _contract(target_language)
    if value is None:
        return None
    cleaned_lines = [
        _NARRATION_LABEL.sub("", line).strip()
        for line in value.splitlines()
        if line.strip()
    ]
    cleaned = "\n".join(line for line in cleaned_lines if line)
    return cleaned or None


def is_structured_video_prompt(
    value: str | None,
    *,
    target_language: str = "zh",
) -> bool:
    if not value:
        return False
    language = str(getattr(target_language, "value", target_language)).lower()
    if not _contains_contract(value, language):
        return False
    return not any(
        header in value
        for other_language, contract in _PROMPT_CONTRACTS.items()
        if other_language != language
        for header in contract["headers"]
    )


def is_legacy_structured_video_prompt(value: str | None) -> bool:
    if not value:
        return False
    return all(header in value for header in _LEGACY_PROMPT_HEADERS)


def is_known_structured_video_prompt(
    value: str | None,
    *,
    target_language: str = "zh",
) -> bool:
    _contract(target_language)
    return (
        any(
            _contains_contract(value, language)
            for language in _PROMPT_CONTRACTS
        )
        or is_legacy_structured_video_prompt(value)
    )


def _contains_contract(value: str | None, target_language: str) -> bool:
    if not value:
        return False
    headers = _contract(target_language)["headers"]
    assert isinstance(headers, tuple)
    return all(header in value for header in headers)


def contains_forbidden_subtitle_terms(value: str | None) -> bool:
    if not value:
        return False
    normalized = value.lower()
    return any(
        term.lower() in normalized
        for term in _FORBIDDEN_SUBTITLE_FORMAT_TERMS
    ) or any(
        pattern.search(value)
        for pattern in _FORBIDDEN_SUBTITLE_INSTRUCTION_PATTERNS
    )


def extract_standard_reference_tokens(value: str | None) -> list[str]:
    if not value:
        return []
    return [
        match.group(0)
        for match in _STANDARD_REFERENCE_TOKEN_PATTERN.finditer(value)
    ]


def strip_markdown_code_fence(value: str) -> str:
    stripped = value.strip()
    match = re.fullmatch(
        r"```(?:text|markdown|md)?\s*\n?(.*?)\n?```",
        stripped,
        flags=re.DOTALL | re.IGNORECASE,
    )
    return match.group(1).strip() if match else stripped


def build_single_shot_video_prompt(
    shot: VideoPromptShot,
    *,
    creative_intent: str | None = None,
    target_language: str = "zh",
) -> str:
    _contract(target_language)
    atomic_shots = expand_atomic_shots(shot)
    return _build_video_prompt(
        atomic_shots,
        creative_intents=_creative_intents(
            atomic_shots,
            target_language=target_language,
        ),
        overall_creative_intent=creative_intent,
        target_language=target_language,
    )


def build_merged_shot_video_prompt(
    shots: Sequence[VideoPromptShot],
    *,
    target_language: str = "zh",
) -> str:
    _contract(target_language)
    if len(shots) < 2:
        raise ValueError("at least two shots are required to build a merged prompt")
    atomic_shots = [
        atomic_shot
        for shot in shots
        for atomic_shot in expand_atomic_shots(shot)
    ]
    return _build_video_prompt(
        atomic_shots,
        creative_intents=_creative_intents(
            atomic_shots,
            target_language=target_language,
        ),
        target_language=target_language,
    )


def normalize_video_prompt(
    shot: VideoPromptShot,
    custom_prompt: str | None,
    *,
    target_language: str = "zh",
) -> str:
    _contract(target_language)
    normalized = custom_prompt.strip() if custom_prompt else None
    if normalized and is_structured_video_prompt(
        normalized,
        target_language=target_language,
    ):
        if len(normalized) > MAX_VIDEO_PROMPT_LENGTH:
            raise ValueError(
                f"video prompt must not exceed {MAX_VIDEO_PROMPT_LENGTH} characters"
            )
        if shot.merge_source_shots:
            validate_merged_prompt_timeline(
                normalized,
                list(shot.merge_source_shots),
                target_language=target_language,
            )
        return normalized
    if normalized and is_known_structured_video_prompt(
        normalized,
        target_language=target_language,
    ):
        normalized = None
    return build_single_shot_video_prompt(
        shot,
        creative_intent=normalized,
        target_language=target_language,
    )


def expand_atomic_shots(shot: VideoPromptShot) -> list[VideoPromptShot]:
    merge_source_shots = getattr(shot, "merge_source_shots", [])
    if merge_source_shots:
        return [
            atomic_shot
            for source in merge_source_shots
            for atomic_shot in expand_atomic_shots(source)
        ]
    return [shot]


def expected_timeline_ranges(
    atomic_shots: Sequence[VideoPromptShot],
) -> list[tuple[float, float]]:
    cursor = 0.0
    ranges: list[tuple[float, float]] = []
    for shot in atomic_shots:
        end = cursor + shot.duration_seconds
        ranges.append((round(cursor, 3), round(end, 3)))
        cursor = end
    return ranges


def extract_timeline_ranges(
    prompt: str,
    *,
    target_language: str = "zh",
) -> list[tuple[float, float]]:
    headers = _contract(target_language)["headers"]
    assert isinstance(headers, tuple)
    timeline_marker = headers[1]
    next_marker = headers[2]
    start = prompt.find(timeline_marker)
    if start < 0:
        return []
    start += len(timeline_marker)
    end = prompt.find(next_marker, start)
    if end < 0:
        return []
    timeline = prompt[start:end]
    pattern = re.compile(
        r"\[?\s*(-?\d+(?:\.\d+)?)\s*(?:s|秒)?\s*"
        r"[-–—~～]\s*(-?\d+(?:\.\d+)?)\s*(?:s|秒)\s*\]?",
        flags=re.IGNORECASE,
    )
    return [
        (float(match.group(1)), float(match.group(2)))
        for match in pattern.finditer(timeline)
    ]


def validate_merged_prompt_timeline(
    prompt: str,
    atomic_shots: Sequence[VideoPromptShot],
    *,
    target_language: str = "zh",
) -> None:
    _contract(target_language)
    expected = expected_timeline_ranges(atomic_shots)
    actual = extract_timeline_ranges(prompt, target_language=target_language)
    expected_label = "、".join(
        f"[{format_prompt_seconds(start)}s-{format_prompt_seconds(end)}s]"
        for start, end in expected
    )
    if len(actual) != len(expected):
        raise ValueError(
            "合并分镜提示词必须保留全部原子时间区间"
            f"（需要：{expected_label}）"
        )

    tolerance = 0.001
    for index, ((actual_start, actual_end), (expected_start, expected_end)) in enumerate(
        zip(actual, expected),
        start=1,
    ):
        if actual_start < 0 or actual_end <= actual_start:
            raise ValueError(
                f"第 {index} 个时间区间无效（需要：{expected_label}）"
            )
        if abs(actual_start - expected_start) <= tolerance and abs(
            actual_end - expected_end
        ) <= tolerance:
            continue
        if actual_start > expected_start + tolerance:
            reason = "存在时间轴空洞"
        elif actual_start < expected_start - tolerance:
            reason = "存在时间轴重叠或顺序错误"
        else:
            reason = "原子时间边界被修改"
        raise ValueError(f"{reason}（需要：{expected_label}）")


def validate_optimized_video_prompt(
    prompt: str,
    atomic_shots: Sequence[VideoPromptShot],
    *,
    target_language: str = "zh",
    reference_image_count: int = 0,
    reference_video_count: int = 0,
    reference_audio_count: int = 0,
    required_reference_tokens: Sequence[str] | None = None,
) -> str:
    contract = _contract(target_language)
    normalized = strip_markdown_code_fence(prompt)
    if not normalized:
        raise ValueError("optimized video prompt must not be empty")
    if len(normalized) > MAX_VIDEO_PROMPT_LENGTH:
        raise ValueError(
            f"video prompt must not exceed {MAX_VIDEO_PROMPT_LENGTH} characters"
        )
    if not atomic_shots:
        raise ValueError("at least one shot is required to validate a video prompt")

    headers = contract["headers"]
    assert isinstance(headers, tuple)
    positions = [normalized.find(header) for header in headers]
    if any(position < 0 for position in positions):
        raise ValueError("optimized video prompt is missing required sections")
    if positions != sorted(positions) or any(
        normalized.count(header) != 1 for header in headers
    ):
        raise ValueError(
            "optimized video prompt sections must appear once in the required order"
        )

    language = str(getattr(target_language, "value", target_language)).lower()
    other_language = "en" if language == "zh" else "zh"
    other_headers = _contract(other_language)["headers"]
    assert isinstance(other_headers, tuple)
    if any(header in normalized for header in other_headers):
        raise ValueError("optimized video prompt mixes language section contracts")

    validate_merged_prompt_timeline(
        normalized,
        atomic_shots,
        target_language=target_language,
    )
    total = sum(shot.duration_seconds for shot in atomic_shots)
    total_label = str(contract["total_label"]).format(
        duration=format_prompt_seconds(total)
    )
    if total_label not in normalized:
        raise ValueError("optimized video prompt total duration does not match the shot")

    for index, shot in enumerate(atomic_shots, start=1):
        description = shot.description.strip()
        visual_prompt = shot.visual_prompt.strip()
        narration = strip_narration_label(
            shot.narration,
            target_language=target_language,
        )
        if description and description not in normalized:
            raise ValueError(
                f"optimized video prompt changed atomic shot {index} plot"
            )
        if visual_prompt and visual_prompt not in normalized:
            raise ValueError(
                f"optimized video prompt changed atomic shot {index} visual intent"
            )
        if narration and narration not in normalized:
            raise ValueError(
                f"optimized video prompt changed atomic shot {index} narration"
            )

    allowed_reference_counts = {
        "图": reference_image_count,
        "视频": reference_video_count,
        "音频": reference_audio_count,
    }
    for kind, number in re.findall(
        r"参考\s*@?\s*(图|视频|音频)\s*(\d+)",
        normalized,
    ):
        if int(number) < 1 or int(number) > allowed_reference_counts[kind]:
            raise ValueError("optimized video prompt invented a reference asset")
    english_reference_counts = {
        "image": reference_image_count,
        "video": reference_video_count,
        "audio": reference_audio_count,
    }
    for kind, number in re.findall(
        r"reference\s*@?\s*(image|video|audio)\s*(\d+)",
        normalized,
        flags=re.IGNORECASE,
    ):
        if (
            int(number) < 1
            or int(number) > english_reference_counts[kind.lower()]
        ):
            raise ValueError("optimized video prompt invented a reference asset")

    if required_reference_tokens is not None:
        required_tokens = Counter(required_reference_tokens)
        actual_tokens = Counter(extract_standard_reference_tokens(normalized))
        if required_tokens - actual_tokens:
            raise ValueError(
                "optimized video prompt is missing required reference tokens"
            )
        if actual_tokens - required_tokens:
            raise ValueError(
                "optimized video prompt invented a standard reference token"
            )

    has_narration = any(
        strip_narration_label(
            shot.narration,
            target_language=target_language,
        )
        for shot in atomic_shots
    )
    if has_narration:
        if str(contract["speech_rule"]).lower() not in normalized.lower():
            raise ValueError(
                "optimized video prompt is missing narration speech rules"
            )
    elif str(contract["no_dialogue_rule"]).lower() not in normalized.lower():
        raise ValueError(
            "optimized video prompt must forbid dialogue"
        )

    return normalized


def _creative_intents(
    shots: Sequence[VideoPromptShot],
    *,
    target_language: str,
) -> list[str | None]:
    return [
        shot.video_prompt.strip()
        if (
            shot.video_prompt
            and not is_known_structured_video_prompt(
                shot.video_prompt,
                target_language=target_language,
            )
        )
        else None
        for shot in shots
    ]


def _build_video_prompt(
    shots: Sequence[VideoPromptShot],
    *,
    creative_intents: Sequence[str | None],
    overall_creative_intent: str | None = None,
    target_language: str,
) -> str:
    if not shots:
        raise ValueError("at least one shot is required to build a video prompt")
    if len(shots) != len(creative_intents):
        raise ValueError("creative intent count must match shot count")

    descriptions = [shot.description.strip() for shot in shots]
    visuals = [shot.visual_prompt.strip() for shot in shots]
    intents = [intent.strip() if intent else "" for intent in creative_intents]
    prompt = _render_prompt(
        shots,
        descriptions=descriptions,
        visuals=visuals,
        creative_intents=intents,
        overall_creative_intent=overall_creative_intent,
        target_language=target_language,
    )
    if len(prompt) <= MAX_VIDEO_PROMPT_LENGTH:
        return prompt

    empty_prompt = _render_prompt(
        shots,
        descriptions=["" for _ in shots],
        visuals=["" for _ in shots],
        creative_intents=["" for _ in shots],
        overall_creative_intent=overall_creative_intent,
        target_language=target_language,
    )
    available = MAX_VIDEO_PROMPT_LENGTH - len(empty_prompt)
    fields = [
        (kind, index, value)
        for index in range(len(shots))
        for kind, value in (
            ("description", descriptions[index]),
            ("visual", visuals[index]),
            ("intent", intents[index]),
        )
        if value
    ]
    if available < len(fields) * 8:
        raise ValueError(
            f"video prompt must not exceed {MAX_VIDEO_PROMPT_LENGTH} characters"
        )

    per_field = max(8, available // max(1, len(fields)))
    compressed_descriptions = descriptions.copy()
    compressed_visuals = visuals.copy()
    compressed_intents = intents.copy()
    for kind, index, value in fields:
        compressed = _truncate(value, per_field)
        if kind == "description":
            compressed_descriptions[index] = compressed
        elif kind == "visual":
            compressed_visuals[index] = compressed
        else:
            compressed_intents[index] = compressed

    compressed_prompt = _render_prompt(
        shots,
        descriptions=compressed_descriptions,
        visuals=compressed_visuals,
        creative_intents=compressed_intents,
        overall_creative_intent=overall_creative_intent,
        target_language=target_language,
    )
    if len(compressed_prompt) > MAX_VIDEO_PROMPT_LENGTH:
        raise ValueError(
            f"video prompt must not exceed {MAX_VIDEO_PROMPT_LENGTH} characters"
        )
    return compressed_prompt


def _render_prompt(
    shots: Sequence[VideoPromptShot],
    *,
    descriptions: Sequence[str],
    visuals: Sequence[str],
    creative_intents: Sequence[str],
    overall_creative_intent: str | None,
    target_language: str,
) -> str:
    contract = _contract(target_language)
    headers = contract["headers"]
    assert isinstance(headers, tuple)
    total = sum(shot.duration_seconds for shot in shots)
    sections = [
        headers[0],
        (
            str(contract["total"]).format(duration=format_prompt_seconds(total))
            + str(contract["continuity"])
        ),
    ]
    if overall_creative_intent:
        sections.append(
            str(contract["overall_intent"]).format(
                intent=overall_creative_intent
            )
        )
    sections.extend(["", headers[1]])

    cursor = 0.0
    has_narration = False
    for index, shot in enumerate(shots):
        end = cursor + shot.duration_seconds
        narration = strip_narration_label(
            shot.narration,
            target_language=target_language,
        )
        sections.extend(
            [
                (
                    f"[{format_prompt_seconds(cursor)}s-"
                    f"{format_prompt_seconds(end)}s]"
                ),
                str(contract["plot"]).format(
                    value=descriptions[index] or contract["default_plot"]
                ),
                str(contract["camera"]).format(
                    value=visuals[index] or contract["default_camera"]
                ),
            ]
        )
        if creative_intents[index]:
            sections.append(
                str(contract["intent"]).format(intent=creative_intents[index])
            )
        if narration:
            has_narration = True
            sections.append(
                str(contract["narration"]).format(value=narration),
            )
        else:
            sections.append(str(contract["ambient"]))
        sections.append("")
        cursor = end

    sections.extend([headers[2]])
    if has_narration:
        sections.append(str(contract["voice"]))
    else:
        sections.append(str(contract["no_voice"]))
    sections.extend(
        [
            "",
            headers[3],
            str(contract["negative"]),
        ]
    )
    return "\n".join(sections).strip()


def _truncate(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    if limit <= 1:
        return "…"
    return f"{value[: limit - 1].rstrip()}…"
