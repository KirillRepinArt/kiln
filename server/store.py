"""data/kiln.db: one SQLite file for what Kiln keeps — the job list, the job and series numbers, the timings, the pause
flag, and the index of your pictures (library.py).

Why a database: a JSON file is rewritten whole on every change (the job list was ~1 MB at 500 jobs), and a crash
mid-write can empty it (2026-10-27). SQLite writes only what changed, in transactions that survive a crash or a power
cut (write-ahead log, full sync), and leaves no deleted text behind in the file (secure_delete). It's in Python's
standard library, and the file is plainly named in Kiln's own data folder.

The schema has a version (PRAGMA user_version) and one migration per change, run in order on open. The JSON files of
earlier versions are imported once, then moved to data/legacy-json/ (kept, not deleted).

One Store per data folder (Store.open), shared by the job list, the namer and the timings; one connection, one lock —
the HTTP threads, the worker and the delete timers all write through it.
"""

from __future__ import annotations

import json
import logging
import shutil
import sqlite3
import threading
import time
from collections.abc import Callable, Iterable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any, ClassVar

from .config import Paths

log = logging.getLogger("kiln")

Job = dict[str, Any]


def _v1(con: sqlite3.Connection) -> None:
    """The job list (one row per job, in queue order) and a few small documents (numbers, timings, flags)."""
    con.execute("CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    con.execute(
        "CREATE TABLE jobs (id INTEGER PRIMARY KEY, pos INTEGER NOT NULL, status TEXT NOT NULL,"
        " kind TEXT, file TEXT, data TEXT NOT NULL)"
    )
    con.execute("CREATE INDEX jobs_pos ON jobs (pos)")


def _v2(con: sqlite3.Connection) -> None:
    """The index of your pictures (library.py): one row per file in the output folder, with a full-text index over
    prompt, series and LoRAs (kept in step by triggers); kind = image / video, so nothing assumes PNG-only."""
    con.execute(
        "CREATE TABLE pictures (id INTEGER PRIMARY KEY, path TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,"
        " size INTEGER NOT NULL, mtime REAL NOT NULL, w INTEGER, h INTEGER, kiln_id TEXT, series TEXT, prompt TEXT,"
        " negative TEXT, params TEXT, settings TEXT, loras TEXT, seed INTEGER, steps INTEGER, model TEXT,"
        " created REAL NOT NULL)"
    )
    for col in ("kiln_id", "series", "created"):
        con.execute(f"CREATE INDEX pictures_{col} ON pictures ({col})")
    con.execute(
        "CREATE VIRTUAL TABLE pictures_fts USING fts5(prompt, series, loras, content='pictures', content_rowid='id')"
    )
    con.execute(
        "CREATE TRIGGER pictures_ai AFTER INSERT ON pictures BEGIN INSERT INTO pictures_fts (rowid, prompt, series,"
        " loras) VALUES (new.id, new.prompt, new.series, new.loras); END"
    )
    con.execute(
        "CREATE TRIGGER pictures_ad AFTER DELETE ON pictures BEGIN INSERT INTO pictures_fts (pictures_fts, rowid,"
        " prompt, series, loras) VALUES ('delete', old.id, old.prompt, old.series, old.loras); END"
    )
    con.execute(
        "CREATE TRIGGER pictures_au AFTER UPDATE ON pictures BEGIN INSERT INTO pictures_fts (pictures_fts, rowid,"
        " prompt, series, loras) VALUES ('delete', old.id, old.prompt, old.series, old.loras); INSERT INTO"
        " pictures_fts (rowid, prompt, series, loras) VALUES (new.id, new.prompt, new.series, new.loras); END"
    )


def _v3(con: sqlite3.Connection) -> None:
    """Each picture's thumbnail key (thumbs.py): its file in data/pthumbs/ is <key>.jpg; a new key when the file
    changes, so a stale thumbnail is never shown."""
    con.execute("ALTER TABLE pictures ADD COLUMN thumb TEXT")


MIGRATIONS: list[Callable[[sqlite3.Connection], None]] = [
    _v1,
    _v2,
    _v3,
]  # MIGRATIONS[n] takes the schema from n to n + 1


