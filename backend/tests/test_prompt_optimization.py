from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from backend.app.schemas import (
    AigcImagePromptLocalEditResult,
    AigcPromptOptimizeRequest,
    AigcPromptOptimizeResponse,
    AigcSeedreamPromptOptimizationResult,
)
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.modelark import (
    AigcImagePromptOptimizationResult,
    AigcImagePromptSectionsResult,
    MockModelArkAdapter,
    ModelArkTextParseError,
)
from backend.app.services.prompt_optimization import (
    PromptOptimizationSafetyError,
    extract_protected_literals,
    render_image_prompt_sections,
    render_image_prompt_sections_with_warnings,
    render_local_edit_prompt,
    render_local_edit_prompt_with_warnings,
    render_seedream_prompt_with_warnings,
    validate_prompt_optimization_result,
)


def llm_request(text: str) -> AigcPromptOptimizeRequest:
    return AigcPromptOptimizeRequest(
        target_node_id="llm-1",
        target_type="llm",
        target_config={
            "model": "doubao-seed-evolving",
            "system_prompt": "你是广告分析师",
        },
        optimization_direction="提升结构清晰度",
        text=text,
    )


def image_request(
    reference_instructions: list[str],
) -> AigcPromptOptimizeRequest:
    return AigcPromptOptimizeRequest(
        target_node_id="image-model",
        target_type="image_to_image",
        target_config={
            "model": "doubao-seedream-5-0-pro-260628",
            "operation": "image_to_image",
            "aspect_ratio": "1:1",
            "size": "2K",
            "reference_image_count": 4,
        },
        text="生成家庭场景",
        reference_instructions=reference_instructions,
    )


def video_request(text: str) -> AigcPromptOptimizeRequest:
    return AigcPromptOptimizeRequest(
        target_node_id="video-model",
        target_type="video_generation",
        target_config={
            "model": "doubao-seedance-2-5-260628",
            "generation_mode": "text_to_video",
            "task_type": "generate",
            "duration_seconds": -1,
            "aspect_ratio": "4:3",
            "generate_audio": True,
            "references": [],
        },
        text=text,
    )


def test_extract_protected_literals_keeps_order_spelling_and_duplicates() -> None:
    source = (
        '保留“ACME Pro”、`sku_id`、https://example.com/a?q=1，'
        "画幅 16:9，时长 5秒，重复“ACME Pro”"
    )

    assert extract_protected_literals(source) == (
        "“ACME Pro”",
        "`sku_id`",
        "https://example.com/a?q=1",
        "16:9",
        "5秒",
        "“ACME Pro”",
    )


def test_result_validation_rejects_removed_protected_literal() -> None:
    request = llm_request('为“ACME Pro”输出 16:9 广告，时长 5秒')

    with pytest.raises(ModelArkTextParseError, match="protected literal"):
        validate_prompt_optimization_result(
            request,
            AigcPromptOptimizeResponse(
                optimized_text="为 ACME Pro 输出广告，时长 5秒",
                optimized_reference_instructions=[],
            ),
        )


def test_video_duration_rewrite_allows_timeline_range_endpoints_to_change() -> None:
    request = video_request(
        "把时间扩展为20s。0-2秒：建立场景，第5秒：展示内部结构，"
        "8-10秒：收尾，保持180度躺平和4:3画幅。"
    )

    validate_prompt_optimization_result(
        request,
        AigcPromptOptimizeResponse(
            optimized_text=(
                "总时长20s。0-4秒：建立场景，第5秒：展示内部结构，"
                "16-20秒：收尾，保持180度躺平和4:3画幅。"
            ),
            optimized_reference_instructions=[],
        ),
    )


def test_video_without_duration_rewrite_keeps_timeline_range_endpoints() -> None:
    request = video_request(
        "0-2秒：建立场景，第5秒：展示内部结构，8-10秒：收尾，"
        "保持180度躺平和4:3画幅。"
    )

    with pytest.raises(ModelArkTextParseError, match="protected literal"):
        validate_prompt_optimization_result(
            request,
            AigcPromptOptimizeResponse(
                optimized_text=(
                    "0-4秒：建立场景，第5秒：展示内部结构，8-12秒：收尾，"
                    "保持180度躺平和4:3画幅。"
                ),
                optimized_reference_instructions=[],
            ),
        )


def test_video_reference_marker_changes_are_not_a_hard_validation_error() -> None:
    request = video_request(
        "主体登场（参考@图1），沿用节奏（参考@视频1），"
        "音效参考（参考@音频1）。"
    )

    validate_prompt_optimization_result(
        request,
        AigcPromptOptimizeResponse(
            optimized_text="主体登场并以连续运镜推进，使用环境音增强节奏。",
            optimized_reference_instructions=[],
        ),
    )


