// Split one app module into others, following a plan — a pure move, checked.
//   node tools/dev/split-module.mjs plan.json
// The plan:
//   { "from": "app/composer.js",
//     "items": { "renderPills": "app/pills.js", ... },          top-level declarations → their new file
//     "heads": { "app/pills.js": "header comment for a new file" },
//     "init": { "fn": "initComposer", "groups": [                its start-up statements → new init functions
//         { "from": 210, "to": 298, "file": "app/pills.js", "name": "initPills", "what": "the pills: …" }, … ] },
//     "remove": true }                                         the source file goes once it's empty
// Each item moves with the comments above it, in its original order; a new file starts with its header, an existing one
// gets the items at its end. main.js calls the new init functions where the old one was, in the groups' order (the
// statements keep their order). Afterwards: tools/dev/fix-imports.mjs, then npm run format.
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const espree = require("espree");
const plan = JSON.parse(readFileSync(process.argv[2], "utf8"));
const OPTS = { ecmaVersion: "latest", sourceType: "module", range: true, loc: true };
const src = readFileSync(plan.from, "utf8");
const ast = espree.parse(src, OPTS);
const decl = s => (s.type === "ExportNamedDeclaration" ? s.declaration : s);
const nameOf = s => {
  const d = decl(s);
  if (!d) return null;
  if (d.type === "FunctionDeclaration" || d.type === "ClassDeclaration") return d.id.name;
  if (d.type === "VariableDeclaration") return d.declarations[0].id.name;
  return null;
};

const out = {}; // file → text to add
const add = (f, t) => (out[f] = (out[f] ?? (existsSync(f) ? "" : (plan.heads?.[f] ?? ""))) + t);
let rest = "",
  prevEnd = 0,
  initNode = null;
const moved = new Set();
for (const st of ast.body) {
  const chunk = src.slice(prevEnd, st.range[1]);
  const n = nameOf(st);
  if (n && plan.items[n]) {
    add(plan.items[n], chunk.replace(/^\n+/, "\n"));
    moved.add(n);
  } else if (plan.init && n === plan.init.fn) initNode = st;
  else rest += chunk;
  prevEnd = st.range[1];
}
rest += src.slice(prevEnd);
const missing = Object.keys(plan.items).filter(n => !moved.has(n));
if (missing.length) throw new Error("not found in " + plan.from + ": " + missing.join(" "));

// the start-up function's statements → the groups
const groupStmts = [];
if (plan.init) {
  if (!initNode) throw new Error(plan.init.fn + " not found");
  const body = decl(initNode).body;
  let pe = body.range[0] + 1;
  const bodies = plan.init.groups.map(() => "");
  for (const st of body.body) {
    const line = st.loc.start.line;
    const gi = plan.init.groups.findIndex(g => line >= g.from && line <= g.to);
    if (gi < 0) throw new Error(`statement at line ${line} is in no group`);
    bodies[gi] += src.slice(pe, st.range[1]).replace(/^\n+/, "\n");
    groupStmts.push([gi, st]);
    pe = st.range[1];
  }
  plan.init.groups.forEach((g, i) =>
    add(
      g.file,
      `\n/* start-up wiring: ${g.what} (called from main.js, in order) */\nexport function ${g.name}() {${bodies[i]}\n}\n`,
    ),
  );
  const main = readFileSync("app/main.js", "utf8");
  if (!main.includes(plan.init.fn + "();")) throw new Error("main.js doesn't call " + plan.init.fn);
  writeFileSync(
    "app/main.js",
    main.replace(plan.init.fn + "();", plan.init.groups.map(g => g.name + "();").join("\n")),
  );
}

// write: the source keeps what's left (or goes), the others get theirs
for (const [f, t] of Object.entries(out)) {
  const base = existsSync(f) && f !== plan.from ? readFileSync(f, "utf8").replace(/\s*$/, "\n") : "";
  writeFileSync(f, base + t.replace(/\s*$/, "\n"));
}
const left = espree.parse(rest, OPTS).body.filter(s => s.type !== "ImportDeclaration");
if (plan.remove) {
  if (left.length) throw new Error(`${plan.from} isn't empty: ${left.map(nameOf).join(" ")}`);
  unlinkSync(plan.from);
} else writeFileSync(plan.from, rest);

// check: every moved item and every start-up statement is where it should be, identical, in order
const SK = new Set(["start", "end", "loc", "range", "raw"]);
const strip = n =>
  Array.isArray(n)
    ? n.map(strip)
    : n && typeof n === "object"
      ? Object.fromEntries(
          Object.keys(n)
            .filter(k => !SK.has(k))
            .sort()
            .map(k => [k, strip(n[k])]),
        )
      : n;
const J = x => JSON.stringify(strip(x));
const now = f => espree.parse(readFileSync(f, "utf8"), OPTS).body.map(decl).filter(Boolean);
let bad = 0;
for (const st of ast.body) {
  const n = nameOf(st);
  if (!n || !plan.items[n]) continue;
  const got = now(plan.items[n]).find(d => (d.id?.name ?? d.declarations?.[0]?.id?.name) === n);
  if (!got || J(got) !== J(decl(st))) (bad++, console.log("differs:", n));
}
if (plan.init)
  plan.init.groups.forEach((g, gi) => {
    const fn = now(g.file).find(d => d.type === "FunctionDeclaration" && d.id.name === g.name);
    const want = groupStmts.filter(([i]) => i === gi).map(([, s]) => J(s));
    if (!fn || J(fn.body.body) !== "[" + want.join(",") + "]") (bad++, console.log("init differs:", g.name));
  });
console.log(
  bad
    ? `${bad} difference(s)`
    : `moved ${moved.size} items${plan.init ? `, ${groupStmts.length} start-up statements into ${plan.init.groups.length} functions` : ""}: identical, in order`,
);
process.exit(bad ? 1 : 0);
