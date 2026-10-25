# Working on Kiln

Kiln runs from plain files: `server.py` (Python 3.10+, standard library) and the page in `index.html` + `app/`.
Nothing here is needed to *use* Kiln — this is the setup for changing it.

## One-time setup
```
npm install                                   # ESLint, Stylelint, Prettier (dev only, into node_modules/)
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt   # Ruff (Python linter), into .venv/
git config core.hooksPath .githooks           # the checks below run before every commit
```

## Before every commit (automatic, via `.githooks/`)
- **Privacy scan** (`tools/privacy_scan.py`): the repo is public, so personal paths, e-mail addresses, pictures with a
  prompt inside, and your own private words never go in. Private words: one regular expression per line in
  `.git/info/private-patterns` (inside `.git/`, so it's never committed). The commit message is scanned too.
- **Linters and formatting** on the files you're committing: ESLint (JavaScript), Stylelint (CSS), Ruff (Python),
  Prettier and `ruff format` (layout). `npm run format` / `.venv\Scripts\ruff format` fix the layout for you.

## Tests
```
npm test                       # all end-to-end tests, several at a time (fake Forge + Kiln + headless Edge each)
node tools/tests/run.mjs cover # only files whose name contains "cover"
node tools/tests/run.mjs -j 1  # one at a time
```
Every new behaviour gets a test in `tools/tests/`. CI (`.github/workflows/ci.yml`) runs the linters, the privacy scan
and the tests on every push.

## By hand
`npm run lint` · `.venv\Scripts\ruff check` · `npm run privacy` (scans every tracked file).