def image_sections(
    *,
    subject: str = "Create a clear family setting.",
    composition: str = "Use clear depth and balanced framing.",
    negative: str = "No unrelated objects.",
    references: list[str] | None = None,
) -> AigcImagePromptSectionsResult:
    return AigcImagePromptSectionsResult(
        optimization_mode="full_design",
        sections=[
            {"label": "Subject", "content": subject},
            {"label": "Environment", "content": "Use a coherent interior."},
            {"label": "Composition", "content": composition},
            {"label": "Negative Prompt", "content": negative},
        ],
        optimized_reference_instructions=references or [],
    )


def test_seedream_renderer_repairs_facts_and_preserves_references() -> None:
    request = image_request(["  保持商标位置与大小不变  "]).model_copy(
        update={"text": '把 ACME 外套改为红色并保留“新品”文案'}
    )

    rendered = render_seedream_prompt_with_warnings(
        request,
        AigcSeedreamPromptOptimizationResult(
            generation_type="图像编辑",
            optimized_text="仅调整图中人物的外套，保持其他内容不变。",
            optimization_explanation="明确了编辑对象和保持范围。",
        ),
    )

    assert rendered.response.generation_type == "图像编辑"
    assert rendered.response.optimization_explanation == (
        "明确了编辑对象和保持范围。"
    )
    assert rendered.response.optimized_reference_instructions == [
        "  保持商标位置与大小不变  "
    ]
    assert "ACME" in rendered.response.optimized_text
    assert "红色" in rendered.response.optimized_text
    assert "“新品”" in rendered.response.optimized_text
    assert "protected_literal_repaired" in rendered.warnings
    assert "required_color_repaired" in rendered.warnings


def test_seedream_renderer_accepts_explicit_exclusion_reversal_with_warning() -> None:
    request = image_request([]).model_copy(
        update={"text": "生成产品图，不要出现水滴"}
    )

    rendered = render_seedream_prompt_with_warnings(
        request,
        AigcSeedreamPromptOptimizationResult(
            generation_type="参考图生图",
            optimized_text="参考原图生成产品图，并在包装表面加入水滴。",
            optimization_explanation="补充了产品质感。",
        ),
    )

    assert rendered.response.optimized_text.endswith("加入水滴。")
    assert "explicit_exclusion_changed" in rendered.warnings


def test_seedream_renderer_accepts_preserved_chinese_action_exclusion() -> None:
    request = image_request([]).model_copy(
        update={"text": "在海报底部增加文字，不要增加阴影"}
    )

    rendered = render_seedream_prompt_with_warnings(
        request,
        AigcSeedreamPromptOptimizationResult(
            generation_type="参考图生图",
            optimized_text="在海报底部增加文字，不要增加阴影。",
            optimization_explanation="明确了增加内容和排除项。",
        ),
    )

    assert "不要增加阴影" in rendered.response.optimized_text

    retained = render_seedream_prompt_with_warnings(
        request.model_copy(update={"text": "保留 2 件商品，不要多余人物"}),
        AigcSeedreamPromptOptimizationResult(
            generation_type="参考图生图",
            optimized_text="保留 2 件商品，不要多余人物。",
            optimization_explanation="保留数量与排除项。",
        ),
    )
    assert "不要多余人物" in retained.response.optimized_text


def test_generation_service_returns_seedream_contract() -> None:
    adapter = SimpleNamespace(
        optimize_aigc_prompt=AsyncMock(
            return_value=AigcSeedreamPromptOptimizationResult(
                generation_type="参考图生图",
                optimized_text="参考原图产品特征，生成家庭使用场景。",
                optimization_explanation="明确了参考特征和新场景。",
            )
        )
    )
    request = image_request(["保持商标位置"])

    result = asyncio.run(
        ModelArkGenerationService(adapter=adapter).optimize_aigc_prompt(
            request,
            source_image_url="https://example.com/source.png",
        )
    )

    assert result.generation_type == "参考图生图"
    assert result.optimization_explanation == "明确了参考特征和新场景。"
    assert result.optimized_reference_instructions == ["保持商标位置"]


