// Unit tests for the layout's maths (app/layoutmath.js): no browser, just numbers — run with `npm run test:unit`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fitInBox, toolColumnW, pageGeometry, GAP, MMIN, PWMIN, CARDMAX } from "../../../app/layoutmath.js";

const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} ≠ ${b}`);
const wide = { pw: 680, rw: 660, iw: null }; // the default sizes

test("a picture fits its box: the side that hits first decides", () => {
  assert.deepEqual(fitInBox("3:4", 300, 300), { w: 225, h: 300 }); // a tall picture in a square: full height
  assert.deepEqual(fitInBox("16:9", 320, 1000), { w: 320, h: 180 }); // a wide one in a tall box: full width
});

test("the edit buttons' column grows a column when the picture is too short for them", () => {
  assert.equal(toolColumnW(600, 6), 52); // tall: one column (6 + 46)
  assert.equal(toolColumnW(100, 6), 144); // two buttons per column → three columns
  assert.equal(toolColumnW(20, 6), 282); // never less than one button per column
});

test("a wide window: your widths as set, the pair centred with even margins", () => {
  const g = pageGeometry({ W: 1477, gen: false, drag: false, minR: 420 }, wide);
  assert.equal(g.pw, 680);
  assert.equal(g.rw, 660);
  near(g.mL, g.mR, "the margins are even");
  near(g.mL + g.pw + GAP + g.rw + g.mR, 1477, "everything adds up to the window");
});

test("the prompt card never gets wider than CARDMAX", () => {
  assert.equal(pageGeometry({ W: 2500, gen: false, drag: false, minR: 420 }, { ...wide, pw: 1400 }).pw, CARDMAX);
});

test("too narrow: both give way in proportion, margins down to their minimum", () => {
  const g = pageGeometry({ W: 1000, gen: false, drag: false, minR: 420 }, wide);
  assert.ok(g.pw < 680 && g.rw < 660, "both shrank");
  near(g.pw / g.rw, 680 / 660, "in proportion");
  near(g.mL, MMIN, "the margins are what's left: their minimum");
});

test("very narrow: each stops at its own minimum, no margins", () => {
  const g = pageGeometry({ W: 700, gen: false, drag: false, minR: 420 }, wide);
  assert.equal(g.pw, PWMIN);
  assert.equal(g.rw, 420);
  assert.equal(g.mL, 0);
});

test("Generating: the area hugs the picture, within your cap", () => {
  const gen = { W: 1477, gen: true, drag: false, minR: 420 };
  assert.equal(pageGeometry({ ...gen, hug: 500 }, wide).rw, 500, "hugs the picture");
  assert.equal(pageGeometry({ ...gen, hug: 500 }, { ...wide, iw: 450 }).rw, 450, "but never past your cap");
  assert.equal(pageGeometry({ ...gen, hug: 300 }, wide).rw, 420, "and never narrower than its minimum");
});

test("Generating while an edge is dragged: your cap, not the picture's hug", () => {
  assert.equal(pageGeometry({ W: 1800, gen: true, drag: true, minR: 420, hug: 500 }, { ...wide, iw: 800 }).rw, 800);
});
