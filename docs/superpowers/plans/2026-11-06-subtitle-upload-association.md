# Subtitle upload association implementation plan

**Goal:** Persist each subtitle extraction task's Ark Files identifier immediately after upload.

**Architecture:** An optional asynchronous `on_file_uploaded(file_id)` hook crosses the package service and provider boundary. The platform saves `input_snapshot.provider_file_id` and `provider_file_uploaded_at` using its existing workspace/task transaction, before Files polling or Responses execution. Task completion merges the latest snapshot, preserving these fields. Retries create new tasks with independent associations.

**Tech stack:** Python, asyncio, Pydantic, existing memory/SQL repositories, Ark Files/Responses, TLS structured events.

The user's instruction authorizes implementation in this session. No commit, push, production mutation or paid model call is included.

- [x] Add an optional per-call upload hook in `standalone/video-subtitle-grounding/src/video_subtitle_grounding/provider.py` and `service.py`. Invoke it after extracting the returned identifier, within the existing cleanup guard. A failed or canceled callback still deletes the provider file and prevents further provider processing.
- [x] In `backend/app/services/subtitle_translation.py`, pass an async upload callback for extraction. Log the safe task/file association, then atomically merge it into the latest task snapshot without editing workspace revision, task status, or draft content. Permit historical recording when the draft changed in flight.
- [x] Add `provider_file_id` to the host structured log whitelist. Do not record signed URLs, local paths, credentials or subtitle contents.
- [x] Verify callback order, upload failure, processing/model failure, cancellation, callback failure and cleanup with offline provider tests. Verify service forwarding and backward compatibility when the hook is absent.
- [x] Verify memory and SQL task persistence, success/failure/cancellation, restart, retry isolation and an in-flight draft edit in `backend/tests/test_subtitle_translation_execution.py`. Check that a persistence failure stops inference and still cleans the uploaded file.
- [x] Release the local package as 0.2.1, update its version/docs, build a wheel and source archive, and update platform requirements/vendor checksum.
- [x] Run standalone tests, relevant platform subtitle/multitrack/logging regressions, Ruff, compilation and `git diff --check`; validate the installed wheel in an isolated environment.

## Query contract and limits

Read `tool_tasks.id` together with `input_snapshot.provider_file_id` and `input_snapshot.provider_file_uploaded_at`. The latter is an ISO 8601 timestamp with UTC offset, consistent with existing database timestamps; viewers convert it to Beijing time. Failed tasks retain the identifier. File cleanup remains best effort, so the retained identifier is an audit record, not a promise that the provider file remains downloadable. Historical tasks without an identifier cannot be backfilled.

If the persistence transaction fails, the task fails rather than continuing an untracked model request; the upload event retains the association in TLS when the logging sink is healthy. Infrastructure failure cannot guarantee database durability. No schema migration is required.

## Verification

- Standalone source suite: 333 passed.
- Isolated wheel suite (imports directly from 0.2.1 wheel with a separate Python environment): 333 passed.
- Platform installed-wheel regressions: 401 passed, including extraction, translation, layout, multitrack, task history and TLS/JSON logging. Memory and SQL repository fixtures were exercised; the SQL fixture uses a local test database, not production MySQL.
- Ruff fatal checks, Python compilation, both repositories' `git diff --check` and deployment script safeguards passed.
- Release artifact contents checked; no private configuration or user videos. Wheel SHA256: `02bdef75ac48cfd98cad654167bf6c89ee260eced27104df2486529160f17db8`.
- No live model calls, production changes, commits or pushes. Restart/deploy the backend with the new package to apply the change to new jobs.
