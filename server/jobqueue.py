"""The job list: every picture asked for, waiting, rendering or finished; saved to data/queue.json on every change.

One lock guards the list (the worker, the HTTP threads and the delete timers all touch it). Every change goes through
save(), which bumps the revision — the page's light poll compares against it (see signature()).
A job is a plain dict, saved as is: id, kind (txt2img / upscale), status (pending / running / done / cancelled /
error / deleted), spec (what the page asked for), progress fields, file (once saved); keys starting with "_" are the
server's own and never leave it (public()).
"""

from __future__ import annotations

import json
import logging
import threading
import time
from collections.abc import Callable, Iterable
from typing import Any

from .config import Paths
from .timings import Estimate

log = logging.getLogger("kiln")

Job = dict[str, Any]
WAITING = ("pending", "running")
FINISHED = ("done", "cancelled", "error")


def public(job: Job) -> Job:
    """The job as the page sees it: without the server's own "_" keys."""
    return {k: v for k, v in job.items() if not k.startswith("_")}


class JobQueue:
    def __init__(self, paths: Paths) -> None:
        self.paths = paths
        self.lock = threading.RLock()
        self.wake = threading.Event()  # set when there's new work: the worker stops waiting
        self.jobs: list[Job] = []
        self.flags: dict[str, Any] = {"paused": False}  # Pause queue: the running job finishes, nothing new starts
        self.rev = 0  # bumped on every change to the list
        self._miss_t = 0.0
        self._miss: frozenset[int] = frozenset()

    # ------------------------------------------------------------ saving
    def load(self) -> None:
        f = self.paths.queue_file
        if f.exists():
            try:
                self.jobs = json.loads(f.read_text(encoding="utf-8"))
            except (OSError, ValueError) as e:
                log.warning("queue.json unreadable, starting empty: %s", e)
        for j in self.jobs:  # a crash mid-job: run it again
            if j["status"] == "running":
                j.update(status="pending", step=0, progress=0)
        if self.paths.flags_file.exists():
            try:
                self.flags.update(json.loads(self.paths.flags_file.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                pass

    def save(self) -> None:
        self.rev += 1
        tmp = self.paths.queue_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.jobs, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(self.paths.queue_file)

    def set_paused(self, paused: bool) -> None:
        with self.lock:
            self.flags["paused"] = paused
            self.paths.flags_file.write_text(json.dumps(self.flags), encoding="utf-8")
        self.wake.set()

    # ------------------------------------------------------------ looking things up (hold the lock)
    def find(self, jid: Any) -> Job | None:
        return next((j for j in self.jobs if j["id"] == jid), None)

    def running(self) -> Job | None:
        return next((j for j in self.jobs if j["status"] == "running"), None)

    def next_pending(self) -> Job | None:
        """The job to start next — none while the queue is paused."""
        with self.lock:
            if self.flags["paused"]:
                return None
            return next((j for j in self.jobs if j["status"] == "pending"), None)

    def busy(self) -> int:
        """How many jobs are waiting or rendering."""
        with self.lock:
            return sum(1 for j in self.jobs if j["status"] in WAITING)

    def files(self) -> list[str]:
        return [j["file"] for j in self.jobs if j.get("file")]

    def missing_ids(self) -> frozenset[int]:
        """Finished jobs whose file is gone (deleted outside Kiln) — checked at most every 2 s: with hundreds of
        pictures a file check per job on every poll added up."""
        now = time.time()
        if now - self._miss_t > 2:
            self._miss_t = now
            self._miss = frozenset(
                j["id"]
                for j in self.jobs
                if j["status"] == "done" and j.get("file") and not (self.paths.out / j["file"]).exists()
            )
        return self._miss

    def signature(self) -> str:
        """What the page has seen: the list's revision, which files are missing, paused. Same signature = the page
        only needs the running job's progress (the light poll — the full list was ~1 MB at 500 jobs, every 0.7 s)."""
        return f"{self.rev}.{hash(self.missing_ids()) & 0xFFFFFFFF}.{int(self.flags['paused'])}"

    def public_list(self, estimate: Callable[[Any], Estimate]) -> list[Job]:
        """The list for the page: est / est_first on waiting jobs; finished files that are gone are marked missing;
        deleted jobs (waiting out their undo window) are left out."""
        out = []
        miss = self.missing_ids()
        for j in self.jobs:
            if j["status"] == "deleted":
                continue
            pj = public(j)
            if j["id"] in miss:
                pj["missing"] = True
            if j["status"] == "pending" and j.get("kind", "txt2img") == "txt2img":
                pj["est"], pj["est_first"] = estimate(j["spec"])
            out.append(pj)
        return out

    # ------------------------------------------------------------ changes
    def next_id(self) -> int:
        """Job ids are never handed out again (like file names): the page keys its state and its image copies by id,
        and a reused id made a new job look like one it had already seen (2026-10-24)."""
        f = self.paths.ids_file
        try:
            hw = int(json.loads(f.read_text(encoding="utf-8")).get("high", 0))
        except (OSError, ValueError, AttributeError):
            hw = 0
        n = max(hw, max([j["id"] for j in self.jobs], default=0)) + 1
        try:
            f.write_text(json.dumps({"high": n}), encoding="utf-8")
        except OSError:
            pass
        return n

    def add(self, specs: Iterable[dict[str, Any]]) -> list[int]:
        """New jobs at the end of the line."""
        ids = []
        with self.lock:
            for sp in specs:
                j: Job = {
                    "id": self.next_id(),
                    "kind": sp.pop("kind", "txt2img"),
                    "status": "pending",
                    "created": time.time(),
                    "spec": sp,
                    "step": 0,
                    "progress": 0,
                }
                j["steps"] = sp.get("steps", 0)
                self.jobs.append(j)
                ids.append(j["id"])
            self.save()
        self.wake.set()
        return ids

    def add_upscale(self, src: Job, upscaler: Any, scale: Any) -> int:
        """An upscale jumps the line: seconds next to minutes, it runs right after the current picture."""
        with self.lock:
            j: Job = {
                "id": self.next_id(),
                "kind": "upscale",
                "status": "pending",
                "created": time.time(),
                "step": 0,
                "progress": 0,
                "spec": {
                    "source": src["file"],
                    "upscaler": upscaler,
                    "scale": scale,
                    "prompt": f"Upscale ×{scale} · {src['file']}",  # noqa: RUF001 — a real multiplication sign, shown in the queue
                    "name": "",
                    "w": src["spec"]["w"],
                    "h": src["spec"]["h"],
                    "steps": 0,
                    "mp": src["spec"].get("mp"),
                    "ar": src["spec"].get("ar"),
                },
            }
            first = next((i for i, x in enumerate(self.jobs) if x["status"] == "pending"), len(self.jobs))
            self.jobs.insert(first, j)
            self.save()
        self.wake.set()
        return int(j["id"])

    def reorder(self, order: list[Any]) -> None:
        """Waiting jobs in the page's order (ids it didn't mention keep theirs, after it); the rest stay in front."""
        with self.lock:
            pend = {j["id"]: j for j in self.jobs if j["status"] == "pending"}
            rest = [j for j in self.jobs if j["status"] != "pending"]
            ordered = [pend.pop(i) for i in order if i in pend] + list(pend.values())
            self.jobs[:] = rest + ordered
            self.save()

    def keep_only(self, keep: Callable[[Job], bool]) -> None:
        with self.lock:
            self.jobs[:] = [j for j in self.jobs if keep(j)]
            self.save()

    def clear_finished(self) -> None:
        self.keep_only(lambda j: j["status"] in WAITING)
