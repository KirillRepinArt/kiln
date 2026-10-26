"""Kiln's own Edge profile (kiln.bat opens Kiln in it): spell-check languages for the prompt editor."""

from __future__ import annotations

import json
from collections.abc import Sequence
from pathlib import Path


def seed_spellcheck(profile: str, langs: Sequence[str]) -> None:
    """Add Kiln's spell-check languages to its Edge profile (kiln.bat runs this before opening Edge)."""
    pref = Path(profile) / "Default" / "Preferences"
    try:
        p = json.loads(pref.read_text(encoding="utf-8")) if pref.exists() else {}
    except (OSError, ValueError):
        return
    sc = p.setdefault("spellcheck", {})
    have = sc.get("dictionaries") or []
    want = have + [lang for lang in langs if lang not in have]
    intl = p.setdefault("intl", {})
    acc = [a for a in (intl.get("accept_languages") or "en-US,en").split(",") if a]
    acc_want = acc + [lang for lang in langs if lang not in acc]
    if want == have and acc_want == acc and p.get("browser", {}).get("enable_spellchecking", True):
        return
    sc["dictionaries"] = want
    intl["accept_languages"] = ",".join(acc_want)
    p.setdefault("browser", {})["enable_spellchecking"] = True
    pref.parent.mkdir(parents=True, exist_ok=True)
    pref.write_text(json.dumps(p), encoding="utf-8")
