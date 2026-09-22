# AIGC Pipeline Thumbnail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a personal AIGC pipeline pin one eligible image or video from its successful run outputs as its workspace thumbnail, while automatically falling back to the newest eligible output or the existing topology preview.

**Architecture:** Persist only `thumbnail_asset_id` on `AigcPipeline`. Extend the repository with batch candidate reads and an atomic thumbnail-field update; let a focused thumbnail service enforce run ownership, output direction, media type, asset state, and signed-URL access. Routes resolve presentation objects without trusting client asset IDs. The workspace loads candidates only when its thumbnail dialog opens, then invalidates the already-existing pipeline list cache after a successful set or clear.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy, in-memory repository, MySQL/SQLite additive migrations, Next.js 16, React 19, TypeScript, TanStack Query, Vitest, Playwright.

**Scope guardrails:**

- Do not add thumbnail fields to `AigcPipelineTemplate` or template endpoints.
- Eligible media must be a `SUCCEEDED` pipeline-run `OUTPUT` reference for the same pipeline, have `Asset.status == SUCCEEDED`, `AssetRole.PUBLIC`, and an `image/*` or `video/*` MIME type.
- URL signing is response-only. If signing returns no URL or raises a storage error, skip that asset and continue resolving other candidates.
- Updating the thumbnail changes only `thumbnail_asset_id` and `updated_at`; it must not increment `revision`, rewrite `definition`, or modify pipeline asset references.
- Preserve all unrelated dirty worktree changes. Stage only files explicitly owned by this feature when committing.

---

## File Structure

- Modify: `backend/app/schemas/aigc.py`
  - Define media-kind/source literals, response models, candidate page item, and nullable thumbnail update request; add read-only thumbnail fields to `AigcPipeline`.
- Modify: `backend/app/schemas/__init__.py`
  - Re-export the new public schema types.
- Modify: `backend/app/db/models.py`
  - Add nullable, indexed `thumbnail_asset_id` to `AigcPipelineORM`.
- Modify: `backend/app/db/session.py`
  - Add an idempotent additive migration for pre-existing `pipelines` tables.
- Modify: `backend/app/repositories/base.py`
  - Add typed protocol methods for thumbnail persistence and batch eligible-output lookup.
- Modify: `backend/app/repositories/memory.py`
  - Persist the field and implement deterministic in-memory candidate lookup.
- Modify: `backend/app/repositories/mysql.py`
  - Persist the field and implement one joined, batch-capable candidate query across runs, tasks, task assets, and assets.
- Create: `backend/app/services/aigc_pipeline_thumbnail.py`
  - Centralize eligibility validation, signed URL resolution, fallback order, candidate pagination, and write behavior.
- Modify: `backend/app/api/dependencies.py`
  - Provide the thumbnail service using the existing repository and asset-storage dependencies.
- Modify: `backend/app/api/aigc_routes.py`
  - Return enriched pipelines from list/detail, expose candidate listing and thumbnail set/clear routes, and translate domain failures to the established API error envelope.
- Modify: `backend/tests/test_aigc_schemas.py`
  - Cover schema serialization and nullable update input.
- Modify: `backend/tests/test_aigc_repository.py`
  - Verify both repository implementations persist the field and batch lookup filters/orders candidates.
- Modify: `backend/tests/test_aigc_routes.py`
  - Cover the HTTP contract, fallback behavior, eligibility rejection, and no revision conflict.
- Modify: `frontend/lib/aigc/types.ts`
  - Mirror thumbnail response, candidate, and update request contracts.
- Modify: `frontend/lib/api-client.ts`
  - Add typed candidate-list and thumbnail-update methods.
- Modify: `frontend/tests/api-client.test.ts`
  - Verify encoded URLs, query parameters, HTTP method, and JSON bodies.
- Create: `frontend/components/workspace/aigc/aigc-thumbnail-dialog.tsx`
  - Render accessible, paged image/video candidate selection and clear actions.
- Modify: `frontend/components/workspace/aigc/aigc-workspace.tsx`
  - Add the personal-pipeline thumbnail entry point, use the dialog, and render media with topology fallback.
- Modify: `frontend/tests/aigc-workspace.test.tsx`
  - Extend mocks and cover dialog, media rendering, fallback, set/clear, and cache refresh behavior.
- Modify: `frontend/scripts/verify-aigc-workspace.mjs`
  - Add fixture assertions for thumbnail media and fallback topology at desktop, tablet, and mobile sizes.

