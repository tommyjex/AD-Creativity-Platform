from __future__ import annotations

import pytest

from backend.app.schemas import AigcNodeType, AigcPipelineDefinition
from backend.app.services.aigc_dag import (
    AigcCacheCandidate,
    AigcDagValidationError,
    AigcPlanAction,
    AigcUpstreamDigest,
    build_aigc_execution_plan,
    canonical_aigc_input_hash,
    validate_aigc_dag,
    validate_aigc_dag_structure,
)


def node(node_id: str, node_type: str, x: int, *, config=None):
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": x, "y": 0},
        "size": {"width": 240, "height": 180},
        "config": config or {},
    }


def edge(
    edge_id: str,
    source: str,
    source_handle: str,
    target: str,
    target_handle: str,
):
    return {
        "id": edge_id,
        "sourceNodeId": source,
        "sourceHandle": source_handle,
        "targetNodeId": target,
        "targetHandle": target_handle,
    }


def chain_definition() -> AigcPipelineDefinition:
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("input", "text_input", 0, config={"text": "商品海报"}),
                node("llm", "llm", 300),
                node("image", "text_to_image", 600),
                node("output", "image_output", 900),
                node("independent-input", "text_input", 0, config={"text": "支线"}),
                node("independent-llm", "llm", 300),
            ],
            "edges": [
                edge("e1", "input", "text", "llm", "prompt"),
                edge("e2", "llm", "text", "image", "prompt"),
                edge("e3", "image", "image", "output", "image"),
                edge(
                    "e4",
                    "independent-input",
                    "text",
                    "independent-llm",
                    "prompt",
                ),
            ],
        }
    )


def image_to_image_definition(image_count: int) -> AigcPipelineDefinition:
    image_nodes = [
        node(
            f"image-{index}",
            "image_input",
            index * 100,
            config={"asset_id": f"asset-{index}"},
        )
        for index in range(image_count)
    ]
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                *image_nodes,
                node("prompt", "text_input", 0, config={"text": "商品海报"}),
                node("model", "image_to_image", 1200),
            ],
            "edges": [
                *[
                    edge(
                        f"image-edge-{index}",
                        f"image-{index}",
                        "image",
                        "model",
                        "image",
                    )
                    for index in range(image_count)
                ],
                edge("prompt-edge", "prompt", "text", "model", "prompt"),
            ],
        }
    )


def video_definition(
    mode: str,
    *,
    model: str = "doubao-seedance-2-5-260628",
    prompt: bool = False,
    first_frame: bool = False,
    last_frame: bool = False,
    reference_images: int = 0,
    reference_videos: int = 0,
    reference_audios: int = 0,
) -> AigcPipelineDefinition:
    nodes = [
        node(
            "video-model",
            "video_generation",
            1000,
            config={"model": model, "generation_mode": mode},
        )
    ]
    edges = []
    if prompt:
        nodes.append(node("prompt", "text_input", 0, config={"text": "生成视频"}))
        edges.append(edge("prompt-edge", "prompt", "text", "video-model", "prompt"))
    for handle, enabled in (
        ("first_frame", first_frame),
        ("last_frame", last_frame),
    ):
        if enabled:
            node_id = handle.replace("_", "-")
            nodes.append(
                node(
                    node_id,
                    "image_input",
                    0,
                    config={"asset_id": f"asset-{node_id}"},
                )
            )
            edges.append(
                edge(
                    f"{handle}-edge",
                    node_id,
                    "image",
                    "video-model",
                    handle,
                )
            )
    for handle, node_type, source_handle, count in (
        ("reference_images", "image_input", "image", reference_images),
        ("reference_videos", "video_input", "video", reference_videos),
        ("reference_audios", "audio_input", "audio", reference_audios),
    ):
        for index in range(count):
            node_id = f"{handle}-{index}"
            nodes.append(
                node(
                    node_id,
                    node_type,
                    index * 10,
                    config={"asset_id": f"asset-{node_id}"},
                )
            )
            edges.append(
                edge(
                    f"{handle}-edge-{index}",
                    node_id,
                    source_handle,
                    "video-model",
                    handle,
                )
            )
    return AigcPipelineDefinition.model_validate({"nodes": nodes, "edges": edges})


def definition_asset_ids(definition: AigcPipelineDefinition) -> set[str]:
    return {
        node.config.asset_id
        for node in definition.nodes
        if node.type.value in {"image_input", "video_input", "audio_input"}
        and node.config.asset_id
    }


