import pytest

from backend.app.schemas import Status, StoryboardShotCreate
from backend.app.video_prompt import (
    MAX_VIDEO_PROMPT_LENGTH,
    build_merged_shot_video_prompt,
    build_single_shot_video_prompt,
    contains_forbidden_subtitle_terms,
    extract_timeline_ranges,
    normalize_video_prompt,
    strip_narration_label,
    validate_merged_prompt_timeline,
    validate_optimized_video_prompt,
)


def _shot(
    index: int,
    *,
    duration: float,
    description: str | None = None,
    visual_prompt: str | None = None,
    narration: str | None = "旁白/字幕：开始体验。",
    video_prompt: str | None = None,
) -> StoryboardShotCreate:
    return StoryboardShotCreate(
        project_id="project-1",
        index=index,
        title=f"镜头 {index}",
        description=description or f"镜头 {index} 的剧情。",
        visual_prompt=visual_prompt or f"镜头 {index} 的运镜。",
        narration=narration,
        duration_seconds=duration,
        status=Status.DRAFT,
        video_prompt=video_prompt,
    )


def test_single_shot_prompt_uses_full_timeline_and_speech_only_rules() -> None:
    prompt = build_single_shot_video_prompt(_shot(1, duration=5))

    assert "[0s-5s]" in prompt
    assert "语音：自然、清晰的普通话旁白或对白“开始体验。”" in prompt
    assert "【语音】" in prompt
    assert "生成自然、清晰的普通话语音" in prompt
    assert "字幕：" not in prompt
    assert "字幕使用简体中文" not in prompt
    assert "画面底部安全区" not in prompt
    assert "白字、黑色描边" not in prompt
    assert "只显示上方指定字幕" not in prompt


def test_merged_prompt_preserves_continuous_source_shot_boundaries() -> None:
    prompt = build_merged_shot_video_prompt(
        [
            _shot(1, duration=5),
            _shot(2, duration=4.5),
            _shot(3, duration=6),
        ]
    )

    assert "[0s-5s]" in prompt
    assert "[5s-9.5s]" in prompt
    assert "[9.5s-15.5s]" in prompt
    assert "生成总时长 15.5 秒" in prompt
    assert prompt.index("镜头 1 的剧情") < prompt.index("镜头 2 的剧情")
    assert prompt.index("镜头 2 的剧情") < prompt.index("镜头 3 的剧情")


def test_merged_prompt_preserves_plain_custom_creative_intent() -> None:
    prompt = build_merged_shot_video_prompt(
        [
            _shot(
                1,
                duration=3,
                video_prompt="使用低机位并保持人物服装一致。",
            ),
            _shot(2, duration=4),
        ]
    )

    assert "创作意图：使用低机位并保持人物服装一致。" in prompt
    assert "[0s-3s]" in prompt
    assert "[3s-7s]" in prompt


def test_legacy_structured_prompt_does_not_reintroduce_subtitles() -> None:
    legacy_prompt = "\n".join(
        [
            "【整体要求】",
            "旧版结构。",
            "【连续时间轴】",
            "[0s-3s] 旧剧情",
            "【语音与字幕】",
            "字幕使用简体中文，位于画面底部安全区，白字、黑色描边。",
            "【负向约束】",
            "不要字幕乱码或字幕遮挡主体。",
        ]
    )
    prompt = build_merged_shot_video_prompt(
        [
            _shot(1, duration=3, video_prompt=legacy_prompt),
            _shot(2, duration=4),
        ]
    )

    assert "【语音与字幕】" not in prompt
    assert "字幕使用简体中文" not in prompt
    assert "字幕乱码" not in prompt
    assert "【语音】" in prompt


def test_current_structure_with_legacy_subtitle_blocks_is_preserved() -> None:
    dirty_prompt = "\n".join(
        [
            "【整体要求】",
            "保留剧情。",
            "【连续时间轴】",
            "[0s-4s] 镜头剧情。",
            "【主字幕】完成任务。",
            "字幕：与语音同步显示。",
            "【语音】",
            "生成普通话语音。",
            "【语音与字幕】",
            "语音和字幕逐字一致。",
            "【负向约束】",
            "避免主体变形。",
        ]
    )
    shot = _shot(1, duration=4, video_prompt=dirty_prompt)

    prompt = normalize_video_prompt(shot, dirty_prompt)

    assert prompt == dirty_prompt
    assert "【主字幕】" in prompt
    assert "字幕：" in prompt
    assert "【语音与字幕】" in prompt
    assert "逐字一致" in prompt
    assert "【语音】" in prompt
    assert "[0s-4s]" in prompt


def test_prompt_without_narration_forbids_dialogue_without_subtitle_rules() -> None:
    prompt = build_single_shot_video_prompt(
        _shot(1, duration=4, narration=None)
    )

    assert "无对白，仅生成环境音与动作音。" in prompt
    assert "不生成旁白或对白" in prompt
    assert "字幕使用简体中文" not in prompt
    assert "不显示字幕" not in prompt


