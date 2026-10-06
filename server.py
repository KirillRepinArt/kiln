"""Kiln server — serves the app and runs a persistent queue against Forge Neo's API.

Standard library only (Python 3.10+). Run:   python server.py        then open http://127.0.0.1:7870
Settings: copy config.example.json to config.local.json and edit (that file is git-ignored).
"""
import base64, datetime, json, os, re, struct, subprocess, sys, threading, time, urllib.error, urllib.parse, urllib.request, zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULTS = {
    "forge_url": "http://127.0.0.1:7860",
    "host": "127.0.0.1",
    "port": 7870,
    "output_dir": "outputs",
    "data_dir": "data",
    "people_folders": ["people", "faces", "characters", "persons"],
    "style_folders": ["style", "styles"],
    "exit_when_closed": True,  # stop when the last Kiln window closes (after the queue is done)
    "spellcheck": ["en-US", "ru", "es"],  # spell-check dictionaries seeded into Kiln's Edge profile by kiln.bat
    "forge_start": "",  # path to Forge's webui-user.bat: Kiln starts Forge (minimized) when it isn't running
    "stop_forge_on_exit": True,  # ...and stops it again when Kiln closes — only if Kiln was the one that started it
}


def load_config():
    cfg = dict(DEFAULTS)
    p = ROOT / "config.local.json"
    if p.exists():
        cfg.update(json.loads(p.read_text(encoding="utf-8")))
    # env overrides (handy for testing against tools/fake_forge.py)
    for k, env, typ in (("forge_url", "KILN_FORGE_URL", str), ("port", "KILN_PORT", int),
                        ("output_dir", "KILN_OUTPUT_DIR", str), ("data_dir", "KILN_DATA_DIR", str),
                        ("forge_start", "KILN_FORGE_START", str)):
        if os.environ.get(env):
            cfg[k] = typ(os.environ[env])
    return cfg


CFG = load_config()
OUT = (ROOT / CFG["output_dir"]).resolve()
DATA = (ROOT / CFG["data_dir"]).resolve()
THUMBS = DATA / "thumbs"
for d in (OUT, DATA, THUMBS):
    d.mkdir(parents=True, exist_ok=True)