## Task 1: Add contracts and durable thumbnail state

**Files:**
- Modify: `backend/app/schemas/aigc.py`
- Modify: `backend/app/schemas/__init__.py`
- Modify: `backend/app/db/models.py`
- Modify: `backend/app/db/session.py`
- Modify: `backend/app/repositories/base.py`
- Modify: `backend/app/repositories/memory.py`
- Modify: `backend/app/repositories/mysql.py`
- Modify: `backend/tests/test_aigc_schemas.py`
- Modify: `backend/tests/test_aigc_repository.py`

- [ ] **Step 1: Write failing schema and repository contract tests**

Add tests that assert:

1. A newly created and a migrated `AigcPipeline` serialize `thumbnail_asset_id: null` and `thumbnail: null`.
2. `AigcPipelineThumbnailUpdate(asset_id=None)` validates; blank asset IDs reject.
3. A repository thumbnail update persists an asset ID, changes `updated_at`, preserves `revision`, definition, and all normal pipeline fields.
4. Both `MemoryRepository` and `MySQLRepository` return only matching successful-run output assets; exclude input references, failed runs, failed assets, internal assets, non-image/video MIME types, and a second pipeline's output.
5. The batch lookup returns candidates ordered by asset creation timestamp descending and groups results by pipeline ID without issuing one query per pipeline.

- [ ] **Step 2: Run the focused tests and verify they fail**

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_aigc_repository.py -q
```

Expected: FAIL because thumbnail schemas, column, protocol methods, and repository implementations do not exist.

- [ ] **Step 3: Define Pydantic response and request types**

In `backend/app/schemas/aigc.py`, near `AigcPipeline`:

```python
class AigcThumbnailMediaKind(str, Enum):
    IMAGE = "image"
    VIDEO = "video"

class AigcPipelineThumbnailSource(str, Enum):
    PINNED = "pinned"
    LATEST_OUTPUT = "latest_output"

class AigcPipelineThumbnail(SchemaModel):
    asset_id: str = Field(..., min_length=1)
    mime_type: str = Field(..., min_length=1)
    kind: AigcThumbnailMediaKind
    source: AigcPipelineThumbnailSource
    url: str = Field(..., min_length=1)

class AigcPipelineThumbnailCandidate(SchemaModel):
    asset_id: str = Field(..., min_length=1)
    run_id: str = Field(..., min_length=1)
    node_id: str = Field(..., min_length=1)
    mime_type: str = Field(..., min_length=1)
    kind: AigcThumbnailMediaKind
    url: str = Field(..., min_length=1)
    created_at: datetime

class AigcPipelineThumbnailUpdate(SchemaModel):
    asset_id: str | None = Field(default=None, min_length=1)
```

Add `thumbnail_asset_id: str | None = None` and `thumbnail: AigcPipelineThumbnail | None = None` to `AigcPipeline` only. Add a whitespace validator to `AigcPipelineThumbnailUpdate.asset_id` so `"   "` rejects rather than becoming a persisted value. Re-export every new externally used schema from `backend/app/schemas/__init__.py`.

- [ ] **Step 4: Add the database column and backward-compatible migration**

In `AigcPipelineORM`, add:

```python
thumbnail_asset_id: Mapped[Optional[str]] = mapped_column(
    String(36), nullable=True, index=True
)
```

Do not add a foreign key: assets can be deleted and the design explicitly requires preserving a stale pinned ID until the user replaces or clears it. In `_apply_additive_migrations`, inspect `pipelines` and issue `ALTER TABLE pipelines ADD COLUMN thumbnail_asset_id VARCHAR(36) NULL` only if absent; create `ix_pipelines_thumbnail_asset_id` only if absent.

- [ ] **Step 5: Extend the repository protocol and implementations**

Add repository-level types/methods that preserve separation between raw eligible rows and URL-bearing response schemas:

```python
def update_aigc_pipeline_thumbnail(
    self, pipeline_id: str, *, asset_id: str | None
) -> AigcPipeline: ...

