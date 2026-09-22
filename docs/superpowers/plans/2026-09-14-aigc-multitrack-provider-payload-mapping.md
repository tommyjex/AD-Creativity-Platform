# AIGC Multi-Track Provider Payload Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert editor-native visual transforms and text styles into MediaKit's supported wire format so generated placement and appearance match the preview.

**Architecture:** Keep the persisted multi-track schema provider-neutral. Add one pure mapping helper in the gateway, call it while building each Provider element, and continue performing asset URL resolution and track reversal at the existing MediaKit boundary.

**Tech Stack:** Python 3.14, Pydantic v2, pytest, MediaKit multi-track API

---

## File Map

- Modify `backend/tests/test_aigc_gateway.py`: assert the complete Provider DTO for video, image, text, and subtitle elements while preserving task parameters.
- Modify `backend/app/services/aigc_gateway.py`: add and use a focused visual-field conversion helper.

### Task 1: Lock the MediaKit visual payload contract

**Files:**
- Modify: `backend/tests/test_aigc_gateway.py:2023-2390`
- Test: `backend/tests/test_aigc_gateway.py`

- [x] **Step 1: Add decimal transform values to the existing five-track fixture**

Use decimal coordinates, dimensions, rotation, and font size on representative
elements so the boundary rounding policy is observable:

```python
"transform": {
    "x": 100.4,
    "y": 100.6,
    "width": 600.4,
    "height": 100.6,
    "rotation": 1.6,
},
"style": {
    "font_type": "SY_Black",
    "font_size": 48.6,
    "color": "#FFFFFFFF",
    "bold": False,
    "italic": False,
    "underline": False,
    "background_color": "#00000000",
},
```

- [x] **Step 2: Assert all visual transforms use `extra`**

Add a small local assertion helper:

```python
    def assert_transform(
        provider_element: dict[str, object],
        expected: dict[str, object],
    ) -> None:
        assert provider_element["extra"] == [
            {"type": "transform", **expected}
        ]
        assert "transform" not in provider_element
```

Call it for the video, image, text, and subtitle elements. Expected transform
keys are `pos_x`, `pos_y`, `width`, `height`, and `rotation`.

- [x] **Step 3: Assert flattened text and subtitle styles**

Assert the first text element contains:

```python
{
    "font_type": "SY_Black",
    "font_size": 49,
    "font_color": "#FFFFFFFF",
    "bold": False,
    "italic": False,
    "underline": False,
    "background_color": "#00000000",
}
```

Assert the default text element omits `font_type`, and assert both text and
subtitle elements omit the internal `style` object.

- [x] **Step 4: Assert subtitle URL field and internal field cleanup**

Replace the old subtitle `source` assertion with:

```python
    assert "/subtitle-input.srt?" in provider_subtitle["text"]
    assert "source" not in provider_subtitle
```

Keep the existing checks proving `task.params` still contains the original
`transform`, `style`, and track order.

- [x] **Step 5: Run the focused test and verify it fails**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_gateway.py::test_gateway_resolves_multi_track_assets_and_uses_mock_mediakit \
  -q
```

Expected: failure because the current payload still contains nested
`transform` and `style`, uses `color`, and sends subtitle URLs through
`source`.

### Task 2: Implement the Provider DTO conversion

**Files:**
- Modify: `backend/app/services/aigc_gateway.py:2068-2122`
- Modify: `backend/app/services/aigc_gateway.py:2750-2765`
- Test: `backend/tests/test_aigc_gateway.py`

- [x] **Step 1: Add a pure visual-field mapping helper**

Add this module-level helper near the other private helpers:

```python
def _map_mediakit_visual_fields(
    rendered: dict[str, object],
    *,
    kind: str,
) -> None:
    transform = rendered.pop("transform", None)
    if isinstance(transform, dict):
        extra = rendered.setdefault("extra", [])
        if not isinstance(extra, list):
            raise ValueError("multi-track element extra filters are invalid")
        extra.append(
            {
                "type": "transform",
                "pos_x": round(float(transform["x"])),
                "pos_y": round(float(transform["y"])),
                "width": max(1, round(float(transform["width"]))),
                "height": max(1, round(float(transform["height"]))),
                "rotation": round(float(transform.get("rotation", 0))),
            }
        )

    if kind not in {"text", "subtitle"}:
        return
    style = rendered.pop("style", None)
    if not isinstance(style, dict):
        return
    font_type = style.get("font_type")
    if font_type:
        rendered["font_type"] = font_type
    rendered.update(
        {
            "font_size": max(1, round(float(style["font_size"]))),
            "font_color": style["color"],
            "bold": style["bold"],
            "italic": style["italic"],
            "underline": style["underline"],
            "background_color": style["background_color"],
        }
    )
```

- [x] **Step 2: Call the helper during Provider serialization**

Replace the existing font-only extraction block with:

```python
                _map_mediakit_visual_fields(
                    rendered,
                    kind=element.type,
                )
```

The helper runs before source URL assignment and does not mutate `element` or
`project`.

- [x] **Step 3: Map subtitle URLs to `text`**

After validating the signed asset URL, assign:

```python
                    if element.type == "subtitle":
                        rendered["text"] = access_url
                    else:
                        rendered["source"] = access_url
```

- [x] **Step 4: Run the focused test**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_gateway.py::test_gateway_resolves_multi_track_assets_and_uses_mock_mediakit \
  -q
```

Expected: `1 passed`.

### Task 3: Regression verification and service reload

**Files:**
- Verify: `backend/app/services/aigc_gateway.py`
- Verify: `backend/tests/test_aigc_gateway.py`

- [x] **Step 1: Run related backend tests**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_gateway.py \
  backend/tests/test_mediakit_multitrack.py \
  backend/tests/test_asset_multitrack_storage.py \
  -q
```

Expected: all selected tests pass.

- [x] **Step 2: Run static validation**

Run:

```bash
.venv/bin/python -m py_compile \
  backend/app/services/aigc_gateway.py \
  backend/tests/test_aigc_gateway.py
git diff --check -- \
  backend/app/services/aigc_gateway.py \
  backend/tests/test_aigc_gateway.py \
  docs/superpowers/plans/2026-09-14-aigc-multitrack-provider-payload-mapping.md
```

Expected: both commands exit successfully without output.

- [x] **Step 3: Restart the backend and verify health**

Restart with:

```bash
.venv/bin/python -m uvicorn backend.app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --env-file .env
```

Verify:

```bash
curl -sS http://127.0.0.1:8000/health
```

Expected: JSON containing `"status":"ok"`.

- [x] **Step 4: Record manual acceptance boundary**

Do not submit a real MediaKit task automatically. Report that the user must
rerun the multi-track node and compare text/image placement in the generated
video because that call consumes an external Provider task.
