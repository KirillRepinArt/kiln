"""Puts the server together and runs it: the queue, the worker, the generator's health check, the window watchdog,
and the HTTP server."""

from __future__ import annotations

import logging
import logging.handlers
import sys
import threading
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from .backends import Backend, make_backend
from .catalog import Catalog
from .config import CFG, Paths
from .jobqueue import JobQueue
from .lifecycle import Window, watchdog
from .pictures import Pictures
from .timings import Timings
from .web import KilnServer
from .worker import Worker

log = logging.getLogger("kiln")

LOG_SIZE, LOG_KEEP = 1_000_000, 3  # data/kiln.log: rotated at 1 MB, three old ones kept


@dataclass
class Kiln:
    """Everything the server runs on, made once at start-up (the HTTP handlers reach it as self.server.kiln)."""

    cfg: Mapping[str, Any]
    paths: Paths
    queue: JobQueue
    timings: Timings
    pictures: Pictures
    backend: Backend
    catalog: Catalog
    worker: Worker
    window: Window = field(default_factory=Window)


def create(cfg: Mapping[str, Any]) -> Kiln:
    paths = Paths.from_config(cfg)
    queue = JobQueue(paths)
    timings = Timings(paths)
    pictures = Pictures(paths, queue)
    backend = make_backend(cfg)
    return Kiln(
        cfg=cfg,
        paths=paths,
        queue=queue,
        timings=timings,
        pictures=pictures,
        backend=backend,
        catalog=Catalog(cfg, paths, backend),
        worker=Worker(paths, queue, backend, timings, pictures),
    )


def setup_logging(paths: Paths) -> None:
    """The console (Kiln's server window, or the test runner) gets the plain messages; data/kiln.log keeps them with
    the time, for when something went wrong while nobody was watching."""
    for stream in (sys.stdout, sys.stderr):  # Windows consoles default to a legacy codepage
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except (AttributeError, ValueError):
            pass
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(logging.Formatter("%(message)s"))
    logfile = logging.handlers.RotatingFileHandler(
        paths.log_file, maxBytes=LOG_SIZE, backupCount=LOG_KEEP, encoding="utf-8"
    )
    logfile.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.handlers[:] = [console, logfile]
    log.setLevel(logging.INFO)
    log.propagate = False


def main() -> None:
    k = create(CFG)
    k.paths.make_dirs()
    setup_logging(k.paths)
    k.queue.load()
    k.pictures.tidy()
    k.timings.load(k.queue.jobs)
    k.backend.start()
    k.worker.start()
    threading.Thread(target=k.backend.watch, daemon=True).start()
    threading.Thread(target=watchdog, args=(k.cfg, k.window, k.queue, k.backend.stop), daemon=True).start()
    srv = KilnServer((CFG["host"], CFG["port"]), k)
    log.info(
        "Kiln on http://%s:%s  ·  Forge: %s  ·  images → %s", CFG["host"], CFG["port"], CFG["forge_url"], k.paths.out
    )
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
