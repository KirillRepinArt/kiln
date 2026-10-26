"""Is a Kiln window still open? The server stops when the last one closed and the queue is done."""

from __future__ import annotations

import logging
import os
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

from .jobqueue import JobQueue

log = logging.getLogger("kiln")

GOODBYE_GRACE = 3  # seconds after a goodbye before the window counts as closed (a reload comes back sooner)
IN_FLIGHT = 1.5  # a poll this soon after the goodbye was already on its way
SILENCE = 600  # no goodbye (a crash) and no poll this long: the window is gone


@dataclass
class Window:
    """What the server knows about the Kiln windows: the last poll, a goodbye, whether the browser cache was cleared."""

    last: float | None = None
    bye: float | None = None
    purged: bool = False


def window_gone(now: float, last: float, bye: float | None) -> bool:
    """True when the Kiln window has closed: it said goodbye over 3 s ago and no window polled since — a poll that was
    already on its way (within 1.5 s of the goodbye) doesn't count; a reload cancels the goodbye by loading the page
    (see web.py) — or 10 min of silence (a crash: no goodbye)."""
    return (bye is not None and last < bye + IN_FLIGHT and now - bye > GOODBYE_GRACE) or now - last > SILENCE


def watchdog(cfg: Mapping[str, Any], window: Window, queue: JobQueue, on_exit: Callable[[], None]) -> None:
    """Exit when no Kiln window is open and nothing is queued or running (a thread).

    A closing window says goodbye (/api/bye): stop ~3 s later unless another window (or a reload) polls first.
    Without a goodbye (crash, killed browser) a window counts as gone after 10 min without a poll — not sooner: Edge
    slows the timers of a page left in the background to about once a minute, and a 15 s limit shut the server down
    under a Kiln window that was simply minimized (2026-10-18)."""
    said = None
    while True:
        time.sleep(1)
        if not cfg.get("exit_when_closed", True) or window.last is None:
            continue
        if not window_gone(time.time(), window.last, window.bye):
            said = None
            continue
        busy = queue.busy()
        if not busy:
            log.info("Kiln window closed and queue empty — stopping the server.")
            on_exit()
            os._exit(0)
        if said != busy:  # explain why the server is still up
            log.info("Kiln window closed — finishing %s queued job%s, then stopping.", busy, "s" * (busy != 1))
            said = busy
