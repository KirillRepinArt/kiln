"""How long a job will take, learned from your own finished runs (kept in data/kiln.db: "history", "stats")."""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping, Sequence
from typing import Any

from .config import Paths
from .store import Store

Job = dict[str, Any]
Spec = Mapping[str, Any]
Estimate = tuple[float, float | None]  # (total seconds, seconds until the first step)
HISTORY_KEEP = 300  # finished runs kept for estimates
DEFAULT_SEC_PER_STEP = 60  # nothing measured yet: assume a slow GPU


def mp_bucket(w: int, h: int) -> str:
    """The nearest of Kiln's sizes in megapixels."""
    mp = w * h / 1e6
    return min(("0.5", "1.0", "1.5", "2.0"), key=lambda b: abs(float(b) - mp))


def median(xs: Iterable[float]) -> float:
    s = sorted(xs)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def setup_of(spec: Spec) -> str:
    """What the generator has to have loaded for this job: model, modules, size, LoRAs with weights."""
    loras = sorted([lora["name"], round(float(lora["w"]), 3)] for lora in spec.get("loras", []))
    return json.dumps([spec.get("checkpoint") or "", sorted(spec.get("modules") or []), spec["w"], spec["h"], loras])


def run_record(job: Job, setup: str, warm: Any) -> dict[str, Any]:
    """One finished run, as kept in the history. "warm" = the run repeated the previous run's setup — recorded for
    later analysis; on the data so far it didn't predict anything."""
    sp = job["spec"]
    first = job.get("t_first")
    return {
        "setup": setup,
        "steps": sp["steps"],
        "w": sp["w"],
        "h": sp["h"],
        "mp": mp_bucket(sp["w"], sp["h"]),
        "warm": bool(warm),
        "dur": round(job["finished"] - job["started"], 1),
        "first": round(first - job["started"], 1) if first else None,
    }


def estimate_from(history: Sequence[Mapping[str, Any]], sec_per_step: Mapping[str, float], spec: Spec) -> Estimate:
    """Expected (total seconds, seconds until the first step) for a job, from your own runs: the median of the
    last five at the same image size and steps. Backtested on real history this beat a per-MP average
    (6 % vs 12 % median error); whether the LoRAs changed made no measurable difference, so they're ignored."""
    steps, mp = spec["steps"], mp_bucket(spec["w"], spec["h"])
    same = [h for h in history if (h["w"], h["h"], h["steps"]) == (spec["w"], spec["h"], steps)][-5:]
    if same:
        f = [h["first"] for h in same if h["first"] is not None]
        return round(median([h["dur"] for h in same]), 1), (round(median(f), 1) if f else None)
    per = [h["dur"] / h["steps"] for h in history if h["mp"] == mp][-5:]  # same megapixels, other shape or steps
    if per:
        return round(median(per) * steps, 1), None
    return round((sec_per_step.get(mp) or DEFAULT_SEC_PER_STEP) * steps, 1), None


class Timings:
    """The history of finished runs, and seconds per step by size (the last-resort estimate)."""

    def __init__(self, paths: Paths) -> None:
        self.paths = paths
        self.store = Store.open(paths)
        self.history: list[dict[str, Any]] = []
        # MP bucket -> seconds per step (end to end, incl. load/decode); sent to the page as "stats"
        self.stats: dict[str, Any] = {"sec_per_step": {}}

    def load(self, jobs: Iterable[Job]) -> None:
        stats = self.store.get("stats")
        if isinstance(stats, dict):
            self.stats = stats
        history = self.store.get("history")
        if history is not None:
            self.history = history if isinstance(history, list) else []
            return
        # first run with history: seed it from the finished jobs still in the queue
        prev = None
        done = (
            j
            for j in jobs
            if j["status"] == "done"
            and j.get("kind", "txt2img") == "txt2img"
            and j.get("started")
            and j.get("finished")
        )
        for j in sorted(done, key=lambda j: j["started"]):
            su = setup_of(j["spec"])
            self.history.append(run_record(j, su, su == prev))
            prev = su
        if self.history:
            self.save_history()

    def save_history(self) -> None:
        del self.history[:-HISTORY_KEEP]
        self.store.put("history", self.history)

    def estimate(self, spec: Spec) -> Estimate:
        return estimate_from(self.history, self.stats["sec_per_step"], spec)

    def record(self, job: Job) -> None:
        """A txt2img job finished: learn from it."""
        sp = job["spec"]
        b = mp_bucket(sp["w"], sp["h"])
        per = (job["finished"] - job["started"]) / max(1, sp["steps"])
        old = self.stats["sec_per_step"].get(b)
        self.stats["sec_per_step"][b] = round(per if old is None else old * 0.7 + per * 0.3, 2)
        self.store.put("stats", self.stats)
        self.history.append(run_record(job, setup_of(sp), job.get("warm")))
        self.save_history()
