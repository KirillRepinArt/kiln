// Unit tests for the ownership tracer's blink rule (tools/tests/trace.mjs reversals) — the rule the tour enforces.
import { test } from "node:test";
import assert from "node:assert/strict";
import { reversals } from "../trace.mjs";

/** a series of opacities as the tracer's samples [_, left, top, width, height, opacity, ms] */
const series = (/** @type {number[]} */ ops) => ({ el: ops.map((o, i) => [0, 0, 0, 0, 0, o, i * 16]) });

test("a fade-through is no blink: out fully, then in (the user, 2026-11-07; Material's definition)", () => {
  assert.deepEqual(reversals(series([1, 0.6, 0.2, 0.01, 0.3, 0.8, 1])), []);
});

test("a blink still fails: a dip that doesn't reach 0, a flash, a dip after a fade-through", () => {
  assert.equal(reversals(series([1, 0.6, 0.3, 0.6, 1])).length, 1, "a dip while seen");
  assert.equal(reversals(series([0, 0.5, 1, 0.5, 0])).length, 1, "a flash: shown, then gone again");
  assert.equal(reversals(series([1, 0.01, 1, 0.5, 1])).length, 1, "through, then a dip");
});

test("positions: one that was fully gone between two appearances is two motions (a fade-through's place change)", () => {
  /* [_, left, top, width, height, opacity, ms]: seen at 700, gone, seen again at 370 riding to 440 */
  const rows = [
    [0, 720, 0, 0, 0, 1, 0],
    [0, 721, 0, 0, 0, 0.4, 16],
    [0, 721, 0, 0, 0, 0, 32],
    [0, 371, 0, 0, 0, 0, 48],
    [0, 371, 0, 0, 0, 0.3, 64],
    [0, 420, 0, 0, 0, 0.8, 80],
    [0, 442, 0, 0, 0, 1, 96],
  ];
  assert.deepEqual(reversals({ el: rows }), []);
  /* the same move back while seen is still a blink */
  const seen = rows.map(r => [...r.slice(0, 5), 1, r[6]]);
  assert.equal(reversals({ el: seen }).filter(x => x.what === "left").length, 1);
});
