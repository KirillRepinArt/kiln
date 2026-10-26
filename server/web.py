"""The HTTP side: the page, its files, the pictures, and the JSON API the page talks to (all on 127.0.0.1).

Each route is one method, listed in GET_ROUTES / POST_ROUTES (a regular expression for the path -> the method). A
method returns its answer (a dict or list → JSON) or raises ApiError (→ {"error": message} with its status).
"""

from __future__ import annotations

import base64
import json
import os
import re
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import TYPE_CHECKING, Any

from . import images
from .errors import ApiError
from .instance import exclusive
from .jobqueue import public
from .page import build_page, styles_signature
from .updates import VERSION, check_update

if TYPE_CHECKING:
    from .main import Kiln

MIME = {
    ".html": "text/html; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
}


Routes = tuple[tuple[re.Pattern[str], str], ...]  # (path pattern, Handler method name)


class KilnServer(ThreadingHTTPServer):
    # on Windows "reuse address" lets a second server share the port silently: claim it exclusively instead
    allow_reuse_address = os.name != "nt"

    def __init__(self, address: tuple[str, int], kiln: Kiln) -> None:
        super().__init__(address, Handler)
        self.kiln = kiln

    def server_bind(self) -> None:
        exclusive(self.socket)
        super().server_bind()


class Handler(BaseHTTPRequestHandler):
    server: KilnServer

    def log_message(self, *a: Any) -> None:
        pass

    @property
    def k(self) -> Kiln:
        return self.server.kiln

    # ------------------------------------------------------------ answering
    def reply(
        self,
        code: int,
        body: Any = b"",
        ctype: str = "application/json",
        cache: bool = False,
        headers: dict[str, str] | None = None,
    ) -> None:
        if isinstance(body, (dict, list)) or body is None:
            body = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "max-age=86400" if cache else "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def file(self, base: Path, name: str, cache: bool = False) -> None:
        p = (base / name).resolve()
        if base not in p.parents or not p.is_file():
            return self.reply(404, {"error": "not found"})
        self.reply(200, p.read_bytes(), MIME.get(p.suffix.lower(), "application/octet-stream"), cache)

    def query(self, key: str) -> str:
        return urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get(key, [""])[0]

    def route(self, routes: Routes, path: str, *args: Any) -> None:
        """Answer with the first route whose pattern matches the whole path: its method gets the pattern's groups,
        then `args` (a POST's body)."""
        for pattern, method in routes:
            m = pattern.fullmatch(path)
            if m:
                try:
                    res = getattr(self, method)(*m.groups(), *args)
                except ApiError as e:
                    return self.reply(e.status, {"error": e.message})
                if res is not None:
                    self.reply(200, res)
                return None
        return self.reply(404, {"error": "not found"})

    def do_GET(self) -> None:
        path = urllib.parse.unquote(self.path.split("?")[0])
        self.route(GET_ROUTES, path)

    def do_POST(self) -> None:
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n) or b"{}")
        self.route(POST_ROUTES, self.path.split("?")[0], body)

    # ------------------------------------------------------------ GET: the page and files
    def get_page(self) -> None:
        k = self.k
        k.window.bye = None  # a reload (or a new window): whoever said goodbye is back
        page = build_page(k.paths.root)
        inject = os.environ.get("KILN_TEST_INJECT")  # test hook: append a script (used by automated UI checks)
        if inject and "test" in self.path:
            page = page.replace(b"</body>", b"<script>" + Path(inject).read_bytes() + b"</script></body>")
        extra = {}
        if not k.window.purged:  # older versions cached images for a day: clear the browser's cache once per run
            k.window.purged = True
            extra["Clear-Site-Data"] = '"cache"'
        self.reply(200, page, MIME[".html"], headers=extra)

    def get_app_file(self, name: str) -> None:
        self.file(self.k.paths.root / "app", name)

    def get_docs_file(self, name: str) -> None:
        self.file(self.k.paths.root / "docs", name, cache=True)

    def get_picture(self, name: str) -> None:  # never cached: a deleted picture must not live on in the browser's cache
        self.file(self.k.paths.out, name)

    def get_lora_thumb(self, name: str) -> None:
        self.file(self.k.paths.thumbs, name)

    def get_queue_thumb(self, name: str) -> None:  # never cached by the browser either (no-store), like the pictures
        self.file(self.k.paths.qthumbs, name)

    # ------------------------------------------------------------ GET: the API
    def get_state(self) -> None:
        """The page's poll. ?since=<signature it has>: the same → only the running job's progress (the light poll)."""
        k, q = self.k, self.k.queue
        k.window.last = time.time()
        since = self.query("since")
        with q.lock:  # answered inside the lock: the job list must not change while it's written out
            sig = q.signature()
            if since and since == sig:
                run = q.running()
                return self.reply(
                    200,
                    {
                        "sig": sig,
                        "same": True,
                        "run": public(run) if run else None,
                        "forge": k.backend.status,
                        "stats": k.timings.stats,
                        "paused": q.flags["paused"],
                        "styles": styles_signature(k.paths.root),
                    },
                )
            return self.reply(
                200,
                {
                    "sig": sig,
                    "forge": k.backend.status,
                    "jobs": q.public_list(k.timings.estimate),
                    "stats": k.timings.stats,
                    "out_dir": str(k.paths.out),
                    "version": VERSION,
                    "paused": q.flags["paused"],
                    "styles": styles_signature(k.paths.root),
                },
            )

    def get_hello(self) -> dict[str, Any]:
        """Who answers on this port: the launcher checks it's Kiln, and for which data folder, before using it."""
        return {"app": "kiln", "version": VERSION, "data": str(self.k.paths.data), "pid": os.getpid()}

    def get_next_name(self) -> dict[str, Any]:
        """The file name the next picture of a series will get (the hint under the name line)."""
        name = self.query("name")
        if not name.strip():
            return {"file": None}
        q = self.k.queue
        with q.lock:  # count jobs already queued under this name so the hint is accurate
            pend = sum(
                1
                for j in q.jobs
                if j["status"] in ("pending", "running") and j["spec"].get("name", "").strip() == name.strip()
            )
            nxt = self.k.pictures.next_filename(name, 0)
        m = re.search(r"-(\d+)\.png$", nxt)
        if m and pend:
            nxt = nxt[: m.start(1)] + f"{int(m.group(1)) + pend:03d}.png"
        return {"file": nxt}

    def get_preview(self, jid: str) -> None:
        b = self.k.worker.previews.get(int(jid))
        if not b:
            raise ApiError(404, "no preview")
        self.reply(200, b, images.image_type(b))

    def get_models(self) -> Any:
        try:
            return self.k.catalog.get("refresh" in self.path)
        except Exception as e:  # noqa: BLE001 — the page shows the reason
            raise ApiError(503, f"Forge not reachable: {e}") from None

    # ------------------------------------------------------------ POST: the API
    def post_estimate(self, b: dict[str, Any]) -> dict[str, Any]:
        """The prompt box's current settings -> expected seconds per image."""
        try:
            return {"est": self.k.timings.estimate(b.get("spec") or {})[0]}
        except Exception as e:  # noqa: BLE001 — half-filled settings: the page just shows no estimate
            raise ApiError(400, str(e)) from None

    def post_update_check(self, b: dict[str, Any]) -> dict[str, Any]:
        try:
            return check_update()
        except Exception as e:  # noqa: BLE001 — offline, rate-limited…: Settings says so
            return {"error": f"GitHub not reachable ({type(e).__name__})", "current": VERSION}

    def post_bye(self, b: dict[str, Any]) -> dict[str, Any]:
        """A Kiln window is closing (sendBeacon from pagehide)."""
        self.k.window.bye = time.time()
        return {}

    def post_jobs(self, b: dict[str, Any]) -> dict[str, Any]:
        return {"ids": self.k.queue.add(b.get("jobs", []))}

    def post_cancel(self, jid: str, b: dict[str, Any]) -> dict[str, Any]:
        """A waiting job leaves the list; the running one stops at the generator's next step."""
        q = self.k.queue
        with q.lock:
            j = q.find(int(jid))
            if not j:
                raise ApiError(404, "no such job")
            if j["status"] == "pending":
                q.jobs.remove(j)
            elif j["status"] == "running":
                j["_cancel"] = True
                j["stopping"] = True
                self.k.backend.interrupt()
            q.save()
        return {"ok": True}

    def post_pause(self, b: dict[str, Any]) -> dict[str, Any]:
        """Pause the queue after the current job / Resume."""
        self.k.queue.set_paused(bool(b.get("paused")))
        return {"paused": self.k.queue.flags["paused"]}

    def post_job_action(self, jid: str, act: str, b: dict[str, Any]) -> dict[str, Any]:
        self.k.pictures.act(int(jid), act, b.get("name", ""))
        return {"ok": True}

    def post_rename(self, jid: str, b: dict[str, Any]) -> dict[str, Any]:
        name = str(b.get("name", "")).strip()[:60]
        return self.k.pictures.rename(int(jid), name, str(b.get("as_file") or ""))

    def post_recycled(self, jid: str, b: dict[str, Any]) -> dict[str, Any]:
        return self.k.pictures.in_recycle_bin(int(jid))

    def post_restore(self, jid: str, b: dict[str, Any]) -> dict[str, Any]:
        return self.k.pictures.restore(int(jid))

    def post_save_back(self, jid: str, b: dict[str, Any]) -> dict[str, Any]:
        return self.k.pictures.save_back(int(jid), str(b.get("data", "")))

    def post_remove_missing(self, b: dict[str, Any]) -> dict[str, Any]:
        self.k.pictures.forget_missing()
        return {"ok": True}

    def post_reorder(self, b: dict[str, Any]) -> dict[str, Any]:
        self.k.queue.reorder(b.get("ids", []))
        return {"ok": True}

    def post_clear(self, b: dict[str, Any]) -> dict[str, Any]:
        self.k.queue.clear_finished()
        return {"ok": True}

    def post_open(self, b: dict[str, Any]) -> dict[str, Any]:
        self.k.pictures.open(b.get("id"))
        return {"ok": True}

    def post_reveal(self, b: dict[str, Any]) -> dict[str, Any]:
        self.k.pictures.reveal(b.get("id"))
        return {"ok": True}

    def post_upscale(self, b: dict[str, Any]) -> dict[str, Any]:
        q = self.k.queue
        with q.lock:
            src = q.find(b.get("id"))
            if not src or not src.get("file"):
                raise ApiError(404, "no image")
            jid = q.add_upscale(src, b.get("upscaler"), b.get("scale", 2))
        return {"ids": [jid]}

    def post_qthumb(self, b: dict[str, Any]) -> dict[str, Any]:
        return {"url": self.k.pictures.save_qthumb(b.get("id"), str(b.get("data", "")))}

    def post_lora_thumb(self, b: dict[str, Any]) -> dict[str, Any]:
        """A LoRA's picture (cropped by the page)."""
        name = Path(b.get("name", "")).name
        data = b.get("data", "")
        if not name or not data.startswith("data:image/"):
            raise ApiError(400, "bad thumb")
        (self.k.paths.thumbs / f"{name}.jpg").write_bytes(base64.b64decode(data.split(",", 1)[1]))
        self.k.catalog.invalidate()
        return {"url": f"/thumbs/{name}.jpg"}


