from __future__ import annotations

import asyncio
import json
from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from backend.app.api.dependencies import (
    get_modelark_generation_service,
    get_repository,
)
from backend.app.main import create_app
from backend.app.repositories import InMemoryRepository
from backend.app.schemas import (
    Brief,
    ProjectCreate,
    Status,
    StoryboardShot,
    StoryboardShotCreate,
    StoryboardShotVideoPromptOptimizeRequest,
    TargetLanguage,
)
from backend.app.schemas.brief import BriefCreate
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.modelark import (
    MockModelArkAdapter,
    VideoPromptOptimizationRequest,
    ModelArkTextParseError,
)
from backend.app.video_prompt import (
    build_single_shot_video_prompt,
    extract_timeline_ranges,
)


def _sse_events(response) -> list[tuple[str, dict[str, object]]]:
    events = []
    for block in response.text.strip().split("\n\n"):
        lines = block.splitlines()
        event = next(line[7:] for line in lines if line.startswith("event: "))
        data = "\n".join(line[6:] for line in lines if line.startswith("data: "))
        events.append((event, json.loads(data)))
    return events


def _optimized_prompt(response) -> str:
    completed = [
        data for event, data in _sse_events(response) if event == "complete"
    ]
    assert len(completed) == 1
    value = completed[0]["optimized_prompt"]
    assert isinstance(value, str)
    return value


def _shot(
    project_id: str,
    index: int,
    *,
    duration: float = 5,
    narration: str | None = "旁白：随时喝到新鲜咖啡。",
) -> StoryboardShotCreate:
    return StoryboardShotCreate(
        project_id=project_id,
        index=index,
        title=f"镜头 {index}",
        description=f"林然完成第 {index} 段咖啡制作剧情。",
        visual_prompt=f"第 {index} 段自然晨光中景跟拍。",
        narration=narration,
        duration_seconds=duration,
        status=Status.DRAFT,
    )


def _create_project(repository: InMemoryRepository) -> str:
    project = repository.create_project(
        ProjectCreate(
            name="咖啡机广告",
            brief=BriefCreate(
                prompt="生成便携咖啡机通勤广告",
                product_name="便携咖啡机",
                target_platform="douyin",
                aspect_ratio="9:16",
                duration_seconds=20,
                style="自然晨光",
                audience="通勤白领",
            ),
        )
    )
    return project.id


@contextmanager
def _client_with_generation(
    repository: InMemoryRepository,
    generation: ModelArkGenerationService,
):
    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_modelark_generation_service] = lambda: generation
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


class CapturingOptimizationAdapter:
    def __init__(self) -> None:
        self.requests: list[VideoPromptOptimizationRequest] = []

    async def optimize_video_prompt(self, request: VideoPromptOptimizationRequest):
        self.requests.append(request)
        return SimpleNamespace(optimized_prompt=request.baseline_prompt)


class InvalidOptimizationAdapter:
    def __init__(self, optimized_prompt: str) -> None:
        self.optimized_prompt = optimized_prompt
        self.calls = 0

    async def optimize_video_prompt(self, request: VideoPromptOptimizationRequest):
        _ = request
        self.calls += 1
        return SimpleNamespace(optimized_prompt=self.optimized_prompt)


def test_optimize_request_strips_blank_draft_and_limits_length() -> None:
    assert StoryboardShotVideoPromptOptimizeRequest(
        video_prompt="  "
    ).video_prompt is None
    assert StoryboardShotVideoPromptOptimizeRequest(
        video_prompt="  draft  "
    ).video_prompt == "draft"

    with pytest.raises(ValueError):
        StoryboardShotVideoPromptOptimizeRequest(video_prompt="x" * 12_001)


def test_optimize_api_uses_effective_prompt_without_persisting() -> None:
    repository = InMemoryRepository()
    project_id = _create_project(repository)
    shot = repository.replace_project_storyboard(
        project_id,
        [_shot(project_id, 1)],
    )[0]
    before = repository.get_project(project_id).model_dump(mode="json")

    with _client_with_generation(
        repository,
        ModelArkGenerationService(adapter=MockModelArkAdapter()),
    ) as client:
        response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shot.id}/"
            "optimize-video-prompt",
            json={"video_prompt": "   "},
        )

    assert response.status_code == 200
    optimized = _optimized_prompt(response)
    assert "优化增强" in optimized
    assert extract_timeline_ranges(optimized) == [(0.0, 5.0)]
    assert "林然完成第 1 段咖啡制作剧情。" in optimized
    assert "随时喝到新鲜咖啡。" in optimized
    assert repository.get_project(project_id).model_dump(mode="json") == before


