# 0001 · The page is plain ES modules: no bundler, no build step

**Context.** Most web apps are written in modules and turned into a bundle by a build tool (Vite, webpack, esbuild).
Kiln runs from a local server on one machine, and its owner reads and edits CSS (and Python) directly, expecting a
saved change to show.

**Decision.** The browser loads `app/*.js` as native ES modules and `app/styles/*.css` as plain stylesheets, exactly
as they are in the repository. The server lists every module with `<link rel="modulepreload">` so they load in
parallel, not one import layer at a time.

**Consequences.** What runs is what's in the repo: no source maps, no stale build, nothing to install to *use* Kiln.
Live style reload is simple (swap a stylesheet). The costs: no tree-shaking or minifying (irrelevant on localhost:
start-up is ~0.6 s), and every module is a separate request (fine on 127.0.0.1). The one bundled piece is the prompt
editor (CodeMirror, `app/vendor/codemirror.js`), built once and committed. A deviation from the common setup, on
purpose.
