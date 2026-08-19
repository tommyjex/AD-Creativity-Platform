from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from functools import lru_cache
from typing import Iterable, Literal, Optional, Sequence

from pydantic import Field, ValidationError

from ..core.config import get_settings
from ..schemas import (
    AssetCreate,
    Brief,
    CharacterAssetIterationOperation,
    CharacterCardCreate,
    FrozenImageGenerationInput,
    FrozenImageLayerDecompositionInput,
    ImageBboxAnnotation,
    ImageEditAnnotation,
    ImagePurpose,
    ImagePromptSuggestion,
    Stage,
    Status,
    StoryboardShot,
    StoryboardShotCreate,
    TargetLanguage,
    TextArtifactCreate,
)
from ..schemas.common import SchemaModel
from ..video_prompt import (
    build_single_shot_video_prompt,
    expand_atomic_shots,
    expected_timeline_ranges,
    extract_standard_reference_tokens,
    normalize_video_prompt,
    strip_markdown_code_fence,
    validate_optimized_video_prompt,
)
from .modelark import (
    BytePlusModelArkAdapter,
    CharacterGenerationRequest,
    CharacterImageEditRequest,
    CharacterImageRegenerateRequest,
    GeneratedAssetResult,
    GeneratedCharacterCardResult,
    GeneratedTextResult,
    HybridModelArkAdapter,
    ImageGenerationRequest,
    ImagePromptGenerationRequest,
    LayerDecompositionRequest,
    LayerDecompositionResult,
    MockModelArkAdapter,
    ModelArkAdapter,
    ModelArkProviderError,
    ModelArkStreamEvent,
    ModelArkTextParseError,
    ProjectImageGenerationRequest,
    TextGenerationRequest,
    VideoEditRequest,
    VideoGenerationRequest,
    VideoPromptOptimizationRequest,
    VideoPromptOptimizationShotContext,
)


STORYBOARD_DURATION_TOLERANCE_SECONDS = 0.5


class StoryboardGenerationResult(SchemaModel):
    artifact: TextArtifactCreate
    shots: list[StoryboardShotCreate] = Field(default_factory=list)


class AssetBatchGenerationResult(SchemaModel):
    assets: list[AssetCreate] = Field(default_factory=list)


class StoryboardVideoGenerationResult(SchemaModel):
    asset: AssetCreate
    last_frame_url: str | None = None


class CharacterCardBatchGenerationResult(SchemaModel):
    cards: list[CharacterCardCreate] = Field(default_factory=list)


@dataclass(frozen=True)
class GenerationStreamEvent:
    kind: Literal["delta", "completed"]
    delta: str = ""
    result: TextArtifactCreate | StoryboardGenerationResult | str | None = None


