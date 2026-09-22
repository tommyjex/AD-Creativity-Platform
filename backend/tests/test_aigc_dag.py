from __future__ import annotations

import pytest

from backend.app.aigc_run_scope import (
    AigcDagValidationError as ScopeValidationError,
    aigc_connected_node_ids as scope_connected_node_ids,
    aigc_downstream_node_ids as scope_downstream_node_ids,
    aigc_projection_node_ids as scope_projection_node_ids,
    aigc_run_conflict_node_ids as scope_run_conflict_node_ids,
    aigc_run_projection_node_ids as scope_run_projection_node_ids,
)
from backend.app.schemas import (
    AigcNodeType,
    AigcPipelineDefinition,
    AigcPipelineDefinitionV2,
    AigcPipelineRunMode,
)
from backend.app.services.aigc_dag import (
    AigcCacheCandidate,
    AigcDagValidationError,
    AigcPlanAction,
    AigcUpstreamDigest,
    aigc_connected_node_ids,
    aigc_downstream_node_ids,
    aigc_projection_node_ids,
    aigc_run_conflict_node_ids,
    aigc_run_projection_node_ids,
    build_aigc_execution_plan,
    canonical_aigc_input_hash,
    validate_aigc_dag,
    validate_aigc_dag_structure,
)


def test_aigc_dag_reexports_repository_neutral_scope_api() -> None:
    assert AigcDagValidationError is ScopeValidationError
    assert aigc_connected_node_ids is scope_connected_node_ids
    assert aigc_downstream_node_ids is scope_downstream_node_ids
    assert aigc_projection_node_ids is scope_projection_node_ids
    assert aigc_run_conflict_node_ids is scope_run_conflict_node_ids
    assert aigc_run_projection_node_ids is scope_run_projection_node_ids


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


def v2_definition(
    nodes: list[dict[str, object]],
    edges: list[dict[str, object]] | None = None,
) -> AigcPipelineDefinitionV2:
    return AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": nodes,
            "edges": edges or [],
        }
    )


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


def disconnected_definition() -> AigcPipelineDefinitionV2:
    return v2_definition(
        [
            node("flow-a-input", "text", 0),
            node("flow-a-model", "llm", 300),
            node("flow-a-output", "text", 600),
            node("flow-a-branch", "text", 600),
            node("flow-b-input", "text", 0),
            node("flow-b-model", "llm", 300),
            node("isolated", "text", 900),
        ],
        [
            edge(
                "flow-a-input-model",
                "flow-a-input",
                "text",
                "flow-a-model",
                "prompt",
            ),
            edge(
                "flow-a-model-output",
                "flow-a-model",
                "text",
                "flow-a-output",
                "text",
            ),
            edge(
                "flow-a-model-branch",
                "flow-a-model",
                "text",
                "flow-a-branch",
                "text",
            ),
            edge(
                "flow-b-input-model",
                "flow-b-input",
                "text",
                "flow-b-model",
                "prompt",
            ),
        ],
    )


def shared_upstream_branch_definition() -> AigcPipelineDefinitionV2:
    return v2_definition(
        [
            node("root", "text", 0),
            node("shared", "text", 200),
            node("branch-a", "text", 400),
            node("output-a", "text", 600),
            node("branch-b", "text", 400),
            node("output-b", "text", 600),
        ],
        [
            edge("root-shared", "root", "text", "shared", "text"),
            edge("shared-a", "shared", "text", "branch-a", "text"),
            edge("a-output", "branch-a", "text", "output-a", "text"),
            edge("shared-b", "shared", "text", "branch-b", "text"),
            edge("b-output", "branch-b", "text", "output-b", "text"),
        ],
    )


def test_aigc_connected_node_ids_handles_chains_branches_and_isolated_nodes() -> None:
    definition = disconnected_definition()

    assert aigc_connected_node_ids(
        definition,
        "flow-a-output",
    ) == frozenset(
        {
            "flow-a-input",
            "flow-a-model",
            "flow-a-output",
            "flow-a-branch",
        }
    )
    assert aigc_connected_node_ids(
        definition,
        "flow-b-model",
    ) == frozenset({"flow-b-input", "flow-b-model"})
    assert aigc_connected_node_ids(
        definition,
        "isolated",
    ) == frozenset({"isolated"})


