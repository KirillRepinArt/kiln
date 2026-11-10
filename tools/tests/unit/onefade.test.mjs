// The one way to fade (R1, the re-read 2026-11-10 — DEVLOG DD-2026-11-10-11): every opacity fade in the app goes
// through fade.js fade(), which starts from what is on screen. A fade started anywhere else — el.animate with opacity
// keyframes, or glassFade called directly — is a second way, and the rule stops holding there (F4 was fixed in one of
// five fade-starters; F5 was the same bug in another). This keeps it the one way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const APP = join(import.meta.dirname, "..", "..", "..", "app");

test("every opacity fade goes through fade.js fade()", () => {
  const found = [];
  for (const f of readdirSync(APP).filter(f => f.endsWith(".js") && f !== "fade.js" && f !== "testing.js")) {
    const src = readFileSync(join(APP, f), "utf8");
    /* an animation whose keyframes name opacity (one call, up to its first closing bracket of the keyframe list) */
    for (const m of src.matchAll(/\.animate\(\s*\[([^\]]*)\]/g))
      if (/opacity/.test(m[1])) found.push(`${f}: ${m[0].slice(0, 60).replace(/\s+/g, " ")}`);
    for (const m of src.matchAll(/\bglassFade\(/g)) found.push(`${f}: glassFade( at ${m.index}`);
  }
  assert.deepEqual(found, [], "fade outside fade.js — use fade(el, to, timing, { from, span, glass, pseudo })");
});
