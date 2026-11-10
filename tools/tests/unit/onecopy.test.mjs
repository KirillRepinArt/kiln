// The one way to make a leaving copy (R2, the re-read 2026-11-10 — DEVLOG DD-2026-11-10-11): leave.js leaveCopy. A deep
// clone made anywhere else is a second way — the box's stand-in and the status row's copy were made by hand, and one
// lingered after it had left while the other was cut by a second switch. (A shallow clone — a <link> reloaded by
// livestyles.js — is no copy of what's seen.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const APP = join(import.meta.dirname, "..", "..", "..", "app");

test("every leaving copy is made by leave.js", () => {
  const found = [];
  for (const f of readdirSync(APP).filter(f => f.endsWith(".js") && f !== "leave.js")) {
    const src = readFileSync(join(APP, f), "utf8");
    for (const m of src.matchAll(/\.cloneNode\(\s*true\s*\)|\.innerHTML\s*=\s*[\w$.]+\.innerHTML/g))
      found.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(found, [], "a copy outside leave.js — use leaveCopy(parts)");
});