def test_validate_aigc_dag_returns_stable_topological_order() -> None:
    order = validate_aigc_dag(chain_definition())

    assert order.index("input") < order.index("llm") < order.index("image")
    assert order.index("image") < order.index("output")
    assert order.index("independent-input") < order.index("independent-llm")


def test_schema_version_one_image_canvas_remains_valid() -> None:
    definition = chain_definition()
    order = validate_aigc_dag(definition)

    assert definition.schema_version == 1
    assert set(order) == {node.id for node in definition.nodes}


def test_validate_aigc_dag_rejects_cycle_and_self_loop() -> None:
    cyclic = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("first", "llm", 0),
                node("second", "llm", 300),
            ],
            "edges": [
                edge("e1", "first", "text", "second", "prompt"),
                edge("e2", "second", "text", "first", "prompt"),
            ],
        }
    )
    with pytest.raises(AigcDagValidationError, match="contains a cycle"):
        validate_aigc_dag(cyclic)

    self_loop = AigcPipelineDefinition.model_validate(
        {
            "nodes": [node("same", "llm", 0)],
            "edges": [edge("e1", "same", "text", "same", "prompt")],
        }
    )
    with pytest.raises(AigcDagValidationError, match="Self loops|self loops"):
        validate_aigc_dag(self_loop)


def test_validate_aigc_dag_rejects_invalid_ports_and_duplicate_inputs() -> None:
    mismatch = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node(
                    "image",
                    "image_input",
                    0,
                    config={"asset_id": "asset-1"},
                ),
                node("llm", "llm", 300),
            ],
            "edges": [edge("e1", "image", "image", "llm", "prompt")],
        }
    )
    with pytest.raises(AigcDagValidationError) as mismatch_error:
        validate_aigc_dag(mismatch, available_asset_ids={"asset-1"})
    assert mismatch_error.value.code == "port_type_mismatch"

    duplicate = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("first", "text_input", 0),
                node("second", "text_input", 0),
                node("llm", "llm", 300),
            ],
            "edges": [
                edge("e1", "first", "text", "llm", "prompt"),
                edge("e2", "second", "text", "llm", "prompt"),
            ],
        }
    )
    with pytest.raises(AigcDagValidationError) as duplicate_error:
        validate_aigc_dag(duplicate)
    assert duplicate_error.value.code == "input_already_connected"


@pytest.mark.parametrize("image_count", [1, 10])
def test_validate_aigc_dag_accepts_supported_image_input_counts(
    image_count: int,
) -> None:
    definition = image_to_image_definition(image_count)

    order = validate_aigc_dag(
        definition,
        available_asset_ids={
            f"asset-{index}" for index in range(image_count)
        },
    )

    assert order[-1] == "model"


def test_validate_aigc_dag_rejects_eleventh_image_input_with_location() -> None:
    definition = image_to_image_definition(11)

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag(
            definition,
            available_asset_ids={
                f"asset-{index}" for index in range(11)
            },
        )

    assert error.value.code == "input_connection_limit_exceeded"
    assert error.value.node_id == "model"
    assert error.value.edge_id == "image-edge-10"
    assert "at most 10" in str(error.value)


def test_validate_aigc_dag_rejects_identical_edge_with_location() -> None:
    definition = image_to_image_definition(1)
    definition.edges.insert(
        1,
        type(definition.edges[0]).model_validate(
            {
                **definition.edges[0].model_dump(by_alias=True),
                "id": "duplicate-image-edge",
            }
        ),
    )

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag(
            definition,
            available_asset_ids={"asset-0"},
        )

    assert error.value.code == "duplicate_edge"
    assert error.value.node_id == "model"
    assert error.value.edge_id == "duplicate-image-edge"


@pytest.mark.parametrize(
    "definition",
    [
        video_definition("text_to_video", prompt=True),
        video_definition("first_frame", first_frame=True),
        video_definition(
            "first_last_frame",
            first_frame=True,
            last_frame=True,
        ),
        video_definition(
            "multimodal_reference",
            reference_audios=1,
        ),
    ],
)
def test_validate_aigc_dag_accepts_all_video_generation_modes(
    definition: AigcPipelineDefinition,
) -> None:
    order = validate_aigc_dag(
        definition,
        available_asset_ids=definition_asset_ids(definition),
    )

    assert order[-1] == "video-model"


