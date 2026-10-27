"""Writing files so a crash can't empty them.

A plain write is only in the system's cache for a moment; a crash or power cut then can leave the file empty or
zero-filled even though Windows recorded it (2026-10-27: a blue screen mid-save left queue.json empty — Kiln started
with no list — and a picture 1.4 MB of zeros). So: write a temp file next to it, push it onto the disk (fsync), then
swap it in (os.replace is atomic): a crash leaves the old file or the new one, never a broken one. For the files Kiln
can't rebuild by itself, the previous version stays as <name>.bak — a second chance if the new one can't be read.
"""

from __future__ import annotations

import os
from pathlib import Path


def write_bytes(path: Path, data: bytes, *, keep_previous: bool = False) -> None:
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    if keep_previous and path.exists():
        os.replace(path, path.with_name(path.name + ".bak"))
    os.replace(tmp, path)


def write_text(path: Path, text: str, *, keep_previous: bool = False) -> None:
    write_bytes(path, text.encode("utf-8"), keep_previous=keep_previous)