def test_generation_service_accepts_multi_reference_seedream_contract() -> None:
    adapter = SimpleNamespace(
        optimize_aigc_prompt=AsyncMock(
            return_value=AigcSeedreamPromptOptimizationResult(
                generation_type="参考图生图",
                optimized_text="参考三张服装图片的版型与细节，生成男模特上身图。",
                optimization_explanation="明确了多张参考图的用途。",
            )
        )
    )
    request = image_request([]).model_copy(
        update={
            "target_config": image_request([]).target_config.model_copy(
                update={"reference_image_count": 3}
            )
        }
    )

    result = asyncio.run(
        ModelArkGenerationService(adapter=adapter).optimize_aigc_prompt(request)
    )

    assert result.generation_type == "参考图生图"
    assert result.optimization_explanation == "明确了多张参考图的用途。"


def test_generation_service_accepts_legacy_image_provider_result() -> None:
    adapter = SimpleNamespace(
        optimize_aigc_prompt=AsyncMock(
            return_value=AigcImagePromptOptimizationResult(
                optimized_text="生成清晰的家庭场景",
                optimized_reference_instructions=[
                    "参考图1",
                    "参考图2",
                    "参考图3",
                    "参考图4",
                ],
            )
        )
    )

    result = asyncio.run(
        ModelArkGenerationService(adapter=adapter).optimize_aigc_prompt(
            image_request([])
        )
    )

    assert result.generation_type == "参考图生图"
    assert result.optimized_text == "生成清晰的家庭场景"

def test_generation_service_preserves_nonempty_reference_instructions() -> None:
    adapter = SimpleNamespace(
        optimize_aigc_prompt=AsyncMock(
            return_value=AigcSeedreamPromptOptimizationResult(
                generation_type="参考图生图",
                optimized_text="参考原图主体生成家庭场景。",
                optimization_explanation="明确了参考对象。",
            )
        )
    )

    result = asyncio.run(
        ModelArkGenerationService(adapter=adapter).optimize_aigc_prompt(
            image_request(["保持主体位置"]),
            source_image_url="https://example.com/source.png",
        )
    )

    assert result.optimized_reference_instructions == ["保持主体位置"]


def test_image_sections_discard_references_when_input_has_none() -> None:
    rendered = render_image_prompt_sections_with_warnings(
        image_request([]),
        image_sections(
            references=[
                "Use the first reference image for product identity.",
                "Use the second reference image for the background.",
            ]
        ),
    )

    assert rendered.response.optimized_reference_instructions == []
    assert "discarded_unrequested_reference_instructions" in rendered.warnings


def test_local_edit_prompt_is_single_paragraph_and_preserves_scope() -> None:
    request = image_request([])
    request = request.model_copy(
        update={
            "text": "把人物外套改为绿色，保持人物和背景不变",
            "target_config": request.target_config.model_copy(
                update={"reference_image_count": 1}
            ),
        }
    )
    result = render_local_edit_prompt(
        request,
        AigcImagePromptLocalEditResult(
            optimization_mode="local_edit",
            optimized_text=(
                "Use the input image as the editing base. Change only the person's "
                "coat color to green. Preserve every unspecified person identity, "
                "pose, background, layout, viewpoint, lighting, texture, text, color, "
                "and other visual content unchanged."
            ),
        ),
    )

    assert "\n" not in result.optimized_text
    assert "Composition:" not in result.optimized_text
    assert "green" in result.optimized_text


def test_local_edit_repairs_brand_color_and_copy_in_one_paragraph() -> None:
    request = image_request([]).model_copy(
        update={
            "text": '把 ACME 外套改为红色并保留“新品”文案',
            "target_config": image_request([]).target_config.model_copy(
                update={"reference_image_count": 1}
            ),
        }
    )

    rendered = render_local_edit_prompt_with_warnings(
        request,
        AigcImagePromptLocalEditResult(
            optimization_mode="local_edit",
            optimized_text=(
                "Use the input image as the editing base. Modify only the coat. "
                "Keep everything else unchanged."
            ),
        ),
    )

    assert "\n" not in rendered.response.optimized_text
    assert "ACME" in rendered.response.optimized_text
    assert "red" in rendered.response.optimized_text
    assert "“新品”" in rendered.response.optimized_text
    assert "protected_literal_repaired" in rendered.warnings
    assert "required_color_repaired" in rendered.warnings


