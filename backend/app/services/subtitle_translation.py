from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from collections import OrderedDict
from time import monotonic
from video_subtitle_grounding.brand_rules import (
    BRAND_RULE_VERSION, BRAND_SKIPPED_WARNING, filter_brand_records,
)
from video_subtitle_grounding.layout import ENCODING_POLICY_VERSION, compile_text_subtitle_project
from video_subtitle_grounding.encoding import apply_subtitle_output_policy, frozen_crf

from backend.app.core.logging import log_event
from backend.app.repositories.base import NotFoundError, RevisionConflictError
from backend.app.schemas.common import utc_now
from backend.app.schemas.enums import ErrorCode, Status, ToolTaskType
from backend.app.schemas.subtitle_translation import (
    SubtitleStageRequest,
    SubtitleTranslationSegment,
    SubtitleTranslationStage,
    SubtitleWorkspace,
    SubtitleWorkspaceCreate,
    SubtitleWorkspaceUpdate,
)
from backend.app.schemas.tool_task import ToolTaskCreate, ToolTaskError

logger = logging.getLogger(__name__)
ACTIVE = {Status.QUEUED, Status.RUNNING}
BUSY = {
    "extract": SubtitleTranslationStage.EXTRACTING,
    "translate": SubtitleTranslationStage.TRANSLATING,
    "render": SubtitleTranslationStage.RENDERING,
}
LAYOUT_FIELDS = (
    "estimated_font_size_px",
    "effective_font_size_px",
    "recommended_text_color",
    "render_bbox_pixels",
    "font_type",
    "font_sha256",
    "text_runs",
    "render_layer_asset_id",
    "render_layer_url",
    "effective_render_mode",
)
ADAPTIVE_LAYOUT_WARNINGS = {
    "bbox_expanded",
    "bbox_expansion_limited",
    "original_bbox_overlap",
    "expanded_background_unverified",
    "font_size_reduced",
    "font_size_small",
    "product_layout_unavailable",
    "product_layer_storage_unavailable",
    "product_glyph_font_fallback",
    "text_product_font_fallback",
    "png_text_fallback",
    "png_mixed_fallback",
    "source_video_bit_rate_unavailable",
    "subtitle_raster_unavailable",
    "missing_glyphs",
    "font_fallback",
    "font_metrics_unverified",
    "preset_glyph_coverage_unverified",
    "footnote_space_limited",
    "font_size_minimum_applied",
    "background_unknown",
    "low_contrast",
    "contrast_unverified",
}


