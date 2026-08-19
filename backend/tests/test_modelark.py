from __future__ import annotations

import asyncio
import json
import re
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from backend.app.core.config import Settings
from backend.app.schemas import (
    Brief,
    Stage,
    Status,
    StoryboardShotCreate,
    TargetLanguage,
)
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.modelark import (
    BytePlusModelArkAdapter,
    CharacterGenerationRequest,
    CharacterImageEditRequest,
    CharacterImageRegenerateRequest,
    GeneratedTextResult,
    HybridModelArkAdapter,
    ImagePromptGenerationRequest,
    MockModelArkAdapter,
    ModelArkProviderError,
    ModelArkTextParseError,
    TextGenerationRequest,
    VideoEditRequest,
    VideoGenerationRequest,
    VideoPromptOptimizationRequest,
    VideoPromptOptimizationShotContext,
)
from backend.app.video_prompt import build_single_shot_video_prompt


class FakeImagesClient:
    def __init__(self, responses: list[object] | None = None) -> None:
        self.calls: list[dict[str, object]] = []
        self.responses = list(responses or [])

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        if not self.responses:
            raise RuntimeError("provider raw secret response")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class FakeChatCompletionsClient:
    def __init__(self, responses: list[object] | None = None) -> None:
        self.calls: list[dict[str, object]] = []
        self.responses = list(responses or [])

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if not self.responses:
            raise RuntimeError("provider raw secret response")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class FakeChatClient:
    def __init__(self, responses: list[object] | None = None) -> None:
        self.completions = FakeChatCompletionsClient(responses)


class FakeResponsesClient:
    def __init__(self, responses: list[object] | None = None) -> None:
        self.calls: list[dict[str, object]] = []
        self.responses = list(responses or [])

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if not self.responses:
            raise RuntimeError("provider raw secret response")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class FakeContentGenerationTasksClient:
    def __init__(
        self,
        create_responses: list[object] | None = None,
        get_responses: list[object] | None = None,
    ) -> None:
        self.create_calls: list[dict[str, object]] = []
        self.get_calls: list[dict[str, object]] = []
        self.create_responses = list(create_responses or [])
        self.get_responses = list(get_responses or [])

    def create(self, **kwargs):
        self.create_calls.append(kwargs)
        return self._next(self.create_responses)

    def get(self, **kwargs):
        self.get_calls.append(kwargs)
        return self._next(self.get_responses)

    @staticmethod
    def _next(responses: list[object]):
        if not responses:
            raise RuntimeError("provider raw secret response")
        response = responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class FakeArkClient:
    def __init__(
        self,
        responses: list[object] | None = None,
        *,
        chat_responses: list[object] | None = None,
        response_responses: list[object] | None = None,
        video_create_responses: list[object] | None = None,
        video_get_responses: list[object] | None = None,
    ) -> None:
        self.images = FakeImagesClient(responses)
        self.chat = FakeChatClient(chat_responses)
        self.responses = FakeResponsesClient(response_responses)
        self.content_generation = SimpleNamespace(
            tasks=FakeContentGenerationTasksClient(
                video_create_responses,
                video_get_responses,
            )
        )


def _settings() -> Settings:
    return Settings(
        ark_api_key="test-key",
        ark_text_model="doubao-seed-evolving",
        ark_image_model="doubao-seedream-5-0-pro-260628",
        ark_video_model="doubao-seedance-2-5-260628",
        ark_video_timeout_seconds=30,
        ark_video_poll_interval_seconds=1,
    )


def _request() -> CharacterGenerationRequest:
    return CharacterGenerationRequest(
        project_id="project-1",
        brief=Brief(
            prompt="生成一条咖啡机广告",
            product_name="便携咖啡机",
            audience="通勤白领",
            style="自然晨光",
        ),
        story_content="用户在清晨通勤途中需要快速获得一杯高品质咖啡。",
    )


def _response(url: str):
    return SimpleNamespace(data=[SimpleNamespace(url=url)])


def _chat_response(text: str):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content=text),
            )
        ]
    )


def _responses_response(text: str):
    return SimpleNamespace(
        output=[
            SimpleNamespace(
                content=[
                    SimpleNamespace(text=text),
                ]
            )
        ]
    )


def test_character_extraction_prompt_requires_turnaround_white_background_and_ratio() -> None:
    request = CharacterGenerationRequest(
        project_id="project-1",
        brief=Brief(
            prompt="生成一条咖啡机广告",
            product_name="便携咖啡机",
            audience="通勤白领",
            style="自然晨光",
            aspect_ratio="16:9",
        ),
        story_content="主角：林然正在通勤路上使用便携咖啡机。",
    )

    prompt = MockModelArkAdapter.build_character_extraction_prompt(request)

    assert "人物或动物三视图" in prompt
    assert "正面、侧面、背面" in prompt
    assert "白底背景" in prompt
    assert "禁止输出具体场景" in prompt
    assert "表情演绎" in prompt
    assert "肢体动作演绎" in prompt
    assert "剧情化画面" in prompt
    assert "画面比例：16:9" in prompt


def test_character_card_image_prompt_preserves_turnaround_white_background_and_ratio() -> None:
    prompt = ModelArkGenerationService.build_character_card_image_prompt(
        "林然",
        "自然晨光广告片质感，浅色衬衫。",
        "3:4",
    )

    assert "人物或动物三视图" in prompt
    assert "正面、侧面、背面" in prompt
    assert "白底背景" in prompt
    assert "禁止添加具体场景" in prompt
    assert "表情演绎" in prompt
    assert "肢体动作演绎" in prompt
    assert "画面比例：3:4" in prompt


def test_english_character_prompts_preserve_proper_names_and_use_english_constraints() -> None:
    request = CharacterGenerationRequest(
        project_id="project-1",
        brief=Brief(
            prompt="Create a BluePeak launch ad",
            target_language=TargetLanguage.EN,
            product_name="BluePeak X1",
            audience="urban commuters",
            style="natural morning light",
            aspect_ratio="16:9",
        ),
        story_content="The protagonist is Avery Chen, who discovers BluePeak X1.",
    )

    extraction_prompt = MockModelArkAdapter.build_character_extraction_prompt(
        request
    )
    image_prompt = ModelArkGenerationService.build_character_card_image_prompt(
        "Avery Chen",
        "A confident urban commuter in a light jacket.",
        "16:9",
        TargetLanguage.EN,
    )

    for expected in [
        "Write name and description in English",
        "Avery Chen",
        "BluePeak X1",
        "front, side, and back turnaround views",
        "pure white background",
        "Aspect ratio: 16:9",
        "performed facial expressions",
        "performed body actions",
    ]:
        assert expected in extraction_prompt
    for expected in [
        "Character name: Avery Chen",
        "front, side, and back turnaround views",
        "pure white background",
        "Do not add a specific scene",
        "Aspect ratio: 16:9",
    ]:
        assert expected in image_prompt
    assert "三视图" not in image_prompt
    assert "画面比例" not in image_prompt


