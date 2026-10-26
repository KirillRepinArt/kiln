// Proof that formatting changed nothing: each JS file's syntax tree at a git revision vs the working copy.
// Positions, raw spellings of literals ('x' vs "x", .6 vs 0.6) and comments are ignored; everything else must match.
//   node tools/dev/ast-same.mjs . HEAD app/stage.js ...
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

// --helpers: the dom.js helpers are pure casts — target(e) is e.target, targetField(e) is e.target, hit(e, s) is
// e.target.closest(s) — so a file that switched to them (typing it) compares as the code it was; their imports aside
const args = process.argv.slice(2);
const HELPERS = args.includes("--helpers");
const [repo, rev, ...files] = args.filter(a => a !== "--helpers");
const id = name => ({ type: "Identifier", name });
const member = (object, name) => ({
  type: "MemberExpression",
  object,
  property: id(name),
  computed: false,
  optional: false,
});
function helpers(n) {
  if (Array.isArray(n)) return n.map(helpers);
  if (!n || typeof n !== "object") return n;
  const o = Object.fromEntries(Object.entries(n).map(([k, v]) => [k, helpers(v)]));
  if (o.type === "CallExpression" && o.callee?.type === "Identifier") {
    const [a, b] = o.arguments;
    if (["target", "targetField"].includes(o.callee.name) && o.arguments.length === 1) return member(a, "target");
    if (o.callee.name === "hit" && o.arguments.length === 2)
      return {
        type: "CallExpression",
        callee: member(member(a, "target"), "closest"),
        arguments: [b],
        optional: false,
      };
  }
  if (o.type === "Program")
    o.body = o.body.filter(s => !(s.type === "ImportDeclaration" && s.source.value === "./dom.js"));
  return o;
}
const require = createRequire(resolve(repo, "package.json")); // an absolute path: Node 24 refuses a relative one
const espree = require("espree");
const SKIP = new Set(["start", "end", "loc", "range", "raw"]);
const strip = n =>
  Array.isArray(n)
    ? n.map(strip)
    : n && typeof n === "object"
      ? Object.fromEntries(
          Object.keys(n)
            .filter(k => !SKIP.has(k))
            .sort()
            .map(k => [k, strip(n[k])]),
        )
      : n;
const parse = src => {
  for (const sourceType of ["script", "module"]) {
    try {
      const tree = espree.parse(src, { ecmaVersion: "latest", sourceType });
      return strip(HELPERS ? helpers(tree) : tree);
    } catch (e) {
      if (sourceType === "module") throw e;
    }
  }
};

const J = o => JSON.stringify(o, (k, v) => (typeof v === "bigint" ? v.toString() + "n" : v));
let bad = 0;
for (const f of files) {
  const before = execFileSync("git", ["show", `${rev}:${f}`], { cwd: repo, encoding: "utf8" });
  const after = readFileSync(join(repo, f), "utf8");
  const same = J(parse(before)) === J(parse(after));
  if (!same) bad++;
  console.log(
    `${same ? "same" : "DIFFERENT"}  ${f}  (${before.split("\n").length} → ${after.split("\n").length} lines)`,
  );
}
console.log(bad ? `\n${bad} file(s) differ` : `\nall ${files.length} files: identical syntax trees`);
process.exit(bad ? 1 : 0);
