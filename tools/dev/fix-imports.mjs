// Recompute every app module's imports and exports from what its code uses ("organize imports" for the whole app).
// For each app/*.js: the app imports at its top are rebuilt — one line per file it uses names from — and a top-level
// declaration another file uses gets `export`. Names used but defined nowhere (and not browser built-ins) are listed.
// Run it after moving code between files.        node tools/dev/fix-imports.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const espree = require("espree");
const eslintScope = require("eslint-scope");
const globals = require("globals");
const BROWSER = new Set([...Object.keys(globals.browser), ...Object.keys(globals.builtin)]);

const files = readdirSync("app")
  .filter(f => f.endsWith(".js"))
  .map(f => "app/" + f);
const OPTS = { ecmaVersion: "latest", sourceType: "module", range: true };

/** the file without its app imports (import { … } from "./x.js") — removed as text, before parsing, so a stale import
    (say of a name now declared in this file) can't stop the tool */
const withoutAppImports = src => src.replace(/^import \{[^}]*\} from "\.\/[^"]+";\n+/gm, "");

const info = {},
  owner = {};
for (const f of files) {
  const src = withoutAppImports(readFileSync(f, "utf8"));
  const ast = espree.parse(src, OPTS);
  const mod = eslintScope.analyze(ast, { ecmaVersion: 2024, sourceType: "module" }).globalScope.childScopes[0];
  const decl = new Map(); // name → top-level statement (the export wrapper if there is one)
  for (const st of ast.body) {
    const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (!d) continue;
    if (d.type === "FunctionDeclaration" || d.type === "ClassDeclaration") decl.set(d.id.name, st);
    if (d.type === "VariableDeclaration")
      for (const v of mod.variables) if (v.defs.some(x => x.parent === d)) decl.set(v.name, st);
  }
  for (const n of decl.keys()) {
    if (owner[n]) throw new Error(`${n} is declared in both ${owner[n]} and ${f}`);
    owner[n] = f;
  }
  info[f] = { src, ast, decl, through: mod.through };
}

let problems = 0;
const needs = Object.fromEntries(files.map(f => [f, new Set()])); // names other files use from f
const imports = Object.fromEntries(files.map(f => [f, new Map()]));
for (const f of files) {
  for (const r of info[f].through) {
    const n = r.identifier.name,
      o = owner[n];
    if (o && o !== f) {
      needs[o].add(n);
      if (!imports[f].has(o)) imports[f].set(o, new Set());
      imports[f].get(o).add(n);
    } else if (!o && !BROWSER.has(n)) {
      console.log(`  ${f}: "${n}" is used but defined nowhere`);
      problems++;
    }
  }
}
// the test bridge may need names no other file uses
const bridge = JSON.parse(readFileSync("tools/dev/bridge-names.json", "utf8"));
for (const n of bridge) if (owner[n]) needs[owner[n]].add(n);

for (const f of files) {
  const { src, decl } = info[f];
  let out = src;
  const starts = [...new Set([...needs[f]].map(n => decl.get(n)))]
    .filter(st => st.type !== "ExportNamedDeclaration")
    .map(st => st.range[0])
    .sort((a, b) => b - a);
  for (const at of starts) out = out.slice(0, at) + "export " + out.slice(at);
  const lines = [...imports[f]]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([o, ns]) => `import { ${[...ns].sort().join(", ")} } from "./${o.slice(4)}";`);
  if (lines.length) {
    const m = out.match(/^(\/\/ @ts-check\n)?(\/\*[\s\S]*?\*\/\n)?/);
    const at = m ? m[0].length : 0;
    out = out.slice(0, at) + lines.join("\n") + "\n\n" + out.slice(at).replace(/^\n+/, "");
  }
  if (out !== readFileSync(f, "utf8")) {
    writeFileSync(f, out);
    console.log(`fixed ${f}`);
  }
}
if (problems) {
  console.log(`${problems} name(s) defined nowhere`);
  process.exit(1);
}
