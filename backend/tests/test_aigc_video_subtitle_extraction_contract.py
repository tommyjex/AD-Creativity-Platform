import pytest
from pydantic import ValidationError

from backend.app.schemas import (
    AIGC_V2_NODE_REGISTRY,
    AigcNodeType,
    AigcPipelineDefinitionV2,
    AigcTaskType,
    AigcPipelineRunNode,
    AigcResultAsset,
    AigcResultKind,
    AigcRunNodeStatus,
    AigcTaskResult,
    AssetCreate,
    AssetRole,
    AssetType,
    Status,
    ToolAssetRole,
)
from backend.app.repositories import InMemoryRepository
from backend.app.services.aigc_executor import AigcPipelineRuntime
from backend.app.services.aigc_dag import (
    AigcDagValidationError,
    validate_aigc_dag,
)


def _node(node_id: str, node_type: str, x: int, config=None):
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": x, "y": 0},
        "size": {"width": 240, "height": 180},
        "config": config or {},
    }


def _edge(source: str, source_handle: str, target: str, target_handle: str):
    return {
        "id": f"{source}-{target}-{target_handle}",
        "sourceNodeId": source,
        "sourceHandle": source_handle,
        "targetNodeId": target,
        "targetHandle": target_handle,
    }


def test_video_subtitle_extraction_contract_and_defaults() -> None:
    definition = AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                _node("video", "video", 0),
                _node("ocr", "video_subtitle_extraction", 300),
                _node("edit", "multi_track_edit", 600),
            ],
            "edges": [
                _edge("video", "video", "ocr", "video"),
                _edge("ocr", "subtitle", "edit", "subtitles"),
            ],
        }
    )

    ocr = next(node for node in definition.nodes if node.id == "ocr")
    registration = next(
        item
        for item in AIGC_V2_NODE_REGISTRY
        if item.type == AigcNodeType.VIDEO_SUBTITLE_EXTRACTION
    )
    assert ocr.config.mode == "Subtitle"
    assert registration.inputs[0].type.value == "video_asset"
    assert registration.outputs[0].type.value == "subtitle_asset"
    assert AigcTaskType.VIDEO_SUBTITLE_EXTRACTION.value == (
        "video_subtitle_extraction"
    )
    validate_aigc_dag(definition, require_complete=True)


def test_video_subtitle_extraction_rejects_detailed_mode() -> None:
    with pytest.raises(ValidationError):
        AigcPipelineDefinitionV2.model_validate(
            {
                "schemaVersion": 2,
                "nodes": [
                    _node(
                        "ocr",
                        "video_subtitle_extraction",
                        0,
                        {"mode": "Detailed"},
                    )
                ],
                "edges": [],
            }
        )


def test_video_subtitle_extraction_rejects_wrong_input_type() -> None:
    definition = AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                _node("image", "image", 0),
                _node("ocr", "video_subtitle_extraction", 300),
            ],
            "edges": [_edge("image", "image", "ocr", "video")],
        }
    )

    with pytest.raises(AigcDagValidationError) as exc_info:
        validate_aigc_dag(definition, require_complete=True)

    assert exc_info.value.code == "port_type_mismatch"


def test_multi_track_snapshot_adds_upstream_subtitle_track() -> None:
    repository = InMemoryRepository()
    repository.create_asset(
        AssetCreate(
            id="ocr-subtitle",
            tool_asset_role=ToolAssetRole.OUTPUT,
            type=AssetType.SUBTITLE,
            asset_role=AssetRole.PUBLIC,
            status=Status.SUCCEEDED,
            object_key="aigc/ocr-subtitle.srt",
            mime_type="application/x-subrip",
            size_bytes=48,
            metadata={"duration_seconds": 8.5},
        )
    )
    definition = AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                _node("ocr", "video_subtitle_extraction", 0),
                _node(
                    "edit",
                    "multi_track_edit",
                    300,
                    {
                        "canvas": {
                            "mode": "auto",
                            "width": None,
                            "height": None,
                            "background_color": "#000000FF",
                        },
                        "output": {"format": "mp4", "fps": 30},
                        "tracks": [
                            {
                                "id": "text-track",
                                "name": "Text",
                                "type": "text",
                                "order": 0,
                                "elements": [
                                    {
                                        "id": "text-element",
                                        "type": "text",
                                        "inline_text": "Base",
                                        "target_time": {
                                            "start_ms": 0,
                                            "end_ms": 8500,
                                        },
                                        "transform": {
                                            "x": 100,
                                            "y": 100,
                                            "width": 400,
                                            "height": 100,
                                        },
                                    }
                                ],
                            }
                        ],
                    },
                ),
            ],
            "edges": [_edge("ocr", "subtitle", "edit", "subtitles")],
        }
    )
    nodes = {node.id: node for node in definition.nodes}
    run_nodes = {
        "ocr": AigcPipelineRunNode(
            node_id="ocr",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(
                kind=AigcResultKind.ASSETS,
                assets=[
                    AigcResultAsset(
                        asset_id="ocr-subtitle",
                        ordinal=0,
                        mime_type="application/x-subrip",
                    )
                ],
            ),
        ),
        "edit": AigcPipelineRunNode(
            node_id="edit",
            included_in_plan=True,
        ),
    }
    runtime = AigcPipelineRuntime(repository, object())  # type: ignore[arg-type]

    params, upstream = runtime._resolve_task_params(
        nodes["edit"],
        definition.edges,
        nodes,
        run_nodes,
        all_edges=definition.edges,
    )

    project = params["project"]
    assert isinstance(project, dict)
    assert [track["type"] for track in project["tracks"]] == [
        "text",
        "subtitle",
    ]
    assert project["tracks"][1]["elements"][0]["asset_id"] == "ocr-subtitle"
    assert project["tracks"][1]["elements"][0]["target_time"]["end_ms"] == 8500
    assert upstream == ["ocr"]
