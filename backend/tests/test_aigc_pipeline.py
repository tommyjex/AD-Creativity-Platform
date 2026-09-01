from __future__ import annotations

import pytest

from backend.app.repositories import InMemoryRepository
from backend.app.schemas import (
    AigcPipelineCreate,
    AigcPipelineDefinition,
    AigcPipelineTemplateCreate,
    AigcPipelineTemplateUpdate,
    AigcPipelineUpdate,
    AigcSaveAsTemplateRequest,
    AigcTemplateInstantiateRequest,
)
from backend.app.services.aigc_dag import AigcDagValidationError
from backend.app.services.aigc_pipeline import AigcPipelineService


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
    assert instantiated.definition == draft
    assert pipeline.revision == 1
    assert saved_template.definition == draft


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
