// Unit tests for the layout's maths (app/layoutmath.js): no browser, just numbers — run with `npm run test:unit`.
import { pairGap } from "../../../app/tokens.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fitInBox,
  toolColumnW,
  pageGeometry,
  stackColumnW,
  framePlacement,
  shapeSteps,
  shapeBox,
  upgradeLayoutPrefs,
  promptSlotH,
  cardAnchorTop,
  cardHeightMode,
  cardPlacement,
  MMIN,
  PWMIN,
  CARDMAX,
} from "../../../app/layoutmath.js";

const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} ≠ ${b}`);
const wide = { pw: 680, rw: 660, iw: null }; // the default sizes

test("a picture fits its box: the side that hits first decides", () => {
  assert.deepEqual(fitInBox("3:4", 300, 300), { w: 225, h: 300 }); // a tall picture in a square: full height
  assert.deepEqual(fitInBox("16:9", 320, 1000), { w: 320, h: 180 }); // a wide one in a tall box: full width
});

test("the edit buttons' column grows a column when the picture is too short for them", () => {
  // 40 px buttons, the tight gap (8) between them and from the picture
  assert.equal(toolColumnW(600, 6), 56); // tall: one column (8 + 48)
  assert.equal(toolColumnW(100, 6), 152); // two buttons per column → three columns
  assert.equal(toolColumnW(20, 6), 296); // never less than one button per column
});

test("a wide window: your widths as set, the pair centred with even margins", () => {
  const g = pageGeometry({ W: 1477, gen: false, drag: false, minR: 420 }, wide);
  assert.equal(g.pw, 680);
  assert.equal(g.rw, 660);
  near(g.mL, g.mR, "the margins are even");
  near(g.mL + g.pw + pairGap() + g.rw + g.mR, 1477, "everything adds up to the window");
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

test("Vertical: the column is as wide as a 16:9 picture at its height, within the tab bar, the prompt and the window", () => {
  assert.equal(stackColumnW(2000, 420, 600, 450, 52), 904); // 450 × 16/9 = 800, + a 52 px button column each side
  assert.equal(stackColumnW(2000, 420, 1000, 450, 52), 1000, "never narrower than the prompt box");
  assert.equal(stackColumnW(700, 420, 600, 450, 52), 700, "never wider than the window");
});

test("the picture and its button column sit centred together; the column away from the prompt", () => {
  const a = { areaW: 1000, areaH: 800, w: 600, h: 450, tb: 52, row: 66, heldTop: null, stacked: false };
  const right = framePlacement({ ...a, toolsLeft: false }); // prompt on the left: the column on the picture's right
  assert.equal(right.left, 174); // (1000 − 600 − 52) / 2
  assert.equal(right.toolsX, 774, "the column right after the picture");
  const left = framePlacement({ ...a, toolsLeft: true }); // prompt on the right: the column on the left
  assert.equal(left.toolsX, 174);
  assert.equal(left.left, 226, "the picture after the column");
  assert.equal(right.top, (800 - 450 - 66) / 2, "centred above the status row's room");
});

test("a held top or bottom edge keeps the picture's top where it was", () => {
  const a = { areaW: 1000, areaH: 800, w: 600, h: 300, tb: 52, row: 66, stacked: false, toolsLeft: false };
  assert.equal(framePlacement({ ...a, heldTop: 40 }).top, 40);
});

test("Vertical: the picture itself is on the centre line", () => {
  const p = framePlacement({
    areaW: 1000,
    areaH: 800,
    w: 600,
    h: 450,
    tb: 52,
    row: 66,
    heldTop: null,
    stacked: true,
    toolsLeft: false,
  });
  assert.equal(p.left, 200);
});

test("older saved layouts become today's: shares of the window → px, once", () => {
  assert.deepEqual(upgradeLayoutPrefs({ pw: 0.4, rw: 0.5, iw: null, ih: 0.8, v: 2 }, 1500), {
    pw: 600,
    rw: 750,
    iw: null,
    ih: 0.8,
    v: 3,
  });
  const today = { pw: 680, rw: 660, iw: null, v: 3 };
  assert.equal(upgradeLayoutPrefs(today, 1500), today, "today's format is left alone");
  assert.equal(upgradeLayoutPrefs({ pw: 680, rw: 660, iw: null }, 1500).v, 3, "no version: already px, just labelled");
  assert.equal(upgradeLayoutPrefs(undefined, 1500), undefined, "nothing saved: nothing to do");
});

/* ---------- the prompt card ---------- */
const anchors = { it: 100, ib: 700, cy: 400 }; // picture top 100, status line 700, centre 400

test("Vertical: the prompt slot is yours, or ~42 % of the window (≤ 250), between 200 px and 70 % of it", () => {
  assert.equal(promptSlotH(0, 1000), 250, "default: 420 → capped at 250");
  assert.equal(promptSlotH(0, 400), 200, "never below 200");
  assert.equal(promptSlotH(600, 1000), 600, "yours");
  assert.equal(promptSlotH(900, 1000), 700, "never above 70 % of the window");
});

test("the card rests at the picture's top, centre or status line — inside the column", () => {
  assert.equal(cardAnchorTop("top", 300, 900, anchors), 100);
  assert.equal(cardAnchorTop("mid", 300, 900, anchors), 250, "centred on the picture");
  assert.equal(cardAnchorTop("bot", 300, 900, anchors), 400, "its bottom on the status line");
  assert.equal(cardAnchorTop("bot", 300, 900, { ...anchors, ib: 1200 }), 600, "never past the column's end");
  assert.equal(
    cardAnchorTop("mid", 300, 900, { it: null, ib: null, cy: null }),
    300,
    "no picture: the column's centre",
  );
});

test("height modes: Full = the column, Match = picture top to status line; too short → its least height, centred", () => {
  assert.deepEqual(cardHeightMode("full", 900, 40, 200, anchors), { top: 0, H: 860 });
  assert.deepEqual(cardHeightMode("match", 900, 40, 200, anchors), { top: 100, H: 560 });
  assert.deepEqual(cardHeightMode("match", 900, 40, 200, { it: 300, ib: 400, cy: 350 }), { top: 230, H: 200 });
});

test("the card: your height or its text's, within the room", () => {
  const c = { colH: 900, CH: 40, pos: "mid", frozen: false, prevTop: null, prevBottom: null, a: anchors };
  assert.equal(cardPlacement({ ...c, pph: 0, naturalH: 300 }).H, 300, "the text's");
  assert.equal(cardPlacement({ ...c, pph: 500, naturalH: 300 }).H, 500, "yours");
  assert.equal(cardPlacement({ ...c, pph: 100, naturalH: 300 }).H, 240, "yours, never under 240");
  assert.equal(cardPlacement({ ...c, pph: 0, naturalH: 2000 }).H, 860, "never more than the room");
});

test("frozen while you work: the top stays put and only the bottom grows (a bottom card grows upward)", () => {
  const c = { colH: 900, CH: 40, pph: 0, naturalH: 500, frozen: true, a: anchors };
  const mid = cardPlacement({ ...c, pos: "mid", prevTop: 200, prevBottom: 540 });
  assert.equal(mid.top, 200, "the top where it was");
  assert.equal(mid.bottom, 540, "the remembered bottom isn't moved");
  const bot = cardPlacement({ ...c, pos: "bot", prevTop: 200, prevBottom: 740 });
  assert.equal(bot.top + bot.H + 40, 740, "a bottom card keeps its bottom: it grew upward");
  const free = cardPlacement({ ...c, frozen: false, pos: "mid", prevTop: 200, prevBottom: 540 });
  assert.equal(free.top, 130, "not frozen: back to its resting place (centred on the picture)");
});

test("shapeSteps: a box changing shape crops first, swaps, then reveals (the one choreography)", () => {
  // a 1:1 empty frame into a 16:9 picture: the height shrinks, the width grows
  const o = { l: 0, t: 0, w: 600, h: 600 },
    n = { l: -100, t: 131, w: 800, h: 450 },
    st = shapeSteps(o, n);
  assert.ok(st.A > 0 && st.B > 0 && st.T === st.A + st.S + st.B);
  assert.deepEqual(st.q(st.A), [0, 1], "by the swap the shrinking axis is done and the growing one hasn't started");
  assert.deepEqual(st.q(st.T), [1, 1]);
  const atSwap = shapeBox(o, n, st.q(st.A));
  assert.equal(atSwap.h, 450, "when the new contents come in the box is already their height (no band above or below)");
  assert.equal(atSwap.w, 600);
  assert.equal(atSwap.l + atSwap.w / 2, 300, "…and each axis keeps its centre until it moves");
  // only a crop: one move, and the swap after it
  const c = shapeSteps({ w: 800, h: 600 }, { w: 400, h: 300 });
  assert.equal(c.B, 0);
  assert.deepEqual(c.q(c.A), [1, 1]);
  // the same size: nothing moves but the swap
  const s = shapeSteps({ w: 500, h: 500 }, { w: 500, h: 500 });
  assert.equal(s.T, s.S);
});