def test_aigc_connected_node_ids_canonicalizes_legacy_definition() -> None:
    assert aigc_connected_node_ids(
        chain_definition(),
        "output",
    ) == frozenset({"input", "llm", "image", "output"})


def test_aigc_branch_scopes_separate_conflicts_from_projection() -> None:
    definition = shared_upstream_branch_definition()

    assert aigc_downstream_node_ids(
        definition,
        "branch-a",
    ) == frozenset({"branch-a", "output-a"})
    assert aigc_projection_node_ids(
        definition,
        "branch-a",
    ) == frozenset({"root", "shared", "branch-a", "output-a"})
    assert aigc_run_conflict_node_ids(
        definition,
        mode=AigcPipelineRunMode.FROM_NODE,
        start_node_id="branch-b",
    ) == frozenset({"branch-b", "output-b"})
    assert aigc_run_projection_node_ids(
        definition,
        mode=AigcPipelineRunMode.RETRY_NODE,
        start_node_id="branch-b",
    ) == frozenset({"root", "shared", "branch-b", "output-b"})


def test_aigc_shared_upstream_scope_conflicts_with_every_branch() -> None:
    definition = shared_upstream_branch_definition()

    assert aigc_run_conflict_node_ids(
        definition,
        mode=AigcPipelineRunMode.FROM_NODE,
        start_node_id="shared",
    ) == frozenset(
        {"shared", "branch-a", "output-a", "branch-b", "output-b"}
    )


def test_local_validation_ignores_invalid_sibling_configuration() -> None:
    definition = v2_definition(
        [
            node("root", "text", 0),
            node("shared", "llm", 200),
            node("branch-a", "llm", 400),
            node("invalid-branch-b", "image_to_image", 400),
        ],
        [
            edge("root-shared", "root", "text", "shared", "prompt"),
            edge("shared-a", "shared", "text", "branch-a", "prompt"),
            edge(
                "shared-b",
                "shared",
                "text",
                "invalid-branch-b",
                "prompt",
            ),
        ],
    )

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag(definition)
    assert error.value.code == "required_input_missing"
    assert error.value.node_id == "invalid-branch-b"

    projection = aigc_projection_node_ids(definition, "branch-a")
    assert validate_aigc_dag(
        definition,
        validation_node_ids=projection,
    )[-1] == "invalid-branch-b"


def test_local_validation_still_rejects_sibling_structure_errors() -> None:
    definition = shared_upstream_branch_definition()
    definition.edges[-1] = definition.edges[-1].model_copy(
        update={"source_handle": "missing-output"}
    )

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag(
            definition,
            require_complete=False,
            validation_node_ids=aigc_projection_node_ids(
                definition,
                "branch-a",
            ),
        )

    assert error.value.code == "source_port_missing"
    assert error.value.edge_id == "b-output"


def test_aigc_full_run_scope_contains_every_node() -> None:
    definition = disconnected_definition()
    expected = frozenset(node.id for node in definition.nodes)

    assert aigc_run_conflict_node_ids(
        definition,
        mode=AigcPipelineRunMode.FULL,
        start_node_id=None,
    ) == expected
    assert aigc_run_projection_node_ids(
        definition,
        mode=AigcPipelineRunMode.FULL,
        start_node_id=None,
    ) == expected


@pytest.mark.parametrize(
    ("mode", "start_node_id"),
    [
        (AigcPipelineRunMode.FROM_NODE, None),
        (AigcPipelineRunMode.FROM_NODE, "missing"),
        (AigcPipelineRunMode.RETRY_NODE, None),
        (AigcPipelineRunMode.RETRY_NODE, "missing"),
    ],
)
@pytest.mark.parametrize(
    "scope",
    [aigc_run_conflict_node_ids, aigc_run_projection_node_ids],
)
def test_aigc_run_scope_rejects_missing_start_node(
    scope,
    mode: AigcPipelineRunMode,
    start_node_id: str | None,
) -> None:
    with pytest.raises(AigcDagValidationError) as error:
        scope(
            disconnected_definition(),
            mode=mode,
            start_node_id=start_node_id,
        )

    assert error.value.code == "start_node_missing"
    assert error.value.node_id == start_node_id


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


