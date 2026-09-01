# Debug Session: duplicate-reference-output
- **Status**: [OPEN]
- **Issue**: Tool video task 758f0f81-99d2-42b0-8d7d-113e55151fce produced a video that appears identical to its reference video; determine whether the model was called and whether the output asset is correctly linked.
- **Debug Server**: Pending; existing task evidence will be inspected first.
- **Log File**: .dbg/trae-debug-log-duplicate-reference-output.ndjson

## Reproduction Steps
1. Open tool video task `758f0f81-99d2-42b0-8d7d-113e55151fce`.
2. Compare the generated output video with the task's reference video.
3. Observe that the content appears identical.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The task used the mock adapter and copied/reused the reference video | High | Low | Rejected: output metadata names `volcengine-modelark`, and the provider task exists remotely. |
| B | The real Seedance model returned a highly similar video | Medium | Medium | Confirmed: provider task succeeded, while sampled output frames retain the original metal cup. |
| C | Provider failure or download fallback reused the reference URL | Medium | Medium | Rejected: provider reports `succeeded`, `error=None`, and returned a distinct Ark TOS video URL. |
| D | The output asset relation points to the input/reference asset | High | Low | Rejected: input and output have different asset IDs, object keys, byte sizes, hashes, and resolutions. |
| E | The files differ but frontend playback cache/URL reuse shows the input | Medium | Low | Rejected: direct downloads from both asset endpoints produce distinct files, yet visual samples remain semantically alike. |

## Log Evidence
- Application task `758f0f81-99d2-42b0-8d7d-113e55151fce` is `succeeded` and records provider task `cgt-20260826150132-wr52q`.
- Provider query reports `status='succeeded'`, `model='doubao-seedance-2-0-fast-260128'`, `duration=15`, `resolution='720p'`, `framespersecond=24`, `seed=56082`, `usage.total_tokens=648900`, and `error=None`.
- The frontend request persisted one image asset ID and one video asset ID. Before provider submission, `_tool_reference_urls` resolved both assets to HTTPS TOS signed URLs. The provider `content` therefore contained one `image_url` item with role `reference_image` and one `video_url` item with role `reference_video`.
- Both current URL resolutions point to `xujianhua-utils.tos-cn-beijing.volces.com` and include standard `X-Tos-*` signature parameters. The exact historical signatures are intentionally not persisted because they expire.
- Reference asset: ID `fe9a6c92-e015-48be-be3a-b85101f34c66`, 6,396,242 bytes, 1920x1080, SHA-256 `42fb754d...`.
- Output asset: ID `e0ac6523-cc7e-4b96-a1a5-83e5749a8eca`, 12,304,468 bytes, 1280x720, SHA-256 `24cbde97...`.
- Direct frame comparisons at 1, 3, 6, 9, 12, and 14 seconds show the same scene and the original metal cup; the requested milk-tea replacement is not visible.
- Whole-video SSIM after normalizing resolution and frame rate is `0.714072`, confirming the files are not identical encodes even though the semantic content is highly similar.

## Verification Conclusion
The model call succeeded and the output pipeline stored the provider's distinct generated file correctly. The failure is semantic instruction adherence: Seedance 2.0 Fast preserved/reconstructed the reference video but did not perform the requested local object replacement.