def list_aigc_pipeline_thumbnail_outputs(
    self, pipeline_ids: Iterable[str]
) -> dict[str, list[AigcPipelineThumbnailOutput]]: ...
```

Define `AigcPipelineThumbnailOutput` as a repository/service-facing schema or typed dataclass containing `pipeline_id`, `run_id`, `node_id`, and `asset: Asset`. Its ordering must be `(asset.created_at DESC, asset.id DESC)` so ties are stable.

For `MemoryRepository`:

- Update copies and model construction automatically through `AigcPipeline` serialization.
- Under the existing lock, verify the pipeline is live, then model-copy only `thumbnail_asset_id` and `updated_at`.
- Traverse `_aigc_task_assets`, `_aigc_tasks`, `_aigc_runs`, and `_assets`, filtering on `AigcAssetDirection.OUTPUT`, `AigcPipelineRunStatus.SUCCEEDED`, `Status.SUCCEEDED`, `AssetRole.PUBLIC`, and a non-empty image/video MIME type.

For `MySQLRepository`:

- Include `thumbnail_asset_id` in create and `_aigc_pipeline_from_orm`.
- Lock the pipeline row in `update_aigc_pipeline_thumbnail`, update only the two specified columns, flush, and map it back without revision checks.
- Implement the batch query with `AssetORM -> AigcPipelineTaskAssetORM -> AigcPipelineTaskORM -> AigcPipelineRunORM`; filter requested pipeline IDs, live pipelines, output direction, succeeded run/asset statuses, public role, and `mime_type ILIKE 'image/%' OR 'video/%'` using the repository's database-portable expression style.
- Select all needed IDs/timestamps in one statement, order globally by `pipeline_id`, `AssetORM.created_at.desc()`, `AssetORM.id.desc()`, then group in Python.

- [ ] **Step 6: Run focused tests and inspect migration behavior**

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_aigc_repository.py -q
```

Expected: PASS. Also run the existing SQLite bootstrap test that exercises additive migrations if it is not already covered by `test_aigc_repository.py`.

- [ ] **Step 7: Commit the isolated persistence layer**

```bash
git add \
  backend/app/schemas/aigc.py \
  backend/app/schemas/__init__.py \
  backend/app/db/models.py \
  backend/app/db/session.py \
  backend/app/repositories/base.py \
  backend/app/repositories/memory.py \
  backend/app/repositories/mysql.py \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_aigc_repository.py
git commit -m "feat: persist aigc pipeline thumbnail selection"
```

## Task 2: Resolve eligible thumbnails through a focused service

**Files:**
- Create: `backend/app/services/aigc_pipeline_thumbnail.py`
- Modify: `backend/app/api/dependencies.py`
- Modify: `backend/tests/test_aigc_routes.py`

- [ ] **Step 1: Write failing service/route tests using existing AIGC run fixtures**

Add helpers near the existing successful-run task asset fixtures to create image, video, audio, internal, failed, cross-pipeline, input, and inaccessible output assets. Cover:

1. Candidate endpoint returns only image/video assets from successful outputs, includes run/node IDs, sorts newest first, and paginates `page`/`page_size`.
2. Pinned valid media returns `source: "pinned"` in detail and list; clearing it produces `latest_output` or `null`.
3. A missing/stale pinned ID does not fail detail/list and falls back.
4. Attempting to pin nonexistent, cross-pipeline, non-output, failed-run, inaccessible, internal, audio, or text assets returns `422` and leaves the prior ID untouched.
5. A thumbnail set leaves `revision` and `definition` unchanged, advances `updated_at`, and is last-write-wins.
6. A storage signer exception or `None` URL skips only that candidate and permits a later eligible candidate to resolve.
7. A list request resolves a page through one batch candidate lookup rather than invoking a per-pipeline method.

- [ ] **Step 2: Run the route test module and verify the new tests fail**

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/test_aigc_routes.py -q
```

Expected: FAIL because no thumbnail service or routes exist.

- [ ] **Step 3: Implement `AigcPipelineThumbnailService`**

Give the service a `Repository` and `AssetStorageService`. Implement these public methods:

```python
def enrich_pipeline(self, pipeline: AigcPipeline) -> AigcPipeline: ...
def enrich_pipelines(self, pipelines: list[AigcPipeline]) -> list[AigcPipeline]: ...
def list_candidates(
    self, pipeline_id: str, *, page: int, page_size: int
) -> AigcPage[AigcPipelineThumbnailCandidate]: ...
def set_thumbnail(
    self, pipeline_id: str, payload: AigcPipelineThumbnailUpdate
) -> AigcPipeline: ...
```

Implementation rules:

- Call `repository.get_aigc_pipeline()` before candidates/set to preserve `404` behavior.
- Resolve candidate rows once per group through `list_aigc_pipeline_thumbnail_outputs`.
- Determine media kind only from the lower-cased MIME prefix. Return no candidate for missing or unrecognized MIME types.
- Call `asset_storage.signed_access_url(asset)` inside a narrow `try/except (ConfigurationError, OSError, ValueError, ... )` boundary; log at warning/debug without URLs or asset metadata, then skip unusable records.
- For `enrich_pipelines`, first check a pinned ID against that pipeline's eligible output rows. If unavailable, choose the first signed latest output. Model-copy the pipeline with `thumbnail` while retaining its persisted ID.
- For non-null writes, find the matching eligible output in that pipeline's resolved rows and require a signable URL before calling the repository write. Raise a dedicated `AigcPipelineThumbnailValidationError` for all failed eligibility cases.
- For clear writes, call `update_aigc_pipeline_thumbnail(..., asset_id=None)` directly and enrich the returned pipeline to expose its automatic fallback.

In `backend/app/api/dependencies.py`, add `get_aigc_pipeline_thumbnail_service` built from the existing `get_repository` and `get_asset_storage_service`.

- [ ] **Step 4: Run focused service/route tests**

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/test_aigc_routes.py -q
```

