"""The job list: every picture asked for, waiting, rendering or finished; saved to data/kiln.db on every change.

One lock guards the list (the worker, the HTTP threads and the delete timers all touch it). Every change goes through
save(), which bumps the revision — the page's light poll compares against it (see signature()).
A job is a plain dict, saved as is: id, kind (txt2img / upscale), status (pending / running / done / cancelled /
error / deleted), spec (what the page asked for), progress fields, file (once saved); keys starting with "_" are the
server's own and never leave it (public()).
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable, Iterable
from typing import Any

from .config import Paths
from .store import Store
from .timings import Estimate

log = logging.getLogger("kiln")

Job = dict[str, Any]
WAITING = ("pending", "running")
FINISHED = ("done", "cancelled", "error")
CHANGES_KEPT = 200  # revisions remembered for the page's poll (a page further behind gets the whole list)


def public(job: Job) -> Job:
    """The job as the page sees it: without the server's own "_" keys."""
    return {k: v for k, v in job.items() if not k.startswith("_")}


class JobQueue:
    def __init__(self, paths: Paths) -> None:
        self.paths = paths
        self.store = Store.open(paths)
        self.lock = threading.RLock()
        self.wake = threading.Event()  # set when there's new work: the worker stops waiting
        self.jobs: list[Job] = []
        self.flags: dict[str, Any] = {"paused": False}  # Pause queue: the running job finishes, nothing new starts
        self.rev = 0  # bumped on every change to the list
        # what each recent revision changed: (rev, ids written, ids gone, order moved) — the page's poll gets just that
        self._changes: list[tuple[int, set[int], set[int], bool]] = []
        self._miss_t = 0.0
        self._miss: frozenset[int] = frozenset()
        # the last Clear list, for its Undo: in memory only (never written), gone when Kiln closes
        self._cleared: list[Job] = []
        self._order_before: list[int] = []

    # ------------------------------------------------------------ saving
    def load(self) -> None:
        self.jobs = self.store.load_jobs()
        for j in self.jobs:  # a crash mid-job: run it again
            if j["status"] == "running":
                j.update(status="pending", step=0, progress=0)
        self.flags.update(self.store.get("flags", {}))

    def save(self, only: Iterable[int] | None = None) -> None:
        """Every change ends here (the page's poll sees the new revision). `only`: the ids of the jobs it touched, when
        it touched nothing else (no job added, removed or moved) — the save then looks at those alone."""
        self.rev += 1
        changed, gone, moved = self.store.save_jobs(self.jobs, only)
        self._changes.append((self.rev, changed, gone, moved))
        del self._changes[:-CHANGES_KEPT]

    def set_paused(self, paused: bool) -> None:
        with self.lock:
            self.flags["paused"] = paused
            self.store.put("flags", self.flags)
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

    def changes_since(self, sig: str) -> tuple[set[int], set[int], bool] | None:
        """What changed after the revision in `sig` (a signature the page had): ids changed, ids gone, order moved —
        None when it's too old to tell (or from before a restart): the page then gets the whole list."""
        try:
            since = int(sig.split(".", 1)[0])
        except ValueError:
            return None
        if since > self.rev or not self._changes or self._changes[0][0] > since + 1:
            return None
        changed: set[int] = set()
        gone: set[int] = set()
        moved = False
        for rev, c, g, m in self._changes:
            if rev > since:
                changed |= c
                gone |= g
                moved = moved or m
        return changed, gone, moved

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
        try:
            hw = int((self.store.get("ids") or {}).get("high", 0))
        except (TypeError, ValueError, AttributeError):
            hw = 0
        n = max(hw, max([j["id"] for j in self.jobs], default=0)) + 1
        self.store.put("ids", {"high": n})
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

    def clear_finished(self) -> int:
        with self.lock:
            # a picture in Delete's undo window stays: its own timer takes it off the list and its file to the Bin
            stays = (*WAITING, "deleted")
            self._order_before = [j["id"] for j in self.jobs]
            self._cleared = [j for j in self.jobs if j["status"] not in stays]
            self.keep_only(lambda j: j["status"] in stays)
            return len(self._cleared)

    def unclear(self) -> int:
        """Undo the last Clear list: its rows back in their old places; anything added since keeps its place after."""
        with self.lock:
            back, self._cleared = self._cleared, []
            if not back:
                return 0
            have = {j["id"] for j in self.jobs}
            by_id = {j["id"]: j for j in [*self.jobs, *(j for j in back if j["id"] not in have)]}
            old = [i for i in self._order_before if i in by_id]
            self.jobs[:] = [by_id[i] for i in old] + [j for j in self.jobs if j["id"] not in set(old)]
            self.save()
            return len(back)