def test_mock_english_character_output_is_english_and_preserves_product_name() -> None:
    adapter = MockModelArkAdapter(_settings())
    request = CharacterGenerationRequest(
        project_id="project-1",
        brief=Brief(
            prompt="Create an ad for BluePeak X1",
            target_language=TargetLanguage.EN,
            product_name="BluePeak X1",
            aspect_ratio="3:4",
        ),
        story_content="The protagonist is Avery Chen, who uses BluePeak X1.",
    )

    characters = asyncio.run(adapter.generate_characters(request))

    assert [character.name for character in characters] == ["Avery Chen"]
    description = characters[0].description
    assert "Avery Chen" in description
    assert "BluePeak X1" in description
    assert "front, side, and back" in description
    assert "pure white background" in description
    assert "Aspect ratio: 3:4" in description
    assert not re.search(r"[\u4e00-\u9fff]", description)


def test_mock_english_character_output_localizes_chinese_story_designation() -> None:
    adapter = MockModelArkAdapter(_settings())
    request = CharacterGenerationRequest(
        project_id="project-1",
        brief=Brief(
            prompt="Create an ad for BluePeak X1",
            target_language=TargetLanguage.EN,
            product_name="BluePeak X1",
        ),
        story_content="主角：小微店主正在寻找更高效的解决方式。",
    )

    characters = asyncio.run(adapter.generate_characters(request))

    assert [character.name for character in characters] == ["Character 1"]
    assert not re.search(r"[\u4e00-\u9fff]", characters[0].description)


def test_byteplus_character_adapter_uses_english_extraction_prompt() -> None:
    client = FakeArkClient(
        chat_responses=[
            _chat_response(
                '{"characters":[{"name":"Avery Chen","description":'
                '"Avery Chen, front, side, and back turnaround views on a pure '
                'white background. Static relationship to BluePeak X1. '
                'Aspect ratio: 16:9"}]}'
            )
        ]
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)
    request = CharacterGenerationRequest(
        project_id="project-1",
        brief=Brief(
            prompt="Create a launch ad",
            target_language=TargetLanguage.EN,
            product_name="BluePeak X1",
            aspect_ratio="16:9",
        ),
        story_content="The protagonist is Avery Chen.",
    )

    result = asyncio.run(adapter.generate_characters(request))

    assert result[0].name == "Avery Chen"
    messages = str(client.chat.completions.calls[0]["messages"])
    assert "Write name and description in English" in messages
    assert "BluePeak X1" in messages
    assert "name 使用故事中的称谓" not in messages


def test_byteplus_image_prompt_uses_complete_brief_and_plain_text_output() -> None:
    client = FakeArkClient(
        chat_responses=[
            _chat_response(
                'A direct production-ready image prompt with "Move faster".'
            )
        ]
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)
    request = ImagePromptGenerationRequest(
        project_id="project-1",
        brief=Brief(
            prompt="Create a conversion-focused launch image.",
            product_name="BluePeak X1",
            selling_points=["fast iteration", "portable design"],
            audience="small business owners",
            target_platform="amazon",
            aspect_ratio="4:3",
            style="premium studio photography",
            target_language=TargetLanguage.EN,
            image_purpose="ecommerce_main",
        ),
        current_prompt="Keep the product centered.",
    )

    result = asyncio.run(adapter.generate_image_prompt(request))

    assert result.prompt == (
        'A direct production-ready image prompt with "Move faster".'
    )
    assert result.model == "doubao-seed-evolving"
    call = client.chat.completions.calls[0]
    assert call["model"] == "doubao-seed-evolving"
    assert "response_format" not in call
    messages = call["messages"]
    system = messages[0]["content"]
    user = messages[1]["content"]
    for expected in (
        "Return only one prompt",
        "never invent",
        "paired ASCII double quotes",
        "up to four supplied selling points",
        "English",
    ):
        assert expected in system
    for expected in (
        "BluePeak X1",
        "fast iteration",
        "portable design",
        "small business owners",
        "conversion-focused launch image",
        "ecommerce_main",
        "amazon",
        "4:3",
        "premium studio photography",
        '"language": "en"',
        "Keep the product centered.",
    ):
        assert expected in user


@pytest.mark.parametrize("language", [TargetLanguage.ZH, TargetLanguage.EN])
def test_mock_image_prompt_is_language_specific_and_deterministic(
    language: TargetLanguage,
) -> None:
    adapter = MockModelArkAdapter(_settings())
    request = ImagePromptGenerationRequest(
        project_id="project-1",
        brief=Brief(
            prompt="Create a product image",
            product_name="BluePeak X1",
            selling_points=["fast iteration", "portable design"],
            target_language=language,
            image_purpose="poster",
        ),
    )

    first = asyncio.run(adapter.generate_image_prompt(request))
    second = asyncio.run(adapter.generate_image_prompt(request))

    assert first == second
    assert bool(re.search(r"[\u4e00-\u9fff]", first.prompt)) == (
        language == TargetLanguage.ZH
    )
    assert first.prompt.count('"') == 4


@pytest.mark.parametrize(
    "model_output",
    [
        'Empty visible copy: ""',
        'Unclosed visible copy: "Move faster',
        'Too many: "One" "Two" "Three" "Four" "Five"',
    ],
)
def test_byteplus_image_prompt_rejects_invalid_visible_copy(
    model_output: str,
) -> None:
    client = FakeArkClient(chat_responses=[_chat_response(model_output)])
    adapter = BytePlusModelArkAdapter(_settings(), client=client)
    request = ImagePromptGenerationRequest(
        project_id="project-1",
        brief=Brief(
            prompt="Create a launch image.",
            product_name="BluePeak X1",
            selling_points=["fast iteration"],
            target_language=TargetLanguage.EN,
            image_purpose="poster",
        ),
    )

    with pytest.raises(
        ModelArkTextParseError,
        match="invalid visible copy",
    ):
        asyncio.run(adapter.generate_image_prompt(request))


