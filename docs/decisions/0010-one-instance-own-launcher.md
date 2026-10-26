# 0010 · One Kiln per data folder; the launcher in Python

**Context.** Two servers on one data folder would both run the queue and overwrite `queue.json`. On Windows, Python's
built-in server sets "reuse address", which there means *share*: a second server bound the same port without an
error. The old `kiln.bat` took anything answering on port 7870 for Kiln.

**Decision.** The server claims its port exclusively on Windows (`SO_EXCLUSIVEADDRUSE`), holds an operating-system
lock on `data/kiln.lock` (released by the OS even after a crash, so never stale), takes the next free port if its own
is busy and writes it to `data/instance.json`; `/api/hello` says who answers. The launcher is Python
(`python -m server --launch`; `kiln.bat` only finds Python): it confirms a running Kiln with `/api/hello`, or starts
one, then opens a window in Edge, else Chrome or Chromium, else the default browser.

**Consequences.** Starting Kiln twice is safe; another program on the port can't be mistaken for it. The launcher's
choices are plain functions with unit tests (batch files can't be tested).
