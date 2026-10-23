# Video Subtitle Style Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the video subtitle grounding experiment with normalized visual-role, font-height, alignment, and multiline grouping metadata without letting malformed style metadata discard valid subtitle text.

**Architecture:** The Provider JSON Schema remains strict as a generation constraint, while the application adapter validates only the top-level envelope and carries every segment field as an untrusted optional value. The validation layer owns core-field authority, style normalization, segment filtering, coordinate conversion, and validation statistics; the service serializes the normalized response and emits only aggregate counters. Existing Files API, media probing, security, and coordinate conversion boundaries remain unchanged.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, pytest, Ruff, ModelArk Responses API with strict JSON Schema

---

## File Map

- Modify `backend/app/schemas/video_subtitle_grounding.py`
  - Define public style enums and normalized response fields.
- Modify `backend/app/services/modelark_video_subtitle_grounding.py`
  - Extend the prompt and Provider JSON Schema.
  - Carry untrusted style values from the Provider boundary to validation.
- Modify `backend/app/services/video_subtitle_grounding_validation.py`
  - Validate core fields, normalize style fields, filter invalid segments, and return aggregate validation statistics.
- Modify `backend/app/services/video_subtitle_grounding.py`
  - Consume the richer validation result and log only aggregate fallback counts.
- Modify `backend/tests/test_video_subtitle_grounding_contract.py`
  - Lock down public response serialization and backwards-compatible defaults.
- Modify `backend/tests/test_modelark_video_subtitle_grounding.py`
  - Lock down prompt, JSON Schema, style-value transport, and legacy response parsing.
- Modify `backend/tests/test_video_subtitle_grounding_validation.py`
  - Cover style normalization, multiline grouping, and segment-level core-field tolerance.
- Modify `backend/tests/test_video_subtitle_grounding_service.py`
  - Cover aggregate logging and response propagation.
- Modify `backend/tests/test_paid_modelark_video_subtitle_grounding_smoke.py`
  - Validate style metadata without exposing subtitle text.
- Modify `.trae/specs/validate-seed-video-subtitle-grounding/validation.md`
  - Record non-paid verification and the separately authorized real-model result.

## Task 1: Public Style Response Contract

**Files:**
- Modify: `backend/app/schemas/video_subtitle_grounding.py:1-103`
- Test: `backend/tests/test_video_subtitle_grounding_contract.py`

- [ ] **Step 1: Write failing response-contract tests**

Add imports for the new enums and update `_response_payload()` so its subtitle contains:

```python
"visual_role": "headline",
"font_height_ratio": 0.062,
"alignment": "center",
"block_id": "block_07",
"line_index": 0,
```

Add these tests:

```python
def test_response_contract_preserves_normalized_style_metadata() -> None:
    response = VideoSubtitleGroundingResponse.model_validate(_response_payload())
    subtitle = response.subtitles[0]

    assert subtitle.visual_role == VideoSubtitleVisualRole.HEADLINE
    assert subtitle.font_height_ratio == 0.062
    assert subtitle.alignment == VideoSubtitleAlignment.CENTER
    assert subtitle.block_id == "block_07"
    assert subtitle.line_index == 0


def test_response_contract_backfills_legacy_style_metadata() -> None:
    payload = _response_payload()
    subtitle = payload["subtitles"][0]  # type: ignore[index]
    assert isinstance(subtitle, dict)
    for field in (
        "visual_role",
        "font_height_ratio",
        "alignment",
        "block_id",
        "line_index",
    ):
        subtitle.pop(field)

    response = VideoSubtitleGroundingResponse.model_validate(payload)

    assert response.subtitles[0].visual_role == VideoSubtitleVisualRole.BODY
    assert response.subtitles[0].font_height_ratio == 0.1
    assert response.subtitles[0].alignment == VideoSubtitleAlignment.CENTER
    assert response.subtitles[0].block_id == "legacy"
    assert response.subtitles[0].line_index == 0
```