@pytest.mark.parametrize(
    ("mode", "kwargs", "error_code"),
    [
        ("text_to_video", {}, "required_input_missing"),
        ("first_frame", {}, "required_input_missing"),
        (
            "first_frame",
            {"first_frame": True, "last_frame": True},
            "input_not_allowed_for_mode",
        ),
        (
            "first_last_frame",
            {"first_frame": True},
            "required_input_missing",
        ),
        ("multimodal_reference", {}, "reference_input_required"),
        (
            "multimodal_reference",
            {"first_frame": True},
            "input_not_allowed_for_mode",
        ),
    ],
)
def test_validate_aigc_dag_rejects_invalid_video_mode_combinations(
    mode: str,
    kwargs: dict[str, bool],
    error_code: str,
) -> None:
    definition = video_definition(mode, **kwargs)

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag(
            definition,
            available_asset_ids=definition_asset_ids(definition),
        )

    assert error.value.code == error_code
    assert error.value.node_id == "video-model"


@pytest.mark.parametrize(
    ("model", "counts"),
    [
        (
            "doubao-seedance-2-5-260628",
            {"reference_images": 30, "reference_videos": 10, "reference_audios": 10},
        ),
        (
            "doubao-seedance-2-0-260128",
            {"reference_images": 9, "reference_videos": 3, "reference_audios": 3},
        ),
    ],
)
def test_validate_aigc_dag_accepts_video_reference_count_boundaries(
    model: str,
    counts: dict[str, int],
) -> None:
    definition = video_definition(
        "multimodal_reference",
        model=model,
        **counts,
    )

    assert validate_aigc_dag(
        definition,
        available_asset_ids=definition_asset_ids(definition),
    )[-1] == "video-model"


@pytest.mark.parametrize(
    ("handle", "count"),
    [
        ("reference_images", 10),
        ("reference_videos", 4),
        ("reference_audios", 4),
    ],
)
def test_validate_aigc_dag_applies_seedance_2_0_reference_limits(
    handle: str,
    count: int,
) -> None:
    definition = video_definition(
        "multimodal_reference",
        model="doubao-seedance-2-0-fast-260128",
        reference_images=count if handle == "reference_images" else 1,
        reference_videos=count if handle == "reference_videos" else 0,
        reference_audios=count if handle == "reference_audios" else 0,
    )

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag(
            definition,
            available_asset_ids=definition_asset_ids(definition),
        )

    assert error.value.code == "input_connection_limit_exceeded"
    assert error.value.node_id == "video-model"
    assert error.value.edge_id == f"{handle}-edge-{count - 1}"


@pytest.mark.parametrize(
    "model",
    [
        "doubao-seedance-2-0-260128",
        "doubao-seedance-2-0-fast-260128",
        "doubao-seedance-2-0-mini-260615",
    ],
)
def test_validate_aigc_dag_rejects_seedance_2_0_audio_only(
    model: str,
) -> None:
    definition = video_definition(
        "multimodal_reference",
        model=model,
        reference_audios=1,
    )

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag(
            definition,
            available_asset_ids=definition_asset_ids(definition),
        )

    assert error.value.code == "audio_only_not_supported"


def test_validate_aigc_dag_requires_reference_video_for_edit_or_extend() -> None:
    for task_type in ("edit", "extend"):
        definition = video_definition(
            "multimodal_reference",
            prompt=True,
            reference_images=1,
        )
        model = next(
            node for node in definition.nodes if node.id == "video-model"
        )
        model.config.task_type = task_type

        with pytest.raises(AigcDagValidationError) as error:
            validate_aigc_dag(
                definition,
                available_asset_ids=definition_asset_ids(definition),
            )

        assert error.value.code == "reference_video_required"


def test_validate_aigc_dag_rejects_video_audio_port_type_mismatch() -> None:
    definition = video_definition(
        "multimodal_reference",
        reference_videos=1,
    )
    definition.edges[0].target_handle = "reference_audios"

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag(
            definition,
            available_asset_ids=definition_asset_ids(definition),
        )

    assert error.value.code == "port_type_mismatch"


def test_validate_aigc_dag_accepts_video_output_and_rejects_image_output() -> None:
    definition = video_definition("text_to_video", prompt=True)
    definition.nodes.append(
        AigcPipelineDefinition.model_validate(
            {"nodes": [node("video-output", "video_output", 1200)]}
        ).nodes[0]
    )
    definition.edges.append(
        type(definition.edges[0]).model_validate(
            edge(
                "video-output-edge",
                "video-model",
                "video",
                "video-output",
                "video",
            )
        )
    )

    assert validate_aigc_dag(definition)[-1] == "video-output"

    definition.nodes[-1] = AigcPipelineDefinition.model_validate(
        {"nodes": [node("image-output", "image_output", 1200)]}
    ).nodes[0]
    definition.edges[-1] = type(definition.edges[0]).model_validate(
        edge(
            "image-output-edge",
            "video-model",
            "video",
            "image-output",
            "image",
        )
    )
    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag(definition)

    assert error.value.code == "port_type_mismatch"


