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

import hashlib
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

from . import thumbs
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
PAGE, PAGE_MAX = 200, 1000  # the Library's lists: a page, and the most one request may ask for


def fts_query(q: str) -> str:
    """Words typed into a search -> a full-text query: every word must match, each as a prefix ("harb" finds
    harbour); quotes and operators typed in are taken as text, never as query syntax."""
    words = re.findall(r"\w+", q or "", re.UNICODE)
    return " ".join(f'"{w}"*' for w in words)


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
        "thumb": thumb_key(rel, st),
    }


def thumb_key(rel: str, st: os.stat_result) -> str:
    """The name of a picture's thumbnail: from its path, size and modified time — a changed file gets a new one."""
    return hashlib.sha1(f"{rel}|{st.st_size}|{st.st_mtime}".encode(), usedforsecurity=False).hexdigest()[:20]


# one row per file, keyed by its path (relative to the output folder): a new file is added, a changed one updated
UPSERT = (
    "INSERT INTO pictures (path, kind, size, mtime, w, h, kiln_id, series, prompt, negative, params, settings, loras,"
    " seed, steps, model, created, thumb) VALUES (:path, :kind, :size, :mtime, :w, :h, :kiln_id, :series, :prompt,"
    " :negative, :params, :settings, :loras, :seed, :steps, :model, :created, :thumb)"
    " ON CONFLICT(path) DO UPDATE SET kind = excluded.kind, size = excluded.size, mtime = excluded.mtime,"
    " w = excluded.w, h = excluded.h, kiln_id = excluded.kiln_id, series = excluded.series, prompt = excluded.prompt,"
    " negative = excluded.negative, params = excluded.params, settings = excluded.settings, loras = excluded.loras,"
    " seed = excluded.seed, steps = excluded.steps, model = excluded.model, created = excluded.created,"
    " thumb = excluded.thumb"
)