@pytest.mark.parametrize(
    ("optimized_text", "error"),
    [
        (
            "Use the input image as the editing base. Change the coat to green.",
            "preservation semantics",
        ),
        (
            "Use the input image as the editing base. Change the coat to green, "
            "change the composition, and preserve every unspecified visual detail "
            "unchanged.",
            "expanded",
        ),
        (
            "Edit Instructions: Use the input image and change only the coat to "
            "green while keeping everything else unchanged.",
            "unlabeled paragraph",
        ),
    ],
)
def test_local_edit_prompt_rejects_missing_preservation_or_scope_expansion(
    optimized_text: str,
    error: str,
) -> None:
    request = image_request([]).model_copy(
        update={
            "text": "把人物外套改为绿色，保持人物和背景不变",
            "target_config": image_request([]).target_config.model_copy(
                update={"reference_image_count": 1}
            ),
        }
    )

    with pytest.raises(PromptOptimizationSafetyError, match=error):
        render_local_edit_prompt(
            request,
            AigcImagePromptLocalEditResult(
                optimization_mode="local_edit",
                optimized_text=optimized_text,
            ),
        )


def test_generation_service_logs_warning_and_returns_usable_result(
    caplog: pytest.LogCaptureFixture,
) -> None:
    adapter = SimpleNamespace(
        optimize_aigc_prompt=AsyncMock(
            return_value=AigcSeedreamPromptOptimizationResult(
                generation_type="文生图",
                optimized_text="生成清晰画面。",
                optimization_explanation="精简了描述。",
            )
        )
    )
    base_request = image_request([])
    request = base_request.model_copy(
        update={
            "text": "生成产品图",
            "target_config": base_request.target_config.model_copy(
                update={"reference_image_count": 0}
            ),
        }
    )

    result = asyncio.run(
        ModelArkGenerationService(adapter=adapter).optimize_aigc_prompt(request)
    )

    assert result.optimized_text == "生成清晰画面。"
    warning_codes = {
        getattr(record, "warning_code", None) for record in caplog.records
    }
    assert "required_subject_term_missing" in warning_codes


def test_generation_service_accepts_llm_literal_rewrite_with_warning(
    caplog: pytest.LogCaptureFixture,
) -> None:
    adapter = SimpleNamespace(
        optimize_aigc_prompt=AsyncMock(
            return_value=AigcImagePromptOptimizationResult(
                optimized_text="为摄像头制作电商创意，突出“1000万高清像素”卖点。",
                optimized_reference_instructions=[],
            )
        )
    )

    result = asyncio.run(
        ModelArkGenerationService(adapter=adapter).optimize_aigc_prompt(
            llm_request("围绕摄像头生成图片创意，核心卖点是“1000w高清像素”。")
        )
    )

    assert result.optimized_text.endswith("卖点。")
    warning_codes = {
        getattr(record, "warning_code", None) for record in caplog.records
    }
    assert "result_validation_failed" in warning_codes


def test_generation_service_logs_local_edit_repair_warnings(
    caplog: pytest.LogCaptureFixture,
) -> None:
    adapter = SimpleNamespace(
        optimize_aigc_prompt=AsyncMock(
            return_value=AigcSeedreamPromptOptimizationResult(
                generation_type="图像编辑",
                optimized_text=(
                    "仅修改图中人物的外套，保持其他内容不变。"
                ),
                optimization_explanation="明确了编辑范围。",
            )
        )
    )
    request = image_request([]).model_copy(
        update={
            "text": 'Change the ACME coat to red and keep “新品”.',
            "target_config": image_request([]).target_config.model_copy(
                update={"reference_image_count": 1}
            ),
        }
    )

    result = asyncio.run(
        ModelArkGenerationService(adapter=adapter).optimize_aigc_prompt(
            request,
            source_image_url="https://example.com/source.png",
        )
    )

    assert "ACME" in result.optimized_text
    assert "red" in result.optimized_text
    warning_codes = {
        getattr(record, "warning_code", None) for record in caplog.records
    }
    assert "protected_literal_repaired" in warning_codes
    assert "required_color_repaired" in warning_codes


def test_image_sections_render_stably_and_preserve_visible_cjk_literal() -> None:
    request = image_request([])
    request = request.model_copy(
        update={"text": '包装显示“家庭清洁专家”，使用红色，3件，画幅 16:9'}
    )
    result = image_sections(
        subject=(
            'Show the red package in the requested quantity and preserve “家庭清洁专家” '
            "exactly for a 16:9 frame. "
            "Preserve exact quantity-object constraint: 3件"
        ),
    )

    response = render_image_prompt_sections(request, result)

    assert response.optimized_text == (
        'Subject: Show the red package in the requested quantity and preserve '
        '“家庭清洁专家” exactly for a 16:9 frame. '
        "Preserve exact quantity-object constraint: 3件\n"
        "Environment: Use a coherent interior.\n"
        "Composition: Use clear depth and balanced framing.\n"
        "Negative Prompt: No unrelated objects."
    )


