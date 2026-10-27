"""Finished pictures on disk and their jobs: delete with an undo window, rename, put back what went missing,
queue thumbnails, open in another app or in Explorer."""

from __future__ import annotations

import base64
import os
import subprocess
import threading
from pathlib import Path
from typing import Any

from . import durable, images, naming, recyclebin
from .config import Paths
from .errors import ApiError
from .jobqueue import FINISHED, Job, JobQueue

UNDO_SECONDS = 12  # a deleted picture waits in data/trash this long, then goes to the Recycle Bin


class Pictures:
    def __init__(self, paths: Paths, queue: JobQueue) -> None:
        self.paths = paths
        self.queue = queue

    def next_filename(self, name: str, seed: Any, take: bool = False) -> str:
        """The next file name of a series (see naming.next_filename); hold the queue's lock when taking one."""
        return naming.next_filename(
            name,
            seed,
            out_dir=self.paths.out,
            job_files=self.queue.files(),
            names_file=self.paths.names_file,
            take=take,
        )

    def tidy(self) -> None:
        """At start-up: deletes from before a restart are past their undo window; thumbnails of jobs no longer on the
        list (removed, cleared) go."""
        q = self.queue
        for j in [j for j in q.jobs if j["status"] == "deleted"]:
            self.finish_delete(j["id"])
        have = {j["id"] for j in q.jobs}
        for t in self.paths.qthumbs.glob("*.jpg"):
            if not t.stem.isdigit() or int(t.stem) not in have:
                t.unlink(missing_ok=True)

    # ------------------------------------------------------------ the job's own actions
    def act(self, jid: int, act: str, name: Any = "") -> None:
        """remove (off the list, the file stays) · delete (to the trash, Undo for UNDO_SECONDS) · undelete ·
        name (a waiting job's series: the file name is only decided when the picture is saved)."""
        q = self.queue
        with q.lock:
            j = q.find(jid)
            if not j:
                raise ApiError(404, "no such job")
            if act == "remove" and j["status"] in FINISHED:
                q.jobs.remove(j)
            elif act == "name" and j["status"] == "pending":
                j["spec"]["name"] = str(name).strip()[:60]
            elif act == "delete" and j["status"] == "done" and j.get("file"):
                src = self.paths.out / j["file"]
                self.paths.trash.mkdir(parents=True, exist_ok=True)
                if src.exists():
                    src.replace(self.paths.trash / j["file"])
                j["status"] = "deleted"
                threading.Timer(UNDO_SECONDS, self.finish_delete, [jid]).start()
            elif act == "undelete" and j["status"] == "deleted":
                t = self.paths.trash / j["file"]
                if t.exists():
                    t.replace(self.paths.out / j["file"])
                j["status"] = "done"
            else:
                raise ApiError(409, f"can't {act} a {j['status']} job")
            q.save()

    def finish_delete(self, jid: int) -> None:
        """The undo window is over: the file goes to the Recycle Bin and the job off the list."""
        q = self.queue
        with q.lock:
            j = q.find(jid)
            if not j or j["status"] != "deleted":
                return
            t = self.paths.trash / j["file"]
            if t.exists():
                recyclebin.recycle(t)
            q.jobs.remove(j)
            (self.paths.qthumbs / f"{jid}.jpg").unlink(missing_ok=True)
            q.save()

    def rename(self, jid: int, name: str, as_file: str) -> dict[str, str]:
        """The simple rename (the full one comes with the Library): a finished picture joins the series you type, as
        its next number; the name inside the PNG follows; `as_file` puts a file back under an exact name (Undo)."""
        q, out = self.queue, self.paths.out
        with q.lock:
            j = q.find(jid)
            if not j or j["status"] != "done" or not j.get("file"):
                raise ApiError(404, "no such picture")
            src = out / j["file"]
            if not src.exists():
                raise ApiError(409, "the file is gone")
            want = Path(as_file).name
            new = (
                want
                if want.endswith(".png") and not (out / want).exists()
                else self.next_filename(name, j.get("seed_used") or j["spec"].get("seed", 0), take=True)
            )
            if new == j["file"]:
                return {"file": new, "old": new}
            data = images.drop_text(src.read_bytes(), "kiln_name")
            if name:
                data = images.add_text(data, "kiln_name", name)
            durable.write_bytes(out / new, data)
            try:
                src.unlink()
            except OSError:
                (out / new).unlink()
                raise ApiError(409, "the file is open in another app — close it and try again") from None
            old = j["file"]
            j["file"] = new
            j["spec"]["name"] = name
            j["name"] = name
            q.save()
        return {"file": new, "old": old}

    # ------------------------------------------------------------ a file deleted outside Kiln
    def _gone(self, jid: Any) -> tuple[Job, Path] | None:
        """The job and where its file belongs — None when the file is there after all."""
        with self.queue.lock:
            j = self.queue.find(jid)
        if not j or not j.get("file"):
            raise ApiError(404, "no such image")
        dest = self.paths.out / j["file"]
        return None if dest.exists() else (j, dest)

    def in_recycle_bin(self, jid: int) -> dict[str, Any]:
        gone = self._gone(jid)
        if not gone:
            return {"ok": True, "exists": True}
        return {"found": recyclebin.find(gone[1]) is not None}

    def restore(self, jid: int) -> dict[str, Any]:
        """Put the file back from the Recycle Bin."""
        gone = self._gone(jid)
        if not gone:
            return {"ok": True, "exists": True}
        dest = gone[1]
        hit = recyclebin.find(dest)
        if not hit:
            raise ApiError(404, "not in the Recycle Bin any more")
        hit[1].replace(dest)
        try:
            hit[0].unlink()
        except OSError:
            pass
        return {"ok": True}

    def save_back(self, jid: int, data_url: str) -> dict[str, Any]:
        """Write back the copy the page still holds (a canvas: the PNG's text is lost, so it goes back in)."""
        gone = self._gone(jid)
        if not gone:
            return {"ok": True, "exists": True}
        j, dest = gone
        if not data_url.startswith("data:image/png;base64,"):
            raise ApiError(400, "no image")
        img = base64.b64decode(data_url.split(",", 1)[1])
        if j.get("infotext"):
            img = images.add_text(img, "parameters", j["infotext"])
        if (j.get("spec") or {}).get("name", "").strip():
            img = images.add_text(img, "kiln_name", j["spec"]["name"].strip())
        durable.write_bytes(dest, img)
        return {"ok": True}

    def forget_missing(self) -> None:
        """Remove finished jobs whose file is gone."""
        out = self.paths.out
        self.queue.keep_only(lambda j: not (j["status"] == "done" and j.get("file") and not (out / j["file"]).exists()))

    # ------------------------------------------------------------ thumbnails
    def save_qthumb(self, jid: Any, data_url: str) -> str:
        """The page made a queue thumbnail (it decodes the picture anyway): keep it."""
        try:
            jid = int(jid)
        except (TypeError, ValueError):
            raise ApiError(400, "bad id") from None
        if not data_url.startswith("data:image/jpeg"):
            raise ApiError(400, "bad thumb")
        with self.queue.lock:
            if not any(j["id"] == jid and j["status"] == "done" for j in self.queue.jobs):
                raise ApiError(404, "no such picture")
        (self.paths.qthumbs / f"{jid}.jpg").write_bytes(base64.b64decode(data_url.split(",", 1)[1]))
        return f"/qthumbs/{jid}.jpg"

    # ------------------------------------------------------------ outside Kiln
    def file_of(self, jid: Any) -> Path:
        with self.queue.lock:
            j = self.queue.find(jid)
        f: Path | None = (self.paths.out / j["file"]) if j and j.get("file") else None
        if not f or not f.exists():
            raise ApiError(404, "file not found")
        return f

    def open(self, jid: Any) -> None:
        """Open the picture in the default app."""
        f = self.file_of(jid)
        if os.name == "nt":
            os.startfile(str(f))  # noqa: S606 — the user's own picture, by their click
        else:
            subprocess.Popen(["xdg-open", str(f)])  # noqa: S603, S607

    def reveal(self, jid: Any) -> None:
        """Show the picture in Explorer."""
        f = self.file_of(jid)
        if os.name == "nt":
            subprocess.Popen(["explorer", "/select,", str(f)])  # noqa: S603, S607
        else:
            subprocess.Popen(["xdg-open", str(f.parent)])  # noqa: S603, S607