def test_optimize_service_builds_numbered_context_without_asset_urls() -> None:
    adapter = CapturingOptimizationAdapter()
    service = ModelArkGenerationService(adapter=adapter)
    secret_url = "https://tos.example/object?X-Tos-Signature=secret"
    shot_data = _shot("project-1", 1).model_dump()
    shot_data.update(
        {
            "first_frame_source_video_asset_id": secret_url,
            "reference_image_asset_ids": [secret_url, "image-2"],
            "reference_video_asset_ids": ["video-1"],
            "reference_audio_asset_ids": ["audio-1"],
        }
    )
    shot = StoryboardShot(**shot_data)

    optimized = asyncio.run(
        service.optimize_storyboard_shot_video_prompt(
            "project-1",
            Brief(
                prompt="生成咖啡机广告",
                summary="突出便携",
                selling_points=["快速", "轻量"],
            ),
            shot,
            "当前草稿：参考图1保持人物一致。",
        )
    )

    request = adapter.requests[0]
    assert request.video_prompt == "当前草稿：参考图1保持人物一致。"
    assert request.uses_first_frame is True
    assert request.uses_previous_shot_last_frame is True
    assert request.reference_asset_labels == [
        "(参考@图1)",
        "(参考@图2)",
        "(参考@视频1)",
        "(参考@音频1)",
    ]
    serialized = request.model_dump_json()
    assert "X-Tos-Signature" not in serialized
    assert secret_url not in serialized
    assert "(参考@图2)" in serialized
    assert optimized != request.video_prompt
    assert optimized == request.baseline_prompt


def test_optimize_service_adds_visible_enhancement_when_model_returns_same_prompt() -> None:
    adapter = CapturingOptimizationAdapter()
    service = ModelArkGenerationService(adapter=adapter)
    shot = StoryboardShot(**_shot("project-1", 1).model_dump())
    current_prompt = shot.effective_video_prompt

    optimized = asyncio.run(
        service.optimize_storyboard_shot_video_prompt(
            "project-1",
            Brief(prompt="生成咖啡机广告"),
            shot,
            current_prompt,
        )
    )

    assert optimized != current_prompt
    assert "优化增强" in optimized
    assert extract_timeline_ranges(optimized) == [(0.0, 5.0)]


def test_optimize_service_rejects_output_that_drops_draft_reference_token() -> None:
    shot = StoryboardShot(
        **{
            **_shot("project-1", 1).model_dump(),
            "reference_image_asset_ids": ["image-1"],
        }
    )
    baseline = build_single_shot_video_prompt(shot)
    adapter = InvalidOptimizationAdapter(baseline)
    service = ModelArkGenerationService(adapter=adapter)

    with pytest.raises(
        ModelArkTextParseError,
        match="optimization output failed validation",
    ):
        asyncio.run(
            service.optimize_storyboard_shot_video_prompt(
                "project-1",
                Brief(prompt="生成咖啡机广告"),
                shot,
                baseline + "\n(参考@图1) 保持人物造型一致。",
            )
        )

    assert adapter.calls == 1


def test_english_optimize_service_uses_english_baseline_and_fallback() -> None:
    adapter = CapturingOptimizationAdapter()
    service = ModelArkGenerationService(adapter=adapter)
    shot = StoryboardShot(**_shot("project-1", 1).model_dump())
    brief = Brief(
        prompt="Create a coffee maker ad.",
        target_language=TargetLanguage.EN,
    )

    optimized = asyncio.run(
        service.optimize_storyboard_shot_video_prompt(
            "project-1",
            brief,
            shot,
            None,
        )
    )

    request = adapter.requests[0]
    assert request.video_prompt == request.baseline_prompt
    assert "[Overall Requirements]" in request.baseline_prompt
    assert "Generate natural, clear English speech" in request.baseline_prompt
    assert "Optimization enhancement:" in optimized
    assert extract_timeline_ranges(
        optimized,
        target_language="en",
    ) == [(0.0, 5.0)]
    assert "【整体要求】" not in optimized


