"""Image generators behind one interface (base.Backend). Today: Forge Neo."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .base import Backend, BackendError, Progress, Render
from .forge import ForgeBackend

__all__ = ["Backend", "BackendError", "ForgeBackend", "Progress", "Render", "make_backend"]


def make_backend(cfg: Mapping[str, Any]) -> ForgeBackend:
    """The generator the settings point at (one kind so far)."""
    return ForgeBackend(cfg)