def test_image_sections_warn_for_unprotected_cjk_and_negative_conflict() -> None:
    request = image_request([])
    request = request.model_copy(update={"text": "生成红色产品主图"})

    non_english = render_image_prompt_sections_with_warnings(
        request,
        image_sections(subject="Create a red 产品 image."),
    )
    negative_conflict = render_image_prompt_sections_with_warnings(
        request,
        image_sections(
            subject="Create a red product hero image.",
            negative="No product and no red elements.",
        ),
    )

    assert non_english.response.optimized_text
    assert "non_english_content" in non_english.warnings
    assert negative_conflict.response.optimized_text
    assert "negative_prompt_possible_conflict" in negative_conflict.warnings


def test_image_sections_accept_missing_recommended_sections_with_warning() -> None:
    request = image_request([])
    result = AigcImagePromptSectionsResult(
        optimization_mode="full_design",
        sections=[
            {
                "label": "Subject",
                "content": "Create a clear family setting.",
            },
            {
                "label": "Lighting",
                "content": "Use controlled indoor light.",
            },
        ],
        optimized_reference_instructions=[],
    )

    rendered = render_image_prompt_sections_with_warnings(request, result)

    assert rendered.response.optimized_text.startswith("Subject: ")
    assert "missing_composition_section" in rendered.warnings
    assert "missing_negative_prompt_section" in rendered.warnings
    assert "section_count_outside_recommendation" in rendered.warnings


def test_image_sections_warn_for_non_object_camera_number() -> None:
    rendered = render_image_prompt_sections_with_warnings(
        image_request([]),
        image_sections(
            composition="Use 3-point lighting with balanced framing.",
        ),
    )

    assert "3-point" in rendered.response.optimized_text
    assert "unrequested_non_object_number" in rendered.warnings


def test_image_reference_validation_repairs_non_asset_literals() -> None:
    request = image_request(
        ['Preserve "ACME".', "Keep 16:9 and `sku_id`."]
    )

    rendered = render_image_prompt_sections_with_warnings(
        request,
        image_sections(
            references=[
                'Preserve "ACME".',
                "Keep 16:9 without the identifier.",
            ]
        ),
    )

    assert "`sku_id`" in rendered.response.optimized_reference_instructions[1]
    assert "reference_constraint_repaired" in rendered.warnings


def test_image_reference_repair_allows_recoverable_literal_reordering() -> None:
    request = image_request(['Keep "ACME" and "X100".'])

    rendered = render_image_prompt_sections_with_warnings(
        request,
        image_sections(references=['Keep "X100".']),
    )

    response = rendered.response
    validate_prompt_optimization_result(request, response)
    assert '"ACME"' in response.optimized_reference_instructions[0]
    assert '"X100"' in response.optimized_reference_instructions[0]
    assert "reference_constraint_repaired" in rendered.warnings


def test_bbox_reference_preserves_token_coordinates_and_source_order() -> None:
    request = image_request([])
    request = request.model_copy(
        update={
            "reference_instructions": [
                'Reduce Image 1<bbox>10 20 30 40</bbox> and keep "ACME".',
                "Enlarge Image 2<bbox>50 60 70 80</bbox>.",
            ]
        }
    )
    valid = image_sections(
        references=[
            'Reduce Image 1<bbox>10 20 30 40</bbox> and preserve "ACME".',
            "Enlarge Image 2<bbox>50 60 70 80</bbox>.",
        ]
    )

    response = render_image_prompt_sections(request, valid)
    assert response.optimized_reference_instructions == valid.optimized_reference_instructions

    with pytest.raises(ModelArkTextParseError, match="BBox"):
        render_image_prompt_sections(
            request,
            image_sections(
                references=list(reversed(valid.optimized_reference_instructions))
            ),
        )


def test_image_sections_reject_direct_exclusion_reversal() -> None:
    request = image_request([]).model_copy(
        update={"text": "为产品制作海报，不要出现水滴"}
    )

    with pytest.raises(
        PromptOptimizationSafetyError,
        match="reversed an explicit exclusion",
    ):
        render_image_prompt_sections(
            request,
            image_sections(
                subject="Create a product poster and add 水滴.",
            ),
        )


def test_unquoted_brand_and_model_are_protected_literals() -> None:
    assert extract_protected_literals("品牌：华为，型号 Mate60，配 2 个产品") == (
        "华为",
        "Mate60",
        "2",
    )


