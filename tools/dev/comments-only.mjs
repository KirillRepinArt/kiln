// Proves a change touched only comments and whitespace: the files' token streams (comments dropped) are identical.
//   node tools/dev/comments-only.mjs <git ref> <file.js|file.css>...   — each file at the ref vs the working copy
// Used by the comment trim (v0.7c step 8): a comments-only commit needs no test run, this is its proof. JS through
// ESLint's tokenizer; CSS with its comments stripped, split at whitespace and punctuation.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import * as espree from "espree";

const [ref, ...files] = process.argv.slice(2);
if (!ref || !files.length) {
  console.error("usage: node tools/dev/comments-only.mjs <git ref> <file.js|file.css>...");
  process.exit(2);
}
/** @param {string} src @param {string} f */
const toks = (src, f) =>
  f.endsWith(".css")
    ? src
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .split(/(\s+|[{}:;,()])/)
        .map(t => t.trim())
        .filter(Boolean)
    : espree.tokenize(src, { ecmaVersion: "latest", sourceType: "module" }).map(t => t.type + " " + t.value);
let bad = 0;
for (const f of files) {
  const old = execFileSync("git", ["show", `${ref}:${f}`], { encoding: "utf8", maxBuffer: 1 << 26 }),
    neu = readFileSync(f, "utf8"),
    [a, b] = [toks(old, f), toks(neu, f)],
    i = a.findIndex((t, j) => t !== b[j]);
  if (i < 0 && a.length === b.length)
    console.log(
      `same code  ${f}  (${old.length} → ${neu.length} bytes, ${Math.round((100 * (old.length - neu.length)) / old.length)}% smaller)`,
    );
  else {
    bad++;
    console.log(`CODE DIFFERS  ${f}  at token ${i < 0 ? Math.min(a.length, b.length) : i}: ${a[i]} ≠ ${b[i]}`);
  }
}
process.exit(bad ? 1 : 0);
