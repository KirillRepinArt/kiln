# 0005 · No downloads at run time: a short, pinned, bundled dependency list

**Context.** Kiln started as "standard library only". That keeps it simple, but some jobs are better done by a proven
library (decoding pictures for thumbnails: Pillow). Fetching packages at run time would break the offline promise
(0011).

**Decision.** (Agreed 2026-10-25.) Run-time dependencies are a short list, each pinned to an exact version and shipped
with Kiln (an embeddable Python with its wheels, as ComfyUI's portable build does), never downloaded at run time. Today
the list is empty for the server; the page bundles CodeMirror (`app/vendor/`). Development tools (formatters, linters,
type checkers, test tools) are pinned too, and stay development-only (`package.json`, `requirements-dev.txt`).

**Consequences.** Works offline and the same on every machine; each addition is a deliberate choice with its licence
recorded in `THIRD-PARTY.md`.
