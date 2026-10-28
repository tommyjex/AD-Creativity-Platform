# Backend Integration Contract

Status: schema defined; implementation in progress. Backend agent owns tasks 1, 3, 4, 6.

- Base path `/api/tools/subtitle-translation`.
- `POST /workspaces`: `{name?, reference_video_asset_id?, clean_video_asset_id?, source_language?: "auto"|language, target_language?: language}`.
- Languages: `en`, `de`, `fr`, `es`, `it`, `pt`, `zh`, `ja`.
- `GET /workspaces`, `GET /workspaces/{id}` return persisted workspaces.
- Workspace: `id`, `revision` (starts at 1), `stage`, input asset IDs, `reference_video`, `clean_video`, `segments`, `active_task_id`, `stage_task_ids`, `output_asset_id`, `warnings`, timestamps.
- Video metadata: display `width`, `height`, `duration_ms`, `rotation`, `fps` (nullable), `has_audio`.
- Segment extends grounding subtitle: stable `segment_id`, immutable original `text`, editable `translated_text`, `translation_status` (`pending|succeeded|failed`), `excluded`, `background_color` (scene estimate), `style`, layout summary fields, `warnings`.
- Style overrides: `font`, `font_size_px`, `text_color`, `background_color` (drawn plate, distinct from scene estimate), `alignment`; all nullable.
- Layout summaries: `estimated_font_size_px`, `recommended_text_color`, `render_bbox_pixels`, `effective_font_size_px`.
- `PATCH /workspaces/{id}`: `expected_revision` plus changed create fields or full `segments` array. Omitted keys unchanged; input asset IDs may be null. Stale revision returns 409.
- `POST /workspaces/{id}/extract|translate|render`: `{expected_revision, segment_ids?}` returns standard ToolTask. IDs apply only to translate; retries preserve successful/manual translations.
- Task `type=video_subtitle_translation`; snapshot `operation`, `workspace_id`, `revision`; use existing `/api/tools/tasks/{task_id}` and `/retry`.
- `POST /import-video`: `{video_url, role: "reference"|"clean"}` returns standard Asset. HTTPS signed URL accepted but never persisted.
- `POST /upload-video?role=reference|clean&filename=...&mime_type=...`: raw `application/octet-stream`, streamed up to 512 MiB; returns standard Asset.
- Viewer read only; mutations require existing Creator/Admin business access.

## Layout Agent Interface

Confirmed `compile_subtitle_project(segments: list[dict], video: dict) -> dict`:

- `segments`: JSON dictionaries from `SubtitleTranslationSegment`.
- `video`: clean display metadata dictionary plus `url`, `asset_id`, `target_language`, `reference_duration_ms`. URL resolved immediately before submission.
- Return `{project: {canvas, track, output}, layouts: {segment_id: summary}, warnings: string[]}`.
- Compiler runs in a worker thread; cold font retrieval can access versioned font URLs. It never calls paid providers. Frozen snapshots store only stable asset references and normalized draft, not signed URLs or runtime projects.
- Backend validates missing translations, handles MediaKit submit/poll/recovery and streams persisted output.

## Recovery Semantics

- Partial translation retains successful records and returns a failed ToolTask, with workspace `review_ready`; use translate with selected IDs or `/retry` to fill only missing records.
- Unrelated edits rebase valid extraction/translation writeback without altering the original task snapshot revision. Relevant edits detach active tasks and current downstream references.
- Render retries after polling/transfer failures reuse the saved provider task ID; terminal provider failure permits a fresh submission from the frozen draft.

## Pre-render Layout Preview (Task 10)

- Detail GET and successful PATCH responses include actual-font layout measurements,
  using the same compiler as rendering in a worker thread, without paid provider calls.
- `POST /workspaces/{id}/preview`: body is the PATCH schema (`expected_revision`,
  optional full `segments` and language/input fields). Returns `SubtitleWorkspace`,
  including measured segment fields, without changing persisted revision or history.
- Draft IDs and original text are immutable here as in PATCH. Stale revisions return 409.
- Available translated segments are measured even when other translations are missing.
  Per-segment layout errors are warnings; font/network failures return editable drafts
  with null measurements and `layout_preview:*` warnings, never fabricated font sizes.
- Detail/PATCH/preview responses include `CAPACITY_NOTICE` and unverified provider
  capacity, vertical anchor, literal escaping and real-render warnings before submission.
- Capacity failures preserve the readable notice in both task `error.message` and
  snapshot `failure_reason`; no subtitle text, signed URLs or raw provider errors appear.
- Measurements in preview responses are derived, not another saved draft revision.
  List responses remain inexpensive persisted summaries; use detail for correction.
- Each measured segment also exposes `font_type` (the exact compiler font file URL)
  and `font_sha256`; both are null when unavailable and recomputed for changed drafts.
  Current `SY_Black` uses the pinned `SubsetOTF/CN/SourceHanSansCN-Regular.otf`,
  not the frontend's previously configured SC file; JP uses the pinned JP file.
  These fields are read-only derived data, not arbitrary client-supplied font sources.
