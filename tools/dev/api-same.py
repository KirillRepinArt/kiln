"""Record what Kiln's server answers to a fixed script of API calls, so a refactor can prove it answers the same.

Starts the fake Forge and the server in REPO (old checkout or new), runs every route (queue, rename, delete + undo,
pause, reorder, upscale, thumbnails, missing files, models, update check, the page and static files), and writes the
answers with times and other run-to-run noise taken out. Compare two recordings with any diff tool.

    python tools/dev/api-same.py <repo dir> <out.json>
"""

import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

FPORT, KPORT = 7893, 7894  # never 7860 / 7870 (the user's real Forge and Kiln)
NOISY = {
    "created",
    "started",
    "finished",
    "t_first",
    "eta",
    "est",
    "est_first",
    "dur",
    "first",
    "sec_per_step",
    "step",
    "progress",
    "preview_rev",
}  # step/progress: how far the 0.8 s progress poll got (timing)
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def call(method, path, body=None, raw=False):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(f"http://127.0.0.1:{KPORT}{path}", data=data, method=method)
    try:
        with OPENER.open(req, timeout=30) as r:
            code, b, ctype = r.status, r.read(), r.headers.get("Content-Type")
    except urllib.error.HTTPError as e:
        code, b, ctype = e.code, e.read(), e.headers.get("Content-Type")
    if raw or not ctype or not ctype.startswith("application/json"):
        return code, {"type": ctype, "sha": hashlib.sha256(b).hexdigest()[:16], "len": len(b)}
    return code, json.loads(b)


def clean(v, out_dir):
    if isinstance(v, dict):
        return {k: ("~" if k in NOISY else clean(x, out_dir)) for k, x in v.items() if k not in ("sig", "preview_rev")}
    if isinstance(v, list):
        return [clean(x, out_dir) for x in v]
    if isinstance(v, str):
        return v.replace(str(out_dir), "<OUT>")
    return v


def wait(pred, what, limit=30):
    t = time.time()
    while time.time() - t < limit:
        if pred():
            return
        time.sleep(0.1)
    raise SystemExit(f"timed out waiting for {what}")


def jobs():
    return call("GET", "/api/state")[1]["jobs"]


def idle():
    return not any(j["status"] in ("pending", "running") for j in jobs())


def saved(data_dir):
    """What Kiln saved — the job list and the series numbers — from data/kiln.db (v0.7b on) or the JSON files before."""
    db = data_dir / "kiln.db"
    if db.exists():
        con = sqlite3.connect(db)
        try:
            q = [json.loads(d) for (d,) in con.execute("SELECT data FROM jobs ORDER BY pos")]
            row = con.execute("SELECT value FROM kv WHERE key = 'names'").fetchone()
            return q, json.loads(row[0]) if row else {}
        finally:
            con.close()
    q = json.loads((data_dir / "queue.json").read_text(encoding="utf-8"))
    return q, json.loads((data_dir / "names.json").read_text(encoding="utf-8"))