class ModelArkGenerationService:
    """Workflow-facing service that converts ModelArk results into app schemas."""

    def __init__(self, adapter: Optional[ModelArkAdapter] = None) -> None:
        self.adapter = adapter or MockModelArkAdapter()
        self.settings = get_settings()

    async def generate_story(
        self,
        project_id: str,
        brief: Brief,
        image_urls: Sequence[str] | None = None,
    ) -> TextArtifactCreate:
        result = await self._generate_text(
            TextGenerationRequest(
                project_id=project_id,
                stage=Stage.STORY,
                brief=brief,
                image_urls=list(image_urls or []),
            )
        )
        return TextArtifactCreate(
            project_id=project_id,
            stage=Stage.STORY,
            title=result.title,
            content=result.content,
            status=Status.SUCCEEDED,
        )

    async def generate_image_prompt(
        self,
        project_id: str,
        brief: Brief,
        *,
        current_prompt: str | None = None,
    ) -> ImagePromptSuggestion:
        return await self.adapter.generate_image_prompt(
            ImagePromptGenerationRequest(
                project_id=project_id,
                brief=brief,
                current_prompt=current_prompt,
            )
        )

    async def stream_story(
        self,
        project_id: str,
        brief: Brief,
        image_urls: Sequence[str] | None = None,
    ) -> AsyncIterator[GenerationStreamEvent]:
        request = TextGenerationRequest(
            project_id=project_id,
            stage=Stage.STORY,
            brief=brief,
            image_urls=list(image_urls or []),
        )
        async for event in self._stream_text(request):
            if event.kind == "delta":
                yield GenerationStreamEvent(kind="delta", delta=event.delta)
                continue
            result = _require_generated_text_result(event)
            yield GenerationStreamEvent(
                kind="completed",
                result=TextArtifactCreate(
                    project_id=project_id,
                    stage=Stage.STORY,
                    title=result.title,
                    content=result.content,
                    status=Status.SUCCEEDED,
                ),
            )

    async def generate_script(
        self,
        project_id: str,
        brief: Brief,
        story_content: str,
        image_urls: Sequence[str] | None = None,
    ) -> TextArtifactCreate:
        result = await self._generate_text(
            TextGenerationRequest(
                project_id=project_id,
                stage=Stage.SCRIPT,
                brief=brief,
                upstream_content=story_content,
                image_urls=list(image_urls or []),
            )
        )
        return TextArtifactCreate(
            project_id=project_id,
            stage=Stage.SCRIPT,
            title=result.title,
            content=result.content,
            status=Status.SUCCEEDED,
        )

    async def stream_script(
        self,
        project_id: str,
        brief: Brief,
        story_content: str,
        image_urls: Sequence[str] | None = None,
    ) -> AsyncIterator[GenerationStreamEvent]:
        request = TextGenerationRequest(
            project_id=project_id,
            stage=Stage.SCRIPT,
            brief=brief,
            upstream_content=story_content,
            image_urls=list(image_urls or []),
        )
        async for event in self._stream_text(request):
            if event.kind == "delta":
                yield GenerationStreamEvent(kind="delta", delta=event.delta)
                continue
            result = _require_generated_text_result(event)
            yield GenerationStreamEvent(
                kind="completed",
                result=TextArtifactCreate(
                    project_id=project_id,
                    stage=Stage.SCRIPT,
                    title=result.title,
                    content=result.content,
                    status=Status.SUCCEEDED,
                ),
            )

    async def generate_character_cards(
        self,
        project_id: str,
        brief: Brief,
        story_content: str,
    ) -> CharacterCardBatchGenerationResult:
        if not story_content.strip():
            raise ModelArkTextParseError("character extraction requires story content")
        generated_cards = await self.adapter.generate_characters(
            CharacterGenerationRequest(
                project_id=project_id,
                brief=brief,
                story_content=story_content,
            )
        )
        if not generated_cards:
            raise ModelArkTextParseError("character extraction returned no characters")
        return CharacterCardBatchGenerationResult(
            cards=[
                self._to_character_card_create(project_id, generated)
                for generated in generated_cards
            ]
        )

    async def generate_character_asset_iteration(
        self,
        project_id: str,
        *,
        source_image_url: str,
        prompt: str,
        operation_type: CharacterAssetIterationOperation,
        metadata: dict[str, str | int | float | bool | None],
    ) -> AssetCreate:
        if operation_type == CharacterAssetIterationOperation.EDIT:
            generated = await self.adapter.edit_character_image(
                CharacterImageEditRequest(
                    project_id=project_id,
                    source_image_url=source_image_url,
                    prompt=prompt,
                )
            )
        else:
            generated = await self.adapter.regenerate_character_image(
                CharacterImageRegenerateRequest(
                    project_id=project_id,
                    prompt=prompt,
                )
            )

        return self._to_asset_create(
            project_id,
            generated.model_copy(
                update={
                    "metadata": {
                        **generated.metadata,
                        **metadata,
                        "status": Status.SUCCEEDED.value,
                    },
                },
                deep=True,
            ),
        )

    async def generate_project_image(
        self,
        frozen_input: FrozenImageGenerationInput,
        *,
        source_image_url: str | None = None,
        reference_image_url: str | None = None,
    ) -> GeneratedAssetResult:
        return await self.adapter.generate_project_image(
            ProjectImageGenerationRequest(
                project_id=frozen_input.project_id,
                model=frozen_input.model,
                operation=frozen_input.operation,
                prompt=frozen_input.normalized_prompt,
                size=frozen_input.size,
                output_format=frozen_input.format,
                source_image_url=source_image_url,
                reference_image_url=reference_image_url,
            )
        )

    async def decompose_image_layers(
        self,
        frozen_input: FrozenImageLayerDecompositionInput,
        *,
        source_image_url: str,
        canvas_width: int,
        canvas_height: int,
    ) -> LayerDecompositionResult:
        return await self.adapter.decompose_image_layers(
            LayerDecompositionRequest(
                project_id=frozen_input.project_id,
                model=frozen_input.model,
                image_url=source_image_url,
                canvas_width=canvas_width,
                canvas_height=canvas_height,
                prompt=frozen_input.final_prompt,
                size=frozen_input.size,
                output_format=frozen_input.format,
            )
        )

    @staticmethod
    def build_layer_decomposition_prompt(
        prompt: str | None,
        *,
        bbox: ImageBboxAnnotation | None,
    ) -> str | None:
        parts = [prompt.strip()] if prompt and prompt.strip() else []
        if bbox is not None:
            parts.append(
                f"图1<bbox>{bbox.x1} {bbox.y1} {bbox.x2} {bbox.y2}</bbox>"
            )
        return "\n\n".join(parts) or None

    @staticmethod
    def normalize_project_image_prompt(
        prompt: str,
        *,
        aspect_ratio: str,
        image_purpose: ImagePurpose,
    ) -> str:
        normalized = prompt.strip()
        if not normalized:
            raise ValueError("image prompt must not be blank")
        purpose_text = {
            ImagePurpose.ECOMMERCE_MAIN: "电商主图",
            ImagePurpose.POSTER: "海报",
        }[image_purpose]
        return (
            f"{normalized}\n\n"
            f"生成约束：画面比例严格使用 {aspect_ratio.strip()}；"
            f"图片用途为{purpose_text}。"
        )

    @staticmethod
    def build_image_edit_prompt(
        prompt: str,
        *,
        annotation: ImageEditAnnotation | None,
        target_language: TargetLanguage,
    ) -> str:
        normalized = prompt.strip()
        if not normalized:
            raise ValueError("image edit prompt must not be blank")
        if annotation is None:
            return normalized

        image_prefix = "图1" if target_language == TargetLanguage.ZH else "Image 1"
        if annotation.type == "point":
            location = f"{image_prefix}<point>{annotation.x} {annotation.y}</point>"
        else:
            location = (
                f"{image_prefix}<bbox>{annotation.x1} {annotation.y1} "
                f"{annotation.x2} {annotation.y2}</bbox>"
            )
        return f"{normalized}\n\n{location}"

    async def generate_character_card_image(
        self,
        project_id: str,
        *,
        aspect_ratio: str,
        target_language: TargetLanguage,
        character_name: str,
        character_description: str,
        metadata: dict[str, str | int | float | bool | None],
    ) -> AssetCreate:
        prompt = self.build_character_card_image_prompt(
            character_name,
            character_description,
            aspect_ratio,
            target_language,
        )
        generated = await self.adapter.regenerate_character_image(
            CharacterImageRegenerateRequest(
                project_id=project_id,
                prompt=prompt,
            )
        )
        return self._to_asset_create(
            project_id,
            generated.model_copy(
                update={
                    "metadata": {
                        **generated.metadata,
                        **metadata,
                        "current_prompt": prompt,
                        "status": Status.SUCCEEDED.value,
                    },
                },
                deep=True,
            ),
        )

    @staticmethod
    def build_character_card_image_prompt(
        character_name: str,
        character_description: str,
        aspect_ratio: str,
        target_language: TargetLanguage = TargetLanguage.ZH,
    ) -> str:
        if target_language == TargetLanguage.EN:
            return (
                f"Character name: {character_name.strip()}\n"
                "Character design description / image prompt: "
                f"{character_description.strip()}\n"
                "Generate a single-character design sheet with front, side, and "
                "back turnaround views displayed side by side on a pure white "
                "background. Keep the subject clear and suitable as a character "
                "asset for an advertising video.\n"
                "Do not add a specific scene, environmental props, narrative "
                "action, performed facial expressions, or performed body actions.\n"
                f"Aspect ratio: {aspect_ratio.strip()}"
            )
        return (
            f"角色名称：{character_name.strip()}\n"
            f"角色形象描述/生图提示词：{character_description.strip()}\n"
            "生成单角色形象设定图，人物或动物三视图（正面、侧面、背面）并列展示，"
            "白底背景，主体清晰，适合广告视频角色资产。\n"
            "禁止添加具体场景、环境道具、剧情化画面、表情演绎或肢体动作演绎。\n"
            f"画面比例：{aspect_ratio.strip()}"
        )

    async def generate_storyboard(
        self,
        project_id: str,
        brief: Brief,
        script_content: str,
        image_urls: Sequence[str] | None = None,
    ) -> StoryboardGenerationResult:
        if not script_content.strip():
            raise ModelArkTextParseError("storyboard generation requires script content")
        result = await self._generate_text(
            TextGenerationRequest(
                project_id=project_id,
                stage=Stage.STORYBOARD,
                brief=brief,
                upstream_content=script_content,
                image_urls=list(image_urls or []),
            )
        )
        self._validate_storyboard_shots(result.storyboard_shots, brief)
        artifact = TextArtifactCreate(
            project_id=project_id,
            stage=Stage.STORYBOARD,
            title=result.title,
            content=result.content,
            status=Status.SUCCEEDED,
        )
        return StoryboardGenerationResult(
            artifact=artifact,
            shots=result.storyboard_shots,
        )

    async def stream_storyboard(
        self,
        project_id: str,
        brief: Brief,
        script_content: str,
        image_urls: Sequence[str] | None = None,
    ) -> AsyncIterator[GenerationStreamEvent]:
        if not script_content.strip():
            raise ModelArkTextParseError("storyboard generation requires script content")
        request = TextGenerationRequest(
            project_id=project_id,
            stage=Stage.STORYBOARD,
            brief=brief,
            upstream_content=script_content,
            image_urls=list(image_urls or []),
        )
        async for event in self._stream_text(request):
            if event.kind == "delta":
                yield GenerationStreamEvent(kind="delta", delta=event.delta)
                continue
            result = _require_generated_text_result(event)
            self._validate_storyboard_shots(result.storyboard_shots, brief)
            yield GenerationStreamEvent(
                kind="completed",
                result=StoryboardGenerationResult(
                    artifact=TextArtifactCreate(
                        project_id=project_id,
                        stage=Stage.STORYBOARD,
                        title=result.title,
                        content=result.content,
                        status=Status.SUCCEEDED,
                    ),
                    shots=result.storyboard_shots,
                ),
            )

    async def generate_image_assets(
        self,
        project_id: str,
        brief: Brief,
        shots: Iterable[StoryboardShotCreate],
    ) -> AssetBatchGenerationResult:
        assets = []
        for shot in sorted(shots, key=lambda item: item.index):
            generated = await self.adapter.generate_image(
                ImageGenerationRequest(
                    project_id=project_id,
                    shot=shot,
                    aspect_ratio=brief.aspect_ratio,
                )
            )
            assets.append(self._to_asset_create(project_id, generated))
        return AssetBatchGenerationResult(assets=assets)

    async def generate_video_assets(
        self,
        project_id: str,
        brief: Brief,
        shots: Iterable[StoryboardShotCreate],
        image_assets: Optional[Sequence[AssetCreate]] = None,
    ) -> AssetBatchGenerationResult:
        image_urls_by_index = self._image_urls_by_index(image_assets or [])
        assets = []
        for shot in sorted(shots, key=lambda item: item.index):
            generated = await self.adapter.generate_video(
                VideoGenerationRequest(
                    project_id=project_id,
                    shot=shot,
                    image_url=image_urls_by_index.get(shot.index),
                    video_prompt=normalize_video_prompt(
                        shot,
                        shot.video_prompt,
                        target_language=brief.target_language,
                    ),
                    aspect_ratio=brief.aspect_ratio,
                    brief_summary=brief.summary or brief.prompt,
                )
            )
            assets.append(self._to_asset_create(project_id, generated))
        return AssetBatchGenerationResult(assets=assets)

    async def generate_storyboard_shot_video_asset(
        self,
        project_id: str,
        brief: Brief,
        shot: StoryboardShotCreate,
        *,
        first_frame_url: str | None = None,
        video_prompt: str | None = None,
        reference_image_urls: Sequence[str] | None = None,
        reference_video_urls: Sequence[str] | None = None,
        reference_audio_urls: Sequence[str] | None = None,
    ) -> StoryboardVideoGenerationResult:
        generated = await self.adapter.generate_video(
            VideoGenerationRequest(
                project_id=project_id,
                shot=shot,
                image_url=first_frame_url,
                video_prompt=normalize_video_prompt(
                    shot,
                    video_prompt if video_prompt is not None else shot.video_prompt,
                    target_language=brief.target_language,
                ),
                aspect_ratio=brief.aspect_ratio,
                reference_image_urls=list(reference_image_urls or []),
                reference_video_urls=list(reference_video_urls or []),
                reference_audio_urls=list(reference_audio_urls or []),
                brief_summary=brief.summary or brief.prompt,
            )
        )
        return StoryboardVideoGenerationResult(
            asset=self._to_asset_create(project_id, generated),
            last_frame_url=generated.last_frame_url,
        )

    async def edit_storyboard_shot_video_asset(
        self,
        project_id: str,
        brief: Brief,
        shot: StoryboardShotCreate,
        *,
        source_video_url: str,
        prompt: str,
    ) -> StoryboardVideoGenerationResult:
        generated = await self.adapter.edit_video(
            VideoEditRequest(
                project_id=project_id,
                shot=shot,
                source_video_url=source_video_url,
                prompt=prompt,
                aspect_ratio=brief.aspect_ratio,
            )
        )
        return StoryboardVideoGenerationResult(
            asset=self._to_asset_create(project_id, generated),
            last_frame_url=generated.last_frame_url,
        )

    async def optimize_storyboard_shot_video_prompt(
        self,
        project_id: str,
        brief: Brief,
        shot: StoryboardShot,
        video_prompt: str | None,
    ) -> str:
        request, atomic_shots, draft = self._video_prompt_optimization_request(
            project_id,
            brief,
            shot,
            video_prompt,
        )
        try:
            result = await self.adapter.optimize_video_prompt(request)
            return self._validate_video_prompt_optimization(
                result.optimized_prompt,
                shot,
                atomic_shots,
                draft,
                brief.target_language,
            )
        except ModelArkProviderError:
            raise
        except (ValidationError, ValueError) as exc:
            raise ModelArkTextParseError(
                "video prompt optimization output failed validation"
            ) from exc
        except Exception as exc:
            raise ModelArkProviderError("video prompt optimization failed") from exc

    async def stream_storyboard_shot_video_prompt_optimization(
        self,
        project_id: str,
        brief: Brief,
        shot: StoryboardShot,
        video_prompt: str | None,
    ) -> AsyncIterator[GenerationStreamEvent]:
        request, atomic_shots, draft = self._video_prompt_optimization_request(
            project_id,
            brief,
            shot,
            video_prompt,
        )
        try:
            if hasattr(self.adapter, "stream_video_prompt_optimization"):
                events = self.adapter.stream_video_prompt_optimization(request)
            else:
                async def legacy_events() -> AsyncIterator[ModelArkStreamEvent]:
                    result = await self.adapter.optimize_video_prompt(request)
                    yield ModelArkStreamEvent(kind="completed", result=result)

                events = legacy_events()
            async for event in events:
                if event.kind == "delta":
                    yield GenerationStreamEvent(kind="delta", delta=event.delta)
                    continue
                result = event.result
                if result is None or not hasattr(result, "optimized_prompt"):
                    raise ModelArkTextParseError(
                        "video prompt optimization returned no result"
                    )
                optimized = self._validate_video_prompt_optimization(
                    result.optimized_prompt,
                    shot,
                    atomic_shots,
                    draft,
                    brief.target_language,
                )
                yield GenerationStreamEvent(kind="completed", result=optimized)
        except ModelArkProviderError:
            raise
        except (ValidationError, ValueError) as exc:
            raise ModelArkTextParseError(
                "video prompt optimization output failed validation"
            ) from exc
        except Exception as exc:
            raise ModelArkProviderError("video prompt optimization failed") from exc

    @staticmethod
    def _video_prompt_optimization_request(
        project_id: str,
        brief: Brief,
        shot: StoryboardShot,
        video_prompt: str | None,
    ) -> tuple[
        VideoPromptOptimizationRequest,
        list[StoryboardShotCreate],
        str,
    ]:
        draft = video_prompt or normalize_video_prompt(
            shot,
            shot.video_prompt,
            target_language=brief.target_language,
        )
        atomic_shots = expand_atomic_shots(shot)
        timeline_ranges = expected_timeline_ranges(atomic_shots)
        atomic_contexts = [
            VideoPromptOptimizationShotContext(
                title=atomic_shot.title,
                description=atomic_shot.description,
                visual_prompt=atomic_shot.visual_prompt,
                narration=atomic_shot.narration,
                duration_seconds=atomic_shot.duration_seconds,
                timeline_start_seconds=start,
                timeline_end_seconds=end,
            )
            for atomic_shot, (start, end) in zip(
                atomic_shots,
                timeline_ranges,
            )
        ]
        reference_labels = [
            *[
                f"(参考@图{index})"
                for index in range(1, len(shot.reference_image_asset_ids) + 1)
            ],
            *[
                f"(参考@视频{index})"
                for index in range(1, len(shot.reference_video_asset_ids) + 1)
            ],
            *[
                f"(参考@音频{index})"
                for index in range(1, len(shot.reference_audio_asset_ids) + 1)
            ],
        ]
        request = VideoPromptOptimizationRequest(
            project_id=project_id,
            brief=brief,
            shot=VideoPromptOptimizationShotContext(
                title=shot.title,
                description=shot.description,
                visual_prompt=shot.visual_prompt,
                narration=shot.narration,
                duration_seconds=shot.duration_seconds,
                timeline_start_seconds=0,
                timeline_end_seconds=shot.duration_seconds,
            ),
            atomic_shots=atomic_contexts,
            video_prompt=draft,
            baseline_prompt=build_single_shot_video_prompt(
                shot,
                target_language=brief.target_language,
            ),
            uses_first_frame=bool(
                shot.first_frame_asset_id
                or shot.first_frame_source_video_asset_id
            ),
            uses_previous_shot_last_frame=bool(
                shot.first_frame_source_video_asset_id
            ),
            reference_asset_labels=reference_labels,
        )
        return request, atomic_shots, draft

    @staticmethod
    def _validate_video_prompt_optimization(
        optimized_prompt: str,
        shot: StoryboardShot,
        atomic_shots: Sequence[StoryboardShotCreate],
        draft: str,
        target_language: TargetLanguage,
    ) -> str:
        required_reference_tokens = extract_standard_reference_tokens(draft)
        optimized = validate_optimized_video_prompt(
            optimized_prompt,
            atomic_shots,
            target_language=target_language,
            reference_image_count=len(shot.reference_image_asset_ids),
            reference_video_count=len(shot.reference_video_asset_ids),
            reference_audio_count=len(shot.reference_audio_asset_ids),
            required_reference_tokens=required_reference_tokens,
        )
        if optimized.strip() == strip_markdown_code_fence(draft).strip():
            optimized = validate_optimized_video_prompt(
                _ensure_visible_video_prompt_optimization(
                    optimized,
                    target_language=target_language,
                ),
                atomic_shots,
                target_language=target_language,
                reference_image_count=len(shot.reference_image_asset_ids),
                reference_video_count=len(shot.reference_video_asset_ids),
                reference_audio_count=len(shot.reference_audio_asset_ids),
                required_reference_tokens=required_reference_tokens,
            )
        return optimized

    async def _generate_text(
        self,
        request: TextGenerationRequest,
    ) -> GeneratedTextResult:
        try:
            return await self.adapter.generate_text(request)
        except ModelArkProviderError:
            raise
        except ValidationError as exc:
            raise ModelArkTextParseError(
                f"{request.stage.value} text generation response could not be parsed"
            ) from exc
        except Exception as exc:
            raise ModelArkProviderError(
                f"{request.stage.value} text generation failed"
            ) from exc

    async def _stream_text(
        self,
        request: TextGenerationRequest,
    ) -> AsyncIterator[ModelArkStreamEvent]:
        try:
            async for event in self.adapter.stream_text(request):
                yield event
        except ModelArkProviderError:
            raise
        except ValidationError as exc:
            raise ModelArkTextParseError(
                f"{request.stage.value} text generation response could not be parsed"
            ) from exc
        except Exception as exc:
            raise ModelArkProviderError(
                f"{request.stage.value} text generation failed"
            ) from exc

    @staticmethod
    def _to_asset_create(
        project_id: str,
        result: GeneratedAssetResult,
    ) -> AssetCreate:
        return AssetCreate(
            project_id=project_id,
            type=result.type,
            status=Status.SUCCEEDED,
            stage=result.stage,
            url=result.url,
            mime_type=result.mime_type,
            metadata=result.metadata,
        )

    @staticmethod
    def _to_character_card_create(
        project_id: str,
        result: GeneratedCharacterCardResult,
    ) -> CharacterCardCreate:
        return CharacterCardCreate(
            project_id=project_id,
            name=result.name,
            description=result.description,
            sort_order=result.sort_order,
            status=Status.DRAFT,
        )

    @staticmethod
    def _image_urls_by_index(
        image_assets: Sequence[AssetCreate],
    ) -> dict[int, str]:
        urls_by_index: dict[int, str] = {}
        for asset in image_assets:
            shot_index = asset.metadata.get("shot_index")
            if isinstance(shot_index, int) and asset.url:
                urls_by_index[shot_index] = asset.url
        return urls_by_index

    @staticmethod
    def _slug(value: str) -> str:
        return "".join(
            char.lower() if char.isalnum() or char in {"-", "_"} else "-"
            for char in value.strip()
        ).strip("-") or "project"

    @staticmethod
    def _validate_storyboard_shots(
        shots: Sequence[StoryboardShotCreate],
        brief: Brief,
    ) -> None:
        if not shots:
            raise ModelArkTextParseError("storyboard generation returned no shots")

        expected_indexes = list(range(1, len(shots) + 1))
        actual_indexes = [shot.index for shot in shots]
        if actual_indexes != expected_indexes:
            raise ModelArkTextParseError(
                "storyboard shot indexes must be consecutive from 1"
            )

        total_duration = 0.0
        for shot in shots:
            if shot.duration_seconds <= 0:
                raise ModelArkTextParseError(
                    "storyboard shot duration must be greater than 0"
                )
            total_duration += shot.duration_seconds

        if (
            abs(total_duration - brief.duration_seconds)
            > STORYBOARD_DURATION_TOLERANCE_SECONDS
        ):
            raise ModelArkTextParseError(
                "storyboard shot duration total does not match brief duration"
            )