class Store:
    _open: ClassVar[dict[Path, Store]] = {}
    _open_lock: ClassVar[threading.Lock] = threading.Lock()

    @classmethod
    def open(cls, paths: Paths) -> Store:
        """The store of this data folder (one per folder: they all share its connection)."""
        path = paths.db_file.resolve()
        with cls._open_lock:
            s = cls._open.get(path)
            if s is None:
                s = cls._open[path] = cls(path, paths)
            return s

    @classmethod
    def close_all(cls) -> None:
        with cls._open_lock:
            for s in cls._open.values():
                s.con.close()
            cls._open.clear()

    def __init__(self, path: Path, paths: Paths) -> None:
        self.path = path
        self.lock = threading.RLock()
        path.parent.mkdir(parents=True, exist_ok=True)
        new = not path.exists()
        self.con = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        for pragma in ("journal_mode=WAL", "synchronous=FULL", "secure_delete=ON", "foreign_keys=ON"):
            self.con.execute(f"PRAGMA {pragma}")
        self._migrate()
        self._saved: dict[int, tuple[int, str]] = {}  # job id -> (position, its JSON) as last written
        self._order: list[int] = []  # the job ids in list order, as last written
        if new:
            import_json(self, paths)

    def _migrate(self) -> None:
        v = self.con.execute("PRAGMA user_version").fetchone()[0]
        for n in range(v, len(MIGRATIONS)):
            with self.tx():
                MIGRATIONS[n](self.con)
                self.con.execute(f"PRAGMA user_version = {n + 1}")
            log.info("data/kiln.db: schema %d", n + 1)

    @contextmanager
    def tx(self) -> Iterator[sqlite3.Connection]:
        """A transaction: everything inside is written together, or not at all."""
        with self.lock:
            self.con.execute("BEGIN IMMEDIATE")
            try:
                yield self.con
            except BaseException:
                self.con.execute("ROLLBACK")
                raise
            self.con.execute("COMMIT")

    # ------------------------------------------------------------ small documents
    def get(self, key: str, default: Any = None) -> Any:
        with self.lock:
            row = self.con.execute("SELECT value FROM kv WHERE key = ?", (key,)).fetchone()
        return json.loads(row[0]) if row else default

    def put(self, key: str, value: Any) -> None:
        with self.tx() as c:
            c.execute("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", (key, json.dumps(value)))

    # ------------------------------------------------------------ the job list
    def load_jobs(self) -> list[Job]:
        with self.lock:
            rows = self.con.execute("SELECT id, pos, data FROM jobs ORDER BY pos").fetchall()
        self._saved = {i: (p, d) for i, p, d in rows}
        self._order = [i for i, _, _ in rows]
        return [json.loads(d) for _, _, d in rows]

    def save_jobs(self, jobs: list[Job], only: Iterable[int] | None = None) -> tuple[set[int], set[int], bool]:
        """Write the list: only the rows that changed (or moved), and drop the ones that are gone. `only`: the jobs a
        change touched — when the list's order and members are as last written, only those are encoded and compared
        (a one-job change at 10 000 jobs took ~170 ms comparing them all, 2026-10-28); otherwise everything is.
        Returns what changed: the ids written, the ids gone, and whether the order moved (the page's poll gets just
        that — jobqueue.py changes_since)."""
        order = [j["id"] for j in jobs]
        if only is not None and order == self._order:
            pick = set(only)
            now = dict(self._saved)
            for pos, j in enumerate(jobs):
                if j["id"] in pick:
                    now[j["id"]] = (pos, json.dumps(j, ensure_ascii=False))
        else:
            now = {j["id"]: (pos, json.dumps(j, ensure_ascii=False)) for pos, j in enumerate(jobs)}
        changed = [(i, p, d) for i, (p, d) in now.items() if self._saved.get(i) != (p, d)]
        gone = [i for i in self._saved if i not in now]
        moved = order != self._order
        if not changed and not gone:
            return set(), set(), moved
        by_id = {j["id"]: j for j in jobs}
        with self.tx() as c:
            c.executemany("DELETE FROM jobs WHERE id = ?", [(i,) for i in gone])
            c.executemany(
                "INSERT OR REPLACE INTO jobs (id, pos, status, kind, file, data) VALUES (?, ?, ?, ?, ?, ?)",
                [(i, p, by_id[i]["status"], by_id[i].get("kind"), by_id[i].get("file"), d) for i, p, d in changed],
            )
        self._saved = now
        self._order = order
        return {i for i, _, _ in changed}, set(gone), moved


def import_json(store: Store, paths: Paths) -> None:
    """Earlier versions kept JSON files in data/: read them into the new database once, then move them to
    data/legacy-json/ (kept as they were). An unreadable queue.json falls back to queue.json.bak."""
    found = False
    jobs: list[Job] | None = None
    for src in (paths.queue_file, paths.queue_file.with_name(paths.queue_file.name + ".bak")):
        if not src.exists():
            continue
        found = True
        try:
            jobs = json.loads(src.read_text(encoding="utf-8"))
            if src.name.endswith(".bak"):
                log.warning("queue.json was unreadable — imported the previous list (queue.json.bak)")
            break
        except (OSError, ValueError) as e:
            log.warning("%s unreadable (%s)", src.name, e)
    if isinstance(jobs, list):
        store.save_jobs([j for j in jobs if isinstance(j, dict) and "id" in j])
    for key, f in (
        ("ids", paths.ids_file),
        ("names", paths.names_file),
        ("flags", paths.flags_file),
        ("stats", paths.stats_file),
        ("history", paths.history_file),
    ):
        if not f.exists():
            continue
        found = True
        try:
            store.put(key, json.loads(f.read_text(encoding="utf-8")))
        except (OSError, ValueError) as e:
            log.warning("%s unreadable, not imported (%s)", f.name, e)
    if not found:
        return
    keep = paths.data / "legacy-json"
    keep.mkdir(exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    q = paths.queue_file
    olds = [q, q.with_name(q.name + ".bak"), *q.parent.glob(q.name + ".unreadable-*")]
    olds += [paths.ids_file, paths.names_file, paths.flags_file, paths.stats_file, paths.history_file]
    for f in (f for f in olds if f.exists()):
        try:
            shutil.move(str(f), str(keep / f"{f.name}.{stamp}" if (keep / f.name).exists() else keep / f.name))
        except OSError as e:
            log.warning("couldn't move %s to legacy-json/ (%s)", f.name, e)
    log.info("data/kiln.db: imported the JSON files of an earlier version (kept in data/legacy-json/)")