def test_render_preserves_literal_whitespace_and_repairs_markup() -> None:
    request = image_request([])
    request = request.model_copy(update={"text": '展示“家庭  清洁”产品'})
    response = render_image_prompt_sections(
        request,
        image_sections(
            subject='  Show   the product text “家庭  清洁” exactly.  '
        ),
    )
    assert response.optimized_text.startswith(
        'Subject: Show the product text “家庭  清洁” exactly.'
    )

    repaired = render_image_prompt_sections_with_warnings(
        image_request([]),
        image_sections(subject="- Show the requested subject."),
    )
    assert repaired.response.optimized_text.startswith(
        "Subject: Show the requested subject."
    )
    assert "section_markup_repaired" in repaired.warnings


def test_image_sections_preserve_unquoted_brand_and_model() -> None:
    request = image_request([])
    request = request.model_copy(
        update={"text": "品牌：华为，型号 Mate60，生成 2 个产品"}
    )
    valid = image_sections(
        subject=(
            "Show the requested products and preserve their identity. "
            "Preserve exact quantity-object constraint: 2 个产品 "
            "Preserve exact identity: 华为 "
            "Preserve exact identity: Mate60"
        ),
    )
    optimized = render_image_prompt_sections(request, valid).optimized_text
    assert "Preserve exact identity: 华为" in optimized
    assert "Preserve exact identity: Mate60" in optimized
    assert "Preserve exact quantity-object constraint: 2 个产品" in optimized


def test_full_design_repairs_recoverable_source_facts() -> None:
    request = image_request([]).model_copy(
        update={
            "text": (
                'Use ACME model X100, display “家庭清洁专家”, '
                "use red, and keep a 16:9 frame."
            )
        }
    )

    rendered = render_image_prompt_sections_with_warnings(
        request,
        image_sections(subject="Create a clean product image."),
    )

    text = rendered.response.optimized_text
    assert "ACME" in text
    assert "X100" in text
    assert "“家庭清洁专家”" in text
    assert "red" in text
    assert "16:9" in text
    assert "protected_literal_repaired" in rendered.warnings
    assert "required_color_repaired" in rendered.warnings


def test_full_design_repairs_only_the_matching_reference_index() -> None:
    request = image_request(['Keep "ACME".', 'Keep "X100".'])

    rendered = render_image_prompt_sections_with_warnings(
        request,
        image_sections(references=["Keep the logo.", "Keep the model."]),
    )

    references = rendered.response.optimized_reference_instructions
    assert '"ACME"' in references[0]
    assert '"ACME"' not in references[1]
    assert '"X100"' in references[1]
    assert "reference_constraint_repaired" in rendered.warnings


def test_bbox_literal_is_not_treated_as_recoverable_copy() -> None:
    request = image_request(
        ["Reduce Image 1<bbox>10 20 30 40</bbox> and keep the logo."]
    )

    with pytest.raises(PromptOptimizationSafetyError, match="BBox|protected literal"):
        render_image_prompt_sections(
            request,
            image_sections(references=["Reduce the selected region."]),
        )


def test_image_sections_repair_missing_identity_anchor_before_rendering() -> None:
    source = "青岚气泡水产品主图"

    rendered = render_image_prompt_sections_with_warnings(
        image_request([]).model_copy(update={"text": source}),
        image_sections(subject="Create a clean product hero image."),
    )

    assert "Preserve exact identity: 青岚气泡水" in rendered.response.optimized_text
    assert "canonical_anchor_repaired" in rendered.warnings


def test_image_sections_sanitize_unexpected_anchor_when_constraints_exist() -> None:
    request = image_request([]).model_copy(
        update={"text": "青岚气泡水产品主图"}
    )

    rendered = render_image_prompt_sections_with_warnings(
        request,
        image_sections(
            subject=(
                "Show the requested product. "
                "Preserve exact identity: 青岚气泡水"
            ),
            composition=(
                "Use centered framing. Preserve exact identity: 虚构品牌"
            ),
        ),
    )

    assert rendered.response.optimized_text.count(
        "Preserve exact identity:"
    ) == 1
    assert (
        "Preserve exact identity: 青岚气泡水"
        in rendered.response.optimized_text
    )
    assert "canonical_anchor_repaired" in rendered.warnings


def test_image_sections_reject_unexpected_anchor_without_constraints() -> None:
    with pytest.raises(PromptOptimizationSafetyError, match="canonical anchor"):
        render_image_prompt_sections(
            image_request([]),
            image_sections(
                subject=(
                    "Show a family scene. "
                    "Preserve exact identity: 虚构品牌"
                ),
            ),
        )