def test_custom_prompt_is_normalized_and_structured_prompt_is_idempotent() -> None:
    shot = _shot(1, duration=6)
    normalized = normalize_video_prompt(shot, "快速推近产品特写。")

    assert "[0s-6s]" in normalized
    assert "创作意图：快速推近产品特写。" in normalized
    assert normalize_video_prompt(shot, normalized) == normalized


def test_optimized_prompt_validation_allows_subtitle_instructions() -> None:
    shot = _shot(1, duration=6)
    prompt = build_single_shot_video_prompt(shot) + "\n字幕使用简体中文。"

    assert validate_optimized_video_prompt(prompt, [shot]) == prompt


@pytest.mark.parametrize(
    ("target_language", "instruction"),
    [
        ("zh", "结尾添加画面文字“立即购买”。"),
        ("zh", "品牌出现时采用文字叠加展示卖点。"),
        ("zh", "收尾使用文案叠加呈现行动号召。"),
        ("en", 'Add a text overlay reading "Buy now".'),
        ("en", 'Show on-screen text reading "Limited offer".'),
        ("en", "Add captions/subtitles synchronized with the voice."),
    ],
)
def test_normalize_preserves_prompts_with_explicit_text_overlay_instructions(
    target_language: str,
    instruction: str,
) -> None:
    shot = _shot(1, duration=6)

    normalized = normalize_video_prompt(
        shot,
        instruction,
        target_language=target_language,
    )

    assert instruction in normalized


@pytest.mark.parametrize(
    ("target_language", "instruction"),
    [
        ("zh", "画面文字：立即购买。"),
        ("zh", "结尾使用文字叠加展示品牌文案。"),
        ("en", 'Display a text overlay: "Buy now".'),
        ("en", 'Include on-screen text: "Limited offer".'),
        ("en", "Add captions/subtitles for all dialogue."),
        ("en", "Captions/subtitles: mirror all dialogue."),
    ],
)
def test_optimized_prompt_validation_allows_text_overlay_instructions(
    target_language: str,
    instruction: str,
) -> None:
    shot = _shot(1, duration=6)
    prompt = (
        build_single_shot_video_prompt(shot, target_language=target_language)
        + f"\n{instruction}"
    )

    assert (
        validate_optimized_video_prompt(
            prompt,
            [shot],
            target_language=target_language,
        )
        == prompt
    )


def test_subtitle_term_detection_does_not_reject_ordinary_narrative() -> None:
    assert contains_forbidden_subtitle_terms(
        "角色阅读墙上的文字，然后继续向前走。"
    ) is False
    assert contains_forbidden_subtitle_terms(
        "The documentary follows a caption editor through the archive."
    ) is False


@pytest.mark.parametrize(
    ("target_language", "required_token"),
    [
        ("zh", "(参考@图1)"),
        ("en", "(reference@image1)"),
    ],
)
def test_optimized_prompt_must_preserve_standard_reference_tokens(
    target_language: str,
    required_token: str,
) -> None:
    shot = _shot(1, duration=6)
    prompt = build_single_shot_video_prompt(
        shot,
        target_language=target_language,
    )

    with pytest.raises(ValueError, match="missing required reference tokens"):
        validate_optimized_video_prompt(
            prompt,
            [shot],
            target_language=target_language,
            reference_image_count=1,
            required_reference_tokens=[required_token],
        )


def test_optimized_prompt_must_not_add_standard_reference_tokens() -> None:
    shot = _shot(1, duration=6)
    prompt = build_single_shot_video_prompt(shot)

    with pytest.raises(ValueError, match="invented a standard reference token"):
        validate_optimized_video_prompt(
            prompt + "\n(参考@图1) 保持造型一致。",
            [shot],
            reference_image_count=1,
            required_reference_tokens=[],
        )


def test_long_prompt_compression_keeps_timeline_and_full_narration() -> None:
    narration = "这是一段必须完整保留的普通话旁白。"
    prompt = build_merged_shot_video_prompt(
        [
            _shot(
                1,
                duration=10,
                description="剧情" * 5_000,
                visual_prompt="运镜" * 5_000,
                narration=narration,
            ),
            _shot(
                2,
                duration=10,
                description="场景" * 5_000,
                visual_prompt="特写" * 5_000,
                narration=narration,
            ),
        ]
    )

    assert len(prompt) <= MAX_VIDEO_PROMPT_LENGTH
    assert "[0s-10s]" in prompt
    assert "[10s-20s]" in prompt
    assert prompt.count(narration) == 2


def test_narration_label_cleanup_handles_each_merged_line() -> None:
    assert strip_narration_label(
        "旁白/字幕：第一句。\n对白: 第二句。\n字幕：第三句。"
    ) == "第一句。\n第二句。\n第三句。"