# Windows often has a system proxy (VPN clients); Forge is local, so never use one.
_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def forge(method, path, body=None, timeout=15):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(CFG["forge_url"].rstrip("/") + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    with _opener.open(req, timeout=timeout) as r:
        raw = r.read()
    return json.loads(raw) if raw else None


# ---------------------------------------------------------------- state
lock = threading.RLock()
wake = threading.Event()
jobs: list[dict] = []
previews: dict[int, bytes] = {}
last_preview = {"v": None}  # the previous job's last preview: Forge can still return it while the next job starts
forge_status = {"ok": False, "error": "not checked yet", "busy": False, "starting": False}
forge_proc = None  # the Forge we started ourselves (None if Forge was already running or isn't ours)
QUEUE_FILE, STATS_FILE, HISTORY_FILE = DATA / "queue.json", DATA / "stats.json", DATA / "history.json"
stats = {"sec_per_step": {}}  # MP bucket -> seconds per step (end to end, incl. load/decode) — last-resort estimate
# Finished runs, for time estimates (see estimate()). "warm" = the run repeated the previous run's setup — recorded
# for later analysis; on the data so far it didn't predict anything.
history: list[dict] = []
last_setup = {"v": None}  # setup of the last txt2img Forge ran for us (None: unknown, e.g. after a restart)


def save_queue():
    tmp = QUEUE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(jobs, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(QUEUE_FILE)


def load_state():
    global jobs, stats
    if QUEUE_FILE.exists():
        try:
            jobs = json.loads(QUEUE_FILE.read_text(encoding="utf-8"))
        except Exception as e:
            print("queue.json unreadable, starting empty:", e)
    for j in jobs:  # a crash mid-job: run it again
        if j["status"] == "running":
            j.update(status="pending", step=0, progress=0)
    if STATS_FILE.exists():
        try:
            stats = json.loads(STATS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    global history
    if HISTORY_FILE.exists():
        try:
            history = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        except Exception:
            history = []
    else:  # first run with history: seed it from the finished jobs still in the queue
        prev = None
        for j in sorted((j for j in jobs if j["status"] == "done" and j.get("kind", "txt2img") == "txt2img"
                         and j.get("started") and j.get("finished")), key=lambda j: j["started"]):
            su = setup_of(j["spec"])
            history.append(run_record(j, su, su == prev))
            prev = su
        if history:
            save_history()


def setup_of(sp):
    """What Forge has to have loaded for this job: model, modules, size, LoRAs with weights."""
    loras = sorted([l["name"], round(float(l["w"]), 3)] for l in sp.get("loras", []))
    return json.dumps([sp.get("checkpoint") or "", sorted(sp.get("modules") or []), sp["w"], sp["h"], loras])


def run_record(j, setup, warm):
    sp = j["spec"]
    first = j.get("t_first")
    return {"setup": setup, "steps": sp["steps"], "w": sp["w"], "h": sp["h"], "mp": mp_bucket(sp["w"], sp["h"]),
            "warm": bool(warm), "dur": round(j["finished"] - j["started"], 1),
            "first": round(first - j["started"], 1) if first else None}


def save_history():
    del history[:-300]
    tmp = HISTORY_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(history), encoding="utf-8")
    tmp.replace(HISTORY_FILE)


def _median(xs):
    xs = sorted(xs)
    return xs[len(xs) // 2] if len(xs) % 2 else (xs[len(xs) // 2 - 1] + xs[len(xs) // 2]) / 2


def estimate(sp):
    """Expected (total seconds, seconds until the first step) for a job, from your own runs: the median of the
    last five at the same image size and steps. Backtested on real history this beat a per-MP average
    (6 % vs 12 % median error); whether the LoRAs changed made no measurable difference, so they're ignored."""
    steps, mp = sp["steps"], mp_bucket(sp["w"], sp["h"])
    c = [h for h in history if (h["w"], h["h"], h["steps"]) == (sp["w"], sp["h"], steps)][-5:]
    if c:
        f = [h["first"] for h in c if h["first"] is not None]
        return round(_median([h["dur"] for h in c]), 1), (round(_median(f), 1) if f else None)
    c = [h["dur"] / h["steps"] for h in history if h["mp"] == mp][-5:]  # same megapixels, other shape or steps
    if c:
        return round(_median(c) * steps, 1), None
    return round((stats["sec_per_step"].get(mp) or 60) * steps, 1), None


def with_estimates(js):
    """Public job list with est / est_first on waiting jobs."""
    out = []
    for j in js:
        pj = public(j)
        if j["status"] == "pending" and j.get("kind", "txt2img") == "txt2img":
            pj["est"], pj["est_first"] = estimate(j["spec"])
        out.append(pj)
    return out


def next_id():
    return max([j["id"] for j in jobs], default=0) + 1


def public(j):
    return {k: v for k, v in j.items() if not k.startswith("_")}


def mp_bucket(w, h):
    mp = w * h / 1e6
    return min(("1.0", "1.5", "2.0"), key=lambda b: abs(float(b) - mp))


# ---------------------------------------------------------------- PNG helpers
def png_has_text(data, key):
    i = 8
    while i < len(data):
        n = struct.unpack(">I", data[i:i + 4])[0]
        tag = data[i + 4:i + 8]
        if tag in (b"tEXt", b"iTXt") and data[i + 8:i + 8 + n].split(b"\0", 1)[0] == key.encode():
            return True
        if tag == b"IEND":
            break
        i += 12 + n
    return False


def png_add_text(data, key, text):
    """Insert an iTXt chunk (UTF-8) before IEND — Forge/A1111 'parameters' format."""
    payload = key.encode() + b"\0\0\0\0\0" + text.encode("utf-8")
    chunk = struct.pack(">I", len(payload)) + b"iTXt" + payload + struct.pack(">I", zlib.crc32(b"iTXt" + payload) & 0xFFFFFFFF)
    end = data.rfind(b"IEND") - 4
    return data[:end] + chunk + data[end:]


def slugify(name):
    s = re.sub(r"[^\w]+", "-", name.lower(), flags=re.UNICODE).strip("-")
    return s[:60] or "kiln"


def next_filename(name, seed):
    if name.strip():
        slug = slugify(name)
        nums = [int(m.group(1)) for p in OUT.glob(f"{slug}-*.png") if (m := re.fullmatch(rf"{re.escape(slug)}-(\d+)\.png", p.name))]
        return f"{slug}-{max(nums, default=0) + 1:03d}.png"
    return f"kiln-{datetime.datetime.now():%Y%m%d-%H%M%S}-{seed}.png"


# ---------------------------------------------------------------- worker
def poll_progress(job, stop):
    while not stop.is_set():
        try:
            r = forge("GET", "/sdapi/v1/progress?skip_current_image=false", timeout=5)
            st = r.get("state") or {}
            with lock:
                if st.get("sampling_steps"):
                    job["step"] = st.get("sampling_step", 0)
                    job["steps"] = st["sampling_steps"]
                    if job["step"] >= 1 and not job.get("t_first"):
                        job["t_first"] = time.time()
                job["progress"] = round(r.get("progress") or 0, 4)
                job["eta"] = round(r.get("eta_relative") or 0, 1)
                if r.get("current_image") and job.get("t_first"):
                    b = base64.b64decode(r["current_image"])
                    if b != last_preview["v"] and b != previews.get(job["id"]):
                        previews[job["id"]] = b
                        job["preview_rev"] = job.get("preview_rev", 0) + 1
        except Exception:
            pass
        stop.wait(0.8)


def ensure_model(spec):
    """Switch checkpoint / VAE+text-encoder only when they differ from what Forge has loaded."""
    want_ck, want_mods = spec.get("checkpoint"), spec.get("modules")
    if not want_ck and not want_mods:
        return
    opts = forge("GET", "/sdapi/v1/options")
    bare = lambda t: re.sub(r"\s*\[[0-9a-f]+\]$", "", t or "")
    norm = lambda ps: sorted(os.path.normcase(os.path.normpath(x)) for x in (ps or []))
    change = {}
    if want_ck and bare(opts.get("sd_model_checkpoint")) != bare(want_ck):
        change["sd_model_checkpoint"] = bare(want_ck)
    if want_mods and norm(opts.get("forge_additional_modules")) != norm(want_mods):
        change["forge_additional_modules"] = want_mods
    if change:
        print("switching model:", change)
        forge("POST", "/sdapi/v1/options", change, timeout=600)


def run_txt2img(job):
    sp = job["spec"]
    ensure_model(sp)
    lora_tags = " ".join(f"<lora:{l['name']}:{l['w']}>" for l in sp.get("loras", []))
    payload = {
        "prompt": (sp["prompt"] + (" " + lora_tags if lora_tags else "")).strip(),
        "negative_prompt": "",
        "width": sp["w"], "height": sp["h"], "steps": sp["steps"],
        "seed": sp.get("seed", -1),
        "cfg_scale": sp.get("cfg", 1.0), "distilled_cfg_scale": sp.get("shift", 1.15),
        "sampler_name": sp.get("sampler", "Euler"), "scheduler": sp.get("scheduler", "Simple"),
        "batch_size": 1, "n_iter": 1, "send_images": True, "save_images": False,
    }
    stop = threading.Event()
    t = threading.Thread(target=poll_progress, args=(job, stop), daemon=True)
    t.start()
    try:
        r = forge("POST", "/sdapi/v1/txt2img", payload, timeout=None)
    finally:
        stop.set()
    if job.get("_cancel"):
        return "cancelled"
    img = base64.b64decode(r["images"][0])
    info = json.loads(r.get("info") or "{}")
    infotext = (info.get("infotexts") or [""])[0]
    seed = info.get("seed", sp.get("seed"))
    if infotext and img[:8] == b"\x89PNG\r\n\x1a\n" and not png_has_text(img, "parameters"):
        img = png_add_text(img, "parameters", infotext)
    name = next_filename(sp.get("name", ""), seed)
    (OUT / name).write_bytes(img)
    with lock:
        job.update(file=name, seed_used=seed, infotext=infotext)
    return "done"


def run_upscale(job):
    sp = job["spec"]
    src = OUT / sp["source"]
    r = forge("POST", "/sdapi/v1/extra-single-image", {
        "image": base64.b64encode(src.read_bytes()).decode(),
        "upscaling_resize": sp.get("scale", 2), "upscaler_1": sp["upscaler"],
    }, timeout=None)
    out = src.with_name(f"{src.stem}_x{sp.get('scale', 2)}.png")
    out.write_bytes(base64.b64decode(r["image"]))
    with lock:
        job["file"] = out.name
    return "done"


def worker():
    while True:
        with lock:
            job = next((j for j in jobs if j["status"] == "pending"), None)
        if not job:
            wake.wait(2); wake.clear()
            continue
        try:
            forge("GET", "/sdapi/v1/options", timeout=5)
            forge_status.update(ok=True, error=None)
        except Exception as e:
            forge_status.update(ok=False, error=f"Forge not reachable at {CFG['forge_url']}")
            time.sleep(3)
            continue
        with lock:
            job.update(status="running", started=time.time(), step=0, progress=0, eta=None, error=None, t_first=None)
            if job["kind"] == "txt2img":
                su = setup_of(job["spec"])
                job["warm"] = su == last_setup["v"]
                job["est"], job["est_first"] = estimate(job["spec"])
            save_queue()
        print(f"job {job['id']} ({job['kind']}) started")
        try:
            result = run_upscale(job) if job["kind"] == "upscale" else run_txt2img(job)
        except urllib.error.URLError as e:
            result = "error"; job["error"] = f"Forge: {e}"
        except Exception as e:
            result = "error"; job["error"] = f"{type(e).__name__}: {e}"
        with lock:
            job.update(status=result, finished=time.time())
            last_preview["v"] = previews.pop(job["id"], None) or last_preview["v"]
            if result == "done" and job["kind"] == "txt2img":
                b = mp_bucket(job["spec"]["w"], job["spec"]["h"])
                per = (job["finished"] - job["started"]) / max(1, job["spec"]["steps"])
                old = stats["sec_per_step"].get(b)
                stats["sec_per_step"][b] = round(per if old is None else old * 0.7 + per * 0.3, 2)
                STATS_FILE.write_text(json.dumps(stats), encoding="utf-8")
                su = setup_of(job["spec"])
                history.append(run_record(job, su, job.get("warm")))
                save_history()
            if job["kind"] == "txt2img":  # Forge now has this setup loaded — unless it never got going
                last_setup["v"] = setup_of(job["spec"]) if (result == "done" or job.get("t_first")) else None
            save_queue()
        print(f"job {job['id']} {result}" + (f": {job.get('error')}" if job.get("error") else ""))


client = {"last": None, "bye": None}


def watchdog():
    """Exit when no Kiln window is open and nothing is queued or running.

    A closing window says goodbye (/api/bye): stop ~2 s later unless another window (or a reload) polls first.
    Without a goodbye (crash, killed browser) a window counts as gone after 15 s without a poll."""
    said = None
    while True:
        time.sleep(1)
        if not CFG.get("exit_when_closed", True) or client["last"] is None:
            continue
        now, last, bye = time.time(), client["last"], client["bye"]
        closed = (bye is not None and bye >= last - 0.5 and now - bye > 2) or now - last > 15
        if not closed:
            said = None
            continue
        with lock:
            busy = sum(1 for j in jobs if j["status"] in ("pending", "running"))
        if not busy:
            print("Kiln window closed and queue empty — stopping the server.", flush=True)
            stop_forge()
            os._exit(0)
        if said != busy:  # explain why the server is still up
            print(f"Kiln window closed — finishing {busy} queued job{'s' * (busy != 1)}, then stopping.", flush=True)
            said = busy


def seed_edge_spellcheck(profile):
    """Add Kiln's spell-check languages to its Edge profile (kiln.bat runs this before opening Edge)."""
    langs = CFG.get("spellcheck") or []
    pref = Path(profile) / "Default" / "Preferences"
    try:
        p = json.loads(pref.read_text(encoding="utf-8")) if pref.exists() else {}
    except Exception:
        return
    sc = p.setdefault("spellcheck", {})
    have = sc.get("dictionaries") or []
    want = have + [l for l in langs if l not in have]
    intl = p.setdefault("intl", {})
    acc = [a for a in (intl.get("accept_languages") or "en-US,en").split(",") if a]
    acc_want = acc + [l for l in langs if l not in acc]
    if want == have and acc_want == acc and p.get("browser", {}).get("enable_spellchecking", True):
        return
    sc["dictionaries"] = want
    intl["accept_languages"] = ",".join(acc_want)
    p.setdefault("browser", {})["enable_spellchecking"] = True
    pref.parent.mkdir(parents=True, exist_ok=True)
    pref.write_text(json.dumps(p), encoding="utf-8")


def start_forge():
    """Start Forge from config "forge_start" (its webui-user.bat) if it isn't answering. Runs once at startup."""
    global forge_proc
    bat = (CFG.get("forge_start") or "").strip()
    if not bat:
        return
    try:
        forge("GET", "/sdapi/v1/progress?skip_current_image=true", timeout=3)
        return  # already running — not ours, so we won't stop it either
    except Exception:
        pass
    path = Path(bat)
    if not path.is_file():
        print(f"forge_start: {bat} not found — start Forge yourself.", flush=True)
        return
    kw = {"cwd": str(path.parent)}
    if os.name == "nt":  # own console window, minimized and without stealing focus
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        si.wShowWindow = 7  # SW_SHOWMINNOACTIVE
        kw.update(creationflags=subprocess.CREATE_NEW_CONSOLE, startupinfo=si)
        cmd = ["cmd", "/c", str(path)]
    else:
        cmd = ["sh", str(path)]
    forge_proc = subprocess.Popen(cmd, **kw)
    forge_status["starting"] = True
    print(f"Starting Forge: {path}", flush=True)


def stop_forge():
    """Stop the Forge we started (whole process tree). Leaves a Forge the user started alone."""
    if forge_proc is None or forge_proc.poll() is not None or not CFG.get("stop_forge_on_exit", True):
        return
    if forge_status.get("busy"):  # something else (Forge's own UI, the Photoshop plugin) is using it — leave it
        print("Forge is busy with another client — leaving it running.", flush=True)
        return
    print("Stopping the Forge that Kiln started.", flush=True)
    if os.name == "nt":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(forge_proc.pid)], capture_output=True)
    else:
        forge_proc.terminate()


def health():
    while True:
        try:
            r = forge("GET", "/sdapi/v1/progress?skip_current_image=true", timeout=5)
            forge_status.update(ok=True, error=None, starting=False, busy=bool((r.get("state") or {}).get("job_count")))
        except Exception:
            starting = forge_proc is not None and forge_proc.poll() is None and forge_status["starting"]
            forge_status.update(ok=False, busy=False, starting=starting,
                                error="Forge is starting" if starting else f"Forge not reachable at {CFG['forge_url']}")
        time.sleep(4)


# ---------------------------------------------------------------- models (cached)
_models = {"t": 0, "data": None}


def lora_category(folder):
    f = folder.lower()
    if f in CFG["people_folders"]:
        return "people"
    if f in CFG["style_folders"]:
        return "style"
    return "utility"


def get_models(refresh=False):
    if _models["data"] and not refresh and time.time() - _models["t"] < 60:
        return _models["data"]
    if refresh:
        try: forge("POST", "/sdapi/v1/refresh-loras", {})
        except Exception: pass
    raw = forge("GET", "/sdapi/v1/loras")
    # Find the LoRA root from the paths themselves (Forge Neo's /cmd-flags can 500): the last "Lora"
    # folder in a path, else the common parent of all files.
    def lora_root(p):
        parts = [x.lower() for x in p.parts]
        return Path(*p.parts[:len(parts) - parts[::-1].index("lora")]) if "lora" in parts else None
    paths = [Path(l["path"]) for l in raw]
    roots = {lora_root(p) for p in paths} - {None}
    common = roots.pop() if len(roots) == 1 else (Path(os.path.commonpath([str(p.parent) for p in paths])) if paths else None)
    loras = []
    for l, p in zip(raw, paths):
        try:
            rel = p.relative_to(lora_root(p) or common)
            folder = rel.parts[0] if len(rel.parts) > 1 else ""
        except (ValueError, TypeError):
            folder = p.parent.name
        meta = l.get("metadata") or {}
        thumb = THUMBS / f"{l['name']}.jpg"
        loras.append({"name": l["name"], "folder": folder, "category": lora_category(folder),
                      "internal": meta.get("ss_output_name") or "",
                      "thumb": f"/thumbs/{l['name']}.jpg" if thumb.exists() else None})
    data = {
        "checkpoints": [m["title"] for m in forge("GET", "/sdapi/v1/sd-models")],
        "modules": [{"name": m["model_name"], "file": m["filename"]} for m in forge("GET", "/sdapi/v1/sd-modules")],
        "upscalers": [u["name"] for u in forge("GET", "/sdapi/v1/upscalers") if u["name"] not in ("None", "Lanczos", "Nearest")],
        "loras": sorted(loras, key=lambda x: x["name"].lower()),
        "current": {k: v for k, v in forge("GET", "/sdapi/v1/options").items() if k in ("sd_model_checkpoint", "forge_additional_modules")},
    }
    _models.update(t=time.time(), data=data)
    return data


# ---------------------------------------------------------------- HTTP
MIME = {".html": "text/html; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
        ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".ico": "image/x-icon"}


def sniff(b):
    return "image/png" if b[:4] == b"\x89PNG" else "image/jpeg" if b[:2] == b"\xff\xd8" else "image/webp" if b[8:12] == b"WEBP" else "application/octet-stream"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def reply(self, code, body=b"", ctype="application/json", cache=False):
        if isinstance(body, (dict, list)) or body is None:
            body = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "max-age=86400" if cache else "no-store")
        self.end_headers()
        self.wfile.write(body)

    def json_body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def file(self, base: Path, name, cache=False):
        p = (base / name).resolve()
        if base not in p.parents or not p.is_file():
            return self.reply(404, {"error": "not found"})
        self.reply(200, p.read_bytes(), MIME.get(p.suffix.lower(), "application/octet-stream"), cache)

    def do_GET(self):
        path = urllib.parse.unquote(self.path.split("?")[0])
        if path in ("/", "/index.html"):
            page = (ROOT / "index.html").read_bytes()
            inject = os.environ.get("KILN_TEST_INJECT")  # test hook: append a script (used by automated UI checks)
            if inject and "test" in self.path:
                page = page.replace(b"</body>", b"<script>" + Path(inject).read_bytes() + b"</script></body>")
            return self.reply(200, page, MIME[".html"])
        if path.startswith("/docs/"):
            return self.file(ROOT / "docs", path[6:], cache=True)
        if path.startswith("/files/"):
            return self.file(OUT, path[7:], cache=True)
        if path.startswith("/thumbs/"):
            return self.file(THUMBS, path[8:])
        if path == "/api/state":
            client["last"] = time.time()
            with lock:
                return self.reply(200, {"forge": forge_status, "jobs": with_estimates(jobs), "stats": stats,
                                        "out_dir": str(OUT)})
        if path == "/api/nextname":
            name = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("name", [""])[0]
            if not name.strip():
                return self.reply(200, {"file": None})
            with lock:  # count jobs already queued under this name so the hint is accurate
                pend = sum(1 for j in jobs if j["status"] in ("pending", "running") and j["spec"].get("name", "").strip() == name.strip())
            nxt = next_filename(name, 0)
            m = re.search(r"-(\d+)\.png$", nxt)
            if m and pend:
                nxt = nxt[:m.start(1)] + f"{int(m.group(1)) + pend:03d}.png"
            return self.reply(200, {"file": nxt})
        if path.startswith("/api/preview/"):
            b = previews.get(int(path.rsplit("/", 1)[1]))
            return self.reply(200, b, sniff(b)) if b else self.reply(404, {"error": "no preview"})
        if path == "/api/models":
            try:
                return self.reply(200, get_models("refresh" in self.path))
            except Exception as e:
                return self.reply(503, {"error": f"Forge not reachable: {e}"})
        self.reply(404, {"error": "not found"})

    def do_POST(self):
        path = self.path.split("?")[0]
        b = self.json_body()
        if path == "/api/estimate":  # the prompt box's current settings -> expected seconds per image
            try:
                return self.reply(200, {"est": estimate(b.get("spec") or {})[0]})
            except Exception as e:
                return self.reply(400, {"error": str(e)})
        if path == "/api/bye":  # a Kiln window is closing (sendBeacon from pagehide)
            client["bye"] = time.time()
            return self.reply(200, {})
        if path == "/api/jobs":
            ids = []
            with lock:
                for sp in b.get("jobs", []):
                    j = {"id": next_id(), "kind": sp.pop("kind", "txt2img"), "status": "pending", "created": time.time(),
                         "spec": sp, "step": 0, "progress": 0}
                    j["steps"] = sp.get("steps", 0)
                    jobs.append(j); ids.append(j["id"])
                save_queue()
            wake.set()
            return self.reply(200, {"ids": ids})
        m = re.fullmatch(r"/api/jobs/(\d+)/cancel", path)
        if m:
            jid = int(m.group(1))
            with lock:
                j = next((x for x in jobs if x["id"] == jid), None)
                if not j:
                    return self.reply(404, {"error": "no such job"})
                if j["status"] == "pending":
                    jobs.remove(j)
                elif j["status"] == "running":
                    j["_cancel"] = True
                    try: forge("POST", "/sdapi/v1/interrupt", {})
                    except Exception: pass
                save_queue()
            return self.reply(200, {"ok": True})
        if path == "/api/reorder":
            order = b.get("ids", [])
            with lock:
                pend = {j["id"]: j for j in jobs if j["status"] == "pending"}
                rest = [j for j in jobs if j["status"] != "pending"]
                ordered = [pend.pop(i) for i in order if i in pend] + list(pend.values())
                jobs[:] = rest + ordered
                save_queue()
            return self.reply(200, {"ok": True})
        if path == "/api/clear":
            with lock:
                jobs[:] = [j for j in jobs if j["status"] in ("pending", "running")]
                save_queue()
            return self.reply(200, {"ok": True})
        if path in ("/api/open", "/api/reveal"):
            with lock:
                j = next((x for x in jobs if x["id"] == b.get("id")), None)
            f = (OUT / j["file"]) if j and j.get("file") else None
            if not f or not f.exists():
                return self.reply(404, {"error": "file not found"})
            if path == "/api/open":
                os.startfile(str(f)) if os.name == "nt" else subprocess.Popen(["xdg-open", str(f)])
            else:
                subprocess.Popen(["explorer", "/select,", str(f)]) if os.name == "nt" else subprocess.Popen(["xdg-open", str(f.parent)])
            return self.reply(200, {"ok": True})
        if path == "/api/upscale":
            with lock:
                src = next((x for x in jobs if x["id"] == b.get("id")), None)
                if not src or not src.get("file"):
                    return self.reply(404, {"error": "no image"})
                j = {"id": next_id(), "kind": "upscale", "status": "pending", "created": time.time(), "step": 0, "progress": 0,
                     "spec": {"source": src["file"], "upscaler": b.get("upscaler"), "scale": b.get("scale", 2),
                              "prompt": f"Upscale ×{b.get('scale', 2)} · {src['file']}", "name": "", "w": src["spec"]["w"],
                              "h": src["spec"]["h"], "steps": 0, "mp": src["spec"].get("mp"), "ar": src["spec"].get("ar")}}
                jobs.append(j); save_queue()
            wake.set()
            return self.reply(200, {"ids": [j["id"]]})
        if path == "/api/thumb":
            name = Path(b.get("name", "")).name
            data = b.get("data", "")
            if not name or not data.startswith("data:image/"):
                return self.reply(400, {"error": "bad thumb"})
            (THUMBS / f"{name}.jpg").write_bytes(base64.b64decode(data.split(",", 1)[1]))
            _models["data"] = None
            return self.reply(200, {"url": f"/thumbs/{name}.jpg"})
        self.reply(404, {"error": "not found"})


def main():
    for stream in (sys.stdout, sys.stderr):  # Windows consoles default to a legacy codepage
        try: stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception: pass
    load_state()
    start_forge()
    threading.Thread(target=worker, daemon=True).start()
    threading.Thread(target=health, daemon=True).start()
    threading.Thread(target=watchdog, daemon=True).start()
    srv = ThreadingHTTPServer((CFG["host"], CFG["port"]), Handler)
    print(f"Kiln on http://{CFG['host']}:{CFG['port']}  ·  Forge: {CFG['forge_url']}  ·  images → {OUT}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--seed-edge":
        seed_edge_spellcheck(sys.argv[2])
    else:
        main()
