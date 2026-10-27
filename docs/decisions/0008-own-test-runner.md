# 0008 · Our own end-to-end runner over the DevTools protocol

**Status: accepted (2026-10-27, at the v0.7 gate).**

**Context.** Playwright is the usual tool for end-to-end tests. Kiln's tests grew first as a small runner of its own
(`tools/tests/run.mjs`): a fake Forge, the server and a headless Edge per test, driven over the Chrome DevTools
Protocol, in real time. It records every request (with what started it), the page's errors and the server's log; each
test runs in its own folders and ports; tests wait for events, never a fixed delay (every flaky test so far was one).

**What was tried.** (2026-10-25/26.) Playwright on one ported test, with the agreement: new tests in Playwright, old
ones moved when touched, never two systems for long. The tests added after that were written for the runner instead:
they need what it does that Playwright makes awkward (request initiators, the page's test handle `window.kiln`,
forced pseudo-states for `cssdiff`, real-time motion sampling). Playwright can reach all of these through its
DevTools sessions, but with more code for each.

**Decision.** The runner is the one system. The Playwright trial is removed. A deviation from the common tool, kept
because it pays for itself: moving 110+ tests would take days and buy mainly Playwright's debugging tools (the trace
viewer, recorded steps).

**Consequences.** One test system, already doing what Kiln's tests need. The runner is ours to maintain: if that
starts costing real time (a browser change breaking it, missing debugging), this gets a new record.
