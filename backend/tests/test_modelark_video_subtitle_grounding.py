from __future__ import annotations

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from backend.app.core.config import Settings
from backend.app.schemas.video_subtitle_grounding import (
    VideoSubtitleGroundingErrorCode,
    VideoSubtitleGroundingErrorPhase,
)
from backend.app.services.modelark_video_subtitle_grounding import (
    VIDEO_SUBTITLE_GROUNDING_JSON_SCHEMA,
    VIDEO_SUBTITLE_GROUNDING_PROMPT,
    ModelArkVideoSubtitleGroundingAdapter,
    VideoSubtitleGroundingProviderError,
)


class FakeFilesClient:
    def __init__(
        self,
        *,
        create_result: object | Exception,
        retrieve_results: list[object | Exception] | None = None,
        delete_result: object | Exception = None,
    ) -> None:
        self.create_result = create_result
        self.retrieve_results = list(retrieve_results or [])
        self.delete_result = delete_result
        self.create_calls: list[dict[str, object]] = []
        self.retrieve_calls: list[tuple[str, dict[str, object]]] = []
        self.delete_calls: list[tuple[str, dict[str, object]]] = []

    def create(self, **kwargs: object) -> object:
        self.create_calls.append(kwargs)
        return self._resolve(self.create_result)

    def retrieve(self, file_id: str, **kwargs: object) -> object:
        self.retrieve_calls.append((file_id, kwargs))
        if not self.retrieve_results:
            raise AssertionError("unexpected files.retrieve call")
        return self._resolve(self.retrieve_results.pop(0))

    def delete(self, file_id: str, **kwargs: object) -> object:
        self.delete_calls.append((file_id, kwargs))
        return self._resolve(self.delete_result)

    @staticmethod
    def _resolve(value: object | Exception) -> object:
        if isinstance(value, Exception):
            raise value
        return value


class FakeRawResponse:
    def __init__(
        self,
        payload: object,
        *,
        headers: dict[str, str] | None = None,
    ) -> None:
        self._payload = payload
        self.headers = headers or {}

    def json(self) -> object:
        return self._payload


class FakeResponsesClient:
    def __init__(self, result: object | BaseException) -> None:
        self.result = result
        self.calls: list[dict[str, object]] = []
        self.with_raw_response = SimpleNamespace(create=self.create)

    def create(self, **kwargs: object) -> object:
        self.calls.append(kwargs)
        if isinstance(self.result, BaseException):
            raise self.result
        return self.result


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "video_subtitle_grounding_model": "doubao-seed-evolving",
        "video_subtitle_grounding_file_processing_timeout_seconds": 10,
        "video_subtitle_grounding_model_timeout_seconds": 20,
        "video_subtitle_grounding_max_output_tokens": 4096,
    }
    values.update(overrides)
    return Settings(**values)


def _payload(subtitles: list[dict[str, object]] | None = None) -> dict[str, object]:
    return {
        "output": [
            {
                "type": "message",
                "content": [
                    {
                        "type": "output_text",
                        "text": json.dumps(
                            {
                                "subtitles": subtitles
                                if subtitles is not None
                                else [
                                    {
                                        "text": "Example subtitle",
                                        "start_ms": 1200,
                                        "end_ms": 2600,
                                        "bbox": "<bbox>120 820 880 920</bbox>",
                                        "visual_role": "body",
                                        "font_height_ratio": 0.05,
                                        "alignment": "center",
                                        "block_id": "block_0",
                                        "line_index": 0,
                                    }
                                ]
                            }
                        ),
                    }
                ],
            }
        ],
        "usage": {
            "input_tokens": 101,
            "output_tokens": 32,
            "total_tokens": 133,
        },
    }


def _adapter(
    *,
    files: FakeFilesClient,
    response: object | BaseException,
    settings: Settings | None = None,
    clock=None,
) -> tuple[ModelArkVideoSubtitleGroundingAdapter, FakeResponsesClient]:
    async def no_sleep(_seconds: float) -> None:
        return None

    responses = FakeResponsesClient(response)
    client = SimpleNamespace(files=files, responses=responses)
    return (
        ModelArkVideoSubtitleGroundingAdapter(
            settings=settings or _settings(),
            client=client,
            poll_interval_seconds=0,
            sleep=no_sleep,
            clock=clock,
        ),
        responses,
    )


