# Task 5 Validation And Handoff

Date: 2026-10-26. Scope: layout compiler, its offline tests and font fixture.
No workspace schema, frontend, MediaKit client or other agent's service edits.
No paid model or MediaKit submit/poll calls. Real rendered quality is unverified.

## Integration API

`backend.app.services.subtitle_translation_layout.compile_subtitle_project(segments: list[dict], video: dict) -> dict`

- Returns `project`, `layouts`, `warnings`. `layouts` is a **dict keyed by
  segment_id**, not a list. Each summary has the schema's estimated/effective
  sizes, recommended color, render bbox and warnings, plus actual font URL,
  SHA-256, measured width, ascent/descent, time clipping and assigned track.
- Uses actual `SubtitleTranslationSegment.model_dump(mode="json")` fields:
  `style.font/font_size_px/text_color/background_color/alignment`, normalized
  BBox coordinates `0..999`, `translated_text`, times, exclusion and stable ID.
- `video.width/height` are already display-oriented, matching the actual
  `SubtitleVideoMetadata`/grounding contract. Do NOT swap these again for
  90/270-degree rotation. Raw-probe callers can instead provide `encoded_width`
  and `encoded_height`; explicit `display_width/display_height` take precedence.
- Runtime video input needs `url` or `source_url`, `duration_ms`, `fps`,
  `rotation`, and known boolean `has_audio`. Optional `target_language` selects
  JP font for Japanese; `reference_duration_ms` enables the >250ms warning.
- Run in a worker thread. Cold font GETs and FreeType measurement are blocking.
  The backend service now calls `await asyncio.to_thread(...)`, supplies language
  and reference duration, and persists layouts plus top-level warnings.
- `project` is MediaKit wire JSON, not the editor/workspace schema. Refresh the
  signed clean-video URL at submission; do not persist that project as a draft.
  The compiler never mutates inputs and does not log text or signed video URLs.

Backend integration: `arun_6aded88681abfce5309545c8`.
System acceptance: `arun_6aded8c881abfce53095465e`.
This session has no `send_message` tool; this disk-visible handoff and commentary
are the communication path. Direct agent messages were not sent.

## Confirmed Contract Evidence

Official API: https://docs.volcengine.com/docs/6448/2673861

Official usage guide: https://docs.volcengine.com/docs/6448/2673939

Both retrieved through WebFetch, using the research-guide skill. These are
provider-owned sources, not independent render verification.

- Text requires an `extra` transform to specify its **display region**.
  `pos_x/pos_y` are integer left-top offsets from the canvas left-top.
  `width/height` are integer display-region dimensions. The compiler maps the
  target BBox directly and sets explicit font_size; it does not resize a text
  bitmap to fill that BBox or add scale/crop filters to text.
- `font_type` accepts a preset ID or public TTF/OTF URL. `font_size` is integer
  pixels. Font and panel colors are RGBA hex, not scene-background samples.
- `typesetting=0` is horizontal. `align_type=0/1/2` means left/center/right.
  `line_max_width=-1` disables automatic wrapping.
- `text` contains text content. Subtitle file URLs use a different `subtitle`
  element; this compiler does not convert text to ASS, SRT, HTML or effects.
  Ordinary JSON escaping preserves the complete literal string.
- Track indexes ascend from bottom to top. Same-track intervals must not
  overlap. The video is track 0; text uses deterministic interval packing.
- Video elements include their source audio in the mixed output. The compiler
  does not duplicate that audio; `disable_audio` is true only for known silent
  inputs. Direction is represented by display-sized canvas, without a second
  transform rotation on the source video.
- Published canvas dimension range: 160..8192 pixels.
- The provider guide limits **subtitle file tracks** to ten. This tool uses
  **text elements**, so that subtitle-track limit is not applied.

## Explicit Evidence Gaps

- No published text-character, text-element or general-track maximum was found.
  **500 subtitles and 4000 characters per subtitle are the tool/workspace
  boundaries, NOT a guarantee that MediaKit accepts that capacity.** The
  compiler emits `provider_text_capacity_unverified` and readable
  `CAPACITY_NOTICE`; over-limit exceptions include that same distinction.
  Tests compile 201 simultaneous texts onto 202 total tracks without truncation.
  This is a compiler test, NOT proof that MediaKit accepts 202 tracks.
- The docs specify the transform/display-region origin and horizontal
  alignment, but not the exact vertical **glyph/baseline anchor**, padding,
  rasterizer metrics, or cross-engine kerning. `provider_vertical_anchor_unverified`
  and `real_render_unverified` remain visible warnings. Pillow tests prove
  local measurement and correct wire mapping, not final glyph placement.
- The docs call text content a string but do not specify literal grammar for
  ASS-looking braces/backslashes or HTML-looking text. JSON round-trip tests
  prove our code preserves the string; they do not prove provider interpretation.
  `provider_literal_escaping_unverified` remains a warning. No speculative
  backslash/HTML escaping is added.
- The existing local adapter's `MultiTrackFrameRate` allows 24/25/30/50/60.
  The retrieved provider guide explicitly demonstrates 30. Non-30 supported
  local values are preserved with `fps_support_local_contract_only`; other
  values, including fractional rates, become 30 with `fps_fallback_30`.
  This does not claim the local enum is independent provider evidence.