def test_byteplus_image_prompt_accepts_no_visible_copy() -> None:
    client = FakeArkClient(
        chat_responses=[_chat_response("A clean product image without visible text.")]
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)
    request = ImagePromptGenerationRequest(
        project_id="project-1",
        brief=Brief(
            prompt="Create a launch image.",
            product_name="BluePeak X1",
            selling_points=["fast iteration"],
            target_language=TargetLanguage.EN,
            image_purpose="poster",
        ),
    )

    result = asyncio.run(adapter.generate_image_prompt(request))

    assert result.prompt == "A clean product image without visible text."


def test_byteplus_character_adapter_extracts_cards_with_text_model() -> None:
    client = FakeArkClient(
        chat_responses=[
            _chat_response(
                '{"characters":[{"name":"林然","description":"年轻创业者，穿浅色衬衫，在清晨通勤场景中使用便携咖啡机。"},{"name":"同事阿周","description":"办公室同事，商务休闲装，见证产品带来的效率变化。"}]}'
            ),
        ]
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)

    results = asyncio.run(adapter.generate_characters(_request()))

    assert [item.name for item in results] == ["林然", "同事阿周"]
    assert [item.sort_order for item in results] == [1, 2]
    assert "便携咖啡机" in results[0].description
    assert client.images.calls == []
    assert len(client.chat.completions.calls) == 1
    call = client.chat.completions.calls[0]
    assert call["model"] == "doubao-seed-evolving"
    assert call["response_format"] == {"type": "json_object"}
    assert call["thinking"] == {"type": "disabled"}
    assert "characters" in str(call["messages"])
    assert "品牌体验官" in str(call["messages"])


def test_byteplus_character_adapter_edits_single_character_with_source_url() -> None:
    client = FakeArkClient([_response("https://model.example/edited.png")])
    adapter = BytePlusModelArkAdapter(_settings(), client=client)

    result = asyncio.run(
        adapter.edit_character_image(
            CharacterImageEditRequest(
                project_id="project-1",
                source_image_url="https://assets.example.com/character.png?signature=x",
                prompt="让角色穿浅蓝色通勤外套",
            )
        )
    )

    assert result.url == "https://model.example/edited.png"
    assert result.metadata["operation_type"] == "edit"
    assert len(client.images.calls) == 1
    call = client.images.calls[0]
    assert call["model"] == "doubao-seedream-5-0-pro-260628"
    assert call["prompt"] == "让角色穿浅蓝色通勤外套"
    assert call["image"] == "https://assets.example.com/character.png?signature=x"
    assert call["size"] == "2K"
    assert call["output_format"] == "png"
    assert call["response_format"] == "url"
    assert call["watermark"] is False


def test_byteplus_character_adapter_regenerates_single_character_from_prompt() -> None:
    client = FakeArkClient([_response("https://model.example/regenerated.png")])
    adapter = BytePlusModelArkAdapter(_settings(), client=client)

    result = asyncio.run(
        adapter.regenerate_character_image(
            CharacterImageRegenerateRequest(
                project_id="project-1",
                prompt="重新生成一位更年轻的品牌体验官",
            )
        )
    )

    assert result.url == "https://model.example/regenerated.png"
    assert result.metadata["operation_type"] == "regenerate"
    assert len(client.images.calls) == 1
    call = client.images.calls[0]
    assert call["model"] == "doubao-seedream-5-0-pro-260628"
    assert call["prompt"] == "重新生成一位更年轻的品牌体验官"
    assert "image" not in call
    assert call["size"] == "2K"
    assert call["output_format"] == "png"
    assert call["response_format"] == "url"
    assert call["watermark"] is False


def test_byteplus_video_adapter_generates_seedance_video_with_references() -> None:
    client = FakeArkClient(
        video_create_responses=[SimpleNamespace(id="video-task-1")],
        video_get_responses=[
            SimpleNamespace(
                status="succeeded",
                content=SimpleNamespace(
                    video_url="https://model.example/generated.mp4",
                    last_frame_url="https://model.example/generated-last-frame.png",
                ),
            )
        ],
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)
    request = VideoGenerationRequest(
        project_id="project-1",
        shot=StoryboardShotCreate(
            project_id="project-1",
            index=1,
            title="通勤开场",
            description="地铁车厢内拿出便携咖啡机",
            visual_prompt="真实生活流",
            duration_seconds=3,
            status=Status.DRAFT,
        ),
        video_prompt="参考图1保持人物一致，参考视频1用于运镜。",
        aspect_ratio="9:16",
        reference_image_urls=["https://assets.example.com/image.png"],
        reference_video_urls=["https://assets.example.com/video.mp4"],
        reference_audio_urls=["https://assets.example.com/audio.mp3"],
    )

    result = asyncio.run(adapter.generate_video(request))

    assert result.url == "https://model.example/generated.mp4"
    assert result.last_frame_url == (
        "https://model.example/generated-last-frame.png"
    )
    assert result.metadata["provider"] == "volcengine-modelark"
    assert result.metadata["provider_task_id"] == "video-task-1"
    assert result.metadata["requested_duration_seconds"] == 3
    assert result.metadata["duration_seconds"] == 4
    assert result.metadata["aspect_ratio"] == "9:16"
    tasks = client.content_generation.tasks
    assert tasks.get_calls == [{"task_id": "video-task-1"}]
    call = tasks.create_calls[0]
    assert call["model"] == "doubao-seedance-2-5-260628"
    assert call["resolution"] == "720p"
    assert call["ratio"] == "9:16"
    assert call["duration"] == 4
    assert call["generate_audio"] is True
    assert call["return_last_frame"] is True
    assert call["watermark"] is False
    assert call["content"] == [
        {
            "type": "text",
            "text": "参考图1保持人物一致，参考视频1用于运镜。",
        },
        {
            "type": "image_url",
            "image_url": {"url": "https://assets.example.com/image.png"},
            "role": "reference_image",
        },
        {
            "type": "video_url",
            "video_url": {"url": "https://assets.example.com/video.mp4"},
            "role": "reference_video",
        },
        {
            "type": "audio_url",
            "audio_url": {"url": "https://assets.example.com/audio.mp3"},
            "role": "reference_audio",
        },
    ]