def test_llm_accepts_one_optional_image_input_and_rejects_duplicates() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("prompt", "text_input", 0, config={"text": "分析图片"}),
                node(
                    "image",
                    "image_input",
                    0,
                    config={"asset_id": "asset-image"},
                ),
                node("llm", "llm", 300),
            ],
            "edges": [
                edge("prompt-edge", "prompt", "text", "llm", "prompt"),
                edge("image-edge", "image", "image", "llm", "image"),
            ],
        }
    )

    assert validate_aigc_dag(
        definition,
        available_asset_ids={"asset-image"},
    ) == ("prompt", "image", "llm")

    duplicate = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                *[
                    item.model_dump(mode="json", by_alias=True)
                    for item in definition.nodes
                ],
                node(
                    "image-two",
                    "image_input",
                    0,
                    config={"asset_id": "asset-image-two"},
                ),
            ],
            "edges": [
                *[
                    item.model_dump(mode="json", by_alias=True)
                    for item in definition.edges
                ],
                edge("image-two-edge", "image-two", "image", "llm", "image"),
            ],
        }
    )
    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag(
            duplicate,
            available_asset_ids={"asset-image", "asset-image-two"},
        )
    assert error.value.code == "input_already_connected"


def test_v2_modality_nodes_participate_in_topology_but_not_execution() -> None:
    definition = v2_definition(
        [
            node("source", "text", 0, config={"text": "商品"}),
            node("relay", "text", 200, config={"text": "备用"}),
            node("model", "llm", 400),
            node("terminal", "text", 600),
        ],
        [
            edge("source-relay", "source", "text", "relay", "text"),
            edge("relay-model", "relay", "text", "model", "prompt"),
            edge("model-terminal", "model", "text", "terminal", "text"),
        ],
    )

    plan = build_aigc_execution_plan(definition, mode="full")

    assert plan.topological_order == ("source", "relay", "model", "terminal")
    assert plan.actions == {
        "source": AigcPlanAction.RESOLVE,
        "relay": AigcPlanAction.PROJECT,
        "model": AigcPlanAction.EXECUTE,
        "terminal": AigcPlanAction.PROJECT,
    }
    assert plan.executable_node_ids == ("model",)


def test_v2_modality_validation_rejects_second_input_and_wrong_type() -> None:
    duplicate = v2_definition(
        [
            node("first", "text", 0, config={"text": "一"}),
            node("second", "text", 0, config={"text": "二"}),
            node("relay", "text", 300),
            node("model", "llm", 600),
        ],
        [
            edge("first-relay", "first", "text", "relay", "text"),
            edge("second-relay", "second", "text", "relay", "text"),
            edge("relay-model", "relay", "text", "model", "prompt"),
        ],
    )
    with pytest.raises(AigcDagValidationError) as duplicate_error:
        validate_aigc_dag(duplicate)
    assert duplicate_error.value.code == "input_already_connected"
    assert duplicate_error.value.node_id == "relay"
    assert duplicate_error.value.edge_id == "second-relay"

    mismatch = v2_definition(
        [
            node("image", "image", 0),
            node("text", "text", 300),
            node("model", "llm", 600),
        ],
        [
            edge("wrong-type", "image", "image", "text", "text"),
            edge("text-model", "text", "text", "model", "prompt"),
        ],
    )
    with pytest.raises(AigcDagValidationError) as mismatch_error:
        validate_aigc_dag(mismatch)
    assert mismatch_error.value.code == "port_type_mismatch"
    assert mismatch_error.value.edge_id == "wrong-type"


def test_v2_modality_validation_rejects_self_loop_and_indirect_cycle() -> None:
    self_loop = v2_definition(
        [
            node("same", "text", 0),
            node("model", "llm", 300),
        ],
        [
            edge("self", "same", "text", "same", "text"),
            edge("same-model", "same", "text", "model", "prompt"),
        ],
    )
    with pytest.raises(AigcDagValidationError) as self_loop_error:
        validate_aigc_dag(self_loop)
    assert self_loop_error.value.code == "self_loop"
    assert self_loop_error.value.edge_id == "self"

    cycle = v2_definition(
        [
            node("first", "text", 0),
            node("second", "text", 200),
            node("model", "llm", 400),
        ],
        [
            edge("first-second", "first", "text", "second", "text"),
            edge("second-first", "second", "text", "first", "text"),
            edge("second-model", "second", "text", "model", "prompt"),
        ],
    )
    with pytest.raises(AigcDagValidationError) as cycle_error:
        validate_aigc_dag(cycle)
    assert cycle_error.value.code == "cycle_detected"


