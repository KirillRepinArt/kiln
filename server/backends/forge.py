"""Forge Neo (and other A1111-style APIs: /sdapi/v1/...) as Kiln's image generator."""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import subprocess
import threading
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

from .. import images
from ..net import OPENER
from .base import BackendError, Progress, Render

log = logging.getLogger("kiln")

PROGRESS_EVERY = 0.8  # seconds between progress polls while a picture renders
HEALTH_EVERY = 4  # seconds between health checks


def lora_folders(paths: list[Path]) -> list[str]:
    """The folder each LoRA sits in under the LoRA root ("" at the root) — the root is found from the paths
    themselves (Forge Neo's /cmd-flags can 500): the last "Lora" folder in a path, else the common parent of all."""

    def lora_root(p: Path) -> Path | None:
        parts = [x.lower() for x in p.parts]
        return Path(*p.parts[: len(parts) - parts[::-1].index("lora")]) if "lora" in parts else None

    roots = {lora_root(p) for p in paths} - {None}
    common = (
        roots.pop()
        if len(roots) == 1
        else (Path(os.path.commonpath([str(p.parent) for p in paths])) if paths else None)
    )
    folders = []
    for p in paths:
        try:
            rel = p.relative_to(lora_root(p) or common)  # type: ignore[arg-type]
            folders.append(rel.parts[0] if len(rel.parts) > 1 else "")
        except (ValueError, TypeError):
            folders.append(p.parent.name)
    return folders


def bare(title: str | None) -> str:
    """A checkpoint's title without Forge's hash: "model.safetensors [abc123]" -> "model.safetensors"."""
    return re.sub(r"\s*\[[0-9a-f]+\]$", "", title or "")


def same_paths(ps: list[str] | None) -> list[str]:
    return sorted(os.path.normcase(os.path.normpath(x)) for x in (ps or []))