def test_ground_subtitles_uploads_waits_calls_responses_and_deletes(
    tmp_path: Path,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-1", status="processing"),
        retrieve_results=[SimpleNamespace(id="file-1", status="active")],
    )
    adapter, responses = _adapter(
        files=files,
        response=FakeRawResponse(
            _payload(),
            headers={"x-request-id": "request-safe-123"},
        ),
    )

    result = asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.5))

    assert result.model == "doubao-seed-evolving"
    assert result.subtitles[0].bbox == "<bbox>120 820 880 920</bbox>"
    assert result.usage.total_tokens == 133
    assert result.request_id == "request-safe-123"
    assert result.cleanup_error is None
    assert files.create_calls[0]["purpose"] == "user_data"
    assert files.create_calls[0]["preprocess_configs"] == {
        "video": {
            "model": "doubao-seed-evolving",
            "fps": 2.5,
        }
    }
    uploaded_file = files.create_calls[0]["file"]
    assert getattr(uploaded_file, "name", "").endswith("input.mp4")
    assert getattr(uploaded_file, "closed", False) is True
    assert files.retrieve_calls == [("file-1", {"timeout": 10.0})]
    assert files.delete_calls == [("file-1", {"timeout": 20.0})]

    call = responses.calls[0]
    assert call["model"] == "doubao-seed-evolving"
    assert call["thinking"] == {"type": "disabled"}
    assert call["temperature"] == 0
    assert call["max_output_tokens"] == 4096
    assert call["timeout"] == 20.0
    assert call["text"] == {"format": VIDEO_SUBTITLE_GROUNDING_JSON_SCHEMA}
    assert call["input"] == [
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": VIDEO_SUBTITLE_GROUNDING_PROMPT},
                {"type": "input_video", "file_id": "file-1"},
            ],
        }
    ]


def test_prompt_covers_multiple_labels_across_the_full_frame() -> None:
    assert "逐帧检查整个视频画面" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "同一画面存在多个产品或部件标签时" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "每个独立文字区域分别返回一条结果" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "画面顶部、底部、四角、中央或任意物体附近" in (
        VIDEO_SUBTITLE_GROUNDING_PROMPT
    )
    assert "商品包装上的印刷文字" in VIDEO_SUBTITLE_GROUNDING_PROMPT


def test_prompt_requires_each_visual_text_line_as_a_separate_subtitle() -> None:
    assert "必须严格按视觉行拆分" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "每一行分别输出为一条独立字幕" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "对应单行文字区域的独立 bbox" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "禁止在 text 字段中使用换行符" in VIDEO_SUBTITLE_GROUNDING_PROMPT


def test_prompt_requires_visual_role_size_alignment_and_line_grouping() -> None:
    assert "headline、body 或 footnote" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "font_height_ratio" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "不得因为文字较小而忽略" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "同一视觉文字块共享 block_id" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "顺序设置从 0 开始的 line_index" in VIDEO_SUBTITLE_GROUNDING_PROMPT


def test_json_schema_requires_nullable_style_keys() -> None:
    subtitle_schema = (
        VIDEO_SUBTITLE_GROUNDING_JSON_SCHEMA["schema"]["properties"]
        ["subtitles"]["items"]
    )

    assert set(subtitle_schema["required"]) == {
        "text",
        "start_ms",
        "end_ms",
        "bbox",
        "visual_role",
        "font_height_ratio",
        "alignment",
        "block_id",
        "line_index",
        "background_color",
    }
    assert subtitle_schema["properties"]["visual_role"]["anyOf"] == [
        {"type": "string", "enum": ["headline", "body", "footnote"]},
        {"type": "null"},
    ]
    assert subtitle_schema["properties"]["font_height_ratio"]["anyOf"] == [
        {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
        {"type": "null"},
    ]
    assert subtitle_schema["properties"]["background_color"]["anyOf"] == [
        {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
        {"type": "null"},
    ]
    assert subtitle_schema["additionalProperties"] is False
    assert VIDEO_SUBTITLE_GROUNDING_JSON_SCHEMA["strict"] is True


def test_prompt_estimates_scene_background_excluding_text_and_outlines() -> None:
    assert "background_color" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "#RRGGBB" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "排除文字字形和描边" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "不是文字颜色" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "不是待绘制的字幕底板颜色" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "背景变化时取代表值" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "复杂或无法可靠估计时返回 null" in VIDEO_SUBTITLE_GROUNDING_PROMPT


@pytest.mark.parametrize(
    "color", ["#FAFAFA", "#123abc", None, "invalid", 42, [], {"bad": True}],
)
def test_adapter_passes_untrusted_background_to_tolerant_validation(
    tmp_path: Path, color: object,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-color", status="active")
    )
    adapter, _ = _adapter(
        files=files,
        response=FakeRawResponse(_payload([{
            "text": "label", "start_ms": 10, "end_ms": 20,
            "bbox": "<bbox>100 800 900 840</bbox>", "background_color": color,
        }])),
    )

    result = asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))

    assert result.subtitles[0].background_color == color
    assert files.create_calls[0]["preprocess_configs"]["video"]["fps"] == 2.0
    assert files.delete_calls[0][0] == "file-color"


