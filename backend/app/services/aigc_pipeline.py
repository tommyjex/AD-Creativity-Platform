from __future__ import annotations

from backend.app.repositories import Repository
from backend.app.schemas import (
    AigcNodeRegistryResponse,
    AigcPipeline,
    AigcPipelineCreate,
    AigcPipelineDefinition,
    AigcPipelineTemplate,
    AigcPipelineTemplateCreate,
    AigcPipelineTemplateUpdate,
    AigcPipelineUpdate,
    AigcSaveAsTemplateRequest,
    AigcTemplateInstantiateRequest,
)
from backend.app.services.aigc_dag import validate_aigc_dag_structure


class AigcPipelineService:
    def __init__(self, repository: Repository) -> None:
        self.repository = repository

    @staticmethod
    def node_registry() -> AigcNodeRegistryResponse:
        return AigcNodeRegistryResponse()

    def create_template(
        self,
        data: AigcPipelineTemplateCreate,
    ) -> AigcPipelineTemplate:
        return self.repository.create_aigc_template(
            data.model_copy(
                update={
                    "definition": prepare_aigc_definition_for_save(
                        data.definition,
                        for_template=True,
                    )
                },
                deep=True,
            )
        )

    def update_template(
        self,
        template_id: str,
        data: AigcPipelineTemplateUpdate,
    ) -> AigcPipelineTemplate:
        return self.repository.update_aigc_template(
            template_id,
            data.model_copy(
                update={
                    "definition": prepare_aigc_definition_for_save(
                        data.definition,
                        for_template=True,
                    )
                },
                deep=True,
            ),
        )

    def delete_template(self, template_id: str) -> None:
        self.repository.delete_aigc_template(template_id)

    def instantiate_template(
        self,
        template_id: str,
        data: AigcTemplateInstantiateRequest,
    ) -> AigcPipeline:
        template = self.repository.get_aigc_template(template_id)
        return self.repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name=data.name or template.name,
                description=template.description,
                definition=prepare_aigc_definition_for_save(
                    template.definition
                ),
                source_template_id=template.id,
                source_template_revision=template.revision,
            )
        )

    def create_pipeline(self, data: AigcPipelineCreate) -> AigcPipeline:
        return self.repository.create_aigc_pipeline(
            data.model_copy(
                update={
                    "definition": prepare_aigc_definition_for_save(
                        data.definition
                    )
                },
                deep=True,
            )
        )

    def update_pipeline(
        self,
        pipeline_id: str,
        data: AigcPipelineUpdate,
    ) -> AigcPipeline:
        return self.repository.update_aigc_pipeline(
            pipeline_id,
            data.model_copy(
                update={
                    "definition": prepare_aigc_definition_for_save(
                        data.definition
                    )
                },
                deep=True,
            ),
        )

    def delete_pipeline(self, pipeline_id: str) -> None:
        self.repository.delete_aigc_pipeline(pipeline_id)

    def save_pipeline_as_template(
        self,
        pipeline_id: str,
        data: AigcSaveAsTemplateRequest,
    ) -> AigcPipelineTemplate:
        pipeline = self.repository.get_aigc_pipeline(pipeline_id)
        return self.repository.create_aigc_template(
            AigcPipelineTemplateCreate(
                name=data.name,
                description=data.description,
                definition=prepare_aigc_definition_for_save(
                    pipeline.definition,
                    for_template=True,
                ),
            )
        )


def prepare_aigc_definition_for_save(
    definition: AigcPipelineDefinition,
    *,
    for_template: bool = False,
) -> AigcPipelineDefinition:
    canonical = canonicalize_aigc_definition(
        definition,
        for_template=for_template,
    )
    validate_aigc_dag_structure(canonical)
    return canonical


def canonicalize_aigc_definition(
    definition: AigcPipelineDefinition,
    *,
    for_template: bool = False,
) -> AigcPipelineDefinition:
    payload = definition.model_dump(mode="json", by_alias=True)
    if for_template:
        nodes = payload.get("nodes", [])
        if isinstance(nodes, list):
            for node in nodes:
                if not isinstance(node, dict):
                    continue
                config = node.get("config")
                if not isinstance(config, dict):
                    continue
                if node.get("type") in {
                    "image_input",
                    "video_input",
                    "audio_input",
                }:
                    config["asset_id"] = None
                    if node.get("type") == "image_input":
                        config["bbox"] = None
                        config["bbox_asset_id"] = None
                elif node.get("type") == "text_input":
                    config["bbox_references"] = []
    return AigcPipelineDefinition.model_validate(payload)