class ForgeBackend:
    label = "Forge"

    def __init__(self, cfg: Mapping[str, Any]) -> None:
        self.cfg = cfg  # read when needed: tests change it after start-up
        self.status: dict[str, Any] = {"ok": False, "error": "not checked yet", "busy": False, "starting": False}
        self.proc: subprocess.Popen[bytes] | None = None  # the Forge we started (None: already running / not ours)

    @property
    def url(self) -> str:
        return str(self.cfg["forge_url"])

    def call(self, method: str, path: str, body: Any = None, timeout: float | None = 15) -> Any:
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(  # noqa: S310 — the configured Forge address
            self.url.rstrip("/") + path, data=data, method=method, headers={"Content-Type": "application/json"}
        )
        try:
            with OPENER.open(req, timeout=timeout) as r:
                raw = r.read()
        except urllib.error.URLError as e:
            raise BackendError(str(e)) from e
        return json.loads(raw) if raw else None

    # ------------------------------------------------------------ running Forge
    def detect(self) -> bool:
        try:
            self.call("GET", "/sdapi/v1/progress?skip_current_image=true", timeout=3)
        except Exception:  # noqa: BLE001 — not answering, for whatever reason
            return False
        return True

    def start(self) -> None:
        """Start Forge from config "forge_start" (its webui-user.bat) if it isn't answering. Runs once at startup."""
        bat = (self.cfg.get("forge_start") or "").strip()
        if not bat or self.detect():  # already running — not ours, so we won't stop it either
            return
        path = Path(bat)
        if not path.is_file():
            log.info("forge_start: %s not found — start Forge yourself.", bat)
            return
        kw: dict[str, Any] = {"cwd": str(path.parent)}
        if os.name == "nt":  # own console window, minimized and without stealing focus
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            si.wShowWindow = 7  # SW_SHOWMINNOACTIVE
            kw.update(creationflags=subprocess.CREATE_NEW_CONSOLE, startupinfo=si)
            cmd = ["cmd", "/c", str(path)]
        else:
            cmd = ["sh", str(path)]
        self.proc = subprocess.Popen(cmd, **kw)  # noqa: S603 — the user's own Forge launcher, from their config
        self.status["starting"] = True
        log.info("Starting Forge: %s", path)

    def stop(self) -> None:
        """Stop the Forge we started (whole process tree). Leaves a Forge the user started alone."""
        if self.proc is None or self.proc.poll() is not None or not self.cfg.get("stop_forge_on_exit", True):
            return
        if self.status.get("busy"):  # something else (Forge's own UI, the Photoshop plugin) is using it — leave it
            log.info("Forge is busy with another client — leaving it running.")
            return
        log.info("Stopping the Forge that Kiln started.")
        if os.name == "nt":
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(self.proc.pid)], capture_output=True)  # noqa: S603, S607
        else:
            self.proc.terminate()

    def health(self) -> None:
        try:
            r = self.call("GET", "/sdapi/v1/progress?skip_current_image=true", timeout=5)
            busy = bool((r.get("state") or {}).get("job_count"))
            self.status.update(ok=True, error=None, starting=False, busy=busy)
        except Exception:  # noqa: BLE001 — any failure means "not reachable"; the status says so
            starting = self.proc is not None and self.proc.poll() is None and self.status["starting"]
            self.status.update(
                ok=False,
                busy=False,
                starting=starting,
                error="Forge is starting" if starting else f"Forge not reachable at {self.url}",
            )

    def watch(self) -> None:
        """Check on Forge every few seconds, for ever (a thread)."""
        while True:
            self.health()
            time.sleep(HEALTH_EVERY)

    def ready(self) -> bool:
        try:
            self.call("GET", "/sdapi/v1/options", timeout=5)
        except Exception:  # noqa: BLE001 — any failure means "not reachable"; the status says so
            self.status.update(ok=False, error=f"Forge not reachable at {self.url}")
            return False
        self.status.update(ok=True, error=None)
        return True

    # ------------------------------------------------------------ what it offers
    def models(self, refresh: bool) -> dict[str, Any]:
        if refresh:
            try:
                self.call("POST", "/sdapi/v1/refresh-loras", {})
            except Exception:  # noqa: BLE001, S110 — a rescan that failed still leaves the list Forge has
                pass
        raw = self.call("GET", "/sdapi/v1/loras")
        folders = lora_folders([Path(lora["path"]) for lora in raw])
        loras = [
            {
                "name": lora["name"],
                "folder": folder,
                "internal": (lora.get("metadata") or {}).get("ss_output_name") or "",
            }
            for lora, folder in zip(raw, folders, strict=True)
        ]
        hidden_upscalers = ("None", "Lanczos", "Nearest")
        return {
            "checkpoints": [m["title"] for m in self.call("GET", "/sdapi/v1/sd-models")],
            "modules": [
                {"name": m["model_name"], "file": m["filename"]} for m in self.call("GET", "/sdapi/v1/sd-modules")
            ],
            "upscalers": [
                u["name"] for u in self.call("GET", "/sdapi/v1/upscalers") if u["name"] not in hidden_upscalers
            ],
            "loras": loras,
            "current": {
                k: v
                for k, v in self.call("GET", "/sdapi/v1/options").items()
                if k in ("sd_model_checkpoint", "forge_additional_modules")
            },
        }

    # ------------------------------------------------------------ rendering
    def ensure_model(self, spec: Mapping[str, Any]) -> None:
        """Switch checkpoint / VAE+text-encoder only when they differ from what Forge has loaded."""
        want_ck, want_mods = spec.get("checkpoint"), spec.get("modules")
        if not want_ck and not want_mods:
            return
        opts = self.call("GET", "/sdapi/v1/options")
        change = {}
        if want_ck and bare(opts.get("sd_model_checkpoint")) != bare(want_ck):
            change["sd_model_checkpoint"] = bare(want_ck)
        if want_mods and same_paths(opts.get("forge_additional_modules")) != same_paths(want_mods):
            change["forge_additional_modules"] = want_mods
        if change:
            log.info("switching model: %s", change)
            self.call("POST", "/sdapi/v1/options", change, timeout=600)

    def poll_progress(self, on_progress: Callable[[Progress], None], stop: threading.Event) -> None:
        while not stop.is_set():
            try:
                r = self.call("GET", "/sdapi/v1/progress?skip_current_image=false", timeout=5)
                st = r.get("state") or {}
                img = r.get("current_image")
                on_progress(
                    Progress(
                        step=st.get("sampling_step", 0),
                        steps=st.get("sampling_steps") or 0,
                        progress=r.get("progress") or 0,
                        eta=r.get("eta_relative") or 0,
                        image=base64.b64decode(img) if img else None,
                    )
                )
            except Exception:  # noqa: BLE001, S110 — a missed poll is fine: the next one comes in a moment
                pass
            stop.wait(PROGRESS_EVERY)

    def txt2img(
        self, spec: Mapping[str, Any], on_progress: Callable[[Progress], None], cancelled: Callable[[], bool]
    ) -> Render | None:
        self.ensure_model(spec)
        lora_tags = " ".join(f"<lora:{lora['name']}:{lora['w']}>" for lora in spec.get("loras", []))
        payload = {
            "prompt": (spec["prompt"] + (" " + lora_tags if lora_tags else "")).strip(),
            "negative_prompt": "",
            "width": spec["w"],
            "height": spec["h"],
            "steps": spec["steps"],
            "seed": spec.get("seed", -1),
            "cfg_scale": spec.get("cfg", 1.0),
            "distilled_cfg_scale": spec.get("shift", 1.15),
            "sampler_name": spec.get("sampler", "Euler"),
            "scheduler": spec.get("scheduler", "Simple"),
            "batch_size": 1,
            "n_iter": 1,
            "send_images": True,
            "save_images": False,
        }
        stop = threading.Event()
        threading.Thread(target=self.poll_progress, args=(on_progress, stop), daemon=True).start()
        try:
            r = self.call("POST", "/sdapi/v1/txt2img", payload, timeout=None)
        finally:
            stop.set()
        if cancelled():
            return None
        img = base64.b64decode(r["images"][0])
        info = json.loads(r.get("info") or "{}")
        infotext = (info.get("infotexts") or [""])[0]
        if infotext and images.is_png(img) and not images.has_text(img, "parameters"):
            img = images.add_text(img, "parameters", infotext)
        return Render(img, info.get("seed", spec.get("seed")), infotext)

    def upscale(self, image: bytes, upscaler: Any, scale: Any) -> bytes:
        body = {"image": base64.b64encode(image).decode(), "upscaling_resize": scale, "upscaler_1": upscaler}
        r = self.call("POST", "/sdapi/v1/extra-single-image", body, timeout=None)
        return base64.b64decode(r["image"])

    def interrupt(self) -> None:
        try:
            self.call("POST", "/sdapi/v1/interrupt", {})
        except Exception:  # noqa: BLE001, S110 — nothing running to stop, or Forge gone: either way, stopped
            pass