Expected: PASS, including prior AIGC route coverage.

- [ ] **Step 5: Commit the thumbnail resolution service**

```bash
git add \
  backend/app/services/aigc_pipeline_thumbnail.py \
  backend/app/api/dependencies.py \
  backend/tests/test_aigc_routes.py
git commit -m "feat: resolve aigc pipeline thumbnail media"
```

## Task 3: Expose the HTTP and frontend client contracts

**Files:**
- Modify: `backend/app/api/aigc_routes.py`
- Modify: `backend/tests/test_aigc_routes.py`
- Modify: `frontend/lib/aigc/types.ts`
- Modify: `frontend/lib/api-client.ts`
- Modify: `frontend/tests/api-client.test.ts`

- [ ] **Step 1: Add failing frontend client tests**

In `frontend/tests/api-client.test.ts`, assert:

```ts
await api.listAigcPipelineThumbnailCandidates("pipeline/with space", {
  page: 2,
  pageSize: 50
});
await api.updateAigcPipelineThumbnail("pipeline/with space", {
  asset_id: "asset-1"
});
await api.updateAigcPipelineThumbnail("pipeline/with space", {
  asset_id: null
});
```

Verify the encoded route, `?page=2&page_size=50`, `PUT`, and exact JSON request bodies.

- [ ] **Step 2: Run the client tests and verify they fail**

```bash
cd frontend && npx vitest run tests/api-client.test.ts
```

Expected: FAIL because the client methods and types do not exist.

- [ ] **Step 3: Add routes around the service**

Update existing pipeline routes:

- `GET /pipelines`: page the repository result first, then call `thumbnail_service.enrich_pipelines(page.items)` so only current-page pipeline IDs are queried.
- `GET /pipelines/{pipeline_id}`: call `thumbnail_service.enrich_pipeline`.
- Add `GET /pipelines/{pipeline_id}/thumbnail-candidates` and `PUT /pipelines/{pipeline_id}/thumbnail` directly before `GET /pipelines/{pipeline_id}` so the resource's subroutes remain adjacent and visibly precede its detail route.
- Add `PUT /pipelines/{pipeline_id}/thumbnail` returning `AigcPipeline`.

Map `NotFoundError` to the current `404 NOT_FOUND` envelope. Map `AigcPipelineThumbnailValidationError` to `422` with `ErrorCode.VALIDATION_ERROR` and a stable `"AIGC pipeline thumbnail is invalid"` message. Do not expose storage exception detail.

- [ ] **Step 4: Mirror contracts in TypeScript and implement API methods**

In `frontend/lib/aigc/types.ts`, add:

```ts
export type AigcThumbnailMediaKind = "image" | "video";
export type AigcPipelineThumbnailSource = "pinned" | "latest_output";

export interface AigcPipelineThumbnail {
  asset_id: string;
  mime_type: string;
  kind: AigcThumbnailMediaKind;
  source: AigcPipelineThumbnailSource;
  url: string;
}

export interface AigcPipelineThumbnailCandidate {
  asset_id: string;
  run_id: string;
  node_id: string;
  mime_type: string;
  kind: AigcThumbnailMediaKind;
  url: string;
  created_at: DateTimeString;
}

export interface AigcPipelineThumbnailUpdate {
  asset_id: string | null;
}
```