def test_byteplus_video_adapter_edits_video_as_reference_candidate() -> None:
    client = FakeArkClient(
        video_create_responses=[SimpleNamespace(id="video-edit-task-1")],
        video_get_responses=[
            SimpleNamespace(
                status="succeeded",
                content=SimpleNamespace(
                    video_url="https://model.example/edited.mp4",
                    last_frame_url=None,
                ),
            )
        ],
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)
    request = VideoEditRequest(
        project_id="project-1",
        shot=StoryboardShotCreate(
            project_id="project-1",
            index=2,
            description="产品使用过程",
            visual_prompt="自然光",
            duration_seconds=8,
            status=Status.SUCCEEDED,
        ),
        source_video_url="https://assets.example.com/source.mp4",
        prompt="增强产品特写，保持人物动作连续",
        aspect_ratio="16:9",
    )

    result = asyncio.run(adapter.edit_video(request))

    assert result.url == "https://model.example/edited.mp4"
    assert result.metadata["operation"] == "video_edit"
    assert result.metadata["edit_prompt"] == "增强产品特写，保持人物动作连续"
    call = client.content_generation.tasks.create_calls[0]
    assert call["ratio"] == "adaptive"
    assert call["duration"] == -1
    assert call["content"][1] == {
        "type": "video_url",
        "video_url": {"url": "https://assets.example.com/source.mp4"},
        "role": "reference_video",
    }
    assert "保持原视频时长" in call["content"][0]["text"]
    assert "增强产品特写" in call["content"][0]["text"]


def test_byteplus_video_adapter_sanitizes_failed_provider_task() -> None:
    client = FakeArkClient(
        video_create_responses=[SimpleNamespace(id="video-task-failed")],
        video_get_responses=[
            SimpleNamespace(
                status="failed",
                error=SimpleNamespace(
                    message="provider raw secret response",
                    code="InternalError",
                ),
            )
        ],
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)
    request = VideoGenerationRequest(
        project_id="project-1",
        shot=StoryboardShotCreate(
            project_id="project-1",
            index=1,
            description="产品特写",
            visual_prompt="自然晨光",
            duration_seconds=5,
            status=Status.DRAFT,
        ),
    )

    with pytest.raises(ModelArkProviderError) as exc_info:
        asyncio.run(adapter.generate_video(request))

    error = str(exc_info.value)
    assert error == "video generation task failed"
    assert "provider raw secret response" not in error
    assert exc_info.value.provider_code == "InternalError"
    assert exc_info.value.phase == "poll"
    assert exc_info.value.provider_task_id == "video-task-failed"


def test_byteplus_video_adapter_extracts_safe_provider_request_id() -> None:
    client = FakeArkClient(
        video_create_responses=[SimpleNamespace(id="video-task-policy")],
        video_get_responses=[
            SimpleNamespace(
                status="failed",
                error=SimpleNamespace(
                    message=(
                        "raw provider text with secret; "
                        "Request id: request-safe-123"
                    ),
                    code="OutputVideoSensitiveContentDetected.PolicyViolation",
                ),
            )
        ],
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)
    request = VideoGenerationRequest(
        project_id="project-1",
        shot=StoryboardShotCreate(
            project_id="project-1",
            index=1,
            description="产品特写",
            visual_prompt="自然晨光",
            duration_seconds=5,
            status=Status.DRAFT,
        ),
    )

    with pytest.raises(ModelArkProviderError) as exc_info:
        asyncio.run(adapter.generate_video(request))

    assert exc_info.value.safe_detail() == (
        "provider_code=OutputVideoSensitiveContentDetected.PolicyViolation; "
        "request_id=request-safe-123; "
        "provider_task_id=video-task-policy; phase=poll"
    )
    assert "raw provider text" not in exc_info.value.safe_detail()
    assert "secret" not in exc_info.value.safe_detail()


def test_byteplus_video_adapter_uses_storyboard_image_as_first_frame() -> None:
    client = FakeArkClient(
        video_create_responses=[SimpleNamespace(id="video-task-first-frame")],
        video_get_responses=[
            SimpleNamespace(
                status="succeeded",
                content=SimpleNamespace(
                    video_url="https://model.example/first-frame.mp4"
                ),
            )
        ],
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)
    request = VideoGenerationRequest(
        project_id="project-1",
        shot=StoryboardShotCreate(
            project_id="project-1",
            index=2,
            description="产品特写",
            visual_prompt="自然晨光",
            duration_seconds=5,
            status=Status.DRAFT,
        ),
        image_url="https://assets.example.com/storyboard.png",
    )

    result = asyncio.run(adapter.generate_video(request))

    assert result.metadata["uses_first_frame"] is True
    assert result.metadata["aspect_ratio"] == "adaptive"
    assert client.content_generation.tasks.create_calls[0]["ratio"] == "adaptive"
    assert client.content_generation.tasks.create_calls[0]["content"][1] == {
        "type": "image_url",
        "image_url": {"url": "https://assets.example.com/storyboard.png"},
        "role": "first_frame",
    }
    assert len(client.content_generation.tasks.create_calls[0]["content"]) == 2


@pytest.mark.parametrize(
    ("reference_field", "reference_url"),
    [
        ("reference_image_urls", "https://assets.example.com/reference.png"),
        ("reference_video_urls", "https://assets.example.com/reference.mp4"),
        ("reference_audio_urls", "https://assets.example.com/reference.mp3"),
    ],
)
def test_video_generation_request_rejects_first_frame_with_reference_media(
    reference_field: str,
    reference_url: str,
) -> None:
    with pytest.raises(ValueError, match="first frame cannot be combined"):
        VideoGenerationRequest(
            project_id="project-1",
            shot=StoryboardShotCreate(
                project_id="project-1",
                index=2,
                description="产品特写",
                visual_prompt="自然晨光",
                duration_seconds=5,
                status=Status.DRAFT,
            ),
            image_url="https://assets.example.com/first-frame.png",
            **{reference_field: [reference_url]},
        )


