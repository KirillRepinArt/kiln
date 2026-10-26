# 0008 · Our own end-to-end runner over the DevTools protocol

**Status: under review — decide at the v0.7 gate.**

**Context.** Playwright is the usual tool for end-to-end tests. Kiln's tests grew first as a small runner of its own
(`tools/tests/run.mjs`): a fake Forge, the server and a headless Edge per test, driven over the Chrome DevTools
Protocol, in real time. It records every request (with what started it), the page's errors and the server's log; each
test runs in its own folders and ports; tests wait for events, never a fixed delay (every flaky test so far was one).

**Decision so far.** (2026-10-25/26.) Playwright was trialled on one test (`tools/tests/pw/`); the agreement: new tests
in Playwright, an old test moved when it's touched, never two systems for long.

**What happened.** The tests added since (live styles, nothing-leaves-the-machine) were written for the runner: they
need what it does that Playwright makes awkward (request initiators, the page's test handle `window.kiln`, forced
pseudo-states for `cssdiff`, real-time motion sampling). So today there are two systems: 110+ tests on the runner, one
on Playwright.

**To decide.** Either keep the runner as the one system (drop the Playwright trial; a deviation from the common tool,
kept because it pays for itself) or move everything to Playwright (its features cover most of this with more code).
Recommended: keep the runner, remove the trial — but it's a decision, not a drift.
