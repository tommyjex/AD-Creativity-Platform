from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app.api.dependencies import get_modelark_generation_service
from backend.app.repositories import Repository
from backend.app.schemas import (
    ImagePromptVersionCreate,
    ProjectCreate,
)
from backend.app.schemas.enums import Stage, Status
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.modelark import MockModelArkAdapter, ModelArkProviderError


def image_project_payload() -> dict[str, object]:
    return {
        "name": "Product Hero",
        "project_type": "image_asset",
        "brief": {
            "prompt": "Create a premium product hero image.",
            "product_name": "AdPilot",
            "audience": "small business owners",
            "selling_points": ["fast iteration"],
            "target_platform": "tmall",
            "aspect_ratio": "1:1",
            "target_language": "zh",
            "image_purpose": "ecommerce_main",
        },
    }


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_image_prompt_versions_are_immutable_monotonic_and_current(
    repository_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    repository: Repository = request.getfixturevalue(repository_fixture)
    project = repository.create_project(
        ProjectCreate.model_validate(image_project_payload())
    )
    base = {
        "project_id": project.id,
        "aspect_ratio": project.brief.aspect_ratio,
        "target_language": project.brief.target_language,
        "image_purpose": project.brief.image_purpose,
    }

    first = repository.save_image_prompt_version(
        ImagePromptVersionCreate(prompt='First prompt with "Fast iteration"', **base)
    )
    second = repository.save_image_prompt_version(
        ImagePromptVersionCreate(prompt='Second prompt with "Work faster"', **base)
    )

    assert [item.version for item in repository.list_image_prompt_versions(project.id)] == [
        2,
        1,
    ]
    assert repository.get_image_prompt_version(project.id, first.id).prompt == (
        'First prompt with "Fast iteration"'
    )
    current = repository.get_project(project.id)
    assert current.current_image_prompt_version_id == second.id
    assert current.image_prompt_status == Status.SUCCEEDED
    assert current.current_stage == Stage.IMAGE
    with pytest.raises(ValidationError):
        first.prompt = "Mutated prompt"  # type: ignore[misc]


@pytest.mark.parametrize("client_fixture", ["client", "mysql_client"])
def test_image_prompt_version_api_saves_snapshots_and_reads_history(
    client_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    client: TestClient = request.getfixturevalue(client_fixture)
    project = client.post("/api/projects", json=image_project_payload()).json()

    saved = client.post(
        f"/api/projects/{project['id']}/image-prompt-versions",
        json={"prompt": 'A clean centered hero shot with "Fast iteration".'},
    )
    assert saved.status_code == 201
    assert saved.json()["version"] == 1
    assert saved.json()["aspect_ratio"] == "1:1"
    assert saved.json()["image_purpose"] == "ecommerce_main"

    history = client.get(
        f"/api/projects/{project['id']}/image-prompt-versions"
    ).json()
    fetched = client.get(
        f"/api/projects/{project['id']}/image-prompt-versions/{saved.json()['id']}"
    ).json()
    refreshed = client.get(f"/api/projects/{project['id']}").json()

    assert history == [saved.json()]
    assert fetched == saved.json()
    assert refreshed["current_image_prompt_version_id"] == saved.json()["id"]
    assert refreshed["image_prompt_status"] == "succeeded"


@pytest.mark.parametrize(
    "prompt",
    [
        'Empty visible copy: ""',
        'Unclosed visible copy: "Fast iteration',
        "Curly visible copy: “Fast iteration”",
        'Too many: "One" "Two" "Three" "Four" "Five"',
    ],
)
def test_image_prompt_version_api_rejects_invalid_visible_copy(
    client: TestClient,
    prompt: str,
) -> None:
    project = client.post("/api/projects", json=image_project_payload()).json()

    response = client.post(
        f"/api/projects/{project['id']}/image-prompt-versions",
        json={"prompt": prompt},
    )

    assert response.status_code == 422
    assert client.get(
        f"/api/projects/{project['id']}/image-prompt-versions"
    ).json() == []


def test_image_prompt_version_api_accepts_zero_or_four_visible_copy_items(
    client: TestClient,
) -> None:
    project = client.post("/api/projects", json=image_project_payload()).json()

    no_copy = client.post(
        f"/api/projects/{project['id']}/image-prompt-versions",
        json={"prompt": "A clean centered hero shot without visible text."},
    )
    four_copies = client.post(
        f"/api/projects/{project['id']}/image-prompt-versions",
        json={"prompt": 'Copy: "One" "Two" "Three" "Four"'},
    )

    assert no_copy.status_code == 201
    assert four_copies.status_code == 201


@pytest.mark.parametrize("client_fixture", ["client", "mysql_client"])
def test_image_brief_only_marks_prompt_stale_on_actual_content_change(
    client_fixture: str,
    request: pytest.FixtureRequest,
) -> None:
    client: TestClient = request.getfixturevalue(client_fixture)
    project = client.post("/api/projects", json=image_project_payload()).json()
    saved = client.post(
        f"/api/projects/{project['id']}/image-prompt-versions",
        json={"prompt": 'Immutable prompt with "Fast iteration"'},
    ).json()

    unchanged = client.patch(
        f"/api/projects/{project['id']}",
        json={"brief": {"audience": "small business owners"}},
    )
    renamed = client.patch(
        f"/api/projects/{project['id']}",
        json={"name": "Renamed only"},
    )
    changed = client.patch(
        f"/api/projects/{project['id']}",
        json={"brief": {"audience": "design teams"}},
    )

    assert unchanged.json()["image_prompt_status"] == "succeeded"
    assert renamed.json()["image_prompt_status"] == "succeeded"
    assert changed.json()["image_prompt_status"] == "stale"
    assert changed.json()["current_stage"] == "image"
    assert client.get(
        f"/api/projects/{project['id']}/image-prompt-versions/{saved['id']}"
    ).json()["prompt"] == 'Immutable prompt with "Fast iteration"'


def test_video_project_rejects_image_prompt_api(client: TestClient) -> None:
    project = client.post(
        "/api/projects",
        json={"name": "Video", "brief": {"prompt": "Create a video"}},
    ).json()

    response = client.get(
        f"/api/projects/{project['id']}/image-prompt-versions"
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "invalid_state"


def test_image_prompt_suggestion_uses_complete_brief_without_saving_version(
    client: TestClient,
) -> None:
    project = client.post("/api/projects", json=image_project_payload()).json()

    response = client.post(
        f"/api/projects/{project['id']}/image-prompts/generate",
        json={"current_prompt": "保留产品居中构图"},
    )

    assert response.status_code == 200
    assert response.json()["model"] == "doubao-seed-evolving"
    assert "AdPilot" in response.json()["prompt"]
    assert "保留产品居中构图" in response.json()["prompt"]
    assert client.get(
        f"/api/projects/{project['id']}/image-prompt-versions"
    ).json() == []


def test_image_prompt_provider_failure_is_sanitized_and_writes_nothing(
    client: TestClient,
) -> None:
    class FailingAdapter(MockModelArkAdapter):
        async def generate_image_prompt(self, request):
            raise ModelArkProviderError(
                "raw provider secret",
                phase="text_generate",
                provider_code="ProviderFailure",
                request_id="request-123456",
            )

    service = ModelArkGenerationService(FailingAdapter())
    client.app.dependency_overrides[get_modelark_generation_service] = lambda: service
    project = client.post("/api/projects", json=image_project_payload()).json()

    response = client.post(
        f"/api/projects/{project['id']}/image-prompts/generate",
        json={},
    )

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "external_service_error"
    assert "raw provider secret" not in str(response.json())
    assert client.get(
        f"/api/projects/{project['id']}/image-prompt-versions"
    ).json() == []
