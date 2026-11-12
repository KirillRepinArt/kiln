// The layout measures what's LAID OUT, never what's SEEN (ARCHITECTURE › layout inputs; DEVLOG DD-2026-11-12-17, -20):
// in the files that feed the layout pass every box is read through dom.js layoutRect — getBoundingClientRect is the box
// as seen through a glue, a ride or a carry (a name row read through the carried box's scale made Vertical's picture
// rubber-band after a drop). A read that wants what's on screen says so on its line: `as seen: <why>`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP = join(import.meta.dirname, "..", "..", "..", "app");
/** the files whose measurements are the layout pass's inputs */
const LAYOUT = ["layout.js", "cardlayout.js", "framebox.js"];

test("the layout's files measure through layoutRect; an as-seen read says why", () => {
  const bad = [];
  for (const f of LAYOUT)
    readFileSync(join(APP, f), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (line.includes("getBoundingClientRect") && !/as seen: \S/.test(line))
          bad.push(`${f}:${i + 1}: ${line.trim()}`);
      });
  assert.deepEqual(bad, [], "a layout input read as seen (use layoutRect, or mark the line `as seen: <why>`)");
});

test("the as-seen reads are the named ones (a new one is a decision, not a habit)", () => {
  const seen = LAYOUT.flatMap(f =>
    readFileSync(join(APP, f), "utf8")
      .split("\n")
      .filter(l => l.includes("getBoundingClientRect"))
      .map(l => `${f}: ${(/as seen: ([^*]+)/.exec(l) || [])[1]?.trim()}`),
  );
  assert.deepEqual(seen.sort(), [
    "cardlayout.js: the box under your hand",
    "cardlayout.js: the map is drawn over what you see",
    "layout.js: a leaving copy starts where its original is on screen",
    "layout.js: the box rides the plate where it is this frame",
  ]);
});