def test_v2_empty_terminal_is_idle_and_pure_modality_pipeline_is_rejected() -> None:
    definition = v2_definition(
        [
            node("prompt", "text", 0, config={"text": "商品"}),
            node("model", "llm", 300),
            node("empty-terminal", "image", 600),
        ],
        [edge("prompt-model", "prompt", "text", "model", "prompt")],
    )

    plan = build_aigc_execution_plan(definition, mode="full")

    assert plan.actions["empty-terminal"] == AigcPlanAction.IDLE

    pure_modality = v2_definition(
        [
            node("source", "text", 0, config={"text": "商品"}),
            node("relay", "text", 300),
        ],
        [edge("source-relay", "source", "text", "relay", "text")],
    )
    with pytest.raises(AigcDagValidationError) as pure_error:
        build_aigc_execution_plan(pure_modality, mode="full")
    assert pure_error.value.code == "model_node_required"


def test_from_modality_node_reuses_model_ancestor_and_projects_relay() -> None:
    definition = v2_definition(
        [
            node("source", "text", 0, config={"text": "商品"}),
            node("producer", "llm", 200),
            node("relay", "text", 400, config={"text": "不得回退"}),
            node("consumer", "llm", 600),
        ],
        [
            edge("source-producer", "source", "text", "producer", "prompt"),
            edge("producer-relay", "producer", "text", "relay", "text"),
            edge("relay-consumer", "relay", "text", "consumer", "prompt"),
        ],
    )

    plan = build_aigc_execution_plan(
        definition,
        mode="from_node",
        start_node_id="relay",
        input_hashes={"producer": "producer-hash"},
        cache_candidates={
            "producer": AigcCacheCandidate(
                node_id="producer",
                input_hash="producer-hash",
                task_id="producer-task",
                output_available=True,
            )
        },
    )

    assert plan.actions == {
        "source": AigcPlanAction.RESOLVE,
        "producer": AigcPlanAction.REUSE,
        "relay": AigcPlanAction.PROJECT,
        "consumer": AigcPlanAction.EXECUTE,
    }
    assert plan.executable_node_ids == ("consumer",)
    assert plan.reused_from_task_ids == {"producer": "producer-task"}


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