def test_byteplus_video_adapter_allows_missing_last_frame() -> None:
    client = FakeArkClient(
        video_create_responses=[SimpleNamespace(id="video-task-no-last-frame")],
        video_get_responses=[
            SimpleNamespace(
                status="succeeded",
                content=SimpleNamespace(
                    video_url="https://model.example/generated.mp4",
                ),
            )
        ],
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)
    request = VideoGenerationRequest(
        project_id="project-1",
        shot=StoryboardShotCreate(
            project_id="project-1",
            index=1,
            description="产品特写",
            visual_prompt="自然晨光",
            duration_seconds=5,
            status=Status.DRAFT,
        ),
    )

    result = asyncio.run(adapter.generate_video(request))

    assert result.url == "https://model.example/generated.mp4"
    assert result.last_frame_url is None


def test_hybrid_adapter_routes_video_to_real_adapter() -> None:
    expected = SimpleNamespace(url="https://model.example/generated.mp4")
    real_adapter = SimpleNamespace(generate_video=AsyncMock(return_value=expected))
    mock_adapter = SimpleNamespace(generate_video=AsyncMock())
    adapter = HybridModelArkAdapter(
        character_adapter=real_adapter,
        fallback_adapter=mock_adapter,
    )
    request = VideoGenerationRequest(
        project_id="project-1",
        shot=StoryboardShotCreate(
            project_id="project-1",
            index=1,
            description="产品特写",
            visual_prompt="自然晨光",
            duration_seconds=5,
            status=Status.DRAFT,
        ),
    )

    result = asyncio.run(adapter.generate_video(request))

    assert result is expected
    real_adapter.generate_video.assert_awaited_once_with(request)
    mock_adapter.generate_video.assert_not_awaited()


def test_byteplus_character_adapter_rejects_empty_character_output() -> None:
    adapter = BytePlusModelArkAdapter(
        _settings(),
        client=FakeArkClient(chat_responses=[_chat_response('{"characters":[]}')]),
    )

    with pytest.raises(ModelArkTextParseError) as exc_info:
        asyncio.run(adapter.generate_characters(_request()))

    assert "no characters" in str(exc_info.value)


def test_byteplus_character_adapter_sanitizes_provider_errors() -> None:
    adapter = BytePlusModelArkAdapter(
        _settings(),
        client=FakeArkClient(
            chat_responses=[RuntimeError("provider raw secret response")]
        ),
    )

    with pytest.raises(ModelArkProviderError) as exc_info:
        asyncio.run(adapter.generate_characters(_request()))

    error = str(exc_info.value)
    assert "character extraction failed" in error
    assert "provider raw secret response" not in error


def test_byteplus_text_adapter_calls_chat_for_pure_text_story() -> None:
    client = FakeArkClient(
        chat_responses=[
            _chat_response('{"title":"咖啡机故事","content":"故事正文"}'),
        ]
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)

    result = asyncio.run(
        adapter.generate_text(
            TextGenerationRequest(
                project_id="project-1",
                stage=Stage.STORY,
                brief=Brief(
                    prompt="生成一条咖啡机广告",
                    product_name="便携咖啡机",
                ),
            )
        )
    )

    assert result.stage == Stage.STORY
    assert result.title == "咖啡机故事"
    assert result.content == "故事正文"
    assert result.metadata["model"] == "doubao-seed-evolving"
    assert result.metadata["provider"] == "volcengine-modelark"
    assert result.metadata["image_input_count"] == 0
    assert len(client.chat.completions.calls) == 1
    assert client.responses.calls == []
    call = client.chat.completions.calls[0]
    assert call["model"] == "doubao-seed-evolving"
    assert call["response_format"] == {"type": "json_object"}
    assert call["thinking"] == {"type": "disabled"}
    assert "只输出 JSON" in str(call["messages"])


def test_byteplus_text_adapter_calls_responses_for_image_inputs() -> None:
    client = FakeArkClient(
        response_responses=[
            _responses_response('{"title":"图文故事","content":"结合参考图的故事正文"}'),
        ]
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)

    result = asyncio.run(
        adapter.generate_text(
            TextGenerationRequest(
                project_id="project-1",
                stage=Stage.STORY,
                brief=Brief(
                    prompt="生成一条咖啡机广告",
                    product_name="便携咖啡机",
                ),
                image_urls=[
                    "https://assets.example.com/ref-a.png?x=1",
                    "https://assets.example.com/ref-b.png?x=2",
                ],
            )
        )
    )

    assert result.title == "图文故事"
    assert result.metadata["image_input_count"] == 2
    assert client.chat.completions.calls == []
    assert len(client.responses.calls) == 1
    call = client.responses.calls[0]
    assert call["model"] == "doubao-seed-evolving"
    assert call["text"] == {"format": {"type": "json_object"}}
    assert call["thinking"] == {"type": "disabled"}
    content = call["input"][0]["content"]
    assert [item["type"] for item in content] == [
        "input_text",
        "input_image",
        "input_image",
    ]
    assert content[1]["image_url"] == "https://assets.example.com/ref-a.png?x=1"
    assert content[2]["detail"] == "auto"


def test_byteplus_text_adapter_parses_storyboard_json() -> None:
    client = FakeArkClient(
        chat_responses=[
            _chat_response(
                """
                {
                  "title": "分镜脚本",
                  "content": "分镜正文",
                  "storyboard_shots": [
                    {
                      "project_id": "project-1",
                      "index": 1,
                      "title": "开场",
                      "description": "真实场景痛点",
                      "visual_prompt": "realistic commercial opening",
                      "narration": "旁白",
                      "duration_seconds": 12
                    },
                    {
                      "project_id": "project-1",
                      "index": 2,
                      "title": "收束",
                      "description": "商品 CTA",
                      "visual_prompt": "product call to action",
                      "narration": "立即体验",
                      "duration_seconds": 12
                    }
                  ]
                }
                """
            ),
        ]
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)

    result = asyncio.run(
        adapter.generate_text(
            TextGenerationRequest(
                project_id="project-1",
                stage=Stage.STORYBOARD,
                brief=Brief(
                    prompt="生成一条咖啡机广告",
                    product_name="便携咖啡机",
                    duration_seconds=24,
                ),
                upstream_content="有效剧本正文",
            )
        )
    )

    assert result.stage == Stage.STORYBOARD
    assert result.title == "分镜脚本"
    assert [shot.index for shot in result.storyboard_shots] == [1, 2]
    assert result.storyboard_shots[0].project_id == "project-1"
    assert result.storyboard_shots[1].duration_seconds == 12


