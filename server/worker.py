"""The worker: one job at a time — takes the next waiting job, has the backend render it, saves the picture."""

from __future__ import annotations

import errno
import logging
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from . import durable, images
from .backends import Backend, BackendError, BackendGone, Progress
from .catalog import Catalog
from .config import Paths
from .jobqueue import Job, JobQueue
from .pictures import Pictures
from .timings import Timings, setup_of

log = logging.getLogger("kiln")

IDLE_WAIT = 2  # seconds between looks at an empty (or paused) queue, unless woken
UNREACHABLE_WAIT = 3  # seconds before asking an unreachable generator again
DISK_FREE_LEAST = 256 * 1024 * 1024  # bytes free in the output folder before a render starts (a picture is ~2-6 MB)
GONE_TRIES = 2  # a job the generator went away under twice is failed (it may be what crashes it)
REPEATS = ("vram", "model", "disk")  # failures the next job would hit too: they pause the queue
FAILS_IN_ROW = 2  # this many failures in a row pause the queue, whatever they were
VRAM_WORDS = ("out of memory", "outofmemory", "not enough memory")


class Missing(Exception):
    """Something the job needs isn't there: a model, a LoRA, room on the disk (kind + names)."""

    def __init__(self, kind: str, names: list[str]) -> None:
        super().__init__(f"{kind} missing: {', '.join(names)}")
        self.kind, self.names = kind, names


def failure(e: Exception) -> str:
    """A failed job's kind (21-failure-states.md, rule 2): the page words each kind and offers its way back."""
    if isinstance(e, Missing):
        return e.kind
    if isinstance(e, BackendGone):
        return "forge-gone"
    if isinstance(e, OSError) and e.errno == errno.ENOSPC:
        return "disk"
    if any(w in str(e).lower() for w in VRAM_WORDS):
        return "vram"
    return "other"