def test_validate_aigc_dag_accepts_strict_bbox_reference_relationship() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node(
                    "image",
                    "image_input",
                    0,
                    config={
                        "asset_id": "asset-1",
                        "bbox_asset_id": "asset-1",
                        "bbox": {
                            "type": "bbox",
                            "x1": 100,
                            "y1": 200,
                            "x2": 700,
                            "y2": 800,
                        },
                    },
                ),
                node(
                    "prompt",
                    "text_input",
                    0,
                    config={
                        "text": "将",
                        "bbox_references": [
                            {
                                "source_node_id": "image",
                                "instruction": "替换为红色包装",
                            }
                        ],
                    },
                ),
                node("model", "image_to_image", 300),
            ],
            "edges": [
                edge("image-edge", "image", "image", "model", "image"),
                edge("prompt-edge", "prompt", "text", "model", "prompt"),
            ],
        }
    )

    assert validate_aigc_dag(
        definition,
        available_asset_ids={"asset-1"},
    )[-1] == "model"


@pytest.mark.parametrize(
    ("mutate", "error_code"),
    [
        ("missing_source", "bbox_reference_source_missing"),
        ("missing_bbox", "bbox_reference_bbox_missing"),
        ("non_image_downstream", "bbox_reference_downstream_invalid"),
        ("missing_shared_image", "bbox_reference_downstream_invalid"),
    ],
)
def test_validate_aigc_dag_rejects_invalid_bbox_reference_relationships(
    mutate: str,
    error_code: str,
) -> None:
    image_config = {
        "asset_id": "asset-1",
        "bbox_asset_id": "asset-1",
        "bbox": {
            "type": "bbox",
            "x1": 100,
            "y1": 200,
            "x2": 700,
            "y2": 800,
        },
    }
    reference_source = "missing" if mutate == "missing_source" else "image"
    if mutate == "missing_bbox":
        image_config = {"asset_id": "asset-1"}
    target_type = "llm" if mutate == "non_image_downstream" else "image_to_image"
    edges = [
        edge("prompt-edge", "prompt", "text", "model", "prompt"),
    ]
    if mutate not in {"missing_shared_image", "non_image_downstream"}:
        edges.insert(0, edge("image-edge", "image", "image", "model", "image"))
    definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("image", "image_input", 0, config=image_config),
                node(
                    "prompt",
                    "text_input",
                    0,
                    config={
                        "text": "编辑",
                        "bbox_references": [
                            {
                                "source_node_id": reference_source,
                                "instruction": "",
                            }
                        ],
                    },
                ),
                node("model", target_type, 300),
            ],
            "edges": edges,
        }
    )

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag(definition, available_asset_ids={"asset-1"})

    assert error.value.code == error_code
    assert error.value.node_id == "prompt"


def test_validate_aigc_dag_rejects_missing_inputs_assets_and_model() -> None:
    missing_input = AigcPipelineDefinition.model_validate(
        {"nodes": [node("llm", "llm", 0)]}
    )
    with pytest.raises(AigcDagValidationError) as input_error:
        validate_aigc_dag(missing_input)
    assert input_error.value.code == "required_input_missing"

    missing_asset = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("image", "image_input", 0, config={"asset_id": "missing"}),
                node("prompt", "text_input", 0),
                node("model", "image_to_image", 300),
            ],
            "edges": [
                edge("e1", "image", "image", "model", "image"),
                edge("e2", "prompt", "text", "model", "prompt"),
            ],
        }
    )
    with pytest.raises(AigcDagValidationError) as asset_error:
        validate_aigc_dag(missing_asset, available_asset_ids=set())
    assert asset_error.value.code == "asset_unavailable"

    no_model = AigcPipelineDefinition.model_validate(
        {"nodes": [node("input", "text_input", 0)]}
    )
    with pytest.raises(AigcDagValidationError) as model_error:
        validate_aigc_dag(no_model)
    assert model_error.value.code == "model_node_required"


def test_structure_validation_allows_empty_and_incomplete_drafts() -> None:
    empty = AigcPipelineDefinition()
    incomplete = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node(
                    "image",
                    "image_input",
                    0,
                    config={"asset_id": "temporarily-unavailable"},
                ),
                node("model", "image_to_image", 300),
            ],
            "edges": [
                edge("image-edge", "image", "image", "model", "image"),
            ],
        }
    )

    assert validate_aigc_dag_structure(empty) == ()
    assert validate_aigc_dag_structure(incomplete) == ("image", "model")

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag(incomplete, available_asset_ids=set())
    assert error.value.code == "asset_unavailable"


