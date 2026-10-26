# 0004 · The server: Python's standard library, a package with a backend interface

**Context.** A web framework (FastAPI, Flask) would be the common choice. Kiln's server has one user on one machine,
a handful of JSON routes and a queue; the image generator (Forge Neo today, ComfyUI next) must be replaceable.

**Decision.** Python's built-in `http.server` (threaded), in a package of small typed modules (`server/__init__.py`
lists them). The generator sits behind one interface (`server/backends/base.py`: detect, start, stop, health, models,
render, upscale, interrupt); `backends/forge.py` is the only file that knows Forge's API. Routes are a table, one
method each; an `ApiError` becomes `{"error": …}` with its status.

**Consequences.** Nothing to install for the server; easy to read. Server push (SSE) works on the built-in server too
(v0.7b). Adding ComfyUI is a second adapter, not a rewrite. Windows needed one fix the framework would have hidden: the
built-in server shared its port silently (see 0010).
