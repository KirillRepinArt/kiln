"""One Kiln per data folder, on a port of its own.

Two servers on one data folder would both run jobs and overwrite each other's queue.json, so the server holds an
operating-system lock on data/kiln.lock while it runs (released by the OS even if it crashes: never a stale lock).
The port it got is written to data/instance.json, so the launcher can find it; /api/hello answers who it is.
"""

from __future__ import annotations

import json
import os
import socket
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import IO, Any, TypeVar

T = TypeVar("T")
PORT_TRIES = 20  # the configured port, then the next ones, then any free one


@dataclass
class InstanceLock:
    """An exclusive lock on a file, held for the life of the process."""

    path: Path
    _f: IO[bytes] | None = field(default=None, repr=False)

    def acquire(self) -> bool:
        f = open(self.path, "a+b")  # held open on purpose: the lock lives as long as the file is open
        try:
            if os.name == "nt":
                import msvcrt

                f.seek(0)
                msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)  # type: ignore[attr-defined,unused-ignore]
        except OSError:
            f.close()
            return False
        self._f = f
        return True

    def release(self) -> None:
        if self._f:
            self._f.close()  # closing the file releases the lock
            self._f = None


def exclusive(sock: socket.socket) -> None:
    """On Windows a port is shared silently unless it's claimed exclusively (SO_REUSEADDR there means "share")."""
    if os.name == "nt":
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)  # type: ignore[attr-defined,unused-ignore]


def ports(preferred: int, tries: int = PORT_TRIES) -> Iterable[int]:
    """The ports to try, in order: the configured one, the next ones, then 0 (any free port the system picks)."""
    yield from range(preferred, preferred + tries)
    yield 0


def bind_first(make: Callable[[int], T], preferred: int) -> tuple[T, int]:
    """make(port) for the first port that's free: (what it made, the port)."""
    last: OSError | None = None
    for port in ports(preferred):
        try:
            return make(port), port
        except OSError as e:
            last = e
    raise last or OSError("no free port")


def write_instance(data: Path, port: int) -> None:
    (data / "instance.json").write_text(json.dumps({"port": port, "pid": os.getpid()}), encoding="utf-8")


def read_instance(data: Path) -> dict[str, Any] | None:
    try:
        info = json.loads((data / "instance.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return info if isinstance(info, dict) and isinstance(info.get("port"), int) else None