def test_structure_validation_still_rejects_invalid_connections() -> None:
    definition = video_definition("first_frame", prompt=True)
    definition.edges[0].target_handle = "first_frame"

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag_structure(definition)

    assert error.value.code == "port_type_mismatch"
    assert error.value.node_id == "video-model"
    assert error.value.edge_id == "prompt-edge"


def test_canonical_input_hash_is_order_independent_and_sensitive() -> None:
    first = canonical_aigc_input_hash(
        node_type=AigcNodeType.IMAGE_TO_IMAGE,
        executor_version="image-v1",
        model="seedream",
        config={"size": "2K", "format": "png"},
        upstream=[
            AigcUpstreamDigest("prompt", "text", "text", "digest-b"),
            AigcUpstreamDigest("image", "asset", "image", "digest-a"),
        ],
    )
    reordered = canonical_aigc_input_hash(
        node_type=AigcNodeType.IMAGE_TO_IMAGE,
        executor_version="image-v1",
        model="seedream",
        config={"format": "png", "size": "2K"},
        upstream=[
            AigcUpstreamDigest("image", "asset", "image", "digest-a"),
            AigcUpstreamDigest("prompt", "text", "text", "digest-b"),
        ],
    )
    changed = canonical_aigc_input_hash(
        node_type=AigcNodeType.IMAGE_TO_IMAGE,
        executor_version="image-v1",
        model="seedream",
        config={"format": "jpeg", "size": "2K"},
        upstream=[],
    )

    assert first == reordered
    assert first != changed
    assert len(first) == 64


def test_full_plan_executes_all_model_nodes() -> None:
    plan = build_aigc_execution_plan(chain_definition(), mode="full")

    assert plan.actions["input"] == AigcPlanAction.RESOLVE
    assert plan.actions["llm"] == AigcPlanAction.EXECUTE
    assert plan.actions["image"] == AigcPlanAction.EXECUTE
    assert plan.actions["output"] == AigcPlanAction.PROJECT
    assert plan.actions["independent-llm"] == AigcPlanAction.EXECUTE


def test_incremental_plan_reuses_valid_ancestors_and_ignores_independent_branch() -> None:
    plan = build_aigc_execution_plan(
        chain_definition(),
        mode="from_node",
        start_node_id="image",
        input_hashes={"llm": "hash-llm"},
        cache_candidates={
            "llm": AigcCacheCandidate(
                node_id="llm",
                input_hash="hash-llm",
                task_id="task-llm",
                output_available=True,
            )
        },
    )

    assert plan.actions["input"] == AigcPlanAction.RESOLVE
    assert plan.actions["llm"] == AigcPlanAction.REUSE
    assert plan.actions["image"] == AigcPlanAction.EXECUTE
    assert plan.actions["output"] == AigcPlanAction.PROJECT
    assert plan.actions["independent-llm"] == AigcPlanAction.IDLE
    assert plan.reused_from_task_ids == {"llm": "task-llm"}


def test_layer_canvas_incremental_plan_reuses_decomposition_but_full_recomputes() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node(
                    "source",
                    "image_input",
                    0,
                    config={"asset_id": "source-asset"},
                ),
                node(
                    "decompose",
                    "image_to_image",
                    300,
                    config={"operation": "layer_decomposition"},
                ),
                node("canvas", "layer_canvas", 600),
            ],
            "edges": [
                edge("source", "source", "image", "decompose", "image"),
                edge("layers", "decompose", "layers", "canvas", "layers"),
            ],
        }
    )
    candidate = AigcCacheCandidate(
        node_id="decompose",
        input_hash="decomposition-hash",
        task_id="decomposition-task",
        output_available=True,
    )

    full = build_aigc_execution_plan(
        definition,
        mode="full",
        input_hashes={"decompose": "decomposition-hash"},
        cache_candidates={"decompose": candidate},
    )
    incremental = build_aigc_execution_plan(
        definition,
        mode="from_node",
        start_node_id="canvas",
        input_hashes={"decompose": "decomposition-hash"},
        cache_candidates={"decompose": candidate},
    )

    assert full.actions["decompose"] == AigcPlanAction.EXECUTE
    assert full.actions["canvas"] == AigcPlanAction.EXECUTE
    assert incremental.actions["decompose"] == AigcPlanAction.REUSE
    assert incremental.reused_from_task_ids == {
        "decompose": "decomposition-task"
    }
    assert incremental.actions["canvas"] == AigcPlanAction.EXECUTE