- Source display-matrix decoding and source audio preservation are documented
  API behavior but have not been tested by an actual MediaKit render.
  Rotated sources get a specific real-render-unverified warning.

Do not mark the checklist's combined provider-capacity/anchor/escaping evidence
item, or real rendered-quality items, complete based on these offline tests.

## Same-Font Measurement

- Reuses the editor's `SY_Black` (Source Han Sans) resource family. Since the
  opaque provider preset's exact binary/version is not published, sends an
  explicit file URL instead of claiming that a local approximation equals the
  preset. Default CN and Japanese JP files use fixed upstream commit
  `a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2`.
- CN URL:
  `https://raw.githubusercontent.com/adobe-fonts/source-han-sans/a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/SubsetOTF/CN/SourceHanSansCN-Regular.otf`
- JP URL:
  `https://raw.githubusercontent.com/adobe-fonts/source-han-sans/a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/SubsetOTF/JP/SourceHanSansJP-Regular.otf`
- Real downloaded CN SHA-256:
  `e2bc8a2e7f37474b774fff8db758681ece40bb6947a90d571bce9dd60671a8e4`
- Real downloaded JP SHA-256:
  `40d1b760d1135539f6b6e0ee2b9f415de6d97576f7676840b06306c7c190c074`
- Also supports `CenturyGothic`, the repo's existing public font URL. That URL
  is not version-pinned, so it gets `font_url_version_unverified`. Other opaque
  editor presets are rejected with `font_resource_unavailable` rather than
  measured using an unrelated system font.
- Only registered resource URLs are fetched; redirects are rejected and
  decompressed downloads are capped at 32 MiB. Arbitrary user font URLs cannot
  create a new SSRF path. No credentials or signed URLs are used for fonts.
- Measures downloaded bytes with Pillow/FreeType. Reads the actual sfnt Unicode
  cmap formats 4/12/13 to detect missing glyphs. A known covering fallback uses
  the fallback's same resource for both measurement and wire submission.
  Unresolved missing glyphs remain explicit with codepoints and font suggestions.
- Height fits actual ascent+descent; integer effective size then fits complete
  text advance plus glyph overhangs. User size is an upper bound. Text cannot be
  shortened, wrapped or enlarged for short translations. If it cannot fit at
  1px, the compiler returns `text_cannot_fit_at_minimum_font`, not truncated text.
- Actual no-paid-API compile using the real default CN download, with German
  `Übermäßig längere Übersetzung`, target BBox `[128,144,641,216]`:
  estimated size 49px, effective 33px, measured width 499px within 513px,
  ascent/descent 39/10px, no missing glyphs. Same fixed URL submitted in project.
  **No project was submitted to MediaKit.**

## Tests And Quality

From repository root:

```bash
PYTHONPATH="$PWD" RUN_PAID_MODELARK_SMOKE=false .venv/bin/python -m pytest backend/tests/test_subtitle_translation_layout.py -q
PYTHONPATH="$PWD" RUN_PAID_MODELARK_SMOKE=false .venv/bin/python -m pytest backend/tests/test_subtitle_translation_layout.py backend/tests/test_mediakit_multitrack.py backend/tests/test_asset_multitrack_storage.py backend/tests/test_subtitle_translation_workspace.py -q
.venv/bin/ruff check backend/app/services/subtitle_translation_layout.py backend/tests/test_subtitle_translation_layout.py
.venv/bin/ruff check --select E9,F63,F7,F82 backend/app/services/subtitle_translation_layout.py backend/tests/test_subtitle_translation_layout.py
.venv/bin/python -m compileall -q backend/app/services/subtitle_translation_layout.py backend/tests/test_subtitle_translation_layout.py
git diff --check
```

Layout suite: 80 tests. Latest four-module run: **138 passed**. One existing
Starlette/httpx deprecation warning. Default/fatal Ruff, formatting, Python
compilation and whitespace checks are required on the final file state.

The 46 KiB ABeeZee OFL fixture is bundled with its license. Tests mock font HTTP
responses with these fixed bytes while using real Pillow metrics; production
never substitutes it for Source Han Sans. Tests are offline and reproducible
without the temporary actual-font downloads.

## Parent And Acceptance Follow-Up

- Before paid submission, UI should display `CAPACITY_NOTICE` or equivalent
  copy. Post-render warnings alone do not warn a user before their first render.
  Preserve the readable distinction when API/schema/compiler limits reject
  oversized drafts; do not translate it into "MediaKit supports 500".
- The stage runner currently preserves a generic public failure plus
  `failure_reason`. For compiler capacity failures it should expose the safe
  `CAPACITY_NOTICE`/code-specific message. This is in the backend agent's owned
  service, not changed by the layout agent.
- Preserve real-render and anchor/escaping warnings in API and frontend.
  Do not show review overlays or mock frames as validated MediaKit quality.
- Accepting arbitrary custom-font URLs requires the existing secure asset
  pipeline plus a verified measurement/submission resource, not widening the
  compiler's public-download allowlist to untrusted inputs.
- No approval, paid verification or frontend changes were requested from this
  session. Task 8 retains browser/system acceptance ownership.
