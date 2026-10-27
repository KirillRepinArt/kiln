"""Settings (config.local.json over the defaults, environment variables over both) and where things live.

The program's own files (ROOT: index.html, app/, docs/) are kept apart from your data (Paths: pictures, queue,
history) — the data folders can live anywhere, and tests point them at a temporary folder.
"""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent  # the program: index.html, app/, docs/, server/

DEFAULTS: dict[str, Any] = {
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

# environment overrides (handy for testing against tools/fake_forge.py)
ENV: tuple[tuple[str, str, type], ...] = (
    ("forge_url", "KILN_FORGE_URL", str),
    ("port", "KILN_PORT", int),
    ("output_dir", "KILN_OUTPUT_DIR", str),
    ("data_dir", "KILN_DATA_DIR", str),
    ("forge_start", "KILN_FORGE_START", str),
)


def load_config(root: Path = ROOT, environ: Mapping[str, str] = os.environ) -> dict[str, Any]:
    cfg = dict(DEFAULTS)
    p = root / "config.local.json"
    if p.exists():
        cfg.update(json.loads(p.read_text(encoding="utf-8")))
    for key, env, typ in ENV:
        if environ.get(env):
            cfg[key] = typ(environ[env])
    return cfg


CFG = load_config()  # one shared dict: tests change a value or two after import, before main()


@dataclass(frozen=True)
class Paths:
    """Every file and folder Kiln reads or writes."""

    root: Path  # the program
    out: Path  # your pictures
    data: Path  # everything else Kiln keeps

    @classmethod
    def from_config(cls, cfg: Mapping[str, Any], root: Path = ROOT) -> Paths:
        return cls(root, (root / cfg["output_dir"]).resolve(), (root / cfg["data_dir"]).resolve())

    @property
    def thumbs(self) -> Path:  # LoRA pictures
        return self.data / "thumbs"

    @property
    def qthumbs(self) -> Path:  # the queue's small pictures, one per job id (made by the page once, stored here)
        return self.data / "qthumbs"

    @property
    def trash(self) -> Path:  # deleted pictures during their undo window
        return self.data / "trash"

    @property
    def db_file(self) -> Path:  # everything below lives here since v0.7b (store.py); the JSON files are imported once
        return self.data / "kiln.db"

    @property
    def queue_file(self) -> Path:
        return self.data / "queue.json"

    @property
    def flags_file(self) -> Path:  # Pause queue
        return self.data / "flags.json"

    @property
    def stats_file(self) -> Path:
        return self.data / "stats.json"

    @property
    def history_file(self) -> Path:
        return self.data / "history.json"

    @property
    def names_file(self) -> Path:  # series -> the highest number ever used
        return self.data / "names.json"

    @property
    def ids_file(self) -> Path:  # the highest job id ever used
        return self.data / "ids.json"

    @property
    def log_file(self) -> Path:
        return self.data / "kiln.log"

    def make_dirs(self) -> None:
        for d in (self.out, self.data, self.thumbs, self.qthumbs):
            d.mkdir(parents=True, exist_ok=True)
