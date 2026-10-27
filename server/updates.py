"""Kiln's version, and the manual Check for updates (Settings → About) — the only request that leaves the machine."""

from __future__ import annotations

import json
import os
import re
import urllib.request
from typing import Any

from .net import OPENER

VERSION = "0.7.1"  # bumped when a roadmap phase is tagged (see CHANGELOG.md)
REPO = "KirillRepinArt/kiln"


def version_key(tag: str) -> tuple[int, ...] | None:
    """ "v0.6" / "v0.6.1" -> (0, 6, 0) / (0, 6, 1); anything else -> None."""
    m = re.fullmatch(r"v(\d+)\.(\d+)(?:\.(\d+))?", tag)
    return tuple(int(x or 0) for x in m.groups()) if m else None


def check_update() -> dict[str, Any]:
    """Newest vX.Y tag on GitHub vs this VERSION. Only runs when the user presses Check for updates."""
    url = os.environ.get("KILN_UPDATE_URL") or f"https://api.github.com/repos/{REPO}/tags"  # env: tests
    req = urllib.request.Request(url, headers={"User-Agent": "Kiln", "Accept": "application/vnd.github+json"})  # noqa: S310
    with OPENER.open(req, timeout=10) as r:
        tags = [t["name"] for t in json.loads(r.read())]
    vs = sorted((v, t) for t in tags if (v := version_key(t)))
    latest = vs[-1][1] if vs else None
    return {
        "current": VERSION,
        "latest": latest,
        "newer": bool(vs) and vs[-1][0] > (version_key("v" + VERSION) or ()),
        "url": f"https://github.com/{REPO}",
    }
