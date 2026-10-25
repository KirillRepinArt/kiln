// v0.7 step 4d: the page's plain scripts → native ES modules.
// For each file (in index.html's order): which of its top-level names other files use (→ export), which names it uses
// from other files (→ import { … } from "./x.js"). Names that only exist as window.X (run-time hooks) are written as
// window.X where they're used. Computed with ESLint's scope analysis, so nothing is guessed.
//   node tools/dev/to-modules.mjs            (rewrites app/*.js; prints a summary)
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const espree = require("espree");
const eslintScope = require("eslint-scope");

const html = readFileSync("index.html", "utf8");
const files = [...html.matchAll(/<script src="(app\/[^"]+)" data-bundle="\w+"><\/script>/g)].map(m => m[1]);
const OPTS = { ecmaVersion: "latest", sourceType: "script", range: true };

// 1 · what each file declares at its top level, and what it leaves unresolved (= uses from elsewhere)
const info = {};
const owner = {};
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const ast = espree.parse(src, OPTS);
  const scopes = eslintScope.analyze(ast, { ecmaVersion: 2024, sourceType: "script" });
  const g = scopes.globalScope;
  const decl = new Map(); // name → top-level statement
  for (const st of ast.body) {
    if (st.type === "FunctionDeclaration" || st.type === "ClassDeclaration") decl.set(st.id.name, st);
    if (st.type === "VariableDeclaration")
      for (const v of g.variables) if (v.defs.some(d => d.parent === st)) decl.set(v.name, st);
  }
  for (const n of decl.keys()) {
    if (owner[n]) throw new Error(`${n} declared in ${owner[n]} and ${f}`);
    owner[n] = f;
  }
  // references to top-level names of other files: in sloppy scripts they resolve to nothing (global "through")
  const refs = [...g.through, ...g.variables.flatMap(v => (decl.has(v.name) ? [] : v.references))];
  info[f] = { src, ast, decl, refs };
}

// window.X = … anywhere in the app: run-time hooks, used elsewhere by bare name
const hooks = new Set();
for (const f of files) for (const m of info[f].src.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) hooks.add(m[1]);

// 2 · imports / exports, plus bare uses of window hooks to make explicit
const exportsOf = Object.fromEntries(files.map(f => [f, new Set()]));
const importsOf = Object.fromEntries(files.map(f => [f, new Map()]));
const toWindow = Object.fromEntries(files.map(f => [f, []]));
for (const f of files) {
  for (const r of info[f].refs) {
    const n = r.identifier.name,
      o = owner[n];
    if (o && o !== f) {
      exportsOf[o].add(n);
      if (!importsOf[f].has(o)) importsOf[f].set(o, new Set());
      importsOf[f].get(o).add(n);
    } else if (!o && hooks.has(n)) toWindow[f].push(r.identifier);
  }
}
// names the test bridge (app/testing.js) reads: exported too
const bridge = JSON.parse(readFileSync(new URL("./bridge-names.json", import.meta.url), "utf8"));
for (const n of bridge) if (owner[n]) exportsOf[owner[n]].add(n);

// 3 · rewrite each file: `export` before exported top-level declarations, window.X for hooks, imports on top
let summary = [];
for (const f of files) {
  const { src, decl } = info[f];
  const edits = []; // [start, end, text]
  const done = new Set();
  for (const n of exportsOf[f]) {
    const st = decl.get(n);
    if (done.has(st)) continue;
    done.add(st);
    edits.push([st.range[0], st.range[0], "export "]);
  }
  for (const id of toWindow[f]) edits.push([id.range[0], id.range[0], "window."]);
  edits.sort((a, b) => b[0] - a[0]);
  let out = src;
  for (const [s, e, t] of edits) out = out.slice(0, s) + t + out.slice(e);
  out = out.replace(/^var justDone = null;$/m, "let justDone = null;");
  const imp = [...importsOf[f]]
    .sort((a, b) => files.indexOf(a[0]) - files.indexOf(b[0]))
    .map(([o, ns]) => `import { ${[...ns].sort().join(", ")} } from "./${o.slice(4)}";`)
    .join("\n");
  // imports go right after the file's header comment
  const m = out.match(/^\/\*[\s\S]*?\*\/\n/);
  const at = m ? m[0].length : 0;
  if (imp) out = out.slice(0, at) + imp + "\n\n" + out.slice(at);
  writeFileSync(f, out);
  summary.push(
    `${f.slice(4).padEnd(14)} imports ${[...importsOf[f].values()].reduce((a, s) => a + s.size, 0)} names from ${importsOf[f].size} files, exports ${exportsOf[f].size}${toWindow[f].length ? `, ${toWindow[f].length} hook uses → window.X` : ""}`,
  );
}
console.log(summary.join("\n"));
console.log(`window hooks: ${[...hooks].sort().join(" ")}`);
