# Working on Kiln

Kiln runs from plain files: the server in `server/` (Python 3.10+, standard library; `python -m server`) and the
page in `index.html` + `app/`.
Nothing here is needed to *use* Kiln — this is the setup for changing it.

## One-time setup
```
npm install                                   # ESLint, Stylelint, Prettier (dev only, into node_modules/)
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt   # Ruff (linter) + mypy (types), into .venv/
git config core.hooksPath .githooks           # the checks below run before every commit
```

## Before every commit (automatic, via `.githooks/`)
- **Privacy scan** (`tools/privacy_scan.py`): the repo is public, so personal paths, e-mail addresses, pictures with a
  prompt inside, and your own private words never go in. Private words: one regular expression per line in
  `.git/info/private-patterns` (inside `.git/`, so it's never committed). The commit message is scanned too.
- **Linters and formatting** on the files you're committing: ESLint (JavaScript), Stylelint (CSS), Ruff (Python),
  Prettier and `ruff format` (layout). `npm run format` / `.venv\Scripts\ruff format` fix the layout for you.

## The look
Every colour, gap, corner, type size and timing is a named token in `app/styles/tokens.css`; each skin is a file in
`app/styles/themes/`. `docs/CUSTOMIZING.md` explains them, and how to add a skin. Saved style changes show in a running Kiln
without a reload.

## Types
The page is plain JavaScript; TypeScript only *checks* it (`npm run typecheck`, also in the hook and CI). Shapes shared
across files live in `app/types.js` as JSDoc; a file is checked once it starts with `// @ts-check` (adopted file by file).
The server is typed Python, checked by mypy in strict mode (`.venv\Scripts\python -m mypy`, also in the hook and CI).

## Tests
```
npm run test:unit              # unit tests of the page's pure logic (tools/tests/unit/*.mjs), in milliseconds
npm run test:server            # unit tests of the server (tools/tests/unit/test_*.py), well under a second
npm test                       # all end-to-end tests, several at a time (fake Forge + Kiln + headless Edge each)
node tools/tests/run.mjs cover # only files whose name contains "cover"
node tools/tests/run.mjs -j 1  # one at a time
```
Every new behaviour gets a test in `tools/tests/`. CI (`.github/workflows/ci.yml`) runs the linters, the privacy scan
and the tests on every push.

## The server
`server/__init__.py` lists its modules and what each one does. The image generator sits behind one interface
(`server/backends/base.py`); Forge Neo is `backends/forge.py`. A server refactor is proven with
`python tools/dev/api-same.py <old checkout> old.json`, then the same on the new code: both servers answer a fixed
script of API calls against the fake Forge, and the two recordings must match.

## By hand
`npm run lint` · `.venv\Scripts\ruff check` · `npm run privacy` (scans every tracked file).
