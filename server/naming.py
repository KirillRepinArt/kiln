"""File names: a picture with a series name is `<series>-NNN.png`; one without is `kiln-<date>-<time>-<seed>.png`."""

from __future__ import annotations

import datetime
import json
import re
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from . import durable


def slugify(name: str) -> str:
    s = re.sub(r"[^\w]+", "-", name.lower(), flags=re.UNICODE).strip("-")
    return s[:60] or "kiln"


def next_filename(
    name: str, seed: Any, *, out_dir: Path, job_files: Iterable[str], names_file: Path, take: bool = False
) -> str:
    """Next free file name of a series. Numbers only go up: a gap left by a deleted image stays a gap (reusing it made
    the queue's old entry and the new image share a name). Counts the files on disk, the files the queue knows, and
    `names_file` (series -> the highest number ever used); `take` records the number as used."""
    if name.strip():
        slug = slugify(name)
        pat = re.compile(rf"{re.escape(slug)}-(\d+)\.png")
        nums = [int(m.group(1)) for p in out_dir.glob(f"{slug}-*.png") if (m := pat.fullmatch(p.name))]
        nums += [int(m.group(1)) for f in job_files if (m := pat.fullmatch(f))]
        try:
            used = json.loads(names_file.read_text(encoding="utf-8")) if names_file.exists() else {}
        except (OSError, ValueError):
            used = {}
        n = max([*nums, used.get(slug, 0)], default=0) + 1
        if take:
            used[slug] = n
            durable.write_text(names_file, json.dumps(used))
        return f"{slug}-{n:03d}.png"
    return f"kiln-{datetime.datetime.now():%Y%m%d-%H%M%S}-{seed}.png"
