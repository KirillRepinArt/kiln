// Proof that formatting changed nothing: each JS file's syntax tree at a git revision vs the working copy.
// Positions, raw spellings of literals ('x' vs "x", .6 vs 0.6) and comments are ignored; everything else must match.
//   node tools/dev/ast-same.mjs . HEAD app/stage.js ...
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const [repo, rev, ...files] = process.argv.slice(2);
const require = createRequire(join(repo, "package.json"));
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
      return strip(espree.parse(src, { ecmaVersion: "latest", sourceType }));
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