def _require_generated_text_result(
    event: ModelArkStreamEvent,
) -> GeneratedTextResult:
    if not isinstance(event.result, GeneratedTextResult):
        raise ModelArkTextParseError("text generation returned no completed result")
    return event.result


def _ensure_visible_video_prompt_optimization(
    prompt: str,
    *,
    target_language: str = "zh",
) -> str:
    language = getattr(target_language, "value", target_language)
    if language == TargetLanguage.EN.value:
        enhancement = (
            "Optimization enhancement: specify shot size, camera position, camera "
            "speed, action continuity, blocking, pacing, and transitions while "
            "preserving subject identity, appearance, product, setting, and spatial "
            "continuity."
        )
        marker = "[Continuous Timeline]"
    else:
        enhancement = (
            "优化增强：明确景别、机位、运镜速度、主体动作衔接、镜头调度、"
            "节奏变化与转场方式，保持主体身份、外形、商品、场景和空间关系连续。"
        )
        marker = "【连续时间轴】"
    if enhancement in prompt:
        return prompt
    return prompt.replace(marker, f"{enhancement}\n\n{marker}", 1)


@lru_cache
def get_generation_service() -> ModelArkGenerationService:
    settings = get_settings()
    return ModelArkGenerationService(
        HybridModelArkAdapter(
            character_adapter=BytePlusModelArkAdapter(settings),
            fallback_adapter=MockModelArkAdapter(settings),
        )
    )