class Library:
    def __init__(self, paths: Paths, store: Store, background: bool = True) -> None:
        self.paths = paths
        self.store = store
        self.background = background  # thumbnails made ahead in a thread (tests make them on demand only)
        self.scanning = False
        self._scan_lock = threading.Lock()
        self._todo: list[tuple[str, str]] = []  # (path, thumb key) still to make, newest first
        self._todo_lock = threading.Condition()
        self._maker: threading.Thread | None = None

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
                    self._drop(gone)
                    changed += len(gone)
                self._want_thumbs()
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
            self._drop([rel])
            return
        if path.suffix.lower() in MEDIA:
            row = describe(path, rel, st)
            self._write([row])
            self._queue_thumbs([(rel, row["thumb"])], first=True)

    def count(self) -> int:
        with self.store.lock:
            return int(self.store.con.execute("SELECT COUNT(*) FROM pictures").fetchone()[0])

    def clear(self) -> None:
        """Forget the index and its thumbnails (Settings → Privacy); both rebuild from the pictures, nothing is lost."""
        with self.store.tx() as c:
            c.execute("DELETE FROM pictures")
        with self._todo_lock:
            self._todo.clear()
        for f in self.paths.pthumbs.glob("*.jpg"):
            f.unlink(missing_ok=True)
        if self.background:
            self.start()
        else:
            self.scan()

    # ------------------------------------------------------------ the Library's lists (v0.8 lays them out)
    def page(self, after: str = "", limit: int = PAGE, q: str = "") -> dict[str, Any]:
        """Pictures newest first, a page at a time: `after` is the cursor the last page ended with ("<created>:<id>",
        so pages never skip or repeat a picture while new ones arrive); `q` = words to find in the prompt, series or
        LoRAs (each word matches as a prefix). Each row has what a grid needs — size, kind, thumbnail."""
        limit = max(1, min(int(limit), PAGE_MAX))
        where: list[str] = []
        args: list[Any] = []
        if after:
            try:
                created, pid = after.split(":", 1)
                where.append("(created < ? OR (created = ? AND id < ?))")
                args += [float(created), float(created), int(pid)]
            except ValueError:
                return {"pictures": [], "next": None, "total": 0}
        match = fts_query(q)
        if match:
            where.append("id IN (SELECT rowid FROM pictures_fts WHERE pictures_fts MATCH ?)")
            args.append(match)
        cond = (" WHERE " + " AND ".join(where)) if where else ""
        sql = "SELECT id, path, kind, w, h, thumb, created, series, kiln_id FROM pictures" + cond  # noqa: S608 — fixed text + placeholders
        with self.store.lock:
            rows = self.store.con.execute(
                sql + " ORDER BY created DESC, id DESC LIMIT ?", [*args, limit + 1]
            ).fetchall()
            total = (
                self.store.con.execute(
                    "SELECT COUNT(*) FROM pictures WHERE id IN (SELECT rowid FROM pictures_fts WHERE pictures_fts MATCH ?)",
                    (match,),
                )
                if match
                else self.store.con.execute("SELECT COUNT(*) FROM pictures")
            ).fetchone()[0]
        more = len(rows) > limit
        rows = rows[:limit]
        pics = [
            {
                "id": i,
                "path": path,
                "kind": kind,
                "w": w,
                "h": h,
                "thumb": f"/pthumbs/{t}.jpg" if t else None,
                "created": created,
                "series": series,
                "kiln_id": kid,
            }
            for i, path, kind, w, h, t, created, series, kid in rows
        ]
        nxt = f"{rows[-1][6]!r}:{rows[-1][0]}" if more else None
        return {"pictures": pics, "next": nxt, "total": total}

    def details(self, pid: int) -> dict[str, Any] | None:
        """One picture's full row: prompt, negative prompt, settings, LoRAs, seed, steps, model, series…"""
        with self.store.lock:
            cur = self.store.con.execute("SELECT * FROM pictures WHERE id = ?", (pid,))
            row = cur.fetchone()
            names = [d[0] for d in cur.description]
        if not row:
            return None
        d = dict(zip(names, row, strict=True))
        for k in ("settings", "loras"):
            d[k] = json.loads(d[k]) if d[k] else ({} if k == "settings" else [])
        d["thumb"] = f"/pthumbs/{d['thumb']}.jpg" if d["thumb"] else None
        return d

    # ------------------------------------------------------------ thumbnails (thumbs.py)
    def _drop(self, rels: list[str]) -> None:
        """Rows of files that are gone — and their thumbnails, at once (a deleted picture leaves nothing behind)."""
        with self.store.tx() as c:
            keys = [
                k
                for (k,) in c.execute(
                    f"SELECT thumb FROM pictures WHERE path IN ({','.join('?' * len(rels))})",  # noqa: S608 — placeholders only
                    rels,
                )
                if k
            ]
            c.executemany("DELETE FROM pictures WHERE path = ?", [(p,) for p in rels])
        for k in keys:
            (self.paths.pthumbs / f"{k}.jpg").unlink(missing_ok=True)

    def _want_thumbs(self) -> None:
        """After a scan: every picture without its thumbnail file, newest first; and old files no row names, gone."""
        if not thumbs.available():
            return
        with self.store.lock:
            rows = self.store.con.execute(
                "SELECT path, thumb FROM pictures WHERE kind = 'image' AND thumb IS NOT NULL ORDER BY created DESC"
            ).fetchall()
        have = {f.stem for f in self.paths.pthumbs.glob("*.jpg")} if self.paths.pthumbs.exists() else set()
        keys = {k for _, k in rows}
        for stale in have - keys:
            (self.paths.pthumbs / f"{stale}.jpg").unlink(missing_ok=True)
        self._queue_thumbs([(p, k) for p, k in rows if k not in have])

    def _queue_thumbs(self, items: list[tuple[str, str]], first: bool = False) -> None:
        if not items or not thumbs.available() or not self.background:
            return
        with self._todo_lock:
            self._todo = [*items, *self._todo] if first else [*self._todo, *items]
            self._todo_lock.notify()
            if self._maker is None:
                self._maker = threading.Thread(target=self._make_thumbs, daemon=True, name="thumbs")
                self._maker.start()

    def _make_thumbs(self) -> None:
        """The background maker: one at a time, quietly (the queue's renders matter more than thumbnails)."""
        while True:
            with self._todo_lock:
                while not self._todo:
                    self._todo_lock.wait()
                rel, key = self._todo.pop(0)
            dest = self.paths.pthumbs / f"{key}.jpg"
            if not dest.exists():
                thumbs.make(self.paths.out / rel, dest)

    def thumb_for(self, path: Path) -> Path | None:
        """The thumbnail of a picture in the output folder — made now if it isn't yet; None without Pillow."""
        try:
            rel = path.resolve().relative_to(self.paths.out.resolve()).as_posix()
        except ValueError:
            return None
        with self.store.lock:
            row = self.store.con.execute("SELECT thumb FROM pictures WHERE path = ?", (rel,)).fetchone()
        if not row or not row[0]:
            return None
        dest = self.paths.pthumbs / f"{row[0]}.jpg"
        if dest.exists() or thumbs.make(path, dest):
            return dest
        return None

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
