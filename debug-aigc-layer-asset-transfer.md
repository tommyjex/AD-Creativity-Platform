# Debug Session: aigc-layer-asset-transfer
- **Status**: [OPEN]
- **Issue**: Seedream layer decomposition reaches the provider but all retries fail with `asset_transfer_failed / AIGC layer assets could not be stored`.
- **Debug Server**: http://127.0.0.1:7777/event (PID 34540)
- **Log File**: `.dbg/trae-debug-log-aigc-layer-asset-transfer.ndjson`

## Reproduction Steps
1. Open AIGC Pipeline `fa07e247-58e2-427a-9f77-650c342e11b6`.
2. Run `图片输入 -> Seedream（图层拆分） -> 图层画布`.
3. Observe the layer decomposition task retry three times and fail while storing provider outputs.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Expected signal |
|----|------------|------------|--------|-----------------|
| A | Provider layer URLs cannot be downloaded or expire before transfer | Medium | Low | Download stage reports non-2xx, timeout, or empty response |
| B | Provider output content is not a valid transparent PNG layer | High | Low | Decode/alpha validation fails for a specific output index |
| C | Local asset storage upload fails | Medium | Low | Download and validation pass, upload stage raises |
| D | Task asset relation persistence fails | Low | Low | Upload passes, repository relation write raises |
| E | Generic exception wrapping hides the failing stage | High | Low | Existing error contains no stage/index/cause |

## Log Evidence
- Lines 1-35 and 55-89: the provider returned one base image and 16 layer URLs; every download and PNG/alpha validation succeeded.
- Lines 36-52 and 90-106: every base/layer object upload succeeded.
- Lines 53 and 107: asset-record persistence failed with MySQL `IntegrityError 1452`; `assets.source_task_id` referenced an AIGC Pipeline Task ID that does not exist in the `generation_tasks` parent table.
- Lines 54 and 108: the stage-specific integrity error was wrapped as the generic `asset_transfer_failed` error.

## Verification Conclusion
| ID | Status | Evidence |
|----|--------|----------|
| A | Rejected | All provider URLs downloaded successfully. |
| B | Rejected | Base image and all 16 alpha layers decoded and validated. |
| C | Rejected | All 17 objects uploaded successfully. |
| D | Inconclusive | Failure occurred while creating asset records, before task relationships. |
| E | Confirmed | The generic wrapper hid the asset-record foreign-key failure. |

Confirmed root cause: AIGC layer asset builders set `source_task_id` to a Pipeline Task ID, but the database foreign key points to `generation_tasks`. AIGC provenance must be represented by `pipeline_task_assets` instead.

## Post-Fix Evidence
- Run `5ceaa235-bacc-45cf-b49c-a41837ee1048` completed successfully in about 2 minutes 24 seconds.
- Post-fix log lines 1-35: the provider base image and all 16 alpha layers downloaded and validated.
- Post-fix log lines 36-52: all 17 objects uploaded successfully.
- Post-fix log line 53: 17 asset records and 17 `pipeline_task_assets` relationships persisted successfully.
- All 17 assets have `source_task_id=null`; the decomposition task has 1 input and 17 output relationships.
- No post-fix `IntegrityError` or `asset_transfer_failed` event occurred.

Pre-fix versus post-fix:

| Stage | Pre-fix | Post-fix |
|-------|---------|----------|
| Provider/download/validation | Passed | Passed |
| Object upload | Passed | Passed |
| Asset record persistence | MySQL 1452 FK failure | Passed |
| Pipeline task relationships | Not reached | 17 relationships persisted |
| Run terminal state | Failed after retries | Succeeded |

## Follow-Up: Layer Canvas Partial Patch

Run `0589abfe-e113-4f95-bece-3fabe1496ad7` reproduced a downstream `worker_error` after the decomposition fix.

Canvas pre-fix instrumentation showed:

- The source layer-set ID/version/digest and selected layer ID matched.
- The saved transform patch explicitly changed `x`, `y`, and `scale`.
- Optional `visible`, `z_index`, and `deleted` fields were serialized as `null`.
- `_execute_layer_canvas` copied `visible=null` into `AigcLayer`, causing schema validation to fail because `visible` must be boolean.

Confirmed follow-up root cause: optional patch fields used null as an override instead of the documented “unchanged” sentinel.

Canvas post-fix Run `cc80b18b-8ce3-4653-9fa9-12260edf6324` evidence:

- Lines 1-2: the source snapshot and selected layer matched; one partial patch was parsed.
- Line 3: the canvas produced a valid version 1 snapshot with 16 layers and the expected selected layer.
- Line 4: all 17 input and 17 output task-asset relationships persisted.

The partial-patch defect is fixed. A separate execution-plan issue remains: `from_node(layer_canvas)` included downstream image editing but omitted that node’s independent `text_input` dependency, leaving the Run waiting indefinitely.

## Post-Fix Evidence
- The three AIGC layer asset builders now persist `source_task_id = NULL` while retaining Pipeline Task provenance in metadata.
- Post-fix log lines 170 and 211 show asset records and both output relationships persisted successfully (`asset_count=2`, `relationship_count=2`).
- No post-fix log entry contains `IntegrityError`; pre-fix lines 53, 107, and 161 consistently contain MySQL error 1452 at `asset_records`.
- A real MySQL transaction probe confirmed that `assets.source_task_id` refers to `generation_tasks` and rejects an existing Pipeline Task ID. The probe transaction was rolled back.
- Targeted tests: 61 passed. Full backend tests: 801 passed. `compileall` and diff checks passed.

## Post-Fix Verification Conclusion
The FK collision is resolved in automated and repository-level verification. Instrumentation and debug files remain in place for a real Pipeline Run comparison.
