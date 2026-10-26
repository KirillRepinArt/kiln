"""The page: index.html, made ready to serve."""

from __future__ import annotations

from pathlib import Path


def build_page(root: Path) -> bytes:
    """index.html as served. The styles are plain files in app/styles/, linked in order. The scripts are ES modules:
    the page loads app/main.js, which imports the rest from /app/. The "server isn't running" note is shown by the HTML
    itself (for index.html opened as a file, where modules can't load) and hidden here, since the server is obviously
    running."""
    page = (root / "index.html").read_text(encoding="utf-8")
    app = root / "app"
    page = page.replace('class="modal offline show"', 'class="modal offline"', 1)
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
