"""Private immutable PNG layers isolated by workspace, never gallery assets."""

from __future__ import annotations

import asyncio
import logging
import re
from collections import OrderedDict
from urllib.parse import quote

from backend.app.core.logging import log_event
from backend.app.repositories.base import NotFoundError

logger = logging.getLogger(__name__)
_HASH = re.compile(r"^[a-f0-9]{64}$")


class SubtitleLayerStorage:
    def __init__(self, repository, asset_storage):
        self.repository = repository
        self.client = getattr(asset_storage, "client", None)
        self._uploaded = OrderedDict()

    def key(self, workspace_id, layer_id):
        self.repository.get_subtitle_workspace(workspace_id)
        if not _HASH.fullmatch(layer_id):
            raise NotFoundError("subtitle layer not found")
        return f"subtitle-layers/{quote(workspace_id, safe='')}/{layer_id}.png"

    async def store(self, workspace_id, layer):
        key = self.key(workspace_id, layer["id"])
        if self.client is None:
            raise ValueError("subtitle layer storage unavailable")
        if key not in self._uploaded:
            # Hash-addressed layers are immutable. Re-uploading identical bytes is safe
            # across restarts/processes; old task layers must never be deleted here.
            await asyncio.to_thread(self.client.put_object, key=key,
                                    content=layer["content"], content_type="image/png")
            self._uploaded[key] = True
            if len(self._uploaded) > 512:
                self._uploaded.popitem(last=False)
            log_event(logger, "subtitle_translation.layer_stored", outcome="succeeded",
                      workspace_id=workspace_id, layer_id=layer["id"],
                      byte_count=len(layer["content"]))
        else:
            self._uploaded.move_to_end(key)
        return key

    async def prepare(self, workspace_id, compiled, *, submit=False):
        from video_subtitle_grounding.product_layout import materialize_layers

        async def materialize(layer):
            key = await self.store(workspace_id, layer)
            return await asyncio.to_thread(self.client.signed_url, key=key)

        if submit:
            await materialize_layers(compiled, materialize)
        else:
            for layer in compiled.get("layers", {}).values():
                await self.store(workspace_id, layer)
        for summary in compiled.get("layouts", {}).values():
            layer_id = summary.get("render_layer_asset_id")
            if layer_id:
                summary["render_layer_url"] = (
                    f"/api/tools/subtitle-translation/workspaces/{quote(workspace_id, safe='')}"
                    f"/layers/{layer_id}.png"
                )

    async def read(self, workspace_id, layer_id):
        key = self.key(workspace_id, layer_id)
        try:
            content = await asyncio.to_thread(self.client.get_object, key=key)
        except Exception:  # noqa: BLE001 - storage errors must not expose private URLs
            raise NotFoundError("subtitle layer not found") from None
        if not isinstance(content, bytes) or not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise NotFoundError("subtitle layer not found")
        return content
