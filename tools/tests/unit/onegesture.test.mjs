// The one drag gesture (G1, ROADMAP v0.7c step 8 — DEVLOG DD-2026-11-10-12): every drag goes through gesture.js, which
// captures the pointer when a press becomes a drag and ends it once however it ends. A pointer capture anywhere else is
// a drag wired by hand — five were (the edges, the box's move, the Queue's reorder, the LoRA weight, the viewer's pan),
// each ending its own way. (Hover trackers — a pointermove without a capture — are no drag.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const APP = join(import.meta.dirname, "..", "..", "..", "app");

test("every drag is gesture.js's", () => {
  const found = [];
  for (const f of readdirSync(APP).filter(f => f.endsWith(".js") && f !== "gesture.js"))
    for (const m of readFileSync(join(APP, f), "utf8").matchAll(/\b(set|release)PointerCapture\(/g))
      found.push(`${f}: ${m[0]}`);
  assert.deepEqual(found, [], "a drag wired by hand — use gesture.js gesture(el, { accept, move, end, … })");
});
