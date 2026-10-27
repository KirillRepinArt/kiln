"""The index of your pictures (v0.7b; the Library of v0.8 stands on it): one row per file in the output folder, sub-folders
too — its size, date, kind (image / video), and what the picture's own text says: prompt, settings, LoRAs, seed,
model, series, and Kiln's id for it. The Library lays out, searches and sorts from these rows, never opening a picture
to draw a page.

Built from the pictures themselves (a PNG keeps its parameters in text chunks), so it can always be cleared and
rebuilt — nothing is lost. Kept current incrementally: a scan compares each file's size and modified time with its
row (only new or changed files are read); a render adds its row as it lands; Kiln's own deletes, renames and restores
update theirs. Reading a PNG here never reads its pixels: the text chunks are found by jumping from header to header.

`kiln_id`: a hidden id Kiln writes into each new render (an iTXt chunk, like `kiln_name`), so a picture is recognised
after you move or rename it outside Kiln (names alone break on duplicates). Kiln never rewrites an existing picture to
add one (2026-10-25, the user's decision): older pictures are matched by name, size and seed when the Library needs it.
"""

from __future__ import annotations

import json
import logging
import os
import re
import struct
import threading
import time
import zlib
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from .config import Paths
from .store import Store

log = logging.getLogger("kiln")

MEDIA = {
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
    ".mp4": "video",
    ".webm": "video",
    ".mov": "video",
}
LORA = re.compile(r"\s*<lora:([^:>]+):([-\d.]+)>")
BATCH = 200  # rows per transaction while scanning: short transactions, the queue never waits long for the lock


def png_meta(path: Path) -> tuple[int | None, int | None, dict[str, str]]:
    """A PNG's size (from IHDR) and its text chunks (tEXt / zTXt / iTXt), without reading its pixels."""
    w = h = None
    texts: dict[str, str] = {}
    with open(path, "rb") as f:
        if f.read(8) != b"\x89PNG\r\n\x1a\n":
            return None, None, texts
        while True:
            head = f.read(8)
            if len(head) < 8:
                break
            n, kind = struct.unpack(">I", head[:4])[0], head[4:]
            if kind == b"IHDR":
                w, h = struct.unpack(">II", f.read(8))
                f.seek(n - 8 + 4, os.SEEK_CUR)
            elif kind in (b"tEXt", b"zTXt", b"iTXt") and n < 4_000_000:
                body = f.read(n)
                f.seek(4, os.SEEK_CUR)
                try:
                    key, rest = body.split(b"\0", 1)
                    if kind == b"tEXt":
                        texts[key.decode("latin1")] = rest.decode("latin1")
                    elif kind == b"zTXt":
                        texts[key.decode("latin1")] = zlib.decompress(rest[1:]).decode("latin1")
                    else:
                        comp, rest = rest[0], rest[2:]
                        _lang, rest = rest.split(b"\0", 1)
                        _tkey, val = rest.split(b"\0", 1)
                        texts[key.decode("latin1")] = (zlib.decompress(val) if comp else val).decode("utf-8")
                except (ValueError, zlib.error, UnicodeDecodeError):
                    pass
            elif kind == b"IEND":
                break
            else:
                f.seek(n + 4, os.SEEK_CUR)  # the pixels (IDAT) and everything else: jumped over
    return w, h, texts


def parse_parameters(text: str) -> dict[str, Any]:
    """Forge's / A1111's "parameters" text -> prompt, negative prompt, settings, LoRAs, seed, steps, model. Text in
    another layout (another tool's) is kept whole as the prompt, with no settings."""
    m = re.search(r"\n(Negative prompt:|Steps:)", text)
    line = re.search(r"(^|\n)(Steps:[^\n]*)", text)
    if not m or not line:
        return {"prompt": text.strip(), "negative": "", "settings": {}, "loras": []}
    head, rest = text[: m.start()], text[m.start() + 1 :]
    neg = re.match(r"Negative prompt:\s*([\s\S]*?)(?=\nSteps:|$)", rest)
    settings = {
        k.strip(): v.strip().strip('"')
        for k, v in re.findall(r"\s*([^:,]+?):\s*(\"(?:[^\"\\]|\\.)*\"|[^,]*)(?:,|$)", line.group(2))
    }
    loras = [{"name": n, "w": float(w)} for n, w in LORA.findall(head)]
    return {
        "prompt": LORA.sub("", head).strip(),
        "negative": neg.group(1).strip() if neg else "",
        "settings": settings,
        "loras": loras,
    }