The legacy default is only a deserialization compatibility path. Runtime extraction will
replace it with BBox-derived values in Task 3.

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_video_subtitle_grounding_contract.py -q
```

Expected: FAIL because `VideoSubtitleVisualRole`, `VideoSubtitleAlignment`, and the five
response fields do not exist.

- [ ] **Step 3: Add enums and normalized response fields**

Add:

```python
class VideoSubtitleVisualRole(StrEnum):
    HEADLINE = "headline"
    BODY = "body"
    FOOTNOTE = "footnote"


class VideoSubtitleAlignment(StrEnum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"
```

Extend `VideoSubtitleGroundingSubtitle`:

```python
class VideoSubtitleGroundingSubtitle(SchemaModel):
    text: str = Field(min_length=1, max_length=VIDEO_SUBTITLE_GROUNDING_MAX_TEXT_LENGTH)
    start_ms: StrictInt = Field(ge=0)
    end_ms: StrictInt = Field(gt=0)
    bbox_normalized: NormalizedBoundingBox
    bbox_pixels: PixelBoundingBox
    visual_role: VideoSubtitleVisualRole = VideoSubtitleVisualRole.BODY
    font_height_ratio: float = Field(default=0.1, gt=0, le=1, allow_inf_nan=False)
    alignment: VideoSubtitleAlignment = VideoSubtitleAlignment.CENTER
    block_id: str = Field(default="legacy", min_length=1, max_length=64)
    line_index: StrictInt = Field(default=0, ge=0)
```

Keep the existing text and positive-area validators unchanged.

- [ ] **Step 4: Run contract tests**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_video_subtitle_grounding_contract.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit the public contract**

```bash
git add \
  backend/app/schemas/video_subtitle_grounding.py \
  backend/tests/test_video_subtitle_grounding_contract.py
git commit -m "feat(subtitles): add normalized style response fields"
```

## Task 2: ModelArk Prompt and Provider Contract

**Files:**
- Modify: `backend/app/services/modelark_video_subtitle_grounding.py:20-116`
- Modify: `backend/app/services/modelark_video_subtitle_grounding.py:337-384`
- Test: `backend/tests/test_modelark_video_subtitle_grounding.py`

- [ ] **Step 1: Extend the test payload helper**

Change the default subtitle in `_payload()` to:

```python
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
```

Do not force custom test payloads to include style keys; tests with historical payloads must
continue to parse.

- [ ] **Step 2: Write failing prompt and JSON Schema tests**

Add:

```python
def test_prompt_requires_visual_role_size_alignment_and_line_grouping() -> None:
    assert "headline、body 或 footnote" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "font_height_ratio" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "不得因为文字较小而忽略" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "同一视觉文字块共享 block_id" in VIDEO_SUBTITLE_GROUNDING_PROMPT
    assert "按从上到下顺序设置 line_index" in VIDEO_SUBTITLE_GROUNDING_PROMPT


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
    }
    assert subtitle_schema["properties"]["visual_role"]["anyOf"] == [
        {"type": "string", "enum": ["headline", "body", "footnote"]},
        {"type": "null"},
    ]
    assert subtitle_schema["properties"]["font_height_ratio"]["anyOf"] == [
        {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
        {"type": "null"},
    ]
```

- [ ] **Step 3: Write failing transport and legacy tests**

Add:

```python
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
```

- [ ] **Step 4: Move per-segment rejection expectations to validation tests**

In `test_ground_subtitles_rejects_invalid_json_or_schema`, retain only invalid JSON,
Markdown fences, invalid top-level shape, unknown top-level fields, and unknown subtitle
fields. Remove the case that expects a malformed `bbox` value to fail inside the adapter.
Add this transport assertion instead:

```python
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
```

- [ ] **Step 5: Run adapter tests and verify failure**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_modelark_video_subtitle_grounding.py -q
```

Expected: FAIL because the prompt, JSON Schema, payload model, and dataclass do not expose
style metadata.

- [ ] **Step 6: Extend the prompt and JSON Schema**

Append requirements to `VIDEO_SUBTITLE_GROUNDING_PROMPT`:

```python
"不得因为文字较小而忽略符合目标定义的小号说明或脚注。"
"每条字幕还必须输出 visual_role、font_height_ratio、alignment、block_id 和 "
"line_index。visual_role 根据相对视觉字号只能是 headline、body 或 footnote；"
"font_height_ratio 是可见字形高度除以视频展示高度的 0 到 1 浮点数；alignment "
"只能是 left、center 或 right。同一视觉文字块共享 block_id，多行按从上到下"
"顺序设置从 0 开始的 line_index。无法可靠判断的样式值使用 null，不得猜测"
"固定字号。"
```

Add the five properties to the subtitle JSON Schema. Use `anyOf` with the valid type and
`null`, and add all five names to `required`. For `block_id`, constrain the non-null branch:

```python
{
    "type": "string",
    "minLength": 1,
    "maxLength": 64,
    "pattern": "^[A-Za-z0-9_-]+$",
}
```

For `line_index`, use an integer minimum of zero or `null`.

- [ ] **Step 7: Make all Provider segment values tolerant at the application boundary**

Replace `_SubtitlePayload` with an envelope model that rejects unknown keys but carries
every value to the authoritative validation layer:

```python
class _SubtitlePayload(SchemaModel):
    text: object | None = None
    start_ms: object | None = None
    end_ms: object | None = None
    bbox: object | None = None
    visual_role: object | None = None
    font_height_ratio: object | None = None
    alignment: object | None = None
    block_id: object | None = None
    line_index: object | None = None
```

Change all nine fields on `ModelArkSubtitleGroundingSegment` to `object | None`, and pass
all parsed values when constructing each segment in `_parse_response()`. Do not normalize
or reject per-segment core/style values in the adapter. `_ResponsePayload` still enforces a
`subtitles` array, the 500-item limit, and `additionalProperties=False` at both object
levels.

Remove `StrictInt` from the Pydantic imports after `_SubtitlePayload` stops using it.

- [ ] **Step 8: Run adapter tests**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_modelark_video_subtitle_grounding.py -q
```

Expected: PASS.

- [ ] **Step 9: Commit the Provider contract**

```bash
git add \
  backend/app/services/modelark_video_subtitle_grounding.py \
  backend/tests/test_modelark_video_subtitle_grounding.py
git commit -m "feat(subtitles): request visual style metadata"
```

## Task 3: Style Normalization and Segment-Level Resilience

**Files:**
- Modify: `backend/app/services/video_subtitle_grounding_validation.py:1-178`
- Test: `backend/tests/test_video_subtitle_grounding_validation.py`

- [ ] **Step 1: Update test helpers for untrusted style values**

Extend `_segment()`:

```python
def _segment(
    *,
    text: object = "Example subtitle",
    start_ms: object = 1200,
    end_ms: object = 2600,
    bbox: object = "<bbox>120 820 880 920</bbox>",
    visual_role: object = "body",
    font_height_ratio: object = 0.05,
    alignment: object = "center",
    block_id: object = "block_0",
    line_index: object = 0,
) -> ModelArkSubtitleGroundingSegment:
    return ModelArkSubtitleGroundingSegment(
        text=text,  # type: ignore[arg-type]
        start_ms=start_ms,  # type: ignore[arg-type]
        end_ms=end_ms,  # type: ignore[arg-type]
        bbox=bbox,  # type: ignore[arg-type]
        visual_role=visual_role,
        font_height_ratio=font_height_ratio,
        alignment=alignment,
        block_id=block_id,
        line_index=line_index,
    )
```

Update existing tests to access `.subtitles` from the new validation result:

```python
result = validate_and_convert_subtitles(...)
subtitles = result.subtitles
```

- [ ] **Step 2: Write failing style-normalization tests**

Add:

```python
def test_preserves_valid_style_and_multiline_grouping() -> None:
    result = validate_and_convert_subtitles(
        _result(
            _segment(
                text="line one",
                visual_role="headline",
                font_height_ratio=0.062,
                alignment="left",
                block_id="block_07",
                line_index=0,
            ),
            _segment(
                text="line two",
                bbox="<bbox>120 920 880 980</bbox>",
                visual_role="footnote",
                font_height_ratio=0.03,
                alignment="left",
                block_id="block_07",
                line_index=1,
            ),
        ),
        _video(),
    )

    assert [subtitle.block_id for subtitle in result.subtitles] == [
        "block_07",
        "block_07",
    ]
    assert [subtitle.line_index for subtitle in result.subtitles] == [0, 1]
    assert result.subtitles[0].visual_role.value == "headline"
    assert result.subtitles[1].visual_role.value == "footnote"


def test_invalid_style_fields_fall_back_independently() -> None:
    result = validate_and_convert_subtitles(
        _result(
            _segment(
                bbox="<bbox>800 700 900 740</bbox>",
                visual_role="unknown",
                font_height_ratio=float("nan"),
                alignment="diagonal",
                block_id="contains space",
                line_index=-1,
            )
        ),
        _video(),
    )
    subtitle = result.subtitles[0]

    assert subtitle.visual_role.value == "body"
    assert subtitle.font_height_ratio == pytest.approx(0.04)
    assert subtitle.alignment.value == "right"
    assert subtitle.block_id == "segment_0"
    assert subtitle.line_index == 0
    assert result.stats.style_fallback_counts == {
        "visual_role": 1,
        "font_height_ratio": 1,
        "alignment": 1,
        "block_id": 1,
        "line_index": 1,
    }
```

- [ ] **Step 3: Write failing core-field resilience tests**

Replace all-or-nothing expectations for mixed results with:

```python
def test_drops_invalid_core_segment_but_keeps_valid_sibling() -> None:
    result = validate_and_convert_subtitles(
        _result(
            _segment(text="valid"),
            _segment(text="invalid\nline"),
        ),
        _video(),
    )

    assert [subtitle.text for subtitle in result.subtitles] == ["valid"]
    assert result.stats.invalid_segment_count == 1


def test_rejects_nonempty_provider_result_when_every_segment_is_invalid() -> None:
    _assert_invalid(
        _result(
            _segment(text="invalid\nline"),
            _segment(bbox="<bbox>900 820 100 920</bbox>"),
        )
    )


def test_accepts_genuinely_empty_provider_result() -> None:
    result = validate_and_convert_subtitles(_result(), _video())
    assert result.subtitles == ()
    assert result.stats.invalid_segment_count == 0
```

Retain focused `_assert_invalid()` coverage for direct helper behavior by using
all-invalid result sets. Existing coordinate, duration, deduplication, ordering, and
500-segment tests must remain.

- [ ] **Step 4: Run validation tests and verify failure**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_video_subtitle_grounding_validation.py -q
```

Expected: FAIL because validation returns a tuple, rejects the first invalid segment, and
does not normalize style fields.

- [ ] **Step 5: Add validation result and statistics types**

Add:

```python
from collections import Counter
from dataclasses import dataclass
from math import isfinite


@dataclass(frozen=True)
class VideoSubtitleGroundingValidationStats:
    invalid_segment_count: int
    style_fallback_counts: dict[str, int]


@dataclass(frozen=True)
class VideoSubtitleGroundingValidationResult:
    subtitles: tuple[VideoSubtitleGroundingSubtitle, ...]
    stats: VideoSubtitleGroundingValidationStats
```

Change `validate_and_convert_subtitles()` to return
`VideoSubtitleGroundingValidationResult`.

- [ ] **Step 6: Implement independent style normalization**

Import `VideoSubtitleAlignment` and `VideoSubtitleVisualRole`, define:

```python
_SAFE_BLOCK_ID_PATTERN = re.compile(r"[A-Za-z0-9_-]{1,64}")


def _normalize_style(
    segment: ModelArkSubtitleGroundingSegment,
    normalized: NormalizedBoundingBox,
    *,
    original_index: int,
    fallback_counts: Counter[str],
) -> tuple[
    VideoSubtitleVisualRole,
    float,
    VideoSubtitleAlignment,
    str,
    int,
]:
    role_value = getattr(segment, "visual_role", None)
    try:
        visual_role = VideoSubtitleVisualRole(role_value)
    except (TypeError, ValueError):
        visual_role = VideoSubtitleVisualRole.BODY
        fallback_counts["visual_role"] += 1

    ratio_value = getattr(segment, "font_height_ratio", None)
    if (
        isinstance(ratio_value, (int, float))
        and not isinstance(ratio_value, bool)
        and isfinite(ratio_value)
        and 0 < ratio_value <= 1
    ):
        font_height_ratio = float(ratio_value)
    else:
        font_height_ratio = (normalized[3] - normalized[1]) / 1000
        fallback_counts["font_height_ratio"] += 1

    alignment_value = getattr(segment, "alignment", None)
    try:
        alignment = VideoSubtitleAlignment(alignment_value)
    except (TypeError, ValueError):
        center_x = (normalized[0] + normalized[2]) / 2
        alignment = (
            VideoSubtitleAlignment.LEFT
            if center_x <= 350
            else VideoSubtitleAlignment.RIGHT
            if center_x >= 650
            else VideoSubtitleAlignment.CENTER
        )
        fallback_counts["alignment"] += 1

    block_value = getattr(segment, "block_id", None)
    if isinstance(block_value, str) and _SAFE_BLOCK_ID_PATTERN.fullmatch(block_value):
        block_id = block_value
    else:
        block_id = f"segment_{original_index}"
        fallback_counts["block_id"] += 1

    line_value = getattr(segment, "line_index", None)
    if _is_strict_int(line_value) and line_value >= 0:
        line_index = line_value
    else:
        line_index = 0
        fallback_counts["line_index"] += 1

    return visual_role, font_height_ratio, alignment, block_id, line_index
```

Use the returned values when constructing `VideoSubtitleGroundingSubtitle`.

- [ ] **Step 7: Implement segment-level core filtering**

In the segment loop:

```python
invalid_segment_count = 0
fallback_counts: Counter[str] = Counter()

for original_index, segment in enumerate(subtitles):
    try:
        text, start_ms, end_ms, normalized = _validate_segment(
            segment,
            duration_ms=video.duration_ms,
        )
        pixels = _to_pixel_bbox(
            normalized,
            display_width=video.display_width,
            display_height=video.display_height,
        )
    except VideoSubtitleGroundingValidationError:
        invalid_segment_count += 1
        continue

    visual_role, font_height_ratio, alignment, block_id, line_index = (
        _normalize_style(
            segment,
            normalized,
            original_index=original_index,
            fallback_counts=fallback_counts,
        )
    )
```

After the loop:

```python
if subtitles and not validated:
    raise VideoSubtitleGroundingValidationError()

return VideoSubtitleGroundingValidationResult(
    subtitles=tuple(item[2] for item in validated),
    stats=VideoSubtitleGroundingValidationStats(
        invalid_segment_count=invalid_segment_count,
        style_fallback_counts=dict(sorted(fallback_counts.items())),
    ),
)
```

Do not catch invalid video metadata, segment-count overflow, or top-level shape errors.

- [ ] **Step 8: Run validation and contract tests**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_video_subtitle_grounding_validation.py \
  backend/tests/test_video_subtitle_grounding_contract.py -q
```

Expected: PASS.

- [ ] **Step 9: Commit normalization**

```bash
git add \
  backend/app/services/video_subtitle_grounding_validation.py \
  backend/tests/test_video_subtitle_grounding_validation.py
git commit -m "feat(subtitles): normalize extracted style metadata"
```

## Task 4: Service Propagation and Safe Aggregate Logging

**Files:**
- Modify: `backend/app/services/video_subtitle_grounding.py:70-177`
- Modify: `backend/tests/test_video_subtitle_grounding_service.py`
- Test: `backend/tests/test_video_subtitle_grounding_service.py`

- [ ] **Step 1: Update Provider fixtures with valid style metadata**

Add valid style values to the default `ModelArkSubtitleGroundingSegment` returned by
`_provider_result()`:

```python
visual_role="body",
font_height_ratio=0.05,
alignment="center",
block_id="block_0",
line_index=0,
```

- [ ] **Step 2: Write a failing response and logging test**

Add:

```python
def test_service_returns_style_and_logs_only_aggregate_validation_stats(
    monkeypatch,
) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(
        service_module,
        "log_event",
        lambda _logger, event, **context: events.append((event, context)),
    )
    result = _provider_result(
        subtitles=(
            ModelArkSubtitleGroundingSegment(
                text="private subtitle",
                start_ms=1200,
                end_ms=2600,
                bbox="<bbox>120 820 880 920</bbox>",
                visual_role=None,
                font_height_ratio=None,
                alignment=None,
                block_id=None,
                line_index=None,
            ),
            ModelArkSubtitleGroundingSegment(
                text="invalid\nprivate",
                start_ms=1200,
                end_ms=2600,
                bbox="<bbox>120 820 880 920</bbox>",
            ),
        )
    )
    service = VideoSubtitleGroundingService(
        preparer=FakePreparer(),
        provider=FakeProvider(result),
        settings=Settings(enable_experimental_video_subtitle_grounding=True),
        clock=lambda: 10.0,
    )

    response = asyncio.run(
        service.run(VideoSubtitleGroundingRequest(video_url=SECRET_URL))
    )

    assert len(response.subtitles) == 1
    assert response.subtitles[0].font_height_ratio == pytest.approx(0.1)
    completed = [
        context for event, context in events if event.endswith(".completed")
    ][0]
    assert completed["invalid_segment_count"] == 1
    assert completed["style_fallback_counts"] == {
        "alignment": 1,
        "block_id": 1,
        "font_height_ratio": 1,
        "line_index": 1,
        "visual_role": 1,
    }
    assert "private subtitle" not in str(events)
    assert RAW_OUTPUT not in str(events)
```

- [ ] **Step 3: Run the service test and verify failure**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_video_subtitle_grounding_service.py \
  -q
```

Expected: FAIL because the service treats the validation result as a subtitle tuple and
does not emit aggregate validation statistics.

- [ ] **Step 4: Consume the validation result**

Replace:

```python
subtitles = validate_and_convert_subtitles(result, prepared.metadata)
```

with:

```python
validation = validate_and_convert_subtitles(result, prepared.metadata)
```

Build the response with:

```python
subtitles=list(validation.subtitles),
```

Add these fields to the completed event:

```python
invalid_segment_count=validation.stats.invalid_segment_count,
style_fallback_counts=validation.stats.style_fallback_counts,
```

Do not add subtitle text, block IDs, BBoxes, or per-item style values to logs.

- [ ] **Step 5: Run service tests**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_video_subtitle_grounding_service.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit service propagation**

```bash
git add \
  backend/app/services/video_subtitle_grounding.py \
  backend/tests/test_video_subtitle_grounding_service.py
git commit -m "feat(subtitles): log style normalization aggregates"
```

## Task 5: Smoke Assertions, Regression, and Validation Record

**Files:**
- Modify: `backend/tests/test_paid_modelark_video_subtitle_grounding_smoke.py`
- Modify: `.trae/specs/validate-seed-video-subtitle-grounding/validation.md`
- Test: all subtitle-grounding backend tests

- [ ] **Step 1: Add style checks to the paid-smoke validator**

Import `VideoSubtitleAlignment` and `VideoSubtitleVisualRole`. Inside
`_assert_smoke_response()` add:

```python
assert subtitle.visual_role in set(VideoSubtitleVisualRole)
assert 0 < subtitle.font_height_ratio <= 1
assert subtitle.alignment in set(VideoSubtitleAlignment)
assert 1 <= len(subtitle.block_id) <= 64
assert subtitle.line_index >= 0
```

Extend `_safe_summary()` with aggregate-only fields:

```python
"role_counts": {
    role.value: sum(
        subtitle.visual_role == role for subtitle in response.subtitles
    )
    for role in VideoSubtitleVisualRole
},
"multiline_block_count": sum(
    count > 1
    for count in Counter(
        subtitle.block_id for subtitle in response.subtitles
    ).values()
),
```

Import `Counter`. Do not print text, BBoxes, block IDs, the video URL, or credentials.

- [ ] **Step 2: Update the sample response and safety test**

Add style fields to `_sample_response()`:

```python
visual_role=VideoSubtitleVisualRole.FOOTNOTE,
font_height_ratio=0.03,
alignment=VideoSubtitleAlignment.CENTER,
block_id="block_0",
line_index=0,
```

Assert the rendered safe summary contains `role_counts` and still excludes
`must-not-be-printed`, `video_url`, and `api_key`.

- [ ] **Step 3: Run the complete non-paid subtitle test set**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_video_subtitle_grounding_contract.py \
  backend/tests/test_modelark_video_subtitle_grounding.py \
  backend/tests/test_video_subtitle_grounding_validation.py \
  backend/tests/test_video_subtitle_grounding_media.py \
  backend/tests/test_video_subtitle_grounding_service.py \
  backend/tests/test_paid_modelark_video_subtitle_grounding_smoke.py \
  -q
```

Expected: PASS; the real paid test is skipped unless `RUN_PAID_MODELARK_SMOKE=true`.

- [ ] **Step 4: Run backend quality gates**

Run:

```bash
.venv/bin/ruff check \
  backend/app/schemas/video_subtitle_grounding.py \
  backend/app/services/modelark_video_subtitle_grounding.py \
  backend/app/services/video_subtitle_grounding.py \
  backend/app/services/video_subtitle_grounding_validation.py \
  backend/tests/test_video_subtitle_grounding_contract.py \
  backend/tests/test_modelark_video_subtitle_grounding.py \
  backend/tests/test_video_subtitle_grounding_validation.py \
  backend/tests/test_video_subtitle_grounding_service.py \
  backend/tests/test_paid_modelark_video_subtitle_grounding_smoke.py

python -m compileall -q backend/app
git diff --check
```

Expected: all commands exit with code 0.

- [ ] **Step 5: Record non-paid verification**

Append to `.trae/specs/validate-seed-video-subtitle-grounding/validation.md`:

```markdown
## Subtitle Style Contract

- Public response now includes `visual_role`, `font_height_ratio`, `alignment`,
  `block_id`, and `line_index`.
- Invalid style values fall back independently; valid text/time/BBox data remains usable.
- Invalid core segments are counted and skipped; a non-empty all-invalid response fails.
- Legacy results without style fields receive deterministic defaults.
- Non-paid subtitle-grounding tests, Ruff, compileall, and `git diff --check` passed.
```

Replace the final line with exact test counts from Step 3.

- [ ] **Step 6: Commit tests and validation record**

```bash
git add \
  backend/tests/test_paid_modelark_video_subtitle_grounding_smoke.py \
  .trae/specs/validate-seed-video-subtitle-grounding/validation.md
git commit -m "test(subtitles): verify style extraction contract"
```

- [ ] **Step 7: Run the real-model validation only after explicit paid-call approval**

Use the existing secure environment configuration and do not place the URL or credentials
in shell history:

```bash
RUN_PAID_MODELARK_SMOKE=true \
PYTHONPATH=. \
.venv/bin/pytest \
  backend/tests/test_paid_modelark_video_subtitle_grounding_smoke.py::test_paid_modelark_video_subtitle_grounding_smoke \
  -q -s
```

Expected: PASS with a safe aggregate JSON summary containing counts and no subtitle text,
video URL, BBoxes, credentials, or Provider raw output.

- [ ] **Step 8: Record real-model observations**

After an authorized run, append the date, elapsed time, token counts, role counts, multiline
block count, and manual observations to
`.trae/specs/validate-seed-video-subtitle-grounding/validation.md`. Record OCR or
classification inaccuracies without storing the source URL, credentials, or model raw
response.

- [ ] **Step 9: Commit the authorized smoke result**

```bash
git add .trae/specs/validate-seed-video-subtitle-grounding/validation.md
git commit -m "docs(subtitles): record style extraction smoke result"
```

Skip Steps 7-9 when paid-call approval is not granted; the implementation remains complete
after Step 6.

## Final Verification

- [ ] Confirm `git diff --check` exits with code 0.
- [ ] Confirm no model raw output or subtitle text appears in stdout-focused tests.
- [ ] Confirm no `.env`, credential, video, Provider file, or generated raw-output artifact
  is staged.
- [ ] Confirm the implementation commits contain only subtitle-style-contract files.
- [ ] Confirm the public API response always returns non-null normalized style fields.
- [ ] Confirm translation and ASS rendering remain outside this implementation.
