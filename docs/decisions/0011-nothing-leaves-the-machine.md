# 0011 · Nothing leaves the machine, checked by tests

**Context.** Kiln is a private, local tool: prompts and pictures are personal. Resilience is part of the same promise:
Kiln must work offline and when outside services break.

**Decision.** Everything Kiln needs ships with it (fonts, the editor; 0005). The page talks only to its own server;
the server talks only to the configured image generator, and to GitHub only when you press Check for updates. No
prompt in notifications, no browser image cache, one privacy switch. Two tests hold it: `nothingleaves › pageTour`
(every request Kiln's page makes in a tour of the whole app stays on the machine) and the unit test `NetworkCalls`
(only three server files make requests at all).

**Consequences.** Software on the machine can still add its own: an antivirus that rewrites pages in transit
(Kaspersky injects a script, even on 127.0.0.1). The page test tells those apart (by where a request's call chain
starts) and names them in its report rather than counting them; they're not Kiln's to stop, but they're visible.