def _int(v: Any) -> int | None:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def describe(path: Path, rel: str, st: os.stat_result) -> dict[str, Any]:
    """The row for one file."""
    kind = MEDIA.get(path.suffix.lower(), "")
    w = h = None
    texts: dict[str, str] = {}
    if path.suffix.lower() == ".png":
        try:
            w, h, texts = png_meta(path)
        except OSError:
            pass
    p = parse_parameters(texts["parameters"]) if "parameters" in texts else None
    s = p["settings"] if p else {}
    return {
        "path": rel,
        "kind": kind,
        "size": st.st_size,
        "mtime": st.st_mtime,
        "w": w,
        "h": h,
        "kiln_id": texts.get("kiln_id"),
        "series": texts.get("kiln_name"),
        "prompt": p["prompt"] if p else None,
        "negative": p["negative"] if p else None,
        "params": texts.get("parameters"),
        "settings": json.dumps(s) if s else None,
        "loras": json.dumps(p["loras"]) if p and p["loras"] else None,
        "seed": _int(s.get("Seed")),
        "steps": _int(s.get("Steps")),
        "model": s.get("Model"),
        "created": min(st.st_mtime, getattr(st, "st_birthtime", st.st_ctime)),
    }


# one row per file, keyed by its path (relative to the output folder): a new file is added, a changed one updated
UPSERT = (
    "INSERT INTO pictures (path, kind, size, mtime, w, h, kiln_id, series, prompt, negative, params, settings, loras,"
    " seed, steps, model, created) VALUES (:path, :kind, :size, :mtime, :w, :h, :kiln_id, :series, :prompt,"
    " :negative, :params, :settings, :loras, :seed, :steps, :model, :created)"
    " ON CONFLICT(path) DO UPDATE SET kind = excluded.kind, size = excluded.size, mtime = excluded.mtime,"
    " w = excluded.w, h = excluded.h, kiln_id = excluded.kiln_id, series = excluded.series, prompt = excluded.prompt,"
    " negative = excluded.negative, params = excluded.params, settings = excluded.settings, loras = excluded.loras,"
    " seed = excluded.seed, steps = excluded.steps, model = excluded.model, created = excluded.created"
)


class Library:
    def __init__(self, paths: Paths, store: Store) -> None:
        self.paths = paths
        self.store = store
        self.scanning = False
        self._scan_lock = threading.Lock()

    def _files(self) -> Iterator[tuple[Path, str, os.stat_result]]:
        """Every picture / video under the output folder (sub-folders too), with its path relative to it."""
        root = self.paths.out
        stack = [root]
        while stack:
            d = stack.pop()
            try:
                entries = list(os.scandir(d))
            except OSError:
                continue
            for e in entries:
                if e.is_dir(follow_symlinks=False):
                    stack.append(Path(e.path))
                elif Path(e.name).suffix.lower() in MEDIA:
                    try:
                        st = e.stat()
                    except OSError:
                        continue
                    p = Path(e.path)
                    yield p, p.relative_to(root).as_posix(), st

    def scan(self) -> int:
        """Bring the index up to date with the folder: read new or changed files, drop the rows of files gone.
        Returns how many rows changed."""
        with self._scan_lock:
            self.scanning = True
            try:
                with self.store.lock:
                    known = {p: (s, m) for p, s, m in self.store.con.execute("SELECT path, size, mtime FROM pictures")}
                seen: set[str] = set()
                batch: list[dict[str, Any]] = []
                changed = 0
                for path, rel, st in self._files():
                    seen.add(rel)
                    if known.get(rel) == (st.st_size, st.st_mtime):
                        continue
                    batch.append(describe(path, rel, st))
                    if len(batch) >= BATCH:
                        changed += self._write(batch)
                        batch = []
                changed += self._write(batch)
                gone = [p for p in known if p not in seen]
                if gone:
                    with self.store.tx() as c:
                        c.executemany("DELETE FROM pictures WHERE path = ?", [(p,) for p in gone])
                    changed += len(gone)
                return changed
            finally:
                self.scanning = False

    def _write(self, rows: list[dict[str, Any]]) -> int:
        if rows:
            with self.store.tx() as c:
                c.executemany(UPSERT, rows)
        return len(rows)

    def index_file(self, path: Path) -> None:
        """One file changed by Kiln (a render landed, a delete, a rename, a restore): its row follows."""
        try:
            rel = path.resolve().relative_to(self.paths.out.resolve()).as_posix()
        except ValueError:
            return  # not in the output folder
        try:
            st = path.stat()
        except OSError:
            with self.store.tx() as c:
                c.execute("DELETE FROM pictures WHERE path = ?", (rel,))
            return
        if path.suffix.lower() in MEDIA:
            self._write([describe(path, rel, st)])

    def count(self) -> int:
        with self.store.lock:
            return int(self.store.con.execute("SELECT COUNT(*) FROM pictures").fetchone()[0])

    def clear(self) -> None:
        """Forget the index (Settings → Privacy); it rebuilds from the pictures, so nothing is lost."""
        with self.store.tx() as c:
            c.execute("DELETE FROM pictures")
        self.start()

    def start(self) -> None:
        """Scan in the background (at start-up, after a Clear): Kiln is usable at once."""

        def run() -> None:
            t0 = time.time()
            try:
                n = self.scan()
            except Exception:
                log.exception("the picture index couldn't be brought up to date")
                return
            if n:
                log.info("picture index: %d updated in %.1f s (%d pictures)", n, time.time() - t0, self.count())

        threading.Thread(target=run, daemon=True, name="library-scan").start()
