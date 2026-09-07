from __future__ import annotations

import pytest

from backend.app.repositories import InMemoryRepository
from backend.app.schemas import (
    AigcPipelineCreate,
    AigcPipelineDefinition,
    AigcPipelineDefinitionV2,
    AigcPipelineTemplateCreate,
    AigcPipelineTemplateUpdate,
    AigcPipelineUpdate,
    AigcSaveAsTemplateRequest,
    AigcTemplateInstantiateRequest,
)
from backend.app.services.aigc_dag import AigcDagValidationError
from backend.app.services.aigc_pipeline import (
    AigcPipelineService,
    prepare_aigc_definition_for_save,
)


def incomplete_definition() -> AigcPipelineDefinition:
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                {
                    "id": "model",
                    "type": "video_generation",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 280, "height": 200},
                    "config": {"generation_mode": "first_last_frame"},
                }
            ],
            "edges": [],
        }
    )


def invalid_definition() -> AigcPipelineDefinition:
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                {
                    "id": "prompt",
                    "type": "text_input",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 240, "height": 180},
                    "config": {"text": "生成视频"},
                },
                {
                    "id": "model",
                    "type": "video_generation",
                    "position": {"x": 320, "y": 0},
                    "size": {"width": 280, "height": 200},
                    "config": {"generation_mode": "first_frame"},
                },
            ],
            "edges": [
                {
                    "id": "invalid-edge",
                    "sourceNodeId": "prompt",
                    "sourceHandle": "text",
                    "targetNodeId": "model",
                    "targetHandle": "first_frame",
                }
            ],
        }
    )


def test_service_all_save_entries_accept_incomplete_drafts() -> None:
    repository = InMemoryRepository()
    service = AigcPipelineService(repository)
    draft = incomplete_definition()

    template = service.create_template(
        AigcPipelineTemplateCreate(name="草稿模板", definition=draft)
    )
    template = service.update_template(
        template.id,
        AigcPipelineTemplateUpdate(
            name=template.name,
            definition=draft,
            expected_revision=template.revision,
        ),
    )
    instantiated = service.instantiate_template(
        template.id,
        AigcTemplateInstantiateRequest(),
    )
    pipeline = service.create_pipeline(
        AigcPipelineCreate(name="草稿画布", definition=draft)
    )
    pipeline = service.update_pipeline(
        pipeline.id,
        AigcPipelineUpdate(
            name=pipeline.name,
            definition=draft,
            expected_revision=pipeline.revision,
        ),
    )
    saved_template = service.save_pipeline_as_template(
        pipeline.id,
        AigcSaveAsTemplateRequest(name="另存模板"),
    )

    assert template.revision == 1
    assert instantiated.definition.schema_version == 2
    assert instantiated.definition == prepare_aigc_definition_for_save(
        draft,
        for_template=True,
    )
    assert pipeline.revision == 1
    assert pipeline.definition.schema_version == 2
    assert saved_template.definition == prepare_aigc_definition_for_save(
        draft,
        for_template=True,
    )


def test_service_revalidates_legacy_definitions_before_copying() -> None:
    repository = InMemoryRepository()
    service = AigcPipelineService(repository)
    invalid = invalid_definition()
    legacy_template = repository.create_aigc_template(
        AigcPipelineTemplateCreate(name="历史模板", definition=invalid)
    )
    legacy_pipeline = repository.create_aigc_pipeline(
        AigcPipelineCreate(name="历史画布", definition=invalid)
    )

    with pytest.raises(AigcDagValidationError) as instantiate_error:
        service.instantiate_template(
            legacy_template.id,
            AigcTemplateInstantiateRequest(),
        )
    assert instantiate_error.value.code == "port_type_mismatch"

    with pytest.raises(AigcDagValidationError) as save_as_error:
        service.save_pipeline_as_template(
            legacy_pipeline.id,
            AigcSaveAsTemplateRequest(name="非法副本"),
        )
    assert save_as_error.value.code == "port_type_mismatch"