Add `thumbnail_asset_id` and `thumbnail` to `AigcPipeline`. In `frontend/lib/api-client.ts`, import these types and add `listAigcPipelineThumbnailCandidates` using `withAigcListQuery` plus `updateAigcPipelineThumbnail` with a `PUT` body.

- [ ] **Step 5: Run contract tests**

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/test_aigc_routes.py -q
cd frontend && npx vitest run tests/api-client.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the HTTP/client contract**

```bash
git add \
  backend/app/api/aigc_routes.py \
  backend/tests/test_aigc_routes.py \
  frontend/lib/aigc/types.ts \
  frontend/lib/api-client.ts \
  frontend/tests/api-client.test.ts
git commit -m "feat: add aigc pipeline thumbnail api"
```

## Task 4: Add accessible thumbnail selection to the workspace

**Files:**
- Create: `frontend/components/workspace/aigc/aigc-thumbnail-dialog.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-workspace.tsx`
- Modify: `frontend/tests/aigc-workspace.test.tsx`

- [ ] **Step 1: Extend workspace tests and API mocks before UI changes**

Add `listAigcPipelineThumbnailCandidates` and `updateAigcPipelineThumbnail` to the hoisted API mock. Update the pipeline fixture with:

```ts
thumbnail_asset_id: null,
thumbnail: null
```

Add tests that verify:

1. Only a personal-pipeline card exposes an accessible `选择缩略图` action; templates do not.
2. Opening the dialog requests candidates for that pipeline and renders image/video labels and non-autoplay previews.
3. Selecting a candidate calls `updateAigcPipelineThumbnail` with its ID, closes only after success, and refreshes/invalidate-refetches the pipelines query.
4. `清除缩略图` sends `{ asset_id: null }`.
5. A thumbnail image uses `object-contain`; a video uses `<video muted playsInline preload="metadata">` with no autoplay; failed image/video loading switches that card to `TopologyPreview`.
6. A failed candidate query or mutation leaves the dialog usable and presents the existing error treatment without breaking card navigation.

- [ ] **Step 2: Run workspace tests and verify they fail**

```bash
cd frontend && npx vitest run tests/aigc-workspace.test.tsx
```

Expected: FAIL because the dialog and thumbnail controls are absent.

- [ ] **Step 3: Build the focused dialog component**

Implement `AigcThumbnailDialog` using the repository's existing `Dialog` primitives. Props should include `pipeline`, `open`, `onOpenChange`, and `onUpdated`.

- Query candidates with a query key including `["aigc", "pipeline-thumbnail-candidates", pipeline.id, page]` and `enabled: open`.
- Keep the preview area fixed and render `<img>`/`<video>` with `object-contain`; do not crop or autoplay media.
- Use a radio-style selectable media grid with visible image/video text, run/node context, and an accessible selected state.
- Include explicit clear action only when `thumbnail_asset_id` is set; label it `清除缩略图`.
- Disable candidate/clear commands while a mutation is pending. Keep a retry-capable error state for candidate retrieval.
- On success, call `onUpdated(updatedPipeline)`, invalidate `["aigc", "pipelines"]`, and close. Do not create a separate per-card thumbnail request.

- [ ] **Step 4: Integrate the dialog without disturbing existing workspace state**

In `AigcWorkspace`:

- Add a `thumbnailPipeline` state storing the selected personal pipeline or `null`.
- Add the card action with an icon button and tooltip/accessibility label `选择缩略图`; stop propagation so it does not trigger card navigation.
- Render `pipeline.thumbnail` in the fixed preview region before `TopologyPreview`.
- Attach `onError` handlers to image/video media. On error, record the affected pipeline ID in component state and show the topology fallback until its URL changes or the list refetches.
- Retain existing template instantiation, create, delete confirmation, list query, URL view, pagination, card navigation, and all existing test IDs/classes from the constellation implementation.

- [ ] **Step 5: Run focused UI tests**

```bash
cd frontend && npx vitest run tests/aigc-workspace.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the workspace chooser**

```bash
git add \
  frontend/components/workspace/aigc/aigc-thumbnail-dialog.tsx \
  frontend/components/workspace/aigc/aigc-workspace.tsx \
  frontend/tests/aigc-workspace.test.tsx
