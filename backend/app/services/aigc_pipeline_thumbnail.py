from __future__ import annotations

import logging

from backend.app.core.config import ConfigurationError
from backend.app.repositories import (
    AigcPipelineThumbnailOutput,
    Repository,
)
from backend.app.schemas import (
    AigcPage,
    AigcPipeline,
    AigcPipelineThumbnail,
    AigcPipelineThumbnailCandidate,
    AigcPipelineThumbnailSource,
    AigcPipelineThumbnailUpdate,
    AigcThumbnailMediaKind,
)
from backend.app.services.assets import AssetStorageService

logger = logging.getLogger(__name__)


class AigcPipelineThumbnailValidationError(ValueError):
    """The requested asset cannot be used as a pipeline thumbnail."""


class AigcPipelineThumbnailService:
    def __init__(
        self,
        repository: Repository,
        asset_storage: AssetStorageService,
    ) -> None:
        self._repository = repository
        self._asset_storage = asset_storage

    def enrich_pipeline(self, pipeline: AigcPipeline) -> AigcPipeline:
        return self.enrich_pipelines([pipeline])[0]

    def enrich_pipelines(
        self,
        pipelines: list[AigcPipeline],
    ) -> list[AigcPipeline]:
        if not pipelines:
            return []
        outputs_by_pipeline = self._repository.list_aigc_pipeline_thumbnail_outputs(
            pipeline.id for pipeline in pipelines
        )
        return [
            pipeline.model_copy(
                update={
                    "thumbnail": self._resolve_thumbnail(
                        pipeline,
                        outputs_by_pipeline.get(pipeline.id, []),
                    )
                },
                deep=True,
            )
            for pipeline in pipelines
        ]

    def list_candidates(
        self,
        pipeline_id: str,
        *,
        page: int,
        page_size: int,
    ) -> AigcPage[AigcPipelineThumbnailCandidate]:
        self._repository.get_aigc_pipeline(pipeline_id)
        outputs = self._repository.list_aigc_pipeline_thumbnail_outputs(
            [pipeline_id]
        ).get(pipeline_id, [])
        candidates = [
            candidate
            for output in outputs
            if (
                candidate := self._candidate_from_output(
                    output,
                    source=None,
                )
            )
            is not None
        ]
        start = (page - 1) * page_size
        return AigcPage(
            items=candidates[start : start + page_size],
            page=page,
            page_size=page_size,
            total=len(candidates),
        )

    def set_thumbnail(
        self,
        pipeline_id: str,
        payload: AigcPipelineThumbnailUpdate,
    ) -> AigcPipeline:
        pipeline = self._repository.get_aigc_pipeline(pipeline_id)
        if payload.asset_id is not None:
            outputs = self._repository.list_aigc_pipeline_thumbnail_outputs(
                [pipeline_id]
            ).get(pipeline_id, [])
            selected = next(
                (
                    output
                    for output in outputs
                    if output.asset.id == payload.asset_id
                    and self._candidate_from_output(output, source=None) is not None
                ),
                None,
            )
            if selected is None:
                raise AigcPipelineThumbnailValidationError(
                    "asset is not an accessible pipeline output"
                )
        updated = self._repository.update_aigc_pipeline_thumbnail(
            pipeline.id,
            asset_id=payload.asset_id,
        )
        return self.enrich_pipeline(updated)

    def _resolve_thumbnail(
        self,
        pipeline: AigcPipeline,
        outputs: list[AigcPipelineThumbnailOutput],
    ) -> AigcPipelineThumbnail | None:
        if pipeline.thumbnail_asset_id is not None:
            pinned = next(
                (
                    output
                    for output in outputs
                    if output.asset.id == pipeline.thumbnail_asset_id
                ),
                None,
            )
            if pinned is not None:
                thumbnail = self._candidate_from_output(
                    pinned,
                    source=AigcPipelineThumbnailSource.PINNED,
                )
                if thumbnail is not None:
                    return thumbnail
        for output in outputs:
            thumbnail = self._candidate_from_output(
                output,
                source=AigcPipelineThumbnailSource.LATEST_OUTPUT,
            )
            if thumbnail is not None:
                return thumbnail
        return None

    def _candidate_from_output(
        self,
        output: AigcPipelineThumbnailOutput,
        *,
        source: AigcPipelineThumbnailSource | None,
    ) -> AigcPipelineThumbnail | AigcPipelineThumbnailCandidate | None:
        kind = _thumbnail_media_kind(output.asset.mime_type)
        if kind is None:
            return None
        url = self._signed_access_url(output)
        if url is None:
            return None
        if source is None:
            return AigcPipelineThumbnailCandidate(
                asset_id=output.asset.id,
                run_id=output.run_id,
                node_id=output.node_id,
                mime_type=output.asset.mime_type or "",
                kind=kind,
                url=url,
                created_at=output.asset.created_at,
            )
        return AigcPipelineThumbnail(
            asset_id=output.asset.id,
            mime_type=output.asset.mime_type or "",
            kind=kind,
            source=source,
            url=url,
        )

    def _signed_access_url(
        self,
        output: AigcPipelineThumbnailOutput,
    ) -> str | None:
        try:
            return self._asset_storage.signed_access_url(output.asset)
        except (ConfigurationError, OSError, RuntimeError, ValueError):
            logger.warning(
                "Unable to sign AIGC pipeline thumbnail asset",
                extra={"asset_id": output.asset.id},
            )
            return None


def _thumbnail_media_kind(mime_type: str | None) -> AigcThumbnailMediaKind | None:
    normalized = (mime_type or "").casefold()
    if normalized.startswith("image/"):
        return AigcThumbnailMediaKind.IMAGE
    if normalized.startswith("video/"):
        return AigcThumbnailMediaKind.VIDEO
    return None