class SubtitleTranslationService:
    @staticmethod
    def _render_modes(project, layouts, requested):
        """Track actual overlays without persisting their signed source URLs."""
        modes = set()
        tracks = project.get("track", [])
        for summary in layouts.values():
            if summary.get("excluded"):
                continue
            mode = summary.get("effective_render_mode")
            if mode not in {"png", "text"}:
                index = summary.get("track_index")
                elements = (
                    tracks[index] if isinstance(index, int) and 0 <= index < len(tracks)
                    else [element for track in tracks[1:] for element in track]
                )
                types = {element.get("type") for element in elements}
                mode = "png" if types == {"image"} else "text" if types == {"text"} else requested
            summary.update(render_mode=requested, effective_render_mode=mode)
            modes.add(mode)
        return next(iter(modes)) if len(modes) == 1 else "mixed" if modes else requested

    @staticmethod
    def _effective_segments(segments):
        return list(filter_brand_records(segments).kept)

    @staticmethod
    def _brand_notices(workspace):
        filtered = filter_brand_records(workspace.segments)
        for index, segment in enumerate(workspace.segments):
            segment.warnings = [
                w for w in segment.warnings
                if w != BRAND_SKIPPED_WARNING
                and (index not in filtered.skipped_indexes or not w.startswith(
                    ("translation_pending:", "layout_preview:missing_translation")))
            ]
            if index in filtered.skipped_indexes:
                segment.warnings.append(BRAND_SKIPPED_WARNING)
        workspace.warnings = [w for w in workspace.warnings if w != BRAND_SKIPPED_WARNING]
        if filtered.skipped_indexes:
            workspace.warnings.append(BRAND_SKIPPED_WARNING)
        return filtered

    def __init__(
        self,
        repository,
        asset_storage,
        *,
        runner=None,
        grounding=None,
        translator=None,
        mediakit_factory=None,
        compiler=None,
        media=None,
    ):
        self.repository = repository
        self.asset_storage = asset_storage
        self.runner = runner
        self.grounding = grounding
        self.translator = translator
        self.mediakit_factory = mediakit_factory
        self.compiler = compiler
        self.media = media
        self._scheduled: set[str] = set()
        self._running: set[asyncio.Task] = set()
        from .subtitle_translation_layers import SubtitleLayerStorage

        self.layers = SubtitleLayerStorage(repository, asset_storage)
        self._product_results = OrderedDict()

    @staticmethod
    def _refresh_products(segment):
        from video_subtitle_grounding.product_names import (
            effective_mentions,
            text_fingerprint,
            validated_mentions,
        )

        text = segment.translated_text or ""
        if segment.product_names_enabled is False:
            segment.product_mentions = (validated_mentions(text, segment.product_mentions)
                                        if segment.product_text_sha256 == text_fingerprint(text) else [])
        else:
            segment.product_mentions = effective_mentions(segment.model_dump(mode="json"))
        segment.product_text_sha256 = text_fingerprint(text)

    def _segment_content(self, segments):
        copies = []
        for original in segments:
            segment = original.model_copy(deep=True)
            self._refresh_products(segment)
            copies.append(segment)
        self._refresh_context(copies)
        return [segment.model_dump(mode="json", exclude={
            *LAYOUT_FIELDS, "warnings", "product_text_sha256",
            "product_recognition_sha256"}) for segment in copies]

    @staticmethod
    def _recognition_fingerprints(segments):
        from video_subtitle_grounding.product_names import CATALOG_VERSION

        records = [{
            "id": s.segment_id, "text": s.translated_text or "",
            "block": s.block_id, "excluded": s.excluded, "enabled": s.product_names_enabled,
        } for s in segments]
        return {s.segment_id: hashlib.sha256(json.dumps({
            "catalog": CATALOG_VERSION, "record": record,
            "context": [other for other in records if s.block_id and other["block"] == s.block_id],
        }, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
                for s, record in zip(segments, records, strict=True)}

    async def prepare_product_update(self, workspace_id, request):
        """Automatically infer edited/historical names before save or POST preview."""
        from backend.app.services.modelark_subtitle_translation import ModelArkSubtitleTranslationAdapter
        from video_subtitle_grounding.product_names import text_fingerprint

        workspace = self.repository.get_subtitle_workspace(workspace_id)
        if workspace.revision != request.expected_revision:
            raise RevisionConflictError("workspace revision changed; reload before saving")
        if request.segments is None:
            return request
        if {s.segment_id: s.text for s in request.segments} != {
                s.segment_id: s.text for s in workspace.segments}:
            raise ValueError("preview must preserve segment IDs and original text")
        segments = [s.model_copy(deep=True) for s in request.segments]
        fingerprints = self._recognition_fingerprints(segments)
        previous = {s.segment_id: s for s in workspace.segments}
        pending = []
        for segment in self._effective_segments(segments):
            digest = fingerprints[segment.segment_id]
            key = (workspace_id, segment.segment_id, digest)
            saved = previous[segment.segment_id]
            if saved.product_recognition_sha256 == digest:
                segment.product_mentions = saved.product_mentions
                segment.product_recognition_sha256 = digest
                segment.product_text_sha256 = text_fingerprint(segment.translated_text or "")
            elif key in self._product_results:
                segment.product_mentions = self._product_results[key]
                segment.product_recognition_sha256 = digest
                segment.product_text_sha256 = text_fingerprint(segment.translated_text or "")
            elif segment.translated_text and not segment.excluded and segment.product_names_enabled:
                pending.append(segment.segment_id)
        if pending:
            records = [{**s.model_dump(mode="json"), "text": s.translated_text}
                       for s in self._effective_segments(segments) if s.translated_text and not s.excluded]
            result = {"product_mentions": {}, "warnings": {}}
            retry_ids = pending
            for attempt in range(2):
                try:
                    translator = self.translator or ModelArkSubtitleTranslationAdapter()
                    fresh = await translator.recognize_products(records, segment_ids=retry_ids)
                    result["product_mentions"].update(fresh["product_mentions"])
                    result["warnings"].update(fresh.get("warnings", {}))
                    retry_ids = [sid for sid in retry_ids if fresh.get("warnings", {}).get(sid)]
                except asyncio.CancelledError:
                    raise
                except Exception as exc:  # noqa: BLE001 - automatic inference cannot block edits
                    log_event(logger, "subtitle_translation.auto_products_failed", outcome="failed",
                              workspace_id=workspace_id, attempt=attempt + 1,
                              error_type=type(exc).__name__, segment_count=len(retry_ids))
                if not retry_ids:
                    break
            for segment in segments:
                if segment.segment_id not in pending:
                    continue
                segment.product_mentions = result["product_mentions"].get(segment.segment_id, [])
                segment.product_text_sha256 = text_fingerprint(segment.translated_text)
                segment.product_recognition_sha256 = fingerprints[segment.segment_id]
                key = (workspace_id, segment.segment_id, segment.product_recognition_sha256)
                self._product_results[key] = segment.product_mentions
                if len(self._product_results) > 512:
                    self._product_results.popitem(last=False)
            log_event(logger, "subtitle_translation.auto_products_completed", outcome="completed",
                      workspace_id=workspace_id, segment_count=len(pending),
                      fallback_count=len(retry_ids))
        if self.repository.get_subtitle_workspace(workspace_id).revision != request.expected_revision:
            raise RevisionConflictError("workspace revision changed; reload before saving")
        return request.model_copy(update={"segments": segments})

    @staticmethod
    def _refresh_context(segments):
        from video_subtitle_grounding.product_names import contextual_segments

        effective = filter_brand_records(segments).kept
        normalized = contextual_segments([s.model_dump(mode="json") for s in effective])
        for segment, record in zip(effective, normalized, strict=True):
            if segment.product_names_enabled is not False:
                segment.product_mentions = record["product_mentions"]

    async def recognize_products(self, workspace_id, request):
        """Explicit paid recognition of a draft, with optimistic writeback."""
        from backend.app.services.modelark_subtitle_translation import (
            ModelArkSubtitleTranslationAdapter,
        )

        workspace = self.repository.get_subtitle_workspace(workspace_id)
        if workspace.revision != request.expected_revision:
            raise RevisionConflictError("workspace revision changed; reload before recognizing")
        if workspace.active_task_id:
            raise ValueError("another workspace stage is active")
        # Use preview validation without invoking layout or writing any draft.
        segments = request.segments if request.segments is not None else workspace.segments
        if {s.segment_id: s.text for s in segments} != {s.segment_id: s.text for s in workspace.segments}:
            raise ValueError("preview must preserve segment IDs and original text")
        records = [{**s.model_dump(mode="json"), "text": s.translated_text}
                   for s in self._effective_segments(segments) if s.translated_text and not s.excluded]
        if not records:
            return await self.preview(workspace, request)
        translator = self.translator or ModelArkSubtitleTranslationAdapter()
        result = await translator.recognize_products(records, segment_ids=[s["segment_id"] for s in records])
        updated = []
        for item in segments:
            segment = item.model_copy(deep=True)
            segment.product_mentions = result["product_mentions"].get(segment.segment_id, [])
            segment.product_text_sha256 = result["product_text_sha256"].get(segment.segment_id)
            segment.warnings = [*segment.warnings, *result.get("warnings", {}).get(segment.segment_id, [])]
            updated.append(segment)
        # patch checks revision again after the model finishes; concurrent edits win.
        saved = self.patch(workspace_id, SubtitleWorkspaceUpdate(
            **{**request.model_dump(exclude_unset=True), "segments": updated}))
        self._event("products_recognized", saved)
        return await self.preview(saved)

    async def stop(self):
        pending = list(self._running)
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)

    def _asset_metadata(self, asset_id):
        from backend.app.services.subtitle_translation_media import metadata_for_asset

        return metadata_for_asset(self.repository.get_asset(asset_id))

    def create(self, request: SubtitleWorkspaceCreate):
        workspace = SubtitleWorkspace(**request.model_dump())
        for role in ("reference", "clean"):
            asset_id = getattr(workspace, f"{role}_video_asset_id")
            if asset_id:
                setattr(workspace, f"{role}_video", self._asset_metadata(asset_id))
        self._warnings(workspace)
        return self.repository.create_subtitle_workspace(workspace)

    async def preview(self, workspace, request=None):
        """Derived layout only: never revise drafts or persist runtime source URLs."""
        from backend.app.services.subtitle_translation_layout import (
            CAPACITY_NOTICE,
            SubtitleLayoutError,
            compile_subtitle_project,
        )

        workspace = workspace.model_copy(deep=True)
        if request is not None:
            if workspace.revision != request.expected_revision:
                raise RevisionConflictError(
                    "workspace revision changed; reload before previewing"
                )
            changes = request.model_dump(
                exclude_unset=True, exclude={"expected_revision"}
            )
            # Draft preview uses the saved mode; mode changes belong to workspace PATCH.
            changes.pop("render_mode", None)
            if request.segments is not None:
                original = {s.segment_id: s.text for s in workspace.segments}
                if original != {s.segment_id: s.text for s in request.segments}:
                    raise ValueError(
                        "preview must preserve segment IDs and original text"
                    )
                changes["segments"] = request.segments
            for role in ("reference", "clean"):
                key = f"{role}_video_asset_id"
                if key in changes and changes[key] != getattr(workspace, key):
                    setattr(
                        workspace,
                        f"{role}_video",
                        self._asset_metadata(changes[key]) if changes[key] else None,
                    )
            for key, value in changes.items():
                setattr(workspace, key, value)
        self._brand_notices(workspace)
        notices = [
            "provider_text_capacity_unverified",
            CAPACITY_NOTICE,
            "provider_vertical_anchor_unverified",
            "provider_literal_escaping_unverified",
            "real_render_unverified",
        ]
        workspace.warnings = list(
            dict.fromkeys(
                [
                    *(
                        w
                        for w in workspace.warnings
                        if w.rsplit(":", 1)[-1] not in ADAPTIVE_LAYOUT_WARNINGS
                        and not w.startswith("layout_preview:")
                    ),
                    *notices,
                ]
            )
        )
        for segment in workspace.segments:
            self._refresh_products(segment)
            for key in LAYOUT_FIELDS:
                setattr(segment, key, None)
            segment.warnings = [
                w
                for w in segment.warnings
                if not w.startswith("layout_preview:")
                and w.rsplit(":", 1)[-1] not in ADAPTIVE_LAYOUT_WARNINGS
            ]
        self._refresh_context(self._effective_segments(workspace.segments))
        video_metadata = workspace.clean_video or workspace.reference_video
        if not video_metadata:
            workspace.warnings.append("layout_preview:video_metadata_unavailable")
            return workspace
        role = "clean" if workspace.clean_video else "reference"
        asset_id = getattr(workspace, f"{role}_video_asset_id")
        try:
            source = self.asset_storage.signed_access_url(
                self.repository.get_asset(asset_id)
            )
        except Exception:  # noqa: BLE001 - unavailable preview source must not block draft reads
            workspace.warnings.append("layout_preview:video_source_unavailable")
            return workspace
        video = {
            **video_metadata.model_dump(),
            "url": source,
            "target_language": workspace.target_language,
            "video_category": workspace.video_category,
            "render_mode": workspace.render_mode,
            "crf": workspace.crf,
            "reference_duration_ms": (
                workspace.reference_video.duration_ms
                if workspace.reference_video
                else None
            ),
        }
        pending = []
        for segment in self._effective_segments(workspace.segments):
            if segment.excluded:
                continue
            if not segment.translated_text:
                segment.warnings.append("layout_preview:missing_translation")
            else:
                pending.append(segment.model_dump(mode="json"))
        compiler = self.compiler or compile_subtitle_project
        while pending:
            try:
                compiled = await asyncio.to_thread(compiler, pending, video)
                if workspace.render_mode == "text" and compiled.get("layers"):
                    raise SubtitleLayoutError("text_render_layers_unavailable")
                try:
                    if workspace.render_mode == "png" and compiled.get("layers"):
                        await self.layers.prepare(workspace.id, compiled)
                except asyncio.CancelledError:
                    raise
                except Exception:  # noqa: BLE001 - optional PNG storage cannot block editing
                    previous = compiled
                    compiled = await asyncio.to_thread(
                        compile_text_subtitle_project,
                        pending, video)
                    compiled.setdefault("warnings", []).extend(previous.get("warnings", []))
                    compiled.setdefault("warnings", []).append("product_layer_storage_unavailable")
                    for segment_id, summary in compiled.get("layouts", {}).items():
                        summary.setdefault("warnings", []).extend(
                            previous.get("layouts", {}).get(segment_id, {}).get("warnings", []))
                        summary.update(render_layer_asset_id=None, render_layer_url=None,
                                       text_runs=[])
                        summary.setdefault("warnings", []).append("product_layer_storage_unavailable")
                summaries = compiled["layouts"]
                effective = self._render_modes(compiled.get("project", compiled), summaries, workspace.render_mode)
                if workspace.render_mode == "png" and effective != "png":
                    compiled.setdefault("warnings", []).append(f"png_{effective}_fallback")
                workspace.warnings = list(
                    dict.fromkeys([*workspace.warnings, *compiled.get("warnings", [])])
                )
                for segment in workspace.segments:
                    summary = summaries.get(segment.segment_id)
                    if summary is None:
                        continue
                    for key in LAYOUT_FIELDS:
                        if key in summary:
                            value = summary[key]
                            if key == "render_bbox_pixels" and value is not None:
                                value = tuple(value)
                            setattr(segment, key, value)
                    segment.warnings = list(
                        dict.fromkeys([*segment.warnings, *summary.get("warnings", [])])
                    )
                break
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - optional measurement cannot block editing
                safe = (
                    str(exc)
                    if isinstance(exc, SubtitleLayoutError)
                    else "measurement_unavailable"
                )
                failed_id = getattr(exc, "segment_id", None)
                warning = f"layout_preview:{safe}"
                workspace.warnings.append(warning)
                for segment in workspace.segments:
                    if segment.segment_id in {s["segment_id"] for s in pending} and (
                        failed_id is None or segment.segment_id == failed_id
                    ):
                        segment.warnings.append(warning)
                if failed_id not in {s["segment_id"] for s in pending} or getattr(
                    exc, "code", ""
                ).startswith("font_"):
                    break
                pending = [s for s in pending if s["segment_id"] != failed_id]
        return workspace

    def patch(self, workspace_id, request: SubtitleWorkspaceUpdate):
        def mutate(workspace, tasks):
            if workspace.revision != request.expected_revision:
                raise RevisionConflictError(
                    "workspace revision changed; reload before saving"
                )
            changes = request.model_dump(
                exclude_unset=True, exclude={"expected_revision"}
            )
            old_segments = {s.segment_id: s for s in workspace.segments}
            if request.segments is not None:
                if set(old_segments) != {s.segment_id for s in request.segments}:
                    raise ValueError(
                        "draft must preserve segment IDs; use excluded to omit a subtitle"
                    )
                for segment in request.segments:
                    if segment.text != old_segments[segment.segment_id].text:
                        raise ValueError("original subtitle text cannot be overwritten")
                cleaned = [s.model_copy(deep=True) for s in request.segments]
                for segment in cleaned:
                    previous = old_segments[segment.segment_id]
                    self._refresh_products(segment)
                    for key in LAYOUT_FIELDS:
                        setattr(segment, key, getattr(previous, key))
                    segment.warnings = list(dict.fromkeys([
                        *previous.warnings, *[w for w in segment.warnings if w in {
                            "product_recognition_unavailable", "product_recognition_invalid_split"}]
                    ]))
                    if segment.translated_text:
                        segment.translation_status = "succeeded"
                    elif previous.translated_text:
                        segment.translation_status = "pending"
                self._refresh_context(cleaned)
                changes["segments"] = cleaned
            reference_changed = (
                changes.get(
                    "reference_video_asset_id", workspace.reference_video_asset_id
                )
                != workspace.reference_video_asset_id
            )
            language_changed = any(
                k in changes and changes[k] != getattr(workspace, k)
                for k in ("source_language", "target_language")
            )
            clean_changed = (
                changes.get("clean_video_asset_id", workspace.clean_video_asset_id)
                != workspace.clean_video_asset_id
            )
            category_changed = (
                changes.get("video_category", workspace.video_category)
                != workspace.video_category
            )
            mode_changed = changes.get("render_mode", workspace.render_mode) != workspace.render_mode
            crf_changed = changes.get("crf", workspace.crf) != workspace.crf
            active = next(
                (
                    t
                    for t in tasks
                    if t.id == workspace.active_task_id and t.status in ACTIVE
                ),
                None,
            )
            active_operation = active.input_snapshot["operation"] if active else None
            draft_changed = (
                "segments" in changes and self._segment_content(changes["segments"])
                != self._segment_content(workspace.segments)
            )
            content_changed = (
                reference_changed
                or language_changed
                or clean_changed
                or category_changed
                or mode_changed
                or (draft_changed)
            )
            active_invalidated = (
                reference_changed
                or (active_operation == "translate" and language_changed)
                or (active_operation == "render" and (content_changed or crf_changed))
            )
            for key, value in changes.items():
                setattr(workspace, key, value)
            if reference_changed:
                workspace.reference_video = (
                    self._asset_metadata(workspace.reference_video_asset_id)
                    if workspace.reference_video_asset_id
                    else None
                )
                workspace.segments = []
                workspace.stage_task_ids = {}
            elif language_changed:
                for segment in workspace.segments:
                    segment.translated_text = None
                    segment.translation_status = "pending"
                    segment.warnings = []
                    self._refresh_products(segment)
                workspace.stage_task_ids.pop("translate", None)
                workspace.stage_task_ids.pop("render", None)
            if clean_changed:
                workspace.clean_video = (
                    self._asset_metadata(workspace.clean_video_asset_id)
                    if workspace.clean_video_asset_id
                    else None
                )
            if content_changed or crf_changed:
                if active_invalidated or active is None:
                    workspace.active_task_id = None
                workspace.output_asset_id = None
                workspace.stage_task_ids.pop("render", None)
                for segment in workspace.segments if content_changed else []:
                    for key in LAYOUT_FIELDS:
                        setattr(segment, key, None)
                    if category_changed or mode_changed:
                        segment.warnings = [
                            warning for warning in segment.warnings
                            if warning.rsplit(":", 1)[-1] not in ADAPTIVE_LAYOUT_WARNINGS
                            and not warning.startswith("layout_preview:")
                        ]
                if category_changed or mode_changed:
                    workspace.warnings = [
                        warning for warning in workspace.warnings
                        if warning.rsplit(":", 1)[-1] not in ADAPTIVE_LAYOUT_WARNINGS
                        and not warning.startswith("layout_preview:")
                    ]
                if active_invalidated or active is None:
                    workspace.stage = self._draft_stage(workspace)
            workspace.revision += 1
            rebased_task = None
            if active is not None and not active_invalidated:
                # Keep the immutable origin revision; authorize only unaffected stage writeback.
                active.input_snapshot = {
                    **active.input_snapshot,
                    "writeback_revision": workspace.revision,
                }
                rebased_task = active
            preserved_warnings = (
                workspace.warnings
                if mode_changed and not reference_changed and not language_changed and not clean_changed
                else []
            )
            self._warnings(workspace)
            workspace.warnings = list(dict.fromkeys([*preserved_warnings, *workspace.warnings]))
            return workspace, rebased_task

        result = self.repository.mutate_subtitle_workspace(workspace_id, mutate)
        self._event("saved", result)
        return result

    @staticmethod
    def _draft_stage(workspace):
        if not workspace.segments:
            return SubtitleTranslationStage.DRAFT
        if all(s.excluded or s.translated_text for s in filter_brand_records(workspace.segments).kept):
            return SubtitleTranslationStage.REVIEW_READY
        return SubtitleTranslationStage.EXTRACTED

    @staticmethod
    def _warnings(workspace):
        workspace.warnings = []
        if (
            workspace.reference_video
            and workspace.clean_video
            and abs(
                workspace.reference_video.duration_ms
                - workspace.clean_video.duration_ms
            )
            > 250
        ):
            workspace.warnings.append(
                "video_duration_mismatch: verify both videos share the same timeline"
            )
        SubtitleTranslationService._brand_notices(workspace)

    def submit(
        self, workspace_id, operation, request: SubtitleStageRequest, *, retry_of=None
    ):
        from video_subtitle_grounding.product_names import CATALOG_VERSION

        from backend.app.services.subtitle_translation_layout import LAYOUT_VERSION

        task_id = None
        created = False

        def mutate(workspace, tasks):
            nonlocal task_id, created
            selected = sorted(set(request.segment_ids or []))
            identity = [
                workspace_id,
                operation,
                request.expected_revision,
                selected,
                retry_of,
                {"brand_rule_version": BRAND_RULE_VERSION},
            ]
            if operation == "render":
                identity.append({"render_layout_version": LAYOUT_VERSION,
                                 "encoding_policy_version": ENCODING_POLICY_VERSION,
                                 "product_catalog_version": CATALOG_VERSION,
                                 "video_category": workspace.video_category,
                                 "render_mode": workspace.render_mode,
                                 "crf": workspace.crf})
            key = hashlib.sha256(
                json.dumps(identity, separators=(",", ":")).encode()
            ).hexdigest()
            existing = next(
                (t for t in tasks if t.input_snapshot.get("idempotency_key") == key),
                None,
            )
            if retry_of:
                existing = next(
                    (t for t in tasks if t.retry_of_task_id == retry_of), existing
                )
            if existing is not None:
                task_id = existing.id
                return workspace, None
            if workspace.revision != request.expected_revision:
                raise RevisionConflictError(
                    "workspace revision changed; reload before executing"
                )
            if workspace.active_task_id:
                active = next(
                    (t for t in tasks if t.id == workspace.active_task_id), None
                )
                if active and active.status in ACTIVE:
                    raise ValueError("another workspace stage is active")
            if operation == "extract":
                if not workspace.reference_video_asset_id:
                    raise ValueError("select a reference video first")
                metadata = self._asset_metadata(workspace.reference_video_asset_id)
                if metadata.duration_ms > 600_000:
                    raise ValueError("reference video must be at most 600 seconds")
            elif operation == "translate":
                ids = {s.segment_id for s in workspace.segments}
                if not ids or any(i not in ids for i in selected):
                    raise ValueError("translation requires valid extracted segment IDs")
                if request.segment_ids is not None and not selected:
                    raise ValueError("translation selection must not be empty")
                requested = set(selected)
                selected = [
                    s.segment_id
                    for s in self._effective_segments(workspace.segments)
                    if not s.excluded
                    and not s.translated_text
                    and (not requested or s.segment_id in requested)
                ]
                if not selected:
                    raise ValueError("no pending translations")
            elif operation == "render":
                render_segments = self._effective_segments(workspace.segments)
                if retry_of:
                    previous_render = next((t for t in tasks if t.id == retry_of), None)
                    if (previous_render and previous_render.provider_task_id
                            and previous_render.input_snapshot.get("failure_reason") != "provider_failed"):
                        frozen = previous_render.input_snapshot
                        frozen_segments = [SubtitleTranslationSegment.model_validate(s) for s in frozen["segments"]]
                        render_segments = (
                            self._effective_segments(frozen_segments)
                            if frozen.get("brand_rule_version") == BRAND_RULE_VERSION
                            else frozen_segments
                        )
                if not workspace.clean_video_asset_id or not workspace.clean_video:
                    raise ValueError("select a clean video first")
                if any(
                    not s.excluded and not s.translated_text
                    for s in render_segments
                ):
                    raise ValueError(
                        "complete or exclude every untranslated subtitle before rendering"
                    )
                if not any(
                    not s.excluded and s.start_ms < workspace.clean_video.duration_ms
                    for s in render_segments
                ):
                    raise ValueError("no renderable subtitle segments")
            else:
                raise ValueError("unknown subtitle operation")
            snapshot = workspace.model_dump(mode="json")
            snapshot.update(
                operation=operation,
                workspace_id=workspace.id,
                revision=workspace.revision,
                segment_ids=selected,
                idempotency_key=key,
                brand_rule_version=BRAND_RULE_VERSION,
            )
            if operation == "render":
                snapshot["render_layout_version"] = LAYOUT_VERSION
                snapshot["product_catalog_version"] = CATALOG_VERSION
                snapshot["encoding_policy_version"] = ENCODING_POLICY_VERSION
                snapshot["encoding_result"] = {
                    "source_asset_id": workspace.clean_video_asset_id,
                    "video_codec": "h264", "crf": workspace.crf,
                }
            resume_provider_task_id = None
            if retry_of:
                previous = next((t for t in tasks if t.id == retry_of), None)
                if previous is None or previous.status != Status.FAILED:
                    raise ValueError("only a failed stage can be retried")
                if (
                    operation == "render"
                    and (
                        previous.input_snapshot.get(
                            "writeback_revision", previous.input_snapshot["revision"]
                        ) != workspace.revision
                        or previous.input_snapshot.get("video_category", "unboxing")
                        != workspace.video_category
                        or previous.input_snapshot.get("render_mode", "png")
                        != workspace.render_mode
                        or frozen_crf(previous.input_snapshot) != workspace.crf
                    )
                ):
                    raise RevisionConflictError(
                        "render snapshot is stale; render the current draft"
                    )
                if operation == "render":
                    snapshot = {**previous.input_snapshot, "idempotency_key": key}
                    snapshot.setdefault("video_category", "unboxing")
                    if (
                        previous.input_snapshot.get("failure_reason")
                        != "provider_failed"
                    ):
                        resume_provider_task_id = previous.provider_task_id
                    if not resume_provider_task_id:
                        snapshot["crf"] = frozen_crf(snapshot)
                        snapshot.setdefault("render_mode", "png")
                        for field in ("encoding_result", "effective_render_mode", "layouts", "layout_warnings"):
                            snapshot.pop(field, None)
                        snapshot["render_layout_version"] = LAYOUT_VERSION
                        snapshot["brand_rule_version"] = BRAND_RULE_VERSION
                        snapshot["encoding_policy_version"] = ENCODING_POLICY_VERSION
            new = ToolTaskCreate(
                type=ToolTaskType.VIDEO_SUBTITLE_TRANSLATION,
                input_snapshot=snapshot,
                retry_of_task_id=retry_of,
                provider_task_id=resume_provider_task_id,
            )
            task_id = new.id
            created = True
            workspace.active_task_id = new.id
            workspace.stage_task_ids[operation] = new.id
            workspace.stage = BUSY[operation]
            if operation == "render":
                workspace.output_asset_id = None
            return workspace, new

        workspace = self.repository.mutate_subtitle_workspace(workspace_id, mutate)
        task = self.repository.get_tool_task(task_id)
        if created:
            self._event("queued", workspace, task)
            self.schedule(task.id)
        return task

    def schedule(self, task_id):
        if self.runner is not None and task_id not in self._scheduled:
            self._scheduled.add(task_id)
            self.runner.schedule(self.run(task_id))

    def retry(self, task_id):
        task = self.repository.get_tool_task(task_id)
        if (
            task.type != ToolTaskType.VIDEO_SUBTITLE_TRANSLATION
            or task.status != Status.FAILED
        ):
            raise ValueError("subtitle stage is not retryable")
        workspace = self.repository.get_subtitle_workspace(
            task.input_snapshot["workspace_id"]
        )
        return self.submit(
            workspace.id,
            task.input_snapshot["operation"],
            SubtitleStageRequest(expected_revision=workspace.revision),
            retry_of=task_id,
        )

    def recover(self):
        for task in self.repository.list_tool_tasks(
            task_type=ToolTaskType.VIDEO_SUBTITLE_TRANSLATION
        ):
            if task.status not in ACTIVE:
                continue
            snapshot = task.input_snapshot
            try:
                valid = (
                    snapshot.get("operation") in BUSY
                    and isinstance(snapshot.get("revision"), int)
                    and bool(snapshot.get("workspace_id"))
                )
                if not valid:
                    raise ValueError("invalid persisted stage")
                self.repository.get_subtitle_workspace(snapshot["workspace_id"])
            except (ValueError, NotFoundError):
                self.repository.update_tool_task(
                    task.id,
                    status=Status.FAILED,
                    finished_at=utc_now(),
                    error=ToolTaskError(
                        code=ErrorCode.VALIDATION_ERROR,
                        message="Subtitle workspace or snapshot is unavailable; create a new workspace.",
                    ),
                )
                continue
            if task.input_snapshot["operation"] == "render" and task.provider_task_id:
                self.schedule(task.id)
            else:
                self._complete(
                    task.id,
                    error="Stage interrupted by application restart; retry this stage.",
                )

    def _complete(self, task_id, *, result=None, error=None, failure_reason=None):
        task = self.repository.get_tool_task(task_id)
        operation = task.input_snapshot["operation"]

        def mutate(workspace, tasks):
            latest = next(t for t in tasks if t.id == task_id)
            if latest.status not in ACTIVE:
                return workspace, None
            stage_result = result
            if (not error and operation == "translate"
                    and latest.input_snapshot.get("brand_rule_version") == BRAND_RULE_VERSION):
                records = latest.input_snapshot["segments"]
                filtered = filter_brand_records(records)
                skipped = {records[i]["segment_id"] for i in filtered.skipped_indexes}
                stage_result = {
                    **result,
                    "translations": {sid: text for sid, text in result["translations"].items() if sid not in skipped},
                    "failed_ids": [sid for sid in result["failed_ids"] if sid not in skipped],
                    "skipped_brand_ids": sorted(skipped),
                }
            # Keep completion logic tied to the frozen task policy.
            result_for_task = stage_result or {}
            latest.status = Status.FAILED if error else Status.SUCCEEDED
            latest.finished_at = utc_now()
            latest.updated_at = utc_now()
            latest.error = (
                ToolTaskError(
                    code=ErrorCode.EXTERNAL_SERVICE_ERROR,
                    message=error[:255],
                    stage=operation,
                )
                if error
                else None
            )
            if not error and operation == "translate" and result_for_task.get("failed_ids"):
                latest.status = Status.FAILED
                latest.error = ToolTaskError(
                    code=ErrorCode.EXTERNAL_SERVICE_ERROR,
                    message="Some subtitles need translation; retry the missing segments.",
                    stage=operation,
                )
            latest.input_snapshot = {**latest.input_snapshot, "result": result_for_task}
            if failure_reason:
                latest.input_snapshot["failure_reason"] = failure_reason
            current = (
                workspace.active_task_id == task_id
                and workspace.revision
                == latest.input_snapshot.get(
                    "writeback_revision", latest.input_snapshot["revision"]
                )
                and (
                    operation != "render"
                    or workspace.video_category
                    == latest.input_snapshot.get("video_category", "unboxing")
                )
                and (
                    operation != "render"
                    or workspace.render_mode == latest.input_snapshot.get("render_mode", "png")
                )
                and (operation != "render" or workspace.crf == frozen_crf(latest.input_snapshot))
            )
            if current:
                workspace.active_task_id = None
                if error:
                    workspace.stage = SubtitleTranslationStage.FAILED
                elif operation == "extract":
                    records = result["segments"]
                    if latest.input_snapshot.get("brand_rule_version") == BRAND_RULE_VERSION:
                        records = self._effective_segments(records)
                    workspace.segments = [
                        SubtitleTranslationSegment.model_validate(s)
                        for s in records
                    ]
                    workspace.revision += 1
                    workspace.output_asset_id = None
                    workspace.stage_task_ids.pop("translate", None)
                    workspace.stage_task_ids.pop("render", None)
                    workspace.stage = SubtitleTranslationStage.EXTRACTED
                elif operation == "translate":
                    translations = result_for_task["translations"]
                    failed_ids = result_for_task["failed_ids"]
                    originals = {
                        s["segment_id"]: s.get("translated_text")
                        for s in latest.input_snapshot["segments"]
                    }
                    for segment in workspace.segments:
                        if (latest.input_snapshot.get("brand_rule_version") == BRAND_RULE_VERSION
                                and segment.segment_id in result_for_task.get("skipped_brand_ids", [])):
                            continue
                        if segment.excluded or segment.translated_text != originals.get(
                            segment.segment_id
                        ):
                            continue
                        if segment.segment_id in translations:
                            segment.translated_text = translations[
                                segment.segment_id
                            ]
                            segment.translation_status = "succeeded"
                            segment.product_mentions = result.get("product_mentions", {}).get(segment.segment_id, [])
                            segment.product_text_sha256 = result.get("product_text_sha256", {}).get(segment.segment_id)
                            self._refresh_products(segment)
                            segment.warnings = [
                                w
                                for w in segment.warnings
                                if not w.startswith("translation_pending:")
                            ]
                            segment.warnings.extend(result.get("warnings", {}).get(segment.segment_id, []))
                        elif segment.segment_id in failed_ids:
                            segment.translation_status = "failed"
                            segment.warnings = [
                                "translation_pending: retry or manually fill this segment"
                            ]
                    if "product_mentions" in result:
                        fingerprints = self._recognition_fingerprints(workspace.segments)
                        for segment in workspace.segments:
                            if segment.segment_id in translations and segment.translated_text == translations[segment.segment_id]:
                                segment.product_recognition_sha256 = fingerprints[segment.segment_id]
                    workspace.revision += 1
                    if translations:
                        workspace.output_asset_id = None
                    workspace.stage = SubtitleTranslationStage.REVIEW_READY
                    if latest.input_snapshot.get("brand_rule_version") == BRAND_RULE_VERSION:
                        self._brand_notices(workspace)
                else:
                    workspace.output_asset_id = result["output_asset_id"]
                    workspace.stage = SubtitleTranslationStage.SUCCEEDED
                    workspace.warnings = list(
                        dict.fromkeys(
                            [*workspace.warnings, *result.get("warnings", [])]
                        )
                    )
                    for segment in workspace.segments:
                        summary = result.get("layouts", {}).get(segment.segment_id, {})
                        for key in (*LAYOUT_FIELDS, "warnings"):
                            if key in summary:
                                value = summary[key]
                                if key == "render_bbox_pixels" and value is not None:
                                    value = tuple(value)
                                setattr(segment, key, value)
            return workspace, latest

        workspace = self.repository.mutate_subtitle_workspace(
            task.input_snapshot["workspace_id"], mutate
        )
        finished = self.repository.get_tool_task(task_id)
        self._event(
            "failed" if finished.status == Status.FAILED else "completed",
            workspace,
            finished,
        )

    def _record_uploaded_file(self, task_id, file_id):
        """Save upload metadata independently of result/draft writeback."""
        task = self.repository.get_tool_task(task_id)
        log_event(
            logger,
            "subtitle_translation.file_uploaded",
            outcome="succeeded",
            workspace_id=task.input_snapshot["workspace_id"],
            task_id=task_id,
            operation=task.input_snapshot["operation"],
            provider_file_id=file_id,
        )

        def mutate(workspace, tasks):
            latest = next(t for t in tasks if t.id == task_id)
            latest.input_snapshot = {
                **latest.input_snapshot,
                "provider_file_id": file_id,
                "provider_file_uploaded_at": utc_now().isoformat(),
            }
            latest.updated_at = utc_now()
            return workspace, latest

        self.repository.mutate_subtitle_workspace(
            task.input_snapshot["workspace_id"], mutate
        )

    async def run(self, task_id):
        running = asyncio.current_task()
        self._running.add(running)
        started = monotonic()
        task = self.repository.get_tool_task(task_id)
        if task.status not in ACTIVE:
            self._scheduled.discard(task_id)
            self._running.discard(running)
            return
        snapshot = task.input_snapshot
        try:
            claimed = False
            stale = False

            def claim(workspace, tasks):
                nonlocal claimed, stale
                latest = next(t for t in tasks if t.id == task.id)
                recoverable = (
                    latest.input_snapshot["operation"] == "render"
                    and latest.provider_task_id
                )
                stale = workspace.active_task_id != task.id
                # Render inputs are frozen; invalidating the current association
                # must not replace or cancel an already requested comparison.
                if stale and not recoverable and latest.input_snapshot["operation"] != "render":
                    return workspace, None
                if latest.status == Status.QUEUED or (
                    latest.status == Status.RUNNING and recoverable
                ):
                    latest.status = Status.RUNNING
                    latest.started_at = latest.started_at or utc_now()
                    claimed = True
                    return workspace, latest
                return workspace, None

            self.repository.mutate_subtitle_workspace(snapshot["workspace_id"], claim)
            if not claimed:
                if stale:
                    self._complete(
                        task.id,
                        error="Input changed before this stage started; execute the current draft.",
                    )
                return
            operation = snapshot["operation"]
            if operation == "extract":
                from backend.app.services.subtitle_translation_media import (
                    SubtitleTranslationMediaService,
                )
                from backend.app.services.video_subtitle_grounding import (
                    VideoSubtitleGroundingService, LegacyVideoSubtitleGroundingService,
                )

                grounding_class = (
                    VideoSubtitleGroundingService
                    if snapshot.get("brand_rule_version") == BRAND_RULE_VERSION
                    else LegacyVideoSubtitleGroundingService
                )
                grounding = self.grounding or grounding_class()
                media = self.media or SubtitleTranslationMediaService(
                    self.repository, self.asset_storage
                )

                async def on_file_uploaded(file_id):
                    self._record_uploaded_file(task.id, file_id)

                async with media.open_asset(
                    snapshot["reference_video_asset_id"], role="reference"
                ) as prepared:
                    response = await grounding.extract(
                        prepared,
                        sampling_fps=2.0,
                        on_file_uploaded=on_file_uploaded,
                    )
                result = {
                    "segments": [
                        SubtitleTranslationSegment(**s.model_dump()).model_dump(
                            mode="json"
                        )
                        for s in response.subtitles
                    ],
                    "usage": response.usage.model_dump(),
                }
            elif operation == "translate":
                from backend.app.services.modelark_subtitle_translation import (
                    ModelArkSubtitleTranslationAdapter, LegacySubtitleTranslationAdapter,
                )

                records = snapshot["segments"]
                selected = snapshot["segment_ids"]
                skipped_ids = []
                new_policy = snapshot.get("brand_rule_version") == BRAND_RULE_VERSION
                if new_policy:
                    filtered = filter_brand_records(records)
                    skipped_ids = [records[i]["segment_id"] for i in filtered.skipped_indexes]
                    records = list(filtered.kept)
                    selected = [sid for sid in selected if sid not in skipped_ids]
                translator_class = ModelArkSubtitleTranslationAdapter if new_policy else LegacySubtitleTranslationAdapter
                if selected:
                    translator = self.translator or translator_class()
                    result = await translator.translate(
                        records, segment_ids=selected,
                        source_language=snapshot["source_language"],
                        target_language=snapshot["target_language"],
                    )
                else:
                    result = {"translations": {}, "failed_ids": []}
                if new_policy:
                    result["skipped_brand_ids"] = sorted(skipped_ids)
                    result["failed_ids"] = [sid for sid in result["failed_ids"] if sid not in skipped_ids]
                    result["translations"] = {
                        sid: text for sid, text in result["translations"].items() if sid not in skipped_ids
                    }
            else:
                result = await self._render(task)
            # A persisted output survives linkage failure and is reused on recovery/retry.
            self._complete(task.id, result=result)
        except asyncio.CancelledError:
            if (
                snapshot["operation"] != "render"
                or not self.repository.get_tool_task(task.id).provider_task_id
            ):
                self._complete(task.id, error="Stage interrupted; retry this stage.")
            raise
        except Exception as exc:  # noqa: BLE001 - persist every background-stage failure
            # Provider payloads, signed URLs and subtitles must never leak through errors.
            log_event(
                logger,
                "subtitle_translation.stage_failed",
                outcome="failed",
                workspace_id=snapshot["workspace_id"],
                task_id=task.id,
                revision=snapshot["revision"],
                operation=snapshot["operation"],
                video_category=snapshot.get("video_category", "unboxing"),
                error_type=type(exc).__name__,
                duration_ms=round((monotonic() - started) * 1000),
            )
            from backend.app.services.subtitle_translation_layout import (
                SubtitleLayoutError,
            )

            message = (
                str(exc)
                if isinstance(exc, SubtitleLayoutError)
                else f"{snapshot['operation'].capitalize()} stage failed; retry this stage or check the input."
            )
            self._complete(
                task.id,
                error=message,
                failure_reason=str(exc)
                if isinstance(exc, SubtitleLayoutError)
                else getattr(exc, "code", None)
                if isinstance(getattr(exc, "code", None), str)
                else "local_failure",
            )
        finally:
            self._scheduled.discard(task_id)
            self._running.discard(running)

    async def _render(self, task):
        from backend.app.services.mediakit_multitrack import MediaKitMultiTrackClient
        from backend.app.services.subtitle_translation_media import (
            SubtitleTranslationMediaService,
        )

        snapshot = task.input_snapshot
        client = (self.mediakit_factory or MediaKitMultiTrackClient)()
        media = self.media or SubtitleTranslationMediaService(
            self.repository, self.asset_storage
        )
        layouts = snapshot.get("layouts", {})
        warnings = snapshot.get("layout_warnings", [])
        if not task.provider_task_id:
            snapshot = await self._resolve_render_encoding(task, media)
            render_segments = snapshot["segments"]
            if snapshot.get("brand_rule_version") == BRAND_RULE_VERSION:
                render_segments = self._effective_segments(render_segments)
            if self.compiler is None:
                from backend.app.services.subtitle_translation_layout import (
                    compile_subtitle_project,
                )

                compiler = compile_subtitle_project
            else:
                compiler = self.compiler
            video = {
                **snapshot["clean_video"],
                "url": self.asset_storage.signed_access_url(
                    self.repository.get_asset(snapshot["clean_video_asset_id"])
                ),
                "asset_id": snapshot["clean_video_asset_id"],
                "target_language": snapshot["target_language"],
                "video_category": snapshot.get("video_category", "unboxing"),
                "render_mode": snapshot["render_mode"],
                "crf": snapshot["crf"],
                "reference_duration_ms": (snapshot.get("reference_video") or {}).get(
                    "duration_ms"
                ),
            }
            compiled = await asyncio.to_thread(compiler, render_segments, video)
            if video["render_mode"] == "text" and isinstance(compiled, dict) and compiled.get("layers"):
                from backend.app.services.subtitle_translation_layout import SubtitleLayoutError

                raise SubtitleLayoutError("text_render_layers_unavailable")
            if isinstance(compiled, dict) and compiled.get("layers"):
                try:
                    await self.layers.prepare(snapshot["workspace_id"], compiled, submit=True)
                except asyncio.CancelledError:
                    raise
                except Exception:  # noqa: BLE001 - readable text fallback, never unresolved sources
                    previous = compiled
                    compiled = await asyncio.to_thread(
                        compile_text_subtitle_project, render_segments, video)
                    if compiled.get("layers"):
                        from backend.app.services.subtitle_translation_layout import SubtitleLayoutError

                        raise SubtitleLayoutError("product_layer_materialization_unavailable")
                    compiled.setdefault("warnings", []).extend(previous.get("warnings", []))
                    compiled.setdefault("warnings", []).append("product_layer_storage_unavailable")
                    for segment_id, summary in compiled.get("layouts", {}).items():
                        summary.setdefault("warnings", []).extend(
                            previous.get("layouts", {}).get(segment_id, {}).get("warnings", []))
                        summary.setdefault("warnings", []).append("product_layer_storage_unavailable")
            if isinstance(compiled, dict):
                project = compiled.get("project", compiled)
                layouts = compiled.get("layouts", {})
                warnings = compiled.get("warnings", [])
            else:
                project = compiled.project
                layouts = compiled.layouts
                warnings = getattr(compiled, "warnings", [])
            # Enforce the frozen policy even for injected or legacy compilers.
            apply_subtitle_output_policy(project, snapshot["crf"])
            effective = self._render_modes(project, layouts, snapshot["render_mode"])
            if snapshot["render_mode"] == "png" and effective != "png":
                warnings = list(dict.fromkeys([*warnings, f"png_{effective}_fallback"]))
            submitted = await client.submit(
                project=project, idempotency_key=snapshot["idempotency_key"]
            )

            def record_provider(workspace, tasks):
                latest = next(t for t in tasks if t.id == task.id)
                latest.provider_task_id = submitted.task_id
                latest.input_snapshot = {
                    **latest.input_snapshot,
                    "layouts": layouts,
                    "layout_warnings": warnings,
                    "effective_render_mode": effective,
                }
                return workspace, latest

            self.repository.mutate_subtitle_workspace(
                snapshot["workspace_id"], record_provider
            )
            task = self.repository.get_tool_task(task.id)
            log_event(
                logger,
                "subtitle_translation.submitted",
                outcome="succeeded",
                workspace_id=snapshot["workspace_id"],
                revision=snapshot["revision"],
                task_id=task.id,
                provider_task_id=task.provider_task_id,
                operation="render",
                video_category=snapshot.get("video_category", "unboxing"),
                segment_count=len(snapshot["segments"]),
                render_mode=snapshot["render_mode"],
                effective_render_mode=effective,
                video_codec="h264",
                crf=snapshot["crf"],
                encoding_policy_version=snapshot["encoding_policy_version"],
            )
        completed = await client.poll(task_id=task.provider_task_id)
        log_event(
            logger,
            "subtitle_translation.polled",
            outcome="succeeded",
            workspace_id=snapshot["workspace_id"],
            revision=snapshot["revision"],
            task_id=task.id,
            provider_task_id=task.provider_task_id,
            operation="render",
            video_category=snapshot.get("video_category", "unboxing"),
            render_mode=snapshot.get("render_mode"),
            effective_render_mode=task.input_snapshot.get("effective_render_mode"),
            encoding_policy_version=snapshot.get("encoding_policy_version"),
            video_codec=(snapshot.get("encoding_result") or {}).get("video_codec"),
            crf=(snapshot.get("encoding_result") or {}).get("crf"),
        )
        asset = await media.store_output(completed.output_video_url, task=task)
        return {
            "output_asset_id": asset.id,
            "layouts": layouts,
            "warnings": warnings,
            **{
                key: task.input_snapshot[key]
                for key in ("render_mode", "effective_render_mode", "encoding_policy_version")
                if key in task.input_snapshot
            },
            **{
                key: (task.input_snapshot.get("encoding_result") or {})[key]
                for key in ("video_codec", "crf")
                if key in (task.input_snapshot.get("encoding_result") or {})
            },
        }

    async def _resolve_render_encoding(self, task, media):
        """Freeze encoding before submission without changing workspace revision."""
        snapshot = task.input_snapshot
        if task.provider_task_id:
            return snapshot
        from backend.app.services.subtitle_translation_layout import LAYOUT_VERSION

        existing = snapshot.get("encoding_result")
        crf = frozen_crf(snapshot)
        if (snapshot.get("encoding_policy_version") == ENCODING_POLICY_VERSION
                and snapshot.get("render_layout_version") == LAYOUT_VERSION
                and snapshot.get("render_mode") in {"png", "text"}
                and existing == {
                    "source_asset_id": snapshot["clean_video_asset_id"],
                    "video_codec": "h264", "crf": crf,
                }):
            if type(snapshot.get("crf")) is int and snapshot["crf"] == crf:
                return snapshot
        mode = snapshot.get("render_mode", "png")
        if mode not in {"png", "text"}:
            raise ValueError("invalid render mode in frozen snapshot")
        result = {
            "source_asset_id": snapshot["clean_video_asset_id"],
            "video_codec": "h264", "crf": crf,
        }

        def freeze(workspace, tasks):
            latest = next(t for t in tasks if t.id == task.id)
            updated = {**latest.input_snapshot, "encoding_policy_version": ENCODING_POLICY_VERSION,
                       "encoding_result": result, "render_mode": mode, "crf": crf,
                       "render_layout_version": LAYOUT_VERSION}
            # Interrupted legacy tasks that never submitted acquire a new encoding identity.
            if (latest.input_snapshot.get("encoding_policy_version") != ENCODING_POLICY_VERSION
                    or "render_mode" not in latest.input_snapshot
                    or latest.input_snapshot.get("render_layout_version") != LAYOUT_VERSION
                    or type(latest.input_snapshot.get("crf")) is not int
                    or latest.input_snapshot.get("crf") != crf):
                updated["idempotency_key"] = hashlib.sha256(json.dumps(
                    [latest.input_snapshot["idempotency_key"], ENCODING_POLICY_VERSION, mode, LAYOUT_VERSION, crf],
                    separators=(",", ":"),
                ).encode()).hexdigest()
                for field in ("effective_render_mode", "layouts", "layout_warnings"):
                    updated.pop(field, None)
            latest.input_snapshot = updated
            return workspace, latest

        self.repository.mutate_subtitle_workspace(snapshot["workspace_id"], freeze)
        log_event(logger, "subtitle_translation.encoding_resolved", outcome="resolved",
                  task_id=task.id, source_asset_id=result["source_asset_id"],
                  render_mode=mode, video_codec="h264", crf=crf,
                  encoding_policy_version=ENCODING_POLICY_VERSION)
        return self.repository.get_tool_task(task.id).input_snapshot

    @staticmethod
    def _event(event, workspace, task=None):
        log_event(
            logger,
            f"subtitle_translation.{event}",
            outcome="failed"
            if event == "failed"
            else "started"
            if event == "queued"
            else "succeeded",
            workspace_id=workspace.id,
            revision=workspace.revision,
            task_id=task.id if task else None,
            operation=task.input_snapshot["operation"] if task else None,
            video_category=(
                task.input_snapshot.get("video_category", "unboxing")
                if task else workspace.video_category
            ),
            segment_count=len(workspace.segments),
            render_mode=task.input_snapshot.get("render_mode") if task else workspace.render_mode,
            effective_render_mode=task.input_snapshot.get("effective_render_mode") if task else None,
            encoding_policy_version=task.input_snapshot.get("encoding_policy_version") if task else None,
            video_codec=(task.input_snapshot.get("encoding_result") or {}).get("video_codec") if task else None,
            crf=(task.input_snapshot.get("encoding_result") or {}).get("crf") if task else None,
        )
