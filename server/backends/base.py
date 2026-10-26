"""What Kiln needs from an image generator. Forge Neo is the first (forge.py); ComfyUI comes next (ROADMAP v0.10).

The rest of the server only talks to a Backend: it never builds a generator's URL or reads its answers. A backend
renders pictures from a job's spec, reports progress while it does, and can be started, watched and stopped.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Protocol


class BackendError(Exception):
    """The generator couldn't be reached or refused a request (the message says how, in the generator's words)."""


@dataclass
class Progress:
    """How far a render is, as the generator reports it."""

    step: Any  # the step being sampled (0 before the first)
    steps: int  # steps in all; 0 = the generator hasn't said yet
    progress: float  # 0..1
    eta: float  # seconds left, the generator's own guess
    image: bytes | None  # the live preview, if it sent one


@dataclass
class Render:
    """A finished picture: the file's bytes (with the generator's own parameters inside), the seed it used, and the
    parameters as text (shown in PNG Info)."""

    image: bytes
    seed: Any
    infotext: str


class Backend(Protocol):
    label: str  # the generator's name, for messages ("Forge: connection refused")
    # what the page shows about the generator: {"ok", "error", "busy", "starting"} (sent as "forge" in /api/state)
    status: dict[str, Any]

    def detect(self) -> bool:
        """Is it answering right now?"""
        ...

    def start(self) -> None:
        """Start the generator if it isn't running and Kiln is set up to start it."""
        ...

    def stop(self) -> None:
        """Stop the generator again — only if Kiln started it and nothing else is using it."""
        ...

    def health(self) -> None:
        """Check on it once and update `status`."""
        ...

    def watch(self) -> None:
        """health() every few seconds, for ever (a thread)."""
        ...

    def ready(self) -> bool:
        """Before a job: can it take one? (updates `status`)"""
        ...

    def models(self, refresh: bool) -> dict[str, Any]:
        """What it offers: checkpoints, modules, upscalers, loras ({name, folder, internal}), current."""
        ...

    def txt2img(
        self, spec: Mapping[str, Any], on_progress: Callable[[Progress], None], cancelled: Callable[[], bool]
    ) -> Render | None:
        """Render a picture (blocks until it's done); None if it was cancelled."""
        ...

    def upscale(self, image: bytes, upscaler: Any, scale: Any) -> bytes: ...

    def interrupt(self) -> None:
        """Stop the render in progress (at the generator's next chance)."""
        ...