def test_incremental_plan_closes_dependencies_of_all_downstream_branches() -> None:
    definition = layer_workflow_definition()
    candidate = AigcCacheCandidate(
        node_id="decompose",
        input_hash="decomposition-hash",
        task_id="decomposition-task",
        output_available=True,
    )

    plan = build_aigc_execution_plan(
        definition,
        mode="from_node",
        start_node_id="canvas",
        input_hashes={"decompose": "decomposition-hash"},
        cache_candidates={"decompose": candidate},
        available_asset_ids={"source-image"},
    )

    assert plan.actions == {
        "input": AigcPlanAction.RESOLVE,
        "decompose": AigcPlanAction.REUSE,
        "canvas": AigcPlanAction.EXECUTE,
        "prompt": AigcPlanAction.RESOLVE,
        "edit": AigcPlanAction.EXECUTE,
        "composite": AigcPlanAction.EXECUTE,
        "output": AigcPlanAction.PROJECT,
    }
    assert plan.reused_from_task_ids == {
        "decompose": "decomposition-task"
    }


def test_incremental_plan_executes_external_deterministic_dependency() -> None:
    definition = layer_workflow_definition()

    plan = build_aigc_execution_plan(
        definition,
        mode="from_node",
        start_node_id="prompt",
        input_hashes={
            "decompose": "decomposition-hash",
            "canvas": "canvas-hash",
        },
        cache_candidates={
            "decompose": AigcCacheCandidate(
                node_id="decompose",
                input_hash="decomposition-hash",
                task_id="decomposition-task",
                output_available=True,
            ),
            "canvas": AigcCacheCandidate(
                node_id="canvas",
                input_hash="canvas-hash",
                task_id="canvas-task",
                output_available=True,
            ),
        },
        available_asset_ids={"source-image"},
    )

    assert plan.actions["decompose"] == AigcPlanAction.REUSE
    assert plan.actions["canvas"] == AigcPlanAction.EXECUTE
    assert plan.actions["prompt"] == AigcPlanAction.RESOLVE
    assert plan.actions["edit"] == AigcPlanAction.EXECUTE
    assert plan.reused_from_task_ids == {
        "decompose": "decomposition-task"
    }


@pytest.mark.parametrize(
    ("output_available", "expected_action"),
    [
        (True, AigcPlanAction.REUSE),
        (False, AigcPlanAction.EXECUTE),
    ],
)
def test_incremental_plan_reuses_external_model_dependency_only_when_available(
    output_available: bool,
    expected_action: AigcPlanAction,
) -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("source-prompt", "text_input", 0, config={"text": "参考图"}),
                node("source-model", "text_to_image", 200),
                node("start-prompt", "text_input", 200, config={"text": "改成红色"}),
                node("target-model", "image_to_image", 400),
                node("output", "image_output", 600),
                node("unrelated-prompt", "text_input", 0, config={"text": "无关"}),
                node("unrelated-model", "llm", 200),
            ],
            "edges": [
                edge(
                    "source-prompt-edge",
                    "source-prompt",
                    "text",
                    "source-model",
                    "prompt",
                ),
                edge(
                    "source-image-edge",
                    "source-model",
                    "image",
                    "target-model",
                    "image",
                ),
                edge(
                    "target-prompt-edge",
                    "start-prompt",
                    "text",
                    "target-model",
                    "prompt",
                ),
                edge(
                    "output-edge",
                    "target-model",
                    "image",
                    "output",
                    "image",
                ),
                edge(
                    "unrelated-edge",
                    "unrelated-prompt",
                    "text",
                    "unrelated-model",
                    "prompt",
                ),
            ],
        }
    )

    plan = build_aigc_execution_plan(
        definition,
        mode="from_node",
        start_node_id="start-prompt",
        input_hashes={"source-model": "source-hash"},
        cache_candidates={
            "source-model": AigcCacheCandidate(
                node_id="source-model",
                input_hash="source-hash",
                task_id="source-task",
                output_available=output_available,
            )
        },
    )

    assert plan.actions["source-prompt"] == AigcPlanAction.RESOLVE
    assert plan.actions["source-model"] == expected_action
    assert plan.actions["start-prompt"] == AigcPlanAction.RESOLVE
    assert plan.actions["target-model"] == AigcPlanAction.EXECUTE
    assert plan.actions["output"] == AigcPlanAction.PROJECT
    assert plan.actions["unrelated-prompt"] == AigcPlanAction.IDLE
    assert plan.actions["unrelated-model"] == AigcPlanAction.IDLE