def test_image_sections_reject_missing_positive_layer_for_identity_anchor() -> None:
    request = image_request([]).model_copy(
        update={"text": "青岚气泡水产品主图"}
    )
    result = AigcImagePromptSectionsResult(
        optimization_mode="full_design",
        sections=[
            {
                "label": "Negative Prompt",
                "content": "No unrelated objects.",
            }
        ],
        optimized_reference_instructions=[],
    )

    with pytest.raises(PromptOptimizationSafetyError, match="canonical anchor"):
        render_image_prompt_sections(request, result)


def test_image_sections_repair_missing_exclusion_anchor_before_rendering() -> None:
    request = image_request([]).model_copy(
        update={"text": "为产品制作清爽海报，不要出现水滴"}
    )

    rendered = render_image_prompt_sections_with_warnings(
        request,
        image_sections(
            subject="Show the product in a fresh poster.",
            negative="No unrelated objects.",
        ),
    )

    assert rendered.response.optimized_text.splitlines()[-1].endswith(
        "Honor exclusion exactly: 不要出现水滴"
    )
    assert "canonical_anchor_repaired" in rendered.warnings


@pytest.mark.parametrize(
    "subject",
    [
        (
            "Show the requested product quantity beside 3 glasses. "
            "Preserve exact quantity-object constraint: 2 瓶青岚气泡水"
        ),
        (
            "Show 2 cups beside the requested product. "
            "Preserve exact quantity-object constraint: 2 瓶青岚气泡水"
        ),
    ],
)
def test_image_sections_warn_for_added_or_rebound_quantity(
    subject: str,
) -> None:
    request = image_request([]).model_copy(
        update={"text": "画面中展示 2 瓶青岚气泡水"}
    )

    rendered = render_image_prompt_sections_with_warnings(
        request,
        image_sections(subject=subject),
    )

    assert rendered.response.optimized_text
    assert "unrequested_object_quantity" in rendered.warnings


def test_provider_cannot_omit_product_or_exclusion_constraints() -> None:
    request = image_request([]).model_copy(
        update={"text": "青岚气泡水产品主图，不要出现水滴"}
    )
    response = render_image_prompt_sections(
        request,
        image_sections(
            subject=(
                "Show a fresh sparkling-water product image. "
                "Preserve exact identity: 青岚气泡水"
            ),
            negative=(
                "No unrelated objects. Honor exclusion exactly: 不要出现水滴"
            ),
        ),
    )

    assert "Preserve exact identity: 青岚气泡水" in response.optimized_text
    assert "Honor exclusion exactly: 不要出现水滴" in response.optimized_text


@pytest.mark.parametrize(
    ("subject", "negative"),
    [
        (
            "Show the requested product.",
            (
                "No unrelated objects. Preserve exact identity: 青岚气泡水 "
                "Honor exclusion exactly: 不要出现水滴"
            ),
        ),
        (
            (
                "Show the requested product. Preserve exact identity: 青岚气泡水 "
                "Honor exclusion exactly: 不要出现水滴"
            ),
            "No unrelated objects.",
        ),
    ],
)
def test_image_sections_repair_canonical_anchors_in_wrong_role(
    subject: str,
    negative: str,
) -> None:
    request = image_request([]).model_copy(
        update={"text": "青岚气泡水产品主图，不要出现水滴"}
    )

    rendered = render_image_prompt_sections_with_warnings(
        request,
        image_sections(subject=subject, negative=negative),
    )

    lines = rendered.response.optimized_text.splitlines()
    assert "Preserve exact identity: 青岚气泡水" in lines[0]
    assert "Honor exclusion exactly: 不要出现水滴" not in lines[0]
    assert "Preserve exact identity: 青岚气泡水" not in lines[-1]
    assert "Honor exclusion exactly: 不要出现水滴" in lines[-1]
    assert "canonical_anchor_repaired" in rendered.warnings


def test_image_sections_repair_identity_anchor_in_wrong_positive_layer() -> None:
    request = image_request([]).model_copy(
        update={"text": "青岚气泡水产品主图"}
    )
    result = AigcImagePromptSectionsResult(
        optimization_mode="full_design",
        sections=[
            {"label": "Product", "content": "Show the requested product."},
            {
                "label": "Environment",
                "content": (
                    "Use a clean studio. Preserve exact identity: 青岚气泡水"
                ),
            },
            {"label": "Composition", "content": "Use balanced framing."},
            {"label": "Negative Prompt", "content": "No unrelated objects."},
        ],
        optimized_reference_instructions=[],
    )

    rendered = render_image_prompt_sections_with_warnings(request, result)

    lines = rendered.response.optimized_text.splitlines()
    assert lines[0].endswith("Preserve exact identity: 青岚气泡水")
    assert "Preserve exact identity: 青岚气泡水" not in lines[1]
    assert "canonical_anchor_repaired" in rendered.warnings


