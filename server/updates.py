"""Kiln's version, and the manual Check for updates (Settings → About) — the only request that leaves the machine."""

from __future__ import annotations

import json
import os
import re
import urllib.request
from typing import Any

from .net import OPENER

VERSION = "0.7c"  # bumped when a roadmap phase is tagged (see CHANGELOG.md)
REPO = "KirillRepinArt/kiln"


def version_key(tag: str) -> tuple[int, ...] | None:
    """A tag's place in the order: (major, minor, phase letter, patch). A letter is a sub-phase of the roadmap
    (v0.7b, v0.7c), between v0.7.x and v0.8: "v0.6" -> (0, 6, 0, 0), "v0.6.1" -> (0, 6, 0, 1),
    "v0.7b" -> (0, 7, 2, 0), "v0.7b.1" -> (0, 7, 2, 1); anything else -> None."""
    m = re.fullmatch(r"v(\d+)\.(\d+)([a-z]?)(?:\.(\d+))?", tag)
    if not m:
        return None
    major, minor, letter, patch = m.groups()
    return (int(major), int(minor), ord(letter) - 96 if letter else 0, int(patch or 0))


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