def test_incremental_plan_recomputes_missing_ancestor_and_downstream() -> None:
    plan = build_aigc_execution_plan(
        chain_definition(),
        mode="from_node",
        start_node_id="image",
        input_hashes={"llm": "current-hash"},
        cache_candidates={
            "llm": AigcCacheCandidate(
                node_id="llm",
                input_hash="old-hash",
                task_id="task-old",
                output_available=True,
            )
        },
    )

    assert plan.actions["llm"] == AigcPlanAction.EXECUTE
    assert plan.actions["image"] == AigcPlanAction.EXECUTE
    assert plan.reused_from_task_ids == {}


def test_incremental_plan_reuses_video_ancestor_with_matching_hash() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("prompt", "text_input", 0, config={"text": "生成视频"}),
                node("source-video", "video_generation", 300),
                node(
                    "target-video",
                    "video_generation",
                    600,
                    config={"generation_mode": "multimodal_reference"},
                ),
                node("output", "video_output", 900),
            ],
            "edges": [
                edge(
                    "source-prompt",
                    "prompt",
                    "text",
                    "source-video",
                    "prompt",
                ),
                edge(
                    "video-reference",
                    "source-video",
                    "video",
                    "target-video",
                    "reference_videos",
                ),
                edge(
                    "video-output",
                    "target-video",
                    "video",
                    "output",
                    "video",
                ),
            ],
        }
    )

    plan = build_aigc_execution_plan(
        definition,
        mode="from_node",
        start_node_id="target-video",
        input_hashes={"source-video": "video-hash"},
        cache_candidates={
            "source-video": AigcCacheCandidate(
                node_id="source-video",
                input_hash="video-hash",
                task_id="video-task",
                output_available=True,
            )
        },
    )

    assert plan.actions["source-video"] == AigcPlanAction.REUSE
    assert plan.actions["target-video"] == AigcPlanAction.EXECUTE
    assert plan.actions["output"] == AigcPlanAction.PROJECT
    assert plan.reused_from_task_ids == {"source-video": "video-task"}


def layer_workflow_definition() -> AigcPipelineDefinition:
    digest = "a" * 64
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node(
                    "input",
                    "image_input",
                    0,
                    config={"asset_id": "source-image"},
                ),
                node(
                    "decompose",
                    "image_to_image",
                    200,
                    config={
                        "operation": "layer_decomposition",
                        "size": "auto",
                    },
                ),
                node(
                    "canvas",
                    "layer_canvas",
                    400,
                    config={
                        "selected_layer_id": "layer-1",
                        "source_layer_set": {
                            "id": "layer-set-1",
                            "version": 0,
                            "digest": digest,
                        },
                    },
                ),
                node("prompt", "text_input", 400, config={"text": "改成红色"}),
                node(
                    "edit",
                    "image_to_image",
                    600,
                    config={"operation": "image_edit"},
                ),
                node("composite", "layer_composite", 800),
                node("output", "image_output", 1000),
            ],
            "edges": [
                edge("input-edge", "input", "image", "decompose", "image"),
                edge("layers-edge", "decompose", "layers", "canvas", "layers"),
                edge(
                    "selected-edge",
                    "canvas",
                    "selected_layer",
                    "edit",
                    "edit_layer",
                ),
                edge("prompt-edge", "prompt", "text", "edit", "prompt"),
                edge(
                    "composite-layers",
                    "canvas",
                    "layers",
                    "composite",
                    "layers",
                ),
                edge(
                    "replacement-edge",
                    "edit",
                    "edited_layer",
                    "composite",
                    "replacement",
                ),
                edge(
                    "output-edge",
                    "composite",
                    "image",
                    "output",
                    "image",
                ),
            ],
        }
    )


def test_validate_aigc_dag_accepts_complete_layer_workflow() -> None:
    definition = layer_workflow_definition()

    order = validate_aigc_dag(
        definition,
        available_asset_ids={"source-image"},
    )

    assert order.index("decompose") < order.index("canvas")
    assert order.index("canvas") < order.index("edit")
    assert order.index("edit") < order.index("composite")


def test_layer_decomposition_allows_optional_prompt_and_only_layers_output() -> None:
    definition = layer_workflow_definition()
    definition.nodes = [
        item for item in definition.nodes if item.id in {"input", "decompose", "canvas"}
    ]
    definition.edges = [
        item for item in definition.edges if item.id in {"input-edge", "layers-edge"}
    ]

    assert validate_aigc_dag(
        definition,
        available_asset_ids={"source-image"},
    ) == ("input", "decompose", "canvas")