def test_ground_subtitles_accepts_empty_results_and_sdk_objects(
    tmp_path: Path,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-empty", status="active")
    )
    sdk_response = SimpleNamespace(
        request_id="request-sdk-1",
        output=[
            SimpleNamespace(
                content=[
                    SimpleNamespace(
                        text=json.dumps({"subtitles": []}),
                    )
                ]
            )
        ],
        usage=SimpleNamespace(
            input_tokens=7,
            output_tokens=3,
            total_tokens=10,
        ),
    )
    adapter, _ = _adapter(files=files, response=sdk_response)

    result = asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))

    assert result.subtitles == ()
    assert result.usage.input_tokens == 7
    assert result.request_id == "request-sdk-1"
    assert files.delete_calls[0][0] == "file-empty"


def test_ground_subtitles_maps_upload_failure_without_cleanup(
    tmp_path: Path,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(create_result=RuntimeError("secret upload body"))
    adapter, responses = _adapter(files=files, response=FakeRawResponse(_payload()))

    with pytest.raises(VideoSubtitleGroundingProviderError) as exc_info:
        asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))

    error = exc_info.value
    assert error.code == VideoSubtitleGroundingErrorCode.MODEL_FILE_UPLOAD_FAILED
    assert error.phase == VideoSubtitleGroundingErrorPhase.FILES_UPLOAD
    assert "secret upload body" not in str(error)
    assert responses.calls == []
    assert files.delete_calls == []


def test_ground_subtitles_maps_processing_failure_and_cleans_up(
    tmp_path: Path,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-failed", status="processing"),
        retrieve_results=[
            SimpleNamespace(
                id="file-failed",
                status="failed",
                error=SimpleNamespace(code="InvalidVideo"),
            )
        ],
    )
    adapter, responses = _adapter(files=files, response=FakeRawResponse(_payload()))

    with pytest.raises(VideoSubtitleGroundingProviderError) as exc_info:
        asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))

    error = exc_info.value
    assert error.code == VideoSubtitleGroundingErrorCode.MODEL_FILE_PROCESSING_FAILED
    assert error.phase == VideoSubtitleGroundingErrorPhase.FILES_PROCESSING
    assert error.provider_code == "InvalidVideo"
    assert responses.calls == []
    assert files.delete_calls[0][0] == "file-failed"


def test_ground_subtitles_maps_processing_timeout_and_cleans_up(
    tmp_path: Path,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-timeout", status="processing"),
        retrieve_results=[SimpleNamespace(id="file-timeout", status="processing")],
    )
    times = iter([0.0, 0.0, 11.0])
    adapter, _ = _adapter(
        files=files,
        response=FakeRawResponse(_payload()),
        clock=lambda: next(times),
    )

    with pytest.raises(VideoSubtitleGroundingProviderError) as exc_info:
        asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))

    assert exc_info.value.phase == VideoSubtitleGroundingErrorPhase.FILES_PROCESSING
    assert exc_info.value.provider_code == "TimeoutError"
    assert files.delete_calls[0][0] == "file-timeout"


def test_ground_subtitles_maps_responses_timeout_and_cleans_up(
    tmp_path: Path,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-response", status="active")
    )
    adapter, _ = _adapter(files=files, response=TimeoutError("secret timeout"))

    with pytest.raises(VideoSubtitleGroundingProviderError) as exc_info:
        asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))

    error = exc_info.value
    assert error.code == VideoSubtitleGroundingErrorCode.MODEL_REQUEST_FAILED
    assert error.phase == VideoSubtitleGroundingErrorPhase.RESPONSES
    assert error.provider_code == "TimeoutError"
    assert files.delete_calls[0][0] == "file-response"


def test_ground_subtitles_maps_responses_failure_without_raw_details(
    tmp_path: Path,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-response-failed", status="active")
    )
    adapter, _ = _adapter(
        files=files,
        response=RuntimeError("secret provider response"),
    )

    with pytest.raises(VideoSubtitleGroundingProviderError) as exc_info:
        asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))

    error = exc_info.value
    assert error.code == VideoSubtitleGroundingErrorCode.MODEL_REQUEST_FAILED
    assert error.phase == VideoSubtitleGroundingErrorPhase.RESPONSES
    assert error.provider_code == "RuntimeError"
    assert "secret provider response" not in str(error)
    assert files.delete_calls[0][0] == "file-response-failed"


