# Debug: video-resolution-schema

Status: OPEN

## Symptom

Submitting a tool video-generation request fails with:

`body.resolution: Extra inputs are not permitted`

## Hypotheses

1. The backend serving port 8000 is an older process whose request schema does not include `resolution`.
2. The serving process imports a different checkout or stale module than the current workspace source.
3. The frontend and backend deployments are on mismatched revisions.
4. The request is routed to a different backend process or proxy target than expected.

## Evidence Log

- `localhost:8000/openapi.json` exposes `ToolVideoGenerationRequest` without
  `resolution`, and restricts `aspect_ratio` to `16:9`/`9:16`/`1:1`.
- Importing `backend.app.schemas.tool_task.ToolVideoGenerationRequest` from
  the current workspace exposes required `resolution` and all seven current
  aspect-ratio values.
- Port 8000 is served by Uvicorn PID 29126 from this workspace, so the running
  process is stale rather than a different deployment target.

## Root Cause

The running Uvicorn process predates the resolution-schema change and was not
started with reload enabled.