class Worker:
    def __init__(
        self,
        paths: Paths,
        queue: JobQueue,
        backend: Backend,
        timings: Timings,
        pictures: Pictures,
        catalog: Catalog | None = None,
    ) -> None:
        self.paths = paths
        self.queue = queue
        self.backend = backend
        self.timings = timings
        self.pictures = pictures
        self.catalog = catalog  # what the generator offers: a job's model and LoRAs are checked against it
        self.unsaved: dict[int, tuple[bytes, Any, str]] = {}  # job id -> a render its save failed on (Retry saves it)
        self.fails_in_row = 0
        self.previews: dict[int, bytes] = {}  # job id -> its latest live preview (served at /api/preview/<id>)
        self.last_preview: bytes | None = None  # the previous job's last preview: Forge can still send it at first
        self.last_setup: str | None = None  # what the generator has loaded for us (None: unknown, e.g. after a restart)

    def start(self) -> None:
        threading.Thread(target=self.run, daemon=True).start()

    def run(self) -> None:
        q = self.queue
        while True:
            job = q.next_pending()
            if not job:
                q.wake.wait(IDLE_WAIT)
                q.wake.clear()
                continue
            if not self.backend.ready():
                time.sleep(UNREACHABLE_WAIT)
                continue
            self.run_one(job)

    def run_one(self, job: Job) -> None:
        """One job, start to end: it finishes, fails, or waits again (the generator went away under it)."""
        q = self.queue
        with q.lock:
            job.update(status="running", started=time.time(), step=0, progress=0, eta=None, error=None, t_first=None)
            if job["kind"] == "txt2img":
                job["warm"] = setup_of(job["spec"]) == self.last_setup
                job["est"], job["est_first"] = self.timings.estimate(job["spec"])
            q.save(only=[job["id"]])
        log.info("job %s (%s) started", job["id"], job["kind"])
        try:
            self.check(job)
            result = self.upscale(job) if job["kind"] == "upscale" else self.txt2img(job)
        except Exception as e:  # noqa: BLE001 — whatever broke, the job says so (its kind and words)
            if job.get("_cancel"):
                result = "cancelled"
            elif isinstance(e, BackendGone) and job.get("_gone", 0) + 1 < GONE_TRIES:
                self.wait_again(job, e)  # not the job's fault: it runs again when the generator is back
                return
            else:
                result = "error"
                self.failed(job, e)
        self.finished(job, result)

    def check(self, job: Job) -> None:
        """Before a render: room on the disk, and the model and LoRAs the job names (a LoRA renamed since the job
        was queued must not render without it). The list is asked again once before calling something missing."""
        if shutil.disk_usage(self.paths.out).free < DISK_FREE_LEAST:
            raise Missing("disk", [str(self.paths.out)])
        sp = job["spec"]
        if job["kind"] != "txt2img" or self.catalog is None or not (sp.get("loras") or sp.get("checkpoint")):
            return
        gap = None
        for refresh in (False, True):
            try:
                gap = self.backend.missing(sp, self.catalog.get(refresh))
            except Exception:  # noqa: BLE001 — can't tell (the generator gone, a list it can't read): the render will say
                return
            if gap is None:
                return
        if gap:
            raise Missing(*gap)

    def wait_again(self, job: Job, e: Exception) -> None:
        with self.queue.lock:
            job["_gone"] = job.get("_gone", 0) + 1
            self.queue.requeue(job)
            self.previews.pop(job["id"], None)
            self.last_setup = None  # a restarted generator has nothing loaded
            self.queue.save()
        log.info("job %s back in line: %s went away (%s)", job["id"], self.backend.label, e)

    def failed(self, job: Job, e: Exception) -> None:
        kind = failure(e)
        with self.queue.lock:
            job["fail"] = kind
            job["missing_names"] = e.names if isinstance(e, Missing) else None
            job["error"] = f"{self.backend.label}: {e}" if isinstance(e, BackendError) else str(e) or type(e).__name__
            job.pop("_gone", None)
            self.fails_in_row += 1
            if kind in REPEATS or self.fails_in_row >= FAILS_IN_ROW:
                self.queue.set_paused(True, {"kind": kind, "job": job["id"]})

    def finished(self, job: Job, result: str) -> None:
        q = self.queue
        with q.lock:
            job.update(status=result, finished=time.time())
            if result == "done":
                self.fails_in_row = 0
                job.pop("_gone", None)
            self.last_preview = self.previews.pop(job["id"], None) or self.last_preview
            if result == "done" and job["kind"] == "txt2img":
                self.timings.record(job)
            if job["kind"] == "txt2img":  # the generator now has this setup loaded — unless it never got going
                self.last_setup = setup_of(job["spec"]) if (result == "done" or job.get("t_first")) else None
            q.save(only=[job["id"]])
        log.info("job %s %s%s", job["id"], result, f": {job.get('error')}" if job.get("error") else "")

    def on_progress(self, job: Job, p: Progress) -> None:
        with self.queue.lock:
            if p.steps:
                job["step"] = p.step
                job["steps"] = p.steps
                if job["step"] >= 1 and not job.get("t_first"):
                    job["t_first"] = time.time()
            job["progress"] = round(p.progress, 4)
            job["eta"] = round(p.eta, 1)
            b = p.image
            if b and job.get("t_first") and b != self.last_preview and b != self.previews.get(job["id"]):
                self.previews[job["id"]] = b
                job["preview_rev"] = job.get("preview_rev", 0) + 1

    def txt2img(self, job: Job) -> str:
        sp = job["spec"]
        r = self.backend.txt2img(sp, lambda p: self.on_progress(job, p), lambda: bool(job.get("_cancel")))
        if r is None:
            return "cancelled"
        img = r.image
        if sp.get("name", "").strip() and images.is_png(img):
            img = images.add_text(
                img, "kiln_name", sp["name"].strip()
            )  # the series name, for PNG Info -> Send to prompt
        again = Path(sp.get("as_file") or "").name  # Render again: back under its own name, if that's free
        with self.queue.lock:
            free = again.endswith(".png") and not (self.paths.out / again).exists()
            name = again if free else self.pictures.next_filename(sp.get("name", ""), r.seed, take=True)
        if images.is_png(img):  # a hidden id: the Library recognises the picture after a move or rename (library.py)
            img = images.add_text(img, "kiln_id", uuid.uuid4().hex)
        try:
            self.save(job, name, img, r.seed, r.infotext)
        except OSError:
            self.unsaved[job["id"]] = (img, r.seed, r.infotext)  # the render isn't thrown away: Retry saves it
            raise
        return "done"

    def save(self, job: Job, name: str, img: bytes, seed: Any, infotext: str) -> None:
        durable.write_bytes(self.paths.out / name, img)  # a crash mid-save left a picture of zeros
        self.pictures.indexed(self.paths.out / name)
        with self.queue.lock:
            job.update(file=name, seed_used=seed, infotext=infotext)

    def retry(self, job: Job) -> None:
        """Retry a failed job: a render whose save failed is saved again (no new render); any other waits again,
        first in line. A queue paused by a failure goes on (Retry means "run it"); one you paused stays paused."""
        q = self.queue
        kept = self.unsaved.get(job["id"])
        if kept:
            img, seed, infotext = kept
            with q.lock:
                name = self.pictures.next_filename(job["spec"].get("name", ""), seed, take=True)
            self.save(job, name, img, seed, infotext)  # an OSError reaches the page: still no room
            del self.unsaved[job["id"]]
            with q.lock:
                job.update(status="done", fail=None, error=None, missing_names=None, finished=time.time())
                q.save()
            return
        with q.lock:
            q.requeue(job)
            q.save()
            if q.flags.get("why"):
                q.set_paused(False)
        q.wake.set()

    def upscale(self, job: Job) -> str:
        sp = job["spec"]
        src = self.paths.out / sp["source"]
        image = src.read_bytes()
        scale = sp.get("scale", 2)
        out = src.with_name(f"{src.stem}_x{scale}.png")
        big = self.backend.upscale(image, sp["upscaler"], scale)
        if images.is_png(big):
            big = images.add_text(images.drop_text(big, "kiln_id"), "kiln_id", uuid.uuid4().hex)
        durable.write_bytes(out, big)
        self.pictures.indexed(out)
        with self.queue.lock:
            job["file"] = out.name
        return "done"
