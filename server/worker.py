"""The worker: one job at a time — takes the next waiting job, has the backend render it, saves the picture."""

from __future__ import annotations

import logging
import threading
import time
import uuid
from pathlib import Path

from . import durable, images
from .backends import Backend, BackendError, Progress
from .config import Paths
from .jobqueue import Job, JobQueue
from .pictures import Pictures
from .timings import Timings, setup_of

log = logging.getLogger("kiln")

IDLE_WAIT = 2  # seconds between looks at an empty (or paused) queue, unless woken
UNREACHABLE_WAIT = 3  # seconds before asking an unreachable generator again


class Worker:
    def __init__(self, paths: Paths, queue: JobQueue, backend: Backend, timings: Timings, pictures: Pictures) -> None:
        self.paths = paths
        self.queue = queue
        self.backend = backend
        self.timings = timings
        self.pictures = pictures
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
            with q.lock:
                job.update(
                    status="running", started=time.time(), step=0, progress=0, eta=None, error=None, t_first=None
                )
                if job["kind"] == "txt2img":
                    job["warm"] = setup_of(job["spec"]) == self.last_setup
                    job["est"], job["est_first"] = self.timings.estimate(job["spec"])
                q.save(only=[job["id"]])
            log.info("job %s (%s) started", job["id"], job["kind"])
            try:
                result = self.upscale(job) if job["kind"] == "upscale" else self.txt2img(job)
            except BackendError as e:
                result = "error"
                job["error"] = f"{self.backend.label}: {e}"
            except Exception as e:  # noqa: BLE001 — whatever broke, the job says so and the queue goes on
                result = "error"
                job["error"] = f"{type(e).__name__}: {e}"
            self.finished(job, result)

    def finished(self, job: Job, result: str) -> None:
        q = self.queue
        with q.lock:
            job.update(status=result, finished=time.time())
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
        durable.write_bytes(self.paths.out / name, img)  # a crash mid-save left a picture of zeros
        self.pictures.indexed(self.paths.out / name)
        with self.queue.lock:
            job.update(file=name, seed_used=r.seed, infotext=r.infotext)
        return "done"

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