def test_byteplus_text_adapter_sanitizes_provider_and_parse_errors() -> None:
    provider_adapter = BytePlusModelArkAdapter(
        _settings(),
        client=FakeArkClient(
            chat_responses=[
                RuntimeError("provider failed with sk-test-secret and signed-url"),
            ]
        ),
    )

    with pytest.raises(ModelArkProviderError) as provider_exc:
        asyncio.run(
            provider_adapter.generate_text(
                TextGenerationRequest(
                    project_id="project-1",
                    stage=Stage.STORY,
                    brief=Brief(prompt="生成一条咖啡机广告"),
                )
            )
        )

    provider_error = str(provider_exc.value)
    assert "story" in provider_error
    assert "sk-test-secret" not in provider_error
    assert "signed-url" not in provider_error

    parse_adapter = BytePlusModelArkAdapter(
        _settings(),
        client=FakeArkClient(chat_responses=[_chat_response("not json")]),
    )

    with pytest.raises(ModelArkTextParseError) as parse_exc:
        asyncio.run(
            parse_adapter.generate_text(
                TextGenerationRequest(
                    project_id="project-1",
                    stage=Stage.STORY,
                    brief=Brief(prompt="生成一条咖啡机广告"),
                )
            )
        )

    parse_error = str(parse_exc.value)
    assert "valid JSON" in parse_error
    assert "not json" not in parse_error


def test_byteplus_video_prompt_optimizer_uses_structured_json_contract() -> None:
    shot = StoryboardShotCreate(
        project_id="project-1",
        index=1,
        title="通勤开场",
        description="林然在地铁站拿出便携咖啡机。",
        visual_prompt="自然晨光，中景跟拍。",
        narration="旁白：随时喝到新鲜咖啡。",
        duration_seconds=5,
    )
    baseline = build_single_shot_video_prompt(shot)
    client = FakeArkClient(
        chat_responses=[
            _chat_response(
                "```json\n"
                + '{"optimized_prompt":'
                + json.dumps(baseline, ensure_ascii=False)
                + "}\n```"
            )
        ]
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)
    request = VideoPromptOptimizationRequest(
        project_id="project-1",
        brief=Brief(
            prompt="生成便携咖啡机广告",
            product_name="便携咖啡机",
            aspect_ratio="9:16",
        ),
        shot=VideoPromptOptimizationShotContext(
            title=shot.title,
            description=shot.description,
            visual_prompt=shot.visual_prompt,
            narration=shot.narration,
            duration_seconds=5,
            timeline_start_seconds=0,
            timeline_end_seconds=5,
        ),
        atomic_shots=[
            VideoPromptOptimizationShotContext(
                title=shot.title,
                description=shot.description,
                visual_prompt=shot.visual_prompt,
                narration=shot.narration,
                duration_seconds=5,
                timeline_start_seconds=0,
                timeline_end_seconds=5,
            )
        ],
        video_prompt="当前编辑草稿",
        baseline_prompt=baseline,
        reference_asset_labels=["(参考@图1)"],
    )

    result = asyncio.run(adapter.optimize_video_prompt(request))

    assert result.optimized_prompt == baseline
    call = client.chat.completions.calls[0]
    assert call["response_format"] == {"type": "json_object"}
    assert call["temperature"] == 0.1
    assert call["thinking"] == {"type": "disabled"}
    assert [message["role"] for message in call["messages"]] == ["system", "user"]
    messages = str(call["messages"])
    assert "optimized_prompt" in messages
    assert "当前编辑草稿" in messages
    assert "(参考@图1)" in messages
    assert "半角括号和 @" in messages
    assert "不得改回旧式引用" in messages
    assert "不得猜测素材内容或新增编号" in messages


def test_mock_video_prompt_optimizer_is_deterministic_and_structured() -> None:
    shot = StoryboardShotCreate(
        project_id="project-1",
        index=1,
        description="商品进入画面。",
        visual_prompt="稳定推近。",
        duration_seconds=4,
    )
    baseline = build_single_shot_video_prompt(shot)
    context = VideoPromptOptimizationShotContext(
        description=shot.description,
        visual_prompt=shot.visual_prompt,
        duration_seconds=4,
        timeline_start_seconds=0,
        timeline_end_seconds=4,
    )
    request = VideoPromptOptimizationRequest(
        project_id="project-1",
        brief=Brief(prompt="商品广告"),
        shot=context,
        atomic_shots=[context],
        video_prompt=baseline,
        baseline_prompt=baseline,
    )
    adapter = MockModelArkAdapter(_settings())

    first = asyncio.run(adapter.optimize_video_prompt(request))
    second = asyncio.run(adapter.optimize_video_prompt(request))

    assert first == second
    assert "优化增强" in first.optimized_prompt
    assert "[0s-4s]" in first.optimized_prompt
    assert first.optimized_prompt.count("【连续时间轴】") == 1


def test_english_video_prompt_optimizer_messages_and_mock_follow_brief_language() -> None:
    shot = StoryboardShotCreate(
        project_id="project-1",
        index=1,
        description="A commuter reveals the compact coffee maker.",
        visual_prompt="Medium tracking shot in natural morning light.",
        narration="Narration: Fresh coffee wherever you go.",
        duration_seconds=5,
    )
    brief = Brief(
        prompt="Create a compact coffee maker ad.",
        target_language=TargetLanguage.EN,
    )
    baseline = build_single_shot_video_prompt(
        shot,
        target_language=TargetLanguage.EN,
    )
    context = VideoPromptOptimizationShotContext(
        description=shot.description,
        visual_prompt=shot.visual_prompt,
        narration=shot.narration,
        duration_seconds=5,
        timeline_start_seconds=0,
        timeline_end_seconds=5,
    )
    request = VideoPromptOptimizationRequest(
        project_id="project-1",
        brief=brief,
        shot=context,
        atomic_shots=[context],
        video_prompt=baseline,
        baseline_prompt=baseline,
        reference_asset_labels=["(参考@图1)"],
    )

    system_prompt, user_prompt = (
        MockModelArkAdapter.build_video_prompt_optimization_messages(request)
    )
    optimized = asyncio.run(MockModelArkAdapter(_settings()).optimize_video_prompt(request))
    client = FakeArkClient(
        chat_responses=[
            _chat_response(
                json.dumps(
                    {"optimized_prompt": baseline},
                    ensure_ascii=False,
                )
            )
        ]
    )
    real_result = asyncio.run(
        BytePlusModelArkAdapter(_settings(), client=client).optimize_video_prompt(
            request
        )
    )

    assert "[Overall Requirements]" in system_prompt
    assert "natural, clear English speech" in system_prompt
    assert "Do not include subtitles" in system_prompt
    assert "authoritative backend context" in user_prompt
    assert "请根据" not in user_prompt
    assert "Optimization enhancement:" in optimized.optimized_prompt
    assert optimized.optimized_prompt.count("[Continuous Timeline]") == 1
    assert "【连续时间轴】" not in optimized.optimized_prompt
    assert real_result.optimized_prompt == baseline
    real_messages = str(client.chat.completions.calls[0]["messages"])
    assert "[Overall Requirements]" in real_messages
    assert "natural, clear English speech" in real_messages
    assert "请根据" not in real_messages


