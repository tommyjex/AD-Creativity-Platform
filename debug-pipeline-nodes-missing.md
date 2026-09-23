# Debug Session: pipeline-nodes-missing
- **Status**: [OPEN]
- **Issue**: Pipeline 9f29c2ce-7e04-440e-b808-8ce04900061e expected about 10 canvas nodes, but the page currently shows only 3 nodes from the first pipeline branch.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-pipeline-nodes-missing.ndjson

## Reproduction Steps
1. Open http://localhost:3000/workspace/aigc/pipelines/9f29c2ce-7e04-440e-b808-8ce04900061e.
2. Wait for the pipeline definition and canvas to load.
3. Count the persisted definition nodes, frontend state nodes, and rendered React Flow nodes.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The persisted backend pipeline definition now contains only 3 nodes. | High | Low | Confirmed |
| B | The API returns about 10 nodes, but frontend migration/filtering reduces them to 3. | Medium | Low | Rejected |
| C | The complete definition is loaded, then stale frontend state autosaves and overwrites it. | Medium | Medium | Confirmed |
| D | All nodes remain in frontend state but some are outside the viewport or visually hidden. | Low | Low | Rejected |

## Log Evidence
- Direct API read at 2026-09-23 10:22 CST returned revision 163 with 3 nodes.
- Latest successful run snapshot (run 2d6dcceb-472a-4c1f-a803-914317ef56ba) contains 10 nodes.
- Browser page load advanced the pipeline from revision 163 to 164 without a user edit.
- Instrumentation added for server rebase input, three-way merge input/output, and autosave payload.
- Pre-fix regression reproduction failed: base/local had 3 ordinary nodes, server had 4, and merge output still had only the original 3.
- `.dbg/trae-debug-log-pipeline-nodes-missing.ndjson` lines 18-19 show the server-only node `remote-added` present in merge input and absent from merge output.
- Post-fix log lines 1-2 show the same 3-to-4 merge retaining `remote-added` and its `server-added-edge`.
- Pipeline data was restored from successful run `2d6dcceb-472a-4c1f-a803-914317ef56ba`.
- Browser verification rendered 10 nodes and 8 edges; subsequent autosaves at revisions 178-179 retained all 10 node IDs.
- Focused regression suites passed: 128 tests. TypeScript and targeted ESLint checks passed.

## Verification Conclusion
The three-way merge only appended server-managed JSON parser nodes. Ordinary
nodes added by a newer server revision were omitted whenever the local draft was
dirty, so a later autosave could persist the stale smaller graph.

The minimal fix retains ordinary nodes and edges that the server added after the
shared base revision, while preserving explicit local deletions. Awaiting user
confirmation before removing instrumentation and debug artifacts.
