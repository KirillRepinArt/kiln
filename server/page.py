"""The page: index.html, made ready to serve."""

from __future__ import annotations

import time
from pathlib import Path


def build_page(root: Path) -> bytes:
    """index.html as served. The styles are plain files in app/styles/, linked in order. The scripts are ES modules:
    the page loads app/main.js, which imports the rest from /app/. The "server isn't running" note is shown by the HTML
    itself (for index.html opened as a file, where modules can't load) and hidden here, since the server is obviously
    running."""
    page = (root / "index.html").read_text(encoding="utf-8")
    app = root / "app"
    page = page.replace('class="modal offline show"', 'class="modal offline"', 1)
    if not (app / "fonts" / "satoshi" / "satoshi.css").is_file():
        page = without_satoshi(page)
    # every module listed up front, so the browser fetches them all at once instead of discovering the imports one
    # layer at a time (main.js → its imports → theirs …); types.js is for the checker only
    preload = "".join(
        f'    <link rel="modulepreload" href="app/{f.name}">\n'
        for f in sorted(app.glob("*.js"))
        if f.name != "types.js"
    )
    page = page.replace(
        '    <script type="module" src="app/main.js"></script>',
        preload + '    <script type="module" src="app/main.js"></script>',
        1,
    )
    return page.encode("utf-8")


SATOSHI_LINK = '    <link rel="stylesheet" href="app/fonts/satoshi/satoshi.css" />\n'
SATOSHI_OPTION = '<option value="Satoshi">Satoshi</option'
SATOSHI_MISSING = (
    '<option value="Satoshi" disabled title="Satoshi\'s licence keeps it out of Kiln\'s public download: add your own '
    'copy to app/fonts/satoshi/ (app/fonts/README.md says how)">Satoshi — not installed</option'
)


def without_satoshi(page: str) -> str:
    """Satoshi is optional (its licence keeps it out of the public repo; each install adds its own copy). Not there:
    no link to a stylesheet that isn't there (it was a 404 on every start), and the font menu says so."""
    return page.replace(SATOSHI_LINK, "", 1).replace(SATOSHI_OPTION, SATOSHI_MISSING, 1)


class _Seen:
    """The last fingerprint and when it was taken."""

    t = 0.0
    sig = ""


def styles_signature(root: Path, now: float | None = None) -> str:
    """A fingerprint of the style files (how many, and the newest save) — it changes the moment you save one, so the
    page swaps the styles in place (live style reload). Looked at no more than once a second."""
    now = time.monotonic() if now is None else now
    if now - _Seen.t >= 1 or not _Seen.sig:
        files = list((root / "app" / "styles").rglob("*.css"))
        newest = max((f.stat().st_mtime_ns for f in files), default=0)
        _Seen.t, _Seen.sig = now, f"{len(files)}.{newest}"
    return _Seen.sig