def test_validate_v2_dag_accepts_paused_bbox_reference_relationship() -> None:
    definition = v2_definition(
        [
            node("image-producer", "text_to_image", 0),
            node("text-producer", "llm", 0),
            node(
                "image",
                "image",
                300,
                config={
                    "asset_id": "local-image",
                    "bbox_asset_id": "local-image",
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
                "text",
                300,
                config={
                    "text": "编辑",
                    "bbox_references": [
                        {
                            "source_node_id": "image",
                            "instruction": "保留说明",
                        }
                    ],
                },
            ),
            node("model", "image_to_image", 600),
        ],
        [
            edge(
                "image-upstream",
                "image-producer",
                "image",
                "image",
                "image",
            ),
            edge(
                "text-upstream",
                "text-producer",
                "text",
                "prompt",
                "text",
            ),
            edge("image-edge", "image", "image", "model", "image"),
            edge("prompt-edge", "prompt", "text", "model", "prompt"),
        ],
    )

    assert validate_aigc_dag_structure(definition)[-1] == "model"


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


def test_validate_aigc_dag_rejects_missing_inputs_and_model() -> None:
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
    assert validate_aigc_dag(
        missing_asset,
        available_asset_ids=set(),
    ) == ("image", "prompt", "model")

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
    assert error.value.code == "required_input_missing"


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


def test_full_plan_executes_multi_track_edit_with_four_multi_inputs() -> None:
    definition = v2_definition(
        [
            node("video-a", "video", 0, config={"asset_id": "video-a"}),
            node("video-b", "video", 0, config={"asset_id": "video-b"}),
            node("image", "image", 0, config={"asset_id": "image"}),
            node("audio", "audio", 0, config={"asset_id": "audio"}),
            node("text", "text", 0, config={"text": "标题"}),
            node(
                "edit",
                "multi_track_edit",
                300,
                config={
                    "canvas": {
                        "mode": "custom",
                        "width": 1920,
                        "height": 1080,
                    },
                    "tracks": [
                        {
                            "id": "video-track",
                            "name": "视频",
                            "type": "video",
                            "elements": [
                                {
                                    "id": "video-element",
                                    "type": "video",
                                    "source": {
                                        "source_node_id": "video-a",
                                        "source_handle": "video",
                                    },
                                    "target_time": {
                                        "start_ms": 0,
                                        "end_ms": 2000,
                                    },
                                    "transform": {
                                        "x": 0,
                                        "y": 0,
                                        "width": 1920,
                                        "height": 1080,
                                    },
                                }
                            ],
                        }
                    ],
                },
            ),
        ],
        [
            edge("video-a-edit", "video-a", "video", "edit", "videos"),
            edge("video-b-edit", "video-b", "video", "edit", "videos"),
            edge("image-edit", "image", "image", "edit", "images"),
            edge("audio-edit", "audio", "audio", "edit", "audios"),
            edge("text-edit", "text", "text", "edit", "texts"),
        ],
    )

    plan = build_aigc_execution_plan(definition, mode="full")

    assert plan.actions["edit"] == AigcPlanAction.EXECUTE
    assert plan.executable_node_ids == ("edit",)


def test_json_parser_requires_one_text_input_and_participates_in_plan() -> None:
    definition = v2_definition(
        [
            node("source", "text", 0, config={"text": '{"items":["one"]}'}),
            node(
                "parser",
                "json_parser",
                300,
                config={"json_path": "$.items"},
            ),
        ],
        [edge("source-parser", "source", "text", "parser", "text")],
    )

    plan = build_aigc_execution_plan(definition, mode="full")

    assert plan.topological_order == ("source", "parser")
    assert plan.actions["parser"] == AigcPlanAction.EXECUTE
    assert plan.executable_node_ids == ("parser",)

    missing = definition.model_copy(update={"edges": []}, deep=True)
    with pytest.raises(AigcDagValidationError) as missing_error:
        validate_aigc_dag(missing)
    assert missing_error.value.code == "required_input_missing"
    assert missing_error.value.node_id == "parser"


def test_json_parser_output_only_accepts_matching_managed_text_nodes() -> None:
    definition = v2_definition(
        [
            node("source", "text", 0, config={"text": '{"items":["one"]}'}),
            node("parser", "json_parser", 300),
            node(
                "managed",
                "text",
                600,
                config={
                    "text": "one",
                    "generated_by_parser_node_id": "parser",
                    "generated_item_index": 0,
                    "generated_from_run_id": "run-1",
                },
            ),
        ],
        [
            edge("source-parser", "source", "text", "parser", "text"),
            edge("parser-managed", "parser", "items", "managed", "text"),
        ],
    )

    assert validate_aigc_dag_structure(definition) == (
        "source",
        "parser",
        "managed",
    )

    payload = definition.model_dump(mode="json", by_alias=True)
    payload["nodes"][2]["config"].pop("generated_by_parser_node_id")
    payload["nodes"][2]["config"].pop("generated_item_index")
    payload["nodes"][2]["config"].pop("generated_from_run_id")
    manual = AigcPipelineDefinitionV2.model_validate(payload)
    with pytest.raises(AigcDagValidationError) as manual_error:
        validate_aigc_dag_structure(manual)
    assert manual_error.value.code == "system_output_connection_invalid"
    assert manual_error.value.edge_id == "parser-managed"

    payload = definition.model_dump(mode="json", by_alias=True)
    payload["nodes"][2]["config"]["generated_by_parser_node_id"] = "other-parser"
    wrong_owner = AigcPipelineDefinitionV2.model_validate(payload)
    with pytest.raises(AigcDagValidationError) as owner_error:
        validate_aigc_dag_structure(wrong_owner)
    assert owner_error.value.code == "system_output_connection_invalid"
