# 0003 · Types: JSDoc + `tsc` for the page, mypy `--strict` for the server

**Context.** Types catch whole classes of mistakes (a value that can be missing, a wrong shape) before the app runs.
TypeScript is the usual way for the page, but it needs a compile step (see 0001).

**Decision.** The page stays JavaScript; types are written as JSDoc comments and checked by TypeScript (`tsc`, a dev
tool only), file by file as each is marked `// @ts-check`. Shared shapes live in `app/types.js`. The server is typed
Python, checked by mypy in strict mode (for Windows, Kiln's platform). Both run in the commit hook and CI.

**Consequences.** The same safety as TypeScript where a file is checked, with no build. Typing found real leftovers
each time (always-true checks, dead paths). Not every page file is checked yet; the rest are adopted as they're
touched.
