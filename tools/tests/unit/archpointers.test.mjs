// A comment that states a rule ARCHITECTURE holds points there — `ARCHITECTURE › <entry>` (the comment rule, DEVLOG
// DD-2026-11-11-7). A pointer to an entry that was renamed or removed is a stale comment no one would notice: every
// pointer in app/ must name an entry of docs/ARCHITECTURE.md (a list item that starts with that name, bold or not).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..", ".."),
  APP = join(ROOT, "app");

/** every file under app/ that holds code (JS and CSS; not the vendored libraries) @param {string} dir */
const files = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory()
      ? d.name === "vendor" || d.name === "fonts"
        ? []
        : files(join(dir, d.name))
      : /\.(js|css)$/.test(d.name)
        ? [join(dir, d.name)]
        : [],
  );

/** the entry's name: up to the first bracket (either), colon, dash, semicolon, full stop, comment end or tag */
const nameOf = (/** @type {string} */ s) =>
  s
    .replace(/\s+/g, " ")
    .split(/ \(|\)| ?:| —| -|;|\.(?:\s|$)|\*\/|\*|@|"/)[0]
    .trim();

test("every ARCHITECTURE › pointer names an entry that exists", () => {
  /* the entries: each list item's lead, bold markers dropped */
  const entries = readFileSync(join(ROOT, "docs", "ARCHITECTURE.md"), "utf8")
      .split("\n")
      .filter(l => /^\s*- /.test(l))
      .map(l => l.replace(/^\s*- /, "").replace(/\*\*/g, "")),
    bad = [];
  for (const f of files(APP)) {
    const src = readFileSync(f, "utf8").replace(/\s*\n\s*(\*(?!\/)\s*)?/g, " "); // a pointer may wrap a comment line
    for (const m of src.matchAll(/ARCHITECTURE › ([^\n]{3,90})/g)) {
      const name = nameOf(m[1]);
      if (!entries.some(e => e.startsWith(name))) bad.push(`${f.slice(APP.length + 1)}: "${name}"`);
    }
  }
  assert.deepEqual(bad, [], "a pointer to an ARCHITECTURE entry that doesn't exist (renamed? removed?)");
});