def test_ground_subtitles_cleans_up_after_cancellation(tmp_path: Path) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-cancelled", status="active")
    )
    adapter, _ = _adapter(files=files, response=asyncio.CancelledError())

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))

    assert files.delete_calls[0][0] == "file-cancelled"


def test_ground_subtitles_carries_untrusted_style_values_to_validation(
    tmp_path: Path,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-style", status="active")
    )
    adapter, _ = _adapter(
        files=files,
        response=FakeRawResponse(
            _payload(
                [
                    {
                        "text": "small note",
                        "start_ms": 10,
                        "end_ms": 20,
                        "bbox": "<bbox>100 800 900 840</bbox>",
                        "visual_role": "unexpected",
                        "font_height_ratio": "bad",
                        "alignment": 42,
                        "block_id": None,
                        "line_index": -1,
                    }
                ]
            )
        ),
    )

    result = asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))
    segment = result.subtitles[0]

    assert segment.visual_role == "unexpected"
    assert segment.font_height_ratio == "bad"
    assert segment.alignment == 42
    assert segment.block_id is None
    assert segment.line_index == -1


def test_ground_subtitles_accepts_legacy_subtitle_without_style_keys(
    tmp_path: Path,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-legacy", status="active")
    )
    adapter, _ = _adapter(
        files=files,
        response=FakeRawResponse(
            _payload(
                [
                    {
                        "text": "legacy",
                        "start_ms": 10,
                        "end_ms": 20,
                        "bbox": "<bbox>100 800 900 840</bbox>",
                    }
                ]
            )
        ),
    )

    result = asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))

    assert result.subtitles[0].visual_role is None
    assert result.subtitles[0].font_height_ratio is None
    assert result.subtitles[0].background_color is None


def test_ground_subtitles_carries_invalid_core_value_to_validation(
    tmp_path: Path,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-invalid-core", status="active")
    )
    adapter, _ = _adapter(
        files=files,
        response=FakeRawResponse(
            _payload(
                [
                    {
                        "text": "bad bbox",
                        "start_ms": 0,
                        "end_ms": 1,
                        "bbox": "120,820,880,920",
                    }
                ]
            )
        ),
    )

    result = asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))

    assert result.subtitles[0].bbox == "120,820,880,920"


@pytest.mark.parametrize(
    "output_text",
    [
        '```json\n{"subtitles": []}\n```',
        '{"subtitles":[],"unexpected":true}',
        '{"subtitles":[{"unexpected":true}]}',
    ],
)
def test_ground_subtitles_rejects_invalid_json_or_schema(
    tmp_path: Path,
    output_text: str,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-invalid", status="active")
    )
    payload = _payload()
    payload["output"][0]["content"][0]["text"] = output_text  # type: ignore[index]
    adapter, _ = _adapter(files=files, response=FakeRawResponse(payload))

    with pytest.raises(VideoSubtitleGroundingProviderError) as exc_info:
        asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))

    error = exc_info.value
    assert error.code == VideoSubtitleGroundingErrorCode.INVALID_MODEL_OUTPUT
    assert error.phase == VideoSubtitleGroundingErrorPhase.RESPONSE_VALIDATION
    assert output_text not in str(error)
    assert files.delete_calls[0][0] == "file-invalid"


def test_ground_subtitles_keeps_cleanup_failure_best_effort(
    tmp_path: Path,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-cleanup", status="active"),
        delete_result=RuntimeError("secret delete response"),
    )
    adapter, _ = _adapter(
        files=files,
        response=FakeRawResponse(_payload(), headers={"x-tt-logid": "log-safe-1"}),
    )

    result = asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))

    assert result.request_id == "log-safe-1"
    assert result.cleanup_error is not None
    assert result.cleanup_error.code == VideoSubtitleGroundingErrorCode.CLEANUP_FAILED
    assert result.cleanup_error.phase == VideoSubtitleGroundingErrorPhase.CLEANUP
    assert "secret delete response" not in str(result.cleanup_error)


def test_ground_subtitles_attaches_cleanup_failure_to_primary_error(
    tmp_path: Path,
) -> None:
    video_path = tmp_path / "input.mp4"
    video_path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-double-failure", status="active"),
        delete_result=RuntimeError("secret delete response"),
    )
    adapter, _ = _adapter(
        files=files,
        response=RuntimeError("secret responses body"),
    )

    with pytest.raises(VideoSubtitleGroundingProviderError) as exc_info:
        asyncio.run(adapter.ground_subtitles(video_path, sampling_fps=2.0))

    error = exc_info.value
    assert error.phase == VideoSubtitleGroundingErrorPhase.RESPONSES
    assert error.cleanup_error is not None
    assert error.cleanup_error.phase == VideoSubtitleGroundingErrorPhase.CLEANUP
