# AIGC Multi-Track Provider Layer Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert foreground-to-background editor tracks into MediaKit's bottom-to-top provider order so full-canvas video cannot cover foreground text.

**Architecture:** Keep pipeline definitions, task parameters, and frontend preview ordering unchanged. Reverse only the filtered, non-empty outer `provider_tracks` list immediately before the MediaKit request; preserve element order within every track.

**Tech Stack:** Python 3.14, FastAPI service layer, Pydantic v2, pytest

---

## File Map

- Modify `backend/tests/test_aigc_gateway.py`: lock the five-track MediaKit payload order, text element order, and unchanged task parameter order.
- Modify `backend/app/services/aigc_gateway.py`: reverse the filtered provider track list at the MediaKit boundary.

### Task 1: Add the failing provider-order contract

**Files:**
- Modify: `backend/tests/test_aigc_gateway.py:2336-2368`
- Test: `backend/tests/test_aigc_gateway.py`

- [x] **Step 1: Assert the MediaKit outer track array is reversed**

Update `test_gateway_resolves_multi_track_assets_and_uses_mock_mediakit` so the
provider payload is expected in this order:

```python
    provider_tracks = provider_project["track"]
    assert [track[0]["type"] for track in provider_tracks] == [
        "subtitle",
        "audio",
        "image",
        "text",
        "video",
    ]
```

- [x] **Step 2: Assert inner element order is preserved**

Use the reversed text-track index while retaining the original two text
elements:

```python
    provider_text_track = provider_tracks[3]
    assert [element["text"] for element in provider_text_track] == [
        "当前 Run 文本",
        "默认字体文本",
    ]
```

Keep the existing assertions for font mapping, source URLs, target times, and
source trims, but update their outer track indexes to the reversed positions.

- [x] **Step 3: Assert saved task parameters remain in editor order**

Retain the existing checks against:

```python
    task.params["project"]["tracks"][1]["elements"]
    task.params["project"]["tracks"][4]["elements"]
```

These assertions prove the conversion does not mutate persisted task input.

- [x] **Step 4: Run the focused test and verify it fails**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_gateway.py::test_gateway_resolves_multi_track_assets_and_uses_mock_mediakit \
  -q
```

Expected: failure because the provider payload is still ordered
`video, text, image, audio, subtitle`.

### Task 2: Reverse provider tracks at the request boundary

**Files:**
- Modify: `backend/app/services/aigc_gateway.py:2068-2136`
- Test: `backend/tests/test_aigc_gateway.py`

- [x] **Step 1: Implement the minimal conversion**

After hidden and empty tracks have been filtered and after the existing empty
project guard, reverse only the provider list:

```python
        if not provider_tracks:
            raise ValueError("multi-track project has no visible elements")

        provider_tracks.reverse()

        client = self.multitrack_client_factory()
```

Do not reverse `project.tracks` and do not reorder `provider_elements`.

- [x] **Step 2: Run the focused test**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_gateway.py::test_gateway_resolves_multi_track_assets_and_uses_mock_mediakit \
  -q
```

Expected: `1 passed`.

- [x] **Step 3: Run related MediaKit and gateway regression tests**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_gateway.py \
  backend/tests/test_mediakit_multitrack.py \
  backend/tests/test_asset_multitrack_storage.py \
  -q
```

Expected: all selected tests pass.

- [x] **Step 4: Run static validation**

Run:

```bash
.venv/bin/python -m py_compile \
  backend/app/services/aigc_gateway.py \
  backend/tests/test_aigc_gateway.py
git diff --check -- \
  backend/app/services/aigc_gateway.py \
  backend/tests/test_aigc_gateway.py
```

Expected: both commands exit successfully without output.

- [x] **Step 5: Restart the backend and verify health**

Restart Uvicorn with:

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

Expected: JSON with `"status":"ok"`.
