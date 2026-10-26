"""What the generator offers — checkpoints, modules, upscalers, LoRAs — with Kiln's own additions (each LoRA's
category from its folder, its picture), cached for a minute."""

from __future__ import annotations

import time
from collections.abc import Mapping
from typing import Any

from .backends import Backend
from .config import Paths

CACHE_SECONDS = 60


class Catalog:
    def __init__(self, cfg: Mapping[str, Any], paths: Paths, backend: Backend) -> None:
        self.cfg = cfg
        self.paths = paths
        self.backend = backend
        self._t = 0.0
        self._data: dict[str, Any] | None = None

    def category(self, folder: str) -> str:
        f = folder.lower()
        if f in self.cfg["people_folders"]:
            return "people"
        if f in self.cfg["style_folders"]:
            return "style"
        return "utility"

    def get(self, refresh: bool = False) -> dict[str, Any]:
        if self._data and not refresh and time.time() - self._t < CACHE_SECONDS:
            return self._data
        data = self.backend.models(refresh)
        loras = []
        for lora in data["loras"]:
            name = lora["name"]
            thumb = self.paths.thumbs / f"{name}.jpg"
            loras.append(
                {
                    "name": name,
                    "folder": lora["folder"],
                    "category": self.category(lora["folder"]),
                    "internal": lora["internal"],
                    "thumb": f"/thumbs/{name}.jpg" if thumb.exists() else None,
                }
            )
        data["loras"] = sorted(loras, key=lambda x: x["name"].lower())
        self._t, self._data = time.time(), data
        return data

    def invalidate(self) -> None:
        """A LoRA got a new picture: the next request builds the list again."""
        self._data = None