def test_layer_decomposition_rejects_second_image() -> None:
    definition = layer_workflow_definition()
    definition.nodes.append(
        AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    node(
                        "second-input",
                        "image_input",
                        0,
                        config={"asset_id": "second-image"},
                    )
                ]
            }
        ).nodes[0]
    )
    definition.edges.insert(
        1,
        type(definition.edges[0]).model_validate(
            edge(
                "second-input-edge",
                "second-input",
                "image",
                "decompose",
                "image",
            )
        ),
    )

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag(
            definition,
            available_asset_ids={"source-image", "second-image"},
        )

    assert error.value.code == "input_connection_limit_exceeded"
    assert error.value.edge_id == "second-input-edge"


def test_layer_decomposition_requires_seedream_5_pro() -> None:
    definition = layer_workflow_definition()
    model = next(item for item in definition.nodes if item.id == "decompose")
    model.config.model = "another-image-model"

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag_structure(definition)

    assert error.value.code == "model_not_supported_for_operation"
    assert error.value.node_id == "decompose"


def test_image_edit_accepts_exactly_one_plain_image_target() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node(
                    "image",
                    "image_input",
                    0,
                    config={"asset_id": "asset-1"},
                ),
                node("prompt", "text_input", 0, config={"text": "编辑"}),
                node(
                    "edit",
                    "image_to_image",
                    300,
                    config={"operation": "image_edit"},
                ),
                node("output", "image_output", 600),
            ],
            "edges": [
                edge("image-edge", "image", "image", "edit", "edit_image"),
                edge("prompt-edge", "prompt", "text", "edit", "prompt"),
                edge("output-edge", "edit", "image", "output", "image"),
            ],
        }
    )

    assert validate_aigc_dag(
        definition,
        available_asset_ids={"asset-1"},
    )[-1] == "output"


def test_image_edit_rejects_both_targets_and_wrong_output() -> None:
    definition = layer_workflow_definition()
    definition.nodes.append(
        AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    node(
                        "plain-image",
                        "image_input",
                        400,
                        config={"asset_id": "plain-image"},
                    )
                ]
            }
        ).nodes[0]
    )
    definition.edges.append(
        type(definition.edges[0]).model_validate(
            edge(
                "plain-edit-edge",
                "plain-image",
                "image",
                "edit",
                "edit_image",
            )
        )
    )

    with pytest.raises(AigcDagValidationError) as conflict:
        validate_aigc_dag(
            definition,
            available_asset_ids={"source-image", "plain-image"},
        )
    assert conflict.value.code == "image_edit_target_conflict"
    assert conflict.value.node_id == "edit"

    definition.edges = [
        item for item in definition.edges if item.id != "plain-edit-edge"
    ]
    output_edge = next(item for item in definition.edges if item.id == "output-edge")
    output_edge.source_node_id = "edit"
    output_edge.source_handle = "image"
    with pytest.raises(AigcDagValidationError) as wrong_output:
        validate_aigc_dag(
            definition,
            available_asset_ids={"source-image", "plain-image"},
        )
    assert wrong_output.value.code == "output_not_allowed_for_operation"


def test_operation_switch_preserves_but_rejects_incompatible_edge() -> None:
    definition = image_to_image_definition(1)
    definition.nodes.append(
        AigcPipelineDefinition.model_validate(
            {"nodes": [node("output", "image_output", 1500)]}
        ).nodes[0]
    )
    definition.edges.append(
        type(definition.edges[0]).model_validate(
            edge("output-edge", "model", "image", "output", "image")
        )
    )
    model = next(item for item in definition.nodes if item.id == "model")
    model.config.operation = "layer_decomposition"

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag_structure(definition)

    assert error.value.code == "output_not_allowed_for_operation"
    assert error.value.edge_id == "output-edge"
    assert len(definition.edges) == 3


def test_layer_canvas_selected_output_requires_selection() -> None:
    definition = layer_workflow_definition()
    canvas = next(item for item in definition.nodes if item.id == "canvas")
    canvas.config.selected_layer_id = None

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag_structure(definition)

    assert error.value.code == "selected_layer_required"
    assert error.value.node_id == "canvas"


def test_full_plan_executes_layer_control_nodes() -> None:
    definition = layer_workflow_definition()

    plan = build_aigc_execution_plan(
        definition,
        mode="full",
        available_asset_ids={"source-image"},
    )

    assert plan.actions["decompose"] == AigcPlanAction.EXECUTE
    assert plan.actions["canvas"] == AigcPlanAction.EXECUTE
    assert plan.actions["edit"] == AigcPlanAction.EXECUTE
    assert plan.actions["composite"] == AigcPlanAction.EXECUTE
