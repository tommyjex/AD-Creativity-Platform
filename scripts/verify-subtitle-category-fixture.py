"""Self-test the browser fixture without starting Next, a browser, or providers."""

import importlib.util
from io import BytesIO
import json
from pathlib import Path
from types import SimpleNamespace
import unittest

SCRIPT = Path(__file__).with_name("verify-subtitle-translation-browser.py")
SPEC = importlib.util.spec_from_file_location("subtitle_browser_fixture", SCRIPT)
fixture = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fixture)


class Route:
    def __init__(self, method, path, payload=None):
        self.request = SimpleNamespace(
            url=f"http://127.0.0.1:3058{path}", method=method,
            post_data_json=payload or {}, headers={},
        )
        self.response = None

    def fulfill(self, **kwargs):
        self.response = kwargs


class CategoryFixtureTests(unittest.TestCase):
    def setUp(self):
        self.api = fixture.MockAPI()
        self.current = self.api.workspaces["workspace-a"]
        self.path = f"{fixture.PREFIX}/workspace-a"

    def request(self, method, path, payload=None):
        route = Route(method, path, payload)
        self.api.route(route)
        return route.response.get("status", 200), json.loads(route.response["body"])

    def test_legacy_get_does_not_backfill(self):
        self.assertNotIn("video_category", self.request("GET", self.path)[1])
        self.assertNotIn("video_category", self.current)

    def test_two_create_values_and_missing_default(self):
        for category in ("product", "unboxing", None):
            payload = {} if category is None else {"video_category": category}
            status, created = self.request("POST", fixture.PREFIX, payload)
            self.assertEqual(status, 201)
            self.assertEqual(created["video_category"], category or "unboxing")
            self.assertEqual(self.api.payloads[-1]["payload"], payload)

    def test_switch_invalidates_only_derived_content(self):
        item = fixture.segment(1)
        item.update(translated_text="Preserved", product_mentions=[{"model": "Saved model"}],
                    product_text_sha256="saved-fingerprint", render_layer_url="old-png",
                    render_layer_asset_id="old-layer", render_bbox_pixels=[1, 2, 3, 4])
        item["style"] = {"background_color": "#CC220080", "text_color": "#2255CC"}
        self.current.update(segments=[item], output_asset_id="old-output",
                            stage_task_ids={"extract": "saved-extract", "render": "old-render"})
        for category in ("product", "unboxing"):
            status, changed = self.request("PATCH", self.path, {
                "expected_revision": self.current["revision"], "video_category": category,
            })
            self.assertEqual(status, 200)
            self.assertIsNone(changed["output_asset_id"])
            self.assertIsNone(changed["segments"][0]["render_layer_url"])
            self.assertIsNone(changed["segments"][0]["render_bbox_pixels"])
            self.assertNotIn("render", changed["stage_task_ids"])
            self.assertEqual(changed["stage_task_ids"]["extract"], "saved-extract")
            self.assertEqual(changed["segments"][0]["translated_text"], "Preserved")
            self.assertEqual(changed["segments"][0]["product_text_sha256"], "saved-fingerprint")
            self.assertEqual(changed["segments"][0]["style"], item["style"])
        self.assertFalse(self.api.tasks)

    def test_omitted_patch_retains_category(self):
        self.current["video_category"] = "product"
        status, changed = self.request("PATCH", self.path, {"expected_revision": 1, "name": "Renamed"})
        self.assertEqual(status, 200)
        self.assertEqual(changed["video_category"], "product")

    def test_invalid_and_null_categories(self):
        for category in (None, "unsupported"):
            self.assertEqual(self.request("POST", fixture.PREFIX, {"video_category": category})[0], 422)
            self.assertEqual(self.request("PATCH", self.path, {
                "expected_revision": 1, "video_category": category,
            })[0], 422)
        self.assertEqual(self.current["revision"], 1)

    def test_stale_revision_and_viewer(self):
        self.assertEqual(self.request("PATCH", self.path, {
            "expected_revision": 0, "video_category": "product",
        })[0], 409)
        self.api.role = "viewer"
        self.assertEqual(self.request("PATCH", self.path, {
            "expected_revision": 1, "video_category": "product",
        })[0], 403)
        self.assertNotIn("video_category", self.current)

    def test_busy_fixture_freezes_all_stages_and_snapshot_category(self):
        self.api.hold_tasks = True
        self.current["video_category"] = "product"
        for operation in ("extract", "translate", "render"):
            task = self.api.submit(self.current, operation)
            for _ in range(3):
                _, current = self.request("GET", self.path)
                self.assertEqual(current["active_task_id"], task["id"])
            self.assertEqual(task["status"], "queued")
            self.assertEqual(task["input_snapshot"]["video_category"], "product")

    def test_png_fixture_separates_categories_without_provider_calls(self):
        from PIL import Image

        evidence = json.loads((fixture.PRODUCT_EVIDENCE / "real-font-evidence.json").read_text())
        for index, example in enumerate(evidence["examples"]):
            path = fixture.PRODUCT_EVIDENCE / f"sample-{index}.png"
            if path.exists():
                self.api.product_examples[example["text"]] = example
                self.api.product_layers[example["layout"]["render_layer_asset_id"]] = path
                break
        item = fixture.segment(1)
        item["translated_text"] = example["text"]
        item["style"]["background_color"] = "#CC220080"
        self.current["segments"] = [item]
        self.api.category_checks = True
        identifiers = []
        for category, alpha in (("unboxing", 128), ("product", 0)):
            self.current["video_category"] = category
            self.api.product_measure(self.current, recognize=True)
            identifier = item["render_layer_asset_id"]
            identifiers.append(identifier)
            image = Image.open(BytesIO(self.api.product_layers[identifier])).convert("RGBA")
            self.assertEqual(image.getpixel((0, 0))[3], alpha)
            self.assertEqual(item["style"]["background_color"], "#CC220080")
        self.assertNotEqual(*identifiers)
        self.assertFalse(self.api.calls)


if __name__ == "__main__":
    unittest.main()