def test_english_batch_video_generation_normalizes_prompt_and_metadata() -> None:
    service = ModelArkGenerationService(adapter=MockModelArkAdapter())
    shot = _shot("project-1", 1).model_copy(
        update={"video_prompt": "Use a controlled push-in."}
    )

    result = asyncio.run(
        service.generate_video_assets(
            "project-1",
            Brief(
                prompt="Create a coffee maker ad.",
                target_language=TargetLanguage.EN,
                aspect_ratio="16:9",
            ),
            [shot],
        )
    )

    prompt = result.assets[0].metadata["motion_prompt"]
    assert "[Overall Requirements]" in prompt
    assert "Creative intent: Use a controlled push-in." in prompt
    assert "Generate natural, clear English speech" in prompt
    assert result.assets[0].metadata["aspect_ratio"] == "16:9"


def test_optimize_merged_shot_preserves_all_atomic_ranges() -> None:
    repository = InMemoryRepository()
    project_id = _create_project(repository)
    shots = repository.replace_project_storyboard(
        project_id,
        [
            _shot(project_id, 1, duration=3),
            _shot(project_id, 2, duration=4),
        ],
    )
    merged = repository.merge_storyboard_shots(
        project_id,
        [shot.id for shot in shots],
    )

    with _client_with_generation(
        repository,
        ModelArkGenerationService(adapter=MockModelArkAdapter()),
    ) as client:
        response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{merged.id}/"
            "optimize-video-prompt",
            json={"video_prompt": merged.effective_video_prompt},
        )

    assert response.status_code == 200
    optimized = _optimized_prompt(response)
    assert extract_timeline_ranges(optimized) == [(0.0, 3.0), (3.0, 7.0)]
    assert optimized.index("第 1 段咖啡制作剧情") < optimized.index(
        "第 2 段咖啡制作剧情"
    )


@pytest.mark.parametrize(
    "invalid_prompt",
    [
        "",
        "【整体要求】\n缺少其他章节",
        build_single_shot_video_prompt(_shot("project-1", 1)).replace(
            "[0s-5s]",
            "[0s-6s]",
        ),
        build_single_shot_video_prompt(_shot("project-1", 1))
        + "\n参考图1用于人物一致性。",
        "x" * 12_001,
    ],
)
def test_invalid_optimization_output_fails_without_side_effects(
    invalid_prompt: str,
) -> None:
    repository = InMemoryRepository()
    project_id = _create_project(repository)
    shot = repository.replace_project_storyboard(
        project_id,
        [_shot(project_id, 1)],
    )[0]
    before = repository.get_project(project_id).model_dump(mode="json")
    adapter = InvalidOptimizationAdapter(invalid_prompt)

    with _client_with_generation(
        repository,
        ModelArkGenerationService(adapter=adapter),
    ) as client:
        response = client.post(
            f"/api/projects/{project_id}/storyboard/shots/{shot.id}/"
            "optimize-video-prompt",
            json={"video_prompt": "需要优化的草稿"},
        )

    assert response.status_code == 200
    errors = [data for event, data in _sse_events(response) if event == "error"]
    assert errors == [{
        "code": "generation_failed",
        "message": "storyboard video prompt optimization failed",
        "detail": "provider_code=UnknownProviderError",
    }]
    assert adapter.calls == 1
    assert repository.get_project(project_id).model_dump(mode="json") == before


def test_missing_project_or_shot_does_not_call_model() -> None:
    repository = InMemoryRepository()
    project_id = _create_project(repository)
    adapter = InvalidOptimizationAdapter("unused")

    with _client_with_generation(
        repository,
        ModelArkGenerationService(adapter=adapter),
    ) as client:
        missing_project = client.post(
            "/api/projects/missing/storyboard/shots/missing/"
            "optimize-video-prompt",
            json={"video_prompt": None},
        )
        missing_shot = client.post(
            f"/api/projects/{project_id}/storyboard/shots/missing/"
            "optimize-video-prompt",
            json={"video_prompt": None},
        )

    assert missing_project.status_code == 404
    assert missing_shot.status_code == 404
    assert missing_project.json()["detail"]["code"] == "not_found"
    assert missing_shot.json()["detail"]["code"] == "not_found"
    assert adapter.calls == 0
