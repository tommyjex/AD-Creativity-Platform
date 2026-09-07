from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from backend.app.schemas import (
    AigcPromptOptimizeRequest,
    AigcPromptOptimizeResponse,
)
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.modelark import (
    AigcImagePromptOptimizationResult,
    MockModelArkAdapter,
    ModelArkTextParseError,
)
from backend.app.services.prompt_optimization import (
    extract_protected_literals,
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


def test_generation_service_discards_invented_references_when_input_is_empty() -> None:
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

    assert result.optimized_reference_instructions == []


def test_generation_service_rejects_changed_nonempty_reference_count() -> None:
    adapter = SimpleNamespace(
        optimize_aigc_prompt=AsyncMock(
            return_value=AigcImagePromptOptimizationResult(
                optimized_text="生成清晰的家庭场景",
                optimized_reference_instructions=[],
            )
        )
    )

    with pytest.raises(ModelArkTextParseError, match="reference count"):
        asyncio.run(
            ModelArkGenerationService(adapter=adapter).optimize_aigc_prompt(
                image_request(["保持主体位置"])
            )
        )


def test_target_specific_messages_include_direction_and_whitelisted_config() -> None:
    request = llm_request("分析投放素材")

    system_prompt, user_prompt = (
        MockModelArkAdapter.build_aigc_prompt_optimization_messages(request)
    )

    assert "LLM 提示词工程优化器" in system_prompt
    assert "隐藏思维过程" in system_prompt
    assert "提升结构清晰度" in user_prompt
    assert "doubao-seed-evolving" in user_prompt


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
