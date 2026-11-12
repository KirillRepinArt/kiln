// Timing is read, never copied (ARCHITECTURE › every design token's one source; v0.7d 6c): a motion's length or curve
// lives once, in app/tokens/base.tokens.json, and the scripts name its role — through tokens.js (ms, easing, bezier,
// layoutmath.js curve) or as var() in a style string. A literal here is a second copy that drifts.
// Named exceptions: the effects' recipes (effects.js, skins.js — their FX objects, 6c-3); timers (6c-2).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const APP = process.env.KILN_APP_DIR || join(import.meta.dirname, "..", "..", "..", "app");
const EXEMPT = new Set(["effects.js", "skins.js", "tokens.js", "testing.js"]);
const files = () =>
  readdirSync(APP)
    .filter(f => f.endsWith(".js") && !EXEMPT.has(f))
    .map(f => [f, readFileSync(join(APP, f), "utf8")]);

test("no motion curve or length written as a literal in the app's scripts", () => {
  const found = [];
  for (const [f, src] of files()) {
    for (const m of src.matchAll(/\beasing:\s*["'`][^"'`]*["'`]/g)) found.push(`${f}: ${m[0]}`);
    for (const m of src.matchAll(/\.transition\s*=\s*["'`]([^"'`]*)["'`]/g))
      if (/\d(?:m?s)\b|cubic-bezier|\bease\b|\blinear\b/.test(m[1].replace(/var\([^)]*\)/g, "")))
        found.push(`${f}: transition "${m[1]}"`);
    for (const m of src.matchAll(/\bbez\(\s*-?\.?\d/g)) found.push(`${f}: ${m[0]}`);
    /* a fade's curve passed by position: the content fades' helpers (rearrange.js fadeNow) */
    for (const m of src.matchAll(/\bfadeNow\([^;]*["'`](?:linear|ease[\w-]*)["'`]/g))
      found.push(`${f}: ${m[0].slice(0, 50)}`);
  }
  assert.deepEqual(
    found,
    [],
    "a timing literal — name its role: tokens.js ms() / easing(), or var(--role) in the string",
  );
});

test("every token a script reads exists in tokens.css", () => {
  const sheet = /** @type {Record<string, string>} */ (Reflect.get(globalThis, "KILN_TOKENS"));
  const missing = [];
  for (const [f, src] of [...files(), ["tokens.js", readFileSync(join(APP, "tokens.js"), "utf8")]])
    for (const m of src.matchAll(/\b(?:ms|easing|bezier|num|tok|curve)\(\s*"(--[\w-]+)"/g))
      if (!sheet?.[m[1]]) missing.push(`${f}: ${m[1]}`);
  for (const [f, src] of files())
    for (const m of src.matchAll(/["'`][^"'`]*var\((--(?:dur|ease|morph|lay)-[\w-]+)\)/g))
      if (!sheet?.[m[1]]) missing.push(`${f}: ${m[1]}`);
  assert.deepEqual(missing, [], "a token name with no token");
});