def test_v2_template_sanitize_clears_local_media_and_bbox_references() -> None:
    definition = AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                {
                    "id": "image",
                    "type": "image",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 240, "height": 180},
                    "config": {
                        "asset_id": "local-image",
                        "bbox_asset_id": "local-image",
                        "bbox": {
                            "type": "bbox",
                            "x1": 100,
                            "y1": 200,
                            "x2": 700,
                            "y2": 800,
                        },
                        "title": None,
                    },
                },
                {
                    "id": "video",
                    "type": "video",
                    "position": {"x": 0, "y": 220},
                    "size": {"width": 240, "height": 180},
                    "config": {"asset_id": "local-video", "title": "成片"},
                },
                {
                    "id": "audio",
                    "type": "audio",
                    "position": {"x": 0, "y": 440},
                    "size": {"width": 240, "height": 180},
                    "config": {"asset_id": "local-audio", "title": None},
                },
                {
                    "id": "text",
                    "type": "text",
                    "position": {"x": 300, "y": 0},
                    "size": {"width": 240, "height": 180},
                    "config": {
                        "text": "保留普通文本",
                        "bbox_references": [
                            {
                                "source_node_id": "image",
                                "instruction": "删除此说明",
                            }
                        ],
                        "title": None,
                    },
                },
                {
                    "id": "image-producer",
                    "type": "text_to_image",
                    "position": {"x": -300, "y": 0},
                    "size": {"width": 240, "height": 180},
                    "config": {},
                },
            ],
            "edges": [
                {
                    "id": "upstream-image",
                    "sourceNodeId": "image-producer",
                    "sourceHandle": "image",
                    "targetNodeId": "image",
                    "targetHandle": "image",
                }
            ],
        }
    )

    sanitized = prepare_aigc_definition_for_save(
        definition,
        for_template=True,
    )
    by_id = {node.id: node for node in sanitized.nodes}

    assert by_id["image"].config.asset_id is None  # type: ignore[union-attr]
    assert by_id["image"].config.bbox is None  # type: ignore[union-attr]
    assert by_id["image"].config.bbox_asset_id is None  # type: ignore[union-attr]
    assert by_id["video"].config.asset_id is None  # type: ignore[union-attr]
    assert by_id["audio"].config.asset_id is None  # type: ignore[union-attr]
    assert by_id["text"].config.text == "保留普通文本"  # type: ignore[union-attr]
    assert by_id["text"].config.bbox_references == []  # type: ignore[union-attr]
    assert sanitized.edges == definition.edges


def test_v2_template_preserves_multitrack_structure_and_inline_text_but_clears_srt() -> None:
    definition = AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                {
                    "id": "edit",
                    "type": "multi_track_edit",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 320, "height": 240},
                    "config": {
                        "canvas": {
                            "mode": "custom",
                            "width": 1920,
                            "height": 1080,
                            "background_color": "#000000FF",
                        },
                        "output": {"format": "mp4", "fps": 30},
                        "tracks": [
                            {
                                "id": "text-track",
                                "name": "文案",
                                "type": "text",
                                "elements": [
                                    {
                                        "id": "text-1",
                                        "type": "text",
                                        "target_time": {
                                            "start_ms": 0,
                                            "end_ms": 3000,
                                        },
                                        "inline_text": "模板内联文案",
                                        "transform": {
                                            "x": 100,
                                            "y": 100,
                                            "width": 800,
                                            "height": 200,
                                        },
                                    }
                                ],
                            },
                            {
                                "id": "subtitle-track",
                                "name": "字幕",
                                "type": "subtitle",
                                "elements": [
                                    {
                                        "id": "subtitle-1",
                                        "type": "subtitle",
                                        "target_time": {
                                            "start_ms": 0,
                                            "end_ms": 3000,
                                        },
                                        "asset_id": "srt-secret-asset",
                                        "transform": {
                                            "x": 100,
                                            "y": 800,
                                            "width": 1720,
                                            "height": 180,
                                        },
                                    }
                                ],
                            },
                            {
                                "id": "subtitle-track-2",
                                "name": "字幕 2",
                                "type": "subtitle",
                                "elements": [
                                    {
                                        "id": "subtitle-2",
                                        "type": "subtitle",
                                        "target_time": {
                                            "start_ms": 3000,
                                            "end_ms": 6000,
                                        },
                                        "asset_id": "srt-secret-asset-2",
                                        "transform": {
                                            "x": 100,
                                            "y": 800,
                                            "width": 1720,
                                            "height": 180,
                                        },
                                    }
                                ],
                            },
                        ],
                    },
                }
            ],
            "edges": [],
        }
    )

    sanitized = prepare_aigc_definition_for_save(definition, for_template=True)
    node = sanitized.nodes[0]
    assert node.type.value == "multi_track_edit"
    assert len(node.config.tracks) == 3  # type: ignore[union-attr]
    assert node.config.tracks[0].elements[0].inline_text == "模板内联文案"  # type: ignore[union-attr]
    assert node.config.tracks[1].elements[0].asset_id is None  # type: ignore[union-attr]
    assert node.config.tracks[2].elements[0].asset_id is None  # type: ignore[union-attr]
