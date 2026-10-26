"""The launcher (`python -m server --launch`, what kiln.bat runs): use the Kiln already running for this data folder, or
start one; wait until it answers; open Kiln in its own window — Edge, else Chrome / Chromium, else your browser.

A running Kiln is found by data/instance.json (the port it got) and confirmed by /api/hello: the old kiln.bat took
anything answering on the port for Kiln, and would have opened some other program in Kiln's window.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import webbrowser
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

from .config import CFG, ROOT, Paths
from .edge import seed_spellcheck
from .instance import read_instance
from .net import OPENER

READY_WAIT = 20  # seconds for a fresh server to answer (a first start can take a few)
WINDOW = "1400,900"

Fetch = Callable[[str], Mapping[str, Any] | None]


def hello(url: str) -> Mapping[str, Any] | None:
    """What answers at url/api/hello — None if nothing (or not JSON)."""
    try:
        with OPENER.open(url + "/api/hello", timeout=1.5) as r:
            info = json.loads(r.read())
    except (OSError, ValueError):
        return None
    return info if isinstance(info, dict) else None


def running_port(paths: Paths, host: str, fetch: Fetch = hello) -> int | None:
    """The port of the Kiln running for this data folder, or None."""
    info = read_instance(paths.data)
    if not info:
        return None
    me = fetch(f"http://{host}:{info['port']}")
    if me and me.get("app") == "kiln" and Path(str(me.get("data"))) == paths.data:
        return int(info["port"])
    return None


def find_browser(
    env: Mapping[str, str] = os.environ, exists: Callable[[Path], bool] = Path.is_file
) -> tuple[str, Path] | None:
    """(name, path) of the first app-window browser installed: Edge, Chrome, Chromium. KILN_BROWSER overrides."""
    if env.get("KILN_BROWSER"):
        return "custom", Path(env["KILN_BROWSER"])
    pf, pf86, local = env.get("ProgramFiles", ""), env.get("ProgramFiles(x86)", ""), env.get("LOCALAPPDATA", "")
    candidates = [
        ("Edge", Path(pf86, "Microsoft/Edge/Application/msedge.exe")),
        ("Edge", Path(pf, "Microsoft/Edge/Application/msedge.exe")),
        ("Chrome", Path(pf, "Google/Chrome/Application/chrome.exe")),
        ("Chrome", Path(pf86, "Google/Chrome/Application/chrome.exe")),
        ("Chrome", Path(local, "Google/Chrome/Application/chrome.exe")),
        ("Chromium", Path(local, "Chromium/Application/chrome.exe")),
    ]
    return next(((name, p) for name, p in candidates if (pf or pf86 or local) and exists(p)), None)


def profile_dir(name: str, env: Mapping[str, str] = os.environ) -> Path:
    """Kiln's own browser profile (so its flags apply even when the browser is already open). Edge keeps the folder
    kiln.bat always used: your window size and zoom stay."""
    return Path(env.get("LOCALAPPDATA", str(Path.home())), "Kiln", "Edge" if name == "Edge" else name)


def browser_command(browser: tuple[str, Path], url: str, profile: Path) -> list[str]:
    """An app window (no tabs, no address bar) on Kiln's own profile; no proxy: VPN clients that take over the system
    proxy must not stand between the page and 127.0.0.1."""
    return [
        str(browser[1]),
        f"--user-data-dir={profile}",
        "--no-proxy-server",
        "--force-dark-mode",
        "--no-first-run",
        "--no-default-browser-check",
        f"--app={url}",
        f"--window-size={WINDOW}",
    ]


def start_server() -> None:
    """The server in its own window, minimized (its log is there), detached from this one."""
    cmd = [sys.executable, "-u", "-m", "server"]
    if os.name == "nt":
        subprocess.Popen(["cmd", "/c", "start", "Kiln server", "/min", *cmd], cwd=ROOT)  # noqa: S603, S607
    else:
        subprocess.Popen(cmd, cwd=ROOT, start_new_session=True)  # noqa: S603


def wait_ready(paths: Paths, host: str, seconds: float = READY_WAIT) -> int | None:
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        port = running_port(paths, host)
        if port:
            return port
        time.sleep(0.25)
    return None


def open_window(url: str) -> str:
    """Open Kiln; says which way it went."""
    found = find_browser()
    if not found:
        webbrowser.open(url)
        return "your default browser"
    profile = profile_dir(found[0])
    seed_spellcheck(str(profile), CFG.get("spellcheck") or [])
    subprocess.Popen(browser_command(found, url, profile))  # noqa: S603 — the user's own browser, found on disk
    return found[0]


def launch() -> int:
    paths = Paths.from_config(CFG)
    host = str(CFG["host"])
    port = running_port(paths, host)
    if port:
        print(f"Kiln is running on port {port} - opening a window.")
    else:
        print("Starting Kiln...")
        start_server()
        port = wait_ready(paths, host)
        if not port:
            print('Kiln did not start - see the "Kiln server" window for what went wrong.')
            return 1
    how = open_window(f"http://{host}:{port}")
    print(f"Kiln is open ({how}).")
    return 0
