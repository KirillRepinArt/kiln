# 0006 · The page polls (with a light answer) until server push

**Context.** The page has to see progress, finished jobs and changes made elsewhere. Server push (Server-Sent Events
or WebSockets) is the standard; polling is the simple first version.

**Decision.** For now the page polls `/api/state` every 0.7 s while a job runs (1.8 s otherwise). With `?since=` and
the signature of what it has, an unchanged list costs a light answer (only the running job): 500 jobs were ~1 MB a
poll before, 0.8 KB now.

**Consequences.** Simple and robust (a missed answer is just the next poll). Up to a poll's delay before something
shows. **To be replaced in v0.7b** by server push (SSE), with one store in the page.
