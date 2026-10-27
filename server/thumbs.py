"""Thumbnails made by the server (v0.7b): one small JPEG per picture, made once in the background, for the Queue now and
the Library next. The page used to make them one by one (decoding each full picture in the browser); the server does it
off the page, ahead of time.

Pillow decodes the pictures — the one run-time dependency (decision 0005: pinned, and bundled with Kiln's own Python
when the launcher comes). Until it's there it's optional: without it no thumbnail is made here, and the page makes the
Queue's as before (it asks, gets nothing, draws its own).
"""

from __future__ import annotations

import importlib
import io
import logging
from pathlib import Path
from typing import Any

from . import durable

log = logging.getLogger("kiln")

SIZE = 384  # the long side, px: the Queue's square crop, and a justified Library row at 2x density
QUALITY = 80

try:
    _Image: Any = importlib.import_module("PIL.Image")
except ImportError:
    _Image = None


def available() -> bool:
    return _Image is not None


def make(src: Path, dest: Path) -> bool:
    """A thumbnail of `src` at `dest` (JPEG, the long side SIZE); False when it can't be made."""
    if _Image is None:
        return False
    try:
        with _Image.open(src) as im:
            im.draft("RGB", (SIZE, SIZE))  # JPEGs decode at a reduced size straight away
            im = im.convert("RGB")
            im.thumbnail((SIZE, SIZE), reducing_gap=2.0)
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=QUALITY, optimize=True)
        dest.parent.mkdir(parents=True, exist_ok=True)
        durable.write_bytes(dest, buf.getvalue())
        return True
    except Exception as e:  # noqa: BLE001 — a broken or unknown file (Pillow raises many kinds): no thumbnail, no crash
        log.debug("no thumbnail for %s: %s", src.name, e)
        return False