def main(repo, out_path):
    repo = Path(repo).resolve()
    tmp = Path(tempfile.mkdtemp(prefix="kiln-api-"))
    out_dir, data_dir = tmp / "out", tmp / "data"
    env = dict(
        os.environ,
        KILN_PORT=str(KPORT),
        KILN_FORGE_URL=f"http://127.0.0.1:{FPORT}",
        KILN_OUTPUT_DIR=str(out_dir),
        KILN_DATA_DIR=str(data_dir),
        KILN_UPDATE_URL=f"http://127.0.0.1:{FPORT}/tags",
        KILN_NO_RECYCLE="1",
        KILN_RECYCLE_ROOT=str(tmp / "bin"),
        PYTHONUNBUFFERED="1",
    )
    here = Path(__file__).resolve().parents[2]
    procs = [subprocess.Popen([sys.executable, str(here / "tools/fake_forge.py"), str(FPORT), "0.02"], env=env)]
    rec = []

    def log(label, res):
        code, body = res
        rec.append([label, code, clean(body, out_dir)])
        return body

    try:
        start = "import server; server.CFG['exit_when_closed']=False; server.CFG['forge_start']=''; server.main()"
        procs.append(subprocess.Popen([sys.executable, "-c", start], cwd=repo, env=env))
        wait(lambda: _up(), "the server")
        wait(lambda: call("GET", "/api/state")[1]["forge"]["ok"], "the first health check")
        log("state empty", call("GET", "/api/state"))
        log("models", call("GET", "/api/models"))
        log("models refresh", call("GET", "/api/models?refresh"))
        log("estimate", call("POST", "/api/estimate", {"spec": {"w": 1024, "h": 1024, "steps": 8}}))
        log("estimate bad", call("POST", "/api/estimate", {"spec": {"w": 1}}))
        log("nextname empty", call("GET", "/api/nextname?name="))
        log("nextname", call("GET", "/api/nextname?name=Test%20Series"))
        spec = {"prompt": "a [fill:336699] cup", "w": 64, "h": 64, "steps": 3, "seed": 7, "loras": []}
        log("pause", call("POST", "/api/pause", {"paused": True}))
        ids = log(
            "add",
            call(
                "POST",
                "/api/jobs",
                {
                    "jobs": [
                        dict(spec, name="Test Series"),
                        dict(spec, name=""),
                        dict(spec, name="Test Series", loras=[{"name": "detail_enhancer_krea2", "w": 0.8}]),
                        dict(spec, name="Other"),
                    ]
                },
            ),
        )["ids"]
        log("nextname pending", call("GET", "/api/nextname?name=Test%20Series"))
        log("rename pending", call("POST", f"/api/jobs/{ids[3]}/name", {"name": "  Renamed  "}))
        log("reorder", call("POST", "/api/reorder", {"ids": [ids[2], ids[0], 999]}))
        log("cancel pending", call("POST", f"/api/jobs/{ids[1]}/cancel"))
        log("cancel missing", call("POST", "/api/jobs/999/cancel"))
        log("state paused", call("GET", "/api/state"))
        log("resume", call("POST", "/api/pause", {"paused": False}))
        wait(idle, "the queue")
        st = log("state done", call("GET", "/api/state"))
        sig = call("GET", "/api/state")[1]["sig"]
        log("state same", call("GET", f"/api/state?since={sig}"))
        files = {j["id"]: j.get("file") for j in st["jobs"]}
        for jid in ids:
            if files.get(jid):
                log(f"file {jid}", call("GET", f"/files/{files[jid]}", raw=True))
        log("preview none", call("GET", f"/api/preview/{ids[0]}"))
        a = ids[2]  # the first to run: Test Series, with a LoRA
        log("rename", call("POST", f"/api/jobs/{a}/rename", {"name": "New Name"}))
        log("rename same", call("POST", f"/api/jobs/{a}/rename", {"name": "New Name", "as_file": "new-name-001.png"}))
        log("rename back", call("POST", f"/api/jobs/{a}/rename", {"name": "Test Series", "as_file": files[a]}))
        log("rename missing", call("POST", "/api/jobs/999/rename", {"name": "x"}))
        log("upscale", call("POST", "/api/upscale", {"id": a, "upscaler": "R-ESRGAN 4x+", "scale": 2}))
        log("upscale none", call("POST", "/api/upscale", {"id": 999}))
        wait(idle, "the upscale")
        log("state upscaled", call("GET", "/api/state"))
        b = ids[0]
        log("delete", call("POST", f"/api/jobs/{b}/delete"))
        log("delete again", call("POST", f"/api/jobs/{b}/delete"))
        log("state deleting", call("GET", "/api/state"))
        log("undelete", call("POST", f"/api/jobs/{b}/undelete"))
        log("file back", call("GET", f"/files/{files[b]}", raw=True))
        log("qthumb", call("POST", "/api/qthumb", {"id": b, "data": "data:image/jpeg;base64,/9j/AA=="}))
        log("qthumb file", call("GET", f"/qthumbs/{b}.jpg", raw=True))
        log("qthumb bad id", call("POST", "/api/qthumb", {"id": "x", "data": "data:image/jpeg;base64,AA=="}))
        log("qthumb bad", call("POST", "/api/qthumb", {"id": b, "data": "nope"}))
        log("qthumb no job", call("POST", "/api/qthumb", {"id": 999, "data": "data:image/jpeg;base64,AA=="}))
        log(
            "thumb",
            call("POST", "/api/thumb", {"name": "detail_enhancer_krea2", "data": "data:image/jpeg;base64,AA=="}),
        )
        log("thumb bad", call("POST", "/api/thumb", {"name": "", "data": ""}))
        log("models thumb", call("GET", "/api/models"))
        log("thumb file", call("GET", "/thumbs/detail_enhancer_krea2.jpg", raw=True))
        c = ids[3]
        (out_dir / files[c]).unlink()  # deleted outside Kiln
        time.sleep(2.2)  # the missing-file check runs at most every 2 s
        log("state missing", call("GET", "/api/state"))
        log("recycled", call("POST", f"/api/jobs/{c}/recycled"))
        log("restore", call("POST", f"/api/jobs/{c}/restore"))
        log("saveback bad", call("POST", f"/api/jobs/{c}/saveback", {"data": "x"}))
        png = (out_dir / files[b]).read_bytes()
        import base64

        url = "data:image/png;base64," + base64.b64encode(png).decode()
        log("saveback", call("POST", f"/api/jobs/{c}/saveback", {"data": url}))
        log("saveback file", call("GET", f"/files/{files[c]}", raw=True))
        log("saveback exists", call("POST", f"/api/jobs/{c}/saveback", {"data": url}))
        (out_dir / files[c]).unlink()
        time.sleep(2.2)
        log("remove-missing", call("POST", "/api/remove-missing"))
        log("open none", call("POST", "/api/open", {"id": 999}))
        log("reveal none", call("POST", "/api/reveal", {"id": 999}))
        log("remove", call("POST", f"/api/jobs/{b}/remove"))
        log("remove pending", call("POST", f"/api/jobs/{b}/remove"))
        log("update-check", call("POST", "/api/update-check"))
        log("bye", call("POST", "/api/bye"))
        log("page", call("GET", "/", raw=True))
        log("page again", call("GET", "/?x", raw=True))
        log("app file", call("GET", "/app/main.js", raw=True))
        log("app escape", call("GET", "/app/../kiln.bat", raw=True))
        log("docs", call("GET", "/docs/screenshot.png", raw=True))
        log("unknown get", call("GET", "/nope"))
        log("unknown post", call("POST", "/api/nope"))
        log("delete for good", call("POST", f"/api/jobs/{a}/delete"))
        time.sleep(13)  # the undo window, then the trash
        log("state after undo window", call("GET", "/api/state"))
        log("clear", call("POST", "/api/clear"))
        log("state end", call("GET", "/api/state"))
        d = log("add long", call("POST", "/api/jobs", {"jobs": [dict(spec, steps=150, name="Long")]}))["ids"][0]
        wait(lambda: any(j["status"] == "running" for j in jobs()), "the long job to start")
        log("cancel running", call("POST", f"/api/jobs/{d}/cancel"))
        wait(idle, "the cancel")
        log("state cancelled", call("GET", "/api/state"))
        procs[0].kill()  # Forge goes away
        procs[0].wait()
        time.sleep(4.5)  # the health check runs every 4 s
        log("state forge down", call("GET", "/api/state"))
        log("models forge down", call("GET", "/api/models?refresh"))
        log("add forge down", call("POST", "/api/jobs", {"jobs": [dict(spec, name="Waits")]}))
        time.sleep(1)
        log("state waiting for forge", call("GET", "/api/state"))
        rec.append(["data files", 0, sorted(p.name for p in data_dir.iterdir())])
        rec.append(["out files", 0, sorted(p.name for p in out_dir.iterdir())])
        rec.append(["trash", 0, sorted(p.name for p in (data_dir / "trash").iterdir())])
        q, names = saved(data_dir)
        rec.append(["queue.json", 0, clean(q, out_dir)])
        rec.append(["names.json", 0, names])
    finally:
        for p in procs:
            p.kill()
        for p in procs:
            p.wait()
        shutil.rmtree(tmp, ignore_errors=True)
    Path(out_path).write_text(json.dumps(rec, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{len(rec)} answers -> {out_path}")


def _up():
    try:
        return call("GET", "/api/nextname?name=")[0] == 200
    except OSError:
        return False


if __name__ == "__main__":
    main(*sys.argv[1:3])