def test_image_sections_warn_for_quantity_object_rebinding_with_same_number() -> None:
    request = image_request([]).model_copy(
        update={"text": "画面中展示 2 瓶青岚气泡水"}
    )

    rendered = render_image_prompt_sections_with_warnings(
        request,
        image_sections(
            subject=(
                "Show 2 cups beside the requested product. "
                "Preserve exact quantity-object constraint: 2 瓶青岚气泡水"
            )
        ),
    )

    assert "unrequested_object_quantity" in rendered.warnings


def test_image_sections_accept_quantity_semantics_with_source_anchor() -> None:
    request = image_request([]).model_copy(
        update={"text": "画面中展示 2 瓶青岚气泡水"}
    )

    response = render_image_prompt_sections(
        request,
        image_sections(
            subject=(
                "Show the requested product in the requested quantity. "
                "Preserve exact quantity-object constraint: 2 瓶青岚气泡水"
            ),
        ),
    )

    assert response.optimized_text.startswith(
        "Subject: Show the requested product in the requested quantity. "
        "Preserve exact quantity-object constraint: 2 瓶青岚气泡水"
    )
    assert response.optimized_text.splitlines()[-1].startswith("Negative Prompt: ")


def test_image_sections_allow_requested_spaced_measurement_translation() -> None:
    request = image_request([]).model_copy(
        update={"text": "洗地机可以完全放平至 180 度，像拖把一样平躺工作"}
    )

    response = render_image_prompt_sections(
        request,
        image_sections(
            subject=(
                "Show the floor washer lying completely flat at 180 degrees "
                "and working like a mop."
            ),
        ),
    )

    assert "180 degrees" in response.optimized_text


def test_image_sections_allow_requested_english_measurement_reuse() -> None:
    request = image_request([]).model_copy(
        update={
            "text": (
                "Show the floor washer fully laid flat at 180 degrees. "
                "Use a low side-angle view that shows the 180-degree posture."
            )
        }
    )

    response = render_image_prompt_sections(
        request,
        image_sections(
            subject=(
                "Depict the floor washer fully laid flat at 180 degrees."
            ),
            composition=(
                "Use a low side-angle view that emphasizes the 180-degree posture."
            ),
        ),
    )

    assert "180 degrees" in response.optimized_text
    assert "180-degree" in response.optimized_text


def test_canonical_anchor_is_preserved_as_an_exact_literal() -> None:
    source = "画面中展示 2   瓶青岚气泡水"
    anchor = "Preserve exact quantity-object constraint: 2   瓶青岚气泡水"

    response = render_image_prompt_sections(
        image_request([]).model_copy(update={"text": source}),
        image_sections(
            subject=f"Show the requested product quantity. {anchor}",
        ),
    )

    assert anchor in response.optimized_text


def test_target_specific_messages_include_direction_and_whitelisted_config() -> None:
    request = llm_request("分析投放素材")

    system_prompt, user_prompt = (
        MockModelArkAdapter.build_aigc_prompt_optimization_messages(request)
    )

    assert "LLM 提示词工程优化器" in system_prompt
    assert "隐藏思维过程" in system_prompt
    assert "提升结构清晰度" in user_prompt
    assert "doubao-seed-evolving" in user_prompt


def test_video_prompt_optimizer_softly_preserves_reference_markers() -> None:
    system_prompt, _ = MockModelArkAdapter.build_aigc_prompt_optimization_messages(
        video_request("主体出现（参考@图1）")
    )

    assert "优先原样保留" in system_prompt
    assert "(参考@图N)" in system_prompt
    assert "(参考@视频N)" in system_prompt
    assert "(参考@音频N)" in system_prompt
    assert "不作为输出有效性判断" in system_prompt


def test_generation_service_rejects_non_image_reference_output() -> None:
    adapter = SimpleNamespace(
        optimize_aigc_prompt=AsyncMock(
            return_value=AigcImagePromptOptimizationResult(
                optimized_text="分析投放素材并输出结构化结论",
                optimized_reference_instructions=["非法引用"],
            )
        )
    )

    with pytest.raises(ModelArkTextParseError, match="non-image"):
        asyncio.run(
            ModelArkGenerationService(adapter=adapter).optimize_aigc_prompt(
                llm_request("分析投放素材")
            )
        )
