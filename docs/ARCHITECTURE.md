# How Kiln is built

Kiln is two programs on your own computer: a small **server** (Python, standard library only) that keeps the queue
and talks to the image generator, and a **page** (plain HTML, CSS and JavaScript modules, no build step) that you
see in a browser window. They talk over HTTP on `127.0.0.1`. Nothing else is involved: no database server, no
framework, no internet.

```
  kiln.bat ──► python -m server --launch ──► finds or starts ──►  server  (python -m server)
                                                                    │  queue · worker · pictures
  browser window  ◄── index.html + app/ ◄───── HTTP on 127.0.0.1 ───┤  /api/…  (JSON)
     (the page)   ──── polls /api/state ───────────────────────────►│
                                                                    └──► Forge Neo's API (/sdapi/v1/…)
```

Why it's built this way is in `docs/decisions/`. How to change the look is in `docs/CUSTOMIZING.md`.

## The server (`server/`)

`server/__init__.py` lists every module. From the bottom up:

| Module | Job |
|---|---|
| `config` | settings (`config.local.json` over the defaults, `KILN_*` environment variables over both) and `Paths`: the program's files apart from your data |
| `images`, `naming`, `timings` | pure helpers: PNG text chunks, file names (numbers never reused), time estimates from your own runs |
| `jobqueue` | the job list: one lock, saved to `data/queue.json` on every change, a revision the page polls against |
| `pictures`, `recyclebin` | finished pictures on disk: delete with Undo (then the Recycle Bin), rename, put back, thumbnails |
| `backends/` | the image generator behind one interface (`base.py`: `Backend`); `forge.py` is the only file that knows Forge's API |
| `catalog` | what the generator offers (checkpoints, LoRAs, upscalers), with Kiln's own additions, cached |
| `worker` | one job at a time: take the next, have the backend render it, save the picture |
| `lifecycle` | is a Kiln window still open? stop when it closed and the queue is done |
| `instance` | one Kiln per data folder (an OS lock), a port of its own (`data/instance.json`), `/api/hello` |
| `page`, `web` | the page as served, and the HTTP API: a table of routes, one method each |
| `main`, `launch` | putting it together; the launcher behind `kiln.bat` |

Threads: the HTTP server (one thread per request), the worker, the generator's health check, the window watchdog.
They share the job list through `JobQueue.lock`.

**Your data** (`data/`, git-ignored): `queue.json` (the jobs), `history.json` + `stats.json` (time estimates),
`names.json` + `ids.json` (numbers never handed out twice), `flags.json` (paused), `trash/` (the Undo window),
`thumbs/` (LoRA pictures), `qthumbs/` (the Queue's small pictures), `kiln.log` (rotated), `kiln.lock` +
`instance.json` (the running server). The pictures themselves go to `outputs/`, each with its settings inside.

## The API

The page polls `GET /api/state`. With `?since=<signature>` the answer is light when nothing changed but the running
job's progress (500 jobs were ~1 MB a poll before). Changes are `POST`s: `/api/jobs` (add), `/api/jobs/<id>/cancel |
remove | delete | undelete | name | rename | recycled | restore | saveback`, `/api/reorder`, `/api/pause`,
`/api/upscale`, `/api/clear`, `/api/remove-missing`, `/api/open`, `/api/reveal`, `/api/thumb`, `/api/qthumb`,
`/api/estimate`, `/api/update-check`, `/api/bye`. Also `GET /api/models`, `/api/nextname`, `/api/preview/<id>`,
`/api/hello`, and the files: `/files/` (pictures, never cached), `/app/`, `/docs/`, `/thumbs/`, `/qthumbs/`. Every answer is
JSON; an error is `{"error": "…"}` with its HTTP status.

## The page (`index.html`, `app/`)

Plain ES modules, loaded by the browser as they are. `app/main.js` starts everything, in a fixed order; every other
file only declares (each has an `init<File>()` that `main.js` calls). The parts:

- **Models: one place for each kind of state, changed only through it.** `jobs.js` (the job list), `prompt.js` (your
  draft and the job shown instead), `picstate.js` (what the picture area shows, a state machine:
  `ux-review/11-picture-states.md`), `layout.js` + `layoutmath.js` (the layout: pure maths, unit-tested),
  `cardlayout.js` (the prompt card). The rest of the page reads them and draws.
- **The screen, by area:** `tabs`, `browse`, `morph`, `edges`, `pills`, `chips`, `peek`, `queue`, `loras`, `pnginfo`,
  `viewer`, `settings`, `keys`, `tooltips`, `editor` (CodeMirror).
- **The server's side:** `live.js` (start), `sync.js` (polling, what changed), `actions.js` (requests), `pictures.js`
  (images, previews, the cache), `progress.js`, `forge.js`.
- **The look:** `app/styles/` (tokens, then one file per part of the screen, then the skins), `effects.js` + `skins.js`
  (the backgrounds and covers: canvas, cheap on a GPU that's busy generating), `tokens.js` (the values the scripts read
  from the CSS), `livestyles.js` (style changes taken without a reload).
- **Shared:** `dom.js` (typed element helpers), `state.js` (settings, saved in the browser), `presets.js`, `types.js`
  (the data shapes, for the type checker), `testing.js` (the tests' handle, only with `?test`).

Types: JSDoc in the files, checked by TypeScript (`tsc`, a dev tool) file by file as they're marked `// @ts-check`.

## Tests and checks

| | What | Where |
|---|---|---|
| unit, page | the pure logic (layout maths, the job list) | `tools/tests/unit/*.test.mjs`, `npm run test:unit` |
| unit, server | the server's logic, the instance lock, the network-call list | `tools/tests/unit/test_server.py`, `npm run test:server` |
| end to end | the real app: a fake Forge (`tools/fake_forge.py`), the server, a headless Edge, per test | `tools/tests/*.test.mjs`, `node tools/tests/run.mjs` |
| proofs | a refactor changes nothing: computed styles (`cssdiff`), API answers (`tools/dev/api-same.py`), syntax trees (`tools/dev/ast-same.mjs`) | run by hand when one applies |
| static | ESLint, Stylelint (incl. the token rule), Prettier, Ruff, mypy `--strict`, `tsc`, the privacy scan | the commit hook and CI |

CI (`.github/workflows/ci.yml`): the static checks and unit tests on Linux, the end-to-end tests on Windows.
