# 0002 · No UI framework: models + imperative drawing

**Context.** React, Vue or Svelte would be the usual choice for an app this size. But much of Kiln is motion and canvas:
glides measured against *targets* (never mid-animation geometry), canvas skins at ~30 fps on a GPU that's busy
generating, a picture morph on its own timeline. Frameworks re-render declaratively; this code has to control exactly
when and what moves.

**Decision.** No framework. Each kind of state has one model that is the only place it changes (`jobs.js`,
`prompt.js`, `picstate.js`, `layout.js` + the pure `layoutmath.js`, `cardlayout.js`); the screen reads the models and
draws. Pure rules live in pure modules with unit tests. A small store with subscriptions comes with v0.7b, when the
server pushes changes.

**Consequences.** Full control of timing and the GPU; nothing between the code and the browser. The discipline a
framework would enforce is kept by convention (a module variable is written only by its owner — the linter's
`no-import-assign` catches a write from elsewhere) and by the types. A deviation from the common setup, on purpose.
