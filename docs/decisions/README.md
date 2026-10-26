# Decisions

Why Kiln is built the way it is: one short record per decision (context, decision, consequences), the usual
"architecture decision record" form. Where Kiln goes against the common choice, the record says so and why. A decision
that changes later gets a new record; the old one says what replaced it.

| # | Decision | Status |
|---|---|---|
| [0001](0001-no-build-step.md) | The page is plain ES modules: no bundler, no build step | accepted |
| [0002](0002-no-framework.md) | No UI framework: models + imperative drawing | accepted |
| [0003](0003-types-as-a-checker.md) | Types: JSDoc + `tsc` for the page, mypy `--strict` for the server | accepted |
| [0004](0004-python-standard-library-server.md) | The server: Python's standard library, a package with a backend interface | accepted |
| [0005](0005-dependencies-pinned-and-bundled.md) | No downloads at run time: a short, pinned, bundled dependency list | accepted |
| [0006](0006-polling-before-push.md) | The page polls (with a light answer) until server push | accepted, to be replaced (v0.7b) |
| [0007](0007-json-files-before-a-database.md) | JSON files until one SQLite database | accepted, to be replaced (v0.7b) |
| [0008](0008-own-test-runner.md) | Our own end-to-end runner over the DevTools protocol | under review (the v0.7 gate) |
| [0009](0009-design-tokens.md) | Design tokens in CSS, enforced by the linter; skins as token files | accepted |
| [0010](0010-one-instance-own-launcher.md) | One Kiln per data folder; the launcher in Python | accepted |
| [0011](0011-nothing-leaves-the-machine.md) | Nothing leaves the machine, checked by tests | accepted |