def test_extract_timeline_ranges_supports_documented_formats() -> None:
    prompt = (
        "【连续时间轴】\n"
        "[0s-3s] 第一段\n"
        "3-8s 第二段\n"
        "8-12秒 第三段\n"
        "【语音】\n无"
    )

    assert extract_timeline_ranges(prompt) == [
        (0.0, 3.0),
        (3.0, 8.0),
        (8.0, 12.0),
    ]


def test_merged_timeline_validation_rejects_missing_gap_and_changed_boundary() -> None:
    shots = [_shot(1, duration=3), _shot(2, duration=5), _shot(3, duration=4)]
    valid = build_merged_shot_video_prompt(shots)
    validate_merged_prompt_timeline(valid, shots)

    for invalid, message in (
        (valid.replace("[3s-8s]", ""), "保留全部原子时间区间"),
        (valid.replace("[3s-8s]", "[4s-8s]"), "时间轴空洞"),
        (valid.replace("[3s-8s]", "[2s-8s]"), "重叠"),
        (valid.replace("[3s-8s]", "[3s-9s]"), "边界"),
    ):
        try:
            validate_merged_prompt_timeline(invalid, shots)
        except ValueError as exc:
            assert message in str(exc)
        else:
            raise AssertionError("invalid merged timeline was accepted")


def test_english_single_prompt_uses_contract_and_natural_clear_speech() -> None:
    shot = _shot(
        1,
        duration=5,
        narration="Narration / subtitles: Start your day fresh.",
    )

    prompt = build_single_shot_video_prompt(shot, target_language="en")

    assert prompt.count("[Overall Requirements]") == 1
    assert prompt.count("[Continuous Timeline]") == 1
    assert prompt.count("[Voice]") == 1
    assert prompt.count("[Negative Constraints]") == 1
    assert "[0s-5s]" in prompt
    assert 'Voice: natural, clear English narration or dialogue: "Start your day fresh."' in prompt
    assert "Generate natural, clear English speech" in prompt
    assert "subtitles" not in prompt.lower()
    assert "captions" not in prompt.lower()


def test_english_merged_and_no_narration_prompts_preserve_timeline() -> None:
    merged = build_merged_shot_video_prompt(
        [
            _shot(1, duration=3, narration="Voice-over: First line."),
            _shot(2, duration=4, narration="Dialogue: Second line."),
        ],
        target_language="en",
    )
    silent = build_single_shot_video_prompt(
        _shot(1, duration=6, narration=None),
        target_language="en",
    )

    assert extract_timeline_ranges(
        merged,
        target_language="en",
    ) == [(0.0, 3.0), (3.0, 7.0)]
    assert "Generate a coherent 7-second advertising video." in merged
    assert "First line." in merged
    assert "Second line." in merged
    assert "Do not generate narration or dialogue" in silent
    assert "ambient and action sounds" in silent


def test_normalize_rebuilds_other_language_contract_without_creative_intent() -> None:
    shot = _shot(1, duration=4)
    chinese = build_single_shot_video_prompt(shot)
    english = normalize_video_prompt(
        shot,
        chinese,
        target_language="en",
    )

    assert "[Overall Requirements]" in english
    assert "【整体要求】" not in english
    assert "Creative intent:" not in english
    assert "Overall creative intent:" not in english
    assert normalize_video_prompt(
        shot,
        english,
        target_language="en",
    ) == english

    mixed = english + "\n" + chinese
    rebuilt = normalize_video_prompt(
        shot,
        mixed,
        target_language="en",
    )
    assert "【整体要求】" not in rebuilt
    assert "Creative intent:" not in rebuilt
    assert "Overall creative intent:" not in rebuilt


def test_english_validation_rejects_mixed_sections_and_bilingual_subtitles() -> None:
    shot = _shot(1, duration=4)
    valid = build_single_shot_video_prompt(shot, target_language="en")
    validate_optimized_video_prompt(
        valid,
        [shot],
        target_language="en",
    )

    mixed = valid + "\n【整体要求】\n不得混入另一套结构。"
    with pytest.raises(ValueError, match="mixes language section contracts"):
        validate_optimized_video_prompt(
            mixed,
            [shot],
            target_language="en",
        )

    for subtitle_instruction in ("Add English subtitles.", "添加中文字幕。"):
        prompt = f"{valid}\n{subtitle_instruction}"
        assert (
            validate_optimized_video_prompt(
                prompt,
                [shot],
                target_language="en",
            )
            == prompt
        )


def test_video_prompt_language_must_be_supported_string() -> None:
    with pytest.raises(ValueError, match="target_language"):
        build_single_shot_video_prompt(
            _shot(1, duration=4),
            target_language="fr",
        )