def test_script_prompt_includes_story_and_brief_constraints() -> None:
    request = TextGenerationRequest(
        project_id="project-1",
        stage=Stage.SCRIPT,
        brief=Brief(
            prompt="生成一条咖啡机广告",
            target_platform="douyin",
            aspect_ratio="9:16",
            duration_seconds=24,
            style="真实晨光",
            audience="通勤白领",
            product_name="便携咖啡机",
            summary="主打清晨通勤场景",
            selling_points=["30秒出杯", "轻量便携"],
        ),
        upstream_content="主角赶地铁前需要一杯稳定好喝的咖啡。",
    )

    prompt = MockModelArkAdapter.build_script_prompt(request)

    for expected in [
        "主角赶地铁前需要一杯稳定好喝的咖啡",
        "便携咖啡机",
        "douyin",
        "9:16",
        "24s",
        "真实晨光",
        "通勤白领",
        "30秒出杯、轻量便携",
        "画面描述、人物动作、台词/旁白、商品露出、节奏说明、转化号召",
    ]:
        assert expected in prompt


def test_english_script_prompt_and_real_adapter_request_enforce_english_output() -> None:
    request = TextGenerationRequest(
        project_id="project-1",
        stage=Stage.SCRIPT,
        brief=Brief(
            prompt="Create a conversion ad for BluePeak X1",
            target_language=TargetLanguage.EN,
            target_platform="TikTok",
            aspect_ratio="9:16",
            duration_seconds=24,
            style="natural morning light",
            audience="urban commuters",
            product_name="BluePeak X1",
            selling_points=["30-second brew", "travel ready"],
        ),
        upstream_content="Avery Chen needs reliable coffee before the train.",
    )
    client = FakeArkClient(
        chat_responses=[
            _chat_response(
                '{"title":"BluePeak X1 Ad Script",'
                '"content":"Scene 1: Avery Chen introduces BluePeak X1."}'
            )
        ]
    )
    adapter = BytePlusModelArkAdapter(_settings(), client=client)

    result = asyncio.run(adapter.generate_text(request))
    prompt = client.chat.completions.calls[0]["messages"][0]["content"]

    assert result.title == "BluePeak X1 Ad Script"
    for expected in [
        "Write the title and complete content in English",
        "Avery Chen",
        "BluePeak X1",
        "Visual Description",
        "Character Action",
        "Dialogue / Voice-over",
        "Product Placement",
        "Pacing",
        "Call to Action",
    ]:
        assert expected in prompt
    assert "使用中文" not in prompt
    assert "中文标题" not in prompt


def test_mock_english_script_output_is_fully_english_and_keeps_proper_names() -> None:
    adapter = MockModelArkAdapter(_settings())
    request = TextGenerationRequest(
        project_id="project-1",
        stage=Stage.SCRIPT,
        brief=Brief(
            prompt="Create a conversion ad for BluePeak X1",
            target_language=TargetLanguage.EN,
            target_platform="TikTok",
            aspect_ratio="9:16",
            duration_seconds=24,
            style="natural morning light",
            audience="urban commuters",
            product_name="BluePeak X1",
            selling_points=["30-second brew", "travel ready"],
        ),
        upstream_content="Avery Chen needs reliable coffee before the train.",
    )

    result = asyncio.run(adapter.generate_text(request))

    assert result.title == "BluePeak X1 24-Second Ad Script"
    assert "Avery Chen needs reliable coffee" in result.content
    for expected in [
        "## Scene 1",
        "Visual Description",
        "Character Action",
        "Dialogue / Voice-over",
        "Product Placement",
        "Pacing",
        "Call to Action",
        "BluePeak X1",
    ]:
        assert expected in result.content
    assert not re.search(r"[\u4e00-\u9fff]", result.title + result.content)


def test_mock_script_output_reflects_story_and_required_structure() -> None:
    adapter = MockModelArkAdapter(_settings())
    request = TextGenerationRequest(
        project_id="project-1",
        stage=Stage.SCRIPT,
        brief=Brief(
            prompt="生成一条咖啡机广告",
            target_platform="douyin",
            aspect_ratio="9:16",
            duration_seconds=24,
            style="真实晨光",
            audience="通勤白领",
            product_name="便携咖啡机",
            selling_points=["30秒出杯", "轻量便携"],
        ),
        upstream_content="主角赶地铁前需要一杯稳定好喝的咖啡。",
    )

    result = asyncio.run(adapter.generate_text(request))

    assert result.stage == Stage.SCRIPT
    assert result.title == "便携咖啡机 24秒广告剧本"
    for expected in [
        "主角赶地铁前需要一杯稳定好喝的咖啡",
        "商品：便携咖啡机",
        "平台：douyin",
        "比例：9:16",
        "时长：24s",
        "风格：真实晨光",
        "受众：通勤白领",
        "卖点：30秒出杯、轻量便携",
        "## 场次 1",
        "画面描述",
        "人物动作",
        "台词/旁白",
        "商品露出",
        "节奏说明",
        "转化号召",
    ]:
        assert expected in result.content
    assert result.metadata["has_upstream"] is True


