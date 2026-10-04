"""A stand-in for Forge Neo's API, for developing Kiln without a GPU.

Implements just the endpoints Kiln uses, with realistic shapes and timing:
txt2img blocks for steps x STEP_SECONDS, /progress reports steps and a live preview,
/interrupt stops early. Images are generated gradients (PNG written with the stdlib).

    python tools/fake_forge.py            # listens on 127.0.0.1:7861
    python tools/fake_forge.py 7861 0.5   # port, seconds per step
"""
import base64, json, random, struct, sys, threading, time, zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7861
STEP_SECONDS = float(sys.argv[2]) if len(sys.argv) > 2 else 0.6

state = {"job_count": 0, "sampling_step": 0, "sampling_steps": 0, "interrupted": False, "preview": None, "t0": 0.0}
options = {"sd_model_checkpoint": "krea2_turbo_fp8_scaled.safetensors", "forge_additional_modules": [],
           "live_previews_enable": True, "show_progress_every_n_steps": 1}
lock = threading.Lock()

LORAS = [  # neutral demo names; folder comes from the path, as with real Forge
    ("krea2_turbo_4step_rank_64_lora_comfyui", "Lora/krea2_turbo_4step_rank_64_lora_comfyui.safetensors"),
    ("detail_enhancer_krea2", "Lora/detail_enhancer_krea2.safetensors"),
    ("lenovo_ultrareal_krea2", "Lora/style/lenovo_ultrareal_krea2.safetensors"),
    ("krea2_janedoe_v2_large_onetrainer", "Lora/people/krea2_janedoe_v2_large_onetrainer.safetensors"),
    ("krea2_annasmith_v1_onetrainer", "Lora/people/krea2_annasmith_v1_onetrainer.safetensors"),
    ("krea2_lunavale_v1_large_onetrainer", "Lora/people/krea2_lunavale_v1_large_onetrainer.safetensors"),
]


def png(w, h, seed, blur=0.0):
    """Small RGB gradient PNG; `blur` 0..1 flattens it (fake 'early step' look)."""
    r = random.Random(seed)
    c1 = [r.randint(30, 200) for _ in range(3)]
    c2 = [r.randint(30, 200) for _ in range(3)]
    if blur:
        mid = [(a + b) // 2 for a, b in zip(c1, c2)]
        c1 = [int(a * (1 - blur) + m * blur) for a, m in zip(c1, mid)]
        c2 = [int(b * (1 - blur) + m * blur) for b, m in zip(c2, mid)]
    rows = bytearray()
    for y in range(h):
        rows.append(0)
        for x in range(w):
            t = (x / max(1, w - 1) + y / max(1, h - 1)) / 2
            rows += bytes(int(a + (b - a) * t) for a, b in zip(c1, c2))
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(bytes(rows), 6)) + chunk(b"IEND", b""))


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/sdapi/v1/options": return self.send(options)
        if p == "/sdapi/v1/cmd-flags": return self.send({"lora_dir": "Lora"})
        if p == "/sdapi/v1/sd-models":
            return self.send([{"title": n, "model_name": n.rsplit(".", 1)[0], "filename": "models/" + n}
                              for n in ("krea2_turbo_fp8_scaled.safetensors", "krea2_turbo-Q6_K.gguf")])
        if p == "/sdapi/v1/sd-modules":
            return self.send([{"model_name": n, "filename": "modules/" + n}
                              for n in ("qwen_image_vae.safetensors", "qwen3vl_4b_fp8_scaled.safetensors")])
        if p == "/sdapi/v1/upscalers":
            return self.send([{"name": n} for n in ("4x-ClearRealityV1", "4x-UltraSharpV2", "R-ESRGAN 4x+")])
        if p == "/sdapi/v1/loras":
            return self.send([{"name": n, "alias": n, "path": path, "metadata": {}} for n, path in LORAS])
        if p == "/sdapi/v1/progress":
            with lock:
                s = dict(state)
            if not s["job_count"]:
                return self.send({"progress": 0, "eta_relative": 0, "state": {"job_count": 0}, "current_image": None})
            prog = 0.01 + (s["sampling_step"] / s["sampling_steps"] if s["sampling_steps"] else 0)
            el = time.time() - s["t0"]
            return self.send({"progress": min(prog, 1), "eta_relative": el / prog - el,
                              "state": {"job_count": 1, "sampling_step": s["sampling_step"], "sampling_steps": s["sampling_steps"]},
                              "current_image": s["preview"]})
        self.send({"detail": "Not Found"}, 404)

    def do_POST(self):
        p = self.path.split("?")[0]
        b = self.body()
        if p == "/sdapi/v1/options":
            options.update(b); return self.send(None)
        if p == "/sdapi/v1/interrupt":
            with lock: state["interrupted"] = True
            return self.send({})
        if p == "/sdapi/v1/extra-single-image":
            return self.send({"image": b.get("image", ""), "html_info": "upscaled (fake)"})
        if p == "/sdapi/v1/txt2img":
            w, h, steps, seed = b.get("width", 1024), b.get("height", 1024), b.get("steps", 4), b.get("seed", -1)
            if seed in (-1, None): seed = random.randint(0, 2**32 - 1)
            with lock:
                state.update(job_count=1, sampling_step=0, sampling_steps=steps, interrupted=False, preview=None, t0=time.time())
            for i in range(steps):
                time.sleep(STEP_SECONDS)
                with lock:
                    if state["interrupted"]: break
                    state["sampling_step"] = i + 1
                    state["preview"] = base64.b64encode(png(w // 16, h // 16, seed, blur=1 - (i + 1) / steps)).decode()
            with lock:
                state.update(job_count=0, preview=None)
            info = {"infotexts": [f"{b.get('prompt','')}\nSteps: {steps}, Sampler: {b.get('sampler_name')}, "
                                  f"Schedule type: {b.get('scheduler')}, CFG scale: {b.get('cfg_scale')}, Seed: {seed}, "
                                  f"Size: {w}x{h}, Model: {options['sd_model_checkpoint']}"], "seed": seed}
            return self.send({"images": [base64.b64encode(png(w // 4, h // 4, seed)).decode()],
                              "parameters": b, "info": json.dumps(info)})
        self.send({"detail": "Not Found"}, 404)


if __name__ == "__main__":
    print(f"fake Forge on http://127.0.0.1:{PORT}  ({STEP_SECONDS}s/step)")
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