git commit -m "feat: choose aigc pipeline thumbnails"
```

## Task 5: End-to-end validation and regression checks

**Files:**
- Modify: `frontend/scripts/verify-aigc-workspace.mjs`
- Modify only test fixtures required by that script.

- [ ] **Step 1: Extend the visual fixture and Playwright script**

Seed at least:

- one pipeline with a signable image thumbnail;
- one with a signable video thumbnail;
- one with `thumbnail: null`;
- one with a URL that intentionally fails to demonstrate topology fallback.

At desktop (`1440x1000`), tablet (`1024x900`), and mobile (`390x844`), assert:

- no horizontal page overflow;
- card grid retains the `xl:5`, `md:4`, and base `2` column rules;
- preview media fits its fixed region without distortion;
- video does not gain `autoplay`;
- the topology fallback remains visible for absent/failed media;
- the thumbnail dialog opens, media is selectable, and its controls remain reachable on mobile.

Store screenshots under the existing workspace test-results directory and use the script's current dev-server lifecycle instead of starting a second server.

- [ ] **Step 2: Run all targeted backend checks**

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_aigc_repository.py \
  backend/tests/test_aigc_routes.py -q
```

- [ ] **Step 3: Run frontend static and unit checks**

```bash
cd frontend
npm run lint
npx vitest run tests/api-client.test.ts tests/aigc-workspace.test.tsx
```

Run the repository's configured typecheck command if `frontend/package.json` provides one; otherwise use the existing production build as the TypeScript integration check:

```bash
npm run build
```

- [ ] **Step 4: Run the responsive browser verification**

```bash
cd frontend
node scripts/verify-aigc-workspace.mjs
```

Expected: screenshots are nonblank, all viewport assertions pass, controls are interactive, and no overflow is detected.

- [ ] **Step 5: Review the final diff and commit only feature-owned files**

```bash
git diff --check
git status --short
git diff -- \
  backend/app/schemas/aigc.py \
  backend/app/schemas/__init__.py \
  backend/app/db/models.py \
  backend/app/db/session.py \
  backend/app/repositories/base.py \
  backend/app/repositories/memory.py \
  backend/app/repositories/mysql.py \
  backend/app/services/aigc_pipeline_thumbnail.py \
  backend/app/api/dependencies.py \
  backend/app/api/aigc_routes.py \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_aigc_repository.py \
  backend/tests/test_aigc_routes.py \
  frontend/lib/aigc/types.ts \
  frontend/lib/api-client.ts \
  frontend/components/workspace/aigc/aigc-thumbnail-dialog.tsx \
  frontend/components/workspace/aigc/aigc-workspace.tsx \
  frontend/tests/api-client.test.ts \
  frontend/tests/aigc-workspace.test.tsx \
  frontend/scripts/verify-aigc-workspace.mjs
```

Only after every verification passes:

```bash
git add \
  backend/app/schemas/aigc.py \
  backend/app/schemas/__init__.py \
  backend/app/db/models.py \
  backend/app/db/session.py \
  backend/app/repositories/base.py \
  backend/app/repositories/memory.py \
  backend/app/repositories/mysql.py \
  backend/app/services/aigc_pipeline_thumbnail.py \
  backend/app/api/dependencies.py \
  backend/app/api/aigc_routes.py \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_aigc_repository.py \
  backend/tests/test_aigc_routes.py \
  frontend/lib/aigc/types.ts \
  frontend/lib/api-client.ts \
  frontend/components/workspace/aigc/aigc-thumbnail-dialog.tsx \
  frontend/components/workspace/aigc/aigc-workspace.tsx \
  frontend/tests/api-client.test.ts \
  frontend/tests/aigc-workspace.test.tsx \
  frontend/scripts/verify-aigc-workspace.mjs
git commit -m "feat: support aigc pipeline thumbnails"
```

## Final Acceptance Checklist

- [ ] `GET /api/aigc/pipelines` and `GET /api/aigc/pipelines/{id}` expose `thumbnail_asset_id` plus a fully resolved thumbnail object or `null`.
- [ ] Candidate listing and pin/clear endpoints conform exactly to the approved API design.
- [ ] Only successful, public image/video outputs from the same pipeline can be selected.
- [ ] A stale pin never breaks list/detail responses; automatic fallback is deterministic.
- [ ] Thumbnail updates do not mutate definitions or revisions.
- [ ] List thumbnail resolution is batch-based and does not add per-card database reads.
- [ ] Personal cards can choose and clear thumbnails; templates cannot.
- [ ] Media keeps its aspect ratio, video never autoplays, and failed media reliably falls back to topology.
- [ ] Targeted backend tests, frontend lint/unit tests, production build/typecheck, and three-viewport Playwright verification pass.