def test_storyboard_prompt_includes_script_and_brief_constraints() -> None:
    request = TextGenerationRequest(
        project_id="project-1",
        stage=Stage.STORYBOARD,
        brief=Brief(
            prompt="生成一条咖啡机广告",
            target_platform="douyin",
            aspect_ratio="9:16",
            duration_seconds=24,
            style="真实晨光",
            audience="通勤白领",
            product_name="便携咖啡机",
            summary="主打清晨通勤场景",
            selling_points=["30秒出杯", "轻量便携"],
        ),
        upstream_content="场次 1：主角赶地铁前需要一杯稳定好喝的咖啡。场次 4：立即购买。",
    )

    prompt = MockModelArkAdapter.build_storyboard_prompt(request)

    for expected in [
        "主角赶地铁前需要一杯稳定好喝的咖啡",
        "立即购买",
        "便携咖啡机",
        "douyin",
        "9:16",
        "24s",
        "真实晨光",
        "通勤白领",
        "30秒出杯、轻量便携",
        "镜头时长、画面描述、主体/场景、运镜、旁白、音效和转场建议",
        "容差不超过 0.5 秒",
    ]:
        assert expected in prompt


def test_english_storyboard_prompt_enforces_english_structured_fields() -> None:
    request = TextGenerationRequest(
        project_id="project-1",
        stage=Stage.STORYBOARD,
        brief=Brief(
            prompt="Create a conversion ad for BluePeak X1",
            target_language=TargetLanguage.EN,
            target_platform="TikTok",
            aspect_ratio="16:9",
            duration_seconds=23,
            style="natural morning light",
            audience="urban commuters",
            product_name="BluePeak X1",
        ),
        upstream_content=(
            "Scene 1: Avery Chen needs coffee. Scene 4: Try BluePeak X1 now."
        ),
    )

    prompt = MockModelArkAdapter.build_storyboard_prompt(request)

    for expected in [
        "Write title and content in English",
        "Write every shot title, description, visual_prompt, and narration in English",
        "Avery Chen",
        "BluePeak X1",
        "subject / setting",
        "camera movement",
        "within 0.5 seconds",
    ]:
        assert expected in prompt
    assert "使用中文" not in prompt
    assert "完整中文分镜" not in prompt


def test_mock_english_storyboard_output_is_english_and_keeps_duration_contract() -> None:
    adapter = MockModelArkAdapter(_settings())
    request = TextGenerationRequest(
        project_id="project-1",
        stage=Stage.STORYBOARD,
        brief=Brief(
            prompt="Create a conversion ad for BluePeak X1",
            target_language=TargetLanguage.EN,
            target_platform="TikTok",
            aspect_ratio="16:9",
            duration_seconds=23,
            style="natural morning light",
            audience="urban commuters",
            product_name="BluePeak X1",
        ),
        upstream_content=(
            "Scene 1: Avery Chen needs coffee. Scene 4: Try BluePeak X1 now."
        ),
    )

    result = asyncio.run(adapter.generate_text(request))
    shots = result.storyboard_shots

    assert result.title == "BluePeak X1 Storyboard"
    assert "Avery Chen needs coffee" in result.content
    assert [shot.index for shot in shots] == [1, 2, 3, 4]
    assert abs(sum(shot.duration_seconds for shot in shots) - 23) <= 0.5
    assert all(shot.duration_seconds > 0 for shot in shots)
    assert all((shot.narration or "").startswith("Voice-over:") for shot in shots)
    structured_text = " ".join(
        [
            result.title,
            result.content,
            *[
                " ".join(
                    [
                        shot.title,
                        shot.description,
                        shot.visual_prompt,
                        shot.narration or "",
                    ]
                )
                for shot in shots
            ],
        ]
    )
    assert "BluePeak X1" in structured_text
    assert not re.search(r"[\u4e00-\u9fff]", structured_text)


def test_mock_storyboard_output_reflects_script_and_duration_constraints() -> None:
    adapter = MockModelArkAdapter(_settings())
    request = TextGenerationRequest(
        project_id="project-1",
        stage=Stage.STORYBOARD,
        brief=Brief(
            prompt="生成一条咖啡机广告",
            target_platform="douyin",
            aspect_ratio="9:16",
            duration_seconds=23,
            style="真实晨光",
            audience="通勤白领",
            product_name="便携咖啡机",
            selling_points=["30秒出杯", "轻量便携"],
        ),
        upstream_content="主角赶地铁前需要咖啡，产品出现后快速出杯，最后 CTA 立即购买。",
    )

    result = asyncio.run(adapter.generate_text(request))

    assert result.stage == Stage.STORYBOARD
    assert result.title == "便携咖啡机 分镜脚本"
    for expected in [
        "剧本依据",
        "主角赶地铁前需要咖啡",
        "商品：便携咖啡机",
        "平台：douyin",
        "比例：9:16",
        "总时长：23s",
        "风格：真实晨光",
        "受众：通勤白领",
        "主体/场景",
        "运镜",
        "音效/转场",
        "旁白",
        "视觉提示",
    ]:
        assert expected in result.content

    shots = result.storyboard_shots
    assert [shot.index for shot in shots] == [1, 2, 3, 4]
    assert all(shot.duration_seconds > 0 for shot in shots)
    assert abs(sum(shot.duration_seconds for shot in shots) - 23) <= 0.5
    assert all((shot.narration or "").startswith("旁白：") for shot in shots)
    assert all(re.search(r"[\u4e00-\u9fff]", shot.visual_prompt) for shot in shots)
    assert "主角赶地铁前需要咖啡" in shots[0].description
    assert "便携咖啡机" in shots[1].description
    assert result.metadata["has_upstream"] is True


class InvalidStoryboardDurationAdapter:
    async def generate_text(self, request: TextGenerationRequest) -> GeneratedTextResult:
        return GeneratedTextResult(
            stage=Stage.STORYBOARD,
            title="Invalid Storyboard",
            content="invalid storyboard",
            storyboard_shots=[
                StoryboardShotCreate(
                    project_id=request.project_id,
                    index=1,
                    title="Too Short",
                    description="duration does not match brief",
                    visual_prompt="invalid prompt",
                    narration="invalid narration",
                    duration_seconds=1,
                    status=Status.DRAFT,
                )
            ],
        )


def test_storyboard_generation_service_rejects_duration_mismatch() -> None:
    service = ModelArkGenerationService(adapter=InvalidStoryboardDurationAdapter())

    with pytest.raises(ModelArkTextParseError) as exc_info:
        asyncio.run(
            service.generate_storyboard(
                "project-1",
                Brief(
                    prompt="生成一条咖啡机广告",
                    duration_seconds=24,
                    product_name="便携咖啡机",
                ),
                "有效剧本正文",
            )
        )

    assert "duration total" in str(exc_info.value)