def _routes(*pairs: tuple[str, str]) -> Routes:
    return tuple((re.compile(p), m) for p, m in pairs)


GET_ROUTES = _routes(
    ("/|/index.html", "get_page"),
    ("/app/(.*)", "get_app_file"),
    ("/docs/(.*)", "get_docs_file"),
    ("/files/(.*)", "get_picture"),
    ("/thumbs/(.*)", "get_lora_thumb"),
    ("/qthumbs/(.*)", "get_queue_thumb"),
    ("/api/state", "get_state"),
    ("/api/hello", "get_hello"),
    ("/api/nextname", "get_next_name"),
    ("/api/preview/(.*)", "get_preview"),
    ("/api/models", "get_models"),
)

POST_ROUTES = _routes(
    ("/api/estimate", "post_estimate"),
    ("/api/update-check", "post_update_check"),
    ("/api/bye", "post_bye"),
    ("/api/jobs", "post_jobs"),
    (r"/api/jobs/(\d+)/cancel", "post_cancel"),
    ("/api/pause", "post_pause"),
    (r"/api/jobs/(\d+)/(remove|delete|undelete|name)", "post_job_action"),
    (r"/api/jobs/(\d+)/rename", "post_rename"),
    (r"/api/jobs/(\d+)/recycled", "post_recycled"),
    (r"/api/jobs/(\d+)/restore", "post_restore"),
    (r"/api/jobs/(\d+)/saveback", "post_save_back"),
    ("/api/remove-missing", "post_remove_missing"),
    ("/api/reorder", "post_reorder"),
    ("/api/clear", "post_clear"),
    ("/api/open", "post_open"),
    ("/api/reveal", "post_reveal"),
    ("/api/upscale", "post_upscale"),
    ("/api/qthumb", "post_qthumb"),
    ("/api/thumb", "post_lora_thumb"),
)
